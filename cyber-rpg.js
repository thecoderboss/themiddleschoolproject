// ================= PROTOCOL ZERO: TURN-BASED CYBERPUNK RPG =================
var rpgRunning = false, rpgAnimId = null;
var rpgMode = "explore"; // "explore" | "battle" | "shop"

var defaultRPG = {
    mapId: "slums",
    px: 60, py: 120,
    lvl: 1, xp: 0,
    hp: 100, maxHp: 100,
    ram: 50, maxRam: 50,
    atk: 16, def: 4,
    credits: 30,
    hasByte: false,
    hasKeycard: false,
    bossesDefeated: [],
    chestsOpened: []
};

var rpgState = JSON.parse(localStorage.getItem("protocol_zero_save") || "null") || Object.assign({}, defaultRPG);
var rpgKeys = {}, rpgCloudLoaded = false, rpgStepCounter = 0;

// 5 Connected Overworld Maps
var RPG_MAPS = {
    slums: {
        name: "SECTOR 7 SLUMS",
        bg: "#070b14", grid: "rgba(0, 221, 255, 0.08)",
        encounterRate: 0,
        exits: [
            { x: 422, y: 90, w: 18, h: 60, toMap: "alley", toX: 24, toY: 115, label: "NEON ALLEY ->" }
        ],
        npcs: [
            { id: "nix", name: "NIX (Mentor)", x: 140, y: 70, color: "#00ff88",
              talk: function() {
                  if (!rpgState.hasByte) {
                      rpgState.hasByte = true;
                      saveRPGLocal();
                      return "* NIX: CorpSec locked down the Mainframe! Take BYTE, my rogue drone—he'll assist you in battle! Head East to Neon Alley.";
                  }
                  if (!rpgState.hasKeycard) {
                      return "* NIX: Battle rogue bots in Neon Alley to level up, then find the CorpSec Keycard in the Server Vault!";
                  }
                  return "* NIX: You got the Keycard! Head through Neon Alley -> Corp Lobby -> Mainframe Core and shut down OVERLORD!";
              }
            },
            { id: "medbot", name: "REPAIR TERMINAL", x: 60, y: 45, color: "#00ddff",
              talk: function() {
                  rpgState.hp = rpgState.maxHp;
                  rpgState.ram = rpgState.maxRam;
                  saveRPGLocal();
                  return "* [TERMINAL]: Diagnostics complete. HP and RAM 100% restored!";
              }
            }
        ],
        chests: [
            { id: "slums_c1", x: 320, y: 180, rewardText: "Found 50 Byte-Credits (₿) in a scrap crate!", give: function() { rpgState.credits += 50; } }
        ]
    },
    alley: {
        name: "NEON ALLEY (DANGER)",
        bg: "#0c0716", grid: "rgba(255, 68, 170, 0.09)",
        encounterRate: 0.014,
        enemies: [
            { name: "Scrap Drone", hp: 42, maxHp: 42, atk: 11, xp: 25, credits: 18, color: "#ff44aa", weak: "EMP BLAST" },
            { name: "CorpSec Patrol", hp: 55, maxHp: 55, atk: 14, xp: 35, credits: 25, color: "#00ddff", weak: "DATA DRAIN" }
        ],
        exits: [
            { x: 0, y: 90, w: 18, h: 60, toMap: "slums", toX: 395, toY: 115, label: "<- SLUMS" },
            { x: 422, y: 90, w: 18, h: 60, toMap: "vault", toX: 24, toY: 115, label: "SERVER VAULT ->" }
        ],
        npcs: [
            { id: "shade", name: "SHADE (Broker)", x: 210, y: 50, color: "#ffd700",
              talk: function() {
                  return "* SHADE: Watch out—wild security bots patrol Neon Alley! Use [HACK] skills in battle to hit their weak spots.";
              }
            }
        ],
        chests: [
            { id: "alley_c1", x: 260, y: 195, rewardText: "Found an Overclock Chip! (+4 ATK permanently!)", give: function() { rpgState.atk += 4; } }
        ]
    },
    vault: {
        name: "CORPSEC SERVER VAULT",
        bg: "#071410", grid: "rgba(0, 255, 136, 0.08)",
        encounterRate: 0.016,
        enemies: [
            { name: "Cipher Turret", hp: 75, maxHp: 75, atk: 18, xp: 50, credits: 35, color: "#ffd700", weak: "EMP BLAST" },
            { name: "Firewall Hound", hp: 90, maxHp: 90, atk: 22, xp: 65, credits: 45, color: "#ff8800", weak: "OVERCLOCK" }
        ],
        exits: [
            { x: 0, y: 90, w: 18, h: 60, toMap: "alley", toX: 395, toY: 115, label: "<- ALLEY" },
            { x: 422, y: 90, w: 18, h: 60, toMap: "core", toX: 24, toY: 115, label: "MAINFRAME ->", locked: true }
        ],
        npcs: [
            { id: "warden", name: "CIPHER WARDEN [BOSS]", x: 330, y: 112, color: "#ff3344",
              talk: function() {
                  if (rpgState.bossesDefeated.includes("warden")) {
                      return "* [WARDEN OFFLINE]: The vault security gate to the East is unlocked.";
                  }
                  startRPGBattle({
                      id: "warden", name: "CIPHER WARDEN", isBoss: true,
                      hp: 180, maxHp: 180, atk: 24, xp: 150, credits: 100,
                      color: "#ff3344", weak: "EMP BLAST",
                      onWin: function() {
                          rpgState.hasKeycard = true;
                          setRPGDialogue("* VICTORY! Cipher Warden dropped the [MAINFRAME KEYCARD]! The East gate is now open!");
                      }
                  });
                  return null;
              }
            }
        ],
        chests: [
            { id: "vault_c1", x: 140, y: 190, rewardText: "Found Titanium Plating! (+25 Max HP & +3 DEF!)", give: function() { rpgState.maxHp += 25; rpgState.hp += 25; rpgState.def += 3; } }
        ]
    },
    core: {
        name: "OMEGA MAINFRAME CORE",
        bg: "#160609", grid: "rgba(255, 34, 68, 0.12)",
        encounterRate: 0,
        exits: [
            { x: 0, y: 90, w: 18, h: 60, toMap: "vault", toX: 395, toY: 115, label: "<- VAULT" }
        ],
        npcs: [
            { id: "overlord", name: "OVERLORD A.I. [FINAL BOSS]", x: 320, y: 110, color: "#ff0044",
              talk: function() {
                  startRPGBattle({
                      id: "overlord", name: "OVERLORD A.I.", isBoss: true,
                      hp: 360, maxHp: 360, atk: 34, xp: 500, credits: 300,
                      color: "#ff0044", weak: "OVERCLOCK",
                      onWin: function() {
                          setRPGDialogue("🏆 YOU DEFEATED OVERLORD A.I. AND FREED THE NETWORK! Click 'Post to Chat' to flex your win!");
                      }
                  });
                  return null;
              }
            }
        ],
        chests: []
    }
};
document.addEventListener("keydown", function(e) {
    if (!rpgRunning) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key) && document.activeElement.tagName !== "INPUT") {
        e.preventDefault();
    }
    if (e.key === " " && !rpgKeys[" "] && rpgMode === "explore") {
        rpgInteract();
    }
    rpgKeys[e.key.toLowerCase()] = true;
});
document.addEventListener("keyup", function(e) {
    rpgKeys[e.key.toLowerCase()] = false;
});

