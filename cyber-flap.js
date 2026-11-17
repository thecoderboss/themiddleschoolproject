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

    // Background & Cyber Grid
    ctx.fillStyle = "#040710";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
    ctx.lineWidth = 1;
    var gridOffset = (cfFrames * 2) % 30;
    for (var gx = -gridOffset; gx < canvas.width; gx += 30) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke();
    }

    // Bird Physics
    cfBird.vy += 0.24;
    cfBird.y += cfBird.vy;

    // Spawn Laser Gates (Gap tightens slightly as score climbs)
    var spawnEvery = Math.max(78, 105 - Math.floor(cfScore / 4) * 2);
    if (cfFrames % spawnEvery === 0) {
        var gapH = Math.max(66, 86 - Math.floor(cfScore / 5) * 2);
        var topH = 26 + Math.random() * (canvas.height - gapH - 52);
        cfPipes.push({ x: canvas.width, topH: topH, gapH: gapH, w: 34, scored: false });
    }

    // Update & Draw Laser Gates
    var speed = 2.4 + Math.min(1.6, cfScore * 0.05);
    for (var i = cfPipes.length - 1; i >= 0; i--) {
        var p = cfPipes[i];
        p.x -= speed;

        // Neon Pink/Red Laser Pillars
        ctx.fillStyle = "#ff1464";
        ctx.fillRect(p.x, 0, p.w, p.topH);
        ctx.fillRect(p.x, p.topH + p.gapH, p.w, canvas.height - (p.topH + p.gapH));

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x, 0, p.w, p.topH);
        ctx.strokeRect(p.x, p.topH + p.gapH, p.w, canvas.height - (p.topH + p.gapH));

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

    // Thruster Particles
    for (var j = cfParticles.length - 1; j >= 0; j--) {
        var pt = cfParticles[j];
        pt.x += pt.vx; pt.y += pt.vy; pt.life--;
        ctx.fillStyle = "rgba(0, 240, 255, " + (pt.life / 14) + ")";
        ctx.fillRect(pt.x, pt.y, 4, 4);
        if (pt.life <= 0) cfParticles.splice(j, 1);
    }

    // Draw Cyber-Drone Bird
    ctx.fillStyle = "#00f0ff";
    ctx.beginPath();
    ctx.arc(cfBird.x, cfBird.y, cfBird.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(cfBird.x + 4, cfBird.y - 3, 7, 5);

    // Ceiling / Floor Crash Check
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
