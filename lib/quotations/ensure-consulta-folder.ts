import 'server-only'

import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const SIMULATION_BASE_PATH =
  process.env.DOA_SIMULATION_BASE_PATH ??
  'C:/Users/Jesús Andrés/Desktop/Aplicaciones - Desarrollo/Design Organization Approval - APP Production/02. Datos DOA/00. APP sinulation/01. DOA_ENTRADAS'

/**
 * Crea la carpeta de simulacion para una consulta entrante si no existe.
 *
 * Estructura:
 *   {SIMULATION_BASE_PATH}/{numeroEntrada}/
 *     1. Email/
 *     2. Adjuntos/
 *
 * Es idempotente: si la carpeta ya existe, no hace nada.
 * No lanza excepciones para no interrumpir la carga de la pagina.
 *
 * @returns `{ created: true }` si se creo, `{ created: false }` si ya existia,
 *          o `{ created: false, error }` si fallo.
 */
export async function ensureConsultaFolder(
  numeroEntrada: string,
): Promise<{ created: boolean; error?: string }> {
  const trimmed = numeroEntrada.trim()
  if (!trimmed) {
    return { created: false, error: 'numero_entrada vacio' }
  }

  try {
    const baseFolderPath = path.join(SIMULATION_BASE_PATH, trimmed)
    const alreadyExists = existsSync(baseFolderPath)

    await Promise.all([
      mkdir(path.join(baseFolderPath, '1. Email'), { recursive: true }),
      mkdir(path.join(baseFolderPath, '2. Adjuntos'), { recursive: true }),
    ])

    return { created: !alreadyExists }
  } catch (error) {
    console.error('Error creando carpeta de consulta:', error)
    return {
      created: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
