import type { Country } from './supabaseApi'
import indiaRunner from '../data/nutrition/india/runner_nutrition_india.txt?raw'
import indiaTendon from '../data/nutrition/india/tendon_bone.txt?raw'
import japanRunner from '../data/nutrition/japan/runner_nutrition_japan.txt?raw'
import japanFermented from '../data/nutrition/japan/fermented_foods.txt?raw'
import usaRunner from '../data/nutrition/usa/runner_nutrition_usa.txt?raw'
import usaRecovery from '../data/nutrition/usa/collagen_recovery.txt?raw'
import usaAntiInflammatory from '../data/nutrition/usa/anti_inflammatory.txt?raw'
import commonGuide from '../data/nutrition/common/sports_nutrition_basics.txt?raw'

type Passage = { text: string; source: string; url?: string }
export type NutritionAnswer = { passages: Passage[]; found: boolean }
export type NutritionConstraints = { allergens: string[]; excludedFoods: string[]; dietaryPatterns: string[] }

// The browser retrieves the shared plain-text corpus locally, so no API key or
// external model is required. Python's prototype reads these same files.
const knowledgeFiles: Record<Country, { path: string; text: string }[]> = {
  india: [
    { path: 'india/runner_nutrition_india.txt', text: indiaRunner },
    { path: 'india/tendon_bone.txt', text: indiaTendon },
  ],
  japan: [
    { path: 'japan/runner_nutrition_japan.txt', text: japanRunner },
    { path: 'japan/fermented_foods.txt', text: japanFermented },
  ],
  usa: [
    { path: 'usa/runner_nutrition_usa.txt', text: usaRunner },
    { path: 'usa/collagen_recovery.txt', text: usaRecovery },
    { path: 'usa/anti_inflammatory.txt', text: usaAntiInflammatory },
  ],
}
const commonPassage = { path: 'common/sports_nutrition_basics.txt', text: commonGuide }

const STOP_WORDS = new Set(['about','after','also','and','are','can','could','does','for','from','how','into','is','meal','my','should','some','that','the','their','there','this','through','what','when','with','would','you','your'])
const LOW_CONFIDENCE_CLAIMS = /ashwagandha|collagen|nattokinase|creatine|caffeine|magnesium|clinically proven|2000%|vo2max|lactic acid|reduces doms|thirst means|mandatory/i
const ALLERGEN_TERMS: Record<string, RegExp> = {
  peanuts: /\bpeanuts?|groundnuts?\b/i,
  'tree nuts': /\b(?:nuts?|almonds?|cashews?|walnuts?|pistachios?|hazelnuts?|pecans?|macadamias?)\b/i,
  dairy: /\b(?:dairy|milk|curd|yogurt|yoghurt|paneer|cheese|buttermilk|whey)\b/i,
  wheat: /\b(?:wheat|gluten|chapati|roti|bread|pasta|barley|rye)\b/i,
  soy: /\b(?:soy|soya|tofu|tempeh|edamame)\b/i,
  eggs: /\beggs?\b/i,
  fish: /\b(?:fish|salmon|tuna|mackerel|sardines?)\b/i,
  shellfish: /\b(?:shellfish|shrimp|prawns?|crab|lobster|oysters?|clams?|mussels?)\b/i,
  sesame: /\b(?:sesame|tahini|til)\b/i,
}
const DIETARY_TERMS: Record<string, RegExp> = {
  vegan: /\b(?:meat|chicken|beef|pork|fish|seafood|eggs?|dairy|milk|curd|yogurt|yoghurt|paneer|cheese|whey|honey)\b/i,
  vegetarian: /\b(?:meat|chicken|beef|pork|fish|seafood|tuna|salmon|mackerel)\b/i,
  pescatarian: /\b(?:meat|chicken|beef|pork|lamb)\b/i,
  'dairy-free': /\b(?:dairy|milk|curd|yogurt|yoghurt|paneer|cheese|buttermilk|whey|casein|ghee|butter)\b/i,
  'gluten-free': /\b(?:wheat|gluten|chapati|roti|bread|pasta|barley|rye)\b/i,
}
const SYNONYMS: Record<string, string[]> = {
  carb: ['carbohydrate','carbs','energy','fuel'], carbs: ['carbohydrate','carb','energy','fuel'],
  carbohydrate: ['carbs','glycogen','fuel','energy'], carbohydrates: ['carb','glycogen','fuel','energy'],
  protein: ['recovery','muscle','postrun'], recover: ['recovery','postrun','protein'],
  before: ['pre','run','timing','food'], after: ['post','run','recovery','timing'],
  during: ['run','carbohydrate','carbs','fuel','hydration'],
  drink: ['hydration','water','electrolyte'], water: ['hydration','fluid','electrolyte'],
  hydration: ['water','fluid','electrolyte','sweat'], hydrate: ['hydration','fluid','water','sweat'], hydrating: ['hydration','fluid','water'],
  electrolyte: ['hydration','fluid','sodium','sweat'], electrolytes: ['hydration','fluid','sodium','sweat'],
  gel: ['carbohydrate','carbs','during','run'], race: ['carbohydrate','carbs','fuel','hydration'],
  preworkout: ['before','pre','snack','timing'], breakfast: ['before','pre','carbohydrate','food'],
  postrun: ['after','recovery','protein','carbohydrate'], recovery: ['after','post','protein','carbohydrate'],
  vegan: ['plant-based','vegetarian','beans','soy','protein','b12'], vegetarian: ['plant-based','vegan','beans','soy','protein'],
  vegetarianism: ['plant-based','vegan','beans','soy','protein'], lactose: ['dairy-free','milk-free','plant-based','soy'],
  gluten: ['wheat-free','gluten-free','rice','carbohydrate'], calories: ['energy','fuel','weight','diet'],
  weightloss: ['energy','weight','diet','fuel'],
  dairy: ['lactose','milk','yogurt','plant-based'],
  low: ['budget','affordable','cheap','meal'], budget: ['affordable','cheap','low-cost','meal'],
  mealplan: ['pre-run','post-run','recovery','carbohydrate','protein'],
  supplement: ['supplements','safety','evidence','healthcare'], supplements: ['supplement','safety','evidence','healthcare'],
  cramp: ['hydration','electrolyte','sodium'], iron: ['iron','spinach','methi','rajma'],
}

