import fs from "node:fs/promises";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

function normalizeKeyword(keyword) {
  return String(keyword ?? "").trim().toLowerCase();
}

export function getDealUrl(deal) {
  return String(deal?.originalUrl || deal?.url || deal?.purchaseUrl || "").trim();
}

function getDealIdentity(deal) {
  return getDealUrl(deal) || `${deal?.title || ""}|${deal?.platform || ""}|${deal?.createdAt || ""}`;
}

export function selectNewDeals({ currentDeals = [], previousDeals = [] }) {
  const previousKeys = new Set(previousDeals.map((deal) => getDealIdentity(deal)).filter(Boolean));
  return currentDeals.filter((deal) => !previousKeys.has(getDealIdentity(deal)));
}

export function buildDeliveryKey({ uid, dealUrl, keyword }) {
  return crypto
    .createHash("sha1")
    .update(`${uid}\n${dealUrl}\n${normalizeKeyword(keyword)}`)
    .digest("hex");
}

function dealMatchesKeyword(deal, keyword) {
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) {
    return false;
  }

  const haystack = [
    deal.title,
    deal.productName,
    deal.summary,
    deal.source,
    deal.platform,
    deal.category,
    ...(Array.isArray(deal.summaryPoints) ? deal.summaryPoints : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedKeyword);
}

export function selectMatchingAlerts({ deals = [], subscriptions = [], deliveries = [] }) {
  const existingDeliveries = new Set(
    deliveries
      .map((item) => item.deliveryKey || buildDeliveryKey({ uid: item.uid, dealUrl: item.dealUrl, keyword: item.keyword }))
      .filter(Boolean)
  );

  const alerts = [];

  subscriptions.forEach((subscription) => {
    if (!subscription?.uid || !subscription?.email || !subscription?.emailAlertsEnabled) {
      return;
    }

    const keywords = Array.isArray(subscription.alertKeywords) ? subscription.alertKeywords : [];
    const normalizedKeywords = keywords.map((keyword) => String(keyword).trim()).filter(Boolean);
    if (normalizedKeywords.length === 0) {
      return;
    }

    deals.forEach((deal) => {
      const dealUrl = getDealUrl(deal);
      if (!dealUrl) {
        return;
      }

      normalizedKeywords.forEach((keyword) => {
        if (!dealMatchesKeyword(deal, keyword)) {
          return;
        }

        const deliveryKey = buildDeliveryKey({ uid: subscription.uid, dealUrl, keyword });
        if (existingDeliveries.has(deliveryKey)) {
          return;
        }

        existingDeliveries.add(deliveryKey);
        alerts.push({
          uid: subscription.uid,
          email: subscription.email,
          keyword,
          deliveryKey,
          dealUrl,
          deal,
        });
      });
    });
  });

  return alerts;
}

export function formatAlertEmail(alert) {
  const deal = alert.deal;
  const price = deal.priceText || (deal.price ? `${deal.price}` : "가격 확인");
  const shipping = deal.shipping || "배송 정보 확인";
  const purchaseUrl = deal.purchaseUrl || "";
  const originalUrl = deal.originalUrl || deal.url || "";
  const subject = `[자취생 핫딜.zip] ${alert.keyword} 키워드 매칭 - ${deal.title}`;

  const lines = [
    `${deal.title}`,
    `가격: ${price}`,
    `배송: ${shipping}`,
    `플랫폼: ${deal.platform || "정보 없음"}`,
    `출처: ${deal.source || "정보 없음"}`,
    `업데이트: ${deal.createdAt || "정보 없음"}`,
    purchaseUrl ? `구매 링크: ${purchaseUrl}` : "",
    originalUrl ? `원본글: ${originalUrl}` : "",
  ].filter(Boolean);

  const text = lines.join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1d1d1f">
      <h2 style="margin:0 0 12px">${escapeHtml(deal.title)}</h2>
      <p style="margin:0 0 8px"><strong>가격</strong>: ${escapeHtml(price)}</p>
      <p style="margin:0 0 8px"><strong>배송</strong>: ${escapeHtml(shipping)}</p>
      <p style="margin:0 0 8px"><strong>플랫폼</strong>: ${escapeHtml(deal.platform || "정보 없음")}</p>
      <p style="margin:0 0 8px"><strong>출처</strong>: ${escapeHtml(deal.source || "정보 없음")}</p>
      <p style="margin:0 0 16px"><strong>업데이트</strong>: ${escapeHtml(deal.createdAt || "정보 없음")}</p>
      ${purchaseUrl ? `<p style="margin:0 0 8px"><a href="${escapeHtml(purchaseUrl)}">구매하러 가기</a></p>` : ""}
      ${originalUrl ? `<p style="margin:0"><a href="${escapeHtml(originalUrl)}">원본글 보러가기</a></p>` : ""}
    </div>
  `.trim();

  return { subject, text, html };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    current: "data/deals.json",
    previous: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--current") {
      options.current = argv[index + 1] || options.current;
      index += 1;
    } else if (arg === "--previous") {
      options.previous = argv[index + 1] || "";
      index += 1;
    }
  }

  return options;
}

async function readDealsPayload(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  const payload = JSON.parse(raw);
  return Array.isArray(payload?.deals) ? payload : { deals: [] };
}

function getRuntimeConfig(env = process.env) {
  const config = {
    projectId: env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || "",
    clientEmail: env.FIREBASE_CLIENT_EMAIL || "",
    privateKey: env.FIREBASE_PRIVATE_KEY ? env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") : "",
    resendApiKey: env.RESEND_API_KEY || "",
    alertFromEmail: env.ALERT_FROM_EMAIL || "",
    alertFromName: env.ALERT_FROM_NAME || "자취생 핫딜.zip",
  };

  const ready =
    Boolean(config.projectId) &&
    Boolean(config.clientEmail) &&
    Boolean(config.privateKey) &&
    Boolean(config.resendApiKey) &&
    Boolean(config.alertFromEmail);

  return { ...config, ready };
}

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

async function getGoogleAccessToken({ clientEmail, privateKey }) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: issuedAt + 3600,
    iat: issuedAt,
  };

  const unsignedToken = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(claim))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsignedToken), privateKey).toString("base64url");
  const assertion = `${unsignedToken}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch Google access token (${response.status}): ${body}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function firestoreRequest({ projectId, accessToken, path, method = "GET", body, query = "" }) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}${query}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
}

