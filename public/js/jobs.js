import * as THREE from "three";
import { LANE_WIDTH } from "./maps.js";
import { buildPedestrian, part, box, merge, materials } from "./models.js";

const NAMES = ["Tolu", "Emeka", "Bisi", "Ngozi", "Kunle", "Amaka", "Femi", "Zainab", "Segun", "Ifeoma", "Yemi", "Chinedu", "Halima", "Dayo", "Funmi", "Obinna", "Sade", "Ibrahim", "Kemi", "Uche", "Bola", "Musa", "Ada", "Tobi"];
const DROP_COLORS = ["#f2b705", "#4cc9f0", "#ff6fb5", "#ff8a3c", "#a78bfa", "#f4f3e9"];
// [base ₦, ₦ per metre] per vehicle and job kind
const RATES = {
  car: { passenger: [400, 1.6], parcel: [300, 1.3] },
  bike: { passenger: [300, 1.5], parcel: [250, 1.3] },
  bus: { passenger: [150, 0.55], parcel: [250, 0.9] }
};
const PASSENGER_SHARE = { car: 0.6, bike: 0.7, bus: 0.85 };
const STOP_SPEED = 1.6; // m/s — "stopped" enough to load
const ZONE = 9; // metres either side of a stop
const LOAD_TIME = 0.9; // seconds per customer
const naira = (n) => `₦${Math.round(n).toLocaleString()}`;

function beamTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.7, "rgba(255,255,255,.55)");
  g.addColorStop(1, "rgba(255,255,255,.9)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(canvas);
}

