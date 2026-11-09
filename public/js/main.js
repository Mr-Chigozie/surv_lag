import * as THREE from "three";
import { MAPS, VEHICLES, DRIVERS } from "./maps.js";
import { Track, makeRng } from "./track.js";
import { buildWorld } from "./world.js";
import { Course } from "./course.js";
import { Traffic } from "./traffic.js";
import { buildVehicle } from "./models.js";
import { GameAudio } from "./audio.js";
import { loadCareer, saveCareer, applyUpgrades, paintColor, upgradeCost, level, spend, PRICES, UPGRADES, PAINTS, REPAIR_COST, BASE_CAPACITY } from "./career.js";
import { Jobs, naira } from "./jobs.js";
import { driverPortrait } from "./portraits.js";
import { Online, RemoteCars } from "./online.js";
import { apiUrl, STATIC_HOST } from "./config.js";

// ---------------------------------------------------------------- DOM
const $ = (id) => document.getElementById(id);
const ui = {
  canvas: $("scene"), menu: $("menu"), loading: $("loading"), loadingName: $("loading-name"), hud: $("hud"),
  vehicleCards: $("vehicle-cards"), mapCards: $("map-cards"), start: $("start-button"),
  quality: $("menu-quality"), sound: $("menu-sound"), boardTitle: $("board-title"), boardList: $("board-list"), personalBest: $("personal-best"),
  route: $("hud-route"), distance: $("hud-distance"), length: $("hud-length"), progress: $("hud-progress"), progressTrack: $("hud-progress-track"),
  score: $("hud-score"), combo: $("hud-combo"), time: $("hud-time"), speed: $("hud-speed"), vehicle: $("hud-vehicle"),
  health: $("hud-health"), healthText: $("hud-health-text"), near: $("hud-near"),
  warning: $("hud-warning"), popups: $("popups"), countdown: $("countdown"), minimap: $("minimap"), vignette: $("damage-vignette"),
  camera: $("hud-camera"), pauseBtn: $("hud-pause"), pause: $("pause"), resume: $("resume-button"), restart: $("restart-button"), quit: $("quit-button"),
  end: $("end"), endStars: $("end-stars"), endKicker: $("end-kicker"), endTitle: $("end-title"), endDesc: $("end-desc"),
  endTime: $("end-time"), endDistance: $("end-distance"), endHealth: $("end-health"), endNear: $("end-near"), endHits: $("end-hits"),
  endScore: $("end-score"), endBreakdown: $("end-breakdown"), submitForm: $("submit-form"), playerName: $("player-name"), submitStatus: $("submit-status"),
  retry: $("retry-button"), menuBtn: $("menu-button"), touch: $("touch-controls"),
  driverCards: $("driver-cards"), coins: $("hud-coins"), endCoins: $("end-coins"),
  wallet: $("menu-wallet"), garageBtn: $("garage-button"), garage: $("garage"), garageClose: $("garage-close"), garageTabs: $("garage-tabs"), garageBody: $("garage-body"), garageWallet: $("garage-wallet"),
  avatarBtn: $("avatar-button"), avatarImg: $("avatar-img"), avatarInitials: $("avatar-initials"), avatarFile: $("avatar-file"), avatarRemove: $("avatar-remove"), profileName: $("profile-name"),
  hudAvatar: $("hud-avatar"), hudName: $("hud-name"), hudSeats: $("hud-seats"), hudEarned: $("hud-earned"), hudJobs: $("hud-jobs-list"), jobStatus: $("hud-jobstatus"),
  endJobs: $("end-jobs"), endLedger: $("end-ledger"), endWallet: $("end-wallet"), endGarage: $("end-garage"),
  onlineBtn: $("online-button"), online: $("online"), onlineClose: $("online-close"), onlineError: $("online-error"),
  onlineConnect: $("online-connect"), onlineCreate: $("online-create"), onlineJoinForm: $("online-join-form"), onlineCode: $("online-code"),
  onlineLobby: $("online-lobby"), onlineRoomCode: $("online-room-code"), onlineCopy: $("online-copy"), onlineMap: $("online-map"), onlineMapName: $("online-map-name"),
  onlineVehicle: $("online-vehicle"), onlineDriver: $("online-driver"), onlinePlayers: $("online-players"), onlineResults: $("online-results"),
  onlineHint: $("online-hint"), onlineLeave: $("online-leave"), onlineReady: $("online-ready"), onlineStart: $("online-start"),
  hudMp: $("hud-mp"), hudMpList: $("hud-mp-list"), endMp: $("end-mp"), endMpTitle: $("end-mp-title"), endMpNote: $("end-mp-note"), endMpList: $("end-mp-list"),
  pauseKicker: $("pause-kicker"), pauseTitle: $("pause-title")
};

const show = (el, display = "grid") => { el.classList.remove("hidden"); el.classList.add(display); };
const hide = (el) => { el.classList.add("hidden"); el.classList.remove("grid", "flex", "block"); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const storage = {
  get(key, fallback = null) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }
};

// ---------------------------------------------------------------- settings
const settings = {
  vehicle: storage.get("lts-vehicle", "car"),
  map: storage.get("lts-map", "third-mainland"),
  quality: storage.get("lts-quality", "high"),
  sound: storage.get("lts-sound", "on") === "on",
  driver: storage.get("lts-driver", "nkechi"),
  camera: 0
};
if (!VEHICLES[settings.vehicle]) settings.vehicle = "car";
if (!DRIVERS[settings.driver]) settings.driver = "nkechi";
if (!MAPS[settings.map]) settings.map = "third-mainland";
const career = loadCareer();
if (!career.vehicles.includes(settings.vehicle)) settings.vehicle = "car";
if (!career.routes.includes(settings.map)) settings.map = "third-mainland";
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const profile = { name: storage.get("lts-name", ""), avatar: storage.get("lts-avatar", "") };
if (!AVATAR_RE.test(profile.avatar)) profile.avatar = "";
let garageVehicle = settings.vehicle;
const qualityProfile = () => settings.quality === "high"
  ? { shadows: true, shadowSize: 2048, pixelRatio: Math.min(window.devicePixelRatio || 1, 2), anisotropy: 8 }
  : { shadows: false, shadowSize: 512, pixelRatio: Math.min(window.devicePixelRatio || 1, 1), anisotropy: 2 };

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1500);
const audio = new GameAudio();
audio.enabled = settings.sound;
const traffic = new Traffic(scene);
const online = new Online();
const remote = new RemoteCars(scene);
traffic.others = remote.list; // NPCs brake for other online players too
let mp = null; // set while an online race is running
let lastResults = null;

function resize() {
  const q = qualityProfile();
  renderer.setPixelRatio(q.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

// ---------------------------------------------------------------- particles
const particleTexture = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const particles = Array.from({ length: 80 }, () => {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: particleTexture, transparent: true, depthWrite: false }));
  sprite.visible = false;
  scene.add(sprite);
  return { sprite, life: 0, max: 1, vel: new THREE.Vector3(), grow: 0 };
});
let particleIndex = 0;
function emit(position, { color = 0x666666, size = 1, life = 1.2, vel = [0, 1.5, 0], spread = 0.6, grow = 1.6, additive = false } = {}) {
  const p = particles[particleIndex++ % particles.length];
  p.sprite.visible = true;
  p.sprite.position.copy(position);
  p.sprite.scale.setScalar(size);
  p.sprite.material.color.set(color);
  p.sprite.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  p.sprite.material.opacity = 0.8;
  p.vel.set(vel[0] + (Math.random() - 0.5) * spread, vel[1] + Math.random() * spread, vel[2] + (Math.random() - 0.5) * spread);
  p.life = p.max = life;
  p.grow = grow;
}
function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.sprite.visible = false; continue; }
    p.sprite.position.addScaledVector(p.vel, dt);
    p.sprite.scale.multiplyScalar(1 + p.grow * dt);
    p.sprite.material.opacity = 0.8 * (p.life / p.max);
  }
}

// ---------------------------------------------------------------- race state
let race = null; // { map, track, world, course, playerMesh, headlights }
let state = "menu"; // menu | countdown | playing | paused | finished | wrecked | ended
let player = null;
let stats = null;
let countdownT = 0;
let endTimer = 0;
let clockT = 0;
const camState = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 62, shake: 0, init: false };
const input = { gas: false, brake: false, left: false, right: false, horn: false };
let hornCooldown = 0;
let lastDanfoMsg = 0;
let pausedFrom = null;
let lastJobsKey = "";

/** Vehicle stats adjusted by the driver's skills. */
function effectiveSpec(vehicleId, driverId) {
  const v = applyUpgrades(VEHICLES[vehicleId], vehicleId, career);
  const d = DRIVERS[driverId];
  return { ...v, maxSpeed: v.maxSpeed * d.speed, accel: v.accel * d.accel, steer: v.steer * d.steer, health: Math.round(v.health * d.health) };
}

/** Online races start on a grid so nobody spawns inside anybody else. */
function gridSlot(index, track) {
  return { s: 16 - Math.floor(index / track.lanes) * 11, lat: track.laneCenter(index % track.lanes) };
}

function newPlayer(vehicleId, track, slot = null) {
  const spec = effectiveSpec(vehicleId, settings.driver);
  return {
    s: slot ? slot.s : 4, lat: slot ? slot.lat : track.laneCenter(Math.floor(track.lanes / 2)), v: 0, latV: 0, steer: 0,
    health: spec.health, maxHealth: spec.health, w: spec.width, len: spec.length,
    alive: true, offroad: false, bumpY: 0, bumpV: 0, scrapeT: 0, autopilot: false, armour: vehicleId === "bus" ? 0.6 : vehicleId === "bike" ? 1.25 : 1
  };
}

