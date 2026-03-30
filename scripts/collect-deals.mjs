import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

const knownPlatformKeywords = [
  "11번가",
  "네이버",
  "네이버쇼핑",
  "네이버스토어",
  "쿠팡",
  "쿠팡로켓",
  "g마켓",
  "지마켓",
  "옥션",
  "롯데온",
  "오늘의집",
  "무신사",
  "컬리",
  "토스",
  "버거킹",
  "배달의민족",
  "배민",
  "컴포즈",
  "메가커피",
  "스타벅스",
  "cj더마켓",
  "스토브",
  "삼성닷컴",
  "amazon",
  "woot",
  "ebay",
  "aliexpress",
  "알리",
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

function getSourceDateParts(dateInput = Date.now()) {
  const targetDate = new Date(dateInput);
  if (Number.isNaN(targetDate.getTime())) {
    return getKstToday();
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SOURCE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(targetDate);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

function pickFirstMatchValue(match) {
  if (!match) return "";
  for (let index = 1; index < match.length; index += 1) {
    if (match[index]) return cleanText(match[index]);
  }
  return "";
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

function normalizeShippingLabel(shippingText) {
  return cleanText(shippingText)
    .replace(/\b무배\b/g, "무료")
    .replace(/\b무료배송\b/g, "무료")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyPlatformLabel(label) {
  const cleaned = normalizeSiteLabel(label).toLowerCase();
  if (!cleaned) return false;
  if (/무료|쿠폰|특가|행사|공동구매|핫딜|공지|코인특가|가격/.test(cleaned)) return false;
  if (cleaned.length > 18) return false;
  return knownPlatformKeywords.some((keyword) => cleaned.includes(keyword.toLowerCase()));
}

function defaultPlatformForSource(source) {
  if (source === "알리뽐뿌") return "알리익스프레스";
  return "";
}

function extractPriceText(text) {
  const match = cleanText(text).match(/(가격별상이|다양|[0-9]{1,3}(?:,\s*[0-9]{3})*원|[0-9]{1,7}원)/i);
  if (!match) return "";
  const value = match[1].replace(/,\s+/g, ",");
  return value;
}

function extractShippingText(text) {
  const match = cleanText(text).match(
    /(무료배송(?:\([^)]*\))?|무료배송|무료|무배|조건부\s*배송|직배(?:무료)?|배송비\s*[0-9,]+원|해외배송|착불)/i
  );
  return normalizeShippingLabel(match?.[1] || "");
}

function parseRelativeTimeText(timeText) {
  const value = cleanText(timeText);
  if (!value) return "";
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(value)) return timeTextToIso(value);

  const now = Date.now();
  const minuteMatch = value.match(/(\d+)\s*분\s*전/);
  if (minuteMatch) return new Date(now - Number(minuteMatch[1]) * 60 * 1000).toISOString();

  const hourMatch = value.match(/(\d+)\s*시간\s*전/);
  if (hourMatch) return new Date(now - Number(hourMatch[1]) * 60 * 60 * 1000).toISOString();

  const dayMatch = value.match(/(\d+)\s*일\s*전/);
  if (dayMatch) return new Date(now - Number(dayMatch[1]) * 24 * 60 * 60 * 1000).toISOString();

  if (/방금/.test(value)) return new Date(now).toISOString();
  return "";
}

function parseTitleMetadata(rawTitle) {
  const cleanedTitle = stripLeadingNoise(stripTags(rawTitle));
  let productPart = cleanedTitle;
  let platform = "";

  const mallMatch = productPart.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (mallMatch && isLikelyPlatformLabel(mallMatch[1])) {
    platform = normalizeSiteLabel(mallMatch[1]);
    productPart = mallMatch[2];
  }

  let metaText = "";
  const metaMatch = productPart.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (metaMatch && /(?:\d|원|무료|무배|배송|직배|쿠폰|할인|적립|멤버십|다양)/.test(metaMatch[2])) {
    productPart = metaMatch[1];
    metaText = normalizeMetaChunk(metaMatch[2]);
  }

  const productName = normalizeProductLabel(productPart);
  return {
    platform,
    productName,
    metaText,
    listedPrice: extractPriceText(metaText) || extractPriceText(cleanedTitle),
    shipping: extractShippingText(metaText) || extractShippingText(cleanedTitle),
  };
}

function formatUnifiedTitle(productLabel, platformLabel = "") {
  const product = normalizeProductLabel(productLabel) || "핫딜";
  const platform = normalizeSiteLabel(platformLabel) || "미확인";
  return `[${platform}] ${product}`;
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
  const meta = parseTitleMetadata(stripLeadingNoise(stripTags(rawTitle), source.titlePrefixes || []));
  return formatUnifiedTitle(meta.productName || rawTitle, meta.platform || normalizeSiteLabel(source.name));
}

function inferCategory(title, hints = {}) {
  const haystack = `${title} ${hints.sourceCategory || ""} ${hints.platform || ""} ${hints.source || ""}`.toLowerCase();
  const produceKeywords = ["양파", "오이", "고구마", "과일", "사과", "샐러드", "채소", "농산물", "천혜향", "귤", "토마토", "당근", "감자", "양배추", "마늘"];
  const meatKeywords = [
    "삼겹살",
    "목살",
    "갈비",
    "한우",
    "한돈",
    "돼지고기",
    "돼지",
    "소고기",
    "소불고기",
    "불고기",
    "닭가슴살",
    "닭다리",
    "닭정육",
    "닭볶음탕",
    "닭갈비",
    "오리고기",
    "오리훈제",
    "오리로스",
    "차돌",
    "우삼겹",
    "대패",
    "스테이크",
    "항정살",
    "돈마호크",
    "육회",
    "갈비탕",
    "흑돼지",
    "돔베고기",
  ];
  const fishKeywords = [
    "생선",
    "수산",
    "해산물",
    "장어",
    "연어",
    "참치",
    "고등어",
    "갈치",
    "명태",
    "오징어",
    "문어",
    "낙지",
    "주꾸미",
    "새우",
    "전복",
    "굴비",
    "굴",
    "조개",
    "꽃게",
    "대게",
    "킹크랩",
    "새조개",
    "홍합",
    "멍게",
    "어묵",
    "회",
  ];
  const frozenKeywords = ["냉동", "만두", "냉동식품", "핫도그", "너겟", "도시락", "피자", "볶음밥"];
  const dessertKeywords = ["아이스크림", "쿠키", "과자", "초코", "디저트", "베이커리", "카스타드", "와플", "커피", "아카페라", "아메리카노", "엑설런트", "끌레도르", "케이크"];
  const dairyKeywords = [
    "우유",
    "치즈",
    "요거트",
    "요구르트",
    "그릭요거트",
    "버터",
    "생크림",
    "휘핑크림",
    "크림치즈",
    "리코타",
    "모짜렐라",
    "모차렐라",
    "체다",
    "파르메산",
    "분유",
    "연유",
  ];
  const dairyExcludedKeywords = ["두유", "soy", "식물성", "오트", "oat", "아몬드브리즈", "almond"];
  const kitchenKeywords = [
    "주방",
    "후라이팬",
    "프라이팬",
    "냄비",
    "식기",
    "접시",
    "컵",
    "텀블러",
    "머그",
    "도마",
    "칼",
    "조리도구",
    "주걱",
    "국자",
    "수저",
    "숟가락",
    "젓가락",
    "밀폐용기",
    "반찬통",
    "채반",
    "키친툴",
  ];
  const householdKeywords = ["휴지", "화장지", "수납", "수납함", "욕실", "생필품", "생활용품", "멀티탭", "쓰레기통", "정리박스", "정리함", "선반"];
  const cleaningKeywords = ["청소", "세제", "세정", "곰팡이", "청소포", "테이프클리너", "클리너", "세척"];
  const travelKeywords = ["항공", "숙박", "렌터카", "렌트카", "여행", "호텔", "리조트", "패스", "티켓"];
  const voucherKeywords = ["상품권", "기프티콘", "금액권", "포인트 전환", "문화상품권", "신세계", "스타벅스 카드"];
  const gameKeywords = ["스팀", "닌텐도", "ps5", "플스", "xbox", "게임", "콘솔", "타이틀"];
  const electronicsKeywords = [
    "전자",
    "pc",
    "모니터",
    "ssd",
    "그래픽카드",
    "노트북",
    "아이폰",
    "갤럭시 s",
    "갤럭시s",
    "갤럭시 탭",
    "갤럭시탭",
    "갤럭시 버즈",
    "갤럭시버즈",
    "갤럭시워치",
    "갤럭시북",
    "yoga",
    "thinkpad",
    "씽크패드",
    "워치",
    "플스",
    "ps5",
    "닌텐도",
    "apple watch",
    "에어팟",
    "이어폰",
    "모니터암",
    "가전",
    "냉장고",
    "세탁기",
    "청소기",
    "tv",
  ];
  const overseasKeywords = ["해외", "직구", "알리", "aliexpress", "amazon", "해외핫딜"];
  const festaKeywords = [
    "이벤트",
    "페스타",
    "멤버십",
    "적립",
    "카드",
    "쿠폰",
    "세일정보",
    "할인권",
    "행사",
    "프로모션",
    "네이버페이",
    "토스",
    "페이",
  ];

  if (overseasKeywords.some((keyword) => haystack.includes(keyword))) return "overseas";
  if (travelKeywords.some((keyword) => haystack.includes(keyword))) return "travel";
  if (voucherKeywords.some((keyword) => haystack.includes(keyword))) return "voucher";
  if (gameKeywords.some((keyword) => haystack.includes(keyword))) return "game";
  if (electronicsKeywords.some((keyword) => haystack.includes(keyword))) return "electronics";
  if (cleaningKeywords.some((keyword) => haystack.includes(keyword))) return "cleaning";
  if (kitchenKeywords.some((keyword) => haystack.includes(keyword))) return "kitchen";
  if (householdKeywords.some((keyword) => haystack.includes(keyword))) return "household";
  if (produceKeywords.some((keyword) => haystack.includes(keyword))) return "produce";
  if (fishKeywords.some((keyword) => haystack.includes(keyword))) return "meat";
  if (meatKeywords.some((keyword) => haystack.includes(keyword))) return "meat";
  if (frozenKeywords.some((keyword) => haystack.includes(keyword))) return "frozen";
  if (dessertKeywords.some((keyword) => haystack.includes(keyword))) return "dessert";
  if (
    dairyKeywords.some((keyword) => haystack.includes(keyword)) &&
    !dairyExcludedKeywords.some((keyword) => haystack.includes(keyword))
  ) return "dairy";
  if (/먹거리|식품|음료|전복|돼지|소고기|갈비탕|오메가3|올리브오일|우유|햇반|현미밥|비엔나|흑돼지|치킨|라면|장어|고기|쌀|수산|배달|밀키트|간식|두유|건강식품|프로틴|사이다|막걸리|약주|육개장|삼계탕|밀면|짜장|국수|면류/.test(haystack)) return "food-other";
  if (festaKeywords.some((keyword) => haystack.includes(keyword))) return "festa";
  return "festa";
}

function inferEventTags(title, hints = {}) {
  const tags = [];
  const map = [
    ["멤버십", "멤버십"],
    ["카드", "카드할인"],
    ["쿠폰", "쿠폰"],
    ["적립", "적립"],
    ["배민", "배달앱"],
    ["네이버페이", "페이적립"],
    ["삼성", "삼성"],
    ["라이브", "라이브특가"],
    ["커피", "커피"],
    ["치킨", "치킨"],
    ["라면", "라면"],
    ["장어", "수산"]
  ];

  const haystack = `${title} ${hints.platform || ""} ${hints.sourceCategory || ""}`.toLowerCase();
  for (const [needle, tag] of map) {
    if (haystack.includes(needle.toLowerCase())) tags.push(tag);
  }

  if (tags.length === 0 && ["produce", "meat", "fish", "dairy", "frozen", "dessert", "food-other"].includes(hints.category)) tags.push("식품");
  if (tags.length === 0 && hints.category === "festa") tags.push("할인페스타");
  return tags;
}

function estimatePrice(title) {
  const match = title.match(/([0-9]{1,3}(?:,\s*[0-9]{3})+|[0-9]{1,7})원/);
  if (!match) return 0;
  return Number(match[1].replaceAll(",", "").replace(/\s+/g, ""));
}

function estimateDiscount(title) {
  const match = title.match(/([1-9][0-9]?)%/);
  return match ? Number(match[1]) : 0;
}

function buildSummary(item) {
  const product = item.productName || normalizeProductLabel(item.title);
  const platform = cleanText(item.platform);
  const price = cleanText(item.listedPrice);
  const shipping = cleanText(item.shipping);
  const pricing = [price, shipping].filter(Boolean).join(", ");
  const conditions = extractDealConditions(item.rawTitle || item.title);
  const segments = [
    `${product} 특가입니다.`,
    platform ? `${platform}${pricing ? ` 기준 ${pricing}` : " 기준"}${pricing ? "" : ""}.` : pricing ? `${pricing}.` : "",
    conditions.length > 0 ? `조건: ${conditions.join(", ")}.` : "",
  ].filter(Boolean);
  return cleanText(segments.join(" "));
}

function buildSummaryPoints(item) {
  const conditions = extractDealConditions(item.rawTitle || item.title);
  return [
    item.platform ? `플랫폼: ${item.platform}` : "",
    item.listedPrice ? `가격: ${item.listedPrice}` : "",
    item.shipping ? `배송: ${item.shipping}` : "",
    ...conditions.map((condition) => `조건: ${condition}`),
  ].filter(Boolean);
}

function extractDealConditions(text) {
  const cleaned = cleanText(text);
  if (!cleaned) return [];

  const datePattern =
    "(?:20\\d{2}[/-](?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\\d|3[01])|(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\\d|3[01]))";
  const patterns = [
    /(선착순\s*\d+\s*(?:명|개|건)?)/gi,
    /(한정수량|수량한정|오늘만|주말한정)/gi,
    new RegExp(`((${datePattern})(?:\\s*[~-]\\s*(${datePattern}))?\\s*까지)`, "gi"),
  ];

  const found = [];
  for (const pattern of patterns) {
    for (const match of cleaned.matchAll(pattern)) {
      const value = cleanText(match[1] || match[0]);
      if (!value) continue;
      if (!found.includes(value)) found.push(value);
    }
  }
  return found.slice(0, 3);
}

function extractDeadlineInfo(text, publishedTimeInput = Date.now()) {
  const cleaned = cleanText(text);
  if (!cleaned) {
    return { deadlineAt: "", deadlineText: "" };
  }

  const fullDateMatch = cleaned.match(
    /(20\d{2})[./-](0?[1-9]|1[0-2])[./-](0?[1-9]|[12]\d|3[01])\s*까지/i
  );
  if (fullDateMatch) {
    const [, year, month, day] = fullDateMatch;
    return {
      deadlineAt: toIsoInSourceTimezone(Number(year), Number(month), Number(day), 23, 59, 59),
      deadlineText: cleanText(fullDateMatch[0]),
    };
  }

  const shortDateMatch = cleaned.match(
    /((0?[1-9]|1[0-2])[./-](0?[1-9]|[12]\d|3[01]))\s*까지/i
  );
  if (shortDateMatch) {
    const parts = getSourceDateParts(publishedTimeInput);
    const month = Number(shortDateMatch[2]);
    const day = Number(shortDateMatch[3]);
    return {
      deadlineAt: toIsoInSourceTimezone(parts.year, month, day, 23, 59, 59),
      deadlineText: cleanText(shortDateMatch[0]),
    };
  }

  if (/오늘만/.test(cleaned)) {
    const parts = getSourceDateParts(publishedTimeInput);
    return {
      deadlineAt: toIsoInSourceTimezone(parts.year, parts.month, parts.day, 23, 59, 59),
      deadlineText: "오늘만",
    };
  }

  return { deadlineAt: "", deadlineText: "" };
}

function extractPurchaseUrlFromHtml(html, source = {}, baseUrl = "") {
  const collector = source.collector || "";
  const patterns = {
    "ppomppu-board": [
      /<li[^>]+class=['"][^'"]*topTitle-link[^'"]*['"][\s\S]*?<a[^>]+href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i
    ],
    "ruliweb-board": [
      /<div[^>]+class=['"][^'"]*source_url[^'"]*['"][\s\S]*?<a[^>]+href=(?:"([^"]*web\.ruliweb\.com\/link\.php[^"]*)"|'([^']*web\.ruliweb\.com\/link\.php[^']*)'|([^\s>]*web\.ruliweb\.com\/link\.php[^\s>]*))/i,
      /<a[^>]+href=(?:"([^"]*web\.ruliweb\.com\/link\.php[^"]*)"|'([^']*web\.ruliweb\.com\/link\.php[^']*)'|([^\s>]*web\.ruliweb\.com\/link\.php[^\s>]*))/i
    ],
    "dealbada-board": [
      /<section[^>]+id=['"]bo_v_link['"][\s\S]*?<a[^>]+href=(?:"([^"]*\/bbs\/link\.php[^"]*)"|'([^']*\/bbs\/link\.php[^']*)'|([^\s>]*\/bbs\/link\.php[^\s>]*))/i
    ],
    "coolenjoy-board": [
      /<a[^>]+href=(?:"([^"]*\/bbs\/link2\.php[^"]*)"|'([^']*\/bbs\/link2\.php[^']*)'|([^\s>]*\/bbs\/link2\.php[^\s>]*))[^>]*>\s*https?:\/\/[^<]+<\/a>/i,
      /<a[^>]+href=(?:"([^"]*\/bbs\/link2\.php[^"]*)"|'([^']*\/bbs\/link2\.php[^']*)'|([^\s>]*\/bbs\/link2\.php[^\s>]*))/i
    ],
    "fmkorea-board": [
      /<a[^>]+href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*class=['"][^'"]*hotdeal_url[^'"]*['"]/i,
      /<a[^>]+class=['"][^'"]*hotdeal_url[^'"]*['"][^>]*href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i
    ],
    "dogdrip-board": [
      /<th[^>]*>\s*링크\s*<\/th>[\s\S]*?<a[^>]+href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i,
      /<a[^>]+href=(?:"((?:https?:)?\/\/brand\.[^"]+)"|'((?:https?:)?\/\/brand\.[^']+)'|(((?:https?:)?\/\/brand\.[^\s>]+)))/i
    ],
  };

  for (const pattern of patterns[collector] || []) {
    const rawUrl = pickFirstMatchValue(html.match(pattern));
    if (!rawUrl) {
      continue;
    }
    const absoluteUrl = toAbsoluteUrl(rawUrl, baseUrl);
    if (absoluteUrl) {
      return canonicalizeUrl(absoluteUrl);
    }
  }

  return "";
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

function normalizeDealRecord(item, existingDeal = null, fallbackRank = 0, publishedTimeInput = null) {
  const publishedTime = publishedTimeInput ?? resolvePublishedTime(item, existingDeal, item.rank ?? fallbackRank);
  const createdAt = new Date(publishedTime).toISOString();
  const parsedTitleMeta = parseTitleMetadata(item.title);
  const textForDeadline = [item.deadlineText, item.rawTitle, item.title, item.summary].filter(Boolean).join(" ");
  const explicitDeadlineTime = new Date(item.deadlineAt || "").getTime();
  const derivedDeadline = item.deadlineAt
    ? {
        deadlineAt: Number.isNaN(explicitDeadlineTime) ? "" : new Date(explicitDeadlineTime).toISOString(),
        deadlineText: cleanText(item.deadlineText),
      }
    : extractDeadlineInfo(textForDeadline, publishedTime);
  const deadlineAt = derivedDeadline.deadlineAt || cleanText(existingDeal?.deadlineAt);
  const deadlineText = derivedDeadline.deadlineText || cleanText(existingDeal?.deadlineText);
  const conditions = extractDealConditions(textForDeadline);
  const statusText =
    deadlineAt
      ? ""
      : conditions.some((condition) => /선착순|한정수량|수량한정|오늘만|주말한정/i.test(condition))
        ? "선착순"
        : "";
  const meta = {
    ...parsedTitleMeta,
    platform: cleanText(item.platform) || parsedTitleMeta.platform || defaultPlatformForSource(item.source),
    productName: cleanText(item.productName) || parsedTitleMeta.productName,
    listedPrice: cleanText(item.listedPrice) || parsedTitleMeta.listedPrice,
    shipping: normalizeShippingLabel(item.shipping) || parsedTitleMeta.shipping,
    sourceCategory: cleanText(item.sourceCategory),
  };
  const unifiedTitle = formatUnifiedTitle(meta.productName || item.title, meta.platform || normalizeSiteLabel(item.source));
  const category = inferCategory(`${item.title} ${meta.productName}`, {
    source: item.source,
    sourceCategory: meta.sourceCategory,
    platform: meta.platform,
  });
  const price = estimatePrice(meta.listedPrice || item.title);

  return {
    id: 0,
    title: unifiedTitle,
    productName: meta.productName || normalizeProductLabel(item.title),
    category,
    source: item.source,
    platform: meta.platform,
    price,
    priceText: meta.listedPrice || (price > 0 ? `${price.toLocaleString("ko-KR")}원` : ""),
    shipping: meta.shipping,
    discount: estimateDiscount(item.title),
    createdAt,
    deadlineAt,
    deadlineText,
    statusText,
    expiresAt: deadlineAt,
    eventTags: inferEventTags(item.title, {
      category,
      platform: meta.platform,
      sourceCategory: meta.sourceCategory,
    }),
    sourceCategory: meta.sourceCategory,
    summary: cleanText(item.summary) || buildSummary({ ...item, ...meta }),
    summaryPoints: Array.isArray(item.summaryPoints) && item.summaryPoints.length > 0 ? item.summaryPoints : buildSummaryPoints({ ...item, ...meta }),
    originalUrl: canonicalizeUrl(item.link),
    purchaseUrl: canonicalizeUrl(item.purchaseUrl || existingDeal?.purchaseUrl || ""),
    url: canonicalizeUrl(item.link),
  };
}

function normalize(items, existingIndex) {
  const dedup = new Set();

  return items
    .map((item, idx) => {
      const link = canonicalizeUrl(item.link);
      const title = normalizeDealTitle(item.title, item.sourceConfig);
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
    .map((item, idx) => ({ ...normalizeDealRecord(item, item.existingDeal, idx, item.publishedTime), id: idx + 1 }));
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
    const titleMeta = parseTitleMetadata(title);
    seen.add(link);
    items.push({
      title,
      link,
      platform: titleMeta.platform,
      productName: titleMeta.productName,
      listedPrice: titleMeta.listedPrice,
      shipping: titleMeta.shipping,
      pubDate: timeTextToIso(timeText) || extractNearbyPubDate(rowHtml, 0),
      rank: items.length
    });

    if (items.length >= (source.maxItems || DEFAULT_PAGE_ITEM_LIMIT)) break;
  }

  return items;
}

function parseRuliwebBoard(html, source) {
  const items = [];
  const seen = new Set();
  const rowPattern = /<tr[^>]+class=['"][^'"]*\btable_body\b[^'"]*['"][\s\S]*?<\/tr>/gi;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const rowHtml = rowMatch[0];
    const hrefMatch = rowHtml.match(/<a[^>]+class=['"][^'"]*subject_link[^'"]*['"][^>]+href=(["'])([^"']+)\1/i);
    const link = toAbsoluteUrl(hrefMatch?.[2] || "", source.listUrl);
    const title = parseFirst(rowHtml, /<a[^>]+class=['"][^'"]*subject_link[^'"]*['"][^>]*>([\s\S]*?)<\/a>/i);
    const sourceCategory = stripTags(
      parseFirst(rowHtml, /<td[^>]+class=['"][^'"]*\bdivsn\b[^'"]*['"][^>]*>([\s\S]*?)<\/td>/i)
    );
    if (/공지/.test(title) || /공지/.test(sourceCategory)) continue;
    if (!title || !link || seen.has(link)) continue;

    const titleMeta = parseTitleMetadata(title);
    seen.add(link);
    items.push({
      title,
      link,
      platform: titleMeta.platform,
      productName: titleMeta.productName,
      listedPrice: titleMeta.listedPrice,
      shipping: titleMeta.shipping,
      sourceCategory,
      pubDate: timeTextToIso(parseFirst(rowHtml, /<td[^>]+class=['"]time['"][^>]*>([^<]+)<\/td>/i)) || extractNearbyPubDate(rowHtml, 0),
      rank: items.length,
    });

    if (items.length >= (source.maxItems || DEFAULT_PAGE_ITEM_LIMIT)) break;
  }

  return items;
}

function parseDealbadaBoard(html, source) {
  const items = [];
  const seen = new Set();
  const rowPattern = /<tr[\s\S]*?<\/tr>/gi;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const rowHtml = rowMatch[0];
    if (!/bo_table=deal_/i.test(rowHtml) || /bo_notice|공지/i.test(rowHtml)) continue;

    const hrefMatch = rowHtml.match(/<a[^>]+href=(["'])([^"']*bo_table=deal_[^"']*wr_id=\d+[^"']*)\1/i);
    const href = hrefMatch?.[2] || "";
    const title = parseFirst(rowHtml, /<td[^>]+class=['"][^'"]*td_subject[^'"]*['"][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
    const link = toAbsoluteUrl(href, source.listUrl);
    if (!title || !link || seen.has(link)) continue;

    const titleMeta = parseTitleMetadata(title);
    seen.add(link);
    items.push({
      title,
      link,
      platform: titleMeta.platform,
      productName: titleMeta.productName,
      listedPrice: titleMeta.listedPrice,
      shipping: titleMeta.shipping,
      sourceCategory: stripTags(parseFirst(rowHtml, /<td[^>]+class=['"][^'"]*td_cate[^'"]*['"][^>]*>([\s\S]*?)<\/td>/i)),
      pubDate: timeTextToIso(parseFirst(rowHtml, /<td[^>]+class=['"][^'"]*td_date[^'"]*['"][^>]*>([^<]+)<\/td>/i)) || extractNearbyPubDate(rowHtml, 0),
      rank: items.length,
    });

    if (items.length >= (source.maxItems || DEFAULT_PAGE_ITEM_LIMIT)) break;
  }

  return items;
}

function parseCoolenjoyBoard(html, source) {
  const items = [];
  const seen = new Set();
  const linkPattern =
    /<a[^>]+href=(["'])((?:https?:\/\/coolenjoy\.net)?\/bbs\/jirum\/\d+[^"']*)\1[^>]+class=['"][^'"]*na-subject[^'"]*['"][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const link = toAbsoluteUrl(match[2], source.listUrl);
    const title = stripTags(match[3]);
    if (!title || !link || seen.has(link)) continue;

    const snippet = html.slice(Math.max(0, (match.index ?? 0) - 350), Math.min(html.length, (match.index ?? 0) + 700));
    const titleMeta = parseTitleMetadata(title);
    seen.add(link);
    items.push({
      title,
      link,
      platform: titleMeta.platform,
      productName: titleMeta.productName,
      listedPrice: parseFirst(snippet, /<font[^>]*>([^<]*원)<\/font>/i) || titleMeta.listedPrice,
      shipping: titleMeta.shipping,
      sourceCategory: stripTags(parseFirst(snippet, /<div[^>]+id=['"]abcd['"][^>]*>([^<]+)<\/div>/i)),
      pubDate: timeTextToIso(parseFirst(snippet, /\b(\d{1,2}:\d{2})\b/)) || extractNearbyPubDate(snippet, 0),
      rank: items.length,
    });

    if (items.length >= (source.maxItems || DEFAULT_PAGE_ITEM_LIMIT)) break;
  }

  return items;
}

function parseFmkoreaBoard(html, source) {
  const items = [];
  const seen = new Set();
  const linkPattern =
    /<a[^>]+href=(["'])(\/\d+)\1[^>]*class=['"][^'"]*hotdeal_var8[^'"]*['"][^>]*>[\s\S]*?<span class=['"]ellipsis-target['"]>([\s\S]*?)<\/span>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const link = toAbsoluteUrl(match[2], source.listUrl);
    const title = stripTags(match[3]);
    if (!title || !link || seen.has(link)) continue;

    const snippet = html.slice(Math.max(0, (match.index ?? 0) - 120), Math.min(html.length, (match.index ?? 0) + 450));
    seen.add(link);
    items.push({
      title,
      link,
      platform: parseFirst(snippet, /쇼핑몰:\s*<a[^>]*class=['"]strong['"][^>]*>([\s\S]*?)<\/a>/i),
      productName: title,
      listedPrice: parseFirst(snippet, /가격:\s*<a[^>]*class=['"]strong['"][^>]*>([\s\S]*?)<\/a>/i),
      shipping: normalizeShippingLabel(parseFirst(snippet, /배송:\s*<a[^>]*class=['"]strong['"][^>]*>([\s\S]*?)<\/a>/i)),
      sourceCategory: stripTags(parseFirst(snippet, /<span class=['"]category['"][^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i)),
      pubDate:
        timeTextToIso(parseFirst(snippet, /<span class=['"]regdate['"][^>]*>\s*([^<\n]+?)(?:<!--|<\/span>)/i)) ||
        extractNearbyPubDate(snippet, 0),
      rank: items.length,
    });

    if (items.length >= (source.maxItems || DEFAULT_PAGE_ITEM_LIMIT)) break;
  }

  return items;
}

function parseDogdripBoard(html, source) {
  const items = [];
  const seen = new Set();
  const linkPattern = /<a[^>]+href=(["'])(\/hotdeal\/\d+[^"']*)\1[^>]+class=['"][^'"]*title-link[^'"]*['"][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const link = toAbsoluteUrl(match[2], source.listUrl);
    const title = stripTags(match[3]);
    if (!title || /핫딜 게시판 안내/.test(title) || !link || seen.has(link)) continue;

    const snippet = html.slice(Math.max(0, (match.index ?? 0) - 160), Math.min(html.length, (match.index ?? 0) + 760));
    const titleMeta = parseTitleMetadata(title);
    const relativeTime = parseFirst(snippet, /<i class=['"][^'"]*fa-clock[^'"]*['"]><\/i>\s*([^<]+)/i);
    seen.add(link);
    items.push({
      title,
      link,
      platform: titleMeta.platform,
      productName: titleMeta.productName,
      listedPrice: titleMeta.listedPrice,
      shipping: titleMeta.shipping,
      sourceCategory:
        parseFirst(snippet, /<span[^>]*>\s*\[([^\]]+)\]\s*<\/span>/i) ||
        parseFirst(snippet, /<span[^>]+text-muted[^>]*>\s*\[([^\]]+)\]\s*<\/span>/i),
      pubDate: parseRelativeTimeText(relativeTime) || extractNearbyPubDate(snippet, 0),
      rank: items.length,
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
    if (source.collector === "ruliweb-board") return parseRuliwebBoard(html, source);
    if (source.collector === "dealbada-board") return parseDealbadaBoard(html, source);
    if (source.collector === "coolenjoy-board") return parseCoolenjoyBoard(html, source);
    if (source.collector === "fmkorea-board") return parseFmkoreaBoard(html, source);
    if (source.collector === "dogdrip-board") return parseDogdripBoard(html, source);
    if (source.collector === "arca-board") return parseArcaBoard(html, source);
    throw new Error(`Unsupported collector: ${source.collector || "unknown"}`);
  }

  throw new Error(`Unsupported source type: ${source.type}`);
}

function filterCollectedItems(items, source) {
  return items
    .map((item) => ({
      ...item,
      rawTitle: cleanText(item.title),
      title: cleanText(item.title),
      link: canonicalizeUrl(item.link),
      source: source.name,
      sourceConfig: source
    }))
    .filter((item) => item.title && item.link)
    .filter((item) => isAllowedUrl(item.link, source.allowedDomains || []))
    .filter((item) => item.platform || item.listedPrice || item.shipping || isLikelyDeal(item.rawTitle || item.title))
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

async function enrichDealsWithPurchaseLinks(deals, sourceConfig) {
  const sourceByName = new Map(sourceConfig.sources.map((source) => [source.name, source]));
  const enriched = [];

  for (const deal of deals) {
    const source = sourceByName.get(deal.source);
    if (!source || source.type !== "page" || deal.purchaseUrl || !deal.url) {
      enriched.push(deal);
      continue;
    }

    try {
      const html = await fetchText(deal.url);
      enriched.push({
        ...deal,
        purchaseUrl: extractPurchaseUrlFromHtml(html, source, deal.url) || deal.purchaseUrl,
      });
    } catch {
      enriched.push(deal);
    }

    await sleep(250);
  }

  return enriched;
}

async function main() {
  const sourceConfig = await loadSourceConfig();
  const existingIndex = await loadExistingDealsIndex();
  const { items, compliance } = await collectFromSources(sourceConfig);
  const normalized = await enrichDealsWithPurchaseLinks(normalize(items, existingIndex), sourceConfig);
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

function isDirectExecution() {
  const entryPath = process.argv[1];
  if (!entryPath) return false;
  return import.meta.url === pathToFileURL(path.resolve(entryPath)).href;
}

export {
  extractDeadlineInfo,
  extractPurchaseUrlFromHtml,
  inferCategory,
  normalizeDealRecord,
  parseDogdripBoard,
  parseFmkoreaBoard,
};

if (isDirectExecution()) {
  main().catch((error) => {
    console.error("[collect] fatal", error);
    process.exitCode = 1;
  });
}
