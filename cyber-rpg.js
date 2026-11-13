// ================= CYBER-BREACH RPG V2 (CLOUD SAVE + SHOP + BLASTER) =================
var rpgRunning = false, rpgAnimId = null;
var RPG_CHAPTERS = [
    { name: "Neon Alley", color: "#00ddff", enemy: "Script Kiddie", boss: "ICE-9 Gatekeeper", bossHp: 150, bossAtk: 14 },
    { name: "Corp Firewall", color: "#ff44aa", enemy: "Sentry Drone", boss: "Watchdog Cerberus", bossHp: 260, bossAtk: 22 },
    { name: "Crypto Vault", color: "#ffd700", enemy: "Cipher Guard", boss: "Cipher Warden", bossHp: 400, bossAtk: 30 },
    { name: "Darknet Site", color: "#b19cd9", enemy: "Trojan Stalker", boss: "Phantom Virus", bossHp: 580, bossAtk: 40 },
    { name: "Data Reactor", color: "#00ff88", enemy: "Plasma Mech", boss: "Reactor Titan", bossHp: 800, bossAtk: 52 },
    { name: "Ghost Server", color: "#ffffff", enemy: "Wraith Node", boss: "Specter Prime", bossHp: 1100, bossAtk: 65 },
    { name: "Neural Grid", color: "#ff8800", enemy: "Synapse Bot", boss: "Mindflayer AI", bossHp: 1450, bossAtk: 80 },
    { name: "Zero-Day Core", color: "#ff0055", enemy: "Exploit Hunter", boss: "Zero-Day Sovereign", bossHp: 1900, bossAtk: 95 },
    { name: "Quantum Gate", color: "#44ffff", enemy: "Qubit Knight", boss: "Chronos Warden", bossHp: 2400, bossAtk: 115 },
    { name: "Omega Mainframe", color: "#ff2222", enemy: "Apex Enforcer", boss: "OVERLORD A.I.", bossHp: 3200, bossAtk: 140 }
];

var defaultRPG = {
    ch: 1, lvl: 1, xp: 0, hp: 100, maxHp: 100,
    bladeAtk: 20, blasterAtk: 14, credits: 0,
    bladeLvl: 1, blasterLvl: 1, armorLvl: 1, ngPlus: 0
};
var rpgState = JSON.parse(localStorage.getItem("cyber_rpg_save") || "null") || Object.assign({}, defaultRPG);
var rpgPlayer = { x: 36, y: 120, size: 16, speed: 3.6, dirX: 1, dirY: 0, atkTimer: 0, shootTimer: 0, dashCd: 0, invuln: 0 };
var rpgEnemies = [], rpgWalls = [], rpgNodes = [], rpgBullets = [], rpgEnemyShots = [], rpgFloatTexts = [], rpgParticles = [], rpgKeys = {};
var rpgBossSpawned = false, rpgCloudLoaded = false;

var HACKER_SPRITE = ["011110","110101","111111","011110","111111","101101"];
var BOT_SPRITE = ["101101","111111","100001","111111","010010","100001"];

document.addEventListener("keydown", function(e) {
    if (!rpgRunning) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key) && document.activeElement.tagName !== "INPUT") {
        e.preventDefault();
    }
    rpgKeys[e.key.toLowerCase()] = true;
});
document.addEventListener("keyup", function(e) {
    rpgKeys[e.key.toLowerCase()] = false;
});

function saveRPGLocal() {
    localStorage.setItem("cyber_rpg_save", JSON.stringify(rpgState));
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
                setRPGLog("☁️ Progress synced to your Supabase account!");
                if (showAlert) alert("☁️ Cloud Save complete!");
            } else if (showAlert) {
                alert("Cloud save failed (Code " + xhr.status + "). Make sure you ran the rpg_saves SQL!");
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
                if (rows && rows.length > 0 && rows[0].save_data) {
                    rpgState = Object.assign({}, defaultRPG, rows[0].save_data);
                    saveRPGLocal();
                    setRPGLog("☁️ Loaded cloud save from your account!");
                }
            }
            rpgCloudLoaded = true;
            callback();
        }
    };
    xhr.send();
}

