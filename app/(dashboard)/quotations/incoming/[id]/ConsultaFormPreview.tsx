/**
 * ============================================================================
 * VISTA PREVIA DEL FORMULARIO DEL CLIENTE
 * ============================================================================
 *
 * Este componente muestra una pequena seccion con el enlace al formulario
 * que se le envio al cliente como parte del flujo comercial. El formulario
 * es generado por n8n y su URL se guarda en la base de datos (Supabase).
 *
 * QUE MUESTRA:
 *   - Si hay URL de formulario: un boton para abrir la URL publica
 *     y la URL registrada en la base de datos para referencia
 *   - Si NO hay URL: un aviso indicando que no hay formulario generado
 *
 * NOTA TECNICA: Este es un Server Component asincrono (async), aunque
 * actualmente no hace llamadas asincronas. Se mantiene asi por si en el
 * futuro se necesita cargar datos adicionales del formulario.
 * ============================================================================
 */

// Iconos decorativos para los botones y etiquetas
import { ExternalLink, FileText } from 'lucide-react'

// Tipo de datos de un cliente con sus contactos asociados
import type { ClienteWithContactos } from '@/types/database'

/** Propiedades que recibe este componente */
type ConsultaFormPreviewProps = {
  consultaId: string                           // ID de la consulta
  consultaCode: string                         // Codigo visible de la consulta
  senderEmail: string | null                   // Email del remitente
  publicFormUrl: string | null                 // URL publica del formulario (puede no existir)
  matchedClient: ClienteWithContactos | null   // Cliente identificado (puede no existir)
}

/**
 * Componente que muestra la seccion de formulario del cliente.
 * Actualmente solo usa la URL del formulario para mostrar el enlace.
 */
export async function ConsultaFormPreview({
  publicFormUrl,
}: ConsultaFormPreviewProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      <div className="px-4 py-3">
        {/* Encabezado de la seccion */}
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Formulario
        </p>
        <h2 className="mt-1.5 text-sm font-semibold text-slate-950">
          Formulario del cliente
        </h2>

        <div className="mt-3 flex flex-col gap-3">
          {publicFormUrl ? (
            /* Si hay URL de formulario: mostrar boton de acceso y la URL registrada */
            <>
              {/* Boton para abrir el formulario en una nueva pestana */}
              <a
                href={publicFormUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 transition-colors hover:bg-sky-100"
              >
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Abrir URL publica
              </a>

              {/* Bloque informativo que muestra la URL almacenada en Supabase */}
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    URL registrada en Supabase
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-600">{publicFormUrl}</p>
                </div>
              </div>
            </>
          ) : (
            /* Si NO hay URL: mostrar aviso */
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/70 px-3 py-3 text-xs leading-5 text-slate-600">
              No hay una URL de formulario guardada en esta consulta.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
