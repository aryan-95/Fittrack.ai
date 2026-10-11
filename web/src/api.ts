export class ApiError extends Error {}
export async function api<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const r = await fetch("/api" + path, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(data.error || `Request failed (${r.status})`);
  return data;
}
export const todayIn = (tz: string) => new Date().toLocaleDateString("en-CA", { timeZone: tz });
export const addDays = (d: string, n: number) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const fmt = (n: number, d = 0) => Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MEALS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snacks"], ["pre_workout", "Pre-workout"], ["post_workout", "Post-workout"], ["custom", "Custom meal"]] as const;
