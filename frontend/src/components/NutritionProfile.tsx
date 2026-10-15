/**
 * SportsAI+ — Nutrition Profile
 * Phase 6: Diet type, diet mode, regional cuisine, allergies, budget
 * Phase 22: Diet mode is NOT tied to nationality — user chooses
 */
import { useState } from "react"
import { Apple, ChevronDown, ChevronUp, Globe, Info, Leaf, ShieldAlert } from "lucide-react"

export type DietType = "vegetarian" | "vegan" | "eggetarian" | "non-vegetarian" | "other"
export type DietMode = "modern_global" | "traditional_regional" | "mixed"

export type NutritionProfileData = {
  dietType:    DietType
  dietMode:    DietMode
  region:      string   // only relevant when mode = traditional or mixed
  cuisine:     string
  goal:        "performance" | "weight_loss" | "muscle_gain" | "general_health"
  allergies:   string[]
  dislikes:    string[]
  budget:      "low" | "medium" | "high"
  cookingTime: "under_15" | "15_to_30" | "over_30"
}

const DEFAULT: NutritionProfileData = {
  dietType:    "vegetarian",
  dietMode:    "mixed",
  region:      "India",
  cuisine:     "South Indian",
  goal:        "performance",
  allergies:   [],
  dislikes:    [],
  budget:      "medium",
  cookingTime: "15_to_30",
}

const DIET_TYPES: { value: DietType; label: string }[] = [
  { value: "vegetarian",    label: "Vegetarian" },
  { value: "vegan",         label: "Vegan" },
  { value: "eggetarian",    label: "Eggetarian" },
  { value: "non-vegetarian",label: "Non-vegetarian" },
  { value: "other",         label: "Other / Flexible" },
]

const DIET_MODES: { value: DietMode; label: string; desc: string }[] = [
  { value: "modern_global",      label: "Modern / Global",      desc: "Oats, quinoa, Greek yoghurt, salmon, protein powder — global availability, nutrition-optimised" },
  { value: "traditional_regional",label:"Traditional / Regional", desc: "Foods from your chosen cuisine — idli, natto, shakshuka, etc." },
  { value: "mixed",              label: "Mix of Both",           desc: "Combine traditional and global foods in a ratio you prefer" },
]

const CUISINES: Record<string, string[]> = {
  "India":       ["South Indian", "North Indian", "Bengali", "Maharashtrian", "Gujarati", "Punjabi", "Other Indian"],
  "Japan":       ["Traditional Japanese (Washoku)", "Modern Japanese"],
  "USA":         ["American", "Mexican-American", "Mediterranean-American", "Other US"],
  "Mediterranean": ["Greek", "Italian", "Lebanese", "Turkish"],
  "East Asia":   ["Chinese", "Korean", "Thai", "Vietnamese"],
  "Other":       ["Middle Eastern", "African", "Latin American", "European", "Other"],
}

const REGIONS = Object.keys(CUISINES)

const COMMON_ALLERGIES = ["Gluten", "Dairy", "Nuts", "Peanuts", "Eggs", "Soy", "Shellfish", "Fish"]

