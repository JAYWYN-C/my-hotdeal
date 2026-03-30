import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.resolve(__dirname, "../data/deals.json");
const sourcesPath = path.resolve(__dirname, "../config/sources.json");

const REQUEST_DELAY_MS = 1000;
const MAX_ITEMS = 80;

const FALLBACK_DEALS = [
  {
    id: 1,
    title: "샘플 딜: 수집 결과가 없어 폴백 데이터 표시",
    category: "mobile-voucher",
    source: "샘플",
    price: 0,
    discount: 0,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(),
    eventTags: ["일반행사"],
    url: "https://example.com"
  }
];

const dealKeywords = [
  "특가",
  "할인",
  "쿠폰",
  "상품권",
  "금액권",
  "기프티콘",
  "1+1",
  "행사",
  "세일",
  "%",
  "원"
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
    .replace(/\s+/g, " ")
    .trim();
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

function isAllowedUrl(rawUrl, allowedDomains) {
  try {
    const url = new URL(cleanText(rawUrl));
    if (url.protocol !== "https:") return false;
    return allowedDomains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function isLikelyDeal(title) {
  const t = title.toLowerCase();
  return dealKeywords.some((keyword) => t.includes(keyword.toLowerCase()));
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
  const match = title.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,7})원?/);
  if (!match) return 0;
  return Number(match[1].replaceAll(",", ""));
}

function estimateDiscount(title) {
  const match = title.match(/([1-9][0-9]?)%/);
  return match ? Number(match[1]) : 0;
}

async function loadSourceConfig() {
  const raw = await fs.readFile(sourcesPath, "utf-8");
  const json = JSON.parse(raw);
  const sources = (json.sources || []).filter((source) => source.enabled && source.type === "rss");
  return { mode: json.mode || "rss-only", policyVersion: json.policyVersion || "1.0.0", sources };
}

function normalize(items) {
  const dedup = new Set();
  const now = Date.now();

  return items
    .filter((item) => item.title && item.link)
    .filter((item) => {
      const key = `${item.source}:${item.title}`;
      if (dedup.has(key)) return false;
      dedup.add(key);
      return true;
    })
    .slice(0, MAX_ITEMS)
    .map((item, idx) => {
      const createdAt = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
      const expiresAt = new Date(now + 1000 * 60 * 60 * 36).toISOString();
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

async function collectFromFeeds(sourceConfig) {
  const merged = [];
  const compliance = [];

  for (const source of sourceConfig.sources) {
    try {
      const response = await fetch(source.feedUrl, {
        headers: { "User-Agent": "hotdeal-rss-bot/1.0 (+github-actions)" }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const xml = await response.text();
      const items = parseRssItems(xml)
        .filter((item) => isAllowedUrl(item.link, source.allowedDomains || []))
        .filter((item) => isLikelyDeal(item.title))
        .map((item) => ({ ...item, source: source.name }));

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
  const { items, compliance } = await collectFromFeeds(sourceConfig);
  const normalized = normalize(items);
  const deals = normalized.length > 0 ? normalized : FALLBACK_DEALS;

  const payload = {
    generatedAt: new Date().toISOString(),
    policy: {
      mode: sourceConfig.mode,
      policyVersion: sourceConfig.policyVersion,
      sourceCount: sourceConfig.sources.length
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
