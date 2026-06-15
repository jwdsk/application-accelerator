import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { extractFromBuffer } from '@/lib/extract'
import { setProfile, setCanned } from '@/lib/kv'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { text, error } = await extractFromBuffer(buffer, file.name)
    if (!text) {
      return NextResponse.json({ error: error || 'Could not read file' }, { status: 400 })
    }

    const response = await anthropic.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4000,
      messages: [
        {
          role: 'system',
          content: 'You are a structured data extractor. Extract company information and Q&A pairs from documents. Always respond with valid JSON only — no preamble, no markdown fences.'
        },
        {
          role: 'user',
          content: `Extract company profile fields and canned Q&A pairs from this document.

Return ONLY a valid JSON object with this exact structure:
{
  "profile": {
    "name": "",
    "tagline": "",
    "mission": "",
    "stage": "",
    "founded": "",
    "location": "",
    "product": "",
    "market": "",
    "traction": "",
    "revenueModel": "",
    "team": "",
    "competition": "",
    "ask": "",
    "impact": ""
  },
  "canned": [
    { "question": "...", "answer": "..." }
  ]
}

Leave fields as empty strings if not found in the document. Include any explicit Q&A pairs, FAQ entries, or interview-style questions with answers as canned entries.

DOCUMENT:
${text.slice(0, 12000)}`
        }
      ]
    })

    const raw = response.choices[0]?.message?.content ?? ''
    let extracted: { profile: Record<string, string>; canned: { question: string; answer: string }[] }
    try {
      extracted = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Could not parse document content. Please try again.' }, { status: 422 })
    }

    const profile = extracted.profile ?? {}
    const canned = extracted.canned ?? []

    await Promise.all([setProfile(profile), setCanned(canned)])

    return NextResponse.json({
      ok: true,
      profile,
      canned,
      profileFields: Object.values(profile).filter(v => v?.trim()).length,
      cannedCount: canned.length
    })
  } catch (err: any) {
    console.error('Seed error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
