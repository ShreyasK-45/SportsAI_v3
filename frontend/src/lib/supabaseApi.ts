/**
 * SportsAI+ · Supabase Data Layer
 *
 * Replaces / augments the local JSON server (server.mjs).
 * When Supabase is not configured, every function silently
 * falls back to the offline mode so the app still runs.
 */

import { supabase, isConfigured } from './supabase'
import type { AthleteProfile, AnalysisSummary, WeeklySession } from '../types'

// ── Country type ─────────────────────────────────────────────
export type Country = 'india' | 'usa' | 'japan'

// ── Auth ─────────────────────────────────────────────────────

export const auth = {
  async signUp(email: string, password: string, displayName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) throw error
    return data.user
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data.user
  },

  async signOut() {
    await supabase.auth.signOut()
  },

  async getUser() {
    const { data } = await supabase.auth.getUser()
    return data.user
  },

  onAuthChange(cb: (user: any) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => cb(session?.user ?? null))
  },
}

// ── Profile ──────────────────────────────────────────────────

export const profileApi = {
  async get(): Promise<AthleteProfile | null> {
    if (!isConfigured) return null
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return null
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (!data) return null
    return {
      displayName:        data.display_name,
      goal:               data.goal,
      targetEvent:        data.target_event,
      weeklyDistanceKm:   data.weekly_distance_km,
      weightKg:           data.weight_kg,
      preferredIntensity: data.preferred_intensity,
      updatedAt:          data.updated_at,
    }
  },

  async upsert(profile: AthleteProfile, country: Country = 'india'): Promise<AthleteProfile> {
    if (!isConfigured) return profile
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return profile
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        user_id:            user.id,
        display_name:       profile.displayName,
        goal:               profile.goal,
        target_event:       profile.targetEvent,
        weekly_distance_km: profile.weeklyDistanceKm,
        weight_kg:          profile.weightKg,
        preferred_intensity:profile.preferredIntensity,
        country,
        updated_at:         new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single()
    if (error) throw error
    return {
      displayName:        data.display_name,
      goal:               data.goal,
      targetEvent:        data.target_event,
      weeklyDistanceKm:   data.weekly_distance_km,
      weightKg:           data.weight_kg,
      preferredIntensity: data.preferred_intensity,
      updatedAt:          data.updated_at,
    }
  },
}

// ── Analyses ─────────────────────────────────────────────────

export const analysesApi = {
  async list(): Promise<AnalysisSummary[]> {
    if (!isConfigured) return []
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return []
    const { data } = await supabase
      .from('analyses')
      .select('id,activity_id,source_name,score,confidence,duration,focus,created_at,country,view,view_confidence,metrics,foot_strike,rag_output')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    return (data ?? []).map(row => ({
      id:            row.id,
      activityId:    row.activity_id,
      sourceName:    row.source_name,
      score:         row.score,
      confidence:    row.confidence,
      duration:      row.duration,
      focus:         row.focus,
      createdAt:     row.created_at,
      country:       row.country,
      view:          row.view,
      viewConfidence:row.view_confidence,
      metrics:       row.metrics,
      footStrike:    row.foot_strike,
      ragOutput:     row.rag_output,
    }))
  },

  async save(analysis: AnalysisSummary & {
    country?: Country
    view?: string
    viewConfidence?: number
    metrics?: any
    footStrike?: any
    ragOutput?: any
  }): Promise<AnalysisSummary> {
    if (!isConfigured) return analysis
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return analysis
    const { data, error } = await supabase
      .from('analyses')
      .insert({
        user_id:        user.id,
        activity_id:    analysis.activityId,
        source_name:    analysis.sourceName,
        score:          analysis.score,
        confidence:     analysis.confidence,
        duration:       analysis.duration,
        focus:          analysis.focus,
        country:        analysis.country ?? 'india',
        view:           analysis.view,
        view_confidence:analysis.viewConfidence,
        metrics:        analysis.metrics,
        foot_strike:    analysis.footStrike,
        rag_output:     analysis.ragOutput,
        created_at:     analysis.createdAt,
      })
      .select()
      .single()
    if (error) throw error
    return { ...analysis, id: data.id }
  },
}

