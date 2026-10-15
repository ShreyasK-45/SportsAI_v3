/**
 * SportsAI+ — Backend Analysis Panel
 * Shows MKI score, running metrics, and RAG output from the Python backend.
 * Displayed alongside the existing frontend analysis when backend is available.
 */
import { useState } from "react"
import { Activity, AlertTriangle, ChevronDown, ChevronUp, Dumbbell, Gauge, Leaf, Sparkles } from "lucide-react"
import type { AnalysisResult } from "../lib/backendApi"

type Props = { result: AnalysisResult }

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bap-section">
      <button className="bap-section-header" onClick={() => setOpen(o => !o)}>
        <Icon size={15} /><span>{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="bap-section-body">{children}</div>}
    </div>
  )
}

export function BackendAnalysisPanel({ result }: Props) {
  const mki      = result.mki_output
  const metrics  = result.running_metrics
  const rag      = result.rag_output
  const poseCon  = result.pose_confidence
  const mki_colour = mki.mki_score >= 80 ? "#22c55e" : mki.mki_score >= 60 ? "#f59e0b" : "#ef4444"

  return (
    <div className="backend-panel">
      <p className="backend-panel-title"><Activity size={14} /> Experimental Backend Estimates</p>
      <p style={{ fontSize: 12, color: "#f59e0b", lineHeight: 1.6, margin: "0 0 16px" }}>
        This legacy video pipeline is not a validated ML measurement system. Its 3D lifting uses synthetic training data, and several stages are heuristics or templates. These values are not force-plate measurements, performance diagnoses, or injury predictions.
      </p>

      {/* Pose confidence */}
      {poseCon && (
        <div style={{ marginBottom: 16 }}>
          <span className={`pose-confidence ${poseCon.level}`}>{poseCon.level} confidence</span>
          <p className="pose-confidence-detail" style={{ marginTop: 6 }}>
            Pose detection: {poseCon.avg_confidence * 100 | 0}% avg visibility ·{" "}
            {poseCon.usable_pct}% usable frames ({poseCon.usable_frames} of {poseCon.total_sampled} sampled)
          </p>
        </div>
      )}

      {/* MKI Score */}
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20, padding:"16px", background:"#111214", borderRadius:14, border:"1px solid #27272a" }}>
        <div>
          <p style={{ fontSize:11, color:"#888", textTransform:"uppercase", margin:"0 0 4px" }}>MKI Score</p>
          <p style={{ fontSize:36, fontWeight:700, color:mki_colour, margin:0 }}>{mki.mki_score.toFixed(1)}</p>
          <p style={{ fontSize:12, color:"#888", margin:0 }}>/100 · {mki.grade}</p>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:11, color:"#666", margin:"0 0 8px", textTransform:"uppercase" }}>Component breakdown</p>
          {Object.entries(mki.component_scores ?? {}).map(([k, v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:11, color:"#888", textTransform:"capitalize" }}>{k.replace(/_/g," ")}</span>
              <span style={{ fontSize:11, color:"#ccc", fontWeight:600 }}>{(v as number).toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Running metrics */}
      <Section title="Running Biomechanics" icon={Gauge}>
        <div className="backend-metrics-grid">
          {[
            ["Cadence",             `${metrics.cadence ?? "—"}`,             "spm"],
            ["Stride Length",       `${metrics.stride_length ?? "—"}`,       "m (estimated)"],
            ["Ground Contact",      `${metrics.ground_contact_time ?? "—"}`, "s (estimated)"],
            ["Symmetry",            `${metrics.symmetry ?? "—"}`,            "%"],
            ["Running Efficiency",  `${metrics.running_efficiency ?? "—"}`,  "%"],
            ["Foot Strike",         `${metrics.foot_strike ?? "—"}`,         ""],
            ["Knee Angle",          `${metrics.knee_angle ?? "—"}`,          "°"],
            ["Torso Lean",          `${metrics.torso_lean ?? "—"}`,          "°"],
          ].map(([label, val, unit]) => (
            <div key={label} className="backend-metric">
              <span>{label}</span>
              <strong>{val}</strong>
              {unit && <small>{unit}</small>}
            </div>
          ))}
        </div>
        <p style={{ fontSize:11, color:"#666", margin:0 }}>
          * Stride length, ground contact time, and foot strike are estimated from 2D video landmarks and should be treated as approximate. They are not laboratory measurements.
        </p>
      </Section>

      {/* AI Coaching */}
      {rag?.coaching_cue && (
        <Section title="Template Coaching Cue" icon={Sparkles}>
          <p style={{ fontSize:14, color:"#ccc", lineHeight:1.7, margin:0 }}>{rag.coaching_cue}</p>
        </Section>
      )}

      {/* Injury risk */}
      {rag?.injury_risk && rag.injury_risk.level !== "Unknown" && (
        <Section title="Biomechanical Load Indicators" icon={AlertTriangle}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <span className={`pose-confidence ${rag.injury_risk.level}`} style={{ fontSize:12 }}>
              {rag.injury_risk.level} loading
            </span>
          </div>
          {rag.injury_risk.factors.length > 0 && (
            <ul style={{ margin:0, padding:"0 0 0 16px" }}>
              {rag.injury_risk.factors.map((f, i) => (
                <li key={i} style={{ fontSize:13, color:"#aaa", marginBottom:6, lineHeight:1.5 }}>
                  {f}
                </li>
              ))}
            </ul>
          )}
          <p style={{ fontSize:13, color:"#ccc", fontWeight:600, margin:"12px 0 0" }}>
            → {rag.injury_risk.advice}
          </p>
          <p style={{ fontSize:11, color:"#666", margin:"8px 0 0" }}>
            These are movement patterns associated with biomechanical loading — not injury diagnoses. Consult a sports physiotherapist if you have pain.
          </p>
        </Section>
      )}

      {/* Drill plan */}
      {rag?.drill_plan && rag.drill_plan.length > 0 && (
        <Section title="Corrective Drill Plan" icon={Dumbbell}>
          {rag.drill_plan.map((d, i) => (
            <div key={i} style={{ background:"#111214", border:"1px solid #27272a", borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{d.name}</span>
                <span style={{ fontSize:11, color:"#54e5b1", fontWeight:700 }}>{d.sets_reps}</span>
              </div>
              <p style={{ fontSize:12, color:"#888", margin:"0 0 4px" }}>Cue: <span style={{ color:"#ccc" }}>{d.cue}</span></p>
              <p style={{ fontSize:12, color:"#666", margin:0 }}>{d.frequency} · <span style={{ color:"#22c55e" }}>{d.target}</span></p>
            </div>
          ))}
        </Section>
      )}

      {/* Nutrition */}
      {rag?.nutrition_plan && (
        <Section title={`Nutrition — ${result.country.toUpperCase()}`} icon={Leaf}>
          {rag.nutrition_plan.pre_run_foods?.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <p style={{ fontSize:11, color:"#f59e0b", textTransform:"uppercase", fontWeight:700, margin:"0 0 6px" }}>Pre-Run</p>
              {rag.nutrition_plan.pre_run_foods.slice(0,3).map((f, i) => (
                <p key={i} style={{ fontSize:13, color:"#ccc", margin:"0 0 4px" }}>• {f}</p>
              ))}
            </div>
          )}
          {rag.nutrition_plan.post_run_recovery?.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <p style={{ fontSize:11, color:"#3b82f6", textTransform:"uppercase", fontWeight:700, margin:"0 0 6px" }}>Post-Run Recovery</p>
              {rag.nutrition_plan.post_run_recovery.slice(0,3).map((f, i) => (
                <p key={i} style={{ fontSize:13, color:"#ccc", margin:"0 0 4px" }}>• {f}</p>
              ))}
            </div>
          )}
          {rag.nutrition_plan.budget_meal && (
            <div style={{ background:"#54e5b110", border:"1px solid #54e5b130", borderRadius:10, padding:"10px 14px", marginTop:8 }}>
              <p style={{ fontSize:11, color:"#54e5b1", fontWeight:700, textTransform:"uppercase", margin:"0 0 4px" }}>💰 Budget Recovery Meal</p>
              <p style={{ fontSize:13, color:"#ccc", margin:0 }}>{rag.nutrition_plan.budget_meal}</p>
            </div>
          )}
          {rag.nutrition_plan.tendon_protocol && (
            <div style={{ background:"#f59e0b10", border:"1px solid #f59e0b30", borderRadius:10, padding:"10px 14px", marginTop:8 }}>
              <p style={{ fontSize:11, color:"#f59e0b", fontWeight:700, textTransform:"uppercase", margin:"0 0 4px" }}>🦴 Tendon Protocol</p>
              <p style={{ fontSize:13, color:"#ccc", margin:"0 0 4px" }}>{rag.nutrition_plan.tendon_protocol.protocol}</p>
              <p style={{ fontSize:11, color:"#888", margin:0 }}>Duration: {rag.nutrition_plan.tendon_protocol.duration}</p>
            </div>
          )}
        </Section>
      )}

      {/* MKI Recommendations */}
      {mki.recommendations?.length > 0 && (
        <div style={{ marginTop:4 }}>
          <p style={{ fontSize:11, color:"#888", textTransform:"uppercase", fontWeight:700, margin:"0 0 8px" }}>MKI Recommendations</p>
          {mki.recommendations.map((r, i) => (
            <p key={i} style={{ fontSize:13, color:"#ccc", margin:"0 0 6px" }}>• {r}</p>
          ))}
        </div>
      )}
    </div>
  )
}
