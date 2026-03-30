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
  assert.match(js, /function renderDealTags\(/);
  assert.match(js, /function setHeaderMenuOpen\(/);
  assert.match(js, /function scrollToSection\(/);
  assert.match(js, /state\.selectedCategory = "all"/);
  assert.match(js, /state\.selectedSource = "all"/);
  assert.match(js, /state\.sort = "latest"/);
  assert.match(js, /{ id: "meat", label: "고기" }/);
  assert.match(js, /{ id: "fish", label: "생선" }/);
  assert.match(js, /{ id: "dairy", label: "유제품" }/);
  assert.match(js, /{ id: "kitchen", label: "주방용품" }/);
  assert.match(js, /tone:\s*"category"/);
  assert.match(js, /tone:\s*"platform"/);
  assert.match(js, /tone:\s*"source"/);
  assert.match(js, /tag-\$\{tag\.tone\}/);
  assert.match(js, /class="detail-header-link">원본글</);
  assert.match(js, /detail-header-divider/);
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
  assert.match(html, /id="home-button"/);
  assert.match(html, /id="google-login"/);
  assert.match(html, /id="menu-button"/);
  assert.match(html, /id="header-menu"/);
  assert.match(html, /data-menu-target="alerts"/);
  assert.match(html, /data-menu-target="bookmarks"/);
});

test("detail header actions stay on one row", async () => {
  const css = await fs.readFile(new URL("../styles.css", import.meta.url), "utf-8");
  assert.match(css, /\.deal-detail-header\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto;[^}]*\}/s);
  assert.match(css, /\.detail-header-actions\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*nowrap;[^}]*\}/s);
  assert.match(css, /\.detail-header-link\s*\{[^}]*text-decoration:\s*none;[^}]*\}/s);
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.deal-detail-header\s*\{[\s\S]*flex-direction:\s*column/s);
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
  assert.match(css, /width:\s*min\(1400px,\s*calc\(100% - 1\.5rem\)\)/i);
  assert.match(css, /\.deal-list\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(360px,\s*1fr\)\)/s);
  assert.match(css, /\.tag-category\s*\{[\s\S]*background:\s*var\(--accent\)/i);
  assert.match(css, /\.tag-platform\s*\{[\s\S]*background:\s*var\(--accent-2\)/i);
  assert.match(css, /\.tag-source\s*\{[\s\S]*color:\s*var\(--muted\)/i);
});

test("pages deploy workflow writes firebase-config.js from repository variables", async () => {
  const workflow = await fs.readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf-8");
  assert.match(workflow, /firebase-config\.js/);
  assert.match(workflow, /FIREBASE_API_KEY/);
  assert.match(workflow, /FIREBASE_AUTH_DOMAIN/);
  assert.match(workflow, /FIREBASE_PROJECT_ID/);
  assert.match(workflow, /FIREBASE_APP_ID/);
});
