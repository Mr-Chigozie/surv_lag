import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ---------- geometry helpers ----------
const tmpMatrix = new THREE.Matrix4();
const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpColor = new THREE.Color();

/** Transform a primitive, paint it a flat vertex colour and strip it to position/normal/color. */
export function part(geometry, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  tmpEuler.set(rx, ry, rz);
  tmpQuat.setFromEuler(tmpEuler);
  tmpMatrix.compose(new THREE.Vector3(x, y, z), tmpQuat, new THREE.Vector3(sx, sy, sz));
  let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  g.applyMatrix4(tmpMatrix);
  for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
  const count = g.attributes.position.count;
  const colors = new Float32Array(count * 3);
  tmpColor.set(color);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const sphere = (r, seg = 8) => new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2));
export const cone = (r, h, seg = 8) => new THREE.ConeGeometry(r, h, seg);
export const merge = (parts) => mergeGeometries(parts, false);

const wheel = (x, y, z, r = 0.36, w = 0.28) => [
  part(cyl(r, r, w, 12), 0x161616, x, y, z, 0, 0, Math.PI / 2),
  part(cyl(r * 0.55, r * 0.55, w + 0.02, 8), 0x9a9a92, x, y, z, 0, 0, Math.PI / 2)
];

// ---------- shared materials ----------
export const materials = {
  detail: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.1 }),
  lights: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  body: new Map()
};

export function bodyMaterial(color) {
  if (!materials.body.has(color)) {
    materials.body.set(color, new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.38, metalness: 0.35 }));
  }
  return materials.body.get(color);
}

// ---------- vehicle blueprints (front of vehicle faces -Z) ----------
const HEAD = 0xfff2c8;
const TAIL = 0xff2a1a;
const GLASS = 0x1b2a33;
const DARK = 0x222222;

function carBlueprint() {
  const L = 4.3;
  const body = [
    part(box(1.8, 0.55, L), 0xffffff, 0, 0.62, 0),
    part(box(1.56, 0.07, 2.0), 0xffffff, 0, 1.44, 0.25),
    part(box(1.76, 0.18, 1.1), 0xffffff, 0, 0.95, -1.45, -0.18, 0, 0)
  ];
  const detail = [
    part(box(1.62, 0.52, 2.15), GLASS, 0, 1.15, 0.25),
    part(box(1.84, 0.22, 0.2), DARK, 0, 0.42, -2.12),
    part(box(1.84, 0.22, 0.2), DARK, 0, 0.42, 2.12),
    part(box(0.5, 0.14, 0.03), 0xf4f1e6, 0, 0.62, 2.17),
    ...wheel(-0.86, 0.36, -1.35), ...wheel(0.86, 0.36, -1.35),
    ...wheel(-0.86, 0.36, 1.35), ...wheel(0.86, 0.36, 1.35)
  ];
  const lights = [
    part(box(0.38, 0.13, 0.04), HEAD, -0.62, 0.72, -2.16), part(box(0.38, 0.13, 0.04), HEAD, 0.62, 0.72, -2.16),
    part(box(0.34, 0.14, 0.04), TAIL, -0.66, 0.74, 2.16), part(box(0.34, 0.14, 0.04), TAIL, 0.66, 0.74, 2.16)
  ];
  return { body, detail, lights, length: L, width: 1.8, height: 1.5, headY: 0.72, headZ: -2.2 };
}

