const vanilluxeTeamText = `Vanilluxe @ Focus Sash
Ability: Snow Warning
EVs: 252 HP / 4 Atk / 252 SpA
Quiet Nature
- Blizzard
- Freeze-Dry
- Ice Shard
- Aurora Veil`;

const sieboldTeamText = `Starmie
Ability: Illuminate
- Psycho Cut
- Waterfall
- Rapid Spin

Clawitzer
Ability: Mega Launcher
- Water Pulse
- Crabhammer
- Aqua Jet
- Flip Turn

Barbaracle
Ability: Tough Claws
- Rock Slide
- Liquidation
- Cross Chop

Gyarados
Ability: Intimidate
IVs: 0 Atk
- Surf
- Flamethrower
- Ice Beam
- Thunderbolt

Blastoise
Ability: Torrent
- Hydro Pump
- Rapid Spin
- Body Slam

Octillery
Ability: Suction Cups
IVs: 0 Atk
- Octazooka
- Haze
- Signal Beam
- Acid Spray`;

export async function applyLiveTrainerAdjustments(trainers) {
  const today = await trainers.current();
  if (today.date === "2026-11-15") return trainers.replaceDailyPokemon(today.date, "Arboliva", vanilluxeTeamText);
  if (today.date === "2026-11-17") return trainers.simplifyDailyStats(today.date);
  if (today.date === "2026-11-19") return trainers.replaceDailyTrainer(today.date, {
    id: "live-2026-11-19-elite-4-siebold",
    name: "Elite 4 Siebold",
    spriteId: "siebold",
    teamText: sieboldTeamText,
  });
  return false;
}

export { sieboldTeamText, vanilluxeTeamText };
