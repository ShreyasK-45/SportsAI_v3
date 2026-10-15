import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowUpRight, CalendarDays, Check, ChevronRight, ChartNoAxesCombined,
  CircleHelp, CircleDot, Cpu, Download, Gauge, Globe, Info, LockKeyhole, LogIn,
  LogOut, Play, Route, ShieldCheck, Sparkles, Timer, TrendingUp, TriangleAlert, User, X, Zap
} from 'lucide-react'
import { Capture }       from './components/Capture'
import { PosePlayback }  from './components/PosePlayback'
import { ActionPlan }    from './components/ActionPlan'
import { CoachFeedback } from './components/CoachFeedback'
import { FootStrikeCard } from './components/FootStrikeCard'
import { AuthModal }     from './components/AuthModal'
import { RAGPanel }      from './components/RAGPanel'
import { sampleVideo }   from './lib/pose'
import { longDistanceRunning } from './lib/running'
import { athleteApi, offlineDashboard } from './lib/api'
import { buildFuelPlan, type FuelProfile, type TrainingIntensity } from './lib/nutrition'
import { auth, nutritionKB, getRAGCoaching } from './lib/supabaseApi'
import { isConfigured }  from './lib/supabase'
import type { AthleteProfile, AuthUser, Country, DashboardData, RAGOutput, RunningAnalysis } from './types'
import { runBackendAnalysis, type BackendState } from './lib/backendBridge'
import { BackendAnalysisPanel } from './components/BackendAnalysisPanel'
import { AnalysisProgress } from './components/AnalysisProgress'
import { NutritionChat } from './components/NutritionChat'
import { createRunningReportPdf } from './lib/reportPdf'

type Screen = 'dashboard' | 'home' | 'guide' | 'report' | 'plans'

const DEMO: RunningAnalysis = {
  id:'demo', createdAt:new Date().toISOString(), sourceName:'Demo easy run · 14 sec', duration:14, confidence:91, score:76, readiness:'ready', view:'side', viewConfidence:89, samples:[],
  metrics:[
    { id:'posture',       label:'Trunk position',           score:86, status:'good',  value:'7.2° from vertical',      description:'Whole-body lean is in a relaxed range.',             cue:'Keep ribs stacked over hips as fatigue builds.' },
    { id:'pelvis',        label:'Pelvic stability',         score:71, status:'watch', value:'27.7% movement',           description:'Extra vertical movement appears late in the clip.',  cue:'Think "forward, not up" for two short easy strides.' },
    { id:'footPlacement', label:'Foot placement',           score:58, status:'focus', value:'0.92× torso length',       description:'Foot sometimes reaches ahead of the hip.',           cue:"Land closer under you; don't force a shorter stride." },
    { id:'head',          label:'Head & neck',              score:82, status:'good',  value:'0.25× torso offset',       description:'Head stays aligned with shoulder midpoint.',         cue:'Gaze soft, ahead on the horizon.' },
    { id:'armSwing',      label:'Arm swing & hand path',    score:79, status:'watch', value:'101° elbow · 0.24× travel',description:'Mostly relaxed, some stiffness late in clip.',      cue:'Soft elbow, hands beside body.' },
    { id:'symmetry',      label:'Stride symmetry',          score:83, status:'good',  value:'0.63 relative gap',        description:'Knee-height pattern broadly consistent.',           cue:'Keep watching across easy runs.' },
  ],
  footStrike:{ classification:'midfoot', confidence:78, contacts:14, message:'Most clear contact frames look midfoot.', landing:'ahead-of-body', landingConfidence:74, correction:'Let the foot meet the ground closer beneath your hips.' },
  notes:['Demo data is illustrative. Upload a side-view running clip for a real local analysis.'],
}

function scoreTone(s: number) { return s >= 80 ? 'good' : s >= 62 ? 'watch' : 'focus' }

const COUNTRIES: { code: Country; flag: string; label: string; desc: string }[] = [
  { code:'india', flag:'🇮🇳', label:'India',  desc:'Ayurvedic · vegetarian · budget' },
  { code:'usa',   flag:'🇺🇸', label:'USA',    desc:'Supplement-focused · evidence-based' },
  { code:'japan', flag:'🇯🇵', label:'Japan',  desc:'Washoku · fish collagen · precision' },
]

