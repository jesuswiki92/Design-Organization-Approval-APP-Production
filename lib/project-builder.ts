/**
 * Utilidades para proponer la creacion de un proyecto nuevo a partir de una
 * consulta entrante (fase "Abrir proyecto").
 *
 * - Deriva un prefijo numerico del modelo de aeronave (ej. "Cessna 208" -> "208",
 *   "Airbus A320" -> "320") o de las siglas del fabricante cuando no hay numero
 *   (ej. "Beechcraft King Air 200" -> "B20").
 * - Calcula el siguiente numero disponible combinando proyectos activos
 *   (`doa_proyectos`) y proyectos historicos (`doa_proyectos_historico`).
 * - Propone una estructura de carpetas estandar para el proyecto.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const PROJECT_FOLDER_STRUCTURE = [
  '01. Consulta',
  '02. Oferta',
  '03. Documentacion',
  '04. Ingenieria',
  '05. Certificacion',
  '06. Entregables',
] as const

export type ProjectPreview = {
  numero_proyecto_sugerido: string
  modelo_prefijo: string
  existentes_mismo_prefijo: number
  secuencia_sugerida: number
  titulo_sugerido: string
  aeronave: string | null
  cliente: string | null
  tcds_code: string | null
  tcds_code_short: string | null
  folder_path: string
  folder_structure: readonly string[]
}

/**
 * Deriva un prefijo corto para el numero_proyecto a partir del modelo de aeronave
 * o del fabricante. Busca primero un numero en el modelo (3-4 digitos) y,
 * si no lo encuentra, usa las 3 primeras letras mayusculas del fabricante/modelo.
 */
export function deriveModelPrefix(
  aircraftManufacturer: string | null,
  aircraftModel: string | null,
): string {
  const combined = `${aircraftManufacturer ?? ''} ${aircraftModel ?? ''}`.trim()

  // Buscar un numero de 3-4 digitos (ej. 208, 320, 1900)
  const numMatch = combined.match(/\b(\d{3,4})\b/)
  if (numMatch) return numMatch[1]

  // Buscar un patron tipo letra+numero (ej. A320, B737, L60, CL600)
  const alnumMatch = combined.match(/\b([A-Z]{1,3}\d{2,4})\b/i)
  if (alnumMatch) return alnumMatch[1].toUpperCase()

  // Fallback: 3 primeras letras del fabricante o modelo
  const fallbackSource = (aircraftModel || aircraftManufacturer || '').toUpperCase()
  const letters = fallbackSource.replace(/[^A-Z]/g, '').slice(0, 3)
  return letters || 'GEN'
}

/**
 * Normaliza un numero_proyecto extrayendo su prefijo y la secuencia numerica
 * final. Soporta tanto `208_094` como `20882` y `B30_058`.
 *
 * Devuelve { prefix, sequence } o null si no se puede extraer secuencia.
 */
function parseProjectNumber(numero: string): { prefix: string; sequence: number } | null {
  const underscoreMatch = numero.match(/^(.+?)_(\d+)$/)
  if (underscoreMatch) {
    return { prefix: underscoreMatch[1], sequence: Number(underscoreMatch[2]) }
  }
  // Si no hay underscore, intentar separar prefijo (caracteres iniciales)
  // del numero final. Ej: "20882" -> prefix "208", sequence "82"; "177001" -> "177", "001"
  const digitsOnly = numero.match(/^(\d{3,4})(\d+)$/)
  if (digitsOnly) {
    return { prefix: digitsOnly[1], sequence: Number(digitsOnly[2]) }
  }
  return null
}

/**
 * Calcula la siguiente secuencia disponible para un prefijo dado combinando
 * proyectos activos e historicos.
 */
export async function computeNextSequence(
  supabase: SupabaseClient,
  prefix: string,
): Promise<{ next: number; existing: number }> {
  const [activos, historicos] = await Promise.all([
    supabase
      .from('doa_proyectos')
      .select('numero_proyecto')
      .ilike('numero_proyecto', `${prefix}%`),
    supabase
      .from('doa_proyectos_historico')
      .select('numero_proyecto')
      .ilike('numero_proyecto', `${prefix}%`),
  ])

  const allNumbers = [
    ...((activos.data ?? []) as { numero_proyecto: string }[]),
    ...((historicos.data ?? []) as { numero_proyecto: string }[]),
  ]
    .map((r) => r.numero_proyecto)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)

  let maxSeq = 0
  for (const numero of allNumbers) {
    const parsed = parseProjectNumber(numero)
    if (parsed && parsed.prefix.toUpperCase() === prefix.toUpperCase()) {
      if (parsed.sequence > maxSeq) maxSeq = parsed.sequence
    }
  }

  return { next: maxSeq + 1, existing: allNumbers.length }
}

export function formatProjectNumber(prefix: string, sequence: number): string {
  const padded = String(sequence).padStart(3, '0')
  return `${prefix}_${padded}`
}

/**
 * Construye la ruta absoluta donde se creara la carpeta del proyecto.
 */
export function buildProjectFolderPath(baseDir: string, numeroProyecto: string): string {
  return `${baseDir.replace(/\\$/, '').replace(/\/$/, '')}/${numeroProyecto}`
}
