import { NextResponse } from 'next/server'
import { list } from '@vercel/blob'
import { getDocs, addDoc } from '@/lib/kv'
import { extractFromBuffer } from '@/lib/extract'

export const maxDuration = 60

function guessContentType(pathname: string): string {
  const lower = pathname.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.doc')) return 'application/msword'
  if (lower.endsWith('.txt')) return 'text/plain'
  return ''
}

export async function POST() {
  try {
    const [kvDocs, { blobs }] = await Promise.all([getDocs(), list()])
    const kvUrls = new Set(kvDocs.map(d => d.url))
    const unindexed = blobs.filter(b => !kvUrls.has(b.url))

    if (unindexed.length === 0) {
      return NextResponse.json({ indexed: 0, total: 0, message: 'All files already indexed.' })
    }

    let indexed = 0
    const errors: string[] = []

    for (const blob of unindexed) {
      try {
        const res = await fetch(blob.url, { signal: AbortSignal.timeout(20_000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const arrayBuffer = await res.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const { text, error } = await extractFromBuffer(buffer, blob.pathname)
        if (!text) throw new Error(error ?? 'No text extracted')
        await addDoc({
          title: blob.pathname,
          url: blob.url,
          text,
          uploadedAt: blob.uploadedAt.toISOString(),
          size: blob.size,
          contentType: guessContentType(blob.pathname),
        })
        indexed++
      } catch (e: any) {
        errors.push(`${blob.pathname}: ${e.message}`)
      }
    }

    return NextResponse.json({
      indexed,
      total: unindexed.length,
      errors,
      message: indexed === unindexed.length
        ? `Indexed ${indexed} file${indexed === 1 ? '' : 's'}.`
        : `Indexed ${indexed} of ${unindexed.length} files. ${errors.length} failed.`,
    })
  } catch (err: any) {
    console.error('Reindex error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
