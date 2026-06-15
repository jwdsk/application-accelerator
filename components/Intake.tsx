'use client'
import { useState, useRef } from 'react'
import type { AppState } from '@/app/page'
import styles from './Intake.module.css'

interface Props {
  onDrafted: (app: AppState) => void
}

type Stage = 'idle' | 'extracting' | 'drafting' | 'error'

export default function Intake({ onDrafted }: Props) {
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [appName, setAppName] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [urlFailed, setUrlFailed] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    if (!url.trim() && !file) {
      setStatusMsg('Please enter a URL or upload a file.')
      return
    }
    if (!appName.trim()) {
      setStatusMsg('Please give this application a name (e.g. "Techstars Health 2024")')
      return
    }

    setStage('extracting')
    setStatusMsg('Fetching and extracting questions…')
    setUrlFailed(false)

    try {
      // Step 1: Extract questions
      const fd = new FormData()
      if (url.trim()) fd.append('url', url.trim())
      if (file) fd.append('file', file)

      const extractRes = await fetch('/api/extract', { method: 'POST', body: fd })
      const extractData = await extractRes.json()

      if (!extractRes.ok) {
        setStage('error')
        setStatusMsg(extractData.error)
        return
      }

      if (extractData.urlFailed) setUrlFailed(true)

      const { questions } = extractData
      setStatusMsg(`Found ${questions.length} questions. Drafting answers…`)
      setStage('drafting')

      // Step 2: Draft answers
      const draftRes = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, appName })
      })
      const draftData = await draftRes.json()

      if (!draftRes.ok) {
        setStage('error')
        setStatusMsg(draftData.error)
        return
      }

      // Step 3: Save to KB
      const appId = `app_${Date.now()}`
      const app: AppState = {
        id: appId,
        name: appName,
        source: extractData.source,
        questions: draftData.questions
      }

      await fetch('/api/kb?type=application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...app, status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      })

      setStage('idle')
      onDrafted(app)
    } catch (err: any) {
      setStage('error')
      setStatusMsg('Unexpected error. Please try again.')
    }
  }

  const loading = stage === 'extracting' || stage === 'drafting'

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>New application</h1>
      <p className={styles.sub}>Paste the application URL — the agent will extract all questions and draft answers from the MetaPause knowledge base.</p>

      <div className={styles.field}>
        <label className={styles.label}>Application name</label>
        <input
          className={styles.input}
          type="text"
          placeholder="e.g. Techstars Health Cohort 2024"
          value={appName}
          onChange={e => setAppName(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Application URL</label>
        <input
          className={styles.input}
          type="url"
          placeholder="https://apply.techstars.com/..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={loading}
        />
      </div>

      {urlFailed && (
        <div className={styles.alertWarn}>
          ⚠ URL couldn't be scraped (may be behind a login or JS-rendered). Used your uploaded file instead.
        </div>
      )}

      <div className={styles.orDivider}>or upload PDF / Word doc</div>

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
          <span>📄 {file.name} <button className={styles.removeFile} onClick={e => { e.stopPropagation(); setFile(null) }}>✕</button></span>
        ) : (
          <span>Drop PDF or Word doc here, or click to browse</span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
        />
      </div>

      {statusMsg && (
        <div className={stage === 'error' ? styles.alertError : styles.alertInfo}>
          {loading && <span className={styles.spinner} />}
          {statusMsg}
        </div>
      )}

      <button
        className={styles.btnPrimary}
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? `${stage === 'extracting' ? 'Extracting…' : 'Drafting…'}` : '⚡ Extract + draft answers'}
      </button>
    </div>
  )
}
