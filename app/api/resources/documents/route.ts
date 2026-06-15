import { NextRequest, NextResponse } from 'next/server'
import { put, list, del } from '@vercel/blob'

export async function GET() {
  try {
    const { blobs } = await list()
    return NextResponse.json({ blobs })
  } catch (err: any) {
    console.error('Blob list error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    const blob = await put(file.name, file, { access: 'public' })
    return NextResponse.json(blob)
  } catch (err: any) {
    console.error('Blob put error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url')
    if (!url) {
      return NextResponse.json({ error: 'url required' }, { status: 400 })
    }
    await del(url)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Blob del error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
