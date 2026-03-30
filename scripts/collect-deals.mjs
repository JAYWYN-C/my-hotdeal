import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.resolve(__dirname, "../data/deals.json");
const sourcesPath = path.resolve(__dirname, "../config/sources.json");

const DEFAULT_USER_AGENT = "hotdeal-collector/1.1 (+github-actions)";
const REQUEST_DELAY_MS = 1000;
const FETCH_RETRY_COUNT = 3;
const MAX_ITEMS = 80;
const RECENT_WINDOW_HOURS = 336;
const DEFAULT_PAGE_ITEM_LIMIT = 40;
const DEFAULT_ITEM_TTL_HOURS = 72;
const SOURCE_TIMEZONE = "Asia/Seoul";
const SOURCE_TIMEZONE_OFFSET = "+09:00";

const FALLBACK_DEALS = [];

const dealKeywords = [
  "핫딜",
  "특가",
  "할인",
  "쿠폰",
  "상품권",
  "금액권",
  "기프티콘",
  "최저가",
  "타임세일",
  "초특가",
  "공동구매",
  "1+1",
  "세일"
];

const excludedKeywords = [
  "바이럴",
  "마케팅",
  "브랜딩",
  "사회공헌",
  "사옥",
  "인터뷰",
  "실적",
  "주가",
  "기념식",
  "공시",
  "리포트",
  "분석"
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  if (!value) return "";
  return value
    .replace(/^<!\[CDATA\[/i, "")
    .replace(/\]\]>$/i, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value) {
  return cleanText(String(value || "").replace(/<[^>]+>/g, " "));
}

function parseFirst(text, regex) {
  const match = text.match(regex);
  if (!match) return "";
  for (let i = 1; i < match.length; i += 1) {
    if (match[i]) return cleanText(match[i]);
  }
  return "";
}

function parseRssItems(xmlText) {
  const chunks = xmlText.match(/<item>([\s\S]*?)<\/item>/gi) || [];
  return chunks.map((itemXml) => ({
    title: parseFirst(itemXml, /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i),
    link: parseFirst(itemXml, /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i),
    pubDate: parseFirst(itemXml, /<pubDate>([\s\S]*?)<\/pubDate>/i)
  }));
}

function getCharsetLabel(contentType = "") {
  const match = contentType.match(/charset=([^;]+)/i);
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "utf-8";
}

async function readResponseText(response) {
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "";
  const asciiSample = buffer.toString("ascii", 0, 2048);
  const metaCharset = asciiSample.match(/charset=([a-z0-9_-]+)/i)?.[1];
  const charset = metaCharset || getCharsetLabel(contentType);

  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

async function fetchText(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= FETCH_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.7",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8"
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return readResponseText(response);
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_RETRY_COUNT) {
        await sleep(250 * attempt);
      }
    }
  }

  throw lastError || new Error("Unknown fetch error");
}

function toAbsoluteUrl(rawUrl, baseUrl) {
  try {
    return new URL(cleanText(rawUrl), baseUrl).toString();
  } catch {
    return "";
  }
}

function canonicalizeUrl(rawUrl) {
  try {
    const url = new URL(cleanText(rawUrl));
    url.hash = "";
    return url.toString();
  } catch {
    return cleanText(rawUrl);
  }
}

