import { NextRequest, NextResponse } from 'next/server'
import { anthropic, buildSystemPrompt } from '@/lib/anthropic'
import { getFullKB } from '@/lib/kv'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { questions, appName } = await req.json()

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'No questions provided' }, { status: 400 })
    }

    const kb = await getFullKB()
    const systemPrompt = buildSystemPrompt(kb)

    const userMessage = `Draft answers for all ${questions.length} questions in this application: "${appName || 'Accelerator Application'}".

Return ONLY a valid JSON array, no preamble, no markdown fences. Each item:
{
  "num": 1,
  "answer": "your drafted answer",
  "confidence": 0.0-1.0,
  "kbSources": ["tier1_corrected" | "tier2_canned" | "tier2_profile" | "tier3_docs" | "general"]
}

Confidence guide:
- 0.9+ : Answered directly from Tier 1 corrected past application
- 0.7-0.9: Answered well from Tier 2 canned Q&A or profile
- 0.5-0.7: Inferred from partial KB data
- Below 0.5: KB doesn't cover this well — flag it

${questions.map((q: any) => `Q${q.num}: ${q.text}${q.charLimit ? ` (${q.charLimit} char limit)` : ''}`).join('\n')}`

    // Single call: sends the system prompt once for all questions.
    // Retry up to 2 times on 429, honouring the retry-after header.
    let response: any
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await anthropic.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 4000,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        })
        break
      } catch (err: any) {
        if (err?.status === 429 && attempt < 2) {
          const waitSec = parseInt(err?.headers?.['retry-after'] ?? '30') + 2
          await new Promise(r => setTimeout(r, waitSec * 1000))
          continue
        }
        throw err
      }
    }

    const raw = (response?.choices[0]?.message?.content ?? '')
      .replace(/```json\n?|```/g, '')
      .trim()

    let drafts: any[] = []
    // Try 1: parse the whole response as a JSON array
    try {
      drafts = JSON.parse(raw)
    } catch {
      // Try 2: find the outermost [...] and parse that slice
      const start = raw.indexOf('[')
      const end = raw.lastIndexOf(']')
      if (start !== -1 && end > start) {
        try { drafts = JSON.parse(raw.slice(start, end + 1)) } catch { /* fall through */ }
      }
    }

    // Try 3: walk the string tracking brace depth — handles truncated arrays
    if (drafts.length === 0) {
      let i = raw.indexOf('{')
      while (i !== -1) {
        let depth = 0, inStr = false, esc = false, j = i
        for (; j < raw.length; j++) {
          const c = raw[j]
          if (esc) { esc = false; continue }
          if (c === '\\' && inStr) { esc = true; continue }
          if (c === '"') { inStr = !inStr; continue }
          if (inStr) continue
          if (c === '{') depth++
          if (c === '}' && --depth === 0) break
        }
        if (depth === 0 && j < raw.length) {
          try {
            const obj = JSON.parse(raw.slice(i, j + 1))
            if (obj.num !== undefined && obj.answer !== undefined) drafts.push(obj)
          } catch { /* malformed, skip */ }
        }
        i = raw.indexOf('{', j + 1)
      }
    }

    if (drafts.length === 0) {
      console.error('Draft parse failed. Groq raw response:', raw.slice(0, 600))
      return NextResponse.json({ error: 'Draft generation failed. Please try again.' }, { status: 422 })
    }

    // Merge questions + drafts
    const answered = questions.map((q: any) => {
      const draft = drafts.find((d: any) => d.num === q.num) ?? {
        answer: '',
        confidence: 0,
        kbSources: [],
      }
      return {
        ...q,
        aiDraft: draft.answer,
        finalAnswer: draft.answer,
        confidence: draft.confidence,
        kbSources: draft.kbSources,
        status: 'pending',
      }
    })

    return NextResponse.json({ questions: answered })
  } catch (err: any) {
    console.error('Draft error:', err)
    return NextResponse.json({ error: 'Something went wrong during drafting. Please try again.' }, { status: 500 })
  }
}
