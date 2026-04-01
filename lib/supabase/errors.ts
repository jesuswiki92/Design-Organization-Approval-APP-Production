/**
 * Detecta si un error de Supabase es por columnas que no existen en el schema.
 * Útil para manejar migraciones pendientes sin romper la app.
 */
export function isMissingSchemaError(error: { message?: string } | null): boolean {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  return msg.includes('column') || msg.includes('schema')
}
