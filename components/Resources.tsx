'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { upload } from '@vercel/blob/client'
import styles from './Resources.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

type BlobFile = {
  url: string
  pathname: string
  size: number
  uploadedAt: string
  contentType: string
}

type KBQuestion = {
  id: string
  section: string
  question: string
  context: string
  answer: string
}

type Tab = 'documents' | 'kb' | 'profile'

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileLabel(contentType: string, pathname: string) {
  if (contentType?.includes('pdf')) return 'PDF'
  if (contentType?.includes('wordprocessingml')) return 'DOCX'
  if (contentType?.includes('msword')) return 'DOC'
  if (contentType?.includes('text/plain')) return 'TXT'
  return pathname.split('.').pop()?.toUpperCase() ?? 'FILE'
}

function formatSize(bytes: number) {
  if (bytes < 1000) return `${bytes} B`
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Resources() {
  const [tab, setTab] = useState<Tab>('documents')

  // ── Documents ───────────────────────────────────────────────────────────────
  const [blobs, setBlobs] = useState<BlobFile[]>([])
  const [blobsLoading, setBlobsLoading] = useState(true)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadStage, setUploadStage] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [uploadedName, setUploadedName] = useState('')
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Knowledge Base ───────────────────────────────────────────────────────────
  const [kbQuestions, setKbQuestions] = useState<KBQuestion[]>([])
  const [kbLoading, setKbLoading] = useState(true)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [seedModalOpen, setSeedModalOpen] = useState(false)
  const [seedFile, setSeedFile] = useState<File | null>(null)
  const [seedLoading, setSeedLoading] = useState(false)
  const [seedError, setSeedError] = useState('')
  const [seedSuccess, setSeedSuccess] = useState<number | null>(null)
  const csvRef = useRef<HTMLInputElement>(null)

  // ── Company Profile ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  useEffect(() => {
    loadBlobs()
    loadKBQuestions()
    loadProfile()
  }, [])

  // ── Loaders ──────────────────────────────────────────────────────────────────

  async function loadBlobs() {
    setBlobsLoading(true)
    try {
      const res = await fetch('/api/resources/documents')
      const data = await res.json()
      setBlobs(data.blobs ?? [])
    } catch { setBlobs([]) }
    setBlobsLoading(false)
  }

  async function loadKBQuestions() {
    setKbLoading(true)
    try {
      const res = await fetch('/api/kb/questions')
      const data = await res.json()
      setKbQuestions(Array.isArray(data) ? data : [])
    } catch { setKbQuestions([]) }
    setKbLoading(false)
  }

  async function loadProfile() {
    setProfileLoading(true)
    try {
      const res = await fetch('/api/kb?type=profile')
      const data = await res.json()
      setProfile(data ?? {})
    } catch { setProfile({}) }
    setProfileLoading(false)
  }

  // ── Document actions ─────────────────────────────────────────────────────────

  async function uploadDoc() {
    if (!uploadFile) return
    const file = uploadFile
    setUploadStage('processing')
    setUploadError('')
    try {
      await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/resources/documents',
      })
      setUploadFile(null)
      setUploadedName(file.name)
      setUploadStage('done')
      await loadBlobs()
    } catch (err: any) {
      setUploadError('Upload failed: ' + (err.message ?? 'Please try again.'))
      setUploadStage('error')
    }
  }

  function resetUpload() {
    setUploadStage('idle')
    setUploadFile(null)
    setUploadError('')
    setUploadedName('')
  }

  async function deleteBlob(url: string) {
    setBlobs(prev => prev.filter(b => b.url !== url))
    await fetch(`/api/resources/documents?url=${encodeURIComponent(url)}`, { method: 'DELETE' })
  }

  // ── KB actions ───────────────────────────────────────────────────────────────

  function handleAnswerChange(id: string, answer: string) {
    setKbQuestions(prev => prev.map(q => q.id === id ? { ...q, answer } : q))
  }

  async function handleAnswerBlur(id: string, answer: string) {
    await fetch('/api/kb/questions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, answer }),
    })
    setSavedIds(prev => new Set([...prev, id]))
    setTimeout(() => {
      setSavedIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }, 2000)
  }

  function openSeedModal() {
    setSeedFile(null)
    setSeedError('')
    setSeedSuccess(null)
    setSeedModalOpen(true)
  }

  async function handleSeedCSV() {
    if (!seedFile) return
    setSeedLoading(true)
    setSeedError('')
    const fd = new FormData()
    fd.append('file', seedFile)
    try {
      const res = await fetch('/api/kb/questions/seed', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setSeedError(data.error || 'Seed failed.')
      } else {
        setSeedSuccess(data.seeded)
        setSeedFile(null)
        await loadKBQuestions()
      }
    } catch {
      setSeedError('Upload failed. Please try again.')
    }
    setSeedLoading(false)
  }

  // ── Profile actions ───────────────────────────────────────────────────────────

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

  // ── KB grouping ───────────────────────────────────────────────────────────────

  const kbSections = kbQuestions.reduce((acc, q) => {
    if (!acc.has(q.section)) acc.set(q.section, [])
    acc.get(q.section)!.push(q)
    return acc
  }, new Map<string, KBQuestion[]>())

  const answeredCount = kbQuestions.filter(q => q.answer.trim()).length
  const totalCount = kbQuestions.length
  const progressPct = totalCount ? Math.round((answeredCount / totalCount) * 100) : 0

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.logo}>MetaPause <span>/ Resources</span></div>
        <nav className={styles.nav}>
          <Link href="/" className={styles.backLink}>← App</Link>
          <button className={`${styles.navBtn} ${tab === 'documents' ? styles.active : ''}`} onClick={() => setTab('documents')}>Documents</button>
          <button className={`${styles.navBtn} ${tab === 'kb' ? styles.active : ''}`} onClick={() => setTab('kb')}>Knowledge Base</button>
          <button className={`${styles.navBtn} ${tab === 'profile' ? styles.active : ''}`} onClick={() => setTab('profile')}>Company Profile</button>
        </nav>
      </header>

      <main className={styles.main}>

        {/* ── TAB 1: Documents ────────────────────────────────────────────── */}
        {tab === 'documents' && (
          <div>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Documents</h2>
              <p className={styles.sectionSub}>Upload PDFs, Word docs, and text files to your knowledge base.</p>
            </div>

            {uploadStage === 'done' ? (
              <div className={styles.uploadSuccess}>
                <span className={styles.uploadSuccessIcon}>✓</span>
                <div>
                  <div className={styles.uploadSuccessTitle}>Uploaded and indexed for AI drafting</div>
                  <div className={styles.uploadSuccessFile}>{uploadedName}</div>
                </div>
                <button className={styles.btnSecondary} onClick={resetUpload}>Upload another</button>
              </div>
            ) : (
              <>
                <div
                  className={`${styles.dropZone} ${uploadFile ? styles.hasFile : ''} ${uploadStage === 'processing' ? styles.dropZoneProcessing : ''}`}
                  onClick={() => uploadStage === 'idle' || uploadStage === 'error' ? fileRef.current?.click() : undefined}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    const f = e.dataTransfer.files[0]
                    if (f) { resetUpload(); setUploadFile(f) }
                  }}
                >
                  {uploadStage === 'processing' ? (
                    <span className={styles.processingLabel}><span className={styles.spinner} /> Uploading and extracting text…</span>
                  ) : uploadFile ? (
                    <span>
                      {uploadFile.name}{' '}
                      <button className={styles.removeFile} onClick={e => { e.stopPropagation(); setUploadFile(null) }}>✕</button>
                    </span>
                  ) : (
                    <span>Drop PDF, DOCX, DOC, or TXT here, or click to browse</span>
                  )}
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files?.[0]) { resetUpload(); setUploadFile(e.target.files[0]) } }} />
                </div>

                {uploadError && <div className={styles.alertError}>{uploadError}</div>}

                {uploadFile && uploadStage !== 'processing' && (
                  <div className={styles.uploadRow}>
                    <button className={styles.btnPrimary} onClick={uploadDoc}>Upload</button>
                    <button className={styles.btnSecondary} onClick={resetUpload}>Cancel</button>
                  </div>
                )}
              </>
            )}

            {blobsLoading ? (
              <div className={styles.loading}>Loading documents…</div>
            ) : blobs.length === 0 ? (
              <div className={styles.empty}>No documents uploaded yet.</div>
            ) : (
              <div className={styles.blobList}>
                {blobs.map(blob => (
                  <div key={blob.url} className={styles.blobCard}>
                    <div className={styles.blobInfo}>
                      <span className={styles.blobName}>{blob.pathname.split('/').pop() ?? blob.pathname}</span>
                      <div className={styles.blobMeta}>
                        <span className={styles.badge}>{fileLabel(blob.contentType, blob.pathname)}</span>
                        <span className={styles.blobDate}>{formatDate(blob.uploadedAt)}</span>
                        <span className={styles.blobSize}>{formatSize(blob.size)}</span>
                      </div>
                    </div>
                    <div className={styles.blobActions}>
                      <a className={styles.btnView} href={blob.url} target="_blank" rel="noopener noreferrer">View</a>
                      <button className={styles.btnDelete} onClick={() => deleteBlob(blob.url)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Knowledge Base ────────────────────────────────────────── */}
        {tab === 'kb' && (
          <div>
            <div className={styles.kbTopRow}>
              <div>
                <h2 className={styles.sectionTitle}>Knowledge Base</h2>
                <p className={styles.sectionSub}>
                  {kbLoading ? 'Loading…' : `${answeredCount} / ${totalCount} questions answered`}
                </p>
              </div>
              <button className={styles.btnPrimary} onClick={openSeedModal}>Seed from CSV</button>
            </div>

            {!kbLoading && totalCount > 0 && (
              <div className={styles.progressWrap}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
                </div>
                <span className={styles.progressLabel}>{progressPct}%</span>
              </div>
            )}

            {kbLoading ? (
              <div className={styles.loading}>Loading…</div>
            ) : totalCount === 0 ? (
              <div className={styles.kbEmpty}>
                <div className={styles.kbEmptyTitle}>No questions yet</div>
                <p className={styles.kbEmptySub}>
                  Upload a CSV with your knowledge base questions to get started.
                  Each row should have a question (starting with a number like "1.") in column A and a context hint in column B.
                </p>
                <button className={styles.btnPrimary} onClick={openSeedModal}>Seed from CSV</button>
              </div>
            ) : (
              <div className={styles.kbList}>
                {Array.from(kbSections.entries()).map(([section, questions]) => (
                  <div key={section} className={styles.kbSection}>
                    <div className={styles.kbSectionHeader}>{section}</div>
                    {questions.map(q => (
                      <div
                        key={q.id}
                        className={`${styles.qCard} ${q.answer.trim() ? styles.qCardAnswered : styles.qCardEmpty}`}
                      >
                        <div className={styles.qText}>{q.question}</div>
                        {q.context && <div className={styles.qContext}>{q.context}</div>}
                        <div className={styles.qAnswerWrap}>
                          <textarea
                            className={styles.qTextarea}
                            value={q.answer}
                            placeholder="Type your answer…"
                            rows={3}
                            onChange={e => handleAnswerChange(q.id, e.target.value)}
                            onBlur={e => handleAnswerBlur(q.id, e.target.value)}
                          />
                          {savedIds.has(q.id) && (
                            <div className={styles.savedIndicator}>✓ Saved</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Seed CSV modal */}
            {seedModalOpen && (
              <div className={styles.modalOverlay} onClick={() => setSeedModalOpen(false)}>
                <div className={styles.modal} onClick={e => e.stopPropagation()}>
                  <div className={styles.modalTitle}>Seed from CSV</div>
                  <p className={styles.modalSub}>
                    Two-column CSV: question text in column A, context hint in column B.
                    Question rows must start with a number (e.g. <em>1. What is MetaPause?</em>) or Q prefix (<em>Q1 Why now?</em>).
                    Any row without that prefix becomes a section header.
                  </p>

                  {seedSuccess !== null ? (
                    <div className={styles.seedSuccessBox}>
                      <div className={styles.seedSuccessTitle}>✓ {seedSuccess} questions seeded</div>
                      <button className={styles.btnPrimary} onClick={() => setSeedModalOpen(false)}>Done</button>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`${styles.modalDropZone} ${seedFile ? styles.hasFile : ''}`}
                        onClick={() => csvRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault()
                          const f = e.dataTransfer.files[0]
                          if (f) { setSeedFile(f); setSeedError('') }
                        }}
                      >
                        {seedFile ? (
                          <span>
                            {seedFile.name}{' '}
                            <button className={styles.removeFile} onClick={e => { e.stopPropagation(); setSeedFile(null) }}>✕</button>
                          </span>
                        ) : (
                          <span>Drop CSV here, or click to browse</span>
                        )}
                        <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }}
                          onChange={e => { if (e.target.files?.[0]) { setSeedFile(e.target.files[0]); setSeedError('') } }} />
                      </div>

                      {seedError && <div className={styles.alertError}>{seedError}</div>}

                      <div className={styles.modalActions}>
                        <button
                          className={styles.btnPrimary}
                          onClick={handleSeedCSV}
                          disabled={!seedFile || seedLoading}
                        >
                          {seedLoading ? 'Seeding…' : 'Seed knowledge base'}
                        </button>
                        <button className={styles.btnSecondary} onClick={() => setSeedModalOpen(false)}>Cancel</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: Company Profile ───────────────────────────────────────── */}
        {tab === 'profile' && (
          <div>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Company Profile</h2>
              <p className={styles.sectionSub}>Used as Tier 2 context in every application draft.</p>
            </div>

            {profileLoading ? (
              <div className={styles.loading}>Loading…</div>
            ) : (
              <>
                <div className={styles.profileGrid}>
                  {PROFILE_FIELDS.map(f => (
                    <div key={f.key} className={`${styles.field} ${f.multiline ? styles.fullWidth : ''}`}>
                      <label className={styles.label}>{f.label}</label>
                      {f.multiline ? (
                        <textarea
                          className={styles.textarea}
                          value={profile[f.key] ?? ''}
                          onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                          rows={3}
                        />
                      ) : (
                        <input
                          className={styles.input}
                          type="text"
                          value={profile[f.key] ?? ''}
                          onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className={styles.saveRow}>
                  <button className={styles.btnPrimary} onClick={saveProfile} disabled={profileSaving}>
                    {profileSaving ? 'Saving…' : profileSaved ? '✓ Saved' : 'Save changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
