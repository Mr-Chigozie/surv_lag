import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

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

const blueprintCache = new Map();
function blueprint(key, factory) {
  if (!blueprintCache.has(key)) {
    const bp = factory();
    blueprintCache.set(key, { ...bp, body: merge(bp.body), detail: merge(bp.detail), lights: merge(bp.lights) });
  }
  return blueprintCache.get(key);
}

const OKADA_SHIRTS = [0x2f6fb0, 0x2e8a4d, 0xd7a02a, 0x8a2f6b, 0xdedad0];

export function getBlueprint(type, variant = 0) {
  switch (type) {
    case "car": return blueprint("car", carBlueprint);
    case "bus":
    case "danfo": return blueprint("danfo", danfoBlueprint);
    case "bike": return blueprint("bike-player", () => okadaBlueprint(0x1f1f1f, false, true));
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

export function buildVehicle(type, color, variant = 0) {
  const bp = getBlueprint(type, variant);
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
