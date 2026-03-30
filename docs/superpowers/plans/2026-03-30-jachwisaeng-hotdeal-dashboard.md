# 자취생 핫딜.zip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the site into a simple resident-focused savings dashboard, add finer categories and home reset behavior, surface both purchase and original post links in the detail popup, and wire hourly collection plus Google-account email alerts.

**Architecture:** Keep the static Pages frontend, but enrich `data/deals.json` with new category, title, status, and original-link fields from `scripts/collect-deals.mjs`. Update `index.html`, `app.js`, and `styles.css` into a cleaner dashboard layout with mobile-first behavior and detail modal actions. Add a GitHub Actions companion script to read Firestore subscriptions, dedupe keyword matches, and send mail via an API when new deals are collected.

**Tech Stack:** Static HTML/CSS/JS, Node.js ESM scripts, GitHub Actions, Firebase Auth/Firestore, `node:test`

---

### Task 1: Lock the new data contract with failing tests

**Files:**
- Modify: `scripts/collect-deals.test.mjs`
- Modify: `scripts/ui-regression.test.mjs`
- Modify: `app.js`

- [ ] **Step 1: Write the failing tests**

```js
test("normalizeDealRecord formats title as [platform] product name", () => {
  const deal = normalizeDealRecord({
    title: "서울우유 무가당 블랙9곡 두유 190ml 20팩 9,800원 무료",
    source: "개드립",
    platform: "네이버쇼핑",
    link: "https://www.dogdrip.net/123",
    pubDate: "2026-03-30T19:59:44+09:00",
  });

  assert.equal(deal.title, "[네이버쇼핑] 서울우유 무가당 블랙9곡 두유 190ml 20팩");
});

test("status display chooses deadline over first-come-first-served", () => {
  const deadlineDeal = normalizeDealRecord({
    title: "한정 특가 3/30까지",
    source: "뽐뿌",
    platform: "11번가",
    link: "https://example.com/deal",
    pubDate: "2026-03-30T10:00:00+09:00",
  });

  assert.equal(deadlineDeal.deadlineText, "3/30까지");
  assert.equal(deadlineDeal.statusText, "");
});

test("status display uses 선착순 when there is no actual deadline", () => {
  const fcfsDeal = normalizeDealRecord({
    title: "선착순 100명 한정수량",
    source: "개드립",
    platform: "네이버쇼핑",
    link: "https://example.com/fcfs",
    pubDate: "2026-03-30T10:00:00+09:00",
  });

  assert.equal(fcfsDeal.deadlineAt, "");
  assert.equal(fcfsDeal.statusText, "선착순");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/collect-deals.test.mjs scripts/ui-regression.test.mjs`
Expected: FAIL because the collector still uses the old title format and has no `statusText` semantics for the new resident dashboard rules

- [ ] **Step 3: Write the minimal implementation**

```js
function normalizeDealRecord(item) {
  return {
    title: `[${platform}] ${productName}`,
    deadlineAt,
    deadlineText,
    statusText,
    originalUrl: canonicalizeUrl(item.link),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/collect-deals.test.mjs scripts/ui-regression.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/collect-deals.test.mjs scripts/ui-regression.test.mjs scripts/collect-deals.mjs
git commit -m "test: cover jachwisaeng dashboard deal contract"
```

### Task 2: Implement category, title, status, and original-link normalization

**Files:**
- Modify: `scripts/collect-deals.mjs`
- Modify: `config/sources.json`
- Test: `scripts/collect-deals.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
test("inferCategory maps fresh produce to 야채·과일", () => {
  assert.equal(inferCategory("[네이버쇼핑] 국산 자색양파 5kg 특상", { platform: "네이버쇼핑" }), "produce");
});

test("inferCategory maps frozen prepared food to 냉동식품", () => {
  assert.equal(inferCategory("[쿠팡] 비비고 진한고기만두 4개", { platform: "쿠팡" }), "frozen");
});

test("normalizeDealRecord keeps original community URL separately from purchase URL", () => {
  const deal = normalizeDealRecord({
    title: "풍천민물장어",
    source: "개드립",
    platform: "네이버쇼핑",
    link: "https://www.dogdrip.net/693549878",
    purchaseUrl: "https://brand.naver.com/santafarmer/products/5471769389",
    pubDate: "2026-03-30T19:00:00+09:00",
  });

  assert.equal(deal.originalUrl, "https://www.dogdrip.net/693549878");
  assert.equal(deal.purchaseUrl, "https://brand.naver.com/santafarmer/products/5471769389");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/collect-deals.test.mjs`
Expected: FAIL because the collector still emits broad categories and does not expose `originalUrl`

- [ ] **Step 3: Write the minimal implementation**

```js
const categories = ["produce", "frozen", "dessert", "food-other", "household", "cleaning", "travel", "voucher", "game", "electronics", "overseas", "festa"];

function inferCategory(title, hints = {}) {
  // map resident-friendly buckets before fallback
}

return {
  originalUrl: canonicalizeUrl(item.link),
  purchaseUrl: canonicalizeUrl(item.purchaseUrl || ""),
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/collect-deals.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/collect-deals.mjs scripts/collect-deals.test.mjs config/sources.json
git commit -m "feat: normalize resident-focused hotdeal categories"
```

