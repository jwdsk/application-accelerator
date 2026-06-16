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

type CannedEntry = { question: string; answer: string }

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
  const [reindexState, setReindexState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [reindexMsg, setReindexMsg] = useState('')
  const [reindexErrors, setReindexErrors] = useState<string[]>([])

  // ── Canned Q&A ───────────────────────────────────────────────────────────────
  const [canned, setCanned] = useState<CannedEntry[]>([])
  const [cannedLoading, setCannedLoading] = useState(true)
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const [cannedAdding, setCannedAdding] = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editingAnswer, setEditingAnswer] = useState('')
  const [editingSaving, setEditingSaving] = useState(false)

  // ── Company Profile ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  useEffect(() => {
    loadBlobs()
    loadCanned()
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

  async function loadCanned() {
    setCannedLoading(true)
    try {
      const res = await fetch('/api/kb?type=canned')
      const data = await res.json()
      setCanned(Array.isArray(data) ? data : [])
    } catch { setCanned([]) }
    setCannedLoading(false)
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

  async function reindexDocs() {
    setReindexState('running')
    setReindexMsg('')
    setReindexErrors([])
    try {
      const res = await fetch('/api/resources/documents/reindex', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Reindex failed')
      setReindexMsg(data.message)
      setReindexErrors(data.errors ?? [])
      setReindexState(data.errors?.length > 0 ? 'error' : 'done')
      await loadBlobs()
    } catch (err: any) {
      setReindexMsg(err.message ?? 'Reindex failed')
      setReindexState('error')
    }
  }

  async function deleteBlob(url: string) {
    setBlobs(prev => prev.filter(b => b.url !== url))
    await fetch(`/api/resources/documents?url=${encodeURIComponent(url)}`, { method: 'DELETE' })
  }

  // ── Canned Q&A actions ────────────────────────────────────────────────────────

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
    await loadCanned()
    setCannedAdding(false)
  }

  async function deleteCannedEntry(idx: number) {
    const filtered = canned.filter((_, i) => i !== idx)
    setCanned(filtered)
    await fetch('/api/kb?type=canned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filtered),
    })
  }

  async function saveEditedAnswer(idx: number) {
    setEditingSaving(true)
    const updated = canned.map((e, i) => i === idx ? { ...e, answer: editingAnswer } : e)
    setCanned(updated)
    await fetch('/api/kb?type=canned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setEditingIdx(null)
    setEditingSaving(false)
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

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.logo}>MetaPause <span>/ Resources</span></div>
        <nav className={styles.nav}>
          <Link href="/" className={styles.backLink}>← App</Link>
          <button className={`${styles.navBtn} ${tab === 'documents' ? styles.active : ''}`} onClick={() => setTab('documents')}>Documents</button>
          <button className={`${styles.navBtn} ${tab === 'kb' ? styles.active : ''}`} onClick={() => setTab('kb')}>Canned Q&amp;A</button>
          <button className={`${styles.navBtn} ${tab === 'profile' ? styles.active : ''}`} onClick={() => setTab('profile')}>Company Profile</button>
        </nav>
      </header>

      <main className={styles.main}>

        {/* ── TAB 1: Documents ────────────────────────────────────────────── */}
        {tab === 'documents' && (
          <div>
            <div className={styles.docHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Documents</h2>
                <p className={styles.sectionSub}>Upload PDFs, Word docs, and text files to your knowledge base.</p>
              </div>
              <div className={styles.reindexWrap}>
                <button
                  className={styles.btnReindex}
                  onClick={reindexDocs}
                  disabled={reindexState === 'running'}
                >
                  {reindexState === 'running' ? <><span className={styles.spinner} /> Indexing…</> : 'Re-index'}
                </button>
                {reindexMsg && (
                  <div className={reindexState === 'error' ? styles.reindexMsgError : styles.reindexMsg}>
                    {reindexMsg}
                  </div>
                )}
                {reindexErrors.length > 0 && (
                  <ul className={styles.reindexErrorList}>
                    {reindexErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
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

        {/* ── TAB 2: Canned Q&A ───────────────────────────────────────────── */}
        {tab === 'kb' && (
          <div>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Canned Q&amp;A</h2>
              <p className={styles.sectionSub}>
                {cannedLoading ? 'Loading…' : `${canned.length} entr${canned.length === 1 ? 'y' : 'ies'} — used as Tier 2 context when drafting.`}
              </p>
            </div>

            {cannedLoading ? (
              <div className={styles.loading}>Loading…</div>
            ) : canned.length === 0 ? (
              <div className={styles.empty}>No canned entries yet. Add one below.</div>
            ) : (
              <div className={styles.cannedList}>
                {canned.map((entry, idx) => (
                  <div key={idx} className={`${styles.cannedEntry} ${editingIdx === idx ? styles.cannedEntryEditing : ''}`}>
                    <div className={styles.cannedActions}>
                      {editingIdx === idx ? (
                        <>
                          <button className={styles.saveInlineBtn} onClick={() => saveEditedAnswer(idx)} disabled={editingSaving}>
                            {editingSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button className={styles.cancelBtn} onClick={() => setEditingIdx(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className={styles.editBtn} onClick={() => { setEditingIdx(idx); setEditingAnswer(entry.answer) }}>Edit</button>
                          <button className={styles.deleteBtn} onClick={() => deleteCannedEntry(idx)}>Delete</button>
                        </>
                      )}
                    </div>
                    <div className={styles.cannedQ}>{entry.question}</div>
                    {editingIdx === idx ? (
                      <textarea
                        className={styles.cannedEditTextarea}
                        value={editingAnswer}
                        onChange={e => setEditingAnswer(e.target.value)}
                        rows={5}
                        autoFocus
                      />
                    ) : (
                      <div className={styles.cannedA}>{entry.answer}</div>
                    )}
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
