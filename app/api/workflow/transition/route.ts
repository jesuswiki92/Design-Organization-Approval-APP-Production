// ⏸️ BASE DE DATOS DESCONECTADA - ver BASES-DE-DATOS.md para reconectar
import { NextResponse } from 'next/server'

import { requireUserApi } from '@/lib/auth/require-user'

export async function POST() {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth

  return NextResponse.json(
    { error: 'API desconectada durante reestructuración' },
    { status: 503 },
  )
}