function danfoBlueprint() {
  const L = 5.0;
  const body = [
    part(box(2.0, 1.5, L), 0xffffff, 0, 1.12, 0.05),
    part(box(1.9, 0.6, 0.9), 0xffffff, 0, 0.75, -2.35)
  ];
  const detail = [
    part(box(2.03, 0.52, 3.7), GLASS, 0, 1.52, 0.45),
    part(box(1.82, 0.55, 0.05), GLASS, 0, 1.48, -2.43, -0.15, 0, 0),
    part(box(2.05, 0.1, L + 0.04), 0x111111, 0, 0.95, 0.05),
    part(box(2.05, 0.1, L + 0.04), 0x111111, 0, 1.18, 0.05),
    part(box(1.7, 0.1, 2.8), 0x3a3a3a, 0, 1.92, 0.4),
    part(box(2.04, 0.2, 0.2), DARK, 0, 0.45, -2.75),
    part(box(2.04, 0.2, 0.15), DARK, 0, 0.45, 2.57),
    ...wheel(-0.95, 0.38, -1.7, 0.38), ...wheel(0.95, 0.38, -1.7, 0.38),
    ...wheel(-0.95, 0.38, 1.6, 0.38), ...wheel(0.95, 0.38, 1.6, 0.38)
  ];
  const lights = [
    part(box(0.34, 0.2, 0.04), HEAD, -0.7, 0.8, -2.81), part(box(0.34, 0.2, 0.04), HEAD, 0.7, 0.8, -2.81),
    part(box(0.25, 0.3, 0.04), TAIL, -0.85, 0.9, 2.58), part(box(0.25, 0.3, 0.04), TAIL, 0.85, 0.9, 2.58)
  ];
  return { body, detail, lights, length: 5.5, width: 2.0, height: 2.0, headY: 0.8, headZ: -2.85 };
}

function okadaBlueprint(shirt = 0x2f6fb0, passenger = false, helmet = false) {
  const body = [
    part(box(0.34, 0.28, 0.75), 0xffffff, 0, 0.88, -0.2),
    part(box(0.38, 0.22, 0.4), 0xffffff, 0, 0.65, 0.55)
  ];
  const detail = [
    part(cyl(0.32, 0.32, 0.12, 12), 0x141414, 0, 0.33, -0.68, 0, 0, Math.PI / 2),
    part(cyl(0.32, 0.32, 0.12, 12), 0x141414, 0, 0.33, 0.7, 0, 0, Math.PI / 2),
    part(box(0.08, 0.7, 0.08), 0x777777, 0, 0.62, -0.62, 0.35, 0, 0),
    part(box(0.72, 0.05, 0.05), 0x333333, 0, 1.12, -0.5),
    part(box(0.3, 0.12, 0.85), 0x1a1a1a, 0, 1.03, 0.32),
    part(box(0.12, 0.14, 0.6), 0x555555, 0.2, 0.45, 0.35),
    // rider
    part(box(0.46, 0.62, 0.3), shirt, 0, 1.45, 0.12, -0.25, 0, 0),
    part(box(0.36, 0.2, 0.55), 0x2a2a35, 0, 1.08, 0.18),
    part(box(0.1, 0.45, 0.1), 0x5a3825, -0.26, 1.35, -0.2, -0.9, 0, 0),
    part(box(0.1, 0.45, 0.1), 0x5a3825, 0.26, 1.35, -0.2, -0.9, 0, 0),
    part(sphere(0.15), 0x4a2e1e, 0, 1.92, 0.02),
    helmet ? part(sphere(0.19), 0xe8e8e0, 0, 1.97, 0.02, 0, 0, 0, 1, 0.85, 1.05) : part(box(0.3, 0.08, 0.3), 0x222222, 0, 2.05, 0)
  ];
  if (passenger) {
    detail.push(
      part(box(0.44, 0.58, 0.3), 0xb8433a, 0, 1.48, 0.62, -0.1, 0, 0),
      part(sphere(0.15), 0x4a2e1e, 0, 1.92, 0.62),
      part(box(0.5, 0.3, 0.3), 0xd6c39a, 0, 1.72, 0.92)
    );
  }
  const lights = [part(box(0.18, 0.14, 0.05), HEAD, 0, 1.0, -0.62), part(box(0.16, 0.08, 0.04), TAIL, 0, 0.82, 0.77)];
  return { body, detail, lights, length: 2.1, width: 0.8, height: 2.0, headY: 1.0, headZ: -0.7 };
}

