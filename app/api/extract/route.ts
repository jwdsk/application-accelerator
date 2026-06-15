import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { scrapeUrl, extractFromBuffer } from '@/lib/extract'

export const maxDuration = 90

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const url = formData.get('url') as string | null
    const file = formData.get('file') as File | null

    let rawText = ''
    let extractionError = ''
    let source = ''

    // 1. Try URL first
    if (url && url.trim()) {
      const result = await scrapeUrl(url.trim())
      if (result.text) {
        rawText = result.text
        source = url.trim()
      } else {
        extractionError = result.error ?? 'URL extraction failed'
      }
    }

    // 2. Fall back to file if URL failed or not provided
    if (!rawText && file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await extractFromBuffer(buffer, file.name)
      if (result.text) {
        rawText = result.text
        source = file.name
      } else {
        extractionError = result.error ?? 'File extraction failed'
      }
    }

    if (!rawText) {
      return NextResponse.json({
        error: extractionError || 'No text could be extracted. Please provide a URL or upload a PDF/doc.'
      }, { status: 400 })
    }

    // 3. Extract and structure the questions.
    // Limit text slice and output tokens to stay within the 12k TPM budget
    // shared with the subsequent /api/draft call (~7500 tokens).
    let response: Awaited<ReturnType<typeof anthropic.chat.completions.create>> | undefined
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await anthropic.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: `Extract all application questions from the text below. Return ONLY a valid JSON array, no preamble, no markdown fences.

Each item:
{
  "num": 1,
  "text": "exact question text",
  "category": "one of: Company basics | Problem | Solution | Market | Business model | Traction | Competition | Team | Funding | Program fit | Impact | Other",
  "charLimit": null or number if a word/character limit is stated
}

If you find section headers or instructions (not questions), skip them.
If no clear questions are found, return an empty array [].

TEXT:
${rawText.slice(0, 5000)}`
          }]
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

    const raw = response?.choices[0]?.message?.content ?? ''
 
    let questions = []
    try {
      questions = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Could not parse questions from the document. Please check the file and try again.' }, { status: 422 })
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'No questions found in this document. Make sure it contains a numbered application form.' }, { status: 422 })
    }

    return NextResponse.json({ questions, source, urlFailed: !!extractionError && !!url })
  } catch (err: any) {
    console.error('Extract error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