function setRPGDialogue(text) {
    var box = document.getElementById("rpg-dialogue-box");
    if (box) box.innerText = text;
}

function updateRPGHud() {
    var mapData = RPG_MAPS[rpgState.mapId] || RPG_MAPS.slums;
    document.getElementById("rpg-area-name").innerText = mapData.name;
    document.getElementById("rpg-lvl").innerText = rpgState.lvl;
    document.getElementById("rpg-hp").innerText = Math.max(0, Math.ceil(rpgState.hp)) + "/" + rpgState.maxHp;
    document.getElementById("rpg-ram").innerText = Math.max(0, Math.ceil(rpgState.ram)) + "/" + rpgState.maxRam;
    document.getElementById("rpg-credits").innerText = rpgState.credits;
}

function saveRPGLocal() {
    localStorage.setItem("protocol_zero_save", JSON.stringify(rpgState));
    updateRPGHud();
}

function saveRPGToCloud(showAlert) {
    saveRPGLocal();
    var email = localStorage.getItem("sb_user_email");
    var token = localStorage.getItem("sb_token");
    if (!email || !token) return;

    var xhr = new XMLHttpRequest();
    xhr.open("POST", SUPABASE_URL + "/rest/v1/rpg_saves", true);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Prefer", "resolution=merge-duplicates");
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status <= 299) {
                setRPGDialogue("* ☁️ Game progress synced to your Supabase account!");
                if (showAlert) alert("☁️ Cloud Save complete!");
            } else if (showAlert) {
                alert("Cloud save failed (Code " + xhr.status + "). Check your rpg_saves table!");
            }
        }
    };
    xhr.send(JSON.stringify({ "email": email, "save_data": rpgState, "updated_at": new Date().toISOString() }));
}

