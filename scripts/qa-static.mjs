import { chromium } from "playwright-core";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--allow-file-access-from-files"],
});

const page = await browser.newPage({ viewport: { width: 590, height: 1000 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(pathToFileURL(resolve("index.html")).href, { waitUntil: "networkidle" });
if (await page.locator(".opponent-team img").count() !== 6) throw new Error("Landing team did not render.");

await page.click('[data-route="lead"]');
await page.waitForSelector('[data-lead="flareon"]');
await page.click('[data-lead="flareon"]');
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

await page.click(".menu-toggle");
await page.click('.menu-panel [data-route="encounters"]');
await page.click('[data-encounter="1"]');
if (!(await page.locator(".encounter-count").textContent())?.includes("2 encounters")) throw new Error("Encounter count did not update.");
await page.click("[data-reveal-all]");
if (await page.locator(".revealed").count() !== 3) throw new Error("Encounters were not revealed.");

const imageFailures = await page.locator("img").evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src));
await browser.close();

if (errors.length || imageFailures.length) throw new Error(JSON.stringify({ errors, imageFailures }, null, 2));
console.log("Static Nuzzle flow passed: landing, lead, battle, PC, encounters, tooltips, and local images.");
