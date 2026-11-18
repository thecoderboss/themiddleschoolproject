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
        setRPGDialogue("🏆 DEFEATED " + defeatedName + "! (+" + activeBattle.xp + " XP, +$" + winCredits + " Credits)");
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
// ============================================================================
// CHUNK 2: CHAPTER 1 MAPS (SECTOR 7 SLUMS & NEON ALLEY) & STORY NPCS
// ============================================================================

registerRPGMap("slums", {
    name: "Sector 7 Slums",
    bg: "#070b14",
    wallColor: "#1b2838",
    walls: [
        { x: 110, y: 20, w: 20, h: 85 },
        { x: 110, y: 145, w: 20, h: 80 },
        { x: 240, y: 55, w: 75, h: 20 },
        { x: 240, y: 165, w: 75, h: 20 }
    ],
    exits: [
        {
            x: 416, y: 95, w: 18, h: 50,
            toMap: "alley", toX: 28, toY: 115,
            reqFlag: "slumsGateOpen",
            lockMsg: "Sector 7 Perimeter Gate is locked! Inspect the Scrap Terminal first."
        }
    ]
});

registerRPGMap("alley", {
    name: "Neon Alley",
    bg: "#0b0716",
    wallColor: "#2a163d",
    walls: [
        { x: 95, y: 10, w: 20, h: 95 },
        { x: 95, y: 145, w: 20, h: 85 },
        { x: 210, y: 50, w: 20, h: 140 },
        { x: 320, y: 10, w: 20, h: 90 },
        { x: 320, y: 140, w: 20, h: 90 }
    ],
    exits: [
        { x: 6, y: 95, w: 16, h: 50, toMap: "slums", toX: 392, toY: 115 },
        {
            x: 416, y: 95, w: 18, h: 50,
            toMap: "metro", toX: 28, toY: 115,
            reqFlag: "wardenDefeated",
            lockMsg: "Under-Metro Blast Door sealed! Defeat CIPHER WARDEN to get the Metro Keycard."
        }
    ]
});

registerRPGEncounters("slums", [
    { id: "slum_bot", name: "Rusty Recon Drone", hp: 38, atk: 8, xp: 18, credits: 14 }
]);

registerRPGEncounters("alley", [
    { id: "alley_hound", name: "Neon Cyber-Hound", hp: 55, atk: 12, xp: 28, credits: 22 },
    { id: "alley_turret", name: "Rogue Riot Turret", hp: 68, atk: 14, xp: 34, credits: 28 }
]);

registerRPGNpcs("slums", [
    {
        name: "Scrap Terminal",
        x: 78, y: 65, color: "#00f0ff",
        onInteract: function() {
            if (!rpgState.flags.slumsGateOpen) {
                rpgState.flags.slumsGateOpen = true;
                unlockLoreLog("log_01");
                completeCh1Quest("q1_wake", "q1_scavenge");
                playStoryScene([
                    { speaker: "SCRAP TERMINAL", line: "DECRYPTING PARTIAL ID CHIP... [UNIT-00 // VANCE LABS // CLEARANCE: ALPHA]." },
                    { speaker: "BYTE", line: "Vance Labs?! That's the old pre-lockdown research facility! And look—your Alpha signature unlocked the East Gate to Neon Alley!" },
                    { speaker: "BYTE", line: "Watch out though. OVERLORD's Rogue Patrol Drones swarm Neon Alley. Let's clear a path and look for clues!" }
                ]);
            } else {
                unlockLoreLog("log_02");
                setRPGDialogue("💻 SCRAP TERMINAL: East Perimeter Gate is OPEN. Head right to enter Neon Alley!");
            }
        }
    },
    {
        name: "Old Man Jax",
        x: 185, y: 115, color: "#ffd700",
        onInteract: function() {
            if (!rpgState.flags.slumsGateOpen) {
                setRPGDialogue("👴 Old Man Jax: *coughs* Check that sparking blue Scrap Terminal first, kid. Your eyes glow like pre-lockdown tech...");
            } else if (!rpgState.flags.jaxCipherGiven) {
                rpgState.flags.jaxCipherGiven = true;
                unlockLoreLog("log_03");
                completeCh1Quest("q1_passcode", "q1_warden");
                playStoryScene([
                    { speaker: "OLD MAN JAX", line: "So you're awake at last, UNIT-00. I worked maintenance at Vance Labs forty years ago." },
                    { speaker: "YOU", line: "You know what I am? Everyone says OVERLORD locked us in here to trap us." },
                    { speaker: "OLD MAN JAX", line: "Bah! Lies told by people too scared to look underground. OVERLORD sealed the Dome in 0.4 seconds to keep something OUT." },
                    { speaker: "OLD MAN JAX", line: "Take this 4-digit bypass cipher: [7-3-9-4]. Use it on the Neon Alley Security Console to draw out Cipher Warden!" }
                ]);
            } else {
                setRPGDialogue("👴 Old Man Jax: Use code [7-3-9-4] on the Neon Alley Console, defeat Cipher Warden, and take the Metro down!");
            }
        }
    },
    {
        name: "Slum Junk Dealer",
        x: 270, y: 115, color: "#00ff88",
        onInteract: function() {
            openRPGShop("Sector 7 Junk Market", ["wpn_baton", "arm_vest", "chip_ram"]);
        }
    }
]);
// ============================================================================
// CHUNK 3: NEON ALLEY NPCS, SECURITY CONSOLE & CIPHER WARDEN BOSS
// ============================================================================

