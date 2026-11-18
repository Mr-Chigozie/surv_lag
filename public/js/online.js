import * as THREE from "three";
import { VEHICLES, DRIVERS, outfitOf } from "./maps.js";
import { buildVehicle } from "./models.js";
import { STATIC_HOST, wsUrl, wakeServer } from "./config.js";

/** Thin WebSocket client for rooms, lobby and race messages. */
export class Online {
  constructor() {
    this.ws = null;
    this.you = null;
    this.room = null;
    this.handlers = {};
    this.connecting = null;
  }

  get connected() { return this.ws && this.ws.readyState === 1; }
  get isHost() { return !!this.room && this.room.hostId === this.you; }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); }
  emit(type, msg) { for (const fn of this.handlers[type] || []) fn(msg); }

  connect() {
    if (this.connected) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      // a sleeping free server has to wake before it accepts the WebSocket
      if (STATIC_HOST) {
        this.emit("waking", {});
        if (!(await wakeServer())) { this.connecting = null; throw new Error("Could not reach the game server"); }
      }
      return this.open();
    })();
    return this.connecting;
  }

  open() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl());
      this.ws = ws;
      const timer = setTimeout(() => { ws.close(); reject(new Error("Server did not answer")); }, 8000);
      ws.onopen = () => { clearTimeout(timer); this.connecting = null; resolve(); };
      ws.onerror = () => { clearTimeout(timer); this.connecting = null; reject(new Error("Could not reach the game server")); };
      ws.onclose = () => {
        this.connecting = null;
        const hadRoom = !!this.room;
        this.room = null;
        this.ws = null;
        this.emit("closed", { hadRoom });
      };
      ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.type === "joined") this.you = msg.you;
        if (msg.type === "room") this.room = msg;
        if (msg.type === "left-room") this.room = null;
        this.emit(msg.type, msg);
      };
    });
  }

  send(msg) { if (this.connected) this.ws.send(JSON.stringify(msg)); }
  leave() { this.send({ type: "leave" }); this.room = null; }
  player(id) { return this.room?.players.find((p) => p.id === id); }
}

// ---------------------------------------------------------------- remote cars

const HORN_TYPE = { car: "car", bike: "okada", bus: "danfo" }; // others use their own horn

function nameTag(name, color) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.font = "bold 30px 'Space Grotesk', sans-serif";
  const w = Math.min(248, ctx.measureText(name).width + 34);
  ctx.fillStyle = "rgba(13,19,16,.78)";
  ctx.beginPath();
  ctx.roundRect((256 - w) / 2, 8, w, 46, 23);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc((256 - w) / 2 + 20, 31, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4f3e9";
  ctx.textBaseline = "middle";
  ctx.fillText(name, (256 - w) / 2 + 33, 32, w - 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  sprite.scale.set(2.8, 0.7, 1);
  sprite.renderOrder = 5;
  return sprite;
}

/** The other players' vehicles, smoothed between network updates. */
export class RemoteCars {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  setup(track, players) {
    this.dispose();
    this.track = track;
    for (const p of players) {
      const spec = VEHICLES[p.vehicle] || VEHICLES.car;
      const rider = parseInt(outfitOf(p.driver, p.outfit).shirt.slice(1), 16);
      const mesh = buildVehicle(spec.model, parseInt(String(p.paint || "#e8e6df").slice(1), 16), 0, rider);
      const tag = nameTag(p.name, DRIVERS[p.driver]?.color || "#c9f06b");
      tag.position.y = spec.tagY + 0.9;
      mesh.add(tag);
      this.scene.add(mesh);
      this.list.push({
        id: p.id, name: p.name, vehicle: spec.id, driver: p.driver, mesh, tag, lean: spec.lean,
        s: 4, lat: track.laneCenter(Math.floor(track.lanes / 2)), v: 0, latV: 0,
        net: null, len: spec.length, w: spec.width, hp: 1, score: 0, horn: false,
        finished: null, bumpCooldown: 0
      });
    }
  }

  get(id) { return this.list.find((r) => r.id === id); }

  onState(msg, now) {
    const r = this.get(msg.id);
    if (!r) return null;
    const first = !r.net;
    r.net = { s: msg.s, lat: msg.lat, v: msg.v, latV: msg.latV, at: now };
    r.hp = msg.hp;
    r.score = msg.sc;
    const honked = msg.horn && !r.horn;
    r.horn = msg.horn;
    if (first) { r.s = msg.s; r.lat = msg.lat; }
    return honked ? { ...r, hornType: HORN_TYPE[r.vehicle] || r.vehicle } : null;
  }

  remove(id) {
    const r = this.get(id);
    if (!r) return;
    this.scene.remove(r.mesh);
    r.tag.material.map.dispose();
    r.tag.material.dispose();
    this.list.splice(this.list.indexOf(r), 1); // keep the same array: traffic holds a reference
  }

  /** Dead reckoning: predict from the last update, then ease toward the prediction. */
  update(dt, now, t) {
    for (const r of this.list) {
      r.bumpCooldown = Math.max(0, r.bumpCooldown - dt);
      if (r.net) {
        const age = Math.min(0.5, (now - r.net.at) / 1000);
        const ps = r.net.s + r.net.v * age;
        const pl = r.net.lat + r.net.latV * Math.min(age, 0.2);
        if (Math.abs(ps - r.s) > 25) r.s = ps;
        r.s += (ps - r.s) * Math.min(1, dt * 8);
        r.lat += (pl - r.lat) * Math.min(1, dt * 8);
        r.v = r.net.v;
        r.latV = r.net.latV;
      }
      const yaw = Math.atan2(r.latV, Math.max(r.v, 3));
      this.track.place(r.mesh, r.s, r.lat, 0, yaw);
      const inner = r.mesh.userData.inner;
      inner.rotation.z = -r.latV * r.lean;
      inner.position.y = Math.sin(t * 13 + r.id) * 0.012 * Math.min(1, r.v / 10);
    }
  }

  dispose() {
    for (const r of [...this.list]) this.remove(r.id);
  }
}
