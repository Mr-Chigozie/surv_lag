import * as THREE from "three";
import { LANE_WIDTH } from "./maps.js";
import { buildVehicle, getBlueprint, bodyMaterial } from "./models.js";

const TYPES = {
  car: { vmin: 15, vmax: 26, lc: 2.4, T: 1.1, gap0: 2.5, colors: [0xd45b43, 0x5690a0, 0xb6a281, 0x555861, 0xe8e6e0, 0x1f2a44, 0x8c1c1c, 0x2e6b4f, 0xc0c4c8] },
  danfo: { vmin: 12, vmax: 23, lc: 4.4, T: 0.6, gap0: 1.4, colors: [0xf2b705, 0xe8ad00] },
  okada: { vmin: 14, vmax: 27, lc: 3.6, T: 0.5, gap0: 1.0, colors: [0xd23c2a, 0x1f1f1f, 0x2f5fbf, 0xe8e8e0] },
  truck: { vmin: 9, vmax: 14, lc: 1.5, T: 1.6, gap0: 3.5, colors: [0x2f5fa0, 0xd8d8d0, 0x9c2a22] },
  tanker: { vmin: 9, vmax: 13, lc: 1.3, T: 1.8, gap0: 4, colors: [0xe9e6dc, 0xd23c2a] },
  brt: { vmin: 15, vmax: 20, lc: 1.5, T: 1.4, gap0: 3, colors: [0x1f5fbf] }
};

const HORN_YIELD = { car: 0.75, danfo: 0.25, okada: 0.5, truck: 0.3, tanker: 0.3, brt: 0.1 };
const A = 2.6;
const B = 5.5;