function isAllowedUrl(rawUrl, allowedDomains) {
  try {
    const url = new URL(cleanText(rawUrl));
    if (url.protocol !== "https:") return false;
    if (!allowedDomains || allowedDomains.length === 0) return true;
    return allowedDomains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function hasStructuredDealFormat(title) {
  const normalized = cleanText(title);
  return (
    /^\[[^\]]+\]\s*.+\((?:[^()]*\d|[^()]*무료|[^()]*무배|[^()]*배송)[^()]*\)$/.test(normalized) ||
    /\((?:[^()]*\d{1,3}(?:,\d{3})*원?|[^()]*무료|[^()]*무배|[^()]*배송)[^()]*\)$/.test(normalized)
  );
}

function isLikelyDeal(title) {
  const t = title.toLowerCase();
  const hasDealKeyword = dealKeywords.some((keyword) => t.includes(keyword.toLowerCase()));
  const hasExcludedKeyword = excludedKeywords.some((keyword) => t.includes(keyword.toLowerCase()));
  return (hasDealKeyword || hasStructuredDealFormat(title)) && !hasExcludedKeyword;
}

function isRecentItem(pubDate) {
  if (!pubDate) return false;
  const published = new Date(pubDate).getTime();
  if (Number.isNaN(published)) return false;
  const cutoff = Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000;
  return published >= cutoff;
}

function matchesIncludeKeywords(title, includeKeywords = []) {
  if (!includeKeywords || includeKeywords.length === 0) return true;
  const lowerTitle = title.toLowerCase();
  return includeKeywords.some((keyword) => lowerTitle.includes(String(keyword).toLowerCase()));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getKstToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SOURCE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

function toIsoInSourceTimezone(year, month, day, hour = 0, minute = 0, second = 0) {
  const safeYear = String(year).padStart(4, "0");
  const safeMonth = String(month).padStart(2, "0");
  const safeDay = String(day).padStart(2, "0");
  const safeHour = String(hour).padStart(2, "0");
  const safeMinute = String(minute).padStart(2, "0");
  const safeSecond = String(second).padStart(2, "0");
  return new Date(
    `${safeYear}-${safeMonth}-${safeDay}T${safeHour}:${safeMinute}:${safeSecond}${SOURCE_TIMEZONE_OFFSET}`
  ).toISOString();
}

function extractNearbyPubDate(html, startIndex = 0) {
  const snippet = html.slice(Math.max(0, startIndex - 180), Math.min(html.length, startIndex + 600));
  const absoluteMatch = snippet.match(
    /\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})(?:\s+([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?)?/
  );
  if (absoluteMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = absoluteMatch;
    return toIsoInSourceTimezone(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second));
  }

  const shortMatch = snippet.match(
    /\b(\d{2})[./-](\d{1,2})[./-](\d{1,2})(?:\s+([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?)?/
  );
  if (shortMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = shortMatch;
    return toIsoInSourceTimezone(2000 + Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second));
  }

  const timeOnlyMatch = snippet.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
  if (timeOnlyMatch) {
    const today = getKstToday();
    const [, hour, minute, second = "0"] = timeOnlyMatch;
    return toIsoInSourceTimezone(today.year, today.month, today.day, Number(hour), Number(minute), Number(second));
  }

  return "";
}

function timeTextToIso(timeText) {
  const match = cleanText(timeText).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return "";

  const today = getKstToday();
  const [, hour, minute, second = "0"] = match;
  return toIsoInSourceTimezone(today.year, today.month, today.day, Number(hour), Number(minute), Number(second));
}

function normalizeMetaChunk(metaText) {
  return cleanText(metaText)
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\b무배\b/g, "무료배송")
    .replace(/(\d),\s+(?=\d)/g, "$1,");
}

function normalizeSiteLabel(siteLabel) {
  return cleanText(siteLabel)
    .replace(/\.$/, "")
    .replace(/\s+/g, " ");
}

function normalizeProductLabel(productLabel) {
  return cleanText(productLabel)
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatUnifiedTitle(productLabel, detailParts) {
  const product = normalizeProductLabel(productLabel) || "핫딜";
  const parts = detailParts.map((part) => cleanText(part)).filter(Boolean);
  return `[${product}] (${parts.join(" / ")})`;
}

function stripLeadingNoise(title, prefixes = []) {
  let nextTitle = cleanText(title);
  const knownPrefixes = [...prefixes, "뽐뿌게시판", "해외뽐뿌", "알리뽐뿌", "쇼핑뽐뿌", "뽐뿌핫딜", "핫딜채널"];

  nextTitle = nextTitle.replace(/^\[(?:끌올|재업|종료임박|품절임박)\]\s*/i, "");
  nextTitle = nextTitle.replace(/^코인딜\)?\s*/i, "");

  for (const prefix of knownPrefixes.filter(Boolean)) {
    nextTitle = nextTitle.replace(new RegExp(`^${escapeRegExp(prefix)}\\s*`, "i"), "");
  }

  return nextTitle.trim();
}

function normalizeDealTitle(rawTitle, source = {}) {
  let title = stripLeadingNoise(stripTags(rawTitle), source.titlePrefixes || []);

  if (/^\[[^\]]+\]\s*\([^()]+\)$/.test(title)) {
    return title;
  }

  title = title
    .replace(/\s+-\s+[^-]+$/, "")
    .replace(/\s+\d+$/, "")
    .replace(/(\d),\s+(?=\d)/g, "$1,")
    .replace(/\s+/g, " ")
    .trim();

  const mallMatch = title.match(/^\[([^\]]+)\]\s*(.+?)(?:\s*\(([^()]+)\))?$/);
  if (mallMatch) {
    const [, mall, itemName, meta] = mallMatch;
    const detailParts = [];
    if (meta) detailParts.push(normalizeMetaChunk(meta));
    detailParts.push(normalizeSiteLabel(mall));
    return formatUnifiedTitle(itemName, detailParts);
  }

  const genericMetaMatch = title.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (genericMetaMatch && /(?:\d|무료|무배|배송|직배|쿠폰)/.test(genericMetaMatch[2])) {
    return formatUnifiedTitle(genericMetaMatch[1], [normalizeMetaChunk(genericMetaMatch[2]), normalizeSiteLabel(source.name)]);
  }

  return formatUnifiedTitle(title, [normalizeSiteLabel(source.name)]);
}

