const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { attachMultiplayer } = require("./multiplayer");

const port = Number(process.env.PORT) || 3000;
const publicDir = path.join(__dirname, "public");
const threeDir = path.join(__dirname, "node_modules", "three");
const dataDir = path.join(__dirname, "data");
const scoresFile = path.join(dataDir, "scores.json");

const MAPS = ["third-mainland", "ikorodu", "lekki", "oshodi"];
const VEHICLES = ["car", "keke", "bike", "bus", "molue", "power", "suv"];
const MAX_PER_BOARD = 10;
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".glb": "model/gltf-binary"
};

function loadScores() {
  try {
    return JSON.parse(fs.readFileSync(scoresFile, "utf8"));
  } catch {
    return {};
  }
}

let scores = loadScores();

function saveScores() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFile(scoresFile, JSON.stringify(scores, null, 2), (error) => {
    if (error) console.error("Could not save scores:", error.message);
  });
}

// Pages copies of the game (e.g. https://mr-chigozie.github.io) call this API from another origin.
// CLIENT_ORIGINS is a comma-separated allow list; empty means any origin.
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
function corsHeaders(request) {
  const origin = request.headers.origin;
  if (!origin) return {};
  if (CLIENT_ORIGINS.length && !CLIENT_ORIGINS.includes(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" };
}

function sendJson(response, status, body) {
  response.writeHead(status, { ...response.cors, "Content-Type": contentTypes[".json"], "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function readBody(request, limit = 48000) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("Body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function handleScores(request, response, url) {
  if (request.method === "GET") {
    const map = url.searchParams.get("map");
    if (map && !MAPS.includes(map)) return sendJson(response, 400, { error: "Unknown map" });
    return sendJson(response, 200, map ? { [map]: scores[map] || [] } : scores);
  }

  if (request.method === "POST") {
    let payload;
    try {
      payload = JSON.parse(await readBody(request));
    } catch {
      return sendJson(response, 400, { error: "Invalid JSON" });
    }
    const name = String(payload.name || "").replace(/[^\w .-]/g, "").trim().slice(0, 16) || "Anonymous";
    const { map, vehicle } = payload;
    const score = Math.floor(Number(payload.score));
    const time = Number(payload.time);
    if (!MAPS.includes(map) || !VEHICLES.includes(vehicle)) return sendJson(response, 400, { error: "Unknown map or vehicle" });
    if (!Number.isFinite(score) || score < 0 || score > 1e7 || !Number.isFinite(time) || time <= 0 || time > 3600) {
      return sendJson(response, 400, { error: "Invalid score" });
    }

    // optional small profile photo (the client sends a 96×96 JPEG data URL)
    const avatar = typeof payload.avatar === "string" && payload.avatar.length <= 40000 && AVATAR_RE.test(payload.avatar) ? payload.avatar : undefined;
    const earned = Math.max(0, Math.min(1e7, Math.floor(Number(payload.earned) || 0)));

    const board = scores[map] || [];
    const entry = { name, vehicle, score, time: Math.round(time * 100) / 100, earned, avatar, date: new Date().toISOString() };
    board.push(entry);
    board.sort((a, b) => b.score - a.score);
    scores[map] = board.slice(0, MAX_PER_BOARD);
    saveScores();
    return sendJson(response, 201, { rank: scores[map].indexOf(entry) + 1, board: scores[map] });
  }

  response.writeHead(405, { Allow: "GET, POST" });
  response.end();
}

function serveFile(response, baseDir, relativePath) {
  const filePath = path.resolve(baseDir, `.${relativePath}`);
  if (!filePath.startsWith(baseDir + path.sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  let url;
  try {
    url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) {
    response.cors = corsHeaders(request);
    if (request.method === "OPTIONS") {
      response.writeHead(204, response.cors);
      response.end();
      return;
    }
  }
  if (pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }
  if (pathname === "/api/scores") {
    handleScores(request, response, url).catch(() => sendJson(response, 500, { error: "Server error" }));
    return;
  }
  if (pathname.startsWith("/vendor/three/")) {
    serveFile(response, threeDir, pathname.slice("/vendor/three".length));
    return;
  }
  serveFile(response, publicDir, pathname === "/" ? "/index.html" : pathname);
});
attachMultiplayer(server);
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use (probably another copy of this server).`);
    console.error(`Stop the other one, or run on a different port:  $env:PORT=3001; npm start`);
    process.exit(1);
  }
  throw error;
}).listen(port, () => {
  console.log(`Lagos Traffic Survivor 3D is running at http://localhost:${port}`);
  // other devices on the same Wi-Fi can join online games through these addresses
  const lan = Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => `http://${a.address}:${port}`);
  if (lan.length) console.log(`Friends on the same Wi-Fi can open: ${lan.join("  or  ")}`);
});
