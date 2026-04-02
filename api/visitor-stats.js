function setCommonHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

function sanitizeHost(value) {
  return String(value || "local")
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/[^a-z0-9.-]/g, "");
}

module.exports = async (req, res) => {
  setCommonHeaders(res);

  if (req.method && req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const domain = sanitizeHost(req.headers["x-forwarded-host"] || req.headers.host);
  const url = `https://visitor.6developer.com/visit?domain=${encodeURIComponent(domain)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: "upstream_error", status: response.status }));
      return;
    }

    const payload = await response.json();
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        today: Number(payload?.todayCount) || 0,
        total: Number(payload?.totalCount) || 0,
      })
    );
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