function buildRace(mapId, vehicleId, attract = false, seed = null, gridIndex = null) {
  const map = MAPS[mapId];
  const q = qualityProfile();
  if (race) {
    race.world.dispose();
    race.course.dispose(scene);
    race.jobs.dispose(scene);
    scene.remove(race.playerMesh);
  }
  remote.dispose();
  renderer.shadowMap.enabled = q.shadows;
  resize();
  const track = new Track(map);
  const driver = DRIVERS[settings.driver];
  const world = buildWorld(scene, map, track, q);
  const course = new Course(scene, map, track);
  const spec = effectiveSpec(vehicleId, driver.id);
  // online: a shared seed gives every player the same customers in the same places
  const jobs = new Jobs(scene, map, track, course, vehicleId, spec.capacity, !attract, seed === null ? Math.random : makeRng(`${seed}-jobs`));
  const playerMesh = buildVehicle(vehicleId === "bike" ? "bike" : vehicleId === "bus" ? "bus" : "car", paintColor(career, vehicleId, VEHICLES[vehicleId].color));
  scene.add(playerMesh);
  let headlights = null;
  if (map.night) {
    const bp = playerMesh.userData.blueprint;
    headlights = new THREE.SpotLight(0xfff0d0, 90, 90, 0.48, 0.55, 1.4);
    headlights.position.set(0, bp.headY + 0.2, bp.headZ);
    headlights.target.position.set(0, 0, bp.headZ - 30);
    playerMesh.add(headlights, headlights.target);
  }
  race = { map, track, world, course, jobs, playerMesh, headlights, vehicleId, driver, spec, outline: [] };
  for (let s = track.sMin; s <= track.sMax; s += 8) {
    const f = track.frame(s, {});
    race.outline.push({ s, x: f.x, z: f.z });
  }
  player = newPlayer(vehicleId, track, gridIndex === null ? null : gridSlot(gridIndex, track));
  player.autopilot = attract;
  if (attract) player.v = 16;
  traffic.reset(map, track, course, vehicleId, driver.honk + spec.honk);
  traffic.populate(player);
  stats = { time: 0, coins: 0, near: 0, hits: 0, peds: 0, bonus: 0, penalty: 0, combo: 1, comboT: 0, maxS: 0 };
  camState.init = false;

  // progress bar markers for jams / roadworks
  ui.progressTrack.querySelectorAll(".marker").forEach((m) => m.remove());
  const marker = (s0, s1, color) => {
    const m = document.createElement("div");
    m.className = "marker absolute top-0 h-full rounded-full opacity-80";
    m.style.left = `${(s0 / map.length) * 100}%`;
    m.style.width = `${Math.max(1, ((s1 - s0) / map.length) * 100)}%`;
    m.style.background = color;
    ui.progressTrack.appendChild(m);
  };
  course.jams.forEach((j) => marker(j.s0, j.s1, "#ff5a3c"));
  course.closures.forEach((c) => marker(c.s0, c.s1, "#f28c13"));
  ui.route.textContent = map.name.toUpperCase();
  ui.length.textContent = map.length.toLocaleString();
  ui.vehicle.textContent = VEHICLES[vehicleId].name.toUpperCase();
  lastJobsKey = "";
}

// ---------------------------------------------------------------- menu
function statBar(label, value) {
  return `<div class="mt-1.5"><div class="mb-1 flex justify-between font-mono text-[8px] tracking-widest text-white/40"><span>${label}</span></div><div class="stat-bar"><span style="width:${Math.round(value * 100)}%"></span></div></div>`;
}
const ICONS = { car: "🚗", bike: "🏍️", bus: "🚐" };

const lockBadge = (price) => `<div class="mt-2 rounded-lg border border-amber/40 bg-amber/10 px-2 py-1.5 text-center font-mono text-[10px] tracking-widest text-amber">🔒 ${naira(price)} · TAP TO BUY</div>`;

function renderMenu() {
  ui.wallet.textContent = naira(career.wallet);
  ui.onlineBtn.textContent = online.room ? `ONLINE · ROOM ${online.room.code}` : "PLAY ONLINE";
  renderProfile();
  ui.vehicleCards.innerHTML = Object.values(VEHICLES).map((v) => `
    <button class="card glass rounded-xl p-4 text-left ${career.vehicles.includes(v.id) ? "" : "opacity-80"}" data-vehicle="${v.id}" aria-pressed="${v.id === settings.vehicle}">
      <div class="flex items-center justify-between"><span class="text-2xl">${ICONS[v.id]}</span><span class="font-mono text-[9px] tracking-widest text-white/40">${Math.round(v.maxSpeed * 3.6)} KM/H</span></div>
      <div class="mt-2 font-display text-sm font-bold">${v.name.toUpperCase()}</div>
      <div class="mb-1 text-[11px] leading-snug text-white/50">${v.blurb}</div>
      ${statBar("TOP SPEED", v.maxSpeed / 42)}${statBar("HANDLING", v.steer / 13)}${statBar("TOUGHNESS", v.health / 180)}
      ${career.vehicles.includes(v.id) ? `<div class="mt-2 font-mono text-[9px] tracking-widest text-white/45">${BASE_CAPACITY[v.id]} SLOTS${v.id === "bus" ? " · CHEAP FARES" : v.id === "bike" ? " · BEST PAY / METRE" : ""}</div>` : lockBadge(PRICES.vehicles[v.id])}
    </button>`).join("");

  ui.driverCards.innerHTML = Object.values(DRIVERS).map((d) => `
    <button class="card glass rounded-xl p-3.5 text-left" data-driver="${d.id}" aria-pressed="${d.id === settings.driver}">
      <div class="flex items-center gap-2.5">
        <span class="block h-14 w-14 shrink-0 rounded-full ring-2 ring-white/10 transition [[aria-pressed=true]_&]:ring-lime">${driverPortrait(d, "h-full w-full")}</span>
        <span class="min-w-0"><span class="block font-display text-sm font-bold leading-tight">${d.name}</span><span class="block font-mono text-[8px] tracking-widest text-white/45">${d.title}</span></span>
      </div>
      <div class="mt-2 text-[11px] leading-snug text-white/50">${d.blurb}</div>
      <ul class="mt-2 space-y-0.5 text-[10px] text-white/70">${d.perks.map((p) => `<li>• ${p}</li>`).join("")}</ul>
    </button>`).join("");

  const traffic = (d) => d > 1.3 ? "GRIDLOCK" : d > 1.1 ? "HEAVY" : d > 0.88 ? "BUSY" : "FLOWING";
  ui.mapCards.innerHTML = Object.values(MAPS).map((m) => `
    <button class="card glass rounded-xl p-4 text-left ${career.routes.includes(m.id) ? "" : "opacity-80"}" data-map="${m.id}" aria-pressed="${m.id === settings.map}">
      <div class="flex items-center justify-between font-mono text-[9px] tracking-widest"><span class="text-lime">${m.short}</span><span class="text-white/40">${m.time}</span></div>
      <div class="mt-1.5 font-display text-base font-bold">${m.name}</div>
      <div class="mb-2 text-[11px] leading-snug text-white/50">${m.tagline}</div>
      <div class="flex flex-wrap gap-1.5 font-mono text-[9px] tracking-wider text-white/60">
        <span class="rounded bg-white/5 px-1.5 py-0.5">${(m.length / 1000).toFixed(1)} KM</span>
        <span class="rounded bg-white/5 px-1.5 py-0.5">${m.lanes} LANES</span>
        <span class="rounded bg-white/5 px-1.5 py-0.5">${traffic(m.traffic.density)}</span>
        <span class="rounded bg-white/5 px-1.5 py-0.5">PAR ${formatTime(m.parTime, false)}</span>
      </div>
      ${career.routes.includes(m.id) ? "" : lockBadge(PRICES.routes[m.id])}
    </button>`).join("");
  ui.quality.textContent = `GFX: ${settings.quality.toUpperCase()}`;
  ui.sound.textContent = `SOUND: ${settings.sound ? "ON" : "OFF"}`;
  loadBoard();
}

function tryUnlock(kind, id, label) {
  const owned = kind === "vehicles" ? career.vehicles : career.routes;
  if (owned.includes(id)) return true;
  const price = PRICES[kind][id];
  if (career.wallet < price) {
    toast(`${label} costs ${naira(price)}. You have ${naira(career.wallet)} — do some deliveries first.`);
    return false;
  }
  if (!confirm(`Unlock ${label} for ${naira(price)}?`)) return false;
  spend(career, price);
  owned.push(id);
  saveCareer(career);
  toast(`${label} unlocked!`);
  return true;
}

ui.vehicleCards.addEventListener("click", (e) => {
  const card = e.target.closest("[data-vehicle]");
  if (!card) return;
  if (!tryUnlock("vehicles", card.dataset.vehicle, VEHICLES[card.dataset.vehicle].name)) return;
  settings.vehicle = card.dataset.vehicle;
  storage.set("lts-vehicle", settings.vehicle);
  renderMenu();
  buildRace(settings.map, settings.vehicle, true);
});
ui.driverCards.addEventListener("click", (e) => {
  const card = e.target.closest("[data-driver]");
  if (!card) return;
  settings.driver = card.dataset.driver;
  storage.set("lts-driver", settings.driver);
  renderMenu();
  renderProfile();
  buildRace(settings.map, settings.vehicle, true);
});
ui.mapCards.addEventListener("click", (e) => {
  const card = e.target.closest("[data-map]");
  if (!card) return;
  if (!tryUnlock("routes", card.dataset.map, MAPS[card.dataset.map].name)) return;
  settings.map = card.dataset.map;
  storage.set("lts-map", settings.map);
  renderMenu();
  buildRace(settings.map, settings.vehicle, true);
});
ui.quality.addEventListener("click", () => {
  settings.quality = settings.quality === "high" ? "low" : "high";
  storage.set("lts-quality", settings.quality);
  renderMenu();
  buildRace(settings.map, settings.vehicle, true);
});
const toggleSound = () => {
  settings.sound = !settings.sound;
  storage.set("lts-sound", settings.sound ? "on" : "off");
  audio.setEnabled(settings.sound);
  ui.sound.textContent = `SOUND: ${settings.sound ? "ON" : "OFF"}`;
  if (settings.sound && (state === "playing" || state === "countdown")) audio.startEngine(settings.vehicle);
};
ui.sound.addEventListener("click", toggleSound);

