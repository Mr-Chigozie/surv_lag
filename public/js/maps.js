// Route definitions. Each map controls road shape, terrain, scenery, lighting and traffic mix.
// `curves` / `hills` are sums of sines over distance s (metres) -> heading change / elevation.

export const MAPS = {
  "third-mainland": {
    id: "third-mainland",
    name: "Third Mainland Bridge",
    short: "3MB",
    tagline: "11.8 km of bridge over the lagoon. No shoulder, no mercy.",
    time: "MORNING",
    length: 3200,
    lanes: 3,
    terrain: "water",
    walls: true,
    curves: [[0.0009, 0.0011, 0.6], [0.0004, 0.0031, 2.1]],
    hills: [[2.2, 0.0016, 0], [0.8, 0.006, 1.3]],
    baseHeight: 9,
    sky: { top: 0x7fb6d8, bottom: 0xf1dcb0, fog: 0xd9d6c0, fogNear: 120, fogFar: 620 },
    sun: { color: 0xfff1d0, intensity: 2.4, dir: [-0.4, 1, 0.5] },
    ambient: 0.9,
    night: false,
    ground: 0x3d6e78,
    traffic: { density: 0.9, mix: { car: 0.42, danfo: 0.26, okada: 0.08, truck: 0.12, tanker: 0.08, brt: 0.04 } },
    hazards: { potholes: 0.35, roadworks: 2, hawkers: 0, jams: 1 },
    scenery: ["skyline", "lampposts", "boats"],
    parTime: 150
  },
  ikorodu: {
    id: "ikorodu",
    name: "Ikorodu Road",
    short: "IKD",
    tagline: "Four lanes, a BRT corridor and a danfo in every gap.",
    time: "HAZY AFTERNOON",
    length: 2800,
    lanes: 4,
    terrain: "city",
    walls: false,
    curves: [[0.0012, 0.0019, 0.2], [0.0006, 0.0045, 1.7]],
    hills: [[1.4, 0.0022, 0.4]],
    baseHeight: 0,
    sky: { top: 0xb7b9a5, bottom: 0xe9d6a8, fog: 0xd4c49c, fogNear: 60, fogFar: 380 },
    sun: { color: 0xffe0b0, intensity: 2.0, dir: [0.5, 0.8, 0.3] },
    ambient: 1.0,
    night: false,
    ground: 0x8a7a5c,
    traffic: { density: 1.25, mix: { car: 0.36, danfo: 0.34, okada: 0.14, truck: 0.06, tanker: 0.02, brt: 0.08 } },
    hazards: { potholes: 1.0, roadworks: 3, hawkers: 0.5, jams: 2 },
    scenery: ["buildings", "billboards", "lampposts", "pedbridge"],
    parTime: 140
  },
  lekki: {
    id: "lekki",
    name: "Lekki–Epe Expressway",
    short: "LKE",
    tagline: "Fast coastal run. Palm trees, sea breeze, speeding Jeeps.",
    time: "SUNSET",
    length: 3600,
    lanes: 3,
    terrain: "coast",
    walls: false,
    curves: [[0.0016, 0.0013, 1.1], [0.0007, 0.0037, 0.3]],
    hills: [[0.6, 0.003, 0]],
    baseHeight: 0.4,
    sky: { top: 0x3b4f86, bottom: 0xf59a5a, fog: 0xe5a179, fogNear: 110, fogFar: 560 },
    sun: { color: 0xffb27a, intensity: 2.2, dir: [-0.9, 0.35, -0.6] },
    ambient: 0.75,
    night: false,
    ground: 0xd8bf8a,
    traffic: { density: 0.85, mix: { car: 0.54, danfo: 0.18, okada: 0.08, truck: 0.1, tanker: 0.06, brt: 0.04 } },
    hazards: { potholes: 0.5, roadworks: 2, hawkers: 0.2, jams: 1 },
    scenery: ["palms", "sea", "lampposts", "estates"],
    parTime: 165
  },
  oshodi: {
    id: "oshodi",
    name: "Oshodi Under-Bridge",
    short: "OSH",
    tagline: "Night market chaos. Hawkers, potholes and wall-to-wall danfos.",
    time: "NIGHT",
    length: 2200,
    lanes: 3,
    terrain: "market",
    walls: false,
    curves: [[0.0018, 0.0026, 0.9], [0.0008, 0.006, 0.1]],
    hills: [[0.5, 0.004, 0]],
    baseHeight: 0,
    sky: { top: 0x070b18, bottom: 0x2a2140, fog: 0x161526, fogNear: 30, fogFar: 240 },
    sun: { color: 0x8fa2ff, intensity: 0.35, dir: [0.3, 1, 0.2] },
    ambient: 1.15,
    hemi: [0x5c6aa0, 0x4a3f30],
    night: true,
    ground: 0x3a3328,
    traffic: { density: 1.45, mix: { car: 0.26, danfo: 0.44, okada: 0.2, truck: 0.04, tanker: 0.02, brt: 0.04 } },
    hazards: { potholes: 1.6, roadworks: 2, hawkers: 1.4, jams: 2 },
    scenery: ["stalls", "lampposts", "overpass", "buildings"],
    parTime: 125
  }
};

