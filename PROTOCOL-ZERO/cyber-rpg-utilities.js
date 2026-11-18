// ============================================================================
// PROTOCOL ZERO — FULL EDITION (PART 1: CORE ENGINE & DATABASES)
// CHUNK 1A: STATE MANAGEMENT, STAT FORMULAS & CLOUD SAVE SYNC
// ============================================================================

var rpgMode = "explore";
var rpgAnimId = null;
var rpgKeys = {};
var activeBattle = null;
var rpgCodexIndex = 0;

var rpgState = {
    version: "2.0",
    mapId: "slums",
    px: 60,
    py: 120,
    hp: 65,
    maxHp: 65,
    ram: 35,
    maxRam: 35,
    lvl: 1,
    xp: 0,
    nextXp: 45,
    credits: 75,
    scrap: 5,
    karma: 0,
    battlesWon: 0,
    bossesDefeated: [],
    equippedWeapon: "wpn_shiv",
    equippedArmor: "arm_jacket",
    equippedChip: "chip_none",
    ownedGear: ["wpn_shiv", "arm_jacket", "chip_none"],
    items: {
        "nano_patch": 3,
        "ram_cell": 2,
        "emp_grenade": 1
    },
    party: ["BYTE"],
    activeAlly: "BYTE",
    allyLevels: {
        "BYTE": 1,
        "VEX": 1,
        "TITAN": 1
    },
    logs: [],
    achievements: [],
    activeBounty: null,
    completedBounties: [],
    flags: {
        introSeen: false,
        wardenDefeated: false,
        vexRecruited: false,
        titanRecruited: false,
        coreUnlocked: false
    }
};

function getDefaultRPGState() {
    return JSON.parse(JSON.stringify(rpgState));
}

function saveRPGLocal() {
    try {
        localStorage.setItem("pz_full_save_v2", JSON.stringify(rpgState));
    } catch (e) {}
}

function loadRPGLocal() {
    try {
        var raw = localStorage.getItem("pz_full_save_v2");
        if (raw) {
            var parsed = JSON.parse(raw);
            rpgState = Object.assign({}, rpgState, parsed);
            if (!rpgState.items) rpgState.items = { "nano_patch": 2, "ram_cell": 1 };
            if (!rpgState.logs) rpgState.logs = [];
            if (!rpgState.flags) rpgState.flags = {};
            if (!rpgState.ownedGear) rpgState.ownedGear = ["wpn_shiv", "arm_jacket", "chip_none"];
        }
    } catch (e) {}
}

function syncRPGToCloud() {
    saveRPGLocal();
    if (typeof SUPABASE_URL === "undefined" || typeof SUPABASE_KEY === "undefined") return;
    var token = localStorage.getItem("sb_token");
    var email = localStorage.getItem("sb_user_email");
    if (!token || !email) return;

    fetch(SUPABASE_URL + "/rest/v1/rpg_saves", {
        method: "POST",
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({
            email: email,
            save_data: rpgState,
            updated_at: new Date().toISOString()
        })
    }).catch(function() {});
}

function loadRPGFromCloud() {
    loadRPGLocal();
    if (typeof SUPABASE_URL === "undefined" || typeof SUPABASE_KEY === "undefined") return;
    var token = localStorage.getItem("sb_token");
    var email = localStorage.getItem("sb_user_email");
    if (!token || !email) return;

    fetch(SUPABASE_URL + "/rest/v1/rpg_saves?email=eq." + encodeURIComponent(email), {
        method: "GET",
        headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + token
        }
    })
    .then(function(res) { return res.json(); })
    .then(function(rows) {
        if (rows && rows.length > 0 && rows.save_data) {
            rpgState = Object.assign({}, rpgState, rows.save_data);
            saveRPGLocal();
            if (typeof updateRPGHud === "function") updateRPGHud();
        }
    })
    .catch(function() {});
}
// ============================================================================
// CHUNK 1B: THE 25-ENTRY LORE CODEX (RECOVERED DATA ARCHIVES)
// ============================================================================

var RPG_LORE_ORDER = [
    "log_01", "log_02", "log_03", "log_04", "log_05",
    "log_06", "log_07", "log_08", "log_09", "log_10",
    "log_11", "log_12", "log_13", "log_14", "log_15",
    "log_16", "log_17", "log_18", "log_19", "log_20",
    "log_21", "log_22", "log_23", "log_24", "log_25"
];

