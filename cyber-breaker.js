// ================= HARD-MODE CYBER-BREAKER ARCADE =================
var cbRunning = false, cbAnimId = null;
var cbScore = 0, cbLvl = 1, cbLives = 3, cbHigh = parseInt(localStorage.getItem("cb_high") || "0");
var cbPaddle = { x: 185, y: 240, w: 70, h: 10, speed: 7, laserTimer: 0, invertTimer: 0, shrinkTimer: 0 };
var cbBalls = [], cbBricks = [], cbDrops = [], cbLasers = [], cbEnemyShots = [], cbParticles = [], cbKeys = {};
var cbLaserCooldown = 0, cbWallDir = 1, cbBoss = null;

var CB_COLORS = ["#ff44aa", "#00ddff", "#00ff88", "#b19cd9"];

document.addEventListener("keydown", function(e) {
    if (!cbRunning) return;
    if (["ArrowLeft", "ArrowRight", " "].includes(e.key) && document.activeElement.tagName !== "INPUT") {
        e.preventDefault();
    }
    cbKeys[e.key.toLowerCase()] = true;
});
document.addEventListener("keyup", function(e) {
    cbKeys[e.key.toLowerCase()] = false;
});

document.addEventListener("mousemove", function(e) {
    if (!cbRunning) return;
    var canvas = document.getElementById("breaker-canvas");
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    if (e.clientY >= rect.top - 40 && e.clientY <= rect.bottom + 40) {
        var relX = e.clientX - rect.left;
        if (cbPaddle.invertTimer > 0) relX = canvas.width - relX;
        cbPaddle.x = Math.max(4, Math.min(canvas.width - cbPaddle.w - 4, relX - cbPaddle.w / 2));
    }
});

function toggleCyberBreaker() {
    var box = document.getElementById("breaker-cabinet");
    box.classList.toggle("hidden");
    document.getElementById("cb-high").innerText = cbHigh;
    if (!box.classList.contains("hidden") && !cbRunning) {
        startCyberBreaker();
    } else if (box.classList.contains("hidden")) {
        cbRunning = false;
        cancelAnimationFrame(cbAnimId);
    }
}

function setBreakerStatus(msg, color) {
    var el = document.getElementById("cb-status");
    if (el) {
        el.innerText = msg;
        el.style.color = color || "#ff44aa";
    }
}

function updateBreakerHud() {
    document.getElementById("cb-score").innerText = cbScore;
    document.getElementById("cb-lvl").innerText = cbLvl;
    document.getElementById("cb-high").innerText = cbHigh;
    var hearts = "";
    for (var i = 0; i < cbLives; i++) hearts += "❤️";
    document.getElementById("cb-lives").innerText = hearts || "💀";
}

function spawnBreakerBall(x, y, dx, dy) {
    cbBalls.push({ x: x, y: y, r: 5, dx: dx, dy: dy });
}

function spawnBreakerParticles(x, y, color) {
    for (var i = 0; i < 12; i++) {
        cbParticles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 18, color: color
        });
    }
}