export const VEHICLES = {
  car: {
    id: "car",
    name: "Salon Car",
    blurb: "Balanced all-rounder. Two hits and you're limping.",
    maxSpeed: 38, // m/s (~137 km/h)
    accel: 9,
    brake: 22,
    steer: 9.5, // lateral m/s at full lock
    health: 100,
    width: 1.85,
    length: 4.3,
    potholeDamage: 8,
    color: 0xd9b23c
  },
  bike: {
    id: "bike",
    name: "Okada",
    blurb: "Lane-splitting legend. Fragile — potholes hurt.",
    maxSpeed: 41,
    accel: 12,
    brake: 26,
    steer: 13,
    health: 55,
    width: 0.8,
    length: 2.1,
    potholeDamage: 22,
    color: 0xe5632f
  },
  bus: {
    id: "bus",
    name: "Danfo",
    blurb: "Slow, wide and built like a tank. Other drivers move for you.",
    maxSpeed: 31,
    accel: 6,
    brake: 16,
    steer: 6.5,
    health: 180,
    width: 2.1,
    length: 5.2,
    potholeDamage: 5,
    color: 0xf2b705
  }
};

export const LANE_WIDTH = 3.6;

// Drivers tweak how the vehicle drives and scores. All multipliers default to 1.
export const DRIVERS = {
  nkechi: {
    id: "nkechi", name: "Mama Nkechi", title: "STEADY HANDS", initials: "MN", color: "#e5632f",
    blurb: "Twenty years without a scratch. Takes the knocks so the car doesn't.",
    perks: ["+25% toughness", "Potholes hurt 30% less", "Slightly slower"],
    speed: 0.97, accel: 0.96, steer: 0.97, health: 1.25, potholes: 0.7, honk: 0, coin: 1, nearMiss: 1
  },
  tunde: {
    id: "tunde", name: "Baba Tunde", title: "OLD SOLDIER", initials: "BT", color: "#2f7fbf",
    blurb: "Thirty years on Lagos roads. When he honks, people move.",
    perks: ["Horn much more effective", "+10% toughness", "Steady, average pace"],
    speed: 1, accel: 1, steer: 1, health: 1.1, potholes: 1, honk: 0.3, coin: 1, nearMiss: 1
  },
  chidi: {
    id: "chidi", name: "Chidi", title: "THE HUSTLER", initials: "CH", color: "#3c9a5f",
    blurb: "Lives for the close shave. Every gap is an opportunity.",
    perks: ["Close passes score +50%", "Coins score +60%", "−10% toughness"],
    speed: 1, accel: 1.04, steer: 1.05, health: 0.9, potholes: 1, honk: 0, coin: 1.6, nearMiss: 1.5
  },
  aisha: {
    id: "aisha", name: "Aisha", title: "RALLY QUEEN", initials: "AS", color: "#a04ec2",
    blurb: "Ex-rally driver. Quick hands, heavy right foot.",
    perks: ["+15% handling", "+6% top speed, +12% acceleration", "−15% toughness"],
    speed: 1.06, accel: 1.12, steer: 1.15, health: 0.85, potholes: 1, honk: 0, coin: 1, nearMiss: 1
  }
};
