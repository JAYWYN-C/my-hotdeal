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

const memoryStore = global.__HOTDEAL_PREFS_STORE__ || new Map();
global.__HOTDEAL_PREFS_STORE__ = memoryStore;

module.exports = async (req, res) => {
  setCommonHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const session = readSessionFromCookie(req);
  if (!session?.uid) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  if (req.method === "GET") {
    const data = memoryStore.get(session.uid) || {
      bookmarks: [],
      alertKeywords: [],
      emailAlertsEnabled: false,
      email: session.email || "",
      updatedAt: Date.now(),
    };
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, data }));
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const body = await readJsonBody(req);
  const prev = memoryStore.get(session.uid) || {};

  const next = {
    bookmarks: Array.isArray(body?.bookmarks)
      ? body.bookmarks.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : Array.isArray(prev.bookmarks)
        ? prev.bookmarks
        : [],
    alertKeywords: Array.isArray(body?.alertKeywords)
      ? body.alertKeywords.map((value) => String(value)).filter((value) => value.length > 0)
      : Array.isArray(prev.alertKeywords)
        ? prev.alertKeywords
        : [],
    emailAlertsEnabled:
      typeof body?.emailAlertsEnabled === "boolean"
        ? body.emailAlertsEnabled
        : typeof prev.emailAlertsEnabled === "boolean"
          ? prev.emailAlertsEnabled
          : false,
    email: session.email || prev.email || "",
    updatedAt: Date.now(),
  };

  memoryStore.set(session.uid, next);
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, data: next }));
};