function loadRPGFromCloud(callback) {
    var email = localStorage.getItem("sb_user_email");
    var token = localStorage.getItem("sb_token");
    if (!email || !token) return callback();

    var xhr = new XMLHttpRequest();
    xhr.open("GET", SUPABASE_URL + "/rest/v1/rpg_saves?email=eq." + encodeURIComponent(email) + "&select=save_data", true);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                var rows = JSON.parse(xhr.responseText);
                if (rows && rows.length > 0 && rows[0].save_data && rows[0].save_data.mapId) {
                    rpgState = Object.assign({}, defaultRPG, rows[0].save_data);
                    saveRPGLocal();
                    setRPGDialogue("* ☁️ Loaded your saved game from the cloud!");
                }
            }
            rpgCloudLoaded = true;
            callback();
        }
    };
    xhr.send();
}

function toggleCyberRPG() {
    var box = document.getElementById("rpg-cabinet");
    box.classList.toggle("hidden");
    if (!box.classList.contains("hidden") && !rpgRunning) {
        var boot = function() {
            updateRPGHud();
            setExploreControls();
            rpgRunning = true;
            cancelAnimationFrame(rpgAnimId);
            rpgMainLoop();
        };
        if (!rpgCloudLoaded) loadRPGFromCloud(boot);
        else boot();
    } else if (box.classList.contains("hidden")) {
        rpgRunning = false;
        cancelAnimationFrame(rpgAnimId);
    }
}

function setExploreControls() {
    rpgMode = "explore";
    var bar = document.getElementById("rpg-action-bar");
    bar.innerHTML =
        '<button class="btn-arcade" onclick="rpgInteract()">💬 Talk / Inspect [Space]</button>' +
        '<button class="btn-arcade" onclick="rpgOpenShop()">🛒 Cyber-Shop</button>' +
        '<button class="btn-arcade" style="background:#00ff88;" onclick="saveRPGToCloud(true)">☁️ Cloud Save</button>' +
        '<button class="btn-arcade" onclick="postRPGProgress()">🏆 Post to Chat</button>' +
        '<button class="btn-arcade" style="background:#ffaaaa;" onclick="resetRPGSave()">🔄 Reset</button>';
}

