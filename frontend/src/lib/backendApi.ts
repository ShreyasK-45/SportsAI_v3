/**
 * SportsAI+ — Backend API client
 * Phase 2: Job-based async analysis with polling
 * Phase 14: Only upload_id passed to backend, never filesystem paths
 */

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000"

export type Country = "india" | "usa" | "japan"

export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"

export type AnalysisStage =
  | "Queued"
  | "Validating video"
  | "Extracting movement"
  | "Calculating biomechanics"
  | "Generating insights"
  | "Complete"
  | "Failed"

export type JobResponse = {
  job_id:   string
  status:   JobStatus
  stage:    AnalysisStage
  error?:   string
  result?:  AnalysisResult
  timings?: Record<string, number>
}

export type PoseConfidence = {
  level:           "High" | "Medium" | "Low" | "Insufficient"
  avg_confidence:  number
  usable_frames:   number
  rejected_frames: number
  total_sampled:   number
  usable_pct:      number
}

export type AnalysisResult = {
  status:           string
  video_name:       string
  frames_processed: number
  country:          Country
  running_metrics:  Record<string, number | string>
  mki_output:       { mki_score: number; grade: string; recommendations: string[]; component_scores: Record<string, number> }
  coach_output:     { strengths: string[]; improvements: string[]; training_plan: string[]; personalized_advice: string }
  rag_output:       {
    coaching_cue:    string
    drill_plan:      { name: string; sets_reps: string; cue: string; frequency: string; target: string }[]
    nutrition_plan:  { country: Country; pre_run_foods: string[]; post_run_recovery: string[]; daily_foods: string[]; hydration: string[]; anti_inflammatory: string[]; supplements: { name: string; dose: string; reason: string }[]; budget_meal: string; tendon_protocol?: { reason: string; protocol: string; duration: string } | null }
    injury_risk:     { level: string; risk_score: number; factors: string[]; advice: string }
    errors_detected: string[]
  }
  pose_confidence:  PoseConfidence
  pipeline_steps:   { name: string; status: string; message?: string }[]
  completed_at:     string
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try { const body = await res.json(); msg = body.detail ?? body.error ?? msg } catch {}
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

/** Upload a video. Returns upload_id (never a path). */
export async function uploadVideo(file: File): Promise<{ upload_id: string; original_filename: string; size_bytes: number }> {
  const form = new FormData()
  form.append("file", file)
  const res = await fetch(`${BACKEND}/upload`, { method: "POST", body: form })
  if (!res.ok) {
    let msg = `Upload failed (${res.status})`
    try { const body = await res.json(); msg = body.detail ?? msg } catch {}
    throw new Error(msg)
  }
  return res.json()
}

/** Start a background analysis. Returns job_id immediately. */
export async function startAnalysis(uploadId: string, country: Country): Promise<JobResponse> {
  return apiRequest<JobResponse>("/analysis", {
    method: "POST",
    body:   JSON.stringify({ upload_id: uploadId, country }),
  })
}

/** Poll for job status. */
export async function pollJobStatus(jobId: string): Promise<JobResponse> {
  return apiRequest<JobResponse>(`/analysis/${jobId}/status`)
}

/**
 * Upload → start analysis → poll until done.
 * Calls onStage with the current stage string as it progresses.
 * Returns the completed AnalysisResult.
 */
export async function analyseVideo(
  file:     File,
  country:  Country,
  onStage:  (stage: AnalysisStage) => void,
  signal?:  AbortSignal,
): Promise<AnalysisResult> {
  onStage("Queued")

  // Step 1: Upload
  const { upload_id } = await uploadVideo(file)

  // Step 2: Start job
  const job = await startAnalysis(upload_id, country)
  onStage(job.stage)

  // Step 3: Poll
  return new Promise<AnalysisResult>((resolve, reject) => {
    const POLL_MS = 1200

    const poll = async () => {
      if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return }
      try {
        const s = await pollJobStatus(job.job_id)
        onStage(s.stage)
        if (s.status === "completed" && s.result) {
          resolve(s.result)
        } else if (s.status === "failed") {
          reject(new Error(s.error ?? "Analysis failed"))
        } else {
          setTimeout(poll, POLL_MS)
        }
      } catch (e) {
        reject(e)
      }
    }

    setTimeout(poll, POLL_MS)
  })
}

/** Download PDF report for a result_id. */
export async function downloadReport(resultId: string, athleteName = "Athlete"): Promise<void> {
  const res = await fetch(`${BACKEND}/report/${resultId}`)
  if (!res.ok) throw new Error(`Report download failed (${res.status})`)
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  const date = new Date().toISOString().slice(0, 10)
  a.href     = url
  a.download = `Stridewise_${athleteName.replace(/\s+/g, "_")}_${date}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

/** Get recent analysis history. */
export async function getHistory() {
  return apiRequest<{ result_id: string; video_name: string; country: Country; mki_score: number; grade: string; completed_at: string }[]>("/upload/history")
}
