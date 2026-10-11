import { Link } from "react-router-dom";
import { Dumbbell, Apple, Bell, LineChart } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-iron text-white">
      <header className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
        <span className="font-display text-2xl font-black" style={{ fontStretch: "80%" }}>FitTrack AI</span>
        <div className="flex gap-2"><Link to="/login" className="px-3 py-2 text-sm font-semibold">Sign in</Link><Link to="/register" className="px-3 py-2 text-sm font-semibold bg-plate rounded-lg">Create account</Link></div>
      </header>
      <section className="max-w-5xl mx-auto px-4 pt-10 pb-16">
        <h1 className="font-display font-black text-5xl md:text-7xl leading-[0.95]" style={{ fontStretch: "75%" }}>Your training log and food diary,<br />in one place.</h1>
        <p className="mt-5 max-w-xl text-white/75 text-lg">Follow a push/pull/legs split, log every set, type what you ate in plain words, and see exactly how many calories and grams of protein you have left today.</p>
        <Link to="/register" className="inline-block mt-7 bg-signal text-iron font-bold px-5 py-3 rounded-lg">Start tracking</Link>
        <div className="grid sm:grid-cols-2 gap-4 mt-14">
          {[[Dumbbell, "Workouts that remember", "Sets, weights and notes are saved as you go, with personal records flagged automatically."], [Apple, "Type your meals", "“200 g paneer, 3 slices bread” becomes a reviewed, editable nutrition entry."], [LineChart, "Trends, not noise", "Weekly averages keep daily weight swings in perspective."], [Bell, "Reminders that don't nag", "Quiet hours, snooze, and no duplicates. Never marks a workout done for you."]].map(([I, t, d]: any) => (
            <div key={t} className="border border-white/15 rounded-xl p-4"><I size={20} className="text-signal" /><h3 className="font-extrabold text-xl mt-2">{t}</h3><p className="text-white/70 text-sm mt-1">{d}</p></div>
          ))}
        </div>
        <p className="text-xs text-white/50 mt-10 max-w-xl">Calorie and macro targets are estimates, not medical advice. Talk to a clinician before starting a new diet or training programme if you have a health condition.</p>
      </section>
    </div>
  );
}
