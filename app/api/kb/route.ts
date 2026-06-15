import { NextRequest, NextResponse } from 'next/server'
import {
  getProfile, setProfile,
  getCanned, setCanned, addCanned,
  getCorrected,
  saveApplication, getApplication, listApplications,
  getFullKB
} from '@/lib/kv'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const id = searchParams.get('id')

  try {
    switch (type) {
      case 'profile':
        return NextResponse.json(await getProfile())

      case 'canned':
        return NextResponse.json(await getCanned())

      case 'corrected':
        return NextResponse.json(await getCorrected())

      case 'application':
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
        const app = await getApplication(id)
        if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        return NextResponse.json(app)

      case 'applications':
        return NextResponse.json(await listApplications())

      case 'full':
        return NextResponse.json(await getFullKB())

      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('KB GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  try {
    const body = await req.json()

    switch (type) {
      case 'profile':
        await setProfile(body)
        return NextResponse.json({ ok: true })

      case 'canned':
        // body = { question, answer } for single, or array for bulk
        if (Array.isArray(body)) {
          await setCanned(body)
        } else {
          await addCanned(body)
        }
        return NextResponse.json({ ok: true })

      case 'application':
        await saveApplication(body)
        return NextResponse.json({ ok: true })

      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('KB POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
