import type { Metric, MetricId } from '../types'

export type Drill = {
  id: string
  title: string
  focus: string
  dose: string
  frequency: string
  cue: string
}

const drillLibrary: Record<MetricId, Drill[]> = {
  posture: [
    { id: 'wall-lean-march', title: 'Wall-lean march', focus: 'Feel a whole-body lean from the ankles.', dose: '2 sets x 20 seconds', frequency: 'Before 2 easy runs/week', cue: 'Keep your body long; do not bend at the waist.' },
    { id: 'relaxed-strides', title: 'Relaxed posture strides', focus: 'Carry the same stacked posture into running.', dose: '4 x 15 seconds, walk back', frequency: 'After an easy run', cue: 'Tall through the crown, ribs over hips, shoulders soft.' },
  ],
  pelvis: [
    { id: 'bridge-march', title: 'Bridge march', focus: 'Build hip control without adding impact.', dose: '2 sets x 8/side', frequency: '2 non-consecutive days/week', cue: 'Keep the pelvis level; stop before your back arches.' },
    { id: 'single-leg-stand', title: 'Single-leg stand', focus: 'Practice quiet hip control.', dose: '2 x 30 seconds/side', frequency: 'Most days', cue: 'Stand tall and keep the pelvis level; use a wall for support.' },
  ],
  footPlacement: [
    { id: 'quick-feet-strides', title: 'Quick-feet strides', focus: 'Explore a quicker, lighter contact without forcing a short stride.', dose: '6 x 20 seconds, 60 seconds easy walk/jog', frequency: 'After a short easy run', cue: 'Let the foot land near you; keep the effort relaxed.' },
    { id: 'ankle-march', title: 'Ankle march', focus: 'Rehearse landing under the body.', dose: '2 x 15 metres', frequency: 'Warm-up, 2-3 times/week', cue: 'Lift from the hip and place the foot quietly beneath you.' },
  ],
  head: [
    { id: 'tall-run-reset', title: 'Tall-run reset', focus: 'Release forward head tension while running.', dose: '3 x 30 seconds easy', frequency: 'During easy runs', cue: 'Look ahead, soften the jaw, and lengthen the back of the neck.' },
    { id: 'wall-posture-reset', title: 'Wall posture reset', focus: 'Find a neutral head-over-ribs position.', dose: '3 slow breaths x 3', frequency: 'Before running', cue: 'Touch your upper back lightly to the wall without forcing your head back.' },
  ],
  armSwing: [
    { id: 'relaxed-arm-swing', title: 'Relaxed arm-swing walk', focus: 'Rehearse a compact hand path without running impact.', dose: '2 x 30 seconds', frequency: 'Before 2 easy runs/week', cue: 'Soft elbows; swing the hands back and forward beside the body.' },
    { id: 'arm-swing-strides', title: 'Easy arm-swing strides', focus: 'Carry relaxed arms into your running rhythm.', dose: '4 x 15 seconds, walk back', frequency: 'After an easy run', cue: 'Let the shoulders stay quiet and the elbows remain gently bent.' },
  ],
  symmetry: [
    { id: 'controlled-step-down', title: 'Controlled step-down', focus: 'Build side-to-side control at a low load.', dose: '2 sets x 6/side', frequency: '2 days/week, pain-free only', cue: 'Keep the knee tracking comfortably over the middle toes.' },
    { id: 'easy-symmetry-check', title: 'Easy-run symmetry check', focus: 'Compare feel, not just the score.', dose: '2 x 30 seconds at easy pace', frequency: 'Once per week', cue: 'If asymmetry or pain persists, pause drills and seek professional advice.' },
  ],
}

export function planForMetrics(metrics: Metric[]): Drill[] {
  const needsWork = [...metrics].filter((metric) => metric.status !== 'good').sort((a, b) => a.score - b.score)
  const primary = needsWork[0] ?? metrics[0]
  const secondary = needsWork[1]
  const selected = [primary, secondary].filter(Boolean).flatMap((metric) => drillLibrary[metric!.id])
  return selected.slice(0, 4)
}
