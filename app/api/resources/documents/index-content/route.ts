import { NextRequest, NextResponse } from 'next/server'
import { addDoc } from '@/lib/kv'
import { extractFromBuffer } from '@/lib/extract'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const url = formData.get('url') as string | null

    if (!file || !url) {
      return NextResponse.json({ error: 'file and url are required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { text, error } = await extractFromBuffer(buffer, file.name)

    await addDoc({
      title: file.name,
      url,
      text: text ?? '',
      uploadedAt: new Date().toISOString(),
      size: buffer.byteLength,
      contentType: file.type,
    })

    return NextResponse.json({ ok: true, extracted: !!text, warning: error })
  } catch (err: any) {
    console.error('index-content error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
