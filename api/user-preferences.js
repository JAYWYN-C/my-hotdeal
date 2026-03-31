function setCommonHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

function getRedisClient() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  if (!url || !token) {
    return null;
  }

  try {
    const { Redis } = require("@upstash/redis");
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

const redisClient = getRedisClient();
const memoryStore = global.__HOTDEAL_PREFS_STORE__ || new Map();
global.__HOTDEAL_PREFS_STORE__ = memoryStore;

function userPrefKey(uid) {
  return `hotdeal:userPreferences:${uid}`;
}

function defaultPreference(email = "") {
  return {
    bookmarks: [],
    alertKeywords: [],
    emailAlertsEnabled: false,
    email,
    updatedAt: Date.now(),
  };
}

async function readPreference(uid, email) {
  if (redisClient) {
    try {
      const raw = await redisClient.get(userPrefKey(uid));
      if (!raw) {
        return { storage: "kv", data: defaultPreference(email) };
      }

      if (typeof raw === "string") {
        return { storage: "kv", data: JSON.parse(raw) };
      }

      return { storage: "kv", data: raw };
    } catch {
      // Fallback to memory mode when KV is temporarily unavailable.
    }
  }

  return {
    storage: "memory",
    data: memoryStore.get(uid) || defaultPreference(email),
  };
}

async function writePreference(uid, data) {
  if (redisClient) {
    try {
      await redisClient.set(userPrefKey(uid), JSON.stringify(data));
      return "kv";
    } catch {
      // Fallback to memory mode when KV is temporarily unavailable.
    }
  }

  memoryStore.set(uid, data);
  return "memory";
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
    const result = await readPreference(session.uid, session.email || "");
    const data = result.data;
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, storage: result.storage, data }));
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const body = await readJsonBody(req);
  const prevResult = await readPreference(session.uid, session.email || "");
  const prev = prevResult.data || {};

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

  const storage = await writePreference(session.uid, next);
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, storage, data: next }));
};
