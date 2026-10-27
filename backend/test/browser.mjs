import { chromium, devices } from "playwright-core";

const baseUrl = process.env.NUZZLE_BASE_URL || "http://127.0.0.1:3000";
const executablePath = process.env.CHROME_PATH || (process.platform === "darwin"
  ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  : process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome");

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
const representativeMobileViewports = [
  { name: "compact iPhone", ...devices["iPhone 12 Mini"].viewport },
  { name: "iPhone 16e", ...devices["iPhone 16e"].viewport },
  { name: "wide iPhone", ...devices["iPhone 11"].viewport },
  { name: "large iPhone", ...devices["iPhone 16 Pro Max"].viewport },
  // The Pixel 10 shares this narrow 20:9 CSS viewport class; Chrome's usable height varies with its toolbar.
  { name: "Pixel 10 class", ...devices["Pixel 9"].viewport },
  { name: "standard Android", ...devices["Pixel 7"].viewport },
  { name: "Galaxy S24", ...devices["Galaxy S24"].viewport },
  { name: "large Android", ...devices["Galaxy A55"].viewport },
  { name: "wide Android", width: 512, height: 960 },
  { name: "compact stress case", width: 320, height: 568 },
];
const representativeDesktopViewports = [
  { name: "compact desktop", width: 1024, height: 768 },
  { name: "small laptop", width: 1280, height: 720 },
  { name: "common laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "full HD", width: 1920, height: 1080 },
];

async function assertMobileLayout(label, scrollRegions = []) {
  const previousViewport = page.viewportSize();
  for (const viewport of representativeMobileViewports) {
    await page.setViewportSize(viewport);
    const safeInsets = viewport.name.includes("iPhone") ? { top: 24, right: 0, bottom: 34, left: 0 } : { top: 0, right: 0, bottom: 0, left: 0 };
    await page.locator("html").evaluate((root, insets) => {
      root.style.setProperty("--safe-top", `${insets.top}px`);
      root.style.setProperty("--safe-right", `${insets.right}px`);
      root.style.setProperty("--safe-bottom", `${insets.bottom}px`);
      root.style.setProperty("--safe-left", `${insets.left}px`);
    }, safeInsets);
    const layout = await page.locator("body").evaluate(async (body, expectedScrollRegions) => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const root = document.documentElement;
      const app = document.querySelector(".app");
      const screen = document.querySelector(".screen");
      const visible = (element) => element && !element.hidden && getComputedStyle(element).display !== "none" && element.getClientRects().length > 0;
      const bounds = (element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height };
      };
      const viewportWidth = root.clientWidth;
      const viewportHeight = window.innerHeight;
      const trackedSelectors = [".screen-header", ".home-actions", ".lead-actions", ".battle-command-area", ".give-up", ".battle-result-actions", ".page-back"];
      const tracked = trackedSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]).filter(visible);
      const outOfBounds = tracked.filter((element) => !expectedScrollRegions.some((selector) => element.closest(selector))).filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > viewportWidth + 1 || rect.top < -1 || rect.bottom > viewportHeight + 1;
      }).map((element) => element.className || element.tagName);
      const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible).map(bounds);
      const invalidDialogs = dialogs.filter((rect) => rect.left < -1 || rect.right > viewportWidth + 1 || rect.top < -1 || rect.bottom > viewportHeight + 1);
      const scrollChecks = expectedScrollRegions.map((selector) => {
        const element = document.querySelector(selector);
        if (!visible(element)) return { selector, missing: true };
        const style = getComputedStyle(element);
        return { selector, missing: false, overflowY: style.overflowY, bounds: bounds(element) };
      });
      return {
        viewportWidth,
        viewportHeight,
        visualViewportHeight: window.visualViewport?.height || viewportHeight,
        documentOverflowX: Math.max(root.scrollWidth, body.scrollWidth) - viewportWidth,
        documentOverflowY: Math.max(root.scrollHeight, body.scrollHeight) - viewportHeight,
        app: app ? bounds(app) : null,
        screen: screen ? { ...bounds(screen), overflowX: screen.scrollWidth - screen.clientWidth, overflowY: screen.scrollHeight - screen.clientHeight } : null,
        outOfBounds,
        invalidDialogs,
        scrollChecks,
      };
    }, scrollRegions);
    const context = `${label} at ${viewport.name} (${viewport.width}x${viewport.height}, safe area ${safeInsets.top}/${safeInsets.bottom})`;
    if (!layout.app || !layout.screen) throw new Error(`${context} did not render the app shell.`);
    if (layout.documentOverflowX > 1 || layout.documentOverflowY > 1) throw new Error(`${context} caused document scrolling: ${JSON.stringify(layout)}`);
    if (layout.screen.overflowX > 1 || layout.app.left < -1 || layout.app.right > layout.viewportWidth + 1 || layout.app.top < -1 || layout.app.bottom > layout.viewportHeight + 1) throw new Error(`${context} escaped the viewport: ${JSON.stringify(layout)}`);
    if (layout.outOfBounds.length || layout.invalidDialogs.length) throw new Error(`${context} clipped a fixed control or dialog: ${JSON.stringify(layout)}`);
    for (const region of layout.scrollChecks) {
      if (region.missing || !["auto", "scroll"].includes(region.overflowY)) throw new Error(`${context} did not provide the expected contained scroll region ${region.selector}: ${JSON.stringify(region)}`);
      if (region.bounds.left < -1 || region.bounds.right > layout.viewportWidth + 1 || region.bounds.top < -1 || region.bounds.bottom > layout.viewportHeight + 1) throw new Error(`${context} placed ${region.selector} outside the viewport: ${JSON.stringify(region)}`);
    }
  }
  await page.locator("html").evaluate((root) => {
    for (const property of ["--safe-top", "--safe-right", "--safe-bottom", "--safe-left"]) root.style.removeProperty(property);
  });
  if (previousViewport) {
    await page.setViewportSize(previousViewport);
    await page.locator("body").evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
}

