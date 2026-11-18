// Online multiplayer: rooms with a 4-letter code, a lobby, and a live race relay.
// Each client simulates its own car, traffic and jobs; the server only relays positions
// and collects results. Everything a client sends is validated and clamped here.
const { WebSocketServer } = require("ws");
const crypto = require("node:crypto");

const MAPS = ["third-mainland", "ikorodu", "lekki", "oshodi"];
const VEHICLES = ["car", "keke", "bike", "bus", "molue", "power", "suv"];
const DRIVERS = ["nkechi", "tunde", "chidi", "aisha", "emeka", "funke"];
const OUTFITS = 3; // outfits per driver
const PAINT_RE = /^#[0-9a-f]{6}$/i;
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid mix-ups
const MAX_PLAYERS = 6;
const MAX_ROOMS = 200;
const START_DELAY_MS = 5000; // time to build the world before "GO"
const RACE_LIMIT_MS = 15 * 60 * 1000;

const rooms = new Map();
let nextId = 1;

const num = (v, min, max, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
const cleanName = (v) => String(v || "").replace(/[^\w .-]/g, "").trim().slice(0, 16) || "Driver";

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function broadcast(room, msg, except = null) {
  const data = JSON.stringify(msg);
  for (const p of room.players) if (p !== except && p.ws.readyState === 1) p.ws.send(data);
}

function publicPlayer(p) {
  return { id: p.id, name: p.name, avatar: p.avatar, vehicle: p.vehicle, driver: p.driver, outfit: p.outfit, paint: p.paint, ready: p.ready, inRace: p.inRace };
}
function roomInfo(room) {
  return { type: "room", code: room.code, hostId: room.host.id, map: room.map, phase: room.phase, players: room.players.map(publicPlayer) };
}
const sendRoom = (room) => broadcast(room, roomInfo(room));

function newCode() {
  for (let tries = 0; tries < 50; tries++) {
    let code = "";
    for (let i = 0; i < 4; i++) code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!rooms.has(code)) return code;
  }
  return null;
}

function applyProfile(p, msg) {
  if (msg.name !== undefined) p.name = cleanName(msg.name);
  if (msg.avatar !== undefined) p.avatar = typeof msg.avatar === "string" && msg.avatar.length <= 40000 && AVATAR_RE.test(msg.avatar) ? msg.avatar : null;
  if (VEHICLES.includes(msg.vehicle)) p.vehicle = msg.vehicle;
  if (DRIVERS.includes(msg.driver)) p.driver = msg.driver;
  if (Number.isInteger(msg.outfit) && msg.outfit >= 0 && msg.outfit < OUTFITS) p.outfit = msg.outfit;
  if (typeof msg.paint === "string" && PAINT_RE.test(msg.paint)) p.paint = msg.paint;
}

/** Two "Driver"s in one room is confusing: number the duplicates. */
function uniqueName(room, p) {
  const base = p.name.slice(0, 13);
  let name = p.name;
  for (let n = 2; room.players.some((x) => x !== p && x.name.toLowerCase() === name.toLowerCase()); n++) name = `${base} ${n}`;
  p.name = name;
}

function leaveRoom(p) {
  const room = p.room;
  if (!room) return;
  p.room = null;
  room.players = room.players.filter((x) => x !== p);
  if (!room.players.length) {
    clearTimeout(room.raceTimer);
    rooms.delete(room.code);
    return;
  }
  if (room.host === p) room.host = room.players[0];
  broadcast(room, { type: "left", id: p.id });
  sendRoom(room);
  if (room.phase === "racing") checkRaceOver(room);
}

function startRace(room) {
  room.phase = "racing";
  room.seed = crypto.randomInt(1e9);
  room.results = [];
  for (const p of room.players) {
    p.inRace = true;
    p.result = null;
  }
  broadcast(room, { type: "start", map: room.map, seed: room.seed, in: START_DELAY_MS, players: room.players.map(publicPlayer) });
  clearTimeout(room.raceTimer);
  room.raceTimer = setTimeout(() => endRace(room), RACE_LIMIT_MS + START_DELAY_MS);
  sendRoom(room);
}

function checkRaceOver(room) {
  if (room.phase !== "racing") return;
  if (room.players.every((p) => !p.inRace || p.result)) endRace(room);
}

function endRace(room) {
  if (room.phase !== "racing") return;
  clearTimeout(room.raceTimer);
  room.phase = "lobby";
  const results = room.players.filter((p) => p.inRace).map((p) => ({ id: p.id, name: p.name, vehicle: p.vehicle, driver: p.driver, ...(p.result || { score: 0, time: 0, earned: 0, distance: 0, wrecked: true, dnf: true }) }));
  results.sort((a, b) => b.score - a.score);
  for (const p of room.players) {
    p.inRace = false;
    p.ready = false;
  }
  broadcast(room, { type: "results", results });
  sendRoom(room);
}

