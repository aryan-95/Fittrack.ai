import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../api";
import { useApp } from "../ctx";
import { Btn, Err, Field } from "../ui";

const schema = z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(8, "Use at least 8 characters") });

export default function AuthPage({ mode }: { mode: "login" | "register" | "forgot" | "reset" }) {
  const { reload } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [err, setErr] = useState(""); const [info, setInfo] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string; password: string }>({ resolver: zodResolver(mode === "forgot" ? schema.pick({ email: true }) : mode === "reset" ? schema.pick({ password: true }) : schema) as any });
  const title = { login: "Sign in", register: "Create your account", forgot: "Reset your password", reset: "Choose a new password" }[mode];

  const submit = handleSubmit(async (v) => {
    setErr("");
    try {
      if (mode === "forgot") { await api("/auth/forgot", { body: { email: v.email } }); setInfo("If that email has an account, a reset link is on its way."); return; }
      if (mode === "reset") { await api("/auth/reset", { body: { token: sp.get("token"), password: v.password } }); nav("/login"); return; }
      await api(`/auth/${mode}`, { body: v }); await reload(); nav("/dashboard");
    } catch (e: any) { setErr(e.message); }
  });

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={submit} className="bg-white border border-line rounded-2xl p-6 w-full max-w-sm space-y-4" noValidate>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {mode !== "reset" && <Field label="Email"><input type="email" autoComplete="email" {...register("email")} /><Err msg={errors.email?.message} /></Field>}
        {mode !== "forgot" && <Field label="Password"><input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} {...register("password")} /><Err msg={errors.password?.message} /></Field>}
        <Err msg={err} />{info && <p className="text-sm text-plate-dark">{info}</p>}
        <Btn type="submit" disabled={isSubmitting} className="w-full">{title}</Btn>
        <div className="text-sm text-mute flex justify-between">
          {mode === "login" ? <><Link to="/register" className="underline">Create account</Link><Link to="/forgot" className="underline">Forgot password?</Link></> : <Link to="/login" className="underline">Back to sign in</Link>}
        </div>
      </form>
    </div>
  );
}