function buildBreakerLevel() {
    cbBricks = []; cbDrops = []; cbLasers = []; cbEnemyShots = []; cbBoss = null;
    var isBossLvl = (cbLvl % 3 === 0);

    if (isBossLvl) {
        cbBoss = {
            x: 170, y: 24, w: 100, h: 22,
            hp: 15 + cbLvl * 5, maxHp: 15 + cbLvl * 5,
            dir: 1, shootCd: 55
        };
        setBreakerStatus("⚠️ BOSS CORE LEVEL " + cbLvl + "! Dodge plasma shots & smash the Core!", "#ff3344");
    } else {
        setBreakerStatus("LEVEL " + cbLvl + ": Avoid RED [!] Skull hazards • Catch Cyan/Gold power-ups!", "#00ddff");
    }

    var rows = isBossLvl ? 3 : Math.min(6, 3 + cbLvl);
    var cols = 9;
    var brickW = 42, brickH = 13, pad = 5, offsetLeft = 11, offsetTop = isBossLvl ? 56 : 24;

    for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
            // Indestructible Steel Bumpers on Level 2+
            if (cbLvl >= 2 && r === rows - 1 && (c === 2 || c === 6)) {
                cbBricks.push({
                    x: offsetLeft + c * (brickW + pad),
                    y: offsetTop + r * (brickH + pad),
                    w: brickW, h: brickH, hp: 999, steel: true, color: "#667788"
                });
                continue;
            }
            // Gold 3-HP & Silver 2-HP Armored Bricks
            var hp = 1;
            var col = CB_COLORS[r % CB_COLORS.length];
            if (r === 0 && cbLvl >= 2) { hp = 3; col = "#ffd700"; }
            else if (r === 1 || (cbLvl >= 3 && (r + c) % 3 === 0)) { hp = 2; col = "#cfd8dc"; }

            cbBricks.push({
                x: offsetLeft + c * (brickW + pad),
                y: offsetTop + r * (brickH + pad),
                w: brickW, h: brickH, hp: hp, steel: false, color: col
            });
        }
    }
}

function startCyberBreaker() {
    cbScore = 0; cbLvl = 1; cbLives = 3;
    cbPaddle.w = 70; cbPaddle.x = 185;
    cbPaddle.laserTimer = 0; cbPaddle.invertTimer = 0; cbPaddle.shrinkTimer = 0;
    cbBalls = []; cbParticles = [];
    buildBreakerLevel();
    spawnBreakerBall(220, 222, 3.8, -4.2);
    updateBreakerHud();
    cbRunning = true;
    cbPausedByHelp = false;
    cancelAnimationFrame(cbAnimId);
    gameLoopCyberBreaker();
}
function spawnBreakerDrop(x, y) {
    if (Math.random() > 0.32) return;
    var roll = Math.random();
    var type = "multi", label = "M", color = "#00ddff";
    if (roll < 0.22) { type = "skull_invert"; label = "!"; color = "#ff2244"; }
    else if (roll < 0.40) { type = "skull_shrink"; label = "!"; color = "#ff2244"; }
    else if (roll < 0.65) { type = "multi"; label = "M", color = "#00ddff"; }
    else if (roll < 0.85) { type = "laser"; label = "L"; color = "#ffd700"; }
    else { type = "wide"; label = "W"; color = "#00ff88"; }

    cbDrops.push({ x: x, y: y, w: 18, h: 12, vy: 2.8, type: type, label: label, color: color });
}

