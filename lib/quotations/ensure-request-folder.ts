import 'server-only'

import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const SIMULATION_BASE_PATH =
  process.env.DOA_SIMULATION_BASE_PATH ??
  'C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/02. Data DOA/00. APP sinulation/01. DOA_ENTRADAS'

/**
 * Crea la folder de simulacion para una request entrante si no existe.
 *
 * Estructura:
 *   {SIMULATION_BASE_PATH}/{numeroEntrada}/
 *     emails/
 *     adjuntos/
 *
 * Es idempotente: si la folder ya existe, no hace nada.
 * No lanza excepciones para no interrumpir la carga de la page.
 *
 * @returns `{ created: true }` si se creo, `{ created: false }` si ya existia,
 *          o `{ created: false, error }` si failed.
 */
export async function ensureConsultaFolder(
  numeroEntrada: string,
): Promise<{ created: boolean; error?: string }> {
  const trimmed = numeroEntrada.trim()
  if (!trimmed) {
    return { created: false, error: 'entry_number vacio' }
  }

  try {
    const baseFolderPath = path.join(SIMULATION_BASE_PATH, trimmed)
    const alreadyExists = existsSync(baseFolderPath)

    await Promise.all([
      mkdir(path.join(baseFolderPath, 'emails'), { recursive: true }),
      mkdir(path.join(baseFolderPath, 'adjuntos'), { recursive: true }),
    ])

    return { created: !alreadyExists }
  } catch (error) {
    console.error('Error creando folder de request:', error)
    return {
      created: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
