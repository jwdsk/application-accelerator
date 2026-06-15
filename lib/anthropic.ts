import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// Builds the KB system prompt from all three tiers
// Tier 1: past corrected applications (highest weight)
// Tier 2: canned Q&A + company profile
// Tier 3: uploaded documents
export function buildSystemPrompt(kb: {
  corrected: { question: string; answer: string; source: string }[]
  canned: { question: string; answer: string }[]
  profile: Record<string, string>
  docs: { title: string; excerpt: string }[]
}) {
  const sections: string[] = []

  sections.push(`You are an expert application writer for MetaPause, an AI-powered women's health startup focused on menopause care. Your job is to draft compelling, specific, and honest answers to accelerator and incubator application questions.

Always write in first person plural ("we", "our"). Be specific — use real numbers and named examples from the knowledge base. Never fabricate metrics or claims not supported by the KB. If the KB doesn't cover something, say so clearly rather than inventing.`)

  if (kb.corrected.length > 0) {
    sections.push(`## TIER 1 — Past corrected application answers (use these first, they are the best source)
These are answers MetaPause has written and approved for real applications. When a new question is similar, lead with this style and content.

${kb.corrected.map(e => `Q: ${e.question}\nA: ${e.answer}\nSource: ${e.source}`).join('\n\n')}`)
  }

  sections.push(`## TIER 2 — Company profile & canned Q&A

### Company profile
${Object.entries(kb.profile).map(([k, v]) => `${k}: ${v}`).join('\n')}

### Canned Q&A
${kb.canned.map(e => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n')}`)

  if (kb.docs.length > 0) {
    sections.push(`## TIER 3 — Reference documents
${kb.docs.map(d => `### ${d.title}\n${d.excerpt}`).join('\n\n')}`)
  }

  return sections.join('\n\n---\n\n')
}
