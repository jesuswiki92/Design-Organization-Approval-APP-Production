import { NextResponse } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'

/**
 * Proxy autenticado al webhook de n8n que actualiza el estado de un proyecto.
 * La URL del webhook vive en `DOA_PROJECT_STATE_WEBHOOK_URL` (server-only).
 * El cliente llama a `/api/webhooks/project-state` — la URL real nunca sale al bundle.
 */

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth

  const url = process.env.DOA_PROJECT_STATE_WEBHOOK_URL
  if (!url) {
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await upstream.text()
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('Content-Type') ?? 'application/json',
      },
    })
  } catch (err) {
    console.error('Error proxying project-state webhook:', err)
    return NextResponse.json(
      { error: 'Upstream webhook failed' },
      { status: 502 },
    )
  }
}