function inferCategory(title) {
  const t = title.toLowerCase();
  const gameElectronicsKeywords = ["닌텐도", "플스", "ps5", "모니터", "ssd", "갤럭시", "아이폰", "노트북", "전자", "게임"];
  const foodKeywords = ["라면", "밀키트", "치킨", "피자", "과자", "커피", "식품", "음식", "배달"];
  const voucherKeywords = ["기프티콘", "상품권", "금액권", "쿠폰", "할인권", "e카드"];

  if (voucherKeywords.some((k) => t.includes(k))) return "mobile-voucher";
  if (foodKeywords.some((k) => t.includes(k))) return "food";
  if (gameElectronicsKeywords.some((k) => t.includes(k))) return "game-electronics";
  return "game-electronics";
}

function inferEventTags(title) {
  const tags = [];
  const map = [
    ["삼성", "삼성행사"],
    ["닌텐도", "닌텐도프로모션"],
    ["배민", "배민쿠폰"],
    ["카드", "카드사이벤트"],
    ["라이브", "라이브특가"]
  ];

  for (const [needle, tag] of map) {
    if (title.includes(needle)) tags.push(tag);
  }

  if (tags.length === 0) tags.push("일반행사");
  return tags;
}

function estimatePrice(title) {
  const match = title.match(/([0-9]{1,3}(?:,\s*[0-9]{3})+|[0-9]{4,7})원?/);
  if (!match) return 0;
  return Number(match[1].replaceAll(",", "").replace(/\s+/g, ""));
}

function estimateDiscount(title) {
  const match = title.match(/([1-9][0-9]?)%/);
  return match ? Number(match[1]) : 0;
}

async function loadExistingDealsIndex() {
  try {
    const raw = await fs.readFile(dataPath, "utf-8");
    const json = JSON.parse(raw);
    const byUrl = new Map();
    const byFingerprint = new Map();

    for (const deal of json.deals || []) {
      if (deal.url) {
        byUrl.set(canonicalizeUrl(deal.url), deal);
      }
      if (deal.source && deal.title) {
        byFingerprint.set(`${deal.source}:${cleanText(deal.title).toLowerCase()}`, deal);
      }
    }

    return { byUrl, byFingerprint };
  } catch {
    return { byUrl: new Map(), byFingerprint: new Map() };
  }
}