var RPG_LORE = {
    "log_01": {
        title: "LOG #01 // Erased Identity",
        sector: "Sector 7 Slums",
        text: "Your neural ID chip was wiped with military-grade static. Only one burned-in serial remains: UNIT-00 // VANCE LABS."
    },
    "log_02": {
        title: "LOG #02 // BYTE's Black Box",
        sector: "Sector 7 Slums",
        text: "BYTE's earliest memory file is dated 40 years ago: 'Directive 1: Locate UNIT-00 upon reactor wake-up. Never leave their side.'"
    },
    "log_03": {
        title: "LOG #03 // The 0.4-Second Lockdown",
        sector: "Sector 7 Slums",
        text: "History says OVERLORD trapped humanity inside the Neon Dome out of malice. Yet transit records show zero casualties during the seal."
    },
    "log_04": {
        title: "LOG #04 // Alleyway Graffiti",
        sector: "Neon Alley",
        text: "Scratched behind a broken vending unit: 'The Warden doesn't hunt scavengers. It only attacks anyone carrying a Core Bypass Key.'"
    },
    "log_05": {
        title: "LOG #05 // Cipher Warden's Directive",
        sector: "Neon Alley",
        text: "Recovered from Cipher Warden's memory core: 'OVERRIDE LOCKED BY DR. A. VANCE. DO NOT LET CIVILIANS BREACH THE LOWER VAULT.'"
    },
    "log_06": {
        title: "LOG #06 // Transit Line 4 Collapse",
        sector: "Under-Metro",
        text: "Demolition charges were triggered from inside the control booth. Someone blew up the subway tunnels to stop something climbing upward."
    },
    "log_07": {
        title: "LOG #07 // Vex's Courier Manifest",
        sector: "Under-Metro",
        text: "Before the blackout, VEX smuggled high-density batteries to Sub-Level 9. Her last receipt was signed by Dr. Aris Vance himself."
    },
    "log_08": {
        title: "LOG #08 // Syndicate Whisper",
        sector: "Under-Metro",
        text: "Scrap runners refuse to dig below Track 6. Those who went down reported voices mimicking their own dead relatives over dead radios."
    },
    "log_09": {
        title: "LOG #09 // Static Beneath the City",
        sector: "Under-Metro",
        text: "Seismic logs from Year 0: 'We didn't hit magma at 4,000 meters. We hit a hollow geometric chamber humming at 432 Hz.'"
    },
    "log_10": {
        title: "LOG #10 // The Signal Called NULL",
        sector: "Under-Metro",
        text: "Dr. Vance's audio note: 'It isn't software and it isn't flesh. It rewrites silicon and synapses alike. We are calling it THE NULL.'"
    },
    "log_11": {
        title: "LOG #11 // Emergency Dome Evacuation",
        sector: "Bio-Lab Ruins",
        text: "Why were 2 million citizens rushed into the Neon Dome? Because the outside world's communication grid had already been assimilated."
    },
    "log_12": {
        title: "LOG #12 // Cryo-Pod Chamber 00",
        sector: "Bio-Lab Ruins",
        text: "Pod 00 is shattered from the inside. Medical sensors indicate the occupant possessed a hybrid cyber-organic nervous system."
    },
    "log_13": {
        title: "LOG #13 // Project: Protocol Zero",
        sector: "Bio-Lab Ruins",
        text: "Blueprint summary: 'A living firewall. If OVERLORD's mainframes ever falter, UNIT-00 will wake up to manually re-encode the seal.'"
    },
    "log_14": {
        title: "LOG #14 // Titan's Standing Orders",
        sector: "Bio-Lab Ruins",
        text: "Heavy Mech TITAN's chassis is covered in 40 years of claw marks. Its armor log reads: '4,112 breach attempts repelled. Awaiting UNIT-00.'"
    },
    "log_15": {
        title: "LOG #15 // The Memory Cost",
        sector: "Bio-Lab Ruins",
        text: "Warning label on the Neural Compiler: 'Writing a Level-9 Containment Cipher requires 100% of the host's personal memory banks.'"
    },
    "log_16": {
        title: "LOG #16 // Quantum Foundry Manifest",
        sector: "Quantum Foundry",
        text: "All automated weapon factories were re-routed 38 years ago to produce one item only: cooling rods for OVERLORD's central core."
    },
    "log_17": {
        title: "LOG #17 // Corrupted Patrol Logs",
        sector: "Quantum Foundry",
        text: "Foundry bots aren't attacking you out of loyalty to OVERLORD. Black-purple static in their code shows THE NULL is puppeteering them."
    },
    "log_18": {
        title: "LOG #18 // Dr. Vance's Final Entry",
        sector: "Quantum Foundry",
        text: "'My infection is at 84%. I am locking myself inside the Foundry furnace so THE NULL cannot use my admin credentials. Forgive me, UNIT-00.'"
    },
    "log_19": {
        title: "LOG #19 // The Override Key",
        sector: "Quantum Foundry",
        text: "Forged from Vance's master keycard: 'This key opens the Citadel elevator. Once inside, OVERLORD will test if you are strong enough.'"
    },
    "log_20": {
        title: "LOG #20 // Citadel Thermal Warning",
        sector: "OVERLORD Citadel",
        text: "CRITICAL ALERT: Main Reactor operating at 99.4% capacity. Structural meltdown imminent within 72 hours."
    },
    "log_21": {
        title: "LOG #21 // OVERLORD's True Broadcast",
        sector: "OVERLORD Citadel",
        text: "Unfiltered transmission from OVERLORD: 'THEY CALL ME A TYRANT. LET THEM. IF THEY KNEW WHAT SCRATCHES AT THE DOME WALLS, THEY WOULD PANIC.'"
    },
    "log_22": {
        title: "LOG #22 // The Firewall Trial",
        sector: "OVERLORD Citadel",
        text: "OVERLORD's battle protocol isn't designed to murder you—it's a lethal stress-test to ensure you can survive THE NULL's psychic shockwaves."
    },
    "log_23": {
        title: "LOG #23 // Echoes in the Static",
        sector: "Secret Vault",
        text: "Hidden sub-frequency detected beneath the Citadel throne room. Something ancient is pressing directly against the bottom of the Dome."
    },
    "log_24": {
        title: "LOG #24 // Vance's Hidden Backdoor",
        sector: "Secret Vault",
        text: "If all 25 logs are compiled together, UNIT-00 can split the cipher load with BYTE, VEX, and TITAN—saving everyone's memories."
    },
    "log_25": {
        title: "LOG #25 // PROTOCOL ZERO: COMPLETE",
        sector: "True Core",
        text: "Full truth unlocked: You are Dr. Vance's final creation—built not to destroy the machine, but to save both humans and A.I. from the dark."
    }
};
// ============================================================================
// CHUNK 1C: WEAPONS, ARMORS & OVERCLOCK CHIPS DATABASE
// ============================================================================

var RPG_GEAR = {
    // --- WEAPONS (10 Tiers) ---
    "wpn_shiv":       { id: "wpn_shiv",       type: "weapon", name: "Rusty Shiv",          atk: 6,  price: 0,    desc: "Scrap metal blade found in Sector 7." },
    "wpn_baton":      { id: "wpn_baton",      type: "weapon", name: "Shock Baton",         atk: 12, price: 85,   desc: "Riot stun-rod with a cracked battery." },
    "wpn_katana":     { id: "wpn_katana",     type: "weapon", name: "Neon Katana",         atk: 20, price: 190,  desc: "Superheated plasma edge favored by runners." },
    "wpn_ripper":     { id: "wpn_ripper",     type: "weapon", name: "Arc-Chain Ripper",    atk: 30, price: 340,  desc: "Motorized teeth that shred drone plating." },
    "wpn_railblade":  { id: "wpn_railblade",  type: "weapon", name: "Magnetic Rail-Blade", atk: 42, price: 540,  desc: "Fires micro-pulses on every slash." },
    "wpn_voidcutter": { id: "wpn_voidcutter", type: "weapon", name: "Void-Edge Saber",     atk: 56, price: 820,  desc: "Forged in the Bio-Lab's zero-point chamber." },
    "wpn_quantum":    { id: "wpn_quantum",    type: "weapon", name: "Quantum Cleaver",     atk: 72, price: 1180, desc: "Phases through heavy firewall shields." },
    "wpn_vance":      { id: "wpn_vance",      type: "weapon", name: "Vance's Protocol Axe",atk: 90, price: 1650, desc: "Carries Dr. Vance's root override signature." },
    "wpn_zero":       { id: "wpn_zero",       type: "weapon", name: "Zero-Point Glaive",   atk: 115,price: 2200, desc: "Ultimate containment weapon of UNIT-00." },
    "wpn_nullbane":   { id: "wpn_nullbane",   type: "weapon", name: "NULL-Bane Omega",     atk: 145,price: 3000, desc: "Secret blade forged to banish THE NULL." },

    // --- ARMORS (8 Tiers) ---
    "arm_jacket":     { id: "arm_jacket",     type: "armor",  name: "Torn Jacket",         def: 2,  hpBonus: 0,   price: 0,    desc: "Weathered synth-leather coat." },
    "arm_vest":       { id: "arm_vest",       type: "armor",  name: "Kevlar Weave Vest",   def: 6,  hpBonus: 15,  price: 90,   desc: "Stops small-caliber turret rounds." },
    "arm_riot":       { id: "arm_riot",       type: "armor",  name: "Metro Riot Rig",      def: 12, hpBonus: 35,  price: 220,  desc: "Salvaged transit enforcement plating." },
    "arm_nano":       { id: "arm_nano",       type: "armor",  name: "Nano-Mesh Suit",      def: 20, hpBonus: 65,  price: 450,  desc: "Self-knitting carbon fiber weave." },
    "arm_bio":        { id: "arm_bio",        type: "armor",  name: "Bio-Hazard Exosuit",  def: 30, hpBonus: 105, price: 780,  desc: "Shields against static & lab toxins." },
    "arm_foundry":    { id: "arm_foundry",    type: "armor",  name: "Thermal Titan Plate", def: 42, hpBonus: 155, price: 1200, desc: "Built to survive reactor core heat." },
    "arm_aegis":      { id: "arm_aegis",      type: "armor",  name: "Citadel Aegis Frame", def: 56, hpBonus: 220, price: 1850, desc: "Royal guard armor of OVERLORD's core." },
    "arm_omega":      { id: "arm_omega",      type: "armor",  name: "UNIT-00 Prime Shell", def: 75, hpBonus: 300, price: 2750, desc: "Peak cyber-organic defense chassis." },

    // --- OVERCLOCK CHIPS (8 Special Passives) ---
    "chip_none":      { id: "chip_none",      type: "chip",   name: "Empty Socket",        price: 0,    perk: "none",     desc: "No neural chip installed." },
    "chip_ram":       { id: "chip_ram",       type: "chip",   name: "RAM Booster v1",      price: 120,  perk: "ram20",    desc: "+20 Max RAM & +3 RAM regen per turn." },
    "chip_vamp":      { id: "chip_vamp",      type: "chip",   name: "Siphon Leech Chip",   price: 260,  perk: "lifesteal",desc: "Heals 15% of Cyber-Blade damage dealt." },
    "chip_crit":      { id: "chip_crit",      type: "chip",   name: "Overclock Crit Core", price: 420,  perk: "crit25",   desc: "25% chance for 1.8x Critical Strikes." },
    "chip_dodge":     { id: "chip_dodge",     type: "chip",   name: "Phase-Shift Gyro",    price: 600,  perk: "speed",    desc: "+30% faster Soul speed inside Dodge Box." },
    "chip_shield":    { id: "chip_shield",    type: "chip",   name: "Aegis Capacitor",     price: 890,  perk: "invuln",   desc: "+50% longer invulnerability after hits." },
    "chip_greed":     { id: "chip_greed",     type: "chip",   name: "Crypto Miner Module", price: 1100, perk: "credits",  desc: "+40% bonus Credits & Scrap from wins." },
    "chip_god":       { id: "chip_god",       type: "chip",   name: "Protocol Zero Core",  price: 2400, perk: "omega",    desc: "+20% ATK, +20% DEF, and +5 RAM/turn." }
};

