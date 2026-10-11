import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Droplets, Dumbbell } from "lucide-react";
import { useApp } from "../ctx";
import { WEEKDAYS } from "../api";
import { Bar, Btn, Card, Macro, Pill, STATUS } from "../ui";

export default function Dashboard() {
  const { p, profile, toast } = useApp();
  const [d, setD] = useState<any>(null);
  const load = () => p("/dashboard").then(setD).catch((e) => toast(e.message));
  useEffect(() => { setD(null); load(); }, [profile.id, profile.kcalTarget]);
  if (!d) return <p className="text-mute">Loading…</p>;
  const n = d.nutrition, r = n.remaining;
  const [label, tone] = STATUS[n.status];
  const dt = new Date(d.date + "T00:00:00");
  const addWater = async (ml: number) => { await p(`/daily/${d.date}/water`, { body: { ml } }); load(); };
  const water = d.entry?.waterMl ?? 0;
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; })();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-black">{greeting}, {profile.name}</h1>
        <p className="text-mute">{WEEKDAYS[dt.getDay()]}, {dt.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="flex justify-between items-start"><div><p className="text-sm text-mute">Calories</p>
            <p className="text-4xl font-black">{Math.round(r.kcal.remaining)}<span className="text-base font-semibold text-mute"> kcal left</span></p></div><Pill tone={tone}>{label}</Pill></div>
          <div className="mt-2"><Bar value={r.kcal.consumed} max={r.kcal.target} over={r.kcal.over > 0} /></div>
          <p className="text-sm text-mute mt-1">{Math.round(r.kcal.consumed)} eaten of {r.kcal.target} target{r.kcal.over > 0 && <span className="text-lift font-semibold"> · {Math.round(r.kcal.over)} over</span>}</p>
          <div className="grid gap-3 mt-4"><Macro label="Protein" unit="g" d={r.protein} /><Macro label="Carbohydrates" unit="g" d={r.carbs} /><Macro label="Fat" unit="g" d={r.fat} /><Macro label="Fiber" unit="g" d={r.fiber} /></div>
          <Link to="/food"><Btn className="mt-4">Log food</Btn></Link>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2"><Dumbbell size={18} className="text-plate" /><h2 className="font-extrabold text-lg">Today's workout</h2></div>
            {d.workout.plan && !d.workout.plan.isRest ? <>
              <p className="mt-1 text-xl font-bold">{d.workout.plan.name}</p>
              <p className="text-sm text-mute">{d.workout.status === "completed" ? "Completed" : d.workout.sessionId ? `${d.workout.done} of ${d.workout.total} exercises done` : `${d.workout.plan.count} exercises planned. Not started.`}</p>
              <div className="mt-2"><Bar value={d.workout.pct} max={100} /></div>
              <Link to="/workout"><Btn className="mt-3">{d.workout.sessionId && d.workout.status !== "completed" ? "Continue workout" : d.workout.status === "completed" ? "View workout" : "Open workout"}</Btn></Link>
            </> : <p className="mt-1 text-mute">Rest and recovery day. Walking and light mobility work are good options.</p>}
          </Card>
          <Card>
            <div className="flex items-center gap-2"><Droplets size={18} className="text-plate" /><h2 className="font-extrabold text-lg">Water</h2></div>
            <p className="mt-1"><b className="text-2xl">{water}</b> <span className="text-mute">/ {profile.waterTargetMl} ml</span></p>
            <Bar value={water} max={profile.waterTargetMl} />
            <div className="flex gap-2 mt-3 flex-wrap"><Btn variant="ghost" onClick={() => addWater(250)}>+250 ml</Btn><Btn variant="ghost" onClick={() => addWater(500)}>+500 ml</Btn></div>
            <p className="text-xs text-mute mt-2">Hydration targets are general guidance, not a medical prescription.</p>
          </Card>
          <Card>
            <div className="flex justify-between text-sm"><span>Steps: <b>{d.entry?.steps ?? "not entered"}</b></span><span>Habits done today: <b>{d.habitPct}%</b></span></div>
          </Card>
        </div>
      </div>

      {d.recommendations.length > 0 && <Card><h2 className="font-extrabold text-lg mb-2">Notes for today</h2><ul className="space-y-1.5 text-sm list-disc pl-5">{d.recommendations.map((x: string) => <li key={x}>{x}</li>)}</ul></Card>}
    </div>
  );
}
