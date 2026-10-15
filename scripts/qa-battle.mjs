import { chromium } from "playwright-core";
import { join } from "node:path";
import { tmpdir } from "node:os";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1180, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
await page.click('[data-route="encounters"]');
await page.click("#revealAll");
await page.click('[data-route="today"]');
await page.click("#battleButton");
await page.click("#commitBattle");
await page.waitForSelector(".showdown-shell", { timeout: 10_000 });
await page.waitForSelector(".move-button", { timeout: 10_000 });

const initialTurn = await page.locator(".turn-badge").textContent();
await page.locator(".move-button:not([disabled])").first().click();
await page.waitForFunction((turn) => document.querySelector(".turn-badge")?.textContent !== turn, initialTurn);

const screenshot = join(tmpdir(), "nuzzle-battle-qa.png");
await page.screenshot({ path: screenshot, fullPage: true });
const result = {
  screenshot,
  title: await page.title(),
  turn: await page.locator(".turn-badge").textContent(),
  moveButtons: await page.locator(".move-button").count(),
  switchButtons: await page.locator(".switch-choices button").count(),
  errors,
};
console.log(JSON.stringify(result));
await browser.close();

if (errors.length) process.exitCode = 1;