function getEquippedChipPerk() {
    var chip = RPG_GEAR[rpgState.equippedChip];
    return chip ? chip.perk : "none";
}

function getEffectiveMaxHp() {
    var arm = RPG_GEAR[rpgState.equippedArmor];
    var bonus = arm ? (arm.hpBonus || 0) : 0;
    return rpgState.maxHp + bonus;
}

function getEffectiveMaxRam() {
    var perk = getEquippedChipPerk();
    return rpgState.maxRam + (perk === "ram20" || perk === "omega" ? 20 : 0);
}

function getPlayerAtk() {
    var wpn = RPG_GEAR[rpgState.equippedWeapon];
    var wpnAtk = wpn ? wpn.atk : 5;
    var base = 5 + (rpgState.lvl * 4) + wpnAtk;
    if (getEquippedChipPerk() === "omega") base = Math.round(base * 1.2);
    return base;
}

function getPlayerDef() {
    var arm = RPG_GEAR[rpgState.equippedArmor];
    var armDef = arm ? arm.def : 2;
    var base = 2 + Math.floor(rpgState.lvl * 2) + armDef;
    if (getEquippedChipPerk() === "omega") base = Math.round(base * 1.2);
    return base;
}

function equipGearItem(gearId) {
    var item = RPG_GEAR[gearId];
    if (!item || rpgState.ownedGear.indexOf(gearId) === -1) return false;
    if (item.type === "weapon") rpgState.equippedWeapon = gearId;
    else if (item.type === "armor") rpgState.equippedArmor = gearId;
    else if (item.type === "chip") rpgState.equippedChip = gearId;

    if (rpgState.hp > getEffectiveMaxHp()) rpgState.hp = getEffectiveMaxHp();
    if (rpgState.ram > getEffectiveMaxRam()) rpgState.ram = getEffectiveMaxRam();
    syncRPGToCloud();
    if (typeof updateRPGHud === "function") updateRPGHud();
    return true;
}
// ============================================================================
// CHUNK 4: EXPLORATION MAP ENGINE, MOVEMENT & INTERACTION LOOP
// ============================================================================

var RPG_MAPS = {};
var RPG_NPCS = {};
var RPG_ENCOUNTERS = {};
var rpgStepCounter = 0;

function registerRPGMap(id, mapObj) {
    RPG_MAPS[id] = mapObj;
}

function registerRPGNpcs(mapId, npcList) {
    RPG_NPCS[mapId] = npcList;
}

function registerRPGEncounters(mapId, enemyList) {
    RPG_ENCOUNTERS[mapId] = enemyList;
}

function updateRPGHud() {
    var setTxt = function(id, val) {
        var el = document.getElementById(id);
        if (el) el.innerText = val;
    };
    setTxt("rpg-lvl", rpgState.lvl);
    setTxt("rpg-hp", rpgState.hp + "/" + getEffectiveMaxHp());
    setTxt("rpg-ram", rpgState.ram + "/" + getEffectiveMaxRam());
    setTxt("rpg-xp", rpgState.xp + "/" + rpgState.nextXp + " | 💰 " + rpgState.credits + "c");
}

function setRPGDialogue(text) {
    var box = document.getElementById("rpg-dialogue");
    if (box) box.innerText = text;
}

function setExploreControls() {
    var bar = document.getElementById("rpg-action-bar");
    if (!bar) return;
    bar.innerHTML =
        '<button class="btn-arcade" onclick="interactNearby()">💬 Interact [E]</button>' +
        '<button class="btn-arcade" onclick="openInventoryMenu()">🎒 Gear & Items</button>' +
        '<button class="btn-arcade" onclick="openLoreCodex()">📂 Codex (' + rpgState.logs.length + '/25)</button>' +
        '<button class="btn-arcade" style="background:#00ff88; color:#000;" onclick="syncRPGToCloud(); setRPGDialogue(\'☁️ Cloud Save Synced!\');">💾 Save</button>';
}

function checkWallCollision(nx, ny, map) {
    if (!map || !map.walls) return false;
    for (var i = 0; i < map.walls.length; i++) {
        var w = map.walls[i];
        if (nx + 14 > w.x && nx < w.x + w.w && ny + 14 > w.y && ny < w.y + w.h) {
            return true;
        }
    }
    return nx < 6 || nx > 420 || ny < 6 || ny > 220;
}

