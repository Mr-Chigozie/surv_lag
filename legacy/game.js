(() => {
  const canvas = document.querySelector("#game-canvas");
  const ctx = canvas.getContext("2d");
  const startScreen = document.querySelector("#start-screen");
  const endScreen = document.querySelector("#end-screen");
  const pauseScreen = document.querySelector("#pause-screen");
  const hud = document.querySelector("#game-hud");
  const distanceDisplay = document.querySelector("#distance");
  const speedDisplay = document.querySelector("#speed");
  const progressBar = document.querySelector("#progress-bar");
  const mobileControls = document.querySelector("#mobile-controls");

  const vehicleSpecs = {
    car: { label: "Salon car", color: "#e7c44b", width: 46, height: 78, speed: 245, handling: 1, durability: 1 },
    bike: { label: "Okada", color: "#f0783f", width: 30, height: 66, speed: 270, handling: 1.24, durability: 0 },
    bus: { label: "Danfo", color: "#e3ae27", width: 54, height: 90, speed: 215, handling: 0.79, durability: 2 }
  };
  const keys = new Set();
  const hazards = [];
  const roadside = [];
  const targetDistance = 2000;
  let selectedVehicle = "car";
  let player = null;
  let distance = 0;
  let speed = 0;
  let roadOffset = 0;
  let spawnTimer = 0;
  let elapsed = 0;
  let state = "ready";
  let lastFrame = 0;
  let soundEnabled = true;
  let audioContext = null;
  let animationId = 0;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(0);
  }

  function roadGeometry(width, height) {
    const horizon = height * 0.37;
    const roadTop = width * 0.22;
    const roadBottom = Math.min(width * 0.91, height * 1.26);
    return { horizon, roadTop, roadBottom, center: width / 2 };
  }

  function roadEdgesAt(progress, geometry) {
    const half = geometry.roadTop / 2 + (geometry.roadBottom / 2 - geometry.roadTop / 2) * progress;
    const bend = Math.sin(distance * 0.0007 + progress * 2.4) * progress * 18;
    return [geometry.center - half + bend, geometry.center + half + bend];
  }

  function drawBuilding(x, y, w, h, color, windows = true) {
    ctx.fillStyle = "#344238";
    ctx.fillRect(x - 2, y + h - 2, w + 4, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(28, 47, 42, .24)";
    ctx.fillRect(x, y, w, 5);
    if (windows) {
      const cols = Math.max(2, Math.floor(w / 13));
      const rows = Math.max(1, Math.floor(h / 15));
      const cellW = (w - 8) / cols;
      const cellH = (h - 8) / rows;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          ctx.fillStyle = (row + col) % 4 === 0 ? "#ddc88c" : "#516c63";
          ctx.fillRect(x + 4 + col * cellW, y + 5 + row * cellH, Math.max(2, cellW * 0.43), Math.max(2, cellH * 0.42));
        }
      }
    }
  }

  function drawPalm(x, y, scale) {
    const trunk = 22 * scale;
    ctx.strokeStyle = "#71563d";
    ctx.lineWidth = Math.max(2, 4 * scale);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 4 * scale, y - 10 * scale, x - 1 * scale, y - trunk);
    ctx.stroke();
    const crownY = y - trunk;
    ctx.strokeStyle = "#416b42";
    ctx.lineWidth = Math.max(2, 3 * scale);
    for (let i = 0; i < 7; i++) {
      const angle = -Math.PI + (Math.PI * i) / 6;
      ctx.beginPath();
      ctx.moveTo(x - scale, crownY);
      ctx.quadraticCurveTo(x + Math.cos(angle) * 10 * scale, crownY + Math.sin(angle) * 9 * scale, x + Math.cos(angle) * 20 * scale, crownY + Math.sin(angle) * 16 * scale + 4 * scale);
      ctx.stroke();
    }
  }

  function drawBackground(width, height, geometry, dt) {
    const sky = ctx.createLinearGradient(0, 0, 0, geometry.horizon + 60);
    sky.addColorStop(0, "#a9cbb5");
    sky.addColorStop(1, "#e0d4a9");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#e9c983";
    ctx.beginPath();
    ctx.arc(width * 0.77, geometry.horizon * 0.44, Math.min(37, width * 0.07), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#7b9b79";
    ctx.fillRect(0, geometry.horizon - 10, width, height - geometry.horizon + 10);
    for (let i = 0; i < 12; i++) {
      const x = (i / 11) * width;
      const h = 22 + Math.abs(Math.sin(i * 42)) * 65;
      drawBuilding(x - 23, geometry.horizon - h, 22 + (i % 3) * 8, h, ["#a27659", "#b88a67", "#8c7661", "#bd9971"][i % 4], i % 3 !== 0);
    }

    const movement = state === "playing" ? speed * dt * 0.46 : 0;
    for (const object of roadside) object.progress += movement / 260;
    for (let i = roadside.length - 1; i >= 0; i--) {
      const object = roadside[i];
      if (object.progress > 1.2) roadside.splice(i, 1);
    }
    if (roadside.length < 20 && state === "playing" && Math.random() < dt * 2.5) {
      roadside.push({ side: Math.random() < 0.5 ? -1 : 1, progress: 0, type: Math.random() < 0.35 ? "palm" : "sign", seed: Math.random() });
    }

    roadside.forEach((object) => {
      const p = object.progress;
      const [left, right] = roadEdgesAt(p, geometry);
      const x = object.side < 0 ? left - 12 - p * 48 : right + 12 + p * 48;
      const y = geometry.horizon + p * (height - geometry.horizon);
      const scale = 0.25 + p * 1.05;
      if (object.type === "palm") {
        drawPalm(x, y, scale);
      } else {
        ctx.fillStyle = "#3e4938";
        ctx.fillRect(x - 2 * scale, y - 17 * scale, 4 * scale, 20 * scale);
        ctx.fillStyle = object.seed > 0.5 ? "#e6b943" : "#bc6049";
        ctx.fillRect(x - 20 * scale, y - 25 * scale, 40 * scale, 13 * scale);
        ctx.fillStyle = "#282b21";
        ctx.font = `bold ${Math.max(3, 5 * scale)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(object.seed > 0.5 ? "LAGOS" : "YABA", x, y - 16 * scale);
      }
    });
  }

  function drawRoad(width, height, geometry, dt) {
    const shoulder = ctx.createLinearGradient(0, geometry.horizon, 0, height);
    shoulder.addColorStop(0, "#81946a");
    shoulder.addColorStop(1, "#c6a579");
    ctx.fillStyle = shoulder;
    ctx.fillRect(0, geometry.horizon, width, height - geometry.horizon);

    const segments = 36;
    const motion = state === "playing" ? speed * dt * 0.5 : 0;
    roadOffset = (roadOffset + motion) % 1;
    for (let i = 0; i < segments; i++) {
      const p1 = i / segments;
      const p2 = (i + 1) / segments;
      const [left1, right1] = roadEdgesAt(p1, geometry);
      const [left2, right2] = roadEdgesAt(p2, geometry);
      const y1 = geometry.horizon + p1 * (height - geometry.horizon);
      const y2 = geometry.horizon + p2 * (height - geometry.horizon);
      ctx.fillStyle = i % 2 === 0 ? "#555850" : "#595b52";
      ctx.beginPath();
      ctx.moveTo(left1, y1);
      ctx.lineTo(right1, y1);
      ctx.lineTo(right2, y2);
      ctx.lineTo(left2, y2);
      ctx.closePath();
      ctx.fill();

      const stripe1 = ((i / segments + roadOffset) * 15) % 1;
      if (stripe1 < 0.5) {
        for (let lane = 1; lane <= 2; lane++) {
          const x1 = left1 + ((right1 - left1) * lane) / 3;
          const x2 = left2 + ((right2 - left2) * lane) / 3;
          const dash = 1.5 + p1 * 7;
          ctx.strokeStyle = "rgba(239, 230, 188, .68)";
          ctx.lineWidth = 0.5 + p1 * 2;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, Math.min(y2, y1 + dash));
          ctx.stroke();
        }
      }
      ctx.fillStyle = i % 2 === Math.floor(roadOffset * 15) % 2 ? "#e5d6aa" : "#a94536";
      ctx.beginPath();
      ctx.moveTo(left1 - 4 * p1, y1);
      ctx.lineTo(left1, y1);
      ctx.lineTo(left2, y2);
      ctx.lineTo(left2 - 4 * p2, y2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(right1, y1);
      ctx.lineTo(right1 + 4 * p1, y1);
      ctx.lineTo(right2 + 4 * p2, y2);
      ctx.lineTo(right2, y2);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawVehicle(x, y, width, height, color, type, isPlayer = false) {
    ctx.save();
    ctx.translate(x, y);
    if (type === "bike") {
      ctx.strokeStyle = "#202421";
      ctx.lineWidth = width * 0.24;
      ctx.beginPath();
      ctx.ellipse(0, 0, width * 0.31, height * 0.16, 0, 0, Math.PI * 2);
      ctx.ellipse(0, -height * 0.54, width * 0.32, height * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-width * 0.31, -height * 0.14);
      ctx.lineTo(-width * 0.16, -height * 0.49);
      ctx.lineTo(width * 0.27, -height * 0.44);
      ctx.lineTo(width * 0.32, -height * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = isPlayer ? "#d4d7ba" : "#312d25";
      ctx.beginPath();
      ctx.arc(0, -height * 0.65, width * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const w = width;
      const h = height;
      ctx.fillStyle = "rgba(0,0,0,.24)";
      ctx.beginPath();
      ctx.ellipse(2, -h * 0.46, w * 0.68, h * 0.54, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#222723";
      ctx.fillRect(-w * 0.55, -h * 0.78, w * 0.17, h * 0.25);
      ctx.fillRect(w * 0.38, -h * 0.78, w * 0.17, h * 0.25);
      ctx.fillRect(-w * 0.55, -h * 0.28, w * 0.17, h * 0.23);
      ctx.fillRect(w * 0.38, -h * 0.28, w * 0.17, h * 0.23);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-w * 0.42, 0);
      ctx.lineTo(-w * 0.48, -h * 0.72);
      ctx.quadraticCurveTo(-w * 0.46, -h * 0.94, -w * 0.23, -h);
      ctx.lineTo(w * 0.23, -h);
      ctx.quadraticCurveTo(w * 0.46, -h * 0.94, w * 0.48, -h * 0.72);
      ctx.lineTo(w * 0.42, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#55716b";
      ctx.beginPath();
      ctx.moveTo(-w * 0.31, -h * 0.72);
      ctx.quadraticCurveTo(-w * 0.29, -h * 0.86, -w * 0.16, -h * 0.87);
      ctx.lineTo(w * 0.16, -h * 0.87);
      ctx.quadraticCurveTo(w * 0.29, -h * 0.86, w * 0.31, -h * 0.72);
      ctx.lineTo(w * 0.27, -h * 0.52);
      ctx.lineTo(-w * 0.27, -h * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f4d378";
      ctx.fillRect(-w * 0.36, -h * 0.18, w * 0.17, h * 0.07);
      ctx.fillRect(w * 0.19, -h * 0.18, w * 0.17, h * 0.07);
      ctx.fillStyle = "rgba(35,32,25,.75)";
      ctx.font = `bold ${Math.max(5, w * 0.18)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(type === "bus" ? "LAGOS" : isPlayer ? "LTS" : "NG", 0, -h * 0.37);
    }
    ctx.restore();
  }

  function drawPothole(x, y, scale) {
    ctx.fillStyle = "rgba(31,35,30,.8)";
    ctx.beginPath();
    ctx.ellipse(x, y, 7 * scale, 3 * scale, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(203,190,157,.35)";
    ctx.lineWidth = Math.max(0.5, scale);
    ctx.beginPath();
    ctx.ellipse(x, y - scale, 7 * scale, 3 * scale, -0.1, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawHazards(width, height, geometry, dt) {
    if (state === "playing") {
      hazards.forEach((hazard) => { hazard.progress += dt * (0.2 + speed / 540); });
    }
    hazards.sort((a, b) => a.progress - b.progress);
    hazards.forEach((hazard) => {
      const p = Math.min(hazard.progress, 1);
      const [left, right] = roadEdgesAt(p, geometry);
      const laneWidth = (right - left) / 3;
      const x = left + laneWidth * (hazard.lane + 0.5);
      const y = geometry.horizon + p * (height - geometry.horizon);
      const scale = 0.24 + p * 1.08;
      if (hazard.type === "pothole") {
        drawPothole(x, y, scale);
      } else {
        drawVehicle(x, y, (hazard.type === "bus" ? 47 : hazard.type === "bike" ? 24 : 38) * scale, (hazard.type === "bus" ? 75 : hazard.type === "bike" ? 52 : 65) * scale, hazard.color, hazard.type);
      }
    });
  }

  function drawScene(dt) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const geometry = roadGeometry(width, height);
    drawBackground(width, height, geometry, dt);
    drawRoad(width, height, geometry, dt);
    drawHazards(width, height, geometry, dt);
    if (player) {
      const spec = vehicleSpecs[selectedVehicle];
      const [left, right] = roadEdgesAt(1, geometry);
      const laneWidth = (right - left) / 3;
      const x = left + laneWidth * (player.lane + 0.5);
      drawVehicle(x, height * 0.91, spec.width * Math.min(1, width / 600), spec.height * Math.min(1, width / 600), spec.color, selectedVehicle, true);
    } else {
      const [left, right] = roadEdgesAt(1, geometry);
      drawVehicle(width / 2, height * 0.91, 46, 78, vehicleSpecs[selectedVehicle].color, selectedVehicle, true);
    }
  }

  function spawnHazard() {
    const lane = Math.floor(Math.random() * 3);
    const roll = Math.random();
    let type = roll < 0.43 ? "car" : roll < 0.68 ? "bus" : roll < 0.87 ? "bike" : "pothole";
    if (hazards.some((hazard) => hazard.lane === lane && hazard.progress < 0.23)) return;
    hazards.push({
      lane,
      progress: 0,
      type,
      color: type === "bus" ? (Math.random() < 0.5 ? "#d8aa2c" : "#4a986a") : ["#d45b43", "#5690a0", "#b6a281", "#555861"][Math.floor(Math.random() * 4)]
    });
  }

  function playTone(frequency, duration = 0.12, type = "sine") {
    if (!soundEnabled) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.07, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn("Audio could not be started.", error);
    }
  }

  function startGame() {
    const spec = vehicleSpecs[selectedVehicle];
    hazards.length = 0;
    roadside.length = 0;
    distance = 0;
    speed = spec.speed * 0.72;
    spawnTimer = 0.7;
    elapsed = 0;
    player = { lane: 1, durability: spec.durability };
    state = "playing";
    startScreen.classList.add("hidden");
    endScreen.classList.add("hidden");
    endScreen.classList.remove("flex");
    hud.classList.remove("hidden");
    hud.classList.add("flex");
    mobileControls.classList.remove("hidden");
    mobileControls.classList.add("flex");
    lastFrame = performance.now();
    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(loop);
    playTone(440, 0.14);
  }

  function endGame(won) {
    state = "ended";
    document.querySelector("#end-icon").textContent = won ? "🏁" : "💥";
    document.querySelector("#end-kicker").textContent = won ? "VICTORIA ISLAND REACHED" : "JOURNEY ENDED";
    document.querySelector("#end-title").textContent = won ? "You made it." : "Traffic got you.";
    document.querySelector("#end-description").textContent = won ? "Lagos tried. Lagos failed. You're officially a road legend." : "Every Lagos legend has a close call. Give it another go.";
    document.querySelector("#final-distance").textContent = Math.floor(distance).toLocaleString();
    endScreen.classList.remove("hidden");
    endScreen.classList.add("flex");
    hud.classList.add("hidden");
    mobileControls.classList.add("hidden");
    if (won) playTone(660, 0.35, "triangle");
    else playTone(150, 0.35, "sawtooth");
  }

  function movePlayer(direction) {
    if (state !== "playing") return;
    player.lane = Math.max(0, Math.min(2, player.lane + direction));
    playTone(direction < 0 ? 300 : 360, 0.055);
  }

  function update(dt) {
    if (state !== "playing") return;
    const spec = vehicleSpecs[selectedVehicle];
    elapsed += dt;
    distance += speed * dt * 0.23;
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnHazard();
      spawnTimer = Math.max(0.52, 1.12 - elapsed * 0.008) + Math.random() * 0.42;
    }

    if (keys.has("ArrowLeft") || keys.has("a")) {
      if (!update.leftHeld) movePlayer(-1);
      update.leftHeld = true;
    } else update.leftHeld = false;
    if (keys.has("ArrowRight") || keys.has("d")) {
      if (!update.rightHeld) movePlayer(1);
      update.rightHeld = true;
    } else update.rightHeld = false;

    speed = Math.min(spec.speed, speed + dt * 10);
    distanceDisplay.textContent = Math.floor(distance).toLocaleString();
    speedDisplay.textContent = Math.round(speed / 3.6).toString();
    progressBar.style.width = `${Math.min(100, (distance / targetDistance) * 100)}%`;

    for (let index = hazards.length - 1; index >= 0; index--) {
      const hazard = hazards[index];
      if (hazard.progress >= 0.89 && hazard.progress <= 0.89 + dt * 1.5 && hazard.lane === player.lane && hazard.type !== "pothole") {
        if (selectedVehicle === "bus" && player.durability > 0) {
          player.durability--;
          hazards.splice(index, 1);
          speed *= 0.77;
          playTone(100, 0.18, "square");
          continue;
        }
        endGame(false);
        return;
      }
      if (hazard.type === "pothole" && hazard.progress >= 0.89 && hazard.progress <= 0.89 + dt * 1.5 && hazard.lane === player.lane) {
        if (selectedVehicle === "bike") {
          endGame(false);
          return;
        }
        speed *= 0.78;
        playTone(95, 0.16, "square");
        hazards.splice(index, 1);
        continue;
      }
      if (hazard.progress > 1.08) hazards.splice(index, 1);
    }
    if (distance >= targetDistance) {
      distance = targetDistance;
      endGame(true);
    }
  }

  function loop(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.04);
    lastFrame = now;
    update(dt);
    drawScene(dt);
    if (state === "playing") animationId = requestAnimationFrame(loop);
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    document.querySelector("#pause-button").textContent = "▶";
    pauseScreen.classList.remove("hidden");
    pauseScreen.classList.add("flex");
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "playing";
    document.querySelector("#pause-button").textContent = "Ⅱ";
    pauseScreen.classList.add("hidden");
    pauseScreen.classList.remove("flex");
    lastFrame = performance.now();
    animationId = requestAnimationFrame(loop);
  }

  document.querySelectorAll("[data-vehicle]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedVehicle = button.dataset.vehicle;
      document.querySelectorAll("[data-vehicle]").forEach((card) => card.classList.toggle("selected", card === button));
      resizeCanvas();
    });
  });

  document.querySelector("#start-button").addEventListener("click", startGame);
  document.querySelector("#retry-button").addEventListener("click", startGame);
  document.querySelector("#pause-button").addEventListener("click", pauseGame);
  document.querySelector("#resume-button").addEventListener("click", resumeGame);

  document.querySelector("#sound-button").addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    document.querySelector("#sound-label").textContent = soundEnabled ? "SOUND ON" : "SOUND OFF";
    if (soundEnabled) playTone(440, 0.08);
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (["ArrowLeft", "ArrowRight", " "].includes(key)) event.preventDefault();
    if (key === "Escape" && (state === "playing" || state === "paused")) {
      if (state === "playing") pauseGame();
      else resumeGame();
      return;
    }
    keys.add(key);
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));

  function bindTouch(button, direction) {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      movePlayer(direction);
    });
  }
  bindTouch(document.querySelector("#left-button"), -1);
  bindTouch(document.querySelector("#right-button"), 1);
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
})();
