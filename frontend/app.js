(function () {
  "use strict";

  const sprite = (id, back = false) => `assets/${back ? "sprites-back" : "sprites"}/${id}.png`;
  const trainerSprite = "assets/trainers/brock.png";
  const app = document.querySelector("#app");
  const tooltip = document.querySelector("#tooltip");

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
  let menuOpen = false;
  let team = new Set(partyIds);
  let pcOrder = [...pcIds];
  let encounters = new Array(3).fill(null);
  let activeId = "flareon";
  let foeHp = 100;
  let playerHp = 100;
  let turn = 1;
  let battleMessage = "";
  let balance = 2500;
  let selectedPcId = null;
  let pcSwapMode = false;
  let selectedLeadId = null;
  let purchaseMessage = "";
  const inventory = {};

  function title() {
    return "Nuzzle #1: Brock (10/15/2026)";
  }

  function grassIcon() {
    return `<svg class="grass-sprite" viewBox="0 0 96 96" aria-hidden="true"><g shape-rendering="crispEdges"><path fill="#1d6c35" d="M15 78h66v8H15zM25 65h52v14H25zM8 55h16v24H8zm66-13h14v38H74zM20 38h13v34H20zm22-26h13v62H42zm22 15h12v46H64z"/><path fill="#46a95f" d="M17 67h18v10H17zm20-23h18v34H37zm17-18h13v52H54zm19 28h13v24H73zM27 25h12v34H27z"/><path fill="#8ed481" d="M12 47h12v18H12zm17-18h9v24h-9zm15-19h10v28H44zm17 18h10v27H61zm18 11h8v19h-8z"/></g></svg>`;
  }

  function header() {
    return `<header class="screen-header"><h1 class="screen-title">${title()}</h1><button class="menu-toggle ${menuOpen ? "open" : ""}" type="button" aria-label="Menu" aria-expanded="${menuOpen}"><span></span></button></header>${menuOpen ? menu() : ""}`;
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

  function menu() {
    const current = route === "lead" || route === "battle" ? "battle" : route;
    return navigation(current, "menu-panel");
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
      <div class="lead-actions"><button class="gloss-button red" type="button" data-start-battle ${selectedLeadId ? "" : "disabled"}>start battle</button><button class="gloss-button purple" type="button" data-route="home">back</button></div>
    </section>`;
  }

  function monButton(id) {
    const mon = mons[id];
    const selected = id === selectedLeadId;
    return `<button class="lead-choice${selected ? " selected" : ""}" type="button" data-select-lead="${id}" aria-pressed="${selected}"><img class="sprite" src="${sprite(id)}" alt=""/><span>${mon.name}</span></button>`;
  }

  function battle() {
    const mon = mons[activeId];
    return `<section class="screen battle-screen">${header()}<div class="arena battle-arena">
      <div class="hp-box enemy"><strong>Steelix <small>Lv. 80</small></strong><div class="hp-bar"><i style="width:${foeHp}%"></i></div><small>${foeHp}%</small></div>
      <img class="sprite active-sprite enemy" src="${sprite("steelix")}" alt="Steelix" />
      <div class="hp-box player"><strong>${mon.name} <small>Lv. 80</small></strong><div class="hp-bar"><i style="width:${playerHp}%"></i></div><small>${Math.round(263 * playerHp / 100)}/263</small></div>
      <img class="sprite active-sprite player" src="${sprite(activeId, true)}" alt="${mon.name}" />
    </div><div class="battle-panel"><p class="prompt">What will <strong>${mon.name}</strong> do? <small>Turn ${turn}</small></p><h2 class="section-label attack">Attack</h2>
      <div class="move-grid">${Object.entries(moves).map(([id, move]) => `<button class="move-button type-${move.type.toLowerCase()}" type="button" data-move="${id}" data-move-tip="${id}"><strong>${move.name}</strong><span>${move.type}</span><small>${move.pp}</small></button>`).join("")}</div>
      <h2 class="section-label">Switch</h2><div class="switch-grid">${[...team].slice(0, 6).map((id) => { const item = mons[id]; return `<button class="switch-choice ${id === activeId ? "selected" : ""}" type="button" data-switch="${id}" data-mon-tip="${id}"><img class="sprite" src="${sprite(id)}" alt=""/><span>${item.name}</span></button>`; }).join("")}</div>
      <p class="battle-message">${battleMessage}</p><button class="gloss-button red give-up" data-route="home">give up</button></div>
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
    const teamFull = team.size >= 6;
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
    const sheetContent = swapChooser || `<section class="sheet-section"><h3>Stats</h3><div class="stat-grid">${stats}</div></section><section class="sheet-section"><h3>Moves</h3><div class="sheet-moves">${mon.moves.map((move) => `<span>${move}</span>`).join("")}</div></section><div class="sheet-actions"><button class="gloss-button ${onTeam ? "slate" : "blue"}" type="button" data-team-toggle="${id}">${primaryLabel}</button></div>`;
    return `<div class="sheet-backdrop" data-close-pc-sheet><section class="pokemon-sheet" role="dialog" aria-modal="true" aria-labelledby="pokemon-sheet-title">
      <button class="sheet-close" type="button" data-close-pc-sheet aria-label="Close Pokémon details" autofocus>×</button>
      <div class="pokemon-summary"><img class="sprite" src="${sprite(id)}" alt="${mon.name}"/><div><p class="sheet-kicker">Pokémon details</p><h2 id="pokemon-sheet-title">${mon.name}</h2><div class="sheet-types">${mon.types.map((type) => `<span class="type-chip ${type.toLowerCase()}">${type}</span>`).join("")}</div></div></div>
      <div class="pokemon-facts"><p><span>Ability</span><strong>${mon.ability}</strong></p><p><span>Nature</span><strong>${mon.nature}</strong></p><p><span>Held item</span><strong>${mon.item}</strong></p></div>
      <div class="sheet-mode-content">${sheetContent}</div>
      <button class="plain-button sheet-secondary-action" type="button" ${swapChooser ? "data-cancel-pc-swap" : "data-close-pc-sheet"}>${swapChooser ? "cancel" : "close"}</button>
    </section></div>`;
  }

  function encountersScreen() {
    const remaining = encounters.filter((item) => !item).length;
    return `<section class="screen">${header()}<div class="encounter-stage"><p class="encounter-count">${remaining ? `${remaining} encounter${remaining === 1 ? "" : "s"} waiting` : "All encounters revealed"}</p>
      <div class="grass-grid">${encounters.map((id, index) => `<button class="grass-card" type="button" data-encounter="${index}" ${id ? "disabled" : ""} aria-label="${id ? mons[id].name : `Reveal encounter ${index + 1}`}">${id ? `<span class="revealed" data-mon-tip="${id}"><img class="sprite" src="${sprite(id)}" alt="${mons[id].name}"/><span>${mons[id].name}</span></span>` : grassIcon()}</button>`).join("")}</div>
      ${backButton()}
    </div></section>`;
  }

  function backButton() {
    return '<button class="gloss-button purple page-back" data-route="home">back</button>';
  }

  const shopItems = [
    { id: "hp-up", group: "Training", name: "HP Up", detail: "+10 HP EVs", price: 100, icon: "HP" },
    { id: "protein", group: "Training", name: "Protein", detail: "+10 Attack EVs", price: 100, icon: "ATK" },
    { id: "iron", group: "Training", name: "Iron", detail: "+10 Defense EVs", price: 100, icon: "DEF" },
    { id: "calcium", group: "Training", name: "Calcium", detail: "+10 Sp. Atk EVs", price: 100, icon: "SPA" },
    { id: "zinc", group: "Training", name: "Zinc", detail: "+10 Sp. Def EVs", price: 100, icon: "SPD" },
    { id: "carbos", group: "Training", name: "Carbos", detail: "+10 Speed EVs", price: 100, icon: "SPE" },
    { id: "bottle-cap", group: "Training", name: "Bottle Cap", detail: "Maximize one IV", price: 500, icon: "IV" },
    { id: "nature-mint", group: "Training", name: "Nature Mint", detail: "Choose a stat nature", price: 300, icon: "N" },
    { id: "leftovers", group: "Held Items", name: "Leftovers", detail: "Restores HP each turn", price: 600, icon: "LF" },
    { id: "sitrus-berry", group: "Held Items", name: "Sitrus Berry", detail: "Restores HP when low", price: 300, icon: "SB" },
    { id: "focus-sash", group: "Held Items", name: "Focus Sash", detail: "Survive one hit from full HP", price: 800, icon: "FS" },
    { id: "choice-scarf", group: "Held Items", name: "Choice Scarf", detail: "Boosts Speed; locks one move", price: 700, icon: "CS" },
  ];

  function itemIcon(item) {
    return `<span class="item-icon ${item.group === "Held Items" ? "held" : "training"}" aria-hidden="true">${item.icon}</span>`;
  }

  function mart() {
    let section = "";
    return `<section class="screen">${header()}<div class="mart-stage"><div class="mart-summary"><p class="purchase-message" aria-live="polite">${purchaseMessage}</p><p class="balance">Balance: <strong>${balance.toLocaleString()} coins</strong></p></div>
      <div class="shop-list">${shopItems.map((item, index) => {
        const heading = item.group !== section ? `<h2>${item.group}</h2>` : "";
        section = item.group;
        const owned = inventory[item.id] || 0;
        return `${heading}<div class="shop-item">${itemIcon(item)}<span class="item-copy"><strong>${item.name}</strong><small>${item.detail}${owned ? ` · Owned: ${owned}` : ""}</small></span><button class="price-button" type="button" data-buy="${index}" ${balance < item.price ? "disabled" : ""}>${item.price} coins</button></div>`;
      }).join("")}</div>${backButton()}</div></section>`;
  }

  function bag() {
    const ownedItems = shopItems.filter((item) => inventory[item.id]);
    const total = ownedItems.reduce((sum, item) => sum + inventory[item.id], 0);
    let section = "";
    const contents = ownedItems.length ? `<div class="bag-list">${ownedItems.map((item) => {
      const heading = item.group !== section ? `<h2>${item.group}</h2>` : "";
      section = item.group;
      const action = item.group === "Held Items" ? "give" : "use";
      return `${heading}<div class="bag-item">${itemIcon(item)}<span class="item-copy"><strong>${item.name}</strong><small>${item.detail}</small></span><span class="item-quantity" aria-label="${inventory[item.id]} owned">×${inventory[item.id]}</span><button class="item-action" type="button" aria-label="${action} ${item.name}">${action}</button></div>`;
    }).join("")}</div>` : `<div class="bag-empty"><div class="empty-bag-icon" aria-hidden="true">0</div><h2>Your bag is empty</h2><p>Items purchased at the mart will appear here.</p><button class="gloss-button blue" type="button" data-route="mart">visit mart</button></div>`;
    return `<section class="screen">${header()}<div class="bag-stage"><div class="bag-summary"><span>${total} item${total === 1 ? "" : "s"}</span><span>${balance.toLocaleString()} coins</span></div>${contents}${backButton()}</div></section>`;
  }

  function simpleScreen(kind) {
    const content = kind === "leaderboard"
        ? '<h2>Leaderboard</h2><p>Daily results and streaks will appear here.</p>'
        : '<h2>Settings</h2><p>Game, sound, and accessibility options will appear here.</p>';
    return `<section class="screen">${header()}<div class="simple-stage">${content}${backButton()}</div></section>`;
  }

  function render() {
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
    document.querySelector(".menu-toggle")?.addEventListener("click", () => { menuOpen = !menuOpen; render(); });
    document.querySelectorAll("[data-route]").forEach((button) => button.addEventListener("click", () => { route = button.dataset.route; if (route === "lead") selectedLeadId = null; if (route === "mart") purchaseMessage = ""; menuOpen = false; render(); scrollTo(0, 0); }));
    document.querySelectorAll("[data-select-lead]").forEach((button) => button.addEventListener("click", () => {
      selectedLeadId = button.dataset.selectLead;
      document.querySelectorAll("[data-select-lead]").forEach((choice) => {
        const selected = choice.dataset.selectLead === selectedLeadId;
        choice.classList.toggle("selected", selected);
        choice.setAttribute("aria-pressed", String(selected));
      });
      document.querySelector("[data-start-battle]")?.removeAttribute("disabled");
    }));
    document.querySelector("[data-start-battle]")?.addEventListener("click", () => { if (!selectedLeadId) return; activeId = selectedLeadId; route = "battle"; render(); scrollTo(0, 0); });
    document.querySelectorAll("[data-switch]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.held || button.dataset.switch === activeId) return; activeId = button.dataset.switch; battleMessage = `Go, ${mons[activeId].name}!`; turn += 1; render(); }));
    document.querySelectorAll("[data-move]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.held) return; const move = moves[button.dataset.move]; foeHp = Math.max(0, foeHp - (move.power === "—" ? 0 : 18)); playerHp = Math.max(0, playerHp - 9); battleMessage = `${mons[activeId].name} used ${move.name}!${foeHp === 0 ? " Steelix fainted!" : ""}`; turn += 1; render(); }));
    document.querySelectorAll("[data-encounter]").forEach((button) => button.addEventListener("click", () => { const index = Number(button.dataset.encounter); if (!encounters[index]) { encounters[index] = encounterIds[index]; if (!pcOrder.includes(encounterIds[index])) pcOrder.push(encounterIds[index]); render(); } }));
    document.querySelector("[data-reveal-all]")?.addEventListener("click", () => { encounters = encounterIds.slice(); for (const id of encounterIds) if (!pcOrder.includes(id)) pcOrder.push(id); render(); });
    document.querySelectorAll("[data-buy]").forEach((button) => button.addEventListener("click", () => {
      const item = shopItems[Number(button.dataset.buy)];
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
    document.querySelectorAll("[data-pc-detail]").forEach((button) => button.addEventListener("click", () => { selectedPcId = button.dataset.pcDetail; pcSwapMode = false; render(); }));
    document.querySelectorAll("[data-close-pc-sheet]").forEach((element) => element.addEventListener("click", (event) => {
      if (element.classList.contains("sheet-backdrop") && event.target !== element) return;
      selectedPcId = null;
      pcSwapMode = false;
      render();
    }));
    document.querySelector("[data-team-toggle]")?.addEventListener("click", (event) => {
      const id = event.currentTarget.dataset.teamToggle;
      if (team.has(id)) team.delete(id);
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
    document.querySelectorAll("[data-mon-tip]").forEach((element) => addInfoInteractions(element, () => monTip(element.dataset.monTip)));
    document.querySelectorAll("[data-move-tip]").forEach((element) => addInfoInteractions(element, () => moveTip(element.dataset.moveTip)));
    document.onkeydown = (event) => {
      if (event.key === "Escape" && selectedPcId) {
        if (pcSwapMode) pcSwapMode = false;
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
        render();
      });
    });
  }

  render();
})();