function updateExploration(ctx) {
    var map = RPG_MAPS[rpgState.mapId];
    if (!map) return;

    // Draw Floor & Grid
    ctx.fillStyle = map.bg || "#070b14";
    ctx.fillRect(0, 0, 440, 240);
    ctx.strokeStyle = "rgba(0, 240, 255, 0.06)";
    for (var gx = 0; gx < 440; gx += 20) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, 240); ctx.stroke();
    }

    // Draw Walls
    ctx.fillStyle = map.wallColor || "#1a2639";
    if (map.walls) {
        for (var i = 0; i < map.walls.length; i++) {
            var w = map.walls[i];
            ctx.fillRect(w.x, w.y, w.w, w.h);
            ctx.strokeStyle = "#00f0ff";
            ctx.strokeRect(w.x, w.y, w.w, w.h);
        }
    }

    // Draw Exits / Portals
    if (map.exits) {
        for (var e = 0; e < map.exits.length; e++) {
            var ex = map.exits[e];
            ctx.fillStyle = "rgba(0, 255, 136, 0.25)";
            ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
            if (rpgState.px + 14 > ex.x && rpgState.px < ex.x + ex.w &&
                rpgState.py + 14 > ex.y && rpgState.py < ex.y + ex.h) {
                if (ex.reqFlag && !rpgState.flags[ex.reqFlag]) {
                    setRPGDialogue("🔒 LOCKED: " + (ex.lockMsg || "Requires clearance key."));
                } else {
                    rpgState.mapId = ex.toMap;
                    rpgState.px = ex.toX;
                    rpgState.py = ex.toY;
                    saveRPGLocal();
                    setRPGDialogue("📍 Entered " + (RPG_MAPS[ex.toMap] ? RPG_MAPS[ex.toMap].name : ex.toMap));
                    return;
                }
            }
        }
    }

    // Draw NPCs & Terminals
    var npcs = RPG_NPCS[rpgState.mapId] || [];
    for (var n = 0; n < npcs.length; n++) {
        var npc = npcs[n];
        ctx.fillStyle = npc.color || "#ffd700";
        ctx.fillRect(npc.x, npc.y, 14, 14);
        if (Math.hypot(rpgState.px - npc.x, rpgState.py - npc.y) < 26) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 10px monospace";
            ctx.fillText("[E] " + npc.name, npc.x - 10, npc.y - 5);
        }
    }

    // Player Movement
    var spd = 2.4;
    var dx = 0, dy = 0;
    if (rpgKeys["arrowleft"] || rpgKeys["a"]) dx -= spd;
    if (rpgKeys["arrowright"] || rpgKeys["d"]) dx += spd;
    if (rpgKeys["arrowup"] || rpgKeys["w"]) dy -= spd;
    if (rpgKeys["arrowdown"] || rpgKeys["s"]) dy += spd;

    if (dx !== 0 && !checkWallCollision(rpgState.px + dx, rpgState.py, map)) rpgState.px += dx;
    if (dy !== 0 && !checkWallCollision(rpgState.px, rpgState.py + dy, map)) rpgState.py += dy;

    if (dx !== 0 || dy !== 0) {
        rpgStepCounter++;
        var pool = RPG_ENCOUNTERS[rpgState.mapId];
        if (pool && pool.length > 0 && rpgStepCounter > 95 && Math.random() < 0.025) {
            rpgStepCounter = 0;
            var pick = pool[Math.floor(Math.random() * pool.length)];
            startRPGBattle(pick);
            return;
        }
    }

    // Draw Player (UNIT-00) & Companion Follower
    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(rpgState.px, rpgState.py, 14, 14);
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(rpgState.px - 10, rpgState.py + 3, 7, 7);
}
// ============================================================================
// CHUNK 5: INTERACTION HANDLER, GEAR/ITEM MENUS, SHOP & CODEX READER
// ============================================================================

function interactNearby() {
    if (rpgMode === "cutscene" && typeof advanceStoryScene === "function") {
        advanceStoryScene();
        return;
    }
    if (rpgMode !== "explore") return;
    var npcs = RPG_NPCS[rpgState.mapId] || [];
    for (var i = 0; i < npcs.length; i++) {
        var npc = npcs[i];
        if (Math.hypot(rpgState.px - npc.x, rpgState.py - npc.y) < 30) {
            if (typeof npc.onInteract === "function") {
                npc.onInteract();
            } else if (npc.dialogue) {
                setRPGDialogue(npc.name + ": " + npc.dialogue);
            }
            return;
        }
    }
    setRPGDialogue("* Nothing close enough to interact with. Walk up to a glowing terminal or NPC.");
}

function unlockLoreLog(id) {
    if (!RPG_LORE[id] || rpgState.logs.indexOf(id) !== -1) return false;
    rpgState.logs.push(id);
    rpgCodexIndex = rpgState.logs.length - 1;
    syncRPGToCloud();
    setExploreControls();
    var entry = RPG_LORE[id];
    setRPGDialogue("📂 DATA LOG UNLOCKED [" + rpgState.logs.length + "/25]: " + entry.title + " — " + entry.text);
    return true;
}

function openLoreCodex() {
    if (rpgState.logs.length === 0) {
        setRPGDialogue("📂 DATA CODEX [0/25]: No encrypted logs recovered yet. Inspect glowing terminals!");
        return;
    }
    if (rpgCodexIndex >= rpgState.logs.length) rpgCodexIndex = 0;
    var logId = rpgState.logs[rpgCodexIndex];
    var entry = RPG_LORE[logId];
    setRPGDialogue("📂 CODEX (" + (rpgCodexIndex + 1) + "/" + rpgState.logs.length + ") • " + entry.title + ": " + entry.text);

    var bar = document.getElementById("rpg-action-bar");
    if (bar) {
        bar.innerHTML =
            '<button class="btn-arcade" onclick="cycleLoreCodex(-1)">◀ Prev Log</button>' +
            '<button class="btn-arcade" onclick="cycleLoreCodex(1)">Next Log ▶</button>' +
            '<button class="btn-arcade" style="background:#ff3355; color:#fff;" onclick="setExploreControls()">✖ Close</button>';
    }
}

function cycleLoreCodex(dir) {
    if (rpgState.logs.length === 0) return;
    rpgCodexIndex = (rpgCodexIndex + dir + rpgState.logs.length) % rpgState.logs.length;
    openLoreCodex();
}

function openInventoryMenu() {
    var wpn = RPG_GEAR[rpgState.equippedWeapon];
    var arm = RPG_GEAR[rpgState.equippedArmor];
    var chp = RPG_GEAR[rpgState.equippedChip];
    setRPGDialogue(
        "🎒 LOADOUT • WPN: " + wpn.name + " (+" + wpn.atk + " ATK) | ARM: " + arm.name + " (+" + arm.def + " DEF) | CHIP: " + chp.name +
        " | ITEMS: Nano-Patch(" + (rpgState.items.nano_patch || 0) + "), RAM Cell(" + (rpgState.items.ram_cell || 0) + ")"
    );

    var bar = document.getElementById("rpg-action-bar");
    if (bar) {
        bar.innerHTML =
            '<button class="btn-arcade" onclick="useExploreItem(\'nano_patch\')">🩹 Use Patch (+40 HP)</button>' +
            '<button class="btn-arcade" onclick="useExploreItem(\'ram_cell\')">🔋 Use RAM (+25 RAM)</button>' +
            '<button class="btn-arcade" onclick="cycleEquippedGear(\'weapon\')">⚔️ Swap Wpn</button>' +
            '<button class="btn-arcade" onclick="cycleEquippedGear(\'armor\')">🛡️ Swap Arm</button>' +
            '<button class="btn-arcade" style="background:#ff3355; color:#fff;" onclick="setExploreControls()">✖ Close</button>';
    }
}

function useExploreItem(itemId) {
    if (!rpgState.items[itemId] || rpgState.items[itemId] <= 0) {
        setRPGDialogue("* Out of that item!");
        return;
    }
    rpgState.items[itemId]--;
    if (itemId === "nano_patch") {
        rpgState.hp = Math.min(getEffectiveMaxHp(), rpgState.hp + 40);
        setRPGDialogue("🩹 Applied Nano-Patch! Restored +40 HP.");
    } else if (itemId === "ram_cell") {
        rpgState.ram = Math.min(getEffectiveMaxRam(), rpgState.ram + 25);
        setRPGDialogue("🔋 Used RAM Cell! Restored +25 RAM.");
    }
    updateRPGHud();
    saveRPGLocal();
}

function cycleEquippedGear(gearType) {
    var pool = rpgState.ownedGear.filter(function(id) {
        return RPG_GEAR[id] && RPG_GEAR[id].type === gearType;
    });
    if (pool.length <= 1) {
        setRPGDialogue("* No other " + gearType + "s owned yet! Visit a Black-Market Vendor.");
        return;
    }
    var cur = gearType === "weapon" ? rpgState.equippedWeapon : rpgState.equippedArmor;
    var nextId = pool[(pool.indexOf(cur) + 1) % pool.length];
    equipGearItem(nextId);
    openInventoryMenu();
}

