(function () {
  "use strict";

  const backSpriteIds = new Set(["flareon", "raichu", "vaporeon", "gengar", "venusaur", "pidgeot", "arcanine", "lapras", "alakazam", "machamp", "nidoking", "exeggutor"]);
  const sprite = (id, back = false) => `assets/${back && backSpriteIds.has(id) ? "sprites-back" : "sprites"}/${id}.png`;
  const healthTone = (percent) => percent <= 20 ? "critical" : percent <= 50 ? "warning" : "healthy";
  const trainerSprite = "assets/trainers/brock.png";
  const app = document.querySelector("#app");
  const tooltip = document.querySelector("#tooltip");
  const savedTheme = localStorage.getItem("nuzzleTheme");

  const mons = {
    flareon: { name: "Flareon", types: ["Fire"], ability: "Flash Fire", item: "Charcoal", nature: "Adamant", natureUp: "Atk", natureDown: "SpA", hp: "100.0% (263/263)", stats: "Atk 296 / Def 156 / SpA 226 / SpD 256 / Spe 166", moves: ["Flamethrower", "Quick Attack", "Bite", "Will-O-Wisp"] },
    raichu: { name: "Raichu", types: ["Electric"], ability: "Static", item: "Magnet", nature: "Timid", natureUp: "Spe", natureDown: "Atk", hp: "100.0% (261/261)", stats: "Atk 216 / Def 146 / SpA 216 / SpD 196 / Spe 256", moves: ["Thunderbolt", "Thunder Punch", "Surf", "Nasty Plot"] },
    vaporeon: { name: "Vaporeon", types: ["Water"], ability: "Water Absorb", item: "Leftovers", nature: "Bold", natureUp: "Def", natureDown: "Atk", hp: "100.0% (401/401)", stats: "Atk 166 / Def 156 / SpA 256 / SpD 226 / Spe 166", moves: ["Surf", "Ice Beam", "Shadow Ball", "Wish"] },
    gengar: { name: "Gengar", types: ["Ghost", "Poison"], ability: "Cursed Body", item: "Spell Tag", nature: "Modest", natureUp: "SpA", natureDown: "Atk", hp: "100.0% (261/261)", stats: "Atk 166 / Def 156 / SpA 296 / SpD 186 / Spe 256", moves: ["Shadow Ball", "Sludge Bomb", "Thunderbolt", "Hypnosis"] },
    venusaur: { name: "Venusaur", types: ["Grass", "Poison"], ability: "Overgrow", item: "Miracle Seed", nature: "Calm", natureUp: "SpD", natureDown: "Atk", hp: "100.0% (301/301)", stats: "Atk 200 / Def 202 / SpA 236 / SpD 236 / Spe 196", moves: ["Giga Drain", "Sludge Bomb", "Earth Power", "Synthesis"] },
    pidgeot: { name: "Pidgeot", types: ["Normal", "Flying"], ability: "Keen Eye", item: "Sharp Beak", nature: "Jolly", natureUp: "Spe", natureDown: "SpA", hp: "100.0% (307/307)", stats: "Atk 196 / Def 186 / SpA 176 / SpD 176 / Spe 218", moves: ["Air Slash", "U-turn", "Quick Attack", "Roost"] },
    arcanine: { name: "Arcanine", types: ["Fire"], ability: "Intimidate", item: "Sitrus Berry", nature: "Adamant", natureUp: "Atk", natureDown: "SpA", hp: "100.0% (321/321)", stats: "Atk 256 / Def 196 / SpA 236 / SpD 196 / Spe 226", moves: ["Flamethrower", "Crunch", "Extreme Speed", "Will-O-Wisp"] },
    lapras: { name: "Lapras", types: ["Water", "Ice"], ability: "Water Absorb", item: "Leftovers", nature: "Modest", natureUp: "SpA", natureDown: "Atk", hp: "100.0% (401/401)", stats: "Atk 206 / Def 196 / SpA 206 / SpD 226 / Spe 156", moves: ["Surf", "Ice Beam", "Thunderbolt", "Sing"] },
    alakazam: { name: "Alakazam", types: ["Psychic"], ability: "Synchronize", item: "Twisted Spoon", nature: "Timid", natureUp: "Spe", natureDown: "Atk", hp: "100.0% (251/251)", stats: "Atk 136 / Def 126 / SpA 306 / SpD 226 / Spe 276", moves: ["Psychic", "Shadow Ball", "Energy Ball", "Calm Mind"] },
    machamp: { name: "Machamp", types: ["Fighting"], ability: "No Guard", item: "Black Belt", nature: "Adamant", natureUp: "Atk", natureDown: "SpA", hp: "100.0% (321/321)", stats: "Atk 296 / Def 196 / SpA 166 / SpD 206 / Spe 146", moves: ["Dynamic Punch", "Knock Off", "Stone Edge", "Bullet Punch"] },
    nidoking: { name: "Nidoking", types: ["Poison", "Ground"], ability: "Sheer Force", item: "Life Orb", nature: "Timid", natureUp: "Spe", natureDown: "Atk", hp: "100.0% (303/303)", stats: "Atk 220 / Def 190 / SpA 206 / SpD 186 / Spe 206", moves: ["Earth Power", "Sludge Bomb", "Ice Beam", "Thunderbolt"] },
    exeggutor: { name: "Exeggutor", types: ["Grass", "Psychic"], ability: "Chlorophyll", item: "Sitrus Berry", nature: "Quiet", natureUp: "SpA", natureDown: "Spe", hp: "100.0% (331/331)", stats: "Atk 226 / Def 206 / SpA 286 / SpD 166 / Spe 146", moves: ["Psychic", "Giga Drain", "Sludge Bomb", "Sleep Powder"] },
  };

  const opponent = ["steelix", "golem", "rhyperior", "aerodactyl", "sudowoodo", "magcargo"];
  const partyIds = ["flareon", "raichu", "vaporeon", "gengar", "venusaur", "pidgeot"];
  const pcIds = [...partyIds, "arcanine", "lapras", "alakazam", "machamp", "nidoking", "exeggutor"];
  const encounterIds = ["lapras", "arcanine", "alakazam"];
  const moves = {
    flamethrower: { name: "Flamethrower", type: "Fire", pp: "24/24", power: 90, accuracy: "100%", description: "Has a 10% chance to burn the target.", effectiveness: "Super effective vs. Steelix (2×)" },
    bite: { name: "Bite", type: "Dark", pp: "40/40", power: 60, accuracy: "100%", description: "Has a 30% chance to make the target flinch.", effectiveness: "Neutral damage vs. Steelix (1×)" },
    quickattack: { name: "Quick Attack", type: "Normal", pp: "48/48", power: 40, accuracy: "100%", description: "Usually moves first.", effectiveness: "Not very effective vs. Steelix (½×)" },
    willowisp: { name: "Will-O-Wisp", type: "Fire", pp: "24/24", power: "—", accuracy: "85%", description: "Burns the target.", effectiveness: "Status move" },
  };

  let route = "home";
  let currentUser = null;
  let authOpen = false;
  let authMode = "login";
  let authLoading = false;
  let authError = "";
  let pendingRoute = null;
  let avatarEditorOpen = false;
  let avatarUploadBlob = null;
  let avatarPreviewUrl = "";
  let avatarBusy = false;
  let theme = savedTheme === "dark" ? "dark" : "light";
  let team = new Set(partyIds);
  let pcOrder = [...pcIds];
  let encounters = new Array(3).fill(null);
  let battleState = null;
  let battleLoading = false;
  let battleError = "";
  let battleLogExpanded = false;
  let battleLogFollow = true;
  let battleLogScrollTop = 0;
  let battleLogHasNew = false;
  let battleLogInitialized = false;
  let battleLogRenderedIds = new Set();
  let balance = 2500;
  let selectedPcId = null;
  let pcSwapMode = false;
  let pcItemMode = false;
  let activePcItemGroup = "Training Items";
  let pendingPcItemId = null;
  let selectedNature = null;
  let pcItemMessage = "";
  let selectedLeadId = null;
  let purchaseMessage = "";
  let activeShopGroup = "Held Items";
  let activeBagGroup = "Held Items";
  const inventory = {};

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function avatarContent(user, previewUrl = "") {
    if (previewUrl) return `<img src="${previewUrl}" alt="">`;
    if (user?.avatarVersion) return `<img src="/api/auth/avatar?v=${encodeURIComponent(user.avatarVersion)}" alt="">`;
    return `<span>${escapeHtml(user?.username?.slice(0, 1).toUpperCase() || "?")}</span>`;
  }

  function resetAvatarEditor() {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    avatarEditorOpen = false;
    avatarUploadBlob = null;
    avatarPreviewUrl = "";
    avatarBusy = false;
    authError = "";
  }

  async function normalizeAvatar(file) {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");
    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = sourceUrl;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error("That image could not be opened.");
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = (image.naturalWidth - side) / 2;
      const sourceY = (image.naturalHeight - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      canvas.getContext("2d").drawImage(image, sourceX, sourceY, side, side, 0, 0, 256, 256);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", .86));
      if (!blob || blob.type !== "image/webp") throw new Error("This browser could not prepare the image.");
      return blob;
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function prepareAvatar(file) {
    avatarBusy = true;
    authError = "";
    try {
      const blob = await normalizeAvatar(file);
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      avatarUploadBlob = blob;
      avatarPreviewUrl = URL.createObjectURL(blob);
    } catch (error) {
      authError = error.message;
    } finally {
      avatarBusy = false;
      render();
    }
  }

  async function saveAvatar() {
    if (!avatarUploadBlob || avatarBusy) return;
    avatarBusy = true;
    authError = "";
    render();
    try {
      const result = await apiRequest("/api/auth/avatar", {
        method: "PUT",
        headers: { "Content-Type": "image/webp" },
        body: avatarUploadBlob,
      });
      currentUser = result.user;
      resetAvatarEditor();
    } catch (error) {
      avatarBusy = false;
      authError = error.message;
    }
    render();
  }

  async function removeAvatar() {
    if (avatarBusy) return;
    avatarBusy = true;
    authError = "";
    render();
    try {
      const result = await apiRequest("/api/auth/avatar", { method: "DELETE" });
      currentUser = result.user;
      resetAvatarEditor();
    } catch (error) {
      avatarBusy = false;
      authError = error.message;
    }
    render();
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: options.body ? { "Content-Type": "application/json", ...options.headers } : options.headers,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && !path.startsWith("/api/auth/")) {
        currentUser = null;
        authOpen = true;
        pendingRoute = route === "home" ? null : route;
      }
      const error = new Error(body.error || `Request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#121212" : "#ffffff");
  }

  function openAuth(destination = null) {
    resetAvatarEditor();
    authOpen = true;
    authMode = "login";
    authError = "";
    pendingRoute = destination;
    render();
    requestAnimationFrame(() => document.querySelector("#auth-username")?.focus({ preventScroll: true }));
  }

  async function submitAuth(form) {
    if (authLoading) return;
    const fields = new FormData(form);
    const username = String(fields.get("username") || "");
    const password = String(fields.get("password") || "");
    const confirmation = String(fields.get("passwordConfirmation") || "");
    if (authMode === "register" && password !== confirmation) {
      authError = "Passwords do not match.";
      render();
      return;
    }
    authLoading = true;
    authError = "";
    render();
    try {
      const result = await apiRequest(`/api/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      currentUser = result.user;
      authOpen = false;
      const destination = pendingRoute;
      pendingRoute = null;
      if (destination) {
        route = destination === "lead" && battleState && !battleState.ended ? "battle" : destination;
        if (route === "lead") selectedLeadId = null;
      }
      await resumeBattle(false);
    } catch (error) {
      authError = error.message;
    } finally {
      authLoading = false;
      render();
    }
  }

  async function logout() {
    if (authLoading) return;
    authLoading = true;
    render();
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      currentUser = null;
      resetAvatarEditor();
      battleState = null;
      authOpen = false;
      authLoading = false;
      route = "home";
      render();
    }
  }

  function acceptBattleState(nextState) {
    if (battleState?.id && battleState.id !== nextState?.id) {
      battleLogInitialized = false;
      battleLogRenderedIds = new Set();
    }
    const previousId = battleState?.log?.at(-1)?.id || 0;
    const nextId = nextState?.log?.at(-1)?.id || 0;
    if (!battleLogFollow && nextId > previousId) battleLogHasNew = true;
    battleState = nextState;
  }

  async function startBattle() {
    if (!selectedLeadId || battleLoading) return;
    battleLoading = true;
    battleError = "";
    render();
    try {
      acceptBattleState(await apiRequest("/api/battles", {
        method: "POST",
        body: JSON.stringify({ partyIds: [...team].slice(0, 6), leadId: selectedLeadId }),
      }));
      localStorage.setItem("nuzzleBattleId", battleState.id);
      route = "battle";
    } catch (error) {
      battleError = error.message;
      route = "lead";
    } finally {
      battleLoading = false;
      render();
      scrollTo(0, 0);
    }
  }

  async function submitBattleChoice(action) {
    if (!battleState || battleLoading || battleState.ended) return;
    battleLoading = true;
    battleError = "";
    render();
    try {
      acceptBattleState(await apiRequest(`/api/battles/${battleState.id}/choices`, {
        method: "POST",
        body: JSON.stringify({ rqid: battleState.rqid, action }),
      }));
    } catch (error) {
      battleError = error.message;
    } finally {
      battleLoading = false;
      render();
    }
  }

  async function forfeitBattle() {
    if (!battleState || battleLoading || battleState.ended) return;
    battleLoading = true;
    battleError = "";
    render();
    try {
      acceptBattleState(await apiRequest(`/api/battles/${battleState.id}/forfeit`, { method: "POST" }));
    } catch (error) {
      battleError = error.message;
    } finally {
      battleLoading = false;
      render();
    }
  }

  function title() {
    return "Nuzzle #1: Brock (10/15/2026)";
  }

  function header() {
    const accountLabel = currentUser ? `Account for ${currentUser.username}` : "Log in or create an account";
    const accountContent = currentUser ? avatarContent(currentUser) : '<span class="account-head"></span><span class="account-shoulders"></span>';
    const themeIcons = '<svg class="theme-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path></svg><svg class="theme-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 15.3A8.5 8.5 0 0 1 8.7 3.6 8.5 8.5 0 1 0 20.4 15.3Z"></path></svg>';
    return `<header class="screen-header"><h1 class="screen-title">${title()}</h1><div class="header-tools"><button class="theme-toggle" type="button" role="switch" aria-checked="${theme === "dark"}" aria-label="Use ${theme === "dark" ? "light" : "dark"} mode" data-toggle-theme><i>${themeIcons}</i></button><button class="account-button${currentUser ? " signed-in" : ""}" type="button" aria-label="${accountLabel}" data-open-account><span class="account-glyph">${accountContent}</span></button></div></header>${authOpen ? authCard() : ""}`;
  }

  function navigation(current = "", className = "home-actions") {
    const currentClass = (name) => current === name ? " is-current" : "";
    const currentPage = (name) => current === name ? ' aria-current="page"' : "";
    return `<nav class="${className}" aria-label="Game sections">
      <button class="gloss-button red${currentClass("battle")}"${currentPage("battle")} data-route="lead">battle</button>
      <button class="gloss-button orange${currentClass("pc")}"${currentPage("pc")} data-route="pc">pc box</button>
      <button class="gloss-button gold${currentClass("bag")}"${currentPage("bag")} data-route="bag">bag</button>
      <button class="gloss-button green${currentClass("encounters")}"${currentPage("encounters")} data-route="encounters">encounter (${encounters.filter((item) => !item).length})</button>
      <button class="gloss-button blue${currentClass("mart")}"${currentPage("mart")} data-route="mart">mart</button>
      <button class="gloss-button purple${currentClass("leaderboard")}"${currentPage("leaderboard")} data-route="leaderboard">leaderboard</button>
      <button class="gloss-button slate${currentClass("settings")}"${currentPage("settings")} data-route="settings">settings</button>
    </nav>`;
  }

  function authCard() {
    if (currentUser && avatarEditorOpen) {
      const preview = avatarContent(currentUser, avatarPreviewUrl);
      return `<div class="auth-backdrop" data-close-auth><section class="auth-card account-card avatar-editor" role="dialog" aria-modal="true" aria-labelledby="avatar-title"><button class="auth-close" type="button" aria-label="Close account" data-close-auth>×</button><h2 id="avatar-title">Profile picture</h2><div class="avatar-editor-preview">${preview}</div>${authError ? `<p class="auth-error" role="alert">${escapeHtml(authError)}</p>` : ""}<input class="avatar-file-input" type="file" accept="image/jpeg,image/png,image/webp" data-avatar-input>${avatarUploadBlob ? `<div class="avatar-actions"><button class="profile-button primary" type="button" data-avatar-save ${avatarBusy ? "disabled" : ""}>${avatarBusy ? "saving…" : "save"}</button><button class="profile-button" type="button" data-avatar-choose ${avatarBusy ? "disabled" : ""}>choose another</button><button class="profile-link" type="button" data-avatar-cancel>cancel</button></div>` : `<div class="avatar-actions"><button class="profile-button primary" type="button" data-avatar-choose ${avatarBusy ? "disabled" : ""}>${avatarBusy ? "preparing…" : "upload a picture"}</button>${currentUser.avatarVersion ? `<button class="profile-button remove" type="button" data-avatar-remove ${avatarBusy ? "disabled" : ""}>remove picture</button>` : ""}<button class="profile-link" type="button" data-avatar-cancel>cancel</button></div>`}</section></div>`;
    }
    if (currentUser) return `<div class="auth-backdrop" data-close-auth><section class="auth-card account-card" role="dialog" aria-modal="true" aria-labelledby="account-title"><button class="auth-close" type="button" aria-label="Close account" data-close-auth>×</button><h2 id="account-title">Account</h2><div class="account-profile"><button class="account-avatar-button" type="button" aria-label="Edit profile picture" data-edit-avatar><span class="account-avatar">${avatarContent(currentUser)}</span><span class="avatar-edit-badge" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m5 14 1-4 7-7 3 3-7 7-4 1Zm7-10 3 3"></path></svg></span></button><strong class="account-name">${escapeHtml(currentUser.username)}</strong></div><button class="auth-primary logout-button" type="button" data-logout ${authLoading ? "disabled" : ""}>${authLoading ? "logging out…" : "log out"}</button></section></div>`;
    const registering = authMode === "register";
    return `<div class="auth-backdrop" data-close-auth><section class="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button class="auth-close" type="button" aria-label="Close login" data-close-auth>×</button><h2 id="auth-title">${registering ? "Create account" : "Log in"}</h2><form data-auth-form><label for="auth-username">Username</label><input id="auth-username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" required><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${registering ? "new-password" : "current-password"}" minlength="15" maxlength="128" required>${registering ? '<label for="auth-password-confirmation">Confirm password</label><input id="auth-password-confirmation" name="passwordConfirmation" type="password" autocomplete="new-password" minlength="15" maxlength="128" required><small class="password-help">Use at least 15 characters.</small>' : ""}${authError ? `<p class="auth-error" role="alert">${escapeHtml(authError)}</p>` : ""}<button class="auth-primary" type="submit" ${authLoading ? "disabled" : ""}>${authLoading ? "please wait…" : registering ? "register" : "log in"}</button></form><button class="auth-mode-link" type="button" data-auth-mode="${registering ? "login" : "register"}">${registering ? "Already have an account? Log in" : "Don't have an account? Register"}</button></section></div>`;
  }

  function home() {
    return `<section class="screen">${header()}<div class="landing">
      <div class="trainer-wrap"><img class="sprite trainer" src="${trainerSprite}" alt="Gym Leader Brock" /></div>
      <div class="opponent-team" aria-label="Brock's team">${opponent.map((id) => `<button type="button" aria-label="${id}"><img class="sprite" src="${sprite(id)}" alt="${id}" /></button>`).join("")}</div>
      ${navigation()}
    </div></section>`;
  }

  function lead() {
    const chosen = [...team].slice(0, 6);
    return `<section class="screen lead-screen">${header()}<div class="arena lead-arena"><img class="sprite trainer" src="${trainerSprite}" alt="Gym Leader Brock" /></div>
      <div class="lead-prompt"><p class="prompt">How will you start the battle?</p><h2 class="section-label">Choose Lead</h2>
      <div class="lead-grid">${chosen.map(monButton).join("")}</div></div>
      ${battleError ? `<p class="battle-error" role="alert">${escapeHtml(battleError)}</p>` : ""}
      <div class="lead-actions"><button class="gloss-button red" type="button" data-start-battle ${selectedLeadId && !battleLoading ? "" : "disabled"}>${battleLoading ? "starting…" : "start battle"}</button><button class="gloss-button purple" type="button" data-route="home">back</button></div>
    </section>`;
  }

  function monButton(id) {
    const mon = mons[id];
    const selected = id === selectedLeadId;
    return `<button class="lead-choice${selected ? " selected" : ""}" type="button" data-select-lead="${id}" aria-pressed="${selected}"><img class="sprite" src="${sprite(id)}" alt=""/><span>${mon.name}</span></button>`;
  }

  function battle() {
    if (!battleState) return `<section class="screen battle-screen">${header()}<div class="battle-unavailable"><h2>Battle unavailable</h2><p>${escapeHtml(battleError || "Start a battle from the lead-selection screen.")}</p><button class="gloss-button purple" data-route="lead">back</button></div></section>`;
    const player = battleState.player.active;
    const enemy = battleState.opponent.active;
    const logEntries = battleState.log || (battleState.events || []).map((text, index) => ({ id: index + 1, side: "system", category: "event", text }));
    const visibleLogEntries = logEntries.at(-1)?.category === "turn" ? logEntries.slice(0, -1) : logEntries;
    const latestAnnouncement = [...logEntries].reverse().find((entry) => entry.category !== "turn")?.text || "";
    let newEntryIndex = 0;
    const logHtml = visibleLogEntries.map((entry) => {
      const isNew = battleLogInitialized && !battleLogRenderedIds.has(entry.id);
      const delay = isNew ? Math.min(newEntryIndex++, 7) * 38 : 0;
      battleLogRenderedIds.add(entry.id);
      const content = entry.category === "turn"
        ? `<div class="battle-log-turn" role="separator">${escapeHtml(entry.text)}</div>`
        : `<p class="battle-log-entry ${entry.side} category-${entry.category}">${escapeHtml(entry.text)}</p>`;
      return `<div class="battle-log-row${isNew ? " is-new" : ""}" data-log-entry-id="${entry.id}" style="--log-delay:${delay}ms"><div>${content}</div></div>`;
    }).join("");
    battleLogInitialized = true;
    const movesHtml = battleState.moves.map((move) => `<button class="move-button type-${move.type.toLowerCase()}" type="button" data-battle-move="${move.slot}" data-battle-move-tip="${move.slot}" ${move.disabled || battleLoading || battleState.ended ? "disabled" : ""}><strong>${escapeHtml(move.name)}</strong><span>${escapeHtml(move.type)}</span><small>${move.pp}/${move.maxPp}</small></button>`).join("");
    const switchesHtml = battleState.player.team.map((pokemon) => `<button class="switch-choice ${pokemon.active ? "selected" : ""} ${pokemon.fainted ? "fainted" : ""}" type="button" data-battle-switch="${pokemon.slot}" data-mon-tip="${pokemon.id}" ${!pokemon.canSwitch || battleLoading || battleState.ended ? "disabled" : ""}><img class="sprite" src="${sprite(pokemon.id)}" alt=""/><span>${escapeHtml(pokemon.name)}</span><small>${pokemon.fainted ? "fainted" : `${pokemon.percent}%`}</small></button>`).join("");
    const prompt = battleState.ended
      ? `<strong>${battleState.winner === "Player" ? "You won!" : battleState.winner === "Brock" ? "Brock won." : "Battle over."}</strong>`
      : battleState.forcedSwitch
        ? "Choose your next Pokémon."
        : battleLoading || battleState.waiting
          ? "Resolving the turn…"
          : `What will <strong>${escapeHtml(player?.name)}</strong> do?`;
    return `<section class="screen battle-screen">${header()}<div class="arena battle-arena" aria-label="Rocky battlefield">
      <div class="battle-platform enemy" aria-hidden="true"></div><div class="battle-platform player" aria-hidden="true"></div>
      ${enemy ? `<div class="battler-slot enemy" data-pokemon="${escapeHtml(enemy.id)}"><img class="sprite active-sprite" src="${sprite(enemy.id)}" alt="${escapeHtml(enemy.name)}" /></div><section class="battle-hud enemy" aria-label="Opponent ${escapeHtml(enemy.name)}"><div class="battle-hud-title"><strong>${escapeHtml(enemy.name)}</strong><span>Lv. ${enemy.level}</span></div><div class="hp-bar ${healthTone(enemy.percent)}"><i style="width:${enemy.percent}%"></i></div><div class="battle-hud-detail"><span>HP</span><small>${enemy.percent}%</small>${enemy.status ? `<b>${escapeHtml(enemy.status.toUpperCase())}</b>` : ""}</div></section>` : ""}
      ${player ? `<div class="battler-slot player" data-pokemon="${escapeHtml(player.id)}"><img class="sprite active-sprite" src="${sprite(player.id, true)}" alt="${escapeHtml(player.name)}" /></div><section class="battle-hud player" aria-label="Your ${escapeHtml(player.name)}"><div class="battle-hud-title"><strong>${escapeHtml(player.name)}</strong><span>Lv. ${player.level}</span></div><div class="hp-bar ${healthTone(player.percent)}"><i style="width:${player.percent}%"></i></div><div class="battle-hud-detail"><span>HP</span><small>${player.hp}/${player.maxHp}</small>${player.status ? `<b>${escapeHtml(player.status.toUpperCase())}</b>` : ""}</div></section>` : ""}
    </div><div class="battle-panel${battleLogExpanded ? " log-expanded" : ""}"><section class="battle-log-card${battleLogExpanded ? " expanded" : ""}" aria-labelledby="battle-log-title"><header><h2 id="battle-log-title">Battle log</h2><div>${battleLogHasNew ? '<button type="button" data-battle-log-new>new events</button>' : ""}<button type="button" data-toggle-battle-log aria-expanded="${battleLogExpanded}">${battleLogExpanded ? "collapse" : "expand"}</button></div></header><div class="battle-log-body" data-battle-log role="log" aria-label="Battle events" tabindex="0"><div class="battle-log-stack">${logHtml || '<p class="battle-log-empty">The battle is starting…</p>'}</div></div></section><span class="visually-hidden" role="status" aria-live="polite">${escapeHtml(latestAnnouncement)}</span>
      <div class="battle-command-area" ${battleLogExpanded ? 'inert aria-hidden="true"' : ""}><p class="prompt">${prompt} <small>Turn ${battleState.turn}</small></p>${battleState.forcedSwitch || battleState.ended ? "" : `<h2 class="section-label attack">Attack</h2><div class="move-grid">${movesHtml}</div>`}
      <h2 class="section-label">Switch</h2><div class="switch-grid">${switchesHtml}</div>${battleError ? `<p class="battle-error" role="alert">${escapeHtml(battleError)}</p>` : ""}</div>
      ${battleState.ended ? '<button class="gloss-button purple give-up" data-route="home">return home</button>' : '<button class="gloss-button red give-up" data-forfeit-battle>give up</button>'}</div>
    </section>`;
  }

  function pc() {
    const party = [...team].slice(0, 6);
    const partySlots = Array.from({ length: 6 }, (_, index) => {
      const id = party[index];
      if (!id) return `<div class="party-slot empty" aria-label="Empty team slot"><span>empty</span></div>`;
      const mon = mons[id];
      return `<button class="party-slot" type="button" data-pc-detail="${id}" aria-label="View ${mon.name}"><img class="sprite" src="${sprite(id)}" alt=""/><span>${mon.name}</span></button>`;
    }).join("");
    const boxMons = pcOrder.map((id) => {
      const mon = mons[id];
      return `<button class="pc-mon${team.has(id) ? " on-team" : ""}" type="button" draggable="false" data-pc-mon="${id}" aria-label="View ${mon.name}${team.has(id) ? ", on team" : ""}"><img class="sprite" src="${sprite(id)}" alt=""/><span class="pc-mon-name">${mon.name}</span>${team.has(id) ? '<span class="team-mark">team</span>' : ""}</button>`;
    }).join("");
    return `<section class="screen">${header()}<div class="pc-stage"><p class="pc-help">Tap a Pokémon for details. Hold, then drag to organize the box.</p>
      <section class="pc-section party-section" aria-labelledby="party-heading"><div class="pc-section-head"><h2 id="party-heading">team</h2><span>${party.length}/6</span></div><div class="party-strip">${partySlots}</div></section>
      <section class="pc-section box-section" aria-labelledby="box-heading"><div class="pc-section-head"><h2 id="box-heading">box</h2><span>${pcOrder.length} Pokémon</span></div><div class="pc-box">${boxMons}</div></section>
      ${backButton()}</div>${selectedPcId ? pcPokemonSheet(selectedPcId) : ""}</section>`;
  }

  function pcPokemonSheet(id) {
    const mon = mons[id];
    const onTeam = team.has(id);
    const maxHp = mon.hp.match(/\/(\d+)\)/)?.[1] || "—";
    const statValues = [`HP ${maxHp}`, ...mon.stats.split(" / ")];
    const stats = statValues.map((stat) => {
      const split = stat.lastIndexOf(" ");
      const label = stat.slice(0, split);
      const value = stat.slice(split + 1);
      const change = label === mon.natureUp ? " raised" : label === mon.natureDown ? " lowered" : "";
      const marker = change === " raised" ? " ↑" : change === " lowered" ? " ↓" : "";
      const ariaChange = change ? `, ${change.trim()} by ${mon.nature} nature` : "";
      return `<span class="stat-card${change}" aria-label="${label}, ${value}${ariaChange}"><small>${label}${marker}</small><strong>${value}</strong></span>`;
    }).join("");
    const swapChooser = pcSwapMode && !onTeam ? `<section class="swap-chooser" aria-labelledby="swap-heading"><h3 id="swap-heading">Who should ${mon.name} replace?</h3><p>The new Pokémon will take the same team position.</p><div class="swap-grid">${[...team].map((teamId) => `<button type="button" data-team-replace="${teamId}"><img class="sprite" src="${sprite(teamId)}" alt=""/><span>${mons[teamId].name}</span></button>`).join("")}</div></section>` : "";
    const primaryLabel = onTeam ? "remove from team" : "add to team";
    const itemChooser = pcItemMode ? pcItemPanel(mon) : "";
    const sheetContent = swapChooser || itemChooser || `<section class="sheet-section"><h3>Stats</h3><div class="stat-grid">${stats}</div></section><section class="sheet-section"><h3>Moves</h3><div class="sheet-moves">${mon.moves.map((move) => `<span>${move}</span>`).join("")}</div></section>${pcItemMessage ? `<p class="sheet-feedback" role="status">${pcItemMessage}</p>` : ""}<div class="sheet-actions"><button class="gloss-button ${onTeam ? "slate" : "blue"}" type="button" data-team-toggle="${id}">${primaryLabel}</button><button class="gloss-button gold" type="button" data-open-pc-items>item</button></div>`;
    const alternateMode = swapChooser || itemChooser;
    return `<div class="sheet-backdrop" data-close-pc-sheet><section class="pokemon-sheet" role="dialog" aria-modal="true" aria-labelledby="pokemon-sheet-title">
      <button class="sheet-close" type="button" data-close-pc-sheet aria-label="Close Pokémon details" autofocus>×</button>
      <div class="pokemon-summary"><img class="sprite" src="${sprite(id)}" alt="${mon.name}"/><div><p class="sheet-kicker">Pokémon details</p><h2 id="pokemon-sheet-title">${mon.name}</h2><div class="sheet-types">${mon.types.map((type) => `<span class="type-chip ${type.toLowerCase()}">${type}</span>`).join("")}</div></div></div>
      <div class="pokemon-facts"><p><span>Ability</span><strong>${mon.ability}</strong></p><p><span>Nature</span><strong>${mon.nature}</strong></p><p><span>Held item</span><strong>${mon.item}</strong></p></div>
      <div class="sheet-mode-content">${sheetContent}</div>
      <button class="plain-button sheet-secondary-action" type="button" ${swapChooser ? "data-cancel-pc-swap" : itemChooser ? "data-cancel-pc-items" : "data-close-pc-sheet"}>${alternateMode ? "cancel" : "close"}</button>
    </section></div>`;
  }

  function encountersScreen() {
    const remaining = encounters.filter((item) => !item).length;
    return `<section class="screen">${header()}<div class="encounter-stage"><p class="encounter-count">${remaining ? `${remaining} encounter${remaining === 1 ? "" : "s"} remaining` : "All encounters revealed"}</p>
      <div class="encounter-list">${encounters.map((id, index) => {
        if (!id) return `<button class="encounter-card mystery" type="button" data-encounter="${index}" aria-label="Reveal encounter ${index + 1}"><span class="encounter-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="encounter-copy"><strong>Unknown encounter</strong><small>Tap to reveal</small></span><span class="encounter-number">${index + 1}</span></button>`;
        const mon = mons[id];
        return `<article class="encounter-card revealed" data-mon-tip="${id}"><span class="encounter-sprite"><img class="sprite" src="${sprite(id)}" alt="${mon.name}"/></span><span class="encounter-copy"><strong>${mon.name}</strong><span class="encounter-types">${mon.types.map((type) => `<span class="type-chip ${type.toLowerCase()}">${type}</span>`).join("")}</span></span><span class="encounter-status">Added to PC</span></article>`;
      }).join("")}</div>
      ${backButton()}
    </div></section>`;
  }

  function backButton() {
    return '<button class="gloss-button purple page-back" data-route="home">back</button>';
  }

  const shopItems = [
    { id: "hp-up", group: "Training Items", name: "HP Up", detail: "+10 HP EVs", price: 100, icon: "HP" },
    { id: "protein", group: "Training Items", name: "Protein", detail: "+10 Attack EVs", price: 100, icon: "ATK" },
    { id: "iron", group: "Training Items", name: "Iron", detail: "+10 Defense EVs", price: 100, icon: "DEF" },
    { id: "calcium", group: "Training Items", name: "Calcium", detail: "+10 Sp. Atk EVs", price: 100, icon: "SPA" },
    { id: "zinc", group: "Training Items", name: "Zinc", detail: "+10 Sp. Def EVs", price: 100, icon: "SPD" },
    { id: "carbos", group: "Training Items", name: "Carbos", detail: "+10 Speed EVs", price: 100, icon: "SPE" },
    { id: "bottle-cap", group: "Training Items", name: "Bottle Cap", detail: "Maximize one IV", price: 500, icon: "IV" },
    { id: "nature-mint", group: "Training Items", name: "Nature Mint", detail: "Choose a stat nature", price: 300, icon: "N" },
    { id: "leftovers", group: "Held Items", name: "Leftovers", detail: "Restores HP each turn", price: 600, icon: "LF" },
    { id: "sitrus-berry", group: "Held Items", name: "Sitrus Berry", detail: "Restores HP when low", price: 300, icon: "SB" },
    { id: "focus-sash", group: "Held Items", name: "Focus Sash", detail: "Survive one hit from full HP", price: 800, icon: "FS" },
    { id: "choice-scarf", group: "Held Items", name: "Choice Scarf", detail: "Boosts Speed; locks one move", price: 700, icon: "CS" },
    { id: "tm-flamethrower", group: "TMs", name: "Flamethrower", detail: "Teach Flamethrower", price: 500, icon: "TM" },
    { id: "tm-thunderbolt", group: "TMs", name: "Thunderbolt", detail: "Teach Thunderbolt", price: 500, icon: "TM" },
    { id: "tm-ice-beam", group: "TMs", name: "Ice Beam", detail: "Teach Ice Beam", price: 500, icon: "TM" },
    { id: "tm-earthquake", group: "TMs", name: "Earthquake", detail: "Teach Earthquake", price: 700, icon: "TM" },
  ];
  const itemGroupOrder = ["Held Items", "Training Items", "TMs"];
  const natureOptions = [
    { name: "Adamant", up: "Atk", down: "SpA" }, { name: "Brave", up: "Atk", down: "Spe" },
    { name: "Bold", up: "Def", down: "Atk" }, { name: "Impish", up: "Def", down: "SpA" },
    { name: "Modest", up: "SpA", down: "Atk" }, { name: "Quiet", up: "SpA", down: "Spe" },
    { name: "Calm", up: "SpD", down: "Atk" }, { name: "Careful", up: "SpD", down: "SpA" },
    { name: "Timid", up: "Spe", down: "Atk" }, { name: "Jolly", up: "Spe", down: "SpA" },
  ];

  function itemIcon(item) {
    const iconClass = item.group === "Held Items" ? "held" : item.group === "TMs" ? "tm" : "training";
    return `<span class="item-icon ${iconClass}" aria-hidden="true">${item.icon}</span>`;
  }

  function pcItemPanel(mon) {
    if (pendingPcItemId === "nature-mint") {
      return `<section class="pc-item-chooser nature-chooser" aria-labelledby="pc-item-heading"><h3 id="pc-item-heading">Choose a nature</h3><p>Current nature: ${mon.nature}</p><div class="nature-options">${natureOptions.map((nature) => `<button class="${selectedNature === nature.name ? "selected" : ""}" type="button" data-select-nature="${nature.name}"><strong>${nature.name}</strong><small><span>+${nature.up}</span> / <i>−${nature.down}</i></small></button>`).join("")}</div><button class="gloss-button blue pc-item-confirm" type="button" data-apply-nature ${selectedNature ? "" : "disabled"}>use mint</button></section>`;
    }
    if (pendingPcItemId?.startsWith("tm-")) {
      const item = shopItems.find((candidate) => candidate.id === pendingPcItemId);
      return `<section class="pc-item-chooser move-replace-chooser" aria-labelledby="pc-item-heading"><h3 id="pc-item-heading">Teach ${item.name}</h3><p>Choose a move for ${mon.name} to forget.</p><div class="move-replace-grid">${mon.moves.map((move, index) => `<button type="button" data-replace-move="${index}">${move}</button>`).join("")}</div></section>`;
    }
    const ownedItems = shopItems.filter((item) => item.group === activePcItemGroup && inventory[item.id]);
    const activeGroupIndex = itemGroupOrder.indexOf(activePcItemGroup);
    const activeTabId = `pc-item-tab-${activePcItemGroup.toLowerCase().replaceAll(" ", "-")}`;
    const rows = ownedItems.length ? ownedItems.map((item) => {
      const action = item.group === "Held Items" ? "give" : item.group === "TMs" ? "teach" : "use";
      return `<div class="pc-item-row">${itemIcon(item)}<span class="item-copy"><strong>${item.name}</strong><small>${item.detail}</small></span><span class="item-quantity">×${inventory[item.id]}</span><button class="item-action" type="button" data-pc-item="${item.id}">${action}</button></div>`;
    }).join("") : `<div class="pc-item-empty"><strong>No items</strong><span>This category is empty.</span></div>`;
    return `<section class="pc-item-chooser" aria-labelledby="pc-item-heading"><h3 id="pc-item-heading">Use item on ${mon.name}</h3><div class="shop-segments pc-item-segments" data-active-index="${activeGroupIndex}" role="tablist" aria-label="Item categories">${itemGroupOrder.map((group) => { const selected = group === activePcItemGroup; return `<button id="pc-item-tab-${group.toLowerCase().replaceAll(" ", "-")}" type="button" role="tab" aria-selected="${selected}" data-pc-item-group="${group}" class="${selected ? "selected" : ""}">${group}</button>`; }).join("")}</div><div class="pc-item-list" role="tabpanel" aria-labelledby="${activeTabId}">${rows}</div></section>`;
  }

  function consumeItem(id) {
    inventory[id] -= 1;
    if (inventory[id] <= 0) delete inventory[id];
  }

  function shopRows() {
    return shopItems.filter((item) => item.group === activeShopGroup).map((item) => {
      const owned = inventory[item.id] || 0;
      return `<div class="shop-item">${itemIcon(item)}<span class="item-copy"><strong>${item.name}</strong><small>${item.detail}${owned ? ` · Owned: ${owned}` : ""}</small></span><button class="price-button" type="button" data-buy="${item.id}" ${balance < item.price ? "disabled" : ""}>${item.price} coins</button></div>`;
    }).join("");
  }

  function mart() {
    const activeGroupIndex = itemGroupOrder.indexOf(activeShopGroup);
    const activeTabId = `shop-tab-${activeShopGroup.toLowerCase().replaceAll(" ", "-")}`;
    return `<section class="screen">${header()}<div class="mart-stage"><div class="mart-summary"><p class="purchase-message" aria-live="polite">${purchaseMessage}</p><p class="balance">Balance: <strong>${balance.toLocaleString()} coins</strong></p></div>
      <div class="shop-segments" data-active-index="${activeGroupIndex}" role="tablist" aria-label="Mart categories">${itemGroupOrder.map((group) => { const selected = group === activeShopGroup; return `<button id="shop-tab-${group.toLowerCase().replaceAll(" ", "-")}" type="button" role="tab" aria-selected="${selected}" data-shop-group="${group}" class="${selected ? "selected" : ""}">${group}</button>`; }).join("")}</div>
      <div class="shop-list" id="shop-items" role="tabpanel" aria-labelledby="${activeTabId}">${shopRows()}</div>${backButton()}</div></section>`;
  }

  function bagContents() {
    const ownedItems = shopItems.filter((item) => item.group === activeBagGroup && inventory[item.id]);
    return ownedItems.length ? `<div class="bag-list">${ownedItems.map((item) => {
      const action = item.group === "Held Items" ? "give" : item.group === "TMs" ? "teach" : "use";
      return `<div class="bag-item">${itemIcon(item)}<span class="item-copy"><strong>${item.name}</strong><small>${item.detail}</small></span><span class="item-quantity" aria-label="${inventory[item.id]} owned">×${inventory[item.id]}</span><button class="item-action" type="button" aria-label="${action} ${item.name}">${action}</button></div>`;
    }).join("")}</div>` : `<div class="bag-empty"><h2>No items</h2><p>Items in this category will appear here.</p><button class="gloss-button blue" type="button" data-visit-mart="${activeBagGroup}">visit mart</button></div>`;
  }

  function bag() {
    const total = shopItems.reduce((sum, item) => sum + (inventory[item.id] || 0), 0);
    const activeGroupIndex = itemGroupOrder.indexOf(activeBagGroup);
    const activeTabId = `bag-tab-${activeBagGroup.toLowerCase().replaceAll(" ", "-")}`;
    return `<section class="screen">${header()}<div class="bag-stage"><div class="bag-summary"><span>${total} item${total === 1 ? "" : "s"}</span><span>${balance.toLocaleString()} coins</span></div>
      <div class="shop-segments bag-segments" data-active-index="${activeGroupIndex}" role="tablist" aria-label="Bag categories">${itemGroupOrder.map((group) => { const selected = group === activeBagGroup; return `<button id="bag-tab-${group.toLowerCase().replaceAll(" ", "-")}" type="button" role="tab" aria-selected="${selected}" data-bag-group="${group}" class="${selected ? "selected" : ""}">${group}</button>`; }).join("")}</div>
      <div class="bag-contents" role="tabpanel" aria-labelledby="${activeTabId}">${bagContents()}</div>${backButton()}</div></section>`;
  }

  function simpleScreen(kind) {
    const content = kind === "leaderboard"
        ? '<h2>Leaderboard</h2><p>Coming soon.</p>'
        : '<h2>Settings</h2><p>Game, sound, and accessibility options will appear here.</p>';
    return `<section class="screen">${header()}<div class="simple-stage">${content}${backButton()}</div></section>`;
  }

  function render() {
    const currentLog = document.querySelector("[data-battle-log]");
    if (currentLog) {
      battleLogScrollTop = currentLog.scrollTop;
      battleLogFollow = currentLog.scrollHeight - currentLog.scrollTop - currentLog.clientHeight < 24;
      if (battleLogFollow) battleLogHasNew = false;
    }
    hideTooltip();
    const screens = { home, lead, battle, pc, bag, encounters: encountersScreen, mart };
    app.innerHTML = screens[route] ? screens[route]() : simpleScreen(route);
    bind();
  }

  function monTip(id) {
    const mon = mons[id];
    return `<div class="tip-head">${mon.name}<span class="tip-types">${mon.types.map((type) => `<i class="type-chip ${type.toLowerCase()}">${type}</i>`).join("")}</span></div><div class="tip-row">HP: ${mon.hp}</div><div class="tip-row">Ability: ${mon.ability} / Item: ${mon.item}</div><div class="tip-row">${mon.stats}</div><div class="tip-row">${mon.moves.map((move) => `• ${move}`).join("<br>")}</div>`;
  }

  function moveTip(id) {
    const move = moves[id];
    return `<div class="tip-head">${move.name}<span class="tip-types"><i class="type-chip ${move.type.toLowerCase()}">${move.type}</i></span></div><div class="tip-row">Base power: <strong>${move.power}</strong><br>Accuracy: <strong>${move.accuracy}</strong></div><div class="tip-row">${move.description}</div><div class="tip-row">△ <strong>${move.effectiveness}</strong></div>`;
  }

  function battleMoveTip(slot) {
    const move = battleState?.moves.find((candidate) => candidate.slot === Number(slot));
    if (!move) return "";
    const power = move.power ?? "—";
    const accuracy = move.accuracy == null ? "—" : `${move.accuracy}%`;
    return `<div class="tip-head">${escapeHtml(move.name)}<span class="tip-types"><i class="type-chip ${move.type.toLowerCase()}">${escapeHtml(move.type)}</i></span></div><div class="tip-row">Base power: <strong>${power}</strong><br>Accuracy: <strong>${accuracy}</strong></div><div class="tip-row">${escapeHtml(move.description)}</div>`;
  }

  function alignOpponentSprite() {
    const arena = document.querySelector(".battle-arena");
    const platform = arena?.querySelector(".battle-platform.enemy");
    const slot = arena?.querySelector(".battler-slot.enemy");
    const image = slot?.querySelector(".active-sprite");
    if (!arena || !platform || !slot || !image) return;
    if (!image.complete || !image.naturalWidth) {
      image.addEventListener("load", alignOpponentSprite, { once: true });
      return;
    }
    const arenaRect = arena.getBoundingClientRect();
    const platformRect = platform.getBoundingClientRect();
    const spriteSize = Math.min(180, arenaRect.width * .46) * .87;
    const anchorX = platformRect.left - arenaRect.left + platformRect.width / 2;
    const anchorY = platformRect.bottom - arenaRect.top - platformRect.height * .1 + 16;
    image.style.setProperty("--foe-sprite-size", `${spriteSize}px`);
    image.style.setProperty("--foe-sprite-left", `${anchorX - spriteSize / 2}px`);
    image.style.setProperty("--foe-sprite-top", `${anchorY - spriteSize}px`);
    slot.classList.add("is-aligned");
  }

  function showTooltip(target, html) {
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    const rect = target.getBoundingClientRect();
    const tip = tooltip.getBoundingClientRect();
    const left = Math.max(10, Math.min(innerWidth - tip.width - 10, rect.left));
    const top = rect.top > tip.height + 10 ? rect.top - tip.height - 6 : Math.min(innerHeight - tip.height - 10, rect.bottom + 6);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(10, top)}px`;
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function addInfoInteractions(element, html) {
    let timer = null;
    let held = false;
    const start = (event) => {
      held = false;
      timer = setTimeout(() => {
        held = true;
        element.dataset.held = "true";
        element.classList.add("hold-active");
        showTooltip(element, html());
        if (navigator.vibrate) navigator.vibrate(18);
      }, 430);
      if (event.pointerType === "mouse") showTooltip(element, html());
    };
    const end = () => {
      clearTimeout(timer);
      element.classList.remove("hold-active");
      if (held) setTimeout(hideTooltip, 90);
    };
    element.addEventListener("pointerdown", start);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
    element.addEventListener("pointerleave", () => { clearTimeout(timer); if (!held) hideTooltip(); });
    element.addEventListener("mouseenter", () => showTooltip(element, html()));
    element.addEventListener("mouseleave", hideTooltip);
    element.addEventListener("click", (event) => {
      if (element.dataset.held === "true") {
        event.preventDefault();
        event.stopImmediatePropagation();
        delete element.dataset.held;
      }
    }, true);
  }

  function bind() {
    alignOpponentSprite();
    document.querySelector("[data-toggle-theme]")?.addEventListener("click", (event) => {
      theme = theme === "dark" ? "light" : "dark";
      localStorage.setItem("nuzzleTheme", theme);
      event.currentTarget.setAttribute("aria-checked", String(theme === "dark"));
      event.currentTarget.setAttribute("aria-label", `Use ${theme === "dark" ? "light" : "dark"} mode`);
      applyTheme();
    });
    document.querySelector("[data-open-account]")?.addEventListener("click", () => {
      resetAvatarEditor();
      authOpen = true;
      authMode = "login";
      authError = "";
      pendingRoute = null;
      render();
      requestAnimationFrame(() => document.querySelector(currentUser ? "[data-logout]" : "#auth-username")?.focus({ preventScroll: true }));
    });
    document.querySelectorAll("[data-close-auth]").forEach((element) => element.addEventListener("click", (event) => {
      if (element.classList.contains("auth-backdrop") && event.target !== element) return;
      authOpen = false;
      resetAvatarEditor();
      pendingRoute = null;
      render();
    }));
    document.querySelector("[data-auth-mode]")?.addEventListener("click", (event) => {
      authMode = event.currentTarget.dataset.authMode;
      authError = "";
      render();
      requestAnimationFrame(() => document.querySelector("#auth-username")?.focus({ preventScroll: true }));
    });
    document.querySelector("[data-auth-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitAuth(event.currentTarget);
    });
    document.querySelector("[data-logout]")?.addEventListener("click", () => void logout());
    document.querySelectorAll("[data-edit-avatar]").forEach((button) => button.addEventListener("click", () => {
      avatarEditorOpen = true;
      authError = "";
      render();
      requestAnimationFrame(() => document.querySelector("[data-avatar-choose]")?.focus({ preventScroll: true }));
    }));
    document.querySelector("[data-avatar-choose]")?.addEventListener("click", () => document.querySelector("[data-avatar-input]")?.click());
    document.querySelector("[data-avatar-input]")?.addEventListener("change", (event) => {
      const [file] = event.currentTarget.files;
      if (file) void prepareAvatar(file);
    });
    document.querySelector("[data-avatar-save]")?.addEventListener("click", () => void saveAvatar());
    document.querySelector("[data-avatar-remove]")?.addEventListener("click", () => void removeAvatar());
    document.querySelector("[data-avatar-cancel]")?.addEventListener("click", () => {
      resetAvatarEditor();
      render();
      requestAnimationFrame(() => document.querySelector("[data-edit-avatar]")?.focus({ preventScroll: true }));
    });
    document.querySelectorAll("[data-route]").forEach((button) => button.addEventListener("click", () => {
      const requestedRoute = button.dataset.route;
      if (!currentUser && requestedRoute !== "home") {
        openAuth(requestedRoute);
        return;
      }
      route = requestedRoute === "lead" && battleState && !battleState.ended ? "battle" : requestedRoute;
      if (route === "lead") selectedLeadId = null;
      if (route === "mart") purchaseMessage = "";
      render();
      scrollTo(0, 0);
    }));
    document.querySelectorAll("[data-select-lead]").forEach((button) => button.addEventListener("click", () => {
      selectedLeadId = button.dataset.selectLead;
      document.querySelectorAll("[data-select-lead]").forEach((choice) => {
        const selected = choice.dataset.selectLead === selectedLeadId;
        choice.classList.toggle("selected", selected);
        choice.setAttribute("aria-pressed", String(selected));
      });
      document.querySelector("[data-start-battle]")?.removeAttribute("disabled");
    }));
    document.querySelector("[data-start-battle]")?.addEventListener("click", startBattle);
    document.querySelectorAll("[data-battle-switch]").forEach((button) => button.addEventListener("click", () => submitBattleChoice({ type: "switch", slot: Number(button.dataset.battleSwitch) })));
    document.querySelectorAll("[data-battle-move]").forEach((button) => button.addEventListener("click", () => submitBattleChoice({ type: "move", slot: Number(button.dataset.battleMove) })));
    document.querySelector("[data-forfeit-battle]")?.addEventListener("click", forfeitBattle);
    document.querySelector("[data-toggle-battle-log]")?.addEventListener("click", () => {
      battleLogExpanded = !battleLogExpanded;
      render();
      requestAnimationFrame(() => document.querySelector("[data-toggle-battle-log]")?.focus());
    });
    const battleLog = document.querySelector("[data-battle-log]");
    if (battleLog) {
      battleLog.addEventListener("scroll", () => {
        battleLogScrollTop = battleLog.scrollTop;
        battleLogFollow = battleLog.scrollHeight - battleLog.scrollTop - battleLog.clientHeight < 24;
        if (battleLogFollow) battleLogHasNew = false;
      }, { passive: true });
      requestAnimationFrame(() => {
        battleLog.scrollTop = battleLogFollow ? battleLog.scrollHeight : battleLogScrollTop;
        const newRows = battleLog.querySelectorAll(".battle-log-row.is-new");
        if (battleLogFollow && newRows.length) {
          const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260 + Math.min(newRows.length - 1, 7) * 38;
          const started = performance.now();
          const followAnimation = (now) => {
            if (!battleLogFollow) return;
            battleLog.scrollTop = battleLog.scrollHeight;
            if (now - started < duration) requestAnimationFrame(followAnimation);
          };
          requestAnimationFrame(followAnimation);
        }
      });
    }
    document.querySelector("[data-battle-log-new]")?.addEventListener("click", () => {
      const log = document.querySelector("[data-battle-log]");
      if (!log) return;
      battleLogFollow = true;
      battleLogHasNew = false;
      log.scrollTop = log.scrollHeight;
      render();
    });
    document.querySelectorAll("[data-encounter]").forEach((button) => button.addEventListener("click", () => { const index = Number(button.dataset.encounter); if (!encounters[index]) { encounters[index] = encounterIds[index]; if (!pcOrder.includes(encounterIds[index])) pcOrder.push(encounterIds[index]); render(); } }));
    const bindShopPurchases = () => document.querySelectorAll("[data-buy]").forEach((button) => button.addEventListener("click", () => {
      const item = shopItems.find((candidate) => candidate.id === button.dataset.buy);
      if (!item) return;
      if (balance >= item.price) {
        const shopScroll = document.querySelector(".shop-list")?.scrollTop || 0;
        balance -= item.price;
        inventory[item.id] = (inventory[item.id] || 0) + 1;
        purchaseMessage = `${item.name} added to your bag.`;
        render();
        const shopList = document.querySelector(".shop-list");
        if (shopList) shopList.scrollTop = shopScroll;
      }
    }));
    document.querySelectorAll("[data-shop-group]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.shopGroup === activeShopGroup) return;
      activeShopGroup = button.dataset.shopGroup;
      purchaseMessage = "";
      document.querySelector(".purchase-message").textContent = "";
      document.querySelector(".shop-segments").dataset.activeIndex = itemGroupOrder.indexOf(activeShopGroup);
      document.querySelectorAll("[data-shop-group]").forEach((tab) => {
        const selected = tab.dataset.shopGroup === activeShopGroup;
        tab.classList.toggle("selected", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
      const shopList = document.querySelector(".shop-list");
      shopList.setAttribute("aria-labelledby", button.id);
      shopList.innerHTML = shopRows();
      bindShopPurchases();
    }));
    bindShopPurchases();
    const bindVisitMart = () => document.querySelector("[data-visit-mart]")?.addEventListener("click", (event) => {
      activeShopGroup = event.currentTarget.dataset.visitMart;
      purchaseMessage = "";
      route = "mart";
      render();
      scrollTo(0, 0);
    });
    document.querySelectorAll("[data-bag-group]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.bagGroup === activeBagGroup) return;
      activeBagGroup = button.dataset.bagGroup;
      const segments = document.querySelector(".bag-segments");
      segments.dataset.activeIndex = itemGroupOrder.indexOf(activeBagGroup);
      document.querySelectorAll("[data-bag-group]").forEach((tab) => {
        const selected = tab.dataset.bagGroup === activeBagGroup;
        tab.classList.toggle("selected", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
      const bagPanel = document.querySelector(".bag-contents");
      bagPanel.setAttribute("aria-labelledby", button.id);
      bagPanel.innerHTML = bagContents();
      bindVisitMart();
    }));
    bindVisitMart();
    document.querySelectorAll("[data-pc-detail]").forEach((button) => button.addEventListener("click", () => { selectedPcId = button.dataset.pcDetail; pcSwapMode = false; pcItemMode = false; pendingPcItemId = null; selectedNature = null; pcItemMessage = ""; render(); }));
    document.querySelectorAll("[data-close-pc-sheet]").forEach((element) => element.addEventListener("click", (event) => {
      if (element.classList.contains("sheet-backdrop") && event.target !== element) return;
      selectedPcId = null;
      pcSwapMode = false;
      pcItemMode = false;
      pendingPcItemId = null;
      selectedNature = null;
      render();
    }));
    document.querySelector("[data-open-pc-items]")?.addEventListener("click", () => {
      pcSwapMode = false;
      pcItemMode = true;
      pendingPcItemId = null;
      selectedNature = null;
      pcItemMessage = "";
      render();
    });
    document.querySelectorAll("[data-pc-item-group]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.pcItemGroup === activePcItemGroup) return;
      activePcItemGroup = button.dataset.pcItemGroup;
      render();
    }));
    document.querySelectorAll("[data-pc-item]").forEach((button) => button.addEventListener("click", () => {
      const item = shopItems.find((candidate) => candidate.id === button.dataset.pcItem);
      if (!item || !inventory[item.id]) return;
      if (item.id === "nature-mint" || item.group === "TMs") {
        pendingPcItemId = item.id;
        selectedNature = null;
        render();
        return;
      }
      if (item.group === "Held Items") mons[selectedPcId].item = item.name;
      consumeItem(item.id);
      pcItemMessage = item.group === "Held Items" ? `${mons[selectedPcId].name} is now holding ${item.name}.` : `${item.name} used on ${mons[selectedPcId].name}.`;
      pcItemMode = false;
      render();
    }));
    document.querySelectorAll("[data-select-nature]").forEach((button) => button.addEventListener("click", () => {
      selectedNature = button.dataset.selectNature;
      render();
    }));
    document.querySelector("[data-apply-nature]")?.addEventListener("click", () => {
      const nature = natureOptions.find((option) => option.name === selectedNature);
      if (!nature || !inventory["nature-mint"]) return;
      Object.assign(mons[selectedPcId], { nature: nature.name, natureUp: nature.up, natureDown: nature.down });
      consumeItem("nature-mint");
      pcItemMessage = `${mons[selectedPcId].name}'s nature changed to ${nature.name}.`;
      pcItemMode = false;
      pendingPcItemId = null;
      selectedNature = null;
      render();
    });
    document.querySelectorAll("[data-replace-move]").forEach((button) => button.addEventListener("click", () => {
      const item = shopItems.find((candidate) => candidate.id === pendingPcItemId);
      if (!item || !inventory[item.id]) return;
      mons[selectedPcId].moves[Number(button.dataset.replaceMove)] = item.name;
      consumeItem(item.id);
      pcItemMessage = `${mons[selectedPcId].name} learned ${item.name}.`;
      pcItemMode = false;
      pendingPcItemId = null;
      render();
    }));
    document.querySelector("[data-team-toggle]")?.addEventListener("click", (event) => {
      const id = event.currentTarget.dataset.teamToggle;
      if (team.has(id)) {
        team.delete(id);
        selectedPcId = null;
        pcSwapMode = false;
        pcItemMode = false;
        pendingPcItemId = null;
        selectedNature = null;
      }
      else if (team.size < 6) team.add(id);
      else pcSwapMode = true;
      render();
    });
    document.querySelectorAll("[data-team-replace]").forEach((button) => button.addEventListener("click", () => {
      const outgoingId = button.dataset.teamReplace;
      team = new Set([...team].map((id) => id === outgoingId ? selectedPcId : id));
      pcSwapMode = false;
      render();
    }));
    document.querySelector("[data-cancel-pc-swap]")?.addEventListener("click", () => {
      pcSwapMode = false;
      render();
    });
    document.querySelector("[data-cancel-pc-items]")?.addEventListener("click", () => {
      pcItemMode = false;
      pendingPcItemId = null;
      selectedNature = null;
      render();
    });
    document.querySelectorAll("[data-mon-tip]").forEach((element) => addInfoInteractions(element, () => monTip(element.dataset.monTip)));
    document.querySelectorAll("[data-move-tip]").forEach((element) => addInfoInteractions(element, () => moveTip(element.dataset.moveTip)));
    document.querySelectorAll("[data-battle-move-tip]").forEach((element) => addInfoInteractions(element, () => battleMoveTip(element.dataset.battleMoveTip)));
    document.onkeydown = (event) => {
      if (event.key === "Escape" && authOpen) {
        authOpen = false;
        resetAvatarEditor();
        pendingRoute = null;
        render();
        requestAnimationFrame(() => document.querySelector("[data-open-account]")?.focus());
      } else if (event.key === "Escape" && battleLogExpanded) {
        battleLogExpanded = false;
        render();
        requestAnimationFrame(() => document.querySelector("[data-toggle-battle-log]")?.focus());
      } else if (event.key === "Escape" && selectedPcId) {
        if (pcSwapMode) pcSwapMode = false;
        else if (pcItemMode) { pcItemMode = false; pendingPcItemId = null; selectedNature = null; }
        else selectedPcId = null;
        render();
      }
    };
    bindPcDrag();
  }

  function bindPcDrag() {
    document.querySelectorAll("[data-pc-mon]").forEach((element) => {
      let holdTimer;
      let dragArmed = false;
      let moved = false;
      element.addEventListener("pointerdown", (event) => {
        element.setPointerCapture?.(event.pointerId);
        holdTimer = setTimeout(() => {
          dragArmed = true;
          element.classList.add("dragging");
        }, 430);
      });
      element.addEventListener("pointermove", (event) => {
        if (!dragArmed) return;
        event.preventDefault();
        hideTooltip();
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-pc-mon]");
        if (!target || target === element) return;
        const sourceId = element.dataset.pcMon;
        const targetId = target.dataset.pcMon;
        const from = pcOrder.indexOf(sourceId);
        const to = pcOrder.indexOf(targetId);
        pcOrder.splice(to, 0, pcOrder.splice(from, 1)[0]);
        target.parentElement.insertBefore(element, to > from ? target.nextSibling : target);
        moved = true;
      });
      element.addEventListener("pointerup", () => {
        clearTimeout(holdTimer);
        if (dragArmed || moved) element.dataset.held = "true";
        dragArmed = false;
        moved = false;
        element.classList.remove("dragging");
      });
      element.addEventListener("pointercancel", () => { clearTimeout(holdTimer); dragArmed = false; element.classList.remove("dragging"); });
      element.addEventListener("click", () => {
        if (element.dataset.held || dragArmed) { delete element.dataset.held; dragArmed = false; return; }
        selectedPcId = element.dataset.pcMon;
        pcSwapMode = false;
        pcItemMode = false;
        pendingPcItemId = null;
        selectedNature = null;
        pcItemMessage = "";
        render();
      });
    });
  }

  async function resumeBattle(shouldRender = true) {
    if (!currentUser) return;
    const battleId = localStorage.getItem("nuzzleBattleId");
    if (!battleId) return;
    try {
      acceptBattleState(await apiRequest(`/api/battles/${battleId}`));
      if (!battleState.ended) route = "battle";
    } catch (error) {
      localStorage.removeItem("nuzzleBattleId");
      battleError = error.message;
    }
    if (shouldRender) render();
  }

  async function loadSession() {
    try {
      const result = await apiRequest("/api/auth/me");
      currentUser = result.user;
      if (currentUser) await resumeBattle(false);
    } catch {
      currentUser = null;
    }
    render();
  }

  applyTheme();
  render();
  window.addEventListener("resize", alignOpponentSprite);
  void loadSession();
})();
