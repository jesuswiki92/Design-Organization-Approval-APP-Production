import { NextRequest } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth

  const { id } = await context.params
  const body = await request.json()

  const webhookUrl = process.env.NEXT_PUBLIC_DOA_QUOTATION_SAVE_WEBHOOK_URL
  if (!webhookUrl) {
    return Response.json(
      { error: 'Webhook URL not configured' },
      { status: 500 }
    )
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consulta_id: id,
        ...body,
      }),
    })
    const data = await res.json().catch(() => ({ ok: true }))
    return Response.json(data)
  } catch (err) {
    console.error('Error calling quotation webhook:', err)
    return Response.json({ error: 'Webhook error' }, { status: 502 })
  }
}