registerRPGNpcs("alley", [
    {
        name: "Alley Scavenger",
        x: 65, y: 115, color: "#00f0ff",
        onInteract: function() {
            if (rpgState.battlesWon >= 3 && !rpgState.flags.done_q1_scavenge) {
                completeCh1Quest("q1_scavenge", "q1_passcode");
                unlockLoreLog("log_04");
                playStoryScene([
                    { speaker: "ALLEY SCAVENGER", line: "Whoa, you actually cleared out those patrol drones! Most runners don't last ten seconds out here." },
                    { speaker: "ALLEY SCAVENGER", line: "See that locked Security Console at the far end? It needs a 4-digit bypass code." },
                    { speaker: "BYTE", line: "Old Man Jax back in Sector 7 worked for Vance Labs! Let's ask him if he remembers the cipher!" }
                ]);
            } else if (!rpgState.flags.done_q1_scavenge) {
                setRPGDialogue("🕵️ Alley Scavenger: Walk around the neon grids and win " + Math.max(0, 3 - rpgState.battlesWon) + " more battles to clear the patrol drones!");
            } else {
                setRPGDialogue("🕵️ Alley Scavenger: Watch out for Cipher Warden at the east blast door—it hits hard!");
            }
        }
    },
    {
        name: "Neon Black-Market",
        x: 165, y: 115, color: "#00ff88",
        onInteract: function() {
            openRPGShop("Neon Alley Arms Dealer", ["wpn_katana", "arm_riot", "chip_vamp"]);
        }
    },
    {
        name: "Security Console",
        x: 360, y: 65, color: "#ffd700",
        onInteract: function() {
            if (rpgState.flags.wardenUnlocked) {
                setRPGDialogue("💻 SECURITY CONSOLE: Override active! Approach Cipher Warden at the east blast door.");
                return;
            }
            var code = prompt("🔐 SECURITY CONSOLE — Enter 4-Digit Bypass Cipher (Hint: Talk to Old Man Jax in Sector 7):");
            if (code === null) return;
            if (code.replace(/[^0-9]/g, "") === "7394") {
                rpgState.flags.wardenUnlocked = true;
                saveRPGLocal();
                playStoryScene([
                    { speaker: "SECURITY CONSOLE", line: "CIPHER [7-3-9-4] ACCEPTED... BLAST DOOR LOCKS DISENGAGING..." },
                    { speaker: "SYSTEM ALERT", line: "⚠️ WARNING: GUARDIAN UNIT [CIPHER WARDEN] ACTIVATED TO DEFEND METRO PERIMETER!" },
                    { speaker: "BYTE", line: "Heads up! Cipher Warden just powered on by the East Gate! Check your Nano-Patches before engaging!" }
                ]);
            } else {
                setRPGDialogue("❌ ACCESS DENIED: Invalid cipher. Ask Old Man Jax in Sector 7 Slums for the 4-digit code!");
            }
        }
    },
    {
        name: "Cipher Warden",
        x: 382, y: 115, color: "#ff2244",
        onInteract: function() {
            if (rpgState.flags.wardenDefeated) {
                setRPGDialogue("🤖 Cipher Warden [OFFLINE]: Blast door to the Under-Metro is unlocked. Step onto the green exit pad!");
                return;
            }
            if (!rpgState.flags.wardenUnlocked) {
                setRPGDialogue("🤖 Cipher Warden [STANDBY]: Armored guardian blocks the Metro gate. Override the Security Console to the north first!");
                return;
            }
            playStoryScene([
                { speaker: "CIPHER WARDEN", line: "HALT, UNIT-00. DIRECTIVE ALPHA FORBIDS CIVILIAN ENTRY INTO TRANSIT LINE 4." },
                { speaker: "YOU", line: "I'm not a civilian—and I need to know what Dr. Vance hid beneath the city!" },
                { speaker: "CIPHER WARDEN", line: "COMBAT STRESS-TEST INITIATED. PROVE YOU CAN SURVIVE THE LOWER SECTORS!" }
            ]);
            setTimeout(function() {
                startRPGBattle({
                    id: "boss_warden",
                    name: "CIPHER WARDEN [CH.1 BOSS]",
                    hp: 155,
                    atk: 15,
                    xp: 120,
                    credits: 140,
                    isBoss: true,
                    onWin: function() {
                        rpgState.flags.wardenDefeated = true;
                        if (rpgState.bossesDefeated.indexOf("boss_warden") === -1) {
                            rpgState.bossesDefeated.push("boss_warden");
                        }
                        unlockLoreLog("log_05");
                        completeCh1Quest("q1_warden", null);
                        playStoryScene([
                            { speaker: "CIPHER WARDEN", line: "FIREWALL... BREACHED... CLEARANCE VERIFIED. PROTECT... THE SEAL... UNIT-00..." },
                            { speaker: "BYTE", line: "We did it!! Look at its memory core—Dr. Vance programmed it to test anyone trying to reach the Deep Core!" },
                            { speaker: "BYTE", line: "The blast door to the Under-Metro is wide open now. Step onto the green exit pad to descend into Chapter 2!" }
                        ]);
                    }
                });
            }, 400);
        }
    }
]);
// ============================================================================
// CHUNK 4: CUTSCENE BATTLE HOOKS, HIDDEN STASHES & CHAPTER 1 SIDE QUESTS
// ============================================================================

