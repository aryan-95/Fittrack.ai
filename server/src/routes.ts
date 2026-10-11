import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import nodemailer from "nodemailer";
import { prisma } from "./db.js";
import { notify, pushEnabled } from "./notify.js";
import { DEFAULT_PLAN, DEFAULT_REMINDERS } from "./data.js";
import { calcTargets, epley1RM, FoodRow, nutrientsFor, parseText, recommendations, remaining, dayStatus, suggestFoods, sumLogs, toGrams } from "./nutrition.js";

export const router = Router();
const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const isProd = process.env.NODE_ENV === "production";

type Req = Request & { userId?: string; profile?: any };
const h = (fn: (req: Req, res: Response) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => fn(req as Req, res).catch(next);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const todayIn = (tz: string) => new Date().toLocaleDateString("en-CA", { timeZone: tz });
const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const weekdayOf = (d: string) => new Date(d + "T00:00:00Z").getUTCDay();
const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------------- Auth ----------------
const creds = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(8, "Password must be at least 8 characters") });
const setCookie = (res: Response, userId: string) =>
  res.cookie("token", jwt.sign({ uid: userId }, SECRET, { expiresIn: "14d" }), { httpOnly: true, sameSite: "lax", secure: isProd, maxAge: 14 * 864e5 });

router.post("/auth/register", h(async (req, res) => {
  const { email, password } = creds.parse(req.body);
  if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: "An account with this email already exists." });
  const user = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12) } });
  setCookie(res, user.id);
  res.json({ id: user.id, email });
}));

router.post("/auth/login", h(async (req, res) => {
  const { email, password } = creds.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "Email or password is incorrect." });
  setCookie(res, user.id);
  res.json({ id: user.id, email });
}));

router.post("/auth/logout", (_req, res) => { res.clearCookie("token"); res.json({ ok: true }); });

router.post("/auth/forgot", h(async (req, res) => {
  const { email } = z.object({ email: z.string().email().toLowerCase() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 3600e3) } });
    const link = `${(process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",")[0]}/reset?token=${token}`;
    if (process.env.SMTP_URL) await nodemailer.createTransport(process.env.SMTP_URL).sendMail({ to: email, from: "FitTrack AI <no-reply@fittrack.local>", subject: "Reset your password", text: `Reset your password: ${link}\nThis link expires in 1 hour.` });
    else console.log(`[password reset] ${email}: ${link}`); // no SMTP configured: link goes to server logs
  }
  res.json({ ok: true }); // same response whether or not the email exists
}));

router.post("/auth/reset", h(async (req, res) => {
  const { token, password } = z.object({ token: z.string(), password: z.string().min(8) }).parse(req.body);
  const rec = await prisma.passwordReset.findUnique({ where: { tokenHash: crypto.createHash("sha256").update(token).digest("hex") } });
  if (!rec || rec.expiresAt < new Date()) return res.status(400).json({ error: "This reset link is invalid or has expired." });
  await prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: await bcrypt.hash(password, 12) } });
  await prisma.passwordReset.deleteMany({ where: { userId: rec.userId } });
  res.json({ ok: true });
}));

const auth = (req: Req, res: Response, next: NextFunction) => {
  try { req.userId = (jwt.verify(req.cookies?.token, SECRET) as any).uid; next(); }
  catch { res.status(401).json({ error: "Please sign in." }); }
};

router.get("/auth/me", auth, h(async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.userId } });
  res.json({ id: u!.id, email: u!.email });
}));

// ---------------- Profiles ----------------
const profileSchema = z.object({
  name: z.string().min(1).max(60),
  age: z.coerce.number().int().min(14).max(100),
  heightCm: z.coerce.number().min(100).max(250),
  weightKg: z.coerce.number().min(30).max(300),
  sex: z.enum(["male", "female"]).nullish(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).default("moderate"),
  avgSteps: z.coerce.number().int().min(0).max(50000).nullish(),
  experience: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  trainingDays: z.coerce.number().int().min(1).max(7).default(4),
  workoutMins: z.coerce.number().int().min(15).max(180).default(60),
  dietPref: z.enum(["veg", "egg", "nonveg"]).default("nonveg"),
  allergies: z.string().max(300).default(""),
  goal: z.enum(["fatloss", "muscle", "recomp", "maintain"]).default("recomp"),
  targetWeightKg: z.coerce.number().min(30).max(300).nullish(),
  targetDate: z.string().nullish(),
  units: z.enum(["metric", "imperial"]).default("metric"),
  timezone: z.string().default("Asia/Kolkata"),
  quietStart: z.string().regex(/^\d\d:\d\d$/).default("22:30"),
  quietEnd: z.string().regex(/^\d\d:\d\d$/).default("06:30"),
  weeklyRateKg: z.coerce.number().min(0.1).max(1).optional(),
});
const manualSchema = z.object({
  kcalTarget: z.coerce.number().int().min(800).max(6000),
  proteinTarget: z.coerce.number().int().min(20).max(400),
  carbTarget: z.coerce.number().int().min(0).max(900),
  fatTarget: z.coerce.number().int().min(15).max(300),
  fiberTarget: z.coerce.number().int().min(5).max(100),
  waterTargetMl: z.coerce.number().int().min(500).max(6000),
});

