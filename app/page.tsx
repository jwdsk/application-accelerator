'use client'
import { useState } from 'react'
import Link from 'next/link'
import Intake from '@/components/Intake'
import Review from '@/components/Review'
import Learn from '@/components/Learn'
import KB from '@/components/KB'
import styles from './page.module.css'

export type Question = {
  num: number
  text: string
  category: string
  charLimit: number | null
  aiDraft: string
  finalAnswer: string
  confidence: number
  kbSources: string[]
  status: 'pending' | 'approved' | 'flagged'
}

export type AppState = {
  id: string
  name: string
  source: string
  questions: Question[]
}

type View = 'intake' | 'review' | 'learn' | 'kb'

export default function Home() {
  const [view, setView] = useState<View>('intake')
  const [app, setApp] = useState<AppState | null>(null)

  function onDrafted(newApp: AppState) {
    setApp(newApp)
    setView('review')
  }

  function onLearn() {
    setView('learn')
  }

  function onReset() {
    setApp(null)
    setView('intake')
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.logo}>
          MetaPause <span>/ Accelerator Agent</span>
        </div>
        <nav className={styles.nav}>
          <button
            className={`${styles.navBtn} ${view === 'intake' ? styles.active : ''}`}
            onClick={() => setView('intake')}
          >
            1. Intake
          </button>
          <button
            className={`${styles.navBtn} ${view === 'review' ? styles.active : ''} ${!app ? styles.disabled : ''}`}
            onClick={() => app && setView('review')}
          >
            2. Review {app ? `(${app.questions.length}q)` : ''}
          </button>
          <button
            className={`${styles.navBtn} ${view === 'learn' ? styles.active : ''}`}
            onClick={() => setView('learn')}
          >
            3. Learn
          </button>
          <button
            className={`${styles.navBtn} ${view === 'kb' ? styles.active : ''}`}
            onClick={() => setView('kb')}
          >
            KB
          </button>
          <Link href="/resources" className={styles.navBtn}>
            Resources
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        {view === 'intake' && <Intake onDrafted={onDrafted} />}
        {view === 'review' && app && <Review app={app} setApp={setApp} onLearn={onLearn} onReset={onReset} />}
        {view === 'review' && !app && (
          <div className={styles.empty}>
            <p>No application loaded yet.</p>
            <button className={styles.btnPrimary} onClick={() => setView('intake')}>Go to intake →</button>
          </div>
        )}
        {view === 'learn' && <Learn currentApp={app} onReset={onReset} />}
        {view === 'kb' && <KB />}
      </main>
    </div>
  )
}
