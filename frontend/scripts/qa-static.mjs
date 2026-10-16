import { chromium } from "playwright-core";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--allow-file-access-from-files"],
});

const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(pathToFileURL(resolve("index.html")).href, { waitUntil: "networkidle" });
if (await page.locator(".opponent-team img").count() !== 6) throw new Error("Landing team did not render.");

const assertFits = async (name) => {
  const dimensions = await page.locator(".screen").evaluate((screen) => ({
    viewport: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
    clientHeight: screen.clientHeight,
    contentHeight: screen.scrollHeight,
  }));
  if (dimensions.documentHeight > dimensions.viewport + 1 || dimensions.contentHeight > dimensions.clientHeight + 1) {
    throw new Error(`${name} overflows the 390x844 viewport: ${JSON.stringify(dimensions)}`);
  }
};

if (await page.locator(".home-actions .gloss-button").count() !== 7) throw new Error("Landing navigation is incomplete.");
await assertFits("Landing");

await page.click('[data-route="lead"]');
await page.waitForSelector('[data-lead="flareon"]');
await assertFits("Lead selection");
await page.click('[data-lead="flareon"]');
await assertFits("Battle");
await page.hover('[data-move="flamethrower"]');
if (await page.locator("#tooltip").isHidden()) throw new Error("Move tooltip did not open.");
const heldMove = page.locator('[data-move="bite"]');
await heldMove.dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 4 });
await page.waitForTimeout(500);
if (await page.locator("#tooltip").isHidden()) throw new Error("Long-press tooltip did not open.");
await heldMove.dispatchEvent("pointerup", { pointerType: "touch", pointerId: 4 });
await heldMove.click();
if (!(await page.locator(".prompt").textContent())?.includes("Turn 1")) throw new Error("Long press incorrectly triggered the move.");
await page.click('[data-move="flamethrower"]');
if (!(await page.locator(".prompt").textContent())?.includes("Turn 2")) throw new Error("Mock battle did not advance.");

await page.click(".menu-toggle");
await page.click('.menu-panel [data-route="pc"]');
await page.waitForSelector(".pc-box");
if (await page.locator(".pc-mon").count() < 12) throw new Error("PC box did not render.");
await page.waitForFunction(() => [...document.querySelectorAll(".pc-mon img")].every((image) => image.complete && image.naturalWidth > 0));
if (await page.locator(".pc-stage .page-back").count() !== 1) throw new Error("PC back control is missing.");
await assertFits("PC");

await page.click(".menu-toggle");
await page.click('.menu-panel [data-route="encounters"]');
await assertFits("Encounters");
await page.click('[data-encounter="1"]');
if (!(await page.locator(".encounter-count").textContent())?.includes("2 encounters")) throw new Error("Encounter count did not update.");
await page.click('[data-encounter="0"]');
await page.click('[data-encounter="2"]');
if (await page.locator(".revealed").count() !== 3) throw new Error("Encounters were not revealed.");

await page.click(".page-back");
await page.click('[data-route="mart"]');
await assertFits("Mart");
const balanceBefore = await page.locator(".balance").textContent();
await page.click('[data-buy="0"]');
const balanceAfter = await page.locator(".balance").textContent();
if (balanceBefore === balanceAfter) throw new Error("Mart purchase did not update the balance.");

await page.click(".page-back");
for (const route of ["bag", "leaderboard", "settings"]) {
  await page.click(`[data-route="${route}"]`);
  await assertFits(route);
  await page.click(".page-back");
}

const imageFailures = await page.locator("img").evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src));
await browser.close();

if (errors.length || imageFailures.length) throw new Error(JSON.stringify({ errors, imageFailures }, null, 2));
console.log("Static Nuzzle flow passed: landing, lead, battle, PC, encounters, mart, secondary screens, tooltips, and local images.");
