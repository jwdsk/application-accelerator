import { NextRequest, NextResponse } from 'next/server'
import { getKBQuestions, setKBQuestions, updateKBAnswer } from '@/lib/kv'

export async function GET() {
  try {
    return NextResponse.json(await getKBQuestions())
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Expected array' }, { status: 400 })
    }
    await setKBQuestions(body)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, answer } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await updateKBAnswer(id, answer ?? '')
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
