const crypto = require("crypto");

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

function getMagicSecret() {
  return process.env.MAGIC_LINK_SECRET || process.env.AUTH_SESSION_SECRET || "hotdeal-dev-magic-secret";
}

function signPayload(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyMagicToken(magicToken) {
  const secret = getMagicSecret();
  if (!secret) {
    throw new Error("magic_secret_missing");
  }

  const parts = String(magicToken || "").split(".");
  if (parts.length !== 2) {
    throw new Error("invalid_magic_token");
  }

  const [encodedPayload, signature] = parts;
  const expected = signPayload(encodedPayload, secret);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("invalid_magic_signature");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  if (!payload?.email || !payload?.exp || Date.now() >= payload.exp) {
    throw new Error("expired_magic_token");
  }

  const uid = `mail_${crypto.createHash("sha256").update(String(payload.email)).digest("hex").slice(0, 24)}`;
  return { uid, email: String(payload.email).toLowerCase() };
}

function readSessionFromCookie(req) {
  const cookies = parseCookies(req);
  const current = cookies.hotdeal_session;
  if (!current) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(current, "base64url").toString("utf8"));
    if (!payload?.uid || !payload?.exp || Date.now() >= payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
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
    const payload = readSessionFromCookie(req);
    if (!payload) {
      res.setHeader("Set-Cookie", makeSessionCookie("", 0, isSecure));
      res.statusCode = 200;
      res.end(JSON.stringify({ authenticated: false }));
      return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ authenticated: true, user: { uid: payload.uid, email: payload.email || "" } }));
    return;
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

  const body = await readJsonBody(req);
  const magicToken = String(body?.magicToken || "");
  const idToken = String(body?.idToken || "");

  try {
    let user = null;
    if (magicToken) {
      user = verifyMagicToken(magicToken);
    } else if (idToken) {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
      if (!apiKey) {
        throw new Error("firebase_api_key_missing");
      }
      user = await verifyFirebaseIdToken(idToken, apiKey);
    } else {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "auth_token_required" }));
      return;
    }

    const exp = Date.now() + 24 * 60 * 60 * 1000;
    const sessionPayload = Buffer.from(JSON.stringify({ ...user, exp }), "utf8").toString("base64url");
    res.setHeader("Set-Cookie", makeSessionCookie(sessionPayload, 24 * 60 * 60, isSecure));
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, user }));
  } catch (error) {
    res.statusCode = 401;
    res.end(
      JSON.stringify({
        error: "invalid_auth_token",
        message: error instanceof Error ? error.message : "unknown",
      })
    );
  }
};
