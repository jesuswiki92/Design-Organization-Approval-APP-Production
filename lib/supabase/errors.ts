/**
 * DETECCION DE ERRORES DE ESQUEMA EN SUPABASE
 *
 * Este archivo contiene funciones para detectar errores especificos de la base de datos.
 * En una app en desarrollo como esta, a veces la estructura de las tablas (el "esquema")
 * cambia y puede haber columnas o tablas que aun no se han creado en la base de datos.
 *
 * En lugar de que la app se rompa cuando esto pasa, estas funciones detectan
 * esos errores especificos y permiten manejarlos de forma controlada
 * (por ejemplo, mostrando datos vacios en vez de un error al usuario).
 */

/**
 * Revisa si un error de Supabase es porque faltan columnas o tablas en la base de datos.
 *
 * Esto ocurre cuando se agrega codigo nuevo que espera una columna que todavia
 * no existe en Supabase (una "migracion pendiente"). En vez de romper toda la pantalla,
 * la app detecta este error y puede continuar funcionando mostrando datos parciales.
 *
 * @param error - El objeto de error que devolvio Supabase (puede ser nulo si no hubo error)
 * @returns true si el error es por columnas o esquema faltante, false en caso contrario
 */
export function isMissingSchemaError(error: { message?: string } | null): boolean {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  return msg.includes('column') || msg.includes('schema')
}
