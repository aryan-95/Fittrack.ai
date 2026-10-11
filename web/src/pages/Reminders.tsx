import { useEffect, useState } from "react";
import { Bell, Plus, Trash2 } from "lucide-react";
import { useApp } from "../ctx";
import { api, WEEKDAYS } from "../api";
import { Btn, Card, Empty, H, Pill } from "../ui";

const TYPES = [["workout_soon", "Workout starting soon"], ["workout_now", "Workout starting now"], ["workout_missed", "Planned workout still open"], ["meal", "Meal logging"], ["protein", "Protein progress"], ["water", "Water"], ["steps", "Steps"], ["weight", "Weight check-in"], ["sleep", "Sleep and recovery"], ["weekly", "Weekly progress report"]];

const b64 = (s: string) => { const pad = "=".repeat((4 - (s.length % 4)) % 4); const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };

export default function Reminders() {
  const { p, toast } = useApp();
  const [rem, setRem] = useState<any[]>([]); const [notes, setNotes] = useState<any[]>([]);
  const [perm, setPerm] = useState("Notification" in window ? Notification.permission : "unsupported");
  const load = () => { p("/reminders").then(setRem); p("/notifications").then(setNotes); };
  useEffect(() => { load(); }, []);
  const patch = async (id: string, body: any) => { await p(`/reminders/${id}`, { method: "PATCH", body }); load(); };

  const enableBrowser = async () => {
    if (!("Notification" in window)) return toast("This browser doesn't support notifications");
    const r = await Notification.requestPermission(); setPerm(r);
    if (r !== "granted") return;
    try {
      const k = await p("/push/key");
      if (k.enabled && "serviceWorker" in navigator && "PushManager" in window) {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(k.key) });
        await p("/push/subscribe", { body: sub.toJSON() }); toast("Push notifications enabled");
      } else toast("Browser notifications on. Background push needs VAPID keys on the server.");
    } catch (e: any) { toast("Couldn't enable push: " + e.message); }
  };

  const act = async (n: any, a: any) => {
    if (a.id === "snooze") await p(`/notifications/${n.id}/snooze`, { body: { reminderId: a.reminderId, minutes: 10 } });
    if (a.id === "skip") await p("/session/skip", { body: {} });
    if (a.id === "reschedule") { const w = new Date().getDay(); await p("/plan/swap", { body: { a: w, b: (w + 1) % 7 } }); toast("Moved to tomorrow"); }
    if (a.id === "start") location.href = "/workout";
    if (a.id === "log") location.href = "/food";
    if (a.id === "water") { await p(`/daily/${new Date().toLocaleDateString("en-CA")}/water`, { body: { ml: 250 } }); toast("+250 ml"); }
    await p("/notifications/read-all", { method: "POST" }); load();
  };

  return (
    <div className="space-y-4">
      <H>Reminders and notifications</H>
      <Card>
        <p className="text-sm"><b>How delivery works.</b> In-app notifications always work while the app is open. Browser notifications need your permission. Background Web Push works on supported browsers when the server has VAPID keys. A website cannot guarantee an alarm when the browser is closed or the phone restricts background activity. For alarm-clock reliability on a phone, a native Android app with scheduled alarms is the right tool.</p>
        <div className="flex gap-2 flex-wrap mt-3 items-center">
          <Btn onClick={enableBrowser}><Bell size={14} />Enable browser notifications</Btn>
          <Btn variant="ghost" onClick={async () => { await p("/reminders/test", { method: "POST" }); load(); toast("Test sent"); }}>Send test</Btn>
          <Pill tone={perm === "granted" ? "good" : "plain"}>Permission: {perm}</Pill>
        </div>
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-2"><h2 className="font-extrabold text-lg">Inbox</h2><Btn variant="ghost" onClick={async () => { await p("/notifications/read-all", { method: "POST" }); load(); }}>Mark all read</Btn></div>
        {notes.length === 0 ? <Empty>No notifications yet.</Empty> : <div className="divide-y divide-line">{notes.slice(0, 12).map((n) => (
          <div key={n.id} className="py-2"><p className={`text-sm ${n.readAt ? "text-mute" : "font-semibold"}`}>{n.title}</p><p className="text-sm text-mute">{n.body}</p>
            <p className="text-xs text-mute">{new Date(n.createdAt).toLocaleString()}</p>
            {!n.readAt && Array.isArray(n.actions) && <div className="flex gap-2 mt-1.5 flex-wrap">{n.actions.map((a: any) => <Btn key={a.id} variant="ghost" onClick={() => act(n, a)}>{a.label}</Btn>)}</div>}
          </div>))}</div>}
      </Card>

      <Card>
        <h2 className="font-extrabold text-lg mb-2">Schedules</h2>
        <p className="text-xs text-mute mb-3">Times use your profile timezone. Reminders skip quiet hours, never repeat on the same day, and never mark anything complete for you.</p>
        <div className="space-y-3">{rem.map((r) => (
          <div key={r.id} className="border border-line rounded-lg p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <input aria-label="Label" className="!w-52" defaultValue={r.label} onBlur={(e) => e.target.value !== r.label && patch(r.id, { label: e.target.value })} />
              <input aria-label="Time" type="time" className="!w-32" defaultValue={r.time} onBlur={(e) => e.target.value !== r.time && patch(r.id, { time: e.target.value })} />
              <label className="text-sm flex items-center gap-1 ml-auto"><input type="checkbox" checked={r.enabled} onChange={(e) => patch(r.id, { enabled: e.target.checked })} />On</label>
              <button aria-label="Delete reminder" onClick={async () => { await p(`/reminders/${r.id}`, { method: "DELETE" }); load(); }}><Trash2 size={15} /></button>
            </div>
            <div className="flex gap-1 mt-2 flex-wrap items-center">{WEEKDAYS.map((d, i) => (
              <button key={d} aria-pressed={r.days.includes(i)} onClick={() => patch(r.id, { days: r.days.includes(i) ? r.days.filter((x: number) => x !== i) : [...r.days, i] })} className={`text-xs rounded-full px-2 py-1 border ${r.days.includes(i) ? "bg-plate text-white border-plate" : "border-line"}`}>{d.slice(0, 3)}</button>))}
              <span className="text-xs text-mute ml-2">{TYPES.find((t) => t[0] === r.type)?.[1]}</span></div>
          </div>))}</div>
        <Btn variant="ghost" className="mt-3" onClick={async () => { await p("/reminders", { body: { type: "water", label: "New reminder", time: "12:00", days: [0, 1, 2, 3, 4, 5, 6], enabled: true } }); load(); }}><Plus size={14} />Add reminder</Btn>
      </Card>
    </div>
  );
}
