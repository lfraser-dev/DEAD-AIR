// DEAD AIR: the helicopter's upgrades, paint jobs and the save file.
//
// Every upgrade has tiers. You buy them in order with SCRAP (earned on missions), and can fit any tier you own.
// Every tier changes how the helicopter looks (see chopper.js), not just its numbers.

export const SLOTS = [
  { id: 'gun', name: 'NOSE GUN', icon: '⁂', tiers: [
    { n: 'CHAIN GUN', cost: 0, d: 'One barrel under the nose. Reliable.' },
    { n: 'ROTARY MINIGUN', cost: 350, d: 'Six spinning barrels. Way faster fire.' },
    { n: 'TWIN MINIGUNS', cost: 900, d: 'Two miniguns side by side. Shreds crowds.' },
    { n: 'AUTOCANNON', cost: 1900, d: '30 mm explosive shells. Blows piles apart.' },
    { n: 'TWIN 30MM', cost: 3800, d: 'Two 30 mm chain guns side by side. Twice the explosive shells.' },
    { n: 'GAU-19 .50 GATLING', cost: 5500, d: 'A three-barrel .50 calibre gatling: fast like a minigun, but every round hits like a hammer and goes through riot armour.' },
  ] },
  { id: 'rockets', name: 'ROCKETS', icon: '➶', tiers: [
    { n: 'NONE', cost: 0, d: 'No rocket pods fitted.' },
    { n: 'ROCKET PODS', cost: 250, d: 'Two pods on the stub wings. 8 rockets.' },
    { n: 'QUAD PODS', cost: 800, d: 'Four pods. 16 rockets.' },
    { n: 'HELLFIRE RAILS', cost: 1700, d: 'Guided missiles: they fly to the biggest crowd near your crosshair.' },
    { n: 'APKWS PODS', cost: 3400, d: 'Laser-guided rockets: each click fires 6 and every one finds its own zombie. 36 of them.' },
  ] },
  { id: 'bombs', name: 'BOMB BAY', icon: '●', tiers: [
    { n: 'NONE', cost: 0, d: 'No bombs.' },
    { n: 'FIRE BOMBS', cost: 450, d: 'Drop with SPACE. The street burns for a while.' },
    { n: 'CLUSTER BOMBS', cost: 1100, d: 'Each bomb splits into six. Clears a street.' },
    { n: 'NAPALM', cost: 2200, d: 'Barrels of napalm. A huge sea of fire.' },
    { n: 'THERMOBARIC', cost: 6000, d: 'Two huge fuel-air bombs per refill. One fireball flattens a whole crowd. Don\'t drop it from low down.' },
  ] },
  { id: 'armor', name: 'ARMOUR', icon: '▣', tiers: [
    { n: 'STOCK HULL', cost: 0, d: 'Thin metal. Be careful.' },
    { n: 'BOLT-ON PLATES', cost: 300, d: 'Steel plates on the sides and nose. +60% health.' },
    { n: 'HEAVY ARMOUR', cost: 900, d: 'Thick plates and a cage over the glass. +130% health.' },
    { n: 'FORTRESS', cost: 2000, d: 'Armour everywhere, even round the tail. +220% health. Heavy!' },
    { n: 'CERAMIC COMPOSITE', cost: 4500, d: 'Ceramic armour tiles over everything. +300% health and lighter than steel.' },
  ] },
  { id: 'engine', name: 'ENGINE', icon: '✦', tiers: [
    { n: 'STOCK TURBINE', cost: 0, d: 'Gets you up there.' },
    { n: 'TURBO', cost: 300, d: 'Bigger exhausts. More lift and top speed.' },
    { n: 'TWIN TURBO', cost: 900, d: 'Two turbines. A lot more of everything.' },
    { n: 'EMERGENCY POWER', cost: 1900, d: 'Hold SHIFT to overboost the engines for a burst of speed.' },
    { n: 'UPRATED ENGINES', cost: 4200, d: 'Two big new turboshafts: much faster, much more lift, and a longer boost.' },
  ] },
  { id: 'rotor', only: 'heli', name: 'ROTOR', icon: '✳', tiers: [
    { n: '4 BLADES', cost: 0, d: 'The standard rotor.' },
    { n: '5 BLADES', cost: 500, d: 'Longer blades. Better lift and quicker turns.' },
    { n: 'COAXIAL', cost: 1400, d: 'Two rotors stacked up. Turns on the spot.' },
    { n: 'COMPOSITE BLADES', cost: 3200, d: 'Wide blades with swept tips: more lift, quicker turns, and clipping a wall barely hurts.' },
  ] },
  { id: 'door', name: 'DOOR GUNS', icon: '⌖', tiers: [
    { n: 'NONE', cost: 0, d: 'Empty doors.' },
    { n: 'DOOR GUNNER', cost: 500, d: 'A gunner in the right door shoots zombies he can see.' },
    { n: 'TWIN GUNNERS', cost: 1200, d: 'Gunners in both doors.' },
    { n: 'DOOR MINIGUNS', cost: 2300, d: 'Both gunners get spinning miniguns.' },
    { n: 'MK19 GRENADES', cost: 3400, d: 'Both doors get Mk 19 grenade launchers: a steady stream of 40 mm grenades into the crowds.' },
  ] },
  { id: 'fuel', name: 'FUEL TANKS', icon: '⛽', tiers: [
    { n: 'STANDARD TANK', cost: 0, d: 'About 5 minutes of flying.' },
    { n: 'SIDE TANKS', cost: 350, d: 'Tanks strapped to the sides. About 8 minutes.' },
    { n: 'FERRY TANKS', cost: 1000, d: 'Big drop tanks on the wings. About 12 minutes.' },
    { n: 'AUX CABIN TANK', cost: 2400, d: 'Ferry tanks plus a big tank inside the cabin. About 20 minutes.' },
  ] },
  { id: 'cabin', name: 'CABIN', icon: '♟', tiers: [
    { n: '4 SEATS', cost: 0, d: 'Carry 4 people (your team and survivors).' },
    { n: '8 SEATS', cost: 300, d: 'Side benches. Carry 8.' },
    { n: '12 SEATS', cost: 900, d: 'Side pods bolted on. Carry 12.' },
    { n: '16 SEATS', cost: 2100, d: 'Bigger pods all the way back. Carry 16 (the Mule carries 40).' },
  ] },
  { id: 'winch', only: 'heli', name: 'WINCH', icon: '⚓', tiers: [
    { n: 'NONE', cost: 0, d: 'People climb a rope ladder: you have to hover low.' },
    { n: 'RESCUE WINCH', cost: 600, d: 'A winch arm on the door: pick people up from 30 m up, out of reach of the piles.' },
    { n: 'CARGO HOOK', cost: 1300, d: 'Also hooks crates from high up, and lowers your team onto roofs without landing.' },
    { n: 'RESCUE HOIST', cost: 2200, d: 'A fast powered hoist: pick people up from 50 m above a roof, three times quicker.' },
  ] },
  { id: 'flir', name: 'THERMAL CAMERA', icon: '◉', tiers: [
    { n: 'NONE', cost: 0, d: 'Just your eyes.' },
    { n: 'THERMAL CAMERA', cost: 500, d: 'A camera ball under the nose: zombies show on the map from far away.' },
    { n: 'THERMAL + MARKERS', cost: 1300, d: 'Marks screamers and piles on screen, and how many zombies are inside buildings.' },
  ] },
  { id: 'skids', only: 'heli', name: 'SKIDS', icon: '⊥', tiers: [
    { n: 'PLAIN SKIDS', cost: 0, d: 'Easy to grab.' },
    { n: 'ANTI-CLIMB SKIDS', cost: 400, d: 'Spikes and greased bars: zombies can barely hang on.' },
  ] },
  { id: 'light', name: 'SEARCHLIGHT', icon: '☀', tiers: [
    { n: 'NONE', cost: 0, d: 'Nights are dark. Really dark.' },
    { n: 'SEARCHLIGHT', cost: 350, d: 'A big light under the nose that points where you fly. Comes on at night (L to switch).' },
    { n: 'NIGHTSUN', cost: 1100, d: 'The police searchlight: twin lamps, much brighter. Zombies caught in the beam stagger and stop.' },
  ] },
  { id: 'medbay', only: 'heli', name: 'MEDICAL BAY', icon: '✚', tiers: [
    { n: 'NONE', cost: 0, d: 'A first aid kit somewhere.' },
    { n: 'MEDICAL BAY', cost: 600, d: 'Stretchers and a medic station: your team heals fast on board and gets +30 health on raids.' },
    { n: 'TRAUMA BAY', cost: 1800, d: 'A full trauma bay: heals 3x faster, +60 health on raids, and a bitten team member is saved once a raid.' },
  ] },
  { id: 'drops', name: 'SUPPLY CHUTES', icon: '☂', tiers: [
    { n: 'NONE', cost: 0, d: 'Your team only has what they took in.' },
    { n: 'SUPPLY CHUTES', cost: 500, d: 'Press B near the building your team is raiding: medkits and grenades parachute down to them.' },
    { n: 'HEAVY DROPS', cost: 1200, d: 'Bigger crates: armour too, and they fight 40% harder for the rest of the raid.' },
  ] },
  { id: 'radio', name: 'RADIO', icon: '📡', tiers: [
    { n: 'HANDHELD', cost: 0, d: 'You only hear calls for help close by.' },
    { n: 'LONG RANGE RADIO', cost: 400, d: 'A big aerial on the tail: hear SOS calls from twice as far, and see hordes coming on the map.' },
    { n: 'SATCOM', cost: 1500, d: 'A satellite dome on the tail: hear SOS calls from anywhere on the map.' },
  ] },
  { id: 'nvg', name: 'NIGHT VISION', icon: '◐', tiers: [
    { n: 'NONE', cost: 0, d: 'At night you only see what\'s lit.' },
    { n: 'NIGHT VISION', cost: 900, d: 'Goggles for the crew and an infrared lamp on the nose: at night everything shows up bright and green. Z switches it on and off.' },
  ] },
  { id: 'ammo', name: 'AMMO', icon: '⁍', tiers: [
    { n: 'BALL', cost: 0, d: 'Ordinary rounds for the nose gun and the door guns.' },
    { n: 'ARMOUR-PIERCING', cost: 900, d: 'Goes straight through riot armour, and on into the one standing behind.' },
    { n: 'INCENDIARY', cost: 1900, d: 'Sets them on fire: they keep burning for a few seconds after you hit them.' },
  ] },
  { id: 'repair', name: 'REPAIRS', icon: '⚒', tiers: [
    { n: 'NONE', cost: 0, d: 'Repairs only at a base.' },
    { n: 'FIELD REPAIR KIT', cost: 800, d: 'Land anywhere and the crew patch the helicopter up (slowly).' },
    { n: 'CREW CHIEF', cost: 2100, d: 'A crew chief on board: fixes things in flight too, and much faster on the ground.' },
  ] },
  { id: 'suppress', name: 'FIRE SUPPRESSION', icon: '❄', tiers: [
    { n: 'NONE', cost: 0, d: 'When it\'s going down, it\'s going down.' },
    { n: 'ENGINE EXTINGUISHERS', cost: 1500, d: 'Once a sortie, a hit that would have brought you down puts the fire out instead: you keep flying on 20% health.' },
  ] },
  { id: 'cooling', name: 'BARREL COOLING', icon: '≋', tiers: [
    { n: 'NONE', cost: 0, d: 'Hold the trigger too long and the gun overheats.' },
    { n: 'COOLED BARRELS', cost: 700, d: 'Heavy fluted barrels with cooling jackets: the nose gun and gun pods heat up 40% slower.' },
    { n: 'QUICK-CHANGE BARRELS', cost: 1800, d: 'Plus a spare barrel set: if it overheats it\'s firing again twice as fast, and it fires 10% quicker.' },
  ] },
  { id: 'hover', only: 'heli', name: 'FLIGHT COMPUTER', icon: '⌬', tiers: [
    { n: 'NONE', cost: 0, d: 'Let go and you drift.' },
    { n: 'HOVER HOLD', cost: 600, d: 'An autopilot: let go of the controls and it stops dead and holds its spot. Perfect for winching and shooting.' },
    { n: 'GROUND PROXIMITY WARNING', cost: 1500, d: 'Plus a radar altimeter that warns you before you fly into something, and bumps do 30% less damage.' },
  ] },
  { id: 'crash', name: 'CRASH SAFETY', icon: '⛨', tiers: [
    { n: 'NONE', cost: 0, d: 'If you go down, so does everyone aboard.' },
    { n: 'CRASHWORTHY SEATS', cost: 900, d: 'Seats that soak up a crash: if you\'re shot down, the survivors aboard live and the rescue team brings them home.' },
    { n: 'CRASH-RESISTANT FUEL', cost: 2000, d: 'Plus self-sealing fuel tanks: no fireball when you go down, and no repair bill.' },
  ] },
  { id: 'sight', name: 'GUN SIGHT', icon: '⊕', tiers: [
    { n: 'IRON SIGHTS', cost: 0, d: 'Point and hope.' },
    { n: 'STABILISED SIGHT', cost: 700, d: 'A gyro-stabilised sight: the nose gun and pods spread half as much.' },
    { n: 'HELMET SIGHT', cost: 1700, d: 'The gun follows your helmet: a third of the spread, and every shot lands where it hurts (+10% damage).' },
  ] },
  { id: 'quiet', name: 'QUIET KIT', icon: '◌', tiers: [
    { n: 'NONE', cost: 0, d: 'Everything for miles hears you coming.' },
    { n: 'EXHAUST SUPPRESSORS', cost: 800, d: 'Baffled exhausts: zombies hear you from a third less far, so fewer drift your way.' },
    { n: 'QUIET ROTOR', cost: 2000, d: 'Plus swept, slow-turning blades: zombies only hear you from less than half as far.' },
  ] },
  { id: 'tpod', name: 'TARGETING POD', icon: '⌾', tiers: [
    { n: 'NONE', cost: 0, d: 'Rockets go where they\'re pointed.' },
    { n: 'LASER DESIGNATOR', cost: 1400, d: 'A laser pod: every rocket steers to the exact spot under your crosshair.' },
    { n: 'SNIPER POD', cost: 3000, d: 'Plus a long-range camera: every zombie within 900 m shows on the map, and the big ones on screen.' },
  ] },
  { id: 'flaps', only: 'plane', name: 'FLAPS', icon: '◿', tiers: [
    { n: 'PLAIN WING', cost: 0, d: 'Slow down too much and you fall out of the sky.' },
    { n: 'SLOTTED FLAPS', cost: 800, d: 'You can fly 20% slower before it stalls: easier take-offs and landings, tighter turns.' },
    { n: 'FLAPS + SLATS', cost: 2000, d: 'Slats on the front of the wing too: stalls 35% slower, and it turns much tighter.' },
  ] },
  { id: 'airbrake', only: 'plane', name: 'AIRBRAKES', icon: '⏸', tiers: [
    { n: 'NONE', cost: 0, d: 'To slow down, throttle back and wait.' },
    { n: 'SPEED BRAKES', cost: 600, d: 'Hold S with the throttle right back: panels pop out and you slow down fast.' },
    { n: 'THRUST REVERSERS', cost: 1500, d: 'Plus reversers on the engines: stop on the runway in a few seconds.' },
  ] },
  { id: 'reheat', only: 'plane', name: 'AFTERBURNER', icon: '♨', tiers: [
    { n: 'NONE', cost: 0, d: 'Full throttle is as fast as it goes.' },
    { n: 'AFTERBURNER', cost: 1500, d: 'Hold SHIFT: fuel sprayed into the exhaust, +60% thrust. Drinks fuel.' },
    { n: 'BIG AFTERBURNER', cost: 3500, d: 'A longer, hotter burn: +110% thrust.' },
  ] },
  // ---- the Spectre's gunship kit (only fits a gunship)
  { id: 'gsgat', only: 'gunship', name: '25 MM GATLING', icon: '⁂', tiers: [
    { n: 'GAU-12', cost: 0, d: 'The standard 25 mm: fast, light shells. Good for strings of zombies.' },
    { n: 'HIGH-RATE GAU-12', cost: 1200, d: 'Faster motor: fires 45% faster.' },
    { n: 'TWIN GATLINGS', cost: 3200, d: 'A second Gatling next to the first: twice the fire, and the shells hit 20% harder.' },
  ] },
  { id: 'gsbof', only: 'gunship', name: '40 MM BOFORS', icon: '◉', tiers: [
    { n: 'BOFORS', cost: 0, d: 'A 40 mm cannon: one exploding shell about every half second.' },
    { n: 'AUTOLOADER', cost: 1500, d: 'Clips fed in by machine: fires 60% faster.' },
    { n: 'PROXIMITY FUZE', cost: 3500, d: 'Autoloader, and the shells burst just above the crowd: blast 50% wider, 30% harder.' },
  ] },
  { id: 'gshow', only: 'gunship', name: '105 MM HOWITZER', icon: '✹', tiers: [
    { n: 'HOWITZER', cost: 0, d: 'A field gun in the side of a plane. One huge shell every 3.5 seconds.' },
    { n: 'FAST LOADER', cost: 2000, d: 'A two-man loading crew: one shell every 2.2 seconds.' },
    { n: 'AIRBURST + INCENDIARY', cost: 4800, d: 'Fast loader, and the shells burst in the air (40% wider blast) and leave the ground burning.' },
  ] },
  { id: 'gsmag', only: 'gunship', name: 'GUNSHIP MAGAZINES', icon: '▤', tiers: [
    { n: 'STANDARD LOAD', cost: 0, d: '1,500 × 25 mm, 100 × 40 mm, 30 × 105 mm. Rearm at a base (3).' },
    { n: 'EXTRA RACKS', cost: 1000, d: '50% more of everything.' },
    { n: 'FULL LOAD-OUT', cost: 2600, d: 'Twice the standard load.' },
  ] },
  { id: 'gssens', only: 'gunship', name: 'SENSOR TURRET', icon: '◎', tiers: [
    { n: 'TV / THERMAL', cost: 0, d: 'A daylight camera and a white-hot thermal camera (I), four zoom levels.' },
    { n: 'TARGET TRACKER', cost: 1500, d: 'Press Q over a zombie, a crowd or a boss: the turret locks on and follows it. Q again to let go.' },
    { n: 'THREAT SCAN', cost: 3600, d: 'Tracker, and the computer boxes every crowd and boss it can see, marks friendlies on the roofs, and shows the zombies left near the crosshair.' },
  ] },
  { id: 'gsauto', only: 'gunship', name: 'GUNSHIP AUTOPILOT', icon: '⟲', tiers: [
    { n: 'FIXED ORBIT', cost: 0, d: 'Flies one steady circle round where you started.' },
    { n: 'ORBIT CONTROL', cost: 1200, d: 'While in gunship mode: W / S climb and descend, A / D tighten and widen the circle, O moves the circle to where you\'re aiming.' },
    { n: 'CREW GUNNER', cost: 4200, d: 'Orbit control, and a gunner works the 25 mm on his own, hosing the biggest crowd near your crosshair while you use the big guns.' },
  ] },
  { id: 'gear', only: 'plane', name: 'LANDING GEAR', icon: '⊼', tiers: [
    { n: 'STANDARD GEAR', cost: 0, d: 'Land gently.' },
    { n: 'ROUGH-FIELD GEAR', cost: 700, d: 'Big tyres and long-travel legs: hard landings don\'t hurt.' },
  ] },
  { id: 'hardpoints', only: 'plane', name: 'WING HARDPOINTS', icon: '⫶', tiers: [
    { n: 'STANDARD', cost: 0, d: 'The usual pylons.' },
    { n: 'EXTRA PYLONS', cost: 1200, d: 'Two more pylons on each wing: +50% rockets and bombs.' },
    { n: 'TRIPLE RACKS', cost: 2800, d: 'Triple ejector racks on every pylon: double rockets and bombs.' },
  ] },
  { id: 'pods', name: 'GUN PODS', icon: '⁑', tiers: [
    { n: 'NONE', cost: 0, d: 'Nothing on the wings but what you fit there.' },
    { n: '.50 CAL PODS', cost: 1400, d: 'Two HMP-400 heavy machine gun pods on the wings. They fire with the nose gun.' },
    { n: '20 MM CANNON PODS', cost: 3200, d: 'Two 20 mm cannon pods: slower, but every shell bursts. They fire with the nose gun.' },
  ] },
  { id: 'sniper', only: 'heli', name: 'MARKSMAN', icon: '⌕', tiers: [
    { n: 'NONE', cost: 0, d: 'Nobody aiming carefully.' },
    { n: 'DESIGNATED MARKSMAN', cost: 1600, d: 'A sharpshooter in the cabin with a scoped rifle: picks off screamers and riot police first, one shot every second and a half.' },
    { n: 'ANTI-MATERIEL RIFLE', cost: 3600, d: 'A .50 calibre rifle: one shot drops a brute, and it goes through riot armour and the one behind.' },
  ] },
  { id: 'racks', name: 'WEAPON RACKS', icon: '☰', tiers: [
    { n: 'NONE', cost: 0, d: 'Standard load.' },
    { n: 'EXTRA RACKS', cost: 900, d: 'Bigger ammo racks: +50% rockets and 2 more bombs.' },
    { n: 'FULL LOADOUT', cost: 2000, d: 'Every rack full: double rockets and 4 more bombs.' },
  ] },
  // ---- more upgrades: no new parts on the outside, but they all change how it flies, fights or pays
  // ---- new weapons
  { id: 'mines', name: 'MINE DROPPER', icon: '✲', tiers: [
    { n: 'NONE', cost: 0, d: 'Nothing to leave behind.' },
    { n: 'MINE RACK', cost: 900, d: 'Press N to drop a land mine. It arms on the ground and blows up the first zombies that walk over it. 6 mines.' },
    { n: 'BOUNDING MINES', cost: 2200, d: 'They jump up before they go off: a bigger blast, and 10 mines.' },
    { n: 'FIRE MINES', cost: 4500, d: '14 mines with a napalm charge: a huge blast and the ground burns after.' },
  ] },
  { id: 'turret', name: 'CHIN TURRET', icon: '⊕', tiers: [
    { n: 'FIXED GUN', cost: 0, d: 'The nose gun points where the nose points.' },
    { n: 'SWIVEL MOUNT', cost: 1100, d: 'The nose gun swings a little on its own onto zombies close to your crosshair.' },
    { n: 'HELMET-SIGHTED TURRET', cost: 2900, d: 'Like an Apache: the turret follows your eyes and snaps onto zombies well off the crosshair.' },
  ] },
  { id: 'salvo', name: 'RIPPLE FIRE', icon: '⁂', tiers: [
    { n: 'SINGLE SHOT', cost: 0, d: 'One rocket per click.' },
    { n: 'PAIRS', cost: 700, d: 'A rocket from each side at once: 2 per click.' },
    { n: 'RIPPLE OF FOUR', cost: 1900, d: 'A quick ripple of 4 rockets per click.' },
  ] },
  { id: 'ccip', name: 'BOMB SIGHT', icon: '⊙', tiers: [
    { n: 'GUESSWORK', cost: 0, d: 'Drop and hope.' },
    { n: 'CCIP BOMB SIGHT', cost: 900, d: 'A circle on the screen shows exactly where your bombs will land if you drop now.' },
  ] },
  { id: 'airburst', name: 'CANNON FUZES', icon: '✺', tiers: [
    { n: 'IMPACT FUZES', cost: 0, d: 'Cannon shells go off when they hit.' },
    { n: 'PROXIMITY FUZES', cost: 1300, d: 'Cannon shells go off just above the crowd: 50% bigger blast. Autocannons only.' },
    { n: 'PROGRAMMABLE AIRBURST', cost: 3200, d: 'Every shell is set to burst right over them: double blast, 15% harder. Autocannons only.' },
  ] },
  { id: 'jdam', name: 'BOMB GUIDANCE', icon: '⌖', tiers: [
    { n: 'DUMB BOMBS', cost: 0, d: 'They fall where they fall.' },
    { n: 'LASER-GUIDED KIT', cost: 1500, d: 'A seeker and little fins on every bomb: they steer towards the spot under your crosshair as they fall.' },
    { n: 'GPS GUIDANCE', cost: 3800, d: 'Satellite-guided tail kits: bombs glide a long way to hit exactly where you were aiming when you let go.' },
  ] },
  { id: 'bfuze', name: 'BOMB FUZES', icon: '⌇', tiers: [
    { n: 'IMPACT FUZES', cost: 0, d: 'Bombs go off when they hit the ground.' },
    { n: 'RADAR FUZES', cost: 1600, d: 'A little radar in the nose sets the bomb off 4 m above the ground: the blast covers 40% more of the crowd.' },
  ] },
  { id: 'flechette', name: 'FLECHETTE WARHEADS', icon: '⫶', tiers: [
    { n: 'NONE', cost: 0, d: 'Rockets just explode.' },
    { n: 'FLECHETTE ROCKETS', cost: 1700, d: 'Each rocket also throws a cone of steel darts forward: they tear through the zombies behind the one it hit.' },
  ] },
  { id: 'loader', name: 'RELOAD CREW', icon: '↻', tiers: [
    { n: 'NONE', cost: 0, d: 'Rockets come back one every 8 seconds.' },
    { n: 'CREW LOADER', cost: 1100, d: 'A crewman reloads the pods in the air: a rocket back every 4 seconds.' },
    { n: 'CREW + BOMB HOIST', cost: 2800, d: 'A rocket every 2.5 seconds, and a bomb winched back onto the rack every 20 seconds.' },
  ] },
  { id: 'barrel', name: 'GUN BARRELS', icon: '═', tiers: [
    { n: 'STOCK BARRELS', cost: 0, d: 'The barrels it came with.' },
    { n: 'MATCH BARRELS', cost: 600, d: 'Hand-fitted barrels: the nose gun hits 10% harder.' },
    { n: 'LONG BARRELS', cost: 1600, d: 'Longer barrels: 20% harder, and 20% tighter spread.' },
    { n: 'CHROME-LINED', cost: 3500, d: 'Chrome-lined long barrels: 30% harder, 30% tighter, and they heat up 20% slower.' },
  ] },
  { id: 'warhead', name: 'WARHEADS', icon: '▲', tiers: [
    { n: 'STANDARD', cost: 0, d: 'Ordinary rocket warheads.' },
    { n: 'HE-FRAG', cost: 700, d: 'High-explosive fragmentation: rockets hit 25% harder with a 15% bigger blast.' },
    { n: 'BLAST-FRAG', cost: 1800, d: '50% harder, 30% bigger blast.' },
    { n: 'TANDEM CHARGE', cost: 4000, d: 'Two charges in every rocket: 80% harder, 40% bigger blast.' },
  ] },
  { id: 'rkx', name: 'ROCKET STORAGE', icon: '⋙', tiers: [
    { n: 'STANDARD', cost: 0, d: 'The usual number of rockets.' },
    { n: 'SPARE PODS', cost: 900, d: 'Spare rockets stowed inside: 25% more rockets.' },
    { n: 'DOUBLE-STACK', cost: 2200, d: 'Double-stacked pods: 50% more rockets.' },
  ] },
  { id: 'belts', name: 'DOOR GUN BELTS', icon: '⁞', tiers: [
    { n: 'BOX MAGAZINES', cost: 0, d: 'The door gunners stop to change boxes.' },
    { n: 'LONG BELTS', cost: 800, d: 'Belts from big ammo cans: door gunners fire 30% faster.' },
    { n: 'LINKLESS FEED', cost: 2000, d: 'A powered feed straight from the cabin: door gunners fire 60% faster.' },
  ] },
  { id: 'spall', name: 'SPALL LINERS', icon: '▤', tiers: [
    { n: 'NONE', cost: 0, d: 'Bare metal inside.' },
    { n: 'KEVLAR LINERS', cost: 700, d: 'Kevlar blankets inside the cabin: you take 10% less damage from everything.' },
    { n: 'HEAVY LINERS', cost: 1800, d: 'Thicker liners: 20% less damage.' },
    { n: 'FULL TUB', cost: 3800, d: 'A kevlar tub all round the crew: 30% less damage.' },
  ] },
  { id: 'frame', name: 'AIRFRAME', icon: '⌗', tiers: [
    { n: 'STOCK FRAME', cost: 0, d: 'Factory standard.' },
    { n: 'REINFORCED', cost: 800, d: 'Doubled-up ribs and stringers: +10% health.' },
    { n: 'HEAVY-DUTY', cost: 2000, d: 'A heavy-duty frame: +20% health.' },
    { n: 'BATTLE FRAME', cost: 4500, d: 'Built for war: +35% health.' },
  ] },
  { id: 'glass', name: 'WINDSCREEN', icon: '◇', tiers: [
    { n: 'STOCK GLASS', cost: 0, d: 'Birds hurt. So does lightning.' },
    { n: 'BIRD-PROOF GLASS', cost: 400, d: 'Thick layered glass and wire cutters: bird strikes do no damage.' },
    { n: 'LIGHTNING PROTECTION', cost: 1200, d: 'Plus metal mesh in the skin: lightning can\'t hurt you in storms.' },
  ] },
  { id: 'fairing', name: 'AERO FAIRINGS', icon: '⌒', tiers: [
    { n: 'NONE', cost: 0, d: 'Bits sticking out everywhere.' },
    { n: 'SMOOTH COVERS', cost: 700, d: 'Covers over the bumps: 5% faster.' },
    { n: 'SLEEK FAIRINGS', cost: 1800, d: 'Proper fairings: 10% faster.' },
    { n: 'RACING BODY KIT', cost: 3800, d: 'A whole smooth body kit: 16% faster.' },
  ] },
  { id: 'strip', name: 'WEIGHT SAVING', icon: '⇡', tiers: [
    { n: 'NONE', cost: 0, d: 'Every seat cushion and coffee machine still aboard.' },
    { n: 'STRIPPED OUT', cost: 600, d: 'Everything you don\'t need comes out: 6% lighter, so it climbs and turns better.' },
    { n: 'CARBON PANELS', cost: 1700, d: 'Carbon-fibre panels too: 12% lighter.' },
  ] },
  { id: 'tailr', only: 'heli', name: 'TAIL ROTOR', icon: '✢', tiers: [
    { n: 'STOCK TAIL ROTOR', cost: 0, d: 'Turns it round. Eventually.' },
    { n: 'HIGH-AUTHORITY', cost: 700, d: 'Bigger, faster tail rotor: turns 10% quicker.' },
    { n: 'FENESTRON', cost: 1900, d: 'A shrouded fan in the tail: turns 20% quicker.' },
  ] },
  { id: 'gyro', name: 'STABILITY', icon: '⊜', tiers: [
    { n: 'NONE', cost: 0, d: 'Wind and storms throw you about.' },
    { n: 'STABILITY AUGMENTATION', cost: 600, d: 'A gyro system that fights the wind: half the wind push and turbulence.' },
    { n: 'ACTIVE GUST DAMPING', cost: 1500, d: 'Sensors feel the gust coming: wind and turbulence barely touch you.' },
  ] },
  { id: 'bladder', name: 'FUEL BLADDERS', icon: '⛽', tiers: [
    { n: 'NONE', cost: 0, d: 'Just the tanks.' },
    { n: 'FUEL BLADDERS', cost: 500, d: 'Rubber fuel bags in every gap: 15% more fuel.' },
    { n: 'BIG BLADDERS', cost: 1300, d: '30% more fuel.' },
  ] },
  { id: 'scav', name: 'SCAVENGER CREW', icon: '⚙', tiers: [
    { n: 'NONE', cost: 0, d: 'Nobody picking through what\'s left.' },
    { n: 'SCAVENGER', cost: 1000, d: 'Someone who knows what\'s worth taking: 15% more scrap from every kill.' },
    { n: 'SALVAGE TEAM', cost: 2500, d: '30% more scrap from every kill.' },
    { n: 'STRIP-MINERS', cost: 5000, d: '50% more scrap from every kill.' },
  ] },
  { id: 'nets', name: 'CARGO NETS', icon: '#', tiers: [
    { n: 'NONE', cost: 0, d: 'Crates rattle about.' },
    { n: 'CARGO NETS', cost: 600, d: 'Nothing falls out: supply crates pay 50% more.' },
    { n: 'CARGO MASTER', cost: 1500, d: 'A loadmaster aboard: supply crates pay double.' },
  ] },
  { id: 'pad', name: 'PADDED CABIN', icon: '♥', tiers: [
    { n: 'BARE FLOOR', cost: 0, d: 'Survivors sit on the floor.' },
    { n: 'BLANKETS & WATER', cost: 500, d: 'Happy survivors tell their friends: 25% more scrap for every rescue.' },
    { n: 'COMFY SEATS', cost: 1400, d: '50% more scrap for every rescue.' },
  ] },
];
export const SLOT = Object.fromEntries(SLOTS.map((s) => [s.id, s]));