function updateRPGHud() {
    var chIdx = (rpgState.ch - 1) % RPG_CHAPTERS.length;
    var prefix = rpgState.ngPlus > 0 ? "NG+" + rpgState.ngPlus + " " : "";
    document.getElementById("rpg-ch").innerText = rpgState.ch;
    document.getElementById("rpg-zone").innerText = prefix + RPG_CHAPTERS[chIdx].name;
    document.getElementById("rpg-lvl").innerText = rpgState.lvl;
    document.getElementById("rpg-hp").innerText = Math.max(0, Math.ceil(rpgState.hp)) + "/" + rpgState.maxHp;
    document.getElementById("rpg-credits").innerText = rpgState.credits;
    document.getElementById("cost-blade").innerText = rpgState.bladeLvl * 30;
    document.getElementById("cost-blaster").innerText = rpgState.blasterLvl * 35;
    document.getElementById("cost-armor").innerText = rpgState.armorLvl * 25;
}

function buyRPGUpgrade(type) {
    if (type === "blade") {
        var cost = rpgState.bladeLvl * 30;
        if (rpgState.credits < cost) return setRPGLog("❌ Need " + cost + "₿ for Blade upgrade!");
        rpgState.credits -= cost; rpgState.bladeLvl++; rpgState.bladeAtk += 6;
        setRPGLog("🗡️ Cyber-Blade upgraded! (Melee DMG: " + rpgState.bladeAtk + ")");
    } else if (type === "blaster") {
        var cost = rpgState.blasterLvl * 35;
        if (rpgState.credits < cost) return setRPGLog("❌ Need " + cost + "₿ for Blaster upgrade!");
        rpgState.credits -= cost; rpgState.blasterLvl++; rpgState.blasterAtk += 5;
        setRPGLog("🔫 Plasma Blaster upgraded! (Ranged DMG: " + rpgState.blasterAtk + ")");
    } else if (type === "armor") {
        var cost = rpgState.armorLvl * 25;
        if (rpgState.credits < cost) return setRPGLog("❌ Need " + cost + "₿ for Armor upgrade!");
        rpgState.credits -= cost; rpgState.armorLvl++; rpgState.maxHp += 30; rpgState.hp += 30;
        setRPGLog("🛡️ Firewall Armor upgraded! (Max HP: " + rpgState.maxHp + ")");
    } else if (type === "heal") {
        if (rpgState.credits < 20) return setRPGLog("❌ Need 20₿ for full heal!");
        if (rpgState.hp >= rpgState.maxHp) return setRPGLog("💚 HP is already full!");
        rpgState.credits -= 20; rpgState.hp = rpgState.maxHp;
        setRPGLog("💊 Overclock Medkit used! HP fully restored.");
    }
    saveRPGLocal();
}

function setRPGLog(msg) {
    var el = document.getElementById("rpg-log");
    if (el) el.innerText = msg;
}

function toggleCyberRPG() {
    var box = document.getElementById("rpg-cabinet");
    box.classList.toggle("hidden");
    if (!box.classList.contains("hidden") && !rpgRunning) {
        var startFn = function() {
            if (rpgState.hp <= 0) rpgState.hp = rpgState.maxHp;
            initRPGChapter();
            rpgRunning = true;
            cancelAnimationFrame(rpgAnimId);
            gameLoopCyberRPG();
        };
        if (!rpgCloudLoaded) loadRPGFromCloud(startFn);
        else startFn();
    } else if (box.classList.contains("hidden")) {
        rpgRunning = false;
        cancelAnimationFrame(rpgAnimId);
    }
}