function rpgInteract() {
    if (rpgMode !== "explore") return;
    var map = RPG_MAPS[rpgState.mapId];

    // Check nearby NPCs
    for (var i = 0; i < map.npcs.length; i++) {
        var npc = map.npcs[i];
        var dist = Math.hypot(rpgState.px - npc.x, rpgState.py - npc.y);
        if (dist < 42) {
            var reply = npc.talk();
            if (reply) setRPGDialogue(reply);
            return;
        }
    }

    // Check nearby Treasure Chests
    for (var c = 0; c < map.chests.length; c++) {
        var ch = map.chests[c];
        var cDist = Math.hypot(rpgState.px - ch.x, rpgState.py - ch.y);
        if (cDist < 40) {
            if (rpgState.chestsOpened.includes(ch.id)) {
                setRPGDialogue("* This loot crate is empty.");
            } else {
                rpgState.chestsOpened.push(ch.id);
                ch.give();
                saveRPGLocal();
                setRPGDialogue("* 📦 " + ch.rewardText);
            }
            return;
        }
    }
    setRPGDialogue("* Nothing nearby to inspect. Walk closer to an NPC, Terminal, or Crate!");
}

function rpgOpenShop() {
    if (rpgMode === "battle") return;
    rpgMode = "shop";
    setRPGDialogue("* [CYBER-SHOP]: Spend Byte-Credits (₿) to upgrade your rig! Current: " + rpgState.credits + "₿");
    var bar = document.getElementById("rpg-action-bar");
    bar.innerHTML =
        '<button class="btn-arcade" onclick="rpgBuy(\'blade\')">🗡️ +5 ATK (40₿)</button>' +
        '<button class="btn-arcade" onclick="rpgBuy(\'ram\')">🔋 +20 MaxRAM (35₿)</button>' +
        '<button class="btn-arcade" onclick="rpgBuy(\'armor\')">🛡️ +3 DEF & +25 HP (45₿)</button>' +
        '<button class="btn-arcade" onclick="rpgBuy(\'heal\')">💊 Full Restore (20₿)</button>' +
        '<button class="btn-arcade" style="background:#ffaaaa;" onclick="setExploreControls()">⬅️ Exit Shop</button>';
}

function rpgBuy(item) {
    if (item === "blade" && rpgState.credits >= 40) {
        rpgState.credits -= 40; rpgState.atk += 5;
        setRPGDialogue("* Upgraded Cyber-Blade! ATK is now " + rpgState.atk + ".");
    } else if (item === "ram" && rpgState.credits >= 35) {
        rpgState.credits -= 35; rpgState.maxRam += 20; rpgState.ram += 20;
        setRPGDialogue("* Upgraded Neural RAM! Max RAM is now " + rpgState.maxRam + ".");
    } else if (item === "armor" && rpgState.credits >= 45) {
        rpgState.credits -= 45; rpgState.def += 3; rpgState.maxHp += 25; rpgState.hp += 25;
        setRPGDialogue("* Installed Subdermal Armor! DEF " + rpgState.def + ", Max HP " + rpgState.maxHp + ".");
    } else if (item === "heal" && rpgState.credits >= 20) {
        rpgState.credits -= 20; rpgState.hp = rpgState.maxHp; rpgState.ram = rpgState.maxRam;
        setRPGDialogue("* HP and RAM fully restored!");
    } else {
        setRPGDialogue("* ❌ Not enough Byte-Credits (₿)!");
    }
    saveRPGLocal();
}
var activeBattle = null;

function startRPGBattle(enemyTemplate) {
    rpgMode = "battle";
    activeBattle = Object.assign({}, enemyTemplate);
    var weakHint = activeBattle.weak ? " (Scan suggests weak to " + activeBattle.weak + ")" : "";
    setRPGDialogue("* ⚠️ " + activeBattle.name + " blocks your path!" + weakHint);
    renderBattleButtons();
}

function renderBattleButtons() {
    var bar = document.getElementById("rpg-action-bar");
    var byteBtn = rpgState.hasByte
        ? '<button class="btn-arcade" style="background:#b19cd9;" onclick="battleTurn(\'byte\')">🤖 BYTE Assist (15 RAM)</button>'
        : '';
    var runBtn = activeBattle && activeBattle.isBoss
        ? ''
        : '<button class="btn-arcade" style="background:#ffaaaa;" onclick="battleTurn(\'run\')">🏃 Escape</button>';

    bar.innerHTML =
        '<button class="btn-arcade" onclick="battleTurn(\'attack\')">⚔️ Cyber-Blade</button>' +
        '<button class="btn-arcade" style="background:#00ddff;" onclick="battleTurn(\'emp\')">⚡ EMP Blast (12 RAM)</button>' +
        '<button class="btn-arcade" style="background:#ffd700;" onclick="battleTurn(\'overclock\')">🔥 Overclock (18 RAM)</button>' +
        '<button class="btn-arcade" style="background:#00ff88;" onclick="battleTurn(\'drain\')">🧬 Data Drain (15 RAM)</button>' +
        byteBtn + runBtn;
}