var ch1OnCutsceneEnd = null;

function playStorySceneWithCallback(lines, callback) {
    ch1OnCutsceneEnd = callback || null;
    playStoryScene(lines);
}

// Upgrade advanceStoryScene so boss fights start cleanly AFTER dialogue finishes
advanceStoryScene = function() {
    CH1_STORY.cutsceneIndex++;
    if (CH1_STORY.cutsceneIndex >= CH1_STORY.cutsceneQueue.length) {
        CH1_STORY.cutsceneQueue = [];
        var cb = ch1OnCutsceneEnd;
        ch1OnCutsceneEnd = null;
        if (typeof cb === "function") {
            cb();
            return;
        }
        rpgMode = "explore";
        if (typeof setExploreControls === "function") setExploreControls();
        setRPGDialogue("* Exploration resumed. Use [WASD / Arrows] to move and [E] to interact.");
    } else {
        renderCurrentStoryLine();
    }
};

function triggerCipherWardenFight() {
    startRPGBattle({
        id: "boss_warden",
        name: "CIPHER WARDEN [CH.1 BOSS]",
        hp: 155,
        atk: 15,
        xp: 120,
        credits: 140,
        isBoss: true,
        onWin: function() {
            rpgState.flags.wardenDefeated = true;
            if (rpgState.bossesDefeated.indexOf("boss_warden") === -1) {
                rpgState.bossesDefeated.push("boss_warden");
            }
            unlockLoreLog("log_05");
            completeCh1Quest("q1_warden", null);
            playStoryScene([
                { speaker: "CIPHER WARDEN", line: "FIREWALL... BREACHED... CLEARANCE VERIFIED. PROTECT... THE SEAL... UNIT-00..." },
                { speaker: "BYTE", line: "We did it!! Look at its memory core—Dr. Vance programmed it to test anyone trying to reach the Deep Core!" },
                { speaker: "BYTE", line: "The blast door to the Under-Metro is wide open now. Step onto the green exit pad to enter Chapter 2!" }
            ]);
        }
    });
}

// Add Hidden Stashes & Side-Quest NPCs into Sector 7 Slums & Neon Alley
if (RPG_NPCS["slums"]) {
    RPG_NPCS["slums"].push({
        name: "Rusted Supply Crate",
        x: 28, y: 195, color: "#00ff88",
        onInteract: function() {
            if (rpgState.flags.slumCrateLooted) {
                setRPGDialogue("📦 Rusted Supply Crate: Empty. You already salvaged the emergency supplies inside.");
                return;
            }
            rpgState.flags.slumCrateLooted = true;
            rpgState.credits += 35;
            rpgState.items.nano_patch = (rpgState.items.nano_patch || 0) + 1;
            syncRPGToCloud();
            updateRPGHud();
            setRPGDialogue("📦 STASH FOUND! Recovered +$35 Credits and +1 Nano-Patch hidden behind the Slum wall!");
        }
    });

    RPG_NPCS["slums"].push({
        name: "Med-Bot 09",
        x: 345, y: 42, color: "#ff66b8",
        onInteract: function() {
            if (!rpgState.flags.medbotRepaired) {
                if (rpgState.credits < 20) {
                    setRPGDialogue("🩺 Med-Bot 09: *BZZT* Need $20 Credits worth of copper wire to reboot my healing bay...");
                    return;
                }
                rpgState.credits -= 20;
                rpgState.flags.medbotRepaired = true;
                rpgState.hp = getEffectiveMaxHp();
                rpgState.ram = getEffectiveMaxRam();
                syncRPGToCloud();
                updateRPGHud();
                setRPGDialogue("🩺 Med-Bot 09: *DING!* Systems online! Free full HP & RAM recharges unlocked forever!");
            } else {
                rpgState.hp = getEffectiveMaxHp();
                rpgState.ram = getEffectiveMaxRam();
                updateRPGHud();
                setRPGDialogue("🩺 Med-Bot 09: Welcome back, UNIT-00! HP and RAM restored to 100%!");
            }
        }
    });
}

