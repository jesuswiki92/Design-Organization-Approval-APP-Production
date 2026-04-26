/**
 * ============================================================================
 * DELETE /api/incoming-requests/[id]
 * ============================================================================
 *
 * Borra una fila de `doa_incoming_requests_v2` y todas las filas dependientes.
 *
 * Las FK en Supabase ya tienen ON DELETE CASCADE para:
 *   - doa_emails
 *   - doa_quotations
 *   - doa_form_tokens
 *   - doa_form_submissions
 *
 * `doa_projects` NO cascadea: si hay un proyecto apuntando, el DELETE falla
 * con violacion de FK. En ese caso devolvemos 409 con mensaje claro al cliente.
 *
 * Sin auth (frame-only). Cuando se reconecte auth se le ponira un guard.
 * ============================================================================
 */

import { NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params

  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'Missing id' },
      { status: 400 },
    )
  }

  const { error, count } = await supabaseServer
    .from('doa_incoming_requests_v2')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) {
    // FK violation con doa_projects: el cliente sabe que tiene un proyecto derivado
    const isFkViolation =
      error.code === '23503' ||
      /foreign key|violates foreign key/i.test(error.message)

    return NextResponse.json(
      {
        ok: false,
        error: isFkViolation
          ? 'No se puede eliminar: existe un proyecto derivado de esta request. Borra el proyecto primero o desvincula la referencia.'
          : `Supabase delete error: ${error.message}`,
      },
      { status: isFkViolation ? 409 : 500 },
    )
  }

  if (!count || count === 0) {
    return NextResponse.json(
      { ok: false, error: 'Request not found' },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true, deleted: count })
}