function battleTurn(action) {
    if (rpgMode !== "battle" || !activeBattle) return;
    var dmg = 0, logMsg = "";

    if (action === "attack") {
        dmg = Math.max(4, rpgState.atk + Math.floor(Math.random() * 6) - 2);
        activeBattle.hp -= dmg;
        logMsg = "* You slash " + activeBattle.name + " for " + dmg + " DMG!";
    } else if (action === "emp") {
        if (rpgState.ram < 12) return setRPGDialogue("* ❌ Not enough RAM (Need 12 RAM)!");
        rpgState.ram -= 12;
        var mult = (activeBattle.weak === "EMP BLAST") ? 1.8 : 1.25;
        dmg = Math.round(rpgState.atk * mult);
        activeBattle.hp -= dmg;
        logMsg = "* ⚡ EMP BLAST hits for " + dmg + " DMG!" + (mult > 1.5 ? " SUPER EFFECTIVE!" : "");
    } else if (action === "overclock") {
        if (rpgState.ram < 18) return setRPGDialogue("* ❌ Not enough RAM (Need 18 RAM)!");
        rpgState.ram -= 18;
        var oMult = (activeBattle.weak === "OVERCLOCK") ? 2.1 : 1.5;
        dmg = Math.round(rpgState.atk * oMult);
        activeBattle.hp -= dmg;
        logMsg = "* 🔥 OVERCLOCK SURGE deals " + dmg + " massive DMG!" + (oMult > 1.8 ? " CRITICAL WEAKNESS!" : "");
    } else if (action === "drain") {
        if (rpgState.ram < 15) return setRPGDialogue("* ❌ Not enough RAM (Need 15 RAM)!");
        rpgState.ram -= 15;
        var dMult = (activeBattle.weak === "DATA DRAIN") ? 1.6 : 1.0;
        dmg = Math.round(rpgState.atk * dMult);
        var healAmt = Math.round(dmg * 0.65);
        activeBattle.hp -= dmg;
        rpgState.hp = Math.min(rpgState.maxHp, rpgState.hp + healAmt);
        logMsg = "* 🧬 DATA DRAIN deals " + dmg + " DMG and restores +" + healAmt + " HP!";
    } else if (action === "byte") {
        if (rpgState.ram < 15) return setRPGDialogue("* ❌ BYTE needs 15 RAM to hack!");
        rpgState.ram -= 15;
        dmg = Math.round(rpgState.atk * 1.1) + 10;
        var ramBack = 8;
        activeBattle.hp -= dmg;
        rpgState.ram = Math.min(rpgState.maxRam, rpgState.ram + ramBack);
        logMsg = "* 🤖 BYTE fires a shock beam for " + dmg + " DMG and disrupts enemy targeting!";
    } else if (action === "run") {
        if (Math.random() < 0.75) {
            activeBattle = null;
            setExploreControls();
            return setRPGDialogue("* You slipped into the shadows and escaped!");
        } else {
            logMsg = "* ❌ Escape blocked!";
        }
    }

    // Check if enemy defeated
    if (activeBattle && activeBattle.hp <= 0) {
        var defeated = activeBattle;
        activeBattle = null;
        rpgState.xp += defeated.xp;
        rpgState.credits += defeated.credits;
        if (defeated.id && !rpgState.bossesDefeated.includes(defeated.id)) {
            rpgState.bossesDefeated.push(defeated.id);
        }

        var lvlMsg = "";
        var xpNeeded = rpgState.lvl * 60;
        while (rpgState.xp >= xpNeeded) {
            rpgState.xp -= xpNeeded;
            rpgState.lvl++;
            rpgState.maxHp += 25;
            rpgState.hp = rpgState.maxHp;
            rpgState.maxRam += 10;
            rpgState.ram = rpgState.maxRam;
            rpgState.atk += 5;
            rpgState.def += 2;
            xpNeeded = rpgState.lvl * 60;
            lvlMsg = " ⚡ LEVEL UP! Now Level " + rpgState.lvl + "!";
        }

        saveRPGLocal();
        if (defeated.isBoss) saveRPGToCloud(false);
        setExploreControls();
        if (defeated.onWin) {
            defeated.onWin();
        } else {
            setRPGDialogue("* 🏆 Derezzed " + defeated.name + "! (+" + defeated.xp + " XP, +" + defeated.credits + "₿)" + lvlMsg);
        }
        return;
    }

    // Enemy Turn
    var enemyDmg = Math.max(2, activeBattle.atk - rpgState.def + Math.floor(Math.random() * 5) - 2);
    if (action === "byte") enemyDmg = Math.max(1, Math.floor(enemyDmg * 0.5));
    rpgState.hp -= enemyDmg;
    updateRPGHud();

    if (rpgState.hp <= 0) {
        activeBattle = null;
        rpgState.mapId = "slums";
        rpgState.px = 60; rpgState.py = 120;
        rpgState.hp = rpgState.maxHp;
        rpgState.ram = rpgState.maxRam;
        saveRPGLocal();
        setExploreControls();
        setRPGDialogue("* 💀 SYSTEM CRASHED! Emergency rebooted back at Sector 7 Slums.");
        return;
    }

    setRPGDialogue(logMsg + "\n* " + activeBattle.name + " strikes back for " + enemyDmg + " DMG!");
}

