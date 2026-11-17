var cfRunning = false;
var cfAnimId = null;
var cfScore = 0;
var cfHigh = parseInt(localStorage.getItem("cf_high") || "0", 10);
var cfFrames = 0;
var cfBird = { x: 75, y: 110, vy: 0, r: 10 };
var cfPipes = [];
var cfParticles = [];

function toggleCyberFlap() {
    var cab = document.getElementById("flap-cabinet");
    if (!cab) return;
    cab.classList.toggle("hidden");
    updateFlapHud();
}

function updateFlapHud() {
    var sEl = document.getElementById("flap-score");
    var hEl = document.getElementById("flap-high");
    if (sEl) sEl.innerText = cfScore;
    if (hEl) hEl.innerText = cfHigh;
}

function setFlapStatus(msg, color) {
    var st = document.getElementById("flap-status");
    if (st) {
        st.innerText = msg;
        if (color) st.style.color = color;
    }
}

function flapBird() {
    if (!cfRunning) return;
    cfBird.vy = -4.6;
    for (var i = 0; i < 5; i++) {
        cfParticles.push({
            x: cfBird.x - 6,
            y: cfBird.y,
            vx: -1.5 - Math.random() * 2,
            vy: (Math.random() - 0.5) * 2.5,
            life: 14
        });
    }
}

function startCyberFlap() {
    cancelAnimationFrame(cfAnimId);
    cfScore = 0;
    cfFrames = 0;
    cfBird = { x: 75, y: 110, vy: -3.2, r: 10 };
    cfPipes = [];
    cfParticles = [];
    cfRunning = true;
    updateFlapHud();
    setFlapStatus("⚡ DODGE THE LASER GATES! [Space / Click]", "#00ff88");
    gameLoopCyberFlap();
}

document.addEventListener("keydown", function(e) {
    var cab = document.getElementById("flap-cabinet");
    if (!cab || cab.classList.contains("hidden")) return;
    if (e.code === "Space" || e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
        if (document.activeElement && document.activeElement.tagName === "INPUT") return;
        e.preventDefault();
        if (!cfRunning) startCyberFlap();
        else flapBird();
    }
});

