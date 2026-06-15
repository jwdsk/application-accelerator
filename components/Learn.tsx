'use client'
import { useState, useRef } from 'react'
import type { AppState } from '@/app/page'
import styles from './Learn.module.css'

interface Props {
  currentApp: AppState | null
  onReset: () => void
}

type Stage = 'idle' | 'uploading' | 'done' | 'error'

export default function Learn({ currentApp, onReset }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [correctedBy, setCorrectedBy] = useState('')
  const [appName, setAppName] = useState(currentApp?.name ?? '')
  const [stage, setStage] = useState<Stage>('idle')
  const [result, setResult] = useState<{ learned: number; message: string } | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!file) { setError('Please upload the corrected application file.'); return }
    if (!appName.trim()) { setError('Please enter the application name.'); return }

    setStage('uploading')
    setError('')

    const fd = new FormData()
    fd.append('file', file)
    fd.append('appName', appName)
    fd.append('correctedBy', correctedBy || 'Team')
    if (currentApp?.id) fd.append('appId', currentApp.id)

    try {
      const res = await fetch('/api/learn', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        setStage('error')
        setError(data.error)
        return
      }

      setResult(data)
      setStage('done')
    } catch {
      setStage('error')
      setError('Upload failed. Please try again.')
    }
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Upload corrected application</h1>
      <p className={styles.sub}>
        Once the team has reviewed and corrected the AI draft, upload the final version here.
        The system will extract the Q&A pairs and add them to the knowledge base — making future drafts better.
      </p>

      <div className={styles.howBox}>
        <div className={styles.howTitle}>How this works</div>
        <div className={styles.howStep}><span className={styles.howNum}>1</span> Download the AI draft, edit it in Word, Google Docs, or any editor</div>
        <div className={styles.howStep}><span className={styles.howNum}>2</span> Upload the corrected version below</div>
        <div className={styles.howStep}><span className={styles.howNum}>3</span> The agent extracts all Q&A pairs and saves them to Tier 1 of the KB</div>
        <div className={styles.howStep}><span className={styles.howNum}>4</span> Next application — agent drafts from your real corrected answers first</div>
      </div>

      {stage === 'done' && result ? (
        <div className={styles.successBox}>
          <div className={styles.successIcon}>✓</div>
          <div className={styles.successTitle}>Knowledge base updated</div>
          <p className={styles.successMsg}>{result.message}</p>
          <p className={styles.successSub}>The agent will use these answers when drafting future applications.</p>
          <button className={styles.btnPrimary} onClick={onReset}>Start new application →</button>
        </div>
      ) : (
        <>
          <div className={styles.field}>
            <label className={styles.label}>Application name</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. Techstars Health Cohort 2024"
              value={appName}
              onChange={e => setAppName(e.target.value)}
              disabled={stage === 'uploading'}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Corrected by (optional)</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Your name or team"
              value={correctedBy}
              onChange={e => setCorrectedBy(e.target.value)}
              disabled={stage === 'uploading'}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Corrected application file</label>
            <div
              className={`${styles.dropZone} ${file ? styles.hasFile : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const f = e.dataTransfer.files[0]
                if (f) setFile(f)
              }}
            >
              {file ? (
                <span>
                  📄 {file.name}{' '}
                  <button className={styles.removeFile} onClick={e => { e.stopPropagation(); setFile(null) }}>✕</button>
                </span>
              ) : (
                <span>Drop corrected PDF or Word doc here, or click to browse</span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
              />
            </div>
          </div>

          {error && <div className={styles.alertError}>{error}</div>}

          {stage === 'uploading' && (
            <div className={styles.alertInfo}>
              <span className={styles.spinner} />
              Processing corrected application…
            </div>
          )}

          <div className={styles.btnRow}>
            <button className={styles.btnSecondary} onClick={onReset}>← Back</button>
            <button
              className={styles.btnPrimary}
              onClick={handleUpload}
              disabled={stage === 'uploading'}
            >
              {stage === 'uploading' ? 'Processing…' : '📚 Add to knowledge base'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