async function loadSourceConfig() {
  const raw = await fs.readFile(sourcesPath, "utf-8");
  const json = JSON.parse(raw);
  const supportedTypes = new Set(["rss", "page"]);
  const sources = (json.sources || []).filter((source) => source.enabled && supportedTypes.has(source.type));
  return {
    mode: json.mode || "public-list-only",
    policyVersion: json.policyVersion || "1.1.0",
    sources
  };
}

function findExistingDeal(existingIndex, sourceName, title, link) {
  return (
    existingIndex.byUrl.get(canonicalizeUrl(link)) ||
    existingIndex.byFingerprint.get(`${sourceName}:${cleanText(title).toLowerCase()}`) ||
    null
  );
}

function resolvePublishedTime(item, existingDeal, fallbackRank = 0) {
  const explicitTime = new Date(item.pubDate).getTime();
  if (!Number.isNaN(explicitTime)) return explicitTime;

  const previousTime = new Date(existingDeal?.createdAt || "").getTime();
  if (!Number.isNaN(previousTime)) return previousTime;

  return Date.now() - fallbackRank * 60 * 1000;
}

function normalize(items, existingIndex) {
  const dedup = new Set();
  const now = Date.now();

  return items
    .map((item, idx) => {
      const title = normalizeDealTitle(item.title, item.sourceConfig);
      const link = canonicalizeUrl(item.link);
      const existingDeal = findExistingDeal(existingIndex, item.source, title, link);
      const publishedTime = resolvePublishedTime(item, existingDeal, item.rank ?? idx);
      return { ...item, title, link, existingDeal, publishedTime };
    })
    .filter((item) => item.title && item.link && isRecentItem(new Date(item.publishedTime).toISOString()))
    .filter((item) => {
      const key = item.link || `${item.source}:${item.title}`;
      if (dedup.has(key)) return false;
      dedup.add(key);
      return true;
    })
    .sort((a, b) => b.publishedTime - a.publishedTime)
    .slice(0, MAX_ITEMS)
    .map((item, idx) => {
      const createdAt = new Date(item.publishedTime).toISOString();
      const existingExpires = new Date(item.existingDeal?.expiresAt || "").getTime();
      const defaultEnd = item.publishedTime + 1000 * 60 * 60 * DEFAULT_ITEM_TTL_HOURS;
      const expiresAt = new Date(Math.max(now + 1000 * 60 * 60 * 3, defaultEnd, Number.isNaN(existingExpires) ? 0 : existingExpires)).toISOString();
      return {
        id: idx + 1,
        title: item.title,
        category: inferCategory(item.title),
        source: item.source,
        price: estimatePrice(item.title),
        discount: estimateDiscount(item.title),
        createdAt,
        expiresAt,
        eventTags: inferEventTags(item.title),
        url: item.link
      };
    });
}

