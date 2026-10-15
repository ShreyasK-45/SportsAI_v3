export type Landmark = { x: number; y: number; z?: number; visibility?: number }

export type PoseSample = {
  timestamp: number
  landmarks: Landmark[]
  confidence: number
}

export type MetricId = 'posture' | 'pelvis' | 'footPlacement' | 'head' | 'armSwing' | 'symmetry'

export type Metric = {
  id: MetricId
  label: string
  score: number
  status: 'good' | 'watch' | 'focus'
  value: string
  description: string
  cue: string
}

export type RunningAnalysis = {
  id: string
  createdAt: string
  sourceName: string
  duration: number
  confidence: number
  score: number
  readiness: 'ready' | 'limited'
  view?: 'side' | 'front' | 'oblique'
  viewConfidence?: number
  samples: PoseSample[]
  metrics: Metric[]
  footStrike: FootStrikeAssessment
  notes: string[]
}

export type FootStrikeAssessment = {
  classification: 'rearfoot' | 'midfoot' | 'forefoot' | 'inconclusive'
  confidence: number
  contacts: number
  message: string
  landing: 'under-body' | 'ahead-of-body' | 'inconclusive'
  landingConfidence: number
  correction?: string
}

/** A sport module owns its capture rules and scoring model. Only running ships today. */
export type SportModule = {
  id: string
  label: string
  captureGuide: string[]
  analyse: (samples: PoseSample[], sourceName: string, duration: number) => RunningAnalysis
}

export type ActivityStatus = 'live' | 'next' | 'planned'

export type ActivityDefinition = {
  id: string
  name: string
  family: string
  status: ActivityStatus
  description: string
  measureFocus: string[]
  captureFocus: string
  accent: string
}

export type AthleteProfile = {
  displayName: string
  goal: string
  targetEvent: string
  weeklyDistanceKm: number
  weightKg: number
  preferredIntensity: 'easy' | 'moderate' | 'hard'
  updatedAt?: string
}

export type AnalysisSummary = {
  id: string
  activityId: string
  sourceName: string
  score: number
  confidence: number
  duration: number
  createdAt: string
  focus: string
}

export type WeeklySession = {
  day: string
  title: string
  detail: string
  kind: 'easy' | 'quality' | 'recovery' | 'strength'
}

export type DashboardData = {
  profile: AthleteProfile
  activities: ActivityDefinition[]
  history: AnalysisSummary[]
  trainingWeek: WeeklySession[]
  apiStatus?: 'connected' | 'offline'
}

// ── Country support ──────────────────────────────────────────
export type Country = 'india' | 'usa' | 'japan'

// ── RAG coaching output ──────────────────────────────────────
export type DrillItem = {
  name:      string
  setsReps:  string
  cue:       string
  frequency: string
  target:    string
}

export type SupplementItem = {
  name:   string
  dose:   string
  reason: string
}

export type RAGOutput = {
  coachingCue:  string
  drillPlan:    DrillItem[]
  injuryRisk:   { level: string; factors: string[]; advice: string }
  country:      Country
  nutrition: {
    preRun:           string[]
    postRun:          string[]
    daily:            string[]
    hydration:        string[]
    antiInflammatory: string[]
    supplements:      SupplementItem[]
    budgetMeal:       string
    collagenProtocol: string
  }
}

// ── Auth user ────────────────────────────────────────────────
export type AuthUser = {
  id:    string
  email: string
}
