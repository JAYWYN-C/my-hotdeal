import test from "node:test";
import assert from "node:assert/strict";

import {
  inferCategory,
  normalizeDealRecord,
  parseDogdripBoard,
  parseFmkoreaBoard,
} from "./collect-deals.mjs";

test("parseFmkoreaBoard extracts platform metadata from list rows", () => {
  const html = `
    <li class="li">
      <div class="li">
        <h3 class="title" data-title-ellipsis="true">
          <a href="/9652014980" class="hotdeal_var8">
            <span class="ellipsis-target">양반 100밥 현미밥, 130g, 30개</span>
          </a>
        </h3>
        <div class="hotdeal_info">
          <span>쇼핑몰: <a class="strong">쿠팡</a></span> /
          <span>가격: <a class="strong">18,750원</a></span> /
          <span>배송: <a class="strong">무료</a></span>
        </div>
        <div>
          <span class="category"><a>먹거리</a> /</span>
          <span class="regdate">19:31</span>
        </div>
      </div>
    </li>
  `;

  const [item] = parseFmkoreaBoard(html, {
    listUrl: "https://www.fmkorea.com/hotdeal",
  });

  assert.equal(item.title, "양반 100밥 현미밥, 130g, 30개");
  assert.equal(item.platform, "쿠팡");
  assert.equal(item.listedPrice, "18,750원");
  assert.equal(item.shipping, "무료");
  assert.equal(item.sourceCategory, "먹거리");
  assert.match(item.link, /9652014980$/);
});

test("parseDogdripBoard extracts hotdeal entries and category labels", () => {
  const html = `
    <li class="ed flex flex-left flex-middle webzine popular-item">
      <div class="ed width-expand">
        <div class="ed list-header">
          <h5 class="ed title margin-remove">
            <a href="/hotdeal/693549878?sort_index=popular&page=1" class="ed title-link" data-document-srl="693549878">
              [네이버쇼핑] 풍천민물장어 1kg 손질후 700g + 소스2종 생강채 13,600원 (무료배송(멤버십))
            </a>
          </h5>
        </div>
        <div class="ed flex list-meta">
          <div class="ed flex flex-left flex-middle">
            <span class="ed text-xxsmall margin-right-xxsmall text-muted">[식품]</span>
            <span class="ed text-muted text-xxsmall margin-right-xsmall">
              <i class="far fa-clock"></i> 8 시간 전
            </span>
          </div>
        </div>
      </div>
      <a href="/hotdeal/693549878?sort_index=popular&page=1" class="ed overlay overlay-fill overlay-top"></a>
    </li>
  `;

  const [item] = parseDogdripBoard(html, {
    listUrl: "https://www.dogdrip.net/hotdeal",
  });

  assert.match(item.link, /693549878/);
  assert.equal(item.platform, "네이버쇼핑");
  assert.equal(item.sourceCategory, "식품");
  assert.match(item.title, /풍천민물장어/);
});

test("normalizeDealRecord keeps price shipping and platform in title", () => {
  const deal = normalizeDealRecord(
    {
      title: "양반 100밥 현미밥, 130g, 30개",
      source: "FM코리아",
      sourceCategory: "먹거리",
      platform: "쿠팡",
      listedPrice: "18,750원",
      shipping: "무료",
      link: "https://www.fmkorea.com/9652014980",
      pubDate: "2026-03-30T19:31:00+09:00",
      summary: "현미밥 30개 구성으로 식품 보관이 편한 특가입니다.",
    },
    null,
    0,
  );

  assert.equal(deal.title, "[양반 100밥 현미밥, 130g, 30개] (18,750원 / 무료 / 쿠팡)");
  assert.equal(deal.category, "food");
  assert.equal(deal.platform, "쿠팡");
  assert.equal(deal.source, "FM코리아");
});

test("normalizeDealRecord keeps summary neutral and surfaces special conditions", () => {
  const deal = normalizeDealRecord(
    {
      title: "[네이버쇼핑] 풍천민물장어 1kg 손질후 700g + 소스2종 생강채 13,600원 (무료배송(멤버십)) 선착순 100명 3/30까지",
      source: "개드립",
      sourceCategory: "식품",
      platform: "네이버쇼핑",
      listedPrice: "13,600원",
      shipping: "무료배송(멤버십)",
      link: "https://www.dogdrip.net/hotdeal/693549878?sort_index=popular&page=1",
      pubDate: "2026-03-30T19:31:00+09:00",
    },
    null,
    0,
  );

  assert.doesNotMatch(deal.summary, /개드립에 올라온|딜입니다/);
  assert.match(deal.summary, /13,600원/);
  assert.ok(deal.summaryPoints.some((point) => point.includes("선착순")));
  assert.ok(deal.summaryPoints.some((point) => point.includes("3/30")));
});

test("inferCategory routes sale events to festa", () => {
  assert.equal(inferCategory("네이버페이 멤버십 적립 이벤트", { sourceCategory: "세일정보" }), "festa");
  assert.equal(inferCategory("알리익스프레스 SSD 특가", { source: "해외뽐뿌" }), "overseas");
  assert.equal(inferCategory("삼성 게이밍 모니터 특가", {}), "electronics");
});
