import { NextRequest, NextResponse } from 'next/server'
import { put, list, del } from '@vercel/blob'
import { extractFromBuffer } from '@/lib/extract'
import { addDoc, deleteDoc } from '@/lib/kv'

export const maxDuration = 60

export async function GET() {
  try {
    const { blobs } = await list()
    return NextResponse.json({ blobs })
  } catch (err: any) {
    console.error('Blob list error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload to Blob and extract text in parallel
    const [blob, extracted] = await Promise.all([
      put(file.name, buffer, { access: 'public' }),
      extractFromBuffer(buffer, file.name),
    ])

    // Store extracted text in KV even if extraction partially failed
    await addDoc({
      title: file.name,
      url: blob.url,
      text: extracted.text ?? '',
      uploadedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ...blob, extracted: !!extracted.text, extractError: extracted.error })
  } catch (err: any) {
    console.error('Blob put error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url')
    if (!url) {
      return NextResponse.json({ error: 'url required' }, { status: 400 })
    }
    await Promise.all([del(url), deleteDoc(url)])
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Blob del error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
