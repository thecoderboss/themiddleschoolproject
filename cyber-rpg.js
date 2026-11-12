    // ================= CYBER-BREACH: 5-CHAPTER HACKER RPG =================
    var rpgRunning = false, rpgAnimId = null;
    var RPG_CHAPTERS = [
        { name: "Neon Alley", color: "#00ddff", enemy: "Script Kiddie", boss: "ICE-9 Gatekeeper", bossHp: 140, bossAtk: 14 },
        { name: "Corp Firewall", color: "#ff44aa", enemy: "Sentry Drone", boss: "Watchdog Cerberus", bossHp: 240, bossAtk: 22 },
        { name: "Crypto Vault", color: "#ffd700", enemy: "Cipher Guard", boss: "Cipher Warden", bossHp: 380, bossAtk: 32 },
        { name: "Darknet Site", color: "#b19cd9", enemy: "Trojan Stalker", boss: "Phantom Virus", bossHp: 550, bossAtk: 45 },
        { name: "Omega Core", color: "#ff3333", enemy: "System Hunter", boss: "Overlord A.I.", bossHp: 800, bossAtk: 60 }
    ];

    var defaultRPG = { ch: 1, lvl: 1, xp: 0, hp: 100, maxHp: 100, atk: 18, ngPlus: 0 };
    var rpgState = JSON.parse(localStorage.getItem("cyber_rpg_save") || "null") || Object.assign({}, defaultRPG);
    var rpgPlayer = { x: 40, y: 120, size: 16, speed: 3.5, dirX: 1, dirY: 0, atkTimer: 0, invuln: 0 };
    var rpgEnemies = [], rpgWalls = [], rpgNodes = [], rpgKeys = {}, rpgBossSpawned = false, rpgParticles = [];

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

    function saveRPG() {
        localStorage.setItem("cyber_rpg_save", JSON.stringify(rpgState));
        updateRPGHud();
    }

    function updateRPGHud() {
        var chIdx = (rpgState.ch - 1) % RPG_CHAPTERS.length;
        var prefix = rpgState.ngPlus > 0 ? "NG+" + rpgState.ngPlus + " " : "";
        document.getElementById("rpg-ch").innerText = rpgState.ch;
        document.getElementById("rpg-zone").innerText = prefix + RPG_CHAPTERS[chIdx].name;
        document.getElementById("rpg-lvl").innerText = rpgState.lvl;
        document.getElementById("rpg-hp").innerText = Math.max(0, Math.ceil(rpgState.hp)) + "/" + rpgState.maxHp;
        document.getElementById("rpg-atk").innerText = rpgState.atk;
    }

    function setRPGLog(msg) {
        var el = document.getElementById("rpg-log");
        if (el) el.innerText = msg;
    }

    function toggleCyberRPG() {
        var box = document.getElementById("rpg-cabinet");
        box.classList.toggle("hidden");
        if (!box.classList.contains("hidden") && !rpgRunning) {
            if (rpgState.hp <= 0) rpgState.hp = rpgState.maxHp;
            initRPGChapter();
            rpgRunning = true;
            cancelAnimationFrame(rpgAnimId);
            gameLoopCyberRPG();
        } else if (box.classList.contains("hidden")) {
            rpgRunning = false;
            cancelAnimationFrame(rpgAnimId);
        }
    }

    function initRPGChapter() {
        rpgPlayer.x = 36; rpgPlayer.y = 122;
        rpgBossSpawned = false;
        rpgEnemies = []; rpgNodes = []; rpgParticles = [];
        var chIdx = (rpgState.ch - 1) % RPG_CHAPTERS.length;
        var scale = 1 + (rpgState.ch - 1) * 0.45;

        // Generate Cyber Grid Obstacles
        rpgWalls = [
            { x: 110, y: 40, w: 24, h: 65 },
            { x: 110, y: 155, w: 24, h: 65 },
            { x: 220, y: 85, w: 24, h: 90 },
            { x: 315, y: 40, w: 24, h: 65 },
            { x: 315, y: 155, w: 24, h: 65 }
        ];

        // Spawn 5 Chapter Enemies
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
                x: spots[i].x, y: spots[i].y, size: 16,
                hp: Math.round(35 * scale), maxHp: Math.round(35 * scale),
                atk: Math.round(8 * scale),
                speed: 1.1 + (chIdx * 0.12),
                isBoss: false, hitFlash: 0
            });
        }


        // Spawn 2 Green Repair Nodes
        rpgNodes.push({ x: 170, y: 125, active: true });
        rpgNodes.push({ x: 375, y: 45, active: true });

        updateRPGHud();
        setRPGLog("CH." + rpgState.ch + " [" + RPG_CHAPTERS[chIdx].name + "]: Derez all 5 bots to summon the Boss!");
    }

    function spawnChapterBoss() {
        rpgBossSpawned = true;
        var chIdx = (rpgState.ch - 1) % RPG_CHAPTERS.length;
        var chData = RPG_CHAPTERS[chIdx];
        var ngMult = 1 + (rpgState.ngPlus * 0.8);
        rpgEnemies.push({
            name: chData.boss,
            x: 370, y: 112, size: 28,
            hp: Math.round(chData.bossHp * ngMult),
            maxHp: Math.round(chData.bossHp * ngMult),
            atk: Math.round(chData.bossAtk * ngMult),
            speed: 1.45,
            isBoss: true, hitFlash: 0
        });
        setRPGLog("⚠️ WARNING: BOSS [" + chData.boss + "] HAS ENTERED THE GRID!");
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
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 18, color: color
            });
        }
    }
    function gainRPGXP(amount) {
        rpgState.xp += amount;
        var xpNeeded = rpgState.lvl * 60;
        while (rpgState.xp >= xpNeeded) {
            rpgState.xp -= xpNeeded;
            rpgState.lvl++;
            rpgState.maxHp += 25;
            rpgState.hp = rpgState.maxHp;
            rpgState.atk += 6;
            xpNeeded = rpgState.lvl * 60;
            setRPGLog("⚡ LEVEL UP! You are now Level " + rpgState.lvl + " (Max HP & ATK boosted)!");
        }
        saveRPG();
    }

    function gameLoopCyberRPG() {
        if (!rpgRunning) return;
        var canvas = document.getElementById("rpg-canvas");
        var ctx = canvas.getContext("2d");
        var chIdx = (rpgState.ch - 1) % RPG_CHAPTERS.length;
        var themeColor = RPG_CHAPTERS[chIdx].color;

        // Background & Cyber Grid Lines
        ctx.fillStyle = "#05080f";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "rgba(0, 221, 255, 0.08)";
        ctx.lineWidth = 1;
        for (var gx = 0; gx < canvas.width; gx += 22) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke();
        }
        for (var gy = 0; gy < canvas.height; gy += 22) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke();
        }

        // Player Movement
        var dx = 0, dy = 0;
        if (rpgKeys["arrowleft"] || rpgKeys["a"]) { dx = -1; rpgPlayer.dirX = -1; rpgPlayer.dirY = 0; }
        if (rpgKeys["arrowright"] || rpgKeys["d"]) { dx = 1; rpgPlayer.dirX = 1; rpgPlayer.dirY = 0; }
        if (rpgKeys["arrowup"] || rpgKeys["w"]) { dy = -1; rpgPlayer.dirX = 0; rpgPlayer.dirY = -1; }
        if (rpgKeys["arrowdown"] || rpgKeys["s"]) { dy = 1; rpgPlayer.dirX = 0; rpgPlayer.dirY = 1; }

        if (dx !== 0 && !hitsWall(rpgPlayer.x + dx * rpgPlayer.speed, rpgPlayer.y, rpgPlayer.size)) {
            rpgPlayer.x += dx * rpgPlayer.speed;
        }
        if (dy !== 0 && !hitsWall(rpgPlayer.x, rpgPlayer.y + dy * rpgPlayer.speed, rpgPlayer.size)) {
            rpgPlayer.y += dy * rpgPlayer.speed;
        }

        // Cyber-Blade Slash Attack (Spacebar)
        if (rpgPlayer.atkTimer > 0) rpgPlayer.atkTimer--;
        if (rpgKeys[" "] && rpgPlayer.atkTimer === 0) {
            rpgPlayer.atkTimer = 14;
            var slashX = rpgPlayer.x + rpgPlayer.dirX * 18;
            var slashY = rpgPlayer.y + rpgPlayer.dirY * 18;

            for (var i = rpgEnemies.length - 1; i >= 0; i--) {
                var en = rpgEnemies[i];
                if (slashX < en.x + en.size + 8 && slashX + rpgPlayer.size + 8 > en.x &&
                    slashY < en.y + en.size + 8 && slashY + rpgPlayer.size + 8 > en.y) {
                    en.hp -= rpgState.atk;
                    en.hitFlash = 6;
                    addRPGParticles(en.x + en.size / 2, en.y + en.size / 2, themeColor);

                    if (en.hp <= 0) {
                        var wasBoss = en.isBoss;
                        var defeatedName = en.name;
                        rpgEnemies.splice(i, 1);

                        if (wasBoss) {
                            gainRPGXP(120 * rpgState.ch);
                            rpgState.ch++;
                            if ((rpgState.ch - 1) % RPG_CHAPTERS.length === 0) {
                                rpgState.ngPlus++;
                            }
                            saveRPG();
                            setRPGLog("🏆 BOSS [" + defeatedName + "] DEREZZED! Advancing to Chapter " + rpgState.ch + "...");
                            setTimeout(initRPGChapter, 1400);
                            break;
                        } else {
                            gainRPGXP(25 * rpgState.ch);
                            setRPGLog("Derez'd " + defeatedName + "! (+" + (25 * rpgState.ch) + " XP)");
                            if (rpgEnemies.length === 0 && !rpgBossSpawned) {
                                spawnChapterBoss();
                            }
                        }
                    }
                }
            }
        }

        // Draw Firewall Obstacles
        ctx.fillStyle = "#111c33";
        ctx.strokeStyle = themeColor;
        for (var w = 0; w < rpgWalls.length; w++) {
            var wl = rpgWalls[w];
            ctx.fillRect(wl.x, wl.y, wl.w, wl.h);
            ctx.strokeRect(wl.x, wl.y, wl.w, wl.h);
        }

        // Draw & Collect Green Repair Nodes
        for (var n = 0; n < rpgNodes.length; n++) {
            var nd = rpgNodes[n];
            if (!nd.active) continue;
            ctx.fillStyle = "#00ff44";
            ctx.fillRect(nd.x, nd.y, 12, 12);
            if (rpgPlayer.x < nd.x + 12 && rpgPlayer.x + rpgPlayer.size > nd.x &&
                rpgPlayer.y < nd.y + 12 && rpgPlayer.y + rpgPlayer.size > nd.y) {
                nd.active = false;
                rpgState.hp = Math.min(rpgState.maxHp, rpgState.hp + Math.round(rpgState.maxHp * 0.45));
                saveRPG();
                addRPGParticles(nd.x + 6, nd.y + 6, "#00ff44");
                setRPGLog("💚 Repair Node absorbed! HP restored to " + rpgState.hp + "/" + rpgState.maxHp);
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

            ctx.fillStyle = foe.hitFlash > 0 ? "#ffffff" : (foe.isBoss ? "#ff2244" : themeColor);
            if (foe.hitFlash > 0) foe.hitFlash--;
            ctx.fillRect(foe.x, foe.y, foe.size, foe.size);

            // Health bar above enemy
            ctx.fillStyle = "#330000";
            ctx.fillRect(foe.x, foe.y - 6, foe.size, 3);
            ctx.fillStyle = "#00ff44";
            ctx.fillRect(foe.x, foe.y - 6, foe.size * (Math.max(0, foe.hp) / foe.maxHp), 3);

            // Contact Damage to Player
            if (rpgPlayer.invuln === 0 &&
                rpgPlayer.x < foe.x + foe.size && rpgPlayer.x + rpgPlayer.size > foe.x &&
                rpgPlayer.y < foe.y + foe.size && rpgPlayer.y + rpgPlayer.size > foe.y) {
                rpgState.hp -= foe.atk;
                rpgPlayer.invuln = 35;
                addRPGParticles(rpgPlayer.x + 8, rpgPlayer.y + 8, "#ff3333");
                saveRPG();

                if (rpgState.hp <= 0) {
                    rpgState.hp = rpgState.maxHp;
                    saveRPG();
                    setRPGLog("💀 SYSTEM CRASHED! Rebooting Chapter " + rpgState.ch + "...");
                    initRPGChapter();
                    break;
                }
            }
        }

        // Draw Player Hacker Avatar
        ctx.fillStyle = (rpgPlayer.invuln % 6 > 2) ? "#ff4444" : "#00ff88";
        ctx.fillRect(rpgPlayer.x, rpgPlayer.y, rpgPlayer.size, rpgPlayer.size);

        // Draw Slash Effect
        if (rpgPlayer.atkTimer > 8) {
            ctx.fillStyle = "rgba(0, 255, 255, 0.75)";
            ctx.fillRect(rpgPlayer.x + rpgPlayer.dirX * 18, rpgPlayer.y + rpgPlayer.dirY * 18, rpgPlayer.size, rpgPlayer.size);
        }

        // Draw Particles
        for (var p = rpgParticles.length - 1; p >= 0; p--) {
            var pt = rpgParticles[p];
            pt.x += pt.vx; pt.y += pt.vy; pt.life--;
            ctx.fillStyle = pt.color;
            ctx.globalAlpha = pt.life / 18;
            ctx.fillRect(pt.x, pt.y, 3, 3);
            if (pt.life <= 0) rpgParticles.splice(p, 1);
        }
        ctx.globalAlpha = 1;

        rpgAnimId = requestAnimationFrame(gameLoopCyberRPG);
    }

    function postRPGProgress() {
        var chIdx = (rpgState.ch - 1) % RPG_CHAPTERS.length;
        var ngText = rpgState.ngPlus > 0 ? " [NG+" + rpgState.ngPlus + "]" : "";
        var msgBox = document.getElementById("user-msg");
        msgBox.value = "💻 [Cyber-Breach RPG] Ch." + rpgState.ch + " (" + RPG_CHAPTERS[chIdx].name + ")" + ngText + " | Lvl " + rpgState.lvl + " | ATK " + rpgState.atk;
        submitRequestMessage();
    }

    function resetRPGSave() {
        if (!confirm("Reset your Cyber-Breach RPG save back to Chapter 1, Level 1?")) return;
        rpgState = Object.assign({}, defaultRPG);
        saveRPG();
        initRPGChapter();
    }
