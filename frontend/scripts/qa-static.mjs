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
await page.waitForSelector('[data-select-lead="flareon"]');
await assertFits("Lead selection");
if (!(await page.locator("[data-start-battle]").isDisabled())) throw new Error("Battle confirmation was enabled before choosing a lead.");
await page.click('[data-select-lead="flareon"]');
if (await page.locator('[data-select-lead="flareon"]').getAttribute("aria-pressed") !== "true") throw new Error("Lead selection did not update.");
if (await page.locator("[data-start-battle]").isDisabled()) throw new Error("Battle confirmation did not enable after choosing a lead.");
await page.click("[data-start-battle]");
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
if (await page.locator(".party-slot").count() !== 6) throw new Error("PC team strip does not have six slots.");
await assertFits("PC");
const partySizeBefore = await page.locator(".party-slot:not(.empty)").count();
await page.click('[data-pc-mon="arcanine"]');
if (await page.locator(".pokemon-sheet").count() !== 1) throw new Error("Pokémon details did not open from the PC.");
if (!(await page.locator("[data-team-toggle]").textContent())?.includes("add to team")) throw new Error("A full team did not offer the add-to-team flow.");
await page.click('[data-team-toggle="arcanine"]');
if (await page.locator(".swap-grid button").count() !== 6) throw new Error("The team swap choices did not render.");
await page.click('[data-team-replace="flareon"]');
if (await page.locator(".party-slot:not(.empty)").count() !== partySizeBefore) throw new Error("Swapping changed the team size.");
if (await page.locator('[data-pc-mon="arcanine"].on-team').count() !== 1 || await page.locator('[data-pc-mon="flareon"].on-team').count() !== 0) throw new Error("The selected Pokémon did not replace the chosen team member.");
await page.click(".sheet-close");

await page.click(".menu-toggle");
await page.click('.menu-panel [data-route="encounters"]');
await assertFits("Encounters");
if (await page.locator(".encounter-card").count() !== 3 || await page.locator(".encounter-card.mystery").count() !== 3) throw new Error("Encounter cards did not render.");
await page.click('[data-encounter="1"]');
if (!(await page.locator(".encounter-count").textContent())?.includes("2 encounters")) throw new Error("Encounter count did not update.");
if (await page.locator(".encounter-card.revealed .encounter-status", { hasText: "Added to PC" }).count() !== 1) throw new Error("Revealed encounter status did not render.");
await page.click('[data-encounter="0"]');
await page.click('[data-encounter="2"]');
if (await page.locator(".revealed").count() !== 3) throw new Error("Encounters were not revealed.");

await page.click(".page-back");
await page.click('[data-route="mart"]');
await assertFits("Mart");
const shopGroups = await page.locator("[data-shop-group]").allTextContents();
if (JSON.stringify(shopGroups) !== JSON.stringify(["Held Items", "Training Items", "TMs"])) throw new Error("Mart categories did not render in the expected order.");
if (await page.locator('[data-shop-group="Held Items"][aria-selected="true"]').count() !== 1) throw new Error("Held Items was not the default mart category.");
await page.click('[data-shop-group="Training Items"]');
if (await page.locator('[data-buy="hp-up"]').count() !== 1) throw new Error("Training items did not render.");
await page.click('[data-shop-group="TMs"]');
if (await page.locator('[data-buy="tm-flamethrower"]').count() !== 1) throw new Error("TMs did not render.");
await page.click('[data-shop-group="Held Items"]');
const balanceBefore = await page.locator(".balance").textContent();
await page.click('[data-buy="leftovers"]');
const balanceAfter = await page.locator(".balance").textContent();
if (balanceBefore === balanceAfter) throw new Error("Mart purchase did not update the balance.");
if (!(await page.locator(".purchase-message").textContent())?.includes("Leftovers")) throw new Error("Mart purchase feedback did not render.");

await page.click(".page-back");
await page.click('[data-route="bag"]');
await assertFits("bag");
const bagGroups = await page.locator("[data-bag-group]").allTextContents();
if (JSON.stringify(bagGroups) !== JSON.stringify(["Held Items", "Training Items", "TMs"])) throw new Error("Bag categories did not render in the expected order.");
if (await page.locator('[data-bag-group="Held Items"][aria-selected="true"]').count() !== 1) throw new Error("Held Items was not the default bag category.");
if (await page.locator(".bag-item").count() !== 1 || !(await page.locator(".item-quantity").textContent())?.includes("1")) throw new Error("Purchased item did not populate the bag.");
if ((await page.locator(".item-action").textContent())?.trim() !== "give") throw new Error("Bag item action did not render.");
await page.click('[data-bag-group="Training Items"]');
if ((await page.locator(".bag-empty h2").textContent())?.trim() !== "No items") throw new Error("The empty bag category did not render its empty state.");
if (await page.locator(".empty-bag-icon").count() !== 0) throw new Error("The old empty bag icon still rendered.");
await page.click('[data-visit-mart="Training Items"]');
if (await page.locator('[data-shop-group="Training Items"][aria-selected="true"]').count() !== 1) throw new Error("Visit mart did not preserve the selected item category.");
if (await page.locator('[data-buy="hp-up"]').count() !== 1) throw new Error("Visit mart opened the wrong item category.");
await page.click(".page-back");
for (const route of ["leaderboard", "settings"]) {
  await page.click(`[data-route="${route}"]`);
  await assertFits(route);
  await page.click(".page-back");
}

const imageFailures = await page.locator("img").evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src));
await browser.close();

if (errors.length || imageFailures.length) throw new Error(JSON.stringify({ errors, imageFailures }, null, 2));
console.log("Static Nuzzle flow passed: landing, lead, battle, PC, encounters, mart, secondary screens, tooltips, and local images.");
