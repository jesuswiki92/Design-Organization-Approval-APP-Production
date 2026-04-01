// ⏸️ BASE DE DATOS DESCONECTADA - ver BASES-DE-DATOS.md para reconectar
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'API desconectada durante reestructuración' },
    { status: 503 },
  )
}
