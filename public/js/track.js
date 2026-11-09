import * as THREE from "three";
import { LANE_WIDTH } from "./maps.js";

export const STEP = 2;

// Deterministic RNG so each map's layout is the same every run.
export function makeRng(seedText) {
  let seed = 0;
  for (const char of seedText) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashNoise(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// Smooth 2D value noise in [0,1].
export function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hashNoise(xi, yi);
  const b = hashNoise(xi + 1, yi);
  const c = hashNoise(xi, yi + 1);
  const d = hashNoise(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * The course is a centreline sampled every STEP metres. Gameplay lives in
 * "road space" (s = distance along road, lat = metres right of centre);
 * Track converts road space into world space.
 */
export class Track {
  constructor(map) {
    this.map = map;
    this.lanes = map.lanes;
    this.halfWidth = (map.lanes * LANE_WIDTH) / 2;
    this.sMin = -200;
    this.sMax = map.length + 520;
    this.n = Math.ceil((this.sMax - this.sMin) / STEP) + 1;
    this.x = new Float32Array(this.n);
    this.y = new Float32Array(this.n);
    this.z = new Float32Array(this.n);
    this.h = new Float32Array(this.n);

    let heading = 0;
    let x = 0;
    let z = 0;
    for (let i = 0; i < this.n; i++) {
      const s = this.sMin + i * STEP;
      this.x[i] = x;
      this.z[i] = z;
      this.h[i] = heading;
      this.y[i] = this.elevation(s);
      // Keep the first and last stretches straight so start/finish gantries look clean.
      const fade = Math.min(1, Math.max(0, (s + 60) / 200)) * Math.min(1, Math.max(0, (map.length + 200 - s) / 200));
      heading += this.curvature(s) * fade * STEP;
      x += Math.sin(heading) * STEP;
      z -= Math.cos(heading) * STEP;
    }
  }

  curvature(s) {
    return this.map.curves.reduce((sum, [amp, freq, phase]) => sum + amp * Math.sin(freq * s + phase), 0);
  }

  elevation(s) {
    const fade = Math.min(1, Math.max(0, (s + 80) / 240));
    return this.map.baseHeight + fade * this.map.hills.reduce((sum, [amp, freq, phase]) => sum + amp * Math.sin(freq * s + phase), 0);
  }

  laneCenter(lane) {
    return -this.halfWidth + LANE_WIDTH * (lane + 0.5);
  }

  laneOf(lat) {
    return Math.max(0, Math.min(this.lanes - 1, Math.floor((lat + this.halfWidth) / LANE_WIDTH)));
  }

  frame(s, out = {}) {
    const f = Math.max(0, Math.min(this.n - 1.001, (s - this.sMin) / STEP));
    const i = Math.floor(f);
    const t = f - i;
    out.x = this.x[i] + (this.x[i + 1] - this.x[i]) * t;
    out.y = this.y[i] + (this.y[i + 1] - this.y[i]) * t;
    out.z = this.z[i] + (this.z[i + 1] - this.z[i]) * t;
    out.h = this.h[i] + (this.h[i + 1] - this.h[i]) * t;
    out.slope = (this.y[i + 1] - this.y[i]) / STEP;
    return out;
  }

  /** World position of road-space point (s, lat), `dy` metres above the road surface. */
  pos(s, lat, dy = 0, out = new THREE.Vector3()) {
    const f = this.frame(s, Track._tmp);
    return out.set(f.x + Math.cos(f.h) * lat, f.y + dy, f.z + Math.sin(f.h) * lat);
  }

  /** Place an object at road space, facing forward along the road plus `yaw` radians to the right. */
  place(object, s, lat, dy = 0, yaw = 0, pitchFollow = true) {
    const f = this.frame(s, Track._tmp2);
    object.position.set(f.x + Math.cos(f.h) * lat, f.y + dy, f.z + Math.sin(f.h) * lat);
    object.rotation.order = "YXZ";
    object.rotation.y = -(f.h + yaw);
    object.rotation.x = pitchFollow ? Math.atan(f.slope) : 0;
  }

  /** Matrix for instanced scenery. */
  matrix(s, lat, dy, scale, yaw = 0, out = new THREE.Matrix4()) {
    const f = this.frame(s, Track._tmp2);
    Track._q.setFromAxisAngle(Track._up, -(f.h + yaw));
    Track._p.set(f.x + Math.cos(f.h) * lat, f.y + dy, f.z + Math.sin(f.h) * lat);
    return out.compose(Track._p, Track._q, scale);
  }

  /**
   * Build a strip mesh by sweeping a cross-section `profile` ([{l, y, c?}] left->right) along the road.
   * Vertical `y` is relative to the road surface unless `absolute` is set.
   */
  ribbon(profile, { s0 = this.sMin, s1 = this.sMax, vLength = 10, uFromLat = false, yFn = null, colorFn = null, absolute = false } = {}) {
    const i0 = Math.max(0, Math.floor((s0 - this.sMin) / STEP));
    const i1 = Math.min(this.n - 1, Math.ceil((s1 - this.sMin) / STEP));
    const rows = i1 - i0 + 1;
    const cols = profile.length;
    const positions = new Float32Array(rows * cols * 3);
    const uvs = new Float32Array(rows * cols * 2);
    const colors = colorFn ? new Float32Array(rows * cols * 3) : null;
    const color = new THREE.Color();
    const minL = profile[0].l;
    const spanL = profile[cols - 1].l - minL || 1;

    for (let r = 0; r < rows; r++) {
      const i = i0 + r;
      const s = this.sMin + i * STEP;
      const cos = Math.cos(this.h[i]);
      const sin = Math.sin(this.h[i]);
      for (let c = 0; c < cols; c++) {
        const p = profile[c];
        const k = r * cols + c;
        const dy = yFn ? yFn(p, s) : p.y;
        positions[k * 3] = this.x[i] + cos * p.l;
        positions[k * 3 + 1] = (absolute ? 0 : this.y[i]) + dy;
        positions[k * 3 + 2] = this.z[i] + sin * p.l;
        uvs[k * 2] = uFromLat ? p.l / vLength : (p.l - minL) / spanL;
        uvs[k * 2 + 1] = s / vLength;
        if (colors) {
          colorFn(p, s, color);
          colors[k * 3] = color.r;
          colors[k * 3 + 1] = color.g;
          colors[k * 3 + 2] = color.b;
        }
      }
    }

    const indices = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = a + 1;
        const cc = a + cols;
        const d = cc + 1;
        indices.push(a, b, cc, b, d, cc);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    if (colors) geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  /** Down-sampled XZ polyline for the minimap. */
  outline(s0, s1, every = 20) {
    const points = [];
    for (let s = s0; s <= s1; s += every) {
      const f = this.frame(s, {});
      points.push([f.x, f.z]);
    }
    return points;
  }
}

Track._tmp = {};
Track._tmp2 = {};
Track._q = new THREE.Quaternion();
Track._p = new THREE.Vector3();
Track._up = new THREE.Vector3(0, 1, 0);
