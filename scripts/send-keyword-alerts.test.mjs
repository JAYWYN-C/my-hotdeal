import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("selectNewDeals keeps only deals not present in the previous snapshot", async () => {
  const { selectNewDeals } = await import("./send-keyword-alerts.mjs");

  const newDeals = selectNewDeals({
    currentDeals: [
      { title: "[네이버쇼핑] 양파", originalUrl: "https://community.example.com/deal-1" },
      { title: "[쿠팡] 세제", originalUrl: "https://community.example.com/deal-2" },
    ],
    previousDeals: [{ title: "[네이버쇼핑] 양파", originalUrl: "https://community.example.com/deal-1" }],
  });

  assert.equal(newDeals.length, 1);
  assert.equal(newDeals[0].originalUrl, "https://community.example.com/deal-2");
});

test("selectMatchingAlerts deduplicates by user deal URL and keyword", async () => {
  const { selectMatchingAlerts } = await import("./send-keyword-alerts.mjs");

  const alerts = selectMatchingAlerts({
    deals: [
      {
        title: "[네이버쇼핑] 양파",
        summary: "장보기 특가",
        originalUrl: "https://community.example.com/deal-1",
        purchaseUrl: "https://store.example.com/deal-1",
        source: "개드립",
        platform: "네이버쇼핑",
        createdAt: "2026-03-30T11:00:00.000Z",
      },
    ],
    subscriptions: [
      {
        uid: "u1",
        email: "a@example.com",
        emailAlertsEnabled: true,
        alertKeywords: ["양파"],
      },
    ],
    deliveries: [{ uid: "u1", dealUrl: "https://community.example.com/deal-1", keyword: "양파" }],
  });

  assert.equal(alerts.length, 0);
});

test("workflow uses hourly cron and wires the email alert step", async () => {
  const workflow = await fs.readFile(new URL("../.github/workflows/collect-deals.yml", import.meta.url), "utf-8");
  assert.match(workflow, /cron:\s*"0 \* \* \* \*"/);
  assert.match(workflow, /Send keyword alerts/);
});
