'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import styles from './Resources.module.css'

type BlobFile = {
  url: string
  pathname: string
  size: number
  uploadedAt: string
  contentType: string
}

type CannedEntry = { question: string; answer: string }
type EditingState = { idx: number; field: 'question' | 'answer'; value: string }
type Tab = 'documents' | 'canned' | 'profile'

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

export default function Resources() {
  const [tab, setTab] = useState<Tab>('documents')

  // ── Documents ─────────────────────────────────────────────────────────────
  const [blobs, setBlobs] = useState<BlobFile[]>([])
  const [blobsLoading, setBlobsLoading] = useState(true)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Canned Q&A ────────────────────────────────────────────────────────────
  const [canned, setCanned] = useState<CannedEntry[]>([])
  const [cannedLoading, setCannedLoading] = useState(true)
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const [addingSaving, setAddingSaving] = useState(false)
  const skipBlur = useRef(false)

  // ── Company Profile ───────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Record<string, string>>({})
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  useEffect(() => {
    loadBlobs()
    loadCanned()
    loadProfile()
  }, [])

  // ── Loaders ───────────────────────────────────────────────────────────────

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

  // ── Document actions ──────────────────────────────────────────────────────

  async function uploadDoc() {
    if (!uploadFile) return
    setUploading(true)
    setUploadError('')
    const fd = new FormData()
    fd.append('file', uploadFile)
    try {
      const res = await fetch('/api/resources/documents', { method: 'POST', body: fd })
      if (!res.ok) {
        const d = await res.json()
        setUploadError(d.error || 'Upload failed.')
      } else {
        setUploadFile(null)
        await loadBlobs()
      }
    } catch { setUploadError('Upload failed. Please try again.') }
    setUploading(false)
  }

  async function deleteBlob(url: string) {
    setBlobs(prev => prev.filter(b => b.url !== url))
    await fetch(`/api/resources/documents?url=${encodeURIComponent(url)}`, { method: 'DELETE' })
  }

  // ── Canned Q&A actions ────────────────────────────────────────────────────

  function saveCannedToKV(entries: CannedEntry[]) {
    fetch('/api/kb?type=canned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entries),
    })
  }

  function handleEditBlur() {
    if (skipBlur.current) {
      skipBlur.current = false
      return
    }
    if (!editing) return
    const updated = canned.map((e, i) =>
      i === editing.idx ? { ...e, [editing.field]: editing.value } : e
    )
    setCanned(updated)
    setEditing(null)
    saveCannedToKV(updated)
  }

  function deleteCanned(idx: number) {
    skipBlur.current = true
    setEditing(null)
    setCanned(prev => {
      const filtered = prev.filter((_, i) => i !== idx)
      saveCannedToKV(filtered)
      return filtered
    })
  }

  async function addCannedEntry() {
    if (!newQ.trim() || !newA.trim()) return
    setAddingSaving(true)
    await fetch('/api/kb?type=canned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: newQ.trim(), answer: newA.trim() }),
    })
    setNewQ('')
    setNewA('')
    setAddingNew(false)
    setAddingSaving(false)
    await loadCanned()
  }

  // ── Profile actions ───────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.logo}>MetaPause <span>/ Resources</span></div>
        <nav className={styles.nav}>
          <Link href="/" className={styles.backLink}>← App</Link>
          <button className={`${styles.navBtn} ${tab === 'documents' ? styles.active : ''}`} onClick={() => setTab('documents')}>Documents</button>
          <button className={`${styles.navBtn} ${tab === 'canned' ? styles.active : ''}`} onClick={() => setTab('canned')}>Canned Q&amp;A</button>
          <button className={`${styles.navBtn} ${tab === 'profile' ? styles.active : ''}`} onClick={() => setTab('profile')}>Company Profile</button>
        </nav>
      </header>

      <main className={styles.main}>

        {/* ── TAB 1: Documents ── */}
        {tab === 'documents' && (
          <div>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Documents</h2>
              <p className={styles.sectionSub}>Upload PDFs, Word docs, and text files to your knowledge base.</p>
            </div>

            <div
              className={`${styles.dropZone} ${uploadFile ? styles.hasFile : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) setUploadFile(f)
              }}
            >
              {uploadFile ? (
                <span>
                  {uploadFile.name}{' '}
                  <button className={styles.removeFile} onClick={e => { e.stopPropagation(); setUploadFile(null) }}>✕</button>
                </span>
              ) : (
                <span>Drop PDF, DOCX, DOC, or TXT here, or click to browse</span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && setUploadFile(e.target.files[0])}
              />
            </div>

            {uploadError && <div className={styles.alertError}>{uploadError}</div>}

            {uploadFile && (
              <div className={styles.uploadRow}>
                <button className={styles.btnPrimary} onClick={uploadDoc} disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
                <button className={styles.btnSecondary} onClick={() => setUploadFile(null)}>Cancel</button>
              </div>
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

        {/* ── TAB 2: Canned Q&A ── */}
        {tab === 'canned' && (
          <div>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Canned Q&amp;A</h2>
              <p className={styles.sectionSub}>
                {cannedLoading ? 'Loading…' : `${canned.length} entr${canned.length === 1 ? 'y' : 'ies'}`} — click any field to edit in place.
              </p>
            </div>

            {cannedLoading ? (
              <div className={styles.loading}>Loading…</div>
            ) : (
              <>
                {canned.length === 0 && !addingNew && (
                  <div className={styles.empty}>No canned entries yet. Add one below.</div>
                )}

                <div className={styles.cannedList}>
                  {canned.map((entry, idx) => (
                    <div key={idx} className={`${styles.cannedCard} ${editing?.idx === idx ? styles.cannedCardActive : ''}`}>
                      <button
                        className={styles.deleteCannedBtn}
                        onMouseDown={() => { skipBlur.current = true }}
                        onClick={() => deleteCanned(idx)}
                      >
                        Delete
                      </button>

                      {editing?.idx === idx && editing.field === 'question' ? (
                        <input
                          className={styles.inlineInput}
                          value={editing.value}
                          autoFocus
                          onChange={e => setEditing({ ...editing, value: e.target.value })}
                          onBlur={handleEditBlur}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); handleEditBlur() }
                            if (e.key === 'Escape') { setEditing(null) }
                          }}
                        />
                      ) : (
                        <div
                          className={styles.cannedQ}
                          onClick={() => setEditing({ idx, field: 'question', value: entry.question })}
                        >
                          {entry.question || <span className={styles.placeholder}>Click to add question…</span>}
                        </div>
                      )}

                      {editing?.idx === idx && editing.field === 'answer' ? (
                        <textarea
                          className={styles.inlineTextarea}
                          value={editing.value}
                          autoFocus
                          rows={5}
                          onChange={e => setEditing({ ...editing, value: e.target.value })}
                          onBlur={handleEditBlur}
                          onKeyDown={e => {
                            if (e.key === 'Escape') { setEditing(null) }
                          }}
                        />
                      ) : (
                        <div
                          className={styles.cannedA}
                          onClick={() => setEditing({ idx, field: 'answer', value: entry.answer })}
                        >
                          {entry.answer || <span className={styles.placeholder}>Click to add answer…</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {addingNew ? (
                  <div className={styles.addForm}>
                    <div className={styles.field}>
                      <label className={styles.label}>Question</label>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="e.g. What problem are you solving?"
                        value={newQ}
                        onChange={e => setNewQ(e.target.value)}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Escape') { setAddingNew(false); setNewQ(''); setNewA('') } }}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Answer</label>
                      <textarea
                        className={styles.textarea}
                        placeholder="Your answer…"
                        value={newA}
                        onChange={e => setNewA(e.target.value)}
                        rows={4}
                      />
                    </div>
                    <div className={styles.addFormBtns}>
                      <button
                        className={styles.btnPrimary}
                        onClick={addCannedEntry}
                        disabled={addingSaving || !newQ.trim() || !newA.trim()}
                      >
                        {addingSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button className={styles.btnSecondary} onClick={() => { setAddingNew(false); setNewQ(''); setNewA('') }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className={styles.btnAddNew} onClick={() => setAddingNew(true)}>
                    + Add new Q&amp;A
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── TAB 3: Company Profile ── */}
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