async function loadBoard() {
  const map = MAPS[settings.map];
  ui.boardTitle.textContent = map.name;
  const best = Number(storage.get(`lts-best-${map.id}`, 0));
  ui.personalBest.textContent = best ? best.toLocaleString() : "—";
  try {
    const response = await fetch(apiUrl(`/api/scores?map=${encodeURIComponent(map.id)}`));
    if (!response.ok) throw new Error(response.statusText);
    const data = await response.json();
    const board = data[map.id] || [];
    if (settings.map !== map.id) return;
    ui.boardList.innerHTML = board.length
      ? board.slice(0, 8).map((e, i) => `<li class="flex items-center gap-3"><span class="w-5 font-mono text-[10px] text-white/40">${String(i + 1).padStart(2, "0")}</span>${avatarHtml(e.avatar, e.name, "h-6 w-6 text-[9px]")}<span class="flex-1 truncate">${escapeHtml(e.name)} <span class="text-xs">${ICONS[e.vehicle] || ""}</span></span><span class="font-mono text-xs text-lime">${e.score.toLocaleString()}</span></li>`).join("")
      : `<li class="text-xs text-white/40">No finishers yet. Be the first legend.</li>`;
  } catch {
    ui.boardList.innerHTML = `<li class="text-xs text-white/40">${STATIC_HOST ? "Leaderboard server is asleep or offline. Your best is saved on this device." : `Leaderboard offline — run <span class="font-mono">npm start</span>.`}</li>`;
  }
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function formatTime(t, tenths = true) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${tenths ? s.toFixed(1).padStart(4, "0") : String(Math.floor(s)).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- flow
function startRace() {
  if (mp) return;
  audio.ensure();
  hide(ui.hudMp);
  hide(ui.menu);
  hide(ui.end);
  hide(ui.pause);
  ui.loadingName.textContent = MAPS[settings.map].name;
  show(ui.loading);
  // let the loading screen paint before the (synchronous) world build
  requestAnimationFrame(() => requestAnimationFrame(() => {
    buildRace(settings.map, settings.vehicle, false);
    hide(ui.loading);
    show(ui.hud, "block");
    ui.touch.classList.add("playing");
    state = "countdown";
    countdownT = 3.0;
    showCount("3");
    audio.countdown();
    if (settings.sound) audio.startEngine(settings.vehicle);
  }));
}

function showCount(text) {
  ui.countdown.innerHTML = `<span class="count">${text}</span>`;
}

function backToMenu() {
  state = "menu";
  mp = null;
  hide(ui.hudMp);
  hide(ui.end);
  hide(ui.pause);
  hide(ui.hud);
  ui.touch.classList.remove("playing");
  audio.stopEngine();
  audio.hornOff();
  show(ui.menu, "block");
  renderMenu();
  buildRace(settings.map, settings.vehicle, true);
}

function setPauseTexts() {
  ui.pauseKicker.textContent = mp ? "ONLINE RACE" : "PIT STOP";
  ui.pauseTitle.textContent = mp ? "The race keeps going!" : "Catch your breath.";
  ui.restart.classList.toggle("hidden", !!mp);
  ui.quit.textContent = mp ? "LEAVE RACE" : "CHANGE RIDE / ROUTE";
}
function pauseGame() {
  if (state !== "playing" && state !== "countdown") return;
  setPauseTexts();
  if (mp) { show(ui.pause); return; } // menu only: your car keeps rolling
  pausedFrom = state;
  state = "paused";
  clearInput();
  audio.updateEngine(0, 0, true);
  show(ui.pause);
}
function resumeGame() {
  if (mp) { hide(ui.pause); return; }
  if (state !== "paused") return;
  state = pausedFrom || "playing";
  hide(ui.pause);
}

function finishRace(won) {
  if (state !== "playing") return;
  race.jobs.close();
  state = won ? "finished" : "wrecked";
  endTimer = won ? 1.4 : 1.8;
  player.alive = won;
  audio.hornOff();
  if (mp && !mp.sentFinish) {
    mp.sentFinish = true;
    const sc = computeScore(won);
    mp.mine = { score: sc.total, time: stats.time, earned: Math.round(race.jobs.earned), distance: sc.distance, wrecked: !won };
    online.send({ type: "finish", ...mp.mine });
  }
  if (won) {
    audio.win();
    popup("YOU MADE IT! 🏁", "text-lime text-3xl");
  } else {
    audio.lose();
    popup("WRECKED 💥", "text-danger text-3xl");
  }
}

function computeScore(won) {
  const map = race.map;
  const distance = Math.floor(Math.min(stats.maxS, map.length));
  const timeBonus = won ? Math.max(0, Math.round((map.parTime - stats.time) * 25)) : 0;
  const healthBonus = won ? Math.round((player.health / player.maxHealth) * 1000) : 0;
  const earnings = Math.round(race.jobs.earned / 5);
  const total = Math.max(0, distance + stats.bonus + timeBonus + healthBonus + earnings - stats.penalty);
  return { distance, timeBonus, healthBonus, earnings, total };
}

function showEnd() {
  state = "ended";
  audio.stopEngine();
  const won = player.alive;
  const map = race.map;
  const score = computeScore(won);
  const healthPct = Math.round((player.health / player.maxHealth) * 100);
  let stars = 0;
  if (won) stars = 1 + (stats.time <= map.parTime ? 1 : 0) + (healthPct >= 60 ? 1 : 0);
  ui.endStars.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  ui.endKicker.textContent = won ? `ARRIVED · ${map.name.toUpperCase()}` : "JOURNEY ENDED";
  ui.endTitle.textContent = won ? (stars === 3 ? "Lagos road legend." : "You made it.") : "Traffic got you.";
  ui.endDesc.textContent = won
    ? stars === 3 ? "Fast, clean and stylish. Even the danfo drivers are impressed." : `Beat ${formatTime(map.parTime, false)} with 60%+ condition for three stars.`
    : "Every Lagos legend has a close call. Shake it off and go again.";
  ui.endCoins.textContent = stats.coins;
  ui.endTime.textContent = formatTime(stats.time);
  ui.endDistance.textContent = `${score.distance.toLocaleString()} m`;
  ui.endHealth.textContent = `${healthPct}%`;
  ui.endNear.textContent = stats.near;
  ui.endHits.textContent = stats.hits;
  ui.endScore.textContent = score.total.toLocaleString();
  ui.endBreakdown.textContent = `distance ${score.distance} · deliveries ${score.earnings} · bonus ${stats.bonus}${won ? ` · time ${score.timeBonus} · condition ${score.healthBonus}` : ""}${stats.penalty ? ` · penalties −${stats.penalty}` : ""}`;

  settleShift();

  const bestKey = `lts-best-${map.id}`;
  if (score.total > Number(storage.get(bestKey, 0))) storage.set(bestKey, String(score.total));

  ui.submitStatus.classList.add("hidden");
  if (won) {
    show(ui.submitForm, "flex");
    ui.playerName.value = profile.name;
    ui.submitForm.onsubmit = async (e) => {
      e.preventDefault();
      const name = ui.playerName.value.trim() || "Anonymous";
      setProfileName(name);
      ui.submitStatus.classList.remove("hidden");
      ui.submitStatus.textContent = "Posting…";
      try {
        const response = await fetch(apiUrl("/api/scores"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, map: map.id, vehicle: race.vehicleId, score: score.total, time: stats.time, earned: Math.round(race.jobs.earned), avatar: profile.avatar || undefined })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed");
        ui.submitStatus.textContent = data.rank ? `Posted! You're #${data.rank} on ${map.name}.` : "Posted, but not top 10 this time.";
        hide(ui.submitForm);
      } catch (error) {
        ui.submitStatus.textContent = `Could not post score (${error.message}).`;
      }
    };
  } else {
    hide(ui.submitForm);
  }
  hide(ui.hud);
  ui.touch.classList.remove("playing");
  ui.retry.classList.toggle("hidden", !!mp);
  ui.menuBtn.textContent = mp ? "LOBBY" : "MENU";
  ui.endMp.classList.toggle("hidden", !mp);
  if (mp) renderEndStandings();
  show(ui.end);
}

ui.start.addEventListener("click", startRace);
ui.retry.addEventListener("click", startRace);
ui.menuBtn.addEventListener("click", () => { if (mp) backToLobby(); else backToMenu(); });
ui.pauseBtn.addEventListener("click", pauseGame);
ui.resume.addEventListener("click", resumeGame);
ui.restart.addEventListener("click", startRace);
ui.quit.addEventListener("click", () => { if (mp) leaveRace(); else backToMenu(); });
ui.camera.addEventListener("click", () => cycleCamera());
ui.garageBtn.addEventListener("click", () => openGarage());
ui.endGarage.addEventListener("click", () => { backToMenu(); openGarage(); });
ui.garageClose.addEventListener("click", closeGarage);
ui.garage.addEventListener("click", (e) => { if (e.target === ui.garage) closeGarage(); });

/** Pay out the shift: deliveries in, repair bill out, into the persistent wallet. */
function settleShift() {
  const jobs = race.jobs;
  const damagePct = (player.maxHealth - player.health) / player.maxHealth;
  const repair = Math.round((damagePct * REPAIR_COST[race.vehicleId]) / 10) * 10;
  const net = jobs.earned - repair;
  career.wallet = Math.max(0, career.wallet + net);
  career.totals.shifts++;
  career.totals.delivered += jobs.delivered.length;
  career.totals.earned += jobs.earned;
  saveCareer(career);

  ui.endJobs.textContent = `${jobs.delivered.length} delivered · ${jobs.missed.length} missed`;
  ui.endLedger.replaceChildren();
  const line = (label, amount, cls = "") => {
    const li = document.createElement("li");
    li.className = "flex justify-between gap-3";
    const a = document.createElement("span");
    a.className = "truncate text-white/70";
    a.textContent = label;
    const b = document.createElement("span");
    b.className = `font-mono ${cls}`;
    b.textContent = amount;
    li.append(a, b);
    ui.endLedger.append(li);
  };
  for (const job of jobs.delivered) line(`${job.kind === "parcel" ? "📦" : "👤"} ${job.name} · ${Math.round(job.dist)} m`, `+${naira(job.paid)}`, "text-[#5fe08f]");
  if (!jobs.delivered.length) line("No deliveries this shift", "₦0", "text-white/50");
  if (jobs.missed.length) line(`${jobs.missed.length} job${jobs.missed.length > 1 ? "s" : ""} missed`, "₦0", "text-white/50");
  if (repair) line(`Repair bill (${Math.round(damagePct * 100)}% damage)`, `−${naira(repair)}`, "text-danger");
  line("Net this shift", `${net < 0 ? "−" : "+"}${naira(Math.abs(net))}`, net < 0 ? "text-danger font-bold" : "text-amber font-bold");
  ui.endWallet.textContent = naira(career.wallet);
}

// ---------------------------------------------------------------- profile (name + photo)
function avatarHtml(src, name, size = "h-9 w-9 text-xs") {
  if (src && AVATAR_RE.test(src)) return `<img src="${src}" alt="" class="${size} shrink-0 rounded-full object-cover">`;
  const initials = escapeHtml((name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?");
  return `<span class="grid ${size} shrink-0 place-items-center rounded-full bg-white/15 font-display font-bold">${initials}</span>`;
}

function renderProfile() {
  if (document.activeElement !== ui.profileName) ui.profileName.value = profile.name;
  const initials = profile.name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  ui.avatarInitials.textContent = initials || "+";
  ui.avatarImg.classList.toggle("hidden", !profile.avatar);
  ui.avatarInitials.classList.toggle("hidden", !!profile.avatar);
  if (profile.avatar) ui.avatarImg.src = profile.avatar;
  ui.avatarRemove.classList.toggle("hidden", !profile.avatar);
  ui.hudName.textContent = profile.name || "Driver";
  ui.hudAvatar.innerHTML = profile.avatar ? `<img src="${profile.avatar}" alt="" class="h-full w-full object-cover">` : driverPortrait(DRIVERS[settings.driver], "h-full w-full");
}

function setProfileName(name) {
  profile.name = name.replace(/[^\w .-]/g, "").slice(0, 16);
  storage.set("lts-name", profile.name);
  renderProfile();
}

ui.profileName.addEventListener("input", () => setProfileName(ui.profileName.value));
ui.avatarBtn.addEventListener("click", () => ui.avatarFile.click());
ui.avatarRemove.addEventListener("click", () => {
  profile.avatar = "";
  storage.set("lts-avatar", "");
  renderProfile();
});
ui.avatarFile.addEventListener("change", () => {
  const file = ui.avatarFile.files?.[0];
  ui.avatarFile.value = "";
  if (!file || !file.type.startsWith("image/")) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    // centre-crop to a small square so it fits comfortably in localStorage and the leaderboard
    const size = 96;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const side = Math.min(img.width, img.height);
    canvas.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    profile.avatar = canvas.toDataURL("image/jpeg", 0.82);
    storage.set("lts-avatar", profile.avatar);
    URL.revokeObjectURL(url);
    renderProfile();
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("That image couldn't be read. Try a JPG or PNG."); };
  img.src = url;
});

function toast(text) {
  const el = document.createElement("div");
  el.className = "fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-ink/95 px-4 py-3 text-sm shadow-2xl ring-1 ring-white/15";
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 2800);
}

// ---------------------------------------------------------------- garage
function openGarage() {
  garageVehicle = career.vehicles.includes(settings.vehicle) ? settings.vehicle : "car";
  renderGarage();
  show(ui.garage);
}
function closeGarage() {
  hide(ui.garage);
  renderMenu();
  if (state === "menu") buildRace(settings.map, settings.vehicle, true);
}

function renderGarage() {
  ui.garageWallet.textContent = naira(career.wallet);
  ui.garageTabs.innerHTML = Object.values(VEHICLES).map((v) => `
    <button role="tab" aria-selected="${v.id === garageVehicle}" data-tab="${v.id}" class="rounded-xl border px-3 py-2 text-left ${v.id === garageVehicle ? "border-amber bg-amber/10" : "border-white/15 hover:border-white/40"}">
      <span class="block font-display text-sm font-bold">${ICONS[v.id]} ${v.name}</span>
      <span class="block font-mono text-[9px] tracking-widest text-white/45">${career.vehicles.includes(v.id) ? "OWNED" : `🔒 ${naira(PRICES.vehicles[v.id])}`}</span>
    </button>`).join("");

  const v = garageVehicle;
  if (!career.vehicles.includes(v)) {
    ui.garageBody.innerHTML = `<div class="rounded-xl bg-white/5 p-5 text-center"><p class="mb-3 text-sm text-white/60">You don't own the ${VEHICLES[v].name} yet.</p><button data-unlock="${v}" class="rounded-xl bg-amber px-5 py-3 font-display text-sm font-bold text-ink hover:brightness-110">BUY FOR ${naira(PRICES.vehicles[v])}</button></div>`;
    return;
  }
  const spec = effectiveSpec(v, settings.driver);
  const rows = Object.entries(UPGRADES).map(([key, up]) => {
    const lvl = level(career, v, key);
    const cost = upgradeCost(v, key, lvl);
    const pips = up.costs.map((_, i) => `<span class="h-1.5 w-5 rounded-full ${i < lvl ? "bg-amber" : "bg-white/15"}"></span>`).join("");
    const button = cost === null
      ? `<span class="font-mono text-[10px] tracking-widest text-white/40">MAXED</span>`
      : `<button data-upgrade="${key}" class="rounded-lg px-3 py-2 font-display text-xs font-bold ${career.wallet >= cost ? "bg-amber text-ink hover:brightness-110" : "cursor-not-allowed bg-white/10 text-white/40"}">${naira(cost)}</button>`;
    return `<div class="flex items-center gap-3 rounded-xl bg-white/5 p-3">
      <div class="min-w-0 flex-1"><div class="font-display text-sm font-bold">${up.name}</div><div class="text-[11px] text-white/50">${up.desc}</div><div class="mt-1.5 flex gap-1">${pips}</div></div>${button}</div>`;
  }).join("");
  const owned = career.paints[v];
  const paints = PAINTS.map((p) => {
    const has = owned.includes(p.id);
    const active = career.paint[v] === p.id;
    const swatch = p.color === null ? VEHICLES[v].color : p.color;
    return `<button data-paint="${p.id}" title="${p.name}${has ? "" : ` · ${naira(p.cost)}`}" class="flex flex-col items-center gap-1 rounded-xl border p-2 ${active ? "border-amber bg-amber/10" : "border-white/10 hover:border-white/40"}">
      <span class="h-7 w-7 rounded-full ring-2 ring-white/20" style="background:#${swatch.toString(16).padStart(6, "0")}"></span>
      <span class="font-mono text-[8px] tracking-widest ${has ? "text-white/60" : "text-amber"}">${has ? p.name.toUpperCase() : naira(p.cost)}</span>
    </button>`;
  }).join("");
  ui.garageBody.innerHTML = `
    <div class="mb-3 grid grid-cols-2 gap-2 font-mono text-[10px] tracking-widest text-white/55 sm:grid-cols-4">
      <div class="rounded-lg bg-white/5 p-2">TOP ${Math.round(spec.maxSpeed * 3.6)} KM/H</div>
      <div class="rounded-lg bg-white/5 p-2">HANDLING ${spec.steer.toFixed(1)}</div>
      <div class="rounded-lg bg-white/5 p-2">TOUGHNESS ${spec.health}</div>
      <div class="rounded-lg bg-white/5 p-2">SLOTS ${spec.capacity}</div>
    </div>
    <div class="space-y-2">${rows}</div>
    <h3 class="mb-2 mt-5 font-mono text-[10px] tracking-[.2em] text-white/45">PAINT</h3>
    <div class="grid grid-cols-4 gap-2 sm:grid-cols-8">${paints}</div>`;
}

ui.garageTabs.addEventListener("click", (e) => {
  const tab = e.target.closest("[data-tab]");
  if (!tab) return;
  garageVehicle = tab.dataset.tab;
  renderGarage();
});
ui.garageBody.addEventListener("click", (e) => {
  const v = garageVehicle;
  const unlock = e.target.closest("[data-unlock]");
  if (unlock) {
    tryUnlock("vehicles", v, VEHICLES[v].name);
    renderGarage();
    return;
  }
  const up = e.target.closest("[data-upgrade]");
  if (up) {
    const key = up.dataset.upgrade;
    const cost = upgradeCost(v, key, level(career, v, key));
    if (cost === null) return;
    if (!spend(career, cost)) return toast(`Not enough cash. You need ${naira(cost)}.`);
    career.upgrades[v][key] = level(career, v, key) + 1;
    saveCareer(career);
    audio.coin();
    renderGarage();
    return;
  }
  const paint = e.target.closest("[data-paint]");
  if (paint) {
    const p = PAINTS.find((x) => x.id === paint.dataset.paint);
    if (!career.paints[v].includes(p.id)) {
      if (!spend(career, p.cost)) return toast(`${p.name} paint costs ${naira(p.cost)}.`);
      career.paints[v].push(p.id);
    }
    career.paint[v] = p.id;
    saveCareer(career);
    renderGarage();
  }
});

// ---------------------------------------------------------------- input
function clearInput() {
  for (const k of Object.keys(input)) input[k] = false;
  audio.hornOff();
  ui.touch.querySelectorAll(".active").forEach((b) => b.classList.remove("active"));
}
function cycleCamera() {
  settings.camera = (settings.camera + 1) % 3;
  camState.init = false;
  popup(["CHASE CAM", "HIGH CAM", "DRIVER CAM"][settings.camera], "text-white/80 text-sm");
}
const KEYMAP = { ArrowUp: "gas", KeyW: "gas", ArrowDown: "brake", KeyS: "brake", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "horn", KeyH: "horn" };

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const action = KEYMAP[e.code];
  if (action) {
    e.preventDefault();
    if (action === "horn" && !input.horn) pressHorn();
    input[action] = true;
    return;
  }
  if (e.repeat) return;
  if (e.code === "Escape" || e.code === "KeyP") {
    if (state === "paused" || (mp && !ui.pause.classList.contains("hidden"))) resumeGame();
    else pauseGame();
  } else if (e.code === "KeyC") cycleCamera();
  else if (e.code === "KeyM") toggleSound();
  else if (e.code === "Enter" && state === "menu" && ui.online.classList.contains("hidden") && ui.garage.classList.contains("hidden")) startRace();
  else if (e.code === "KeyR" && state === "ended" && !mp) startRace();
});
window.addEventListener("keyup", (e) => {
  const action = KEYMAP[e.code];
  if (!action) return;
  input[action] = false;
  if (action === "horn") audio.hornOff();
});
// Fix from the 2D version: keys no longer get stuck when the window loses focus.
window.addEventListener("blur", () => { clearInput(); pauseGame(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) { clearInput(); pauseGame(); } });