// ── Nutrition Logs ───────────────────────────────────────────

export type MealType = 'pre_run' | 'post_run' | 'daily' | 'supplement'
export interface NutritionLog {
  id?: string
  country: Country
  mealType: MealType
  description: string
  loggedAt?: string
}

export const nutritionApi = {
  async list(country?: Country): Promise<NutritionLog[]> {
    if (!isConfigured) return []
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return []
    let query = supabase
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(100)
    if (country) query = query.eq('country', country)
    const { data } = await query
    return (data ?? []).map(r => ({
      id:          r.id,
      country:     r.country,
      mealType:    r.meal_type,
      description: r.description,
      loggedAt:    r.logged_at,
    }))
  },

  async log(entry: NutritionLog): Promise<NutritionLog> {
    if (!isConfigured) return entry
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return entry
    const { data, error } = await supabase
      .from('nutrition_logs')
      .insert({
        user_id:     user.id,
        country:     entry.country,
        meal_type:   entry.mealType,
        description: entry.description,
      })
      .select()
      .single()
    if (error) throw error
    return { ...entry, id: data.id, loggedAt: data.logged_at }
  },
}

// ── Training Sessions ────────────────────────────────────────

export const trainingApi = {
  async listWeek(): Promise<WeeklySession[]> {
    if (!isConfigured) return []
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return []
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const { data } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('week_start', weekStart.toISOString().slice(0, 10))
      .order('created_at')
    return (data ?? []).map(r => ({
      day:       r.day,
      title:     r.title,
      detail:    r.detail,
      kind:      r.kind,
      completed: r.completed,
    }))
  },

  async markComplete(day: string, completed: boolean): Promise<void> {
    if (!isConfigured) return
    const user = (await supabase.auth.getUser()).data.user
    if (!user) return
    await supabase
      .from('training_sessions')
      .update({ completed })
      .eq('user_id', user.id)
      .eq('day', day)
  },
}

// ── RAG-style nutrition data (client-side, no server needed) ──

export type CountryNutrition = {
  preRun: string[]
  postRun: string[]
  daily: string[]
  hydration: string[]
  antiInflammatory: string[]
  supplements: { name: string; dose: string; reason: string }[]
  budgetMeal: string
  collagenProtocol: string
}

