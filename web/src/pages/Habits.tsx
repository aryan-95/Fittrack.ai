import { useEffect, useState } from "react";
import { todayIn } from "../api";
import { useApp } from "../ctx";
import { Bar, Btn, Card, Field, H } from "../ui";

export default function Habits() {
  const { p, profile, toast } = useApp();
  const date = todayIn(profile.timezone);
  const [e, setE] = useState<any>(null);
  const [custom, setCustom] = useState("");
  const [form, setForm] = useState<any>({ steps: "", sleepH: "", fruitVeg: "" });
  const load = () => p(`/daily?from=${date}&to=${date}`).then((r) => { const x = r[0] ?? { waterMl: 0, mobility: false }; setE(x); setForm({ steps: x.steps ?? "", sleepH: x.sleepH ?? "", fruitVeg: x.fruitVeg ?? "" }); });
  useEffect(() => { load(); }, [profile.id]);
  if (!e) return <p className="text-mute">Loading…</p>;
  const add = async (ml: number) => { await p(`/daily/${date}/water`, { body: { ml } }); load(); };
  const save = async (extra: any = {}) => {
    const body: any = { ...extra };
    if (form.steps !== "") body.steps = Number(form.steps); if (form.sleepH !== "") body.sleepH = Number(form.sleepH); if (form.fruitVeg !== "") body.fruitVeg = Number(form.fruitVeg);
    await p(`/daily/${date}`, { method: "PUT", body }); toast("Saved"); load();
  };
  return (
    <div className="space-y-4">
      <H sub="Quick daily check-ins. Targets here are general guidance, not medical advice.">Water, steps and habits</H>
      <Card>
        <p className="text-sm text-mute">Water</p><p className="text-3xl font-black">{e.waterMl} <span className="text-base text-mute font-semibold">/ {profile.waterTargetMl} ml</span></p>
        <Bar value={e.waterMl} max={profile.waterTargetMl} />
        <div className="flex gap-2 mt-3 flex-wrap items-center"><Btn variant="ghost" onClick={() => add(250)}>+250 ml</Btn><Btn variant="ghost" onClick={() => add(500)}>+500 ml</Btn>
          <input className="!w-28" type="number" placeholder="Custom ml" value={custom} onChange={(x) => setCustom(x.target.value)} /><Btn variant="ghost" onClick={() => { if (Number(custom) > 0) { add(Number(custom)); setCustom(""); } }}>Add</Btn>
          <Btn variant="ghost" onClick={() => add(-250)}>Undo 250</Btn></div>
      </Card>
      <Card>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Steps today"><input type="number" value={form.steps} onChange={(x) => setForm({ ...form, steps: x.target.value })} /></Field>
          <Field label="Sleep last night" hint="hours"><input type="number" step="0.25" value={form.sleepH} onChange={(x) => setForm({ ...form, sleepH: x.target.value })} /></Field>
          <Field label="Fruit & veg servings"><input type="number" value={form.fruitVeg} onChange={(x) => setForm({ ...form, fruitVeg: x.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={!!e.mobility} onChange={(x) => save({ mobility: x.target.checked })} />Did stretching or mobility today</label>
        <Btn className="mt-3" onClick={() => save()}>Save</Btn>
        <p className="text-xs text-mute mt-2">Steps are entered manually. Automatic step sync would need a native app or a device integration such as Health Connect or Apple Health.</p>
      </Card>
    </div>
  );
}