function truckBlueprint(cargo = 0x5d6b3a) {
  const L = 9;
  const body = [part(box(2.5, 2.2, 2.2), 0xffffff, 0, 1.65, -3.3)];
  const detail = [
    part(box(2.4, 0.8, 0.05), GLASS, 0, 2.15, -4.41, -0.08, 0, 0),
    part(box(2.5, 2.8, 6.4), cargo, 0, 2.0, 1.1),
    part(box(2.3, 0.3, L - 0.2), 0x2a2a2a, 0, 0.6, 0),
    part(box(2.52, 0.25, 0.2), DARK, 0, 0.55, -4.42),
    ...wheel(-1.1, 0.5, -3.3, 0.5, 0.35), ...wheel(1.1, 0.5, -3.3, 0.5, 0.35),
    ...wheel(-1.1, 0.5, 2.2, 0.5, 0.35), ...wheel(1.1, 0.5, 2.2, 0.5, 0.35),
    ...wheel(-1.1, 0.5, 3.4, 0.5, 0.35), ...wheel(1.1, 0.5, 3.4, 0.5, 0.35)
  ];
  const lights = [
    part(box(0.35, 0.2, 0.04), HEAD, -0.9, 1.0, -4.43), part(box(0.35, 0.2, 0.04), HEAD, 0.9, 1.0, -4.43),
    part(box(0.3, 0.2, 0.04), TAIL, -1.0, 0.75, 4.33), part(box(0.3, 0.2, 0.04), TAIL, 1.0, 0.75, 4.33)
  ];
  return { body, detail, lights, length: L, width: 2.5, height: 3.4, headY: 1.0, headZ: -4.45 };
}

function tankerBlueprint() {
  const L = 10;
  const body = [part(box(2.5, 2.2, 2.2), 0xffffff, 0, 1.65, -3.8)];
  const detail = [
    part(box(2.4, 0.8, 0.05), GLASS, 0, 2.15, -4.91, -0.08, 0, 0),
    part(cyl(1.15, 1.15, 6.9, 16), 0xc9ccc9, 0, 2.15, 1.25, Math.PI / 2, 0, 0),
    part(box(2.34, 0.25, 6.9), 0xd23c2a, 0, 1.6, 1.25),
    part(box(2.3, 0.3, L - 0.2), 0x2a2a2a, 0, 0.6, 0),
    ...wheel(-1.1, 0.5, -3.8, 0.5, 0.35), ...wheel(1.1, 0.5, -3.8, 0.5, 0.35),
    ...wheel(-1.1, 0.5, 2.6, 0.5, 0.35), ...wheel(1.1, 0.5, 2.6, 0.5, 0.35),
    ...wheel(-1.1, 0.5, 3.8, 0.5, 0.35), ...wheel(1.1, 0.5, 3.8, 0.5, 0.35)
  ];
  const lights = [
    part(box(0.35, 0.2, 0.04), HEAD, -0.9, 1.0, -4.93), part(box(0.35, 0.2, 0.04), HEAD, 0.9, 1.0, -4.93),
    part(box(0.3, 0.2, 0.04), TAIL, -1.0, 0.75, 4.83), part(box(0.3, 0.2, 0.04), TAIL, 1.0, 0.75, 4.83)
  ];
  return { body, detail, lights, length: L, width: 2.5, height: 3.4, headY: 1.0, headZ: -4.95 };
}