if (RPG_NPCS["alley"]) {
    RPG_NPCS["alley"].push({
        name: "Encrypted Dead-Drop",
        x: 245, y: 26, color: "#b026ff",
        onInteract: function() {
            if (rpgState.flags.alleyDropLooted) {
                setRPGDialogue("📡 Encrypted Dead-Drop: Signal already downloaded.");
                return;
            }
            rpgState.flags.alleyDropLooted = true;
            rpgState.credits += 50;
            rpgState.items.ram_cell = (rpgState.items.ram_cell || 0) + 2;
            syncRPGToCloud();
            updateRPGHud();
            setRPGDialogue("📡 DEAD-DROP HACKED! Siphoned +$50 Credits and +2 RAM Cells from a Syndicate cache!");
        }
    });
}
// ============================================================================
// CHUNK 5: BOUNTY TERMINAL, SECRET ALLEY MINI-BOSS & BYTE OVERCLOCK UPGRADE
// ============================================================================

var CH1_BOUNTIES = [
    { id: "bnt_drones", title: "Scrap Sweep (Win 3 Battles)", targetWins: 3, rewardCredits: 55, rewardXp: 45 },
    { id: "bnt_patrol", title: "Neon Purge (Win 7 Battles)", targetWins: 7, rewardCredits: 110, rewardXp: 85 },
    { id: "bnt_hunter", title: "Warden's Bane (Win 12 Battles)", targetWins: 12, rewardCredits: 185, rewardXp: 140 }
];

function interactCh1BountyBoard() {
    for (var i = 0; i < CH1_BOUNTIES.length; i++) {
        var b = CH1_BOUNTIES[i];
        if (rpgState.completedBounties.indexOf(b.id) === -1) {
            if (rpgState.battlesWon >= b.targetWins) {
                rpgState.completedBounties.push(b.id);
                rpgState.credits += b.rewardCredits;
                rpgState.xp += b.rewardXp;
                syncRPGToCloud();
                updateRPGHud();
                setRPGDialogue("🎯 BOUNTY CLAIMED: " + b.title + "! Earned +$" + b.rewardCredits + " Credits & +" + b.rewardXp + " XP!");
            } else {
                var rem = b.targetWins - rpgState.battlesWon;
                setRPGDialogue("🎯 ACTIVE BOUNTY: " + b.title + " — Win " + rem + " more battle(s) to claim +$" + b.rewardCredits + " Credits!");
            }
            return;
        }
    }
    setRPGDialogue("🎯 BOUNTY TERMINAL: All Sector 7 bounties cleared! Check the Under-Metro board in Chapter 2.");
}

// Add Bounty Terminal & BYTE Overclock Bench to Sector 7 Slums
if (RPG_NPCS["slums"]) {
    RPG_NPCS["slums"].push({
        name: "Bounty Terminal",
        x: 155, y: 38, color: "#ffaa00",
        onInteract: function() {
            interactCh1BountyBoard();
        }
    });

    RPG_NPCS["slums"].push({
        name: "BYTE Upgrade Bench",
        x: 350, y: 192, color: "#00f0ff",
        onInteract: function() {
            if (rpgState.flags.byteUpgradedCh1) {
                setRPGDialogue("🔧 BYTE Upgrade Bench: BYTE's Shock-Hack coil is running at Overclock Tier 2!");
                return;
            }
            if (rpgState.credits < 90) {
                setRPGDialogue("🔧 BYTE Upgrade Bench: Needs $90 Credits to upgrade BYTE's Shock-Hack amplifier.");
                return;
            }
            rpgState.credits -= 90;
            rpgState.flags.byteUpgradedCh1 = true;
            rpgState.allyLevels["BYTE"] = 2;
            syncRPGToCloud();
            updateRPGHud();
            playStoryScene([
                { speaker: "SYSTEM", line: "INSTALLING HIGH-VOLTAGE CAPACITOR INTO COMPANION DRONE [BYTE]..." },
                { speaker: "BYTE", line: "WHOA!! My circuits feel like lightning! My Shock-Hack assist hits even harder now, UNIT-00!" }
            ]);
        }
    });
}