async function assertDesktopLayout(label, scrollRegions = [], relationships = []) {
  const previousViewport = page.viewportSize();
  for (const viewport of representativeDesktopViewports) {
    await page.setViewportSize(viewport);
    const layout = await page.locator("body").evaluate(async (body, expectations) => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const root = document.documentElement;
      const app = document.querySelector(".app");
      const screen = document.querySelector(".screen");
      const visible = (element) => element && !element.hidden && getComputedStyle(element).display !== "none" && element.getClientRects().length > 0;
      const bounds = (element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height };
      };
      const appBounds = app ? bounds(app) : null;
      const screenBounds = screen ? bounds(screen) : null;
      const trackedSelectors = [".screen-header", ".home-actions", ".lead-actions", ".battle-command-area", ".give-up", ".battle-result-actions", ".page-back"];
      const tracked = trackedSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]).filter(visible);
      const outOfBounds = appBounds ? tracked.filter((element) => !expectations.scrollRegions.some((selector) => element.closest(selector))).filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < appBounds.left - 1 || rect.right > appBounds.right + 1 || rect.top < appBounds.top - 1 || rect.bottom > appBounds.bottom + 1;
      }).map((element) => element.className || element.tagName) : [];
      const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible).map(bounds);
      const invalidDialogs = dialogs.filter((rect) => rect.left < -1 || rect.right > root.clientWidth + 1 || rect.top < -1 || rect.bottom > window.innerHeight + 1);
      const scrollChecks = expectations.scrollRegions.map((selector) => {
        const element = document.querySelector(selector);
        if (!visible(element)) return { selector, missing: true };
        return { selector, missing: false, overflowY: getComputedStyle(element).overflowY, bounds: bounds(element) };
      });
      const relationshipChecks = expectations.relationships.map(({ first, second, direction }) => {
        const firstElement = document.querySelector(first);
        const secondElement = document.querySelector(second);
        return { first, second, direction, firstBounds: visible(firstElement) ? bounds(firstElement) : null, secondBounds: visible(secondElement) ? bounds(secondElement) : null };
      });
      return {
        viewportWidth: root.clientWidth,
        viewportHeight: window.innerHeight,
        documentOverflowX: Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth,
        documentOverflowY: Math.max(root.scrollHeight, body.scrollHeight) - window.innerHeight,
        app: appBounds,
        screen: screen ? { ...screenBounds, overflowX: screen.scrollWidth - screen.clientWidth, overflowY: screen.scrollHeight - screen.clientHeight } : null,
        outOfBounds,
        invalidDialogs,
        scrollChecks,
        relationshipChecks,
      };
    }, { scrollRegions, relationships });
    const context = `${label} at ${viewport.name} (${viewport.width}x${viewport.height})`;
    if (!layout.app || !layout.screen) throw new Error(`${context} did not render the app shell.`);
    if (layout.documentOverflowX > 1 || layout.documentOverflowY > 1) throw new Error(`${context} caused document scrolling: ${JSON.stringify(layout)}`);
    if (layout.app.width < 899 || layout.app.width > 901 || layout.app.top < -1 || layout.app.bottom > layout.viewportHeight + 1) throw new Error(`${context} did not use the desktop app shell: ${JSON.stringify(layout)}`);
    if (layout.screen.overflowX > 1 || layout.screen.left < layout.app.left - 1 || layout.screen.right > layout.app.right + 1 || layout.screen.top < layout.app.top - 1 || layout.screen.bottom > layout.app.bottom + 1) throw new Error(`${context} escaped the desktop app shell: ${JSON.stringify(layout)}`);
    if (layout.outOfBounds.length || layout.invalidDialogs.length) throw new Error(`${context} clipped a control or dialog: ${JSON.stringify(layout)}`);
    for (const region of layout.scrollChecks) {
      if (region.missing || !["auto", "scroll"].includes(region.overflowY)) throw new Error(`${context} did not provide the expected contained scroll region ${region.selector}: ${JSON.stringify(region)}`);
      if (region.bounds.left < layout.app.left - 1 || region.bounds.right > layout.app.right + 1 || region.bounds.top < layout.app.top - 1 || region.bounds.bottom > layout.app.bottom + 1) throw new Error(`${context} placed ${region.selector} outside the app shell: ${JSON.stringify(region)}`);
    }
    for (const relationship of layout.relationshipChecks) {
      if (!relationship.firstBounds || !relationship.secondBounds) throw new Error(`${context} could not verify the desktop relationship ${relationship.first} ${relationship.direction} ${relationship.second}: ${JSON.stringify(relationship)}`);
      const valid = relationship.direction === "before"
        ? relationship.firstBounds.right <= relationship.secondBounds.left + 1
        : relationship.firstBounds.bottom <= relationship.secondBounds.top + 1;
      if (!valid) throw new Error(`${context} did not arrange ${relationship.first} ${relationship.direction} ${relationship.second}: ${JSON.stringify(relationship)}`);
    }
  }
  if (previousViewport) {
    await page.setViewportSize(previousViewport);
    await page.locator("body").evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
}

