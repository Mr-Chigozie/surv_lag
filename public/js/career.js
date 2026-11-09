// Career = everything that persists between shifts: wallet, unlocks, upgrades, paint.
// Stored in localStorage; every access is guarded because storage can be unavailable.

const KEY = "lts-career-v1";

export const START_WALLET = 5000;

export const PRICES = {
  vehicles: { car: 0, bike: 12000, bus: 35000 },
  routes: { "third-mainland": 0, ikorodu: 0, lekki: 15000, oshodi: 25000 }
};

export const UPGRADES = {
  engine: { name: "Engine tune", desc: "+5% top speed, +8% acceleration", costs: [6000, 14000, 30000] },
  tyres: { name: "Tyres", desc: "+7% handling", costs: [4000, 10000, 22000] },
  body: { name: "Body work", desc: "+12% toughness", costs: [5000, 12000, 26000] },
  cargo: { name: "Extra space", desc: "+1 seat / parcel slot (danfo +2)", costs: [8000, 18000] },
  horn: { name: "Loud horn", desc: "Traffic moves over more often", costs: [3000, 8000] }
};

const COST_SCALE = { car: 1, bike: 0.7, bus: 1.4 };
export const BASE_CAPACITY = { car: 3, bike: 1, bus: 8 };
export const REPAIR_COST = { car: 4000, bike: 2000, bus: 7000 }; // full wreck repair

export const PAINTS = [
  { id: "factory", name: "Factory", color: null, cost: 0 },
  { id: "lime", name: "Lime", color: 0xb8e05a, cost: 2500 },
  { id: "red", name: "Red", color: 0xc8202a, cost: 2500 },
  { id: "blue", name: "Blue", color: 0x2f5fbf, cost: 2500 },
  { id: "black", name: "Black", color: 0x1e1e22, cost: 2500 },
  { id: "white", name: "White", color: 0xe9e9e4, cost: 2500 },
  { id: "purple", name: "Purple", color: 0x6f3fb0, cost: 4000 },
  { id: "gold", name: "Gold", color: 0xc9a227, cost: 6000 }
];

function defaults() {
  return {
    wallet: START_WALLET,
    vehicles: ["car"],
    routes: ["third-mainland", "ikorodu"],
    upgrades: { car: {}, bike: {}, bus: {} },
    paints: { car: ["factory"], bike: ["factory"], bus: ["factory"] },
    paint: { car: "factory", bike: "factory", bus: "factory" },
    totals: { shifts: 0, delivered: 0, earned: 0 }
  };
}

export function loadCareer() {
  const base = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!saved || typeof saved !== "object") return base;
    return {
      ...base,
      ...saved,
      upgrades: { ...base.upgrades, ...saved.upgrades },
      paints: { ...base.paints, ...saved.paints },
      paint: { ...base.paint, ...saved.paint },
      totals: { ...base.totals, ...saved.totals }
    };
  } catch {
    return base;
  }
}

export function saveCareer(career) {
  try {
    localStorage.setItem(KEY, JSON.stringify(career));
  } catch {
    /* private mode: progress lasts for this session only */
  }
}

export const level = (career, vehicleId, key) => career.upgrades[vehicleId]?.[key] || 0;

/** Cost of the next level of an upgrade, or null when maxed. */
export function upgradeCost(vehicleId, key, currentLevel) {
  const cost = UPGRADES[key].costs[currentLevel];
  return cost === undefined ? null : Math.round((cost * COST_SCALE[vehicleId]) / 500) * 500;
}

export function capacity(career, vehicleId) {
  return BASE_CAPACITY[vehicleId] + level(career, vehicleId, "cargo") * (vehicleId === "bus" ? 2 : 1);
}

/** Vehicle spec with garage upgrades applied. */
export function applyUpgrades(spec, vehicleId, career) {
  const engine = level(career, vehicleId, "engine");
  const tyres = level(career, vehicleId, "tyres");
  const body = level(career, vehicleId, "body");
  return {
    ...spec,
    maxSpeed: spec.maxSpeed * (1 + engine * 0.05),
    accel: spec.accel * (1 + engine * 0.08),
    steer: spec.steer * (1 + tyres * 0.07),
    health: Math.round(spec.health * (1 + body * 0.12)),
    honk: level(career, vehicleId, "horn") * 0.15,
    capacity: capacity(career, vehicleId)
  };
}

export function paintColor(career, vehicleId, fallback) {
  const paint = PAINTS.find((p) => p.id === career.paint[vehicleId]);
  return paint?.color ?? fallback;
}

/** Spend money if the wallet allows it. Returns true on success. */
export function spend(career, amount) {
  if (amount > career.wallet) return false;
  career.wallet -= amount;
  saveCareer(career);
  return true;
}