function brtBlueprint() {
  const L = 11;
  const body = [part(box(2.6, 2.6, L), 0xffffff, 0, 1.75, 0)];
  const detail = [
    part(box(2.63, 0.9, L - 1.6), GLASS, 0, 2.2, 0.3),
    part(box(2.4, 1.1, 0.05), GLASS, 0, 2.15, -5.51),
    part(box(2.64, 0.28, L + 0.02), 0xc8202a, 0, 1.2, 0),
    part(box(2.0, 0.3, 4), 0xd8d8d0, 0, 3.15, 0),
    ...wheel(-1.15, 0.5, -3.6, 0.5, 0.35), ...wheel(1.15, 0.5, -3.6, 0.5, 0.35),
    ...wheel(-1.15, 0.5, 3.4, 0.5, 0.35), ...wheel(1.15, 0.5, 3.4, 0.5, 0.35)
  ];
  const lights = [
    part(box(0.4, 0.2, 0.04), HEAD, -0.95, 0.85, -5.52), part(box(0.4, 0.2, 0.04), HEAD, 0.95, 0.85, -5.52),
    part(box(0.3, 0.35, 0.04), TAIL, -1.1, 0.95, 5.52), part(box(0.3, 0.35, 0.04), TAIL, 1.1, 0.95, 5.52)
  ];
  return { body, detail, lights, length: L, width: 2.6, height: 3.3, headY: 0.85, headZ: -5.55 };
}

/** Seated rider for open vehicles; `lean` tips the torso forward (radians). */
function rider(shirt, x, y, z, lean = -0.25, helmet = null) {
  const parts = [
    part(box(0.44, 0.58, 0.3), shirt, x, y + 0.32, z, lean, 0, 0),
    part(box(0.34, 0.2, 0.5), 0x2a2a35, x, y - 0.02, z + 0.05),
    part(box(0.1, 0.42, 0.1), 0x4a2e1e, x - 0.25, y + 0.25, z - 0.32, -1.0, 0, 0),
    part(box(0.1, 0.42, 0.1), 0x4a2e1e, x + 0.25, y + 0.25, z - 0.32, -1.0, 0, 0)
  ];
  const hz = z + Math.sin(lean) * 0.5;
  if (helmet !== null) {
    parts.push(part(sphere(0.19, 10), helmet, x, y + 0.78, hz, 0, 0, 0, 1, 0.9, 1.1));
    parts.push(part(box(0.26, 0.09, 0.05), GLASS, x, y + 0.79, hz - 0.18));
  } else {
    parts.push(part(sphere(0.15), 0x4a2e1e, x, y + 0.76, hz));
  }
  return parts;
}

function kekeBlueprint(shirt = 0x2f6fb0) {
  const body = [
    part(box(1.3, 0.5, 1.45), 0xffffff, 0, 0.62, 0.5), // passenger tub
    part(box(0.78, 0.5, 0.95), 0xffffff, 0, 0.62, -0.72), // driver cowl
    part(box(0.82, 0.62, 0.1), 0xffffff, 0, 0.98, -1.2, -0.22, 0, 0), // nose panel
    part(box(1.36, 0.08, 2.35), 0xffffff, 0, 1.86, 0.1) // roof
  ];
  const detail = [
    part(box(0.76, 0.5, 0.04), GLASS, 0, 1.5, -1.12, -0.2, 0, 0),
    part(box(1.32, 0.1, 1.47), 0x2e8a4d, 0, 0.84, 0.5),
    part(box(0.8, 0.1, 0.97), 0x2e8a4d, 0, 0.84, -0.72),
    part(box(1.3, 0.62, 0.04), 0x1c1c1c, 0, 1.5, 1.22),
    part(box(1.1, 0.14, 0.5), 0x1a1a1a, 0, 0.95, 0.75), // back bench
    part(box(1.1, 0.4, 0.1), 0x1a1a1a, 0, 1.15, 1.0),
    part(box(0.6, 0.04, 0.04), 0x333333, 0, 1.18, -0.9),
    ...[[-0.63, 1.2], [0.63, 1.2], [-0.4, -1.05], [0.4, -1.05]].map(([x, z]) => part(box(0.06, 1.05, 0.06), 0x333333, x, 1.35, z)),
    part(cyl(0.27, 0.27, 0.14, 12), 0x161616, 0, 0.27, -1.08, 0, 0, Math.PI / 2),
    ...wheel(-0.6, 0.3, 0.85, 0.3, 0.16), ...wheel(0.6, 0.3, 0.85, 0.3, 0.16),
    ...rider(shirt, 0, 0.98, -0.5, -0.12)
  ];
  const lights = [
    part(box(0.22, 0.15, 0.04), HEAD, 0, 1.0, -1.27),
    part(box(0.14, 0.14, 0.04), TAIL, -0.55, 0.72, 1.23), part(box(0.14, 0.14, 0.04), TAIL, 0.55, 0.72, 1.23)
  ];
  return { body, detail, lights, length: 2.8, width: 1.35, height: 1.9, headY: 1.0, headZ: -1.3 };
}

