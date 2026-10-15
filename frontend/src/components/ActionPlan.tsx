import { useMemo, useState } from 'react'
import { Apple, Dumbbell, Download, Info, ShieldAlert } from 'lucide-react'
import { buildFuelPlan, type FuelProfile, type TrainingIntensity } from '../lib/nutrition'
import { planForMetrics } from '../lib/training'
import type { Metric } from '../types'

export function ActionPlan({ metrics }: { metrics: Metric[] }) {
  const drills = useMemo(() => planForMetrics(metrics), [metrics])
  const [profile, setProfile] = useState<FuelProfile>({ heightCm: 170, weightKg: 65, intensity: 'moderate', durationMinutes: 60 })
  const plan = useMemo(() => buildFuelPlan(profile), [profile])
  const updateNumber = (key: 'heightCm' | 'weightKg' | 'durationMinutes', value: string) => {
    const next = Number(value)
    if (Number.isFinite(next) && next > 0) setProfile((current) => ({ ...current, [key]: next }))
  }
  const exportPlan = () => {
    const file = new Blob([JSON.stringify({ profile, fuelPlan: plan, drills }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href = url; link.download = 'stridewise-running-action-plan.json'; link.click(); URL.revokeObjectURL(url)
  }

  return <section className="action-plan">
    <div className="action-heading"><div><span className="eyebrow">PRACTISE & FUEL</span><h2>Your next 2-week focus</h2><p>These drills are selected from the weaker form signals in this report. Keep all work comfortable and pain-free.</p></div><button className="secondary compact" onClick={exportPlan}><Download size={16} /> Export action plan</button></div>
    <div className="drill-grid">{drills.map((drill) => <article className="drill-card" key={drill.id}><Dumbbell size={19} /><div><span>{drill.focus}</span><h3>{drill.title}</h3><p><b>{drill.dose}</b> · {drill.frequency}</p><small>{drill.cue}</small></div></article>)}</div>
    <div className="nutrition-panel"><div className="nutrition-intro"><Apple size={22} /><span className="eyebrow">RUNNER FUEL PLANNER</span><h2>Fuel the training load,<br /><em>not the form score.</em></h2><p>Uses session intensity, duration, and body mass to provide a general starting point. Height is kept as profile context; no calorie or weight-loss prescription is made.</p></div>
      <div className="fuel-form">
        <label>Height <div><input aria-label="Height in centimetres" type="number" min="120" max="230" value={profile.heightCm} onChange={(event) => updateNumber('heightCm', event.target.value)} /><span>cm</span></div></label>
        <label>Weight <div><input aria-label="Weight in kilograms" type="number" min="30" max="200" value={profile.weightKg} onChange={(event) => updateNumber('weightKg', event.target.value)} /><span>kg</span></div></label>
        <label>Session duration <div><input aria-label="Session duration in minutes" type="number" min="15" max="300" value={profile.durationMinutes} onChange={(event) => updateNumber('durationMinutes', event.target.value)} /><span>min</span></div></label>
        <fieldset><legend>Training intensity</legend><div className="intensity-buttons">{(['easy', 'moderate', 'hard'] as TrainingIntensity[]).map((intensity) => <button type="button" className={profile.intensity === intensity ? 'selected' : ''} onClick={() => setProfile((current) => ({ ...current, intensity }))} key={intensity}>{intensity}</button>)}</div></fieldset>
      </div>
      <div className="fuel-results"><div className="macro"><span>Daily carbohydrate</span><strong>{plan.carbohydrate}</strong><small>Training-day starting range</small></div><div className="macro"><span>Daily protein</span><strong>{plan.protein}</strong><small>Training-day starting range</small></div><div className="fuel-copy"><span className="eyebrow">{plan.session}</span><p><b>Before:</b> {plan.before}</p><p><b>During:</b> {plan.during}</p><p><b>After:</b> {plan.after}</p></div></div>
      <div className="fuel-guardrail"><ShieldAlert size={18} /><div><b>Use this as education, not medical nutrition therapy.</b><span>{plan.note} If you are under 18, pregnant, have diabetes, kidney disease, a history of disordered eating, persistent fatigue, or are managing an injury, work with a physician or sports dietitian before changing intake.</span></div></div>
      <p className="nutrition-source"><Info size={14} /> General carbohydrate and protein starting ranges are aligned with sports-nutrition guidance; adjust with a qualified professional for your health and event needs. <a href="https://www.usada.org/athletes/substances/nutrition-guide/" target="_blank" rel="noreferrer">Read the USADA guide</a>.</p>
    </div>
  </section>
}