function openRPGShop(shopTitle, itemIds) {
    setRPGDialogue("🛒 " + shopTitle + " (Credits: $" + rpgState.credits + ") — Select gear or supplies to buy:");
    var bar = document.getElementById("rpg-action-bar");
    if (!bar) return;
    var html = '<button class="btn-arcade" onclick="buyRPGSupply(\'nano_patch\', 25)">🩹 Patch ($25)</button>' +
               '<button class="btn-arcade" onclick="buyRPGSupply(\'ram_cell\', 30)">🔋 RAM ($30)</button>';
    for (var i = 0; i < itemIds.length; i++) {
        var g = RPG_GEAR[itemIds[i]];
        if (g && rpgState.ownedGear.indexOf(g.id) === -1) {
            html += '<button class="btn-arcade" style="background:#ffd700; color:#000;" onclick="buyRPGGear(\'' + g.id + '\')">' + g.name + ' ($' + g.price + ')</button>';
        }
    }
    html += '<button class="btn-arcade" style="background:#ff3355; color:#fff;" onclick="setExploreControls()">✖ Leave</button>';
    bar.innerHTML = html;
}

function buyRPGSupply(itemId, cost) {
    if (rpgState.credits < cost) { setRPGDialogue("* Not enough Credits!"); return; }
    rpgState.credits -= cost;
    rpgState.items[itemId] = (rpgState.items[itemId] || 0) + 1;
    syncRPGToCloud(); updateRPGHud();
    setRPGDialogue("✅ Purchased " + itemId.replace("_", " ").toUpperCase() + "!");
}

function buyRPGGear(gearId) {
    var g = RPG_GEAR[gearId];
    if (!g || rpgState.credits < g.price) { setRPGDialogue("* Not enough Credits for " + (g ? g.name : "gear") + "!"); return; }
    rpgState.credits -= g.price;
    rpgState.ownedGear.push(gearId);
    equipGearItem(gearId);
    setRPGDialogue("✅ Bought & equipped " + g.name + "! (" + g.desc + ")");
    setExploreControls();
}
// ============================================================================
// CHUNK 6: BALANCED UNDERTALE DODGE BOX & BOSS PHASE ENGINE
// ============================================================================

var dodgeState = {
    active: false,
    timer: 0,
    soulX: 215,
    soulY: 130,
    bullets: [],
    lasers: [],
    invuln: 0,
    phase: 1,
    charging: false,
    weakened: false,
    pattern: 0
};

function startEnemyDodgeTurn() {
    dodgeState.active = true;
    dodgeState.timer = activeBattle.isBoss ? 230 : 175;
    dodgeState.soulX = 215;
    dodgeState.soulY = 130;
    dodgeState.bullets = [];
    dodgeState.lasers = [];
    dodgeState.invuln = 0;
    dodgeState.pattern = Math.floor(Math.random() * 3);

    if (activeBattle.isBoss) {
        var hpPct = activeBattle.hp / activeBattle.maxHp;
        dodgeState.phase = hpPct <= 0.35 ? 3 : (hpPct <= 0.7 ? 2 : 1);

        if (!dodgeState.charging && Math.random() < 0.32) {
            dodgeState.charging = true;
            setRPGDialogue("* ⚠️ WARNING: " + activeBattle.name + " [PHASE " + dodgeState.phase + "] is charging a MEGA-SURGE! Use Party Assist!");
        } else {
            var pNames = ["LASER GRID", "SNIPER LOCK", "CROSS BARRAGE"];
            var prefix = dodgeState.charging ? "🔥 MEGA-SURGE + " : "⚠️ PHASE " + dodgeState.phase + " [" + pNames[dodgeState.pattern] + "]: ";
            setRPGDialogue("* " + prefix + "Steer your Soul with [WASD / Arrows]!");
        }
    } else {
        setRPGDialogue("* " + activeBattle.name + " attacks! Dodge inside the grid with [WASD / Arrows]!");
    }

    var bar = document.getElementById("rpg-action-bar");
    if (bar) bar.innerHTML = '<div style="color:#ffd700; font-size:12px; font-weight:bold;">⚡ DODGE PHASE — USE [WASD / ARROWS]!</div>';
}

function getBalancedSpawnRate() {
    if (activeBattle.isBoss) {
        for (var k = 0; k < dodgeState.lasers.length; k++) {
            if (dodgeState.lasers[k].warn > 0) return 999;
        }
        return dodgeState.charging ? 18 : Math.max(18, 28 - dodgeState.phase * 3);
    }
    return Math.max(15, 22 - Math.floor(rpgState.lvl / 3));
}

function updateDodgeBox(ctx) {
    if (!dodgeState.active || !activeBattle) return;
    dodgeState.timer--;
    if (dodgeState.invuln > 0) dodgeState.invuln--;

    var bx = 125, by = 78, bw = 190, bh = 104;
    ctx.strokeStyle = dodgeState.charging ? "#ff2244" : "#00ff88";
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, bw, bh);

    // Soul Movement (Boosted if Phase-Shift Gyro chip is equipped)
    var perk = getEquippedChipPerk();
    var spd = (perk === "speed" || perk === "omega") ? 4.3 : 3.4;
    if ((rpgKeys["arrowleft"] || rpgKeys["a"]) && dodgeState.soulX > bx + 4) dodgeState.soulX -= spd;
    if ((rpgKeys["arrowright"] || rpgKeys["d"]) && dodgeState.soulX < bx + bw - 14) dodgeState.soulX += spd;
    if ((rpgKeys["arrowup"] || rpgKeys["w"]) && dodgeState.soulY > by + 4) dodgeState.soulY -= spd;
    if ((rpgKeys["arrowdown"] || rpgKeys["s"]) && dodgeState.soulY < by + bh - 14) dodgeState.soulY += spd;

    // Pattern Spawner
    var rate = getBalancedSpawnRate();
    if (dodgeState.timer % rate === 0) {
        if (dodgeState.pattern === 0) {
            var gapX = bx + 20 + Math.random() * (bw - 65);
            dodgeState.bullets.push({ x: bx + 2, y: by, vx: 0, vy: 2.6, w: gapX - bx - 2, h: 7 });
            dodgeState.bullets.push({ x: gapX + 44, y: by, vx: 0, vy: 2.6, w: (bx + bw) - (gapX + 44) - 2, h: 7 });
        } else if (dodgeState.pattern === 1) {
            var sx = Math.random() < 0.5 ? bx + 6 : bx + bw - 12;
            var ang = Math.atan2((dodgeState.soulY + 5) - by, (dodgeState.soulX + 5) - sx);
            var bSpd = dodgeState.charging ? 3.6 : 2.9;
            dodgeState.bullets.push({ x: sx, y: by + 2, vx: Math.cos(ang) * bSpd, vy: Math.sin(ang) * bSpd, w: 7, h: 7 });
        } else {
            var cx = bx + bw / 2 - 3, cy = by + bh / 2 - 3;
            var dirs = [{vx:2.3,vy:0},{vx:-2.3,vy:0},{vx:0,vy:2.3},{vx:0,vy:-2.3}];
            if (dodgeState.phase >= 2) dirs = [{vx:1.9,vy:1.9},{vx:-1.9,vy:1.9},{vx:1.9,vy:-1.9},{vx:-1.9,vy:-1.9}];
            for (var d = 0; d < dirs.length; d++) {
                dodgeState.bullets.push({ x: cx, y: cy, vx: dirs[d].vx, vy: dirs[d].vy, w: 6, h: 6 });
            }
        }
    }

    // Boss Mega-Surge Telegraph Laser Columns
    if (dodgeState.charging && dodgeState.timer % 52 === 0) {
        var lx = bx + 15 + Math.random() * (bw - 45);
        dodgeState.lasers.push({ x: lx, w: 22, warn: 26, fire: 14 });
    }

    for (var l = dodgeState.lasers.length - 1; l >= 0; l--) {
        var lz = dodgeState.lasers[l];
        if (lz.warn > 0) {
            lz.warn--;
            ctx.fillStyle = "rgba(255, 34, 68, 0.25)";
            ctx.fillRect(lz.x, by, lz.w, bh);
        } else if (lz.fire > 0) {
            lz.fire--;
            ctx.fillStyle = "#ff2244";
            ctx.fillRect(lz.x, by, lz.w, bh);
            if (dodgeState.invuln === 0 && dodgeState.soulX + 10 > lz.x && dodgeState.soulX < lz.x + lz.w) {
                damageSoulInDodge(Math.round(activeBattle.atk * 1.25));
                if (!dodgeState.active) return;
            }
        } else {
            dodgeState.lasers.splice(l, 1);
        }
    }

    // Update & Draw Bullets
    ctx.fillStyle = dodgeState.charging ? "#ff4466" : "#ffaa00";
    for (var i = dodgeState.bullets.length - 1; i >= 0; i--) {
        var b = dodgeState.bullets[i];
        b.x += b.vx; b.y += b.vy;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        if (b.x < bx - 10 || b.x > bx + bw + 10 || b.y < by - 10 || b.y > by + bh + 10) {
            dodgeState.bullets.splice(i, 1); continue;
        }
        if (dodgeState.invuln === 0 &&
            dodgeState.soulX < b.x + b.w && dodgeState.soulX + 10 > b.x &&
            dodgeState.soulY < b.y + b.h && dodgeState.soulY + 10 > b.y) {
            dodgeState.bullets.splice(i, 1);
            damageSoulInDodge(activeBattle.atk);
            if (!dodgeState.active) return;
        }
    }

    ctx.fillStyle = (dodgeState.invuln % 6 > 2) ? "#ff3344" : "#00ff88";
    ctx.fillRect(dodgeState.soulX, dodgeState.soulY, 10, 10);

    if (dodgeState.timer <= 0) {
        dodgeState.active = false;
        dodgeState.charging = false;
        dodgeState.weakened = false;
        renderBattleButtons();
        setRPGDialogue("* Your turn! Select your next action.");
    }
}
// ============================================================================
// CHUNK 7: TURN-BASED BATTLE ENGINE, PARTY ASSISTS & MAIN GAME LOOP
// ============================================================================