function molueBlueprint() {
  const L = 9.5;
  const body = [
    part(box(2.45, 2.3, L), 0xffffff, 0, 1.7, 0),
    part(box(2.3, 0.35, L - 0.6), 0xffffff, 0, 2.98, 0) // rounded roof line
  ];
  const detail = [
    part(box(2.47, 0.78, L - 1.6), GLASS, 0, 2.25, 0.4),
    part(box(2.25, 0.95, 0.05), GLASS, 0, 2.15, -L / 2 - 0.01),
    part(box(2.48, 0.13, L + 0.02), 0x111111, 0, 1.55, 0),
    part(box(2.48, 0.13, L + 0.02), 0x111111, 0, 1.25, 0),
    part(box(2.48, 1.5, 0.95), 0x151515, 0, 1.55, -3.3), // open doorway (both sides)
    part(box(2.48, 1.5, 0.95), 0x151515, 0, 1.55, 2.6),
    part(box(1.9, 0.12, 5.5), 0x3a3a3a, 0, 3.24, 0.3), // roof rack
    part(box(0.5, 0.35, 0.6), 0x8b6b3e, -0.4, 3.45, -0.8),
    part(box(0.6, 0.3, 0.5), 0x6fb3d9, 0.45, 3.43, 1.4),
    part(box(2.5, 0.3, 0.25), DARK, 0, 0.6, -L / 2 - 0.08),
    part(box(2.5, 0.3, 0.2), DARK, 0, 0.6, L / 2 + 0.05),
    part(box(1.2, 0.18, 0.04), 0x111111, 0, 3.0, -L / 2 - 0.02), // destination board
    // conductor hanging out of the front door
    part(box(0.3, 0.6, 0.28), 0xb8433a, 1.32, 1.85, -3.3, 0, 0, -0.25),
    part(sphere(0.14), 0x4a2e1e, 1.42, 2.3, -3.3),
    part(box(0.1, 0.5, 0.1), 0x4a2e1e, 1.25, 2.3, -3.05, 0, 0, 0.3),
    ...wheel(-1.1, 0.55, -3.0, 0.55, 0.35), ...wheel(1.1, 0.55, -3.0, 0.55, 0.35),
    ...wheel(-1.1, 0.55, 2.9, 0.55, 0.35), ...wheel(1.1, 0.55, 2.9, 0.55, 0.35),
    ...wheel(-1.1, 0.55, 3.9, 0.55, 0.35), ...wheel(1.1, 0.55, 3.9, 0.55, 0.35)
  ];
  const lights = [
    part(box(0.38, 0.22, 0.04), HEAD, -0.85, 0.95, -L / 2 - 0.02), part(box(0.38, 0.22, 0.04), HEAD, 0.85, 0.95, -L / 2 - 0.02),
    part(box(0.28, 0.35, 0.04), TAIL, -1.0, 1.0, L / 2 + 0.02), part(box(0.28, 0.35, 0.04), TAIL, 1.0, 1.0, L / 2 + 0.02)
  ];
  return { body, detail, lights, length: L, width: 2.5, height: 3.6, headY: 0.95, headZ: -L / 2 - 0.05 };
}

