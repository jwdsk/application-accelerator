import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { extractFromBuffer } from '@/lib/extract'
import { addCorrectedEntries, getApplication, saveApplication } from '@/lib/kv'
import type { CorrectedEntry } from '@/lib/kv'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const appId = formData.get('appId') as string | null
    const correctedBy = (formData.get('correctedBy') as string) || 'Team'
    const appName = (formData.get('appName') as string) || 'Application'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 1. Extract text from corrected doc
    const buffer = Buffer.from(await file.arrayBuffer())
    const { text, error } = await extractFromBuffer(buffer, file.name)
    if (!text) {
      return NextResponse.json({ error: error || 'Could not read file' }, { status: 400 })
    }

    // 2. Get the original application questions if we have the appId
    let originalQuestions: { num: number; text: string }[] = []
    if (appId) {
      const app = await getApplication(appId)
      if (app) {
        originalQuestions = app.questions.map(q => ({ num: q.num, text: q.text }))
        // Mark as learned
        await saveApplication({ ...app, status: 'learned', updatedAt: new Date().toISOString() })
      }
    }

    // 3. Use Claude to extract Q+A pairs from the corrected doc
    const originalContext = originalQuestions.length > 0
      ? `\n\nOriginal questions for reference:\n${originalQuestions.map(q => `Q${q.num}: ${q.text}`).join('\n')}`
      : ''

    const response = await anthropic.messages.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `This is a completed and human-corrected accelerator application. Extract all question-answer pairs from it.

Return ONLY a valid JSON array, no preamble, no markdown fences:
[
  {
    "question": "the question as written",
    "answer": "the human-written answer"
  }
]

Only include pairs where both question and answer are clearly present and the answer is substantive (more than a few words).
${originalContext}

CORRECTED DOCUMENT:
${text.slice(0, 10000)}`
      }]
    })

    const raw = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim()

    let pairs: { question: string; answer: string }[] = []
    try {
      pairs = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Could not parse Q&A pairs from document.' }, { status: 422 })
    }

    if (!Array.isArray(pairs) || pairs.length === 0) {
      return NextResponse.json({ error: 'No question-answer pairs found in document.' }, { status: 422 })
    }

    // 4. Store as corrected entries
    const entries: CorrectedEntry[] = pairs.map(p => ({
      question: p.question,
      answer: p.answer,
      source: appName,
      correctedBy,
      correctedAt: new Date().toISOString()
    }))

    await addCorrectedEntries(entries)

    return NextResponse.json({
      learned: entries.length,
      message: `${entries.length} Q&A pairs added to knowledge base from "${appName}".`
    })
  } catch (err: any) {
    console.error('Learn error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
