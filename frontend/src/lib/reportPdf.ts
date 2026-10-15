import type { Country, RAGOutput, RunningAnalysis } from '../types'

type PdfLine = { text: string; kind: 'title' | 'subtitle' | 'section' | 'body' | 'spacer' }

function pdfSafe(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[×]/g, 'x')
    .replace(/[°]/g, ' deg')
    .replace(/[·•]/g, '|')
    .replace(/[₹]/g, 'INR ')
    .replace(/[→↗]/g, '->')
    .replace(/[^\x20-\x7E]/g, '')
}

function wrap(text: string, width = 88): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (word.length > width) {
      if (current) lines.push(current)
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width))
      current = ''
      continue
    }
    if (current && `${current} ${word}`.length > width) {
      lines.push(current)
      current = word
    } else current = current ? `${current} ${word}` : word
  }
  if (current) lines.push(current)
  return lines
}

function makeLines(analysis: RunningAnalysis, rag: RAGOutput | null, country: Country, fileName: string): PdfLine[] {
  const lines: PdfLine[] = [
    { text: 'SportsAI+ | Running Form Report', kind: 'title' },
    { text: `${fileName || analysis.sourceName} | ${new Date(analysis.createdAt).toLocaleDateString()} | ${country.toUpperCase()}`, kind: 'subtitle' },
    { text: `Overall screen: ${analysis.score}/100 | Landmark confidence: ${analysis.confidence}% | Duration: ${analysis.duration}s`, kind: 'section' },
    { text: 'This is a video-based form screen, not a medical diagnosis or force-plate measurement.', kind: 'body' },
    { text: '', kind: 'spacer' },
    { text: 'FORM MEASURES', kind: 'section' },
  ]

  for (const metric of analysis.metrics) {
    lines.push({ text: `${metric.label} | ${metric.score}/100 | ${metric.status.toUpperCase()} | ${metric.value}`, kind: 'body' })
    lines.push({ text: metric.description, kind: 'body' })
    lines.push({ text: `Cue: ${metric.cue}`, kind: 'body' })
    lines.push({ text: '', kind: 'spacer' })
  }

  const strike = analysis.footStrike
  lines.push({ text: 'FOOT-CONTACT SCREEN', kind: 'section' })
  lines.push({ text: `${strike.classification} | ${strike.confidence}% confidence | ${strike.contacts} clear contacts`, kind: 'body' })
  lines.push({ text: strike.message, kind: 'body' })
  lines.push({ text: '', kind: 'spacer' })

  if (rag) {
    lines.push({ text: 'COACHING AND NUTRITION', kind: 'section' })
    lines.push({ text: 'Next coaching cue', kind: 'body' })
    lines.push({ text: rag.coachingCue, kind: 'body' })
    lines.push({ text: `Injury-risk screen: ${rag.injuryRisk.level}. ${rag.injuryRisk.advice}`, kind: 'body' })
    if (rag.injuryRisk.factors.length) lines.push({ text: `Factors: ${rag.injuryRisk.factors.join('; ')}`, kind: 'body' })
    lines.push({ text: 'Suggested drills', kind: 'body' })
    rag.drillPlan.forEach(drill => lines.push({ text: `${drill.name} (${drill.setsReps}) | ${drill.cue} | ${drill.frequency}`, kind: 'body' }))
    lines.push({ text: `Nutrition guide (${rag.country})`, kind: 'body' })
    const nutrition = rag.nutrition
    for (const [title, foods] of [
      ['Before a run', nutrition.preRun], ['After a run', nutrition.postRun], ['Daily foods', nutrition.daily],
      ['Hydration', nutrition.hydration], ['Other foods', nutrition.antiInflammatory],
    ] as [string, string[]][]) {
      lines.push({ text: `${title}: ${foods.join('; ')}`, kind: 'body' })
    }
    lines.push({ text: `Budget meal: ${nutrition.budgetMeal}`, kind: 'body' })
  }

  if (analysis.notes.length) {
    lines.push({ text: 'LIMITATIONS', kind: 'section' })
    analysis.notes.forEach(note => lines.push({ text: note, kind: 'body' }))
  }
  lines.push({ text: 'Educational coaching support only. For pain, injury, or nutrition concerns, consult a qualified professional.', kind: 'subtitle' })
  return lines
}

function pdfText(text: string, x: number, y: number, size: number, font = 'F1', color = '0.16 0.21 0.25'): string {
  const escaped = pdfSafe(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  return `${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escaped}) Tj ET\n`
}

export function createRunningReportPdf(analysis: RunningAnalysis, rag: RAGOutput | null, country: Country, fileName: string): Blob {
  const sourceLines = makeLines(analysis, rag, country, fileName)
  const pages: PdfLine[][] = [[]]
  let y = 744

  for (const line of sourceLines) {
    if (line.kind === 'spacer') {
      y -= 9
      continue
    }
    const size = line.kind === 'title' ? 21 : line.kind === 'section' ? 11 : line.kind === 'subtitle' ? 9 : 9
    const wrapped = wrap(line.text, line.kind === 'title' ? 51 : 94)
    for (const part of wrapped) {
      const height = line.kind === 'section' ? 19 : line.kind === 'title' ? 28 : 14
      if (y < 62) {
        pages.push([])
        y = 770
      }
      pages[pages.length - 1].push({ ...line, text: part })
      y -= height
    }
  }

  const pageIds = pages.map((_, index) => 3 + index * 2)
  const fontId = 3 + pages.length * 2
  const objects: string[] = []
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`

  pages.forEach((page, pageIndex) => {
    let stream = ''
    stream += '0.97 0.98 0.96 rg 0 0 595 842 re f\n'
    stream += '0.05 0.40 0.37 rg 0 0 595 8 re f\n'
    stream += pdfText('SPORTSAI+', 48, 802, 10, 'F2', '0.05 0.40 0.37')
    stream += '0.78 0.82 0.80 RG 48 788 m 547 788 l S\n'
    let cursorY = 762
    for (const line of page) {
      if (line.kind === 'title') {
        stream += pdfText(line.text, 48, cursorY, 20, 'F2', '0.07 0.13 0.20')
        cursorY -= 27
      } else if (line.kind === 'section') {
        stream += `0.88 0.95 0.91 rg 45 ${cursorY - 4} 505 17 re f\n`
        stream += pdfText(line.text, 52, cursorY, 10, 'F2', '0.05 0.34 0.31')
        cursorY -= 19
      } else {
        const color = line.kind === 'subtitle' ? '0.35 0.41 0.46' : '0.16 0.21 0.25'
        stream += pdfText(line.text, 52, cursorY, line.kind === 'subtitle' ? 8 : 9, 'F1', color)
        cursorY -= 14
      }
    }
    stream += `0.40 0.45 0.48 rg BT /F1 8 Tf 1 0 0 1 48 34 Tm (SportsAI+ | Page ${pageIndex + 1} of ${pages.length}) Tj ET\n`
    const pageId = pageIds[pageIndex]
    const contentId = pageId + 1
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${fontId + 1} 0 R >> >> /Contents ${contentId} 0 R >>`
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`
  })
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  objects[fontId + 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'

  let document = '%PDF-1.4\n%SportsAI PDF\n'
  const offsets = [0]
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = document.length
    document += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xrefOffset = document.length
  document += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id++) document += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  document += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new Blob([document], { type: 'application/pdf' })
}
