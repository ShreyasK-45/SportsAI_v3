/**
 * SportsAI+ — Backend Bridge
 * Connects the existing frontend analysis flow to the Python backend.
 * The backend runs in parallel with the frontend browser analysis.
 * If the backend is unavailable, the frontend analysis still works.
 */

import { analyseVideo, type AnalysisResult, type AnalysisStage, type Country } from "./backendApi"

export type BackendState =
  | { status: "idle" }
  | { status: "running"; stage: AnalysisStage }
  | { status: "done";    result: AnalysisResult }
  | { status: "failed";  error: string }
  | { status: "unavailable" }

// The browser analysis is local-first. Never upload a selected video just
// because a service happens to be listening on localhost; server processing
// must be explicitly enabled by setting VITE_BACKEND_URL.
const BACKEND = import.meta.env.VITE_BACKEND_URL?.trim() || null

let _backendAvailable: boolean | null = null

export async function checkBackend(): Promise<boolean> {
  if (!BACKEND) return false
  if (_backendAvailable !== null) return _backendAvailable
  try {
    const r = await fetch(`${BACKEND}/health`, { signal: AbortSignal.timeout(3000) })
    _backendAvailable = r.ok
  } catch {
    _backendAvailable = false
  }
  return _backendAvailable
}

/**
 * Run the Python backend analysis on a file.
 * Returns an async state stream via the onState callback.
 * Never throws — failures are reported as BackendState.failed.
 */
export async function runBackendAnalysis(
  file:      File,
  country:   Country,
  onState:   (state: BackendState) => void,
): Promise<void> {
  if (!BACKEND) {
    onState({ status: "unavailable" })
    return
  }
  const available = await checkBackend()
  if (!available) {
    onState({ status: "unavailable" })
    return
  }

  try {
    onState({ status: "running", stage: "Queued" })
    const result = await analyseVideo(
      file,
      country,
      (stage) => onState({ status: "running", stage }),
    )
    onState({ status: "done", result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Backend analysis failed"
    onState({ status: "failed", error: msg })
  }
}