// the helicopters you can fly. cap = the highest tier of each upgrade that fits (0 = can't fit it at all).
export const HELIS = {
  warhorse: { n: 'WARHORSE', cost: 0, d: 'The all-rounder. Good guns, room for your team, takes a beating. Fits every upgrade.', seats: [4, 8, 12, 16],
    hp: 1, mass: 1, lift: 1, speed: 1, agility: 1, fuel: 1, cap: {} },
  hornet: { n: 'HORNET', cost: 1500, d: 'A tiny, fast scout. Darts between skyscrapers and turns on a coin. Two inside, two on the benches outside. Paper-thin.', seats: [4, 6],
    hp: 0.6, mass: 0.72, lift: 1.06, speed: 1.3, agility: 1.65, fuel: 0.85, cap: { gun: 2, rockets: 2, bombs: 1, armor: 1, cabin: 1, fuel: 1, winch: 1, medbay: 0, drops: 1, engine: 3, speaker: 1, pods: 1, sniper: 1 } },
  reaper: { n: 'REAPER', cost: 4500, d: 'A gunship. Its chin gun hits 30% harder, its four pylons carry 50% more rockets, and it\'s armoured like a tank. Two seats only.', seats: [2],
    hp: 1.75, mass: 1.2, lift: 1.28, speed: 1.14, agility: 1.08, fuel: 1, gunMul: 1.3, rocketMul: 1.5, cap: { cabin: 0, door: 0, winch: 0, medbay: 0, sniper: 0 } },
  viper: { n: 'VIPER', cost: 3000, d: 'A slim two-seat attack helicopter: the fastest thing in the sky, a chin gun 15% harder and 25% more rockets. Not much armour, no cabin.', seats: [2],
    hp: 0.9, mass: 0.85, lift: 1.12, speed: 1.4, agility: 1.4, fuel: 0.95, gunMul: 1.15, rocketMul: 1.25, cap: { cabin: 0, door: 0, winch: 0, medbay: 0, drops: 1, sniper: 0 } },
  kestrel: { n: 'KESTREL', cost: 6500, d: 'A big three-engine utility helicopter: 12 to 24 seats, a quick cruise, tough as anything, and room for nearly every upgrade.', seats: [12, 16, 20, 24],
    hp: 1.45, mass: 1.35, lift: 1.42, speed: 1.08, agility: 0.8, fuel: 1.5, cap: { gun: 3 } },
  huey: { n: 'HUEY', cost: 1000, d: 'The classic. A cheap, honest utility helicopter: big open doors, a two-blade rotor you can hear for miles, room for 6 to 14, and it fits almost everything.', seats: [6, 9, 12, 14],
    hp: 0.95, mass: 0.95, lift: 1.04, speed: 1.02, agility: 1.08, fuel: 1.15, cap: { gun: 3, rockets: 2, armor: 3, rotor: 1 } },
  seaking: { n: 'SEA KING', cost: 5500, d: 'A big search-and-rescue helicopter with a boat hull: it can land on water. A rescue hoist comes fitted, 14 to 26 seats, and it flies for ages.', seats: [14, 18, 22, 26],
    hp: 1.55, mass: 1.45, lift: 1.52, speed: 0.98, agility: 0.74, fuel: 1.7, floats: true, min: { winch: 1 }, cap: { gun: 2, rockets: 2, pods: 1 } },
  osprey: { n: 'OSPREY', cost: 8000, d: 'A PLANE that can hover: press V to tip the rotors forward and fly like a plane, V again to hover like a helicopter. 16 to 28 seats, huge range. Wide, so mind the buildings.', seats: [16, 20, 24, 28],
    hp: 1.5, mass: 1.5, lift: 1.62, speed: 1.2, agility: 0.7, fuel: 2.0, tilt: true, plane: true, vtol: true, stall: 30, vmax: 95, thrust: 9, cap: { rotor: 0, gun: 2, rockets: 2, pods: 1, bombs: 2 } },
  harrier: { n: 'HARRIER', cost: 9500, d: 'A jump jet PLANE: hovers on four swivelling nozzles, then press V and it flies like a fighter, the fastest thing in the game. Guns 20% harder, 50% more rockets. One seat.', seats: [1],
    hp: 0.85, mass: 0.9, lift: 1.3, speed: 1.3, agility: 1.55, fuel: 0.9, plane: true, vtol: true, stall: 34, vmax: 118, thrust: 11, gunMul: 1.2, rocketMul: 1.5, jet: true, cap: { rotor: 0, cabin: 0, door: 0, winch: 0, medbay: 0, sniper: 0, drops: 0, armor: 2 } },
  alligator: { n: 'ALLIGATOR', cost: 7000, d: 'A heavy attack helicopter with two rotors stacked on one mast (no tail rotor), two pilots side by side, and six pylons. Chin gun +25%, rockets +40%, armoured.', seats: [2],
    hp: 1.55, mass: 1.15, lift: 1.3, speed: 1.25, agility: 1.35, fuel: 1.05, gunMul: 1.25, rocketMul: 1.4, cap: { cabin: 0, door: 0, winch: 0, medbay: 0, sniper: 0, rotor: 0 } },
  warthog: { n: 'WARTHOG', cost: 8500, d: 'A PLANE built around a gun: the GAU-8 30 mm cannon (+60% damage), armour round the pilot (+120% health), eleven pylons. Takes off from the runway, needs speed to stay up.', seats: [1],
    hp: 2.2, mass: 1.2, lift: 1.2, speed: 1, agility: 1.0, fuel: 1.4, gunMul: 1.6, rocketMul: 1.5, plane: true, jet: true, stall: 26, vmax: 82, thrust: 8, cap: { cabin: 0, door: 0 } },
  spectre: { n: 'SPECTRE', cost: 11000, d: 'A flying GUNSHIP: four propellers, and a 25 mm Gatling, a 40 mm Bofors and a 105 mm howitzer pointing out of the left side. Climb above 80 m and press G: the autopilot circles and you aim the guns through the sensor camera (1 / 2 / 3 picks the gun, wheel zooms, I for thermal). Huge, tough, slow to turn.', seats: [4],
    hp: 2.4, mass: 1.8, lift: 1.5, speed: 1, agility: 0.55, fuel: 2.2, plane: true, gunship: true, stall: 30, vmax: 70, thrust: 6.5, min: { door: 3 }, cap: { cabin: 0, rockets: 0, pods: 0 } },
  lynx: { n: 'LYNX', cost: 2400, d: 'A fast, nimble utility helicopter on wheels: a four-blade rotor, room for 4 to 8, quick to turn and quick to climb. A great step up from the Warhorse.', seats: [4, 6, 6, 8],
    hp: 0.95, mass: 0.85, lift: 1.1, speed: 1.22, agility: 1.35, fuel: 1.0, cap: { gun: 3, rockets: 2, armor: 2 } },
  stallion: { n: 'STALLION', cost: 5200, d: 'A tough twin-engine troop carrier: 11 to 20 seats, two door guns fitted as standard, crash-proof seats, and stub wings for extra pylons. Built to go in under fire.', seats: [11, 14, 17, 20],
    hp: 1.5, mass: 1.25, lift: 1.36, speed: 1.12, agility: 0.95, fuel: 1.3, rocketMul: 1.2, min: { door: 2 }, cap: {} },
  bronco: { n: 'BRONCO', cost: 6000, d: 'A twin-boom propeller attack PLANE built to fly low and slow over a fight: stalls at only 80 km/h, turns tight, takes off in no distance, rockets +30%. Two seats.', seats: [2],
    hp: 1.15, mass: 0.95, lift: 1.25, speed: 1, agility: 1.35, fuel: 1.3, rocketMul: 1.3, plane: true, stall: 22, vmax: 80, thrust: 7.5, cap: { cabin: 0, door: 0, winch: 0, medbay: 0 } },
  falcon: { n: 'FALCON', cost: 14000, d: 'A supersonic fighter JET: the fastest and most agile thing in the sky, afterburner fitted, a 20 mm Gatling and missiles on the wingtips. Needs a long runway and lots of speed. One seat.', seats: [1],
    hp: 0.95, mass: 0.9, lift: 1.2, speed: 1.4, agility: 1.9, fuel: 1.1, gunMul: 1.15, rocketMul: 1.3, plane: true, jet: true, stall: 40, vmax: 150, thrust: 14, min: { reheat: 1 }, cap: { cabin: 0, door: 0, winch: 0, medbay: 0, sniper: 0, drops: 0 } },
  pelican: { n: 'PELICAN', cost: 9000, d: 'A FLYING BOAT: a plane with a boat for a body and floats on its wingtips. Takes off from the runway or from the river, carries 10 to 22, and flies for ages. Slow and steady.', seats: [10, 14, 18, 22],
    hp: 1.6, mass: 1.4, lift: 1.4, speed: 1, agility: 0.75, fuel: 2.2, plane: true, floats: true, stall: 24, vmax: 74, thrust: 7, cap: { cabin: 3, winch: 0 } },
  mosquito: { n: 'MOSQUITO', cost: 10500, d: 'A fast twin-engine fighter-bomber PLANE made of wood: four cannons under the nose, a bomb bay full of fire bombs, and two big propellers. Two seats.', seats: [2],
    hp: 1.0, mass: 1.0, lift: 1.2, speed: 1.2, agility: 1.45, fuel: 1.5, gunMul: 1.3, plane: true, stall: 32, vmax: 108, thrust: 10.5, min: { bombs: 1 }, cap: { cabin: 0, door: 0, winch: 0, medbay: 0, sniper: 0 } },
  fortress: { n: 'FORTRESS', cost: 16000, d: 'A four-engine heavy BOMBER: a glass nose, gun turrets on top, underneath and in the tail, waist gunners, and an enormous bomb bay. Slow to turn, but almost impossible to bring down.', seats: [6, 8, 10, 12],
    hp: 3.2, mass: 2.4, lift: 1.6, speed: 1, agility: 0.55, fuel: 3.0, gunMul: 1.2, plane: true, stall: 30, vmax: 84, thrust: 8.6, min: { door: 2, bombs: 1 }, cap: { winch: 0 } },
  gyro: { n: 'WHIRLYBIRD', cost: 2200, d: 'An AUTOGYRO: a tiny open plane with a free-spinning rotor on top instead of wings, and a pusher propeller behind your seat. It flies at walking pace and lands almost anywhere. One seat.', seats: [1],
    hp: 0.6, mass: 0.5, lift: 1, speed: 0.8, agility: 1.3, fuel: 1.4, plane: true, stall: 10, vmax: 44, thrust: 4.6, cap: { cabin: 0, door: 0, winch: 0, medbay: 0, armor: 1, bombs: 1, rockets: 1, sniper: 0, pods: 0, racks: 0, hardpoints: 0 } },
  biplane: { n: 'BARNSTORMER', cost: 3200, d: 'An old BIPLANE: two wings, bracing wires, a round radial engine and an open cockpit. Slow, but it rolls and loops like nothing else and lands in any field. Two seats.', seats: [2],
    hp: 0.85, mass: 0.7, lift: 1, speed: 0.9, agility: 2.1, fuel: 1.3, plane: true, stall: 18, vmax: 62, thrust: 6.6, cap: { cabin: 0, door: 0, winch: 0, medbay: 0, armor: 2, sniper: 0 } },
  zeppelin: { n: 'ZEPPELIN', cost: 14000, d: 'An AIRSHIP: a huge silver gas bag with a cabin slung underneath and two door gunners. Slow and enormous, but it hangs in the sky for ages and carries 20 to 40 people.', seats: [20, 26, 32, 40],
    hp: 2.4, mass: 2.6, lift: 2.7, speed: 0.55, agility: 0.42, fuel: 2.4, min: { door: 2 }, cap: { rotor: 0, skids: 0, engine: 2 } },
  mule: { n: 'MULE', cost: 3500, d: 'A huge twin-rotor transport. Slow and wide, but carries 16 people (32 with the cabin upgrades), flies for ages and can soak up hits.', seats: [16, 24, 32, 40],
    hp: 2.1, mass: 1.75, lift: 1.78, speed: 0.84, agility: 0.52, fuel: 1.9, cap: { gun: 1, rockets: 0, rotor: 1, engine: 3, racks: 0, pods: 0 } },
};
// ---- VARIANTS: the same airframe as one above, but built for a different job: different numbers, and kit that comes
// fitted (and shows on the outside). base = the airframe it's built on.
const VAR = (base, o) => { const B = HELIS[base]; return { ...B, ...o, base, cap: { ...B.cap, ...(o.cap || {}) }, min: { ...(B.min || {}), ...(o.min || {}) } }; };
Object.assign(HELIS, {
  sparrow: VAR('hornet', { n: 'SPARROW', cost: 1200, d: 'A police scout: the Hornet with a NightSun searchlight and night vision already fitted. Quick, cheap and great at night.', hp: 0.65, speed: 1.32, min: { light: 2, nvg: 1 } }),
  medic: VAR('huey', { n: 'DUSTOFF', cost: 1900, d: 'The classic Huey as a flying ambulance: medical bay and rescue winch fitted, room for 8 to 16.', seats: [8, 10, 13, 16], hp: 1.05, min: { medbay: 1, winch: 1 }, cap: { gun: 2, rockets: 1 } }),
  gunslinger: VAR('huey', { n: 'HUEY GUNSLINGER', cost: 2600, d: 'A Huey bristling with guns: two door gunners, rocket pods and machine-gun pods all fitted. Cheap firepower.', seats: [4, 6, 8, 10], hp: 1.1, gunMul: 1.1, min: { door: 2, rockets: 1, pods: 1 } }),
  apache: VAR('reaper', { n: 'APACHE', cost: 9500, d: 'The king of attack helicopters: Hellfire rails, a laser targeting pod and thermal camera all fitted, armoured like a tank, chin gun +40%.', hp: 1.95, speed: 1.18, gunMul: 1.4, rocketMul: 1.6, min: { rockets: 3, tpod: 1, flir: 1 } }),
  nightstalker: VAR('stallion', { n: 'NIGHT STALKER', cost: 7800, d: 'Special forces Stallion: night vision, quiet rotors and a thermal camera fitted, door guns, and it barely makes a sound. Zombies hear you from half as far.', hp: 1.6, speed: 1.18, min: { door: 2, nvg: 1, quiet: 2, flir: 1 } }),
  hook: VAR('mule', { n: 'HOOK', cost: 6200, d: 'The super-heavy Mule: a cargo hook and big fuel tanks fitted, up to 48 seats, and even harder to knock down.', seats: [20, 30, 40, 48], hp: 2.4, lift: 1.9, speed: 0.9, min: { winch: 2, fuel: 1 } }),
});
const PERKS = { 'warhorse': 'FIELD PATCHING: the crew patch it up in the air, healing back up to half health.', 'hornet': 'TOO SMALL TO GRAB: zombies can barely hang on to the skids.', 'reaper': 'BATHTUB ARMOUR: takes 25% less damage from everything.', 'viper': 'SPRINT: SHIFT boost works even with the stock engine.', 'kestrel': 'THRIFTY: burns 30% less fuel.', 'huey': 'LOUD AND PROUD: the dead come running to that two-blade thump: +25% scrap from kills.', 'seaking': 'BOAT HULL: lands on water.', 'osprey': 'TILTROTOR: hovers like a helicopter, V to fly like a plane.', 'harrier': 'JUMP JET: hovers on its nozzles, V to fly like a fighter.', 'alligator': 'EJECTION SEATS: crash safety fitted, so nobody aboard is lost if you go down.', 'warthog': 'GAU-8: the biggest gun in the game.', 'spectre': 'GUNSHIP: press G above 80 m to circle and fire the side guns.', 'lynx': 'QUICK HANDS: people climb aboard twice as fast.', 'stallion': 'GUN CREW: its door gunners fire 30% faster.', 'bronco': 'LOW AND SLOW: stalls at only 80 km/h, takes off in no distance.', 'falcon': 'SUPERSONIC: afterburner fitted, the fastest thing in the sky.', 'mule': 'THE BUS: up to 40 people.', 'sparrow': 'NIGHT HUNTER: kills at night pay double scrap.', 'medic': 'MEDEVAC: every rescue pays double.', 'gunslinger': 'ARSENAL: door guns, rocket pods and gun pods all fitted.', 'apache': 'HELLFIRE: guided missiles and a laser targeting pod fitted.', 'nightstalker': 'SILENT: zombies can hardly hear it at all.', 'pelican': 'FLYING BOAT: lands and takes off on the river as well as the runway.', 'mosquito': 'BOMB TRUCK: carries twice as many bombs.', 'fortress': 'FLYING FORTRESS: three times the bombs, and gunners at the waist windows.', 'gyro': 'CAN\'T STALL: the free-spinning rotor holds it up even at walking pace.', 'biplane': 'STUNT PLANE: rolls and loops twice as fast as anything else.', 'zeppelin': 'LIGHTER THAN AIR: burns a quarter of the fuel, and if it\'s shot down it sinks gently so nobody aboard is lost.', 'hook': 'SKY CRANE: cargo hook fitted, and supply crates pay double.' };
for (const k of Object.keys(HELIS)) HELIS[k].pk = PERKS[k] || '';
for (const k of Object.keys(HELIS)) if (!HELIS[k].min || !Object.keys(HELIS[k].min).length) delete HELIS[k].min;
export const MODEL = (k) => (HELIS[k] && HELIS[k].base) || k;
// is this upgrade one for helicopters, planes or both? (the VTOLs count as both)
export function slotFits(id, kind) {
  const sl = SLOT[id], HK = HELIS[kind] || HELIS.warhorse;
  if (!sl || !sl.only) return true;
  if (sl.only === 'gunship') return !!HK.gunship;
  if (HK.vtol) return true;
  return sl.only === (HK.plane ? 'plane' : 'heli');
}
export const HELI_IDS = Object.keys(HELIS).sort((a, b) => HELIS[a].cost - HELIS[b].cost);
// the upgrades that actually fit this helicopter
export function capEq(eq, kind = 'warhorse') {
  const HK = HELIS[kind] || HELIS.warhorse, cap = HK.cap, out = {};
  for (const k of Object.keys(eq)) out[k] = Math.min(eq[k], slotFits(k, kind) ? (cap[k] ?? 99) : 0);
  for (const k of Object.keys(HK.min || {})) out[k] = Math.max(out[k] || 0, HK.min[k]);      // kit that comes fitted
  return out;
}

