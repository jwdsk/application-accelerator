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

Return ONLY a valid JSON object with a "drafts" key containing an array. No preamble, no markdown fences:
{"drafts": [...]}

Each item in the array:
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
          temperature: 0,
          // @ts-ignore — Groq supports json_object for this model
          response_format: { type: 'json_object' },
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

    const raw = (response?.choices[0]?.message?.content ?? '').trim()

    let drafts: any[] = []
    try {
      // response_format:json_object always returns an object — unwrap the drafts array
      const parsed = JSON.parse(raw)
      drafts = Array.isArray(parsed) ? parsed : (parsed.drafts ?? parsed.answers ?? Object.values(parsed))
    } catch {
      // Fallback: find the outermost [...] in case model wrapped in extra text
      const start = raw.indexOf('[')
      const end = raw.lastIndexOf(']')
      if (start !== -1 && end > start) {
        try { drafts = JSON.parse(raw.slice(start, end + 1)) } catch { /* give up */ }
      }
    }

    if (drafts.length === 0) {
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