// Add Secret Mini-Boss ("Scrap Golem Mk-I") in Neon Alley's Hidden Alcove
if (RPG_NPCS["alley"]) {
    RPG_NPCS["alley"].push({
        name: "Overgrown Mech",
        x: 245, y: 196, color: "#ff6600",
        onInteract: function() {
            if (rpgState.flags.alleyGolemDefeated) {
                setRPGDialogue("🦾 Overgrown Mech: Reduced to quiet scrap metal.");
                return;
            }
            playStorySceneWithCallback([
                { speaker: "BYTE", line: "Careful! That rusty mech isn't dead—its red optical eye just locked onto us!" },
                { speaker: "SCRAP GOLEM", line: "INTRUDER... UNAUTHORIZED... CRUSH PROTOCOL ENGAGED." }
            ], function() {
                startRPGBattle({
                    id: "mini_golem",
                    name: "SCRAP GOLEM MK-I [MINI-BOSS]",
                    hp: 115,
                    atk: 13,
                    xp: 85,
                    credits: 95,
                    isBoss: true,
                    onWin: function() {
                        rpgState.flags.alleyGolemDefeated = true;
                        if (rpgState.ownedGear.indexOf("chip_crit") === -1) {
                            rpgState.ownedGear.push("chip_crit");
                            equipGearItem("chip_crit");
                        }
                        syncRPGToCloud();
                        setRPGDialogue("🏆 SCRAP GOLEM DESTROYED! Salvaged & equipped [Overclock Crit Core] (+25% Crit Chance)!");
                    }
                });
            });
        }
    });
}
// ============================================================================
// CHUNK 6: QUEST LOG VIEWER, AMBIENT LORE NPCS & CLEAN WARDEN BATTLE HOOK
// ============================================================================

function openCh1QuestLog() {
    var activeId = rpgState.flags.ch1Quest || "q1_wake";
    var q = CH1_QUESTS[activeId];
    if (rpgState.flags.wardenDefeated) {
        setRPGDialogue("📜 CHAPTER 1 COMPLETE! Head through Neon Alley's East Blast Door to enter Chapter 2: The Under-Metro!");
        return;
    }
    if (q) {
        setRPGDialogue("📜 ACTIVE QUEST [" + q.title + "]: " + q.desc + " (Reward: $" + q.rewardCredits + " + " + q.rewardXp + " XP)");
    } else {
        setRPGDialogue("📜 QUEST LOG: Explore Sector 7 Slums and talk to BYTE or Old Man Jax.");
    }
}

// Upgrade Cipher Warden's onInteract in Neon Alley to use the clean Cutscene Callback
if (RPG_NPCS["alley"]) {
    for (var wIdx = 0; wIdx < RPG_NPCS["alley"].length; wIdx++) {
        if (RPG_NPCS["alley"][wIdx].name === "Cipher Warden") {
            RPG_NPCS["alley"][wIdx].onInteract = function() {
                if (rpgState.flags.wardenDefeated) {
                    setRPGDialogue("🤖 Cipher Warden [OFFLINE]: Blast door to the Under-Metro is unlocked. Step onto the green exit pad!");
                    return;
                }
                if (!rpgState.flags.wardenUnlocked) {
                    setRPGDialogue("🤖 Cipher Warden [STANDBY]: Armored guardian blocks the Metro gate. Override the Security Console to the north first!");
                    return;
                }
                playStorySceneWithCallback([
                    { speaker: "CIPHER WARDEN", line: "HALT, UNIT-00. DIRECTIVE ALPHA FORBIDS CIVILIAN ENTRY INTO TRANSIT LINE 4." },
                    { speaker: "YOU", line: "I'm not a civilian—and I need to know what Dr. Vance hid beneath the city!" },
                    { speaker: "CIPHER WARDEN", line: "COMBAT STRESS-TEST INITIATED. PROVE YOU CAN SURVIVE THE LOWER SECTORS!" }
                ], triggerCipherWardenFight);
            };
        }
    }
}

// Add Worldbuilding NPCs in Sector 7 Slums & Neon Alley
if (RPG_NPCS["slums"]) {
    RPG_NPCS["slums"].push({
        name: "Slum Kid Mira",
        x: 62, y: 165, color: "#66e0ff",
        onInteract: function() {
            playStoryScene([
                { speaker: "MIRA", line: "My granddad says nobody has seen the real sky since the Neon Dome closed forty years ago." },
                { speaker: "MIRA", line: "Sometimes at night, if you press your ear against the storm grates, you can hear static whispering from way down deep..." },
                { speaker: "BYTE", line: "*whirs nervously* Let's stay away from the deep grates until we find out what's down there, UNIT-00." }
            ]);
        }
    });

    RPG_NPCS["slums"].push({
        name: "Ex-Guard Vance-7",
        x: 215, y: 196, color: "#ff80c8",
        onInteract: function() {
            if (!rpgState.flags.exGuardTip) {
                rpgState.flags.exGuardTip = true;
                rpgState.credits += 15;
                saveRPGLocal();
                updateRPGHud();
                playStoryScene([
                    { speaker: "EX-GUARD", line: "You've got the posture of a Vance Labs prototype. Watch your RAM in Neon Alley—those Cyber-Hounds strike fast." },
                    { speaker: "EX-GUARD", line: "Here's $15 Credits. Buy a Kevlar Weave Vest from the Junk Market before you pick a fight with Cipher Warden!" }
                ]);
            } else {
                setRPGDialogue("🛡️ Ex-Guard: Remember—use BYTE's Shock-Hack assist when a boss charges a Mega-Surge!");
            }
        }
    });
}

