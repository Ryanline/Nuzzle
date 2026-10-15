(function () {
  "use strict";

  const DATA = window.NUZZLE_DATA;
  const STORAGE_KEY = "nuzzle-preview-v2";
  const spriteBase = "https://play.pokemonshowdown.com/sprites/gen5/";
  const backSpriteBase = "https://play.pokemonshowdown.com/sprites/gen5-back/";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let currentRoute = "today";
  let toastTimer;
  let battleState = null;
  let battleBusy = false;

  function gameDate() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date()).reduce((out, part) => ({ ...out, [part.type]: part.value }), {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function hash(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function random(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(pool, rng) {
    return pool[Math.floor(rng() * pool.length)];
  }

  function initialState() {
    const date = gameDate();
    const profileSeed = crypto.getRandomValues(new Uint32Array(1))[0];
    const rng = random(hash(`${date}:${profileSeed}:fresh-run`));
    const starters = DATA.species.filter((mon) => mon.starter);
    const ordinary = DATA.species.filter((mon) => !mon.starter);
    const chosen = [pick(starters, rng)];
    while (chosen.length < 10) {
      const candidate = pick(ordinary, rng);
      if (!chosen.some((mon) => mon.id === candidate.id)) chosen.push(candidate);
    }
    const encounters = chosen.map((mon, index) => ({
      encounterId: `${date}-${index + 1}`,
      speciesId: mon.id,
      moves: generateMoves(mon, random(hash(`${date}:${profileSeed}:${mon.id}:${index}`))),
      revealed: false
    }));
    return {
      version: 2, date, profileSeed, encounters, roster: [], party: [], lead: null,
      money: 2400, inventory: {}, streak: 0, wipes: 0, badges: 0, eliteWins: 0, championWins: 0
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.version === 2) return saved;
    } catch (error) {
      console.warn("Could not load Nuzzle preview state", error);
    }
    const fresh = initialState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }

  let state = loadState();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function species(id) {
    return DATA.species.find((mon) => mon.id === id);
  }

  function sprite(mon) {
    return `${spriteBase}${mon.sprite || mon.id}.png`;
  }

  function generateMoves(mon, rng) {
    const moves = mon.moves.map(([id, name, type, bp, category]) => ({ id, name, type, bp, category }));
    const selected = [];
    const unused = (category, type) => moves.filter((move) => !selected.includes(move) && (!category || move.category === category) && (!type || move.type === type));

    mon.types.forEach((type) => {
      const ordinary = unused("ordinary", type).sort((a, b) => b.bp - a.bp);
      if (ordinary.length) {
        const cutoff = ordinary[Math.min(2, ordinary.length - 1)].bp;
        selected.push(pick(ordinary.filter((move) => move.bp >= cutoff), rng));
      } else {
        const backup = unused("backup", type);
        if (backup.length) selected.push(pick(backup, rng));
      }
    });

    while (selected.filter((move) => move.category !== "status").length < 3) {
      const ordinary = unused("ordinary");
      const backup = unused("backup");
      if (ordinary.length) selected.push(pick(ordinary, rng));
      else if (backup.length) selected.push(pick(backup, rng));
      else break;
    }
    while (selected.length < 4) {
      const remaining = unused();
      if (!remaining.length) break;
      selected.push(pick(remaining, rng));
    }
    return selected.map((move) => move.id);
  }

  function moveDetails(mon, moveId) {
    const raw = mon.moves.find((move) => move[0] === moveId);
    return raw ? { id: raw[0], name: raw[1], type: raw[2], bp: raw[3], category: raw[4] } : null;
  }

  function dateInfo() {
    const [year, month, day] = state.date.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const finaleIndex = day - (lastDay - 5);
    let tier = "regular";
    let label = "Regular trainer";
    if (finaleIndex >= 1 && finaleIndex <= 4) { tier = "elite"; label = `Elite Four · ${finaleIndex}`; }
    else if (finaleIndex === 5) { tier = "champion"; label = "Champion"; }
    else if (date.getUTCDay() === 5) { tier = "gym"; label = "Friday Gym"; }
    const display = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
    return { tier, label, display, sunday: date.getUTCDay() === 0 };
  }

  function opponent() {
    return DATA.trainers[dateInfo().tier];
  }

  function route(name) {
    currentRoute = name;
    document.body.classList.toggle("battle-mode", name === "battle");
    $$('[data-view]').forEach((view) => { view.hidden = view.dataset.view !== name; });
    $$('[data-route]').forEach((button) => {
      if (button.closest("nav")) button.setAttribute("aria-current", button.dataset.route === name ? "page" : "false");
    });
    render();
    $("#main").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function typeTags(types) {
    return `<div class="types">${types.map((type) => `<span class="type">${type}</span>`).join("")}</div>`;
  }

  function battleLogLine(line) {
    const parts = line.split("|");
    const actor = (parts[2] || "").replace(/^p[12]a: /, "");
    if (parts[1] === "turn") return `<strong>Turn ${parts[2]}</strong>`;
    if (parts[1] === "move") return `<span><b>${actor}</b> used ${parts[3]}!</span>`;
    if (parts[1] === "switch" || parts[1] === "drag") return `<span><b>${actor}</b> entered the battle.</span>`;
    if (parts[1] === "faint") return `<span><b>${actor}</b> fainted!</span>`;
    if (parts[1] === "-supereffective") return "<span>It's super effective!</span>";
    if (parts[1] === "-resisted") return "<span>It's not very effective…</span>";
    if (parts[1] === "-crit") return "<span>A critical hit!</span>";
    if (parts[1] === "-status") return `<span><b>${actor}</b> was afflicted with ${parts[3]}.</span>`;
    if (parts[1] === "cant") return `<span><b>${actor}</b> couldn't move.</span>`;
    if (parts[1] === "win") return `<strong>${parts[2]} won the battle!</strong>`;
    if (parts[1] === "tie") return "<strong>The battle ended in a tie.</strong>";
    return "";
  }

  function hpClass(percent) {
    return percent <= 20 ? "critical" : percent <= 50 ? "warning" : "";
  }

  function renderBattle() {
    const view = $("#battleView");
    if (!battleState) {
      view.innerHTML = '<div class="battle-loading"><div class="battle-spinner"></div><h2>Preparing the field…</h2><p>Pokémon Showdown is creating your battle.</p></div>';
      return;
    }
    const player = battleState.player || {};
    const foe = battleState.opponent || {};
    const playerId = DATA.species.find((mon) => mon.name === player.species)?.id || "missingno";
    const party = battleState.request?.party || [];
    const moves = battleState.request?.moves || [];
    const log = battleState.log.map(battleLogLine).filter(Boolean).filter((entry, index, entries) => entry !== entries[index - 1]).slice(-80);
    const trainer = opponent();
    const result = battleState.ended
      ? `<div class="battle-result"><strong>${battleState.winner === "You" ? "Victory!" : "Battle over"}</strong><span>${battleState.winner ? `${battleState.winner} won.` : "The battle ended in a tie."}</span><button type="button" data-leave-battle>Return to Nuzzle</button></div>`
      : "";
    view.innerHTML = `
      <div class="showdown-shell" aria-label="Pokémon battle">
        <section class="battle-left">
          <div class="battlefield">
            <div class="turn-badge">Turn ${battleState.turn}</div>
            <div class="battle-trainer foe-trainer"><span>${trainer.title} ${trainer.name}</span><div class="team-pips">${Array.from({ length: 3 }, (_, i) => `<i class="team-pip ${i === 0 && foe.fainted ? "fainted" : ""}"></i>`).join("")}</div></div>
            <div class="battle-trainer player-trainer"><span>You</span><div class="team-pips">${party.map((mon) => `<i class="team-pip ${mon.fainted ? "fainted" : ""}"></i>`).join("")}</div></div>
            <div class="status-box foe-status"><strong>${foe.species || "Opponent"} <small>Lv. 100</small></strong><div class="hp-track"><span class="${hpClass(foe.hpPercent)}" style="width:${foe.hpPercent || 0}%"></span></div><small>${foe.hpPercent || 0}%</small></div>
            <img class="battle-sprite foe-sprite" src="${spriteBase}${foe.id || "missingno"}.png" alt="${foe.species || "Opponent Pokémon"}" />
            <div class="status-box player-status"><strong>${player.species || "Your Pokémon"} <small>Lv. 100</small></strong><div class="hp-track"><span class="${hpClass(player.hpPercent)}" style="width:${player.hpPercent || 0}%"></span></div><small>${player.condition || ""}</small></div>
            <img class="battle-sprite player-sprite" src="${backSpriteBase}${playerId}.png" alt="${player.species || "Your Pokémon"}" />
          </div>
          <div class="battle-controls">
            ${result || `<p class="choice-prompt">${battleBusy ? "Waiting for the trainer…" : battleState.request.forceSwitch ? `Choose a Pokémon to replace ${player.species}.` : `What will ${player.species} do?`}</p>
            ${battleState.request.forceSwitch ? "" : `<div class="move-choices">${moves.map((move) => `<button type="button" class="move-button type-${(move.type || "normal").toLowerCase()}" data-battle-choice="move ${move.slot}" ${battleBusy || move.disabled ? "disabled" : ""}><strong>${move.name}</strong><span>${move.type || "Normal"}</span>${move.maxpp == null ? "" : `<small>${move.pp}/${move.maxpp}</small>`}</button>`).join("")}</div>`}
            <div class="switch-label">Switch</div>
            <div class="switch-choices">${party.map((mon) => `<button type="button" data-battle-choice="switch ${mon.slot}" ${battleBusy || mon.active || mon.fainted || battleState.request.trapped ? "disabled" : ""}><img src="${spriteBase}${DATA.species.find((item) => item.name === mon.species)?.id || "missingno"}.png" alt=""/><span>${mon.species}</span><i><b style="width:${mon.hpPercent}%"></b></i></button>`).join("")}</div>`}
          </div>
        </section>
        <aside class="battle-log-panel">
          <header><strong>Nuzzle Daily Battle</strong><button type="button" data-leave-battle>Exit battle</button></header>
          <div class="battle-format"><b>Format:</b><strong>[Gen 9] Nuzzle Kanto</strong><span>Species Clause · No legendaries · Level 100</span></div>
          <div class="battle-log" role="log" aria-live="polite">${log.map((entry) => `<p>${entry}</p>`).join("")}</div>
        </aside>
      </div>`;
    const logElement = $(".battle-log", view);
    if (logElement) logElement.scrollTop = logElement.scrollHeight;
  }

  function renderToday() {
    const info = dateInfo();
    const trainer = opponent();
    const party = state.party.map(species).filter(Boolean);
    const unrevealed = state.encounters.filter((item) => !item.revealed).length;
    $("#todayView").innerHTML = `
      <div class="today-grid">
        <article class="hero-card">
          <div class="hero-top">
            <div class="daily-meta">
              <span class="pill">${info.label}</span>
              <span class="pill neutral">${info.display}</span>
              ${info.sunday ? '<span class="pill">Sunday · 4 encounters</span>' : ""}
            </div>
            <div class="trainer-heading">
              <div>
                <p class="eyebrow">Today's shared challenge</p>
                <h1>${trainer.title} ${trainer.name}</h1>
                <p class="lede">${trainer.note}. Inspect every known move and held item before you commit.</p>
              </div>
              <div class="trainer-art" aria-hidden="true">${trainer.name[0]}</div>
            </div>
          </div>
          <div class="opponent-strip" aria-label="Opponent team">
            ${trainer.team.map(([id, item, moves], index) => {
              const mon = species(id);
              return `<button class="opponent-mon" type="button" data-opponent="${index}">
                <img src="${sprite(mon)}" alt="" loading="eager" />
                <strong>${mon.name}</strong><small>${item} · inspect</small>
              </button>`;
            }).join("")}
          </div>
        </article>
        <aside class="side-card">
          <p class="eyebrow">Your party</p>
          <h2>${party.length ? `${party.length} ready` : "No team yet"}</h2>
          <p class="lede">${party.length ? "Choose your lead when you're ready." : `Reveal your fresh-run encounters first. ${unrevealed} waiting.`}</p>
          <div class="party-mini">
            ${Array.from({ length: 6 }, (_, index) => party[index]
              ? `<div class="mini-slot" title="${party[index].name}"><img src="${sprite(party[index])}" alt="${party[index].name}" /></div>`
              : '<div class="mini-slot" aria-label="Empty party slot">+</div>').join("")}
          </div>
          <button id="battleButton" class="primary" type="button" ${party.length ? "" : "disabled"}>Choose lead &amp; battle</button>
          <p class="battle-note">One official attempt per game date</p>
        </aside>
      </div>
      <div class="quick-links" aria-label="Preparation">
        <button class="quick-link" type="button" data-route="encounters"><span class="quick-icon" aria-hidden="true">🌿</span><span><strong>Tall grass</strong><small>${unrevealed ? `${unrevealed} fresh-run encounters waiting` : "All encounters claimed"}</small></span></button>
        <button class="quick-link" type="button" data-route="pc"><span class="quick-icon" aria-hidden="true">◉</span><span><strong>PC</strong><small>${state.roster.length} living · ${party.length} in party</small></span></button>
        <button class="quick-link" type="button" data-route="shop"><span class="quick-icon" aria-hidden="true">◇</span><span><strong>Shop</strong><small>₽${state.money.toLocaleString()} available</small></span></button>
      </div>`;
  }

  function rosterCard(entry, encounter = false) {
    const mon = species(entry.speciesId);
    const inParty = state.party.includes(mon.id);
    return `<article class="roster-card ${inParty ? "in-party" : ""}">
      ${mon.starter ? '<span class="starter-ribbon">Starter</span>' : ""}
      <img src="${sprite(mon)}" alt="${mon.name}" loading="lazy" />
      <strong>${mon.name}</strong>
      ${typeTags(mon.types)}
      <small>${mon.ability} · Level 100</small>
      <div class="card-actions">
        <button type="button" data-details="${mon.id}">Details</button>
        ${encounter ? "" : `<button type="button" data-party-toggle="${mon.id}">${inParty ? "Box" : "Add"}</button>`}
      </div>
    </article>`;
  }

  function renderEncounters() {
    const waiting = state.encounters.filter((entry) => !entry.revealed);
    const revealed = state.encounters.filter((entry) => entry.revealed);
    $("#encountersView").innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Fresh run</p><h1>Tall grass</h1><p class="lede">Ten unique catches are already rolled and saved. Your first reveal is always a fully evolved starter.</p></div><span class="pill">${waiting.length} waiting</span></div>
      ${waiting.length ? `<section class="page-card encounter-stage"><div><div class="grass" aria-hidden="true">🌿</div><p class="eyebrow">Encounter ${revealed.length + 1} of ${state.encounters.length}</p><h2>Something is moving.</h2><p class="lede">Reveals are guaranteed catches. Refreshing cannot reroll this package.</p><div class="card-actions" style="justify-content:center;margin-top:22px"><button id="revealNext" class="primary" type="button">Reveal next</button><button id="revealAll" class="secondary" type="button">Reveal all</button></div></div></section>` : `<section class="page-card encounter-stage"><div><div class="grass" aria-hidden="true">✓</div><h2>Grass cleared</h2><p class="lede">Your fresh-run package is safely in the PC.</p><button class="secondary" type="button" data-route="pc" style="margin-top:20px">Manage party</button></div></section>`}
      ${revealed.length ? `<div class="encounter-grid">${revealed.map((entry) => rosterCard(entry, true)).join("")}</div>` : ""}`;
  }

  function renderPC() {
    $("#pcView").innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Living roster</p><h1>Your PC</h1><p class="lede">Choose up to six for today's battle. Boxed Pokémon remain part of the run.</p></div><span class="pill">${state.party.length} / 6 in party</span></div>
      <div class="roster-grid">${state.roster.length ? state.roster.map((entry) => rosterCard(entry)).join("") : '<div class="empty-state"><h3>Your PC is empty</h3><p>Visit the tall grass to reveal your fresh-run roster.</p><button class="secondary" type="button" data-route="encounters">Go to encounters</button></div>'}</div>`;
  }

  function renderShop() {
    $("#shopView").innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Preparation</p><h1>Supply shop</h1><p class="lede">Held items return after battle. There are no bag items during a fight.</p></div><span class="pill">₽${state.money.toLocaleString()}</span></div>
      <div class="prototype-callout"><strong>Prototype balance:</strong> inventory and prices are placeholders pending D10 approval. Purchases here only exercise the interface.</div>
      <div class="shop-grid">${DATA.shop.map((item) => `<article class="shop-card"><div class="item-icon" aria-hidden="true">◇</div><small>${item.category}</small><h3>${item.name}</h3><p>${item.description}</p><footer><strong>₽${item.price.toLocaleString()}</strong><button class="secondary" type="button" data-buy="${item.id}" ${state.money < item.price ? "disabled" : ""}>Buy${state.inventory[item.id] ? ` · ${state.inventory[item.id]}` : ""}</button></footer></article>`).join("")}</div>`;
  }

  function renderRecords() {
    $("#recordsView").innerHTML = `
      <div class="page-head"><div><p class="eyebrow">Lifetime record</p><h1>Your journey</h1><p class="lede">Run resources reset. These milestones stay with you.</p></div></div>
      <div class="records-grid">
        <div class="record-card"><span>Current streak</span><strong>${state.streak}</strong></div>
        <div class="record-card"><span>Wipes</span><strong>${state.wipes}</strong></div>
        <div class="record-card"><span>Gym badges</span><strong>${state.badges}</strong></div>
        <div class="record-card"><span>Champion wins</span><strong>${state.championWins}</strong></div>
      </div>`;
  }

  function render() {
    renderToday();
    renderEncounters();
    renderPC();
    renderShop();
    renderRecords();
    renderBattle();
    $("#streakCount").textContent = state.streak;
    const waiting = state.encounters.filter((entry) => !entry.revealed).length;
    $("#encounterBadge").textContent = waiting || "";
    bindDynamicEvents();
  }

  function reveal(count) {
    let revealed = 0;
    for (const entry of state.encounters) {
      if (entry.revealed || revealed >= count) continue;
      entry.revealed = true;
      state.roster.push({ speciesId: entry.speciesId, moves: [...entry.moves], encounterId: entry.encounterId });
      if (state.party.length < 6) state.party.push(entry.speciesId);
      revealed += 1;
    }
    save();
    render();
    showToast(revealed === 1 ? `${species(state.roster.at(-1).speciesId).name} joined your run.` : `${revealed} encounters joined your run.`);
  }

  function toggleParty(id) {
    if (state.party.includes(id)) {
      state.party = state.party.filter((member) => member !== id);
      if (state.lead === id) state.lead = null;
    } else if (state.party.length < 6) {
      state.party.push(id);
    } else {
      showToast("Your party is full. Box someone first.");
      return;
    }
    save(); render();
  }

  function showDetails(id, opponentIndex) {
    const mon = species(id);
    const entry = state.roster.find((item) => item.speciesId === id);
    const trainerSet = opponentIndex !== undefined ? opponent().team[opponentIndex] : null;
    const moves = trainerSet ? trainerSet[2].map((name) => ({ name })) : (entry?.moves || []).map((moveId) => moveDetails(mon, moveId)).filter(Boolean);
    const dialog = $("#detailDialog");
    dialog.innerHTML = `<div class="dialog-inner"><div class="dialog-head"><div><p class="eyebrow">${trainerSet ? "Opponent scout" : "Pokémon details"}</p><h2>${mon.name}</h2>${typeTags(mon.types)}</div><button class="dialog-close" type="button" aria-label="Close">×</button></div>
      <p><strong>Ability:</strong> ${trainerSet ? "Hidden before battle (decision open)" : mon.ability}<br><strong>Held item:</strong> ${trainerSet ? trainerSet[1] : "None"}</p>
      <h3>Moves</h3><ul class="move-list">${moves.map((move) => `<li><strong>${move.name}</strong>${move.type ? `<small>${move.type}${move.bp ? ` · ${move.bp} BP` : ""}</small>` : ""}</li>`).join("")}</ul>
      ${trainerSet ? '<p class="battle-note">Exact opponent stats and nature are intentionally hidden.</p>' : ""}</div>`;
    $(".dialog-close", dialog).addEventListener("click", () => dialog.close());
    dialog.showModal();
  }

  function showLeadDialog() {
    const dialog = $("#leadDialog");
    const options = state.party.map(species);
    let selected = state.lead || state.party[0];
    dialog.innerHTML = `<div class="dialog-inner"><div class="dialog-head"><div><p class="eyebrow">Battle commitment</p><h2>Choose your lead</h2></div><button class="dialog-close" type="button" aria-label="Close">×</button></div><p>Your party will be frozen when the official battle begins.</p><div class="lead-options">${options.map((mon) => `<button class="lead-option ${mon.id === selected ? "selected" : ""}" type="button" data-lead="${mon.id}"><img src="${sprite(mon)}" alt=""/><span>${mon.name}</span></button>`).join("")}</div><button id="commitBattle" class="primary" type="button" style="width:100%">Continue to battle</button><p class="battle-note">This preview stops before creating an official attempt.</p></div>`;
    $(".dialog-close", dialog).addEventListener("click", () => dialog.close());
    $$('[data-lead]', dialog).forEach((button) => button.addEventListener("click", () => {
      selected = button.dataset.lead;
      $$('[data-lead]', dialog).forEach((option) => option.classList.toggle("selected", option === button));
    }));
    $("#commitBattle", dialog).addEventListener("click", async () => {
      state.lead = selected; save();
      dialog.close();
      battleState = null;
      route("battle");
      try {
        const party = state.party.map((id) => {
          const entry = state.roster.find((candidate) => candidate.speciesId === id);
          return { speciesId: id, moves: entry?.moves || [] };
        });
        const response = await fetch("/api/battles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ party, leadId: selected, trainerTier: dateInfo().tier }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Battle service returned ${response.status}`);
        battleState = result;
        render();
      } catch (error) {
        route("today");
        dialog.innerHTML = `<div class="dialog-inner"><div class="dialog-head"><div><p class="eyebrow">Local service unavailable</p><h2>Battle could not start</h2></div><button class="dialog-close" type="button" aria-label="Close">×</button></div><p>${error.message}. Start PostgreSQL and the Nuzzle server, then try again.</p></div>`;
        $(".dialog-close", dialog).addEventListener("click", () => dialog.close());
        dialog.showModal();
      }
    });
    dialog.showModal();
  }

  async function submitBattleChoice(choice) {
    if (!battleState || battleBusy || battleState.ended) return;
    battleBusy = true;
    renderBattle();
    bindDynamicEvents();
    try {
      const response = await fetch(`/api/battles/${battleState.id}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The battle action failed.");
      battleState = result;
    } catch (error) {
      showToast(error.message);
    } finally {
      battleBusy = false;
      renderBattle();
      bindDynamicEvents();
    }
  }

  function buy(id) {
    const item = DATA.shop.find((candidate) => candidate.id === id);
    if (!item || state.money < item.price) return;
    state.money -= item.price;
    state.inventory[id] = (state.inventory[id] || 0) + 1;
    save(); render(); showToast(`${item.name} added to your inventory.`);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function bindDynamicEvents() {
    $$('[data-route]').forEach((button) => button.onclick = () => route(button.dataset.route));
    $$('[data-opponent]').forEach((button) => button.onclick = () => {
      const index = Number(button.dataset.opponent);
      showDetails(opponent().team[index][0], index);
    });
    $$('[data-details]').forEach((button) => button.onclick = () => showDetails(button.dataset.details));
    $$('[data-party-toggle]').forEach((button) => button.onclick = () => toggleParty(button.dataset.partyToggle));
    $$('[data-buy]').forEach((button) => button.onclick = () => buy(button.dataset.buy));
    if ($("#revealNext")) $("#revealNext").onclick = () => reveal(1);
    if ($("#revealAll")) $("#revealAll").onclick = () => reveal(state.encounters.length);
    if ($("#battleButton")) $("#battleButton").onclick = showLeadDialog;
    $$('[data-battle-choice]').forEach((button) => button.onclick = () => submitBattleChoice(button.dataset.battleChoice));
    $$('[data-leave-battle]').forEach((button) => button.onclick = () => route("today"));
  }

  $("#resetPreview").addEventListener("click", () => {
    if (!window.confirm("Reset the browser-only Nuzzle preview? This clears the revealed roster and purchases on this device.")) return;
    state = initialState(); save(); route("today"); showToast("Local preview reset.");
  });

  [$("#detailDialog"), $("#leadDialog")].forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  }));

  // Lightweight invariants for the curated prototype data.
  DATA.species.forEach((mon) => {
    const generated = generateMoves(mon, random(hash(`self-test:${mon.id}`)));
    console.assert(new Set(generated).size === generated.length, `${mon.name}: duplicate generated move`);
    console.assert(generated.length <= 4, `${mon.name}: too many generated moves`);
    mon.types.forEach((type) => {
      const canStab = mon.moves.some((move) => move[2] === type && move[4] !== "status");
      if (canStab) console.assert(generated.some((id) => moveDetails(mon, id)?.type === type), `${mon.name}: missing ${type} STAB`);
    });
  });

  render();
  route(currentRoute);
})();
