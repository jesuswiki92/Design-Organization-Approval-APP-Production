/**
 * ============================================================================
 * GENERACION DE .docx DESDE PLANTILLAS .dotx
 * ============================================================================
 *
 * Utilidades para:
 *  - Resolver el name real de fichero .dotx a partir del codigo de template
 *    (ej. "G12-01" -> "G12-01 Ed_01 Change Classification.dotx").
 *  - Generar un .docx a partir de un .dotx aplicando reemplazos literales
 *    en `word/document.xml` (los "placeholders" de las templates DOA son
 *    palabras literales: `project_code`, `document_code`, etc.).
 *
 * Este modulo NO modifica el formato Word: solo hace replace en el XML y
 * regenera el zip. Se usa desde el flujo manual "Crear Project New".
 * ============================================================================
 */
import { readFile, writeFile, readdir } from 'fs/promises'
import JSZip from 'jszip'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Reemplaza un placeholder literal en el XML de Word tolerando que el text
 * pueda venir fragmentado entre nodos `<w:t>`. Primero intenta `replaceAll`
 * directo; si no encuentra coincidencias, aplica un regex que permite
 * etiquetas XML intermedias entre cada caracter del placeholder.
 *
 * Devuelve `{ xml, count }` donde `count` es el numero de reemplazos
 * efectivos (sumando ambas estrategias).
 */
function replacePlaceholder(
  xml: string,
  placeholder: string,
  replacement: string,
): { xml: string; count: number } {
  const safe = escapeXml(replacement)

  // 1) Reemplazo directo (caso comun: la palabra cabe en un unico <w:t>).
  const before = xml
  xml = xml.split(placeholder).join(safe)
  const directMatches = before.split(placeholder).length - 1

  // 2) Fallback: permite cualquier numero de etiquetas XML entre caracteres
  //    del placeholder. Esto cubre el caso en que Word haya partido la
  //    palabra en varios runs. Se aplica solo si el reemplazo directo no
  //    agoto todas las ocurrencias visibles.
  const chars = placeholder.split('').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  // Debe haber al menos 1 tag intermedia para que valga la pena el fallback,
  // si no duplicariamos el conteo de los matches directos que ya hicimos.
  const tolerantPattern = new RegExp(chars.join('(?:<[^>]+>)+'), 'g')
  let fallbackMatches = 0
  xml = xml.replace(tolerantPattern, () => {
    fallbackMatches += 1
    return safe
  })

  return { xml, count: directMatches + fallbackMatches }
}

/**
 * Genera un fichero .docx a partir de una template .dotx aplicando
 * reemplazos literales sobre `word/document.xml`.
 *
 * Los `.dotx` de DOA no contienen header/footer separados, todo el
 * contenido textual vive en `word/document.xml`.
 */
export async function generarDocxDesdeTemplate(opts: {
  dotxPath: string
  destDocxPath: string
  replacements: Record<string, string>
}): Promise<void> {
  const { dotxPath, destDocxPath, replacements } = opts

  const buf = await readFile(dotxPath)
  const zip = await JSZip.loadAsync(buf)

  const docEntry = zip.file('word/document.xml')
  if (!docEntry) {
    throw new Error(`Plantilla invalida: no se encontro word/document.xml en ${dotxPath}`)
  }

  let xml = await docEntry.async('string')

  for (const [key, value] of Object.entries(replacements)) {
    const { xml: next, count } = replacePlaceholder(xml, key, value ?? '')
    xml = next
    if (count === 0) {
      // No abortamos: puede que esa template simplemente no tenga ese placeholder.
      console.warn(
        `[templates-docx] Placeholder "${key}" no encontrado en ${dotxPath}`,
      )
    }
  }

  zip.file('word/document.xml', xml)

  // Nota: el type MIME no se cambia; basta con la extension .docx al escribir
  // para que Word lo abra como document editable.
  const out = await zip.generateAsync({ type: 'nodebuffer' })
  await writeFile(destDocxPath, out)
}

// ─── Resolucion de name de fichero .dotx ──────────────────────────────────

let cachedTemplateDir: string | null = null
let cachedFiles: string[] | null = null

/**
 * Escanea una vez el directorio de templates y cachea la lista de ficheros.
 * Debe invocarse antes de `resolveDotxFilename` (la API route lo llama con
 * el root pasado por parametro).
 */
export async function primeTemplateCache(plantillasRoot: string): Promise<void> {
  if (cachedTemplateDir === plantillasRoot && cachedFiles) return
  try {
    const entries = await readdir(plantillasRoot)
    cachedFiles = entries.filter((n) => n.toLowerCase().endsWith('.dotx'))
    cachedTemplateDir = plantillasRoot
  } catch (err) {
    console.error('[templates-docx] No se pudo leer el directorio de templates:', err)
    cachedFiles = []
    cachedTemplateDir = plantillasRoot
  }
}

/**
 * Mapea un codigo de template (ej. "G12-01") al name real del fichero
 * `.dotx` en el directorio de templates cacheado. Devuelve `null` si no
 * se encuentra.
 *
 * El matching es tolerante: busca una ocurrencia que empiece por `${code} `
 * o por `${code}_` (algunas templates antiguas pueden usar other separador).
 */
export function resolveDotxFilename(templateCode: string): string | null {
  if (!cachedFiles) return null
  const code = templateCode.trim()
  const lower = code.toLowerCase()
  const match = cachedFiles.find((name) => {
    const n = name.toLowerCase()
    return n.startsWith(`${lower} `) || n.startsWith(`${lower}_`) || n === `${lower}.dotx`
  })
  return match ?? null
}