function suvBlueprint() {
  const L = 4.9;
  const body = [
    part(box(1.98, 0.85, L), 0xffffff, 0, 0.88, 0),
    part(box(1.86, 0.08, 2.95), 0xffffff, 0, 1.94, 0.4),
    part(box(1.92, 0.2, 1.2), 0xffffff, 0, 1.36, -1.8, -0.06, 0, 0)
  ];
  const detail = [
    part(box(1.88, 0.62, 3.0), GLASS, 0, 1.6, 0.4),
    part(box(2.02, 0.3, 0.25), DARK, 0, 0.46, -2.45),
    part(box(2.02, 0.3, 0.25), DARK, 0, 0.46, 2.45),
    part(box(1.2, 0.32, 0.04), 0xb8b8b0, 0, 0.98, -2.46), // chrome grille
    part(box(0.06, 0.06, 2.7), 0x8a8a84, -0.82, 2.01, 0.4), part(box(0.06, 0.06, 2.7), 0x8a8a84, 0.82, 2.01, 0.4),
    part(box(0.14, 0.06, 2.5), 0x2a2a2a, -1.04, 0.46, 0), part(box(0.14, 0.06, 2.5), 0x2a2a2a, 1.04, 0.46, 0),
    part(cyl(0.38, 0.38, 0.22, 12), 0x161616, 0, 1.0, 2.55, Math.PI / 2, 0, 0), // spare wheel
    ...wheel(-0.92, 0.44, -1.55, 0.44, 0.32), ...wheel(0.92, 0.44, -1.55, 0.44, 0.32),
    ...wheel(-0.92, 0.44, 1.55, 0.44, 0.32), ...wheel(0.92, 0.44, 1.55, 0.44, 0.32)
  ];
  const lights = [
    part(box(0.42, 0.12, 0.04), HEAD, -0.7, 1.08, -2.46), part(box(0.42, 0.12, 0.04), HEAD, 0.7, 1.08, -2.46),
    part(box(0.12, 0.4, 0.04), TAIL, -0.9, 1.1, 2.46), part(box(0.12, 0.4, 0.04), TAIL, 0.9, 1.1, 2.46)
  ];
  return { body, detail, lights, length: L, width: 2.0, height: 2.0, headY: 1.08, headZ: -2.5 };
}

function superbikeBlueprint(shirt = 0x1f1f1f) {
  const body = [
    part(box(0.42, 0.42, 0.85), 0xffffff, 0, 0.82, -0.45), // front fairing
    part(box(0.36, 0.24, 0.5), 0xffffff, 0, 1.02, -0.02), // tank
    part(box(0.28, 0.16, 0.55), 0xffffff, 0, 1.08, 0.62, 0.25, 0, 0), // tail
    part(box(0.32, 0.24, 0.6), 0xffffff, 0, 0.55, 0.05)
  ];
  const detail = [
    part(cyl(0.33, 0.33, 0.17, 14), 0x141414, 0, 0.33, -0.72, 0, 0, Math.PI / 2),
    part(cyl(0.34, 0.34, 0.2, 14), 0x141414, 0, 0.34, 0.72, 0, 0, Math.PI / 2),
    part(box(0.3, 0.2, 0.04), GLASS, 0, 1.12, -0.86, -0.7, 0, 0),
    part(box(0.07, 0.6, 0.07), 0x9a9a92, 0, 0.62, -0.68, 0.4, 0, 0),
    part(box(0.12, 0.12, 0.5), 0x7a7a7a, 0.2, 0.62, 0.55, -0.2, 0, 0),
    part(box(0.28, 0.08, 0.45), 0x1a1a1a, 0, 1.1, 0.3),
    ...rider(shirt, 0, 1.08, 0.12, -0.75, 0x16161a)
  ];
  const lights = [part(box(0.24, 0.1, 0.05), HEAD, 0, 0.92, -0.89), part(box(0.18, 0.06, 0.04), TAIL, 0, 1.15, 0.9)];
  return { body, detail, lights, length: 2.1, width: 0.8, height: 1.75, headY: 0.92, headZ: -0.92 };
}