router.post("/targets/preview", auth, h(async (req, res) => {
  const p = profileSchema.partial({ name: true }).parse(req.body);
  res.json(calcTargets({ ...p, goal: p.goal } as any));
}));

async function createDefaultPlan(profileId: string) {
  const ex = await prisma.exercise.findMany();
  const byName = new Map(ex.map((e) => [e.name, e.id]));
  for (const d of DEFAULT_PLAN) {
    await prisma.planDay.create({
      data: {
        profileId, weekday: d.weekday, name: d.name, isRest: !!d.isRest,
        exercises: { create: d.ex.filter(([n]) => byName.has(n)).map(([n, sets, reps], i) => ({ exerciseId: byName.get(n)!, order: i, sets, reps })) },
      },
    });
  }
}

router.get("/profiles", auth, h(async (req, res) => {
  res.json(await prisma.profile.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "asc" } }));
}));

router.post("/profiles", auth, h(async (req, res) => {
  const { weeklyRateKg, targetDate, ...p } = profileSchema.parse(req.body);
  const t = calcTargets({ ...p, weeklyRateKg } as any);
  const profile = await prisma.profile.create({ data: { ...p, targetDate: targetDate ? new Date(targetDate) : null, userId: req.userId!, ...t } });
  await createDefaultPlan(profile.id);
  await prisma.reminder.createMany({ data: DEFAULT_REMINDERS.map((r) => ({ profileId: profile.id, type: r.type, label: r.label, time: r.time, days: r.days, enabled: r.enabled ?? true })) });
  res.json(profile);
}));

// everything below is scoped to one profile owned by the signed-in user
const P = Router({ mergeParams: true });
router.use("/profiles/:pid", auth, async (req: Req, res: Response, next: NextFunction) => {
  const profile = await prisma.profile.findFirst({ where: { id: req.params.pid, userId: req.userId } }).catch(() => null);
  if (!profile) return res.status(404).json({ error: "Profile not found." });
  req.profile = profile; next();
}, P);

P.patch("/", h(async (req, res) => {
  const body = req.body || {};
  const { targets, weeklyRateKg, targetDate, ...rest } = profileSchema.partial().extend({ targets: manualSchema.optional() }).parse(body);
  const merged = { ...req.profile, ...rest };
  const data: any = { ...rest };
  if (targetDate !== undefined) data.targetDate = targetDate ? new Date(targetDate) : null;
  if (targets) Object.assign(data, targets, { manualTargets: true });
  else if (!req.profile.manualTargets || body.recalculate) {
    // Recalculate when relevant inputs change (unless the user pinned manual targets).
    const relevant = ["age", "heightCm", "weightKg", "sex", "activityLevel", "avgSteps", "trainingDays", "goal"].some((k) => k in rest);
    if (relevant || body.recalculate) { Object.assign(data, calcTargets({ ...merged, weeklyRateKg } as any), { manualTargets: false }); }
  }
  res.json(await prisma.profile.update({ where: { id: req.profile.id }, data }));
}));

P.delete("/", h(async (req, res) => { await prisma.profile.delete({ where: { id: req.profile.id } }); res.json({ ok: true }); }));

P.get("/export", h(async (req, res) => {
  const id = req.profile.id;
  const data = await prisma.profile.findUnique({
    where: { id },
    include: { foodLogs: true, foods: true, entries: true, sessions: { include: { items: true } }, reminders: true, planDays: { include: { exercises: true } } },
  });
  res.setHeader("Content-Disposition", `attachment; filename="fittrack-${req.profile.name}.json"`);
  res.json(data);
}));

// ---------------- Foods ----------------
const foodWhere = (pid: string) => ({ OR: [{ profileId: null }, { profileId: pid }] });

P.get("/foods", h(async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const foods = await prisma.food.findMany({
    where: { AND: [foodWhere(req.profile.id), q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { aliases: { has: q } }] } : {}] },
    orderBy: { name: "asc" }, take: 30,
  });
  res.json(foods);
}));

