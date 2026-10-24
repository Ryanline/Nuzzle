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
for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
  await page.setViewportSize(viewport);
  const landingBounds = await page.locator(".home-screen").evaluate((screen) => {
    const settings = screen.querySelector('[data-route="settings"]').getBoundingClientRect();
    const account = screen.querySelector(".account-button").getBoundingClientRect();
    const app = screen.closest(".app").getBoundingClientRect();
    const opponentTeam = screen.querySelector(".opponent-team").getBoundingClientRect();
    const opponentButton = screen.querySelector(".opponent-team button");
    const opponentSpriteStyle = getComputedStyle(opponentButton.querySelector("img"));
    return {
      viewportHeight: window.innerHeight,
      settingsBottom: settings.bottom,
      settingsHeight: settings.height,
      accountTop: account.top,
      documentScrollHeight: document.documentElement.scrollHeight,
      appCenter: app.left + app.width / 2,
      opponentTeamCenter: opponentTeam.left + opponentTeam.width / 2,
      opponentTeamOverflow: getComputedStyle(screen.querySelector(".opponent-team")).overflow,
      opponentButtonOverflow: getComputedStyle(opponentButton).overflow,
      opponentSpriteTranslation: new DOMMatrix(opponentSpriteStyle.transform).m41,
    };
  });
  if (landingBounds.settingsBottom > landingBounds.viewportHeight + 1 || landingBounds.settingsHeight < 34) throw new Error(`Landing controls do not fit ${viewport.width}x${viewport.height}.`);
  if (landingBounds.accountTop < -1 || landingBounds.documentScrollHeight > landingBounds.viewportHeight + 1) throw new Error(`Landing page overflows ${viewport.width}x${viewport.height}.`);
  if (Math.abs(landingBounds.appCenter - landingBounds.opponentTeamCenter) > 1) throw new Error(`The opponent team is not centered at ${viewport.width}x${viewport.height}.`);
  if (landingBounds.opponentTeamOverflow !== "visible" || landingBounds.opponentButtonOverflow !== "visible") throw new Error(`Wide opponent sprites can be clipped at ${viewport.width}x${viewport.height}.`);
  if (Math.abs(landingBounds.opponentSpriteTranslation + 20) > .1) throw new Error(`Opponent team sprites were not shifted left 20px at ${viewport.width}x${viewport.height}.`);
}
await page.setViewportSize({ width: 390, height: 844 });
if (await page.locator(".menu-toggle").count()) throw new Error("The obsolete hamburger menu is still rendered.");
await page.click('[data-route="pc"]');
await page.waitForSelector(".auth-card");
if (await page.locator(".pc-stage").count()) throw new Error("A logged-out user reached the PC without authenticating.");
await page.click('[data-auth-mode="register"]');
const username = "ryanline";
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
await page.click('[data-route="settings"]');
if (!await page.locator('[data-route="config"]').count()) throw new Error("The ryanline account did not receive the trainer config entry point.");
await page.click('[data-route="config"]');
await page.waitForSelector(".config-current");
await page.click("[data-open-trainer-form]");
if (await page.locator('[name="spriteId"]').inputValue()) throw new Error("A new trainer draft did not start with an empty sprite choice.");
if (!(await page.locator("[data-trainer-sprite-preview]").getAttribute("src"))?.includes("mystery.png")) throw new Error("The empty trainer draft did not show the mystery avatar.");
await page.click("[data-toggle-trainer-sprites]");
if (await page.locator(".trainer-sprite-option").count() < 1000) throw new Error("The full scrollable trainer sprite catalog was not available.");
await page.fill('.trainer-form input[name="name"]', "Persistent draft");
await page.fill('.trainer-form input[name="spriteId"]', "misty-mast");
const narrowedSpriteCount = await page.locator(".trainer-sprite-option").count();
if (narrowedSpriteCount < 1 || narrowedSpriteCount >= 1000) throw new Error("Typing did not narrow the trainer sprite dropdown.");
await page.click('[data-trainer-sprite-option="misty-masters"]');
await page.fill('.trainer-form textarea[name="teamText"]', "Starmie\nAbility: Natural Cure\n- Surf");
await page.click('.config-back[data-route="settings"]');
await page.click('[data-route="config"]');
if (await page.locator('.trainer-form input[name="name"]').inputValue() !== "Persistent draft") throw new Error("The trainer name draft did not persist across navigation.");
if (await page.locator('.trainer-form input[name="spriteId"]').inputValue() !== "misty-masters") throw new Error("The trainer sprite draft did not persist across navigation.");
if (!(await page.locator('.trainer-form textarea[name="teamText"]').inputValue()).includes("Starmie")) throw new Error("The trainer team draft did not persist across navigation.");
await page.reload({ waitUntil: "networkidle" });
await page.click('[data-route="settings"]');
await page.waitForSelector('[data-route="config"]');
await page.click('[data-route="config"]');
await page.waitForSelector(".config-current");
await page.click("[data-open-trainer-form]");
if (await page.locator('.trainer-form input[name="name"]').inputValue() !== "Persistent draft") throw new Error("The trainer draft did not persist across a page reload.");
const addQueuedTrainer = async (name, spriteId, species) => {
  await page.click("[data-open-trainer-form]");
  await page.fill('.trainer-form input[name="name"]', name);
  await page.fill('.trainer-form input[name="spriteId"]', spriteId);
  await page.fill('.trainer-form textarea[name="teamText"]', `${species}\nAbility: Pressure\nLevel: 100\n- Protect`);
  const response = page.waitForResponse((candidate) => candidate.url().endsWith("/api/admin/trainers") && candidate.request().method() === "POST");
  await page.click('.trainer-form button[type="submit"]');
  if (!(await response).ok()) throw new Error(`Adding ${name} to the daily trainer queue failed.`);
};
await addQueuedTrainer("Blue", "blue", "Mewtwo");
await addQueuedTrainer("Red", "red", "Mew");
if (await page.locator("[data-trainer-row]").count() !== 2) throw new Error("The admin queue did not render both added trainers.");
const reorderResponse = page.waitForResponse((candidate) => candidate.url().endsWith("/api/admin/trainers/order") && candidate.request().method() === "PUT");
await page.locator('[data-move-trainer][data-direction="up"]').nth(1).click();
if (!(await reorderResponse).ok()) throw new Error("Reordering the daily trainer queue failed.");
if (!(await page.locator("[data-trainer-row]").first().textContent())?.includes("Red")) throw new Error("The daily trainer queue did not retain its reordered position.");
await page.click('.config-back[data-route="settings"]');
await page.click(".page-back");
const emptyRunBattleButton = page.locator('button[data-route="encounters"]', { hasText: /^battle$/i });
if (await emptyRunBattleButton.count() !== 1) throw new Error("The empty-run Battle button did not retain its normal label and redirect to encounters.");
await emptyRunBattleButton.click();
const encounterScroll = await page.locator(".encounter-list").evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
if (encounterScroll.scrollHeight <= encounterScroll.clientHeight) throw new Error("The 12 opening encounters did not receive a contained scroll area.");
for (let slot = 0; slot < 12; slot++) {
  const scrollTopBeforeReveal = slot === 5
    ? await page.locator(".encounter-list").evaluate((element) => {
      element.scrollTop = 240;
      return element.scrollTop;
    })
    : null;
  const encounterResponse = page.waitForResponse((response) => response.url().includes(`/api/game/encounters/${slot}`) && response.request().method() === "POST");
  await page.click(`[data-encounter="${slot}"]`);
  if (!(await encounterResponse).ok()) throw new Error(`Opening encounter ${slot + 1} failed.`);
  if (scrollTopBeforeReveal !== null) {
    const scrollTopAfterReveal = await page.locator(".encounter-list").evaluate((element) => element.scrollTop);
    if (Math.abs(scrollTopAfterReveal - scrollTopBeforeReveal) > 2) throw new Error("Revealing an encounter reset the list scroll position.");
  }
  if (slot === 0) {
    const firstEncounter = await page.evaluate(() => fetch("/api/game").then((response) => response.json()));
    if (firstEncounter.roster.length !== 1 || !firstEncounter.battleUnlocked) throw new Error("The first individual encounter did not add one Pokémon and unlock battle.");
    if (await page.locator(".encounter-card.revealed").count() !== 1) throw new Error("A newly claimed encounter did not remain visible during its reveal visit.");
  }
}
const generatedGame = await page.evaluate(() => fetch("/api/game").then((response) => response.json()));
if (generatedGame.roster.length !== 12 || generatedGame.teamIds.length !== 6) throw new Error("The 12 opening encounters did not build the initial roster and team.");
const outgoingId = generatedGame.teamIds[0];
const outgoingPokemon = generatedGame.roster.find((pokemon) => pokemon.id === outgoingId);
const content = await page.evaluate(() => fetch("/api/content").then((response) => response.json()));
const teachableTm = content.items.find((item) => item.group === "TMs" && outgoingPokemon.learnableMoveIds.includes(item.moveId) && !outgoingPokemon.moves.some((move) => move.toLowerCase().replace(/[^a-z0-9]+/g, "") === item.moveId));
if (!teachableTm) throw new Error("No compatible TM was available for the PC teaching flow.");
const replacementId = generatedGame.roster.find((pokemon) => !generatedGame.teamIds.includes(pokemon.id)).id;
const replacementName = generatedGame.roster.find((pokemon) => pokemon.id === replacementId).name;
await page.click(".page-back");
await page.click('[data-route="encounters"]');
if (await page.locator(".encounter-card.revealed").count()) throw new Error("Previously claimed encounters remained visible after returning to the screen.");
if (!await page.locator(".encounter-empty").count()) throw new Error("The completed encounter screen did not show its empty state.");
await page.click(".page-back");
await page.click('[data-route="mart"]');
if (await page.locator('[data-shop-group="TMs"]').count() !== 1) throw new Error("The TM category did not appear in the Mart.");
if (await page.locator(".shop-item").count() !== 139) throw new Error("The Mart did not render every approved held item.");
await page.click('[data-shop-group="Training Items"]');
if (await page.locator(".shop-item").count() !== 24) throw new Error("The Mart did not render every approved training item.");
await page.click('[data-shop-group="TMs"]');
if (await page.locator(".shop-item").count() !== 690) throw new Error("The Mart did not render every eligible TM.");
await page.click(`[data-open-purchase="${teachableTm.id}"]`);
const tmPurchaseResponse = page.waitForResponse((response) => response.url().includes(`/api/game/shop/${teachableTm.id}`) && response.request().method() === "POST");
await page.click(`[data-purchase-form="${teachableTm.id}"] button[type="submit"]`);
if (!(await tmPurchaseResponse).ok()) throw new Error("Purchasing a TM failed.");
await page.click('[data-shop-group="Training Items"]');
await page.click('[data-item-about="hpup"]');
if (!(await page.locator(".mart-item-description").textContent())?.includes("HP EV")) throw new Error("The Mart item information drawer did not show the item description.");
await page.click(".mart-sheet .sheet-close");
await page.click('[data-open-purchase="hpup"]');
await page.fill("#purchase-quantity", "5");
if ((await page.locator("[data-purchase-quantity-output]").textContent())?.trim() !== "×5") throw new Error("The selected bulk quantity did not update.");
if ((await page.locator("[data-purchase-price]").textContent())?.trim() !== "₽50") throw new Error("The bulk purchase price did not update.");
const purchaseResponse = page.waitForResponse((response) => response.url().includes("/api/game/shop/hpup") && response.request().method() === "POST");
await page.click('[data-purchase-form="hpup"] button[type="submit"]');
if (!(await purchaseResponse).ok()) throw new Error("Purchasing a training item failed.");
const purchasedGame = await page.evaluate(() => fetch("/api/game").then((response) => response.json()));
if (purchasedGame.inventory.hpup !== 5) throw new Error("The bulk purchase quantity was not persisted.");
await page.click(".page-back");
await page.click('[data-route="pc"]');
await page.click(`[data-pc-detail="${outgoingId}"]`);
const pcActionSpacing = await page.locator(".pokemon-sheet").evaluate((sheet) => {
  const teamButton = sheet.querySelector("[data-team-toggle]").getBoundingClientRect();
  const itemButton = sheet.querySelector("[data-open-pc-items]").getBoundingClientRect();
  const closeButton = sheet.querySelector(".sheet-actions [data-close-pc-sheet]").getBoundingClientRect();
  const sheetBounds = sheet.getBoundingClientRect();
  return {
    firstGap: itemButton.top - teamButton.bottom,
    secondGap: closeButton.top - itemButton.bottom,
    closeBottom: closeButton.bottom,
    sheetBottom: sheetBounds.bottom,
  };
});
if (pcActionSpacing.firstGap < 9 || Math.abs(pcActionSpacing.firstGap - pcActionSpacing.secondGap) > 1) throw new Error("The PC drawer actions do not have consistent spacing.");
if (pcActionSpacing.closeBottom > pcActionSpacing.sheetBottom + 1) throw new Error("The PC drawer actions overflow the drawer.");
await page.click('[data-pc-detail-view="training"]');
if (await page.locator(".training-details .pokemon-facts").count() || await page.locator(".pc-detail-panel > .pokemon-facts").count()) throw new Error("The IV and EV view still includes the general Pokémon facts.");
if (await page.locator(".training-stat-row").count() !== 6) throw new Error("The PC training view did not show all six battle stats.");
if (!(await page.locator(".ev-total").textContent())?.includes("/ 510")) throw new Error("The PC training view did not show the total EV limit.");
await page.click('[data-pc-detail-view="stats"]');
await page.click("[data-open-pc-items]");
await page.click('[data-pc-item="hpup"]');
const trainingResponse = page.waitForResponse((response) => response.url().includes(`/api/game/pokemon/${outgoingId}/train`) && response.request().method() === "POST");
await page.click("[data-train-form] button[type=submit]");
if (!(await trainingResponse).ok()) throw new Error("Using a purchased training item failed.");
await page.waitForSelector(".sheet-feedback");
await page.click("[data-open-pc-items]");
await page.click('[data-pc-item-group="TMs"]');
await page.click(`[data-pc-item="${teachableTm.id}"]`);
const tmTrainingResponse = page.waitForResponse((response) => response.url().includes(`/api/game/pokemon/${outgoingId}/train`) && response.request().method() === "POST");
await page.click("[data-train-form] button[type=submit]");
if (!(await tmTrainingResponse).ok()) throw new Error("Teaching a purchased TM failed.");
const tmTrainedGame = await page.evaluate(() => fetch("/api/game").then((response) => response.json()));
if (tmTrainedGame.roster.find((pokemon) => pokemon.id === outgoingId).moves[0] !== teachableTm.move) throw new Error("The selected move slot was not replaced by the TM.");
if (tmTrainedGame.inventory[teachableTm.id]) throw new Error("The successfully used TM was not consumed.");
await page.click(".sheet-close");
await page.click(`[data-pc-detail="${outgoingId}"]`);
let teamUpdateResponse = page.waitForResponse((response) => response.url().endsWith("/api/game/team") && response.request().method() === "PUT");
await page.click(`[data-team-toggle="${outgoingId}"]`);
if (!(await teamUpdateResponse).ok()) throw new Error("Removing a Pokémon from the team failed.");
if (await page.locator(".pokemon-sheet").count()) throw new Error("Removing a Pokémon from the team did not close the PC drawer.");
await page.click(`[data-pc-mon="${outgoingId}"]`);
teamUpdateResponse = page.waitForResponse((response) => response.url().endsWith("/api/game/team") && response.request().method() === "PUT");
await page.click(`[data-team-toggle="${outgoingId}"]`);
if (!(await teamUpdateResponse).ok()) throw new Error("Returning a Pokémon to the team failed.");
await page.click(".sheet-close");
await page.click(`[data-pc-mon="${replacementId}"]`);
await page.click(`[data-team-toggle="${replacementId}"]`);
teamUpdateResponse = page.waitForResponse((response) => response.url().endsWith("/api/game/team") && response.request().method() === "PUT");
await page.click(`[data-team-replace="${outgoingId}"]`);
if (!(await teamUpdateResponse).ok()) throw new Error("Replacing a team Pokémon failed.");
await page.click(".sheet-close");
await page.click(".page-back");
await page.click('[data-route="lead"]');
await page.click(`[data-select-lead="${replacementId}"]`);
if (!(await page.locator(".lead-details-card").textContent())?.includes(replacementName)) throw new Error("Selecting a lead did not show its battle details.");
if (await page.locator(".lead-stat").count() !== 6) throw new Error("The lead preview did not show all six battle stats together.");
if (await page.locator(".lead-move-grid > span").count() !== 4) throw new Error("The lead preview did not show all four moves.");
const leadChoiceTops = await page.locator(".lead-choice").evaluateAll((choices) => choices.map((choice) => Math.round(choice.getBoundingClientRect().top)));
if (new Set(leadChoiceTops).size !== 1) throw new Error("The six lead choices did not fit in one row.");
if (!(await page.locator(".lead-arena").evaluate((element) => getComputedStyle(element).backgroundImage)).includes("assets/arena.jpg")) throw new Error("The lead preview did not load the grassy arena background.");
if (await page.locator(".lead-arena .battle-platform").count() !== 2) throw new Error("The lead preview did not use the shared CSS battlefield platforms.");
if (await page.locator(".lead-arena .battle-platform").first().evaluate((element) => getComputedStyle(element).backgroundImage) !== "none") throw new Error("The lead preview still shows an oval platform.");
const trainerAnchorError = await page.locator(".lead-arena").evaluate((arena) => {
  const trainer = arena.querySelector(".trainer").getBoundingClientRect();
  const anchor = arena.querySelector(".battle-platform.enemy").getBoundingClientRect();
  return Math.abs(trainer.left + trainer.width / 2 - (anchor.left + anchor.width / 2));
});
if (trainerAnchorError > 1) throw new Error(`The daily trainer was not centered on the shared opponent anchor (${trainerAnchorError}px off).`);
await page.click("[data-start-battle]");
await page.waitForSelector('.battle-screen [data-battle-move="1"]');

