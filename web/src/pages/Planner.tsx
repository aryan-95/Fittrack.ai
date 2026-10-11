import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { api, WEEKDAYS } from "../api";
import { useApp } from "../ctx";
import { Btn, Card, Field, H, Modal, Pill } from "../ui";

export default function Planner() {
  const { p, toast } = useApp();
  const [plan, setPlan] = useState<any[]>([]);
  const [lib, setLib] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const load = () => p("/plan").then(setPlan);
  useEffect(() => { load(); api("/exercises").then(setLib); }, []);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const day = (w: number) => plan.find((d) => d.weekday === w);

  const open = (w: number) => {
    const d = day(w);
    setEdit({ weekday: w, name: d?.name ?? "New workout", isRest: d?.isRest ?? false, exercises: (d?.exercises ?? []).map((e: any) => ({ exerciseId: e.exerciseId, name: e.exercise.name, sets: e.sets, reps: e.reps })) });
  };
  const move = (i: number, dir: number) => { const x = [...edit.exercises]; const j = i + dir; if (j < 0 || j >= x.length) return; [x[i], x[j]] = [x[j], x[i]]; setEdit({ ...edit, exercises: x }); };
  const save = async () => {
    await p(`/plan/${edit.weekday}`, { method: "PUT", body: { name: edit.name, isRest: edit.isRest, exercises: edit.exercises.map(({ exerciseId, sets, reps }: any) => ({ exerciseId, sets: Number(sets), reps })) } });
    setEdit(null); toast("Plan saved"); load();
  };
  const swap = async (a: number, b: number) => { await p("/plan/swap", { body: { a, b } }); load(); };

  return (
    <div>
      <H sub="This is a template, not a rule. Change days, swap exercises, add cardio or mobility, or set rest days. Deload weeks: lower sets or weights for a week by editing here.">Weekly plan</H>
      <div className="space-y-3">
        {order.map((w, idx) => { const d = day(w); return (
          <Card key={w}>
            <div className="flex items-center justify-between gap-2">
              <div><p className="text-sm text-mute">{WEEKDAYS[w]}</p><p className="font-extrabold text-lg">{d?.name ?? "Unplanned"} {d?.isRest && <Pill>Rest</Pill>}</p></div>
              <div className="flex gap-1">
                {idx > 0 && <Btn variant="ghost" aria-label={`Swap with ${WEEKDAYS[order[idx - 1]]}`} onClick={() => swap(w, order[idx - 1])}><ArrowUp size={14} /></Btn>}
                {idx < 6 && <Btn variant="ghost" aria-label={`Swap with ${WEEKDAYS[order[idx + 1]]}`} onClick={() => swap(w, order[idx + 1])}><ArrowDown size={14} /></Btn>}
                <Btn variant="ghost" onClick={() => open(w)}>Edit</Btn>
              </div>
            </div>
            {d && !d.isRest && <p className="text-sm text-mute mt-1">{d.exercises.map((e: any) => e.exercise.name).join(" · ") || "No exercises yet"}</p>}
          </Card>
        ); })}
      </div>
      {edit && <Modal title={`Edit ${WEEKDAYS[edit.weekday]}`} onClose={() => setEdit(null)} wide>
        <div className="space-y-3">
          <Field label="Workout name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.isRest} onChange={(e) => setEdit({ ...edit, isRest: e.target.checked })} />Rest day</label>
          {!edit.isRest && <>
            {edit.exercises.map((x: any, i: number) => (
              <div key={i} className="grid grid-cols-[1fr_4rem_5.5rem_auto] gap-2 items-center">
                <span className="text-sm font-semibold">{x.name}</span>
                <input aria-label="Sets" type="number" value={x.sets} onChange={(e) => setEdit({ ...edit, exercises: edit.exercises.map((y: any, j: number) => j === i ? { ...y, sets: e.target.value } : y) })} />
                <input aria-label="Reps" value={x.reps} onChange={(e) => setEdit({ ...edit, exercises: edit.exercises.map((y: any, j: number) => j === i ? { ...y, reps: e.target.value } : y) })} />
                <div className="flex"><button aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp size={15} /></button><button aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown size={15} /></button><button aria-label="Remove" onClick={() => setEdit({ ...edit, exercises: edit.exercises.filter((_: any, j: number) => j !== i) })}><Trash2 size={15} /></button></div>
              </div>
            ))}
            <Field label="Add exercise (cardio and mobility included)">
              <select value="" onChange={(e) => { const x = lib.find((l) => l.id === e.target.value); if (x) setEdit({ ...edit, exercises: [...edit.exercises, { exerciseId: x.id, name: x.name, sets: x.sets, reps: x.reps }] }); }}>
                <option value="">Choose…</option>{lib.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
          </>}
          <Btn onClick={save}><Plus size={14} />Save day</Btn>
        </div>
      </Modal>}
    </div>
  );
}