const customFood = z.object({
  name: z.string().min(1).max(80),
  kcal: z.coerce.number().min(0).max(1000), protein: z.coerce.number().min(0).max(100), carbs: z.coerce.number().min(0).max(100),
  fat: z.coerce.number().min(0).max(100), fiber: z.coerce.number().min(0).max(100),
  servingName: z.string().optional(), servingGrams: z.coerce.number().positive().optional(),
  diet: z.enum(["veg", "egg", "nonveg"]).default("veg"),
});
P.post("/foods", h(async (req, res) => {
  const { servingName, servingGrams, ...f } = customFood.parse(req.body); // values are per 100 g
  const units: any = servingName && servingGrams ? { [servingName.toLowerCase()]: servingGrams, piece: servingGrams } : {};
  res.json(await prisma.food.create({ data: { ...f, aliases: [], units, profileId: req.profile.id, source: "Custom (entered by you)" } }));
}));
P.delete("/foods/:id", h(async (req, res) => {
  await prisma.food.deleteMany({ where: { id: req.params.id, profileId: req.profile.id } }); res.json({ ok: true });
}));

P.post("/foods/parse", h(async (req, res) => {
  const { text } = z.object({ text: z.string().min(1).max(1000) }).parse(req.body);
  const foods = (await prisma.food.findMany({ where: foodWhere(req.profile.id) })) as unknown as FoodRow[];
  const items = parseText(text, foods).map((it) => ({
    ...it,
    candidates: it.candidates.map(({ food, score }) => {
      const g = toGrams(food, it.quantity, it.unit);
      const grams = g.grams ?? 0;
      return { id: food.id, name: food.name, score, grams, estimated: g.estimated, note: g.note, source: food.source, per100: { kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber }, ...nutrientsFor(food, grams) };
    }),
  }));
  res.json({ items, usedAI: false });
}));

const logItem = z.object({
  foodId: z.string().optional(), name: z.string().optional(), quantity: z.coerce.number().positive().default(1), unit: z.string().default("g"),
  grams: z.coerce.number().positive().max(10000), meal: z.string().default("snack"), date: dateStr.optional(), estimated: z.boolean().optional(),
});
const logDay = async (pid: string, date: string) => prisma.foodLog.findMany({ where: { profileId: pid, date }, orderBy: { createdAt: "asc" } });

P.post("/log/foods", h(async (req, res) => {
  const items = z.array(logItem).min(1).max(40).parse(req.body.items);
  const foods = await prisma.food.findMany({ where: { id: { in: items.map((i) => i.foodId).filter(Boolean) as string[] }, ...foodWhere(req.profile.id) } });
  const byId = new Map(foods.map((f) => [f.id, f]));
  const date = todayIn(req.profile.timezone);
  const rows = items.map((i) => {
    const f: any = i.foodId ? byId.get(i.foodId) : undefined;
    if (!f) throw Object.assign(new Error("Unknown food in request."), { status: 400 });
    const n = nutrientsFor(f as any, i.grams);
    return { profileId: req.profile.id, date: i.date ?? date, meal: i.meal, name: f.name, foodId: f.id, quantity: i.quantity, unit: i.unit, grams: i.grams, ...n, source: f.source, estimated: i.estimated ?? false };
  });
  await prisma.foodLog.createMany({ data: rows });
  res.json({ ok: true, added: rows.length });
}));

P.get("/log/foods", h(async (req, res) => res.json(await logDay(req.profile.id, dateStr.default(todayIn(req.profile.timezone)).parse(req.query.date || undefined)))));

P.patch("/log/foods/:id", h(async (req, res) => {
  const b = z.object({ grams: z.coerce.number().positive().optional(), quantity: z.coerce.number().positive().optional(), meal: z.string().optional(),
    kcal: z.coerce.number().min(0).optional(), protein: z.coerce.number().min(0).optional(), carbs: z.coerce.number().min(0).optional(), fat: z.coerce.number().min(0).optional(), fiber: z.coerce.number().min(0).optional() }).parse(req.body);
  const log = await prisma.foodLog.findFirst({ where: { id: req.params.id, profileId: req.profile.id } });
  if (!log) return res.status(404).json({ error: "Entry not found." });
  const data: any = { ...b };
  if (b.grams && log.foodId && b.kcal === undefined) {
    const f = await prisma.food.findUnique({ where: { id: log.foodId } });
    if (f) Object.assign(data, nutrientsFor(f as any, b.grams));
  }
  if (b.kcal !== undefined || b.protein !== undefined) { data.source = "Corrected by you"; data.estimated = false; }
  res.json(await prisma.foodLog.update({ where: { id: log.id }, data }));
}));
P.delete("/log/foods/:id", h(async (req, res) => { await prisma.foodLog.deleteMany({ where: { id: req.params.id, profileId: req.profile.id } }); res.json({ ok: true }); }));

