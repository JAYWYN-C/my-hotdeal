import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("detail modal keeps hidden state with explicit CSS rule", async () => {
  const css = await fs.readFile(new URL("../styles.css", import.meta.url), "utf-8");
  assert.match(css, /\.deal-detail-modal\[hidden\]\s*\{\s*display:\s*none/);
});

test("app exposes a home reset handler and compact original post action", async () => {
  const js = await fs.readFile(new URL("../app.js", import.meta.url), "utf-8");
  assert.match(js, /function resetToHome\(/);
  assert.match(js, /function pickDashboardDeals\(predicate, limit = 3\)/);
  assert.match(js, /function renderDealTags\(/);
  assert.match(js, /function setHeaderMenuOpen\(/);
  assert.match(js, /function scrollToSection\(/);
  assert.match(js, /state\.selectedCategory = "all"/);
  assert.match(js, /state\.selectedSource = "all"/);
  assert.match(js, /state\.sort = "latest"/);
  assert.match(js, /{ id: "meat", label: "고기·생선" }/);
  assert.doesNotMatch(js, /{ id: "fish", label: "생선" }/);
  assert.match(js, /{ id: "dairy", label: "유제품" }/);
  assert.match(js, /{ id: "kitchen", label: "주방용품" }/);
  assert.match(js, /tone:\s*"category"/);
  assert.match(js, /tone:\s*"platform"/);
  assert.match(js, /tone:\s*"source"/);
  assert.match(js, /tag-\$\{tag\.tone\}/);
  assert.match(js, /data-bookmark-detail="\$\{deal\.id\}"/);
  assert.match(js, /bookmarkList\.querySelectorAll\("button\[data-bookmark-detail\]"\)/);
  assert.match(js, /class="detail-header-link">원본글</);
  assert.doesNotMatch(js, /detail-header-divider/);
  assert.doesNotMatch(js, /detailHeaderActions\.innerHTML = '<button class="detail-header-link" type="button" data-close-detail>닫기<\/button>'/);
  assert.doesNotMatch(js, /원본글 보러가기/);
});

test("app surfaces missing Google auth config clearly", async () => {
  const js = await fs.readFile(new URL("../app.js", import.meta.url), "utf-8");
  assert.match(js, /Google 로그인 설정 필요/);
});

test("header includes top-right home login and menu controls", async () => {
  const html = await fs.readFile(new URL("../index.html", import.meta.url), "utf-8");
  assert.match(html, /<title>자취핫딜\.zip<\/title>/);
  assert.match(html, />자취핫딜\.zip</);
  assert.doesNotMatch(html, /자취생 핫딜\.zip/);
  assert.match(html, /<h3>할인 키워드<\/h3>/);
  assert.doesNotMatch(html, /<h3>지금 아끼기 좋은 딜<\/h3>/);
  assert.match(html, /검색과 분류 탭으로 필요한 특가만 빠르게 찾고,/);
  assert.match(html, /자세히 보기에서 구매 링크와 원본글을 바로 확인하세요\./);
  assert.doesNotMatch(html, /넓은 화면에서는 더 많이 보고, 모바일에서는 자연스럽게 줄어드는 밀도 높은 레이아웃으로 정리했습니다\./);
  assert.match(html, /id="home-button"/);
  assert.match(html, /id="google-login"/);
  assert.match(html, /id="menu-button"/);
  assert.match(html, /id="header-menu"/);
  assert.match(html, /data-menu-target="alerts"/);
  assert.match(html, /data-menu-target="bookmarks"/);
  assert.match(html, /id="deal-pagination"/);
  assert.match(html, /id="page-prev"/);
  assert.match(html, /id="page-next"/);
  assert.match(html, /id="page-status"/);
  assert.doesNotMatch(html, /id="data-status"/);
  assert.doesNotMatch(html, /최근 딜 .*소스 상태 성공 .*알림 키워드/);
  assert.match(html, /id="footer-visitor-today"/);
  assert.match(html, /id="footer-visitor-total"/);
});

test("detail header actions stay on one row", async () => {
  const css = await fs.readFile(new URL("../styles.css", import.meta.url), "utf-8");
  assert.match(css, /\.deal-detail-header\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto;[^}]*\}/s);
  assert.match(css, /\.detail-header-actions\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*nowrap;[^}]*\}/s);
  assert.match(css, /\.detail-header-link\s*\{[^}]*text-decoration:\s*none;[^}]*\}/s);
  assert.match(css, /\.deal-detail-header h2\s*\{[\s\S]*font-size:\s*clamp\(1\.55rem,\s*3\.2vw,\s*2\.2rem\)/i);
  assert.doesNotMatch(css, /\.deal-detail-header h2\s*\{[\s\S]*font-size:\s*clamp\(1\.85rem,\s*4vw,\s*2\.7rem\)/i);
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.deal-detail-header\s*\{[\s\S]*flex-direction:\s*column/s);
});

test("deal list uses single-column pagination with 20 items per page", async () => {
  const js = await fs.readFile(new URL("../app.js", import.meta.url), "utf-8");
  const css = await fs.readFile(new URL("../styles.css", import.meta.url), "utf-8");
  assert.match(js, /const DEALS_PER_PAGE = 20;/);
  assert.match(js, /currentPage:\s*1/);
  assert.match(js, /function paginatedDeals\(/);
  assert.match(js, /const start = \(state\.currentPage - 1\) \* DEALS_PER_PAGE;/);
  assert.match(js, /state\.currentPage = 1;/);
  assert.match(js, /pageStatus\.textContent = `\$\{state\.currentPage\} \/ \$\{totalPages\}페이지`;/);
  assert.match(css, /\.deal-list\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*gap:\s*1rem;/s);
  assert.match(css, /\.deal-pagination\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*center;/s);
});

test("detail body uses a compact text layout instead of repeated info boxes", async () => {
  const js = await fs.readFile(new URL("../app.js", import.meta.url), "utf-8");
  const css = await fs.readFile(new URL("../styles.css", import.meta.url), "utf-8");
  assert.match(js, /class="detail-facts"/);
  assert.match(js, /class="detail-fact-label"/);
  assert.match(js, /data-detail-bookmark="\$\{deal\.id\}"/);
  assert.match(js, /detailContent\.querySelectorAll\("button\[data-detail-bookmark\]"\)/);
  assert.doesNotMatch(js, /class="detail-grid"/);
  assert.doesNotMatch(js, /class="detail-points"/);
  assert.match(css, /\.detail-facts\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.detail-fact-label\s*\{[^}]*color:\s*var\(--muted\)/s);
  assert.doesNotMatch(css, /\.detail-grid\s*\{/);
  assert.doesNotMatch(css, /\.detail-points\s*\{/);
});

test("styles use the approved resident dashboard palette", async () => {
  const css = await fs.readFile(new URL("../styles.css", import.meta.url), "utf-8");
  assert.match(css, /--accent:\s*#05299e/i);
  assert.match(css, /--accent-2:\s*#66c3ff/i);
  assert.match(css, /--bg:\s*#fff8f0/i);
  assert.match(css, /--ink:\s*#000000/i);
  assert.match(css, /--surface:\s*#ffffff/i);
  assert.match(css, /--surface-soft:\s*#f5fbff/i);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/i);
  assert.match(css, /width:\s*min\(1260px,\s*calc\(100% - 2\.75rem\)\)/i);
  assert.match(css, /\.hero-copy\s*\{[^}]*display:\s*grid;[^}]*align-content:\s*start;/s);
  assert.match(css, /\.hero-main\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(304px,\s*344px\);[^}]*gap:\s*1\.25rem;/s);
  assert.match(css, /\.hero-actions\s+\.btn\s*\{[^}]*min-height:\s*52px;[^}]*min-width:\s*94px;[^}]*font-size:\s*1rem;/s);
  assert.match(css, /\.hero-panel\s*\{[^}]*max-width:\s*344px;[^}]*justify-self:\s*end;[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*padding:\s*0;/s);
  assert.match(css, /\.hero-panel-item\s*\{[^}]*min-height:\s*88px;[^}]*padding:\s*0\.9rem 0\.95rem;/s);
  assert.match(css, /\.dashboard\s+\.section-title-row\s*\{[^}]*justify-content:\s*flex-start;[^}]*gap:\s*0\.7rem;/s);
  assert.match(css, /\.dashboard\s+\.chip\s*\{[^}]*padding:\s*0\.08rem 0\.42rem;[^}]*font-size:\s*0\.68rem;[^}]*line-height:\s*1\.15;/s);
  assert.match(css, /\.dashboard-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(220px,\s*1fr\)\);[^}]*gap:\s*0\.85rem;/s);
  assert.doesNotMatch(css, /\.dashboard-grid\s*\{[^}]*justify-content:\s*flex-start;/s);
  assert.match(css, /\.dashboard-panel\s*\{[^}]*padding:\s*0\.62rem 0\.68rem;[^}]*border-radius:\s*14px;/s);
  assert.match(css, /\.dashboard-panel h3\s*\{[^}]*font-size:\s*0\.9rem;/s);
  assert.match(css, /\.mini-deal\s*\{[^}]*padding:\s*0\.52rem 0\.58rem;[^}]*border-radius:\s*10px;/s);
  assert.match(css, /\.mini-deal-title\s*\{[^}]*font-size:\s*0\.88rem;[^}]*line-height:\s*1\.3/s);
  assert.match(css, /\.mini-deal-meta\s*\{[^}]*font-size:\s*0\.74rem;/s);
  assert.match(css, /h1\s*\{[\s\S]*font-size:\s*clamp\(3rem,\s*6vw,\s*5rem\)/i);
  assert.match(css, /h2\s*\{[\s\S]*font-size:\s*clamp\(1\.7rem,\s*2\.8vw,\s*2\.2rem\)/i);
  assert.match(css, /\.tabs button\s*\{[\s\S]*padding:\s*0\.72rem 1\.12rem;[\s\S]*font-size:\s*1\.14rem;/i);
  assert.match(css, /\.tag-category\s*\{[\s\S]*background:\s*var\(--accent\)/i);
  assert.match(css, /\.tag-platform\s*\{[\s\S]*background:\s*var\(--accent-2\)/i);
  assert.match(css, /\.tag-source\s*\{[\s\S]*color:\s*var\(--muted\)/i);
  assert.match(css, /@media\s*\(max-width:\s*960px\)\s*\{[\s\S]*\.hero-main\s*\{[\s\S]*grid-template-columns:\s*1fr;/s);
});

test("pages deploy workflow writes firebase-config.js from repository variables", async () => {
  const workflow = await fs.readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf-8");
  assert.match(workflow, /firebase-config\.js/);
  assert.match(workflow, /FIREBASE_API_KEY/);
  assert.match(workflow, /FIREBASE_AUTH_DOMAIN/);
  assert.match(workflow, /FIREBASE_PROJECT_ID/);
  assert.match(workflow, /FIREBASE_APP_ID/);
});

test("collect workflow can redeploy refreshed data to vercel", async () => {
  const workflow = await fs.readFile(new URL("../.github/workflows/collect-deals.yml", import.meta.url), "utf-8");
  assert.match(workflow, /id:\s*data_changes/);
  assert.match(workflow, /git config user\.name "github-actions\[bot\]"/);
  assert.match(workflow, /git config user\.email "41898282\+github-actions\[bot\]@users\.noreply\.github\.com"/);
  assert.match(workflow, /git add data\/deals\.json/);
  assert.match(workflow, /git commit -m "chore: update deals data"/);
  assert.match(workflow, /git push origin HEAD:main/);
  assert.match(workflow, /VERCEL_TOKEN/);
  assert.match(workflow, /VERCEL_ORG_ID/);
  assert.match(workflow, /VERCEL_PROJECT_ID/);
  assert.match(workflow, /npx --yes vercel deploy --prod --yes --token "\$VERCEL_TOKEN"/);
  assert.match(workflow, /steps\.data_changes\.outputs\.updated == 'true'/);
  assert.doesNotMatch(workflow, /stefanzweifel\/git-auto-commit-action@v5/);
});

test("vercel deploy ignores repository-only files", async () => {
  const ignoreFile = await fs.readFile(new URL("../.vercelignore", import.meta.url), "utf-8");
  assert.match(ignoreFile, /^\.github$/m);
  assert.match(ignoreFile, /^docs$/m);
  assert.match(ignoreFile, /^scripts$/m);
  assert.match(ignoreFile, /^config$/m);
  assert.match(ignoreFile, /^README\.md$/m);
  assert.match(ignoreFile, /^firebase-config\.example\.js$/m);
});

test("footer visitor counters use shared countapi keys and right-aligned layout", async () => {
  const js = await fs.readFile(new URL("../app.js", import.meta.url), "utf-8");
  const css = await fs.readFile(new URL("../styles.css", import.meta.url), "utf-8");
  const api = await fs.readFile(new URL("../api/visitor-stats.js", import.meta.url), "utf-8");
  assert.match(js, /const footerVisitorToday = document\.getElementById\("footer-visitor-today"\);/);
  assert.match(js, /const footerVisitorTotal = document\.getElementById\("footer-visitor-total"\);/);
  assert.match(js, /function renderVisitorStats\(/);
  assert.match(js, /function syncVisitorStats\(/);
  assert.match(js, /fetch\(\s*`\.\/*api\/visitor-stats\?scope=\$\{encodeURIComponent\(scope\)\}&mode=\$\{encodeURIComponent\(mode\)\}&date=\$\{encodeURIComponent\(dateKey\)\}`\s*\)/);
  assert.doesNotMatch(js, /https:\/\/api\.countapi\.xyz/);
  assert.match(js, /hotdeal-visitor-total-counted/);
  assert.match(js, /hotdeal-visitor-day/);
  assert.match(api, /https:\/\/api\.countapi\.xyz/);
  assert.match(api, /scope === "today"/);
  assert.match(api, /scope === "total"/);
  assert.match(api, /Access-Control-Allow-Origin/);
  assert.match(css, /\.footer\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*space-between;/s);
  assert.match(css, /\.footer-visitor-stats\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*flex-end;/s);
});
