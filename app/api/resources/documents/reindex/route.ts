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
        if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status} from ${blob.url}`)
        const arrayBuffer = await res.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const { text, error: extractErr } = await extractFromBuffer(buffer, blob.pathname)
        // Index even if extraction yields no text (matches onUploadCompleted behaviour).
        // Record extraction failure as a warning, not a hard error.
        if (extractErr) errors.push(`${blob.pathname}: extraction warning — ${extractErr}`)
        await addDoc({
          title: blob.pathname,
          url: blob.url,
          text: text ?? '',
          uploadedAt: blob.uploadedAt.toISOString(),
          size: blob.size,
          contentType: guessContentType(blob.pathname),
        })
        indexed++
      } catch (e: any) {
        console.error('Reindex item failed:', blob.pathname, e)
        errors.push(`${blob.pathname}: ${e.message}`)
      }
    }

    const hardErrors = errors.filter(e => !e.includes('extraction warning'))
    const msg = hardErrors.length > 0
      ? `Indexed ${indexed} of ${unindexed.length} files. ${hardErrors.length} failed.`
      : `Indexed ${indexed} file${indexed === 1 ? '' : 's'}.`

    return NextResponse.json({
      indexed,
      total: unindexed.length,
      errors,
      message: msg,
    })
  } catch (err: any) {
    console.error('Reindex error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