if (RPG_NPCS["alley"]) {
    RPG_NPCS["alley"].push({
        name: "Flickering Holo-Sign",
        x: 132, y: 40, color: "#00f0ff",
        onInteract: function() {
            setRPGDialogue("📺 HOLO-SIGN [YEAR 0 ARCHIVE]: 'CITIZENS OF NEW OTTAWA — REMAIN CALM. THE DOME SHIELD IS FOR YOUR PROTECTION. — DR. ARIS VANCE'");
        }
    });
}
// ============================================================================
// CHUNK 7: SECRET WALL TERMINALS, STREET EVENTS & CHAPTER 1 COMPLETION TRACKER
// ============================================================================

function checkCh1Achievements() {
    if (!rpgState.achievements) rpgState.achievements = [];
    var grant = function(id, label, bonusCredits) {
        if (rpgState.achievements.indexOf(id) !== -1) return;
        rpgState.achievements.push(id);
        rpgState.credits += bonusCredits;
        syncRPGToCloud();
        updateRPGHud();
        setRPGDialogue("🏅 ACHIEVEMENT UNLOCKED: " + label + " (+" + bonusCredits + " Credits)!");
    };

    if (rpgState.battlesWon >= 1) grant("ach_first_blood", "First Circuit Broken", 20);
    if (rpgState.flags.alleyGolemDefeated) grant("ach_golem_slayer", "Scrapyard Titan", 50);
    if (rpgState.flags.wardenDefeated) grant("ach_ch1_clear", "Perimeter Breached (Ch.1 Clear)", 100);
    if (rpgState.logs.length >= 5) grant("ach_archivist_1", "Slum Data Archivist (5 Logs)", 40);
}

// Add Secret Wall Terminals & Scavenger Events to Sector 7 & Neon Alley
if (RPG_NPCS["slums"]) {
    RPG_NPCS["slums"].push({
        name: "Hidden Wall Panel",
        x: 275, y: 38, color: "#9e88cc",
        onInteract: function() {
            if (rpgState.flags.slumSecretFound) {
                setRPGDialogue("🔌 Hidden Wall Panel: Secret cache already decrypted.");
                return;
            }
            rpgState.flags.slumSecretFound = true;
            rpgState.credits += 45;
            rpgState.items.emp_grenade = (rpgState.items.emp_grenade || 0) + 1;
            checkCh1Achievements();
            syncRPGToCloud();
            updateRPGHud();
            playStoryScene([
                { speaker: "BYTE", line: "Whoa! Nice eyes, UNIT-00! Behind that loose steel plate was a pre-lockdown emergency stash!" },
                { speaker: "SYSTEM", line: "OBTAINED: +$45 Credits & +1 EMP Grenade." }
            ]);
        }
    });
}

if (RPG_NPCS["alley"]) {
    RPG_NPCS["alley"].push({
        name: "Stray Courier Drone",
        x: 345, y: 196, color: "#00ff88",
        onInteract: function() {
            if (rpgState.flags.courierSaved) {
                setRPGDialogue("🛸 Stray Courier Drone: *happy beep!* Thanks again for fixing my gyro!");
                return;
            }
            rpgState.flags.courierSaved = true;
            rpgState.karma = (rpgState.karma || 0) + 1;
            rpgState.credits += 30;
            rpgState.items.nano_patch = (rpgState.items.nano_patch || 0) + 1;
            syncRPGToCloud();
            updateRPGHud();
            playStoryScene([
                { speaker: "COURIER DRONE", line: "*BEEP-BOOP!* Left-wing stabilizer repaired! Delivery tip transferred to UNIT-00!" },
                { speaker: "BYTE", line: "Hehe, even the stray bots like you! (+1 Karma, +$30 Credits, +1 Nano-Patch)" }
            ]);
        }
    });

    RPG_NPCS["alley"].push({
        name: "Ch.1 Status Beacon",
        x: 398, y: 65, color: "#ffd700",
        onInteract: function() {
            checkCh1Achievements();
            var logsFound = 0;
            var ch1Logs = ["log_01", "log_02", "log_03", "log_04", "log_05"];
            for (var i = 0; i < ch1Logs.length; i++) {
                if (rpgState.logs.indexOf(ch1Logs[i]) !== -1) logsFound++;
            }
            setRPGDialogue(
                "📊 CHAPTER 1 REPORT • Logs: " + logsFound + "/5 | Mini-Boss: " +
                (rpgState.flags.alleyGolemDefeated ? "CLEARED" : "ALIVE") +
                " | Cipher Warden: " + (rpgState.flags.wardenDefeated ? "DEFEATED" : "ACTIVE")
            );
        }
    });
}

