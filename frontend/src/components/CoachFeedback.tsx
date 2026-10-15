import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Metric } from '../types'

type Message = { title: string; observed: string; correction: string }

const explain: Record<string, Omit<Message, 'title'>> = {
  posture: { observed: 'Your upper body is leaning too much or too little instead of moving as one tall line.', correction: 'Stand tall, then lean your whole body slightly forward from the ankles. Do not bend at the waist.' },
  pelvis: { observed: 'The side-view screen found repeated vertical pelvic movement beyond the app’s conservative threshold.', correction: 'Think forward, not upward. Let the belt line travel smoothly forward while keeping the legs and shoulders relaxed.' },
  footPlacement: { observed: 'One foot reaches too far in front of your hips on some steps.', correction: 'Let the foot touch down closer under your body. Keep the stride relaxed; do not force tiny steps.' },
  head: { observed: 'Your head moves ahead of your shoulders at times.', correction: 'Look ahead softly, relax your jaw, and make the back of your neck long.' },
  armSwing: { observed: 'Your hand path or elbow bend is less compact than an efficient distance-running pattern in this clip.', correction: 'Keep a natural 70–120° elbow bend and drive the elbows gently back. Let relaxed hands travel backward and forward beside the lower ribs, below shoulder height.' },
  symmetry: { observed: 'The two sides do not move as evenly as we would like in this clip.', correction: 'Keep your effort easy and use the control drills. Stop if you have pain or a persistent uneven feeling.' },
}

export function CoachFeedback({ metrics }: { metrics: Metric[] }) {
  const messages = useMemo<Message[]>(() => {
    const needsWork = metrics.filter((metric) => metric.status !== 'good').sort((a, b) => a.score - b.score)
    if (!needsWork.length) return [{ title: 'Good baseline', observed: 'This clip did not show a major form issue in the screened signals.', correction: 'Keep the same relaxed effort and check another easy run when you are fresh.' }]
    return needsWork.slice(0, 3).map((metric) => ({ title: metric.label, observed: metric.description, correction: metric.cue }))
  }, [metrics])
  const script = useMemo(() => ['Here is your running form summary.', ...messages.flatMap((message) => [`${message.title}. ${message.observed}`, `Try this. ${message.correction}`]), 'Work on one cue at a time, and stop if you feel pain.'].join(' '), [messages])
  const [muted, setMuted] = useState(false); const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const stop = () => { if (supported) window.speechSynthesis.cancel(); setSpeaking(false) }
  const speak = () => {
    if (!supported || muted) return
    stop(); const utterance = new SpeechSynthesisUtterance(script); utterance.rate = 0.9; utterance.pitch = 1
    utterance.onend = () => setSpeaking(false); utterance.onerror = () => setSpeaking(false); window.speechSynthesis.speak(utterance); setSpeaking(true)
  }
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel() }, [supported])
  const toggleMute = () => { if (!muted) stop(); setMuted((value) => !value) }

  return <section className="coach-feedback"><div className="coach-heading"><div><span className="eyebrow">SIMPLE FORM EXPLANATION</span><h2>What to change next</h2><p>Read the short version or let the coach voice explain it.</p></div><div className="voice-controls"><button className="voice-play" disabled={muted || !supported} onClick={speaking ? stop : speak}>{speaking ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}{speaking ? 'Stop coach' : 'Play coach voice'}</button><button className={muted ? 'voice-mute selected' : 'voice-mute'} onClick={toggleMute} aria-pressed={muted}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}{muted ? 'Voice muted' : 'Mute voice'}</button></div></div>
    {!supported && <p className="voice-unavailable">Voice coaching is not available in this browser. The full simple-language guidance is shown below.</p>}
    <div className="mistakes-grid">{messages.map((message) => <article key={message.title}><h3>{message.title}</h3><div><span>What we saw</span><p>{message.observed}</p></div><div><span>What to do</span><p>{message.correction}</p></div></article>)}</div>
  </section>
}
