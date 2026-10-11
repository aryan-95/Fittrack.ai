import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays, api, todayIn } from "../api";
import { useApp } from "../ctx";
import { Btn, Card, Empty, Field, H } from "../ui";

const Chart = ({ title, data, children, note }: any) => (
  <Card><h3 className="font-extrabold mb-1">{title}</h3>{note && <p className="text-xs text-mute mb-2">{note}</p>}
    {data.length < 2 ? <Empty>Not enough data yet.</Empty> : <div className="h-56"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>}</Card>
);
const tick = (d: string) => d.slice(5);

export default function Progress() {
  const { p, profile, toast } = useApp();
  const today = todayIn(profile.timezone);
  const [range, setRange] = useState("30");
  const [from, setFrom] = useState(addDays(today, -29)); const [to, setTo] = useState(today);
  const [d, setD] = useState<any>(null);
  const [form, setForm] = useState({ weightKg: "", waistCm: "" });
  const [ex, setEx] = useState<any[]>([]); const [exId, setExId] = useState(""); const [hist, setHist] = useState<any[]>([]);

  const load = () => p(range === "custom" ? `/progress?from=${from}&to=${to}&days=730` : `/progress?days=${range}`).then(setD);
  useEffect(() => { load(); }, [range, from, to, profile.id]);
  useEffect(() => { api("/exercises").then(setEx); }, []);
  useEffect(() => { if (exId) p(`/exercise-history/${exId}`).then(setHist); }, [exId]);

  const log = async () => {
    const body: any = {}; if (form.weightKg) body.weightKg = Number(form.weightKg); if (form.waistCm) body.waistCm = Number(form.waistCm);
    if (!Object.keys(body).length) return;
    await p(`/daily/${today}`, { method: "PUT", body }); setForm({ weightKg: "", waistCm: "" }); toast("Saved"); load();
  };
  if (!d) return <p className="text-mute">Loading…</p>;
  const a = d.adherence;
  return (
    <div className="space-y-4">
      <H sub="Daily weight bounces with water, salt and food volume. The 7-day average is the line to watch.">Body progress</H>
      <div className="flex flex-wrap gap-2 items-end">
        {["7", "30", "90"].map((r) => <Btn key={r} variant={range === r ? "primary" : "ghost"} onClick={() => setRange(r)}>{r} days</Btn>)}
        <Btn variant={range === "custom" ? "primary" : "ghost"} onClick={() => setRange("custom")}>Custom</Btn>
        {range === "custom" && <><input type="date" className="!w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /><input type="date" className="!w-auto" value={to} max={today} onChange={(e) => setTo(e.target.value)} /></>}
      </div>
      <Card><div className="grid sm:grid-cols-3 gap-3 items-end">
        <Field label="Today's weight" hint="kg"><input type="number" step="0.1" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} /></Field>
        <Field label="Waist" hint="cm"><input type="number" step="0.1" value={form.waistCm} onChange={(e) => setForm({ ...form, waistCm: e.target.value })} /></Field>
        <Btn onClick={log}>Save measurements</Btn></div></Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Chart title="Body weight" data={d.weight} note="Dots are daily weigh-ins; the line is the 7-day average.">
          <LineChart data={d.weight}><CartesianGrid stroke="#D4DAD6" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={tick} fontSize={11} /><YAxis domain={["auto", "auto"]} fontSize={11} width={40} /><Tooltip />
            <Line dataKey="weight" stroke="#9AA5AE" strokeWidth={0} dot={{ r: 3 }} name="Daily" /><Line dataKey="avg7" stroke="#0E7C7B" strokeWidth={2.5} dot={false} name="7-day avg" /></LineChart></Chart>
        <Chart title="Waist (cm)" data={d.waist}><LineChart data={d.waist}><CartesianGrid stroke="#D4DAD6" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={tick} fontSize={11} /><YAxis domain={["auto", "auto"]} fontSize={11} width={40} /><Tooltip /><Line dataKey="waist" stroke="#17212B" strokeWidth={2} /></LineChart></Chart>
        <Chart title="Calories" data={d.nutrition} note="Only days you logged food are shown."><BarChart data={d.nutrition}><CartesianGrid stroke="#D4DAD6" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={tick} fontSize={11} /><YAxis fontSize={11} width={40} /><Tooltip /><ReferenceLine y={profile.kcalTarget} stroke="#F2A900" strokeDasharray="4 4" /><Bar dataKey="kcal" fill="#0E7C7B" /></BarChart></Chart>
        <Chart title="Protein (g)" data={d.nutrition}><BarChart data={d.nutrition}><CartesianGrid stroke="#D4DAD6" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={tick} fontSize={11} /><YAxis fontSize={11} width={40} /><Tooltip /><ReferenceLine y={profile.proteinTarget} stroke="#F2A900" strokeDasharray="4 4" /><Bar dataKey="protein" fill="#17212B" /></BarChart></Chart>
        <Chart title="Workouts per week" data={d.workoutsPerWeek}><BarChart data={d.workoutsPerWeek}><CartesianGrid stroke="#D4DAD6" strokeDasharray="3 3" /><XAxis dataKey="week" tickFormatter={tick} fontSize={11} /><YAxis allowDecimals={false} fontSize={11} width={30} /><Tooltip /><Bar dataKey="count" fill="#0E7C7B" /></BarChart></Chart>
        <Chart title="Steps" data={d.steps}><BarChart data={d.steps}><CartesianGrid stroke="#D4DAD6" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={tick} fontSize={11} /><YAxis fontSize={11} width={45} /><Tooltip /><Bar dataKey="steps" fill="#9AA5AE" /></BarChart></Chart>
      </div>
      <Card>
        <h3 className="font-extrabold mb-2">Strength progression</h3>
        <select aria-label="Exercise" value={exId} onChange={(e) => setExId(e.target.value)}><option value="">Choose an exercise…</option>{ex.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        {exId && (hist.length < 2 ? <Empty>Log this exercise in at least two workouts to see a trend.</Empty> : <div className="h-56 mt-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={hist}><CartesianGrid stroke="#D4DAD6" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={tick} fontSize={11} /><YAxis domain={["auto", "auto"]} fontSize={11} width={40} /><Tooltip /><Line dataKey="best1RM" name="Est. 1RM (kg)" stroke="#0E7C7B" strokeWidth={2.5} /><Line dataKey="topWeight" name="Top weight (kg)" stroke="#F2A900" strokeWidth={2} /></LineChart></ResponsiveContainer></div>)}
      </Card>
      <Card><h3 className="font-extrabold mb-1">Consistency</h3>
        <p className="text-sm">{d.completedWorkouts} workout{d.completedWorkouts === 1 ? "" : "s"} completed in this period.</p>
        {a ? <p className="text-sm mt-1">Of {a.days} days with food logged: {a.kcalWithin10} within 10% of your calorie target, {a.proteinHit} reached 90%+ of your protein target.</p> : <p className="text-sm text-mute mt-1">Log food to see adherence.</p>}
      </Card>
    </div>
  );
}