// Wrap Cipher Warden's victory to also award Chapter 1 Achievements
var origTriggerWarden = triggerCipherWardenFight;
triggerCipherWardenFight = function() {
    origTriggerWarden();
    if (activeBattle && activeBattle.onWin) {
        var baseWin = activeBattle.onWin;
        activeBattle.onWin = function() {
            baseWin();
            checkCh1Achievements();
        };
    }
};

// Auto-trigger Chapter 1 Intro if player starts on Sector 7 Slums
window.addEventListener("load", function() {
    if (typeof loadRPGLocal === "function") loadRPGLocal();
    if (rpgState && rpgState.mapId === "slums" && !rpgState.flags.ch1IntroDone) {
        setTimeout(function() {
            var cab = document.getElementById("rpg-cabinet");
            if (cab && !cab.classList.contains("hidden")) startChapter1Intro();
        }, 300);
    }
});
// ============================================================================
// CHUNK 8: SECTOR 7 UNDERGROUND ARENA GAUNTLET (TRAINING & CREDITS FARM)
// ============================================================================

var CH1_ARENA_WAVES = [
    { tier: 1, name: "Arena Scrap-Bot",     hp: 48,  atk: 10, xp: 25, credits: 22 },
    { tier: 2, name: "Twin-Blade Enforcer", hp: 75,  atk: 13, xp: 40, credits: 38 },
    { tier: 3, name: "Neon Riot Suppressor",hp: 105, atk: 16, xp: 65, credits: 60 },
    { tier: 4, name: "Slum Pit Champion",   hp: 140, atk: 18, xp: 95, credits: 90 }
];

function openSlumArenaMenu() {
    var tier = rpgState.flags.arenaTier || 1;
    if (tier > CH1_ARENA_WAVES.length) {
        setRPGDialogue("🏟️ UNDERGROUND ARENA: You are the reigning Sector 7 Pit Champion! Re-fight Tier 4 anytime for XP & Credits.");
        tier = 4;
    } else {
        setRPGDialogue("🏟️ UNDERGROUND ARENA [TIER " + tier + "/4]: Ready to challenge " + CH1_ARENA_WAVES[tier - 1].name + "?");
    }

    var bar = document.getElementById("rpg-action-bar");
    if (bar) {
        bar.innerHTML =
            '<button class="btn-arcade" style="background:#ffaa00; color:#000;" onclick="startArenaMatch(' + tier + ')">⚔️ Enter Pit (Tier ' + tier + ')</button>' +
            '<button class="btn-arcade" style="background:#ff3355; color:#fff;" onclick="setExploreControls()">✖ Step Back</button>';
    }
}

function startArenaMatch(tier) {
    var wave = CH1_ARENA_WAVES[Math.min(tier, CH1_ARENA_WAVES.length) - 1];
    if (!wave) return;
    startRPGBattle({
        id: "arena_t" + tier,
        name: "PIT: " + wave.name,
        hp: wave.hp,
        atk: wave.atk,
        xp: wave.xp,
        credits: wave.credits,
        isBoss: (tier === 4),
        onWin: function() {
            var cur = rpgState.flags.arenaTier || 1;
            if (tier === cur && cur <= CH1_ARENA_WAVES.length) {
                rpgState.flags.arenaTier = cur + 1;
            }
            if (tier === 4 && rpgState.ownedGear.indexOf("chip_dodge") === -1) {
                rpgState.ownedGear.push("chip_dodge");
                equipGearItem("chip_dodge");
                setRPGDialogue("🏆 ARENA CHAMPION! Won +$" + wave.credits + " Credits & unlocked [Phase-Shift Gyro] (+30% Dodge Speed)!");
            }
            syncRPGToCloud();
        }
    });
}

if (RPG_NPCS["slums"]) {
    RPG_NPCS["slums"].push({
        name: "Pit Promoter Kade",
        x: 398, y: 168, color: "#ff4466",
        onInteract: function() {
            openSlumArenaMenu();
        }
    });
}
// ============================================================================
// CHUNK 9: FREQUENCY DECRYPTION PUZZLE & BYTE REST-POINT LORE SCENE
// ============================================================================