function rpgMainLoop() {
    if (!rpgRunning) return;
    var canvas = document.getElementById("rpg-canvas");
    var ctx = canvas.getContext("2d");
    var map = RPG_MAPS[rpgState.mapId] || RPG_MAPS.slums;

    if (rpgMode === "battle" && activeBattle) {
        // Turn-Based Undertale / Pokemon Battle Screen
        ctx.fillStyle = "#03050a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Battle Arena Frame
        ctx.strokeStyle = activeBattle.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 16, 400, 208);

        // Enemy Name & HP Bar
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.fillText(activeBattle.name + " (HP: " + Math.max(0, activeBattle.hp) + "/" + activeBattle.maxHp + ")", 220, 42);

        ctx.fillStyle = "#330011";
        ctx.fillRect(110, 50, 220, 10);
        ctx.fillStyle = activeBattle.color;
        ctx.fillRect(110, 50, 220 * (Math.max(0, activeBattle.hp) / activeBattle.maxHp), 10);

        // Enemy Hologram Avatar
        var size = activeBattle.isBoss ? 68 : 48;
        ctx.fillStyle = activeBattle.color;
        ctx.fillRect(220 - size / 2, 82, size, size);
        ctx.fillStyle = "#000";
        ctx.fillRect(220 - size / 4, 96, 8, 8);
        ctx.fillRect(220 + size / 4 - 8, 96, 8, 8);

        // Party Status Footer inside Battle Screen
        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 12px monospace";
        var partyText = "YOU [LVL " + rpgState.lvl + "]" + (rpgState.hasByte ? "  +  🤖 BYTE [ONLINE]" : "");
        ctx.fillText(partyText, 220, 198);
    } else {
        // Overworld Exploration Screen
        ctx.fillStyle = map.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = map.grid;
        ctx.lineWidth = 1;
        for (var gx = 0; gx < canvas.width; gx += 22) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke();
        }
        for (var gy = 0; gy < canvas.height; gy += 22) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke();
        }

        // Handle Movement in Explore Mode
        if (rpgMode === "explore") {
            var moved = false;
            var spd = 3.2;
            if ((rpgKeys["arrowleft"] || rpgKeys["a"]) && rpgState.px > 8) { rpgState.px -= spd; moved = true; }
            if ((rpgKeys["arrowright"] || rpgKeys["d"]) && rpgState.px < canvas.width - 24) { rpgState.px += spd; moved = true; }
            if ((rpgKeys["arrowup"] || rpgKeys["w"]) && rpgState.py > 8) { rpgState.py -= spd; moved = true; }
            if ((rpgKeys["arrowdown"] || rpgKeys["s"]) && rpgState.py < canvas.height - 24) { rpgState.py += spd; moved = true; }

            if (moved && map.encounterRate > 0 && map.enemies) {
                rpgStepCounter++;
                if (rpgStepCounter > 35 && Math.random() < map.encounterRate) {
                    rpgStepCounter = 0;
                    var pick = map.enemies[Math.floor(Math.random() * map.enemies.length)];
                    startRPGBattle(pick);
                }
            }
        }

                // Draw & Check Room Exits
        ctx.font = "bold 10px monospace";
        for (var ex = 0; ex < map.exits.length; ex++) {
            var portal = map.exits[ex];
            ctx.fillStyle = (portal.locked && !rpgState.hasKeycard) ? "#ff3344" : "#00ddff";
            ctx.fillRect(portal.x, portal.y, portal.w, portal.h);
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = portal.x === 0 ? "left" : "right";
            ctx.fillText(portal.label, portal.x === 0 ? 22 : 418, portal.y + 34);

            if (rpgState.px < portal.x + portal.w && rpgState.px + 16 > portal.x &&
                rpgState.py < portal.y + portal.h && rpgState.py + 16 > portal.y) {
                if (portal.locked && !rpgState.hasKeycard) {
                    rpgState.px = portal.x - 20;
                    setRPGDialogue("* 🔒 LOCKED: Requires the [MAINFRAME KEYCARD] from Cipher Warden!");
                } else {
                    rpgState.mapId = portal.toMap;
                    rpgState.px = portal.toX;
                    rpgState.py = portal.toY;
                    saveRPGLocal();
                    setRPGDialogue("* Entered " + RPG_MAPS[rpgState.mapId].name + ".");
                    break;
                }
            }
        }

        // Draw Chests
        for (var c = 0; c < map.chests.length; c++) {
            var ch = map.chests[c];
            ctx.fillStyle = rpgState.chestsOpened.includes(ch.id) ? "#444" : "#ffd700";
            ctx.fillRect(ch.x, ch.y, 14, 14);
        }

        // Draw NPCs & Labels
        ctx.textAlign = "center";
        for (var n = 0; n < map.npcs.length; n++) {
            var npc = map.npcs[n];
            ctx.fillStyle = npc.color;
            ctx.fillRect(npc.x, npc.y, 16, 16);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(npc.name, npc.x + 8, npc.y - 5);
        }

        // Draw Player & BYTE Companion
        ctx.fillStyle = "#00ff88";
        ctx.fillRect(rpgState.px, rpgState.py, 16, 16);
        if (rpgState.hasByte) {
            ctx.fillStyle = "#b19cd9";
            ctx.fillRect(rpgState.px - 12, rpgState.py - 8, 8, 8);
        }
    }

    rpgAnimId = requestAnimationFrame(rpgMainLoop);
}

function postRPGProgress() {
    var mapName = (RPG_MAPS[rpgState.mapId] || RPG_MAPS.slums).name;
    var msgBox = document.getElementById("user-msg");
    msgBox.value = "💻 [PROTOCOL ZERO RPG] Lvl " + rpgState.lvl + " | Area: " + mapName + " | Bosses: " + rpgState.bossesDefeated.length + "/2 | ₿" + rpgState.credits;
    submitRequestMessage();
}

function resetRPGSave() {
    if (!confirm("Reset your PROTOCOL ZERO save back to the beginning?")) return;
    rpgState = Object.assign({}, defaultRPG);
    activeBattle = null;
    saveRPGToCloud(false);
    setExploreControls();
    setRPGDialogue("* Save wiped. Welcome back to Sector 7 Slums!");
}