function gameLoopCyberBreaker() {
    if (!cbRunning) return;
    var canvas = document.getElementById("breaker-canvas");
    var ctx = canvas.getContext("2d");

    ctx.fillStyle = "#06040d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (cbPaddle.laserTimer > 0) cbPaddle.laserTimer--;
    if (cbPaddle.invertTimer > 0) cbPaddle.invertTimer--;
    if (cbPaddle.shrinkTimer > 0) {
        cbPaddle.shrinkTimer--;
        if (cbPaddle.shrinkTimer === 0) cbPaddle.w = 70;
    }

    var moveDir = 0;
    if (cbKeys["arrowleft"] || cbKeys["a"]) moveDir -= 1;
    if (cbKeys["arrowright"] || cbKeys["d"]) moveDir += 1;
    if (cbPaddle.invertTimer > 0) moveDir *= -1;
    cbPaddle.x = Math.max(4, Math.min(canvas.width - cbPaddle.w - 4, cbPaddle.x + moveDir * cbPaddle.speed));

    if (cbLaserCooldown > 0) cbLaserCooldown--;
    if (cbKeys[" "] && cbPaddle.laserTimer > 0 && cbLaserCooldown === 0) {
        cbLasers.push({ x: cbPaddle.x + 6, y: cbPaddle.y - 8, w: 3, h: 10 });
        cbLasers.push({ x: cbPaddle.x + cbPaddle.w - 9, y: cbPaddle.y - 8, w: 3, h: 10 });
        cbLaserCooldown = 14;
    }

    ctx.fillStyle = cbPaddle.invertTimer > 0 ? "#ff2244" : (cbPaddle.laserTimer > 0 ? "#ffd700" : "#00ddff");
    ctx.fillRect(cbPaddle.x, cbPaddle.y, cbPaddle.w, cbPaddle.h);

    ctx.fillStyle = "#ffd700";
    for (var l = cbLasers.length - 1; l >= 0; l--) {
        var las = cbLasers[l];
        las.y -= 7.5;
        ctx.fillRect(las.x, las.y, las.w, las.h);
        if (las.y < 0) { cbLasers.splice(l, 1); continue; }

        if (cbBoss && las.x < cbBoss.x + cbBoss.w && las.x + las.w > cbBoss.x && las.y < cbBoss.y + cbBoss.h && las.y + las.h > cbBoss.y) {
            cbLasers.splice(l, 1);
            hitBreakerBoss(1);
            continue;
        }
        for (var b = cbBricks.length - 1; b >= 0; b--) {
            var br = cbBricks[b];
            if (las.x < br.x + br.w && las.x + las.w > br.x && las.y < br.y + br.h && las.y + las.h > br.y) {
                cbLasers.splice(l, 1);
                hitBreakerBrick(b);
                break;
            }
        }
    }

    if (cbBoss) {
        cbBoss.x += (1.8 + cbLvl * 0.25) * cbBoss.dir;
        if (cbBoss.x <= 10 || cbBoss.x + cbBoss.w >= canvas.width - 10) cbBoss.dir *= -1;
        cbBoss.shootCd--;
        if (cbBoss.shootCd <= 0) {
            cbBoss.shootCd = Math.max(28, 65 - cbLvl * 4);
            cbEnemyShots.push({ x: cbBoss.x + cbBoss.w / 2 - 3, y: cbBoss.y + cbBoss.h, w: 6, h: 10, vy: 3.8 });
        }
        ctx.fillStyle = "#ff2244";
        ctx.fillRect(cbBoss.x, cbBoss.y, cbBoss.w, cbBoss.h);
        ctx.fillStyle = "#330011";
        ctx.fillRect(cbBoss.x, cbBoss.y - 7, cbBoss.w, 4);
        ctx.fillStyle = "#00ff88";
        ctx.fillRect(cbBoss.x, cbBoss.y - 7, cbBoss.w * (cbBoss.hp / cbBoss.maxHp), 4);
    }

    ctx.fillStyle = "#ff3344";
    for (var es = cbEnemyShots.length - 1; es >= 0; es--) {
        var shot = cbEnemyShots[es];
        shot.y += shot.vy;
        ctx.fillRect(shot.x, shot.y, shot.w, shot.h);
        if (shot.x < cbPaddle.x + cbPaddle.w && shot.x + shot.w > cbPaddle.x && shot.y < cbPaddle.y + cbPaddle.h && shot.y + shot.h > cbPaddle.y) {
            cbEnemyShots.splice(es, 1);
            loseBreakerLife("💥 Hit by Boss Plasma!");
            if (!cbRunning) return;
            continue;
        }
        if (shot.y > canvas.height) cbEnemyShots.splice(es, 1);
    }

    var breakableLeft = 0, edgeHit = false;
    var slideSpd = cbLvl >= 2 ? (0.45 + cbLvl * 0.12) * cbWallDir : 0;
    for (var i = 0; i < cbBricks.length; i++) {
        var blk = cbBricks[i];
        if (!blk.steel) breakableLeft++;
        blk.x += slideSpd;
        if (blk.x <= 6 || blk.x + blk.w >= canvas.width - 6) edgeHit = true;

        ctx.fillStyle = blk.steel ? "#556677" : (blk.hp === 3 ? "#ffd700" : (blk.hp === 2 ? "#cfd8dc" : blk.color));
        ctx.fillRect(blk.x, blk.y, blk.w, blk.h);
        if (blk.steel) {
            ctx.strokeStyle = "#ffffff";
            ctx.strokeRect(blk.x, blk.y, blk.w, blk.h);
        }
    }
    if (edgeHit) cbWallDir *= -1;
    if (breakableLeft === 0 && !cbBoss) {
        cbLvl++;
        cbScore += 100;
        updateBreakerHud();
        buildBreakerLevel();
        cbBalls = [];
        spawnBreakerBall(cbPaddle.x + cbPaddle.w / 2, 220, 4.0 + cbLvl * 0.25, -(4.3 + cbLvl * 0.25));
    }

    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    for (var d = cbDrops.length - 1; d >= 0; d--) {
        var dr = cbDrops[d];
        dr.y += dr.vy;
        ctx.fillStyle = dr.color;
        ctx.fillRect(dr.x, dr.y, dr.w, dr.h);
        ctx.fillStyle = "#000";
        ctx.fillText(dr.label, dr.x + dr.w / 2, dr.y + 9);

        if (dr.x < cbPaddle.x + cbPaddle.w && dr.x + dr.w > cbPaddle.x && dr.y < cbPaddle.y + cbPaddle.h && dr.y + dr.h > cbPaddle.y) {
            if (dr.type === "multi" && cbBalls.length > 0) {
                var ref = cbBalls[0];
                spawnBreakerBall(ref.x, ref.y, -ref.dx, ref.dy);
                spawnBreakerBall(ref.x, ref.y, ref.dx * 0.8, -Math.abs(ref.dy));
                setBreakerStatus("⚡ MULTI-BALL ACTIVATED!", "#00ddff");
            } else if (dr.type === "laser") {
                cbPaddle.laserTimer = 420;
                setBreakerStatus("🔫 DUAL LASERS ONLINE! Press [Space] to fire!", "#ffd700");
            } else if (dr.type === "wide") {
                cbPaddle.w = Math.min(120, cbPaddle.w + 25);
                setBreakerStatus("🛡️ PADDLE EXPANDED!", "#00ff88");
            } else if (dr.type === "skull_invert") {
                cbPaddle.invertTimer = 300;
                setBreakerStatus("💀 CURSED! Controls INVERTED for 5 seconds!", "#ff2244");
            } else if (dr.type === "skull_shrink") {
                cbPaddle.w = 38;
                cbPaddle.shrinkTimer = 360;
                setBreakerStatus("💀 SHRUNK! Mini-paddle for 6 seconds!", "#ff2244");
            }
            cbDrops.splice(d, 1);
            continue;
        }
        if (dr.y > canvas.height) cbDrops.splice(d, 1);
    }

    ctx.fillStyle = "#ffffff";
    for (var bi = cbBalls.length - 1; bi >= 0; bi--) {
        var ball = cbBalls[bi];
        ball.x += ball.dx;
        ball.y += ball.dy;

        if (ball.x - ball.r <= 0 || ball.x + ball.r >= canvas.width) ball.dx *= -1;
        if (ball.y - ball.r <= 0) ball.dy *= -1;

        if (ball.dy > 0 && ball.y + ball.r >= cbPaddle.y && ball.y - ball.r <= cbPaddle.y + cbPaddle.h &&
            ball.x >= cbPaddle.x && ball.x <= cbPaddle.x + cbPaddle.w) {
            var hitOffset = (ball.x - (cbPaddle.x + cbPaddle.w / 2)) / (cbPaddle.w / 2);
            var speed = Math.min(8.5, Math.hypot(ball.dx, ball.dy) * 1.03);
            var angle = hitOffset * (Math.PI / 3);
            ball.dx = speed * Math.sin(angle);
            ball.dy = -Math.abs(speed * Math.cos(angle));
        }

        if (cbBoss && ball.x + ball.r > cbBoss.x && ball.x - ball.r < cbBoss.x + cbBoss.w &&
            ball.y + ball.r > cbBoss.y && ball.y - ball.r < cbBoss.y + cbBoss.h) {
            ball.dy *= -1;
            hitBreakerBoss(1);
        }

        for (var k = cbBricks.length - 1; k >= 0; k--) {
            var bk = cbBricks[k];
            if (ball.x + ball.r > bk.x && ball.x - ball.r < bk.x + bk.w &&
                ball.y + ball.r > bk.y && ball.y - ball.r < bk.y + bk.h) {
                ball.dy *= -1;
                hitBreakerBrick(k);
                break;
            }
        }

        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();

        if (ball.y - ball.r > canvas.height) cbBalls.splice(bi, 1);
    }

    if (cbBalls.length === 0) {
        loseBreakerLife("💀 Ball lost!");
        if (!cbRunning) return;
        spawnBreakerBall(cbPaddle.x + cbPaddle.w / 2, 220, 3.8, -4.2);
    }

    for (var p = cbParticles.length - 1; p >= 0; p--) {
        var pt = cbParticles[p];
        pt.x += pt.vx; pt.y += pt.vy; pt.life--;
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.life / 18;
        ctx.fillRect(pt.x, pt.y, 3, 3);
        if (pt.life <= 0) cbParticles.splice(p, 1);
    }
    ctx.globalAlpha = 1;

    cbAnimId = requestAnimationFrame(gameLoopCyberBreaker);
}
function hitBreakerBrick(idx) {
    var bk = cbBricks[idx];
    if (bk.steel) {
        spawnBreakerParticles(bk.x + bk.w / 2, bk.y + bk.h / 2, "#ffffff");
        return;
    }
    bk.hp--;
    cbScore += 15;
    if (cbScore > cbHigh) { cbHigh = cbScore; localStorage.setItem("cb_high", cbHigh); }
    spawnBreakerParticles(bk.x + bk.w / 2, bk.y + bk.h / 2, bk.color);
    if (bk.hp <= 0) {
        spawnBreakerDrop(bk.x + bk.w / 2 - 9, bk.y);
        cbBricks.splice(idx, 1);
    }
    updateBreakerHud();
}

