import { Footprints, Info } from 'lucide-react'
import type { FootStrikeAssessment } from '../types'

export function FootStrikeCard({ assessment }: { assessment: FootStrikeAssessment }) {
  const label = assessment.classification === 'inconclusive' ? 'Inconclusive' : assessment.classification === 'rearfoot' ? 'Rearfoot / heel-first' : assessment.classification === 'midfoot' ? 'Midfoot' : 'Forefoot / toe-first'
  const landing = assessment.landing === 'ahead-of-body' ? 'Landing ahead of body' : assessment.landing === 'under-body' ? 'Landing close to body' : 'Landing position unclear'
  return <section className={`foot-strike-card ${assessment.classification}`}><div className="foot-strike-title"><Footprints size={22} /><div><span className="eyebrow">FOOT-CONTACT SCREEN</span><h2>{label}</h2></div>{assessment.classification !== 'inconclusive' && <div className="contact-confidence"><strong>{assessment.confidence}%</strong><span>strike confidence</span></div>}</div><p>{assessment.message}</p>{assessment.correction && <div className={`contact-correction ${assessment.landing}`}><b>{landing}{assessment.landingConfidence ? ` · ${assessment.landingConfidence}% confidence` : ''}</b><span>{assessment.correction}</span></div>}<div className="strike-facts"><span><b>{assessment.contacts}</b> contact frames screened</span><span><Info size={14} /> Rearfoot, midfoot, and forefoot patterns are not graded as good or bad.</span></div></section>
}