// paint jobs: body colour, trim colour, a pattern, and the cost
export const PAINTS = [
  { id: 'redtail', n: 'RED TAIL', body: [0.78, 0.8, 0.82], trim: [0.75, 0.08, 0.06], cost: 0, rank: 3, stripe: [0.75, 0.08, 0.06], mat: 'metal' },
  { id: 'tiger', n: 'TIGER', body: [0.92, 0.48, 0.08], trim: [0.06, 0.06, 0.06], cost: 0, rank: 4, stripe: [0.06, 0.06, 0.06], shark: true },
  { id: 'checker', n: 'CHEQUERED FLAG', body: [0.9, 0.9, 0.88], trim: [0.06, 0.06, 0.06], cost: 0, rank: 5, stripe: [0.06, 0.06, 0.06] },
  { id: 'thunder', n: 'THUNDERBIRD', body: [0.06, 0.12, 0.38], trim: [0.95, 0.78, 0.1], cost: 0, rank: 6, stripe: [0.95, 0.78, 0.1] },
  { id: 'gold', n: 'ACE GOLD', body: [0.85, 0.66, 0.2], trim: [0.08, 0.07, 0.05], cost: 0, rank: 7, stripe: [0.08, 0.07, 0.05], mat: 'metal' },
  { id: 'chrome', n: 'LEGEND CHROME', body: [0.86, 0.88, 0.92], trim: [0.2, 0.85, 1], cost: 0, rank: 8, stripe: [0.2, 0.85, 1], glow: [0.2, 0.85, 1], mat: 'metal' },
  { id: 'olive', n: 'OLIVE', body: [0.3, 0.34, 0.22], trim: [0.16, 0.17, 0.13], cost: 0 },
  { id: 'night', n: 'NIGHT OPS', body: [0.12, 0.13, 0.15], trim: [0.05, 0.05, 0.06], cost: 0 },
  { id: 'arctic', n: 'ARCTIC', body: [0.82, 0.84, 0.86], trim: [0.3, 0.33, 0.36], cost: 150 },
  { id: 'desert', n: 'DESERT', body: [0.66, 0.55, 0.38], trim: [0.4, 0.31, 0.2], cost: 150 },
  { id: 'rescue', n: 'RESCUE', body: [0.85, 0.2, 0.12], trim: [0.92, 0.92, 0.9], cost: 300, stripe: [0.92, 0.92, 0.9] },
  { id: 'hazard', n: 'HAZARD', body: [0.95, 0.72, 0.08], trim: [0.08, 0.08, 0.08], cost: 500, stripe: [0.08, 0.08, 0.08] },
  { id: 'shark', n: 'SHARK MOUTH', body: [0.42, 0.46, 0.5], trim: [0.2, 0.22, 0.25], cost: 800, shark: true },
  { id: 'toxic', n: 'TOXIC', body: [0.2, 0.22, 0.2], trim: [0.35, 1, 0.2], cost: 1200, glow: [0.35, 1, 0.2], stripe: [0.35, 1, 0.2] },
  { id: 'navy', n: 'NAVY GREY', body: [0.42, 0.45, 0.48], trim: [0.22, 0.24, 0.26], cost: 200 },
  { id: 'jungle', n: 'JUNGLE GREEN', body: [0.16, 0.25, 0.13], trim: [0.08, 0.1, 0.07], cost: 200 },
  { id: 'midnight', n: 'MIDNIGHT BLUE', body: [0.08, 0.12, 0.25], trim: [0.04, 0.05, 0.1], cost: 350 },
  { id: 'police', n: 'POLICE', body: [0.9, 0.91, 0.92], trim: [0.1, 0.2, 0.55], cost: 400, stripe: [0.1, 0.25, 0.75] },
  { id: 'medevac', n: 'MEDEVAC', body: [0.92, 0.92, 0.9], trim: [0.75, 0.1, 0.1], cost: 400, stripe: [0.85, 0.12, 0.1] },
  { id: 'coast', n: 'COASTGUARD', body: [0.95, 0.45, 0.1], trim: [0.92, 0.92, 0.9], cost: 450, stripe: [0.92, 0.92, 0.9] },
  { id: 'cherry', n: 'CHERRY RED', body: [0.55, 0.05, 0.07], trim: [0.12, 0.02, 0.03], cost: 600 },
  { id: 'carbon', n: 'CARBON BLACK', body: [0.07, 0.07, 0.08], trim: [0.3, 0.3, 0.32], cost: 700, mat: 'metal' },
  { id: 'sky', n: 'SKY BLUE', body: [0.45, 0.65, 0.85], trim: [0.92, 0.92, 0.9], cost: 500, stripe: [0.92, 0.92, 0.9] },
  { id: 'teal', n: 'OCEAN TEAL', body: [0.1, 0.42, 0.45], trim: [0.05, 0.2, 0.22], cost: 400 },
  { id: 'pink', n: 'DESERT PINK', body: [0.78, 0.55, 0.52], trim: [0.45, 0.3, 0.28], cost: 400 },
  { id: 'bee', n: 'BUMBLEBEE', body: [0.95, 0.75, 0.05], trim: [0.05, 0.05, 0.05], cost: 700, stripe: [0.05, 0.05, 0.05] },
  { id: 'gunship', n: 'GUNSHIP GREY', body: [0.28, 0.3, 0.32], trim: [0.12, 0.13, 0.14], cost: 300 },
  { id: 'gold', n: 'SOLID GOLD', body: [0.85, 0.64, 0.2], trim: [0.5, 0.36, 0.1], cost: 5000, mat: 'brass' },
  { id: 'dev', n: 'DEV: ROOT', body: [0.04, 0.05, 0.06], trim: [0.1, 1, 0.45], cost: 0, glow: [0.1, 1, 0.45], stripe: [0.1, 1, 0.45], dev: true },
];
export const PAINT = Object.fromEntries(PAINTS.map((p) => [p.id, p]));
// camouflage patterns over the paint (k = the pattern number in the shader), nose art and tail markings
export const CAMOS = [
  { id: 'none', n: 'NO CAMO', cost: 0, d: 'Just the paint.' },
  { id: 'woodland', n: 'WOODLAND', cost: 300, k: 1, d: 'Blotches of dark green, brown and black.' },
  { id: 'desert', n: 'DESERT', cost: 300, k: 2, d: 'Big soft patches of sand and earth.' },
  { id: 'urban', n: 'URBAN', cost: 300, k: 3, d: 'Greys, for the city.' },
  { id: 'tiger', n: 'TIGER STRIPES', cost: 700, k: 4, d: 'Black stripes the whole way down.' },
  { id: 'splinter', n: 'SPLINTER', cost: 900, k: 5, d: 'Hard-edged shards of light and dark.' },
  { id: 'digital', n: 'DIGITAL', cost: 1200, k: 6, d: 'Tiny pixels, like modern uniforms.' },
  { id: 'arcticcamo', n: 'ARCTIC CAMO', cost: 800, k: 7, d: 'White and pale grey blotches, for snow.' },
  { id: 'junglecamo', n: 'JUNGLE', cost: 800, k: 8, d: 'Busy little shapes in three greens and a brown.' },
  { id: 'lizard', n: 'LIZARD', cost: 1000, k: 9, d: 'Long ragged streaks along the body.' },
];
export const CAMO = Object.fromEntries(CAMOS.map((p) => [p.id, p]));
export const NOSEART = [
  { id: 'none', n: 'NONE', cost: 0, d: 'A plain nose.' },
  { id: 'shark', n: 'SHARK MOUTH', cost: 600, d: 'Red mouth, white teeth, an eye. The classic.' },
  { id: 'flames', n: 'FLAMES', cost: 900, d: 'Hot-rod flames licking back from the nose.' },
  { id: 'skull', n: 'SKULL & BONES', cost: 900, d: 'A skull and crossbones on both sides.' },
  { id: 'checks', n: 'CHEQUERED NOSE', cost: 500, d: 'Black and white checks, like the old fighter squadrons.' },
  { id: 'bolt', n: 'LIGHTNING BOLT', cost: 600, d: 'A yellow lightning bolt down each side.' },
  { id: 'sunburst', n: 'SUNBURST', cost: 800, d: 'Orange and yellow rays fanning back from the nose.' },
];
export const TAILART = [
  { id: 'none', n: 'PLAIN TAIL', cost: 0, d: 'Nothing on the tail.' },
  { id: 'stripes', n: 'INVASION STRIPES', cost: 400, d: 'Black and white bands round the tail boom.' },
  { id: 'bands', n: 'RESCUE BANDS', cost: 400, d: 'Dayglo orange bands, so your team can spot you.' },
  { id: 'number', n: 'TAIL NUMBER', cost: 200, d: 'Your number on both sides. Click it again for a new one.' },
  { id: 'tchecks', n: 'CHEQUERED BAND', cost: 400, d: 'A black and white chequered band round the tail.' },
  { id: 'star', n: 'STAR ROUNDEL', cost: 500, d: 'A white star in a blue circle on each side of the cabin.' },
];
// rotor tip colours (the tips are painted so people can see the blades spinning)
export const TIPS = [
  { id: 'none', n: 'YELLOW TIPS', cost: 0, d: 'The standard: yellow.', col: [0.9, 0.8, 0.2] },
  { id: 'white', n: 'WHITE TIPS', cost: 100, d: 'Plain white.', col: [0.93, 0.93, 0.9] },
  { id: 'red', n: 'RED TIPS', cost: 150, d: 'Bright red.', col: [0.85, 0.1, 0.08] },
  { id: 'orange', n: 'DAYGLO TIPS', cost: 200, d: 'Dayglo orange, very easy to see.', col: [1, 0.45, 0.05] },
  { id: 'black', n: 'BLACK TIPS', cost: 150, d: 'Stealthy.', col: [0.04, 0.04, 0.05] },
  { id: 'chequer', n: 'STRIPED TIPS', cost: 300, d: 'Red and white stripes.', col: [0.85, 0.1, 0.08], col2: [0.93, 0.93, 0.9] },
];
// tinted glass
export const TINTS = [
  { id: 'none', n: 'CLEAR GLASS', cost: 0, d: 'Ordinary glass.' },
  { id: 'smoke', n: 'SMOKED', cost: 200, d: 'Dark, like sunglasses.', col: [0.03, 0.03, 0.035] },
  { id: 'gold', n: 'GOLD VISOR', cost: 400, d: 'Gold-coated, like an astronaut\'s visor.', col: [0.45, 0.33, 0.08] },
  { id: 'blue', n: 'BLUE TINT', cost: 250, d: 'A cold blue.', col: [0.06, 0.16, 0.38] },
  { id: 'green', n: 'NVG GREEN', cost: 250, d: 'Night-vision-safe green.', col: [0.06, 0.25, 0.1] },
  { id: 'amber', n: 'AMBER', cost: 300, d: 'Warm orange.', col: [0.45, 0.2, 0.03] },
];
// a second colour for the trim (tail plane, fins, pods...), over the paint job's own
export const TRIMS = [
  { id: 'none', n: 'MATCHING TRIM', cost: 0, d: 'Whatever the paint job comes with.' },
  { id: 'black', n: 'BLACK TRIM', cost: 150, d: 'Black.', col: [0.05, 0.05, 0.06] },
  { id: 'white', n: 'WHITE TRIM', cost: 150, d: 'White.', col: [0.9, 0.9, 0.88] },
  { id: 'red', n: 'RED TRIM', cost: 200, d: 'Red.', col: [0.7, 0.08, 0.07] },
  { id: 'yellow', n: 'YELLOW TRIM', cost: 200, d: 'Yellow.', col: [0.95, 0.72, 0.08] },
  { id: 'blue', n: 'BLUE TRIM', cost: 200, d: 'Blue.', col: [0.1, 0.25, 0.65] },
  { id: 'gunmetal', n: 'GUNMETAL TRIM', cost: 250, d: 'Dark bare metal.', col: [0.22, 0.23, 0.25] },
];