function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 2 && !STOP_WORDS.has(word)) ?? []
}

function corpus(country: Country): Passage[] {
  return [commonPassage, ...knowledgeFiles[country]]
    .flatMap(({ path, text: content }) => content.split(/\n\s*\n/)
      .map(text => text.replace(/\s+/g, ' ').trim())
      .filter(text => text.length > 35 && !LOW_CONFIDENCE_CLAIMS.test(text))
      .map(text => {
        const url = text.match(/https?:\/\/[^\s]+/)?.[0]?.replace(/[),.]+$/, '')
        const reference = text.match(/Source:\s*(.*?)\s*,?\s*https?:\/\//i)?.[1]?.replace(/[,.\s]+$/, '')
        const body = text.replace(/\s*Source:\s*.*$/i, '').trim()
        return { text: body, source: reference || path.split('/').pop()?.replace(/\.txt$/i, '').replace(/_/g, ' ') || 'Nutrition guide', ...(url ? { url } : {}) }
      }))
}

export function extractNutritionConstraints(question: string): NutritionConstraints {
  const allergySegments = [
    ...[...question.matchAll(/\b(?:allergic\s+to|allergy\s+to|allergy:\s*)([^.!?]+)/gi)].map(match => match[1]),
    ...[...question.matchAll(/\b([a-z-]+)\s+allerg(?:y|ies)\b/gi)].map(match => match[1]),
  ]
  const allergyText = allergySegments.join(' ')
  const allergens = Object.entries(ALLERGEN_TERMS)
    .filter(([, pattern]) => pattern.test(allergyText))
    .map(([name]) => name)
  const explicitFoods = allergySegments.flatMap(segment => segment
    .split(/\b(?:and|or|but)\b|[,/&]/i)
    .map(food => food.toLowerCase().replace(/^(?:i(?:'m| am)?\s+)?(?:also\s+)?(?:allergic\s+to\s+)?/, '').trim())
    .filter(food => food && food.length <= 40))
  for (const food of explicitFoods) {
    const recognized = Object.entries(ALLERGEN_TERMS).some(([name, pattern]) => name === food || pattern.test(food))
    if (!recognized && !allergens.includes(food)) allergens.push(food)
  }
  const excludedFoods = [...question.matchAll(/\b(?:anything|something)\s+other\s+than\s+([a-z-]+)/gi)]
    .map(match => match[1].toLowerCase())
    .concat([...question.matchAll(/\b(?:avoid|without|except|anything but)\s+([a-z-]+)/gi)].map(match => match[1].toLowerCase()))
  const dietaryPatterns: string[] = []
  if (/\bvegan\b|\bplant[- ]based\b/i.test(question)) dietaryPatterns.push('vegan')
  else if (/\bvegetarian\b|\bveggie\b/i.test(question)) dietaryPatterns.push('vegetarian')
  if (/\bpescatarian\b/i.test(question)) dietaryPatterns.push('pescatarian')
  if (/\b(?:dairy[- ]free|lactose[- ]free|without dairy)\b/i.test(question)) dietaryPatterns.push('dairy-free')
  if (/\bgluten[- ]free\b|\bcoeliac\b|\bceliac\b/i.test(question)) dietaryPatterns.push('gluten-free')
  return { allergens, excludedFoods, dietaryPatterns }
}

function searchText(question: string): string {
  return question
    .replace(/\b(?:allergic\s+to|allergy\s+to|allergy:)\s*[^.!?]+/gi, ' ')
    .replace(/\b(?:anything|something)\s+other\s+than\s+[a-z-]+/gi, ' ')
    .replace(/\b(?:i am|i'm)\s+(?:a\s+)?(?:vegan|vegetarian|pescatarian)\b/gi, ' ')
}

function removeConflictingSentences(text: string, constraints: NutritionConstraints): string {
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const allergenPattern = (name: string) => {
    if (ALLERGEN_TERMS[name]) return ALLERGEN_TERMS[name]
    const variants = new Set([name, name.replace(/ies$/i, 'y'), name.replace(/es$/i, ''), name.replace(/s$/i, '')])
    return new RegExp(`\\b(?:${[...variants].map(escapeRegex).join('|')})\\b`, 'i')
  }
  const terms = [
    ...constraints.allergens.map(allergenPattern),
    ...constraints.dietaryPatterns.map(name => DIETARY_TERMS[name]),
    ...constraints.excludedFoods.map(food => new RegExp(`\\b${escapeRegex(food)}\\b`, 'i')),
  ]
  return text.split(/(?<=[.!?])\s+/)
    .filter(sentence => !terms.some(pattern => pattern.test(sentence)))
    .join(' ')
    .trim()
}

export function answerNutritionQuestion(question: string, country: Country): NutritionAnswer {
  const docs = corpus(country)
  const constraints = extractNutritionConstraints(question)
  const queryTokens = tokenize(searchText(question))
  const expanded = new Set(queryTokens.flatMap(token => [token, ...(SYNONYMS[token] ?? [])]))
  if (!expanded.size || !docs.length) return { passages: [], found: false }

  const frequencies = new Map<string, number>()
  const termsByDoc = docs.map(({ text }) => {
    const terms = tokenize(text)
    for (const term of new Set(terms)) frequencies.set(term, (frequencies.get(term) ?? 0) + 1)
    return terms
  })
  const scored = docs.map((passage, index) => {
    const terms = termsByDoc[index]
    const counts = new Map<string, number>()
    terms.forEach(term => counts.set(term, (counts.get(term) ?? 0) + 1))
    const length = Math.max(terms.length, 1)
    let score = 0
    for (const term of expanded) {
      const count = counts.get(term) ?? 0
      if (!count) continue
      const idf = Math.log(1 + (docs.length - (frequencies.get(term) ?? 0) + 0.5) / ((frequencies.get(term) ?? 0) + 0.5))
      score += (count / (count + 1.2 * (0.25 + 0.75 * length / 120))) * idf
    }
    // Prefer passages that match multiple distinct query ideas.
    const matched = [...expanded].filter(term => counts.has(term)).length
    return { ...passage, text: removeConflictingSentences(passage.text, constraints), score: score * (1 + Math.min(matched, 3) * 0.15), matched }
  }).filter(item => item.text.length > 0).sort((a, b) => b.score - a.score)

  const best = scored[0]
  if (!best || best.matched === 0 || best.score < 0.12) return { passages: [], found: false }
  const passages = scored.filter(item => item.score >= Math.max(0.12, best.score * 0.48)).slice(0, 3)
  return { passages: passages.map(({ text, source }) => ({ text, source })), found: passages.length > 0 }
}

export function nutritionSafetyReply(question: string): string | null {
  if (/\bcalories?\b.*\b(?:need|should|target|daily|eat)\b|\b(?:daily calories?|calorie target|calorie deficit)\b|\b(?:lose|losing|weight[- ]loss)\b/i.test(question)) {
    return 'I can share general sports-fuelling information, but I cannot set a personal calorie target or weight-loss plan. Energy needs depend on your health and training; ask a registered sports dietitian for an individualized plan.'
  }
  if (/\b(?:diabetes|kidney disease|renal disease|pregnan|coeliac|celiac|eating disorder|anorexia|bulimia|medication|medicine interaction|food poisoning|iron deficiency|iron supplement|iron tablets?|anemia|anaemia|low[- ]fodmap)\b/i.test(question)) {
    return 'That needs advice tailored to your health history and treatment. I can only provide general sports-nutrition information; please check with your clinician or a registered dietitian before changing your diet or supplements.'
  }
  return null
}
