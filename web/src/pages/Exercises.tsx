import { useEffect, useState } from "react";
import { api } from "../api";
import { Card, Empty, H, Pill } from "../ui";
import ExerciseDetail from "./ExerciseDetail";

export default function Exercises() {
  const [f, setF] = useState({ q: "", muscle: "", equipment: "", difficulty: "", type: "" });
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => api("/exercises?" + new URLSearchParams(Object.entries(f).filter(([, v]) => v) as any)).then(setList), 200);
    return () => clearTimeout(t);
  }, [f]);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <div>
      <H sub="Written instructions for every exercise. Tap one to see form cues, mistakes and variations.">Exercise library</H>
      <Card className="grid sm:grid-cols-5 gap-2 mb-4">
        <input placeholder="Search" aria-label="Search exercises" value={f.q} onChange={set("q")} />
        <select aria-label="Muscle" value={f.muscle} onChange={set("muscle")}><option value="">Any muscle</option>{["Chest", "Upper chest", "Shoulders", "Side delts", "Rear delts", "Triceps", "Biceps", "Lats", "Mid back", "Upper back", "Quads", "Hamstrings", "Glutes", "Calves", "Core", "Obliques"].map((m) => <option key={m}>{m}</option>)}</select>
        <select aria-label="Equipment" value={f.equipment} onChange={set("equipment")}><option value="">Any equipment</option>{["Barbell", "Dumbbell", "Cable", "Machine", "None"].map((m) => <option key={m}>{m}</option>)}</select>
        <select aria-label="Difficulty" value={f.difficulty} onChange={set("difficulty")}><option value="">Any level</option><option>Beginner</option><option>Intermediate</option></select>
        <select aria-label="Type" value={f.type} onChange={set("type")}><option value="">Any type</option>{["Compound", "Isolation", "Isometric", "Core", "Core stability", "Cardio", "Mobility"].map((m) => <option key={m}>{m}</option>)}</select>
      </Card>
      {list.length === 0 ? <Empty>No exercises match these filters.</Empty> : (
        <div className="grid sm:grid-cols-2 gap-3">{list.map((e) => (
          <button key={e.id} onClick={() => setOpen(e.id)} className="text-left bg-white border border-line rounded-xl p-3 hover:border-plate">
            <p className="font-bold">{e.name}</p><p className="text-sm text-mute">{e.primary} · {e.equipment}</p>
            <div className="flex gap-1.5 mt-2"><Pill>{e.type}</Pill><Pill tone={e.difficulty === "Beginner" ? "good" : "warn"}>{e.difficulty}</Pill></div>
          </button>
        ))}</div>
      )}
      {open && <ExerciseDetail id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