function initRPGChapter() {
    rpgPlayer.x = 36; rpgPlayer.y = 122;
    rpgBossSpawned = false;
    rpgEnemies = []; rpgNodes = []; rpgBullets = []; rpgEnemyShots = []; rpgParticles = []; rpgFloatTexts = [];
    var chIdx = (rpgState.ch - 1) % RPG_CHAPTERS.length;
    var scale = 1 + (rpgState.ch - 1) * 0.45 + (rpgState.ngPlus * 1.5);

    rpgWalls = [
        { x: 110, y: 40, w: 24, h: 65 },
        { x: 110, y: 155, w: 24, h: 65 },
        { x: 220, y: 85, w: 24, h: 90 },
        { x: 315, y: 40, w: 24, h: 65 },
        { x: 315, y: 155, w: 24, h: 65 }
    ];

    var spots = [
        { x: 160, y: 40 },
        { x: 160, y: 205 },
        { x: 270, y: 45 },
        { x: 270, y: 200 },
        { x: 380, y: 120 }
    ];

    for (var i = 0; i < spots.length; i++) {
        rpgEnemies.push({
            name: RPG_CHAPTERS[chIdx].enemy,
            x: spots[i].x, y: spots[i].y, size: 18,
            hp: Math.round(38 * scale), maxHp: Math.round(38 * scale),
            atk: Math.round(8 * scale),
            speed: 1.05 + (chIdx * 0.08),
            isBoss: false, hitFlash: 0, shootCd: 60 + i * 20
        });
    }

    rpgNodes.push({ x: 170, y: 125, active: true });
    rpgNodes.push({ x: 375, y: 45, active: true });

    updateRPGHud();
    setRPGLog("CH." + rpgState.ch + " [" + RPG_CHAPTERS[chIdx].name + "]: Derez all 5 bots to summon the Boss!");
}

function spawnChapterBoss() {
    rpgBossSpawned = true;
    var chIdx = (rpgState.ch - 1) % RPG_CHAPTERS.length;
    var chData = RPG_CHAPTERS[chIdx];
    var ngMult = 1 + (rpgState.ngPlus * 0.9);
    rpgEnemies.push({
        name: chData.boss,
        x: 365, y: 110, size: 30,
        hp: Math.round(chData.bossHp * ngMult),
        maxHp: Math.round(chData.bossHp * ngMult),
        atk: Math.round(chData.bossAtk * ngMult),
        speed: 1.35,
        isBoss: true, hitFlash: 0, shootCd: 50
    });
    setRPGLog("⚠️ BOSS ALERT: [" + chData.boss + "] HAS ENTERED THE GRID!");
}

function hitsWall(nx, ny, size) {
    if (nx < 6 || ny < 6 || nx + size > 434 || ny + size > 254) return true;
    for (var i = 0; i < rpgWalls.length; i++) {
        var w = rpgWalls[i];
        if (nx < w.x + w.w && nx + size > w.x && ny < w.y + w.h && ny + size > w.y) return true;
    }
    return false;
}

function addRPGParticles(x, y, color) {
    for (var i = 0; i < 10; i++) {
        rpgParticles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 4.5,
            vy: (Math.random() - 0.5) * 4.5,
            life: 18, color: color
        });
    }
}

function addFloatText(x, y, text, color) {
    rpgFloatTexts.push({ x: x, y: y, text: text, color: color, life: 28 });
}

function gainRPGXP(amount, creditsEarned) {
    rpgState.xp += amount;
    rpgState.credits += creditsEarned;
    var xpNeeded = rpgState.lvl * 65;
    while (rpgState.xp >= xpNeeded) {
        rpgState.xp -= xpNeeded;
        rpgState.lvl++;
        rpgState.maxHp += 25;
        rpgState.hp = rpgState.maxHp;
        rpgState.bladeAtk += 5;
        rpgState.blasterAtk += 4;
        xpNeeded = rpgState.lvl * 65;
        setRPGLog("⚡ LEVEL UP! Level " + rpgState.lvl + " reached (All stats boosted)!");
    }
    saveRPGLocal();
}

function damageRPGEnemy(idx, dmg, color) {
    var en = rpgEnemies[idx];
    en.hp -= dmg;
    en.hitFlash = 6;
    addRPGParticles(en.x + en.size / 2, en.y + en.size / 2, color);
    addFloatText(en.x + en.size / 2, en.y - 6, "-" + dmg, "#ffffff");

    if (en.hp <= 0) {
        var wasBoss = en.isBoss;
        var defeatedName = en.name;
        rpgEnemies.splice(idx, 1);

        if (wasBoss) {
            var rewardCredits = 50 + (rpgState.ch * 15);
            gainRPGXP(130 * rpgState.ch, rewardCredits);
            rpgState.ch++;
            if ((rpgState.ch - 1) % RPG_CHAPTERS.length === 0) rpgState.ngPlus++;
            saveRPGToCloud(false);
            setRPGLog("🏆 BOSS [" + defeatedName + "] DEREZZED! (+" + rewardCredits + "₿) Advancing to Ch." + rpgState.ch + "...");
            setTimeout(initRPGChapter, 1500);
            return true;
        } else {
            var botCredits = 10 + (rpgState.ch * 3);
            gainRPGXP(25 * rpgState.ch, botCredits);
            setRPGLog("Derez'd " + defeatedName + "! (+" + botCredits + "₿)");
            if (rpgEnemies.length === 0 && !rpgBossSpawned) spawnChapterBoss();
        }
    }
    return false;
}

