import * as THREE from "three";
import { LANE_WIDTH } from "./maps.js";
import { makeRng } from "./track.js";
import { part, box, cyl, merge, materials, buildPedestrian, coneGeometry, barrierGeometry } from "./models.js";

function decalTexture(draw) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  draw(canvas.getContext("2d"));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const potholeTexture = () => decalTexture((ctx) => {
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  g.addColorStop(0, "rgba(14,13,11,1)");
  g.addColorStop(0.6, "rgba(28,26,22,.95)");
  g.addColorStop(0.82, "rgba(110,100,82,.8)");
  g.addColorStop(1, "rgba(80,76,70,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 52 + Math.sin(i * 2.7) * 8;
    ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  ctx.fill();
  ctx.fillStyle = "rgba(60,80,90,.45)";
  ctx.beginPath();
  ctx.ellipse(58, 70, 22, 12, 0.3, 0, Math.PI * 2);
  ctx.fill();
});

function signTexture(text, bg = "#f28c13") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.translate(128, 128);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#111";
  ctx.fillRect(-88, -88, 176, 176);
  ctx.fillStyle = bg;
  ctx.fillRect(-80, -80, 160, 160);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.font = "bold 30px 'Space Grotesk', sans-serif";
  text.split("\n").forEach((line, i, all) => ctx.fillText(line, 0, (i - (all.length - 1) / 2) * 34 + 10));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Course {
  constructor(scene, map, track) {
    this.map = map;
    this.track = track;
    this.group = new THREE.Group();
    scene.add(this.group);
    const rng = makeRng(`${map.id}-course`);
    this.rng = rng;
    const hw = track.halfWidth;
    const L = map.length;

    // ---- go-slow (jam) zones ----
    this.jams = [];
    for (let i = 0; i < map.hazards.jams; i++) {
      for (let tries = 0; tries < 20; tries++) {
        const s0 = 350 + rng() * (L - 750);
        const s1 = s0 + 170 + rng() * 130;
        if (this.jams.every((j) => s1 < j.s0 - 150 || s0 > j.s1 + 150)) {
          this.jams.push({ s0, s1 });
          break;
        }
      }
    }
    this.jams.sort((a, b) => a.s0 - b.s0);

    // ---- roadworks: one lane closed by cones ----
    this.closures = [];
    this.cones = [];
    this.barriers = [];
    for (let i = 0; i < map.hazards.roadworks; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const s0 = 250 + rng() * (L - 450);
        const s1 = s0 + 55 + rng() * 40;
        const lane = rng() < 0.5 ? 0 : map.lanes - 1;
        if (this.closures.every((c) => s1 < c.s0 - 120 || s0 > c.s1 + 120) && this.jams.every((j) => s1 < j.s0 - 40 || s0 > j.s1 + 40)) {
          this.closures.push({ s0, s1, lane });
          break;
        }
      }
    }
    for (const c of this.closures) {
      const outer = track.laneCenter(c.lane) + (c.lane === 0 ? -LANE_WIDTH / 2 + 0.3 : LANE_WIDTH / 2 - 0.3);
      const inner = track.laneCenter(c.lane) + (c.lane === 0 ? LANE_WIDTH / 2 : -LANE_WIDTH / 2);
      for (let s = c.s0; s <= c.s1; s += 3.2) {
        const t = Math.min(1, (s - c.s0) / 16);
        this.cones.push({ s, lat: outer + (inner - outer) * t, r: 0.3, knocked: false, vel: null, y: 0, spin: 0 });
      }
      this.barriers.push({ s: c.s0 + 6, lat: track.laneCenter(c.lane), halfW: 1.6, knocked: false });
    }
    this.coneMesh = new THREE.InstancedMesh(coneGeometry(), materials.detail, Math.max(1, this.cones.length));
    this.coneMesh.castShadow = true;
    this.group.add(this.coneMesh);
    this.barrierMeshes = this.barriers.map((b) => {
      const mesh = new THREE.Mesh(barrierGeometry(), materials.detail);
      mesh.castShadow = true;
      track.place(mesh, b.s, b.lat);
      this.group.add(mesh);
      return mesh;
    });

    // warning signs
    const signs = [
      ...this.jams.map((j) => ({ s: j.s0 - 150, text: "GO-SLOW\nAHEAD", bg: "#e5452f" })),
      ...this.closures.map((c) => ({ s: c.s0 - 110, text: "ROAD\nWORKS", bg: "#f28c13" }))
    ];
    const postGeo = merge([part(box(0.12, 2.4, 0.12), 0x8a8a8a, 0, 1.2, 0)]);
    for (const sign of signs) {
      const g = new THREE.Group();
      const post = new THREE.Mesh(postGeo, materials.detail);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: signTexture(sign.text, sign.bg), transparent: true, alphaTest: 0.2, toneMapped: true }));
      face.position.set(0, 2.7, 0.08);
      g.add(post, face);
      track.place(g, sign.s, hw + (map.terrain === "water" ? 0.5 : 1.2), map.terrain === "water" ? 0.9 : 0.2, 0, false);
      this.group.add(g);
    }

    // ---- potholes ----
    this.potholes = [];
    const potholeCount = Math.round((L / 100) * map.hazards.potholes);
    for (let i = 0; i < potholeCount; i++) {
      const s = 120 + rng() * (L - 160);
      if (this.inClosure(s, 10)) continue;
      const lat = track.laneCenter(Math.floor(rng() * map.lanes)) + (rng() - 0.5) * 1.6;
      this.potholes.push({ s, lat, r: 0.55 + rng() * 0.6, hit: false });
    }
    const potMat = new THREE.MeshStandardMaterial({ map: potholeTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 1 });
    const potMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), potMat, Math.max(1, this.potholes.length));
    this.potholes.forEach((p, i) => potMesh.setMatrixAt(i, track.matrix(p.s, p.lat, 0.025, new THREE.Vector3(p.r * 2.3, 1, p.r * 2.0), rng())));
    potMesh.count = this.potholes.length;
    potMesh.receiveShadow = true;
    this.group.add(potMesh);

    // ---- Naira coins ----
    this.coins = [];
    for (let s = 140; s < L - 60; s += 80 + rng() * 90) {
      const lane = Math.floor(rng() * map.lanes);
      const zig = rng() < 0.35;
      for (let k = 0; k < 5; k++) {
        const cs = s + k * 6;
        const lat = track.laneCenter(zig ? Math.min(map.lanes - 1, lane + (k > 2 ? 1 : 0)) : lane);
        if (!this.inClosure(cs, 4)) this.coins.push({ s: cs, lat, taken: false });
      }
    }
    const coinGeo = merge([
      part(cyl(0.42, 0.42, 0.1, 18), 0xf5c542, 0, 0, 0, Math.PI / 2, 0, 0),
      part(box(0.12, 0.5, 0.12), 0x9c6c00, -0.12, 0, 0), part(box(0.12, 0.5, 0.12), 0x9c6c00, 0.12, 0, 0),
      part(box(0.42, 0.06, 0.13), 0x9c6c00, 0, 0.06, 0), part(box(0.42, 0.06, 0.13), 0x9c6c00, 0, -0.06, 0)
    ]);
    this.coinMesh = new THREE.InstancedMesh(coinGeo, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.6 }), Math.max(1, this.coins.length));
    this.coinMesh.count = this.coins.length;
    this.group.add(this.coinMesh);

    // ---- repair kits ----
    this.repairs = [];
    for (let s = 600; s < L - 200; s += 650 + rng() * 300) {
      this.repairs.push({ s, lat: track.laneCenter(Math.floor(rng() * map.lanes)), taken: false });
    }
    const repairGeo = merge([
      part(box(0.9, 0.9, 0.9), 0x2e9e57, 0, 0, 0),
      part(box(0.95, 0.22, 0.6), 0xffffff, 0, 0, 0), part(box(0.22, 0.6, 0.95), 0xffffff, 0, 0, 0)
    ]);
    this.repairMeshes = this.repairs.map((r) => {
      const mesh = new THREE.Mesh(repairGeo, new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x1d6b3a, emissiveIntensity: 0.5 }));
      mesh.castShadow = true;
      this.group.add(mesh);
      return mesh;
    });

    // ---- pedestrians: hawkers in jams + road crossers ----
    this.peds = [];
    const addPed = (ped) => {
      ped.mesh = buildPedestrian(rng, ped.hawker);
      this.group.add(ped.mesh);
      this.peds.push(ped);
    };
    for (const j of this.jams) {
      const count = Math.round((j.s1 - j.s0) / 40 * map.hazards.hawkers);
      for (let i = 0; i < count; i++) {
        const divider = 1 + Math.floor(rng() * (map.lanes - 1));
        const lat = -hw + divider * LANE_WIDTH;
        addPed({ kind: "hawker", hawker: true, s: j.s0 + 20 + rng() * (j.s1 - j.s0 - 30), lat, homeLat: lat, vLat: 0, vS: (rng() - 0.5) * 0.6, timer: rng() * 4, state: "idle", r: 0.35 });
      }
    }
    const crossings = Math.round((L / 500) * map.hazards.hawkers);
    for (let i = 0; i < crossings; i++) {
      const s = 300 + rng() * (L - 450);
      if (this.inClosure(s, 30) || this.inJam(s, 30)) continue;
      const side = rng() < 0.5 ? -1 : 1;
      const group = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < group; k++) {
        addPed({ kind: "crosser", hawker: rng() < 0.4, s: s + k * 1.1, lat: side * (hw + 1.0 + k * 0.4), dir: -side, speed: 1.2 + rng() * 0.6, trigger: 70 + rng() * 50, state: "waiting", r: 0.35 });
      }
    }
    this.pedsTotal = this.peds.length;
    this._m = new THREE.Matrix4();
    this._hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    this.updateCones(0);
  }

  inClosure(s, margin = 0) {
    return this.closures.some((c) => s > c.s0 - margin && s < c.s1 + margin);
  }

  inJam(s, margin = 0) {
    return this.jams.some((j) => s > j.s0 - margin && s < j.s1 + margin);
  }

  /** 1 in free-flow, ~0.2 deep in a go-slow, smooth ramps either side. */
  jamFactor(s) {
    for (const j of this.jams) {
      if (s > j.s0 - 60 && s < j.s1 + 40) {
        const into = Math.min((s - (j.s0 - 60)) / 60, (j.s1 + 40 - s) / 40, 1);
        return 1 - 0.8 * Math.max(0, into);
      }
    }
    return 1;
  }

  /** Is the given lane blocked by roadworks between s and s+ahead? Returns distance or Infinity. */
  closureAhead(s, lat, ahead = 80) {
    let best = Infinity;
    for (const c of this.closures) {
      if (c.s1 < s || c.s0 > s + ahead) continue;
      const center = this.track.laneCenter(c.lane);
      if (Math.abs(lat - center) < LANE_WIDTH * 0.75) best = Math.min(best, Math.max(0, c.s0 - s));
    }
    return best;
  }

  updateCones(dt) {
    const m = this._m;
    this.cones.forEach((c, i) => {
      if (c.vel) {
        c.s += c.vel.s * dt;
        c.lat += c.vel.lat * dt;
        c.vel.y -= 22 * dt;
        c.y = Math.max(0, c.y + c.vel.y * dt);
        c.spin += dt * 9;
        if (c.y === 0) {
          c.vel.s *= 0.9;
          c.vel.lat *= 0.9;
        }
      }
      this.track.matrix(c.s, c.lat, c.y, new THREE.Vector3(1, 1, 1), c.spin, m);
      if (c.spin) m.multiply(new THREE.Matrix4().makeRotationX(Math.min(Math.PI / 2, c.spin)));
      this.coneMesh.setMatrixAt(i, m);
    });
    this.coneMesh.count = this.cones.length;
    this.coneMesh.instanceMatrix.needsUpdate = true;
  }

  update(dt, t, player) {
    if (this.cones.some((c) => c.vel)) this.updateCones(dt);

    // coins spin & bob
    const scale = new THREE.Vector3(1, 1, 1);
    this.coins.forEach((c, i) => {
      if (c.taken || Math.abs(c.s - player.s) > 400) {
        this.coinMesh.setMatrixAt(i, this._hidden);
        return;
      }
      this.track.matrix(c.s, c.lat, 1.0 + Math.sin(t * 3 + c.s) * 0.12, scale, t * 3 + c.s * 0.3, this._m);
      this.coinMesh.setMatrixAt(i, this._m);
    });
    this.coinMesh.instanceMatrix.needsUpdate = true;

    this.repairs.forEach((r, i) => {
      const mesh = this.repairMeshes[i];
      mesh.visible = !r.taken;
      if (!r.taken) {
        this.track.place(mesh, r.s, r.lat, 1.1 + Math.sin(t * 2.5) * 0.15, t * 1.5, false);
      }
    });

    // pedestrians
    for (const p of this.peds) {
      if (p.state === "gone") continue;
      if (p.kind === "hawker" && p.state !== "dodge") {
        p.timer -= dt;
        if (p.timer <= 0) {
          p.timer = 2 + this.rng() * 4;
          p.vS = (this.rng() - 0.5) * 1.2;
          p.walk = this.rng() < 0.5;
        }
        p.s += p.vS * dt * (p.walk ? 1 : 0.2);
      } else if (p.kind === "crosser") {
        if (p.state === "waiting" && player.s > p.s - p.trigger) p.state = "crossing";
        if (p.state === "crossing") {
          p.lat += p.dir * p.speed * dt;
          if (Math.abs(p.lat) > this.track.halfWidth + 1.5 && Math.sign(p.lat) === p.dir) p.state = "done";
        }
      }
      if (p.state === "dodge") {
        p.dodgeT += dt;
        p.lat += p.dodgeDir * 6 * dt;
        p.y = Math.max(0, Math.sin(Math.min(1, p.dodgeT * 2) * Math.PI) * 1.2);
        if (Math.abs(p.lat) > this.track.halfWidth + 2.5) {
          p.state = "gone";
          p.mesh.visible = false;
        }
      }
      const walking = p.state === "crossing" || (p.kind === "hawker" && p.walk);
      const bob = walking ? Math.abs(Math.sin(t * 9 + p.s)) * 0.06 : 0;
      const facing = p.kind === "crosser" && p.state === "crossing" ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : p.kind === "hawker" ? Math.PI : 0;
      this.track.place(p.mesh, p.s, p.lat, (p.y || 0) + bob + (Math.abs(p.lat) > this.track.halfWidth ? 0.2 : 0), facing, false);
    }
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material !== materials.detail) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
  }
}