// THE SPIRE: what you build at the base. Each tier needs scrap AND enough people living there (everyone you rescue
// moves in). The people are what make the place work: they scavenge, so the more there are, the more scrap comes in.
export const BASE = [
  { id: 'bunks', name: 'BUNKS', icon: '⌂', tiers: [
    { n: 'CAMP BEDS', cost: 0, pop: 0, d: 'Room for 40 people. Everyone over that just sleeps on the floor and doesn\'t help.' },
    { n: 'BARRACKS FLOORS', cost: 1200, pop: 25, d: 'Three floors turned into dorms: room for 150.' },
    { n: 'THE WHOLE TOWER', cost: 3500, pop: 90, d: 'Every floor fitted out: room for 500.' },
  ] },
  { id: 'guns', name: 'DEFENCE GUNS', icon: '⌖', tiers: [
    { n: 'TWIN .50 CALS', cost: 0, pop: 0, d: 'Heavy machine guns on the corners of the flight deck.' },
    { n: 'BOFORS 40 MM', cost: 2500, pop: 30, d: 'Old anti-aircraft guns: explosive shells that blow piles apart.' },
    { n: 'PHALANX CIWS', cost: 6000, pop: 120, d: 'A navy close-in weapon system on every corner: 75 shots a second. Nothing gets near the Spire.' },
  ] },
  { id: 'depot', name: 'FUEL DEPOT', icon: '⛽', tiers: [
    { n: 'JERRY CANS', cost: 0, pop: 0, d: 'Fuel by hand.' },
    { n: 'FUEL BOWSER', cost: 1500, pop: 20, d: 'Refuel twice as fast, and fuel drops (G) cost ⚙60 and bring twice as much.' },
    { n: 'TANK FARM', cost: 4000, pop: 70, d: 'Big tanks and pumps: refuelling, repairs and rearming are instant, and fuel drops are free.' },
  ] },
  { id: 'works', name: 'WORKSHOP', icon: '⚒', tiers: [
    { n: 'TOOLBOX', cost: 0, pop: 0, d: 'A spanner and some tape.' },
    { n: 'WORKSHOP', cost: 2000, pop: 35, d: 'Mechanics among the survivors: every helicopter upgrade costs 10% less.' },
    { n: 'MACHINE SHOP', cost: 5000, pop: 110, d: 'Lathes, welders, a whole crew: upgrades cost 20% less and helicopters 15% less.' },
  ] },
  { id: 'clinic', name: 'CLINIC', icon: '✚', tiers: [
    { n: 'FIRST AID', cost: 0, pop: 0, d: 'Plasters.' },
    { n: 'CLINIC', cost: 1500, pop: 25, d: 'A doctor and nurses: your team gets +25 max health.' },
    { n: 'FIELD HOSPITAL', cost: 4000, pop: 80, d: 'A proper ward: +50 max health, and recruiting is free (they train the volunteers).' },
  ] },
  { id: 'radar', name: 'RADAR ROOM', icon: '◎', tiers: [
    { n: 'BINOCULARS', cost: 0, pop: 0, d: 'Someone on the roof with binoculars.' },
    { n: 'RADAR ROOM', cost: 2200, pop: 40, d: 'Hordes show on your map wherever they are, and more calls for help come in at once.' },
  ] },
];
export const BASE_SLOT = Object.fromEntries(BASE.map((s) => [s.id, s]));
export const BEDS = [40, 150, 500];
export function baseCut(save, heli) { const w = (save.base && save.base.works) || 0; return heli ? [1, 1, 0.85][w] : [1, 0.9, 0.8][w]; }