async function assertContainedLandscape(label, scrollRegion) {
  const previousViewport = page.viewportSize();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator("html").evaluate((root) => {
    root.style.setProperty("--safe-top", "0px");
    root.style.setProperty("--safe-right", "44px");
    root.style.setProperty("--safe-bottom", "21px");
    root.style.setProperty("--safe-left", "44px");
  });
  const layout = await page.locator("body").evaluate(async (body, selector) => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const root = document.documentElement;
    const app = document.querySelector(".app");
    const screen = document.querySelector(".screen");
    const region = document.querySelector(selector);
    const appRect = app?.getBoundingClientRect();
    const screenRect = screen?.getBoundingClientRect();
    return {
      documentOverflowX: Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth,
      documentOverflowY: Math.max(root.scrollHeight, body.scrollHeight) - window.innerHeight,
      appWidth: appRect?.width,
      appTop: appRect?.top,
      appBottom: appRect?.bottom,
      screenTop: screenRect?.top,
      screenBottom: screenRect?.bottom,
      regionOverflowY: region ? getComputedStyle(region).overflowY : null,
    };
  }, scrollRegion);
  if (layout.documentOverflowX > 1 || layout.documentOverflowY > 1 || layout.appWidth > 591 || layout.appTop < -1 || layout.appBottom > 391 || layout.screenTop < -1 || layout.screenBottom > 391) throw new Error(`${label} escaped the contained landscape shell: ${JSON.stringify(layout)}`);
  if (!["auto", "scroll"].includes(layout.regionOverflowY)) throw new Error(`${label} did not put landscape overflow in ${scrollRegion}: ${JSON.stringify(layout)}`);
  await page.locator("html").evaluate((root) => {
    for (const property of ["--safe-top", "--safe-right", "--safe-bottom", "--safe-left"]) root.style.removeProperty(property);
  });
  if (previousViewport) {
    await page.setViewportSize(previousViewport);
    await page.locator("body").evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
}