if (!(await page.locator(".battle-hud.player").textContent())?.includes(replacementName)) throw new Error("The selected PC Pokémon was not used as the lead.");
if (!(await page.locator(".battle-hud.enemy").textContent())?.includes("Lv. 100")) throw new Error("Brock's Pokémon is not level 100.");
if (await page.locator("[data-battle-move]").count() !== 4) throw new Error("The engine did not provide four moves.");
if (await page.locator(".battle-platform").count() !== 2) throw new Error("The CSS battlefield platforms were not rendered.");
if (await page.locator(".battle-platform").first().evaluate((element) => getComputedStyle(element).backgroundImage) !== "none") throw new Error("The battle still shows an oval platform.");
const playerSpriteSource = await page.locator(".battler-slot.player img").getAttribute("src");
if (!playerSpriteSource?.includes("gen5-back") && !playerSpriteSource?.includes("sprites-back")) throw new Error("The generated player Pokémon did not use a back sprite.");
if (!(await page.locator(".battle-arena").evaluate((element) => getComputedStyle(element).backgroundImage)).includes("assets/arena.jpg")) throw new Error("The battle did not load the grassy arena background.");
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
    enemyAnchorErrorY: Math.abs(enemyImageRect.bottom - (enemyPlatform.bottom - enemyPlatform.height * .1 + 30 - enemyImageRect.height * .12)),
    enemyContained: enemyImageRect.left >= arenaRect.left && enemyImageRect.right <= arenaRect.right && enemyImageRect.top >= arenaRect.top && enemyImageRect.bottom <= arenaRect.bottom,
  };
});
const overlaps = (one, two) => one.left < two.right && one.right > two.left && one.top < two.bottom && one.bottom > two.top;
if (overlaps(battlefieldBounds.enemyHud, battlefieldBounds.enemySprite) || overlaps(battlefieldBounds.playerHud, battlefieldBounds.playerSprite)) throw new Error("A health card overlaps its Pokémon sprite slot.");
if (battlefieldBounds.enemyHud.left >= battlefieldBounds.enemySprite.left || battlefieldBounds.playerHud.left <= battlefieldBounds.playerSprite.left) throw new Error("The battlefield does not use the intended opposing-corner layout.");
if (battlefieldBounds.playerPlatformVisibleFraction < 0.45 || battlefieldBounds.playerPlatformVisibleFraction > 0.6) throw new Error("The player's platform is not approximately half-clipped by the bottom of the arena.");
if (battlefieldBounds.enemyAnchorErrorX > 1 || battlefieldBounds.enemyAnchorErrorY > 1) throw new Error("The foe's full-canvas bottom-center was not aligned to the shared platform anchor.");
if (!battlefieldBounds.enemyContained) throw new Error(`The foe sprite canvas falls outside the battle arena: ${JSON.stringify(battlefieldBounds.enemySprite)}`);

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
await page.waitForSelector(".result-modal");
if (!(await page.locator(".result-modal").textContent())?.includes("Defeat")) throw new Error("The result overlay did not report the loss.");
const resultCenterOffset = await page.locator(".result-modal").evaluate((modal) => {
  const bounds = modal.getBoundingClientRect();
  return Math.abs(bounds.top + bounds.height / 2 - window.innerHeight / 2);
});
if (resultCenterOffset > 2) throw new Error(`The result overlay was not vertically centered (${resultCenterOffset}px off).`);
if (await page.locator(".result-mon-card").count() !== 6) throw new Error("The result overlay did not show all six opposing Pokémon.");
await page.click(".result-close");
if (await page.locator(".result-modal").count()) throw new Error("The result overlay did not close.");
if (await page.locator("[data-open-result]").count() !== 1) throw new Error("The completed battle did not retain a result button.");
await page.click("[data-open-result]");
await page.waitForSelector(".result-modal");
await page.click(".result-close");
await page.click('.battle-result-actions [data-route="home"]');
if (!(await page.locator('.home-actions [data-route="battle"]').textContent())?.includes("view result")) throw new Error("The landing battle button did not point back to today's result.");
await page.click('.home-actions [data-route="battle"]');
await page.waitForSelector(".result-modal");
await page.click(".result-close");
await page.click('.battle-result-actions [data-route="home"]');
const leaderboardResponses = Promise.all([
  page.waitForResponse((response) => response.url().endsWith("/api/leaderboard/daily") && response.request().method() === "GET"),
  page.waitForResponse((response) => response.url().endsWith("/api/leaderboard/streak") && response.request().method() === "GET"),
]);
await page.click('[data-route="leaderboard"]');
if ((await leaderboardResponses).some((response) => !response.ok())) throw new Error("Loading the leaderboards failed.");
await page.waitForSelector('.leaderboard-tabs [data-leaderboard-view="daily"].selected');
if (await page.locator(".leaderboard-row.leaderboard-loss").count() !== 1) throw new Error("A completed loss did not appear on the daily leaderboard.");
if (!(await page.locator(".leaderboard-row.leaderboard-loss").textContent())?.includes(username)) throw new Error("The daily loss row did not show the account name.");
await page.click('[data-leaderboard-view="streak"]');
if (!(await page.locator(".streak-row").textContent())?.includes("0-day streak")) throw new Error("A completed loss did not appear as a zero-day streak.");
await page.click('.leaderboard-stage [data-route="home"]');
await page.click('[data-route="settings"]');
if (await page.locator("[data-reset-daily-battle]").count() !== 1) throw new Error("The admin settings did not expose the daily battle reset.");
const resetResponse = page.waitForResponse((response) => response.url().endsWith("/api/admin/battle/reset") && response.request().method() === "POST");
await page.click("[data-reset-daily-battle]");
if (!(await resetResponse).ok()) throw new Error("Resetting the admin's daily battle failed.");
if (!(await page.locator(".admin-battle-reset").textContent())?.includes("ready to play again")) throw new Error("The daily battle reset did not report success.");
await page.click('.settings-stage [data-route="home"]');
const freshBattleButton = page.locator('.home-actions [data-route="encounters"]');
if ((await freshBattleButton.textContent())?.trim() !== "battle") throw new Error("A forfeit did not route the fresh run through opening encounters.");
await freshBattleButton.click();
if (await page.locator("[data-encounter-slot]").count() !== 12) throw new Error("A forfeit did not create twelve fresh-run encounters.");

const imageFailures = await page.locator("img").evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src));
await browser.close();

if (errors.length || imageFailures.length) throw new Error(JSON.stringify({ errors, imageFailures }, null, 2));
console.log("Browser flow passed: auth, opening encounters, full Mart catalogs, training, PC team swap, battle, refresh resume, and forfeit.");