export function NutritionProfile({
  value,
  onChange,
}: {
  value:    NutritionProfileData
  onChange: (v: NutritionProfileData) => void
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const set = <K extends keyof NutritionProfileData>(k: K, v: NutritionProfileData[K]) =>
    onChange({ ...value, [k]: v })

  const toggleAllergy = (a: string) => {
    const next = value.allergies.includes(a)
      ? value.allergies.filter(x => x !== a)
      : [...value.allergies, a]
    set("allergies", next)
  }

  const cuisines = CUISINES[value.region] ?? CUISINES["Other"]

  return (
    <div className="nutrition-profile">
      <div className="np-header">
        <Apple size={20} />
        <div>
          <p className="eyebrow">NUTRITION PROFILE</p>
          <h2>Your food preferences</h2>
          <p className="np-note">
            <Info size={13} />
            {" "}Diet type and diet mode are independent — your nationality does not determine your food style.
          </p>
        </div>
      </div>

      {/* Diet Type */}
      <div className="np-section">
        <label className="np-label"><Leaf size={14} /> Diet type</label>
        <div className="np-pills">
          {DIET_TYPES.map(d => (
            <button
              key={d.value}
              type="button"
              className={`np-pill ${value.dietType === d.value ? "selected" : ""}`}
              onClick={() => set("dietType", d.value)}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Diet Mode */}
      <div className="np-section">
        <label className="np-label"><Globe size={14} /> Diet style</label>
        <p className="np-hint">Choose the food style that suits you — this is not based on your nationality.</p>
        <div className="np-mode-cards">
          {DIET_MODES.map(m => (
            <button
              key={m.value}
              type="button"
              className={`np-mode-card ${value.dietMode === m.value ? "selected" : ""}`}
              onClick={() => set("dietMode", m.value)}>
              <b>{m.label}</b>
              <span>{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cuisine — only when traditional or mixed */}
      {(value.dietMode === "traditional_regional" || value.dietMode === "mixed") && (
        <div className="np-section">
          <label className="np-label">Cuisine / region</label>
          <div className="np-row">
            <select
              value={value.region}
              onChange={e => { set("region", e.target.value); set("cuisine", CUISINES[e.target.value]?.[0] ?? "") }}
              className="np-select">
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={value.cuisine}
              onChange={e => set("cuisine", e.target.value)}
              className="np-select">
              {cuisines.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Goal */}
      <div className="np-section">
        <label className="np-label">Primary nutrition goal</label>
        <div className="np-pills">
          {([["performance","Performance"],["muscle_gain","Muscle gain"],["general_health","General health"],["weight_loss","Weight management"]] as const).map(([v,l]) => (
            <button key={v} type="button"
              className={`np-pill ${value.goal === v ? "selected" : ""}`}
              onClick={() => set("goal", v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* Allergies */}
      <div className="np-section">
        <label className="np-label">Allergies & intolerances</label>
        <div className="np-pills">
          {COMMON_ALLERGIES.map(a => (
            <button key={a} type="button"
              className={`np-pill allergy ${value.allergies.includes(a) ? "selected" : ""}`}
              onClick={() => toggleAllergy(a)}>{a}</button>
          ))}
        </div>
        <input
          className="np-text-input"
          placeholder="Other allergies (comma-separated)"
          onBlur={e => {
            const extras = e.target.value.split(",").map(x => x.trim()).filter(Boolean)
            set("allergies", [...new Set([...value.allergies, ...extras])])
          }} />
      </div>

      {/* Advanced */}
      <button type="button" className="np-advanced-toggle"
        onClick={() => setAdvancedOpen(o => !o)}>
        {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {advancedOpen ? "Hide" : "Show"} budget & cooking time
      </button>

      {advancedOpen && (
        <div className="np-advanced">
          <div className="np-section">
            <label className="np-label">Budget</label>
            <div className="np-pills">
              {([["low","Budget-friendly"],["medium","Mid-range"],["high","Premium"]] as const).map(([v,l]) => (
                <button key={v} type="button"
                  className={`np-pill ${value.budget === v ? "selected" : ""}`}
                  onClick={() => set("budget", v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="np-section">
            <label className="np-label">Available cooking time</label>
            <div className="np-pills">
              {([["under_15","Under 15 min"],["15_to_30","15–30 min"],["over_30","30+ min"]] as const).map(([v,l]) => (
                <button key={v} type="button"
                  className={`np-pill ${value.cookingTime === v ? "selected" : ""}`}
                  onClick={() => set("cookingTime", v)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="np-guardrail">
        <ShieldAlert size={16} />
        <p>This profile tailors general nutrition guidance for training. It is not medical nutrition therapy. Consult a sports dietitian for clinical advice.</p>
      </div>
    </div>
  )
}

export { DEFAULT as defaultNutritionProfile }