P.post("/log/duplicate", h(async (req, res) => {
  const b = z.object({ fromDate: dateStr, toDate: dateStr, meal: z.string().optional() }).parse(req.body);
  const src = await prisma.foodLog.findMany({ where: { profileId: req.profile.id, date: b.fromDate, ...(b.meal ? { meal: b.meal } : {}) } });
  await prisma.foodLog.createMany({ data: src.map(({ id, createdAt, ...r }) => ({ ...r, date: b.toDate })) });
  res.json({ ok: true, copied: src.length });
}));

async function nutritionFor(profile: any, date: string) {
  const logs = await logDay(profile.id, date);
  const totals = sumLogs(logs);
  const r = remaining(profile, totals);
  const isPast = date < todayIn(profile.timezone);
  return { logs, totals, remaining: r, status: dayStatus(logs.length, r, isPast) };
}

P.get("/nutrition", h(async (req, res) => {
  const date = dateStr.default(todayIn(req.profile.timezone)).parse(req.query.date || undefined);
  const n = await nutritionFor(req.profile, date);
  const foods = (await prisma.food.findMany({ where: foodWhere(req.profile.id) })) as unknown as FoodRow[];
  res.json({ date, ...n, suggestions: suggestFoods(req.profile, n.remaining, foods, n.logs.length) });
}));

// ---------------- Exercises ----------------
router.get("/exercises", auth, h(async (req, res) => {
  const { q, muscle, equipment, difficulty, type } = req.query as Record<string, string>;
  const where: any = { AND: [] };
  if (q) where.AND.push({ name: { contains: q, mode: "insensitive" } });
  if (muscle) where.AND.push({ OR: [{ primary: { contains: muscle, mode: "insensitive" } }, { secondary: { has: muscle } }] });
  if (equipment) where.AND.push({ equipment: { contains: equipment, mode: "insensitive" } });
  if (difficulty) where.AND.push({ difficulty });
  if (type) where.AND.push({ type });
  res.json(await prisma.exercise.findMany({ where, orderBy: { name: "asc" } }));
}));
router.get("/exercises/:id", auth, h(async (req, res) => {
  const e = await prisma.exercise.findUnique({ where: { id: req.params.id } });
  if (!e) return res.status(404).json({ error: "Exercise not found." });
  res.json({ ...e, video: null, mediaNote: "No demonstration video is bundled. Add a verified video or image URL per exercise from a licensed source (for example a licensed exercise API) to show it here." });
}));

// ---------------- Plan ----------------
P.get("/plan", h(async (req, res) => {
  res.json(await prisma.planDay.findMany({ where: { profileId: req.profile.id }, orderBy: { weekday: "asc" }, include: { exercises: { orderBy: { order: "asc" }, include: { exercise: true } } } }));
}));

P.put("/plan/:weekday", h(async (req, res) => {
  const weekday = z.coerce.number().int().min(0).max(6).parse(req.params.weekday);
  const b = z.object({ name: z.string().min(1).max(60), isRest: z.boolean().default(false), exercises: z.array(z.object({ exerciseId: z.string(), sets: z.coerce.number().int().min(1).max(12), reps: z.string().max(20) })).max(30) }).parse(req.body);
  const day = await prisma.planDay.upsert({ where: { profileId_weekday: { profileId: req.profile.id, weekday } }, update: { name: b.name, isRest: b.isRest }, create: { profileId: req.profile.id, weekday, name: b.name, isRest: b.isRest } });
  await prisma.planExercise.deleteMany({ where: { planDayId: day.id } });
  if (!b.isRest) await prisma.planExercise.createMany({ data: b.exercises.map((e, i) => ({ planDayId: day.id, order: i, ...e })) });
  res.json({ ok: true });
}));

P.post("/plan/swap", h(async (req, res) => {
  const { a, b } = z.object({ a: z.number().int().min(0).max(6), b: z.number().int().min(0).max(6) }).parse(req.body);
  if (a === b) return res.json({ ok: true });
  const [da, db] = await Promise.all([a, b].map((w) => prisma.planDay.findUnique({ where: { profileId_weekday: { profileId: req.profile.id, weekday: w } } })));
  await prisma.$transaction(async (tx) => {
    if (da) await tx.planDay.update({ where: { id: da.id }, data: { weekday: -1 } });
    if (db) await tx.planDay.update({ where: { id: db.id }, data: { weekday: a } });
    if (da) await tx.planDay.update({ where: { id: da.id }, data: { weekday: b } });
  });
  res.json({ ok: true });
}));

// ---------------- Workout sessions ----------------
const sessionInclude = { items: { orderBy: { order: "asc" as const }, include: { exercise: true } } };

