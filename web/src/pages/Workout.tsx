import { useEffect, useRef, useState } from "react";
import { Check, Info, Plus, Repeat, SkipForward, Timer, Trash2, TriangleAlert } from "lucide-react";
import { api } from "../api";
import { useApp } from "../ctx";
import { Bar, Btn, Card, Empty, Err, H, Modal, Pill } from "../ui";
import ExerciseDetail from "./ExerciseDetail";

function RestTimer({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState<number | null>(null);
  const t = useRef<any>(null);
  const start = () => { clearInterval(t.current); setLeft(seconds || 90); t.current = setInterval(() => setLeft((l) => (l === null ? null : l <= 1 ? (clearInterval(t.current), 0) : l - 1)), 1000); };
  const stop = () => { clearInterval(t.current); setLeft(null); };
  useEffect(() => () => clearInterval(t.current), []);
  useEffect(() => { if (left === 0) { try { const c = new AudioContext(); const o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 660; o.start(); o.stop(c.currentTime + 0.25); } catch {} } }, [left]);
  return left === null ? <Btn variant="ghost" onClick={start}><Timer size={14} />Rest {seconds || 90}s</Btn> :
    <Btn variant="ghost" onClick={stop}><Timer size={14} />{left === 0 ? "Rest over. Go!" : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`} · stop</Btn>;
}

function Item({ it, locked, onChange, onInfo, onReplace }: { it: any; locked: boolean; onChange: () => void; onInfo: () => void; onReplace: () => void }) {
  const { p, toast } = useApp();
  const [sets, setSets] = useState<any[]>(it.sets.length ? it.sets : Array.from({ length: it.targetSets }, () => ({ weight: 0, reps: 0 })));
  const [note, setNote] = useState(it.note ?? "");
  const [skipping, setSkipping] = useState(false); const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const done = it.status === "done", skipped = it.status === "skipped";

  const patch = async (body: any) => {
    setErr("");
    try {
      const r = await p(`/session/items/${it.id}`, { method: "PATCH", body });
      if (r.pr) toast(`New personal record on ${it.exercise.name}: est. 1RM ${r.pr.estimated1RM} kg`);
      onChange();
    } catch (e: any) { setErr(e.message); }
  };
  const upd = (i: number, k: string, v: any) => setSets(sets.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const save = () => patch({ sets: sets.map((s) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0, warmup: !!s.warmup })), note });

  return (
    <Card className={done ? "border-plate bg-plate-light/40" : skipped ? "opacity-70" : ""}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-extrabold text-lg">{it.exercise.name}</h3>
          <p className="text-sm text-mute">{it.targetSets} × {it.targetReps} · {it.exercise.primary}</p>
        </div>
        <div className="flex gap-1 items-center">
          {done && <Pill tone="good">Done</Pill>}{skipped && <Pill>Skipped{it.skipReason ? `: ${it.skipReason}` : ""}</Pill>}{it.pain && <Pill tone="bad">Pain noted</Pill>}
          <button aria-label="Exercise instructions" onClick={onInfo} className="p-1.5"><Info size={18} /></button>
        </div>
      </div>
      {!skipped && <div className="mt-3 space-y-2">
        {sets.map((s, i) => (
          <div key={i} className="grid grid-cols-[2.2rem_1fr_1fr_auto_auto] gap-2 items-center">
            <span className="text-sm text-mute">{s.warmup ? "W" : i + 1}</span>
            <input aria-label={`Set ${i + 1} weight kg`} inputMode="decimal" placeholder="kg" disabled={locked} value={s.weight || ""} onChange={(e) => upd(i, "weight", e.target.value)} onBlur={save} />
            <input aria-label={`Set ${i + 1} reps`} inputMode="numeric" placeholder="reps" disabled={locked} value={s.reps || ""} onChange={(e) => upd(i, "reps", e.target.value)} onBlur={save} />
            <label className="text-xs flex items-center gap-1"><input type="checkbox" disabled={locked} checked={!!s.warmup} onChange={(e) => { upd(i, "warmup", e.target.checked); }} onBlur={save} />warm-up</label>
            <button aria-label="Remove set" disabled={locked} onClick={() => { const n = sets.filter((_, j) => j !== i); setSets(n); patch({ sets: n }); }}><Trash2 size={15} className="text-mute" /></button>
          </div>
        ))}
        <div className="flex gap-2 flex-wrap items-center">
          <Btn variant="ghost" disabled={locked} onClick={() => setSets([...sets, { weight: sets[sets.length - 1]?.weight ?? 0, reps: 0 }])}><Plus size={14} />Add set</Btn>
          <RestTimer seconds={it.exercise.restSec} />
        </div>
        <textarea rows={1} placeholder="Notes" disabled={locked} value={note} onChange={(e) => setNote(e.target.value)} onBlur={save} />
      </div>}
      {!locked && <div className="flex gap-2 mt-3 flex-wrap">
        {!done && !skipped && <Btn onClick={() => patch({ sets: sets.map((s) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0, warmup: !!s.warmup })), note, status: "done" })}><Check size={15} />Mark done</Btn>}
        {(done || skipped) && <Btn variant="ghost" onClick={() => patch({ status: "pending" })}>Reopen</Btn>}
        {!done && !skipped && <Btn variant="ghost" onClick={() => setSkipping(true)}><SkipForward size={14} />Skip</Btn>}
        {!done && !skipped && <Btn variant="ghost" onClick={onReplace}><Repeat size={14} />Replace</Btn>}
        <Btn variant="ghost" onClick={() => patch({ pain: !it.pain })}><TriangleAlert size={14} />{it.pain ? "Clear pain flag" : "Report pain"}</Btn>
      </div>}
      {it.pain && <p className="text-xs text-lift mt-2">Sharp pain or joint discomfort is a reason to stop that exercise. Consider a lighter alternative and see a clinician if it persists.</p>}
      {skipping && <div className="mt-3 flex gap-2"><input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} /><Btn onClick={() => { patch({ status: "skipped", skipReason: reason || null }); setSkipping(false); }}>Skip</Btn></div>}
      <Err msg={err} />
    </Card>
  );
}

export default function Workout() {
  const { p, toast } = useApp();
  const [data, setData] = useState<any>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<any>(null);
  const [lib, setLib] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const load = () => p("/session/today").then(setData);
  useEffect(() => { load(); }, []);
  useEffect(() => { if (replacing) api("/exercises?muscle=" + encodeURIComponent(replacing.exercise.primary.split(" ")[0])).then(setLib); }, [replacing]);
  if (!data) return <p className="text-mute">Loading…</p>;
  const { plan, session } = data;

  if (!plan || plan.isRest) return <div><H>Today's workout</H><Card><p>Today is a rest and recovery day. You can change this in the weekly plan.</p></Card></div>;

  const start = async () => { try { await p("/session/start", { body: { date: data.date } }); load(); } catch (e: any) { setErr(e.message); } };
  const doneCount = session?.items.filter((i: any) => i.status === "done").length ?? 0;
  const open = session?.items.filter((i: any) => i.status === "pending").length ?? 0;
  const completed = session?.status === "completed";

  if (summary) return (
    <div><H>Workout saved</H>
      <Card className="space-y-2">
        <p className="text-2xl font-black">{plan.name} complete</p>
        <p>{summary.durationMin} min · {summary.exercisesDone} exercises done{summary.exercisesSkipped ? ` · ${summary.exercisesSkipped} skipped` : ""} · {summary.totalSets} working sets</p>
        {summary.prs.length > 0 ? <div><b>Personal records</b><ul className="list-disc pl-5 text-sm">{summary.prs.map((x: any) => <li key={x.exercise}>{x.exercise}: est. 1RM {x.estimated1RM} kg (was {x.previous})</li>)}</ul></div> : <p className="text-sm text-mute">No new records this time. Consistency counts.</p>}
        <Btn onClick={() => { setSummary(null); load(); }}>Back to workout</Btn>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      <H sub={completed ? "Saved as completed." : session ? `${doneCount} of ${session.items.length} exercises done` : "Opening this page doesn't log anything. Start the workout when you begin."}>{plan.name}</H>
      {!session && <>
        <Card><ol className="space-y-1 text-sm">{plan.exercises.map((e: any) => <li key={e.id} className="flex justify-between"><span>{e.exercise.name}</span><span className="text-mute">{e.sets} × {e.reps}</span></li>)}</ol>
          <div className="flex gap-2 mt-4"><Btn onClick={start}>Start workout</Btn><Btn variant="ghost" onClick={async () => { await p("/session/skip", { body: { date: data.date } }); toast("Workout skipped"); load(); }}>Skip today</Btn></div><Err msg={err} /></Card>
      </>}
      {session?.status === "skipped" && <Card><p>You skipped this workout today.</p></Card>}
      {session && session.status !== "skipped" && <>
        <Bar value={doneCount} max={session.items.length} />
        {session.items.map((it: any) => <Item key={it.id + it.status + it.exerciseId} it={it} locked={completed} onChange={load} onInfo={() => setInfo(it.exerciseId)} onReplace={() => setReplacing(it)} />)}
        {!completed && <Card>
          <textarea rows={2} placeholder="How did it feel? (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Btn className="mt-3" disabled={open > 0} onClick={async () => { try { setSummary(await p(`/session/${session.id}/finish`, { body: { notes } })); } catch (e: any) { setErr(e.message); } }}>Finish and save workout</Btn>
          {open > 0 && <p className="text-xs text-mute mt-2">{open} exercise{open > 1 ? "s" : ""} still open. Mark each done or skip it.</p>}
          <Err msg={err} />
        </Card>}
      </>}
      {info && <ExerciseDetail id={info} onClose={() => setInfo(null)} />}
      {replacing && <Modal title={`Replace ${replacing.exercise.name}`} onClose={() => setReplacing(null)}>
        {lib.length === 0 ? <Empty>No similar exercises found.</Empty> : <div className="space-y-1">{lib.filter((e) => e.id !== replacing.exerciseId).map((e) => (
          <button key={e.id} className="w-full text-left p-2 rounded-lg hover:bg-chalk" onClick={async () => { await p(`/session/items/${replacing.id}/replace`, { body: { exerciseId: e.id } }); setReplacing(null); load(); }}><b>{e.name}</b> <span className="text-sm text-mute">{e.equipment}</span></button>
        ))}</div>}
      </Modal>}
    </div>
  );
}
