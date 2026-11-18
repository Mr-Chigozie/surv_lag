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

// Everything that makes a ride different lives here.
//   maxSpeed m/s · steer = lateral m/s at full lock · armour multiplies damage taken
//   yield = extra chance traffic moves over when you honk · lean = body roll per lateral m/s
//   jobs: [base ₦, ₦ per metre] fares, passenger share and group size at each stop
export const VEHICLES = {
  car: {
    id: "car", name: "Salon Car", icon: "🚗", model: "car",
    blurb: "Balanced all-rounder. Two hits and you're limping.",
    maxSpeed: 38, accel: 9, brake: 22, steer: 9.5, health: 100, width: 1.85, length: 4.3,
    potholeDamage: 8, potholeSlow: 0.86, armour: 1, yield: 0, lean: 0.012, color: 0xd9b23c,
    price: 0, capacity: 3, cargoStep: 1, repair: 4000, costScale: 1, note: "",
    cam: { dist: 8.5, height: 3.2, hoodH: 1.25 }, tagY: 2.2,
    jobs: { passenger: [400, 1.6], parcel: [300, 1.3], share: 0.6, group: [1, 3] }
  },
  keke: {
    id: "keke", name: "Keke Napep", icon: "🛺", model: "keke",
    blurb: "Three wheels, three seats, zero fear. Cheap to run, tips on sharp turns.",
    maxSpeed: 25, accel: 8, brake: 18, steer: 10.5, health: 75, width: 1.35, length: 2.8,
    potholeDamage: 14, potholeSlow: 0.78, armour: 1.1, yield: 0, lean: 0.035, tippy: true, color: 0xf2c12e,
    price: 6000, capacity: 3, cargoStep: 1, repair: 2500, costScale: 0.6, note: "CHEAP REPAIRS · TIPPY",
    cam: { dist: 6.8, height: 2.9, hoodH: 1.6 }, tagY: 2.3,
    jobs: { passenger: [250, 1.15], parcel: [200, 1.0], share: 0.8, group: [1, 3] }
  },
  bike: {
    id: "bike", name: "Okada", icon: "🛵", model: "bike",
    blurb: "Lane-splitting legend. Fragile — potholes hurt.",
    maxSpeed: 41, accel: 12, brake: 26, steer: 13, health: 55, width: 0.8, length: 2.1,
    potholeDamage: 22, potholeSlow: 0.72, armour: 1.25, yield: 0, lean: 0.09, color: 0xe5632f,
    price: 12000, capacity: 1, cargoStep: 1, repair: 2000, costScale: 0.7, note: "BEST PAY / METRE",
    cam: { dist: 6.2, height: 2.7, hoodH: 1.7 }, tagY: 2.4,
    jobs: { passenger: [300, 1.5], parcel: [250, 1.3], share: 0.7, group: [1, 3] }
  },
  bus: {
    id: "bus", name: "Danfo", icon: "🚐", model: "bus",
    blurb: "Slow, wide and built like a tank. Other drivers move for you.",
    maxSpeed: 31, accel: 6, brake: 16, steer: 6.5, health: 180, width: 2.1, length: 5.2,
    potholeDamage: 5, potholeSlow: 0.86, armour: 0.6, yield: 0.25, lean: 0.012, color: 0xf2b705,
    price: 35000, capacity: 8, cargoStep: 2, repair: 7000, costScale: 1.4, note: "CHEAP FARES",
    cam: { dist: 10.5, height: 4.3, hoodH: 1.9 }, tagY: 3.2,
    jobs: { passenger: [150, 0.55], parcel: [250, 0.9], share: 0.85, group: [2, 5] }
  },
  molue: {
    id: "molue", name: "Molue", icon: "🚌", model: "molue",
    blurb: "The yellow giant. Fourteen seats, a conductor on the door and nothing gets in its way.",
    maxSpeed: 25, accel: 4.2, brake: 13, steer: 5.2, health: 280, width: 2.5, length: 9.5,
    potholeDamage: 3, potholeSlow: 0.93, armour: 0.45, yield: 0.45, lean: 0.008, color: 0xf2b705,
    price: 50000, capacity: 14, cargoStep: 3, repair: 10000, costScale: 1.7, note: "PACKED STOPS · TRAFFIC MOVES",
    cam: { dist: 15, height: 5.6, hoodH: 2.6 }, tagY: 3.6,
    jobs: { passenger: [110, 0.42], parcel: [220, 0.8], share: 0.9, group: [3, 7] }
  },
  power: {
    id: "power", name: "Power Bike", icon: "🏍️", model: "superbike",
    blurb: "A superbike on express runs. Fastest thing on the road, and the first to break.",
    maxSpeed: 52, accel: 15, brake: 29, steer: 14, health: 55, width: 0.8, length: 2.1,
    potholeDamage: 26, potholeSlow: 0.65, armour: 1.35, yield: 0, lean: 0.11, color: 0xc8202a,
    price: 75000, capacity: 1, cargoStep: 1, repair: 9000, costScale: 1.5, note: "EXPRESS PARCELS",
    cam: { dist: 6, height: 2.5, hoodH: 1.55 }, tagY: 2.2,
    jobs: { passenger: [400, 1.8], parcel: [700, 2.6], share: 0.15, group: [1, 2] }
  },
  suv: {
    id: "suv", name: "Lekki SUV", icon: "🚙", model: "suv",
    blurb: "Big money on wheels. VIP fares, traffic gives way, and repairs cost a fortune.",
    maxSpeed: 43, accel: 10.5, brake: 24, steer: 8.8, health: 150, width: 2.0, length: 4.9,
    potholeDamage: 5, potholeSlow: 0.9, armour: 0.85, yield: 0.2, lean: 0.01, color: 0x1e1e22,
    price: 90000, capacity: 4, cargoStep: 1, repair: 15000, costScale: 2, note: "VIP FARES · PRICEY REPAIRS",
    cam: { dist: 9.2, height: 3.6, hoodH: 1.55 }, tagY: 2.5,
    jobs: { passenger: [900, 2.7], parcel: [600, 2.0], share: 0.75, group: [1, 2] }
  }
};

