import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const root = dirname(fileURLToPath(import.meta.url))
const storePath = join(root, 'data', 'athlete-store.json')
const distPath = join(root, 'dist')
const port = Number(process.env.PORT ?? 8787)

const activities = [
  { id: 'long-distance-running', name: 'Long-distance running', family: 'Endurance', status: 'live', description: 'Cadence-aware form screens for relaxed, efficient mileage.', measureFocus: ['Trunk stack', 'Contact placement', 'Stride symmetry'], captureFocus: 'Side view · 10–20 seconds · full body', accent: '#54e5b1' },
  { id: 'sprint', name: 'Sprint mechanics', family: 'Track', status: 'next', description: 'Acceleration, max-velocity posture, and front-side mechanics.', measureFocus: ['Projection angle', 'Step frequency', 'Front-side action'], captureFocus: 'Side view · 60–120 fps', accent: '#ff765f' },
  { id: 'long-jump', name: 'Long jump', family: 'Jumps', status: 'planned', description: 'Approach rhythm, take-off posture, and landing control.', measureFocus: ['Approach rhythm', 'Take-off angle', 'Landing sequence'], captureFocus: 'Side view · runway to landing', accent: '#f5c66d' },
  { id: 'shot-put', name: 'Shot put', family: 'Throws', status: 'planned', description: 'Glide or rotational sequencing, block, and release position.', measureFocus: ['Hip–shoulder separation', 'Block', 'Release path'], captureFocus: 'Rear-oblique view · full circle', accent: '#6da9ff' },
  { id: 'discus', name: 'Discus throw', family: 'Throws', status: 'planned', description: 'Entry balance, orbit, delivery rhythm, and release.', measureFocus: ['Orbit control', 'Separation', 'Delivery rhythm'], captureFocus: 'Rear-oblique view · full circle', accent: '#c9a7ff' },
  { id: 'javelin', name: 'Javelin throw', family: 'Throws', status: 'planned', description: 'Run-up rhythm, impulse stride, block, and arm path.', measureFocus: ['Impulse stride', 'Block side', 'Release angle'], captureFocus: 'Side view · whole runway', accent: '#78d5ff' },
]

const trainingWeek = [
  { day: 'MON', title: 'Easy aerobic', detail: '45 min conversational · keep the next cue gentle', kind: 'easy' },
  { day: 'TUE', title: 'Control strength', detail: '20 min · bridge march + controlled step-down', kind: 'strength' },
  { day: 'WED', title: 'Steady progression', detail: '10 min easy + 20 min steady + 10 min easy', kind: 'quality' },
  { day: 'THU', title: 'Recovery', detail: 'Rest or 25 min very easy walk/jog', kind: 'recovery' },
  { day: 'FRI', title: 'Easy + strides', detail: '35 min easy + 4 × 15 sec relaxed strides', kind: 'easy' },
  { day: 'SAT', title: 'Long easy run', detail: '60 min easy · practise your fueling routine', kind: 'quality' },
  { day: 'SUN', title: 'Recovery reset', detail: 'Mobility and an optional 20 min walk', kind: 'recovery' },
]

function seedStore() {
  const now = Date.now()
  return {
    profile: { displayName: 'Runner', goal: 'Build relaxed long-run efficiency', targetEvent: 'Half marathon', weeklyDistanceKm: 32, weightKg: 65, preferredIntensity: 'moderate', updatedAt: new Date().toISOString() },
    history: [
      { id: 'starter-1', activityId: 'long-distance-running', sourceName: 'Easy run baseline', score: 76, confidence: 91, duration: 14, createdAt: new Date(now - 6 * 86400000).toISOString(), focus: 'Contact placement' },
      { id: 'starter-2', activityId: 'long-distance-running', sourceName: 'Easy run recheck', score: 80, confidence: 90, duration: 16, createdAt: new Date(now - 2 * 86400000).toISOString(), focus: 'Pelvic stability' },
    ],
  }
}

async function loadStore() {
  try { return JSON.parse(await readFile(storePath, 'utf8')) } catch { const store = seedStore(); await saveStore(store); return store }
}

async function saveStore(store) { await mkdir(dirname(storePath), { recursive: true }); await writeFile(storePath, JSON.stringify(store, null, 2)) }

