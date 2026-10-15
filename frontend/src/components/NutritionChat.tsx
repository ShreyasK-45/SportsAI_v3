import { FormEvent, useRef, useState } from 'react'
import { Bot, Leaf, Send, Sparkles } from 'lucide-react'
import type { Country } from '../lib/supabaseApi'
import { answerNutritionQuestion, extractNutritionConstraints, nutritionSafetyReply } from '../lib/nutritionRag'

type Message = { role: 'user' | 'assistant'; text: string; sources?: { text: string; source: string; url?: string }[] }

const prompts: Record<Country, string[]> = {
  india: ['What can I eat before a run besides idli?', 'How much protein do runners need?', 'How should I fuel a long run?'],
  usa: ['How much carbohydrate during a long run?', 'How much protein do runners need?', 'How can I hydrate safely?'],
  japan: ['What is a good post-run meal?', 'How should I fuel a long run?', 'What are vegan protein options?'],
}

export function NutritionChat({ country }: { country: Country }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  function ask(value: string) {
    const prompt = value.trim()
    if (!prompt || busy) return
    setQuestion('')
    setMessages(current => [...current, { role: 'user', text: prompt }])
    setBusy(true)
    // Retrieval is local and synchronous; yield once so the UI can show the turn.
    window.setTimeout(() => {
      const safetyReply = nutritionSafetyReply(prompt)
      const result = safetyReply ? { passages: [], found: false } : answerNutritionQuestion(prompt, country)
      const constraints = extractNutritionConstraints(prompt)
      const constraintNote = [
        constraints.excludedFoods.length ? `I left out ${constraints.excludedFoods.join(' and ')} as requested.` : '',
        constraints.allergens.length ? `I removed passages mentioning ${constraints.allergens.join(' and ')}. With an allergy, check labels and preparation for cross-contact; this chat cannot guarantee food safety.` : '',
        constraints.dietaryPatterns.length ? `I applied your ${constraints.dietaryPatterns.join(' and ')} preference to the retrieved suggestions.` : '',
      ].filter(Boolean).join(' ')
      const reply: Message = result.found
        ? {
            role: 'assistant',
            text: [`Here are relevant options from the ${country.toUpperCase()} runner nutrition guides.`, constraintNote].filter(Boolean).join(' '),
            sources: result.passages,
          }
        : {
            role: 'assistant',
            text: [safetyReply ?? `I couldn't find a supported answer in the ${country.toUpperCase()} nutrition guides. Try asking about pre-run food, food during a long run, recovery, carbohydrates, protein, hydration, vegetarian or vegan options, allergies, or budget meals.`, constraintNote].filter(Boolean).join(' '),
          }
      setMessages(current => [...current, reply])
      setBusy(false)
      window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0)
    }, 30)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    ask(question)
  }

  return (
    <section className="nutrition-chat" aria-labelledby="nutrition-chat-title">
      <div className="nutrition-chat-heading">
        <div className="nutrition-chat-icon"><Bot size={20} /></div>
        <div>
          <span className="eyebrow"><Sparkles size={12} /> NUTRITION Q&amp;A · {country.toUpperCase()}</span>
          <h2 id="nutrition-chat-title">Ask about your fuelling</h2>
          <p>Answers are retrieved from the selected country’s runner nutrition guides.</p>
        </div>
      </div>

      <div className="nutrition-chat-log" aria-live="polite" aria-label="Nutrition conversation">
        {messages.length === 0 ? (
          <div className="nutrition-chat-empty">
            <Leaf size={19} />
            <p>Ask a nutrition question, or start with one of these:</p>
            <div className="nutrition-chat-prompts">
              {prompts[country].map(prompt => <button type="button" key={prompt} onClick={() => ask(prompt)}>{prompt}</button>)}
            </div>
          </div>
        ) : messages.map((message, index) => (
          <article className={`nutrition-chat-message ${message.role}`} key={`${index}-${message.text}`}>
            <span>{message.role === 'user' ? 'You' : 'Nutrition guide'}</span>
            <p>{message.text}</p>
            {message.sources?.map((source, sourceIndex) => <blockquote key={sourceIndex}>{source.text}<small>Source: {source.source}{source.url && <> · <a href={source.url} target="_blank" rel="noreferrer">View reference ↗</a></>}</small></blockquote>)}
          </article>
        ))}
        {busy && <p className="nutrition-chat-loading">Searching the {country} nutrition guides…</p>}
        <div ref={endRef} />
      </div>

      <form className="nutrition-chat-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="nutrition-question">Ask a nutrition question</label>
        <input id="nutrition-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask about meals, hydration, recovery…" maxLength={300} />
        <button type="submit" disabled={!question.trim() || busy} aria-label="Send question"><Send size={16} /> Ask</button>
      </form>
      <p className="nutrition-chat-note">Educational information only. It does not replace personalized advice from a registered dietitian.</p>
    </section>
  )
}
