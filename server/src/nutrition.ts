// Pure functions: target calculation, natural-language food parsing, nutrient math, recommendations.

export type Goal = "fatloss" | "muscle" | "recomp" | "maintain";

const ACTIVITY: Record<string, { mult: number; label: string }> = {
  sedentary: { mult: 1.2, label: "Sedentary (desk job, little exercise)" },
  light: { mult: 1.375, label: "Light (1-3 workouts/week)" },
  moderate: { mult: 1.55, label: "Moderate (3-5 workouts/week)" },
  active: { mult: 1.725, label: "Active (6-7 workouts/week or physical job)" },
  very_active: { mult: 1.9, label: "Very active (hard training + physical job)" },
};

export interface TargetInput {
  age: number;
  heightCm: number;
  weightKg: number;
  sex?: string | null;
  activityLevel: string;
  avgSteps?: number | null;
  trainingDays: number;
  goal: Goal;
  weeklyRateKg?: number; // optional desired weekly change magnitude
}

export function calcTargets(i: TargetInput) {
  // Mifflin-St Jeor. Sex constant: +5 male, -161 female, -78 (midpoint) when not provided.
  const sexConst = i.sex === "male" ? 5 : i.sex === "female" ? -161 : -78;
  const bmr = 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age + sexConst;
  let mult = ACTIVITY[i.activityLevel]?.mult ?? 1.55;
  // Steps can nudge the multiplier slightly when the person has told us their average.
  if (i.avgSteps) {
    if (i.avgSteps < 5000) mult = Math.min(mult, 1.375);
    else if (i.avgSteps > 12000) mult = Math.max(mult, 1.55);
  }
  const maintenance = Math.round(bmr * mult);

  // Goal adjustment: 7700 kcal ≈ 1 kg is a rough rule of thumb, so we cap to modest rates.
  let delta = 0;
  if (i.goal === "fatloss") {
    const rate = Math.min(i.weeklyRateKg ?? 0.4, 0.0075 * i.weightKg * 1.0 + 0.2, 0.75);
    delta = -Math.round((rate * 7700) / 7 / 10) * 10;
    delta = Math.max(delta, -Math.round(maintenance * 0.25)); // never > 25% below maintenance
  } else if (i.goal === "muscle") {
    delta = Math.round(maintenance * 0.08 / 10) * 10; // ~8% surplus
  } else if (i.goal === "recomp") {
    delta = -Math.round(maintenance * 0.05 / 10) * 10;
  }

  const floor = i.sex === "male" ? 1500 : i.sex === "female" ? 1200 : 1350;
  let kcal = maintenance + delta;
  let floored = false;
  if (kcal < floor) {
    kcal = floor;
    floored = true;
  }

  const proteinPerKg = i.goal === "fatloss" || i.goal === "recomp" ? 2.0 : i.goal === "muscle" ? 1.8 : 1.6;
  const protein = Math.round(i.weightKg * proteinPerKg);
  const fat = Math.max(Math.round((kcal * 0.27) / 9), Math.round(i.weightKg * 0.7));
  const carbs = Math.max(Math.round((kcal - protein * 4 - fat * 9) / 4), 0);
  const fiber = Math.round((kcal / 1000) * 14); // 14 g per 1000 kcal (common dietary guidance)
  const water = Math.round((i.weightKg * 32) / 50) * 50; // ~32 ml/kg, general guidance only

  const notes: string[] = [];
  if (floored) notes.push("Target was raised to a minimum safe floor; a lower intake is not recommended without professional supervision.");
  if (!i.sex) notes.push("Sex not provided, so a midpoint constant was used. Your real maintenance may differ by roughly ±80 kcal.");

  return {
    kcalTarget: kcal,
    proteinTarget: protein,
    carbTarget: carbs,
    fatTarget: fat,
    fiberTarget: fiber,
    waterTargetMl: water,
    assumptions: {
      formula: "Mifflin-St Jeor resting energy expenditure × activity multiplier",
      bmr: Math.round(bmr),
      activityMultiplier: mult,
      activityLabel: ACTIVITY[i.activityLevel]?.label,
      maintenance,
      goalAdjustmentKcal: delta,
      proteinPerKg,
      fatShare: "~27% of calories (min 0.7 g/kg)",
      fiber: "14 g per 1000 kcal",
      confidence: "Estimates are typically within ±10-15%. Re-check after 3-4 weeks using your weight trend, training performance, hunger and recovery.",
      notes,
    },
  };
}

// ---------- Food parsing ----------

const NUM_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5,
};
export const UNIT_ALIASES: Record<string, string> = {
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g", kg: "kg", kgs: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", l: "l", litre: "l", litres: "l", liter: "l", liters: "l",
  cup: "cup", cups: "cup", tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  slice: "slice", slices: "slice", scoop: "scoop", scoops: "scoop",
  piece: "piece", pieces: "piece", pc: "piece", pcs: "piece",
  bowl: "bowl", bowls: "bowl", glass: "glass", glasses: "glass",
};
const STATES = ["raw", "cooked", "dry", "boiled", "fried"];
const GENERIC_ML: Record<string, number> = { cup: 240, tbsp: 15, tsp: 5, glass: 250 };

