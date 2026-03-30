import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaginatedListUrl,
  extractDeadlineInfo,
  extractPurchaseUrlFromHtml,
  inferCategory,
  normalizeDealRecord,
  parseBoardDateText,
  parseDogdripBoard,
  parseFmkoreaBoard,
  shouldStopPaginating,
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

test("parseBoardDateText handles board date formats used in paginated pages", () => {
  const referenceDate = new Date("2026-03-31T12:00:00+09:00");

  assert.equal(parseBoardDateText("03-29", referenceDate), "2026-03-28T15:00:00.000Z");
  assert.equal(parseBoardDateText("26/03/30", referenceDate), "2026-03-29T15:00:00.000Z");
  assert.equal(parseBoardDateText("2026.03.20", referenceDate), "2026-03-19T15:00:00.000Z");
});

test("buildPaginatedListUrl normalizes page query updates", () => {
  assert.equal(
    buildPaginatedListUrl("https://coolenjoy.net/bbs/jirum", 1),
    "https://coolenjoy.net/bbs/jirum"
  );
  assert.equal(
    buildPaginatedListUrl("https://coolenjoy.net/bbs/jirum", 3),
    "https://coolenjoy.net/bbs/jirum?page=3"
  );
  assert.equal(
    buildPaginatedListUrl("https://www.dealbada.com/bbs/board.php?bo_table=deal_domestic", 2),
    "https://www.dealbada.com/bbs/board.php?bo_table=deal_domestic&page=2"
  );
});

test("shouldStopPaginating stops once pages are older than the recent cutoff", () => {
  const cutoffTime = new Date("2026-03-25T00:00:00+09:00").getTime();

  assert.equal(
    shouldStopPaginating(
      [{ pubDate: "2026-03-24T10:00:00+09:00" }, { pubDate: "2026-03-24T09:00:00+09:00" }],
      8,
      18,
      cutoffTime
    ),
    true
  );

  assert.equal(
    shouldStopPaginating(
      [{ pubDate: "2026-03-30T10:00:00+09:00" }, { pubDate: "2026-03-29T09:00:00+09:00" }],
      8,
      18,
      cutoffTime
    ),
    false
  );

  assert.equal(
    shouldStopPaginating(
      [{ pubDate: "2026-03-30T10:00:00+09:00" }],
      18,
      18,
      cutoffTime
    ),
    true
  );
});