export class Traffic {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pools = new Map();
    this.list = [];
    this.others = []; // other online players: NPCs treat them like the player
    this.events = [];
  }

  reset(map, track, course, playerVehicle, honkBonus = 0) {
    for (const npc of this.list) this.release(npc);
    this.list = [];
    this.map = map;
    this.track = track;
    this.course = course;
    this.playerVehicle = playerVehicle;
    this.honkBonus = honkBonus;
    this.mixEntries = Object.entries(map.traffic.mix);
    this.spawnCooldown = 0;
    this.honkTimer = 3;
    this.rng = Math.random;
  }

  acquire(type, variant, color) {
    const key = type === "okada" || type === "truck" ? `${type}-${variant}` : type;
    const pool = this.pools.get(key) || [];
    this.pools.set(key, pool);
    let mesh = pool.pop();
    if (!mesh) {
      mesh = buildVehicle(type, color, variant);
      this.group.add(mesh);
    }
    mesh.userData.inner.children[0].material = bodyMaterial(color);
    mesh.visible = true;
    mesh.userData.poolKey = key;
    return mesh;
  }

  release(npc) {
    npc.mesh.visible = false;
    this.pools.get(npc.mesh.userData.poolKey).push(npc.mesh);
  }

  pickType(lane) {
    let roll = Math.random();
    for (const [type, weight] of this.mixEntries) {
      roll -= weight;
      if (roll <= 0) {
        // BRT stays in its own corridor on Ikorodu Road; trucks prefer the slow (right) lanes.
        if (type === "brt" && this.map.id === "ikorodu" && lane !== 0) return "car";
        if ((type === "truck" || type === "tanker") && lane === 0 && this.map.lanes > 2) return "car";
        return type;
      }
    }
    return "car";
  }

  laneFree(lane, s, ahead, behind) {
    const center = this.track.laneCenter(lane);
    return this.list.every((n) => Math.abs(n.lat - center) > LANE_WIDTH * 0.7 || n.s - n.len / 2 > s + ahead || n.s + n.len / 2 < s - behind);
  }

  spawn(s, lane, speedFactor = 1) {
    if (this.course.closureAhead(s - 10, this.track.laneCenter(lane), 30) < 30) return null;
    const type = this.pickType(lane);
    const spec = TYPES[type];
    const variant = Math.floor(Math.random() * 10);
    const bp = getBlueprint(type, variant);
    const color = spec.colors[Math.floor(Math.random() * spec.colors.length)];
    const vDesired = spec.vmin + Math.random() * (spec.vmax - spec.vmin);
    const jam = this.course.jamFactor(s);
    const npc = {
      type,
      spec,
      s,
      lat: this.track.laneCenter(lane) + (type === "okada" ? (Math.random() - 0.5) * 1.4 : 0),
      latV: 0,
      lane,
      targetLane: lane,
      laneOffset: 0,
      v: vDesired * jam * speedFactor,
      vDesired,
      len: bp.length,
      w: bp.width,
      mesh: this.acquire(type, variant, color),
      decide: Math.random(),
      stopTimer: 0,
      passed: false,
      touched: false,
      hitCooldown: 0,
      phase: Math.random() * 10
    };
    this.list.push(npc);
    return npc;
  }

  populate(player) {
    const lanes = this.map.lanes;
    const count = this.targetCount(player.s);
    for (let i = 0; i < count; i++) {
      const s = player.s + 35 + (i / count) * 420 + Math.random() * 10;
      const lane = Math.floor(Math.random() * lanes);
      if (this.laneFree(lane, s, 14, 14)) this.spawn(s, lane);
    }
  }

  targetCount(s) {
    const jamNear = this.course.inJam(s + 200, 150) ? 1.9 : 1;
    return Math.round(this.map.traffic.density * this.map.lanes * 5.5 * jamNear);
  }

  /** Something the NPC must not drive into: other NPCs, the player, pedestrians, roadworks. */
  findLeader(npc, player) {
    let best = null;
    let bestGap = 120;
    const reach = (w) => (npc.w + w) / 2 + 0.35;
    const check = (s, lat, len, w, v) => {
      if (Math.abs(lat - npc.lat) > reach(w) && Math.abs(lat - this.track.laneCenter(npc.targetLane)) > reach(w)) return;
      const gap = s - len / 2 - (npc.s + npc.len / 2);
      if (gap > -0.5 && gap < bestGap) {
        bestGap = gap;
        best = { gap: Math.max(0.1, gap), v };
      }
    };
    for (const other of this.list) if (other !== npc && other.s > npc.s) check(other.s, other.lat, other.len, other.w, other.v);
    for (const o of this.others) if (o.s > npc.s) check(o.s, o.lat, o.len, o.w, o.v);
    if (player.s > npc.s) check(player.s, player.lat, player.len, player.w, player.v);
    for (const p of this.course.peds) {
      if (p.state === "gone" || p.state === "waiting" || p.state === "done" || p.s < npc.s) continue;
      if (Math.abs(p.lat) > this.track.halfWidth + 0.3) continue;
      check(p.s, p.lat, 0.8, 0.8, 0);
    }
    const closure = this.course.closureAhead(npc.s, npc.lat, 60);
    if (closure < bestGap) best = { gap: Math.max(0.1, closure - npc.len / 2 - 1), v: 0 };
    return best;
  }

  tryLaneChange(npc, player, aggressive = false) {
    const options = [npc.lane - 1, npc.lane + 1].filter((l) => l >= 0 && l < this.map.lanes);
    if (this.map.id === "ikorodu" && npc.type !== "brt" && npc.type !== "danfo") {
      // Most drivers respect the BRT lane. Danfos... don't.
      const i = options.indexOf(0);
      if (i >= 0) options.splice(i, 1);
    }
    if (Math.random() < 0.5) options.reverse();
    for (const lane of options) {
      const center = this.track.laneCenter(lane);
      if (this.course.closureAhead(npc.s, center, 50) < 50) continue;
      const behind = aggressive ? 2 : 9 + npc.v * 0.4;
      if (!this.laneFree(lane, npc.s, npc.len + 6, behind)) continue;
      const playerInLane = Math.abs(player.lat - center) < LANE_WIDTH * 0.7;
      if (playerInLane && !aggressive && player.s < npc.s + npc.len && player.s > npc.s - behind - 6) continue;
      if (playerInLane && aggressive && Math.abs(player.s - npc.s) < (npc.len + player.len) / 2 + 0.5) continue;
      // never cut in right behind a slow or stopped player (e.g. loading passengers) — they would be rear-ended
      const gapToPlayer = player.s - npc.s;
      if (playerInLane && gapToPlayer > 0 && gapToPlayer < 14 + npc.v * 1.5 && player.v < npc.v - 2) continue;
      npc.targetLane = lane;
      npc.lane = lane;
      return true;
    }
    return false;
  }

  honk(player) {
    const bonus = (this.playerVehicle === "bus" ? 0.25 : 0) + this.honkBonus;
    for (const npc of this.list) {
      const ds = npc.s - player.s;
      if (ds < 0 || ds > 45) continue;
      if (Math.abs(npc.lat - player.lat) > (npc.w + player.w) / 2 + 0.6) continue;
      if (Math.random() < HORN_YIELD[npc.type] + bonus) this.tryLaneChange(npc, player, false);
      else if (npc.type === "danfo" && Math.random() < 0.5) this.events.push({ type: "honkBack", s: npc.s, lat: npc.lat });
    }
  }

  update(dt, player, t) {
    const track = this.track;
    const hw = track.halfWidth;
    this.events.length = 0;

    for (let i = this.list.length - 1; i >= 0; i--) {
      const npc = this.list[i];
      const spec = npc.spec;
      npc.hitCooldown = Math.max(0, npc.hitCooldown - dt);

      // --- longitudinal (Intelligent Driver Model) ---
      let v0 = npc.vDesired * this.course.jamFactor(npc.s);
      if (npc.stopTimer > 0) {
        npc.stopTimer -= dt;
        v0 = 0;
      }
      const leader = this.findLeader(npc, player);
      let accel = A * (1 - Math.pow(npc.v / Math.max(0.5, v0), 4));
      if (leader) {
        const sStar = spec.gap0 + npc.v * spec.T + (npc.v * (npc.v - leader.v)) / (2 * Math.sqrt(A * B));
        accel -= A * Math.pow(Math.max(0, sStar) / leader.gap, 2);
      }
      if (v0 === 0) accel = Math.min(accel, -4);
      npc.v = Math.max(0, npc.v + Math.max(-11, Math.min(A, accel)) * dt);

      // --- lane decisions ---
      npc.decide -= dt;
      if (npc.decide <= 0 && npc.stopTimer <= 0) {
        npc.decide = 0.6 + Math.random() * 0.8;
        const blocked = leader && leader.gap < 25 && leader.v < npc.vDesired - 2;
        const closureSoon = this.course.closureAhead(npc.s, npc.lat, 70) < 70;
        if (closureSoon) this.tryLaneChange(npc, player, true);
        else if (blocked && Math.random() < (npc.type === "danfo" ? 0.9 : 0.5)) this.tryLaneChange(npc, player, npc.type === "danfo" || npc.type === "okada");
        else if (npc.type === "danfo" && Math.random() < 0.08) this.tryLaneChange(npc, player, true);
        // danfo pulls over to pick passengers ("Oshodi! Oshodi!")
        if (npc.type === "danfo" && npc.lane === this.map.lanes - 1 && Math.random() < 0.05 && this.course.jamFactor(npc.s) > 0.9) {
          npc.stopTimer = 2.5 + Math.random() * 3;
          this.events.push({ type: "danfoStop", s: npc.s, lat: npc.lat });
        }
        if (npc.type === "okada") npc.laneOffset = Math.random() < 0.35 ? (Math.random() < 0.5 ? -1 : 1) * (LANE_WIDTH / 2 - 0.2) : (Math.random() - 0.5) * 0.8;
      }

      // --- lateral motion ---
      let targetLat = track.laneCenter(npc.targetLane);
      if (npc.type === "okada") targetLat += npc.laneOffset + Math.sin(t * 1.7 + npc.phase) * 0.25;
      if (npc.stopTimer > 0) targetLat = hw - npc.w / 2 + 0.5;
      const dl = targetLat - npc.lat;
      const latTarget = Math.max(-spec.lc, Math.min(spec.lc, dl * 2.2)) * Math.min(1, npc.v / 4 + 0.15);
      npc.latV += (latTarget - npc.latV) * Math.min(1, dt * 5);
      npc.lat += npc.latV * dt;
      npc.lat = Math.max(-hw + npc.w / 2 - 0.2, Math.min(hw - npc.w / 2 + 0.6, npc.lat));

      npc.s += npc.v * dt;

      // --- placement ---
      const yaw = Math.atan2(npc.latV, Math.max(npc.v, 3));
      track.place(npc.mesh, npc.s, npc.lat, 0, yaw);
      const inner = npc.mesh.userData.inner;
      inner.rotation.z = npc.type === "okada" ? -npc.latV * 0.12 : -npc.latV * 0.015;
      inner.position.y = Math.sin(t * 13 + npc.phase) * 0.012 * Math.min(1, npc.v / 10);

      if (npc.s < player.s - 140 || npc.s > player.s + 650 || npc.s > this.map.length + 450) {
        this.release(npc);
        this.list.splice(i, 1);
      }
    }

    // --- spawning ---
    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0 && this.list.length < this.targetCount(player.s)) {
      this.spawnCooldown = 0.12;
      const lane = Math.floor(Math.random() * this.map.lanes);
      const ahead = player.s + 330 + Math.random() * 150;
      if (ahead < this.map.length + 300 && this.laneFree(lane, ahead, 16, 16)) this.spawn(ahead, lane);
      // occasionally a fast car comes from behind when you're dawdling
      if (player.v < 16 && Math.random() < 0.06 && !this.course.inJam(player.s, 60)) {
        const behindS = player.s - 110;
        if (behindS > 0 && this.laneFree(lane, behindS, 20, 20)) {
          const npc = this.spawn(behindS, lane, 1.25);
          if (npc) npc.vDesired = Math.max(npc.vDesired, 24);
        }
      }
    }

    // ambient Lagos honking
    this.honkTimer -= dt * (this.course.inJam(player.s, 80) ? 2.5 : 1) * this.map.traffic.density;
    if (this.honkTimer <= 0) {
      this.honkTimer = 1.5 + Math.random() * 4;
      const near = this.list.filter((n) => Math.abs(n.s - player.s) < 60);
      if (near.length) {
        const n = near[Math.floor(Math.random() * near.length)];
        this.events.push({ type: "ambientHonk", s: n.s, lat: n.lat, vehicle: n.type });
      }
    }
  }
}