export const nutritionKB: Record<Country, CountryNutrition> = {
  india: {
    preRun:          ['Idli with sambar (2-3 hrs before)', 'Banana (30-60 min before)', 'Poha with peanuts', 'Ragi dosa with chutney'],
    postRun:         ['Paneer bhurji + rice (25g protein)', 'Dal + rice + curd', 'Soya chunks + chapati', 'Banana + curd + peanut butter shake'],
    daily:           ['Moong dal (lunch)', 'Rajma-chawal', 'Spinach sabzi (iron)', 'Chana salad', 'Sweet potato'],
    hydration:       ['Coconut water — natural electrolytes', 'Buttermilk / chaas', 'Jaljeera', 'Lemon water + pink salt (natural ORS)'],
    antiInflammatory:['Turmeric haldi milk + black pepper daily', 'Fresh ginger in tea/food', 'Amla juice (vitamin C)', 'Beetroot juice 250ml pre-run (+3-5% endurance)'],
    supplements:     [
      { name:'Ashwagandha',     dose:'300-600mg daily',      reason:'VO2max improvement, cortisol reduction' },
      { name:'Amla / Vitamin C',dose:'500mg natural',         reason:'Collagen synthesis + iron absorption' },
      { name:'Vitamin D3',      dose:'2000 IU daily',         reason:'Bone health — deficiency common in India' },
      { name:'Iron (if tested low)', dose:'Blood test first', reason:'Common in Indian female runners' },
    ],
    budgetMeal:       'Banana + curd + peanut butter + oats: 25g protein, 60g carbs — under ₹50',
    collagenProtocol: 'Amla juice (natural vitamin C 500mg) + glycine 5g, 30 min before morning run. Non-veg: bone broth soup weekly.',
  },
  usa: {
    preRun:          ['Oatmeal + banana + almond butter', 'Whole grain toast + peanut butter + honey', 'Greek yoghurt + granola + berries', 'Bagel + cream cheese (race day)'],
    postRun:         ['Chocolate milk — clinical gold standard (15g protein, 26g carbs)', 'Chicken breast + sweet potato', 'Greek yoghurt + berries + granola', 'Whey protein shake + banana'],
    daily:           ['Wild salmon 3×/week (omega-3)', 'Blueberries daily (antioxidants)', 'Eggs daily', 'Sweet potato', 'Tuna', 'Cottage cheese before sleep'],
    hydration:       ['Electrolyte drink: Nuun or LMNT', 'Coconut water', '500ml water 2 hrs pre-run', '150-250ml every 15-20 min during run'],
    antiInflammatory:['Tart cherry juice 480ml daily — reduces DOMS 30%', 'Turmeric golden milk', 'Wild salmon 3×/week', 'Dark chocolate 70%+ 30g daily'],
    supplements:     [
      { name:'Creatine monohydrate',   dose:'3-5g daily',              reason:'Sprint performance + recovery' },
      { name:'Caffeine',               dose:'3-6mg/kg 30-60 min pre-run',reason:'Endurance performance +3-7%' },
      { name:'Collagen + Vitamin C',   dose:'15g + 500mg pre-run',      reason:'Tendon collagen synthesis' },
      { name:'Omega-3 fish oil',        dose:'2-3g EPA+DHA daily',      reason:'Inflammation reduction' },
      { name:'Tart cherry extract',    dose:'480mg or 480ml juice',     reason:'DOMS reduction 30%' },
      { name:'Magnesium glycinate',    dose:'300-400mg before sleep',   reason:'Cramp prevention + sleep quality' },
    ],
    budgetMeal:       '5oz tuna + brown rice + frozen broccoli + olive oil: 40g protein, 60g carbs — under $4',
    collagenProtocol: '15g collagen peptides + 500mg vitamin C, 30-60 min before morning run for tendon synthesis.',
  },
  japan: {
    preRun:          ['Onigiri (1-2 rice balls) + green tea', 'Soba noodles with light broth', 'Banana + miso soup', 'Mochi (race day carb loading)'],
    postRun:         ['Grilled salmon + rice + miso soup', '2 onsen tamago + soy milk + edamame (20g protein)', 'Natto + rice + pickled vegetables', 'Tofu stir-fry + brown rice'],
    daily:           ['Natto daily (K2, nattokinase, protein)', 'Seaweed salad (iodine, fucoxanthin)', 'Edamame (complete protein)', 'Mackerel or salmon', 'Purple sweet potato', 'Umeboshi 1-2 daily'],
    hydration:       ['Pocari Sweat during runs (precise Na/K ratio)', 'Green tea before short runs', 'Miso soup post-run (sodium + probiotics)', 'Umeboshi in water — traditional sports drink'],
    antiInflammatory:['Matcha green tea 3-5 cups daily (catechins)', 'Fresh ginger in miso or food', 'Seaweed — fucoxanthin', 'Yuzu citrus hot water (vitamin C)', 'Wasabi — allyl isothiocyanate'],
    supplements:     [
      { name:'Fish collagen peptides', dose:'5-10g daily',          reason:'Japan leads in fish collagen research — tendon + cartilage' },
      { name:'Vitamin C (yuzu/amla)',  dose:'500mg with collagen',   reason:'Essential co-factor for collagen synthesis' },
      { name:'Vitamin D3',            dose:'2000 IU daily',          reason:'Indoor lifestyle — deficiency risk' },
      { name:'B12 (plant-based only)',dose:'1000mcg daily',          reason:'Mandatory for strict plant-based athletes' },
    ],
    budgetMeal:       'Salmon onigiri + miso soup + edamame + green tea = complete recovery under ¥400',
    collagenProtocol: '5-10g fish collagen peptides (gyoyo collagen) + yuzu vitamin C, every morning. Traditional: fish skin stew weekly.',
  },
}

