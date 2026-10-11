import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../api";
import { useApp } from "../ctx";
import { Btn, Card, Err, Field, H } from "../ui";

const schema = z.object({
  name: z.string().min(1, "Enter a name"),
  age: z.coerce.number().int().min(14, "Minimum age is 14").max(100),
  heightCm: z.coerce.number().min(100, "Height in cm").max(250),
  weightKg: z.coerce.number().min(30).max(300),
  sex: z.enum(["", "male", "female"]).optional(),
  activityLevel: z.string(), avgSteps: z.coerce.number().min(0).max(50000).optional().or(z.literal("")),
  experience: z.string(), trainingDays: z.coerce.number().int().min(1).max(7), workoutMins: z.coerce.number().int().min(15).max(180),
  dietPref: z.string(), allergies: z.string().optional(), goal: z.string(),
  targetWeightKg: z.coerce.number().optional().or(z.literal("")),
  timezone: z.string(),
});
type V = z.infer<typeof schema>;

export default function Wizard({ first = false }: { first?: boolean }) {
  const { reload, setProfileId, toast } = useApp();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<any>(null);
  const [manual, setManual] = useState<any>(null);
  const [err, setErr] = useState("");
  const { register, handleSubmit, getValues, trigger, formState: { errors } } = useForm<V>({
    resolver: zodResolver(schema) as any,
    defaultValues: { activityLevel: "moderate", experience: "beginner", trainingDays: 4, workoutMins: 60, dietPref: "nonveg", goal: "recomp", sex: "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  });

  const clean = (v: any) => ({ ...v, sex: v.sex || null, avgSteps: v.avgSteps === "" ? null : v.avgSteps, targetWeightKg: v.targetWeightKg === "" ? null : v.targetWeightKg });

  const next = async () => {
    const fields: (keyof V)[][] = [["name", "age", "heightCm", "weightKg", "sex"], ["activityLevel", "experience", "trainingDays", "workoutMins", "dietPref", "goal"]];
    if (!(await trigger(fields[step]))) return;
    if (step === 1) {
      try { const pv = await api("/targets/preview", { body: clean(getValues()) }); setPreview(pv); setManual({ kcalTarget: pv.kcalTarget, proteinTarget: pv.proteinTarget, carbTarget: pv.carbTarget, fatTarget: pv.fatTarget, fiberTarget: pv.fiberTarget, waterTargetMl: pv.waterTargetMl }); }
      catch (e: any) { setErr(e.message); return; }
    }
    setStep(step + 1);
  };

  const save = handleSubmit(async (v) => {
    try {
      const prof = await api("/profiles", { body: clean(v) });
      const edited = preview && Object.keys(manual).some((k) => Number(manual[k]) !== preview[k]);
      if (edited) await api(`/profiles/${prof.id}`, { method: "PATCH", body: { targets: manual } });
      setProfileId(prof.id); await reload(); toast("Profile created"); nav("/dashboard");
    } catch (e: any) { setErr(e.message); }
  });

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8">
      <H sub={`Step ${step + 1} of 3`}>{first ? "Set up your profile" : "Add a profile"}</H>
      <form onSubmit={save} noValidate>
        {step === 0 && <Card><div className="grid sm:grid-cols-2 gap-4">
          <Field label="Display name"><input {...register("name")} /><Err msg={errors.name?.message} /></Field>
          <Field label="Age"><input type="number" {...register("age")} /><Err msg={errors.age?.message} /></Field>
          <Field label="Height" hint="cm"><input type="number" step="0.1" {...register("heightCm")} /><Err msg={errors.heightCm?.message} /></Field>
          <Field label="Weight" hint="kg"><input type="number" step="0.1" {...register("weightKg")} /><Err msg={errors.weightKg?.message} /></Field>
          <Field label="Sex" hint="optional, only used in the calorie formula"><select {...register("sex")}><option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option></select></Field>
          <Field label="Target weight" hint="kg, optional"><input type="number" step="0.1" {...register("targetWeightKg")} /></Field>
        </div></Card>}
        {step === 1 && <Card><div className="grid sm:grid-cols-2 gap-4">
          <Field label="Primary goal"><select {...register("goal")}><option value="fatloss">Fat loss</option><option value="muscle">Muscle gain</option><option value="recomp">Body recomposition</option><option value="maintain">Maintenance</option></select></Field>
          <Field label="Activity level"><select {...register("activityLevel")}><option value="sedentary">Sedentary</option><option value="light">Light (1-3 workouts/week)</option><option value="moderate">Moderate (3-5)</option><option value="active">Active (6-7)</option><option value="very_active">Very active</option></select></Field>
          <Field label="Average daily steps" hint="optional"><input type="number" {...register("avgSteps")} /></Field>
          <Field label="Gym experience"><select {...register("experience")}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></Field>
          <Field label="Training days per week"><input type="number" {...register("trainingDays")} /><Err msg={errors.trainingDays?.message} /></Field>
          <Field label="Workout length" hint="minutes"><input type="number" {...register("workoutMins")} /></Field>
          <Field label="Diet"><select {...register("dietPref")}><option value="veg">Vegetarian</option><option value="egg">Vegetarian with eggs</option><option value="nonveg">Non-vegetarian</option></select></Field>
          <Field label="Allergies / restrictions" hint="comma separated"><input placeholder="peanut, lactose" {...register("allergies")} /></Field>
          <Field label="Timezone"><input {...register("timezone")} /></Field>
        </div></Card>}
        {step === 2 && preview && manual && <Card>
          <h3 className="font-extrabold text-lg">Your starting targets</h3>
          <p className="text-sm text-mute mb-3">These are estimates. Edit any number to set your own.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {([["kcalTarget", "Calories (kcal)"], ["proteinTarget", "Protein (g)"], ["carbTarget", "Carbs (g)"], ["fatTarget", "Fat (g)"], ["fiberTarget", "Fiber (g)"], ["waterTargetMl", "Water (ml)"]] as const).map(([k, l]) => (
              <Field key={k} label={l}><input type="number" value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: e.target.value })} /></Field>
            ))}
          </div>
          <div className="mt-4 text-sm bg-chalk rounded-lg p-3 space-y-1">
            <p><b>Formula:</b> {preview.assumptions.formula}</p>
            <p>Resting energy ≈ {preview.assumptions.bmr} kcal × {preview.assumptions.activityMultiplier} activity = <b>{preview.assumptions.maintenance} kcal</b> maintenance; goal adjustment {preview.assumptions.goalAdjustmentKcal} kcal.</p>
            <p>Protein {preview.assumptions.proteinPerKg} g/kg · fat {preview.assumptions.fatShare} · fiber {preview.assumptions.fiber}.</p>
            <p className="text-mute">{preview.assumptions.confidence}</p>
            {preview.assumptions.notes.map((n: string) => <p key={n} className="text-lift">{n}</p>)}
          </div>
        </Card>}
        <Err msg={err} />
        <div className="flex gap-2 mt-4">
          {step > 0 && <Btn type="button" variant="ghost" onClick={() => setStep(step - 1)}>Back</Btn>}
          {step < 2 ? <Btn type="button" onClick={next}>Continue</Btn> : <Btn type="submit">Create profile</Btn>}
          {!first && step === 0 && <Btn type="button" variant="ghost" onClick={() => nav("/dashboard")}>Cancel</Btn>}
        </div>
      </form>
    </div>
  );
}
