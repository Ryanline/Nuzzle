(function () {
  "use strict";

  const toId = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const sprite = (id, back = false, currentSpriteId = null, shiny = null) => {
    const speciesId = mons[id]?.speciesId || id;
    const isShiny = shiny ?? Boolean(mons[id]?.shiny);
    const spriteId = currentSpriteId || mons[id]?.spriteId || pokemonContent.get(speciesId)?.spriteId || speciesId;
    const directory = isShiny ? (back ? "gen5-back-shiny" : "gen5-shiny") : (back ? "gen5-back" : "gen5");
    return `assets/showdown/${directory}/${encodeURIComponent(spriteId)}.png`;
  };
  let spriteBounds = {};
  const spriteBoundsReady = fetch("assets/showdown/sprite-bounds.json", { cache: "force-cache" })
    .then((response) => response.ok ? response.json() : {})
    .catch(() => ({}))
    .then((bounds) => {
      spriteBounds = bounds;
      requestAnimationFrame(alignBattleSprites);
      return bounds;
    });
  const healthTone = (percent) => percent <= 20 ? "critical" : percent <= 50 ? "warning" : "healthy";
  const trainerSprite = (id = "brock") => id === "brock"
    ? "assets/trainers/brock.png"
    : `assets/showdown/trainers/${encodeURIComponent(id)}.png`;
  const mysteryTrainerSprite = "assets/trainers/mystery.png";
  const defaultAccountAvatarId = "unknownf";
  const app = document.querySelector("#app");
  const tooltip = document.querySelector("#tooltip");
  const savedTheme = localStorage.getItem("nuzzleTheme");

  let mons = {
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

  const fallbackToday = {
    date: "2026-10-22",
    number: 1,
    trainer: {
      name: "Brock",
      spriteId: "brock",
      pokemon: ["steelix", "golem", "rhyperior", "aerodactyl", "sudowoodo", "magcargo"].map((id) => ({ id, name: id, spriteId: id })),
    },
  };
  const partyIds = ["flareon", "raichu", "vaporeon", "gengar", "venusaur", "pidgeot"];
  const pcIds = [...partyIds, "arcanine", "lapras", "alakazam", "machamp", "nidoking", "exeggutor"];
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
  let welcomeOpen = false;
  let welcomeLoading = false;
  let welcomeError = "";
  let avatarPickerOpen = false;
  let avatarSprites = [];
  let avatarLoading = false;
  let avatarSaving = false;
  let avatarError = "";
  let avatarQuery = "";
  let pendingRoute = null;
  let theme = savedTheme === "dark" ? "dark" : "light";
  let gameState = null;
  let contentLoaded = false;
  let pokemonContent = new Map();
  let team = new Set(partyIds);
  let pcOrder = [...pcIds];
  let encounters = [];
  let encountersRevealedThisVisit = new Set();
  let encounterListScrollTop = 0;
  let battleState = null;
  let battleLoading = false;
  let battleError = "";
  let battleLogExpanded = false;
  let battleLogFollow = true;
  let battleLogScrollTop = 0;
  let battleLogHasNew = false;
  let battleLogInitialized = false;
  let battleLogRenderedIds = new Set();
  let resultOverlayOpen = false;
  let balance = 50000;
  let selectedPcId = null;
  let selectedTrainerPokemon = null;
  let pcDetailView = "summary";
  let pcSummaryMoveId = null;
  let pcSwapMode = false;
  let pcItemMode = false;
  let activePcItemGroup = "Held Items";
  let pendingPcItemId = null;
  let selectedNature = null;
  let pcItemMessage = "";
  let trainingDraft = null;
  let trainingMoveSlot = null;
  let trainingMoveSearch = "";
  let trainingMessage = "";
  let trainingTransactionKey = null;
  let selectedLeadId = null;
  let gameBusy = false;
  let purchaseMessage = "";
  let activeShopGroup = "Held Items";
  let martSearch = "";
  let martSheetItemId = null;
  let martSheetMode = null;
  let martListScrollTop = 0;
  let activeBagGroup = "Held Items";
  let bagSearch = "";
  let inventory = {};
  let todayState = fallbackToday;
  let rolloverTimer = null;
  let countdownTimer = null;
  let adminConfig = null;
  let configBusy = false;
  let configError = "";
  let battleResetBusy = false;
  let battleResetMessage = "";
  let wipeMeBusy = false;
  let wipeMeMessage = "";
  let moreCardOpen = null;
  let leaderboardView = "daily";
  let leaderboardData = null;
  let leaderboardLoading = false;
  let leaderboardError = "";
  let trainerFormOpen = false;
  const emptyTrainerDraft = () => ({ name: "", spriteId: "", teamText: "" });
  let trainerDraft = emptyTrainerDraft();

  function trainerDraftStorageKey() {
    return currentUser?.id ? `nuzzleTrainerDraft:${currentUser.id}` : null;
  }

  function loadTrainerDraft() {
    trainerDraft = emptyTrainerDraft();
    const key = trainerDraftStorageKey();
    if (!key) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (!saved || typeof saved !== "object") return;
      trainerDraft = {
        name: String(saved.name || "").slice(0, 40),
        spriteId: String(saved.spriteId || ""),
        teamText: String(saved.teamText || ""),
      };
    } catch {}
  }

  function saveTrainerDraft() {
    const key = trainerDraftStorageKey();
    if (key) localStorage.setItem(key, JSON.stringify(trainerDraft));
  }

  function clearTrainerDraft() {
    const key = trainerDraftStorageKey();
    if (key) localStorage.removeItem(key);
    trainerDraft = emptyTrainerDraft();
  }

  function applyGameState(nextState) {
    gameState = nextState;
    balance = nextState.money;
    inventory = { ...nextState.inventory };
    encounters = nextState.encounters || [];
    team = new Set(nextState.teamIds || []);
    pcOrder = nextState.roster.map((pokemon) => pokemon.id);
    mons = Object.fromEntries(nextState.roster.map((pokemon) => {
      const nature = natureOptions.find((option) => option.name === pokemon.nature) || {};
      return [pokemon.id, { ...pokemon, natureUp: nature.up || "", natureDown: nature.down || "" }];
    }));
  }

  async function loadContent() {
    if (contentLoaded) return;
    const result = await apiRequest("/api/content");
    shopItems = result.items;
    pokemonContent = new Map(result.pokemon.map((pokemon) => [pokemon.id, pokemon]));
    contentLoaded = true;
  }

  async function loadGame() {
    await loadContent();
    applyGameState(await apiRequest("/api/game"));
  }

  async function loadToday() {
    todayState = await apiRequest("/api/today");
    clearTimeout(rolloverTimer);
    const delay = Math.max(1000, Date.parse(todayState.nextRolloverAt) - Date.now() + 500);
    rolloverTimer = setTimeout(async () => {
      try {
        await loadToday();
        if (currentUser) await loadGame();
        render();
      } catch {}
    }, Math.min(delay, 2_147_000_000));
  }

  function countdownText() {
    const remaining = Math.max(0, Math.ceil((Date.parse(todayState.nextRolloverAt) - Date.now()) / 1000));
    if (!Number.isFinite(remaining)) return "--:--:--";
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  }

  function updateCountdown() {
    clearTimeout(countdownTimer);
    const output = document.querySelector("[data-rollover-countdown]");
    if (!output) return;
    output.textContent = countdownText();
    countdownTimer = setTimeout(updateCountdown, 1000 - (Date.now() % 1000) + 20);
  }

  async function loadLeaderboard() {
    if (!currentUser || leaderboardLoading) return;
    leaderboardLoading = true;
    leaderboardError = "";
    render();
    try {
      const [daily, streak] = await Promise.all([
        apiRequest("/api/leaderboard/daily"),
        apiRequest("/api/leaderboard/streak"),
      ]);
      leaderboardData = { ...daily, streakEntries: streak.entries };
    } catch (error) {
      leaderboardError = error.message;
    } finally {
      leaderboardLoading = false;
      render();
    }
  }

  async function loadAvatarSprites() {
    if (avatarSprites.length || avatarLoading) return;
    avatarLoading = true;
    avatarError = "";
    render();
    try {
      const result = await apiRequest("/api/account/avatars");
      avatarSprites = result.sprites || [];
    } catch (error) {
      avatarError = error.message;
    } finally {
      avatarLoading = false;
      render();
    }
  }

  async function selectAvatar(spriteId) {
    if (avatarSaving) return;
    avatarSaving = true;
    avatarError = "";
    render();
    try {
      const result = await apiRequest("/api/account/avatar", {
        method: "PUT",
        body: JSON.stringify({ spriteId: spriteId || null }),
      });
      currentUser = result.user;
      avatarPickerOpen = false;
      avatarQuery = "";
      if (leaderboardData) {
        const withAvatar = (entry) => entry.username.toLowerCase() === currentUser.username.toLowerCase()
          ? { ...entry, avatarSpriteId: currentUser.avatarSpriteId }
          : entry;
        leaderboardData = {
          ...leaderboardData,
          entries: (leaderboardData.entries || []).map(withAvatar),
          streakEntries: (leaderboardData.streakEntries || []).map(withAvatar),
        };
      }
    } catch (error) {
      avatarError = error.message;
    } finally {
      avatarSaving = false;
      render();
    }
  }

  async function loadAdminConfig() {
    if (!currentUser?.isAdmin) return;
    configBusy = true;
    configError = "";
    render();
    try {
      adminConfig = await apiRequest("/api/admin/trainers");
    } catch (error) {
      configError = error.message;
    } finally {
      configBusy = false;
      render();
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function avatarContent(user) {
    const source = trainerSprite(user?.avatarSpriteId || defaultAccountAvatarId);
    return `<img class="sprite" src="${source}" alt="">`;
  }

  function avatarChoices(query = avatarQuery) {
    const search = String(query).trim().toLowerCase();
    const selectableSprites = avatarSprites.filter((trainer) => trainer.id !== defaultAccountAvatarId);
    const matches = search
      ? selectableSprites.filter((trainer) => trainer.id.includes(search) || trainer.name.toLowerCase().includes(search))
      : selectableSprites;
    const defaultSelected = !currentUser?.avatarSpriteId || currentUser.avatarSpriteId === defaultAccountAvatarId;
    const defaultChoice = `<button class="avatar-choice${defaultSelected ? " selected" : ""}" type="button" data-avatar-sprite="" aria-label="Unknown trainer" aria-pressed="${defaultSelected}" title="Unknown trainer (default)"><img class="sprite" src="${trainerSprite(defaultAccountAvatarId)}" alt=""></button>`;
    const choices = matches.map((trainer) => {
      const selected = currentUser?.avatarSpriteId === trainer.id;
      return `<button class="avatar-choice${selected ? " selected" : ""}" type="button" data-avatar-sprite="${trainer.id}" aria-label="${escapeHtml(trainer.name)}" aria-pressed="${selected}" title="${escapeHtml(trainer.name)}"><img class="sprite" src="${trainerSprite(trainer.id)}" alt="" loading="lazy"></button>`;
    }).join("");
    return defaultChoice + choices + (matches.length ? "" : '<p class="avatar-empty">No matching avatars.</p>');
  }

  function resetAuthDialog() {
    authError = "";
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
    resetAuthDialog();
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
      welcomeOpen = !currentUser.welcomeSeen;
      welcomeError = "";
      loadTrainerDraft();
      authOpen = false;
      const destination = pendingRoute;
      pendingRoute = null;
      if (destination) {
        route = destination === "lead" && battleState && !battleState.ended ? "battle" : destination;
        if (route === "lead") selectedLeadId = null;
      }
      await loadGame();
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
      welcomeOpen = false;
      welcomeLoading = false;
      welcomeError = "";
      avatarPickerOpen = false;
      avatarSprites = [];
      avatarQuery = "";
      avatarError = "";
      trainerDraft = emptyTrainerDraft();
      trainerFormOpen = false;
      resetAuthDialog();
      battleState = null;
      resultOverlayOpen = false;
      gameState = null;
      encounters = [];
      encountersRevealedThisVisit = new Set();
      encounterListScrollTop = 0;
      mons = {};
      team = new Set();
      pcOrder = [];
      inventory = {};
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
    const justEnded = Boolean(battleState && battleState.id === nextState?.id && !battleState.ended && nextState?.ended);
    battleState = nextState;
    if (justEnded) {
      resultOverlayOpen = true;
      if (gameState?.dailyBattleId === nextState.id) gameState.dailyBattleEnded = true;
    }
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
      if (gameState) gameState.dailyBattleAttempted = true;
      if (gameState) {
        gameState.dailyBattleId = battleState.id;
        gameState.dailyBattleEnded = false;
      }
      resultOverlayOpen = false;
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
      if (battleState.ended) await loadGame();
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
      if (battleState.ended) await loadGame();
    } catch (error) {
      battleError = error.message;
    } finally {
      battleLoading = false;
      render();
    }
  }

  function title(includeDate = true) {
    const [year, month, day] = String(todayState.date).split("-");
    const name = `Nuzzle #${todayState.number}: ${todayState.trainer.name}`;
    return includeDate ? `${name} (${Number(month)}/${Number(day)}/${year})` : name;
  }

  function header() {
    const homeHeader = route === "home";
    const [year, month, day] = String(todayState.date).split("-");
    const accountLabel = currentUser ? `Account for ${currentUser.username}` : "Log in or create an account";
    const accountContent = currentUser ? avatarContent(currentUser) : '<span class="account-head"></span><span class="account-shoulders"></span>';
    const themeIcons = '<svg class="theme-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path></svg><svg class="theme-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 15.3A8.5 8.5 0 0 1 8.7 3.6 8.5 8.5 0 1 0 20.4 15.3Z"></path></svg>';
    const titleBlock = homeHeader
      ? `<div class="header-title-group"><h1 class="screen-title">Daily ${title(false)}</h1><p class="screen-meta"><time datetime="${todayState.date}">${Number(month)}/${Number(day)}/${year}</time><span aria-hidden="true"> - </span>next trainer in <b data-rollover-countdown>${countdownText()}</b></p></div>`
      : `<h1 class="screen-title">${title()}</h1>`;
    return `<header class="screen-header${homeHeader ? " home-header" : ""}">${titleBlock}<div class="header-tools"><button class="theme-toggle" type="button" role="switch" aria-checked="${theme === "dark"}" aria-label="Use ${theme === "dark" ? "light" : "dark"} mode" data-toggle-theme><i>${themeIcons}</i></button><button class="account-button${currentUser ? " signed-in" : ""}" type="button" aria-label="${accountLabel}" data-open-account><span class="account-glyph">${accountContent}</span></button></div></header>${authOpen ? authCard() : ""}`;
  }

  function navigation(current = "", className = "home-actions") {
    const currentClass = (name) => current === name ? " is-current" : "";
    const currentPage = (name) => current === name ? ' aria-current="page"' : "";
    const dailyBattleUsed = Boolean(currentUser && gameState?.dailyBattleAttempted && gameState?.dailyBattleId);
    const battleRoute = dailyBattleUsed ? "battle" : currentUser && gameState && !gameState.battleUnlocked ? "encounters" : "lead";
    return `<nav class="${className}" aria-label="Game sections">
      <button class="gloss-button red${currentClass("battle")}"${currentPage("battle")} data-route="${battleRoute}">${dailyBattleUsed ? gameState.dailyBattleEnded ? "View result" : "Resume battle" : "Battle"}</button>
      <button class="gloss-button orange${currentClass("pc")}"${currentPage("pc")} data-route="pc">PC box</button>
      <button class="gloss-button gold${currentClass("bag")}"${currentPage("bag")} data-route="bag">Bag</button>
      <button class="gloss-button green${currentClass("encounters")}"${currentPage("encounters")} data-route="encounters">Encounter (${encounters.filter((item) => !item.claimed).length})</button>
      <button class="gloss-button blue${currentClass("mart")}"${currentPage("mart")} data-route="mart">Mart</button>
      <button class="gloss-button purple${currentClass("leaderboard")}"${currentPage("leaderboard")} data-route="leaderboard">Leaderboard</button>
      <button class="gloss-button slate${currentClass("settings")}"${currentPage("settings")} data-route="settings">More</button>
    </nav>`;
  }

  function authCard() {
    if (currentUser && avatarPickerOpen) return `<div class="auth-backdrop" data-close-auth><section class="auth-card account-card avatar-picker-card" role="dialog" aria-modal="true" aria-labelledby="account-title"><button class="auth-close" type="button" aria-label="Close account" data-close-auth>×</button><div class="avatar-picker-head"><h2 id="account-title">Choose an avatar</h2><button type="button" data-cancel-avatar>Cancel</button></div><label class="avatar-search"><span>Find a trainer</span><input type="search" value="${escapeHtml(avatarQuery)}" placeholder="Type to narrow the list" autocomplete="off" data-avatar-search></label>${avatarError ? `<p class="auth-error" role="alert">${escapeHtml(avatarError)}</p>` : ""}<div class="avatar-grid" data-avatar-grid>${avatarLoading ? '<p class="avatar-empty">Loading avatars…</p>' : avatarChoices()}</div></section></div>`;
    if (currentUser) return `<div class="auth-backdrop" data-close-auth><section class="auth-card account-card" role="dialog" aria-modal="true" aria-labelledby="account-title"><button class="auth-close" type="button" aria-label="Close account" data-close-auth>×</button><h2 id="account-title">Account</h2><div class="account-profile"><span class="account-avatar">${avatarContent(currentUser)}</span><strong class="account-name">${escapeHtml(currentUser.username)}</strong><button class="profile-link" type="button" data-edit-avatar>Choose avatar</button></div>${avatarError ? `<p class="auth-error" role="alert">${escapeHtml(avatarError)}</p>` : ""}<button class="auth-primary logout-button" type="button" data-logout ${authLoading ? "disabled" : ""}>${authLoading ? "Logging out…" : "Log out"}</button></section></div>`;
    const registering = authMode === "register";
    return `<div class="auth-backdrop" data-close-auth><section class="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button class="auth-close" type="button" aria-label="Close login" data-close-auth>×</button><h2 id="auth-title">${registering ? "Create account" : "Log in"}</h2><form data-auth-form><label for="auth-username">Username</label><input id="auth-username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" required><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${registering ? "new-password" : "current-password"}" minlength="7" maxlength="128" required>${registering ? '<label for="auth-password-confirmation">Confirm password</label><input id="auth-password-confirmation" name="passwordConfirmation" type="password" autocomplete="new-password" minlength="7" maxlength="128" required><small class="password-help">Use at least 7 characters.</small>' : ""}${authError ? `<p class="auth-error" role="alert">${escapeHtml(authError)}</p>` : ""}<button class="auth-primary" type="submit" ${authLoading ? "disabled" : ""}>${authLoading ? "Please wait…" : registering ? "Register" : "Log in"}</button></form><button class="auth-mode-link" type="button" data-auth-mode="${registering ? "login" : "register"}">${registering ? "Already have an account? Log in" : "Don't have an account? Register"}</button></section></div>`;
  }

  function welcomeCard() {
    if (!welcomeOpen || !currentUser) return "";
    return `<div class="auth-backdrop welcome-backdrop"><section class="auth-card welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><h2 id="welcome-title">Welcome to Nuzzle!</h2><p>Nuzzle is a daily puzzle game built around simulated Nuzlocke battles. Start a fresh run, claim encounters, build your team, and challenge the daily Trainer.</p><p>Win to earn money and new encounters to grow your box. Lose, and your run is wiped—but tomorrow brings a fresh start and another chance!</p>${welcomeError ? `<p class="auth-error" role="alert">${escapeHtml(welcomeError)}</p>` : ""}<button class="auth-primary" type="button" data-dismiss-welcome ${welcomeLoading ? "disabled" : ""}>${welcomeLoading ? "Please wait…" : "Let’s go"}</button></section></div>`;
  }

  async function dismissWelcome() {
    if (welcomeLoading) return;
    welcomeLoading = true;
    welcomeError = "";
    render();
    try {
      const result = await apiRequest("/api/account/welcome", { method: "PUT" });
      currentUser = result.user;
      welcomeOpen = false;
    } catch (error) {
      welcomeError = error.message;
    } finally {
      welcomeLoading = false;
      render();
    }
  }

  function home() {
    const trainer = todayState.trainer;
    return `<section class="screen home-screen">${header()}<div class="landing">
      <div class="trainer-wrap"><img class="sprite trainer" src="${trainerSprite(trainer.spriteId)}" alt="${escapeHtml(trainer.name)}" /></div>
      <div class="opponent-team" aria-label="${escapeHtml(trainer.name)}'s team">${trainer.pokemon.map((pokemon) => `<button type="button" aria-label="${escapeHtml(pokemon.name)}${pokemon.shiny ? ", shiny" : ""}"><img class="sprite" src="${sprite(pokemon.id, false, pokemon.spriteId, pokemon.shiny)}" alt="${escapeHtml(pokemon.name)}" /></button>`).join("")}</div>
      ${navigation()}
    </div></section>`;
  }

  function lead() {
    const chosen = [...team].slice(0, 6);
    const trainer = todayState.trainer;
    return `<section class="screen lead-screen">${header()}<div class="arena battle-arena lead-arena"><div class="battle-platform enemy" aria-hidden="true"></div><div class="battle-platform player" aria-hidden="true"></div><img class="sprite trainer trainer-${escapeHtml(trainer.spriteId)}" src="${trainerSprite(trainer.spriteId)}" alt="${escapeHtml(trainer.name)}" /></div>
      <div class="lead-prompt"><p class="prompt">How will you start the battle?</p><h2 class="section-label">Choose Lead</h2>
      <div class="lead-grid">${chosen.map(monButton).join("")}</div><div class="lead-details-slot" data-lead-details aria-live="polite">${leadDetails(selectedLeadId)}</div></div>
      ${battleError ? `<p class="battle-error" role="alert">${escapeHtml(battleError)}</p>` : ""}
      <div class="lead-actions"><button class="gloss-button red" type="button" data-start-battle ${selectedLeadId && !battleLoading ? "" : "disabled"}>${battleLoading ? "Starting…" : "Start battle"}</button><button class="gloss-button purple" type="button" data-route="home">Back</button></div>
    </section>`;
  }

  function monButton(id) {
    const mon = mons[id];
    const selected = id === selectedLeadId;
    return `<button class="lead-choice${selected ? " selected" : ""}" type="button" data-select-lead="${id}" aria-label="Choose ${escapeHtml(mon.name)} as lead" aria-pressed="${selected}"><img class="sprite" src="${sprite(id)}" alt=""/><span>${mon.name}</span></button>`;
  }

  function leadDetails(id) {
    const mon = mons[id];
    if (!mon) return "";
    const statLabels = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
    const statOrder = ["hp", "atk", "def", "spa", "spd", "spe"];
    const statValues = mon.calculatedStats || {};
    const statLine = statOrder.map((stat) => {
      const label = statLabels[stat];
      const natureChange = label === mon.natureUp ? " raised" : label === mon.natureDown ? " lowered" : "";
      const marker = natureChange === " raised" ? " ↑" : natureChange === " lowered" ? " ↓" : "";
      return `<span class="lead-stat${natureChange}" aria-label="${label}, ${statValues[stat] ?? "—"}${natureChange ? `, ${natureChange.trim()} by ${mon.nature} nature` : ""}"><small>${label}${marker}</small> <strong>${statValues[stat] ?? "—"}</strong></span>`;
    }).join("");
    const moveDetails = mon.moveDetails || mon.moves.map((name) => ({ name, type: "Normal" }));
    return `<article class="lead-details-card" aria-label="${escapeHtml(mon.name)} battle details">
      <header><strong>${escapeHtml(mon.name)}</strong><span class="lead-detail-types">${mon.types.map((type) => `<i class="type-chip ${type.toLowerCase()}">${escapeHtml(type)}</i>`).join("")}</span></header>
      <p class="lead-fact-line"><span><b>Ability:</b> ${escapeHtml(mon.ability)}</span><span><b>Item:</b> ${escapeHtml(mon.item || "None")}</span></p>
      <div class="lead-stat-line" aria-label="Battle stats">${statLine}</div>
      <div class="lead-move-grid">${moveDetails.map((move) => `<span><strong>${escapeHtml(move.name)}</strong><i class="type-chip ${move.type.toLowerCase()}">${escapeHtml(move.type)}</i></span>`).join("")}</div>
    </article>`;
  }

  function battle() {
    if (!battleState) return `<section class="screen battle-screen">${header()}<div class="battle-unavailable"><h2>Battle unavailable</h2><p>${escapeHtml(battleError || "Start a battle from the lead-selection screen.")}</p><button class="gloss-button purple" data-route="lead">Back</button></div></section>`;
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
    const switchesHtml = battleState.player.team.map((pokemon) => `<button class="switch-choice ${pokemon.active ? "selected" : ""} ${pokemon.fainted ? "fainted" : ""}" type="button" data-battle-switch="${pokemon.slot}" data-mon-tip="${pokemon.id}" ${!pokemon.canSwitch || battleLoading || battleState.ended ? "disabled" : ""}><img class="sprite" src="${sprite(pokemon.id, false, pokemon.spriteId, pokemon.shiny)}" alt=""/><span>${escapeHtml(pokemon.name)}</span><small>${pokemon.fainted ? "fainted" : `${pokemon.percent}%`}</small><i class="switch-hp ${healthTone(pokemon.percent)}" aria-hidden="true"><b style="width:${pokemon.fainted ? 0 : pokemon.percent}%"></b></i></button>`).join("");
    const prompt = battleState.ended
      ? `<strong>${battleState.winner === "Player" ? "You won!" : battleState.winner ? `${escapeHtml(battleState.winner)} won.` : "Battle over."}</strong>`
      : battleState.forcedSwitch
        ? "Choose your next Pokémon."
        : battleLoading || battleState.waiting
          ? "Resolving the turn…"
          : `What will <strong>${escapeHtml(player?.name)}</strong> do?`;
    return `<section class="screen battle-screen">${header()}<div class="arena battle-arena" aria-label="Grassy battlefield">
      <div class="battle-platform enemy" aria-hidden="true"></div><div class="battle-platform player" aria-hidden="true"></div>
      ${enemy ? `<div class="battler-slot enemy" data-pokemon="${escapeHtml(enemy.id)}"><img class="sprite active-sprite" src="${sprite(enemy.id, false, enemy.spriteId, enemy.shiny)}" alt="${escapeHtml(enemy.name)}" /></div><section class="battle-hud enemy" aria-label="Opponent ${escapeHtml(enemy.name)}"><div class="battle-hud-title"><strong>${escapeHtml(enemy.name)}</strong><span>Lv. ${enemy.level}</span></div><div class="hp-bar ${healthTone(enemy.percent)}"><i style="width:${enemy.percent}%"></i></div><div class="battle-hud-detail"><span>HP</span><small>${enemy.percent}%</small>${enemy.status ? `<b>${escapeHtml(enemy.status.toUpperCase())}</b>` : ""}</div></section>` : ""}
      ${player ? `<div class="battler-slot player" data-pokemon="${escapeHtml(player.id)}"><img class="sprite active-sprite" src="${sprite(player.id, true, player.spriteId, player.shiny)}" alt="${escapeHtml(player.name)}" /></div><section class="battle-hud player" aria-label="Your ${escapeHtml(player.name)}"><div class="battle-hud-title"><strong>${escapeHtml(player.name)}</strong><span>Lv. ${player.level}</span></div><div class="hp-bar ${healthTone(player.percent)}"><i style="width:${player.percent}%"></i></div><div class="battle-hud-detail"><span>HP</span><small>${player.percent}%</small>${player.status ? `<b>${escapeHtml(player.status.toUpperCase())}</b>` : ""}</div></section>` : ""}
    </div><div class="battle-panel${battleLogExpanded ? " log-expanded" : ""}"><section class="battle-log-card${battleLogExpanded ? " expanded" : ""}" aria-labelledby="battle-log-title"><header><h2 id="battle-log-title">Battle log</h2><div>${battleLogHasNew ? '<button type="button" data-battle-log-new>New events</button>' : ""}<button type="button" data-toggle-battle-log aria-expanded="${battleLogExpanded}">${battleLogExpanded ? "Collapse" : "Expand"}</button></div></header><div class="battle-log-body" data-battle-log role="log" aria-label="Battle events" tabindex="0"><div class="battle-log-stack">${logHtml || '<p class="battle-log-empty">The battle is starting…</p>'}</div></div></section><span class="visually-hidden" role="status" aria-live="polite">${escapeHtml(latestAnnouncement)}</span>
      <div class="battle-command-area" ${battleLogExpanded ? 'inert aria-hidden="true"' : ""}><p class="prompt">${prompt} <small>Turn ${battleState.turn}</small></p>${battleState.forcedSwitch || battleState.ended ? "" : `<h2 class="section-label attack">Attack</h2><div class="move-grid">${movesHtml}</div>`}
      <h2 class="section-label">Switch</h2><div class="switch-grid">${switchesHtml}</div>${battleError ? `<p class="battle-error" role="alert">${escapeHtml(battleError)}</p>` : ""}</div>
      ${battleState.ended ? '<div class="battle-result-actions"><button class="gloss-button green" type="button" data-open-result>Result</button><button class="gloss-button purple" data-route="home">Return home</button></div>' : '<button class="gloss-button red give-up" data-forfeit-battle>Give up</button>'}</div>
      ${battleState.ended && resultOverlayOpen ? battleResultOverlay() : ""}
    </section>`;
  }

  function sameResultPokemon(profile, pokemon) {
    const normalized = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalized(profile?.id) === normalized(pokemon?.id)
      || normalized(profile?.name) === normalized(pokemon?.name)
      || normalized(profile?.nickname) === normalized(pokemon?.name);
  }

  function resultPokemon(profile, tone) {
    if (!profile) return `<span class="result-credit ${tone} text-only">indirect</span>`;
    return `<span class="result-credit ${tone}"><img class="sprite" src="${sprite(profile.id, false, profile.spriteId, profile.shiny)}" alt=""><b>${escapeHtml(profile.nickname || profile.name)}</b></span>`;
  }

  function battleResultOverlay() {
    const knockouts = battleState.knockouts || [];
    const cards = battleState.opponent.team.map((pokemon) => {
      const defeatedBy = knockouts.filter((entry) => entry.defeated?.side === "opponent" && sameResultPokemon(entry.defeated, pokemon));
      const defeatedPlayer = knockouts.filter((entry) => entry.credited?.side === "opponent" && sameResultPokemon(entry.credited, pokemon));
      const greenCredits = defeatedBy.length
        ? defeatedBy.map((entry) => resultPokemon(entry.credited?.side === "player" ? entry.credited : null, "ko-by")).join("")
        : `<span class="result-credit empty">${pokemon.fainted ? "no direct KO" : "survived"}</span>`;
      const redCredits = defeatedPlayer.length
        ? defeatedPlayer.map((entry) => resultPokemon(entry.defeated, "ko-earned")).join("")
        : '<span class="result-credit empty">no KOs</span>';
      return `<article class="result-mon-card"><div class="result-credit-row above" aria-label="Knocked out by">${greenCredits}</div><div class="result-opponent"><img class="sprite" src="${sprite(pokemon.id, false, pokemon.spriteId, pokemon.shiny)}" alt="${escapeHtml(pokemon.name)}"><strong>${escapeHtml(pokemon.name)}</strong></div><div class="result-credit-row below" aria-label="Pokémon knocked out">${redCredits}</div></article>`;
    }).join("");
    const victory = battleState.winner === "Player";
    const heading = victory ? "Victory!" : battleState.winner ? "Defeat" : "Battle complete";
    const challengeNumber = battleState.challengeDate === todayState.date ? todayState.number : battleState.challengeNumber || todayState.number;
    const subheading = battleState.forfeited ? `You forfeited against ${battleState.opponent.name}.` : `${battleState.opponent.name} · Nuzzle #${challengeNumber}`;
    return `<div class="result-backdrop" data-close-result><section class="result-modal ${victory ? "victory" : "defeat"}" role="dialog" aria-modal="true" aria-labelledby="result-title"><button class="result-close" type="button" aria-label="Close result" data-close-result>×</button><header><span>daily battle result</span><h2 id="result-title">${heading}</h2><p>${escapeHtml(subheading)}</p></header><div class="result-legend"><span class="green-key">▲ your Pokémon that KO'd it</span><span class="red-key">▼ your Pokémon it KO'd</span></div><div class="result-grid">${cards}</div></section></div>`;
  }

  function pc() {
    const trainer = todayState.trainer;
    const trainerSlots = trainer.pokemon.map((pokemon, index) => `<button class="party-slot trainer-party-slot" type="button" data-trainer-pokemon="${index}" aria-label="View ${escapeHtml(pokemon.name)}${pokemon.shiny ? ", shiny" : ""}"><img class="sprite" src="${sprite(pokemon.id, false, pokemon.spriteId, pokemon.shiny)}" alt=""/><span>${escapeHtml(pokemon.name)}</span></button>`).join("");
    const party = [...team].slice(0, 6);
    const partySlots = Array.from({ length: 6 }, (_, index) => {
      const id = party[index];
      if (!id) return `<div class="party-slot empty" aria-label="Empty team slot"><span>empty</span></div>`;
      const mon = mons[id];
      return `<div class="party-card"><button class="party-slot" type="button" data-pc-detail="${id}" aria-label="View ${mon.name}"><img class="sprite" src="${sprite(id)}" alt=""/><span>${mon.name}</span></button><button class="pc-quick-action remove" type="button" data-quick-team-remove="${id}" aria-label="Remove ${mon.name} from team">×</button></div>`;
    }).join("");
    const boxIds = pcOrder.filter((id) => !team.has(id));
    const boxMons = boxIds.map((id) => {
      const mon = mons[id];
      return `<div class="pc-mon-card"><button class="pc-mon" type="button" draggable="false" data-pc-mon="${id}" aria-label="View ${mon.name}"><img class="sprite" src="${sprite(id)}" alt=""/><span class="pc-mon-name">${mon.name}</span></button><button class="pc-quick-action add" type="button" data-quick-team-add="${id}" aria-label="Add ${mon.name} to team">+</button></div>`;
    }).join("");
    return `<section class="screen">${header()}<div class="pc-stage">
      <section class="pc-section trainer-reference-section" aria-labelledby="trainer-team-heading"><div class="pc-section-head"><h2 id="trainer-team-heading">${escapeHtml(trainer.name)}</h2><span>${trainer.pokemon.length} Pokémon</span></div><div class="party-strip">${trainerSlots}</div></section>
      <section class="pc-section party-section" aria-labelledby="party-heading"><div class="pc-section-head"><h2 id="party-heading">team</h2><span>${party.length}/6</span></div><div class="party-strip">${partySlots}</div></section>
      <section class="pc-section box-section" aria-labelledby="box-heading"><div class="pc-section-head"><h2 id="box-heading">box</h2><span>${boxIds.length} Pokémon</span></div><div class="pc-box">${boxMons}</div></section>
      ${backButton()}</div>${selectedPcId ? pcPokemonSheet(selectedPcId) : ""}${selectedTrainerPokemon !== null ? trainerPokemonCard(trainer.pokemon[selectedTrainerPokemon]) : ""}</section>`;
  }

  function trainerPokemonCard(pokemon) {
    const species = pokemonContent.get(pokemon.id) || {};
    const types = pokemon.types?.length ? pokemon.types : species.types || ["Normal"];
    const abilities = pokemon.possibleAbilities?.length
      ? pokemon.possibleAbilities
      : [...new Set([...(species.ordinaryAbilities || []), species.hiddenAbility].filter(Boolean))];
    const baseSpeed = species.baseStats?.spe;
    const fallbackSpeedStat = (iv, ev, natureNumerator) => {
      const core = Math.floor((2 * baseSpeed + iv + Math.floor(ev / 4)) * 100 / 100) + 5;
      return Math.floor(core * natureNumerator / 10);
    };
    const fallbackSpeed = Number.isFinite(baseSpeed)
      ? {
          min: fallbackSpeedStat(0, 0, 9),
          max: fallbackSpeedStat(31, 252, 11),
        }
      : null;
    const speedRange = pokemon.speedRange || fallbackSpeed;
    const speed = Number.isFinite(speedRange?.min) && Number.isFinite(speedRange?.max) ? `${speedRange.min}–${speedRange.max}` : "—";
    return `<div class="trainer-scout-backdrop" data-close-trainer-pokemon><section class="trainer-scout-card" role="dialog" aria-modal="true" aria-labelledby="trainer-scout-title"><button class="trainer-scout-close" type="button" data-close-trainer-pokemon aria-label="Close trainer Pokémon details">×</button><header><h2 id="trainer-scout-title">${escapeHtml(pokemon.name)}</h2><div class="sheet-types">${types.map((type) => `<span class="type-chip ${type.toLowerCase()}">${escapeHtml(type)}</span>`).join("")}</div></header><div class="trainer-scout-facts"><p><span>Possible abilities</span><strong>${escapeHtml(abilities.join(", ") || "Unknown")}</strong></p><p><span>Speed</span><strong>${speed}</strong><small>before items, abilities, or modifiers</small></p></div></section></div>`;
  }

  const trainingStats = [["hp", "HP"], ["atk", "Atk"], ["def", "Def"], ["spa", "SpA"], ["spd", "SpD"], ["spe", "Spe"]];
  const trainingStatNames = { hp: "HP", atk: "Atk", def: "Def", spa: "Sp. Atk", spd: "Sp. Def", spe: "Spe" };

  function beginTraining(mon) {
    trainingDraft = {
      speciesId: mon.speciesId,
      ivs: { ...mon.ivs },
      evs: { ...mon.evs },
      nature: mon.nature,
      ability: mon.ability,
      moves: [...mon.moves],
    };
    trainingMoveSlot = null;
    trainingMoveSearch = "";
    trainingMessage = "";
    trainingTransactionKey = crypto.randomUUID();
  }

  function trainingForm(mon, speciesId = trainingDraft?.speciesId) {
    return mon.trainingForms?.find((form) => form.id === speciesId) || { id: mon.speciesId, name: mon.name, baseStats: mon.baseStats, ordinaryAbilities: mon.ordinaryAbilities, hiddenAbility: mon.hiddenAbility, learnableMoveIds: mon.learnableMoveIds, legalMoveIds: mon.legalMoveIds };
  }

  function availableTrainingForms(mon) {
    const targets = new Set(shopItems.filter((item) => item.effect === "form").map((item) => item.target));
    return (mon.trainingForms || []).filter((form) => form.id === mon.speciesId || (mon.speciesId.startsWith("rotom") && form.id.startsWith("rotom")) || targets.has(form.id));
  }

  function previewTrainingStats(mon) {
    const draft = trainingDraft;
    const form = trainingForm(mon);
    const nature = natureOptions.find((option) => option.name === draft.nature) || {};
    const labelByStat = { atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
    return Object.fromEntries(trainingStats.map(([stat]) => {
      const base = form.baseStats[stat];
      const core = Math.floor(((2 * base + draft.ivs[stat] + Math.floor(draft.evs[stat] / 4)) * mon.level) / 100);
      const adjustment = nature.up === labelByStat[stat] ? 1.1 : nature.down === labelByStat[stat] ? .9 : 1;
      return [stat, stat === "hp" ? (base === 1 ? 1 : core + mon.level + 10) : Math.floor((core + 5) * adjustment)];
    }));
  }

  function localTrainingQuote(mon) {
    const draft = trainingDraft;
    const form = trainingForm(mon);
    const lines = [];
    const add = (key, label, cost) => lines.push({ key, label, cost });
    for (const [stat, label] of trainingStats) {
      const evDifference = draft.evs[stat] - mon.evs[stat];
      if (evDifference > 0) {
        const item = shopItems.find((candidate) => candidate.effect === "ev" && candidate.stat === stat && candidate.amount > 0);
        add(`ev-${stat}`, `${label} EV +${evDifference}`, evDifference * item.price);
      } else if (evDifference < 0) {
        add(`ev-${stat}`, `${label} EV −${Math.abs(evDifference)}`, 0);
      }
      if (draft.ivs[stat] !== mon.ivs[stat]) {
        const cost = draft.ivs[stat] > mon.ivs[stat] ? shopItems.find((item) => item.effect === "iv").price : 0;
        add(`iv-${stat}`, `${label} IV ${mon.ivs[stat]} → ${draft.ivs[stat]}`, cost);
      }
    }
    if (draft.nature !== mon.nature) add("nature", `Nature ${mon.nature} → ${draft.nature}`, shopItems.find((item) => item.effect === "nature").price);
    if (draft.ability !== mon.ability) {
      const effect = draft.ability === form.hiddenAbility ? "ability-patch" : "ability-capsule";
      add("ability", `Ability ${mon.ability} → ${draft.ability}`, shopItems.find((item) => item.effect === effect).price);
    }
    if (draft.speciesId !== mon.speciesId) {
      const item = mon.speciesId.startsWith("rotom") && draft.speciesId.startsWith("rotom")
        ? shopItems.find((candidate) => candidate.effect === "rotom")
        : shopItems.find((candidate) => candidate.effect === "form" && candidate.target === draft.speciesId);
      add("form", `Form ${mon.name} → ${form.name}`, item.price);
    }
    const known = new Set(mon.moves.map(toId));
    for (const move of draft.moves) {
      const moveId = toId(move);
      if (known.has(moveId)) continue;
      const item = shopItems.find((candidate) => candidate.id === `tm-${moveId}`);
      add(`move-${moveId}`, `Learn ${move}`, item.price);
    }
    const changed = draft.speciesId !== mon.speciesId || draft.nature !== mon.nature || draft.ability !== mon.ability
      || trainingStats.some(([stat]) => draft.ivs[stat] !== mon.ivs[stat] || draft.evs[stat] !== mon.evs[stat])
      || draft.moves.some((move, slot) => move !== mon.moves[slot]);
    return { lines, total: lines.reduce((sum, line) => sum + line.cost, 0), changed };
  }

  function moveCatalogItem(name, details = {}) {
    return shopItems.find((item) => item.group === "TMs" && item.moveId === toId(name)) || {
      name,
      type: details.type || "Normal",
      category: details.category || "Status",
      power: details.power || 0,
      accuracy: true,
      description: "Move details unavailable.",
    };
  }

  function showdownMoveRow(item, price = null) {
    const power = item.category === "Status" || !item.power ? "—" : item.power;
    const accuracy = item.accuracy === true ? "—" : `${item.accuracy}%`;
    return `<span class="showdown-move-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description || "No additional effect.")}</small></span><span class="showdown-move-data"><span class="showdown-move-sprite"><img src="assets/showdown/types/${encodeURIComponent(item.type)}.png" alt="${escapeHtml(item.type)} type"></span><span class="showdown-move-sprite"><img src="assets/showdown/categories/${encodeURIComponent(item.category)}.png" alt="${escapeHtml(item.category)} move"></span><span class="showdown-move-stat" data-move-stat><small>Power</small><b>${power}</b></span><span class="showdown-move-stat" data-move-stat><small>Accuracy</small><b>${accuracy}</b></span><span class="showdown-move-stat showdown-move-price${price === null ? " empty" : ""}" data-move-price><small>Price</small><b>${price === null ? "" : `₽${price.toLocaleString()}`}</b></span></span>`;
  }

  function trainingMovePicker(mon) {
    const form = trainingForm(mon);
    const query = trainingMoveSearch.trim().toLowerCase();
    const selectedElsewhere = new Set(trainingDraft.moves.filter((_, slot) => slot !== trainingMoveSlot).map(toId));
    const moves = shopItems.filter((item) => item.group === "TMs" && form.learnableMoveIds.includes(item.moveId) && !selectedElsewhere.has(item.moveId));
    const matches = (item) => !query || `${item.name} ${item.type} ${item.category} ${item.description || ""}`.toLowerCase().includes(query);
    const matchCount = moves.filter(matches).length;
    const currentMoveName = trainingDraft.moves[trainingMoveSlot];
    const currentMove = moveCatalogItem(currentMoveName);
    return `<section class="training-move-picker"><header><div class="training-move-nav"><button type="button" data-close-move-picker aria-label="Back to training">←</button><small>Replace move ${trainingMoveSlot + 1}</small></div><div class="showdown-move-row training-current-move" data-current-training-move>${showdownMoveRow(currentMove)}</div></header><label class="move-search"><span>Search available moves</span><input type="search" value="${escapeHtml(trainingMoveSearch)}" placeholder="Search by name, type, category, or effect" data-training-move-search autofocus><small aria-live="polite" data-training-move-count>${matchCount} matching move${matchCount === 1 ? "" : "s"}</small></label><div class="training-move-list">${moves.map((item) => `<button class="showdown-move-row" type="button" data-select-training-move="${item.id}" data-move-search-text="${escapeHtml(`${item.name} ${item.type} ${item.category} ${item.description || ""}`.toLowerCase())}" ${matches(item) ? "" : "hidden"}>${showdownMoveRow(item, item.price)}</button>`).join("")}<p class="training-empty" ${matchCount ? "hidden" : ""}>No matching moves.</p></div></section>`;
  }

  function trainingEditor(mon) {
    if (!trainingDraft) beginTraining(mon);
    if (trainingMoveSlot !== null) return trainingMovePicker(mon);
    const form = trainingForm(mon);
    const stats = previewTrainingStats(mon);
    const quote = localTrainingQuote(mon);
    const invalidMoveSlots = trainingDraft.moves.map((move, slot) => form.legalMoveIds.includes(toId(move)) ? null : slot).filter((slot) => slot !== null);
    const evTotal = Object.values(trainingDraft.evs).reduce((sum, value) => sum + value, 0);
    const rows = trainingStats.map(([stat]) => {
      const changed = trainingDraft.evs[stat] !== mon.evs[stat] || trainingDraft.ivs[stat] !== mon.ivs[stat];
      return `<div class="training-editor-row${changed ? " changed" : ""}"><strong class="training-stat-name">${trainingStatNames[stat]}</strong><span class="training-base-value">${form.baseStats[stat]}</span><input class="training-ev-input" aria-label="${trainingStatNames[stat]} EV" type="number" min="0" max="252" value="${trainingDraft.evs[stat]}" data-training-ev-input="${stat}" inputmode="numeric"><input class="training-ev-slider" aria-label="${trainingStatNames[stat]} EV slider" type="range" min="0" max="252" step="1" value="${trainingDraft.evs[stat]}" data-training-ev="${stat}"><input class="training-iv-input" aria-label="${trainingStatNames[stat]} IV" type="number" min="0" max="31" value="${trainingDraft.ivs[stat]}" data-training-iv="${stat}" inputmode="numeric"><button class="training-iv-max" type="button" data-max-training-iv="${stat}" aria-label="Max ${trainingStatNames[stat]} IV">Max IV</button><output class="training-final-value" aria-label="Final ${trainingStatNames[stat]} stat">${stats[stat]}</output></div>`;
    }).join("");
    const abilities = [...form.ordinaryAbilities, form.hiddenAbility].filter(Boolean);
    const forms = availableTrainingForms(mon);
    return `<section class="training-editor" role="tabpanel"><div class="training-scroll"><div class="training-column-head" aria-hidden="true"><span>Stat</span><span>Base</span><span>EV</span><span></span><span>IV</span><span></span><span>Total</span></div>${rows}<div class="training-remaining"><span>${510 - evTotal} EVs remaining</span><button type="button" data-reset-evs>Clear EVs</button></div><div class="training-selects"><label>Nature<select data-training-nature>${natureOptions.map((nature) => `<option value="${nature.name}" ${nature.name === trainingDraft.nature ? "selected" : ""}>${nature.name}${nature.up ? ` (+${nature.up}, −${nature.down})` : " (neutral)"}</option>`).join("")}</select></label><label>Ability<select data-training-ability>${abilities.map((ability) => `<option ${ability === trainingDraft.ability ? "selected" : ""}>${escapeHtml(ability)}</option>`).join("")}</select></label>${forms.length > 1 ? `<label>Form<select data-training-form>${forms.map((candidate) => `<option value="${candidate.id}" ${candidate.id === trainingDraft.speciesId ? "selected" : ""}>${escapeHtml(candidate.name)}</option>`).join("")}</select></label>` : ""}</div><div class="training-moves"><h3>Moves</h3>${trainingDraft.moves.map((move, slot) => `<button class="${invalidMoveSlots.includes(slot) ? "invalid" : ""}" type="button" data-edit-training-move="${slot}"><span><small>Move ${slot + 1}${invalidMoveSlots.includes(slot) ? " · replacement required" : ""}</small><strong>${escapeHtml(move)}</strong></span><b>Select</b></button>`).join("")}</div></div><footer class="training-footer">${trainingMessage ? `<p role="alert">${escapeHtml(trainingMessage)}</p>` : ""}${invalidMoveSlots.length ? '<p role="alert">Replace moves that are illegal for the selected form.</p>' : ""}<div class="training-footer-line"><span>${quote.lines.length} pending change${quote.lines.length === 1 ? "" : "s"}<button type="button" data-reset-training ${quote.changed ? "" : "disabled"}>Reset</button></span><span>Total ₽${quote.total.toLocaleString()}</span></div><div class="training-after">Balance after ₽${Math.max(0, balance - quote.total).toLocaleString()}</div><div class="training-footer-actions"><button class="gloss-button blue" type="button" data-apply-training ${quote.changed && quote.total <= balance && !invalidMoveSlots.length ? "" : "disabled"}>Apply changes</button><button class="gloss-button neutral" type="button" data-close-pc-sheet>Close</button></div></footer></section>`;
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
      return `<span class="stat-card${change}"><small>${label}${marker}</small><strong>${value}</strong></span>`;
    }).join("");
    const swapChooser = pcSwapMode && !onTeam ? `<section class="swap-chooser" aria-labelledby="swap-heading"><h3 id="swap-heading">Who should ${mon.name} replace?</h3><p>The new Pokémon will take the same team position.</p><div class="swap-grid">${[...team].map((teamId) => `<button type="button" data-team-replace="${teamId}"><img class="sprite" src="${sprite(teamId)}" alt=""/><span>${mons[teamId].name}</span></button>`).join("")}</div></section>` : "";
    const itemChooser = pcItemMode ? pcItemPanel(mon) : "";
    const tabs = `<div class="pc-detail-tabs" role="tablist" aria-label="Pokémon details"><button type="button" role="tab" aria-selected="${pcDetailView === "summary"}" class="${pcDetailView === "summary" ? "selected" : ""}" data-pc-detail-view="summary">Summary</button><button type="button" role="tab" aria-selected="${pcDetailView === "training"}" class="${pcDetailView === "training" ? "selected" : ""}" data-pc-detail-view="training">Training</button></div>`;
    const moveDetails = mon.moveDetails || mon.moves.map((name) => ({ name, type: "Normal", category: "Status", power: null }));
    const summaryMoves = moveDetails.map((move) => {
      const type = move.type || "Normal";
      const category = move.category || "Status";
      return `<button class="sheet-move type-${toId(type)}" type="button" data-summary-move="${toId(move.name)}" title="View ${escapeHtml(move.name)} details"><strong>${escapeHtml(move.name)}</strong><span class="sheet-move-category"><img src="assets/showdown/categories/${encodeURIComponent(category)}.png" alt="${escapeHtml(category)} move"></span></button>`;
    }).join("");
    const summary = `<div class="pokemon-facts"><p><span>Ability</span><strong>${mon.ability}</strong></p><p><span>Nature</span><strong>${mon.nature}</strong></p><p><span>Held item</span><strong>${mon.item}</strong></p></div><section class="sheet-section" role="tabpanel"><div class="stat-grid">${stats}</div><h3>Moves</h3><div class="sheet-moves">${summaryMoves}</div></section>`;
    const normalContent = `${tabs}<div class="pc-detail-panel">${pcDetailView === "training" ? trainingEditor(mon) : summary}</div>${pcDetailView === "summary" ? `<div class="sheet-actions"><button class="gloss-button ${onTeam ? "red" : "green"}" type="button" data-team-toggle="${id}">${onTeam ? "Remove from team" : "Add to team"}</button><button class="gloss-button blue" type="button" data-open-pc-items>Held item</button><button class="gloss-button slate" type="button" data-close-pc-sheet>Close</button></div>` : ""}`;
    const sheetContent = swapChooser || itemChooser || normalContent;
    const alternateMode = swapChooser || itemChooser;
    const selectedMove = pcSummaryMoveId ? moveCatalogItem(mon.moves.find((move) => toId(move) === pcSummaryMoveId) || pcSummaryMoveId) : null;
    const moveCard = selectedMove ? `<div class="summary-move-backdrop" data-close-summary-move><section class="summary-move-card" role="dialog" aria-labelledby="summary-move-title"><header><small>Move details</small><button type="button" data-close-summary-move aria-label="Close move details">×</button></header><div class="showdown-move-row" data-summary-move-detail id="summary-move-title">${showdownMoveRow(selectedMove)}</div></section></div>` : "";
    return `<div class="sheet-backdrop" data-close-pc-sheet><section class="pokemon-sheet${pcDetailView === "training" && !alternateMode ? " training-sheet" : ""}" role="dialog" aria-modal="true" aria-labelledby="pokemon-sheet-title"><button class="sheet-close" type="button" data-close-pc-sheet aria-label="Close Pokémon details">×</button><div class="pokemon-summary"><img class="sprite" src="${sprite(id)}" alt="${mon.name}"/><div><p class="sheet-kicker">Pokémon details</p><h2 id="pokemon-sheet-title">${mon.name}</h2><div class="sheet-types">${mon.types.map((type) => `<span class="type-chip ${type.toLowerCase()}">${type}</span>`).join("")}</div></div></div><div class="sheet-mode-content">${sheetContent}</div>${alternateMode ? `<button class="gloss-button neutral sheet-secondary-action" type="button" ${swapChooser ? "data-cancel-pc-swap" : "data-cancel-pc-items"}>Cancel</button>` : ""}${moveCard}</section></div>`;
  }

  function encountersScreen() {
    const remaining = encounters.filter((encounter) => !encounter.claimed).length;
    const visibleEncounters = encounters.map((encounter, slot) => ({ encounter, slot })).filter(({ encounter, slot }) => !encounter.claimed || encountersRevealedThisVisit.has(slot));
    return `<section class="screen">${header()}<div class="encounter-stage">${remaining ? `<p class="encounter-count">${remaining} encounter${remaining === 1 ? "" : "s"} remaining</p>` : ""}
      <div class="encounter-list">${visibleEncounters.length ? visibleEncounters.map(({ encounter, slot: index }) => {
        if (!encounter.claimed) {
          return `<button class="encounter-card mystery" type="button" data-encounter="${index}" aria-label="Reveal encounter ${index + 1}"><span class="encounter-mark" aria-hidden="true"><img src="assets/pixel-grass.png" alt=""/></span><span class="encounter-copy"><strong>Unknown encounter</strong><small>Tap to reveal</small></span></button>`;
        }
        const mon = encounter.pokemon[0];
        return `<article class="encounter-card revealed" data-mon-tip="${mon.id}"><span class="encounter-sprite"><img class="sprite" src="${sprite(mon.id)}" alt="${escapeHtml(mon.name)}"/></span><span class="encounter-copy"><strong>${escapeHtml(mon.name)}</strong><span class="encounter-types">${mon.types.map((type) => `<span class="type-chip ${type.toLowerCase()}">${type}</span>`).join("")}</span></span><span class="encounter-status">Added to PC</span></article>`;
      }).join("") : `<div class="encounter-empty"><p>All encounters claimed</p><p>New encounters in <b data-rollover-countdown>${countdownText()}</b></p></div>`}</div>
      ${backButton()}
    </div></section>`;
  }

  function backButton() {
    return '<button class="gloss-button purple page-back" data-route="home">Back</button>';
  }

  let shopItems = [];
  const itemGroupOrder = ["Held Items", "Key Items"];
  const pcItemGroupOrder = ["Held Items"];
  const itemGroupLabel = (group) => group === "Held Items" ? "Held items" : group === "Key Items" ? "Key items" : group;
  const natureOptions = [
    { name: "Adamant", up: "Atk", down: "SpA" }, { name: "Lonely", up: "Atk", down: "Def" }, { name: "Naughty", up: "Atk", down: "SpD" }, { name: "Brave", up: "Atk", down: "Spe" },
    { name: "Bold", up: "Def", down: "Atk" }, { name: "Impish", up: "Def", down: "SpA" }, { name: "Relaxed", up: "Def", down: "Spe" }, { name: "Lax", up: "Def", down: "SpD" },
    { name: "Jolly", up: "Spe", down: "SpA" }, { name: "Timid", up: "Spe", down: "Atk" }, { name: "Hasty", up: "Spe", down: "Def" }, { name: "Naive", up: "Spe", down: "SpD" },
    { name: "Modest", up: "SpA", down: "Atk" }, { name: "Mild", up: "SpA", down: "Def" }, { name: "Rash", up: "SpA", down: "SpD" }, { name: "Quiet", up: "SpA", down: "Spe" },
    { name: "Calm", up: "SpD", down: "Atk" }, { name: "Careful", up: "SpD", down: "SpA" }, { name: "Sassy", up: "SpD", down: "Spe" }, { name: "Gentle", up: "SpD", down: "Def" },
    { name: "Bashful" }, { name: "Docile" }, { name: "Hardy" }, { name: "Quirky" }, { name: "Serious" },
  ];

  function itemIcon(item) {
    const iconClass = item.group === "Held Items" ? "held" : item.group === "TMs" ? "tm" : "training";
    const sprite = item.group === "Held Items" && Number.isInteger(item.spriteNumber)
      ? `<i class="held-item-sprite" style="background-position:-${(item.spriteNumber % 16) * 24}px -${Math.floor(item.spriteNumber / 16) * 24}px"></i>`
      : escapeHtml(item.icon);
    return `<span class="item-icon ${iconClass}" aria-hidden="true">${sprite}</span>`;
  }

  function pcItemPanel(mon) {
    if (pendingPcItemId) {
      const item = shopItems.find((candidate) => candidate.id === pendingPcItemId);
      let controls = "";
      if (item.effect === "ev") controls = `<label>Quantity<input name="quantity" type="number" min="1" max="${inventory[item.id]}" value="1" inputmode="numeric"></label>`;
      else if (item.effect === "iv") controls = `<label>Stat<select name="stat">${["hp", "atk", "def", "spa", "spd", "spe"].map((stat) => `<option value="${stat}">${stat.toUpperCase()}</option>`).join("")}</select></label><label>New IV<input name="value" type="number" min="0" max="31" value="31" inputmode="numeric"></label>`;
      else if (item.effect === "nature") controls = `<label>Nature<select name="nature">${natureOptions.map((nature) => `<option value="${nature.name}" ${nature.name === mon.nature ? "disabled" : ""}>${nature.name}${nature.up ? ` (+${nature.up}, −${nature.down})` : " (neutral)"}</option>`).join("")}</select></label>`;
      else if (item.effect === "ability-capsule") {
        const choices = mon.ordinaryAbilities.filter((ability) => ability !== mon.ability);
        controls = choices.length ? `<label>Ability<select name="ability">${choices.map((ability) => `<option>${escapeHtml(ability)}</option>`).join("")}</select></label>` : `<p class="sheet-feedback">This Pokémon has no eligible ordinary ability to switch to.</p>`;
      } else if (item.effect === "ability-patch") controls = `<p>Change <strong>${escapeHtml(mon.ability)}</strong> to <strong>${escapeHtml(mon.hiddenAbility || "no eligible hidden ability")}</strong>.</p>`;
      else if (item.effect === "rotom") controls = `<label>Rotom form<select name="form">${[["rotom", "Base"], ["rotomheat", "Heat"], ["rotomwash", "Wash"], ["rotomfrost", "Frost"], ["rotomfan", "Fan"], ["rotommow", "Mow"]].map(([id, label]) => `<option value="${id}" ${id === mon.speciesId ? "disabled" : ""}>${label}</option>`).join("")}</select></label>`;
      else if (item.effect === "form") controls = `<p>Change ${escapeHtml(mon.name)} to the form associated with ${escapeHtml(item.name)}.</p>`;
      else if (item.effect === "tm") controls = `<fieldset class="move-replace-field"><legend>Choose a move to replace</legend><div class="move-replace-grid">${mon.moves.map((move, slot) => `<label><input type="radio" name="slot" value="${slot}" ${slot === 0 ? "checked" : ""}><span>${escapeHtml(move)}</span></label>`).join("")}</div></fieldset>`;
      const cannotLearnTm = item.effect === "tm" && !mon.learnableMoveIds?.includes(item.moveId);
      const alreadyKnowsTm = item.effect === "tm" && mon.moves.some((move) => move.toLowerCase().replace(/[^a-z0-9]+/g, "") === item.moveId);
      const unusable = (item.effect === "ability-capsule" && !mon.ordinaryAbilities.some((ability) => ability !== mon.ability)) || (item.effect === "ability-patch" && (!mon.hiddenAbility || mon.hiddenAbility === mon.ability)) || cannotLearnTm || alreadyKnowsTm;
      if (cannotLearnTm) controls = `<p class="sheet-feedback">${escapeHtml(mon.name)} cannot learn ${escapeHtml(item.name)}.</p>`;
      else if (alreadyKnowsTm) controls = `<p class="sheet-feedback">${escapeHtml(mon.name)} already knows ${escapeHtml(item.name)}.</p>`;
      return `<section class="pc-item-chooser training-config" aria-labelledby="pc-item-heading"><h3 id="pc-item-heading">Use ${escapeHtml(item.name)}</h3><p>${escapeHtml(item.detail)}</p><form data-train-form data-item-id="${item.id}">${controls}<button class="gloss-button blue pc-item-confirm" type="submit" ${unusable ? "disabled" : ""}>Confirm</button></form></section>`;
    }
    const ownedItems = shopItems.filter((item) => item.group === activePcItemGroup && inventory[item.id] && item.id !== mon.heldItemId);
    const activeGroupIndex = pcItemGroupOrder.indexOf(activePcItemGroup);
    const activeTabId = `pc-item-tab-${activePcItemGroup.toLowerCase().replaceAll(" ", "-")}`;
    const heldItem = mon.heldItemId ? shopItems.find((item) => item.id === mon.heldItemId) : null;
    const heldItemControl = heldItem ? `<div class="pc-held-item"><span><small>Currently holding</small><strong>${escapeHtml(heldItem.name)}</strong></span><button class="item-action take" type="button" data-pc-unequip>Take</button></div>` : "";
    const rows = ownedItems.length ? ownedItems.map((item) => {
      const action = item.group === "Held Items" ? "Give" : "Use";
      const incompatible = item.group === "TMs" && !mon.learnableMoveIds?.includes(item.moveId);
      return `<div class="pc-item-row${incompatible ? " incompatible" : ""}">${itemIcon(item)}<span class="item-copy"><strong>${escapeHtml(item.name)}</strong><small>${incompatible ? `Cannot be learned by ${escapeHtml(mon.name)}` : escapeHtml(item.detail)}</small></span><span class="item-quantity">×${inventory[item.id]}</span><button class="item-action" type="button" data-pc-item="${item.id}" ${incompatible ? "disabled" : ""}>${action}</button></div>`;
    }).join("") : `<div class="pc-item-empty"><strong>No items</strong><span>This category is empty.</span></div>`;
    return `<section class="pc-item-chooser" aria-labelledby="pc-item-heading"><h3 id="pc-item-heading">Use item on ${mon.name}</h3>${pcItemMessage ? `<p class="pc-item-feedback" role="status">${escapeHtml(pcItemMessage)}</p>` : ""}${heldItemControl}<div class="shop-segments pc-item-segments" data-active-index="${activeGroupIndex}" role="tablist" aria-label="Item categories">${pcItemGroupOrder.map((group) => { const selected = group === activePcItemGroup; return `<button id="pc-item-tab-${group.toLowerCase().replaceAll(" ", "-")}" type="button" role="tab" aria-selected="${selected}" data-pc-item-group="${group}" class="${selected ? "selected" : ""}">${itemGroupLabel(group)}</button>`; }).join("")}</div><div class="pc-item-list" role="tabpanel" aria-labelledby="${activeTabId}">${rows}</div></section>`;
  }

  function shopRows() {
    const items = shopItems.filter((item) => item.group === activeShopGroup);
    if (!items.length) return '<div class="shop-empty"><strong>No items</strong><span>Nothing is available in this category yet.</span></div>';
    const query = martSearch.trim().toLowerCase();
    const matches = (item) => !query || `${item.name} ${item.detail} ${item.description || ""}`.toLowerCase().includes(query);
    const matchCount = items.filter(matches).length;
    return items.map((item) => {
      const soldOut = item.purchaseLimit === 1 && gameState?.purchasedUnique.includes(item.id);
      const searchText = `${item.name} ${item.detail} ${item.description || ""}`.toLowerCase();
      return `<div class="shop-item" data-mart-search-text="${escapeHtml(searchText)}" ${matches(item) ? "" : "hidden"}>${itemIcon(item)}<span class="item-copy"><strong>${escapeHtml(item.name)}</strong></span><button class="price-button" type="button" data-open-purchase="${item.id}" ${balance < item.price || soldOut ? "disabled" : ""}>${soldOut ? "Bought" : `₽${item.price.toLocaleString()}`}</button></div>`;
    }).join("") + `<p class="item-search-empty" data-mart-search-empty ${matchCount ? "hidden" : ""}>No matching items.</p>`;
  }

  function maxPurchaseQuantity(item) {
    if (!item || item.price < 1) return 0;
    const affordable = Math.min(999, Math.floor(balance / item.price));
    if (item.purchaseLimit === 1) return gameState?.purchasedUnique.includes(item.id) ? 0 : Math.min(1, affordable);
    return affordable;
  }

  function martSheet() {
    const item = shopItems.find((candidate) => candidate.id === martSheetItemId);
    if (!item || !martSheetMode) return "";
    const maxQuantity = maxPurchaseQuantity(item);
    const summary = `<div class="mart-sheet-summary">${itemIcon(item)}<h2 id="mart-sheet-title">${escapeHtml(item.name)}</h2></div>`;
    const remaining = Math.max(0, balance - item.price);
    return `<div class="sheet-backdrop mart-sheet-backdrop" data-close-mart-sheet><section class="mart-sheet" role="dialog" aria-modal="true" aria-labelledby="mart-sheet-title">
      <button class="sheet-close" type="button" data-close-mart-sheet aria-label="Close purchase">×</button>${summary}
      <p class="mart-item-description">${escapeHtml(item.description || item.detail)}</p>
      <form data-purchase-form="${item.id}">
        <div class="purchase-ledger"><p><span>Money</span><span class="purchase-value">₽${balance.toLocaleString()}</span></p><p><span>Price</span><span class="purchase-value">₽${item.price.toLocaleString()}</span></p><p><span>Remaining after</span><span class="purchase-value purchase-remaining">₽${remaining.toLocaleString()}</span></p></div>
        <div class="mart-sheet-actions"><button class="gloss-button blue" type="submit" ${maxQuantity ? "" : "disabled"}>Buy</button><button class="plain-button" type="button" data-close-mart-sheet>Close</button></div>
      </form>
    </section></div>`;
  }

  function mart() {
    const activeGroupIndex = itemGroupOrder.indexOf(activeShopGroup);
    const activeTabId = `shop-tab-${activeShopGroup.toLowerCase().replaceAll(" ", "-")}`;
    return `<section class="screen">${header()}<div class="mart-stage"><div class="mart-summary"><p class="purchase-message" aria-live="polite">${purchaseMessage}</p><p class="balance">Balance: <strong>₽${balance.toLocaleString()}</strong></p></div>
      <div class="shop-segments mart-segments" data-active-index="${activeGroupIndex}" role="tablist" aria-label="Mart categories">${itemGroupOrder.map((group) => { const selected = group === activeShopGroup; return `<button id="shop-tab-${group.toLowerCase().replaceAll(" ", "-")}" type="button" role="tab" aria-selected="${selected}" data-shop-group="${group}" class="${selected ? "selected" : ""}">${itemGroupLabel(group)}</button>`; }).join("")}</div>
      <label class="move-search item-search"><span>Search items</span><input type="search" value="${escapeHtml(martSearch)}" placeholder="Search by name or effect" data-mart-search><small aria-live="polite" data-mart-search-count>${shopItems.filter((item) => item.group === activeShopGroup && (!martSearch.trim() || `${item.name} ${item.detail} ${item.description || ""}`.toLowerCase().includes(martSearch.trim().toLowerCase()))).length} matching item${shopItems.filter((item) => item.group === activeShopGroup && (!martSearch.trim() || `${item.name} ${item.detail} ${item.description || ""}`.toLowerCase().includes(martSearch.trim().toLowerCase()))).length === 1 ? "" : "s"}</small></label>
      <div class="shop-list" id="shop-items" role="tabpanel" aria-labelledby="${activeTabId}">${shopRows()}</div>${backButton()}</div>${martSheet()}</section>`;
  }

  function bagContents() {
    const ownedItems = shopItems.filter((item) => item.group === activeBagGroup && inventory[item.id]);
    const query = bagSearch.trim().toLowerCase();
    const matches = (item) => !query || `${item.name} ${item.detail} ${item.description || ""}`.toLowerCase().includes(query);
    const matchCount = ownedItems.filter(matches).length;
    return ownedItems.length ? `<div class="bag-list">${ownedItems.map((item) => {
      const action = item.group === "Held Items" ? "give" : "use";
      const searchText = `${item.name} ${item.detail} ${item.description || ""}`.toLowerCase();
      return `<div class="bag-item" data-bag-search-text="${escapeHtml(searchText)}" ${matches(item) ? "" : "hidden"}>${itemIcon(item)}<span class="item-copy"><strong>${item.name}</strong><small>${item.detail}</small></span><span class="item-quantity" aria-label="${inventory[item.id]} owned">×${inventory[item.id]}</span><button class="item-action" type="button" data-route="pc" aria-label="${action} ${item.name} from the PC">${action === "give" ? "Give" : "Use"}</button></div>`;
    }).join("")}<p class="item-search-empty" data-bag-search-empty ${matchCount ? "hidden" : ""}>No matching items.</p></div>` : `<div class="bag-empty"><h2>No items</h2><p>Items in this category will appear here.</p><button class="gloss-button blue" type="button" data-visit-mart="${activeBagGroup}">Visit mart</button></div>`;
  }

  function bag() {
    const total = shopItems.reduce((sum, item) => sum + (inventory[item.id] || 0), 0);
    const activeGroupIndex = itemGroupOrder.indexOf(activeBagGroup);
    const activeTabId = `bag-tab-${activeBagGroup.toLowerCase().replaceAll(" ", "-")}`;
    return `<section class="screen">${header()}<div class="bag-stage"><div class="bag-summary"><span>${total} item${total === 1 ? "" : "s"}</span><span>₽${balance.toLocaleString()}</span></div>
      <div class="shop-segments bag-segments" data-active-index="${activeGroupIndex}" role="tablist" aria-label="Bag categories">${itemGroupOrder.map((group) => { const selected = group === activeBagGroup; return `<button id="bag-tab-${group.toLowerCase().replaceAll(" ", "-")}" type="button" role="tab" aria-selected="${selected}" data-bag-group="${group}" class="${selected ? "selected" : ""}">${itemGroupLabel(group)}</button>`; }).join("")}</div>
      <label class="move-search item-search"><span>Search items</span><input type="search" value="${escapeHtml(bagSearch)}" placeholder="Search by name or effect" data-bag-search><small aria-live="polite" data-bag-search-count>${shopItems.filter((item) => item.group === activeBagGroup && inventory[item.id] && (!bagSearch.trim() || `${item.name} ${item.detail} ${item.description || ""}`.toLowerCase().includes(bagSearch.trim().toLowerCase()))).length} matching item${shopItems.filter((item) => item.group === activeBagGroup && inventory[item.id] && (!bagSearch.trim() || `${item.name} ${item.detail} ${item.description || ""}`.toLowerCase().includes(bagSearch.trim().toLowerCase()))).length === 1 ? "" : "s"}</small></label>
      <div class="bag-contents" role="tabpanel" aria-labelledby="${activeTabId}">${bagContents()}</div>${backButton()}</div></section>`;
  }

  function leaderboardScreen() {
    const entries = leaderboardData?.entries || [];
    const streakEntries = leaderboardData?.streakEntries || [];
    const dailyContent = leaderboardLoading
      ? '<div class="leaderboard-empty"><strong>Loading leaderboard…</strong></div>'
      : leaderboardError
        ? `<div class="leaderboard-empty"><strong>Could not load leaderboard</strong><span>${escapeHtml(leaderboardError)}</span></div>`
        : entries.length
          ? `<ol class="leaderboard-list">${entries.map((entry) => `<li class="leaderboard-row${entry.won ? "" : " leaderboard-loss"}"><span class="leaderboard-rank" aria-label="Rank ${entry.rank}">${entry.rank}</span><div class="leaderboard-entry"><strong class="leaderboard-player-name">${escapeHtml(entry.username)}</strong><div class="leaderboard-roster"><span class="leaderboard-avatar" aria-hidden="true">${avatarContent(entry)}</span><div class="leaderboard-team" aria-label="${entry.team.length - entry.fainted} surviving Pokémon and ${entry.fainted} fainted Pokémon">${entry.team.map((pokemon) => `<span class="leaderboard-mon ${pokemon.fainted ? "fainted" : "survived"}" title="${escapeHtml(pokemon.name)} — ${pokemon.fainted ? "fainted" : "survived"}"><img class="sprite" src="${sprite(pokemon.id, false, pokemon.spriteId, pokemon.shiny)}" alt="${escapeHtml(pokemon.name)}"></span>`).join("")}</div></div></div></li>`).join("")}</ol>`
          : '<div class="leaderboard-empty"><strong>No results yet</strong><span>Today’s first completed battle will appear here.</span></div>';
    const streakContent = leaderboardLoading
      ? '<div class="leaderboard-empty"><strong>Loading leaderboard…</strong></div>'
      : leaderboardError
        ? `<div class="leaderboard-empty"><strong>Could not load leaderboard</strong><span>${escapeHtml(leaderboardError)}</span></div>`
        : streakEntries.length
          ? `<ol class="leaderboard-list streak-list">${streakEntries.map((entry) => `<li class="leaderboard-row streak-row"><span class="leaderboard-rank" aria-label="Rank ${entry.rank}">${entry.rank}</span><div class="leaderboard-entry"><div class="leaderboard-identity"><span class="leaderboard-avatar" aria-hidden="true">${avatarContent(entry)}</span><strong>${escapeHtml(entry.username)}</strong></div></div><strong class="streak-count">${entry.streak}-day streak</strong></li>`).join("")}</ol>`
          : '<div class="leaderboard-empty"><strong>No active streaks yet</strong><span>Win today to start one.</span></div>';
    const content = leaderboardView === "daily" ? dailyContent : streakContent;
    return `<section class="screen">${header()}<div class="leaderboard-stage"><h2>Leaderboard</h2><div class="pc-detail-tabs leaderboard-tabs" role="tablist" aria-label="Leaderboard type"><button type="button" role="tab" aria-selected="${leaderboardView === "streak"}" class="${leaderboardView === "streak" ? "selected" : ""}" data-leaderboard-view="streak">Streak</button><button type="button" role="tab" aria-selected="${leaderboardView === "daily"}" class="${leaderboardView === "daily" ? "selected" : ""}" data-leaderboard-view="daily">Daily</button></div><div class="leaderboard-content" role="tabpanel">${content}</div>${backButton()}</div></section>`;
  }

  function settingsScreen() {
    const adminActions = currentUser?.isAdmin
      ? `<section class="more-developer" aria-labelledby="developer-actions-title"><h3 id="developer-actions-title">Developer</h3><div class="more-actions"><button class="gloss-button gold" type="button" data-route="config">Scheduler</button><button class="gloss-button slate" type="button" data-reset-daily-battle ${battleResetBusy || wipeMeBusy || !gameState?.dailyBattleAttempted ? "disabled" : ""}>${battleResetBusy ? "Resetting…" : "Battle reset"}</button><button class="gloss-button crystal" type="button" data-wipe-me ${wipeMeBusy || battleResetBusy ? "disabled" : ""}>${wipeMeBusy ? "Wiping…" : "Wipe me"}</button></div><small class="more-status" role="status" aria-live="polite">${escapeHtml(wipeMeMessage || battleResetMessage)}</small></section>`
      : "";
    return `<section class="screen">${header()}<div class="simple-stage more-stage"><h2>More</h2><div class="more-actions"><button class="gloss-button red" type="button" data-open-more-card="how-to-play">How to play</button><button class="gloss-button yellow" type="button" data-open-more-card="nuzlocke">What a Nuzlocke is</button><button class="gloss-button green" type="button" data-open-more-card="schedule">Schedule</button><button class="gloss-button blue" type="button" data-open-more-card="affiliation">Affiliation</button></div>${adminActions}${backButton()}</div>${moreCard()}</section>`;
  }

  function moreCard() {
    if (!moreCardOpen) return "";
    const cards = {
      "how-to-play": {
        title: "How to play",
        content: `<ol class="more-card-steps"><li><strong>Claim encounters.</strong> Each one joins your PC.</li><li><strong>Build a team.</strong> Choose up to six Pokémon, then adjust their training, moves, and held items.</li><li><strong>Challenge the daily trainer.</strong> Pick your lead and play out the simulated battle.</li><li><strong>Protect your run.</strong> A win earns money and encounters. A loss wipes your run... But you can always start fresh tomorrow!</li></ol>`,
      },
      nuzlocke: {
        title: "What a Nuzlocke is",
        content: `<p>A <a href="https://bulbapedia.bulbagarden.net/wiki/Nuzlocke_Challenge" target="_blank" rel="noopener noreferrer">Nuzlocke</a> is a fan-created way to make Pokémon more challenging. Encounters are limited, fainted Pokémon are lost forever, and losing a battle ends the run completely.</p><p>Nuzzle adapts those stakes into a daily puzzle game form: limited encounters are given, fainted Pokémon are automatically removed, and the loss of any battle wipes your entire box and ends your win streak.</p>`,
      },
      schedule: {
        title: "Battle schedule",
        content: `<dl class="battle-schedule"><div><dt>Sunday</dt><dd>Theme teams</dd></div><div><dt>Monday</dt><dd>Regular trainers</dd></div><div><dt>Tuesday</dt><dd>Ace trainers</dd></div><div><dt>Wednesday</dt><dd>Rival battles</dd></div><div><dt>Thursday</dt><dd>Gym leaders</dd></div><div><dt>Friday</dt><dd>Elite 4</dd></div><div><dt>Saturday</dt><dd>Champions</dd></div></dl><p class="schedule-note">On holidays, a special holiday-themed trainer may appear instead of the regularly scheduled opponent.</p><p class="schedule-reset">Battles reset each day at 12:00 AM Eastern Time (EST).</p>`,
      },
      affiliation: {
        title: "Affiliation",
        content: `<p><strong>Nuzzle is an unofficial, fan-made daily <a href="https://bulbapedia.bulbagarden.net/wiki/Nuzlocke_Challenge" target="_blank" rel="noopener noreferrer">Nuzlocke</a> battle simulator.</strong></p><p>It turns the fan-created, self-imposed rules of a Nuzlocke into a daily puzzle, similar in spirit to Wordle or Pokédoku but built around a simulated battle.</p><p>Battles use the open-source <a href="https://github.com/smogon/pokemon-showdown" target="_blank" rel="noopener noreferrer">Pokémon Showdown</a> engine. Sprites are used for identification and readability in place of a text-only display.</p><p>Nuzzle is not affiliated with or endorsed by Nintendo, Creatures Inc., GAME FREAK inc., The Pokémon Company, Smogon, or Pokémon Showdown. Pokémon, Pokémon character names, and sprites are © Nintendo, Creatures Inc., and GAME FREAK inc.</p>`,
      },
    };
    const card = cards[moreCardOpen];
    if (!card) return "";
    return `<div class="auth-backdrop more-card-backdrop" data-close-more-card><section class="auth-card more-card more-card-${moreCardOpen}" role="dialog" aria-modal="true" aria-labelledby="more-card-title"><button class="auth-close" type="button" aria-label="Close ${card.title}" data-close-more-card>×</button><h2 id="more-card-title">${card.title}</h2><div class="more-card-content">${card.content}</div><button class="gloss-button purple more-card-back" type="button" data-close-more-card>Back</button></section></div>`;
  }

  async function resetDailyBattle() {
    if (!currentUser?.isAdmin || battleResetBusy || !gameState?.dailyBattleAttempted) return;
    battleResetBusy = true;
    battleResetMessage = "";
    wipeMeMessage = "";
    render();
    try {
      await apiRequest("/api/admin/battle/reset", { method: "POST" });
      gameState.dailyBattleAttempted = false;
      gameState.dailyBattleId = null;
      gameState.dailyBattleEnded = false;
      battleState = null;
      resultOverlayOpen = false;
      localStorage.removeItem("nuzzleBattleId");
      battleResetMessage = "Today's battle is ready to play again.";
    } catch (error) {
      battleResetMessage = error.message;
    } finally {
      battleResetBusy = false;
      render();
    }
  }

  async function wipeMe() {
    if (!currentUser?.isAdmin || wipeMeBusy || battleResetBusy) return;
    if (!confirm("Wipe your run, remove today's battle and streak, and generate 12 fresh encounters?")) return;
    wipeMeBusy = true;
    wipeMeMessage = "";
    battleResetMessage = "";
    render();
    try {
      applyGameState(await apiRequest("/api/admin/wipe-me", { method: "POST" }));
      battleState = null;
      resultOverlayOpen = false;
      selectedPcId = null;
      encountersRevealedThisVisit = new Set();
      encounterListScrollTop = 0;
      localStorage.removeItem("nuzzleBattleId");
      wipeMeMessage = "Run wiped. Your 12 fresh encounters are ready.";
    } catch (error) {
      wipeMeMessage = error.message;
    } finally {
      wipeMeBusy = false;
      render();
    }
  }

  function formatGameDate(date) {
    const [year, month, day] = String(date || "").split("-");
    return `${Number(month)}/${Number(day)}/${year}`;
  }

  function trainerSpriteChoices(sprites, query = "") {
    const search = String(query).trim().toLowerCase();
    const matches = search
      ? sprites.filter((trainer) => trainer.id.includes(search) || trainer.name.toLowerCase().includes(search))
      : sprites;
    return matches.length
      ? matches.map((trainer) => `<button class="trainer-sprite-option" type="button" role="option" data-trainer-sprite-option="${trainer.id}"><strong>${escapeHtml(trainer.name)}</strong><small>${trainer.id}</small></button>`).join("")
      : '<p class="trainer-sprite-empty">No matching trainer sprites.</p>';
  }

  function configScreen() {
    if (!currentUser?.isAdmin) return settingsScreen();
    const current = adminConfig?.current;
    const queue = adminConfig?.queue || [];
    const sprites = adminConfig?.sprites || [];
    const validSprite = sprites.some((trainer) => trainer.id === trainerDraft.spriteId);
    const currentCard = current ? `<section class="config-current"><span>live now · Nuzzle #${current.number}</span><strong>${escapeHtml(current.trainer.name)}</strong><small>${formatGameDate(current.date)}</small><div>${current.trainer.pokemon.map((pokemon) => `<img class="sprite" src="${sprite(pokemon.id, false, pokemon.spriteId, pokemon.shiny)}" alt="${escapeHtml(pokemon.name)}">`).join("")}</div></section>` : "";
    const rows = queue.map((trainer, index) => `<article class="trainer-queue-row" data-trainer-row="${trainer.id}">
      <div class="trainer-order-controls"><button type="button" aria-label="Move ${escapeHtml(trainer.name)} up" data-move-trainer="${trainer.id}" data-direction="up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" aria-label="Move ${escapeHtml(trainer.name)} down" data-move-trainer="${trainer.id}" data-direction="down" ${index === queue.length - 1 ? "disabled" : ""}>↓</button></div>
      <div class="trainer-queue-copy"><span>${formatGameDate(trainer.scheduledDate)} · Nuzzle #${current ? current.number + index + 1 : index + 1}</span><strong>${escapeHtml(trainer.name)}</strong><div>${trainer.pokemon.map((pokemon) => `<img class="sprite" src="${sprite(pokemon.id, false, pokemon.spriteId, pokemon.shiny)}" alt="${escapeHtml(pokemon.name)}">`).join("")}</div></div>
      <img class="sprite trainer-queue-avatar" src="${trainerSprite(trainer.spriteId)}" alt="">
      <button class="trainer-remove" type="button" aria-label="Remove ${escapeHtml(trainer.name)}" data-remove-trainer="${trainer.id}">×</button>
    </article>`).join("");
    const form = trainerFormOpen ? `<form class="trainer-form" data-trainer-form>
      <div class="trainer-form-head"><h2>Add trainer</h2><button type="button" data-close-trainer-form aria-label="Close">×</button></div>
      <label>Trainer name<input name="name" maxlength="40" required placeholder="Misty" value="${escapeHtml(trainerDraft.name)}"></label>
      <div class="trainer-sprite-field"><label for="trainer-sprite-input">Trainer sprite</label><div class="trainer-sprite-combobox">
        <div class="trainer-sprite-input-row"><input id="trainer-sprite-input" name="spriteId" autocomplete="off" required value="${escapeHtml(trainerDraft.spriteId)}" data-trainer-sprite role="combobox" aria-autocomplete="list" aria-controls="trainer-sprite-menu" aria-expanded="false" placeholder="Choose or type to search"><button type="button" data-toggle-trainer-sprites aria-label="Show trainer sprites">▾</button></div>
        <div class="trainer-sprite-menu" id="trainer-sprite-menu" data-trainer-sprite-menu role="listbox" hidden>${trainerSpriteChoices(sprites)}</div>
      </div></div>
      <div class="trainer-sprite-preview${validSprite ? "" : " mystery"}"><img class="sprite" src="${validSprite ? trainerSprite(trainerDraft.spriteId) : mysteryTrainerSprite}" alt="${validSprite ? "Selected trainer sprite" : "Mystery trainer"}" data-trainer-sprite-preview></div>
      <label>Showdown team<textarea name="teamText" rows="14" required placeholder="Starmie @ Leftovers&#10;Ability: Natural Cure&#10;Level: 100&#10;- Surf&#10;- Psychic&#10;- Ice Beam&#10;- Recover">${escapeHtml(trainerDraft.teamText)}</textarea></label>
      <p class="config-help">Paste between one and six complete Showdown sets. Battle order is randomized.</p>
      ${configError ? `<p class="battle-error" role="alert">${escapeHtml(configError)}</p>` : ""}
      <button class="gloss-button blue" type="submit" ${configBusy ? "disabled" : ""}>${configBusy ? "Adding…" : "Add to queue"}</button>
    </form>` : "";
    return `<section class="screen config-screen">${header()}<div class="config-stage"><div class="config-heading"><div><p>Admin</p><h2>Scheduler</h2></div><button class="config-add" type="button" data-open-trainer-form aria-label="Add trainer">+</button></div>
      ${currentCard}${configError && !trainerFormOpen ? `<p class="battle-error" role="alert">${escapeHtml(configError)}</p>` : ""}
      <div class="trainer-queue" data-trainer-queue>${configBusy && !adminConfig ? '<p class="config-empty">Loading queue…</p>' : rows || '<p class="config-empty">No trainers queued. Brock will be used as the fallback.</p>'}</div>
      ${form}<button class="gloss-button purple config-back" type="button" data-route="settings">Back to More</button></div></section>`;
  }

  async function addTrainer(form) {
    if (configBusy) return;
    const data = new FormData(form);
    trainerDraft = { name: String(data.get("name") || ""), spriteId: String(data.get("spriteId") || ""), teamText: String(data.get("teamText") || "") };
    saveTrainerDraft();
    configBusy = true;
    configError = "";
    try {
      adminConfig = await apiRequest("/api/admin/trainers", {
        method: "POST",
        body: JSON.stringify(trainerDraft),
      });
      trainerFormOpen = false;
      clearTrainerDraft();
    } catch (error) {
      configError = error.message;
      trainerFormOpen = true;
    } finally {
      configBusy = false;
      render();
    }
  }

  async function removeTrainer(id) {
    if (configBusy) return;
    configBusy = true;
    try {
      adminConfig = await apiRequest(`/api/admin/trainers/${id}`, { method: "DELETE" });
      configError = "";
    } catch (error) {
      configError = error.message;
    } finally {
      configBusy = false;
      render();
    }
  }

  async function persistTrainerOrder(ids) {
    if (configBusy) return;
    configBusy = true;
    try {
      adminConfig = await apiRequest("/api/admin/trainers/order", { method: "PUT", body: JSON.stringify({ ids }) });
      configError = "";
    } catch (error) {
      configError = error.message;
      await loadAdminConfig();
      return;
    } finally {
      configBusy = false;
      render();
    }
  }

  function render() {
    if (route === "encounters") {
      const encounterList = document.querySelector(".encounter-list");
      if (encounterList) encounterListScrollTop = encounterList.scrollTop;
    }
    if (route === "mart") {
      const shopList = document.querySelector(".shop-list");
      if (shopList) martListScrollTop = shopList.scrollTop;
    }
    const currentLog = document.querySelector("[data-battle-log]");
    if (currentLog) {
      battleLogScrollTop = currentLog.scrollTop;
      battleLogFollow = currentLog.scrollHeight - currentLog.scrollTop - currentLog.clientHeight < 24;
      if (battleLogFollow) battleLogHasNew = false;
    }
    hideTooltip();
    const screens = { home, lead, battle, pc, bag, encounters: encountersScreen, mart, leaderboard: leaderboardScreen, settings: settingsScreen, config: configScreen };
    app.innerHTML = `${screens[route] ? screens[route]() : simpleScreen(route)}${welcomeCard()}`;
    bind();
    updateCountdown();
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
    const spriteSize = Math.min(180, arenaRect.width * .46) * .78 * .9;
    const anchorX = platformRect.left - arenaRect.left + platformRect.width / 2;
    const anchorY = platformRect.bottom - arenaRect.top - platformRect.height * .1 + 30 - spriteSize * .12;
    image.style.setProperty("--foe-sprite-size", `${spriteSize}px`);
    image.style.setProperty("--foe-sprite-left", `${anchorX - spriteSize / 2}px`);
    image.style.setProperty("--foe-sprite-top", `${anchorY - spriteSize}px`);
    slot.classList.add("is-aligned");
  }

  function alignPlayerSprite() {
    const arena = document.querySelector(".battle-arena");
    const platform = arena?.querySelector(".battle-platform.player");
    const slot = arena?.querySelector(".battler-slot.player");
    const image = slot?.querySelector(".active-sprite");
    const hud = arena?.querySelector(".battle-hud.player");
    if (!arena || !platform || !slot || !image || !hud) return;
    if (!image.complete || !image.naturalWidth) {
      image.addEventListener("load", alignPlayerSprite, { once: true });
      return;
    }
    const arenaRect = arena.getBoundingClientRect();
    const platformRect = platform.getBoundingClientRect();
    const hudRect = hud.getBoundingClientRect();
    const marker = "/assets/showdown/";
    const pathname = decodeURIComponent(new URL(image.currentSrc || image.src, location.href).pathname);
    const key = pathname.includes(marker) ? pathname.split(marker)[1] : "";
    const [visibleX, visibleY, visibleWidth, visibleHeight, canvasWidth, canvasHeight] = spriteBounds[key]
      || [0, 0, image.naturalWidth, image.naturalHeight, image.naturalWidth, image.naturalHeight];
    const inset = Math.max(6, arenaRect.height * .025);
    const safeLeft = inset;
    const safeRight = Math.max(safeLeft + 1, Math.min(arenaRect.width - inset, hudRect.left - arenaRect.left - inset));
    const safeTop = Math.max(inset, arenaRect.height * .23);
    const baseline = arenaRect.height - inset;
    const baseCanvasHeight = Math.min(210, arenaRect.width * .5, arenaRect.height * .9);
    const scale = Math.max(.01, Math.min(
      baseCanvasHeight / canvasHeight,
      (safeRight - safeLeft) / visibleWidth,
      (baseline - safeTop) / visibleHeight,
    ));
    const renderedWidth = canvasWidth * scale;
    const renderedHeight = canvasHeight * scale;
    const anchorX = platformRect.left - arenaRect.left + platformRect.width / 2;
    let left = anchorX - (visibleX + visibleWidth / 2) * scale;
    const visibleLeft = () => left + visibleX * scale;
    const visibleRight = () => visibleLeft() + visibleWidth * scale;
    if (visibleLeft() < safeLeft) left += safeLeft - visibleLeft();
    if (visibleRight() > safeRight) left -= visibleRight() - safeRight;
    const top = baseline - (visibleY + visibleHeight) * scale;
    image.style.setProperty("--player-sprite-left", `${left}px`);
    image.style.setProperty("--player-sprite-top", `${top}px`);
    image.style.setProperty("--player-sprite-width", `${renderedWidth}px`);
    image.style.setProperty("--player-sprite-height", `${renderedHeight}px`);
    image.dataset.visibleLeft = String(left + visibleX * scale);
    image.dataset.visibleRight = String(left + (visibleX + visibleWidth) * scale);
    image.dataset.visibleTop = String(top + visibleY * scale);
    image.dataset.visibleBottom = String(top + (visibleY + visibleHeight) * scale);
    image.dataset.safeLeft = String(safeLeft);
    image.dataset.safeRight = String(safeRight);
    image.dataset.safeTop = String(safeTop);
    image.dataset.safeBottom = String(baseline);
    slot.classList.add("is-aligned");
  }

  function alignBattleSprites() {
    alignOpponentSprite();
    alignPlayerSprite();
  }

  function showTooltip(target, html) {
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    const rect = target.getBoundingClientRect();
    const tip = tooltip.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportWidth = viewport?.width || innerWidth;
    const viewportHeight = viewport?.height || innerHeight;
    const left = Math.max(viewportLeft + 10, Math.min(viewportLeft + viewportWidth - tip.width - 10, rect.left));
    const top = rect.top > viewportTop + tip.height + 10
      ? rect.top - tip.height - 6
      : Math.min(viewportTop + viewportHeight - tip.height - 10, rect.bottom + 6);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(viewportTop + 10, top)}px`;
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  async function claimEncounter(slot) {
    if (gameBusy) return;
    gameBusy = true;
    try {
      applyGameState(await apiRequest(`/api/game/encounters/${slot}`, { method: "POST", body: "{}" }));
      encountersRevealedThisVisit.add(slot);
    } catch (error) {
      purchaseMessage = error.message;
    } finally {
      gameBusy = false;
      render();
    }
  }

  async function purchaseItem(item, quantity = 1) {
    if (gameBusy) return;
    gameBusy = true;
    try {
      applyGameState(await apiRequest(`/api/game/shop/${item.id}`, { method: "POST", body: JSON.stringify({ quantity }) }));
      purchaseMessage = `${quantity === 1 ? item.name : `${quantity} ${item.name}`} added to your bag.`;
      martSheetItemId = null;
      martSheetMode = null;
    } catch (error) {
      purchaseMessage = error.message;
    } finally {
      gameBusy = false;
      render();
    }
  }

  async function persistTeam(teamIds) {
    if (gameBusy) return;
    gameBusy = true;
    try {
      applyGameState(await apiRequest("/api/game/team", { method: "PUT", body: JSON.stringify({ teamIds }) }));
    } catch (error) {
      pcItemMessage = error.message;
    } finally {
      gameBusy = false;
      render();
    }
  }

  async function equipItem(item) {
    if (gameBusy) return;
    gameBusy = true;
    try {
      applyGameState(await apiRequest(`/api/game/pokemon/${selectedPcId}/equip`, { method: "POST", body: JSON.stringify({ itemId: item.id }) }));
      pcItemMessage = `${mons[selectedPcId].name} is now holding ${item.name}.`;
    } catch (error) {
      pcItemMessage = error.message;
    } finally {
      gameBusy = false;
      render();
    }
  }

  async function unequipItem() {
    if (gameBusy || !selectedPcId) return;
    gameBusy = true;
    const pokemonName = mons[selectedPcId].name;
    try {
      applyGameState(await apiRequest(`/api/game/pokemon/${selectedPcId}/unequip`, { method: "POST", body: "{}" }));
      pcItemMessage = `${pokemonName}'s held item was returned to the Bag.`;
    } catch (error) {
      pcItemMessage = error.message;
    } finally {
      gameBusy = false;
      render();
    }
  }

  async function trainPokemon(item, options) {
    if (gameBusy) return;
    gameBusy = true;
    const previousId = selectedPcId;
    try {
      const next = await apiRequest(`/api/game/pokemon/${selectedPcId}/train`, { method: "POST", body: JSON.stringify({ itemId: item.id, options }) });
      applyGameState(next);
      if (!mons[selectedPcId]) {
        const expectedId = options.form || item.target;
        selectedPcId = mons[expectedId] ? expectedId : pcOrder.find((id) => mons[id]?.encounterFamilyId === pokemonContent.get(previousId)?.encounterFamilyId) || null;
      }
      pcItemMessage = `${item.name} used successfully.`;
      pcItemMode = false;
      pendingPcItemId = null;
    } catch (error) {
      pcItemMessage = error.message;
    } finally {
      gameBusy = false;
      render();
    }
  }

  function hasPendingTraining(mon = mons[selectedPcId]) {
    return Boolean(mon && trainingDraft && localTrainingQuote(mon).changed);
  }

  async function applyTraining() {
    const mon = mons[selectedPcId];
    if (gameBusy || !mon || !trainingDraft) return;
    const quote = localTrainingQuote(mon);
    if (!quote.changed || quote.total > balance) return;
    gameBusy = true;
    trainingMessage = "";
    const targetSpeciesId = trainingDraft.speciesId;
    try {
      const result = await apiRequest(`/api/game/pokemon/${selectedPcId}/training/apply`, {
        method: "POST",
        body: JSON.stringify({ build: trainingDraft, expectedCost: quote.total, idempotencyKey: trainingTransactionKey }),
      });
      applyGameState(result.state);
      selectedPcId = mons[targetSpeciesId] ? targetSpeciesId : selectedPcId;
      beginTraining(mons[selectedPcId]);
      trainingMessage = `Training applied for ₽${quote.total.toLocaleString()}.`;
    } catch (error) {
      trainingMessage = error.message;
    } finally {
      gameBusy = false;
      render();
    }
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
    alignBattleSprites();
    const encounterList = document.querySelector(".encounter-list");
    if (encounterList) {
      encounterList.scrollTop = encounterListScrollTop;
      encounterList.addEventListener("scroll", () => {
        encounterListScrollTop = encounterList.scrollTop;
      }, { passive: true });
    }
    const shopList = document.querySelector(".shop-list");
    if (shopList) {
      shopList.scrollTop = martListScrollTop;
      shopList.addEventListener("scroll", () => {
        martListScrollTop = shopList.scrollTop;
      }, { passive: true });
    }
    document.querySelector("[data-toggle-theme]")?.addEventListener("click", (event) => {
      theme = theme === "dark" ? "light" : "dark";
      localStorage.setItem("nuzzleTheme", theme);
      event.currentTarget.setAttribute("aria-checked", String(theme === "dark"));
      event.currentTarget.setAttribute("aria-label", `Use ${theme === "dark" ? "light" : "dark"} mode`);
      applyTheme();
    });
    document.querySelector("[data-open-account]")?.addEventListener("click", () => {
      resetAuthDialog();
      authOpen = true;
      authMode = "login";
      authError = "";
      avatarPickerOpen = false;
      avatarQuery = "";
      avatarError = "";
      pendingRoute = null;
      render();
      requestAnimationFrame(() => document.querySelector(currentUser ? "[data-logout]" : "#auth-username")?.focus({ preventScroll: true }));
    });
    document.querySelectorAll("[data-close-auth]").forEach((element) => element.addEventListener("click", (event) => {
      if (element.classList.contains("auth-backdrop") && event.target !== element) return;
      authOpen = false;
      avatarPickerOpen = false;
      avatarQuery = "";
      resetAuthDialog();
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
    document.querySelector("[data-dismiss-welcome]")?.addEventListener("click", () => void dismissWelcome());
    document.querySelector("[data-edit-avatar]")?.addEventListener("click", () => {
      avatarPickerOpen = true;
      avatarQuery = "";
      avatarError = "";
      render();
      void loadAvatarSprites();
    });
    document.querySelector("[data-cancel-avatar]")?.addEventListener("click", () => {
      avatarPickerOpen = false;
      avatarQuery = "";
      avatarError = "";
      render();
      requestAnimationFrame(() => document.querySelector("[data-edit-avatar]")?.focus({ preventScroll: true }));
    });
    const avatarSearch = document.querySelector("[data-avatar-search]");
    avatarSearch?.addEventListener("input", () => {
      avatarQuery = avatarSearch.value;
      const grid = document.querySelector("[data-avatar-grid]");
      if (grid) grid.innerHTML = avatarChoices();
    });
    document.querySelector("[data-avatar-grid]")?.addEventListener("click", (event) => {
      const choice = event.target.closest("[data-avatar-sprite]");
      if (!choice) return;
      void selectAvatar(choice.dataset.avatarSprite);
    });
    document.querySelectorAll("[data-route]").forEach((button) => button.addEventListener("click", () => {
      const requestedRoute = button.dataset.route;
      if (!currentUser && requestedRoute !== "home") {
        openAuth(requestedRoute);
        return;
      }
      let nextRoute = requestedRoute === "lead" && battleState && !battleState.ended ? "battle" : requestedRoute;
      if (nextRoute === "config" && !currentUser?.isAdmin) nextRoute = "settings";
      if (route === "encounters" && nextRoute !== "encounters") {
        encountersRevealedThisVisit = new Set();
        encounterListScrollTop = 0;
      }
      if (route === "mart" && nextRoute !== "mart") {
        martSheetItemId = null;
        martSheetMode = null;
        martListScrollTop = 0;
      }
      if (nextRoute !== "pc") {
        selectedPcId = null;
        selectedTrainerPokemon = null;
        pcSummaryMoveId = null;
      }
      if (nextRoute !== "settings") moreCardOpen = null;
      route = nextRoute;
      if (route === "battle" && battleState?.ended) resultOverlayOpen = true;
      if (route === "lead") selectedLeadId = null;
      if (route === "mart") purchaseMessage = "";
      render();
      scrollTo(0, 0);
      if (route === "config" && !adminConfig) void loadAdminConfig();
      if (route === "leaderboard") void loadLeaderboard();
    }));
    document.querySelectorAll("[data-leaderboard-view]").forEach((button) => button.addEventListener("click", () => {
      leaderboardView = button.dataset.leaderboardView;
      render();
    }));
    document.querySelectorAll("[data-open-more-card]").forEach((button) => button.addEventListener("click", () => {
      moreCardOpen = button.dataset.openMoreCard;
      render();
      requestAnimationFrame(() => document.querySelector(".more-card .auth-close")?.focus({ preventScroll: true }));
    }));
    document.querySelectorAll("[data-close-more-card]").forEach((element) => element.addEventListener("click", (event) => {
      if (element.classList.contains("more-card-backdrop") && event.target !== element) return;
      const trigger = moreCardOpen;
      moreCardOpen = null;
      render();
      requestAnimationFrame(() => document.querySelector(`[data-open-more-card="${trigger}"]`)?.focus({ preventScroll: true }));
    }));
    document.querySelector("[data-open-trainer-form]")?.addEventListener("click", () => {
      trainerFormOpen = true;
      configError = "";
      render();
    });
    document.querySelector("[data-close-trainer-form]")?.addEventListener("click", () => {
      trainerFormOpen = false;
      configError = "";
      render();
    });
    const trainerForm = document.querySelector("[data-trainer-form]");
    trainerForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      void addTrainer(event.currentTarget);
    });
    trainerForm?.querySelectorAll('[name="name"], [name="teamText"]').forEach((field) => field.addEventListener("input", () => {
      trainerDraft[field.name] = field.value;
      saveTrainerDraft();
    }));
    const spriteInput = trainerForm?.querySelector("[data-trainer-sprite]");
    const spriteMenu = trainerForm?.querySelector("[data-trainer-sprite-menu]");
    const spritePreview = trainerForm?.querySelector("[data-trainer-sprite-preview]");
    const availableSprites = adminConfig?.sprites || [];
    const availableSpriteIds = new Set(availableSprites.map((trainer) => trainer.id));
    const updateSpritePreview = (value) => {
      if (!spritePreview) return;
      const valid = availableSpriteIds.has(value);
      spriteInput?.setCustomValidity(value && !valid ? "Choose a trainer sprite from the dropdown." : "");
      spritePreview.src = valid ? trainerSprite(value) : mysteryTrainerSprite;
      spritePreview.alt = valid ? "Selected trainer sprite" : "Mystery trainer";
      spritePreview.parentElement?.classList.toggle("mystery", !valid);
    };
    const openSpriteMenu = (query = "") => {
      if (!spriteMenu || !spriteInput) return;
      spriteMenu.innerHTML = trainerSpriteChoices(availableSprites, query);
      spriteMenu.hidden = false;
      spriteInput.setAttribute("aria-expanded", "true");
    };
    const closeSpriteMenu = () => {
      if (!spriteMenu || !spriteInput) return;
      spriteMenu.hidden = true;
      spriteInput.setAttribute("aria-expanded", "false");
    };
    spriteInput?.addEventListener("focus", () => openSpriteMenu(spriteInput.value));
    spriteInput?.addEventListener("input", () => {
      trainerDraft.spriteId = spriteInput.value.trim();
      saveTrainerDraft();
      updateSpritePreview(trainerDraft.spriteId);
      openSpriteMenu(spriteInput.value);
    });
    trainerForm?.querySelector("[data-toggle-trainer-sprites]")?.addEventListener("click", () => {
      if (!spriteMenu || !spriteInput) return;
      if (spriteMenu.hidden) {
        spriteInput.focus();
        openSpriteMenu();
      } else closeSpriteMenu();
    });
    spriteMenu?.addEventListener("click", (event) => {
      const option = event.target.closest("[data-trainer-sprite-option]");
      if (!option || !spriteInput) return;
      trainerDraft.spriteId = option.dataset.trainerSpriteOption;
      spriteInput.value = trainerDraft.spriteId;
      saveTrainerDraft();
      updateSpritePreview(trainerDraft.spriteId);
      closeSpriteMenu();
      spriteInput.focus();
    });
    if (spriteInput) updateSpritePreview(spriteInput.value);
    document.querySelectorAll("[data-remove-trainer]").forEach((button) => button.addEventListener("click", () => void removeTrainer(button.dataset.removeTrainer)));
    document.querySelectorAll("[data-move-trainer]").forEach((button) => button.addEventListener("click", () => {
      const ids = (adminConfig?.queue || []).map((trainer) => trainer.id);
      const from = ids.indexOf(button.dataset.moveTrainer);
      const to = button.dataset.direction === "up" ? from - 1 : from + 1;
      if (from < 0 || to < 0 || to >= ids.length) return;
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      void persistTrainerOrder(ids);
    }));
    document.querySelectorAll("[data-select-lead]").forEach((button) => button.addEventListener("click", () => {
      selectedLeadId = button.dataset.selectLead;
      document.querySelectorAll("[data-select-lead]").forEach((choice) => {
        const selected = choice.dataset.selectLead === selectedLeadId;
        choice.classList.toggle("selected", selected);
        choice.setAttribute("aria-pressed", String(selected));
      });
      const details = document.querySelector("[data-lead-details]");
      if (details) details.innerHTML = leadDetails(selectedLeadId);
      document.querySelector("[data-start-battle]")?.removeAttribute("disabled");
    }));
    document.querySelector("[data-start-battle]")?.addEventListener("click", startBattle);
    document.querySelectorAll("[data-battle-switch]").forEach((button) => button.addEventListener("click", () => submitBattleChoice({ type: "switch", slot: Number(button.dataset.battleSwitch) })));
    document.querySelectorAll("[data-battle-move]").forEach((button) => button.addEventListener("click", () => submitBattleChoice({ type: "move", slot: Number(button.dataset.battleMove) })));
    document.querySelector("[data-forfeit-battle]")?.addEventListener("click", forfeitBattle);
    document.querySelector("[data-open-result]")?.addEventListener("click", () => {
      resultOverlayOpen = true;
      render();
    });
    document.querySelectorAll("[data-close-result]").forEach((element) => element.addEventListener("click", (event) => {
      if (element.classList.contains("result-backdrop") && event.target !== element) return;
      resultOverlayOpen = false;
      render();
      requestAnimationFrame(() => document.querySelector("[data-open-result]")?.focus({ preventScroll: true }));
    }));
    document.querySelector("[data-reset-daily-battle]")?.addEventListener("click", resetDailyBattle);
    document.querySelector("[data-wipe-me]")?.addEventListener("click", wipeMe);
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
    document.querySelectorAll("[data-encounter]").forEach((button) => button.addEventListener("click", () => void claimEncounter(Number(button.dataset.encounter))));
    const bindShopRows = () => {
      document.querySelectorAll("[data-open-purchase]").forEach((button) => button.addEventListener("click", () => {
        martSheetItemId = button.dataset.openPurchase;
        martSheetMode = "buy";
        render();
        requestAnimationFrame(() => document.querySelector("[data-purchase-form] button[type='submit']")?.focus({ preventScroll: true }));
      }));
    };
    document.querySelectorAll("[data-shop-group]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.shopGroup === activeShopGroup) return;
      activeShopGroup = button.dataset.shopGroup;
      martSearch = "";
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
      const search = document.querySelector("[data-mart-search]");
      if (search) search.value = "";
      const count = document.querySelector("[data-mart-search-count]");
      const itemCount = shopItems.filter((item) => item.group === activeShopGroup).length;
      if (count) count.textContent = `${itemCount} matching item${itemCount === 1 ? "" : "s"}`;
      martListScrollTop = 0;
      shopList.scrollTop = 0;
      bindShopRows();
    }));
    bindShopRows();
    document.querySelector("[data-mart-search]")?.addEventListener("input", (event) => {
      martSearch = event.currentTarget.value;
      const query = martSearch.trim().toLowerCase();
      let matchCount = 0;
      document.querySelectorAll("[data-mart-search-text]").forEach((row) => {
        const matches = !query || row.dataset.martSearchText.includes(query);
        row.hidden = !matches;
        if (matches) matchCount++;
      });
      const empty = document.querySelector("[data-mart-search-empty]");
      if (empty) empty.hidden = matchCount > 0;
      const count = document.querySelector("[data-mart-search-count]");
      if (count) count.textContent = `${matchCount} matching item${matchCount === 1 ? "" : "s"}`;
    });
    document.querySelectorAll("[data-close-mart-sheet]").forEach((element) => element.addEventListener("click", (event) => {
      if (element.classList.contains("mart-sheet-backdrop") && event.target !== element) return;
      martSheetItemId = null;
      martSheetMode = null;
      render();
    }));
    document.querySelector("[data-purchase-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const item = shopItems.find((candidate) => candidate.id === event.currentTarget.dataset.purchaseForm);
      if (item) void purchaseItem(item);
    });
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
      bagSearch = "";
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
      const search = document.querySelector("[data-bag-search]");
      if (search) search.value = "";
      const count = document.querySelector("[data-bag-search-count]");
      const itemCount = shopItems.filter((item) => item.group === activeBagGroup && inventory[item.id]).length;
      if (count) count.textContent = `${itemCount} matching item${itemCount === 1 ? "" : "s"}`;
      bindVisitMart();
    }));
    bindVisitMart();
    document.querySelector("[data-bag-search]")?.addEventListener("input", (event) => {
      bagSearch = event.currentTarget.value;
      const query = bagSearch.trim().toLowerCase();
      let matchCount = 0;
      document.querySelectorAll("[data-bag-search-text]").forEach((row) => {
        const matches = !query || row.dataset.bagSearchText.includes(query);
        row.hidden = !matches;
        if (matches) matchCount++;
      });
      const empty = document.querySelector("[data-bag-search-empty]");
      if (empty) empty.hidden = matchCount > 0;
      const count = document.querySelector("[data-bag-search-count]");
      if (count) count.textContent = `${matchCount} matching item${matchCount === 1 ? "" : "s"}`;
    });
    document.querySelectorAll("[data-trainer-pokemon]").forEach((button) => button.addEventListener("click", () => { selectedTrainerPokemon = Number(button.dataset.trainerPokemon); render(); }));
    document.querySelectorAll("[data-close-trainer-pokemon]").forEach((element) => element.addEventListener("click", (event) => {
      if (element.classList.contains("trainer-scout-backdrop") && event.target !== element) return;
      selectedTrainerPokemon = null;
      render();
    }));
    document.querySelectorAll("[data-pc-detail]").forEach((button) => button.addEventListener("click", () => { selectedPcId = button.dataset.pcDetail; pcDetailView = "summary"; pcSummaryMoveId = null; pcSwapMode = false; pcItemMode = false; pendingPcItemId = null; selectedNature = null; pcItemMessage = ""; trainingDraft = null; trainingMoveSlot = null; trainingMessage = ""; render(); }));
    document.querySelectorAll("[data-pc-detail-view]").forEach((button) => button.addEventListener("click", () => {
      pcDetailView = button.dataset.pcDetailView;
      if (pcDetailView === "training" && !trainingDraft) beginTraining(mons[selectedPcId]);
      render();
    }));
    document.querySelectorAll("[data-close-pc-sheet]").forEach((element) => element.addEventListener("click", (event) => {
      if (element.classList.contains("sheet-backdrop") && event.target !== element) return;
      if (hasPendingTraining() && !window.confirm("Discard your pending training changes?")) return;
      selectedPcId = null;
      pcSummaryMoveId = null;
      pcSwapMode = false;
      pcItemMode = false;
      pendingPcItemId = null;
      selectedNature = null;
      trainingDraft = null;
      trainingMoveSlot = null;
      render();
    }));
    document.querySelectorAll("[data-summary-move]").forEach((button) => button.addEventListener("click", () => { pcSummaryMoveId = button.dataset.summaryMove; render(); }));
    document.querySelectorAll("[data-close-summary-move]").forEach((element) => element.addEventListener("click", (event) => {
      if (element.classList.contains("summary-move-backdrop") && event.target !== element) return;
      pcSummaryMoveId = null;
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
      if (item.group !== "Held Items") {
        pendingPcItemId = item.id;
        selectedNature = null;
        render();
        return;
      }
      void equipItem(item);
    }));
    document.querySelector("[data-pc-unequip]")?.addEventListener("click", () => void unequipItem());
    document.querySelector("[data-train-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const item = shopItems.find((candidate) => candidate.id === event.currentTarget.dataset.itemId);
      const fields = new FormData(event.currentTarget);
      const options = Object.fromEntries(fields.entries());
      if (options.quantity) options.quantity = Number(options.quantity);
      if (options.value) options.value = Number(options.value);
      if (options.slot !== undefined) options.slot = Number(options.slot);
      if (item) void trainPokemon(item, options);
    });
    const updateTrainingEv = (stat, rawValue) => {
        const otherTotal = Object.entries(trainingDraft.evs).reduce((sum, [key, value]) => sum + (key === stat ? 0 : value), 0);
        trainingDraft.evs[stat] = Math.max(0, Math.min(252, 510 - otherTotal, Math.round(Number(rawValue) || 0)));
        const slider = document.querySelector(`[data-training-ev="${stat}"]`);
        const numeric = document.querySelector(`[data-training-ev-input="${stat}"]`);
        if (slider) slider.value = trainingDraft.evs[stat];
        if (numeric) numeric.value = trainingDraft.evs[stat];
        const result = slider?.closest(".training-editor-row")?.querySelector(".training-final-value");
        if (result) result.textContent = previewTrainingStats(mons[selectedPcId])[stat];
        const remaining = document.querySelector(".training-remaining span");
        if (remaining) remaining.textContent = `${510 - Object.values(trainingDraft.evs).reduce((sum, value) => sum + value, 0)} EVs remaining`;
    };
    document.querySelectorAll("[data-training-ev]").forEach((input) => {
      input.addEventListener("input", () => updateTrainingEv(input.dataset.trainingEv, input.value));
      input.addEventListener("change", () => { updateTrainingEv(input.dataset.trainingEv, input.value); render(); });
    });
    document.querySelectorAll("[data-training-ev-input]").forEach((input) => {
      input.addEventListener("input", () => updateTrainingEv(input.dataset.trainingEvInput, input.value));
      input.addEventListener("change", () => { updateTrainingEv(input.dataset.trainingEvInput, input.value); setTimeout(render, 0); });
    });
    document.querySelectorAll("[data-training-iv]").forEach((input) => {
      const update = () => {
        const stat = input.dataset.trainingIv;
        trainingDraft.ivs[stat] = Math.max(0, Math.min(31, Math.round(Number(input.value) || 0)));
        input.value = trainingDraft.ivs[stat];
        const result = input.closest(".training-editor-row")?.querySelector(".training-final-value");
        if (result) result.textContent = previewTrainingStats(mons[selectedPcId])[stat];
      };
      input.addEventListener("input", update);
      input.addEventListener("change", () => { update(); setTimeout(render, 0); });
    });
    document.querySelectorAll("[data-max-training-iv]").forEach((button) => button.addEventListener("click", () => {
      trainingDraft.ivs[button.dataset.maxTrainingIv] = 31;
      render();
    }));
    document.querySelector("[data-reset-evs]")?.addEventListener("click", () => {
      for (const stat of Object.keys(trainingDraft.evs)) trainingDraft.evs[stat] = 0;
      render();
    });
    document.querySelector("[data-training-nature]")?.addEventListener("change", (event) => { trainingDraft.nature = event.currentTarget.value; render(); });
    document.querySelector("[data-training-ability]")?.addEventListener("change", (event) => { trainingDraft.ability = event.currentTarget.value; render(); });
    document.querySelector("[data-training-form]")?.addEventListener("change", (event) => {
      trainingDraft.speciesId = event.currentTarget.value;
      const form = trainingForm(mons[selectedPcId]);
      const abilities = [...form.ordinaryAbilities, form.hiddenAbility].filter(Boolean);
      if (!abilities.includes(trainingDraft.ability)) trainingDraft.ability = form.ordinaryAbilities[0];
      render();
    });
    document.querySelectorAll("[data-edit-training-move]").forEach((button) => button.addEventListener("click", () => { trainingMoveSlot = Number(button.dataset.editTrainingMove); trainingMoveSearch = ""; render(); }));
    document.querySelector("[data-close-move-picker]")?.addEventListener("click", () => { trainingMoveSlot = null; trainingMoveSearch = ""; render(); });
    document.querySelector("[data-training-move-search]")?.addEventListener("input", (event) => {
      trainingMoveSearch = event.currentTarget.value;
      const query = trainingMoveSearch.trim().toLowerCase();
      const picker = event.currentTarget.closest(".training-move-picker");
      let matchCount = 0;
      picker?.querySelectorAll("[data-select-training-move]").forEach((button) => {
        const matches = !query || button.dataset.moveSearchText.includes(query);
        button.hidden = !matches;
        if (matches) matchCount += 1;
      });
      const count = picker?.querySelector("[data-training-move-count]");
      if (count) count.textContent = `${matchCount} matching move${matchCount === 1 ? "" : "s"}`;
      const empty = picker?.querySelector(".training-empty");
      if (empty) empty.hidden = Boolean(matchCount);
    });
    document.querySelectorAll("[data-select-training-move]").forEach((button) => button.addEventListener("click", () => {
      const item = shopItems.find((candidate) => candidate.id === button.dataset.selectTrainingMove);
      if (!item) return;
      trainingDraft.moves[trainingMoveSlot] = item.move;
      trainingMoveSlot = null;
      trainingMoveSearch = "";
      render();
    }));
    document.querySelector("[data-reset-training]")?.addEventListener("click", () => { beginTraining(mons[selectedPcId]); render(); });
    document.querySelector("[data-apply-training]")?.addEventListener("click", () => void applyTraining());
    document.querySelectorAll("[data-quick-team-remove]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.quickTeamRemove;
      void persistTeam([...team].filter((teamId) => teamId !== id));
    }));
    document.querySelectorAll("[data-quick-team-add]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.quickTeamAdd;
      if (team.size < 6) {
        void persistTeam([...team, id]);
        return;
      }
      selectedPcId = id;
      pcDetailView = "summary";
      pcSwapMode = true;
      pcItemMode = false;
      pendingPcItemId = null;
      selectedNature = null;
      pcItemMessage = "";
      trainingDraft = null;
      render();
    }));
    document.querySelector("[data-team-toggle]")?.addEventListener("click", (event) => {
      const id = event.currentTarget.dataset.teamToggle;
      if (team.has(id)) {
        const nextTeam = [...team].filter((teamId) => teamId !== id);
        selectedPcId = null;
        pcSwapMode = false;
        pcItemMode = false;
        pendingPcItemId = null;
        selectedNature = null;
        render();
        void persistTeam(nextTeam);
        return;
      }
      else if (team.size < 6) {
        void persistTeam([...team, id]);
        return;
      }
      else pcSwapMode = true;
      render();
    });
    document.querySelectorAll("[data-team-replace]").forEach((button) => button.addEventListener("click", () => {
      const outgoingId = button.dataset.teamReplace;
      const nextTeam = [...team].map((id) => id === outgoingId ? selectedPcId : id);
      pcSwapMode = false;
      void persistTeam(nextTeam);
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
      if (event.key === "Escape" && moreCardOpen) {
        const trigger = moreCardOpen;
        moreCardOpen = null;
        render();
        requestAnimationFrame(() => document.querySelector(`[data-open-more-card="${trigger}"]`)?.focus());
      } else if (event.key === "Escape" && authOpen) {
        authOpen = false;
        resetAuthDialog();
        pendingRoute = null;
        render();
        requestAnimationFrame(() => document.querySelector("[data-open-account]")?.focus());
      } else if (event.key === "Escape" && battleLogExpanded) {
        battleLogExpanded = false;
        render();
        requestAnimationFrame(() => document.querySelector("[data-toggle-battle-log]")?.focus());
      } else if (event.key === "Escape" && selectedTrainerPokemon !== null) {
        selectedTrainerPokemon = null;
        render();
      } else if (event.key === "Escape" && selectedPcId) {
        if (pcSummaryMoveId) pcSummaryMoveId = null;
        else if (pcSwapMode) pcSwapMode = false;
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
        const sourceCard = element.closest(".pc-mon-card");
        const targetCard = target.closest(".pc-mon-card");
        targetCard.parentElement.insertBefore(sourceCard, to > from ? targetCard.nextSibling : targetCard);
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
        pcDetailView = "summary";
        pcSummaryMoveId = null;
        pcSwapMode = false;
        pcItemMode = false;
        pendingPcItemId = null;
        selectedNature = null;
        pcItemMessage = "";
        trainingDraft = null;
        trainingMoveSlot = null;
        trainingMessage = "";
        render();
      });
    });
  }

  async function resumeBattle(shouldRender = true) {
    if (!currentUser) return;
    const battleId = gameState?.dailyBattleAttempted && gameState?.dailyBattleId
      ? gameState.dailyBattleId
      : localStorage.getItem("nuzzleBattleId");
    if (!battleId) return;
    try {
      acceptBattleState(await apiRequest(`/api/battles/${battleId}`));
      localStorage.setItem("nuzzleBattleId", battleId);
      if (!battleState.ended) route = "battle";
    } catch (error) {
      localStorage.removeItem("nuzzleBattleId");
      battleError = error.message;
    }
    if (shouldRender) render();
  }

  async function loadSession() {
    try {
      await Promise.all([loadContent(), loadToday()]);
      const result = await apiRequest("/api/auth/me");
      currentUser = result.user;
      welcomeOpen = Boolean(currentUser && !currentUser.welcomeSeen);
      welcomeError = "";
      loadTrainerDraft();
      if (currentUser) {
        await loadGame();
        await resumeBattle(false);
      }
    } catch {
      currentUser = null;
    }
    render();
  }

  applyTheme();
  render();
  window.addEventListener("resize", alignBattleSprites);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    void loadToday().then(async () => {
      if (currentUser) await loadGame();
      render();
    }).catch(() => {});
  });
  void loadSession();
})();
