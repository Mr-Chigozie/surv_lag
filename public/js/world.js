import * as THREE from "three";
import { LANE_WIDTH } from "./maps.js";
import { makeRng, valueNoise } from "./track.js";
import { part, box, cyl, cone, sphere, merge, materials, buildPedestrian } from "./models.js";

const ROUTE_ENDS = {
  "third-mainland": ["EBUTE METTA", "LAGOS ISLAND"],
  ikorodu: ["OJOTA", "JIBOWU · YABA"],
  lekki: ["LEKKI PHASE 1", "AJAH"],
  oshodi: ["OSHODI", "IKEJA"]
};

const ADS = [
  ["SUYA SPOT", "Hot & spicy · open till late", "#1c1c1c", "#f2b705"],
  ["OYA PAY", "Send money sharp sharp", "#5b2bd6", "#ffffff"],
  ["JOLLOF KINGDOM", "Party rice. Every day.", "#d23c2a", "#fff4d6"],
  ["GO-SLOW INSURANCE", "Because traffic happens", "#0f5f4a", "#e9ffb0"],
  ["EKO 5G", "Fast like okada", "#0a3d91", "#ffffff"],
  ["DRIVE SAFE", "Arrive alive · respect the zebra", "#f2f2f2", "#d23c2a"]
];

// ---------- canvas textures ----------
function canvasTexture(width, height, draw, { repeat = true, srgb = true } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function speckle(ctx, w, h, count, colors, size = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * size + 0.5, Math.random() * size + 0.5);
  }
}

function roadTexture(map, rng) {
  const lanes = map.lanes;
  const metres = 48; // texture repeats every 48 m
  return canvasTexture(512, 2048, (ctx, w, h) => {
    const base = map.id === "ikorodu" ? "#585651" : map.id === "oshodi" ? "#4a4844" : "#4b4c4a";
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, 22000, ["#5e5e5a", "#3f3f3c", "#666660", "#454542"], 2);
    // repair patches & tyre wear
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = rng() < 0.5 ? "rgba(30,30,28,.35)" : "rgba(110,105,95,.22)";
      ctx.fillRect(rng() * w, rng() * h, 30 + rng() * 120, 40 + rng() * 200);
    }
    const laneW = w / lanes;
    for (let i = 0; i < lanes; i++) {
      ctx.fillStyle = "rgba(25,25,25,.18)";
      ctx.fillRect(laneW * (i + 0.25) - 8, 0, 16, h);
      ctx.fillRect(laneW * (i + 0.75) - 8, 0, 16, h);
    }
    // cracks
    ctx.strokeStyle = "rgba(25,25,22,.55)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
      let x = rng() * w;
      let y = rng() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (rng() - 0.5) * 30;
        y += rng() * 25;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const pxPerM = h / metres;
    // edge lines
    ctx.fillStyle = "#e3b62c";
    ctx.fillRect(6, 0, 7, h);
    ctx.fillStyle = "#e9e6dc";
    ctx.fillRect(w - 13, 0, 7, h);
    // lane dividers: 4 m dash, 8 m gap
    for (let lane = 1; lane < lanes; lane++) {
      const x = laneW * lane - 3;
      const solid = map.id === "ikorodu" && lane === 1;
      if (solid) {
        ctx.fillStyle = "#e9e6dc";
        ctx.fillRect(x - 6, 0, 5, h);
        ctx.fillRect(x + 6, 0, 5, h);
      } else {
        ctx.fillStyle = "rgba(233,230,220,.85)";
        for (let m = 0; m < metres; m += 12) ctx.fillRect(x, h - (m + 4) * pxPerM, 6, 4 * pxPerM);
      }
    }
    if (map.id === "ikorodu") {
      ctx.save();
      ctx.fillStyle = "rgba(233,230,220,.8)";
      ctx.font = "bold 70px sans-serif";
      ctx.textAlign = "center";
      ctx.translate(laneW / 2, h * 0.3);
      ctx.scale(1, 2.4);
      ctx.fillText("BRT", 0, 0);
      ctx.restore();
      ctx.fillStyle = "rgba(200,40,40,.12)";
      ctx.fillRect(14, 0, laneW - 20, h);
    }
  });
}