// ── Build RAG output from analysis + country ─────────────────
function buildRAG(analysis: RunningAnalysis, country: Country): RAGOutput {
  const rag = getRAGCoaching(analysis.metrics, country, analysis.score)
  return {
    ...rag,
    country,
    nutrition: nutritionKB[country],
  }
}

// ─────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]     = useState<Screen>('dashboard')
  const [analysis, setAnalysis] = useState<RunningAnalysis | null>(null)
  const [ragOutput, setRag]     = useState<RAGOutput | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy]         = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError]       = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData>(offlineDashboard)
  const [country, setCountry]   = useState<Country>('india')
  const [user, setUser]         = useState<AuthUser | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [showRAG, setShowRAG]   = useState(false)
  const [backendState, setBackendState] = useState<BackendState>({ status: 'idle' })
  const _latestFile = useState<File | null>(null)

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl) }, [videoUrl])

  // Auth listener
  useEffect(() => {
    if (!isConfigured) return
    const { data: { subscription } } = auth.onAuthChange((u: any) => {
      setUser(u ? { id: u.id, email: u.email } : null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const refreshDashboard = async () => {
    try { setDashboard(await athleteApi.dashboard()) }
    catch { setDashboard(d => ({ ...d, apiStatus: 'offline' })) }
  }
  useEffect(() => { void refreshDashboard() }, [])

  async function analyse(file: File) {
    setError(null); setBusy(true); setProgress(0); setFileName(file.name)
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(URL.createObjectURL(file))
    try {
      const { samples, duration } = await sampleVideo(file, setProgress)
      const generated = longDistanceRunning.analyse(samples, file.name, duration)
      const rag = buildRAG(generated, country)
      setAnalysis(generated); setRag(rag); setScreen('report'); setShowRAG(false)
      if (generated.readiness === 'ready') {
        const weakest = [...generated.metrics].sort((a, b) => a.score - b.score)[0]
        void athleteApi.saveAnalysis({
          id: generated.id, activityId: longDistanceRunning.id,
          sourceName: generated.sourceName, score: generated.score,
          confidence: generated.confidence, duration: generated.duration,
          createdAt: generated.createdAt, focus: weakest?.label ?? 'Running form',
          country, view: generated.view, viewConfidence: generated.viewConfidence,
          metrics: generated.metrics, footStrike: generated.footStrike, ragOutput: rag,
        }).then(refreshDashboard).catch(() => undefined)
      }
      // Kick off Python backend in parallel (non-blocking)
      setBackendState({ status: 'idle' })
      void runBackendAnalysis(file, country, setBackendState)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed. Please try another video.')
      setScreen('home')
    } finally { setBusy(false) }
  }

  function openDemo() {
    const rag = buildRAG(DEMO, country)
    setAnalysis(DEMO); setRag(rag); setVideoUrl(null)
    setFileName('Demo easy run'); setScreen('report'); setShowRAG(false)
  }

  function downloadReport() {
    if (!analysis) return
    const url = URL.createObjectURL(createRunningReportPdf(analysis, ragOutput, country, fileName))
    const a = document.createElement('a'); a.href = url; a.download = `sportsai-report-${analysis.id}.pdf`; a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <main>
      {/* ── Topbar ── */}
      <header className="topbar">
        <button className="brand" onClick={() => setScreen('dashboard')}>
          <span className="brand-mark"><Activity size={18} /></span>SportsAI<span style={{color:'#54e5b1'}}>+</span>
        </button>
        <nav>
          <button className={screen==='dashboard'?'active':''} onClick={()=>setScreen('dashboard')}>Dashboard</button>
          <button className={screen==='home'?'active':''}      onClick={()=>setScreen('home')}>Form check</button>
          <button className={screen==='plans'?'active':''}     onClick={()=>setScreen('plans')}>Training & fuel</button>
          <button className={screen==='guide'?'active':''}     onClick={()=>setScreen('guide')}>Capture guide</button>
        </nav>
        <div className="topbar-right">
          {/* Country selector */}
          <div className="country-pill">
            <Globe size={14} />
            <select value={country} onChange={e => setCountry(e.target.value as Country)}
              aria-label="Nutrition country">
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}
            </select>
          </div>
          {/* Auth */}
          {isConfigured && (
            user
              ? <button className="auth-chip" onClick={() => auth.signOut()}>
                  <User size={14} />{user.email.split('@')[0]}<LogOut size={13} />
                </button>
              : <button className="auth-chip" onClick={() => setShowAuth(true)}>
                  <LogIn size={14} />Sign in
                </button>
          )}
          <button className="header-link" onClick={openDemo}>View sample <ArrowUpRight size={16} /></button>
        </div>
      </header>

      {/* ── Auth modal ── */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onAuth={u => setUser(u ? { id:u.id, email:u.email } : null)} />}

      {/* ── Toast ── */}
      {error && <div className="toast"><TriangleAlert size={18}/><span>{error}</span><button onClick={()=>setError(null)} aria-label="Dismiss"><X size={16}/></button></div>}

      {/* ── Analysis overlay ── */}
      {busy && (
        <div className="analysis-overlay">
          <div className="analysis-dialog">
            <div className="spinner"/>
            <span className="eyebrow">LOCAL POSE ANALYSIS</span>
            <h2>Reading your running pattern</h2>
            <p>Sampling frames and checking landmark confidence. This stays in your browser.</p>
            <div className="progress"><i style={{width:`${progress}%`}}/></div>
            <strong>{progress}%</strong>
          </div>
        </div>
      )}

      {/* ── Screens ── */}
      {screen==='dashboard' && <Dashboard dashboard={dashboard} country={country} onAnalyse={()=>setScreen('home')} onPlans={()=>setScreen('plans')} user={user} onAuth={()=>setShowAuth(true)} />}
      {screen==='home'      && <Home onFile={analyse} onDemo={openDemo} busy={busy} country={country} setCountry={setCountry} />}
      {screen==='guide'     && <Guide onStart={()=>setScreen('home')} />}
      {screen==='report' && analysis && (
        <Report analysis={analysis} ragOutput={ragOutput} showRAG={showRAG} onToggleRAG={()=>setShowRAG(v=>!v)} videoUrl={videoUrl} fileName={fileName} onNew={()=>setScreen('home')} onDownload={downloadReport} backendState={backendState} />
      )}
      {screen==='plans' && <PlanStudio dashboard={dashboard} country={country} onSaved={refreshDashboard} />}

      <footer>SportsAI+ is a running-form coaching aid. It does not diagnose injury or replace a coach, physio, or clinician.</footer>
    </main>
  )
}

// ── Dashboard ────────────────────────────────────────────────
function Dashboard({ dashboard, country, onAnalyse, onPlans, user, onAuth }: {
  dashboard: DashboardData; country: Country; onAnalyse: () => void; onPlans: () => void
  user: AuthUser | null; onAuth: () => void
}) {
  const history     = dashboard.history.slice(0,6).reverse()
  const latest      = dashboard.history[0]
  const avgScore    = dashboard.history.length ? Math.round(dashboard.history.reduce((t,i)=>t+i.score,0)/dashboard.history.length) : 0
  const scoreDelta  = dashboard.history.length > 1 ? dashboard.history[0].score - dashboard.history[1].score : 0
  const maxScore    = Math.max(...history.map(i=>i.score), 100)
  const liveActivity= dashboard.activities.find(a=>a.status==='live')
  const countryInfo = COUNTRIES.find(c=>c.code===country)!

  return (
    <section className="dashboard-page">
      <div className="dashboard-hero">
        <div className="dashboard-copy">
          <span className="eyebrow"><span className="dot"/>SPORTSAI+ · MOVEMENT INTELLIGENCE</span>
          <h1>Train the <em>pattern,</em><br/>not just the pace.</h1>
          <p>Biomechanics-led video coaching with country-adapted nutrition for endurance runners.</p>
          <div className="dashboard-actions">
            <button className="primary" onClick={onAnalyse}><Zap size={17}/> Analyse a running clip</button>
            <button className="ghost-button" onClick={onPlans}>Open this week <ChevronRight size={17}/></button>
          </div>
          <div className="api-state">
            <span className={dashboard.apiStatus==='connected'?'api-dot live':'api-dot'}/>
            {dashboard.apiStatus==='connected'
              ? (user ? `Synced to cloud · ${user.email}` : 'Connected · local storage')
              : 'Offline preview · sign in to sync across devices'}
            {!user && isConfigured && (
              <button className="inline-auth" onClick={onAuth}><LogIn size={13}/> Sign in</button>
            )}
          </div>
        </div>
        <div className="signal-stage">
          <div className="signal-grid"/><div className="signal-arc arc-one"/><div className="signal-arc arc-two"/>
          <div className="runner-silhouette">
            <i className="runner-head"/><i className="runner-torso"/>
            <i className="runner-arm left"/><i className="runner-arm right"/>
            <i className="runner-leg left"/><i className="runner-leg right"/>
          </div>
          <div className="scan-label label-top"><CircleDot size={13}/>BIOKINEMATIC MODEL</div>
          <div className="scan-label label-bottom"><TrendingUp size={13}/>{latest?`${latest.score}/100 latest form screen`:'READY FOR BASELINE'}</div>
          <div className="stage-metric"><span>Readiness</span><strong>{avgScore||'—'}</strong><small>/100</small></div>
        </div>
      </div>

      {/* Country nutrition strip */}
      <div className="country-strip">
        <span className="eyebrow"><Globe size={13}/> ACTIVE NUTRITION COUNTRY</span>
        <div className="country-strip-row">
          {COUNTRIES.map(c => (
            <div key={c.code} className={`country-chip ${country===c.code?'active':''}`}>
              {c.flag} {c.label}<small>{c.desc}</small>
            </div>
          ))}
        </div>
        <p className="country-strip-note">
          <strong>{countryInfo.flag} {countryInfo.label} mode active.</strong> After each analysis, the AI coaching panel shows drills, injury risk, and nutrition adapted for {countryInfo.label}.
        </p>
      </div>

      <div className="dashboard-stats">
        <article><span>Current focus</span><strong>{latest?.focus??'Set your baseline'}</strong><small>{latest?`${latest.confidence}% landmark confidence`:'Upload your first side-view clip'}</small></article>
        <article><span>Form trend</span><strong>{scoreDelta>0?'+':''}{scoreDelta||'—'} pts</strong><small>{dashboard.history.length>1?'versus prior screen':'two screens establish a trend'}</small></article>
        <article><span>Training intent</span><strong>{dashboard.profile.targetEvent}</strong><small>{dashboard.profile.weeklyDistanceKm} km weekly · {dashboard.profile.preferredIntensity} focus</small></article>
      </div>

      <div className="dashboard-section-heading">
        <div><span className="eyebrow">ACTIVITY ARCHITECTURE</span><h2>One platform. Sport-specific logic.</h2></div>
        <p>Every sport carries its own capture protocol, movement model, and coaching language.</p>
      </div>
      <div className="activity-catalog">
        {dashboard.activities.map(activity => (
          <article className={`activity-tile ${activity.status}`} key={activity.id} style={{'--activity-accent':activity.accent} as React.CSSProperties}>
            <div className="activity-tile-top"><span>{activity.family}</span>{activity.status==='live'?<b><span className="live-dot"/>Live now</b>:activity.status==='next'?<b>Next module</b>:<LockKeyhole size={15}/>}</div>
            <h3>{activity.name}</h3><p>{activity.description}</p>
            <div className="activity-focus">{activity.measureFocus.map(f=><span key={f}>{f}</span>)}</div>
            <small><Cpu size={13}/>{activity.captureFocus}</small>
            {activity.status==='live'&&<button onClick={onAnalyse}>Open form lab <ChevronRight size={15}/></button>}
          </article>
        ))}
      </div>

      <div className="dashboard-lower">
        <section className="trend-panel">
          <div className="panel-heading"><div><span className="eyebrow">MOVEMENT QUALITY</span><h2>Form screen history</h2></div><ChartNoAxesCombined size={22}/></div>
          {history.length
            ? <div className="score-chart"><div className="chart-grid"/>{history.map((item,i)=><div className="chart-column" key={item.id} style={{height:`${Math.max(24,item.score/maxScore*100)}%`}}><i/><span>{item.score}</span><small>{i===history.length-1?'Latest':`Run ${i+1}`}</small></div>)}</div>
            : <p className="empty-state">Your form-screen trend appears here after the first analysis.</p>}
          <div className="chart-caption"><span><i/> Score uses only the measures available for that camera view</span><span>{history.length} saved screens</span></div>
        </section>
        <section className="week-panel">
          <div className="panel-heading"><div><span className="eyebrow">TRAINING RHYTHM</span><h2>Next seven days</h2></div><button onClick={onPlans}>View plan <ArrowUpRight size={15}/></button></div>
          <div className="week-list">{dashboard.trainingWeek.slice(0,4).map(s=><article key={s.day}><span>{s.day}</span><div><b>{s.title}</b><small>{s.detail}</small></div><i className={s.kind}/></article>)}</div>
        </section>
      </div>
      {liveActivity&&<aside className="dashboard-note"><Route size={19}/><p><b>Running is the active module.</b> Its scorer works from 33 MediaPipe landmarks and stores only report summaries—not uploaded video.</p><button onClick={onAnalyse}>Start a running form check <ChevronRight size={16}/></button></aside>}
    </section>
  )
}

// ── Home ─────────────────────────────────────────────────────
function Home({ onFile, onDemo, busy, country, setCountry }: { onFile:(f:File)=>void; onDemo:()=>void; busy:boolean; country:Country; setCountry:(c:Country)=>void }) {
  return (
    <>
      <div className="home-grid">
        <div>
          <div className="home-country-selector">
            <p className="eyebrow"><Globe size={13}/> NUTRITION COUNTRY</p>
            <div className="home-country-btns">
              {COUNTRIES.map(c=>(
                <button key={c.code} className={country===c.code?'selected':''} onClick={()=>setCountry(c.code)}>
                  {c.flag} {c.label}<small>{c.desc}</small>
                </button>
              ))}
            </div>
          </div>
          <Capture onFile={onFile} busy={busy}/>
        </div>
        <section className="visual-card">
          <div className="route-line route-one"/><div className="route-line route-two"/>
          <div className="runner-figure"><span className="head"/><i className="body"/><i className="arm arm-one"/><i className="arm arm-two"/><i className="leg leg-one"/><i className="leg leg-two"/></div>
          <div className="visual-copy"><span>FORM, NOT FITNESS</span><strong>Small corrections add up over long miles.</strong></div>
          <button className="demo-button" onClick={onDemo}><Play size={15} fill="currentColor"/> Explore a sample report</button>
        </section>
      </div>
      <section className="trust-row">
        <div><ShieldCheck size={21}/><span><b>Private by design</b>Your video is processed locally</span></div>
        <div><Gauge size={21}/><span><b>Transparent signals</b>See the measurements behind each cue</span></div>
        <div><Globe size={21}/><span><b>Country nutrition</b>India · USA · Japan knowledge bases</span></div>
      </section>
    </>
  )
}

// ── Guide ─────────────────────────────────────────────────────
function Guide({ onStart }: { onStart: () => void }) {
  return (
    <section className="guide-page">
      <div>
        <span className="eyebrow"><span className="dot"/>A BETTER INPUT MAKES A BETTER CUE</span>
        <h1>Set up your clip<br/><em>like a coach would.</em></h1>
        <p className="lead">This release is focused on long-distance running. A stable full-body side view is best for foot-contact feedback.</p>
        <button className="primary" onClick={onStart}>Start a form check <ChevronRight size={18}/></button>
      </div>
      <div className="guide-list">
        {longDistanceRunning.captureGuide.map((item,i)=><article key={item}><span>0{i+1}</span><p>{item}</p><Check size={20}/></article>)}
      </div>
      <aside><Info size={19}/><p>Landmark-based video analysis is sensitive to camera angle, occlusion, lighting, and clothing.</p></aside>
    </section>
  )
}

// ── Report ────────────────────────────────────────────────────
function Report({ analysis, ragOutput, showRAG, onToggleRAG, videoUrl, fileName, onNew, onDownload, backendState }: {
  analysis: RunningAnalysis; ragOutput: RAGOutput | null; showRAG: boolean; onToggleRAG: () => void
  videoUrl: string | null; fileName: string; onNew: () => void; onDownload: () => void
  backendState: BackendState
}) {
  const focus = useMemo(() => [...analysis.metrics].sort((a,b)=>a.score-b.score)[0], [analysis.metrics])
  if (analysis.readiness==='limited') return (
    <section className="limited">
      <TriangleAlert size={42}/><span className="eyebrow">ANALYSIS PAUSED</span>
      <h1>We need a clearer running view.</h1>
      {analysis.notes.map(n=><p key={n}>{n}</p>)}
      <button className="primary" onClick={onNew}>Try another clip <ChevronRight size={18}/></button>
    </section>
  )
  const viewLabel = analysis.view==='front'?'frontal':analysis.view??'unclassified'
  return (
    <section className="report-page">
      <div className="report-header">
        <div>
          <span className="eyebrow"><span className="dot"/>RUNNING FORM REPORT</span>
          <h1>Your easy-run form,<br/><em>made actionable.</em></h1>
          <p className="subtle">{fileName||analysis.sourceName} · {Math.round(analysis.duration)} sec · {analysis.confidence}% landmark confidence · {viewLabel} view ({analysis.viewConfidence??0}% confidence)</p>
        </div>
        <div className={`score-orb ${scoreTone(analysis.score)}`}>
          <span>Form score</span><strong>{analysis.score}</strong><small>/100</small>
        </div>
      </div>

      <div className="report-layout">
        <div className="replay-card">
          {videoUrl&&analysis.samples.length
            ?<PosePlayback videoUrl={videoUrl} samples={analysis.samples}/>
            :<div className="demo-replay"><span className="eyebrow">SAMPLE REPORT</span><b>Upload a clip to see your own pose overlay.</b><div className="mini-runner"/></div>}
          <div className="replay-footer">
            <span><Timer size={16}/> {Math.round(analysis.duration)} sec screened</span>
            <span><ShieldCheck size={16}/> Video not uploaded</span>
          </div>
        </div>
        <aside className="next-cue">
          <span className="eyebrow">YOUR NEXT CUE</span>
          <h2>{focus?.cue}</h2>
          <p>Work on one thing at a time. Use this cue during 2 × 30 seconds of relaxed strides, then recheck an easy run.</p>
          <button className="text-button" onClick={onNew}>Analyse another clip <ChevronRight size={17}/></button>
        </aside>
      </div>

      <FootStrikeCard assessment={analysis.footStrike}/>

      <div className="metric-heading">
        <div><span className="eyebrow">FORM SIGNALS</span><h2>What the video showed</h2></div>
        <div style={{display:'flex',gap:'8px'}}>
          <button className="secondary compact" onClick={onDownload}><Download size={16}/> Download PDF</button>
          {ragOutput && (
            <button className="secondary compact" onClick={onToggleRAG} style={{background:showRAG?'#54e5b122':'',borderColor:showRAG?'#54e5b1':''}}>
              <Sparkles size={16}/> {showRAG?'Hide':'Show'} AI Coaching + Nutrition
            </button>
          )}
        </div>
      </div>

      <div className="metrics-grid">
        {analysis.metrics.map(item=>(
          <article className={`metric-card ${item.status}`} key={item.id}>
            <div className="metric-top"><span>{item.label}</span><b>{item.score}</b></div>
            <div className="bar"><i style={{width:`${item.score}%`}}/></div>
            <strong>{item.value}</strong><p>{item.description}</p>
            <div className="cue"><Sparkles size={15}/>{item.cue}</div>
          </article>
        ))}
      </div>

      {showRAG && ragOutput && <RAGPanel rag={ragOutput}/>}

      <CoachFeedback metrics={analysis.metrics}/>
      <ActionPlan metrics={analysis.metrics}/>

      {/* ── Python Backend Analysis ── */}
      {backendState.status === 'running' && (
        <AnalysisProgress status="processing" stage={backendState.stage} />
      )}
      {backendState.status === 'failed' && (
        <AnalysisProgress status="failed" stage="Failed" error={backendState.error} />
      )}
      {backendState.status === 'done' && (
        <BackendAnalysisPanel result={backendState.result} />
      )}

      <div className="report-notes">{analysis.notes.map(n=><p key={n}><Info size={16}/>{n}</p>)}</div>
    </section>
  )
}

// ── PlanStudio ────────────────────────────────────────────────
function PlanStudio({ dashboard, country, onSaved }: { dashboard: DashboardData; country: Country; onSaved: () => void }) {
  const [profile, setProfile] = useState<AthleteProfile>(dashboard.profile)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  useEffect(()=>{ setProfile(dashboard.profile) }, [dashboard.profile])
  const fp: FuelProfile = { heightCm:170, weightKg:profile.weightKg, durationMinutes:60, intensity:profile.preferredIntensity }
  const fuel = useMemo(()=>buildFuelPlan(fp), [fp.weightKg, fp.intensity])
  const update = (k: keyof AthleteProfile, v: string|number) => setProfile(p=>({...p,[k]:v}))
  const save = async () => {
    setSaving(true); setSaved(false)
    try { const saved = await athleteApi.profile(profile); setProfile(saved); setSaved(true); await onSaved() }
    catch { setSaved(false) } finally { setSaving(false) }
  }

  const nut = nutritionKB[country]
  const countryInfo = COUNTRIES.find(c=>c.code===country)!

  return (
    <section className="plans-page">
      <div className="plans-heading">
        <span className="eyebrow"><span className="dot"/>TRAINING SYSTEM · LONG-DISTANCE RUNNING</span>
        <h1>Build the week<br/>around the <em>runner.</em></h1>
        <p>Adjust the athlete context once. The backend saves it and feeds the weekly rhythm and fuelling guidance.</p>
      </div>
      <div className="profile-plans-grid">
        <section className="athlete-profile-card">
          <div className="profile-title"><div><span className="eyebrow">ATHLETE PROFILE</span><h2>Training context</h2></div><span className="profile-chip">{isConfigured?'Cloud profile':'Local profile'}</span></div>
          <div className="profile-form">
            <label>Name<input value={profile.displayName} onChange={e=>update('displayName',e.target.value)}/></label>
            <label>Target event<input value={profile.targetEvent} onChange={e=>update('targetEvent',e.target.value)}/></label>
            <label className="wide">Primary goal<input value={profile.goal} onChange={e=>update('goal',e.target.value)}/></label>
            <label>Weekly distance<div><input type="number" min="0" max="300" value={profile.weeklyDistanceKm} onChange={e=>update('weeklyDistanceKm',Number(e.target.value))}/><span>km</span></div></label>
            <label>Body mass<div><input type="number" min="30" max="250" value={profile.weightKg} onChange={e=>update('weightKg',Number(e.target.value))}/><span>kg</span></div></label>
            <fieldset className="wide"><legend>Typical training intensity</legend>
              <div className="plan-intensities">{(['easy','moderate','hard'] as TrainingIntensity[]).map(i=><button type="button" key={i} className={profile.preferredIntensity===i?'selected':''} onClick={()=>update('preferredIntensity',i)}>{i}</button>)}</div>
            </fieldset>
          </div>
          <div className="profile-save">
            <span>{saved?'Saved to your athlete workspace.':'Only report summaries and your profile are stored.'}</span>
            <button className="primary compact-save" disabled={saving} onClick={save}>{saving?'Saving…':'Save training context'} <ChevronRight size={16}/></button>
          </div>
        </section>

        <section className="fuel-spotlight">
          <div>
            <span className="eyebrow">FUELLING SNAPSHOT · {countryInfo.flag} {countryInfo.label.toUpperCase()}</span>
            <h2>Train well.<br/><em>Recover ready.</em></h2>
            <p>General sport-nutrition starting ranges adapted for {countryInfo.label}. Tailor with a registered sports dietitian.</p>
          </div>
          <div className="fuel-figures">
            <article><span>Daily carbohydrate</span><strong>{fuel.carbohydrate}</strong></article>
            <article><span>Daily protein</span><strong>{fuel.protein}</strong></article>
          </div>
          <div className="fuel-lines">
            <p><b>Before:</b> {nut.preRun[0]}</p>
            <p><b>After:</b>  {nut.postRun[0]}</p>
            <p><b>Budget meal:</b> {nut.budgetMeal}</p>
          </div>
          {/* Supplement quick list */}
          <div className="fuel-sups">
            <p className="eyebrow" style={{marginBottom:'6px'}}>KEY SUPPLEMENTS</p>
            {nut.supplements.slice(0,3).map(s=>(
              <div key={s.name} className="fuel-sup-row">
                <b>{s.name}</b><span>{s.dose}</span><small>{s.reason}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="weekly-plan">
        <div className="weekly-plan-heading"><div><span className="eyebrow">ADAPTIVE MICRO-CYCLE</span><h2>This week's movement menu</h2></div><p>Intensity distributed: quality runs buffered by easy and recovery days.</p></div>
        <div className="week-strip">{dashboard.trainingWeek.map(s=><article className={s.kind} key={s.day}><span>{s.day}</span><h3>{s.title}</h3><p>{s.detail}</p><i/></article>)}</div>
      </section>
      <NutritionChat country={country} />
      <aside className="plans-guardrail"><Info size={18}/><p><b>Coaching support, not medical clearance.</b> Reduce or stop training for pain, unexplained fatigue, or dizziness.</p></aside>
    </section>
  )
}
