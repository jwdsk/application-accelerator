import { NextRequest, NextResponse } from 'next/server'
import { anthropic, buildSystemPrompt } from '@/lib/anthropic'
import { getFullKB } from '@/lib/kv'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { questions, appName } = await req.json()

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'No questions provided' }, { status: 400 })
    }

    const kb = await getFullKB()
    const systemPrompt = buildSystemPrompt(kb)

    // Draft all questions in one call for efficiency + prompt caching
    // Sonnet handles the drafting — quality matters here
    const response = await anthropic.messages.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Draft answers for all ${questions.length} questions in this application: "${appName || 'Accelerator Application'}".

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
      }]
    })

    const raw = response.choices[0]?.message?.content ?? ''
    let drafts = []
    try {
      drafts = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Draft generation failed. Please try again.' }, { status: 422 })
    }

    // Merge questions + drafts
    const answered = questions.map((q: any) => {
      const draft = drafts.find((d: any) => d.num === q.num) ?? {
        answer: '',
        confidence: 0,
        kbSources: []
      }
      return {
        ...q,
        aiDraft: draft.answer,
        finalAnswer: draft.answer,
        confidence: draft.confidence,
        kbSources: draft.kbSources,
        status: 'pending'
      }
    })

    return NextResponse.json({ questions: answered })
  } catch (err: any) {
    console.error('Draft error:', err)
    return NextResponse.json({ error: 'Something went wrong during drafting. Please try again.' }, { status: 500 })
  }
}
