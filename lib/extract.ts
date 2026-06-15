// Extracts raw text from a URL or uploaded file buffer
// URL first, PDF/doc fallback

// ─── URL scraping ─────────────────────────────────────────────────────────────

export async function scrapeUrl(url: string): Promise<{ text: string; error?: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MetaPause-Agent/1.0)'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!res.ok) {
      return { text: '', error: `HTTP ${res.status} — page returned an error` }
    }

    const contentType = res.headers.get('content-type') ?? ''

    // PDF served directly from URL
    if (contentType.includes('pdf')) {
      const buffer = await res.arrayBuffer()
      return extractPdf(Buffer.from(buffer))
    }

    const html = await res.text()

    // Strip scripts, styles, nav — keep content
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s{3,}/g, '\n\n')
      .trim()

    if (cleaned.length < 100) {
      return {
        text: '',
        error: 'Page loaded but appears to be JavaScript-rendered or behind a login wall. Please upload a PDF instead.'
      }
    }

    return { text: cleaned }
  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      return { text: '', error: 'URL timed out after 10 seconds. Please upload a PDF instead.' }
    }
    return { text: '', error: `Could not reach URL: ${err.message}. Please upload a PDF instead.` }
  }
}

// ─── PDF extraction ───────────────────────────────────────────────────────────

export async function extractPdf(buffer: Buffer): Promise<{ text: string; error?: string }> {
  try {
    // Dynamic import — pdf-parse has side effects at module level
    const pdfParse = (await import('pdf-parse')).default
    const data = await pdfParse(buffer)
    if (!data.text || data.text.trim().length < 50) {
      return { text: '', error: 'PDF appears to be scanned or image-only. Please paste the questions as text.' }
    }
    return { text: data.text.trim() }
  } catch (err: any) {
    return { text: '', error: `Could not read PDF: ${err.message}` }
  }
}

// ─── Word doc extraction ──────────────────────────────────────────────────────

export async function extractDocx(buffer: Buffer): Promise<{ text: string; error?: string }> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    if (!result.value || result.value.trim().length < 50) {
      return { text: '', error: 'Document appears to be empty or unreadable.' }
    }
    return { text: result.value.trim() }
  } catch (err: any) {
    return { text: '', error: `Could not read document: ${err.message}` }
  }
}

// ─── Route by file type ───────────────────────────────────────────────────────

export async function extractFromBuffer(
  buffer: Buffer,
  filename: string
): Promise<{ text: string; error?: string }> {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return extractPdf(buffer)
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return extractDocx(buffer)
  // Try as plain text
  return { text: buffer.toString('utf-8') }
}
