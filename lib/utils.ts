/**
 * UTILIDADES GENERALES DE LA APLICACION
 *
 * Este archivo contiene funciones auxiliares que se usan en toda la app.
 * Por ahora solo tiene una funcion para combinar clases de estilo (CSS),
 * pero aqui se pueden agregar mas utilidades compartidas en el futuro.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combina varias clases de estilo CSS en una sola cadena de texto.
 *
 * Esto es necesario porque Tailwind CSS (el sistema de estilos de la app)
 * a veces genera conflictos cuando se juntan varias clases. Esta funcion
 * resuelve esos conflictos automaticamente.
 *
 * Se usa en practicamente todos los componentes visuales de la app.
 *
 * @param inputs - Una o mas clases de estilo que se quieren combinar
 * @returns Una cadena de texto con las clases de estilo ya combinadas sin conflictos
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
