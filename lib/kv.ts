import { kv } from '@vercel/kv'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CannedEntry {
  question: string
  answer: string
}

export interface CorrectedEntry {
  question: string
  answer: string
  source: string        // application name it came from
  correctedBy: string   // free text — whoever uploaded
  correctedAt: string   // ISO date
}

export interface Application {
  id: string
  name: string          // e.g. "Techstars Health 2024"
  sourceUrl?: string
  sourcePdfUrl?: string
  status: 'draft' | 'reviewed' | 'submitted' | 'learned'
  questions: Question[]
  createdAt: string
  updatedAt: string
}

export interface Question {
  num: number
  text: string
  category: string
  charLimit: number | null
  aiDraft: string
  finalAnswer: string   // same as aiDraft until human corrects
  confidence: number
  status: 'pending' | 'approved' | 'flagged'
}

// ─── Company profile ──────────────────────────────────────────────────────────

export async function getProfile(): Promise<Record<string, string>> {
  const profile = await kv.get<Record<string, string>>('kb:profile')
  return profile ?? {}
}

export async function setProfile(profile: Record<string, string>) {
  await kv.set('kb:profile', profile)
}

// ─── Canned Q&A ───────────────────────────────────────────────────────────────

export async function getCanned(): Promise<CannedEntry[]> {
  const entries = await kv.get<CannedEntry[]>('kb:canned')
  return entries ?? []
}

export async function setCanned(entries: CannedEntry[]) {
  await kv.set('kb:canned', entries)
}

export async function addCanned(entry: CannedEntry) {
  const current = await getCanned()
  await kv.set('kb:canned', [...current, entry])
}

// ─── Corrected applications (Tier 1) ─────────────────────────────────────────

export async function getCorrected(): Promise<CorrectedEntry[]> {
  const entries = await kv.get<CorrectedEntry[]>('kb:corrected')
  return entries ?? []
}

export async function addCorrectedEntries(entries: CorrectedEntry[]) {
  const current = await getCorrected()
  await kv.set('kb:corrected', [...current, ...entries])
}

// ─── Applications ─────────────────────────────────────────────────────────────

export async function saveApplication(app: Application) {
  await kv.set(`app:${app.id}`, app)
  // Add to index
  const index = await kv.get<string[]>('app:index') ?? []
  if (!index.includes(app.id)) {
    await kv.set('app:index', [app.id, ...index])
  }
}

export async function getApplication(id: string): Promise<Application | null> {
  return kv.get<Application>(`app:${id}`)
}

export async function listApplications(): Promise<Application[]> {
  const index = await kv.get<string[]>('app:index') ?? []
  if (index.length === 0) return []
  const apps = await Promise.all(index.map(id => kv.get<Application>(`app:${id}`)))
  return apps.filter(Boolean) as Application[]
}

// ─── Documents (Tier 3) ──────────────────────────────────────────────────────

export interface DocEntry {
  title: string
  url: string
  text: string
  uploadedAt: string
}

export async function getDocs(): Promise<DocEntry[]> {
  const index = await kv.get<string[]>('doc:index') ?? []
  if (index.length === 0) return []
  const docs = await Promise.all(index.map(url => kv.get<DocEntry>(`doc:${url}`)))
  return docs.filter(Boolean) as DocEntry[]
}

export async function addDoc(doc: DocEntry): Promise<void> {
  await kv.set(`doc:${doc.url}`, doc)
  const index = await kv.get<string[]>('doc:index') ?? []
  if (!index.includes(doc.url)) {
    await kv.set('doc:index', [doc.url, ...index])
  }
}

export async function deleteDoc(url: string): Promise<void> {
  await kv.del(`doc:${url}`)
  const index = await kv.get<string[]>('doc:index') ?? []
  await kv.set('doc:index', index.filter(u => u !== url))
}

// ─── Full KB for prompt ───────────────────────────────────────────────────────

export async function getFullKB() {
  const [corrected, canned, profile, docs] = await Promise.all([
    getCorrected(),
    getCanned(),
    getProfile(),
    getDocs(),
  ])
  return {
    corrected,
    canned,
    profile,
    docs: docs.map(d => ({ title: d.title, excerpt: d.text.slice(0, 3000) })),
  }
}

