function setCommonHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
}

function readConfigFromEnv() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };
}

function getMissingKeys(config) {
  const missing = [];
  if (!config.apiKey) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!config.authDomain) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!config.projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!config.appId) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  return missing;
}

module.exports = async (req, res) => {
  setCommonHeaders(res);

  if (req.method && req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }

  const config = readConfigFromEnv();
  const missingKeys = getMissingKeys(config);
  const configured = missingKeys.length === 0;

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      configured,
      config: configured ? config : {},
      missingKeys,
    })
  );
};
