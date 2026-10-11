import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../ctx";
import { Btn, Card, Err, Field, H } from "../ui";

export default function Settings() {
  const { p, profile, reload, toast } = useApp();
  const nav = useNavigate();
  const [v, setV] = useState<any>({ ...profile });
  const [t, setT] = useState<any>({ kcalTarget: profile.kcalTarget, proteinTarget: profile.proteinTarget, carbTarget: profile.carbTarget, fatTarget: profile.fatTarget, fiberTarget: profile.fiberTarget, waterTargetMl: profile.waterTargetMl });
  const [err, setErr] = useState("");
  const a = profile.assumptions;
  const k = (key: string) => ({ value: v[key] ?? "", onChange: (e: any) => setV({ ...v, [key]: e.target.value }) });

  const saveProfile = async () => {
    setErr("");
    try {
      const body = { name: v.name, age: v.age, heightCm: v.heightCm, weightKg: v.weightKg, sex: v.sex || null, activityLevel: v.activityLevel, avgSteps: v.avgSteps === "" ? null : v.avgSteps, experience: v.experience, trainingDays: v.trainingDays, workoutMins: v.workoutMins, dietPref: v.dietPref, allergies: v.allergies, goal: v.goal, timezone: v.timezone, quietStart: v.quietStart, quietEnd: v.quietEnd, targetWeightKg: v.targetWeightKg === "" ? null : v.targetWeightKg };
      await p("", { method: "PATCH", body }); await reload(); toast("Profile saved");
    } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="space-y-4">
      <H>Goals and profile</H>
      <Card>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Name"><input {...k("name")} /></Field><Field label="Age"><input type="number" {...k("age")} /></Field><Field label="Height (cm)"><input type="number" {...k("heightCm")} /></Field>
          <Field label="Weight (kg)"><input type="number" step="0.1" {...k("weightKg")} /></Field>
          <Field label="Sex" hint="optional"><select {...k("sex")}><option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option></select></Field>
          <Field label="Goal"><select {...k("goal")}><option value="fatloss">Fat loss</option><option value="muscle">Muscle gain</option><option value="recomp">Recomposition</option><option value="maintain">Maintenance</option></select></Field>
          <Field label="Activity"><select {...k("activityLevel")}><option value="sedentary">Sedentary</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="active">Active</option><option value="very_active">Very active</option></select></Field>
          <Field label="Avg daily steps"><input type="number" {...k("avgSteps")} /></Field>
          <Field label="Experience"><select {...k("experience")}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></Field>
          <Field label="Training days/week"><input type="number" {...k("trainingDays")} /></Field><Field label="Workout minutes"><input type="number" {...k("workoutMins")} /></Field>
          <Field label="Diet"><select {...k("dietPref")}><option value="veg">Vegetarian</option><option value="egg">Vegetarian + eggs</option><option value="nonveg">Non-vegetarian</option></select></Field>
          <Field label="Allergies"><input {...k("allergies")} /></Field><Field label="Target weight (kg)"><input type="number" {...k("targetWeightKg")} /></Field>
          <Field label="Timezone"><input {...k("timezone")} /></Field><Field label="Quiet hours start"><input type="time" {...k("quietStart")} /></Field><Field label="Quiet hours end"><input type="time" {...k("quietEnd")} /></Field>
        </div>
        <Btn className="mt-3" onClick={saveProfile}>Save profile</Btn><Err msg={err} />
        {!profile.manualTargets && <p className="text-xs text-mute mt-2">Changing weight, activity, goal or similar recalculates your targets automatically.</p>}
        {profile.manualTargets && <p className="text-xs text-mute mt-2">You set your targets manually, so they won't change automatically. Use “Recalculate” below to reset them.</p>}
      </Card>
      <Card>
        <h2 className="font-extrabold text-lg">Daily targets</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
          {([["kcalTarget", "Calories"], ["proteinTarget", "Protein g"], ["carbTarget", "Carbs g"], ["fatTarget", "Fat g"], ["fiberTarget", "Fiber g"], ["waterTargetMl", "Water ml"]] as const).map(([key, l]) => <Field key={key} label={l}><input type="number" value={t[key]} onChange={(e) => setT({ ...t, [key]: e.target.value })} /></Field>)}
        </div>
        <div className="flex gap-2 mt-3"><Btn onClick={async () => { try { await p("", { method: "PATCH", body: { targets: t } }); await reload(); toast("Targets saved"); } catch (e: any) { setErr(e.message); } }}>Save my targets</Btn>
          <Btn variant="ghost" onClick={async () => { await p("", { method: "PATCH", body: { recalculate: true } }); await reload(); toast("Targets recalculated"); setTimeout(() => location.reload(), 300); }}>Recalculate from profile</Btn></div>
        {a && <div className="mt-4 text-sm bg-chalk rounded-lg p-3 space-y-1">
          <p><b>How these were estimated.</b> {a.formula}. Resting ≈ {a.bmr} kcal × {a.activityMultiplier} = {a.maintenance} kcal maintenance, goal adjustment {a.goalAdjustmentKcal} kcal.</p>
          <p>Protein {a.proteinPerKg} g/kg · fat {a.fatShare} · fiber {a.fiber}.</p>
          <p className="text-mute">{a.confidence}</p>{a.notes?.map((n: string) => <p key={n} className="text-lift">{n}</p>)}
        </div>}
      </Card>
      <Card>
        <h2 className="font-extrabold text-lg mb-2">Your data</h2>
        <div className="flex gap-2 flex-wrap">
          <a href={`/api/profiles/${profile.id}/export`}><Btn variant="ghost">Export this profile (JSON)</Btn></a>
          <Btn variant="danger" onClick={async () => { if (confirm(`Delete the profile “${profile.name}” and all its data? This can't be undone.`)) { await p("", { method: "DELETE" }); await reload(); nav("/dashboard"); } }}>Delete profile</Btn>
        </div>
      </Card>
    </div>
  );
}
