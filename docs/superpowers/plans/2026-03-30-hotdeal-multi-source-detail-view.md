# Hotdeal Multi-Source Detail View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the hotdeal collector to multiple Korean community sources, normalize deals around resident-friendly categories, and replace direct outbound links with an internal detail view.

**Architecture:** Extend `scripts/collect-deals.mjs` so each community parser returns normalized list metadata including platform, price, shipping, source category, and optional summary hints. Then enrich the final feed with UI-facing fields used by a redesigned static frontend in `app.js`, `index.html`, and `styles.css`.

**Tech Stack:** Static HTML/CSS/JS, Node.js ESM scripts, `node:test` for parser and categorization regression coverage

---

### Task 1: Make the collector testable

**Files:**
- Modify: `scripts/collect-deals.mjs`
- Create: `scripts/collect-deals.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { inferCategory, normalizeDealRecord, parseFmkoreaBoard, parseDogdripBoard } from "./collect-deals.mjs";

test("normalizeDealRecord keeps platform in unified title", () => {
  const deal = normalizeDealRecord({
    title: "양반 현미밥 30개",
    source: "FM코리아",
    platform: "쿠팡",
    listedPrice: "18,750원",
    shipping: "무료",
    link: "https://www.fmkorea.com/9652014980",
    pubDate: "2026-03-30T19:31:00+09:00",
  });

  assert.equal(deal.title, "[양반 현미밥 30개] (18,750원 / 무료 / 쿠팡)");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/collect-deals.test.mjs`
Expected: FAIL because the exports and normalization helper do not exist yet

- [ ] **Step 3: Write minimal implementation**

```js
export function normalizeDealRecord(item) {
  // create UI-ready deal object
}

export { inferCategory, parseFmkoreaBoard, parseDogdripBoard };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/collect-deals.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/collect-deals.mjs scripts/collect-deals.test.mjs docs/superpowers/plans/2026-03-30-hotdeal-multi-source-detail-view.md
git commit -m "test: cover hotdeal collector normalization"
```

### Task 2: Add multi-source parsers and metadata extraction

**Files:**
- Modify: `scripts/collect-deals.mjs`
- Modify: `config/sources.json`
- Test: `scripts/collect-deals.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
test("parseFmkoreaBoard extracts title, platform, price, shipping, and category", () => {
  const html = `<li><h3 class="title"><a href="/9652014980"><span class="ellipsis-target">양반 100밥 현미밥, 130g, 30개</span></a></h3><div class="hotdeal_info"><span>쇼핑몰: <a class="strong">쿠팡</a></span> / <span>가격: <a class="strong">18,750원</a></span> / <span>배송: <a class="strong">무료</a></span></div><div><span class="category"><a>먹거리</a> /</span><span class="regdate">19:31</span></div></li>`;
  const [item] = parseFmkoreaBoard(html, { listUrl: "https://www.fmkorea.com/hotdeal" });

  assert.equal(item.platform, "쿠팡");
  assert.equal(item.listedPrice, "18,750원");
  assert.equal(item.shipping, "무료");
  assert.equal(item.sourceCategory, "먹거리");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/collect-deals.test.mjs`
Expected: FAIL because parser output is incomplete

- [ ] **Step 3: Write minimal implementation**

```js
function parseFmkoreaBoard(html, source) {
  // extract link, item name, platform, price, shipping, category, and time
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/collect-deals.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/collect-deals.mjs scripts/collect-deals.test.mjs config/sources.json
git commit -m "feat: add multi-source hotdeal parsers"
```

### Task 3: Add summary-friendly deal normalization and detail data

**Files:**
- Modify: `scripts/collect-deals.mjs`
- Test: `scripts/collect-deals.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
test("inferCategory routes card-brand promotions to festa", () => {
  assert.equal(
    inferCategory("[네이버페이] 멤버십 적립 이벤트", { sourceCategory: "세일정보" }),
    "festa"
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/collect-deals.test.mjs`
Expected: FAIL because category logic is still tied to old buckets

- [ ] **Step 3: Write minimal implementation**

```js
function inferCategory(title, hints = {}) {
  // map to food, electronics, overseas, festa
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/collect-deals.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/collect-deals.mjs scripts/collect-deals.test.mjs
git commit -m "feat: normalize resident-focused hotdeal categories"
```

### Task 4: Redesign the frontend around category tabs and detail modal

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`

- [ ] **Step 1: Write the failing test**

```js
// Manual acceptance check
// 1. "자세히 보기" opens an internal detail layer
// 2. Card shows platform and source separately
// 3. Category tabs read: 전체 / 식품 / 전자기기 / 해외핫딜 / 할인 페스타
```

- [ ] **Step 2: Run the manual check to verify current UI fails**

Run: `open index.html` or local static preview
Expected: current UI still links directly to "원문 보기"

- [ ] **Step 3: Write minimal implementation**

```js
state.selectedDealId = null;

function openDealDetail(id) {
  state.selectedDealId = id;
}
```

- [ ] **Step 4: Run the manual check to verify it passes**

Run: local preview plus generated `data/deals.json`
Expected: detail layer opens, metadata is split, cards reflect new categories

- [ ] **Step 5: Commit**

```bash
git add index.html app.js styles.css
git commit -m "feat: add detail view for curated hotdeals"
```

### Task 5: Verify, refresh data, and publish

**Files:**
- Modify: `data/deals.json`
- Modify: `README.md`
- Modify: `LEGAL_SOURCES.md`

- [ ] **Step 1: Run collector checks**

Run: `node --check scripts/collect-deals.mjs`
Expected: no syntax errors

- [ ] **Step 2: Run tests**

Run: `node --test scripts/collect-deals.test.mjs`
Expected: PASS

- [ ] **Step 3: Refresh data**

Run: `node scripts/collect-deals.mjs`
Expected: multi-source deals are written to `data/deals.json`

- [ ] **Step 4: Smoke-check the site**

Run: local static preview or open the generated site
Expected: cards render, detail view works, and unsupported sources are documented as blocked

- [ ] **Step 5: Commit and publish**

```bash
git add README.md LEGAL_SOURCES.md data/deals.json
git commit -m "feat: publish curated multi-source hotdeal feed"
git push origin main
```