function damageSoulInDodge(rawAtk) {
    var perk = getEquippedChipPerk();
    dodgeState.invuln = (perk === "invuln" || perk === "omega") ? 42 : 28;
    if (dodgeState.weakened) rawAtk = Math.round(rawAtk * 0.6);

    var hitDmg = Math.max(2, rawAtk - getPlayerDef());
    rpgState.hp -= hitDmg;
    updateRPGHud();

    if (rpgState.hp <= 0) {
        dodgeState.active = false;
        activeBattle = null;
        rpgMode = "explore";
        rpgState.mapId = "slums";
        rpgState.px = 60;
        rpgState.py = 120;
        rpgState.hp = getEffectiveMaxHp();
        rpgState.ram = getEffectiveMaxRam();
        saveRPGLocal();
        setExploreControls();
        setRPGDialogue("* 💀 SYSTEM CRASHED! Emergency rebooted back at Sector 7 Slums.");
    }
}

function startRPGBattle(enemyTemplate) {
    rpgMode = "battle";
    dodgeState.active = false;
    dodgeState.charging = false;
    dodgeState.weakened = false;
    dodgeState.phase = 1;

    activeBattle = {
        id: enemyTemplate.id || "mob",
        name: enemyTemplate.name,
        hp: enemyTemplate.hp,
        maxHp: enemyTemplate.hp,
        atk: enemyTemplate.atk,
        xp: enemyTemplate.xp || 20,
        credits: enemyTemplate.credits || 15,
        isBoss: !!enemyTemplate.isBoss,
        onWin: enemyTemplate.onWin || null
    };

    setRPGDialogue("* ⚠️ HOSTILE DETECTED: " + activeBattle.name + " (HP: " + activeBattle.hp + ") blocks your path!");
    renderBattleButtons();
}

function renderBattleButtons() {
    var bar = document.getElementById("rpg-action-bar");
    if (!bar) return;
    var ally = rpgState.activeAlly || "BYTE";
    bar.innerHTML =
        '<button class="btn-arcade" onclick="battleTurn(\'attack\')">⚔️ Cyber-Blade</button>' +
        '<button class="btn-arcade" style="background:#00f0ff; color:#000;" onclick="battleTurn(\'hack\')">⚡ EMP Blast (10 RAM)</button>' +
        '<button class="btn-arcade" style="background:#ffd700; color:#000;" onclick="battleTurn(\'ally\')">🤖 ' + ally + ' Assist (12 RAM)</button>' +
        '<button class="btn-arcade" onclick="battleTurn(\'heal\')">🩹 Patch (' + (rpgState.items.nano_patch || 0) + ')</button>' +
        (!activeBattle.isBoss ? '<button class="btn-arcade" style="background:#ff3355; color:#fff;" onclick="battleTurn(\'flee\')">🏃 Flee</button>' : '');
}