function hitBreakerBoss(dmg) {
    if (!cbBoss) return;
    cbBoss.hp -= dmg;
    cbScore += 25;
    if (cbScore > cbHigh) { cbHigh = cbScore; localStorage.setItem("cb_high", cbHigh); }
    spawnBreakerParticles(cbBoss.x + cbBoss.w / 2, cbBoss.y + cbBoss.h / 2, "#ff2244");
    if (cbBoss.hp <= 0) {
        cbScore += 250;
        cbBoss = null;
        setBreakerStatus("🏆 BOSS CORE DESTROYED! (+250 PTS)", "#00ff88");
    }
    updateBreakerHud();
}

function loseBreakerLife(reason) {
    cbLives--;
    cbPaddle.w = 70; cbPaddle.invertTimer = 0; cbPaddle.shrinkTimer = 0;
    updateBreakerHud();
    setBreakerStatus(reason, "#ff3344");
    if (cbLives <= 0) {
        cbRunning = false;
        var canvas = document.getElementById("breaker-canvas");
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ff44aa";
        ctx.font = "bold 22px monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER! SCORE: " + cbScore, canvas.width / 2, canvas.height / 2);
    }
}

function postBreakerScore() {
    var msgBox = document.getElementById("user-msg");
    msgBox.value = "🧱 [Cyber-Breaker HARD] Score: " + cbScore + " (Lvl " + cbLvl + " | High: " + cbHigh + ")";
    submitRequestMessage();
}

var cbPausedByHelp = false;

function toggleBreakerHelp() {
    var helpBox = document.getElementById("breaker-help");
    if (!helpBox) return;

    var opening = helpBox.classList.contains("hidden");
    helpBox.classList.toggle("hidden");

    if (opening && cbRunning) {
        cbRunning = false;
        cbPausedByHelp = true;
        cancelAnimationFrame(cbAnimId);
        setBreakerStatus("⏸️ PAUSED (Close Rules to resume)", "#ffd700");
    } else if (!opening && cbPausedByHelp && cbLives > 0) {
        cbPausedByHelp = false;
        cbRunning = true;
        setBreakerStatus("▶ RESUMED!", "#00ff88");
        gameLoopCyberBreaker();
    }
}