const kerbTexture = () => canvasTexture(32, 64, (ctx, w, h) => {
  ctx.fillStyle = "#e7b416";
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = "#1d1d1d";
  ctx.fillRect(0, h / 2, w, h / 2);
});

const concreteTexture = () => canvasTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = "#b9b3a6";
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 2500, ["#a8a295", "#c8c2b5", "#9a9488"], 2);
  ctx.strokeStyle = "rgba(70,65,60,.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, h);
});

const grainTexture = () => canvasTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, 5000, ["#d8d8d8", "#eeeeee", "#c4c4c4", "#fafafa"], 3);
}, { srgb: false });

const waterTexture = (color) => canvasTexture(256, 256, (ctx, w, h) => {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * h;
    const x = Math.random() * w;
    ctx.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.12})`;
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 10, y - 3, x + 22 + Math.random() * 20, y);
    ctx.stroke();
  }
});

function windowTextures(night) {
  const draw = (lit) => (ctx, w, h) => {
    ctx.fillStyle = lit ? "#000000" : "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const cols = 4;
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const on = Math.random() < (night ? 0.45 : 0.15);
        ctx.fillStyle = lit ? (on ? "#ffcf7a" : "#000000") : on ? "#c9b47a" : "#3c4c52";
        ctx.fillRect(8 + c * 30, 6 + r * 30, 18, 20);
      }
    }
    if (!lit) {
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.fillRect(0, h - 10, w, 10);
    }
  };
  return { map: canvasTexture(128, 256, draw(false), { repeat: false }), emissive: canvasTexture(128, 256, draw(true), { repeat: false }) };
}

function bannerTexture(title, subtitle, bg = "#111714", fg = "#c9f06b") {
  return canvasTexture(1024, 192, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 48) {
      ctx.fillStyle = (i / 48) % 2 ? "#111" : "#eee";
      ctx.fillRect(i, 0, 48, 16);
      ctx.fillStyle = (i / 48) % 2 ? "#eee" : "#111";
      ctx.fillRect(i, h - 16, 48, 16);
    }
    ctx.fillStyle = fg;
    ctx.font = "bold 78px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, w / 2, 104);
    ctx.fillStyle = "#f4f3e9";
    ctx.font = "500 34px 'DM Mono', monospace";
    ctx.fillText(subtitle, w / 2, 152);
  }, { repeat: false });
}

function adTexture([title, tagline, bg, fg]) {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(w * 0.85, h * 0.2, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = "bold 62px 'Space Grotesk', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(title, 28, 130, w - 56);
    ctx.font = "500 26px 'DM Sans', sans-serif";
    ctx.fillText(tagline, 30, 182, w - 60);
  }, { repeat: false });
}

const radialTexture = () => canvasTexture(128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, "rgba(255,214,150,.75)");
  g.addColorStop(0.5, "rgba(255,190,110,.25)");
  g.addColorStop(1, "rgba(255,170,80,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}, { repeat: false });

// ---------- instancing helper ----------
function instanced(geometry, material, items, { cast = true, receive = false } = {}) {
  if (!items.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  const color = new THREE.Color();
  items.forEach((item, i) => {
    mesh.setMatrixAt(i, item.matrix);
    if (item.color !== undefined) mesh.setColorAt(i, color.set(item.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.computeBoundingSphere();
  return mesh;
}

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- scenery geometry ----------
function palmGeometry() {
  const parts = [];
  let x = 0;
  for (let i = 0; i < 5; i++) {
    x += 0.12;
    parts.push(part(cyl(0.16 - i * 0.012, 0.2 - i * 0.012, 1.6, 7), i % 2 ? 0x7a5c3e : 0x6b4f35, x, 0.8 + i * 1.55, 0, 0, 0, -0.06));
  }
  const topX = x + 0.1;
  const topY = 8.1;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(part(box(0.5, 0.06, 3.2), i % 2 ? 0x3f7a3a : 0x4d8f3f, topX + Math.sin(a) * 1.3, topY - 0.35, Math.cos(a) * 1.3, 0.45, a, 0));
  }
  parts.push(part(sphere(0.32, 6), 0x5b4a22, topX, topY - 0.3, 0));
  return merge(parts);
}

function lampGeometry() {
  return merge([
    part(cyl(0.09, 0.13, 8, 8), 0x6f716e, 0, 4, 0),
    part(box(2.2, 0.1, 0.1), 0x6f716e, -1.1, 7.95, 0),
    part(box(0.6, 0.12, 0.3), 0x3a3a3a, -2.1, 7.85, 0)
  ]);
}

function stallGeometry(umbrella, goods) {
  return merge([
    part(box(2.2, 0.85, 1.4), 0x8b6b3e, 0, 0.43, 0),
    part(box(2.0, 0.25, 1.2), goods, 0, 0.98, 0),
    part(cyl(0.04, 0.04, 2.4, 5), 0x555555, 0, 1.6, 0),
    part(cone(1.15, 0.55, 8), umbrella, 0, 2.6, 0),
    part(box(0.6, 0.45, 0.4), 0xd9c9a0, 1.4, 0.23, 0.3)
  ]);
}

function houseGeometry(roof) {
  return merge([
    part(box(1, 1, 1), 0xece2cc, 0, 0.5, 0),
    part(cone(0.78, 0.5, 4), roof, 0, 1.25, 0, 0, Math.PI / 4, 0),
    part(box(0.2, 0.4, 0.02), 0x5a3a22, 0, 0.2, 0.51)
  ]);
}

function hutGeometry() {
  const parts = [];
  for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) parts.push(part(box(0.15, 2.2, 0.15), 0x5c4630, x, 1.1, z));
  parts.push(part(box(3, 1.8, 3), 0x8a6a48, 0, 3.1, 0), part(box(3.4, 0.12, 3.6), 0x8a5a3a, 0, 4.1, 0, 0.18, 0, 0));
  return merge(parts);
}

function canoeGeometry() {
  return merge([
    part(box(0.9, 0.35, 5), 0x6b4a2e, 0, 0.15, 0),
    part(box(0.3, 0.9, 0.3), 0x2f6fb0, 0, 0.75, 0.6),
    part(sphere(0.13), 0x4a2e1e, 0, 1.3, 0.6)
  ]);
}

// ---------- the world ----------
export function buildWorld(scene, map, track, quality) {
  const rng = makeRng(`${map.id}-world`);
  const hw = track.halfWidth;
  const group = new THREE.Group();
  scene.add(group);
  const night = map.night;
  const updaters = [];
  const add = (mesh) => mesh && group.add(mesh);
  const anisotropy = quality.anisotropy;

  // sky dome
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(map.sky.top) }, bottom: { value: new THREE.Color(map.sky.bottom) } },
    vertexShader: "varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vPos; void main(){ float h = clamp(normalize(vPos).y * 1.6 + 0.05, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0); }"
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 24, 12), skyMaterial);
  sky.renderOrder = -1;
  scene.add(sky);
  group.userData.sky = sky;

  let stars = null;
  if (night) {
    const positions = [];
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = 0.15 + Math.random() * 1.3;
      positions.push(Math.cos(a) * Math.cos(e) * 1000, Math.sin(e) * 1000, Math.sin(a) * Math.cos(e) * 1000);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
    scene.add(stars);
  }

  scene.fog = new THREE.Fog(map.sky.fog, map.sky.fogNear, map.sky.fogFar);
  scene.background = new THREE.Color(map.sky.bottom);

  // lights
  const hemi = new THREE.HemisphereLight(map.hemi?.[0] ?? map.sky.top, map.hemi?.[1] ?? map.ground, map.ambient);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(map.sun.color, map.sun.intensity);
  const sunDir = v3(...map.sun.dir).normalize();
  sun.castShadow = quality.shadows;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 260 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // road surface
  const roadMap = roadTexture(map, rng);
  roadMap.anisotropy = anisotropy;
  const roadMaterial = new THREE.MeshStandardMaterial({ map: roadMap, roughness: night ? 0.55 : 0.9, metalness: 0 });
  const road = new THREE.Mesh(track.ribbon([{ l: -hw, y: 0 }, { l: hw, y: 0 }], { vLength: 48 }), roadMaterial);
  road.receiveShadow = true;
  group.add(road);

  const grain = grainTexture();
  const concreteMap = concreteTexture();
  const concrete = new THREE.MeshStandardMaterial({ map: concreteMap, roughness: 0.95 });

  if (map.terrain === "water") {
    // bridge barriers + deck edges
    const barrier = new THREE.MeshStandardMaterial({ color: 0xc9c4b6, roughness: 0.9, map: grain });
    for (const side of [-1, 1]) {
      const e = hw * side;
      const profile = side < 0
        ? [{ l: e - 0.9, y: -1.6 }, { l: e - 0.9, y: 0.9 }, { l: e - 0.5, y: 0.95 }, { l: e - 0.12, y: 0.9 }, { l: e, y: 0.02 }]
        : [{ l: e, y: 0.02 }, { l: e + 0.12, y: 0.9 }, { l: e + 0.5, y: 0.95 }, { l: e + 0.9, y: 0.9 }, { l: e + 0.9, y: -1.6 }];
      const mesh = new THREE.Mesh(track.ribbon(profile, { vLength: 4, uFromLat: true }), barrier);
      mesh.receiveShadow = mesh.castShadow = true;
      group.add(mesh);
    }
    const underside = new THREE.Mesh(track.ribbon([{ l: hw + 0.9, y: -1.6 }, { l: -hw - 0.9, y: -1.6 }]), barrier);
    group.add(underside);
    // pillars
    const pillarItems = [];
    for (let s = track.sMin + 10; s < track.sMax; s += 32) {
      const deckY = track.frame(s).y - 1.6;
      for (const lat of [-hw * 0.55, hw * 0.55]) pillarItems.push({ matrix: track.matrix(s, lat, -1.6 - deckY / 2, v3(1.4, deckY + 2, 1.4)) });
      pillarItems.push({ matrix: track.matrix(s, 0, -1.9, v3(hw * 2 + 1.2, 0.6, 1.8)) });
    }
    add(instanced(box(1, 1, 1).translate(0, 0, 0), barrier, pillarItems, { cast: false }));
  } else {
    // ground terrain
    const base = hw + 0.4;
    const lats = [-320, -210, -140, -95, -62, -40, -26, -16, -base - 6, -base - 2, -base];
    const profile = [...lats.map((l) => ({ l })), ...lats.slice().reverse().map((l) => ({ l: -l }))];
    const groundColor = new THREE.Color(map.ground);
    const palette = {
      city: [0x8a7a5c, 0x6f6a55, 0x9c8c6a],
      market: [0x4a4034, 0x3c342a, 0x5a4c3a],
      coast: [0xd8bf8a, 0xc9ad74, 0x7d9b5a]
    }[map.terrain];
    const ground = new THREE.Mesh(
      track.ribbon(profile, {
        vLength: 6,
        uFromLat: true,
        yFn: (p, s) => {
          const a = Math.abs(p.l);
          if (a <= base + 2.1) return -0.06;
          const n = valueNoise(p.l * 0.04, s * 0.02);
          if (map.terrain === "coast" && p.l > 45) return -Math.min(2.6, (p.l - 45) * 0.06) + n * 0.3;
          const amp = map.terrain === "coast" ? 1.8 : 0.4;
          return -0.1 + n * amp * Math.min(1, (a - base) / 30);
        },
        colorFn: (p, s, out) => {
          const n = valueNoise(p.l * 0.05 + 7, s * 0.015);
          if (map.terrain === "coast") {
            const grass = p.l < -20 ? Math.min(1, (-p.l - 20) / 25) * (0.4 + n * 0.6) : 0;
            out.set(palette[0]).lerp(new THREE.Color(palette[2]), grass).lerp(new THREE.Color(palette[1]), n * 0.4);
          } else {
            out.set(palette[0]).lerp(new THREE.Color(n > 0.5 ? palette[2] : palette[1]), Math.abs(n - 0.5) * 1.4);
          }
          out.lerp(groundColor, 0.15);
        }
      }),
      new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: 1 })
    );
    ground.receiveShadow = true;
    group.add(ground);

    // kerbs (yellow/black, very Lagos) + sidewalks
    const kerbMaterial = new THREE.MeshStandardMaterial({ map: kerbTexture(), roughness: 0.8 });
    const walk = map.terrain === "coast" ? 1.2 : 3.6;
    for (const side of [-1, 1]) {
      const e = hw * side;
      const kerbProfile = side < 0
        ? [{ l: e - 0.3, y: 0.22 }, { l: e, y: 0.22 }, { l: e, y: 0 }]
        : [{ l: e, y: 0 }, { l: e, y: 0.22 }, { l: e + 0.3, y: 0.22 }];
      const kerb = new THREE.Mesh(track.ribbon(kerbProfile, { vLength: 2 }), kerbMaterial);
      kerb.receiveShadow = true;
      group.add(kerb);
      const walkProfile = side < 0
        ? [{ l: e - 0.3 - walk, y: -0.05 }, { l: e - 0.3 - walk, y: 0.2 }, { l: e - 0.3, y: 0.2 }]
        : [{ l: e + 0.3, y: 0.2 }, { l: e + 0.3 + walk, y: 0.2 }, { l: e + 0.3 + walk, y: -0.05 }];
      const sidewalk = new THREE.Mesh(track.ribbon(walkProfile, { vLength: 2, uFromLat: true }), concrete);
      sidewalk.receiveShadow = true;
      group.add(sidewalk);
    }
  }

  // water
  let water = null;
  if (map.terrain === "water" || map.terrain === "coast") {
    const tex = waterTexture(map.terrain === "water" ? "#3d6e78" : "#3c6f8a");
    tex.repeat.set(80, 80);
    const waterMaterial = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.12, metalness: 0.35, color: night ? 0x6a7a90 : 0xffffff });
    water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = map.terrain === "water" ? 0 : -0.6;
    water.receiveShadow = true;
    scene.add(water);
    updaters.push((t, cam) => {
      water.position.x = cam.x;
      water.position.z = cam.z;
      tex.offset.set(cam.x / 30 + t * 0.01, -cam.z / 30 + t * 0.006);
    });
  }

  // ---------- scenery ----------
  const has = (name) => map.scenery.includes(name);
  const { map: winMap, emissive: winEmissive } = windowTextures(night);
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: winMap,
    emissiveMap: winEmissive,
    emissive: night ? 0xffffff : 0x000000,
    emissiveIntensity: night ? 0.55 : 0,
    roughness: 0.85
  });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8c8a84, roughness: 0.95 });
  const buildingGeo = box(1, 1, 1).translate(0, 0.5, 0);
  const buildingMats = [wallMaterial, wallMaterial, roofMaterial, roofMaterial, wallMaterial, wallMaterial];
  const BUILDING_COLORS = [0xe8dcc2, 0xd9a77c, 0xc77b5a, 0xa9c4c9, 0xbfd6b0, 0xd8d2c8, 0xe6c86e, 0x9fa6a8];

  const buildings = [];
  const tanks = [];
  const placeBuildings = (minLat, maxLat, minH, maxH, gapMin, gapMax) => {
    for (const side of [-1, 1]) {
      for (let s = track.sMin + 20; s < track.sMax - 10;) {
        const w = 8 + rng() * 12;
        const d = 8 + rng() * 10;
        const h = minH + rng() * rng() * (maxH - minH);
        const lat = side * (minLat + rng() * (maxLat - minLat) + d / 2);
        buildings.push({ matrix: track.matrix(s, lat, -0.2, v3(d, h, w), 0), color: BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)] });
        if (rng() < 0.55) tanks.push({ matrix: track.matrix(s + (rng() - 0.5) * w * 0.5, lat + (rng() - 0.5) * d * 0.4, h - 0.2, v3(1, 1, 1)) });
        s += w + gapMin + rng() * (gapMax - gapMin);
      }
    }
  };
  if (has("buildings")) {
    if (map.terrain === "market") placeBuildings(hw + 12, hw + 20, 5, 16, 1, 6);
    else placeBuildings(hw + 5.5, hw + 12, 6, 34, 2, 10);
  }
  if (has("skyline")) {
    for (let s = track.sMin; s < track.sMax + 300; s += 18 + rng() * 30) {
      const side = rng() < 0.5 ? -1 : 1;
      const h = 20 + rng() * rng() * 110;
      const w = 14 + rng() * 22;
      buildings.push({ matrix: track.matrix(s, side * (230 + rng() * 260), -track.frame(s).y, v3(w, h, w), 0), color: [0xa9b4bd, 0xc8ccd0, 0x8e9aa6, 0xd6d0c0][Math.floor(rng() * 4)] });
    }
  }
  const buildingMesh = instanced(buildingGeo, buildingMats, buildings, { cast: true, receive: true });
  if (buildingMesh) group.add(buildingMesh);
  const tankMesh = instanced(cyl(0.6, 0.6, 1.2, 10).translate(0, 0.6, 0), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 }), tanks);
  if (tankMesh) group.add(tankMesh);

  // lamp posts
  const lampHeads = [];
  const lampPools = [];
  if (has("lampposts")) {
    const lampItems = [];
    const offset = map.terrain === "water" ? 0.5 : map.terrain === "coast" ? 1.2 : 1.8;
    for (let s = track.sMin + 15, i = 0; s < track.sMax; s += 42, i++) {
      const side = map.terrain === "water" || i % 2 === 0 ? (i % 2 ? 1 : -1) : 1;
      const lat = side * (hw + offset);
      const yaw = side > 0 ? 0 : Math.PI;
      lampItems.push({ matrix: track.matrix(s, lat, 0.2, v3(1, 1, 1), yaw) });
      const headLat = side * (hw + offset - 2.1);
      lampHeads.push({ matrix: track.matrix(s, headLat, 7.74, v3(1, 1, 1), yaw) });
      if (night) lampPools.push({ matrix: track.matrix(s, side * (hw + offset - 3.2), 0.05, v3(14, 1, 14)) });
    }
    add(instanced(lampGeometry(), materials.detail, lampItems));
    const headMat = new THREE.MeshBasicMaterial({ color: night ? 0xffe1a0 : 0x9a9a90, toneMapped: !night });
    add(instanced(box(0.5, 0.06, 0.25), headMat, lampHeads, { cast: false }));
    if (night) {
      const poolMat = new THREE.MeshBasicMaterial({ map: radialTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      add(instanced(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat, lampPools, { cast: false }));
    }
  }

  // billboards
  if (has("billboards")) {
    const frames = [];
    const panels = ADS.map(() => []);
    for (let s = 60; s < track.sMax; s += 110 + rng() * 120) {
      const side = rng() < 0.5 ? -1 : 1;
      const lat = side * (hw + 5);
      const yaw = -side * 0.25;
      frames.push({ matrix: track.matrix(s, lat, 0, v3(1, 1, 1), yaw) });
      panels[Math.floor(rng() * ADS.length)].push({ matrix: track.matrix(s, lat, 7.5, v3(1, 1, 1), yaw) });
    }
    const frameGeo = merge([
      part(box(0.3, 9.5, 0.3), 0x555555, -2.5, 4.75, -0.35), part(box(0.3, 9.5, 0.3), 0x555555, 2.5, 4.75, -0.35),
      part(box(8.4, 4.4, 0.2), 0x333333, 0, 7.5, -0.12)
    ]);
    add(instanced(frameGeo, materials.detail, frames));
    const panelGeo = new THREE.PlaneGeometry(8, 4);
    panels.forEach((items, i) => {
      if (!items.length) return;
      const mat = new THREE.MeshBasicMaterial({ map: adTexture(ADS[i]), toneMapped: true, color: night ? 0xbbbbbb : 0xffffff });
      add(instanced(panelGeo, mat, items, { cast: false }));
    });
  }

  // pedestrian bridges
  if (has("pedbridge")) {
    const items = [];
    const span = hw * 2 + 9;
    const geo = merge([
      part(box(span, 0.5, 2.6), 0x8d8a82, 0, 6.4, 0),
      part(box(span, 1.1, 0.08), 0x2f6f4a, 0, 7.2, 1.25), part(box(span, 1.1, 0.08), 0x2f6f4a, 0, 7.2, -1.25),
      part(box(2.8, 6.6, 2.8), 0x9b978e, -span / 2 - 1.2, 3.3, 0), part(box(2.8, 6.6, 2.8), 0x9b978e, span / 2 + 1.2, 3.3, 0),
      part(box(2.6, 0.12, 2.6), 0x2f6f4a, -span / 2 - 1.2, 6.7, 0), part(box(2.6, 0.12, 2.6), 0x2f6f4a, span / 2 + 1.2, 6.7, 0)
    ]);
    for (let s = 380; s < map.length; s += 520) items.push({ matrix: track.matrix(s, 0, 0, v3(1, 1, 1)) });
    add(instanced(geo, materials.detail, items, { cast: true }));
  }

  // palms
  if (has("palms")) {
    const items = [];
    for (let s = track.sMin; s < track.sMax; s += 6 + rng() * 9) {
      const side = rng() < 0.5 ? -1 : 1;
      const lat = side * (hw + 4 + rng() * rng() * 40);
      const sc = 0.8 + rng() * 0.6;
      const m = track.matrix(s, lat, -0.1, v3(sc, sc * (0.85 + rng() * 0.4), sc), rng() * Math.PI * 2);
      items.push({ matrix: m });
    }
    add(instanced(palmGeometry(), materials.detail, items));
  }

  // walled estates (Lekki)
  if (has("estates")) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9dfc8, roughness: 0.9, map: grain });
    const wallMesh = new THREE.Mesh(track.ribbon([{ l: -hw - 16, y: -0.2 }, { l: -hw - 16, y: 2.6 }, { l: -hw - 15.7, y: 2.6 }], { vLength: 6, s0: 100, s1: map.length + 300 }), wallMat);
    wallMesh.castShadow = wallMesh.receiveShadow = true;
    group.add(wallMesh);
    for (const roof of [0xb2442e, 0x3f4f6a]) {
      const items = [];
      for (let s = 110; s < map.length + 300; s += 16 + rng() * 14) {
        if (rng() < 0.5) continue;
        const sx = 9 + rng() * 5;
        const sy = 4 + rng() * 4;
        items.push({ matrix: track.matrix(s, -hw - 24 - rng() * 20, -0.1, v3(sx, sy, 8 + rng() * 4), 0) });
      }
      add(instanced(houseGeometry(roof), materials.detail, items));
    }
  }

  // Makoko-style stilt village + canoes on the lagoon
  if (has("boats")) {
    const huts = [];
    for (let s = 600; s < 1900; s += 9 + rng() * 10) {
      for (let k = 0; k < 3; k++) if (rng() < 0.6) huts.push({ matrix: track.matrix(s + rng() * 6, -90 - k * 22 - rng() * 60, -track.frame(s).y, v3(1, 1, 1), rng() * 0.6) });
    }
    add(instanced(hutGeometry(), materials.detail, huts));
    const canoes = [];
    for (let i = 0; i < 70; i++) {
      const s = rng() * map.length;
      const side = rng() < 0.6 ? -1 : 1;
      canoes.push({ matrix: track.matrix(s, side * (25 + rng() * 180), -track.frame(s).y, v3(1, 1, 1), rng() * Math.PI) });
    }
    add(instanced(canoeGeometry(), materials.detail, canoes));
  }

  // market stalls + crowd + overpass (Oshodi)
  const bulbs = [];
  if (has("stalls")) {
    const variants = [[0xd23c2a, 0xe8c547], [0x2f7fbf, 0xd94f3a], [0xf2b705, 0x3c9a5f], [0x3c9a5f, 0xeeeeea]];
    const lists = variants.map(() => []);
    const crowd = [];
    for (const side of [-1, 1]) {
      for (let s = track.sMin + 30; s < track.sMax - 20; s += 2.8 + rng() * 2.5) {
        const lat = side * (hw + 2.4 + rng() * 1.6);
        lists[Math.floor(rng() * variants.length)].push({ matrix: track.matrix(s, lat, 0.2, v3(1, 1, 1), rng() * 0.4 - 0.2) });
        if (night && rng() < 0.6) bulbs.push({ matrix: track.matrix(s, lat, 2.2, v3(1, 1, 1)) });
        if (rng() < 0.7) crowd.push({ s: s + 1.4, lat: side * (hw + 0.9 + rng() * 1.0) });
        if (rng() < 0.5) crowd.push({ s: s + rng() * 2, lat: side * (hw + 5 + rng() * 4) });
      }
    }
    variants.forEach(([umbrella, goods], i) => add(instanced(stallGeometry(umbrella, goods), materials.detail, lists[i])));
    const pedGeos = [0, 1, 2, 3, 4].map(() => buildPedestrian(rng, rng() < 0.5).geometry);
    pedGeos.forEach((geo, i) => {
      const items = crowd.filter((_, k) => k % pedGeos.length === i).map((c) => ({ matrix: track.matrix(c.s, c.lat, 0.2, v3(1, 1, 1), rng() * Math.PI * 2) }));
      add(instanced(geo, materials.detail, items));
    });
    if (bulbs.length) add(instanced(sphere(0.12, 6), new THREE.MeshBasicMaterial({ color: 0xffd58a, toneMapped: false }), bulbs, { cast: false }));
  }

  if (has("overpass")) {
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.95, map: grain });
    const ranges = [[250, 720], [1150, 1650], [1900, 2150]];
    const pillars = [];
    for (const [s0, s1] of ranges) {
      const w = hw + 7;
      const deck = new THREE.Mesh(track.ribbon([{ l: -w, y: 7.2 }, { l: -w, y: 8.8 }, { l: w, y: 8.8 }, { l: w, y: 7.2 }, { l: -w, y: 7.2 }], { s0, s1, vLength: 8, uFromLat: true }), deckMat);
      deck.castShadow = deck.receiveShadow = true;
      group.add(deck);
      for (let s = s0 + 6; s < s1; s += 22) for (const side of [-1, 1]) pillars.push({ matrix: track.matrix(s, side * (hw + 1.1), 0, v3(1.3, 7.3, 1.3)) });
    }
    add(instanced(box(1, 1, 1).translate(0, 0.5, 0), deckMat, pillars, { receive: true }));
  }

  // start / finish gantries
  const [origin, destination] = ROUTE_ENDS[map.id];
  const gantry = (s, title, subtitle, colors) => {
    const g = new THREE.Group();
    const span = hw * 2 + 2.4;
    const post = merge([
      part(box(0.5, 7.5, 0.5), 0x2b2b2b, -span / 2, 3.75, 0), part(box(0.5, 7.5, 0.5), 0x2b2b2b, span / 2, 3.75, 0),
      part(box(span + 0.5, 0.4, 0.5), 0x2b2b2b, 0, 7.4, 0)
    ]);
    const postMesh = new THREE.Mesh(post, materials.detail);
    postMesh.castShadow = true;
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(span - 0.6, (span - 0.6) * 0.1875), new THREE.MeshBasicMaterial({ map: bannerTexture(title, subtitle, ...colors), toneMapped: true }));
    banner.position.set(0, 6.0, 0.3);
    g.add(postMesh, banner);
    track.place(g, s, 0, 0, 0, false);
    group.add(g);
  };
  gantry(28, `START · ${origin}`, `${map.name.toUpperCase()} · ${(map.length / 1000).toFixed(1)} KM`, ["#111714", "#c9f06b"]);
  gantry(map.length, `FINISH · ${destination}`, "YOU SURVIVED LAGOS", ["#c9f06b", "#111714"]);

  return {
    group,
    sun,
    sunDir,
    hemi,
    water,
    update(t, cam, focus) {
      sky.position.copy(cam);
      if (stars) stars.position.copy(cam);
      sun.position.copy(focus).addScaledVector(sunDir, 120);
      sun.target.position.copy(focus);
      for (const fn of updaters) fn(t, cam);
    },
    dispose() {
      scene.remove(group, sky, hemi, sun, sun.target);
      if (stars) scene.remove(stars);
      if (water) scene.remove(water);
      group.traverse((o) => {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        if (o.material) {
          for (const m of [].concat(o.material)) {
            if (m === materials.detail || m === materials.lights) continue;
            for (const key of ["map", "emissiveMap"]) m[key]?.dispose?.();
            m.dispose();
          }
        }
      });
      sky.geometry.dispose();
      skyMaterial.dispose();
    }
  };
}

export { LANE_WIDTH };