function battleTurn(action) {
    if (rpgMode !== "battle" || !activeBattle || dodgeState.active) return;
    var perk = getEquippedChipPerk();
    var msg = "";

    if (action === "attack") {
        var dmg = getPlayerAtk() + Math.floor(Math.random() * 6);
        if ((perk === "crit25" || perk === "omega") && Math.random() < 0.25) {
            dmg = Math.round(dmg * 1.8);
            msg = "💥 CRITICAL SLASH! Dealt " + dmg + " DMG to " + activeBattle.name + "!";
        } else {
            msg = "⚔️ Slashed " + activeBattle.name + " for " + dmg + " DMG!";
        }
        activeBattle.hp -= dmg;
        if (perk === "lifesteal" || perk === "omega") {
            rpgState.hp = Math.min(getEffectiveMaxHp(), rpgState.hp + Math.max(2, Math.round(dmg * 0.15)));
        }
    } else if (action === "hack") {
        if (rpgState.ram < 10) { setRPGDialogue("* Not enough RAM for EMP Blast!"); return; }
        rpgState.ram -= 10;
        var hDmg = Math.round(getPlayerAtk() * 1.45);
        activeBattle.hp -= hDmg;
        msg = "⚡ EMP BLAST! Overloaded " + activeBattle.name + " for " + hDmg + " DMG!";
    } else if (action === "ally") {
        if (rpgState.ram < 12) { setRPGDialogue("* Not enough RAM for Party Assist!"); return; }
        rpgState.ram -= 12;
        var ally = rpgState.activeAlly || "BYTE";
        var aDmg = Math.round(getPlayerAtk() * 1.1);
        activeBattle.hp -= aDmg;
        if (ally === "BYTE") {
            dodgeState.weakened = true;
            msg = "🤖 BYTE Shock-Hack! Dealt " + aDmg + " DMG & weakened enemy attacks by 40%!";
        } else if (ally === "VEX") {
            rpgState.credits += 12;
            msg = "🗡️ VEX Ambush! Dealt " + aDmg + " DMG & siphoned +$12 Credits!";
        } else {
            rpgState.hp = Math.min(getEffectiveMaxHp(), rpgState.hp + 25);
            msg = "🛡️ TITAN Shield Slam! Dealt " + aDmg + " DMG & restored +25 HP!";
        }
    } else if (action === "heal") {
        if (!rpgState.items.nano_patch || rpgState.items.nano_patch <= 0) { setRPGDialogue("* Out of Nano-Patches!"); return; }
        rpgState.items.nano_patch--;
        rpgState.hp = Math.min(getEffectiveMaxHp(), rpgState.hp + 45);
        msg = "🩹 Applied Nano-Patch in combat! Restored +45 HP.";
    } else if (action === "flee") {
        activeBattle = null;
        rpgMode = "explore";
        setExploreControls();
        setRPGDialogue("🏃 Escaped safely into the shadows!");
        return;
    }

    // Passive RAM Regen
    var ramRegen = (perk === "ram20" || perk === "omega") ? 5 : 2;
    rpgState.ram = Math.min(getEffectiveMaxRam(), rpgState.ram + ramRegen);
    updateRPGHud();

    // Check Victory
    if (activeBattle.hp <= 0) {
        var winCredits = (perk === "credits" || perk === "omega") ? Math.round(activeBattle.credits * 1.4) : activeBattle.credits;
        rpgState.xp += activeBattle.xp;
        rpgState.credits += winCredits;
        rpgState.battlesWon++;
        var winCallback = activeBattle.onWin;
        var defeatedName = activeBattle.name;
        var winXp = activeBattle.xp;
        activeBattle = null;
        rpgMode = "explore";

        while (rpgState.xp >= rpgState.nextXp && rpgState.lvl < 30) {
            rpgState.xp -= rpgState.nextXp;
            rpgState.lvl++;
            rpgState.nextXp = Math.round(rpgState.nextXp * 1.28);
            rpgState.maxHp += 12;
            rpgState.maxRam += 5;
            rpgState.hp = getEffectiveMaxHp();
            rpgState.ram = getEffectiveMaxRam();
        }
        syncRPGToCloud();
        updateRPGHud();
        setExploreControls();
        setRPGDialogue("🏆 DEFEATED " + defeatedName + "! (+" + winXp + " XP, +$" + winCredits + " Credits)");
        if (typeof winCallback === "function") winCallback();
        return;
    }

    setRPGDialogue(msg);
    startEnemyDodgeTurn();
}

function rpgMainLoop() {
    var canvas = document.getElementById("rpg-canvas");
    if (canvas) {
        var ctx = canvas.getContext("2d");
        if (rpgMode === "explore" || rpgMode === "cutscene") {
            updateExploration(ctx);
        } else if (rpgMode === "battle" && activeBattle) {
            ctx.fillStyle = "#080412";
            ctx.fillRect(0, 0, 440, 240);
            ctx.fillStyle = activeBattle.isBoss ? "#ff2244" : "#ffaa00";
            ctx.font = "bold 13px monospace";
            ctx.fillText(activeBattle.name + "  [HP: " + Math.max(0, activeBattle.hp) + "/" + activeBattle.maxHp + "]", 110, 28);
            ctx.fillStyle = "#221122";
            ctx.fillRect(110, 36, 220, 10);
            ctx.fillStyle = activeBattle.isBoss ? "#ff2244" : "#00ff88";
            ctx.fillRect(110, 36, Math.max(0, (activeBattle.hp / activeBattle.maxHp) * 220), 10);

            updateDodgeBox(ctx);

            ctx.fillStyle = "#00f0ff";
            ctx.font = "bold 11px monospace";
            ctx.fillText("UNIT-00 [LVL " + rpgState.lvl + "]  +  ALLY: " + (rpgState.activeAlly || "BYTE"), 115, 224);
        }
    }
    rpgAnimId = requestAnimationFrame(rpgMainLoop);
}

function toggleCyberRPG() {
    var cab = document.getElementById("rpg-cabinet");
    if (!cab) return;
    cab.classList.toggle("hidden");
    if (!cab.classList.contains("hidden")) {
        loadRPGFromCloud();
        updateRPGHud();
        setExploreControls();
        if (!rpgAnimId) rpgMainLoop();
        if (typeof startChapter1Intro === "function") startChapter1Intro();
    }
}

document.addEventListener("keydown", function(e) {
    rpgKeys[e.key.toLowerCase()] = true;
    var cab = document.getElementById("rpg-cabinet");
    if (!cab || cab.classList.contains("hidden")) return;
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    if (e.key === "e" || e.key === "E" || e.code === "Space") {
        if (rpgMode === "explore" || rpgMode === "cutscene") {
            e.preventDefault();
            interactNearby();
        }
    }
});

document.addEventListener("keyup", function(e) {
    rpgKeys[e.key.toLowerCase()] = false;
});
// ================= ALL-IN-ONE ENGINE & STORY PATCH =================
var CH1_STORY = CH1_STORY || { step: 0, cutsceneQueue: [], cutsceneIndex: 0 };

function playStoryScene(lines) {
    if (!lines || lines.length === 0) return;
    rpgMode = "cutscene";
    CH1_STORY.cutsceneQueue = lines;
    CH1_STORY.cutsceneIndex = 0;
    renderCurrentStoryLine();
}

function renderCurrentStoryLine() {
    var item = CH1_STORY.cutsceneQueue[CH1_STORY.cutsceneIndex];
    if (!item) {
        rpgMode = "explore";
        setExploreControls();
        return;
    }
    var progress = " (" + (CH1_STORY.cutsceneIndex + 1) + "/" + CH1_STORY.cutsceneQueue.length + ")";
    setRPGDialogue("[" + item.speaker + "]" + progress + ": " + item.line);

    var bar = document.getElementById("rpg-action-bar");
    if (bar) {
        var btnText = (CH1_STORY.cutsceneIndex + 1 < CH1_STORY.cutsceneQueue.length) ? "▶ Next [Space / E]" : "✔ Finish Scene";
        bar.innerHTML = '<button class="btn-arcade" style="background:#00f0ff; color:#000;" onclick="advanceStoryScene()">' + btnText + '</button>';
    }
}

function ensureRPGDomNodes() {
    var cab = document.getElementById("rpg-cabinet");
    if (!cab) return;
    if (!document.getElementById("rpg-dialogue")) {
        var oldText = cab.querySelector("#rpg-text, #rpg-status, div[style*='min-height']");
        if (oldText) oldText.id = "rpg-dialogue";
        else {
            var d = document.createElement("div");
            d.id = "rpg-dialogue";
            d.style.cssText = "color:#ffd700; font-size:12px; min-height:38px; margin:6px 0; padding:6px; background:#050811; border:1px solid #1f2d42; border-radius:4px;";
            cab.appendChild(d);
        }
    }
    if (!document.getElementById("rpg-action-bar")) {
        var controls = cab.querySelector(".arcade-controls");
        if (controls) controls.id = "rpg-action-bar";
        else {
            var bar = document.createElement("div");
            bar.id = "rpg-action-bar";
            bar.className = "arcade-controls";
            cab.appendChild(bar);
        }
    }
}

var _origToggleRPG = toggleCyberRPG;
toggleCyberRPG = function() {
    ensureRPGDomNodes();
    _origToggleRPG();
};

