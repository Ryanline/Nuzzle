import { chromium } from "playwright-core";

const baseUrl = process.env.NUZZLE_BASE_URL || "http://127.0.0.1:3000";
const executablePath = process.env.CHROME_PATH || (process.platform === "darwin"
  ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  : process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome");

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(baseUrl, { waitUntil: "networkidle" });
if (await page.locator(".menu-toggle").count()) throw new Error("The obsolete hamburger menu is still rendered.");
await page.click('[data-route="pc"]');
await page.waitForSelector(".auth-card");
if (await page.locator(".pc-stage").count()) throw new Error("A logged-out user reached the PC without authenticating.");
await page.click('[data-auth-mode="register"]');
const username = `tester${String(Date.now()).slice(-8)}`;
const password = "correct horse battery staple";
await page.fill('#auth-username', username);
await page.fill('#auth-password', password);
await page.fill('#auth-password-confirmation', password);
await page.click('.auth-primary[type="submit"]');
await page.waitForSelector(".pc-stage");
if (!(await page.locator(".account-button").getAttribute("aria-label"))?.includes(username)) throw new Error("The account control did not show the authenticated user.");
if (await page.locator(".account-online").count()) throw new Error("The obsolete account status dot is still rendered.");
await page.click("[data-open-account]");
await page.click("[data-edit-avatar]");
await page.locator("[data-avatar-input]").setInputFiles({
  name: "avatar.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
});
await page.waitForSelector('.avatar-editor-preview img[src^="blob:"]');
await page.click("[data-avatar-save]");
await page.waitForSelector(".account-profile .account-avatar img");
if (await page.evaluate(() => fetch("/api/auth/avatar").then((response) => response.status)) !== 200) throw new Error("The uploaded avatar was not persisted by the backend.");
if (!await page.locator(".account-button img").count()) throw new Error("The uploaded avatar did not appear in the header.");
await page.click("[data-edit-avatar]");
if (!await page.locator("[data-avatar-remove]").count()) throw new Error("An uploaded avatar did not offer a remove option.");
await page.click("[data-avatar-remove]");
await page.waitForSelector(".account-profile");
if (await page.locator(".account-profile .account-avatar img").count()) throw new Error("Removing an avatar did not restore the initial fallback.");
await page.click(".auth-close");
if (await page.locator(".account-button img").count()) throw new Error("The removed avatar remained in the header.");
await page.click("[data-toggle-theme]");
if (await page.locator("html").getAttribute("data-theme") !== "dark") throw new Error("The theme switch did not activate dark mode.");
if (await page.evaluate(() => localStorage.getItem("nuzzleTheme")) !== "dark") throw new Error("The selected theme was not remembered on the device.");
await page.click("[data-toggle-theme]");
await page.click(".page-back");
if (!(await page.locator('[data-route="encounters"]').first().textContent())?.includes("encounter first")) throw new Error("Battle was not locked for an empty run.");
await page.locator('[data-route="encounters"]').first().click();
await page.click('[data-encounter="0"]');
await page.waitForSelector(".encounter-batch");
const generatedGame = await page.evaluate(() => fetch("/api/game").then((response) => response.json()));
if (generatedGame.roster.length !== 12 || generatedGame.teamIds.length !== 6) throw new Error("The opening encounter did not add 12 Pokémon and select an initial team.");
const outgoingId = generatedGame.teamIds[0];
const replacementId = generatedGame.roster.find((pokemon) => !generatedGame.teamIds.includes(pokemon.id)).id;
const replacementName = generatedGame.roster.find((pokemon) => pokemon.id === replacementId).name;
await page.click(".page-back");
await page.click('[data-route="mart"]');
if (await page.locator('[data-shop-group="TMs"]').count()) throw new Error("The deferred TM category appeared in the Mart.");
if (await page.locator(".shop-item").count() !== 139) throw new Error("The Mart did not render every approved held item.");
await page.click('[data-shop-group="Training Items"]');
if (await page.locator(".shop-item").count() !== 24) throw new Error("The Mart did not render every approved training item.");
const purchaseResponse = page.waitForResponse((response) => response.url().includes("/api/game/shop/hpup") && response.request().method() === "POST");
await page.click('[data-buy="hpup"]');
if (!(await purchaseResponse).ok()) throw new Error("Purchasing a training item failed.");
await page.click(".page-back");
await page.click('[data-route="pc"]');
await page.click(`[data-pc-detail="${outgoingId}"]`);
await page.click("[data-open-pc-items]");
await page.click('[data-pc-item="hpup"]');
const trainingResponse = page.waitForResponse((response) => response.url().includes(`/api/game/pokemon/${outgoingId}/train`) && response.request().method() === "POST");
await page.click("[data-train-form] button[type=submit]");
if (!(await trainingResponse).ok()) throw new Error("Using a purchased training item failed.");
await page.waitForSelector(".sheet-feedback");
await page.click(".sheet-close");
await page.click(`[data-pc-detail="${outgoingId}"]`);
await page.click(`[data-team-toggle="${outgoingId}"]`);
if (await page.locator(".pokemon-sheet").count()) throw new Error("Removing a Pokémon from the team did not close the PC drawer.");
await page.click(`[data-pc-mon="${outgoingId}"]`);
await page.click(`[data-team-toggle="${outgoingId}"]`);
await page.click(".sheet-close");
await page.click(`[data-pc-mon="${replacementId}"]`);
await page.click(`[data-team-toggle="${replacementId}"]`);
await page.click(`[data-team-replace="${outgoingId}"]`);
await page.click(".sheet-close");
await page.click(".page-back");
await page.click('[data-route="lead"]');
await page.click(`[data-select-lead="${replacementId}"]`);
await page.click("[data-start-battle]");
await page.waitForSelector('.battle-screen [data-battle-move="1"]');

if (!(await page.locator(".battle-hud.player").textContent())?.includes(replacementName)) throw new Error("The selected PC Pokémon was not used as the lead.");
if (!(await page.locator(".battle-hud.enemy").textContent())?.includes("Lv. 100")) throw new Error("Brock's Pokémon is not level 100.");
if (await page.locator("[data-battle-move]").count() !== 4) throw new Error("The engine did not provide four moves.");
if (await page.locator(".battle-platform").count() !== 2) throw new Error("The CSS battlefield platforms were not rendered.");
if (!(await page.locator(".battler-slot.player img").getAttribute("src"))?.includes("gen5-back")) throw new Error("The generated player Pokémon did not use a back sprite.");
if ((await page.locator(".battle-arena").evaluate((element) => getComputedStyle(element).backgroundImage)).includes("arena.png")) throw new Error("The battle still uses the old arena image.");
const battlefieldBounds = await page.locator(".battle-arena").evaluate((arena) => {
  const arenaRect = arena.getBoundingClientRect();
  const bounds = (selector) => {
    const rect = arena.querySelector(selector).getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  };
  const playerPlatform = arena.querySelector(".battle-platform.player").getBoundingClientRect();
  const enemyPlatform = arena.querySelector(".battle-platform.enemy").getBoundingClientRect();
  const enemyImage = arena.querySelector(".battler-slot.enemy img");
  const enemyImageRect = enemyImage.getBoundingClientRect();
  return {
    enemyHud: bounds(".battle-hud.enemy"),
    playerHud: bounds(".battle-hud.player"),
    enemySprite: bounds(".battler-slot.enemy img"),
    playerSprite: bounds(".battler-slot.player"),
    playerPlatformVisibleFraction: (arenaRect.bottom - playerPlatform.top) / playerPlatform.height,
    enemyAnchorErrorX: Math.abs((enemyImageRect.left + enemyImageRect.width / 2) - (enemyPlatform.left + enemyPlatform.width / 2)),
    enemyAnchorErrorY: Math.abs(enemyImageRect.bottom - (enemyPlatform.bottom - enemyPlatform.height * .1 + 16)),
  };
});
const overlaps = (one, two) => one.left < two.right && one.right > two.left && one.top < two.bottom && one.bottom > two.top;
if (overlaps(battlefieldBounds.enemyHud, battlefieldBounds.enemySprite) || overlaps(battlefieldBounds.playerHud, battlefieldBounds.playerSprite)) throw new Error("A health card overlaps its Pokémon sprite slot.");
if (battlefieldBounds.enemyHud.left >= battlefieldBounds.enemySprite.left || battlefieldBounds.playerHud.left <= battlefieldBounds.playerSprite.left) throw new Error("The battlefield does not use the intended opposing-corner layout.");
if (battlefieldBounds.playerPlatformVisibleFraction < 0.45 || battlefieldBounds.playerPlatformVisibleFraction > 0.6) throw new Error("The player's platform is not approximately half-clipped by the bottom of the arena.");
if (battlefieldBounds.enemyAnchorErrorX > 1 || battlefieldBounds.enemyAnchorErrorY > 1) throw new Error("The foe's full-canvas bottom-center was not aligned to the shared platform anchor.");

const turnResponse = page.waitForResponse((response) => response.url().includes("/choices") && response.request().method() === "POST");
await page.click('[data-battle-move="1"]');
if (!(await turnResponse).ok()) throw new Error("The battle choice request failed.");
await page.waitForFunction(() => !document.querySelector(".prompt")?.textContent.includes("Resolving"));
if ((await page.locator(".prompt").textContent())?.includes("Choose your next")) {
  const switchResponse = page.waitForResponse((response) => response.url().includes("/choices") && response.request().method() === "POST");
  await page.locator("[data-battle-switch]:not([disabled])").first().click();
  if (!(await switchResponse).ok()) throw new Error("The forced-switch request failed.");
}
await page.waitForFunction(() => document.querySelector(".prompt")?.textContent.includes("Turn 2"));
if (await page.locator(".battle-log-entry.player", { hasText: "used" }).count() < 1) throw new Error("The battle log omitted the player's move.");
if (await page.locator(".battle-log-entry.opponent", { hasText: "used" }).count() < 1) throw new Error("The battle log omitted Brock's move.");
if (await page.locator(".battle-log-turn", { hasText: "Turn 2" }).count()) throw new Error("The empty upcoming turn consumed battle-log space.");
if (await page.locator(".battle-log-row.is-new").count() < 1) throw new Error("New battle-log entries were not marked for animation.");
if (await page.locator(".battle-log-row.is-new").first().evaluate((element) => getComputedStyle(element).animationName) !== "battle-log-reveal") throw new Error("New battle-log entries did not receive the reveal animation.");
const collapsedHeight = await page.locator(".battle-log-card").evaluate((element) => element.clientHeight);
await page.click("[data-toggle-battle-log]");
const expandedHeight = await page.locator(".battle-log-card").evaluate((element) => element.clientHeight);
if (expandedHeight <= collapsedHeight) throw new Error("The battle log did not expand.");
if (await page.locator(".battle-command-area").getAttribute("inert") === null) throw new Error("Covered battle controls remained interactive.");
const overlayBounds = await page.locator(".battle-log-card").boundingBox();
const arenaBounds = await page.locator(".battle-arena").boundingBox();
const giveUpBounds = await page.locator(".give-up").boundingBox();
if (!overlayBounds || !arenaBounds || !giveUpBounds || overlayBounds.y < arenaBounds.y + arenaBounds.height - 1 || overlayBounds.y + overlayBounds.height > giveUpBounds.y + 1) throw new Error("The expanded log did not stay between the battle visual and Give Up.");
await page.click("[data-toggle-battle-log]");
if (await page.locator(".battle-command-area").getAttribute("inert") !== null) throw new Error("Battle controls stayed inert after collapse.");

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".battle-screen");
if (!(await page.locator(".prompt").textContent())?.includes("Turn 2")) throw new Error("The active battle was not resumed after refresh.");

await page.click("[data-forfeit-battle]");
await page.waitForFunction(() => document.querySelector(".prompt")?.textContent.includes("Brock won"));
if (await page.locator("[data-forfeit-battle]").count()) throw new Error("Forfeit remained available after the battle ended.");

const imageFailures = await page.locator("img").evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src));
await browser.close();

if (errors.length || imageFailures.length) throw new Error(JSON.stringify({ errors, imageFailures }, null, 2));
console.log("Browser flow passed: auth, opening encounters, full Mart catalogs, training, PC team swap, battle, refresh resume, and forfeit.");