function gameLoopCyberRPG() {
    if (!rpgRunning) return;
    var canvas = document.getElementById("rpg-canvas");
    var ctx = canvas.getContext("2d");
    var chIdx = (rpgState.ch - 1) % RPG_CHAPTERS.length;
    var themeColor = RPG_CHAPTERS[chIdx].color;

    ctx.fillStyle = "#05080f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(0, 221, 255, 0.08)";
    for (var gx = 0; gx < canvas.width; gx += 22) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke();
    }
    for (var gy = 0; gy < canvas.height; gy += 22) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke();
    }

    // Player Movement & Phase Dash [Q]
    var dx = 0, dy = 0;
    if (rpgKeys["arrowleft"] || rpgKeys["a"]) { dx = -1; rpgPlayer.dirX = -1; rpgPlayer.dirY = 0; }
    if (rpgKeys["arrowright"] || rpgKeys["d"]) { dx = 1; rpgPlayer.dirX = 1; rpgPlayer.dirY = 0; }
    if (rpgKeys["arrowup"] || rpgKeys["w"]) { dy = -1; rpgPlayer.dirX = 0; rpgPlayer.dirY = -1; }
    if (rpgKeys["arrowdown"] || rpgKeys["s"]) { dy = 1; rpgPlayer.dirX = 0; rpgPlayer.dirY = 1; }

    if (rpgPlayer.dashCd > 0) rpgPlayer.dashCd--;
    var moveSpeed = rpgPlayer.speed;
    if (rpgKeys["q"] && rpgPlayer.dashCd === 0 && (dx !== 0 || dy !== 0)) {
        moveSpeed = 28;
        rpgPlayer.dashCd = 45;
        rpgPlayer.invuln = 15;
        addRPGParticles(rpgPlayer.x + 8, rpgPlayer.y + 8, "#00ffff");
    }

    if (dx !== 0 && !hitsWall(rpgPlayer.x + dx * moveSpeed, rpgPlayer.y, rpgPlayer.size)) rpgPlayer.x += dx * moveSpeed;
    if (dy !== 0 && !hitsWall(rpgPlayer.x, rpgPlayer.y + dy * moveSpeed, rpgPlayer.size)) rpgPlayer.y += dy * moveSpeed;

    // Melee Cyber-Blade Slash [Space]
    if (rpgPlayer.atkTimer > 0) rpgPlayer.atkTimer--;
    if (rpgKeys[" "] && rpgPlayer.atkTimer === 0) {
        rpgPlayer.atkTimer = 14;
        var slashX = rpgPlayer.x + rpgPlayer.dirX * 18;
        var slashY = rpgPlayer.y + rpgPlayer.dirY * 18;
        for (var i = rpgEnemies.length - 1; i >= 0; i--) {
            var en = rpgEnemies[i];
            if (slashX < en.x + en.size + 8 && slashX + rpgPlayer.size + 8 > en.x &&
                slashY < en.y + en.size + 8 && slashY + rpgPlayer.size + 8 > en.y) {
                if (damageRPGEnemy(i, rpgState.bladeAtk, themeColor)) break;
            }
        }
    }

    // Ranged Plasma Blaster [E]
    if (rpgPlayer.shootTimer > 0) rpgPlayer.shootTimer--;
    if (rpgKeys["e"] && rpgPlayer.shootTimer === 0) {
        rpgPlayer.shootTimer = 18;
        rpgBullets.push({
            x: rpgPlayer.x + 6, y: rpgPlayer.y + 6,
            vx: rpgPlayer.dirX * 6.5, vy: rpgPlayer.dirY * 6.5
        });
    }

    // Draw Firewall Walls
    ctx.fillStyle = "#111c33";
    ctx.strokeStyle = themeColor;
    for (var w = 0; w < rpgWalls.length; w++) {
        var wl = rpgWalls[w];
        ctx.fillRect(wl.x, wl.y, wl.w, wl.h);
        ctx.strokeRect(wl.x, wl.y, wl.w, wl.h);
    }

    // Draw Repair Nodes
    for (var n = 0; n < rpgNodes.length; n++) {
        var nd = rpgNodes[n];
        if (!nd.active) continue;
        ctx.fillStyle = "#00ff44";
        ctx.fillRect(nd.x, nd.y, 12, 12);
        if (rpgPlayer.x < nd.x + 12 && rpgPlayer.x + rpgPlayer.size > nd.x &&
            rpgPlayer.y < nd.y + 12 && rpgPlayer.y + rpgPlayer.size > nd.y) {
            nd.active = false;
            rpgState.hp = Math.min(rpgState.maxHp, rpgState.hp + Math.round(rpgState.maxHp * 0.45));
            saveRPGLocal();
            addFloatText(nd.x, nd.y, "+HEAL", "#00ff44");
        }
    }

    // Player Plasma Bullets
    ctx.fillStyle = "#00ffff";
    for (var b = rpgBullets.length - 1; b >= 0; b--) {
        var bul = rpgBullets[b];
        bul.x += bul.vx; bul.y += bul.vy;
        ctx.fillRect(bul.x, bul.y, 5, 5);
        if (hitsWall(bul.x, bul.y, 5)) { rpgBullets.splice(b, 1); continue; }
        for (var ei = rpgEnemies.length - 1; ei >= 0; ei--) {
            var tar = rpgEnemies[ei];
            if (bul.x < tar.x + tar.size && bul.x + 5 > tar.x && bul.y < tar.y + tar.size && bul.y + 5 > tar.y) {
                rpgBullets.splice(b, 1);
                damageRPGEnemy(ei, rpgState.blasterAtk, "#00ffff");
                break;
            }
        }
    }

    // Update & Draw Enemies + Boss
    if (rpgPlayer.invuln > 0) rpgPlayer.invuln--;
    for (var e = 0; e < rpgEnemies.length; e++) {
        var foe = rpgEnemies[e];
        var angle = Math.atan2(rpgPlayer.y - foe.y, rpgPlayer.x - foe.x);
        var vx = Math.cos(angle) * foe.speed;
        var vy = Math.sin(angle) * foe.speed;
        if (!hitsWall(foe.x + vx, foe.y, foe.size)) foe.x += vx;
        if (!hitsWall(foe.x, foe.y + vy, foe.size)) foe.y += vy;

        // Boss & Enemy Ranged Shots
        foe.shootCd--;
        if (foe.shootCd <= 0) {
            foe.shootCd = foe.isBoss ? 55 : 130;
            rpgEnemyShots.push({
                x: foe.x + foe.size / 2, y: foe.y + foe.size / 2,
                vx: Math.cos(angle) * 3.2, vy: Math.sin(angle) * 3.2,
                dmg: Math.max(4, Math.round(foe.atk * 0.7))
            });
        }

        var drawCol = foe.hitFlash > 0 ? "#ffffff" : (foe.isBoss ? "#ff2244" : themeColor);
        if (foe.hitFlash > 0) foe.hitFlash--;
        if (typeof drawPixelSprite === "function") {
            drawPixelSprite(ctx, BOT_SPRITE, foe.x, foe.y, foe.size / 6, drawCol);
        } else {
            ctx.fillStyle = drawCol;
            ctx.fillRect(foe.x, foe.y, foe.size, foe.size);
        }

        // Health Bar
        ctx.fillStyle = "#330000";
        ctx.fillRect(foe.x, foe.y - 6, foe.size, 3);
        ctx.fillStyle = "#00ff44";
        ctx.fillRect(foe.x, foe.y - 6, foe.size * (Math.max(0, foe.hp) / foe.maxHp), 3);

        // Contact Damage
        if (rpgPlayer.invuln === 0 &&
            rpgPlayer.x < foe.x + foe.size && rpgPlayer.x + rpgPlayer.size > foe.x &&
            rpgPlayer.y < foe.y + foe.size && rpgPlayer.y + rpgPlayer.size > foe.y) {
            rpgState.hp -= foe.atk;
            rpgPlayer.invuln = 35;
            addFloatText(rpgPlayer.x, rpgPlayer.y - 6, "-" + foe.atk, "#ff3333");
            saveRPGLocal();
            if (rpgState.hp <= 0) {
                rpgState.hp = rpgState.maxHp;
                saveRPGLocal();
                setRPGLog("💀 SYSTEM CRASHED! Rebooting Chapter " + rpgState.ch + "...");
                initRPGChapter();
                break;
            }
        }
    }

    // Enemy Projectiles
    ctx.fillStyle = "#ff4444";
    for (var es = rpgEnemyShots.length - 1; es >= 0; es--) {
        var shot = rpgEnemyShots[es];
        shot.x += shot.vx; shot.y += shot.vy;
        ctx.fillRect(shot.x, shot.y, 5, 5);
        if (hitsWall(shot.x, shot.y, 5)) { rpgEnemyShots.splice(es, 1); continue; }
        if (rpgPlayer.invuln === 0 &&
            shot.x < rpgPlayer.x + rpgPlayer.size && shot.x + 5 > rpgPlayer.x &&
            shot.y < rpgPlayer.y + rpgPlayer.size && shot.y + 5 > rpgPlayer.y) {
            rpgEnemyShots.splice(es, 1);
            rpgState.hp -= shot.dmg;
            rpgPlayer.invuln = 28;
            addFloatText(rpgPlayer.x, rpgPlayer.y - 6, "-" + shot.dmg, "#ff3333");
            saveRPGLocal();
            if (rpgState.hp <= 0) {
                rpgState.hp = rpgState.maxHp;
                saveRPGLocal();
                setRPGLog("💀 SYSTEM CRASHED! Rebooting Chapter " + rpgState.ch + "...");
                initRPGChapter();
                break;
            }
        }
    }

    // Draw Player Hacker Sprite
    var pCol = (rpgPlayer.invuln % 6 > 2) ? "#ff4444" : "#00ff88";
    if (typeof drawPixelSprite === "function") {
        drawPixelSprite(ctx, HACKER_SPRITE, rpgPlayer.x, rpgPlayer.y, rpgPlayer.size / 6, pCol);
    } else {
        ctx.fillStyle = pCol;
        ctx.fillRect(rpgPlayer.x, rpgPlayer.y, rpgPlayer.size, rpgPlayer.size);
    }

    // Draw Melee Blade Slash
    if (rpgPlayer.atkTimer > 8) {
        ctx.fillStyle = "rgba(0, 255, 255, 0.75)";
        ctx.fillRect(rpgPlayer.x + rpgPlayer.dirX * 18, rpgPlayer.y + rpgPlayer.dirY * 18, rpgPlayer.size, rpgPlayer.size);
    }

    // Draw Particles & Floating Damage Numbers
    for (var p = rpgParticles.length - 1; p >= 0; p--) {
        var pt = rpgParticles[p];
        pt.x += pt.vx; pt.y += pt.vy; pt.life--;
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.life / 18;
        ctx.fillRect(pt.x, pt.y, 3, 3);
        if (pt.life <= 0) rpgParticles.splice(p, 1);
    }
    ctx.globalAlpha = 1;

    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    for (var ft = rpgFloatTexts.length - 1; ft >= 0; ft--) {
        var fl = rpgFloatTexts[ft];
        fl.y -= 0.7; fl.life--;
        ctx.fillStyle = fl.color;
        ctx.fillText(fl.text, fl.x, fl.y);
        if (fl.life <= 0) rpgFloatTexts.splice(ft, 1);
    }

    rpgAnimId = requestAnimationFrame(gameLoopCyberRPG);
}

function postRPGProgress() {
    var chIdx = (rpgState.ch - 1) % RPG_CHAPTERS.length;
    var ngText = rpgState.ngPlus > 0 ? " [NG+" + rpgState.ngPlus + "]" : "";
    var msgBox = document.getElementById("user-msg");
    msgBox.value = "💻 [Cyber-Breach RPG] Ch." + rpgState.ch + " (" + RPG_CHAPTERS[chIdx].name + ")" + ngText + " | Lvl " + rpgState.lvl + " | ₿" + rpgState.credits;
    submitRequestMessage();
}

function resetRPGSave() {
    if (!confirm("Reset your Cyber-Breach RPG save back to Chapter 1, Level 1?")) return;
    rpgState = Object.assign({}, defaultRPG);
    saveRPGToCloud(false);
    initRPGChapter();
}