page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".home-screen .screen-title");
const localSpriteResponse = await fetch(`${baseUrl}/assets/showdown/gen5/charizard.png`);
if (!localSpriteResponse.ok || localSpriteResponse.headers.get("content-type") !== "image/png" || !localSpriteResponse.headers.get("cache-control")?.includes("immutable")) {
  throw new Error("Local sprites were not served as long-lived immutable PNG assets.");
}
const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute("content");
if (!viewportMeta?.includes("width=device-width") || !viewportMeta.includes("viewport-fit=cover") || !viewportMeta.includes("interactive-widget=resizes-content")) throw new Error("The mobile viewport does not cover device cutouts and resize for the virtual keyboard.");
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
      opponentSpriteWidth: Number.parseFloat(opponentSpriteStyle.width),
      opponentSpriteTranslation: new DOMMatrix(opponentSpriteStyle.transform).m41,
      opponentSpriteVerticalTranslation: new DOMMatrix(opponentSpriteStyle.transform).m42,
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
  if (Math.abs(landingBounds.opponentSpriteTranslation / landingBounds.opponentSpriteWidth + .065) > .002) throw new Error(`Opponent team sprites did not retain their proportional left offset at ${viewport.width}x${viewport.height}.`);
  if (landingBounds.opponentSpriteVerticalTranslation > -2.5) throw new Error(`Opponent team sprites did not retain their mobile clearance above the Battle button at ${viewport.width}x${viewport.height}.`);
  if (landingBounds.titlePosition !== "static" || landingBounds.titleTop < landingBounds.toolsBottom - 1 || landingBounds.titleClipped) throw new Error(`The daily title overlaps the header controls or is clipped at ${viewport.width}x${viewport.height}.`);
  if (landingBounds.metaTop < landingBounds.titleBottom) throw new Error(`The daily title overlaps its countdown at ${viewport.width}x${viewport.height}.`);
  if (!/next trainer in \d{2}:\d{2}:\d{2}/i.test(landingBounds.metaText)) throw new Error(`The daily countdown is missing at ${viewport.width}x${viewport.height}.`);
  if (!landingBounds.metaText.includes(" - ") || landingBounds.titleFontSize !== landingBounds.metaFontSize) throw new Error(`The date and countdown line does not match the title typography at ${viewport.width}x${viewport.height}.`);
  if (landingBounds.metaHeight > landingBounds.metaLineHeight * 1.5) throw new Error(`The date and countdown wrapped at ${viewport.width}x${viewport.height}.`);
}
await assertMobileLayout("landing page");
await assertDesktopLayout("landing page", [], [
  { first: ".trainer-wrap", second: ".opponent-team", direction: "above" },
  { first: ".opponent-team", second: ".home-actions", direction: "above" },
]);
await assertContainedLandscape("landing page", ".landing");
await page.setViewportSize({ width: 390, height: 844 });
if (await page.locator(".menu-toggle").count()) throw new Error("The obsolete hamburger menu is still rendered.");
await page.click('[data-route="pc"]');
await page.waitForSelector(".auth-card");
if (await page.locator(".pc-stage").count()) throw new Error("A logged-out user reached the PC without authenticating.");
await assertMobileLayout("login dialog", [".auth-card"]);
await page.click('[data-auth-mode="register"]');
await assertMobileLayout("registration dialog", [".auth-card"]);
if (await page.locator("#auth-password").getAttribute("minlength") !== "7" || await page.locator("#auth-password-confirmation").getAttribute("minlength") !== "7" || !(await page.locator(".password-help").textContent())?.includes("7 characters")) throw new Error("Registration did not expose the seven-character password minimum.");
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
const lightToggle = await page.locator(".theme-toggle").evaluate((toggle) => ({
  offset: new DOMMatrix(getComputedStyle(toggle.querySelector("i")).transform).m41,
  moonOpacity: getComputedStyle(toggle.querySelector(".theme-moon")).opacity,
  sunOpacity: getComputedStyle(toggle.querySelector(".theme-sun")).opacity,
}));
if (Math.abs(lightToggle.offset) > .1 || lightToggle.moonOpacity !== "1" || lightToggle.sunOpacity !== "0") throw new Error("Light mode did not show the moon on the left side of the theme switch.");
await page.click("[data-toggle-theme]");
if (await page.locator("html").getAttribute("data-theme") !== "dark") throw new Error("The theme switch did not activate dark mode.");
if (await page.evaluate(() => localStorage.getItem("nuzzleTheme")) !== "dark") throw new Error("The selected theme was not remembered on the device.");
await page.waitForFunction(() => new DOMMatrix(getComputedStyle(document.querySelector(".theme-toggle i")).transform).m41 > 23.9);
const darkToggle = await page.locator(".theme-toggle").evaluate((toggle) => ({
  sunOpacity: getComputedStyle(toggle.querySelector(".theme-sun")).opacity,
  moonOpacity: getComputedStyle(toggle.querySelector(".theme-moon")).opacity,
}));
if (darkToggle.sunOpacity !== "1" || darkToggle.moonOpacity !== "0") throw new Error("Dark mode did not show the sun on the right side of the theme switch.");
await page.click("[data-toggle-theme]");
await page.click(".page-back");
await page.click('[data-route="settings"]');
if ((await page.locator(".more-stage h2").textContent())?.trim() !== "More") throw new Error("The Settings destination was not replaced by More.");
await assertMobileLayout("More screen");
await assertDesktopLayout("More screen", [], [
  { first: ".more-actions button:nth-child(1)", second: ".more-actions button:nth-child(2)", direction: "above" },
]);
const moreButtons = await page.locator(".more-stage button").evaluateAll((buttons) => buttons.map((button) => ({ label: button.textContent.trim(), classes: button.className })));
if (moreButtons.map(({ label }) => label).join(",") !== "How to play,What a Nuzlocke is,Schedule,Affiliation,Scheduler,Battle reset,Back") throw new Error("The More actions were not rendered in the requested order.");
for (const [index, color] of ["red", "yellow", "green", "blue", "gold", "slate", "purple"].entries()) {
  if (!moreButtons[index].classes.includes(color)) throw new Error(`${moreButtons[index].label} did not use the requested ${color} palette.`);
}
await page.setViewportSize({ width: 320, height: 568 });
const moreCardChecks = [
  ["how-to-play", "How to play", "Challenge the daily trainer", null],
  ["nuzlocke", "What a Nuzlocke is", "wipes your entire box and ends your win streak", "bulbapedia.bulbagarden.net/wiki/Nuzlocke_Challenge"],
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
  if (cardId === "how-to-play" && !(await card.textContent())?.includes("A loss wipes your run... But you can always start fresh tomorrow!")) throw new Error("How to play did not use the requested run-reset wording.");
  if (cardId === "schedule" && (await card.locator(".battle-schedule dd").allTextContents()).join(",") !== "Theme teams,Regular trainers,Ace trainers,Rival battles,Gym leaders,Elite 4,Champions") throw new Error("The battle schedule did not use the requested labels and capitalization.");
  if (cardId === "schedule" && !(await card.locator(".schedule-note").textContent())?.includes("holiday-themed trainer")) throw new Error("The battle schedule did not explain the holiday exception.");
  if (cardId === "affiliation" && (await card.locator(".more-card-content > p").count() !== 4 || !(await card.locator(".more-card-content > p").last().textContent())?.includes("sprites are © Nintendo"))) throw new Error("The affiliation and ownership notices were not combined into one paragraph.");
  await card.locator(".more-card-back").click();
  if (await page.locator(".more-card").count()) throw new Error(`${title} remained open after using Back.`);
}
await page.setViewportSize({ width: 390, height: 844 });
if (!await page.locator('[data-route="config"]', { hasText: "Scheduler" }).count()) throw new Error("The ryanline account did not receive the Scheduler entry point.");
await page.click('[data-route="config"]');
await page.waitForSelector(".config-current");
await assertMobileLayout("scheduler", [".config-stage"]);
await assertDesktopLayout("scheduler", [".config-stage"]);
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
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector('.home-screen [data-route="settings"]');
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
await page.waitForFunction(() => document.querySelector("[data-trainer-row] .trainer-queue-copy strong")?.textContent?.trim() === "Red");
if (!(await page.locator("[data-trainer-row]").first().textContent())?.includes("Red")) throw new Error("The daily trainer queue did not retain its reordered position.");
if (!(await page.locator("[data-trainer-row]").first().locator(".trainer-queue-copy img").getAttribute("src"))?.includes("/gen5-shiny/mew.png")) throw new Error("A queued shiny trainer Pokémon did not use its shiny sprite.");
await page.click('.config-back[data-route="settings"]');
await page.click(".page-back");
const emptyRunBattleButton = page.locator('button[data-route="encounters"]', { hasText: /^battle$/i });
if (await emptyRunBattleButton.count() !== 1) throw new Error("The empty-run Battle button did not retain its normal label and redirect to encounters.");
await emptyRunBattleButton.click();
await assertMobileLayout("opening encounters", [".encounter-list"]);
await assertDesktopLayout("opening encounters", [".encounter-list"], [
  { first: ".encounter-card:nth-child(1)", second: ".encounter-card:nth-child(2)", direction: "above" },
]);
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
if ((await page.locator("[data-shop-group]").allTextContents()).join(",") !== "Held items,Key items") throw new Error("The Mart did not show the Held items and Key items segments.");
if (await page.locator(".shop-item").count() !== 139) throw new Error("The Mart did not render every approved held item.");
if (await page.locator(".shop-item .held-item-sprite").count() !== 139) throw new Error("The Mart did not render sprites for every approved held item.");
if ((await page.locator('[data-open-purchase="leftovers"]').locator("xpath=ancestor::div[contains(@class, 'shop-item')]").locator(".held-item-sprite").getAttribute("style")) !== "background-position:-48px -360px") throw new Error("The held-item sprite did not use its 24px Showdown sheet position.");
const itemControlAppearance = await page.locator(".shop-item").first().evaluate((row) => {
  const root = document.documentElement;
  const hadTheme = root.hasAttribute("data-theme");
  const previousTheme = root.getAttribute("data-theme");
  const tile = row.querySelector(".item-icon.held");
  root.dataset.theme = "light";
  const lightTile = getComputedStyle(tile).backgroundColor;
  root.dataset.theme = "dark";
  const darkTile = getComputedStyle(tile).backgroundColor;
  if (hadTheme) root.setAttribute("data-theme", previousTheme);
  else root.removeAttribute("data-theme");
  return {
    lightTile,
    darkTile,
  };
});
if (itemControlAppearance.lightTile === itemControlAppearance.darkTile) throw new Error("Held-item tiles did not adapt to dark mode.");
if (await page.locator(".item-about-button, [data-item-about]").count()) throw new Error("The Mart retained a separate item-info control.");
if (!await page.locator("[data-mart-search]").count()) throw new Error("The Mart did not expose item search.");
await page.locator("[data-mart-search]").evaluate((input) => { input.dataset.identity = "original"; });
await page.locator("[data-mart-search]").pressSequentially("leftovers", { delay: 10 });
const stableMartSearch = await page.locator("[data-mart-search]").evaluate((input) => ({ identity: input.dataset.identity, focused: document.activeElement === input }));
if (stableMartSearch.identity !== "original" || !stableMartSearch.focused || await page.locator(".shop-item:visible").count() !== 1) throw new Error("Mart search was not stable or did not filter items.");
await page.fill("[data-mart-search]", "");
await assertMobileLayout("Mart", [".shop-list"]);
await assertDesktopLayout("Mart", [".shop-list"], [
  { first: ".shop-item:nth-child(1)", second: ".shop-item:nth-child(2)", direction: "above" },
]);
await page.click('[data-open-purchase="leftovers"]');
await assertMobileLayout("Mart purchase drawer", [".mart-sheet"]);
await assertDesktopLayout("Mart purchase drawer");
const purchaseDrawer = await page.locator(".mart-sheet").evaluate((sheet) => ({
  title: sheet.querySelector("h2")?.textContent.trim(),
  description: sheet.querySelector(".mart-item-description")?.textContent.trim(),
  labels: [...sheet.querySelectorAll(".purchase-ledger p > span:first-child")].map((label) => label.textContent.trim()),
  values: [...sheet.querySelectorAll(".purchase-ledger .purchase-value")].map((value) => value.textContent.trim()),
  actions: [...sheet.querySelectorAll(".mart-sheet-actions button")].map((button) => button.textContent.trim()),
  hasSprite: Boolean(sheet.querySelector(".held-item-sprite")),
  hasCloseButton: Boolean(sheet.querySelector(".sheet-close[data-close-mart-sheet]")),
  hasQuantityUi: Boolean(sheet.querySelector("#purchase-quantity, [data-purchase-quantity-output], .purchase-slider")),
}));
if (purchaseDrawer.title !== "Leftovers" || !purchaseDrawer.description || !purchaseDrawer.hasSprite || !purchaseDrawer.hasCloseButton) throw new Error(`The unified held-item drawer was incomplete: ${JSON.stringify(purchaseDrawer)}`);
if (purchaseDrawer.labels.join(",") !== "Money,Price,Remaining after" || purchaseDrawer.actions.join(",") !== "Buy,Close" || purchaseDrawer.hasQuantityUi) throw new Error(`The held-item drawer retained obsolete purchase controls: ${JSON.stringify(purchaseDrawer)}`);
if (!purchaseDrawer.values[0].includes("50,000") || !purchaseDrawer.values[1].includes("2,500") || !purchaseDrawer.values[2].includes("47,500")) throw new Error(`The held-item purchase totals were incorrect: ${JSON.stringify(purchaseDrawer.values)}`);
const heldItemPurchaseResponse = page.waitForResponse((response) => response.url().includes("/api/game/shop/leftovers") && response.request().method() === "POST");
await page.click('[data-purchase-form="leftovers"] button[type="submit"]');
if (!(await heldItemPurchaseResponse).ok()) throw new Error("Purchasing a held item failed.");
await page.waitForFunction(() => {
  const button = document.querySelector('[data-open-purchase="leftovers"]');
  return button?.disabled && button.textContent.trim() === "Bought";
});
const tmHighlightFits = await page.locator(".shop-segments").evaluate((element) => {
  const style = getComputedStyle(element, "::before");
  const translation = style.transform === "none" ? 0 : new DOMMatrixReadOnly(style.transform).m41;
  const rightEdge = Number.parseFloat(style.left) + translation + Number.parseFloat(style.width);
  return rightEdge <= element.clientWidth - 3 + .5;
});
if (!tmHighlightFits) throw new Error("The held-item segment highlight overflowed its control.");
await page.click(".page-back");
await page.click('[data-route="bag"]');
if ((await page.locator("[data-bag-group]").allTextContents()).join(",") !== "Held items,Key items") throw new Error("The Bag did not show the Held items and Key items segments.");
if (!await page.locator(".bag-list").count()) throw new Error("The Bag did not render its contained item list.");
if (!await page.locator("[data-bag-search]").count()) throw new Error("The Bag did not expose item search.");
await page.fill("[data-bag-search]", "definitely-no-such-item");
if (await page.locator(".bag-item:visible").count() || !await page.locator("[data-bag-search-empty]:visible").count()) throw new Error("Bag search did not show its no-match state.");
await page.fill("[data-bag-search]", "leftovers");
if (await page.locator(".bag-item:visible").count() !== 1) throw new Error("Bag search did not find an owned item by name.");
if (await page.locator(".bag-item:visible .held-item-sprite").count() !== 1) throw new Error("The Bag did not render the owned held item's sprite.");
await assertMobileLayout("Bag", [".bag-list"]);
await assertDesktopLayout("Bag", [".bag-list"]);
await page.click(".page-back");
await page.click('[data-route="pc"]');
if ((await page.locator(".trainer-reference-section .pc-section-head h2").textContent())?.trim() !== "Brock") throw new Error("The PC did not identify today's trainer team.");
if (await page.locator(".trainer-reference-section .trainer-party-slot").count() !== 6) throw new Error("The PC did not show today's full trainer team.");
if (await page.locator(".party-section [data-pc-detail]").count() !== generatedGame.teamIds.length) throw new Error("The PC Team section did not show only the active team.");
if (await page.locator(".box-section [data-pc-mon]").count() !== generatedGame.roster.length - generatedGame.teamIds.length) throw new Error("The PC Box section did not exclude active team members.");
if (await page.locator(".team-mark, .pc-help").count()) throw new Error("The obsolete PC team labels or helper text are still visible.");
if (await page.locator(".party-section [data-quick-team-remove]").count() !== generatedGame.teamIds.length || await page.locator(".box-section [data-quick-team-add]").count() !== generatedGame.roster.length - generatedGame.teamIds.length) throw new Error("The PC cards did not expose the expected quick team controls.");
if (await page.locator(".trainer-reference-section .pc-quick-action").count()) throw new Error("The trainer reference cards incorrectly exposed team controls.");
if (!await page.locator(`[data-quick-team-remove="${outgoingId}"].remove[aria-label="Remove ${outgoingPokemon.name} from team"]`).count() || !await page.locator(`[data-quick-team-add="${replacementId}"].add[aria-label="Add ${replacementName} to team"]`).count()) throw new Error("The quick team controls did not use the requested action styling or accessible labels.");
await assertMobileLayout("PC", [".box-section .pc-box"]);
await assertDesktopLayout("PC", [".box-section .pc-box"], [
  { first: ".trainer-reference-section", second: ".party-section", direction: "above" },
  { first: ".party-section", second: ".box-section", direction: "above" },
]);
const quickActionAppearance = await page.locator(".pc-quick-action").evaluateAll((buttons) => buttons.slice(0, 2).map((button) => {
  const bounds = button.getBoundingClientRect();
  const card = button.parentElement.getBoundingClientRect();
  const style = getComputedStyle(button);
  return { width: bounds.width, height: bounds.height, topOffset: bounds.top - card.top, rightOffset: bounds.right - card.right, backgroundImage: style.backgroundImage, boxShadow: style.boxShadow, textShadow: style.textShadow };
}));
if (quickActionAppearance.some((button) => button.width > 18.5 || button.height > 18.5 || Math.abs(button.topOffset) > 3.5 || Math.abs(button.rightOffset) > 3.5 || button.backgroundImage !== "none" || button.boxShadow !== "none" || button.textShadow !== "none")) throw new Error("The PC quick controls were not compact, flat, and anchored to the card corner.");
let quickTeamResponse = page.waitForResponse((response) => response.url().endsWith("/api/game/team") && response.request().method() === "PUT");
await page.click(`[data-quick-team-remove="${outgoingId}"]`);
if (!(await quickTeamResponse).ok()) throw new Error("Quick-removing a Pokémon from the team failed.");
await page.waitForSelector(`[data-quick-team-add="${outgoingId}"]`);
if (await page.locator(".pokemon-sheet").count()) throw new Error("Quick-removing a Pokémon opened its details drawer.");
quickTeamResponse = page.waitForResponse((response) => response.url().endsWith("/api/game/team") && response.request().method() === "PUT");
await page.click(`[data-quick-team-add="${outgoingId}"]`);
if (!(await quickTeamResponse).ok()) throw new Error("Quick-adding a Pokémon to an open team slot failed.");
await page.waitForSelector(`[data-quick-team-remove="${outgoingId}"]`);
await page.click(`[data-quick-team-add="${replacementId}"]`);
if (!await page.locator(".swap-chooser").count()) throw new Error("Quick-adding with a full team did not open the replacement chooser.");
await page.click("[data-cancel-pc-swap]");
await page.click(".sheet-close");
await page.click(`[data-pc-detail="${outgoingId}"]`);
await assertMobileLayout("PC summary drawer", [".pc-detail-panel"]);
await assertDesktopLayout("PC summary drawer", [".pc-detail-panel"]);
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
    spriteWidth: sheet.querySelector(".pokemon-summary > img").getBoundingClientRect().width,
    summaryHeight: sheet.querySelector(".pokemon-summary").getBoundingClientRect().height,
  };
});
if (summaryAppearance.labels.join(",") !== "Remove from team,Held item,Close") throw new Error("The PC Summary actions did not use the requested labels and capitalization.");
if (!summaryAppearance.classes[0].includes("red") || !summaryAppearance.classes[1].includes("blue") || !summaryAppearance.classes[2].includes("slate")) throw new Error("The PC Summary actions did not match the Battle, Mart, and Settings colors.");
if (summaryAppearance.lightBackgrounds.some((value, index) => value === summaryAppearance.darkBackgrounds[index])) throw new Error("The PC Summary action colors did not adapt to dark mode.");
if (summaryAppearance.factsTopBorder !== "0px") throw new Error("PC Summary retained the redundant divider above Ability.");
if (summaryAppearance.spriteWidth < 70 || summaryAppearance.summaryHeight < 70) throw new Error("The PC drawer did not give the Pokémon sprite a larger shared header.");
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
await assertMobileLayout("PC training drawer");
await assertDesktopLayout("PC training drawer");
if (await page.locator(".pokemon-summary > img").evaluate((image) => image.getBoundingClientRect().width) < 63) throw new Error("The compact Training drawer shrank the Pokémon sprite back to its old size.");
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
    summaryTop: summaryBounds.top,
    summaryLeft: summaryBounds.left,
    spriteWidth: spriteBounds.width,
    spriteTop: spriteBounds.top,
    nameFontSize: nameStyle.fontSize,
    nameTop: sheet.querySelector(".pokemon-summary h2").getBoundingClientRect().top,
    maxButtonText: maxButton.textContent,
    maxButtonWidth: maxButton.getBoundingClientRect().width,
    footerButtonLabels: footerButtons.map((button) => button.textContent.trim()),
    footerButtonHeights: footerButtons.map((button) => button.getBoundingClientRect().height),
    sliderHeight: slider.getBoundingClientRect().height,
    sliderBackgroundSize: getComputedStyle(slider).backgroundSize,
  };
});
if (trainingLayout.horizontalOverflow > 1 || trainingLayout.footerOverflow > 1 || trainingLayout.trainingScrollOverflow > 1) throw new Error(`The compact Training editor overflowed or required scrolling in its mobile drawer: ${JSON.stringify(trainingLayout)}`);
if (trainingLayout.unusedGap > 10) throw new Error("The Training drawer retained dead space between its moves and footer.");
if (trainingLayout.maxButtonText !== "Max IV" || trainingLayout.maxButtonWidth > 30) throw new Error("The compact IV shortcut did not read Max IV at its original width.");
if (trainingLayout.footerButtonLabels.join(",") !== "Apply changes,Close" || new Set(trainingLayout.footerButtonHeights).size !== 1) throw new Error("The Training footer did not expose normalized Apply and Close actions.");
if (trainingLayout.sliderHeight > 20) throw new Error("The Training EV slider remained too thick for the compact layout.");
if (!trainingLayout.sliderBackgroundSize.includes("16px")) throw new Error("The Training EV slider track did not stop beneath its thumb.");
if ((await page.locator("[data-edit-training-move] > b").allTextContents()).some((label) => label.trim() !== "Select")) throw new Error("Training move actions did not use the Select label.");
await page.fill('[data-training-ev-input="hp"]', "7");
if (await page.locator('[data-training-ev="hp"]').inputValue() !== "7") throw new Error("Typing an EV did not synchronize its slider.");
await page.locator('[data-training-ev="hp"]').evaluate((input) => { input.value = "5"; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); });
await page.click('[data-edit-training-move="0"]');
await assertMobileLayout("move picker", [".training-move-list"]);
await assertDesktopLayout("move picker", [".training-move-list"]);
const currentMoveSummary = await page.locator("[data-current-training-move]").evaluate((row) => ({
  name: row.querySelector(".showdown-move-copy > strong")?.textContent.trim(),
  imagePaths: [...row.querySelectorAll(".showdown-move-sprite img")].map((image) => new URL(image.src).pathname),
  statLabels: [...row.querySelectorAll("[data-move-stat] small")].map((label) => label.textContent.trim()),
  statValues: [...row.querySelectorAll("[data-move-stat] b")].map((value) => value.textContent.trim()),
  description: row.querySelector(".showdown-move-copy > small")?.textContent.trim(),
  price: row.querySelector("[data-move-price] b")?.textContent.trim(),
}));
if (currentMoveSummary.name !== outgoingPokemon.moves[0] || currentMoveSummary.statLabels.join(",") !== "Power,Accuracy" || currentMoveSummary.statValues.some((value) => !value) || !currentMoveSummary.description || currentMoveSummary.price) throw new Error(`The current move did not use the complete price-free Showdown row: ${JSON.stringify(currentMoveSummary)}`);
if (!currentMoveSummary.imagePaths[0]?.includes("/assets/showdown/types/") || !currentMoveSummary.imagePaths[1]?.includes("/assets/showdown/categories/")) throw new Error(`The current move did not use local Showdown type and category sprites: ${JSON.stringify(currentMoveSummary.imagePaths)}`);
const candidateMoveSummary = await page.locator("[data-select-training-move]").first().evaluate((row) => ({ images: row.querySelectorAll(".showdown-move-sprite img").length, priceHeader: row.querySelector("[data-move-price] small")?.textContent.trim(), price: row.querySelector("[data-move-price] b")?.textContent.trim() }));
if (candidateMoveSummary.images !== 2 || candidateMoveSummary.priceHeader !== "Price" || !candidateMoveSummary.price?.startsWith("₽")) throw new Error("Candidate moves did not share the aligned Showdown row while retaining their labeled price.");
const alignedMoveColumns = await page.locator("[data-select-training-move]").evaluateAll((rows) => rows.slice(0, 5).map((row) => [...row.querySelectorAll(".showdown-move-sprite, [data-move-stat], [data-move-price]")].map((cell) => cell.getBoundingClientRect().left)));
if (alignedMoveColumns.some((columns) => columns.some((left, index) => Math.abs(left - alignedMoveColumns[0][index]) > .5))) throw new Error(`Move comparison columns did not align across cards: ${JSON.stringify(alignedMoveColumns)}`);
if (!await page.locator("[data-training-move-search]").count()) throw new Error("The Training move picker did not expose search.");
await page.locator("[data-training-move-search]").evaluate((input) => { input.dataset.identity = "original"; });
await page.locator("[data-training-move-search]").pressSequentially("th", { delay: 20 });
const stableSearch = await page.locator("[data-training-move-search]").evaluate((input) => ({ identity: input.dataset.identity, focused: document.activeElement === input }));
if (stableSearch.identity !== "original" || !stableSearch.focused) throw new Error("Typing in move search replaced or unfocused the input.");
await page.fill("[data-training-move-search]", "definitely-no-such-move");
if (await page.locator("[data-select-training-move]:visible").count() || !await page.locator(".training-empty:visible").count()) throw new Error("Move search did not filter nonmatching moves.");
await page.fill("[data-training-move-search]", teachableTm.move);
if (!await page.locator(`[data-select-training-move="${teachableTm.id}"]:visible`).count()) throw new Error("Move search did not find a compatible move by name.");
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
  summaryTop: sheet.querySelector(".pokemon-summary").getBoundingClientRect().top,
  summaryLeft: sheet.querySelector(".pokemon-summary").getBoundingClientRect().left,
  spriteWidth: sheet.querySelector(".pokemon-summary > img").getBoundingClientRect().width,
  spriteTop: sheet.querySelector(".pokemon-summary > img").getBoundingClientRect().top,
  nameFontSize: getComputedStyle(sheet.querySelector(".pokemon-summary h2")).fontSize,
  nameTop: sheet.querySelector(".pokemon-summary h2").getBoundingClientRect().top,
  actionButtonHeight: sheet.querySelector(".sheet-actions .gloss-button").getBoundingClientRect().height,
}));
if (summaryHeader.sheetHeight !== trainingLayout.sheetHeight) throw new Error("Summary and Training drawers did not share the same height.");
if (summaryHeader.summaryHeight !== trainingLayout.summaryHeight || summaryHeader.spriteWidth !== trainingLayout.spriteWidth || summaryHeader.nameFontSize !== trainingLayout.nameFontSize) throw new Error("Summary and Training did not share the same Pokémon header sizing.");
if (summaryHeader.summaryTop !== trainingLayout.summaryTop || summaryHeader.summaryLeft !== trainingLayout.summaryLeft || summaryHeader.spriteTop !== trainingLayout.spriteTop || summaryHeader.nameTop !== trainingLayout.nameTop) throw new Error("Summary and Training did not keep the Pokémon header in the same position.");
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
await assertMobileLayout("lead selection", [".lead-prompt"]);
await assertDesktopLayout("lead selection", [".lead-prompt"], [
  { first: ".lead-arena", second: ".lead-prompt", direction: "above" },
  { first: ".lead-prompt", second: ".lead-actions", direction: "above" },
]);
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
await assertMobileLayout("active battle", [".battle-panel", ".battle-log-body"]);
await assertDesktopLayout("active battle", [".battle-panel", ".battle-log-body"], [
  { first: ".battle-arena", second: ".battle-panel", direction: "above" },
]);
await assertContainedLandscape("active battle", ".battle-panel");
await page.waitForSelector(".battler-slot.enemy.is-aligned");

