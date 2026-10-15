export type TrainingIntensity = 'easy' | 'moderate' | 'hard'

export type FuelProfile = { heightCm: number; weightKg: number; intensity: TrainingIntensity; durationMinutes: number }

export type FuelPlan = {
  carbohydrate: string
  protein: string
  session: string
  before: string
  during: string
  after: string
  note: string
}

const carbRanges: Record<TrainingIntensity, [number, number]> = { easy: [3, 5], moderate: [5, 7], hard: [6, 8] }

const grams = (kg: number, range: [number, number]) => `${Math.round(kg * range[0])}-${Math.round(kg * range[1])} g/day`

export function buildFuelPlan(profile: FuelProfile): FuelPlan {
  const carbs = carbRanges[profile.intensity]
  const proteinRange: [number, number] = profile.intensity === 'hard' ? [1.6, 1.8] : [1.4, 1.6]
  const isLong = profile.durationMinutes > 60
  const isKeySession = profile.intensity !== 'easy' || profile.durationMinutes >= 60
  return {
    carbohydrate: grams(profile.weightKg, carbs),
    protein: grams(profile.weightKg, proteinRange),
    session: `${profile.intensity[0].toUpperCase()}${profile.intensity.slice(1)} · ${profile.durationMinutes} min`,
    before: isKeySession ? '1-3 hours before: choose a familiar carbohydrate-led meal or snack with some protein and low-to-moderate fibre. Example: idli with fruit, or oats with milk/soy milk and banana.' : 'For an easy short run, eat your usual balanced meal pattern. A small familiar snack is optional if you are hungry.',
    during: isLong ? 'For sessions over 60 minutes, practise taking 30-60 g carbohydrate each hour; start with the lower end and test it in training. Water and sodium needs vary with heat and sweat loss.' : 'Water to thirst is generally a practical starting point. Carry fluid in heat or when you know you sweat heavily.',
    after: isKeySession ? `Within a few hours, have a carbohydrate-rich meal plus about ${Math.round(profile.weightKg * 0.3)} g protein. Example: rice or roti with dal, vegetables, and eggs, dairy, paneer, or soy.` : 'At the next meal, include carbohydrate, a protein food, colourful vegetables or fruit, and a source of healthy fat.',
    note: `Profile: ${profile.heightCm} cm, ${profile.weightKg} kg. Carbohydrate and protein are weight-based because body mass better scales these starting targets; height is kept as profile context, not used to prescribe weight loss or calories.`,
  }
}