export class Jobs {
  constructor(scene, map, track, course, vehicleId, capacity, active, rng = Math.random) {
    this.map = map;
    this.track = track;
    this.vehicleId = vehicleId;
    this.capacity = capacity;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.points = [];
    this.jobs = [];
    this.onboard = [];
    this.delivered = [];
    this.missed = [];
    this.earned = 0;
    this.actionT = 0;
    this.status = "";
    this.beamTex = beamTexture();
    this.beamGeo = new THREE.CylinderGeometry(1.1, 1.1, 40, 16, 1, true).translate(0, 20, 0);
    this.ringGeo = new THREE.RingGeometry(1.6, 2.1, 32).rotateX(-Math.PI / 2);
    if (!active) return;

    const hw = track.halfWidth;
    const water = map.terrain === "water";
    this.standLat = water ? hw + 0.45 : hw + 1.1;
    this.standDy = water ? 0.95 : 0.2;
    let colorIndex = 0;
    let id = 0;

    for (let s = 110 + rng() * 60; s < map.length - 320; s += 220 + rng() * 230) {
      if (course.inClosure(s, 25)) continue;
      const point = { s, jobs: [], beam: this.beam(s, "#5fe08f", 0.32), passed: false };
      const count = vehicleId === "bus" ? 2 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 3);
      for (let k = 0; k < count; k++) {
        const kind = rng() < PASSENGER_SHARE[vehicleId] ? "passenger" : "parcel";
        let toS = Math.min(map.length - 30, s + 260 + rng() * 950);
        // never drop off inside roadworks (the right lane may be coned off)
        for (const c of course.closures) if (toS > c.s0 - 20 && toS < c.s1 + 20) toS = c.s1 + 30;
        if (toS > map.length - 30) continue;
        const dist = toS - s;
        if (dist < 200) continue;
        const [base, perM] = RATES[vehicleId][kind];
        const mesh = buildPedestrian(rng, false);
        if (kind === "parcel") {
          const parcel = new THREE.Mesh(merge([part(box(0.5, 0.4, 0.4), 0xb07a45, 0, 1.0, -0.32), part(box(0.52, 0.06, 0.1), 0xe8d9a8, 0, 1.2, -0.32)]), materials.detail);
          mesh.add(parcel);
        }
        track.place(mesh, s - 2 + k * 1.3, this.standLat + (k % 2) * 0.6, this.standDy, Math.PI / 2, false);
        this.group.add(mesh);
        const job = {
          id: id++,
          kind,
          name: NAMES[Math.floor(rng() * NAMES.length)],
          fromS: s,
          toS,
          dist,
          pay: Math.round((base + perM * dist) / 50) * 50,
          timeLimit: Math.round(dist / 10.5 + 18),
          timeLeft: 0,
          fragile: kind === "parcel" && rng() < 0.35,
          rating: 5,
          damage: 0,
          color: DROP_COLORS[colorIndex++ % DROP_COLORS.length],
          state: "waiting",
          mesh,
          point
        };
        point.jobs.push(job);
        this.jobs.push(job);
      }
      if (point.jobs.length) this.points.push(point);
      else this.removeBeam(point.beam);
    }
  }

  beam(s, color, opacity) {
    const material = new THREE.MeshBasicMaterial({ color, map: this.beamTex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const beam = new THREE.Mesh(this.beamGeo, material);
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
    const lane = this.track.halfWidth - LANE_WIDTH / 2 + 0.6;
    const g = new THREE.Group();
    beam.position.x = 0;
    g.add(beam, ring);
    this.track.place(g, s, lane, 0.05, 0, false);
    this.group.add(g);
    return g;
  }

  removeBeam(beam) {
    if (!beam) return;
    this.group.remove(beam);
    beam.traverse((o) => o.material?.dispose());
  }

  get seatsUsed() { return this.onboard.length; }

  inZone(player, s) {
    return Math.abs(player.s - s) < ZONE && player.lat > this.track.halfWidth - LANE_WIDTH * 1.05;
  }

  /** Called when the player crashes into something. */
  onCrash() {
    for (const job of this.onboard) {
      if (job.kind === "passenger") job.rating = Math.max(1, job.rating - 1);
      else if (job.fragile) job.damage++;
    }
  }

  onBump() {
    for (const job of this.onboard) if (job.kind === "passenger") job.rating = Math.max(1, job.rating - 0.5);
  }

  /** Final pay for a delivery, with the reasons. */
  settle(job) {
    let amount = job.pay;
    const notes = [];
    if (job.timeLeft >= 0) {
      amount *= 1.2;
      notes.push("on time +20%");
    } else {
      amount *= 0.7;
      notes.push("late −30%");
    }
    if (job.kind === "passenger") {
      const tip = (job.rating - 3) * 0.1;
      amount *= 1 + tip;
      if (tip) notes.push(`${job.rating.toFixed(1)}★ ${tip > 0 ? "tip" : "complaint"} ${tip > 0 ? "+" : "−"}${Math.abs(Math.round(tip * 100))}%`);
    } else if (job.fragile && job.damage) {
      const cut = Math.min(0.75, job.damage * 0.25);
      amount *= 1 - cut;
      notes.push(`damaged −${Math.round(cut * 100)}%`);
    }
    return { amount: Math.round(amount / 10) * 10, notes };
  }

  update(dt, t, player, playing, hooks) {
    this.status = "";
    // pulse the beams
    const pulse = 0.25 + Math.sin(t * 3) * 0.08;
    for (const p of this.points) if (p.beam) p.beam.children[0].material.opacity = pulse;
    for (const job of this.onboard) if (job.beam) job.beam.children[0].material.opacity = pulse + 0.1;
    if (!playing) return;

    for (const job of this.onboard) job.timeLeft -= dt;

    const stopped = player.v < STOP_SPEED;
    let acted = false;

    // drop-offs first, so seats free up for the next pickup
    const drop = this.onboard.find((j) => this.inZone(player, j.toS));
    if (drop && stopped) {
      acted = true;
      this.actionT += dt;
      this.status = `DROPPING OFF ${drop.name.toUpperCase()}…`;
      if (this.actionT >= LOAD_TIME) {
        this.actionT = 0;
        this.deliver(drop, hooks);
      }
    }

    // pickups
    const point = !acted && this.points.find((p) => !p.passed && this.inZone(player, p.s) && p.jobs.some((j) => j.state === "waiting"));
    if (point && stopped) {
      const next = point.jobs.find((j) => j.state === "waiting");
      if (this.seatsUsed >= this.capacity) {
        this.status = `FULL ${this.seatsUsed}/${this.capacity} — drop someone off first`;
      } else {
        acted = true;
        this.actionT += dt;
        this.status = `LOADING ${next.kind === "parcel" ? "PARCEL" : next.name.toUpperCase()}…`;
        if (this.actionT >= LOAD_TIME) {
          this.actionT = 0;
          this.board(next, hooks);
        }
      }
    }
    if (!acted) this.actionT = 0;

    // passed by: waiting customers give up, onboard customers past their stop are lost
    for (const p of this.points) {
      if (!p.passed && player.s > p.s + ZONE + 2) {
        p.passed = true;
        this.removeBeam(p.beam);
        p.beam = null;
      }
    }
    for (const job of [...this.onboard]) {
      if (player.s > job.toS + ZONE + 2) this.miss(job, hooks, job.kind === "passenger" ? `“Oga, you passed my stop!” ${job.name} got off angry` : `Missed the drop for ${job.name}'s parcel`);
    }

    if (!this.status) {
      const nextPoint = this.points.find((p) => !p.passed && p.s > player.s - ZONE && p.s - player.s < 160 && p.jobs.some((j) => j.state === "waiting"));
      const nextDrop = this.onboard.filter((j) => j.toS > player.s - ZONE).sort((a, b) => a.toS - b.toS)[0];
      if (nextDrop && nextDrop.toS - player.s < 160) this.status = `DROP-OFF ${Math.max(0, Math.round(nextDrop.toS - player.s))} m — ${nextDrop.name} · stop in the right lane`;
      else if (nextPoint) {
        const waiting = nextPoint.jobs.filter((j) => j.state === "waiting");
        const value = waiting.reduce((sum, j) => sum + j.pay, 0);
        this.status = `PICKUP ${Math.max(0, Math.round(nextPoint.s - player.s))} m — ${waiting.length} waiting · up to ${naira(value)} · stop in the right lane`;
      }
    }
  }

  board(job, hooks) {
    job.state = "onboard";
    job.timeLeft = job.timeLimit;
    job.mesh.visible = false;
    job.beam = this.beam(job.toS, job.color, 0.35);
    this.onboard.push(job);
    hooks.boarded(job);
  }

  deliver(job, hooks) {
    const { amount, notes } = this.settle(job);
    job.state = "delivered";
    job.paid = amount;
    this.earned += amount;
    this.onboard.splice(this.onboard.indexOf(job), 1);
    this.delivered.push(job);
    this.removeBeam(job.beam);
    job.beam = null;
    // the customer appears at their destination
    job.mesh.visible = true;
    this.track.place(job.mesh, job.toS + 1.5, this.standLat, this.standDy, -Math.PI / 2, false);
    hooks.delivered(job, amount, notes);
  }

  miss(job, hooks, message) {
    job.state = "missed";
    this.onboard.splice(this.onboard.indexOf(job), 1);
    this.missed.push(job);
    this.removeBeam(job.beam);
    job.beam = null;
    hooks.missed(job, message);
  }

  /** Shift over (finish or wreck): anyone still aboard is lost. */
  close() {
    for (const job of [...this.onboard]) {
      job.state = "missed";
      this.missed.push(job);
    }
    this.onboard.length = 0;
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.material && o.material !== materials.detail) o.material.dispose();
      if (o.geometry && o.geometry !== this.beamGeo && o.geometry !== this.ringGeo) o.geometry.dispose();
    });
    this.beamGeo.dispose();
    this.ringGeo.dispose();
    this.beamTex.dispose();
  }
}

export { naira };
