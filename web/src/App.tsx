import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Activity, Apple, Bell, CalendarDays, Dumbbell, Droplets, Home, LineChart, ListChecks, LogOut, Plus, Settings as Cog, Library, History as Hist } from "lucide-react";
import { useApp } from "./ctx";
import { api } from "./api";
import Landing from "./pages/Landing";
import AuthPage from "./pages/Auth";
import Wizard from "./pages/Wizard";
import Dashboard from "./pages/Dashboard";
import Workout from "./pages/Workout";
import Exercises from "./pages/Exercises";
import Planner from "./pages/Planner";
import HistoryPage from "./pages/History";
import Food from "./pages/Food";
import Nutrition from "./pages/Nutrition";
import Progress from "./pages/Progress";
import Habits from "./pages/Habits";
import Reminders from "./pages/Reminders";
import SettingsPage from "./pages/Settings";

const NAV = [
  ["/dashboard", "Today", Home], ["/workout", "Workout", Dumbbell], ["/food", "Log food", Apple], ["/nutrition", "Nutrition", Activity],
  ["/progress", "Progress", LineChart], ["/habits", "Water & steps", Droplets], ["/planner", "Weekly plan", CalendarDays],
  ["/exercises", "Exercises", Library], ["/history", "History", Hist], ["/notifications", "Reminders", Bell], ["/settings", "Goals & profile", Cog],
] as const;

function beep() {
  try { const c = new AudioContext(); const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = 0.08; o.start(); o.stop(c.currentTime + 0.18); } catch {}
}

function Shell() {
  const { profiles, profile, setProfileId, p, reload } = useApp();
  const nav = useNavigate();
  const seen = useRef<Set<string>>(new Set());
  const [unread, setUnread] = useState(0);

  // While the app is open: poll for new notifications, show a browser notification + beep.
  useEffect(() => {
    if (!profile) return;
    let first = true;
    const tick = async () => {
      try {
        const list = await p("/notifications");
        setUnread(list.filter((n: any) => !n.readAt).length);
        for (const n of list) {
          if (!seen.current.has(n.id)) {
            seen.current.add(n.id);
            if (!first && !n.readAt) {
              beep();
              if ("Notification" in window && Notification.permission === "granted") new Notification(n.title, { body: n.body });
            }
          }
        }
        first = false;
      } catch {}
    };
    tick(); const t = setInterval(tick, 30000); return () => clearInterval(t);
  }, [profile?.id]);

  return (
    <div className="min-h-screen md:flex">
      <aside className="md:w-60 md:min-h-screen bg-iron text-white p-4 md:sticky md:top-0 md:h-screen md:overflow-auto">
        <div className="flex items-center justify-between md:block">
          <p className="font-display text-2xl font-black" style={{ fontStretch: "80%" }}>FitTrack AI</p>
          <div className="flex items-center gap-2 md:mt-3">
            <select aria-label="Active profile" value={profile?.id} onChange={(e) => e.target.value === "__new" ? nav("/profiles/new") : setProfileId(e.target.value)} className="!bg-white/10 !border-white/20 !text-white text-sm">
              {profiles.map((x) => <option key={x.id} value={x.id} className="text-iron">{x.name}</option>)}
              <option value="__new" className="text-iron">+ Add profile</option>
            </select>
          </div>
        </div>
        <nav className="mt-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1">
          {NAV.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? "bg-plate text-white" : "text-white/75 hover:bg-white/10"}`}>
              <Icon size={16} />{label}{to === "/notifications" && unread > 0 && <span className="ml-auto bg-signal text-iron text-xs rounded-full px-1.5">{unread}</span>}
            </NavLink>
          ))}
          <button onClick={async () => { await api("/auth/logout", { method: "POST" }); await reload(); nav("/"); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white/75 hover:bg-white/10 whitespace-nowrap"><LogOut size={16} />Sign out</button>
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8 max-w-5xl w-full">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/food" element={<Food />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/notifications" element={<Reminders />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profiles/new" element={<Wizard />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading, profile } = useApp();
  if (loading) return <p className="p-8 text-mute">Loading…</p>;
  if (!user) return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/forgot" element={<AuthPage mode="forgot" />} />
      <Route path="/reset" element={<AuthPage mode="reset" />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
  if (!profile) return <Routes><Route path="*" element={<Wizard first />} /></Routes>;
  return <Shell />;
}
