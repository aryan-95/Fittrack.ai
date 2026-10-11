import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <section className={`bg-white border border-line rounded-xl p-4 ${className}`}>{children}</section>
);
export const H = ({ children, sub }: { children: ReactNode; sub?: ReactNode }) => (
  <div className="mb-3"><h2 className="text-xl font-extrabold">{children}</h2>{sub && <p className="text-sm text-mute mt-0.5">{sub}</p>}</div>
);
export function Btn({ children, variant = "primary", className = "", ...r }: any) {
  const v = variant === "primary" ? "bg-plate text-white hover:bg-plate-dark" : variant === "danger" ? "bg-lift text-white" : "bg-white border border-line hover:bg-chalk";
  return <button {...r} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold disabled:opacity-50 ${v} ${className}`}>{children}</button>;
}
export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="block text-sm"><span className="font-semibold">{label}</span>{hint && <span className="text-mute"> · {hint}</span>}<div className="mt-1">{children}</div></label>
);
export function Bar({ value, max, over = false, color }: { value: number; max: number; over?: boolean; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2.5 rounded-full bg-chalk overflow-hidden" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={Math.round(max)}>
      <div className={`h-full rounded-full ${over ? "bg-lift" : color || "bg-plate"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 bg-iron/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-label={title} className={`bg-white w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[90vh] overflow-auto rounded-t-2xl sm:rounded-2xl p-5`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3"><h2 className="text-xl font-extrabold">{title}</h2><button aria-label="Close" onClick={onClose}><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}
export const Err = ({ msg }: { msg?: string }) => (msg ? <p role="alert" className="text-sm text-lift mt-2">{msg}</p> : null);
export const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-mute py-6 text-center">{children}</p>;
export const Pill = ({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "good" | "warn" | "bad" }) => {
  const c = { plain: "bg-chalk text-mute", good: "bg-plate-light text-plate-dark", warn: "bg-signal/20 text-iron", bad: "bg-lift/15 text-lift" }[tone];
  return <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${c}`}>{children}</span>;
};
export function Macro({ label, unit, d }: { label: string; unit: string; d: { target: number; consumed: number; remaining: number; over: number } }) {
  return (
    <div>
      <div className="flex justify-between items-baseline text-sm"><span className="font-semibold">{label}</span><span className="text-mute">{Math.round(d.consumed)} / {d.target} {unit}</span></div>
      <Bar value={d.consumed} max={d.target} over={d.over > 0} />
      <p className="text-xs mt-1 text-mute">{d.over > 0 ? <span className="text-lift font-semibold">{Math.round(d.over)} {unit} over target</span> : <>{Math.round(d.remaining)} {unit} remaining</>}</p>
    </div>
  );
}
export const STATUS: Record<string, [string, "plain" | "good" | "warn" | "bad"]> = {
  not_started: ["Not started", "plain"], in_progress: ["In progress", "warn"], completed: ["Completed", "good"], over_target: ["Over target", "bad"], no_log: ["No log", "plain"],
};