const blueprintCache = new Map();
function blueprint(key, factory) {
  if (!blueprintCache.has(key)) {
    const bp = factory();
    blueprintCache.set(key, { ...bp, body: merge(bp.body), detail: merge(bp.detail), lights: merge(bp.lights) });
  }
  return blueprintCache.get(key);
}

const OKADA_SHIRTS = [0x2f6fb0, 0x2e8a4d, 0xd7a02a, 0x8a2f6b, 0xdedad0];

/** `rider` (hex number) dresses the person on open player vehicles in their outfit colour. */
export function getBlueprint(type, variant = 0, rider = null) {
  switch (type) {
    case "car": return blueprint("car", carBlueprint);
    case "bus":
    case "danfo": return blueprint("danfo", danfoBlueprint);
    case "bike": return blueprint(`bike-player-${rider}`, () => okadaBlueprint(rider ?? 0x1f1f1f, false, true));
    case "keke": return blueprint(`keke-${rider}`, () => kekeBlueprint(rider ?? 0x2f6fb0));
    case "superbike": return blueprint(`superbike-${rider}`, () => superbikeBlueprint(rider ?? 0x1f1f1f));
    case "molue": return blueprint("molue", molueBlueprint);
    case "suv": return blueprint("suv", suvBlueprint);
    case "okada": {
      const v = variant % 10;
      return blueprint(`okada-${v}`, () => okadaBlueprint(OKADA_SHIRTS[v % OKADA_SHIRTS.length], v >= 5));
    }
    case "truck": return blueprint(`truck-${variant % 3}`, () => truckBlueprint([0x5d6b3a, 0x7a5236, 0x3f5a7a][variant % 3]));
    case "tanker": return blueprint("tanker", tankerBlueprint);
    case "brt": return blueprint("brt", brtBlueprint);
    default: throw new Error(`Unknown vehicle type ${type}`);
  }
}

// ---------- detailed Blender models (tools/blender/build_vehicles.py → public/models/*.glb) ----------
const GLB_FILES = { car: "car", bus: "danfo", bike: "okada", keke: "keke", molue: "molue", superbike: "superbike", suv: "suv" };
const glbTemplates = {};
const glbPaint = new Map();
const glbShirt = new Map();
const glbLights = {};

/** Load the Blender models. Missing files are fine: those vehicles keep the built-in block models. */
export async function loadVehicleModels(base = "./models/") {
  const loader = new GLTFLoader();
  const names = [...new Set(Object.values(GLB_FILES))];
  const results = await Promise.allSettled(names.map((n) => loader.loadAsync(`${base}${n}.glb`)));
  results.forEach((r, i) => {
    if (r.status === "fulfilled") glbTemplates[names[i]] = r.value.scene;
    else console.warn(`Vehicle model ${names[i]}.glb not loaded; using the block model.`);
  });
  return Object.keys(glbTemplates).length;
}

function paintFor(color) {
  if (!glbPaint.has(color)) glbPaint.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.35 }));
  return glbPaint.get(color);
}
function shirtFor(color) {
  if (!glbShirt.has(color)) glbShirt.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
  return glbShirt.get(color);
}
function lightFor(material) {
  const key = material.name;
  if (!glbLights[key]) glbLights[key] = new THREE.MeshBasicMaterial({ color: material.color.clone(), toneMapped: false });
  return glbLights[key];
}

function buildDetailed(type, color, rider) {
  const template = glbTemplates[GLB_FILES[type]];
  const model = template.clone(true);
  const paintMeshes = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    // the exporter gives one mesh per material, so each mesh has a single material
    const name = o.material.name;
    if (name === "Body") { o.material = paintFor(color); paintMeshes.push(o); }
    else if (name === "Shirt" && rider !== null) o.material = shirtFor(rider);
    else if (name === "Head" || name === "Tail") o.material = lightFor(o.material);
  });
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  inner.add(model);
  group.userData = { inner, blueprint: getBlueprint(type, 0, rider), paintMeshes };
  return group;
}

