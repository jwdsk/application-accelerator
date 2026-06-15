import { NextRequest, NextResponse } from 'next/server'
import { setKBQuestions } from '@/lib/kv'
import type { KBQuestion } from '@/lib/kv'

// Handles basic CSV including quoted fields
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim()); current = ''
      } else {
        current += ch
      }
    }
    cells.push(current.trim())
    rows.push(cells)
  }
  return rows
}

// "1. Text", "Q1. Text", "Q1 Text" → question row; strip the prefix for clean storage
const QUESTION_PREFIX = /^(Q?\d+[\.\)\:\s]+\s*)/i

function isQuestionRow(colA: string): boolean {
  return QUESTION_PREFIX.test(colA)
}

function stripPrefix(colA: string): string {
  return colA.replace(QUESTION_PREFIX, '').trim()
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const text = await file.text()
    const rows = parseCSV(text)

    const questions: KBQuestion[] = []
    let currentSection = 'General'
    let qIndex = 0

    for (const row of rows) {
      const colA = row[0]?.trim() ?? ''
      const colB = row[1]?.trim() ?? ''
      if (!colA) continue

      if (isQuestionRow(colA)) {
        questions.push({
          id: `q${++qIndex}`,
          section: currentSection,
          question: stripPrefix(colA),
          context: colB,
          answer: '',
        })
      } else {
        // Section header — skip rows that look like column labels
        if (colA.toLowerCase() !== 'question' && colA.toLowerCase() !== 'section') {
          currentSection = colA
        }
      }
    }

    if (questions.length === 0) {
      return NextResponse.json(
        { error: 'No questions found. Make sure question rows start with a number (e.g. "1. What is...") or Q prefix (e.g. "Q1 What is...").' },
        { status: 422 }
      )
    }

    await setKBQuestions(questions)
    return NextResponse.json({ seeded: questions.length })
  } catch (err: any) {
    console.error('Seed error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