function openFrequencyPuzzle() {
    if (rpgState.flags.freqPuzzleSolved) {
        setRPGDialogue("📻 Relay Tower: Signal locked at 432 Hz. Deep-core telemetry uploaded to your Codex.");
        return;
    }
    var guess = prompt("📻 RELAY TOWER — Tune receiver frequency in Hz (Hint: Check Log #09 or guess between 400-450):");
    if (guess === null) return;
    var val = parseInt(guess.replace(/[^0-9]/g, ""), 10);

    if (val === 432) {
        rpgState.flags.freqPuzzleSolved = true;
        rpgState.credits += 75;
        rpgState.xp += 65;
        syncRPGToCloud();
        updateRPGHud();
        playStoryScene([
            { speaker: "RELAY TOWER", line: "SIGNAL LOCKED [432 HZ]... DECRYPTING SUB-SURFACE ECHO..." },
            { speaker: "UNKNOWN VOICE", line: "...if anyone hears this... Dr. Vance's containment cipher is holding... do not trust the static..." },
            { speaker: "BYTE", line: "Whoa!! That transmission came from four kilometers straight down! We're on the right track, UNIT-00! (+$75 Credits, +65 XP)" }
        ]);
    } else if (!isNaN(val)) {
        var hint = val < 432 ? "TOO LOW — static interference rises." : "TOO HIGH — receiver harmonic clipping.";
        setRPGDialogue("📻 RELAY TOWER [" + val + " Hz]: " + hint + " Try tuning again!");
    }
}

if (RPG_NPCS["alley"]) {
    RPG_NPCS["alley"].push({
        name: "Tuned Relay Tower",
        x: 28, y: 40, color: "#00f0ff",
        onInteract: function() {
            openFrequencyPuzzle();
        }
    });
}

if (RPG_NPCS["slums"]) {
    RPG_NPCS["slums"].push({
        name: "Neon Campfire",
        x: 155, y: 192, color: "#ff8800",
        onInteract: function() {
            rpgState.hp = getEffectiveMaxHp();
            rpgState.ram = getEffectiveMaxRam();
            updateRPGHud();
            if (!rpgState.flags.campfireSceneSeen) {
                rpgState.flags.campfireSceneSeen = true;
                saveRPGLocal();
                playStoryScene([
                    { speaker: "BYTE", line: "*hovers near the warm plasma barrel* You know, UNIT-00... before you woke up, this place felt empty." },
                    { speaker: "YOU", line: "Even if my memories are gone, I know we have to reach the Citadel and help OVERLORD." },
                    { speaker: "BYTE", line: "I'm with you all the way! HP & RAM fully restored—let's go!" }
                ]);
            } else {
                setRPGDialogue("🔥 Neon Campfire: Warm plasma glow restores your HP and RAM to 100%!");
            }
        }
    });
}
// ============================================================================
// CHUNK 10: SLUM HACKER QUIZ TERMINAL (LORE & SECURITY CHALLENGE)
// ============================================================================

var CH1_QUIZ_QUESTIONS = [
    {
        q: "Q1/3: Who engineered the Neon Dome lockdown and Protocol Zero?",
        a: "vance",
        hint: "Starts with V (Dr. Aris ___)"
    },
    {
        q: "Q2/3: What is UNIT-00's companion drone named?",
        a: "byte",
        hint: "4 letters, digital unit of data"
    },
    {
        q: "Q3/3: What is the name of the digital parasite trapped below Sector 7?",
        a: "null",
        hint: "THE ____ (4 letters)"
    }
];

function startCh1HackerQuiz() {
    if (rpgState.flags.ch1QuizPassed) {
        setRPGDialogue("🧠 Hacker Terminal: Security clearance already verified. Good luck in the Under-Metro, UNIT-00!");
        return;
    }
    for (var i = 0; i < CH1_QUIZ_QUESTIONS.length; i++) {
        var item = CH1_QUIZ_QUESTIONS[i];
        var ans = prompt("🧠 SECURITY QUIZ — " + item.q + "\n(Hint: " + item.hint + ")");
        if (ans === null) return;
        if (ans.toLowerCase().indexOf(item.a) === -1) {
            setRPGDialogue("❌ QUIZ FAILED on Question " + (i + 1) + "! Check your Data Codex logs and try again.");
            return;
        }
    }
    rpgState.flags.ch1QuizPassed = true;
    rpgState.credits += 80;
    rpgState.maxRam += 5;
    rpgState.ram = getEffectiveMaxRam();
    syncRPGToCloud();
    updateRPGHud();
    playStoryScene([
        { speaker: "HACKER TERMINAL", line: "ALL 3 SECURITY QUESTIONS VERIFIED... NEURAL CACHE EXPANDED (+5 MAX RAM)." },
        { speaker: "BYTE", line: "Boom! Three for three! Plus we scored $80 Credits from the terminal's bounty escrow!" }
    ]);
}

if (RPG_NPCS["slums"]) {
    RPG_NPCS["slums"].push({
        name: "Hacker Quiz Node",
        x: 305, y: 115, color: "#00ff88",
        onInteract: function() {
            startCh1HackerQuiz();
        }
    });
}