async function prevBest(profileId: string, exerciseId: string, excludeItemId: string) {
  const prev = await prisma.sessionExercise.findMany({ where: { exerciseId, status: "done", id: { not: excludeItemId }, session: { profileId } } });
  let best = 0;
  for (const p of prev) for (const s of p.sets as any[]) if (!s.warmup && s.weight > 0 && s.reps > 0) best = Math.max(best, epley1RM(s.weight, s.reps));
  return best;
}

P.get("/session/today", h(async (req, res) => {
  const date = dateStr.default(todayIn(req.profile.timezone)).parse(req.query.date || undefined);
  const plan = await prisma.planDay.findUnique({ where: { profileId_weekday: { profileId: req.profile.id, weekday: weekdayOf(date) } }, include: { exercises: { orderBy: { order: "asc" }, include: { exercise: true } } } });
  const session = plan ? await prisma.session.findUnique({ where: { profileId_date_name: { profileId: req.profile.id, date, name: plan.name } }, include: sessionInclude }) : null;
  res.json({ date, plan, session });
}));

// Starting is explicit. Opening the page never creates a log. Duplicate starts return the existing session.
P.post("/session/start", h(async (req, res) => {
  const date = dateStr.default(todayIn(req.profile.timezone)).parse(req.body?.date);
  const plan = await prisma.planDay.findUnique({ where: { profileId_weekday: { profileId: req.profile.id, weekday: weekdayOf(date) } }, include: { exercises: { orderBy: { order: "asc" } } } });
  if (!plan || plan.isRest) return res.status(400).json({ error: "No workout is planned for this day." });
  const existing = await prisma.session.findUnique({ where: { profileId_date_name: { profileId: req.profile.id, date, name: plan.name } }, include: sessionInclude });
  if (existing) return res.json(existing);
  try {
    const s = await prisma.session.create({ data: { profileId: req.profile.id, date, name: plan.name, items: { create: plan.exercises.map((e) => ({ exerciseId: e.exerciseId, order: e.order, targetSets: e.sets, targetReps: e.reps })) } }, include: sessionInclude });
    res.json(s);
  } catch { // race on the unique constraint
    res.json(await prisma.session.findUnique({ where: { profileId_date_name: { profileId: req.profile.id, date, name: plan.name } }, include: sessionInclude }));
  }
}));

const own = async (req: Req, itemId: string) => prisma.sessionExercise.findFirst({ where: { id: itemId, session: { profileId: req.profile.id } }, include: { session: true } });

P.patch("/session/items/:id", h(async (req, res) => {
  const b = z.object({
    sets: z.array(z.object({ weight: z.coerce.number().min(0).max(1000), reps: z.coerce.number().int().min(0).max(200), warmup: z.boolean().optional() })).max(20).optional(),
    status: z.enum(["pending", "done", "skipped"]).optional(), note: z.string().max(500).nullish(), skipReason: z.string().max(200).nullish(), pain: z.boolean().optional(),
  }).parse(req.body);
  const item = await own(req, req.params.id);
  if (!item) return res.status(404).json({ error: "Exercise entry not found." });
  if (item.session.status === "completed") return res.status(409).json({ error: "This workout is already saved as completed." });
  const updated = await prisma.sessionExercise.update({ where: { id: item.id }, data: b as any });
  let prs: any = null;
  if (b.status === "done") {
    const sets = ((b.sets ?? item.sets) as any[]).filter((s) => !s.warmup && s.weight > 0 && s.reps > 0);
    if (sets.length) {
      const best = Math.max(...sets.map((s) => epley1RM(s.weight, s.reps)));
      const prev = await prevBest(req.profile.id, item.exerciseId, item.id);
      if (best > prev && prev > 0) prs = { estimated1RM: round1(best), previous: round1(prev) };
    }
  }
  res.json({ item: updated, pr: prs });
}));

P.post("/session/items/:id/replace", h(async (req, res) => {
  const { exerciseId } = z.object({ exerciseId: z.string() }).parse(req.body);
  const item = await own(req, req.params.id);
  if (!item) return res.status(404).json({ error: "Exercise entry not found." });
  if (item.session.status === "completed") return res.status(409).json({ error: "This workout is already saved as completed." });
  res.json(await prisma.sessionExercise.update({ where: { id: item.id }, data: { exerciseId, sets: [], status: "pending" }, include: { exercise: true } }));
}));

