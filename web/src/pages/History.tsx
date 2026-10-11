import { useEffect, useState } from "react";
import { useApp } from "../ctx";
import { Card, Empty, H, Pill } from "../ui";

export default function HistoryPage() {
  const { p } = useApp();
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { p("/sessions").then(setRows); }, []);
  if (!rows) return <p className="text-mute">Loading…</p>;
  return (
    <div>
      <H>Workout history</H>
      {rows.length === 0 ? <Empty>No workouts yet. Start one from Workout.</Empty> : <div className="space-y-3">{rows.map((s) => (
        <Card key={s.id}>
          <div className="flex justify-between"><div><p className="text-sm text-mute">{s.date}</p><p className="font-extrabold text-lg">{s.name}</p></div><Pill tone={s.status === "completed" ? "good" : s.status === "skipped" ? "plain" : "warn"}>{s.status === "in_progress" ? "Not finished" : s.status}</Pill></div>
          {s.items.length > 0 && <ul className="text-sm mt-2 space-y-0.5">{s.items.map((i: any) => (
            <li key={i.id} className="flex justify-between gap-3"><span>{i.exercise.name}{i.status === "skipped" && " (skipped)"}</span>
              <span className="text-mute text-right">{(i.sets as any[]).filter((x) => !x.warmup && x.reps).map((x) => `${x.weight}×${x.reps}`).join(", ")}</span></li>
          ))}</ul>}
          {s.notes && <p className="text-sm italic text-mute mt-2">{s.notes}</p>}
        </Card>
      ))}</div>}
    </div>
  );
}