function parsePpomppuBoard(html, source) {
  const items = [];
  const seen = new Set();
  const rowPattern = /<tr[^>]+class=['"][^'"]*\bbaseList\b[^'"]*['"][\s\S]*?<\/tr>/gi;
  const linkPattern =
    /<a[^>]+class=['"]baseList-title[^'"]*['"][^>]+href=(["'])([^"']*view\.php\?id=([^"'&]+)[^"']*?(?:&amp;|&)no=(\d+)[^"']*)\1[^>]*>([\s\S]*?)<\/a>/i;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const rowHtml = rowMatch[0];
    const match = rowHtml.match(linkPattern);
    if (!match) continue;

    const boardId = cleanText(match[3]);
    if (source.boardId && boardId !== source.boardId) continue;

    const link = toAbsoluteUrl(match[2], source.listUrl);
    const title = stripTags(match[5]).replace(/\s+\d+$/, "");
    if (!title || title.length < 4 || seen.has(link)) continue;

    const timeText = parseFirst(rowHtml, /<time[^>]+class=['"]baseList-time['"][^>]*>([^<]+)<\/time>/i);
    seen.add(link);
    items.push({
      title,
      link,
      pubDate: timeTextToIso(timeText) || extractNearbyPubDate(rowHtml, 0),
      rank: items.length
    });

    if (items.length >= (source.maxItems || DEFAULT_PAGE_ITEM_LIMIT)) break;
  }

  return items;
}

function parseArcaBoard(html, source) {
  const items = [];
  const seen = new Set();
  const channelName = source.channel || "hotdeal";
  const hrefPattern = new RegExp(
    `<a[^>]+href=(["'])((?:https?:\\/\\/[^"'<>]+)?\\/b\\/${escapeRegExp(channelName)}\\/(\\d+)(?:\\?[^"'<>]*)?)\\1[^>]*>([\\s\\S]*?)<\\/a>`,
    "gi"
  );

  for (const match of html.matchAll(hrefPattern)) {
    const link = toAbsoluteUrl(match[2], source.listUrl);
    const title = stripTags(match[4]).replace(/\s+\d+$/, "");
    if (!title || title.length < 4 || seen.has(link)) continue;

    seen.add(link);
    items.push({
      title,
      link,
      pubDate: extractNearbyPubDate(html, match.index ?? 0),
      rank: items.length
    });

    if (items.length >= (source.maxItems || DEFAULT_PAGE_ITEM_LIMIT)) break;
  }

  return items;
}

async function collectSourceItems(source) {
  if (source.type === "rss") {
    const xml = await fetchText(source.feedUrl);
    return parseRssItems(xml).map((item, idx) => ({
      ...item,
      link: toAbsoluteUrl(item.link, source.feedUrl),
      rank: idx
    }));
  }

  if (source.type === "page") {
    const html = await fetchText(source.listUrl);
    if (source.collector === "ppomppu-board") return parsePpomppuBoard(html, source);
    if (source.collector === "arca-board") return parseArcaBoard(html, source);
    throw new Error(`Unsupported collector: ${source.collector || "unknown"}`);
  }

  throw new Error(`Unsupported source type: ${source.type}`);
}

function filterCollectedItems(items, source) {
  return items
    .map((item) => ({
      ...item,
      title: normalizeDealTitle(item.title, source),
      link: canonicalizeUrl(item.link),
      source: source.name,
      sourceConfig: source
    }))
    .filter((item) => item.title && item.link)
    .filter((item) => isAllowedUrl(item.link, source.allowedDomains || []))
    .filter((item) => isLikelyDeal(item.title))
    .filter((item) => matchesIncludeKeywords(item.title, source.includeKeywords || []));
}

async function collectFromSources(sourceConfig) {
  const merged = [];
  const compliance = [];

  for (const source of sourceConfig.sources) {
    try {
      const items = filterCollectedItems(await collectSourceItems(source), source);
      merged.push(...items);
      compliance.push({ source: source.name, status: "ok", collected: items.length });
    } catch (error) {
      compliance.push({ source: source.name, status: "error", message: error.message });
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return { items: merged, compliance };
}

async function main() {
  const sourceConfig = await loadSourceConfig();
  const existingIndex = await loadExistingDealsIndex();
  const { items, compliance } = await collectFromSources(sourceConfig);
  const normalized = normalize(items, existingIndex);
  const deals = normalized.length > 0 ? normalized : FALLBACK_DEALS;

  const payload = {
    generatedAt: new Date().toISOString(),
    policy: {
      mode: sourceConfig.mode,
      policyVersion: sourceConfig.policyVersion,
      sourceCount: sourceConfig.sources.length,
      recentWindowHours: RECENT_WINDOW_HOURS
    },
    compliance,
    deals
  };

  await fs.writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  console.log(`[collect] saved ${deals.length} deals to ${dataPath}`);
}

main().catch((error) => {
  console.error("[collect] fatal", error);
  process.exitCode = 1;
});