function handle(p, msg) {
  const room = p.room;
  switch (msg.type) {
    case "create": {
      if (room) leaveRoom(p);
      if (rooms.size >= MAX_ROOMS) return send(p.ws, { type: "error", message: "Server is full, try again later." });
      const code = newCode();
      if (!code) return send(p.ws, { type: "error", message: "Could not create a room." });
      applyProfile(p, msg);
      const r = { code, host: p, players: [p], map: MAPS.includes(msg.map) ? msg.map : MAPS[0], phase: "lobby", seed: 0, raceTimer: null };
      rooms.set(code, r);
      p.room = r;
      p.ready = false;
      send(p.ws, { type: "joined", you: p.id, code });
      return sendRoom(r);
    }
    case "join": {
      const code = String(msg.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      const r = rooms.get(code);
      if (!r) return send(p.ws, { type: "error", message: `No room called ${code || "that"}. Check the code.` });
      if (r === room) return;
      if (r.players.length >= MAX_PLAYERS) return send(p.ws, { type: "error", message: "That room is full (6 drivers)." });
      if (r.phase === "racing") return send(p.ws, { type: "error", message: "That room is mid-race. Try again when they finish." });
      if (room) leaveRoom(p);
      applyProfile(p, msg);
      p.room = r;
      p.ready = false;
      r.players.push(p);
      uniqueName(r, p);
      send(p.ws, { type: "joined", you: p.id, code });
      return sendRoom(r);
    }
    case "leave":
      leaveRoom(p);
      return send(p.ws, { type: "left-room" });
    case "profile":
      if (!room || room.phase !== "lobby") return;
      applyProfile(p, msg);
      uniqueName(room, p);
      if (msg.ready !== undefined) p.ready = !!msg.ready;
      return sendRoom(room);
    case "map":
      if (!room || room.host !== p || room.phase !== "lobby" || !MAPS.includes(msg.map)) return;
      room.map = msg.map;
      return sendRoom(room);
    case "start":
      if (!room || room.host !== p || room.phase !== "lobby") return;
      if (room.players.some((x) => x !== p && !x.ready)) return send(p.ws, { type: "error", message: "Wait until everyone is ready." });
      return startRace(room);
    case "state": {
      if (!room || room.phase !== "racing" || !p.inRace || p.result) return;
      const now = Date.now();
      if (now - p.lastState < 30) return; // ~30 updates/s max
      p.lastState = now;
      return broadcast(room, {
        type: "state", id: p.id,
        s: num(msg.s, -50, 20000), lat: num(msg.lat, -30, 30), v: num(msg.v, 0, 80), latV: num(msg.latV, -20, 20),
        hp: num(msg.hp, 0, 1), sc: Math.round(num(msg.sc, 0, 1e7)), horn: !!msg.horn
      }, p);
    }
    case "finish": {
      if (!room || room.phase !== "racing" || !p.inRace || p.result) return;
      p.result = {
        score: Math.round(num(msg.score, 0, 1e7)), time: Math.round(num(msg.time, 0, 3600) * 100) / 100,
        earned: Math.round(num(msg.earned, 0, 1e7)), distance: Math.round(num(msg.distance, 0, 20000)), wrecked: !!msg.wrecked
      };
      broadcast(room, { type: "finished", id: p.id, ...p.result });
      return checkRaceOver(room);
    }
    default:
  }
}

function attachMultiplayer(server) {
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 64 * 1024 });

  wss.on("connection", (ws) => {
    const p = { id: nextId++, ws, room: null, name: "Driver", avatar: null, vehicle: "car", driver: "nkechi", outfit: 0, paint: "#e8e6df", ready: false, inRace: false, result: null, lastState: 0, budget: 60 };
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });
    ws.on("message", (data) => {
      // crude flood protection: ~60 messages per second on average
      if (--p.budget < 0) return;
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (msg && typeof msg === "object" && typeof msg.type === "string") handle(p, msg);
    });
    ws.on("close", () => leaveRoom(p));
    ws.on("error", () => {});
    const refill = setInterval(() => { p.budget = Math.min(120, p.budget + 60); }, 1000);
    ws.on("close", () => clearInterval(refill));
    send(ws, { type: "hello", id: p.id });
  });

  // drop connections that stopped answering (closed laptops, dead phones)
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 20000);
  wss.on("close", () => clearInterval(heartbeat));
  return wss;
}

module.exports = { attachMultiplayer };
