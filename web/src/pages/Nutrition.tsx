import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fmt, todayIn } from "../api";
import { useApp } from "../ctx";
import { Btn, Card, Empty, H, Macro, Pill, STATUS } from "../ui";

export default function Nutrition() {
  const { p, profile } = useApp();
  const today = todayIn(profile.timezone);
  const [date, setDate] = useState(today);
  const [d, setD] = useState<any>(null);
  useEffect(() => { p(`/nutrition?date=${date}`).then(setD); }, [date, profile.id]);
  if (!d) return <p className="text-mute">Loading…</p>;
  const r = d.remaining; const [label, tone] = STATUS[d.status];
  return (
    <div className="space-y-4">
      <H sub="Remaining = target minus what you've logged. Going over is shown as an excess, never as something to make up.">Nutrition today</H>
      <div className="flex items-center gap-3"><input type="date" className="!w-auto" value={date} max={today} onChange={(e) => setDate(e.target.value)} /><Pill tone={tone}>{label}</Pill></div>
      {d.status === "no_log" && <p className="text-sm text-mute">No food was logged on this day. That doesn't mean you didn't eat.</p>}
      <Card>
        <p className="text-sm text-mute">Calories</p>
        <p className="text-4xl font-black">{fmt(r.kcal.consumed)} <span className="text-base text-mute font-semibold">of {r.kcal.target} kcal</span></p>
        <p className="text-sm mt-1">{r.kcal.over > 0 ? <b className="text-lift">{fmt(r.kcal.over)} kcal over target</b> : <b>{fmt(r.kcal.remaining)} kcal remaining</b>}</p>
        <div className="grid sm:grid-cols-2 gap-4 mt-4"><Macro label="Protein" unit="g" d={r.protein} /><Macro label="Carbohydrates" unit="g" d={r.carbs} /><Macro label="Fat" unit="g" d={r.fat} /><Macro label="Fiber" unit="g" d={r.fiber} /></div>
        <p className="text-xs text-mute mt-4">Within roughly ±10% of your calorie target is a good day. You don't need to hit every macro exactly or eat extra to fill gaps.</p>
      </Card>
      <Card>
        <h2 className="font-extrabold text-lg mb-2">Ideas to fill what's left</h2>
        {d.suggestions.length === 0 ? <Empty>{r.kcal.remaining < 100 ? "You're close to your calorie target. Nothing more is needed." : "No suggestions available."}</Empty> : (
          <ul className="space-y-1.5 text-sm">{d.suggestions.map((s: any) => <li key={s.name} className="flex justify-between"><span><b>{s.name}</b> · about {s.grams} g</span><span className="text-mute">{s.kcal} kcal · {s.protein} g protein · {s.fiber} g fiber</span></li>)}</ul>
        )}
        <p className="text-xs text-mute mt-2">Filtered by your diet type and allergy list. Always check labels yourself.</p>
      </Card>
      <Link to="/food"><Btn>Log food</Btn></Link>
    </div>
  );
}