P.post("/session/:id/finish", h(async (req, res) => {
  const s = await prisma.session.findFirst({ where: { id: req.params.id, profileId: req.profile.id }, include: { items: { include: { exercise: true } } } });
  if (!s) return res.status(404).json({ error: "Workout not found." });
  if (s.status === "completed") return res.json({ session: s, alreadyFinished: true });
  const pending = s.items.filter((i) => i.status === "pending").length;
  if (pending) return res.status(400).json({ error: `${pending} exercise${pending > 1 ? "s are" : " is"} still open. Mark each one done or skip it first.` });
  const finishedAt = new Date();
  const notes = typeof req.body?.notes === "string" ? req.body.notes.slice(0, 1000) : s.notes;
  const done = s.items.filter((i) => i.status === "done");
  const totalSets = done.reduce((a, i) => a + (i.sets as any[]).filter((x) => !x.warmup).length, 0);
  const prs: any[] = [];
  for (const i of done) {
    const sets = (i.sets as any[]).filter((x) => !x.warmup && x.weight > 0 && x.reps > 0);
    if (!sets.length) continue;
    const best = Math.max(...sets.map((x) => epley1RM(x.weight, x.reps)));
    const prev = await prevBest(req.profile.id, i.exerciseId, i.id);
    if (prev > 0 && best > prev) prs.push({ exercise: i.exercise.name, estimated1RM: round1(best), previous: round1(prev) });
  }
  await prisma.session.update({ where: { id: s.id }, data: { status: "completed", finishedAt, notes } });
  res.json({ durationMin: Math.max(1, Math.round((finishedAt.getTime() - s.startedAt.getTime()) / 60000)), exercisesDone: done.length, exercisesSkipped: s.items.length - done.length, totalSets, prs });
}));

P.post("/session/skip", h(async (req, res) => {
  const date = dateStr.default(todayIn(req.profile.timezone)).parse(req.body?.date);
  const plan = await prisma.planDay.findUnique({ where: { profileId_weekday: { profileId: req.profile.id, weekday: weekdayOf(date) } } });
  if (!plan || plan.isRest) return res.status(400).json({ error: "No workout is planned for this day." });
  await prisma.session.upsert({ where: { profileId_date_name: { profileId: req.profile.id, date, name: plan.name } }, update: {}, create: { profileId: req.profile.id, date, name: plan.name, status: "skipped" } });
  res.json({ ok: true });
}));

P.get("/sessions", h(async (req, res) => {
  res.json(await prisma.session.findMany({ where: { profileId: req.profile.id }, orderBy: { date: "desc" }, take: 60, include: sessionInclude }));
}));

P.get("/exercise-history/:exerciseId", h(async (req, res) => {
  const rows = await prisma.sessionExercise.findMany({ where: { exerciseId: req.params.exerciseId, status: "done", session: { profileId: req.profile.id } }, include: { session: true }, orderBy: { session: { date: "asc" } } });
  res.json(rows.map((r) => {
    const sets = (r.sets as any[]).filter((s) => !s.warmup && s.weight > 0 && s.reps > 0);
    return { date: r.session.date, best1RM: sets.length ? round1(Math.max(...sets.map((s) => epley1RM(s.weight, s.reps)))) : null, topWeight: sets.length ? Math.max(...sets.map((s) => s.weight)) : null };
  }));
}));

// ---------------- Daily habits & measurements ----------------
const entrySchema = z.object({ weightKg: z.coerce.number().min(20).max(400).nullish(), waistCm: z.coerce.number().min(30).max(300).nullish(), steps: z.coerce.number().int().min(0).max(100000).nullish(),
  sleepH: z.coerce.number().min(0).max(24).nullish(), fruitVeg: z.coerce.number().int().min(0).max(30).nullish(), mobility: z.boolean().optional(), waterMl: z.coerce.number().int().min(0).max(20000).optional() });

P.get("/daily", h(async (req, res) => {
  const to = dateStr.default(todayIn(req.profile.timezone)).parse(req.query.to || undefined);
  const from = dateStr.default(addDays(to, -29)).parse(req.query.from || undefined);
  res.json(await prisma.dailyEntry.findMany({ where: { profileId: req.profile.id, date: { gte: from, lte: to } }, orderBy: { date: "asc" } }));
}));
P.put("/daily/:date", h(async (req, res) => {
  const date = dateStr.parse(req.params.date);
  const data = entrySchema.parse(req.body);
  res.json(await prisma.dailyEntry.upsert({ where: { profileId_date: { profileId: req.profile.id, date } }, update: data, create: { profileId: req.profile.id, date, ...data } }));
}));
P.post("/daily/:date/water", h(async (req, res) => {
  const date = dateStr.parse(req.params.date);
  const { ml } = z.object({ ml: z.coerce.number().int().min(-5000).max(5000) }).parse(req.body);
  const cur = await prisma.dailyEntry.findUnique({ where: { profileId_date: { profileId: req.profile.id, date } } });
  const waterMl = Math.max((cur?.waterMl ?? 0) + ml, 0);
  res.json(await prisma.dailyEntry.upsert({ where: { profileId_date: { profileId: req.profile.id, date } }, update: { waterMl }, create: { profileId: req.profile.id, date, waterMl } }));
}));