const battlePanelFallback = await page.locator(".battle-panel").evaluate((panel) => {
  const originalStyle = panel.getAttribute("style");
  panel.style.height = "220px";
  panel.style.flex = "0 0 220px";
  const overflowY = getComputedStyle(panel).overflowY;
  const overflow = panel.scrollHeight - panel.clientHeight;
  panel.scrollTop = panel.scrollHeight;
  const panelBounds = panel.getBoundingClientRect();
  const giveUpBounds = panel.querySelector(".give-up").getBoundingClientRect();
  const result = {
    overflowY,
    overflow,
    scrollTop: panel.scrollTop,
    giveUpVisible: giveUpBounds.top >= panelBounds.top - 1 && giveUpBounds.bottom <= panelBounds.bottom + 1,
  };
  if (originalStyle === null) panel.removeAttribute("style");
  else panel.setAttribute("style", originalStyle);
  return result;
});
if (battlePanelFallback.overflowY !== "auto" || battlePanelFallback.overflow <= 1 || battlePanelFallback.scrollTop <= 1 || !battlePanelFallback.giveUpVisible) throw new Error(`The compact battle controls could not scroll to the final action: ${JSON.stringify(battlePanelFallback)}`);

if (await page.locator(".battler-slot.player").getAttribute("data-pokemon") !== replacementId) throw new Error("The selected PC Pokémon was not used as the lead.");
if (!(await page.locator(".battle-hud.enemy").textContent())?.includes("Lv. 100")) throw new Error("Brock's Pokémon is not level 100.");
const battleHealth = await page.locator(".battle-hud").evaluateAll((huds) => huds.map((hud) => {
  const bar = hud.querySelector(".hp-bar").getBoundingClientRect();
  const detail = hud.querySelector(".battle-hud-detail").getBoundingClientRect();
  return { text: hud.querySelector(".battle-hud-detail small").textContent.trim(), separated: bar.bottom <= detail.top };
}));
if (battleHealth.some(({ text, separated }) => !/^\d+%$/.test(text) || !separated)) throw new Error(`Battle HP did not use separated percentage labels: ${JSON.stringify(battleHealth)}`);
const switchHealth = await page.locator(".switch-choice:not(.fainted)").evaluateAll((buttons) => buttons.map((button) => ({
  label: button.querySelector("small").textContent.trim(),
  width: button.querySelector(".switch-hp b").style.width,
  nameBottom: button.querySelector(":scope > span").getBoundingClientRect().bottom,
  labelTop: button.querySelector("small").getBoundingClientRect().top,
})));
if (switchHealth.some(({ label, width, nameBottom, labelTop }) => label !== width || nameBottom > labelTop + .5)) throw new Error(`Switch HP names, labels, or bars overlapped or disagreed: ${JSON.stringify(switchHealth)}`);
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

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector(".battle-screen");
if (!(await page.locator(".prompt").textContent())?.includes("Turn 2")) throw new Error("The active battle was not resumed after refresh.");