function pressHorn() {
  if (state !== "playing") return;
  audio.hornOn(settings.vehicle);
  if (hornCooldown <= 0) {
    traffic.honk(player);
    hornCooldown = 0.7;
  }
}

ui.touch.querySelectorAll("[data-touch]").forEach((button) => {
  const action = button.dataset.touch;
  const down = (e) => {
    e.preventDefault();
    button.setPointerCapture?.(e.pointerId);
    button.classList.add("active");
    if (action === "horn" && !input.horn) pressHorn();
    input[action] = true;
  };
  const up = () => {
    button.classList.remove("active");
    input[action] = false;
    if (action === "horn") audio.hornOff();
  };
  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", up);
  button.addEventListener("pointercancel", up);
  button.addEventListener("lostpointercapture", up);
});

// ---------------------------------------------------------------- feedback
function popup(text, classes = "text-lime text-xl") {
  const el = document.createElement("div");
  el.className = `popup font-display font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,.7)] ${classes}`;
  el.textContent = text;
  ui.popups.appendChild(el);
  while (ui.popups.children.length > 4) ui.popups.firstChild.remove();
  setTimeout(() => el.remove(), 1500);
}
let vignetteTimer = 0;
function damage(amount, reason, shake = 0.5) {
  if (state !== "playing") return;
  const dmg = Math.round(amount * player.armour);
  if (dmg <= 0) return;
  player.health = Math.max(0, player.health - dmg);
  camState.shake = Math.max(camState.shake, shake);
  vignetteTimer = 0.35;
  stats.combo = 1;
  if (reason) popup(`${reason} −${dmg}`, "text-danger text-lg");
  if (player.health <= 0) finishRace(false);
}
const playerWorld = new THREE.Vector3();
function sparks(count = 8) {
  race.track.pos(player.s + player.len / 2, player.lat, 0.8, playerWorld);
  for (let i = 0; i < count; i++) emit(playerWorld, { color: 0xffb347, size: 0.25, life: 0.4, vel: [0, 3, 0], spread: 6, grow: -1, additive: true });
}