export function getRAGCoaching(
  metrics: any[],
  country: Country,
  score: number,
): {
  coachingCue: string
  drillPlan: { name: string; setsReps: string; cue: string; frequency: string; target: string }[]
  injuryRisk: { level: string; factors: string[]; advice: string }
} {
  const issues: string[] = []
  const drills: { name: string; setsReps: string; cue: string; frequency: string; target: string }[] = []
  const riskFactors: string[] = []
  const cueParts: string[] = []

  if (score >= 80) {
    cueParts.push(`Excellent form score of ${score}/100. Focus on maintaining mechanics and progressive load.`)
  } else if (score >= 62) {
    cueParts.push(`Form score ${score}/100 shows meaningful improvement potential. Address the priorities below.`)
  } else {
    cueParts.push(`Form score ${score}/100 — technique needs priority attention before increasing intensity.`)
  }

  const posture = metrics.find(m => m.id === 'posture')
  const pelvis  = metrics.find(m => m.id === 'pelvis')
  const foot    = metrics.find(m => m.id === 'footPlacement')
  const arm     = metrics.find(m => m.id === 'armSwing')
  const sym     = metrics.find(m => m.id === 'symmetry')

  if (posture && posture.score < 80) {
    cueParts.push('Trunk position needs attention — lean from ankles, not waist, ribs over hips.')
    issues.push('posture')
    drills.push({ name:'Wall-lean march', setsReps:'2×20s', cue:'Body long, lean from ankles, no waist bend', frequency:'Before 2 easy runs/week', target:'Whole-body forward lean' })
  }
  if (pelvis && pelvis.score < 80) {
    cueParts.push('Pelvic stability is below target — think forward, not upward. Belt line travels smoothly forward.')
    issues.push('pelvis')
    drills.push({ name:'Bridge march', setsReps:'2×8 each side', cue:'Keep pelvis level, stop before back arches', frequency:'2 non-consecutive days/week', target:'Hip control without impact' })
    riskFactors.push('Pelvic instability — IT band and hip flexor overload risk')
  }
  if (foot && foot.score < 80) {
    cueParts.push('Foot placement is ahead of your hips. Let the foot land closer under your centre of mass.')
    issues.push('footPlacement')
    drills.push({ name:'Quick-feet strides', setsReps:'6×20s, 60s easy recovery', cue:'Foot lands near you, effort relaxed', frequency:'After a short easy run', target:'Contact closer to body' })
    riskFactors.push('Overstriding — shin splint and stress fracture risk')
  }
  if (arm && arm.score < 80) {
    cueParts.push('Arm swing needs tightening — keep natural 70-120° elbow bend, drive elbows back, hands below shoulder.')
    issues.push('armSwing')
    drills.push({ name:'Relaxed arm-swing walk', setsReps:'2×30s', cue:'Soft elbows, hands back-forward beside body', frequency:'Before 2 easy runs/week', target:'Compact efficient arm action' })
  }
  if (sym && sym.score < 80) {
    cueParts.push(`Stride symmetry at ${sym.score}/100 — left-right imbalance detected. Strengthen weaker side.`)
    issues.push('symmetry')
    drills.push({ name:'Controlled step-down', setsReps:'2×6 each side', cue:'Knee tracks over middle toe', frequency:'2 days/week, pain-free only', target:'Side-to-side control' })
    drills.push({ name:'Single-leg balance', setsReps:'2×30s each side', cue:'Stand tall, pelvis level', frequency:'Daily', target:'Proprioception and stability' })
    riskFactors.push('Gait asymmetry — knee and ankle overuse injury risk')
  }

  if (drills.length === 0) {
    drills.push({ name:'Relaxed strides', setsReps:'4×15s, walk back', cue:'Tall, soft, quick — form not speed', frequency:'After an easy run', target:'Maintain running economy' })
  }

  const riskScore = riskFactors.length
  const level = riskScore >= 3 ? 'High' : riskScore >= 1 ? 'Moderate' : 'Low'

  return {
    coachingCue: cueParts.join(' '),
    drillPlan:   drills.slice(0, 5),
    injuryRisk: {
      level,
      factors: riskFactors,
      advice:   level === 'High'
        ? 'Reduce training load 40% and consult a sports physiotherapist.'
        : level === 'Moderate'
        ? 'Monitor closely. Complete drill plan before adding mileage.'
        : 'Continue current training. Maintain consistent drill work.',
    },
  }
}
