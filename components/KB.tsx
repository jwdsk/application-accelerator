'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './KB.module.css'

type CannedEntry = { question: string; answer: string }

const PROFILE_FIELDS: { key: string; label: string; multiline?: boolean }[] = [
  { key: 'name', label: 'Company name' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'stage', label: 'Stage' },
  { key: 'founded', label: 'Founded' },
  { key: 'location', label: 'Location' },
  { key: 'mission', label: 'Mission', multiline: true },
  { key: 'product', label: 'Product', multiline: true },
  { key: 'market', label: 'Market', multiline: true },
  { key: 'traction', label: 'Traction', multiline: true },
  { key: 'revenueModel', label: 'Revenue model', multiline: true },
  { key: 'team', label: 'Team', multiline: true },
  { key: 'competition', label: 'Competition', multiline: true },
  { key: 'ask', label: 'Ask', multiline: true },
  { key: 'impact', label: 'Impact', multiline: true },
]

type SeedStage = 'idle' | 'seeding' | 'done' | 'error'

export default function KB() {
  const [profile, setProfileState] = useState<Record<string, string>>({})
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const [canned, setCannedState] = useState<CannedEntry[]>([])
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const [cannedAdding, setCannedAdding] = useState(false)

  const [seedFile, setSeedFile] = useState<File | null>(null)
  const [seedStage, setSeedStage] = useState<SeedStage>('idle')
  const [seedResult, setSeedResult] = useState<{ profileFields: number; cannedCount: number } | null>(null)
  const [seedError, setSeedError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    const [profileRes, cannedRes] = await Promise.all([
      fetch('/api/kb?type=profile'),
      fetch('/api/kb?type=canned'),
    ])
    const [profileData, cannedData] = await Promise.all([
      profileRes.json(),
      cannedRes.json(),
    ])
    setProfileState(profileData ?? {})
    setCannedState(Array.isArray(cannedData) ? cannedData : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function saveProfile() {
    setProfileSaving(true)
    await fetch('/api/kb?type=profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    setProfileSaving(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2500)
  }

  async function addCannedEntry() {
    if (!newQ.trim() || !newA.trim()) return
    setCannedAdding(true)
    await fetch('/api/kb?type=canned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: newQ.trim(), answer: newA.trim() }),
    })
    setNewQ('')
    setNewA('')
    await loadAll()
    setCannedAdding(false)
  }

  async function deleteCannedEntry(idx: number) {
    const filtered = canned.filter((_, i) => i !== idx)
    setCannedState(filtered)
    await fetch('/api/kb?type=canned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filtered),
    })
  }

  async function handleSeed() {
    if (!seedFile) return
    setSeedStage('seeding')
    setSeedError('')
    const fd = new FormData()
    fd.append('file', seedFile)
    try {
      const res = await fetch('/api/kb/seed', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setSeedStage('error')
        setSeedError(data.error || 'Seed failed.')
        return
      }
      setSeedResult({ profileFields: data.profileFields, cannedCount: data.cannedCount })
      setSeedStage('done')
      await loadAll()
    } catch {
      setSeedStage('error')
      setSeedError('Upload failed. Please try again.')
    }
  }

  if (loading) return <div className={styles.loading}>Loading knowledge base…</div>

  return (
    <div className={styles.wrap}>

      {/* ── Section 1: Company Profile ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Company profile</h2>
          <p className={styles.sectionSub}>Used as Tier 2 context in every application draft.</p>
        </div>
        <div className={styles.profileGrid}>
          {PROFILE_FIELDS.map(f => (
            <div key={f.key} className={`${styles.field} ${f.multiline ? styles.fullWidth : ''}`}>
              <label className={styles.label}>{f.label}</label>
              {f.multiline ? (
                <textarea
                  className={styles.textarea}
                  value={profile[f.key] ?? ''}
                  onChange={e => setProfileState(p => ({ ...p, [f.key]: e.target.value }))}
                  rows={3}
                />
              ) : (
                <input
                  className={styles.input}
                  type="text"
                  value={profile[f.key] ?? ''}
                  onChange={e => setProfileState(p => ({ ...p, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
        <div className={styles.saveRow}>
          <button className={styles.btnPrimary} onClick={saveProfile} disabled={profileSaving}>
            {profileSaving ? 'Saving…' : profileSaved ? '✓ Saved' : 'Save profile'}
          </button>
        </div>
      </section>

      {/* ── Section 2: Canned Q&A ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Canned Q&amp;A</h2>
          <p className={styles.sectionSub}>
            {canned.length} entr{canned.length === 1 ? 'y' : 'ies'} — used as Tier 2 context when drafting.
          </p>
        </div>

        {canned.length === 0 ? (
          <div className={styles.emptyList}>No canned entries yet. Add one below or seed from a document.</div>
        ) : (
          <div className={styles.cannedList}>
            {canned.map((entry, idx) => (
              <div key={idx} className={styles.cannedEntry}>
                <button className={styles.deleteBtn} onClick={() => deleteCannedEntry(idx)}>Delete</button>
                <div className={styles.cannedQ}>{entry.question}</div>
                <div className={styles.cannedA}>{entry.answer}</div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.addForm}>
          <div className={styles.addFormTitle}>Add entry</div>
          <div className={styles.field}>
            <label className={styles.label}>Question</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. What problem are you solving?"
              value={newQ}
              onChange={e => setNewQ(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Answer</label>
            <textarea
              className={styles.textarea}
              placeholder="Your canned answer…"
              value={newA}
              onChange={e => setNewA(e.target.value)}
              rows={4}
            />
          </div>
          <button
            className={styles.btnPrimary}
            onClick={addCannedEntry}
            disabled={cannedAdding || !newQ.trim() || !newA.trim()}
          >
            {cannedAdding ? 'Adding…' : '+ Add entry'}
          </button>
        </div>
      </section>

      {/* ── Section 3: Seed from document ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Seed from document</h2>
          <p className={styles.sectionSub}>
            Upload the MetaPause KB questionnaire to auto-populate profile and canned Q&amp;A. Replaces existing data.
          </p>
        </div>

        {seedStage === 'done' && seedResult ? (
          <div className={styles.seedSuccess}>
            <div className={styles.successIcon}>✓</div>
            <div className={styles.successTitle}>Knowledge base seeded</div>
            <p className={styles.successMsg}>
              {seedResult.profileFields} profile field{seedResult.profileFields !== 1 ? 's' : ''} and{' '}
              {seedResult.cannedCount} Q&amp;A pair{seedResult.cannedCount !== 1 ? 's' : ''} saved.
            </p>
            <button className={styles.btnSecondary} onClick={() => { setSeedStage('idle'); setSeedFile(null) }}>
              Seed again
            </button>
          </div>
        ) : (
          <>
            <div
              className={`${styles.dropZone} ${seedFile ? styles.hasFile : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) setSeedFile(f)
              }}
            >
              {seedFile ? (
                <span>
                  {seedFile.name}{' '}
                  <button
                    className={styles.removeFile}
                    onClick={e => { e.stopPropagation(); setSeedFile(null) }}
                  >✕</button>
                </span>
              ) : (
                <span>Drop PDF or Word doc here, or click to browse</span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && setSeedFile(e.target.files[0])}
              />
            </div>

            {seedError && <div className={styles.alertError}>{seedError}</div>}

            {seedStage === 'seeding' && (
              <div className={styles.alertInfo}>
                <span className={styles.spinner} />
                Extracting and seeding knowledge base…
              </div>
            )}

            <div className={styles.saveRow}>
              <button
                className={styles.btnPrimary}
                onClick={handleSeed}
                disabled={!seedFile || seedStage === 'seeding'}
              >
                {seedStage === 'seeding' ? 'Processing…' : 'Seed knowledge base'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
