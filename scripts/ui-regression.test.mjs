import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("detail modal keeps hidden state with explicit CSS rule", async () => {
  const css = await fs.readFile(new URL("../styles.css", import.meta.url), "utf-8");
  assert.match(css, /\.deal-detail-modal\[hidden\]\s*\{\s*display:\s*none/);
});

test("app exposes a home reset handler and original post action", async () => {
  const js = await fs.readFile(new URL("../app.js", import.meta.url), "utf-8");
  assert.match(js, /function resetToHome\(/);
  assert.match(js, /state\.selectedCategory = "all"/);
  assert.match(js, /state\.selectedSource = "all"/);
  assert.match(js, /state\.sort = "latest"/);
  assert.match(js, /원본글 보러가기/);
});

test("styles use the approved resident dashboard palette", async () => {
  const css = await fs.readFile(new URL("../styles.css", import.meta.url), "utf-8");
  assert.match(css, /--accent:\s*#1098f7/i);
  assert.match(css, /--ink:\s*#000000/i);
  assert.match(css, /--surface:\s*#ffffff/i);
  assert.match(css, /--rose:\s*#b89e97/i);
  assert.match(css, /--blush:\s*#decccc/i);
});