/** Repaint a vehicle built by buildVehicle (block or detailed). */
export function setPaint(vehicle, color) {
  const { paintMeshes, inner } = vehicle.userData;
  if (paintMeshes) {
    for (const o of paintMeshes) o.material = paintFor(color);
  } else {
    inner.children[0].material = bodyMaterial(color);
  }
}

/** `detailed` uses the Blender model when it loaded (player and online rides; traffic stays light). */
export function buildVehicle(type, color, variant = 0, rider = null, detailed = false) {
  if (detailed && glbTemplates[GLB_FILES[type]]) return buildDetailed(type, color, rider);
  const bp = getBlueprint(type, variant, rider);
  const group = new THREE.Group();
  const inner = new THREE.Group(); // inner group can lean/bounce without fighting road placement
  group.add(inner);
  const bodyMesh = new THREE.Mesh(bp.body, bodyMaterial(color));
  const detailMesh = new THREE.Mesh(bp.detail, materials.detail);
  const lightMesh = new THREE.Mesh(bp.lights, materials.lights);
  bodyMesh.castShadow = detailMesh.castShadow = true;
  inner.add(bodyMesh, detailMesh, lightMesh);
  group.userData = { inner, blueprint: bp };
  return group;
}

// ---------- people & props ----------
const SKIN = 0x4a2e1e;
const CLOTH = [0xd94f3a, 0x2f7fbf, 0xe8c547, 0x3c9a5f, 0xa04ec2, 0xf08a3c, 0xeeeeea];

export function buildPedestrian(rng = Math.random, hawker = true) {
  const cloth = CLOTH[Math.floor(rng() * CLOTH.length)];
  const parts = [
    part(box(0.42, 0.62, 0.26), cloth, 0, 1.15, 0),
    part(box(0.4, 0.7, 0.24), rng() < 0.5 ? 0x2a2a35 : cloth, 0, 0.45, 0, 0, 0, 0, 1, 1, 1),
    part(sphere(0.14), SKIN, 0, 1.62, 0),
    part(box(0.1, 0.5, 0.1), SKIN, -0.27, 1.1, 0),
    part(box(0.1, 0.5, 0.1), SKIN, 0.27, 1.1, 0)
  ];
  if (hawker) {
    const goods = [0xe6d7a6, 0xd23c2a, 0x6fb3d9, 0xf2b705][Math.floor(rng() * 4)];
    parts.push(part(cyl(0.38, 0.32, 0.12, 10), 0x8b6b3e, 0, 1.82, 0), part(box(0.5, 0.18, 0.5), goods, 0, 1.96, 0));
  }
  const mesh = new THREE.Mesh(merge(parts), materials.detail);
  mesh.castShadow = true;
  return mesh;
}

export function coneGeometry() {
  return merge([
    part(box(0.5, 0.06, 0.5), 0x222222, 0, 0.03, 0),
    part(cone(0.2, 0.75, 10), 0xff6a13, 0, 0.42, 0),
    part(cyl(0.12, 0.155, 0.12, 10), 0xf4f4f4, 0, 0.5, 0)
  ]);
}

export function barrierGeometry() {
  return merge([
    part(box(0.12, 1.1, 0.12), 0x999999, -1.4, 0.55, 0),
    part(box(0.12, 1.1, 0.12), 0x999999, 1.4, 0.55, 0),
    part(box(3.2, 0.32, 0.08), 0xf2f2f2, 0, 0.9, 0),
    part(box(0.4, 0.33, 0.09), 0xd8261c, -1.1, 0.9, 0),
    part(box(0.4, 0.33, 0.09), 0xd8261c, -0.3, 0.9, 0),
    part(box(0.4, 0.33, 0.09), 0xd8261c, 0.5, 0.9, 0),
    part(box(0.35, 0.33, 0.09), 0xd8261c, 1.2, 0.9, 0),
    part(box(1.2, 0.9, 0.06), 0xf2b705, 0, 1.8, 0),
    part(box(0.08, 0.7, 0.08), 0x999999, 0, 1.2, 0)
  ]);
}