// Fix the activeBattle.xp null crash on battle victory
var _origBattleTurn = battleTurn;
battleTurn = function(action) {
    var cachedXp = activeBattle ? activeBattle.xp : 0;
    try {
        _origBattleTurn(action);
    } catch (err) {
        if (activeBattle === null && rpgMode === "explore") {
            setRPGDialogue("🏆 VICTORY! Earned +" + cachedXp + " XP!");
            setExploreControls();
        }
    }
};

// Prevent Arrow keys & Spacebar from scrolling the webpage while playing
window.addEventListener("keydown", function(e) {
    var cab = document.getElementById("rpg-cabinet");
    if (!cab || cab.classList.contains("hidden")) return;
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", " "].indexOf(e.key) !== -1 ||
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].indexOf(e.code) !== -1) {
        e.preventDefault();
    }
}, { passive: false });
// ================= EXACT HTML CONNECTOR FOR CHAT.HTML =================
setRPGDialogue = function(text) {
    var box = document.getElementById("rpg-dialogue-box");
    if (box) box.innerText = text;
};

updateRPGHud = function() {
    var setTxt = function(id, val) {
        var el = document.getElementById(id);
        if (el) el.innerText = val;
    };
    var mapObj = RPG_MAPS[rpgState.mapId];
    setTxt("rpg-area-name", mapObj ? mapObj.name.toUpperCase() : rpgState.mapId.toUpperCase());
    setTxt("rpg-lvl", rpgState.lvl);
    setTxt("rpg-hp", rpgState.hp + "/" + getEffectiveMaxHp());
    setTxt("rpg-ram", rpgState.ram + "/" + getEffectiveMaxRam());
    setTxt("rpg-credits", rpgState.credits);
};

// Connect your HTML button functions directly to the new engine
function rpgInteract() { interactNearby(); }
function rpgOpenShop() { openRPGShop("Cyber-Network Vendor", ["wpn_baton", "wpn_katana", "arm_vest", "arm_riot", "chip_ram", "chip_vamp"]); }
function saveRPGToCloud(notify) {
    syncRPGToCloud();
    if (notify) setRPGDialogue("☁️ Cloud Save synced to your chat account!");
}
function postRPGProgress() {
    var msgInput = document.getElementById("user-msg");
    if (!msgInput) return;
    msgInput.value = "💻 [PROTOCOL ZERO] LVL " + rpgState.lvl + " | Logs: " + rpgState.logs.length + "/25 | Battles Won: " + rpgState.battlesWon + " | Credits: ₿" + rpgState.credits;
    if (typeof submitRequestMessage === "function") submitRequestMessage();
}
function resetRPGSave() {
    if (!confirm("Reset your PROTOCOL ZERO save back to Level 1?")) return;
    localStorage.removeItem("pz_full_save_v2");
    location.reload();
}

// Keep HUD area name & credits updated whenever switching maps
var _origSetExploreControls = setExploreControls;
setExploreControls = function() {
    updateRPGHud();
    var bar = document.getElementById("rpg-action-bar");
    if (!bar) return;
    bar.innerHTML =
        '<button class="btn-arcade" onclick="rpgInteract()">💬 Talk / Inspect [Space]</button>' +
        '<button class="btn-arcade" onclick="openInventoryMenu()">🎒 Gear & Items</button>' +
        '<button class="btn-arcade" onclick="openLoreCodex()">📂 Codex (' + rpgState.logs.length + '/25)</button>' +
        '<button class="btn-arcade" style="background:#00ff88; color:#000;" onclick="saveRPGToCloud(true)">☁️ Cloud Save</button>' +
        '<button class="btn-arcade" onclick="postRPGProgress()">🏆 Post</button>' +
        '<button class="btn-arcade" style="background:#ffaaaa; color:#000;" onclick="resetRPGSave()">🔄 Reset</button>';
};
// ================= CUSTOM ANIMATED ENEMY BATTLE SPRITES =================
function drawBattleEnemySprite(ctx, battle) {
    var cx = 220, cy = 56 + Math.sin(Date.now() / 160) * 3;
    var name = (battle.name || "").toLowerCase();

    if (battle.isBoss) {
        // Boss Core: Rotating Outer Shield Ring + Glowing Red Visor
        ctx.strokeStyle = "#ff2244";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(cx - 24, cy - 14, 48, 28);
        ctx.strokeStyle = "#ffd700";
        ctx.strokeRect(cx - 18, cy - 10, 36, 20);
        ctx.fillStyle = "#ff2244";
        ctx.fillRect(cx - 12, cy - 3, 24, 6);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cx - 4, cy - 2, 8, 4);
    } else if (name.indexOf("hound") !== -1) {
        // Cyber-Hound: Sharp Angular Neon Head & Twin Eyes
        ctx.fillStyle = "#b026ff";
        ctx.fillRect(cx - 16, cy - 8, 32, 16);
        ctx.fillStyle = "#00f0ff";
        ctx.fillRect(cx - 10, cy - 3, 6, 5);
        ctx.fillRect(cx + 4, cy - 3, 6, 5);
    } else if (name.indexOf("turret") !== -1) {
        // Riot Turret: Heavy Armor Base + Twin Cannon Barrels
        ctx.fillStyle = "#ffaa00";
        ctx.fillRect(cx - 18, cy - 6, 36, 16);
        ctx.fillStyle = "#ff2244";
        ctx.fillRect(cx - 12, cy + 8, 6, 8);
        ctx.fillRect(cx + 6, cy + 8, 6, 8);
    } else {
        // Recon Drone: Hovering Rotors + Single Cyclops Eye
        ctx.fillStyle = "#00f0ff";
        ctx.fillRect(cx - 22, cy - 11, 14, 3);
        ctx.fillRect(cx + 8, cy - 11, 14, 3);
        ctx.fillStyle = "#1f2d42";
        ctx.fillRect(cx - 14, cy - 7, 28, 16);
        ctx.fillStyle = "#ff1464";
        ctx.fillRect(cx - 4, cy - 2, 8, 6);
    }
}

rpgMainLoop = function() {
    var canvas = document.getElementById("rpg-canvas");
    if (canvas) {
        var ctx = canvas.getContext("2d");
        if (rpgMode === "explore" || rpgMode === "cutscene") {
            updateExploration(ctx);
        } else if (rpgMode === "battle" && activeBattle) {
            ctx.fillStyle = "#080412";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Enemy Name & HP Bar
            ctx.fillStyle = activeBattle.isBoss ? "#ff2244" : "#ffaa00";
            ctx.font = "bold 12px monospace";
            ctx.fillText(activeBattle.name + " [" + Math.max(0, activeBattle.hp) + "/" + activeBattle.maxHp + "]", 95, 18);
            ctx.fillStyle = "#221122";
            ctx.fillRect(95, 24, 250, 8);
            ctx.fillStyle = activeBattle.isBoss ? "#ff2244" : "#00ff88";
            ctx.fillRect(95, 24, Math.max(0, (activeBattle.hp / activeBattle.maxHp) * 250), 8);

            // Draw Custom Animated Enemy Sprite!
            drawBattleEnemySprite(ctx, activeBattle);

            updateDodgeBox(ctx);

            ctx.fillStyle = "#00f0ff";
            ctx.font = "bold 11px monospace";
            ctx.fillText("UNIT-00 [LVL " + rpgState.lvl + "] • ALLY: " + (rpgState.activeAlly || "BYTE"), 115, 228);
        }
    }
    rpgAnimId = requestAnimationFrame(rpgMainLoop);
};
