import { NextRequest, NextResponse } from 'next/server'
import { put, list, del } from '@vercel/blob'
import { addDoc, deleteDoc, getDocs } from '@/lib/kv'
import { extractFromBuffer } from '@/lib/extract'

export const maxDuration = 60

export async function GET() {
  try {
    // Merge KV index (has extracted text) with live Blob list (catches files
    // uploaded outside the app or before onUploadCompleted ran).
    const [kvDocs, { blobs: blobList }] = await Promise.all([getDocs(), list()])

    const kvByUrl = new Map(kvDocs.map(d => [d.url, d]))

    // KV entries first (they have text), then any Blob-only files not yet indexed
    const fromKV = kvDocs.map(d => ({
      pathname: d.title,
      url: d.url,
      uploadedAt: d.uploadedAt,
      size: d.size ?? 0,
      contentType: d.contentType ?? 'application/octet-stream',
    }))

    const fromBlobOnly = blobList
      .filter(b => !kvByUrl.has(b.url))
      .map(b => ({
        pathname: b.pathname,
        url: b.url,
        uploadedAt: b.uploadedAt,
        size: b.size,
        contentType: '',
      }))

    return NextResponse.json({ blobs: [...fromKV, ...fromBlobOnly] })
  } catch (err: any) {
    console.error('Doc list error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Extract text before uploading — buffer already in memory, no CDN fetch needed
    const { text } = await extractFromBuffer(buffer, file.name)

    // Upload to Blob with public access so Re-index can fetch it if needed
    const blob = await put(file.name, buffer, { access: 'public', addRandomSuffix: false })

    await addDoc({
      title: file.name,
      url: blob.url,
      text: text ?? '',
      uploadedAt: new Date().toISOString(),
      size: buffer.byteLength,
      contentType: file.type || blob.contentType,
    })

    return NextResponse.json({ url: blob.url, extracted: !!text })
  } catch (err: any) {
    console.error('Upload error:', err)
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
