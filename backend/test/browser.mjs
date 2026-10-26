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
if (!/^Daily Nuzzle #\d+: /.test((await page.locator(".home-header .screen-title").textContent())?.trim() || "")) throw new Error("The landing title did not identify the Daily Nuzzle.");
for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
  await page.setViewportSize(viewport);
  const landingBounds = await page.locator(".home-screen").evaluate((screen) => {
    const settings = screen.querySelector('[data-route="settings"]').getBoundingClientRect();
    const account = screen.querySelector(".account-button").getBoundingClientRect();
    const app = screen.closest(".app").getBoundingClientRect();
    const opponentTeam = screen.querySelector(".opponent-team").getBoundingClientRect();
    const opponentButton = screen.querySelector(".opponent-team button");
    const opponentSpriteStyle = getComputedStyle(opponentButton.querySelector("img"));
    const title = screen.querySelector(".screen-title");
    const titleRect = title.getBoundingClientRect();
    const toolsRect = screen.querySelector(".header-tools").getBoundingClientRect();
    const meta = screen.querySelector(".screen-meta");
    const titleStyle = getComputedStyle(title);
    const metaStyle = getComputedStyle(meta);
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
      titleTop: titleRect.top,
      titleBottom: titleRect.bottom,
      toolsBottom: toolsRect.bottom,
      titleClipped: title.scrollWidth > title.clientWidth + 1 || title.scrollHeight > title.clientHeight + 1,
      titlePosition: titleStyle.position,
      metaText: meta.textContent || "",
      metaTop: meta.getBoundingClientRect().top,
      titleFontSize: titleStyle.fontSize,
      metaFontSize: metaStyle.fontSize,
      metaHeight: meta.getBoundingClientRect().height,
      metaLineHeight: Number.parseFloat(metaStyle.lineHeight),
    };
  });
  if (landingBounds.settingsBottom > landingBounds.viewportHeight + 1 || landingBounds.settingsHeight < 34) throw new Error(`Landing controls do not fit ${viewport.width}x${viewport.height}.`);
  if (landingBounds.accountTop < -1 || landingBounds.documentScrollHeight > landingBounds.viewportHeight + 1) throw new Error(`Landing page overflows ${viewport.width}x${viewport.height}.`);
  if (Math.abs(landingBounds.appCenter - landingBounds.opponentTeamCenter) > 1) throw new Error(`The opponent team is not centered at ${viewport.width}x${viewport.height}.`);
  if (landingBounds.opponentTeamOverflow !== "visible" || landingBounds.opponentButtonOverflow !== "visible") throw new Error(`Wide opponent sprites can be clipped at ${viewport.width}x${viewport.height}.`);
  if (Math.abs(landingBounds.opponentSpriteTranslation + 20) > .1) throw new Error(`Opponent team sprites were not shifted left 20px at ${viewport.width}x${viewport.height}.`);
  if (landingBounds.titlePosition !== "static" || landingBounds.titleTop < landingBounds.toolsBottom - 1 || landingBounds.titleClipped) throw new Error(`The daily title overlaps the header controls or is clipped at ${viewport.width}x${viewport.height}.`);
  if (landingBounds.metaTop < landingBounds.titleBottom) throw new Error(`The daily title overlaps its countdown at ${viewport.width}x${viewport.height}.`);
  if (!/next trainer in \d{2}:\d{2}:\d{2}/i.test(landingBounds.metaText)) throw new Error(`The daily countdown is missing at ${viewport.width}x${viewport.height}.`);
  if (!landingBounds.metaText.includes(" - ") || landingBounds.titleFontSize !== landingBounds.metaFontSize) throw new Error(`The date and countdown line does not match the title typography at ${viewport.width}x${viewport.height}.`);
  if (landingBounds.metaHeight > landingBounds.metaLineHeight * 1.5) throw new Error(`The date and countdown wrapped at ${viewport.width}x${viewport.height}.`);
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
const registrationResponse = page.waitForResponse((response) => response.url().endsWith("/api/auth/register") && response.request().method() === "POST");
await page.locator("[data-auth-form]").evaluate((form) => form.requestSubmit());
if (!(await registrationResponse).ok()) throw new Error("Registering the browser-test account failed.");
await page.waitForSelector(".pc-stage");
await page.waitForSelector(".welcome-card");
if ((await page.locator(".welcome-card h2").textContent())?.trim() !== "Welcome to Nuzzle!") throw new Error("A new account did not receive the welcome message.");
if (!(await page.locator(".welcome-card").textContent())?.includes("daily puzzle game")) throw new Error("The welcome message did not explain Nuzzle.");
const welcomeResponse = page.waitForResponse((response) => response.url().endsWith("/api/account/welcome") && response.request().method() === "PUT");
await page.click("[data-dismiss-welcome]");
if (!(await welcomeResponse).ok()) throw new Error("Acknowledging the welcome message failed.");
if (await page.locator(".welcome-card").count()) throw new Error("The acknowledged welcome message remained open.");
if (!(await page.locator(".account-button").getAttribute("aria-label"))?.includes(username)) throw new Error("The account control did not show the authenticated user.");
if (await page.locator(".account-online").count()) throw new Error("The obsolete account status dot is still rendered.");
await page.click("[data-open-account]");
if (!(await page.locator(".account-profile .account-avatar img").getAttribute("src"))?.includes("/trainers/unknownf.png")) throw new Error("A new account did not default to Showdown's unknown trainer avatar.");
const avatarListResponse = page.waitForResponse((response) => response.url().endsWith("/api/account/avatars") && response.request().method() === "GET");
await page.click("[data-edit-avatar]");
if (!(await avatarListResponse).ok()) throw new Error("Loading the account avatar catalog failed.");
await page.waitForSelector('[data-avatar-sprite="misty"]');
if (await page.locator("[data-avatar-sprite]").count() < 1400) throw new Error("The account avatar picker did not expose the full trainer sprite catalog.");
await page.fill("[data-avatar-search]", "misty");
if (await page.locator('[data-avatar-sprite="misty"]').count() !== 1) throw new Error("Searching account avatars did not find Misty.");
const avatarUpdateResponse = page.waitForResponse((response) => response.url().endsWith("/api/account/avatar") && response.request().method() === "PUT");
await page.click('[data-avatar-sprite="misty"]');
if (!(await avatarUpdateResponse).ok()) throw new Error("Saving an account avatar failed.");
if (!(await page.locator(".account-profile .account-avatar img").getAttribute("src"))?.includes("/trainers/misty.png")) throw new Error("The saved account avatar did not appear in the account card.");
await page.click(".auth-close");
await page.click("[data-toggle-theme]");
if (await page.locator("html").getAttribute("data-theme") !== "dark") throw new Error("The theme switch did not activate dark mode.");
if (await page.evaluate(() => localStorage.getItem("nuzzleTheme")) !== "dark") throw new Error("The selected theme was not remembered on the device.");
await page.click("[data-toggle-theme]");
await page.click(".page-back");
await page.click('[data-route="settings"]');
if ((await page.locator(".more-stage h2").textContent())?.trim() !== "More") throw new Error("The Settings destination was not replaced by More.");
const moreButtons = await page.locator(".more-stage button").evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), classes: button.className })));
if (moreButtons.map(({ label }) => label).join(",") !== "How to play,What a Nuzlocke is,Schedule,Affiliation,Scheduler,Battle reset,Back") throw new Error("The More actions were not rendered in the requested order.");
for (const [index, color] of ["red", "yellow", "green", "blue", "gold", "slate", "purple"].entries()) {
  if (!moreButtons[index].classes.includes(color)) throw new Error(`${moreButtons[index].label} did not use the requested ${color} palette.`);
}
await page.setViewportSize({ width: 320, height: 568 });
const moreCardChecks = [
  ["how-to-play", "How to play", "Challenge the daily trainer", null],
  ["nuzlocke", "What a Nuzlocke is", "fainted Pokémon are considered lost", "bulbapedia.bulbagarden.net/wiki/Nuzlocke_Challenge"],
  ["schedule", "Battle schedule", "12:00 AM Eastern Time (EST)", null],
  ["affiliation", "Affiliation", "not affiliated with or endorsed", "github.com/smogon/pokemon-showdown"],
];
for (const [cardId, title, copy, link] of moreCardChecks) {
  await page.click(`[data-open-more-card="${cardId}"]`);
  const card = page.locator(".more-card");
  if ((await card.locator("h2").textContent())?.trim() !== title || !(await card.textContent())?.includes(copy)) throw new Error(`${title} did not show its expected concise copy.`);
  if (await card.locator(".auth-close").count() !== 1 || await card.locator(".more-card-back", { hasText: "Back" }).count() !== 1) throw new Error(`${title} did not provide both close controls.`);
  const cardFit = await card.evaluate((element) => ({ top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  if (cardFit.top < 0 || cardFit.bottom > 568 || cardFit.scrollHeight > cardFit.clientHeight) throw new Error(`${title} did not fit a 320x568 mobile page without scrolling.`);
  if (link && !await card.locator(`a[href*="${link}"]`).count()) throw new Error(`${title} did not include its required source link.`);
  if (cardId === "how-to-play" && !(await card.textContent())?.includes("but you can start fresh tomorrow!")) throw new Error("How to play did not use the requested run-reset wording.");
  if (cardId === "schedule" && (await card.locator(".battle-schedule dd").allTextContents()).join(",") !== "Theme teams,Regular trainers,Ace trainers,Rival battles,Gym leaders,Elite 4,Champions") throw new Error("The battle schedule did not use the requested labels and capitalization.");
  if (cardId === "affiliation" && (await card.locator(".more-card-content > p").count() !== 4 || !(await card.locator(".more-card-content > p").last().textContent())?.includes("sprites are © Nintendo"))) throw new Error("The affiliation and ownership notices were not combined into one paragraph.");
  await card.locator(".more-card-back").click();
  if (await page.locator(".more-card").count()) throw new Error(`${title} remained open after using Back.`);
}
await page.setViewportSize({ width: 390, height: 844 });
if (!await page.locator('[data-route="config"]', { hasText: "Scheduler" }).count()) throw new Error("The ryanline account did not receive the Scheduler entry point.");
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
if (await page.locator(".welcome-card").count()) throw new Error("The acknowledged welcome message appeared again.");
await page.click('[data-route="settings"]');
await page.waitForSelector('[data-route="config"]');
await page.click('[data-route="config"]');
await page.waitForSelector(".config-current");
await page.click("[data-open-trainer-form]");
if (await page.locator('.trainer-form input[name="name"]').inputValue() !== "Persistent draft") throw new Error("The trainer draft did not persist across a page reload.");
const addQueuedTrainer = async (name, spriteId, species, shiny = false) => {
  const expectedCount = await page.locator("[data-trainer-row]").count() + 1;
  await page.click("[data-open-trainer-form]");
  await page.fill('.trainer-form input[name="name"]', name);
  await page.fill('.trainer-form input[name="spriteId"]', spriteId);
  await page.fill('.trainer-form textarea[name="teamText"]', `${species}\nAbility: Pressure\n${shiny ? "Shiny: Yes\n" : ""}Level: 100\n- Protect`);
  const response = page.waitForResponse((candidate) => candidate.url().endsWith("/api/admin/trainers") && candidate.request().method() === "POST");
  await page.click('.trainer-form button[type="submit"]');
  if (!(await response).ok()) throw new Error(`Adding ${name} to the daily trainer queue failed.`);
  await page.waitForFunction((count) => document.querySelectorAll("[data-trainer-row]").length === count && !document.querySelector(".trainer-form"), expectedCount);
};
await addQueuedTrainer("Blue", "blue", "Mewtwo");
await addQueuedTrainer("Red", "red", "Mew", true);
if (await page.locator("[data-trainer-row]").count() !== 2) throw new Error("The admin queue did not render both added trainers.");
const reorderResponse = page.waitForResponse((candidate) => candidate.url().endsWith("/api/admin/trainers/order") && candidate.request().method() === "PUT");
await page.locator('[data-move-trainer][data-direction="up"]').nth(1).click();
if (!(await reorderResponse).ok()) throw new Error("Reordering the daily trainer queue failed.");
if (!(await page.locator("[data-trainer-row]").first().textContent())?.includes("Red")) throw new Error("The daily trainer queue did not retain its reordered position.");
if (!(await page.locator("[data-trainer-row]").first().locator(".trainer-queue-copy img").getAttribute("src"))?.includes("/gen5-shiny/mew.png")) throw new Error("A queued shiny trainer Pokémon did not use its shiny sprite.");
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
const replacementId = generatedGame.roster.find((pokemon) => !generatedGame.teamIds.includes(pokemon.id) && pokemon.ability !== "Illusion").id;
const replacementName = generatedGame.roster.find((pokemon) => pokemon.id === replacementId).name;
await page.click(".page-back");
await page.click('[data-route="encounters"]');
if (await page.locator(".encounter-card.revealed").count()) throw new Error("Previously claimed encounters remained visible after returning to the screen.");
if (!await page.locator(".encounter-empty").count()) throw new Error("The completed encounter screen did not show its empty state.");
if (await page.locator(".encounter-count").count()) throw new Error("The completed encounter screen retained the redundant top status.");
const completedEncounterCopy = await page.locator(".encounter-empty").evaluate((element) => ({
  lines: [...element.querySelectorAll("p")].map((line) => line.textContent.trim()),
  fontWeight: getComputedStyle(element.querySelector("p")).fontWeight,
}));
if (completedEncounterCopy.lines[0] !== "All encounters claimed" || !/^New encounters in \d{2}:\d{2}:\d{2}$/.test(completedEncounterCopy.lines[1])) throw new Error("The completed encounter state did not show the concise rollover message.");
if (Number(completedEncounterCopy.fontWeight) > 400) throw new Error("The completed encounter message was styled as a title.");
await page.click(".page-back");
await page.click('[data-route="mart"]');
if (await page.locator('[data-shop-group="TMs"], [data-shop-group="Training Items"]').count()) throw new Error("Training consumables still appeared in the Mart.");
if (await page.locator(".shop-item").count() !== 139) throw new Error("The Mart did not render every approved held item.");
await page.click('[data-open-purchase="leftovers"]');
const heldItemPurchaseResponse = page.waitForResponse((response) => response.url().includes("/api/game/shop/leftovers") && response.request().method() === "POST");
await page.click('[data-purchase-form="leftovers"] button[type="submit"]');
if (!(await heldItemPurchaseResponse).ok()) throw new Error("Purchasing a held item failed.");
const tmHighlightFits = await page.locator(".shop-segments").evaluate((element) => {
  const style = getComputedStyle(element, "::before");
  const translation = style.transform === "none" ? 0 : new DOMMatrixReadOnly(style.transform).m41;
  const rightEdge = Number.parseFloat(style.left) + translation + Number.parseFloat(style.width);
  return rightEdge <= element.clientWidth - 3 + .5;
});
if (!tmHighlightFits) throw new Error("The held-item segment highlight overflowed its control.");
await page.click(".page-back");
await page.click('[data-route="pc"]');
if ((await page.locator(".trainer-reference-section .pc-section-head h2").textContent())?.trim() !== "Brock") throw new Error("The PC did not identify today's trainer team.");
if (await page.locator(".trainer-reference-section .trainer-party-slot").count() !== 6) throw new Error("The PC did not show today's full trainer team.");
if (await page.locator(".party-section [data-pc-detail]").count() !== generatedGame.teamIds.length) throw new Error("The PC Team section did not show only the active team.");
if (await page.locator(".box-section [data-pc-mon]").count() !== generatedGame.roster.length - generatedGame.teamIds.length) throw new Error("The PC Box section did not exclude active team members.");
if (await page.locator(".team-mark, .pc-help").count()) throw new Error("The obsolete PC team labels or helper text are still visible.");
await page.click(`[data-pc-detail="${outgoingId}"]`);
const summaryAppearance = await page.locator(".pokemon-sheet").evaluate((sheet) => {
  const buttons = [...sheet.querySelectorAll(".sheet-actions .gloss-button")];
  const lightBackgrounds = buttons.map((button) => getComputedStyle(button).backgroundImage);
  document.documentElement.dataset.theme = "dark";
  const darkBackgrounds = buttons.map((button) => getComputedStyle(button).backgroundImage);
  document.documentElement.dataset.theme = "light";
  return {
    labels: buttons.map((button) => button.textContent.trim()),
    classes: buttons.map((button) => button.className),
    lightBackgrounds,
    darkBackgrounds,
    factsTopBorder: getComputedStyle(sheet.querySelector(".pokemon-facts")).borderTopWidth,
  };
});
if (summaryAppearance.labels.join(",") !== "Remove from team,Held item,Close") throw new Error("The PC Summary actions did not use the requested labels and capitalization.");
if (!summaryAppearance.classes[0].includes("red") || !summaryAppearance.classes[1].includes("blue") || !summaryAppearance.classes[2].includes("slate")) throw new Error("The PC Summary actions did not match the Battle, Mart, and Settings colors.");
if (summaryAppearance.lightBackgrounds.some((value, index) => value === summaryAppearance.darkBackgrounds[index])) throw new Error("The PC Summary action colors did not adapt to dark mode.");
if (summaryAppearance.factsTopBorder !== "0px") throw new Error("PC Summary retained the redundant divider above Ability.");
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
if (pcActionSpacing.firstGap < 6 || Math.abs(pcActionSpacing.firstGap - pcActionSpacing.secondGap) > 1) throw new Error("The PC drawer actions do not have consistent spacing.");
if (pcActionSpacing.closeBottom > pcActionSpacing.sheetBottom + 1) throw new Error("The PC drawer actions overflow the drawer.");
await page.setViewportSize({ width: 390, height: 568 });
await page.click('[data-pc-detail-view="training"]');
const expectedNatureOrder = ["Adamant", "Lonely", "Naughty", "Brave", "Bold", "Impish", "Relaxed", "Lax", "Jolly", "Timid", "Hasty", "Naive", "Modest", "Mild", "Rash", "Quiet", "Calm", "Careful", "Sassy", "Gentle", "Bashful", "Docile", "Hardy", "Quirky", "Serious"];
if (JSON.stringify(await page.locator("[data-training-nature] option").evaluateAll((options) => options.map((option) => option.value))) !== JSON.stringify(expectedNatureOrder)) throw new Error("The Training nature menu did not use the requested order.");
if (await page.locator(".pc-detail-panel > .pokemon-facts").count()) throw new Error("Training still includes the general Pokémon facts.");
if (await page.locator(".training-editor-row").count() !== 6) throw new Error("Training did not show all six battle stats.");
if ((await page.locator(".training-stat-name").allTextContents()).join(",") !== "HP,Atk,Def,Sp. Atk,Sp. Def,Spe") throw new Error("Training did not use the requested Showdown stat labels.");
if ((await page.locator(".training-column-head").textContent())?.includes("FINAL") || (await page.locator(".training-editor").textContent())?.includes("Values update before you spend")) throw new Error("Training retained the removed explanatory headings.");
if (!(await page.locator(".training-remaining").textContent())?.includes("EVs remaining")) throw new Error("Training did not show the remaining EV budget.");
const trainingLayout = await page.locator(".training-sheet").evaluate((sheet) => {
  const sheetBounds = sheet.getBoundingClientRect();
  const footerBounds = sheet.querySelector(".training-footer").getBoundingClientRect();
  const trainingContent = sheet.querySelector(".training-scroll");
  const movesBounds = sheet.querySelector(".training-moves").getBoundingClientRect();
  const summaryBounds = sheet.querySelector(".pokemon-summary").getBoundingClientRect();
  const spriteBounds = sheet.querySelector(".pokemon-summary > img").getBoundingClientRect();
  const nameStyle = getComputedStyle(sheet.querySelector(".pokemon-summary h2"));
  const maxButton = sheet.querySelector(".training-iv-max");
  const footerButtons = [...sheet.querySelectorAll(".training-footer-actions .gloss-button")];
  const slider = sheet.querySelector("[data-training-ev]");
  return {
    sheetHeight: sheetBounds.height,
    horizontalOverflow: sheet.scrollWidth - sheet.clientWidth,
    footerOverflow: footerBounds.bottom - sheetBounds.bottom,
    trainingScrollOverflow: trainingContent.scrollHeight - trainingContent.clientHeight,
    unusedGap: footerBounds.top - movesBounds.bottom,
    summaryHeight: summaryBounds.height,
    spriteWidth: spriteBounds.width,
    nameFontSize: nameStyle.fontSize,
    maxButtonText: maxButton.textContent,
    maxButtonWidth: maxButton.getBoundingClientRect().width,
    footerButtonLabels: footerButtons.map((button) => button.textContent.trim()),
    footerButtonHeights: footerButtons.map((button) => button.getBoundingClientRect().height),
    sliderHeight: slider.getBoundingClientRect().height,
  };
});
if (trainingLayout.horizontalOverflow > 1 || trainingLayout.footerOverflow > 1 || trainingLayout.trainingScrollOverflow > 1) throw new Error(`The compact Training editor overflowed or required scrolling in its mobile drawer: ${JSON.stringify(trainingLayout)}`);
if (trainingLayout.unusedGap > 10) throw new Error("The Training drawer retained dead space between its moves and footer.");
if (trainingLayout.maxButtonText !== "Max IV" || trainingLayout.maxButtonWidth > 30) throw new Error("The compact IV shortcut did not read Max IV at its original width.");
if (trainingLayout.footerButtonLabels.join(",") !== "Apply changes,Close" || new Set(trainingLayout.footerButtonHeights).size !== 1) throw new Error("The Training footer did not expose normalized Apply and Close actions.");
if (trainingLayout.sliderHeight > 20) throw new Error("The Training EV slider remained too thick for the compact layout.");
await page.fill('[data-training-ev-input="hp"]', "7");
if (await page.locator('[data-training-ev="hp"]').inputValue() !== "7") throw new Error("Typing an EV did not synchronize its slider.");
await page.locator('[data-training-ev="hp"]').evaluate((input) => { input.value = "5"; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); });
await page.click('[data-edit-training-move="0"]');
if (!await page.locator("[data-training-move-search]").count()) throw new Error("The Training move picker did not expose search.");
await page.fill("[data-training-move-search]", "definitely-no-such-move");
if (await page.locator("[data-select-training-move]").count() || !await page.locator(".training-empty").count()) throw new Error("Move search did not filter nonmatching moves.");
await page.fill("[data-training-move-search]", teachableTm.move);
if (!await page.locator(`[data-select-training-move="${teachableTm.id}"]`).count()) throw new Error("Move search did not find a compatible move by name.");
await page.click(`[data-select-training-move="${teachableTm.id}"]`);
if (!(await page.locator(".training-footer-line").textContent())?.includes(`Total ₽${(50 + teachableTm.price).toLocaleString()}`)) throw new Error("Training did not show the staged build total in its compact footer.");
const trainingResponse = page.waitForResponse((response) => response.url().includes(`/api/game/pokemon/${outgoingId}/training/apply`) && response.request().method() === "POST");
await page.click("[data-apply-training]");
if (!(await trainingResponse).ok()) throw new Error("Applying a staged training build failed.");
const tmTrainedGame = await page.evaluate(() => fetch("/api/game").then((response) => response.json()));
if (tmTrainedGame.roster.find((pokemon) => pokemon.id === outgoingId).evs.hp !== 5) throw new Error("The staged EV change was not applied.");
if (tmTrainedGame.roster.find((pokemon) => pokemon.id === outgoingId).moves[0] !== teachableTm.move) throw new Error("The selected move slot was not replaced.");
await page.click('[data-pc-detail-view="summary"]');
const summaryHeader = await page.locator(".pokemon-sheet").evaluate((sheet) => ({
  sheetHeight: sheet.getBoundingClientRect().height,
  summaryHeight: sheet.querySelector(".pokemon-summary").getBoundingClientRect().height,
  spriteWidth: sheet.querySelector(".pokemon-summary > img").getBoundingClientRect().width,
  nameFontSize: getComputedStyle(sheet.querySelector(".pokemon-summary h2")).fontSize,
  actionButtonHeight: sheet.querySelector(".sheet-actions .gloss-button").getBoundingClientRect().height,
}));
if (summaryHeader.sheetHeight !== trainingLayout.sheetHeight) throw new Error("Summary and Training drawers did not share the same height.");
if (summaryHeader.summaryHeight !== trainingLayout.summaryHeight || summaryHeader.spriteWidth !== trainingLayout.spriteWidth || summaryHeader.nameFontSize !== trainingLayout.nameFontSize) throw new Error("Summary and Training did not share the same Pokémon header sizing.");
if (summaryHeader.actionButtonHeight !== trainingLayout.footerButtonHeights[0]) throw new Error("Summary and Training actions did not share the same button height.");
await page.setViewportSize({ width: 390, height: 844 });
await page.click("[data-open-pc-items]");
await page.click('[data-pc-item-group="Held Items"]');
const equipResponse = page.waitForResponse((response) => response.url().includes(`/api/game/pokemon/${outgoingId}/equip`) && response.request().method() === "POST");
await page.click('[data-pc-item="leftovers"]');
if (!(await equipResponse).ok()) throw new Error("Giving a held item failed.");
if (!await page.locator(".pc-item-chooser").count()) throw new Error("Giving a held item closed the item view.");
if (!(await page.locator(".pc-held-item").textContent())?.includes("Leftovers")) throw new Error("The PC item view did not show the held item.");
if (await page.locator('[data-pc-item="leftovers"]').count()) throw new Error("The equipped held item remained in the available item list.");
if (!(await page.locator(".pc-item-feedback").textContent())?.includes("now holding Leftovers")) throw new Error("Giving a held item did not show confirmation feedback.");
const unequipResponse = page.waitForResponse((response) => response.url().includes(`/api/game/pokemon/${outgoingId}/unequip`) && response.request().method() === "POST");
await page.click("[data-pc-unequip]");
if (!(await unequipResponse).ok()) throw new Error("Removing a held item failed.");
if (!await page.locator(".pc-item-chooser").count()) throw new Error("Taking a held item closed the item view.");
if (await page.locator(".pc-held-item").count()) throw new Error("The taken held item remained on the Pokémon.");
if (await page.locator('[data-pc-item="leftovers"]').count() !== 1) throw new Error("The taken held item did not return to the available item list.");
if (!(await page.locator(".pc-item-feedback").textContent())?.includes("returned to the Bag")) throw new Error("Taking a held item did not show confirmation feedback.");
await page.waitForFunction(async (pokemonId) => {
  const game = await fetch("/api/game").then((response) => response.json());
  return !game.roster.find((pokemon) => pokemon.id === pokemonId)?.heldItemId && game.inventory.leftovers === 1;
}, outgoingId);
const unequippedGame = await page.evaluate(() => fetch("/api/game").then((response) => response.json()));
if (unequippedGame.roster.find((pokemon) => pokemon.id === outgoingId).heldItemId) throw new Error("The Pokémon kept its removed held item.");
if (unequippedGame.inventory.leftovers !== 1) throw new Error("Removing a held item changed its owned quantity.");
await page.click(".sheet-close");
await page.click(`[data-pc-detail="${outgoingId}"]`);
let teamUpdateResponse = page.waitForResponse((response) => response.url().endsWith("/api/game/team") && response.request().method() === "PUT");
await page.click(`[data-team-toggle="${outgoingId}"]`);
if (!(await teamUpdateResponse).ok()) throw new Error("Removing a Pokémon from the team failed.");
if (await page.locator(".pokemon-sheet").count()) throw new Error("Removing a Pokémon from the team did not close the PC drawer.");
await page.click(`[data-pc-mon="${outgoingId}"]`);
if ((await page.locator(`[data-team-toggle="${outgoingId}"]`).textContent())?.trim() !== "Add to team" || !await page.locator(`[data-team-toggle="${outgoingId}"].green`).count()) throw new Error("The PC Add to team action was not green.");
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

if (await page.locator(".battler-slot.player").getAttribute("data-pokemon") !== replacementId) throw new Error("The selected PC Pokémon was not used as the lead.");
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
if (await page.locator(".battle-log-entry", { hasText: "used" }).count() < 1) throw new Error("The battle log omitted every completed move.");
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
if (!(await page.locator('.home-actions [data-route="battle"]').textContent())?.includes("View result")) throw new Error("The landing battle button did not point back to today's result.");
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
if (!(await page.locator(".leaderboard-row.leaderboard-loss .leaderboard-avatar img").getAttribute("src"))?.includes("/trainers/misty.png")) throw new Error("The selected account avatar did not appear on the daily leaderboard.");
const leaderboardRowLayout = await page.locator(".leaderboard-row.leaderboard-loss").evaluate((row) => {
  const avatar = row.querySelector(".leaderboard-avatar").getBoundingClientRect();
  const team = row.querySelector(".leaderboard-team").getBoundingClientRect();
  return {
    height: row.getBoundingClientRect().height,
    avatarCenter: avatar.top + avatar.height / 2,
    teamCenter: team.top + team.height / 2,
  };
});
if (Math.abs(leaderboardRowLayout.avatarCenter - leaderboardRowLayout.teamCenter) > 2) throw new Error("The leaderboard avatar was not aligned beside the Pokémon team.");
if (leaderboardRowLayout.height > 85) throw new Error("The daily leaderboard row became too tall.");
await page.click('[data-leaderboard-view="streak"]');
if (!(await page.locator(".streak-row").textContent())?.includes("0-day streak")) throw new Error("A completed loss did not appear as a zero-day streak.");
await page.click('.leaderboard-stage [data-route="home"]');
await page.click('[data-route="settings"]');
if (await page.locator("[data-reset-daily-battle]").count() !== 1) throw new Error("The admin settings did not expose the daily battle reset.");
const resetResponse = page.waitForResponse((response) => response.url().endsWith("/api/admin/battle/reset") && response.request().method() === "POST");
await page.click("[data-reset-daily-battle]");
if (!(await resetResponse).ok()) throw new Error("Resetting the admin's daily battle failed.");
if (!(await page.locator(".more-developer").textContent())?.includes("ready to play again")) throw new Error("The daily battle reset did not report success.");
await page.click('.more-stage [data-route="home"]');
const freshBattleButton = page.locator('.home-actions .red[data-route="encounters"]');
if ((await freshBattleButton.textContent())?.trim() !== "Battle") throw new Error("A forfeit did not route the fresh run through opening encounters.");
await freshBattleButton.click();
if (await page.locator("[data-encounter]").count() !== 12) throw new Error("A forfeit did not create twelve fresh-run encounters.");

const imageFailures = await page.locator("img").evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src));
await browser.close();

if (errors.length || imageFailures.length) throw new Error(JSON.stringify({ errors, imageFailures }, null, 2));
console.log("Browser flow passed: auth, opening encounters, held-item Mart, staged PC training, team swap, battle, refresh resume, and forfeit.");
