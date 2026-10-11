import { useEffect, useState } from "react";
import { api } from "../api";
import { Modal, Pill } from "../ui";

export default function ExerciseDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [e, setE] = useState<any>(null);
  useEffect(() => { api("/exercises/" + id).then(setE); }, [id]);
  return (
    <Modal title={e?.name ?? "Exercise"} onClose={onClose} wide>
      {!e ? <p className="text-mute">Loading…</p> : (
        <div className="space-y-4 text-sm">
          <div className="flex gap-2 flex-wrap"><Pill tone="good">{e.primary}</Pill>{e.secondary.map((s: string) => <Pill key={s}>{s}</Pill>)}<Pill>{e.equipment}</Pill><Pill>{e.type}</Pill><Pill>{e.difficulty}</Pill></div>
          <div className="rounded-lg border border-dashed border-line bg-chalk p-3 text-mute">{e.mediaNote}</div>
          <div><b>Starting position.</b> {e.start}</div>
          <div><b>How to do it</b><ol className="list-decimal pl-5 mt-1 space-y-1">{e.instructions.map((s: string) => <li key={s}>{s}</li>)}</ol></div>
          <div><b>Breathing.</b> {e.breathing}</div>
          <div className="grid grid-cols-3 gap-2 text-center">{[["Sets", e.sets], ["Reps", e.reps], ["Rest", e.restSec ? `${e.restSec}s` : "n/a"]].map(([k, v]) => <div key={k} className="bg-chalk rounded-lg p-2"><p className="text-xs text-mute">{k}</p><p className="font-bold">{v}</p></div>)}</div>
          <div><b>Common mistakes</b><ul className="list-disc pl-5 mt-1">{e.mistakes.map((s: string) => <li key={s}>{s}</li>)}</ul></div>
          <div><b>Safety.</b> {e.safety}</div>
          <div><b>Beginner:</b> {e.beginner}</div>
          <div className="grid sm:grid-cols-2 gap-2"><div className="bg-chalk rounded-lg p-2"><b>Easier:</b> {e.easier}</div><div className="bg-chalk rounded-lg p-2"><b>Harder:</b> {e.harder}</div></div>
          <div><b>Alternatives:</b> {e.alternatives.join(", ")}</div>
        </div>
      )}
    </Modal>
  );
}