### Task 3: Rebuild the frontend as a clean resident savings dashboard

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Test: `scripts/ui-regression.test.mjs`

- [ ] **Step 1: Write the failing UI assertions**

```js
test("home actions reset filters and close detail modal", async () => {
  const js = await fs.readFile(new URL("../app.js", import.meta.url), "utf-8");
  assert.match(js, /function resetToHome\(/);
  assert.match(js, /selectedCategory = "all"/);
  assert.match(js, /selectedSource = "all"/);
  assert.match(js, /sort = "latest"/);
});

test("detail modal includes purchase and original post actions", async () => {
  const js = await fs.readFile(new URL("../app.js", import.meta.url), "utf-8");
  assert.match(js, /구매하러 가기/);
  assert.match(js, /원본글 보러가기/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/ui-regression.test.mjs`
Expected: FAIL because the UI still lacks the new home reset handler and original-post button

- [ ] **Step 3: Write the minimal implementation**

```js
function resetToHome() {
  state.search = "";
  state.selectedSource = "all";
  state.selectedCategory = "all";
  state.sort = "latest";
  closeDealDetail();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const categories = [
  { id: "produce", label: "야채·과일" },
  // ...
];
```

- [ ] **Step 4: Run tests and a visual smoke check**

Run: `node --test scripts/ui-regression.test.mjs && node --check app.js`
Expected: PASS, then open a local preview and verify the simple dashboard, mobile wrapping, home reset, and both modal action buttons

- [ ] **Step 5: Commit**

```bash
git add index.html app.js styles.css scripts/ui-regression.test.mjs
git commit -m "feat: redesign hotdeal site as resident savings dashboard"
```

### Task 4: Add Google-account email alert persistence and sender scripts

**Files:**
- Modify: `app.js`
- Create: `scripts/send-keyword-alerts.mjs`
- Create: `scripts/send-keyword-alerts.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write the failing tests**

```js
test("selectMatchingAlerts deduplicates by user deal URL and keyword", async () => {
  const { selectMatchingAlerts } = await import("./send-keyword-alerts.mjs");
  const alerts = selectMatchingAlerts({
    deals: [{ title: "[네이버쇼핑] 양파", originalUrl: "https://a", purchaseUrl: "https://b", source: "개드립", platform: "네이버쇼핑" }],
    subscriptions: [{ uid: "u1", email: "a@example.com", emailAlertsEnabled: true, alertKeywords: ["양파"] }],
    deliveries: [{ uid: "u1", dealUrl: "https://a", keyword: "양파" }],
  });

  assert.equal(alerts.length, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/send-keyword-alerts.test.mjs`
Expected: FAIL because the alert script does not exist yet

- [ ] **Step 3: Write the minimal implementation**

```js
export function selectMatchingAlerts({ deals, subscriptions, deliveries }) {
  // filter by enabled users, keyword match, and delivery history
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/send-keyword-alerts.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app.js scripts/send-keyword-alerts.mjs scripts/send-keyword-alerts.test.mjs README.md
git commit -m "feat: add Google-account keyword email alerts"
```

### Task 5: Switch the workflow to hourly collection and post-collect email dispatch

**Files:**
- Modify: `.github/workflows/collect-deals.yml`
- Modify: `scripts/collect-deals.mjs`
- Modify: `data/deals.json`
- Modify: `README.md`

- [ ] **Step 1: Write the failing workflow checks**

```js
test("workflow uses hourly cron", async () => {
  const workflow = await fs.readFile(new URL("../.github/workflows/collect-deals.yml", import.meta.url), "utf-8");
  assert.match(workflow, /cron:\s*"0 \* \* \* \*"/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/send-keyword-alerts.test.mjs scripts/ui-regression.test.mjs scripts/collect-deals.test.mjs`
Expected: FAIL because the workflow still uses the 3-hour schedule and alert dispatch is not wired

- [ ] **Step 3: Write the minimal implementation**

```yml
schedule:
  - cron: "0 * * * *"
```

```yml
- name: Send keyword alerts
  run: node scripts/send-keyword-alerts.mjs
```

- [ ] **Step 4: Run verification**

Run:
- `node --test scripts/collect-deals.test.mjs scripts/ui-regression.test.mjs scripts/send-keyword-alerts.test.mjs`
- `node --check app.js`
- `node --check scripts/collect-deals.mjs`
- `node --check scripts/send-keyword-alerts.mjs`
- `node scripts/collect-deals.mjs`

Expected: PASS, fresh `data/deals.json` generated, and the workflow file reflects hourly collection

- [ ] **Step 5: Commit and publish**

```bash
git add .github/workflows/collect-deals.yml scripts/collect-deals.mjs scripts/send-keyword-alerts.mjs scripts/send-keyword-alerts.test.mjs data/deals.json README.md
git commit -m "feat: schedule resident hotdeal dashboard hourly"
git push origin main
```
