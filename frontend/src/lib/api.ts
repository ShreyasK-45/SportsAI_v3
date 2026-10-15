/**
 * SportsAI+ · API Layer
 * Tries Supabase first; falls back to the local Node server; final fallback is offline data.
 */
import type { ActivityDefinition, AnalysisSummary, AthleteProfile, DashboardData, WeeklySession } from '../types'
import { profileApi, analysesApi } from './supabaseApi'
import { isConfigured } from './supabase'

const fallbackActivities: ActivityDefinition[] = [
  { id:'long-distance-running', name:'Long-distance running', family:'Endurance', status:'live', description:'Cadence-aware form screens for relaxed, efficient mileage.', measureFocus:['Trunk stack','Contact placement','Stride symmetry'], captureFocus:'Side view · 10–20 seconds · full body', accent:'#54e5b1' },
  { id:'sprint', name:'Sprint mechanics', family:'Track', status:'next', description:'Acceleration, max-velocity posture, and front-side mechanics.', measureFocus:['Projection angle','Step frequency','Front-side action'], captureFocus:'Side view · 60–120 fps', accent:'#ff765f' },
  { id:'long-jump', name:'Long jump', family:'Jumps', status:'planned', description:'Approach rhythm, take-off posture, and landing control.', measureFocus:['Approach rhythm','Take-off angle','Landing sequence'], captureFocus:'Side view · runway to landing', accent:'#f5c66d' },
  { id:'shot-put', name:'Shot put', family:'Throws', status:'planned', description:'Glide or rotational sequencing, block, and release position.', measureFocus:['Hip–shoulder separation','Block','Release path'], captureFocus:'Rear-oblique view · full circle', accent:'#6da9ff' },
  { id:'discus', name:'Discus throw', family:'Throws', status:'planned', description:'Entry balance, orbit, delivery rhythm, and release.', measureFocus:['Orbit control','Separation','Delivery rhythm'], captureFocus:'Rear-oblique view · full circle', accent:'#c9a7ff' },
  { id:'javelin', name:'Javelin throw', family:'Throws', status:'planned', description:'Run-up rhythm, impulse stride, block, and arm path.', measureFocus:['Impulse stride','Block side','Release angle'], captureFocus:'Side view · whole runway', accent:'#78d5ff' },
]

const fallbackWeek: WeeklySession[] = [
  { day:'MON', title:'Easy aerobic',       detail:'45 min conversational · keep the next cue gentle',          kind:'easy'     },
  { day:'TUE', title:'Control strength',   detail:'20 min · bridge march + controlled step-down',              kind:'strength' },
  { day:'WED', title:'Steady progression', detail:'10 min easy + 20 min steady + 10 min easy',                 kind:'quality'  },
  { day:'THU', title:'Recovery',           detail:'Rest or 25 min very easy walk/jog',                         kind:'recovery' },
  { day:'FRI', title:'Easy + strides',     detail:'35 min easy + 4 × 15 sec relaxed strides',                  kind:'easy'     },
  { day:'SAT', title:'Long easy run',      detail:'60 min easy · practise your fueling routine',               kind:'quality'  },
  { day:'SUN', title:'Recovery reset',     detail:'Mobility and an optional 20 min walk',                      kind:'recovery' },
]

export const offlineDashboard: DashboardData = {
  profile:      { displayName:'Runner', goal:'Build relaxed long-run efficiency', targetEvent:'Half marathon', weeklyDistanceKm:32, weightKg:65, preferredIntensity:'moderate' },
  activities:   fallbackActivities,
  history:      [
    { id:'starter-1', activityId:'long-distance-running', sourceName:'Easy run baseline', score:76, confidence:91, duration:14, createdAt:new Date(Date.now()-6*86400000).toISOString(), focus:'Contact placement' },
    { id:'starter-2', activityId:'long-distance-running', sourceName:'Easy run recheck',  score:80, confidence:90, duration:16, createdAt:new Date(Date.now()-2*86400000).toISOString(), focus:'Pelvic stability'  },
  ],
  trainingWeek: fallbackWeek,
  apiStatus:    'offline',
}

async function localRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api${path}`, { headers:{'Content-Type':'application/json',...(init?.headers??{})}, ...init })
  if (!r.ok) throw new Error(`API ${r.status}`)
  return r.json() as Promise<T>
}

export const athleteApi = {
  async dashboard(): Promise<DashboardData> {
    // 1. Try Supabase
    if (isConfigured) {
      try {
        const [profile, history] = await Promise.all([profileApi.get(), analysesApi.list()])
        return {
          profile:      profile ?? offlineDashboard.profile,
          activities:   fallbackActivities,
          history:      history.length ? history : offlineDashboard.history,
          trainingWeek: fallbackWeek,
          apiStatus:    'connected',
        }
      } catch { /* fall through */ }
    }
    // 2. Try local Node server
    try {
      const data = await localRequest<DashboardData>('/dashboard')
      return { ...data, apiStatus:'connected' }
    } catch { /* fall through */ }
    // 3. Offline
    return offlineDashboard
  },

  async profile(p: AthleteProfile): Promise<AthleteProfile> {
    if (isConfigured) return profileApi.upsert(p)
    return localRequest<AthleteProfile>('/profile', { method:'PUT', body:JSON.stringify(p) })
  },

  analyses: () => isConfigured ? analysesApi.list() : localRequest<AnalysisSummary[]>('/analyses'),

  async saveAnalysis(a: AnalysisSummary & { country?: any; view?: string; viewConfidence?: number; metrics?: any; footStrike?: any; ragOutput?: any }): Promise<AnalysisSummary> {
    if (isConfigured) return analysesApi.save(a)
    return localRequest<AnalysisSummary>('/analyses', { method:'POST', body:JSON.stringify(a) })
  },

  plan: () => localRequest<WeeklySession[]>('/plan'),
}