export const LANE_WIDTH = 3.6;

// Drivers tweak how the vehicle drives, scores and earns. Missing multipliers default to 1 (honk to 0).
const DRIVER_DEFAULTS = { speed: 1, accel: 1, steer: 1, health: 1, potholes: 1, honk: 0, coin: 1, nearMiss: 1, pay: 1, repair: 1 };
const driver = (d) => ({ ...DRIVER_DEFAULTS, ...d });

export const DRIVERS = {
  nkechi: driver({
    id: "nkechi", name: "Mama Nkechi", title: "STEADY HANDS", initials: "MN", color: "#e5632f",
    blurb: "Twenty years without a scratch. Takes the knocks so the car doesn't.",
    perks: ["+25% toughness", "Potholes hurt 30% less", "Slightly slower"],
    speed: 0.97, accel: 0.96, steer: 0.97, health: 1.25, potholes: 0.7
  }),
  tunde: driver({
    id: "tunde", name: "Baba Tunde", title: "OLD SOLDIER", initials: "BT", color: "#2f7fbf",
    blurb: "Thirty years on Lagos roads. When he honks, people move.",
    perks: ["Horn much more effective", "+10% toughness", "Steady, average pace"],
    health: 1.1, honk: 0.3
  }),
  chidi: driver({
    id: "chidi", name: "Chidi", title: "THE HUSTLER", initials: "CH", color: "#3c9a5f",
    blurb: "Lives for the close shave. Every gap is an opportunity.",
    perks: ["Close passes score +50%", "Coins score +60%", "−10% toughness"],
    accel: 1.04, steer: 1.05, health: 0.9, coin: 1.6, nearMiss: 1.5
  }),
  aisha: driver({
    id: "aisha", name: "Aisha", title: "RALLY QUEEN", initials: "AS", color: "#a04ec2",
    blurb: "Ex-rally driver. Quick hands, heavy right foot.",
    perks: ["+15% handling", "+6% top speed, +12% acceleration", "−15% toughness"],
    speed: 1.06, accel: 1.12, steer: 1.15, health: 0.85
  }),
  emeka: driver({
    id: "emeka", name: "Emeka", title: "THE MECHANIC", initials: "EM", color: "#1f9e9a",
    blurb: "Runs a roadside workshop in Ladipo. Knows every rattle by ear.",
    perks: ["Repair bills 40% cheaper", "+10% toughness", "−5% acceleration"],
    accel: 0.95, health: 1.1, repair: 0.6
  }),
  funke: driver({
    id: "funke", name: "Aunty Funke", title: "SMOOTH TALKER", initials: "AF", color: "#e04f8f",
    blurb: "Every customer leaves as a friend, and friends pay well.",
    perks: ["Fares +15%", "Customers forgive one bump", "−5% top speed"],
    speed: 0.95, pay: 1.15, forgive: true
  })
};