const KEY = 'semifinals.deadair';
export function loadSave() {
  const s = { scrap: 0, own: {}, eq: {}, paints: ['olive', 'night'], paint: 'olive', camos: ['none'], camo: 'none', noses: ['none'], nose: 'none', tails: ['none'], tailArt: 'none', num: 10 + Math.floor(Math.random() * 90), flight: 'easy', invert: false, sens: 1, best: 0, runs: 0, titans: 0, rescued: 0, crew: [], pool: [], events: 0, name: '' };
  try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* ignore */ }
  // the belly turret, the tail gun and electric skids are gone: give back everything that was spent on them
  if (!s.refund2) {
    const spent = { turret: [0, 800, 2500], tail: [0, 900, 2900] };
    let back = 0;
    for (const k of Object.keys(spent)) back += spent[k][Math.min(2, (s.own && s.own[k]) || 0)];
    if (s.own && (s.own.skids || 0) >= 2) back += 1100;
    s.refund2 = true;
    if (back > 0) { s.scrap = (s.scrap || 0) + back; s.refundMsg = back; }
    s.refundPending = true;
  }
  // the loudspeaker, flashbangs, noise beacons and drones are gone too: everything spent on them comes back
  if (!s.refund3) {
    const spent = { speaker: [0, 450, 2050], flares: [0, 700, 2600], beacon: [0, 600, 2300], drone: [0, 1200, 3800, 8200] };
    let back = 0;
    for (const k of Object.keys(spent)) back += spent[k][Math.min(spent[k].length - 1, (s.own && s.own[k]) || 0)];
    s.refund3 = true;
    if (back > 0) { s.scrap = (s.scrap || 0) + back; s.refundMsg = (s.refundMsg || 0) + back; }
    s.refundPending = true;
  }
  // the flamethrower and crew grenades are gone: their scrap comes back
  if (!s.refund6) {
    const spent = { flamer: [0, 1400, 5000], nades: [0, 800, 2800] };
    let back = 0;
    for (const k of Object.keys(spent)) back += spent[k][Math.min(spent[k].length - 1, (s.own && s.own[k]) || 0)];
    s.refund6 = true;
    if (back > 0) { s.scrap = (s.scrap || 0) + back; s.refundMsg = (s.refundMsg || 0) + back; s.refundPending = true; }
  }
  // the Skycrane was taken out: if you bought it, you get the scrap back
  if (!s.refund4) {
    s.refund4 = true;
    if ((s.helis || []).includes('skycrane')) { s.helis = s.helis.filter((k) => k !== 'skycrane'); s.scrap = (s.scrap || 0) + 6000; s.refundMsg = (s.refundMsg || 0) + 6000; s.refundPending = true; }
  }
  for (const sl of SLOTS) {
    const top = sl.tiers.length - 1;
    s.own[sl.id] = Math.min(top, s.own[sl.id] ?? 0); s.eq[sl.id] = Math.min(s.own[sl.id], s.eq[sl.id] ?? 0);
  }
  for (const k of Object.keys(s.eq)) if (!SLOTS.some((sl) => sl.id === k)) { delete s.eq[k]; delete s.own[k]; }
  s.team = s.team || []; s.stash = s.stash || { medkit: 2, pistol: 0, smg: 0, shotgun: 0, rifle: 0, vest: 0, heavy: 0, pack: 0, grenade: 0 };
  if (s.seed == null) s.seed = 0;
  s.base = Object.assign({ bunks: 0, guns: 0, depot: 0, works: 0, clinic: 0, radar: 0 }, s.base || {});
  s.story = Object.assign({ ch: 0, prog: {}, masts: [], fort: false, seen: -1, done: false }, s.story || {});
  const GONE = { wildcat: 4200, cobra: 4000, blackshark: 9000, kestrel2: 9800, seahawk: 7400, valor: 12000, harrier2: 13000, tucano: 7200, hog2: 12500, raptor: 20000, ghostrider: 17000 };
  for (const k of Object.keys(GONE)) if ((s.helis || []).includes(k)) { s.helis = s.helis.filter((q) => q !== k); s.scrap = (s.scrap || 0) + GONE[k]; s.refundMsg = (s.refundMsg || 0) + GONE[k]; s.refundPending = true; }
  s.helis = s.helis || ['warhorse']; if (!HELIS[s.heli] || !s.helis.includes(s.heli)) s.heli = 'warhorse';
  if (s.refundPending) { delete s.refundPending; saveSave(s); }
  return s;
}
export function saveSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

