import { useState } from 'react'
import { AlertTriangle, Apple, BrainCircuit, CheckCircle2, ChevronDown, ChevronUp, Dumbbell, HeartPulse, Leaf, Zap } from 'lucide-react'
import type { RAGOutput } from '../types'

function Pill({ text, colour }: { text: string; colour: string }) {
  return <span style={{ background:`${colour}22`, color:colour, border:`1px solid ${colour}44` }}
    className="rag-pill">{text}</span>
}

function Block({ title, items, colour, icon: Icon }: { title: string; items: string[]; colour: string; icon: any }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rag-block">
      <button className="rag-block-header" onClick={() => setOpen(!open)}>
        <span style={{ color: colour }}><Icon size={14} /></span>
        <span>{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <ul className="rag-block-list">
          {items.map((item, i) => (
            <li key={i}><CheckCircle2 size={12} style={{ color: colour, flexShrink:0 }} />{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function RAGPanel({ rag }: { rag: RAGOutput }) {
  const riskColour = rag.injuryRisk.level === 'High' ? '#ef4444'
    : rag.injuryRisk.level === 'Moderate' ? '#f59e0b' : '#22c55e'

  return (
    <section className="rag-panel">

      {/* Coaching Cue */}
      <div className="rag-section">
        <div className="rag-section-title"><BrainCircuit size={16} /><span>AI Coaching Cue</span></div>
        <p className="rag-cue">{rag.coachingCue}</p>
      </div>

      {/* Injury Risk */}
      <div className="rag-section">
        <div className="rag-section-title"><AlertTriangle size={16} /><span>Injury Risk</span>
          <Pill text={rag.injuryRisk.level} colour={riskColour} />
        </div>
        {rag.injuryRisk.factors.map((f, i) => (
          <p key={i} className="rag-risk-item">⚠ {f}</p>
        ))}
        <p className="rag-risk-advice">→ {rag.injuryRisk.advice}</p>
      </div>

      {/* Drill Plan */}
      <div className="rag-section">
        <div className="rag-section-title"><Dumbbell size={16} /><span>Corrective Drill Plan</span></div>
        <div className="rag-drills">
          {rag.drillPlan.map((d, i) => (
            <div key={i} className="rag-drill">
              <div className="rag-drill-header">
                <span className="rag-drill-name">{d.name}</span>
                <span className="rag-drill-sets">{d.setsReps}</span>
              </div>
              <p className="rag-drill-cue">Cue: {d.cue}</p>
              <p className="rag-drill-meta">{d.frequency} · <span style={{color:'#22c55e'}}>{d.target}</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* Nutrition */}
      <div className="rag-section">
        <div className="rag-section-title">
          <Leaf size={16} />
          <span>Nutrition — {rag.country === 'india' ? '🇮🇳 India' : rag.country === 'usa' ? '🇺🇸 USA' : '🇯🇵 Japan'}</span>
        </div>
        <Block title="Pre-Run Foods"        items={rag.nutrition.preRun}            colour="#f59e0b" icon={Apple}        />
        <Block title="Post-Run Recovery"    items={rag.nutrition.postRun}           colour="#3b82f6" icon={HeartPulse}   />
        <Block title="Daily Foods"          items={rag.nutrition.daily}             colour="#22c55e" icon={Apple}        />
        <Block title="Hydration"            items={rag.nutrition.hydration}         colour="#06b6d4" icon={Zap}          />
        <Block title="Anti-Inflammatory"    items={rag.nutrition.antiInflammatory}  colour="#ef4444" icon={HeartPulse}   />
        <Block title="Supplements"
          items={rag.nutrition.supplements.map(s => `${s.name} — ${s.dose} (${s.reason})`)}
          colour="#a855f7" icon={Zap} />

        <div className="rag-budget">
          <span className="rag-budget-label">💰 Budget Recovery Meal</span>
          <p>{rag.nutrition.budgetMeal}</p>
        </div>
        <div className="rag-collagen">
          <span className="rag-budget-label">🦴 Tendon/Collagen Protocol</span>
          <p>{rag.nutrition.collagenProtocol}</p>
        </div>
      </div>
    </section>
  )
}
