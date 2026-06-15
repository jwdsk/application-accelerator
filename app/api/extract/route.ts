import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { scrapeUrl, extractFromBuffer } from '@/lib/extract'

export const maxDuration = 30

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

    // 3. Use Claude Haiku to extract and structure the questions
    const response = await anthropic.messages.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2000,
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
${rawText.slice(0, 8000)}`
      }]
    })

    const raw = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim()

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
