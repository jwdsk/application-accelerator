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
  return profile ?? DEFAULT_PROFILE
}

export async function setProfile(profile: Record<string, string>) {
  await kv.set('kb:profile', profile)
}

// ─── Canned Q&A ───────────────────────────────────────────────────────────────

export async function getCanned(): Promise<CannedEntry[]> {
  const entries = await kv.get<CannedEntry[]>('kb:canned')
  return entries ?? DEFAULT_CANNED
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

// ─── Full KB for prompt ───────────────────────────────────────────────────────

export async function getFullKB() {
  const [corrected, canned, profile] = await Promise.all([
    getCorrected(),
    getCanned(),
    getProfile()
  ])
  return { corrected, canned, profile, docs: [] }
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: Record<string, string> = {
  name: 'MetaPause',
  tagline: 'AI-powered menopause care platform for women',
  mission: 'To help women navigate perimenopause and menopause with personalized, science-backed AI support.',
  stage: 'Pre-seed',
  founded: '2023',
  location: 'Remote',
  product: 'A personalized AI companion that helps women track symptoms, understand hormonal changes, and access evidence-based guidance — through a subscription app and wellness store.',
  market: 'The global menopause market is valued at $15B+ and growing. 1 billion women globally will be in menopause or perimenopause by 2025.',
  traction: 'Early beta users, growing waitlist, strategic partnerships in development.',
  revenueModel: 'Subscription (B2C app) + e-commerce (wellness products) + B2B licensing to HR platforms and health insurers.',
  team: '3 co-founders with backgrounds in women\'s health, product, and AI.',
  competition: 'We differ from Elektra, Gennev, and Midi by being AI-first, mobile-native, and accessible at a fraction of clinical cost.',
  ask: 'Raising $500K pre-seed to build product, grow team, and reach 10K paying users.',
  impact: 'Menopause is chronically under-researched and stigmatized. MetaPause democratizes access to care for women who cannot afford private menopause clinics.'
}

const DEFAULT_CANNED: CannedEntry[] = [
  {
    question: 'What problem are you solving?',
    answer: 'Menopause affects 50% of the global population yet remains chronically under-researched and stigmatized. Women spend an average of 7 years in perimenopause with minimal clinical support, often dismissed by doctors. MetaPause provides an AI-powered companion that gives women personalized, evidence-based guidance through every stage of their hormonal journey — accessible 24/7, at a fraction of clinical cost.'
  },
  {
    question: 'Why now?',
    answer: 'Three tailwinds converge: (1) The menopause care market has reached mainstream awareness in the last 3 years, driven by celebrity advocacy and new research; (2) AI tooling is mature enough to deliver genuinely personalized health guidance; (3) The femtech funding ecosystem has expanded significantly, with dedicated women\'s health investors now active globally.'
  },
  {
    question: 'What is your unfair advantage?',
    answer: 'Our co-founding team combines lived experience of menopause, deep women\'s health research expertise, and product/AI engineering skills. We are building the data flywheel first — every interaction trains a model that gets better at predicting what women need before they know they need it.'
  },
  {
    question: 'What do you need from this program?',
    answer: 'We are looking for mentorship on clinical partnerships and regulatory pathways, introductions to women\'s health VCs and strategic health system partners, and office hours support on B2B GTM strategy.'
  },
  {
    question: 'What is your social impact?',
    answer: 'Menopause is one of the most universal yet most neglected health experiences. MetaPause directly addresses health equity — we are building care that is accessible to women regardless of income, geography, or whether their doctor takes their symptoms seriously.'
  }
]