export interface FoodRow {
  id: string; name: string; aliases: string[]; kcal: number; protein: number; carbs: number; fat: number; fiber: number;
  units: any; density: number | null; diet: string; source: string;
}

export interface ParsedItem {
  raw: string;
  quantity: number;
  unit: string;
  query: string;
  state?: string;
  candidates: { food: FoodRow; score: number }[];
  ambiguous: boolean;
  issue?: string;
}

const singular = (w: string) => (w.length > 3 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).map(singular);

export function parseText(text: string, foods: FoodRow[]): ParsedItem[] {
  let t = text.toLowerCase().replace(/\b(i|we)\s+(ate|had|drank|consumed)\b/g, "").replace(/\b(for|at)\s+(breakfast|lunch|dinner|snacks?)\b/g, "");
  const parts = t.split(/,|;|\+|&|\band\b|\bwith\b/).map((s) => s.trim()).filter(Boolean);
  const out: ParsedItem[] = [];
  for (const raw of parts) {
    const words = raw.replace(/\bof\b/g, " ").split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let quantity = 1;
    let unit = "";
    let i = 0;
    const first = words[0];
    if (/^\d+(\.\d+)?$/.test(first)) { quantity = parseFloat(first); i = 1; }
    else if (/^\d+\/\d+$/.test(first)) { const [a, b] = first.split("/").map(Number); quantity = a / b; i = 1; }
    else if (/^\d+(\.\d+)?[a-z]+$/.test(first)) { // "200g"
      const m = first.match(/^(\d+(?:\.\d+)?)([a-z]+)$/)!;
      if (UNIT_ALIASES[m[2]]) { quantity = parseFloat(m[1]); unit = UNIT_ALIASES[m[2]]; i = 1; }
    } else if (NUM_WORDS[first] !== undefined) { quantity = NUM_WORDS[first]; i = 1; }
    let rest = words.slice(i);
    if (!unit && rest.length && UNIT_ALIASES[rest[0]]) { unit = UNIT_ALIASES[rest[0]]; rest = rest.slice(1); }
    if (!unit && rest.length > 1 && UNIT_ALIASES[rest[rest.length - 1]]) { unit = UNIT_ALIASES[rest[rest.length - 1]]; rest = rest.slice(0, -1); } // "6 bread slices"
    if (!unit) unit = "piece";
    const state = rest.find((w) => STATES.includes(w));
    const query = rest.join(" ");
    if (!query) continue;
    const qt = tokens(query).filter((w) => !STATES.includes(w));
    const cands = foods
      .map((f) => {
        const names = [f.name, ...f.aliases];
        let best = 0;
        for (const n of names) {
          const ft = tokens(n);
          const ftCore = ft.filter((w) => !STATES.includes(w));
          if (!ftCore.length || !qt.length) continue;
          const hit = qt.filter((w) => ftCore.includes(w)).length;
          if (!hit) continue;
          let s = (hit / qt.length) * 0.7 + (hit / ftCore.length) * 0.3;
          const fState = ft.find((w) => STATES.includes(w));
          if (state && fState === state) s += 0.2;
          else if (state && fState && fState !== state) s -= 0.15;
          best = Math.max(best, s);
        }
        return { food: f, score: best };
      })
      .filter((c) => c.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    const ambiguous = cands.length > 1 && cands[0].score - cands[1].score < 0.12;
    out.push({
      raw, quantity, unit, query, state, candidates: cands, ambiguous,
      issue: cands.length ? undefined : "No matching food found. Search manually or create a custom food.",
    });
  }
  return out;
}

/** Convert a quantity+unit to grams for a food. `estimated` is true when a generic conversion was used. */
export function toGrams(food: FoodRow, quantity: number, unit: string): { grams: number | null; estimated: boolean; note?: string } {
  const u = (food.units || {}) as Record<string, number>;
  if (unit === "g") return { grams: quantity, estimated: false };
  if (unit === "kg") return { grams: quantity * 1000, estimated: false };
  if (unit === "ml" || unit === "l") {
    const ml = unit === "l" ? quantity * 1000 : quantity;
    if (food.density) return { grams: ml * food.density, estimated: false };
    return { grams: ml, estimated: true, note: "Assumed 1 g per ml; no density on file for this food." };
  }
  if (u[unit]) return { grams: quantity * u[unit], estimated: false };
  if (GENERIC_ML[unit]) {
    const g = GENERIC_ML[unit] * (food.density ?? 1);
    return { grams: quantity * g, estimated: true, note: `Used a generic ${unit} size; edit the grams if yours differs.` };
  }
  if (u.piece && (unit === "piece" || unit === "slice")) return { grams: quantity * u.piece, estimated: true, note: "Used the standard piece weight." };
  return { grams: null, estimated: true, note: `No ${unit} size known for ${food.name}. Enter grams instead.` };
}

export function nutrientsFor(food: FoodRow, grams: number) {
  const f = grams / 100;
  return { kcal: food.kcal * f, protein: food.protein * f, carbs: food.carbs * f, fat: food.fat * f, fiber: food.fiber * f };
}

export function sumLogs(logs: { kcal: number; protein: number; carbs: number; fat: number; fiber: number }[]) {
  return logs.reduce((a, l) => ({ kcal: a.kcal + l.kcal, protein: a.protein + l.protein, carbs: a.carbs + l.carbs, fat: a.fat + l.fat, fiber: a.fiber + l.fiber }), { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
}

export function remaining(profile: any, totals: any) {
  const keys = [["kcal", "kcalTarget"], ["protein", "proteinTarget"], ["carbs", "carbTarget"], ["fat", "fatTarget"], ["fiber", "fiberTarget"]] as const;
  const r: any = {};
  for (const [k, t] of keys) {
    const target = profile[t] as number;
    const consumed = totals[k] as number;
    r[k] = { target, consumed, remaining: Math.max(target - consumed, 0), over: Math.max(consumed - target, 0), pct: target ? consumed / target : 0 };
  }
  return r;
}

export function dayStatus(logCount: number, r: any, isPast: boolean) {
  if (!logCount) return isPast ? "no_log" : "not_started";
  if (r.kcal.pct > 1.05) return "over_target";
  if (r.kcal.pct >= 0.9 && r.protein.pct >= 0.9) return "completed";
  return "in_progress";
}

export function suggestFoods(profile: any, r: any, foods: FoodRow[], meals: number) {
  if (r.kcal.remaining < 100) return [];
  const allergies = (profile.allergies || "").toLowerCase().split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean);
  const allowed = (f: FoodRow) => {
    if (profile.dietPref === "veg" && f.diet !== "veg") return false;
    if (profile.dietPref === "egg" && f.diet === "nonveg") return false;
    const hay = [f.name, ...f.aliases].join(" ").toLowerCase();
    return !allergies.some((a: string) => hay.includes(a));
  };
  const proteinGap = r.protein.remaining > 10;
  return foods
    .filter((f) => allowed(f) && f.kcal > 20 && f.kcal < 700)
    .map((f) => ({ f, score: proteinGap ? f.protein / f.kcal : f.fiber / f.kcal }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ f }) => {
      const budget = Math.min(r.kcal.remaining * 0.35, 350);
      const grams = Math.max(Math.round((budget / f.kcal) * 100 / 10) * 10, 20);
      const n = nutrientsFor(f, grams);
      return { name: f.name, grams, kcal: Math.round(n.kcal), protein: Math.round(n.protein), fiber: Math.round(n.fiber) };
    });
}

export function recommendations(ctx: {
  r: any; logCount: number; mealsLogged: string[]; session?: { done: number; total: number } | null;
  workoutsThisWeek: number; weightTrend?: { weeks: number; deltaKg: number } | null; hour: number; isToday: boolean;
}) {
  const out: string[] = [];
  const { r } = ctx;
  if (ctx.logCount === 0) {
    if (ctx.isToday) out.push("Nothing is logged yet today. Add what you've eaten when you're ready; an empty log doesn't mean a skipped meal.");
  } else {
    if (r.protein.remaining > 0) out.push(`You've logged ${Math.round(r.protein.consumed)} g of protein with ${Math.round(r.protein.remaining)} g left to reach your target.`);
    if (r.fiber.pct < 0.6 && ctx.hour >= 15) out.push("Your logged fiber is below target so far. Vegetables, fruit, dal or oats can help.");
    if (r.kcal.over > 0) out.push(`You're ${Math.round(r.kcal.over)} kcal above target for the day. A small overshoot is normal; no need to compensate.`);
  }
  if (ctx.isToday && ctx.hour >= 14 && !ctx.mealsLogged.includes("lunch") && ctx.logCount > 0) out.push("No lunch has been logged. If you've eaten, add it to keep totals accurate.");
  if (ctx.session) out.push(`Today's workout: ${ctx.session.done} of ${ctx.session.total} exercises complete.`);
  if (ctx.workoutsThisWeek > 0) out.push(`You've completed ${ctx.workoutsThisWeek} workout${ctx.workoutsThisWeek > 1 ? "s" : ""} this week.`);
  if (ctx.weightTrend && Math.abs(ctx.weightTrend.deltaKg) < 0.3 && ctx.weightTrend.weeks >= 3) out.push(`Your average weight has been stable for ${ctx.weightTrend.weeks} weeks. If that doesn't match your goal, consider reviewing your calorie target.`);
  return out;
}

export function epley1RM(weight: number, reps: number) {
  return reps <= 1 ? weight : weight * (1 + reps / 30);
}