window.addEventListener("load", function() {
    var canvas = document.getElementById("flap-canvas");
    if (canvas) {
        canvas.addEventListener("mousedown", function() {
            if (!cfRunning) startCyberFlap();
            else flapBird();
        });
    }
    updateFlapHud();
});
function gameLoopCyberFlap() {
    if (!cfRunning) return;
    var canvas = document.getElementById("flap-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    cfFrames++;

    // Background & Cyber Grid (Grid speeds up with score!)
    var speed = 2.6 + Math.min(2.8, cfScore * 0.08);
    ctx.fillStyle = "#040710";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = cfScore >= 15 ? "rgba(255, 20, 100, 0.12)" : "rgba(0, 240, 255, 0.08)";
    ctx.lineWidth = 1;
    var gridOffset = Math.floor(cfFrames * speed) % 30;
    for (var gx = -gridOffset; gx < canvas.width; gx += 30) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke();
    }

    // Bird Physics
    cfBird.vy += 0.25;
    cfBird.y += cfBird.vy;

    // Spawn Laser Gates (Faster spawns, tighter gaps, & moving gates after Score 5)
    var spawnEvery = Math.max(62, 100 - Math.floor(cfScore * 1.4));
    if (cfFrames % spawnEvery === 0) {
        var gapH = Math.max(58, 86 - Math.floor(cfScore * 0.9));
        var topH = 24 + Math.random() * (canvas.height - gapH - 48);
        var moveDir = (cfScore >= 5 && Math.random() < Math.min(0.75, cfScore * 0.04)) ? (Math.random() < 0.5 ? 1 : -1) : 0;
        var moveSpd = moveDir * (0.7 + Math.min(1.5, cfScore * 0.04));
        var hasBonus = (cfScore >= 3 && Math.random() < 0.35);
        cfPipes.push({ x: canvas.width, topH: topH, gapH: gapH, w: 34, scored: false, vy: moveSpd, bonus: hasBonus });
    }

    // Update & Draw Laser Gates
    for (var i = cfPipes.length - 1; i >= 0; i--) {
        var p = cfPipes[i];
        p.x -= speed;

        // Oscillate Moving Gates Vertically
        if (p.vy !== 0) {
            p.topH += p.vy;
            if (p.topH < 18 || p.topH + p.gapH > canvas.height - 18) p.vy *= -1;
        }

        // Neon Pink/Red Laser Pillars (Turn Electric Purple for Moving Gates)
        ctx.fillStyle = p.vy !== 0 ? "#b026ff" : "#ff1464";
        ctx.fillRect(p.x, 0, p.w, p.topH);
        ctx.fillRect(p.x, p.topH + p.gapH, p.w, canvas.height - (p.topH + p.gapH));

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x, 0, p.w, p.topH);
        ctx.strokeRect(p.x, p.topH + p.gapH, p.w, canvas.height - (p.topH + p.gapH));

        // Optional Gold Overclock Ring (+2 Bonus Points)
        if (p.bonus) {
            var bx = p.x + p.w / 2, by = p.topH + p.gapH / 2;
            ctx.strokeStyle = "#ffd700";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.stroke();

            if (Math.hypot(cfBird.x - bx, cfBird.y - by) < cfBird.r + 7) {
                p.bonus = false;
                cfScore += 2;
                setFlapStatus("⚡ OVERCLOCK BONUS! +2 PTS!", "#ffd700");
                updateFlapHud();
            }
        }

        // Score Point
        if (!p.scored && p.x + p.w < cfBird.x) {
            p.scored = true;
            cfScore++;
            if (cfScore > cfHigh) {
                cfHigh = cfScore;
                localStorage.setItem("cf_high", cfHigh.toString());
            }
            updateFlapHud();
        }

        // Collision Check
        if (cfBird.x + cfBird.r - 2 > p.x && cfBird.x - cfBird.r + 2 < p.x + p.w) {
            if (cfBird.y - cfBird.r + 2 < p.topH || cfBird.y + cfBird.r - 2 > p.topH + p.gapH) {
                endCyberFlap();
                return;
            }
        }
        if (p.x + p.w < 0) cfPipes.splice(i, 1);
    }

    // Thruster Particles & Bird
    for (var j = cfParticles.length - 1; j >= 0; j--) {
        var pt = cfParticles[j];
        pt.x += pt.vx; pt.y += pt.vy; pt.life--;
        ctx.fillStyle = "rgba(0, 240, 255, " + (pt.life / 14) + ")";
        ctx.fillRect(pt.x, pt.y, 4, 4);
        if (pt.life <= 0) cfParticles.splice(j, 1);
    }

    ctx.fillStyle = "#00f0ff";
    ctx.beginPath(); ctx.arc(cfBird.x, cfBird.y, cfBird.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(cfBird.x + 4, cfBird.y - 3, 7, 5);

    if (cfBird.y + cfBird.r >= canvas.height || cfBird.y - cfBird.r <= 0) {
        endCyberFlap();
        return;
    }
    cfAnimId = requestAnimationFrame(gameLoopCyberFlap);
}

function endCyberFlap() {
    cfRunning = false;
    cancelAnimationFrame(cfAnimId);
    setFlapStatus("💥 DRONE CRASHED! Final Score: " + cfScore + " (Press Space / Click to retry)", "#ff3355");
}

function postFlapScore() {
    var msgInput = document.getElementById("user-msg");
    if (!msgInput) return;
    msgInput.value = "🐦 [CYBER-FLAP] I flew through " + cfScore + " laser gates! (High Score: " + cfHigh + ")";
    if (typeof submitRequestMessage === "function") submitRequestMessage();
}
