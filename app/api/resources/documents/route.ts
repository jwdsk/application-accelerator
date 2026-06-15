import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { list, del } from '@vercel/blob'
import { deleteDoc, getDocs } from '@/lib/kv'

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

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody
  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (_pathname) => ({
      allowedContentTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ],
      maximumSizeInBytes: 50 * 1024 * 1024,
    }),
    onUploadCompleted: async ({ blob }) => {
      const { addDoc } = await import('@/lib/kv')
      const { extractFromBuffer } = await import('@/lib/extract')
      try {
        const res = await fetch(blob.url)
        const arrayBuffer = await res.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const { text } = await extractFromBuffer(buffer, blob.pathname)
        await addDoc({
          title: blob.pathname,
          url: blob.url,
          text: text ?? '',
          uploadedAt: new Date().toISOString(),
          size: arrayBuffer.byteLength,
          contentType: blob.contentType,
        })
      } catch (e) {
        console.error('Text extraction failed:', e)
      }
    },
  })
  return Response.json(jsonResponse)
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
