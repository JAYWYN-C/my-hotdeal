function setCommonHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

function parseCookies(req) {
  const raw = req.headers?.cookie || "";
  const result = {};
  raw.split(";").forEach((chunk) => {
    const [k, ...rest] = chunk.trim().split("=");
    if (!k) return;
    result[k] = decodeURIComponent(rest.join("="));
  });
  return result;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function makeSessionCookie(value, maxAgeSeconds, isSecure) {
  const parts = [
    `hotdeal_session=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (isSecure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

async function verifyFirebaseIdToken(idToken, apiKey) {
  const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new Error(`identity_lookup_failed:${response.status}`);
  }

  const data = await response.json();
  const user = Array.isArray(data?.users) ? data.users[0] : null;
  if (!user?.localId) {
    throw new Error("invalid_user_payload");
  }

  return {
    uid: user.localId,
    email: user.email || "",
  };
}

module.exports = async (req, res) => {
  setCommonHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const isSecure =
    String(req.headers["x-forwarded-proto"] || "").includes("https") || process.env.NODE_ENV === "production";

  if (req.method === "GET") {
    const cookies = parseCookies(req);
    const current = cookies.hotdeal_session;
    if (!current) {
      res.statusCode = 200;
      res.end(JSON.stringify({ authenticated: false }));
      return;
    }

    try {
      const payload = JSON.parse(Buffer.from(current, "base64url").toString("utf8"));
      if (!payload?.uid || !payload?.exp || Date.now() >= payload.exp) {
        res.setHeader("Set-Cookie", makeSessionCookie("", 0, isSecure));
        res.statusCode = 200;
        res.end(JSON.stringify({ authenticated: false }));
        return;
      }

      res.statusCode = 200;
      res.end(JSON.stringify({ authenticated: true, user: { uid: payload.uid, email: payload.email || "" } }));
      return;
    } catch {
      res.setHeader("Set-Cookie", makeSessionCookie("", 0, isSecure));
      res.statusCode = 200;
      res.end(JSON.stringify({ authenticated: false }));
      return;
    }
  }

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", makeSessionCookie("", 0, isSecure));
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "firebase_api_key_missing" }));
    return;
  }

  const body = await readJsonBody(req);
  const idToken = String(body?.idToken || "");
  if (!idToken) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "id_token_required" }));
    return;
  }

  try {
    const user = await verifyFirebaseIdToken(idToken, apiKey);
    const exp = Date.now() + 60 * 60 * 1000;
    const sessionPayload = Buffer.from(JSON.stringify({ ...user, exp }), "utf8").toString("base64url");

    res.setHeader("Set-Cookie", makeSessionCookie(sessionPayload, 60 * 60, isSecure));
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, user }));
  } catch (error) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "invalid_id_token",
        message: error instanceof Error ? error.message : "unknown",
      })
    );
  }
};