test("normalizeDealRecord formats title as [platform] product name", () => {
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

  assert.equal(deal.title, "[쿠팡] 양반 100밥 현미밥, 130g, 30개");
  assert.equal(deal.category, "food-other");
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

test("extractDeadlineInfo resolves explicit deadlines in KST", () => {
  const result = extractDeadlineInfo(
    "풍천민물장어 특가 선착순 100명 3/30까지",
    "2026-03-30T19:31:00+09:00",
  );

  assert.equal(result.deadlineText, "3/30까지");
  assert.equal(result.deadlineAt, "2026-03-30T14:59:59.000Z");
});

test("normalizeDealRecord only keeps deadline when source text actually contains one", () => {
  const withoutDeadline = normalizeDealRecord(
    {
      title: "양반 100밥 현미밥, 130g, 30개",
      source: "FM코리아",
      sourceCategory: "먹거리",
      platform: "쿠팡",
      listedPrice: "18,750원",
      shipping: "무료",
      link: "https://www.fmkorea.com/9652014980",
      pubDate: "2026-03-30T19:31:00+09:00",
    },
    null,
    0,
  );

  const withDeadline = normalizeDealRecord(
    {
      title: "[네이버쇼핑] 풍천민물장어 1kg 손질후 700g 13,600원 (무료배송) 3/30까지",
      source: "개드립",
      sourceCategory: "식품",
      platform: "네이버쇼핑",
      listedPrice: "13,600원",
      shipping: "무료배송",
      link: "https://www.dogdrip.net/hotdeal/693549878?sort_index=popular&page=1",
      pubDate: "2026-03-30T19:31:00+09:00",
    },
    null,
    0,
  );

  assert.equal(withoutDeadline.deadlineAt, "");
  assert.equal(withoutDeadline.expiresAt, "");
  assert.equal(withoutDeadline.statusText, "");
  assert.equal(withDeadline.deadlineText, "3/30까지");
  assert.equal(withDeadline.deadlineAt, "2026-03-30T14:59:59.000Z");
  assert.equal(withDeadline.statusText, "");
});

test("normalizeDealRecord uses 선착순 status when there is no explicit deadline", () => {
  const deal = normalizeDealRecord(
    {
      title: "[네이버쇼핑] 풍천민물장어 1kg 선착순 100명 한정수량",
      source: "개드립",
      sourceCategory: "식품",
      platform: "네이버쇼핑",
      listedPrice: "13,600원",
      shipping: "무료배송",
      link: "https://www.dogdrip.net/hotdeal/693549878?sort_index=popular&page=1",
      pubDate: "2026-03-30T19:31:00+09:00",
    },
    null,
    0,
  );

  assert.equal(deal.deadlineAt, "");
  assert.equal(deal.deadlineText, "");
  assert.equal(deal.statusText, "선착순");
});

test("normalizeDealRecord keeps original community URL separately", () => {
  const deal = normalizeDealRecord(
    {
      title: "풍천민물장어 1kg",
      source: "개드립",
      sourceCategory: "식품",
      platform: "네이버쇼핑",
      listedPrice: "13,600원",
      shipping: "무료배송",
      link: "https://www.dogdrip.net/hotdeal/693549878?sort_index=popular&page=1",
      purchaseUrl: "https://brand.naver.com/santafarmer/products/5471769389",
      pubDate: "2026-03-30T19:31:00+09:00",
    },
    null,
    0,
  );

  assert.equal(deal.originalUrl, "https://www.dogdrip.net/hotdeal/693549878?sort_index=popular&page=1");
  assert.equal(deal.purchaseUrl, "https://brand.naver.com/santafarmer/products/5471769389");
});

test("inferCategory maps resident food groups and overseas deals", () => {
  assert.equal(inferCategory("[네이버쇼핑] 국산 자색양파 5kg 특상", { sourceCategory: "식품" }), "produce");
  assert.equal(inferCategory("[쿠팡] 비비고 진한고기만두 (냉동), 400g, 4개", { sourceCategory: "식품" }), "frozen");
  assert.equal(inferCategory("[오늘의집] 엑설런트 오리지널 6개", { sourceCategory: "식품" }), "dessert");
  assert.equal(inferCategory("[네이버쇼핑] 서울우유 무가당 블랙9곡 두유 190ml 20팩", { sourceCategory: "식품" }), "food-other");
  assert.equal(inferCategory("[네이버쇼핑] 상하목장 유기농 우유 24팩", { sourceCategory: "식품" }), "dairy");
  assert.equal(inferCategory("[컬리] 그릭요거트 400g 2통", { sourceCategory: "식품" }), "dairy");
  assert.equal(inferCategory("[네이버쇼핑] 풍천민물장어 1kg 손질후 700g + 소스2종 생강채 13,600원 (무료배송)", { sourceCategory: "식품" }), "meat");
  assert.equal(inferCategory("[쿠팡] 한돈 삼겹살 구이용 1kg", { sourceCategory: "식품" }), "meat");
  assert.equal(inferCategory("[쿠팡] 냉동 삼겹살 구이용 1kg", { sourceCategory: "식품" }), "meat");
  assert.equal(inferCategory("[네이버쇼핑] 냉동 연어 스테이크 800g", { sourceCategory: "식품" }), "meat");
  assert.equal(inferCategory("[4910] 하이뮨 프로틴 밸런스 액티브 22g 바닐라봉봉 ZERO 250ml 18입", { platform: "4910", source: "FM코리아" }), "food-other");
  assert.equal(inferCategory("[네이버] 제주 구좌 흙 왕당근 5kg", { sourceCategory: "식품" }), "produce");
  assert.equal(inferCategory("[루리웹] 더 미식 유니짜장 4인분(5,220원/배송3,000원)", { sourceCategory: "식품" }), "food-other");
  assert.equal(inferCategory("[G마켓] YOGA SLIM 7 14ILL10 83JX0018KR", { platform: "G마켓", source: "FM코리아" }), "electronics");
  assert.equal(inferCategory("[쿠팡] 후라이팬 28cm 2종 세트", { sourceCategory: "생활" }), "kitchen");
  assert.equal(inferCategory("[오늘의집] 밀폐용기 10종 세트", { sourceCategory: "생활" }), "kitchen");
  assert.equal(inferCategory("[쿠팡] 3겹 화장지 30롤", { sourceCategory: "생활" }), "household");
  assert.equal(inferCategory("[오늘의집] 수납함 정리박스 4개", { sourceCategory: "생활" }), "household");
  assert.equal(inferCategory("[오늘의집] 철제 선반 4단", { sourceCategory: "생활" }), "household");
});

test("extractPurchaseUrlFromHtml finds source purchase links", () => {
  const ppomppuHtml = `
    <li class="topTitle-link partner">
      <a href="https://s.ppomppu.co.kr?idno=ppomppu_693209&target=abc" target="_blank">
        http://www.11st.co.kr/products/9217825261/share
      </a>
    </li>
  `;
  const fmkoreaHtml = `
    <table class="hotdeal_table">
      <tr>
        <th scope="row">링크</th>
        <td>
          <div class="xe_content">
            <a href="https://link.coupang.com/a/eetegd" target="_blank" class="hotdeal_url">https://link.coupang.com/a/eetegd</a>
          </div>
        </td>
      </tr>
    </table>
  `;
  const dogdripHtml = `
    <table class="ed table table-striped table-bordered margin-remove">
      <tr>
        <th>링크</th>
        <td><a href="https://brand.naver.com/santafarmer/products/5471769389" target="_blank">https://brand.naver.com/santafarmer/products/5471769389</a></td>
      </tr>
    </table>
  `;

  assert.equal(
    extractPurchaseUrlFromHtml(ppomppuHtml, { collector: "ppomppu-board" }, "https://www.ppomppu.co.kr/zboard/view.php?id=ppomppu&no=693209"),
    "https://s.ppomppu.co.kr/?idno=ppomppu_693209&target=abc",
  );
  assert.equal(
    extractPurchaseUrlFromHtml(fmkoreaHtml, { collector: "fmkorea-board" }, "https://www.fmkorea.com/9652014980"),
    "https://link.coupang.com/a/eetegd",
  );
  assert.equal(
    extractPurchaseUrlFromHtml(dogdripHtml, { collector: "dogdrip-board" }, "https://www.dogdrip.net/693549878"),
    "https://brand.naver.com/santafarmer/products/5471769389",
  );
});

test("inferCategory routes sale events to festa", () => {
  assert.equal(inferCategory("네이버페이 멤버십 적립 이벤트", { sourceCategory: "세일정보" }), "festa");
  assert.equal(inferCategory("알리익스프레스 SSD 특가", { source: "해외뽐뿌" }), "overseas");
  assert.equal(inferCategory("삼성 게이밍 모니터 특가", {}), "electronics");
  assert.equal(inferCategory("신세계 상품권 할인 판매", {}), "voucher");
  assert.equal(inferCategory("제주 항공권 특가", {}), "travel");
  assert.equal(inferCategory("스팀 봄 세일 게임 할인", {}), "game");
});
