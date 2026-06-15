import { NextRequest, NextResponse } from 'next/server'
import { anthropic, buildSystemPrompt } from '@/lib/anthropic'
import { getFullKB } from '@/lib/kv'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { questions, appName: _appName } = await req.json()

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'No questions provided' }, { status: 400 })
    }

    const kb = await getFullKB()
    const systemPrompt = buildSystemPrompt(kb)

    const drafts = await Promise.all(
      questions.map(async (q: any) => {
        const response = await anthropic.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 800,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Draft an answer for this single application question for MetaPause.

Question: ${q.text}
${q.charLimit ? `Character limit: ${q.charLimit} characters maximum` : ''}

Return ONLY a valid JSON object, no preamble, no markdown fences:
{
  "num": ${q.num},
  "answer": "your drafted answer",
  "confidence": 0.0-1.0,
  "kbSources": ["tier1_corrected" | "tier2_canned" | "tier2_profile" | "tier3_docs" | "general"]
}

Confidence guide:
- 0.9+ : Answered directly from Tier 1 corrected past application
- 0.7-0.9: Answered well from Tier 2 canned Q&A or profile
- 0.5-0.7: Inferred from partial KB data
- Below 0.5: KB doesn't cover this — flag it`
            }
          ]
        })

        const raw = (response.choices[0]?.message?.content ?? '')
          .replace(/```json|```/g, '')
          .trim()

        try {
          return JSON.parse(raw)
        } catch {
          return { num: q.num, answer: '', confidence: 0, kbSources: [] }
        }
      })
    )

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
