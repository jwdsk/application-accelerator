'use client'
import { useState } from 'react'
import type { AppState, Question } from '@/app/page'
import styles from './Review.module.css'

interface Props {
  app: AppState
  setApp: (app: AppState) => void
  onLearn: () => void
  onReset: () => void
}

export default function Review({ app, setApp, onLearn, onReset }: Props) {
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const approved = app.questions.filter(q => q.status === 'approved').length
  const flagged = app.questions.filter(q => q.status === 'flagged').length
  const pending = app.questions.filter(q => q.status === 'pending').length

  function updateQuestion(num: number, updates: Partial<Question>) {
    const updated = {
      ...app,
      questions: app.questions.map(q => q.num === num ? { ...q, ...updates } : q)
    }
    setApp(updated)
    // Persist
    fetch('/api/kb?type=application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updated, status: 'reviewed', updatedAt: new Date().toISOString() })
    })
  }

  function approve(num: number) {
    updateQuestion(num, { status: 'approved' })
  }

  function flag(num: number) {
    updateQuestion(num, { status: 'flagged' })
  }

  function updateAnswer(num: number, value: string) {
    updateQuestion(num, { finalAnswer: value })
  }

  async function copyAll() {
    const text = app.questions.map(q =>
      `Q${q.num}. ${q.text}\n\n${q.finalAnswer}`
    ).join('\n\n─────\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadTxt() {
    const lines = [
      `APPLICATION: ${app.name}`,
      `GENERATED: ${new Date().toLocaleDateString()}`,
      `STATUS: ${approved}/${app.questions.length} approved`,
      '═'.repeat(60),
      '',
      ...app.questions.flatMap(q => [
        `Q${q.num}. ${q.text}`,
        `[${q.status.toUpperCase()}]`,
        '',
        q.finalAnswer,
        '',
        '─'.repeat(40),
        ''
      ])
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${app.name.replace(/\s+/g, '_')}_draft.txt`
    a.click()
  }

  const confColor = (c: number) =>
    c >= 0.8 ? 'var(--teal)' : c >= 0.5 ? 'var(--amber)' : 'var(--red)'

  return (
    <div className={styles.wrap}>
      {/* Header stats */}
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.title}>{app.name}</h1>
          <p className={styles.sub}>{app.source}</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={copyAll}>
            {copied ? '✓ Copied' : '📋 Copy all'}
          </button>
          <button className={styles.btnSecondary} onClick={downloadTxt}>⬇ Download</button>
          <button className={styles.btnLearn} onClick={onLearn}>Upload corrected →</button>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}><span className={styles.statNum}>{approved}</span><span className={styles.statLabel}>Approved</span></div>
        <div className={styles.stat}><span className={styles.statNum}>{pending}</span><span className={styles.statLabel}>Pending</span></div>
        <div className={styles.stat}><span className={styles.statNum}>{flagged}</span><span className={styles.statLabel}>Flagged</span></div>
        <div className={styles.stat}><span className={`${styles.statNum} ${styles.pct}`}>{Math.round((approved / app.questions.length) * 100)}%</span><span className={styles.statLabel}>Done</span></div>
      </div>

      {/* Question cards */}
      <div className={styles.qList}>
        {app.questions.map(q => (
          <div
            key={q.num}
            className={`${styles.qCard} ${q.status === 'approved' ? styles.cardApproved : q.status === 'flagged' ? styles.cardFlagged : ''}`}
          >
            <div className={styles.qTop}>
              <div className={styles.qMeta}>
                <span className={styles.qNum}>Q{q.num}</span>
                <span className={styles.qCat}>{q.category}</span>
                {q.charLimit && <span className={styles.qLimit}>{q.charLimit} chars</span>}
              </div>
              <div className={styles.qStatus}>
                <span className={`${styles.dot} ${styles[`dot_${q.status}`]}`} />
                {q.status}
              </div>
            </div>

            <p className={styles.qText}>{q.text}</p>

            {/* Confidence bar */}
            <div className={styles.confRow}>
              <span className={styles.confLabel}>Confidence</span>
              <div className={styles.confBar}>
                <div className={styles.confFill} style={{ width: `${q.confidence * 100}%`, background: confColor(q.confidence) }} />
              </div>
              <span className={styles.confPct}>{Math.round(q.confidence * 100)}%</span>
            </div>

            {/* Answer — editable */}
            <textarea
              className={styles.answer}
              value={q.finalAnswer}
              onChange={e => updateAnswer(q.num, e.target.value)}
              rows={Math.max(4, Math.ceil(q.finalAnswer.length / 80))}
            />
            {q.charLimit && (
              <div className={`${styles.charCount} ${q.finalAnswer.length > q.charLimit ? styles.charOver : ''}`}>
                {q.finalAnswer.length} / {q.charLimit}
              </div>
            )}

            {/* AI draft comparison if edited */}
            {q.finalAnswer !== q.aiDraft && (
              <button
                className={styles.revertBtn}
                onClick={() => updateAnswer(q.num, q.aiDraft)}
              >
                ↩ Revert to AI draft
              </button>
            )}

            <div className={styles.qActions}>
              <button className={styles.btnApprove} onClick={() => approve(q.num)}>✓ Approve</button>
              <button className={styles.btnFlag} onClick={() => flag(q.num)}>⚑ Flag</button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <button className={styles.btnSecondary} onClick={onReset}>← New application</button>
        <button className={styles.btnLearn} onClick={onLearn}>Done — upload corrected version →</button>
      </div>
    </div>
  )
}
