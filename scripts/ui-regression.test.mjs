import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("detail modal keeps hidden state with explicit CSS rule", async () => {
  const css = await fs.readFile(new URL("../styles.css", import.meta.url), "utf-8");
  assert.match(css, /\.deal-detail-modal\[hidden\]\s*\{\s*display:\s*none/);
});
