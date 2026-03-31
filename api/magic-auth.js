const crypto = require("crypto");

function setCommonHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
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

function getOrigin(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host) {
    return "";
  }
  return `${forwardedProto}://${host}`;
}

function makeMagicToken(email) {
  const secret = process.env.MAGIC_LINK_SECRET || process.env.AUTH_SESSION_SECRET || "hotdeal-dev-magic-secret";

  const payload = {
    email: String(email || "").toLowerCase(),
    exp: Date.now() + 15 * 60 * 1000,
    nonce: crypto.randomBytes(12).toString("hex"),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("hex");
  return `${encodedPayload}.${signature}`;
}

async function sendViaResend({ to, url }) {
  const apiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.AUTH_FROM_EMAIL || process.env.ALERT_FROM_EMAIL || "";

  if (!apiKey || !from) {
    return { delivered: false, reason: "resend_not_configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "자취핫딜 로그인 링크",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6;">
          <h2>자취핫딜 로그인</h2>
          <p>아래 버튼을 눌러 15분 안에 로그인하세요.</p>
          <p><a href="${url}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#1138d8;color:#fff;text-decoration:none;">로그인하기</a></p>
          <p>버튼이 안 열리면 아래 주소를 복사해 브라우저에 붙여넣으세요.</p>
          <p>${url}</p>
        </div>
      `,
      text: `자취핫딜 로그인 링크 (15분 유효): ${url}`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`resend_failed:${response.status}:${body}`);
  }

  return { delivered: true };
}

module.exports = async (req, res) => {
  setCommonHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const body = await readJsonBody(req);
  const email = String(body?.email || "").trim().toLowerCase();
  const redirectPath = String(body?.redirectPath || "/").startsWith("/") ? String(body?.redirectPath || "/") : "/";

  if (!email || !email.includes("@")) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "valid_email_required" }));
    return;
  }

  try {
    const token = makeMagicToken(email);
    const origin = getOrigin(req);
    const url = `${origin}${redirectPath}${redirectPath.includes("?") ? "&" : "?"}magic_token=${encodeURIComponent(token)}`;

    let delivery = { delivered: false, reason: "email_provider_not_configured" };
    try {
      delivery = await sendViaResend({ to: email, url });
    } catch (error) {
      delivery = { delivered: false, reason: error instanceof Error ? error.message : "email_send_failed" };
    }

    // If mail provider is missing, return the link so setup/test can continue.
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        ok: true,
        delivered: Boolean(delivery.delivered),
        delivery,
        magicLink: delivery.delivered ? undefined : url,
      })
    );
  } catch (error) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: "magic_auth_failed",
        message: error instanceof Error ? error.message : "unknown",
      })
    );
  }
};