// ---------------------------------------------------------------- simulation
function edgeLimit() {
  const hw = race.track.halfWidth;
  const t = race.map.terrain;
  const normal = t === "water" ? hw - 0.12 : t === "market" ? hw + 0.3 : hw + 3.0;
  return normal - player.w / 2;
}

function updatePlayer(dt) {
  const spec = race.spec;
  const hw = race.track.halfWidth;
  let gas = input.gas;
  let brake = input.brake;
  let steerTarget = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  if (player.autopilot || state === "finished" || state === "wrecked") {
    // simple autopilot for the menu showcase and post-race roll-out
    const lead = traffic.list.filter((n) => n.s > player.s && n.s - player.s < 30 && Math.abs(n.lat - player.lat) < 2.2).sort((a, b) => a.s - b.s)[0];
    const want = state === "wrecked" ? 0 : state === "finished" ? 0 : lead ? Math.min(lead.v, 18) : 18;
    gas = player.v < want - 0.5;
    brake = player.v > want + 1.5;
    const laneTarget = race.track.laneCenter(race.track.laneOf(player.lat));
    steerTarget = clamp((laneTarget - player.lat) * 0.6, -1, 1);
    if (state === "wrecked") steerTarget = 0;
  }

  player.steer += (steerTarget - player.steer) * Math.min(1, dt * (steerTarget ? 7 : 10));
  const edge = Math.abs(player.lat) + player.w / 2 - hw;
  const wasOff = player.offroad;
  player.offroad = edge > 0.2 && race.map.terrain !== "water";
  if (player.offroad && !wasOff && player.v > 6) {
    player.bumpV = 2.2;
    audio.pothole();
  }
  const vmax = player.offroad ? Math.min(spec.maxSpeed, 13) : spec.maxSpeed;
  if (gas) player.v += spec.accel * Math.max(0, 1 - (player.v / vmax) ** 2) * dt;
  if (brake) player.v -= spec.brake * dt;
  if (!gas && !brake) player.v -= (1.0 + player.v * 0.025) * dt;
  if (player.v > vmax) player.v -= 12 * dt;
  player.v = clamp(player.v, 0, spec.maxSpeed * 1.05);

  const grip = Math.min(1, player.v / 7 + 0.08);
  const latTarget = player.steer * spec.steer * grip;
  player.latV += (latTarget - player.latV) * Math.min(1, dt * 6);
  player.lat += player.latV * dt;

  const limit = edgeLimit();
  if (Math.abs(player.lat) > limit) {
    const side = Math.sign(player.lat);
    const impact = Math.abs(player.latV);
    player.lat = side * limit;
    player.latV = -side * Math.min(2, impact * 0.3);
    player.v -= 7 * dt;
    player.scrapeT -= dt;
    if (player.scrapeT <= 0 && player.v > 4 && state === "playing") {
      player.scrapeT = 0.25;
      audio.scrape();
      sparks(4);
      const reason = race.map.terrain === "water" ? "BARRIER" : race.map.terrain === "market" ? "MARKET STALL" : "KERB";
      if (impact > 2.5) damage(2 + impact * 1.4, reason, 0.3);
      else damage(1, null, 0.12);
    }
  }
  if (player.offroad && player.v > 5) camState.shake = Math.max(camState.shake, 0.08);

  player.s += player.v * dt;
  // bump spring
  player.bumpV -= player.bumpY * 90 * dt + player.bumpV * 9 * dt;
  player.bumpY += player.bumpV * dt;
}

function rectOverlap(as, alat, alen, aw, bs, blat, blen, bw) {
  const ps = (alen + blen) / 2 - Math.abs(as - bs);
  const pl = (aw + bw) / 2 - Math.abs(alat - blat);
  return ps > 0 && pl > 0 ? { ps, pl } : null;
}

function handleCollisions() {
  const course = race.course;
  const p = player;

  for (const npc of traffic.list) {
    const hit = rectOverlap(p.s, p.lat, p.len, p.w, npc.s, npc.lat, npc.len, npc.w);
    if (hit) {
      const ahead = npc.s > p.s;
      let impact;
      if (hit.ps < hit.pl * 1.4) {
        // nose-to-tail
        if (ahead) {
          impact = Math.max(0, p.v - npc.v);
          p.s = npc.s - (npc.len + p.len) / 2 - 0.02;
          p.v = Math.max(0, npc.v * 0.85 - 1);
          npc.v += impact * 0.25;
        } else {
          impact = Math.max(0, npc.v - p.v);
          p.s = npc.s + (npc.len + p.len) / 2 + 0.02;
          p.v += impact * 0.45;
          npc.v = p.v * 0.7;
        }
      } else {
        const dir = Math.sign(p.lat - npc.lat) || 1;
        impact = Math.abs(p.latV - npc.latV) + Math.abs(p.v - npc.v) * 0.2 + 1;
        p.lat += dir * hit.pl;
        p.latV = dir * 3.2;
        npc.lat -= dir * 0.25;
        npc.latV = -dir * 1.5;
        p.v *= 0.94;
      }
      npc.touched = true;
      if (npc.hitCooldown <= 0 && state === "playing") {
        npc.hitCooldown = 0.5;
        if (impact > 1.2) {
          stats.hits++;
          const names = { car: "CRASH", danfo: "DANFO HIT", okada: "OKADA HIT", truck: "TRUCK HIT", tanker: "TANKER HIT", brt: "BRT HIT" };
          damage(4 + impact * 2.3, names[npc.type], Math.min(1.2, 0.3 + impact * 0.06));
          race.jobs.onCrash();
          audio.crash(Math.min(1, impact / 15));
          sparks(12);
        } else {
          audio.scrape();
        }
      }
    }

    // near misses: just overtook something fast and close without touching it
    if (!npc.passed && p.s - p.len / 2 > npc.s + npc.len / 2) {
      npc.passed = true;
      const gap = Math.abs(p.lat - npc.lat) - (p.w + npc.w) / 2;
      const justPassed = p.s - npc.s < (p.len + npc.len) / 2 + 3;
      if (justPassed && !npc.touched && gap < 0.9 && p.v > 14 && p.v > npc.v + 4 && state === "playing") {
        const points = Math.round(100 * stats.combo * race.driver.nearMiss);
        stats.bonus += points;
        stats.near++;
        popup(`CLOSE ONE! +${points}${stats.combo > 1 ? ` ×${stats.combo}` : ""}`);
        stats.combo = Math.min(8, stats.combo + 1);
        stats.comboT = 4;
        audio.nearMiss();
      }
    }
  }

  for (const r of remote.list) {
    const hit = rectOverlap(p.s, p.lat, p.len, p.w, r.s, r.lat, r.len, r.w);
    if (!hit) continue;
    if (hit.ps < hit.pl * 1.4) {
      if (r.s > p.s) { p.s = r.s - (r.len + p.len) / 2 - 0.02; p.v = Math.min(p.v, r.v * 0.9); }
      else { p.s = r.s + (r.len + p.len) / 2 + 0.02; p.v = Math.max(p.v, r.v * 0.8); }
    } else {
      const dir = Math.sign(p.lat - r.lat) || 1;
      p.lat += dir * hit.pl;
      p.latV = dir * 3;
      p.v *= 0.96;
    }
    if (r.bumpCooldown <= 0 && state === "playing") {
      r.bumpCooldown = 1.2;
      audio.scrape();
      popup(`BUMPED ${r.name.toUpperCase()}`, "text-white/80 text-sm");
    }
  }

  if (state !== "playing") return;

  for (const hole of course.potholes) {
    if (hole.hit || Math.abs(hole.s - p.s) > hole.r + p.len * 0.35) continue;
    if (Math.abs(hole.lat - p.lat) < hole.r * 0.8 + p.w * 0.35) {
      hole.hit = true;
      const spec = VEHICLES[race.vehicleId];
      p.bumpV = 3.5;
      p.v *= race.vehicleId === "bike" ? 0.72 : 0.86;
      audio.pothole();
      race.jobs.onBump();
      damage(spec.potholeDamage * race.driver.potholes * (0.4 + p.v / spec.maxSpeed), "POTHOLE", 0.6);
    }
  }

  for (const cone of course.cones) {
    if (cone.vel) continue;
    if (rectOverlap(p.s, p.lat, p.len, p.w, cone.s, cone.lat, 0.6, 0.6)) {
      cone.vel = { s: p.v * 0.8 + 2, lat: (Math.sign(cone.lat - p.lat) || 1) * (2 + Math.random() * 3), y: 4 + Math.random() * 3 };
      p.v *= 0.95;
      audio.scrape();
      damage(2, null, 0.15);
    }
  }
  course.barriers.forEach((b, i) => {
    if (b.knocked) return;
    if (rectOverlap(p.s, p.lat, p.len, p.w, b.s, b.lat, 0.4, b.halfW * 2)) {
      b.knocked = true;
      race.course.barrierMeshes[i].visible = false;
      stats.hits++;
      damage(8 + p.v * 0.6, "ROADWORKS", 0.8);
      race.jobs.onCrash();
      p.v *= 0.5;
      audio.crash(0.6);
      sparks(14);
    }
  });

  for (const ped of course.peds) {
    if (ped.state === "gone" || ped.state === "dodge" || ped.state === "done") continue;
    if (rectOverlap(p.s, p.lat, p.len, p.w, ped.s, ped.lat, 0.7, 0.7)) {
      ped.state = "dodge";
      ped.dodgeT = 0;
      ped.dodgeDir = Math.sign(ped.lat - p.lat) || (ped.lat > 0 ? 1 : -1);
      stats.peds++;
      stats.penalty += 300;
      p.v *= 0.8;
      audio.pedestrian();
      damage(6, null, 0.3);
      popup("ABEG! WATCH THE ROAD! −300", "text-amber text-lg");
    }
  }

  course.coins.forEach((c) => {
    if (c.taken || Math.abs(c.s - p.s) > 1.2 + p.len / 2) return;
    if (Math.abs(c.lat - p.lat) < p.w / 2 + 0.55) {
      c.taken = true;
      stats.coins++;
      stats.bonus += Math.round(50 * race.driver.coin);
      audio.coin();
    }
  });
  course.repairs.forEach((r) => {
    if (r.taken || Math.abs(r.s - p.s) > 1.5 + p.len / 2) return;
    if (Math.abs(r.lat - p.lat) < p.w / 2 + 0.7) {
      r.taken = true;
      const before = p.health;
      p.health = Math.min(p.maxHealth, p.health + p.maxHealth * 0.35);
      audio.repair();
      popup(`MECHANIC! +${Math.round(p.health - before)} HP`, "text-[#5fe08f] text-lg");
    }
  });
}

