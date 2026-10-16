(function () {
  "use strict";

  const sprite = (id, back = false) => `assets/${back ? "sprites-back" : "sprites"}/${id}.png`;
  const trainerSprite = "assets/trainers/brock.png";
  const app = document.querySelector("#app");
  const tooltip = document.querySelector("#tooltip");

  const mons = {
    flareon: { name: "Flareon", types: ["Fire"], ability: "Flash Fire", item: "Charcoal", hp: "100.0% (263/263)", stats: "Atk 296 / Def 156 / SpA 226 / SpD 256 / Spe 166", moves: ["Flamethrower", "Quick Attack", "Bite", "Will-O-Wisp"] },
    raichu: { name: "Raichu", types: ["Electric"], ability: "Static", item: "Magnet", hp: "100.0% (261/261)", stats: "Atk 216 / Def 146 / SpA 216 / SpD 196 / Spe 256", moves: ["Thunderbolt", "Thunder Punch", "Surf", "Nasty Plot"] },
    vaporeon: { name: "Vaporeon", types: ["Water"], ability: "Water Absorb", item: "Leftovers", hp: "100.0% (401/401)", stats: "Atk 166 / Def 156 / SpA 256 / SpD 226 / Spe 166", moves: ["Surf", "Ice Beam", "Shadow Ball", "Wish"] },
    gengar: { name: "Gengar", types: ["Ghost", "Poison"], ability: "Cursed Body", item: "Spell Tag", hp: "100.0% (261/261)", stats: "Atk 166 / Def 156 / SpA 296 / SpD 186 / Spe 256", moves: ["Shadow Ball", "Sludge Bomb", "Thunderbolt", "Hypnosis"] },
    venusaur: { name: "Venusaur", types: ["Grass", "Poison"], ability: "Overgrow", item: "Miracle Seed", hp: "100.0% (301/301)", stats: "Atk 200 / Def 202 / SpA 236 / SpD 236 / Spe 196", moves: ["Giga Drain", "Sludge Bomb", "Earth Power", "Synthesis"] },
    pidgeot: { name: "Pidgeot", types: ["Normal", "Flying"], ability: "Keen Eye", item: "Sharp Beak", hp: "100.0% (307/307)", stats: "Atk 196 / Def 186 / SpA 176 / SpD 176 / Spe 218", moves: ["Air Slash", "U-turn", "Quick Attack", "Roost"] },
    arcanine: { name: "Arcanine", types: ["Fire"], ability: "Intimidate", item: "Sitrus Berry", hp: "100.0% (321/321)", stats: "Atk 256 / Def 196 / SpA 236 / SpD 196 / Spe 226", moves: ["Flamethrower", "Crunch", "Extreme Speed", "Will-O-Wisp"] },
    lapras: { name: "Lapras", types: ["Water", "Ice"], ability: "Water Absorb", item: "Leftovers", hp: "100.0% (401/401)", stats: "Atk 206 / Def 196 / SpA 206 / SpD 226 / Spe 156", moves: ["Surf", "Ice Beam", "Thunderbolt", "Sing"] },
    alakazam: { name: "Alakazam", types: ["Psychic"], ability: "Synchronize", item: "Twisted Spoon", hp: "100.0% (251/251)", stats: "Atk 136 / Def 126 / SpA 306 / SpD 226 / Spe 276", moves: ["Psychic", "Shadow Ball", "Energy Ball", "Calm Mind"] },
    machamp: { name: "Machamp", types: ["Fighting"], ability: "No Guard", item: "Black Belt", hp: "100.0% (321/321)", stats: "Atk 296 / Def 196 / SpA 166 / SpD 206 / Spe 146", moves: ["Dynamic Punch", "Knock Off", "Stone Edge", "Bullet Punch"] },
    nidoking: { name: "Nidoking", types: ["Poison", "Ground"], ability: "Sheer Force", item: "Life Orb", hp: "100.0% (303/303)", stats: "Atk 220 / Def 190 / SpA 206 / SpD 186 / Spe 206", moves: ["Earth Power", "Sludge Bomb", "Ice Beam", "Thunderbolt"] },
    exeggutor: { name: "Exeggutor", types: ["Grass", "Psychic"], ability: "Chlorophyll", item: "Sitrus Berry", hp: "100.0% (331/331)", stats: "Atk 226 / Def 206 / SpA 286 / SpD 166 / Spe 146", moves: ["Psychic", "Giga Drain", "Sludge Bomb", "Sleep Powder"] },
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

  function title() {
    return "Nuzzle #1: Brock (10/15/2026)";
  }

  function grassIcon() {
    return `<svg class="grass-sprite" viewBox="0 0 96 96" aria-hidden="true"><g shape-rendering="crispEdges"><path fill="#1d6c35" d="M15 78h66v8H15zM25 65h52v14H25zM8 55h16v24H8zm66-13h14v38H74zM20 38h13v34H20zm22-26h13v62H42zm22 15h12v46H64z"/><path fill="#46a95f" d="M17 67h18v10H17zm20-23h18v34H37zm17-18h13v52H54zm19 28h13v24H73zM27 25h12v34H27z"/><path fill="#8ed481" d="M12 47h12v18H12zm17-18h9v24h-9zm15-19h10v28H44zm17 18h10v27H61zm18 11h8v19h-8z"/></g></svg>`;
  }

  function header() {
    return `<header class="screen-header"><h1 class="screen-title">${title()}</h1><button class="menu-toggle ${menuOpen ? "open" : ""}" type="button" aria-label="Menu" aria-expanded="${menuOpen}"><span></span></button></header>${menuOpen ? menu() : ""}`;
  }

  function menu() {
    return `<nav class="menu-panel" aria-label="Main menu">
      <button class="gloss-button red" data-route="lead">battle</button>
      <button class="gloss-button orange" data-route="pc">pc box</button>
      <button class="gloss-button gold" data-route="home">leaderboard</button>
      <button class="gloss-button green" data-route="encounters">encounter (${encounters.filter((item) => !item).length})</button>
      <button class="gloss-button slate" data-route="home">settings</button>
    </nav>`;
  }

  function home() {
    return `<section class="screen">${header()}<div class="landing">
      <div class="trainer-wrap"><img class="sprite trainer" src="${trainerSprite}" alt="Gym Leader Brock" /></div>
      <div class="opponent-team" aria-label="Brock's team">${opponent.map((id) => `<button type="button" aria-label="${id}"><img class="sprite" src="${sprite(id)}" alt="${id}" /></button>`).join("")}</div>
      <div class="home-actions">
        <button class="gloss-button red" data-route="lead">battle</button>
        <button class="gloss-button orange" data-route="pc">pc box</button>
        <button class="gloss-button gold" type="button">leaderboard</button>
        <button class="gloss-button green" data-route="encounters">encounter (${encounters.filter((item) => !item).length})</button>
        <button class="gloss-button slate" type="button">settings</button>
      </div>
      <div class="ad-slot">ADVERTISEMENT</div>
    </div></section>`;
  }

  function lead() {
    const chosen = [...team].slice(0, 6);
    return `<section class="screen">${header()}<div class="arena"><img class="sprite trainer" src="${trainerSprite}" alt="Gym Leader Brock" /></div>
      <div class="lead-prompt"><p class="prompt">How will you start the battle?</p><h2 class="section-label">Choose Lead</h2>
      <div class="lead-grid">${chosen.map(monButton).join("")}</div></div>
      <button class="gloss-button purple back-button" data-route="home">back</button>
    </section>`;
  }

  function monButton(id) {
    const mon = mons[id];
    return `<button class="lead-choice" type="button" data-lead="${id}" data-mon-tip="${id}"><img class="sprite" src="${sprite(id)}" alt=""/><span>${mon.name}</span></button>`;
  }

  function battle() {
    const mon = mons[activeId];
    return `<section class="screen">${header()}<div class="arena battle-arena">
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
    return `<section class="screen">${header()}<div class="pc-banner">pc box</div><p class="pc-help">Tap to add or remove a party star. Hold, then drag to rearrange.</p>
      <div class="pc-box">${pcOrder.map((id) => { const mon = mons[id]; return `<button class="pc-mon" type="button" draggable="false" data-pc-mon="${id}" data-mon-tip="${id}" aria-label="${mon.name}${team.has(id) ? ", in party" : ""}"><img class="sprite" src="${sprite(id)}" alt="${mon.name}"/>${team.has(id) ? '<span class="party-star" aria-label="In party">★</span>' : ""}</button>`; }).join("")}</div>
      <div class="home-actions"><button class="gloss-button red" data-route="lead">battle</button><button class="gloss-button green" data-route="encounters">encounter (${encounters.filter((item) => !item).length})</button><button class="gloss-button purple" data-route="home">back</button></div>
    </section>`;
  }

  function encountersScreen() {
    const remaining = encounters.filter((item) => !item).length;
    return `<section class="screen">${header()}<div class="encounter-stage"><p class="encounter-count">${remaining ? `${remaining} encounter${remaining === 1 ? "" : "s"} waiting` : "All encounters revealed"}</p>
      <div class="grass-grid">${encounters.map((id, index) => `<button class="grass-card" type="button" data-encounter="${index}" ${id ? "disabled" : ""} aria-label="${id ? mons[id].name : `Reveal encounter ${index + 1}`}">${id ? `<span class="revealed" data-mon-tip="${id}"><img class="sprite" src="${sprite(id)}" alt="${mons[id].name}"/><span>${mons[id].name}</span></span>` : grassIcon()}</button>`).join("")}</div>
      ${remaining ? '<button class="gloss-button green reveal-all" type="button" data-reveal-all>reveal all</button>' : ""}
      <div class="home-actions"><button class="gloss-button red" data-route="lead">battle</button><button class="gloss-button orange" data-route="pc">pc box</button><button class="gloss-button purple" data-route="home">back</button></div>
    </div></section>`;
  }

  function render() {
    hideTooltip();
    app.innerHTML = route === "home" ? home() : route === "lead" ? lead() : route === "battle" ? battle() : route === "pc" ? pc() : encountersScreen();
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
    document.querySelectorAll("[data-route]").forEach((button) => button.addEventListener("click", () => { route = button.dataset.route; menuOpen = false; render(); scrollTo(0, 0); }));
    document.querySelectorAll("[data-lead]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.held) return; activeId = button.dataset.lead; route = "battle"; render(); }));
    document.querySelectorAll("[data-switch]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.held || button.dataset.switch === activeId) return; activeId = button.dataset.switch; battleMessage = `Go, ${mons[activeId].name}!`; turn += 1; render(); }));
    document.querySelectorAll("[data-move]").forEach((button) => button.addEventListener("click", () => { if (button.dataset.held) return; const move = moves[button.dataset.move]; foeHp = Math.max(0, foeHp - (move.power === "—" ? 0 : 18)); playerHp = Math.max(0, playerHp - 9); battleMessage = `${mons[activeId].name} used ${move.name}!${foeHp === 0 ? " Steelix fainted!" : ""}`; turn += 1; render(); }));
    document.querySelectorAll("[data-encounter]").forEach((button) => button.addEventListener("click", () => { const index = Number(button.dataset.encounter); if (!encounters[index]) { encounters[index] = encounterIds[index]; if (!pcOrder.includes(encounterIds[index])) pcOrder.push(encounterIds[index]); render(); } }));
    document.querySelector("[data-reveal-all]")?.addEventListener("click", () => { encounters = encounterIds.slice(); for (const id of encounterIds) if (!pcOrder.includes(id)) pcOrder.push(id); render(); });
    document.querySelectorAll("[data-mon-tip]").forEach((element) => addInfoInteractions(element, () => monTip(element.dataset.monTip)));
    document.querySelectorAll("[data-move-tip]").forEach((element) => addInfoInteractions(element, () => moveTip(element.dataset.moveTip)));
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
        if (element.dataset.held || dragArmed) { dragArmed = false; return; }
        const id = element.dataset.pcMon;
        if (team.has(id)) team.delete(id); else if (team.size < 6) team.add(id);
        render();
      });
    });
  }

  render();
})();