// ---------------- Dashboard ----------------
P.get("/dashboard", h(async (req, res) => {
  const tz = req.profile.timezone;
  const date = todayIn(tz);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date())) % 24;
  const n = await nutritionFor(req.profile, date);
  const plan = await prisma.planDay.findUnique({ where: { profileId_weekday: { profileId: req.profile.id, weekday: weekdayOf(date) } }, include: { exercises: { include: { exercise: true }, orderBy: { order: "asc" } } } });
  const session = plan ? await prisma.session.findUnique({ where: { profileId_date_name: { profileId: req.profile.id, date, name: plan.name } }, include: { items: true } }) : null;
  const total = session?.items.length ?? plan?.exercises.length ?? 0;
  const doneCount = session?.items.filter((i) => i.status === "done").length ?? 0;
  const entry = await prisma.dailyEntry.findUnique({ where: { profileId_date: { profileId: req.profile.id, date } } });
  const weekStart = addDays(date, -((weekdayOf(date) + 6) % 7));
  const workoutsThisWeek = await prisma.session.count({ where: { profileId: req.profile.id, status: "completed", date: { gte: weekStart, lte: date } } });
  const weights = await prisma.dailyEntry.findMany({ where: { profileId: req.profile.id, weightKg: { not: null }, date: { gte: addDays(date, -28) } }, orderBy: { date: "asc" } });
  let weightTrend = null as any;
  if (weights.length >= 6) {
    const avg = (a: any[]) => a.reduce((s, x) => s + x.weightKg, 0) / a.length;
    const first = weights.filter((w) => w.date < addDays(date, -21)); const last = weights.filter((w) => w.date >= addDays(date, -7));
    if (first.length && last.length) weightTrend = { weeks: 3, deltaKg: avg(last) - avg(first) };
  }
  // habit completion: water, workout (if planned), protein >= 90%, steps/sleep entered
  const habits = [
    { key: "water", done: (entry?.waterMl ?? 0) >= req.profile.waterTargetMl },
    { key: "protein", done: n.remaining.protein.pct >= 0.9 },
    { key: "mobility", done: !!entry?.mobility },
    ...(plan && !plan.isRest ? [{ key: "workout", done: session?.status === "completed" }] : []),
  ];
  res.json({
    date, profile: req.profile, nutrition: { totals: n.totals, remaining: n.remaining, status: n.status, logCount: n.logs.length },
    workout: { plan: plan ? { name: plan.name, isRest: plan.isRest, count: plan.exercises.length } : null, sessionId: session?.id ?? null, status: session?.status ?? "not_started", done: doneCount, total, pct: total ? Math.round((doneCount / total) * 100) : 0 },
    entry, habits, habitPct: Math.round((habits.filter((x) => x.done).length / habits.length) * 100),
    recommendations: recommendations({ r: n.remaining, logCount: n.logs.length, mealsLogged: Array.from(new Set<string>(n.logs.map((l: any) => String(l.meal)))), session: session && session.status !== "completed" ? { done: doneCount, total } : null, workoutsThisWeek, weightTrend, hour, isToday: true }),
  });
}));

