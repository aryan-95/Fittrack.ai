import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "./api";

type Ctx = {
  user: any | null; loading: boolean; profiles: any[]; profile: any | null;
  setProfileId: (id: string) => void; reload: () => Promise<void>;
  p: (path: string, opts?: { method?: string; body?: any }) => Promise<any>;
  toast: (msg: string) => void;
};
const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [pid, setPid] = useState<string | null>(localStorage.getItem("pid"));
  const [msg, setMsg] = useState("");

  const reload = useCallback(async () => {
    try {
      const u = await api("/auth/me"); setUser(u);
      setProfiles(await api("/profiles"));
    } catch { setUser(null); setProfiles([]); }
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const profile = profiles.find((x) => x.id === pid) ?? profiles[0] ?? null;
  const setProfileId = (id: string) => { localStorage.setItem("pid", id); setPid(id); };
  const p = (path: string, opts: any = {}) => api(`/profiles/${profile.id}${path}`, opts);
  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  return (
    <C.Provider value={{ user, loading, profiles, profile, setProfileId, reload, p, toast }}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">{msg && <div className="bg-iron text-white text-sm px-4 py-2 rounded-lg shadow-lg">{msg}</div>}</div>
    </C.Provider>
  );
}
