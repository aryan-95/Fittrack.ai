import cron from "node-cron";
import { prisma } from "./db.js";
import { notify } from "./notify.js";
import { remaining, sumLogs } from "./nutrition.js";

function localParts(tz: string, d = new Date()) {
  const date = d.toLocaleDateString("en-CA", { timeZone: tz });
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const hh = get("hour") === "24" ? "00" : get("hour");
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { date, time: `${hh}:${get("minute")}`, weekday: wd };
}
const inQuiet = (t: string, s: string, e: string) => (s <= e ? t >= s && t < e : t >= s || t < e);
const addMin = (t: string, m: number) => { const [h, mi] = t.split(":").map(Number); const x = (h * 60 + mi + m + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };

async function tick() {
  const reminders = await prisma.reminder.findMany({ where: { enabled: true }, include: { profile: true } });
  const now = new Date();
  for (const r of reminders) {
    const p = r.profile;
    const lp = localParts(p.timezone, now);
    const snoozed = r.snoozeUntil && r.snoozeUntil <= now;
    const due = (r.days.includes(lp.weekday) && lp.time >= r.time && lp.time < addMin(r.time, 5) && r.lastSentDate !== lp.date) || snoozed;
    if (!due) continue;
    if (!snoozed && inQuiet(lp.time, p.quietStart, p.quietEnd)) continue; // respect quiet hours
    const plan = await prisma.planDay.findUnique({ where: { profileId_weekday: { profileId: p.id, weekday: lp.weekday } } });
    const session = await prisma.session.findFirst({ where: { profileId: p.id, date: lp.date, status: "completed" } });
    const skipped = await prisma.session.findFirst({ where: { profileId: p.id, date: lp.date, status: "skipped" } });
    const hasWorkout = !!plan && !plan.isRest;
    let title = r.label, body = "", actions: any = undefined, send = true;
    const act = (extra: any[] = []) => [...extra, { id: "snooze", label: "Snooze 10 min", reminderId: r.id }];
    switch (r.type) {
      case "workout_soon": send = hasWorkout && !session; body = `${plan?.name} is coming up. Warm up and get your gear ready.`; actions = act([{ id: "start", label: "Start now" }]); break;
      case "workout_now": send = hasWorkout && !session; body = `${plan?.name} is scheduled now.`; actions = act([{ id: "start", label: "Start now" }]); break;
      case "workout_missed": send = hasWorkout && !session && !skipped; title = "Planned workout still open"; body = `${plan?.name} isn't marked done. You can still do it, move it to tomorrow, or skip it. Nothing has been marked complete.`; actions = act([{ id: "start", label: "Start now" }, { id: "reschedule", label: "Move to tomorrow" }, { id: "skip", label: "Skip" }]); break;
      case "meal": {
        const logs = await prisma.foodLog.findMany({ where: { profileId: p.id, date: lp.date } });
        body = logs.length ? "Review today's log and add anything missing." : "Nothing is logged yet. If you've eaten, add it so your totals stay accurate.";
        actions = [{ id: "log", label: "Log food" }]; break;
      }
      case "protein": {
        const logs = await prisma.foodLog.findMany({ where: { profileId: p.id, date: lp.date } });
        const rem = remaining(p, sumLogs(logs));
        send = rem.protein.remaining > 0 && logs.length > 0; body = `${Math.round(rem.protein.remaining)} g protein left today.`; break;
      }
      case "water": {
        const e = await prisma.dailyEntry.findUnique({ where: { profileId_date: { profileId: p.id, date: lp.date } } });
        send = (e?.waterMl ?? 0) < p.waterTargetMl; body = `${e?.waterMl ?? 0} of ${p.waterTargetMl} ml logged. A glass of water?`; actions = [{ id: "water", label: "+250 ml" }]; break;
      }
      case "steps": body = "Log your steps for today if you track them."; break;
      case "weight": body = "A quick morning weigh-in helps your trend line. Daily changes are mostly water, so look at the weekly average."; break;
      case "sleep": body = "Wind down soon. Sleep is when you recover from training."; break;
      case "weekly": body = "Your weekly progress summary is ready."; break;
    }
    // Always record that we handled today's occurrence, to avoid duplicates.
    await prisma.reminder.update({ where: { id: r.id }, data: { lastSentDate: lp.date, snoozeUntil: null } });
    if (send) await notify(p.id, r.type, title, body, actions);
  }
}

export function startScheduler() {
  cron.schedule("* * * * *", () => { tick().catch((e) => console.error("scheduler tick failed", e)); });
  console.log("Reminder scheduler started (runs every minute)");
}