function fromFirestoreValue(value) {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.nullValue !== undefined) return null;
  if (value.arrayValue !== undefined) {
    return (value.arrayValue.values || []).map((item) => fromFirestoreValue(item));
  }
  if (value.mapValue !== undefined) {
    return fromFirestoreFields(value.mapValue.fields || {});
  }
  return undefined;
}

function fromFirestoreFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)])
  );
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: toFirestoreFields(value) } };
  }
  return { stringValue: String(value) };
}

function toFirestoreFields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]));
}

async function listUserPreferences({ projectId, accessToken }) {
  const subscriptions = [];
  let pageToken = "";

  do {
    const query = `?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const response = await firestoreRequest({
      projectId,
      accessToken,
      path: "userPreferences",
      query,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to list userPreferences (${response.status}): ${body}`);
    }

    const payload = await response.json();
    (payload.documents || []).forEach((document) => {
      const uid = document.name.split("/").pop();
      subscriptions.push({
        uid,
        ...fromFirestoreFields(document.fields || {}),
      });
    });
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return subscriptions;
}

async function hasDeliveryRecord({ projectId, accessToken, deliveryKey }) {
  const response = await firestoreRequest({
    projectId,
    accessToken,
    path: `alertDeliveries/${deliveryKey}`,
  });

  if (response.status === 404) {
    return false;
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch alertDeliveries/${deliveryKey} (${response.status}): ${body}`);
  }
  return true;
}

async function saveDeliveryRecord({ projectId, accessToken, alert }) {
  const response = await firestoreRequest({
    projectId,
    accessToken,
    path: `alertDeliveries/${alert.deliveryKey}`,
    method: "PATCH",
    body: {
      fields: toFirestoreFields({
        uid: alert.uid,
        email: alert.email,
        keyword: alert.keyword,
        dealUrl: alert.dealUrl,
        title: alert.deal.title,
        createdAt: new Date().toISOString(),
      }),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to save delivery record (${response.status}): ${body}`);
  }
}

async function sendEmail({ resendApiKey, alertFromEmail, alertFromName, alert }) {
  const { subject, text, html } = formatAlertEmail(alert);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${alertFromName} <${alertFromEmail}>`,
      to: [alert.email],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send email (${response.status}): ${body}`);
  }
}

export async function main(options = {}) {
  const args = {
    ...parseArgs(),
    ...options,
  };

  const currentPayload = await readDealsPayload(args.current);
  const previousPayload = args.previous ? await readDealsPayload(args.previous) : { deals: [] };
  const newDeals = selectNewDeals({
    currentDeals: currentPayload.deals || [],
    previousDeals: previousPayload.deals || [],
  });

  if (newDeals.length === 0) {
    console.log("No new deals found for keyword alerts.");
    return { sent: 0, matched: 0, newDeals: 0, skipped: true };
  }

  const config = getRuntimeConfig();
  if (!config.ready) {
    console.log("Skipping keyword alerts because Firebase or email secrets are not configured.");
    return { sent: 0, matched: 0, newDeals: newDeals.length, skipped: true };
  }

  const accessToken = await getGoogleAccessToken(config);
  const subscriptions = await listUserPreferences({
    projectId: config.projectId,
    accessToken,
  });
  const candidateAlerts = selectMatchingAlerts({
    deals: newDeals,
    subscriptions,
    deliveries: [],
  });

  let sent = 0;
  let deduped = 0;

  for (const alert of candidateAlerts) {
    if (await hasDeliveryRecord({ projectId: config.projectId, accessToken, deliveryKey: alert.deliveryKey })) {
      deduped += 1;
      continue;
    }

    await sendEmail({
      resendApiKey: config.resendApiKey,
      alertFromEmail: config.alertFromEmail,
      alertFromName: config.alertFromName,
      alert,
    });
    await saveDeliveryRecord({ projectId: config.projectId, accessToken, alert });
    sent += 1;
  }

  console.log(
    `Keyword alerts checked ${candidateAlerts.length} matches across ${newDeals.length} new deals. Sent ${sent}, skipped ${deduped}.`
  );

  return { sent, matched: candidateAlerts.length, newDeals: newDeals.length, skipped: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