function send(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' })
  response.end(JSON.stringify(payload))
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = []
    request.on('data', (chunk) => { size += chunk.length; if (size > 1_000_000) { reject(new Error('Request body is too large')); request.destroy() } else chunks.push(chunk) })
    request.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) } catch { reject(new Error('Request body must be valid JSON')) } })
    request.on('error', reject)
  })
}

function profileFrom(payload, current) {
  const number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback
  const string = (value, fallback, max = 100) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback
  return {
    displayName: string(payload.displayName, current.displayName, 40), goal: string(payload.goal, current.goal, 120), targetEvent: string(payload.targetEvent, current.targetEvent, 60),
    weeklyDistanceKm: number(payload.weeklyDistanceKm, current.weeklyDistanceKm, 0, 300), weightKg: number(payload.weightKg, current.weightKg, 30, 250),
    preferredIntensity: ['easy', 'moderate', 'hard'].includes(payload.preferredIntensity) ? payload.preferredIntensity : current.preferredIntensity, updatedAt: new Date().toISOString(),
  }
}

function analysisFrom(payload) {
  const number = (value, min, max) => Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : null
  const text = (value, max) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
  const score = number(payload.score, 0, 100); const confidence = number(payload.confidence, 0, 100); const duration = number(payload.duration, 0, 1800); const sourceName = text(payload.sourceName, 120); const focus = text(payload.focus, 120)
  if (score === null || confidence === null || duration === null || !sourceName || !focus || payload.activityId !== 'long-distance-running') return null
  return { id: randomUUID(), activityId: payload.activityId, sourceName, score: Math.round(score), confidence: Math.round(confidence), duration, focus, createdAt: new Date().toISOString() }
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' }
function serveStatic(request, response, pathname) {
  if (!existsSync(distPath)) return send(response, 404, { error: 'Frontend build not found. Run npm run build, or use npm run dev:all.' })
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const candidate = normalize(join(distPath, requested)); const isInsideDist = candidate === distPath || candidate.startsWith(`${distPath}${sep}`); const safe = isInsideDist && existsSync(candidate) ? candidate : join(distPath, 'index.html')
  response.writeHead(200, { 'Content-Type': mime[extname(safe)] ?? 'application/octet-stream', 'Cache-Control': safe.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable' })
  createReadStream(safe).pipe(response)
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  if (request.method === 'OPTIONS') return send(response, 204, {})
  try {
    if (request.method === 'GET' && url.pathname === '/api/health') return send(response, 200, { status: 'ok', storage: 'local-json', version: '1.0.0' })
    if (request.method === 'GET' && url.pathname === '/api/dashboard') { const store = await loadStore(); return send(response, 200, { ...store, activities, trainingWeek }) }
    if (request.method === 'GET' && url.pathname === '/api/activities') return send(response, 200, activities)
    if (request.method === 'GET' && url.pathname === '/api/profile') return send(response, 200, (await loadStore()).profile)
    if (request.method === 'PUT' && url.pathname === '/api/profile') { const store = await loadStore(); store.profile = profileFrom(await readJson(request), store.profile); await saveStore(store); return send(response, 200, store.profile) }
    if (request.method === 'GET' && url.pathname === '/api/analyses') return send(response, 200, (await loadStore()).history)
    if (request.method === 'POST' && url.pathname === '/api/analyses') { const store = await loadStore(); const analysis = analysisFrom(await readJson(request)); if (!analysis) return send(response, 422, { error: 'A valid long-distance-running analysis summary is required.' }); store.history.unshift(analysis); store.history = store.history.slice(0, 30); await saveStore(store); return send(response, 201, analysis) }
    if (request.method === 'GET' && url.pathname === '/api/plan') return send(response, 200, trainingWeek)
    if (url.pathname.startsWith('/api/')) return send(response, 404, { error: 'Unknown API route' })
    return serveStatic(request, response, url.pathname)
  } catch (error) { return send(response, 400, { error: error instanceof Error ? error.message : 'Bad request' }) }
})

server.listen(port, '127.0.0.1', () => console.log(`Stridewise API listening on http://127.0.0.1:${port}`))