// Outfits change the portrait and, on open rides (okada, keke, power bike), what the rider wears.
// Index 0 is free; the others are bought per driver. `shirt` is the rider's 3D colour.
export const OUTFIT_COSTS = [0, 3000, 6000];
export const OUTFITS = {
  nkechi: [
    { name: "Market Day", shirt: "#17607a", gele: "#f08a24", geleDark: "#e5632f", geleLine: "#b85a14", geleHi: "#ffb45a", cloth: "#17607a", dot: "#f2b705", core: "#e5632f" },
    { name: "Owambe", shirt: "#5b2a86", gele: "#d9a521", geleDark: "#b8860b", geleLine: "#8a6410", geleHi: "#ffe08a", cloth: "#5b2a86", dot: "#f4d35e", core: "#e04f8f" },
    { name: "Sunday Best", shirt: "#2f5fbf", gele: "#2f5fbf", geleDark: "#1f4590", geleLine: "#16336b", geleHi: "#7fa7ff", cloth: "#f4f3e9", dot: "#2f5fbf", core: "#c8202a" }
  ],
  tunde: [
    { name: "Classic", shirt: "#efe6d2", robe: "#efe6d2", trim: "#1f4f7a", stitch: "#f2b705", cap: "#1f4f7a", capDark: "#163c5e" },
    { name: "Chief", shirt: "#1f5e3a", robe: "#1f5e3a", trim: "#d9a521", stitch: "#f4d35e", cap: "#a8262b", capDark: "#7d1b1f" },
    { name: "Royal", shirt: "#4b2462", robe: "#4b2462", trim: "#d9a521", stitch: "#fbf6ee", cap: "#d9a521", capDark: "#a87d10" }
  ],
  chidi: [
    { name: "Yellow Jersey", shirt: "#f2b705", jersey: "#f2b705", trim: "#2e7d4a" },
    { name: "Green Kit", shirt: "#2e7d4a", jersey: "#2e7d4a", trim: "#fbf6ee" },
    { name: "Street Black", shirt: "#1d1d22", jersey: "#1d1d22", trim: "#c8202a" }
  ],
  aisha: [
    { name: "Rally Red", shirt: "#c72f2f", jacket: "#c72f2f", stripe: "#fbf6ee", hijab: "#4b2462", hijabTop: "#5d2d79", hijabLine: "#a04ec2" },
    { name: "Desert Run", shirt: "#c98a3a", jacket: "#c98a3a", stripe: "#3a2a20", hijab: "#2a5e5a", hijabTop: "#327170", hijabLine: "#6fc2bd" },
    { name: "Night Stage", shirt: "#1d2a44", jacket: "#1d2a44", stripe: "#f2b705", hijab: "#141418", hijabTop: "#22222a", hijabLine: "#a04ec2" }
  ],
  emeka: [
    { name: "Workshop Blue", shirt: "#2b4c7e", overalls: "#2b4c7e", tee: "#e8e3d8", cap: "#c8202a" },
    { name: "Hi-Vis", shirt: "#f28c13", overalls: "#f28c13", tee: "#2a2a30", cap: "#1d1d22" },
    { name: "Pit Crew", shirt: "#2e7d4a", overalls: "#2e7d4a", tee: "#f2b705", cap: "#f4f3e9" }
  ],
  funke: [
    { name: "Pink Power", shirt: "#e04f8f", blouse: "#e04f8f", band: "#f2b705", lips: "#a3203d" },
    { name: "Ankara Gold", shirt: "#d9a521", blouse: "#d9a521", band: "#17607a", lips: "#8a2a1e" },
    { name: "Emerald", shirt: "#1f7a5a", blouse: "#1f7a5a", band: "#fbf6ee", lips: "#a3203d" }
  ]
};

export const outfitOf = (driverId, index = 0) => {
  const list = OUTFITS[driverId] || OUTFITS.nkechi;
  return list[index] || list[0];
};
