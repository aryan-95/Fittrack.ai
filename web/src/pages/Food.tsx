import { useEffect, useState } from "react";
import { Copy, Pencil, Search, Trash2 } from "lucide-react";
import { addDays, fmt, MEALS, todayIn } from "../api";
import { useApp } from "../ctx";
import { Btn, Card, Empty, Err, Field, H, Macro, Pill } from "../ui";

const per = (c: any, grams: number) => { const f = grams / 100; return { kcal: c.per100.kcal * f, protein: c.per100.protein * f, carbs: c.per100.carbs * f, fat: c.per100.fat * f, fiber: c.per100.fiber * f }; };

export default function Food() {
  const { p, profile, toast } = useApp();
  const today = todayIn(profile.timezone);
  const [date, setDate] = useState(today);
  const [meal, setMeal] = useState("lunch");
  const [text, setText] = useState("");
  const [review, setReview] = useState<any[] | null>(null);
  const [q, setQ] = useState(""); const [results, setResults] = useState<any[]>([]);
  const [day, setDay] = useState<any>(null);
  const [custom, setCustom] = useState(false);
  const [err, setErr] = useState("");

  const load = () => p(`/nutrition?date=${date}`).then(setDay);
  useEffect(() => { load(); }, [date]);
  useEffect(() => { const t = setTimeout(() => p(`/foods?q=${encodeURIComponent(q)}`).then(setResults), 200); return () => clearTimeout(t); }, [q]);

  const parse = async () => {
    setErr("");
    try {
      const r = await p("/foods/parse", { body: { text } });
      if (!r.items.length) return setErr("Couldn't find any foods in that text. Try “150 g cooked rice, 2 eggs”.");
      setReview(r.items.map((it: any) => ({ ...it, sel: 0, grams: it.candidates[0]?.grams ?? 0, include: it.candidates.length > 0 })));
    } catch (e: any) { setErr(e.message); }
  };
  const setItem = (i: number, patch: any) => setReview(review!.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const pick = (i: number, sel: number) => setItem(i, { sel, grams: review![i].candidates[sel].grams });

  const saveReview = async () => {
    const items = review!.filter((x) => x.include && x.candidates.length && x.grams > 0).map((x) => ({ foodId: x.candidates[x.sel].id, quantity: x.quantity, unit: x.unit, grams: Number(x.grams), meal, date, estimated: x.candidates[x.sel].estimated }));
    if (!items.length) return setErr("Nothing to save yet. Enter grams for each item you want to add.");
    await p("/log/foods", { body: { items } }); setReview(null); setText(""); toast("Meal added"); load();
  };

  const addManual = async (f: any, grams: number, unit: string, quantity: number) => {
    await p("/log/foods", { body: { items: [{ foodId: f.id, quantity, unit, grams, meal, date }] } }); toast(`${f.name} added`); load();
  };

  const totals = day?.remaining;
  return (
    <div className="space-y-4">
      <H sub="Type what you ate, or search the food list. You always review before anything is saved.">Log food</H>
      <div className="flex gap-2 flex-wrap items-end">
        <Field label="Date"><input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Meal"><select value={meal} onChange={(e) => setMeal(e.target.value)}>{MEALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      </div>

      <Card>
        <label className="font-semibold text-sm" htmlFor="quick">Quick entry</label>
        <textarea id="quick" rows={2} className="mt-1" placeholder="I ate 200 g paneer, 50 g dry soya chunks, 3 slices of bread and 150 g cooked rice" value={text} onChange={(e) => setText(e.target.value)} />
        <Btn className="mt-2" onClick={parse} disabled={!text.trim()}>Review items</Btn><Err msg={err} />
        {review && <div className="mt-4 space-y-3">
          {review.map((it, i) => { const c = it.candidates[it.sel]; const n = c ? per(c, Number(it.grams) || 0) : null; return (
            <div key={i} className="border border-line rounded-lg p-3 text-sm">
              <div className="flex justify-between gap-2"><span className="font-semibold">“{it.raw}”</span><label className="flex items-center gap-1"><input type="checkbox" checked={it.include} onChange={(e) => setItem(i, { include: e.target.checked })} />Add</label></div>
              {!c ? <p className="text-lift mt-1">{it.issue}</p> : <>
                <div className="grid sm:grid-cols-[1fr_7rem] gap-2 mt-2">
                  <select aria-label="Matched food" value={it.sel} onChange={(e) => pick(i, Number(e.target.value))}>{it.candidates.map((cc: any, k: number) => <option key={cc.id} value={k}>{cc.name}</option>)}</select>
                  <div className="flex items-center gap-1"><input aria-label="Grams" type="number" value={it.grams} onChange={(e) => setItem(i, { grams: e.target.value })} /><span>g</span></div>
                </div>
                {it.ambiguous && <p className="mt-1 text-lift">More than one food matched “{it.query}”. Check the match above (for example cooked vs dry, or with vs without milk).</p>}
                {(c.estimated || !it.grams) && <p className="mt-1 text-mute"><Pill tone="warn">Estimated</Pill> {c.note ?? "Enter the weight in grams."}</p>}
                {n && <p className="mt-1 text-mute">{fmt(n.kcal)} kcal · P {fmt(n.protein, 1)} g · C {fmt(n.carbs, 1)} g · F {fmt(n.fat, 1)} g · Fiber {fmt(n.fiber, 1)} g</p>}
                <p className="text-xs text-mute">Source: {c.source}</p>
              </>}
            </div>
          ); })}
          <div className="flex gap-2 items-center"><Btn onClick={saveReview}>Save to {MEALS.find(([k]) => k === meal)![1]}</Btn><Btn variant="ghost" onClick={() => setReview(null)}>Cancel</Btn></div>
        </div>}
      </Card>

      <Card>
        <div className="flex items-center gap-2"><Search size={16} /><input aria-label="Search foods" placeholder="Search foods (paneer, roti, dal…)" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="mt-3 divide-y divide-line">{results.length === 0 ? <Empty>No match. Create a custom food below.</Empty> : results.map((f) => <FoodRow key={f.id} f={f} onAdd={addManual} />)}</div>
        <Btn variant="ghost" className="mt-3" onClick={() => setCustom(!custom)}>{custom ? "Hide custom food" : "Create a custom food"}</Btn>
        {custom && <CustomFood onSaved={() => { setCustom(false); p(`/foods?q=${encodeURIComponent(q)}`).then(setResults); }} />}
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-2"><h2 className="font-extrabold text-lg">Log for {date === today ? "today" : date}</h2>
          <Btn variant="ghost" onClick={async () => { const r = await p("/log/duplicate", { body: { fromDate: addDays(date, -1), toDate: date } }); toast(`Copied ${r.copied} entries from yesterday`); load(); }}><Copy size={14} />Copy yesterday</Btn></div>
        {totals && <div className="grid sm:grid-cols-2 gap-3 mb-4"><Macro label="Calories" unit="kcal" d={totals.kcal} /><Macro label="Protein" unit="g" d={totals.protein} /></div>}
        {!day || day.logs.length === 0 ? <Empty>Nothing logged for this day.</Empty> : MEALS.map(([k, l]) => { const rows = day.logs.filter((x: any) => x.meal === k); if (!rows.length) return null; return (
          <div key={k} className="mb-3"><h3 className="font-bold text-sm mb-1">{l} <span className="text-mute font-normal">{fmt(rows.reduce((a: number, x: any) => a + x.kcal, 0))} kcal</span></h3>
            {rows.map((x: any) => (
              <div key={x.id} className="flex items-center justify-between text-sm py-1.5 border-t border-line">
                <div><p>{x.name} <span className="text-mute">· {fmt(x.grams, 1)} g</span> {x.estimated && <Pill tone="warn">estimated</Pill>}</p><p className="text-xs text-mute">{fmt(x.kcal)} kcal · P {fmt(x.protein, 1)} · C {fmt(x.carbs, 1)} · F {fmt(x.fat, 1)}</p></div>
                <div className="flex gap-1">
                  <button aria-label="Edit grams" onClick={async () => { const g = prompt("Grams", String(x.grams)); if (g && Number(g) > 0) { await p(`/log/foods/${x.id}`, { method: "PATCH", body: { grams: Number(g) } }); load(); } }}><Pencil size={15} /></button>
                  <button aria-label="Delete entry" onClick={async () => { await p(`/log/foods/${x.id}`, { method: "DELETE" }); load(); }}><Trash2 size={15} /></button>
                </div>
              </div>))}
          </div>); })}
      </Card>
    </div>
  );
}

function FoodRow({ f, onAdd }: { f: any; onAdd: (f: any, g: number, u: string, q: number) => void }) {
  const units = Object.keys(f.units || {});
  const [qty, setQty] = useState(units.length ? 1 : 100);
  const [unit, setUnit] = useState(units[0] || "g");
  const grams = unit === "g" ? qty : (f.units[unit] ?? 0) * qty;
  return (
    <div className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="min-w-[10rem]"><p className="font-semibold">{f.name} {f.profileId && <Pill>custom</Pill>}</p>
        <p className="text-xs text-mute">Per 100 g: {f.kcal} kcal · P {f.protein} · C {f.carbs} · F {f.fat} · Fiber {f.fiber}{units.length ? ` · ${units.map((u) => `1 ${u} ≈ ${f.units[u]} g`).slice(0, 2).join(", ")}` : ""}</p></div>
      <div className="flex gap-1.5 items-center">
        <input aria-label="Quantity" className="!w-20" type="number" min="0" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        <select aria-label="Unit" className="!w-24" value={unit} onChange={(e) => setUnit(e.target.value)}><option value="g">g</option>{units.map((u) => <option key={u}>{u}</option>)}</select>
        <Btn variant="ghost" disabled={!(grams > 0)} onClick={() => onAdd(f, grams, unit, qty)}>Add</Btn>
      </div>
    </div>
  );
}

function CustomFood({ onSaved }: { onSaved: () => void }) {
  const { p, toast } = useApp();
  const [v, setV] = useState<any>({ name: "", kcal: "", protein: "", carbs: "", fat: "", fiber: "0", servingName: "serving", servingGrams: "", diet: "veg" });
  const [err, setErr] = useState("");
  const k = (key: string) => ({ value: v[key], onChange: (e: any) => setV({ ...v, [key]: e.target.value }) });
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-sm text-mute mb-2">Enter values per 100 g from the package label.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Field label="Name"><input {...k("name")} /></Field><Field label="kcal"><input type="number" {...k("kcal")} /></Field>
        <Field label="Protein g"><input type="number" {...k("protein")} /></Field><Field label="Carbs g"><input type="number" {...k("carbs")} /></Field>
        <Field label="Fat g"><input type="number" {...k("fat")} /></Field><Field label="Fiber g"><input type="number" {...k("fiber")} /></Field>
        <Field label="Serving name"><input {...k("servingName")} /></Field><Field label="Serving grams"><input type="number" {...k("servingGrams")} /></Field>
      </div>
      <Btn className="mt-3" onClick={async () => { try { await p("/foods", { body: { ...v, servingGrams: v.servingGrams || undefined } }); toast("Custom food saved"); onSaved(); } catch (e: any) { setErr(e.message); } }}>Save food</Btn><Err msg={err} />
    </div>
  );
}
