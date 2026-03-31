const COUNT_API_BASE = "https://api.countapi.xyz";

function setCommonHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

function sanitizeHost(value) {
  return String(value || "local")
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/[^a-z0-9-]/g, "-");
}

function getCounterKey(scope, date) {
  if (scope === "today") {
    return /^20\d{2}-\d{2}-\d{2}$/.test(date) ? `visitors-${date}` : null;
  }
  if (scope === "total") {
    return "visitors-total";
  }
  return null;
}

module.exports = async (req, res) => {
  setCommonHeaders(res);

  if (req.method && req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const mode = req.query?.mode === "hit" ? "hit" : "get";
  const scope = req.query?.scope === "today" ? "today" : req.query?.scope === "total" ? "total" : "";
  const date = String(req.query?.date || "");
  const key = getCounterKey(scope, date);

  if (!key) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "invalid_scope" }));
    return;
  }

  const namespace = `jachwi-hotdeal-${sanitizeHost(req.headers.host)}`;
  const url = `${COUNT_API_BASE}/${mode}/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: "upstream_error", status: response.status }));
      return;
    }

    const payload = await response.json();
    res.statusCode = 200;
    res.end(JSON.stringify({ value: Number(payload?.value) || 0 }));
  } catch (error) {
    res.statusCode = 502;
    res.end(
      JSON.stringify({
        error: "upstream_fetch_failed",
        message: error instanceof Error ? error.message : "unknown",
      })
    );
  }
};
