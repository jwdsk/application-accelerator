import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { del } from '@vercel/blob'
import { deleteDoc, getDocs } from '@/lib/kv'

export const maxDuration = 60

export async function GET() {
  try {
    const docs = await getDocs()
    const blobs = docs.map(d => ({
      pathname: d.title,
      url: d.url,
      uploadedAt: d.uploadedAt,
      size: d.size ?? 0,
      contentType: d.contentType ?? 'application/octet-stream',
    }))
    return NextResponse.json({ blobs })
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
        const buffer = Buffer.from(await res.arrayBuffer())
        const { text } = await extractFromBuffer(buffer, blob.pathname)
        await addDoc({
          title: blob.pathname,
          url: blob.url,
          text: text ?? '',
          uploadedAt: new Date().toISOString(),
          size: blob.size,
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