function processTrafficEvents() {
  for (const e of traffic.events) {
    const ds = e.s - player.s;
    if (e.type === "ambientHonk") {
      const right = (e.lat - player.lat) / 20;
      audio.distantHonk(e.vehicle, Math.hypot(ds, e.lat - player.lat), right);
    } else if (e.type === "honkBack") {
      audio.distantHonk("danfo", Math.abs(ds), (e.lat - player.lat) / 10);
      if (clockT - lastDanfoMsg > 4) {
        lastDanfoMsg = clockT;
        popup("Danfo honks back. He's not moving. 🙄", "text-amber text-sm");
      }
    } else if (e.type === "danfoStop" && ds > 0 && ds < 90 && state === "playing" && clockT - lastDanfoMsg > 6) {
      lastDanfoMsg = clockT;
      popup("“OSHODI! OSHODI!” — danfo stopping ahead", "text-amber text-sm");
    }
  }
}

function updateWarnings() {
  const s = player.s;
  let text = "";
  const jam = race.course.jams.find((j) => j.s0 - s > 0 && j.s0 - s < 170);
  const closure = race.course.closures.find((c) => c.s0 - s > 0 && c.s0 - s < 130);
  const crossing = race.course.peds.find((p) => p.kind === "crosser" && p.state === "crossing" && p.s - s > 0 && p.s - s < 70 && Math.abs(p.lat) < race.track.halfWidth);
  if (crossing) text = "⚠ PEDESTRIAN CROSSING";
  else if (closure) text = `ROAD WORKS ${Math.round(closure.s0 - s)} m — ${closure.lane === 0 ? "LEFT" : "RIGHT"} LANE CLOSED`;
  else if (jam) text = `GO-SLOW AHEAD · ${Math.round(jam.s0 - s)} m`;
  else if (race.course.inJam(s)) text = "GO-SLOW · WEAVE THROUGH";
  if (text) {
    ui.warning.textContent = text;
    ui.warning.classList.remove("hidden");
  } else ui.warning.classList.add("hidden");
}

