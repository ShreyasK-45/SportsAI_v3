/**
 * SportsAI+ — Analysis Progress Display
 * Phase 9: Real pipeline stages, no fake percentages
 */
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react"
import type { AnalysisStage, JobStatus } from "../lib/backendApi"

type Props = {
  status:    JobStatus
  stage:     AnalysisStage
  error?:    string
}

const STAGES: AnalysisStage[] = [
  "Queued",
  "Validating video",
  "Extracting movement",
  "Calculating biomechanics",
  "Generating insights",
  "Complete",
]

function stageIndex(s: AnalysisStage): number {
  return STAGES.indexOf(s)
}

export function AnalysisProgress({ status, stage, error }: Props) {
  const currentIdx = stageIndex(stage)

  return (
    <div className="analysis-progress">
      <div className="ap-header">
        {status === "failed" ? (
          <XCircle size={32} className="ap-icon fail" />
        ) : status === "completed" ? (
          <CheckCircle2 size={32} className="ap-icon done" />
        ) : (
          <Loader2 size={32} className="ap-icon spin" />
        )}
        <div>
          <p className="eyebrow">
            {status === "failed" ? "ANALYSIS FAILED" :
             status === "completed" ? "ANALYSIS COMPLETE" :
             "ANALYSING YOUR RUN"}
          </p>
          <p className="ap-stage">{stage}</p>
        </div>
      </div>

      {status !== "failed" && (
        <ol className="ap-stages">
          {STAGES.filter(s => s !== "Queued").map((s, i) => {
            const idx  = STAGES.indexOf(s)
            const done = idx < currentIdx || status === "completed"
            const active = idx === currentIdx && status !== "completed"
            return (
              <li key={s} className={done ? "done" : active ? "active" : ""}>
                {done ? <CheckCircle2 size={16} /> :
                 active ? <Loader2 size={16} className="spin" /> :
                 <Circle size={16} />}
                <span>{s}</span>
              </li>
            )
          })}
        </ol>
      )}

      {status === "failed" && error && (
        <div className="ap-error">
          <p>{error}</p>
          <p className="ap-error-hint">
            Try a clearer side-view clip with the full body visible, good lighting, and a stable camera.
          </p>
        </div>
      )}

      {status !== "failed" && (
        <p className="ap-note">
          Your video is processed on the server and not stored after analysis.
        </p>
      )}
    </div>
  )
}