await page.click("[data-forfeit-battle]");
await page.waitForFunction(() => document.querySelector(".prompt")?.textContent.includes("Brock won"));
if (await page.locator("[data-forfeit-battle]").count()) throw new Error("Forfeit remained available after the battle ended.");
await page.waitForSelector(".result-modal");
if (!(await page.locator(".result-modal").textContent())?.includes("Defeat")) throw new Error("The result overlay did not report the loss.");
await assertMobileLayout("battle result", [".result-modal"]);
await assertDesktopLayout("battle result", [".result-modal"]);
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
await assertMobileLayout("leaderboard", [".leaderboard-content"]);
await assertDesktopLayout("leaderboard", [".leaderboard-content"]);
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
if ((await page.locator(".leaderboard-content").textContent()).toUpperCase().includes("LOSS")) throw new Error("The daily leaderboard still displayed the LOSS label.");
if (await page.locator(".leaderboard-loss .leaderboard-mon.survived").count()) throw new Error("A forfeited battle showed surviving Pokémon on the leaderboard.");
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
if ((await freshBattleButton.textContent())?.trim() !== "Battle") throw new Error("A forfeit did not route the empty fresh run through encounters.");
await freshBattleButton.click();
if (await page.locator("[data-encounter]").count()) throw new Error("A forfeit granted fresh-run encounters before the next day.");
if (!(await page.locator(".encounter-empty").textContent())?.includes("New encounters in")) throw new Error("The post-wipe encounter screen did not show the next-day countdown.");

const imageFailures = await page.locator("img").evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src));
await browser.close();

if (errors.length || imageFailures.length) throw new Error(JSON.stringify({ errors, imageFailures }, null, 2));
console.log("Browser flow passed: auth, opening encounters, held-item Mart, staged PC training, team swap, battle, refresh resume, and forfeit.");