// ---------------------------------------------------------------- jobs feedback
const jobHooks = {
  boarded(job) {
    audio.coin();
    popup(`${job.kind === "parcel" ? `📦 ${job.name}'s parcel${job.fragile ? " (FRAGILE)" : ""}` : `👤 ${job.name}`} → ${Math.round(job.dist)} m · ${naira(job.pay)}`, "text-[#5fe08f] text-lg");
  },
  delivered(job, amount, notes) {
    audio.repair();
    popup(`+${naira(amount)} · ${job.name} delivered`, "text-amber text-2xl");
    if (notes.length) popup(notes.join(" · "), "text-white/80 text-sm");
  },
  missed(job, message) {
    audio.pedestrian();
    popup(message, "text-danger text-base");
  }
};

// ---------------------------------------------------------------- camera
const CAMS = {
  car: { dist: 8.5, height: 3.2, hoodH: 1.25 },
  bike: { dist: 6.2, height: 2.7, hoodH: 1.7 },
  bus: { dist: 10.5, height: 4.3, hoodH: 1.9 }
};
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
function updateCamera(dt, t) {
  const track = race.track;
  const c = CAMS[race.vehicleId];
  const speedRatio = player.v / VEHICLES[race.vehicleId].maxSpeed;
  if (player.autopilot && state === "menu") {
    const a = t * 0.12;
    track.pos(player.s, player.lat, 1.5, tmpB);
    tmpA.set(tmpB.x + Math.cos(a) * 13, tmpB.y + 5 + Math.sin(t * 0.3) * 1.5, tmpB.z + Math.sin(a) * 13);
    camState.pos.lerp(tmpA, camState.init ? Math.min(1, dt * 2) : 1);
    camState.look.copy(tmpB);
    camState.init = true;
    camera.fov = 55;
  } else {
    const mode = settings.camera;
    if (mode === 2) {
      track.pos(player.s + player.len / 2 + 0.15, player.lat, c.hoodH + player.bumpY, tmpA);
      track.pos(player.s + 30, player.lat + player.latV * 0.6, c.hoodH * 0.8, tmpB);
      camState.pos.copy(tmpA);
      camState.look.copy(tmpB);
    } else {
      const k = mode === 1 ? 1.75 : 1;
      track.pos(player.s - c.dist * k - speedRatio * 1.5, player.lat * 0.85, c.height * k * (mode === 1 ? 1.25 : 1), tmpA);
      track.pos(player.s + 14, player.lat * 0.92, 1.1, tmpB);
      if (!camState.init) {
        camState.pos.copy(tmpA);
        camState.look.copy(tmpB);
      }
      camState.pos.lerp(tmpA, Math.min(1, dt * 7));
      camState.look.lerp(tmpB, Math.min(1, dt * 10));
    }
    camState.init = true;
    const portraitBoost = camera.aspect < 1 ? (1 - camera.aspect) * 34 : 0;
    const targetFov = (mode === 2 ? 70 : 60) + speedRatio * 14 + portraitBoost;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
  }
  camera.position.copy(camState.pos);
  if (camState.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * camState.shake;
    camera.position.y += (Math.random() - 0.5) * camState.shake;
    camState.shake = Math.max(0, camState.shake - dt * 2.2);
  }
  camera.lookAt(camState.look);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- HUD & minimap
const miniCtx = ui.minimap.getContext("2d");
const MINI_COLORS = { car: "#d6d6d0", danfo: "#f2b705", okada: "#ff8a4c", truck: "#7fa7d9", tanker: "#e9e6dc", brt: "#3b82f6" };
function drawMinimap() {
  const ctx = miniCtx;
  const W = ui.minimap.width;
  const H = ui.minimap.height;
  const track = race.track;
  const f = track.frame(player.s, {});
  const cos = Math.cos(f.h);
  const sin = Math.sin(f.h);
  const scale = 0.4;
  const cx = W / 2;
  const cy = H * 0.68;
  const project = (x, z) => {
    const dx = x - f.x;
    const dz = z - f.z;
    return [cx + (dx * cos + dz * sin) * scale, cy - (dx * sin - dz * cos) * scale];
  };
  const projectRoad = (s, lat) => {
    const g = track.frame(s, {});
    return project(g.x + Math.cos(g.h) * lat, g.z + Math.sin(g.h) * lat);
  };
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "rgba(10,14,12,.85)";
  ctx.fillRect(0, 0, W, H);
  const stroke = (s0, s1, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    let first = true;
    for (const pt of race.outline) {
      if (pt.s < s0 || pt.s > s1) continue;
      const [x, y] = project(pt.x, pt.z);
      if (first) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      first = false;
    }
    ctx.stroke();
  };
  const roadW = Math.max(5, track.halfWidth * 2 * scale);
  stroke(player.s - 200, Math.min(race.map.length, player.s + 450), "#3a403b", roadW + 3);
  stroke(player.s - 200, Math.min(race.map.length, player.s + 450), "#5b625c", roadW);
  for (const j of race.course.jams) stroke(Math.max(j.s0, player.s - 200), Math.min(j.s1, player.s + 450), "rgba(255,90,60,.55)", roadW);
  for (const c of race.course.closures) {
    const [x, y] = projectRoad((c.s0 + c.s1) / 2, track.laneCenter(c.lane));
    ctx.fillStyle = "#f28c13";
    ctx.fillRect(x - 2, y - 6, 4, 12);
  }
  if (race.map.length - player.s < 450) {
    const [x, y] = projectRoad(race.map.length, 0);
    ctx.fillStyle = "#c9f06b";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🏁", x, y + 5);
  }
  for (const n of traffic.list) {
    if (Math.abs(n.s - player.s) > 300) continue;
    const [x, y] = projectRoad(n.s, n.lat);
    ctx.fillStyle = MINI_COLORS[n.type];
    const len = Math.max(2, n.len * scale);
    ctx.fillRect(x - Math.max(1.5, n.w * scale) / 2, y - len / 2, Math.max(1.5, n.w * scale), len);
  }
  for (const p of race.course.peds) {
    if (p.state !== "crossing" && p.kind !== "hawker") continue;
    if (p.state === "gone" || Math.abs(p.s - player.s) > 300) continue;
    const [x, y] = projectRoad(p.s, p.lat);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const markerDot = (s, color, r) => {
    if (s < player.s - 200 || s > player.s + 450) return;
    const [x, y] = projectRoad(s, track.halfWidth - 1.2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0d1310";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  for (const p of race.jobs.points) if (!p.passed && p.jobs.some((j) => j.state === "waiting")) markerDot(p.s, "#5fe08f", 4.5);
  for (const j of race.jobs.onboard) markerDot(j.toS, j.color, 5);
  for (const r of remote.list) {
    if (Math.abs(r.s - player.s) > 450) continue;
    const [x, y] = projectRoad(r.s, r.lat);
    ctx.fillStyle = DRIVERS[r.driver]?.color || "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const [px, py] = projectRoad(player.s, player.lat);
  ctx.fillStyle = "#c9f06b";
  ctx.beginPath();
  ctx.moveTo(px, py - 7);
  ctx.lineTo(px + 4.5, py + 5);
  ctx.lineTo(px - 4.5, py + 5);
  ctx.closePath();
  ctx.fill();
}

function updateHud() {
  const map = race.map;
  const s = clamp(player.s, 0, map.length);
  ui.distance.textContent = Math.floor(s).toLocaleString();
  ui.progress.style.width = `${(s / map.length) * 100}%`;
  ui.speed.textContent = Math.round(player.v * 3.6);
  ui.time.textContent = formatTime(stats.time);
  ui.score.textContent = computeScore(false).total.toLocaleString();
  ui.combo.textContent = stats.combo > 1 ? `×${stats.combo}` : "";
  const pct = player.health / player.maxHealth;
  ui.health.style.width = `${pct * 100}%`;
  ui.health.style.background = pct > 0.6 ? "#c9f06b" : pct > 0.3 ? "#f2b705" : "#ff5a3c";
  ui.healthText.textContent = `${Math.round(pct * 100)}%`;
  ui.near.textContent = stats.near;
  ui.coins.textContent = stats.coins;
  const jobs = race.jobs;
  ui.hudSeats.textContent = `${jobs.seatsUsed}/${jobs.capacity}`;
  ui.hudEarned.textContent = naira(jobs.earned);
  const key = jobs.onboard.map((j) => `${j.id}:${Math.ceil(j.timeLeft)}:${Math.round((j.toS - player.s) / 10)}`).join("|");
  if (key !== lastJobsKey) {
    lastJobsKey = key;
    ui.hudJobs.innerHTML = jobs.onboard.map((j) => {
      const late = j.timeLeft < 0;
      const t = Math.abs(Math.ceil(j.timeLeft));
      return `<li class="flex items-center gap-2 text-[11px]"><span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${j.color}"></span><span class="truncate">${j.kind === "parcel" ? "📦" : "👤"} ${escapeHtml(j.name)}</span><span class="ml-auto whitespace-nowrap font-mono text-white/60">${Math.max(0, Math.round(j.toS - player.s))} m</span><span class="w-10 text-right font-mono ${late ? "text-danger" : t < 10 ? "text-amber" : "text-white/60"}">${late ? "+" : ""}${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}</span></li>`;
    }).join("");
  }
  if (jobs.status) {
    ui.jobStatus.textContent = jobs.status;
    ui.jobStatus.classList.remove("hidden");
  } else ui.jobStatus.classList.add("hidden");
  if (mp && clockT - mp.boardT > 0.25) {
    mp.boardT = clockT;
    ui.hudMpList.innerHTML = standings().map((e, i) => `<li class="flex items-center gap-1.5 ${e.me ? "font-bold text-lime" : "text-white/80"}"><span class="w-3 font-mono text-[9px] text-white/40">${i + 1}</span><span class="h-2 w-2 shrink-0 rounded-full" style="background:${DRIVERS[e.driver]?.color || "#fff"}"></span><span class="min-w-0 flex-1 truncate">${escapeHtml(e.name)}${e.flag ? " " + e.flag : ""}</span><span class="font-mono text-[10px]">${e.score.toLocaleString()}</span></li>`).join("");
  }
  vignetteTimer = Math.max(0, vignetteTimer - 1 / 60);
  ui.vignette.style.opacity = String(Math.max(vignetteTimer * 2.2, pct < 0.25 ? 0.35 + Math.sin(clockT * 6) * 0.15 : 0));
  drawMinimap();
}

// ---------------------------------------------------------------- loop
function placePlayer(t) {
  const yaw = Math.atan2(player.latV, Math.max(player.v, 3));
  race.track.place(race.playerMesh, player.s, player.lat, 0, yaw);
  const inner = race.playerMesh.userData.inner;
  inner.position.y = player.bumpY + (player.offroad ? Math.sin(t * 40) * 0.03 : 0);
  inner.rotation.z = race.vehicleId === "bike" ? -player.latV * 0.09 : -player.latV * 0.012;
  inner.rotation.x = race.vehicleId === "bike" ? 0 : -player.bumpY * 0.15;
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clockT += rawDt;
  if (!race) return;

  const simulating = state === "playing" || state === "finished" || state === "wrecked" || state === "menu";
  if (state === "countdown") {
    const before = Math.ceil(countdownT);
    countdownT = mp ? (mp.startAt - now) / 1000 : countdownT - rawDt;
    const after = Math.ceil(countdownT);
    if (after !== before) {
      if (after > 0) { if (after <= 3) { showCount(String(after)); audio.countdown(); } }
      else { showCount("GO!"); audio.countdown(true); state = "playing"; }
    }
    audio.updateEngine(0, input.gas ? 1 : 0);
  }

  if (simulating) {
    const steps = Math.ceil(rawDt / (1 / 60));
    const dt = rawDt / steps;
    for (let i = 0; i < steps; i++) {
      if (state === "playing") stats.time += dt;
      updatePlayer(dt);
      traffic.update(dt, player, clockT);
      handleCollisions();
    }
    // online: race time is wall-clock time since GO, so a hidden tab can't freeze your timer
    if (mp && state === "playing") stats.time = Math.max(0, (now - mp.startAt) / 1000);
    stats.maxS = Math.max(stats.maxS, player.s);
    stats.comboT -= rawDt;
    if (stats.comboT <= 0) stats.combo = 1;
    hornCooldown -= rawDt;
    if (input.horn && hornCooldown <= 0 && state === "playing") { traffic.honk(player); hornCooldown = 0.7; }
    processTrafficEvents();
    race.course.update(rawDt, clockT, player);
    race.jobs.update(rawDt, clockT, player, state === "playing", jobHooks);

    if (state === "playing" && player.s >= race.map.length) finishRace(true);
    if (state === "finished" || state === "wrecked") {
      endTimer -= rawDt;
      if (endTimer <= 0) showEnd();
    }
    if (state === "menu" && player.s > race.map.length - 50) {
      // loop the showcase drive
      player.s = 4;
      traffic.reset(race.map, race.track, race.course, race.vehicleId);
      traffic.populate(player);
    }
    if (state !== "menu") audio.updateEngine(player.v / race.spec.maxSpeed, input.gas ? 1 : 0);

    // smoke when damaged
    const pct = player.health / player.maxHealth;
    if (pct < 0.4 && Math.random() < (0.45 - pct) * rawDt * 40) {
      race.track.pos(player.s - player.len * 0.1, player.lat, 1.2, playerWorld);
      emit(playerWorld, { color: pct < 0.15 ? 0x222222 : 0x777777, size: 0.8, life: 1.4, vel: [0, 2, 0], spread: 0.8 });
    }
  }

  if (mp) {
    remote.update(rawDt, now, clockT);
    if (online.connected && state !== "countdown" && now - mp.lastSend > 66) {
      mp.lastSend = now;
      online.send({ type: "state", s: player.s, lat: player.lat, v: player.v, latV: player.latV, hp: player.health / player.maxHealth, sc: computeScore(false).total, horn: input.horn });
    }
  }
  updateParticles(rawDt);
  placePlayer(clockT);
  if (state !== "paused") updateCamera(rawDt, clockT);
  race.track.pos(player.s, player.lat, 0, playerWorld);
  race.world.update(clockT, camera.position, playerWorld);
  if (state !== "menu") {
    updateHud();
    updateWarnings();
  }
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- online multiplayer
function updateOnlineButton() {
  ui.onlineBtn.textContent = online.room ? `ONLINE · ROOM ${online.room.code}` : "PLAY ONLINE";
}
function showOnlineError(text) {
  if (ui.online.classList.contains("hidden")) { toast(text); return; }
  ui.onlineError.textContent = text;
  ui.onlineError.classList.remove("hidden");
}
const clearOnlineError = () => ui.onlineError.classList.add("hidden");
function paintHex() {
  const c = paintColor(career, settings.vehicle, VEHICLES[settings.vehicle].color);
  return `#${(c >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
}
const onlineProfile = () => ({ name: profile.name || "Driver", avatar: profile.avatar || null, vehicle: settings.vehicle, driver: settings.driver, paint: paintHex() });

function openOnline() {
  clearOnlineError();
  show(ui.online);
  renderOnline();
  if (online.room && online.room.phase === "lobby") online.send({ type: "profile", ...onlineProfile() });
}
const closeOnline = () => hide(ui.online);

async function connectOnline() {
  try {
    await online.connect();
    clearOnlineError();
    return true;
  } catch (error) {
    showOnlineError(STATIC_HOST ? `${error.message}. The online server may be down. Try again in a minute.` : `${error.message}. Is the game server running?`);
    return false;
  }
}
async function createRoom() {
  clearOnlineError();
  if (await connectOnline()) online.send({ type: "create", map: settings.map, ...onlineProfile() });
}
async function joinRoom(raw) {
  clearOnlineError();
  const code = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 4) { showOnlineError("Room codes are 4 characters, like K7QX."); return; }
  if (await connectOnline()) online.send({ type: "join", code, ...onlineProfile() });
}

const MEDALS = ["🥇", "🥈", "🥉"];
function resultRows(rows, final) {
  return rows.map((r, i) => `<li class="flex items-center gap-2 ${r.me ? "text-lime" : ""}">
    <span class="w-6 shrink-0 text-center ${final && i < 3 ? "" : "font-mono text-[10px] text-white/40"}">${final && i < 3 ? MEDALS[i] : i + 1}</span>
    <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${DRIVERS[r.driver]?.color || "#fff"}"></span>
    <span class="min-w-0 flex-1 truncate font-semibold">${escapeHtml(r.name)}${r.me ? ` <span class="font-normal text-white/40">(you)</span>` : ""}</span>
    <span class="whitespace-nowrap font-mono text-[10px] text-white/50">${r.detail}</span>
    <span class="w-16 shrink-0 text-right font-display font-bold">${r.score.toLocaleString()}</span></li>`).join("");
}
const finalRow = (r) => ({
  me: r.id === online.you, name: r.name, driver: r.driver, score: r.score,
  detail: r.dnf ? "DNF" : r.wrecked ? "WRECKED" : `${formatTime(r.time)} · ${naira(r.earned)}`
});

function renderOnline() {
  updateOnlineButton();
  const room = online.room;
  ui.onlineConnect.classList.toggle("hidden", !!room);
  ui.onlineLobby.classList.toggle("hidden", !room);
  if (!room) return;
  const me = room.players.find((p) => p.id === online.you);
  const host = online.isHost;
  ui.onlineRoomCode.textContent = room.code;
  ui.onlineMap.classList.toggle("hidden", !host);
  ui.onlineMapName.classList.toggle("hidden", host);
  ui.onlineMapName.textContent = MAPS[room.map]?.name || room.map;
  if (host) {
    ui.onlineMap.innerHTML = Object.values(MAPS).filter((m) => career.routes.includes(m.id) || m.id === room.map)
      .map((m) => `<option value="${m.id}" ${m.id === room.map ? "selected" : ""}>${m.name}</option>`).join("");
  }
  ui.onlineVehicle.innerHTML = Object.values(VEHICLES).filter((v) => career.vehicles.includes(v.id))
    .map((v) => `<option value="${v.id}" ${v.id === settings.vehicle ? "selected" : ""}>${ICONS[v.id]} ${v.name}</option>`).join("");
  ui.onlineDriver.innerHTML = Object.values(DRIVERS)
    .map((d) => `<option value="${d.id}" ${d.id === settings.driver ? "selected" : ""}>${d.name}</option>`).join("");

  ui.onlinePlayers.innerHTML = room.players.map((p) => {
    const pic = p.avatar && AVATAR_RE.test(p.avatar) ? `<img src="${p.avatar}" alt="" class="h-full w-full object-cover">` : driverPortrait(DRIVERS[p.driver] || DRIVERS.nkechi, "h-full w-full");
    const badge = p.id === room.hostId
      ? `<span class="rounded bg-amber/15 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-amber">HOST</span>`
      : p.ready
        ? `<span class="rounded bg-lime/15 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-lime">READY</span>`
        : `<span class="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-white/40">NOT READY</span>`;
    return `<li class="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 ${p.id === online.you ? "ring-1 ring-lime/40" : ""}">
      <span class="block h-9 w-9 shrink-0 overflow-hidden rounded-full">${pic}</span>
      <span class="min-w-0 flex-1"><span class="block truncate text-sm font-bold">${escapeHtml(p.name)}${p.id === online.you ? ` <span class="font-normal text-white/40">(you)</span>` : ""}</span>
      <span class="block truncate text-[11px] text-white/50">${ICONS[p.vehicle] || ""} ${VEHICLES[p.vehicle]?.name || ""} · ${DRIVERS[p.driver]?.name || ""}</span></span>${badge}</li>`;
  }).join("");

  const allReady = room.players.every((p) => p.id === room.hostId || p.ready);
  ui.onlineReady.classList.toggle("hidden", host);
  ui.onlineStart.classList.toggle("hidden", !host);
  ui.onlineStart.disabled = !allReady;
  ui.onlineStart.textContent = room.players.length > 1 ? `START RACE (${room.players.length} DRIVERS)` : "START (JUST ME)";
  ui.onlineReady.textContent = me?.ready ? "NOT READY YET" : "I'M READY";
  ui.onlineHint.textContent = host
    ? room.players.length === 1 ? "Share the room code or invite link with your friends." : allReady ? "Everyone is ready. Start when you like." : "Waiting for everyone to press I'M READY."
    : me?.ready ? "Waiting for the host to start the race." : "Pick your ride, then press I'M READY.";

  if (lastResults?.length) {
    ui.onlineResults.innerHTML = `<div class="mb-2 font-mono text-[9px] tracking-widest text-lime/80">LAST RACE</div><ol class="space-y-1.5 text-sm">${resultRows(lastResults.map(finalRow), true)}</ol>`;
    ui.onlineResults.classList.remove("hidden");
  } else ui.onlineResults.classList.add("hidden");
}

/** Everyone in the race, best score first (live scores while driving). */
function standings() {
  const me = {
    me: true, name: profile.name || "You", driver: settings.driver,
    score: mp.mine ? mp.mine.score : computeScore(false).total,
    flag: mp.mine ? (mp.mine.wrecked ? "💥" : "🏁") : "",
    detail: mp.mine ? (mp.mine.wrecked ? "WRECKED" : `${formatTime(mp.mine.time)} · ${naira(mp.mine.earned)}`) : "driving"
  };
  const others = remote.list.map((r) => ({
    me: false, name: r.name, driver: r.driver,
    score: r.finished ? r.finished.score : r.score,
    flag: r.finished ? (r.finished.wrecked ? "💥" : "🏁") : "",
    detail: r.finished ? (r.finished.wrecked ? "WRECKED" : `${formatTime(r.finished.time)} · ${naira(r.finished.earned)}`) : `driving · ${Math.max(0, Math.round(r.s)).toLocaleString()} m`
  }));
  return [me, ...others].sort((a, b) => b.score - a.score);
}

function renderEndStandings() {
  if (!mp) return;
  const final = mp.results;
  const waiting = final ? 0 : remote.list.filter((r) => !r.finished).length;
  ui.endMpTitle.textContent = final ? "FINAL RESULTS" : "RACE RESULTS";
  ui.endMpNote.textContent = mp.offline ? "connection lost" : waiting ? `waiting for ${waiting} driver${waiting > 1 ? "s" : ""}…` : "";
  ui.endMpList.innerHTML = final ? resultRows(final.map(finalRow), true) : resultRows(standings(), false);
}

function startOnlineRace(msg) {
  if (!MAPS[msg.map]) return;
  audio.ensure();
  closeOnline();
  closeGarage();
  hide(ui.menu);
  hide(ui.end);
  hide(ui.pause);
  const order = msg.players.map((p) => p.id);
  mp = { startAt: performance.now() + msg.in, lastSend: 0, boardT: 0, sentFinish: false, mine: null, results: null, offline: false };
  ui.loadingName.textContent = MAPS[msg.map].name;
  show(ui.loading);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!mp) return;
    buildRace(msg.map, settings.vehicle, false, msg.seed, Math.max(0, order.indexOf(online.you)));
    remote.setup(race.track, msg.players.filter((p) => p.id !== online.you));
    for (const r of remote.list) Object.assign(r, gridSlot(order.indexOf(r.id), race.track));
    hide(ui.loading);
    show(ui.hud, "block");
    show(ui.hudMp, "block");
    ui.touch.classList.add("playing");
    state = "countdown";
    countdownT = Math.max(0.3, (mp.startAt - performance.now()) / 1000);
    if (countdownT > 3) ui.countdown.innerHTML = `<span class="count text-4xl sm:text-6xl">GET READY</span>`;
    else showCount(String(Math.ceil(countdownT)));
    if (settings.sound) audio.startEngine(settings.vehicle);
  }));
}

function backToLobby() {
  backToMenu();
  if (online.room) openOnline();
  else toast("You're no longer in the online room.");
}

function leaveRace() {
  if (mp && !mp.sentFinish && race) {
    mp.sentFinish = true;
    const sc = computeScore(false);
    online.send({ type: "finish", score: sc.total, time: stats.time, earned: Math.round(race.jobs.earned), distance: sc.distance, wrecked: true });
  }
  hide(ui.pause);
  backToLobby();
}

online.on("room", () => renderOnline());
online.on("left-room", () => renderOnline());
online.on("error", (msg) => showOnlineError(msg.message));
online.on("start", (msg) => startOnlineRace(msg));
online.on("state", (msg) => {
  if (!mp || !race) return;
  const honk = remote.onState(msg, performance.now());
  if (honk) audio.distantHonk(honk.hornType, Math.hypot(honk.s - player.s, honk.lat - player.lat), clamp((honk.lat - player.lat) / 20, -1, 1));
});
online.on("finished", (msg) => {
  if (!mp) return;
  const r = remote.get(msg.id);
  if (r) {
    r.finished = msg;
    if (state === "playing") popup(`${r.name} ${msg.wrecked ? "is out 💥" : "finished 🏁"}`, "text-white/85 text-sm");
  }
  if (state === "ended") renderEndStandings();
});
online.on("left", (msg) => {
  if (!mp) return;
  const r = remote.get(msg.id);
  if (!r) return;
  if (state === "playing") popup(`${r.name} left the race`, "text-white/70 text-sm");
  remote.remove(msg.id);
  if (state === "ended") renderEndStandings();
});
online.on("results", (msg) => {
  lastResults = msg.results;
  if (mp) {
    mp.results = msg.results;
    if (state === "ended") renderEndStandings();
  }
  renderOnline();
});
online.on("waking", () => showOnlineError("Connecting to the game server. The free server can take up to a minute to wake up…"));
online.on("closed", ({ hadRoom }) => {
  if (mp) {
    mp.offline = true;
    remote.dispose();
    if (state === "playing" || state === "countdown") popup("Connection lost. You're driving solo now.", "text-danger text-base");
    if (state === "ended") renderEndStandings();
  } else if (hadRoom) showOnlineError("Lost connection to the game server.");
  renderOnline();
});

ui.onlineBtn.addEventListener("click", openOnline);
ui.onlineClose.addEventListener("click", closeOnline);
ui.online.addEventListener("click", (e) => { if (e.target === ui.online) closeOnline(); });
ui.onlineCreate.addEventListener("click", createRoom);
ui.onlineJoinForm.addEventListener("submit", (e) => { e.preventDefault(); joinRoom(ui.onlineCode.value); });
ui.onlineCode.addEventListener("input", () => { ui.onlineCode.value = ui.onlineCode.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
ui.onlineCopy.addEventListener("click", async () => {
  const link = `${location.origin}/?room=${online.room?.code || ""}`;
  try {
    await navigator.clipboard.writeText(link);
    toast("Invite link copied. Send it to your friends.");
  } catch {
    toast(link);
  }
});
ui.onlineMap.addEventListener("change", () => online.send({ type: "map", map: ui.onlineMap.value }));
const changeRide = () => {
  if (career.vehicles.includes(ui.onlineVehicle.value)) settings.vehicle = ui.onlineVehicle.value;
  if (DRIVERS[ui.onlineDriver.value]) settings.driver = ui.onlineDriver.value;
  storage.set("lts-vehicle", settings.vehicle);
  storage.set("lts-driver", settings.driver);
  online.send({ type: "profile", ...onlineProfile() });
  renderMenu();
  if (state === "menu") buildRace(settings.map, settings.vehicle, true);
};
ui.onlineVehicle.addEventListener("change", changeRide);
ui.onlineDriver.addEventListener("change", changeRide);
ui.onlineReady.addEventListener("click", () => online.send({ type: "profile", ready: !online.player(online.you)?.ready }));
ui.onlineStart.addEventListener("click", () => online.send({ type: "start" }));
ui.onlineLeave.addEventListener("click", () => { online.leave(); lastResults = null; renderOnline(); });

/** ?room=ABCD invite links open the lobby and join straight away. */
function checkInviteLink() {
  const code = (new URLSearchParams(location.search).get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (!code) return;
  history.replaceState(null, "", location.pathname);
  openOnline();
  ui.onlineCode.value = code;
  joinRoom(code);
}

// ---------------------------------------------------------------- boot
resize();
renderMenu();
buildRace(settings.map, settings.vehicle, true);
requestAnimationFrame(frame);
window.__lts = { get state() { return state; }, get player() { return player; }, get race() { return race; }, get mp() { return mp; }, traffic, remote, online, startRace };
checkInviteLink();