// what the fitted upgrades add up to
export function statsFor(eq0, kind = 'warhorse') {
  const HK = HELIS[kind] || HELIS.warhorse, eq = capEq(eq0, kind);
  const v = (k, max) => Math.min(eq[k] || 0, max);
  const g = v('gun', 5), ar = v('armor', 4), en = v('engine', 4), ro = v('rotor', 3), rk = v('rockets', 4), bo = v('bombs', 4);
  const S = {
    kind,
    hp: Math.round(500 * [1, 1.6, 2.3, 3.2, 4][ar]),
    mass: [1, 1.06, 1.14, 1.26, 1.1][ar] + rk * 0.02 + bo * 0.02 + v('cabin', 3) * 0.03 + v('fuel', 3) * 0.03 + v('winch', 3) * 0.02,
    lift: [1, 1.14, 1.28, 1.36, 1.5][en] * [1, 1.07, 1.12, 1.15][ro],
    speed: [1, 1.1, 1.2, 1.26, 1.45][en],
    agility: [1, 1.15, 1.35, 1.3][ro],
    boost: en >= 3, boostMul: en === 4 ? 1.35 : 1,
    toughBlades: ro === 3,
    gun: [
      { rate: 9, dmg: 22, spread: 0.010, heat: 0.035, cool: 0.45, barrels: 1 },
      { rate: 24, dmg: 16, spread: 0.016, heat: 0.016, cool: 0.4, barrels: 1, spin: true },
      { rate: 44, dmg: 16, spread: 0.018, heat: 0.011, cool: 0.4, barrels: 2, spin: true },
      { rate: 5, dmg: 90, spread: 0.006, heat: 0.05, cool: 0.5, barrels: 1, cannon: true, splash: 3.5 },
      { rate: 9, dmg: 90, spread: 0.008, heat: 0.03, cool: 0.5, barrels: 2, cannon: true, splash: 3.5 },
      { rate: 30, dmg: 34, spread: 0.012, heat: 0.011, cool: 0.45, barrels: 1, spin: true, pierce: true },
    ][g],
    rockets: Math.round([0, 8, 16, 12, 36][rk] * [1, 1.5, 2][v('racks', 2)]), rocketDmg: [0, 260, 340, 420, 170][rk], rocketR: [0, 6.5, 8, 8.5, 5][rk], homing: rk === 3, swarm: rk === 4,
    bombs: bo ? [0, 4, 4, 4, 2][bo] + [0, 2, 4][v('racks', 2)] / (bo === 4 ? 2 : 1) : 0, cluster: bo === 2, napalm: bo === 3, thermo: bo === 4,
    gunners: Math.min(2, v('door', 4)), doorMini: v('door', 4) === 3, doorGL: v('door', 4) === 4,
    seats: [4, 8, 12, 16][v('cabin', 3)],
    fuel: [100, 160, 240, 330][v('fuel', 3)],
    winch: v('winch', 3), hook: v('winch', 3) >= 2, hoist: v('winch', 3) === 3,
    flir: v('flir', 2), speaker: 0, lrad: false, skidGuard: v('skids', 1) >= 1, zap: false,
    light: v('light', 2), medbay: v('medbay', 2), drops: v('drops', 2), radio: v('radio', 2),
    nvg: v('nvg', 1), racks: v('racks', 2), drones: 0, ammo: v('ammo', 2), repair: v('repair', 2), suppress: v('suppress', 1), flares: 0, megaFlare: false, beacons: 0, beaconBoom: false,
    sight: v('sight', 2), quiet: v('quiet', 2), tpod: v('tpod', 2),
    gsGat: v('gsgat', 2), gsBof: v('gsbof', 2), gsHow: v('gshow', 2), gsMag: v('gsmag', 2), gsSens: v('gssens', 2), gsAuto: v('gsauto', 2),
    flaps: v('flaps', 2), airbrake: v('airbrake', 2), reheat: v('reheat', 2), gear: v('gear', 1), hardpoints: v('hardpoints', 2),
    cooling: v('cooling', 2), hover: v('hover', 2), gpws: v('hover', 2) === 2, crash: v('crash', 2),
    crewMax: [2, 3, 4, 4][v('cabin', 3)],
    pods: v('pods', 2), sniper: v('sniper', 2),
  };
  // the extra upgrades
  const br = v('barrel', 3), wh = v('warhead', 3);
  Object.assign(S, { mines: [0, 6, 10, 14][v('mines', 3)], mineLvl: v('mines', 3), turret: v('turret', 2), salvo: v('salvo', 2), ccip: v('ccip', 1), jdam: v('jdam', 2), bfuze: v('bfuze', 1), flech: v('flechette', 1), loader: v('loader', 2), spall: v('spall', 3), glass: v('glass', 2), gyro: v('gyro', 2), scav: v('scav', 3), nets: v('nets', 2), pad: v('pad', 2), belts: v('belts', 2) });
  const ab = v('airburst', 2); if (ab && S.gun.splash) S.gun = { ...S.gun, splash: S.gun.splash * [1, 1.5, 2][ab], dmg: Math.round(S.gun.dmg * (ab === 2 ? 1.15 : 1)) };
  if (br) S.gun = { ...S.gun, dmg: Math.round(S.gun.dmg * [1, 1.1, 1.2, 1.3][br]), spread: S.gun.spread * [1, 1, 0.8, 0.7][br], heat: S.gun.heat * (br === 3 ? 0.8 : 1) };
  if (wh) { S.rocketDmg = Math.round(S.rocketDmg * [1, 1.25, 1.5, 1.8][wh]); S.rocketR *= [1, 1.15, 1.3, 1.4][wh]; }
  S.rockets = Math.round(S.rockets * [1, 1.25, 1.5][v('rkx', 2)]);
  S.hp = Math.round(S.hp * [1, 1.1, 1.2, 1.35][v('frame', 3)]);
  S.speed *= [1, 1.05, 1.1, 1.16][v('fairing', 3)];
  S.mass *= [1, 0.94, 0.88][v('strip', 2)];
  S.agility *= [1, 1.1, 1.2][v('tailr', 2)];
  S.fuel = Math.round(S.fuel * [1, 1.15, 1.3][v('bladder', 2)]);
  if (S.sight) S.gun = { ...S.gun, spread: S.gun.spread * [1, 0.5, 0.33][S.sight], dmg: Math.round(S.gun.dmg * (S.sight === 2 ? 1.1 : 1)) };
  if (S.cooling) S.gun = { ...S.gun, heat: S.gun.heat * 0.6, cool: S.gun.cool * (S.cooling === 2 ? 2 : 1), rate: S.gun.rate * (S.cooling === 2 ? 1.1 : 1) };
  // the airframe
  S.floats = !!HK.floats; S.heavy = !!HK.heavy; S.perk = HK.base ? Object.keys(HELIS).find((k) => HELIS[k] === HK) : kind;
  if (S.perk === 'hornet') S.skidGuard = true;
  if (S.perk === 'viper' && !S.boost) { S.boost = true; S.boostMul = 1.2; }
  if (S.perk === 'alligator') S.crash = Math.max(S.crash, 2);
  if (S.perk === 'mosquito') S.bombs *= 2;
  if (S.perk === 'fortress') S.bombs *= 3;
  if (S.perk === 'zeppelin') S.crash = Math.max(S.crash, 2);
  // planes: stall speed, top speed, thrust; flaps lower the stall, the afterburner is the boost
  if (HK.plane) {
    Object.assign(S, { plane: true, jet: !!HK.jet, gunship: !!HK.gunship, vtol: !!HK.vtol, stall: HK.stall * [1, 0.8, 0.65][S.flaps], vmax: HK.vmax * [1, 1.08, 1.16, 1.22, 1.32][en] * [1, 1.05, 1.1, 1.16][v('fairing', 3)], thrust: HK.thrust * [1, 1.1, 1.2, 1.25, 1.35][en] });
    S.boost = S.reheat > 0 || S.boost; S.boostMul = S.reheat ? [1, 1.6, 2.1][S.reheat] : S.boostMul;
    const hm = [1, 1.5, 2][S.hardpoints];
    S.rockets = Math.round(S.rockets * hm); S.bombs = Math.round(S.bombs * hm);
  }
  S.hp = Math.round(S.hp * HK.hp); S.mass *= HK.mass; S.lift *= HK.lift; S.speed *= HK.speed; S.agility *= HK.agility;
  S.fuel = Math.round(S.fuel * HK.fuel);
  S.seats = HK.seats[Math.min(HK.seats.length - 1, v('cabin', 3))];
  if (HK.gunMul) S.gun = { ...S.gun, dmg: Math.round(S.gun.dmg * HK.gunMul) };
  if (HK.rocketMul) S.rockets = Math.round(S.rockets * HK.rocketMul);
  if ((HK.cap.door ?? 9) === 0) S.gunners = 0;
  return S;
}
// 0..1 bars for the hangar
export function bars(eq, kind) {
  const s = statsFor(eq, kind), gun = s.gun.rate * s.gun.dmg * (s.gun.splash ? 2.2 : 1);
  return [
    ['ARMOUR', Math.min(1, s.hp / 3600)],
    ['FIREPOWER', Math.min(1, (gun + s.rockets * s.rocketDmg / 12 + s.gunners * 150 * (s.doorMini ? 2 : 1) + s.bombs * 60 + [0, 600, 700][s.pods] + [0, 90, 330][s.sniper]) / 2200)],
    ['FUEL', Math.min(1, s.fuel / 460)],
    ['SEATS', Math.min(1, s.seats / 40)],
  ];
}