// ---------------- Progress ----------------
P.get("/progress", h(async (req, res) => {
  const tz = req.profile.timezone;
  const to = dateStr.default(todayIn(tz)).parse(req.query.to || undefined);
  const days = z.coerce.number().int().min(7).max(730).default(30).parse(req.query.days);
  const from = dateStr.default(addDays(to, -days + 1)).parse(req.query.from || undefined);
  const pid = req.profile.id;
  const [entries, logs, sessions] = await Promise.all([
    prisma.dailyEntry.findMany({ where: { profileId: pid, date: { gte: addDays(from, -6), lte: to } }, orderBy: { date: "asc" } }),
    prisma.foodLog.findMany({ where: { profileId: pid, date: { gte: from, lte: to } } }),
    prisma.session.findMany({ where: { profileId: pid, date: { gte: from, lte: to } } }),
  ]);
  const weights = entries.filter((e) => e.weightKg != null);
  const weight = weights.filter((w) => w.date >= from).map((w) => {
    const win = weights.filter((x) => x.date <= w.date && x.date >= addDays(w.date, -6));
    return { date: w.date, weight: w.weightKg, avg7: round1(win.reduce((s, x) => s + x.weightKg!, 0) / win.length) };
  });
  const byDate = new Map<string, { kcal: number; protein: number }>();
  for (const l of logs) { const c = byDate.get(l.date) ?? { kcal: 0, protein: 0 }; c.kcal += l.kcal; c.protein += l.protein; byDate.set(l.date, c); }
  const nutrition = [...byDate.entries()].sort().map(([date, v]) => ({ date, kcal: Math.round(v.kcal), protein: Math.round(v.protein), kcalTarget: req.profile.kcalTarget, proteinTarget: req.profile.proteinTarget }));
  const adh = nutrition.length ? { days: nutrition.length, kcalWithin10: nutrition.filter((d) => Math.abs(d.kcal - d.kcalTarget) <= d.kcalTarget * 0.1).length, proteinHit: nutrition.filter((d) => d.protein >= d.proteinTarget * 0.9).length } : null;
  const weeks = new Map<string, number>();
  for (const s of sessions.filter((s) => s.status === "completed")) { const wk = addDays(s.date, -((weekdayOf(s.date) + 6) % 7)); weeks.set(wk, (weeks.get(wk) ?? 0) + 1); }
  res.json({
    from, to, weight, waist: entries.filter((e) => e.waistCm != null && e.date >= from).map((e) => ({ date: e.date, waist: e.waistCm })),
    nutrition, adherence: adh, workoutsPerWeek: [...weeks.entries()].sort().map(([week, count]) => ({ week, count })),
    steps: entries.filter((e) => e.steps != null && e.date >= from).map((e) => ({ date: e.date, steps: e.steps })),
    sleep: entries.filter((e) => e.sleepH != null && e.date >= from).map((e) => ({ date: e.date, hours: e.sleepH })),
    water: entries.filter((e) => e.date >= from && e.waterMl > 0).map((e) => ({ date: e.date, ml: e.waterMl })),
    completedWorkouts: sessions.filter((s) => s.status === "completed").length,
  });
}));

// ---------------- Reminders & notifications ----------------
const reminderSchema = z.object({ type: z.string(), label: z.string().max(80), time: z.string().regex(/^\d\d:\d\d$/), days: z.array(z.number().int().min(0).max(6)), enabled: z.boolean().default(true) });
P.get("/reminders", h(async (req, res) => res.json(await prisma.reminder.findMany({ where: { profileId: req.profile.id }, orderBy: { time: "asc" } }))));
P.post("/reminders", h(async (req, res) => res.json(await prisma.reminder.create({ data: { ...reminderSchema.parse(req.body), profileId: req.profile.id } }))));
P.patch("/reminders/:id", h(async (req, res) => {
  const data = reminderSchema.partial().parse(req.body);
  await prisma.reminder.updateMany({ where: { id: req.params.id, profileId: req.profile.id }, data: { ...data, lastSentDate: null } });
  res.json({ ok: true });
}));
P.delete("/reminders/:id", h(async (req, res) => { await prisma.reminder.deleteMany({ where: { id: req.params.id, profileId: req.profile.id } }); res.json({ ok: true }); }));
P.post("/reminders/test", h(async (req, res) => {
  res.json(await notify(req.profile.id, "test", "Test reminder", "If you can see this, in-app notifications work. Browser and push delivery depend on your permissions.", [{ id: "snooze", label: "Snooze 10 min" }]));
}));
P.get("/notifications", h(async (req, res) => res.json(await prisma.notification.findMany({ where: { profileId: req.profile.id }, orderBy: { createdAt: "desc" }, take: 50 }))));
P.post("/notifications/read-all", h(async (req, res) => { await prisma.notification.updateMany({ where: { profileId: req.profile.id, readAt: null }, data: { readAt: new Date() } }); res.json({ ok: true }); }));
P.post("/notifications/:id/snooze", h(async (req, res) => {
  const { reminderId, minutes } = z.object({ reminderId: z.string().optional(), minutes: z.coerce.number().int().min(1).max(240).default(10) }).parse(req.body);
  if (reminderId) await prisma.reminder.updateMany({ where: { id: reminderId, profileId: req.profile.id }, data: { snoozeUntil: new Date(Date.now() + minutes * 60000) } });
  await prisma.notification.updateMany({ where: { id: req.params.id, profileId: req.profile.id }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));
P.get("/push/key", h(async (_req, res) => res.json({ enabled: pushEnabled, key: process.env.VAPID_PUBLIC_KEY || null })));
P.post("/push/subscribe", h(async (req, res) => {
  const s = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }).parse(req.body);
  await prisma.pushSub.upsert({ where: { endpoint: s.endpoint }, update: { profileId: req.profile.id, keys: s.keys }, create: { profileId: req.profile.id, endpoint: s.endpoint, keys: s.keys } });
  res.json({ ok: true });
}));

// ---------------- Errors ----------------
router.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; ") });
  if (err?.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});
