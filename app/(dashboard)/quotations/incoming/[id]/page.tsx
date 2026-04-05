/**
 * ============================================================================
 * PAGINA DE DETALLE DE CONSULTA ENTRANTE
 * ============================================================================
 *
 * Esta pagina muestra toda la informacion de una consulta (query) que ha
 * llegado de un cliente potencial o existente. Es la vista que el equipo
 * comercial usa para revisar cada consulta individual antes de convertirla
 * en un presupuesto (quotation).
 *
 * QUE HACE ESTA PAGINA:
 * - Busca los datos de la consulta en la base de datos (Supabase)
 * - Intenta identificar automaticamente a que cliente pertenece la consulta
 * - Muestra el correo original del cliente y el borrador de respuesta de la IA
 * - Muestra los datos de la aeronave asociada (si los hay)
 * - Si se identifica al cliente, muestra su historial de proyectos anteriores
 *
 * NOTA TECNICA: Esta es una pagina de SERVIDOR, lo que significa que los
 * datos se cargan antes de que la pagina llegue al navegador del usuario.
 * Esto es mas rapido y seguro que cargar datos desde el navegador.
 * ============================================================================
 */

// --- IMPORTACIONES ---
// Componente de Next.js para crear enlaces/links entre paginas
import Link from 'next/link'
// Iconos visuales que se usan en la interfaz (flechas, sobres, etc.)
import { ArrowLeft, Mail, Plus, ScanSearch, UserRoundX } from 'lucide-react'

// Barra superior de la pagina con titulo y subtitulo
import { TopBar } from '@/components/layout/TopBar'
// Funcion para conectarse a la base de datos Supabase desde el servidor
import { createClient } from '@/lib/supabase/server'
// Definiciones de tipos de datos: Cliente, Contacto de cliente, y Consulta entrante
import type { Cliente, ClienteContacto, ConsultaEntrante } from '@/types/database'

// Panel que muestra los detalles completos de un cliente identificado
import { ClientDetailPanel } from '../../../clients/ClientDetailPanel'
// Funciones auxiliares para buscar y emparejar clientes con las consultas entrantes
import {
  buildIncomingClientLookup,
  resolveIncomingClientRecord,
  toIncomingQuery,
} from '../../incoming-queries'
// Columna central colapsable: correo original + compositor de respuesta
import { CenterColumnCollapsible } from './CenterColumnCollapsible'
// Banner que muestra el estado de verificacion del TCDS contra doa_aeronaves
import { TcdsStatusBanner } from './TcdsStatusBanner'

/**
 * ============================================================================
 * PANEL DE CLIENTE DESCONOCIDO
 * ============================================================================
 *
 * Este componente se muestra cuando el sistema NO pudo identificar
 * automaticamente a que cliente pertenece la consulta. Esto puede pasar
 * cuando el correo del remitente no coincide con ningun cliente registrado
 * en nuestra base de datos.
 *
 * Muestra:
 * - Un aviso visual (en amarillo) indicando que el cliente no fue identificado
 * - El email del remitente de la consulta, para que el equipo pueda
 *   buscarlo manualmente o registrarlo como nuevo cliente
 *
 * Recibe como dato de entrada (parametro):
 * - senderEmail: la direccion de correo de quien envio la consulta
 * ============================================================================
 */
function UnknownClientPanel({ senderEmail }: { senderEmail: string | null }) {
  return (
    // Contenedor principal del panel con bordes redondeados y sombra
    <section className="flex h-full min-h-0 flex-col rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
      {/* Cabecera del panel con titulo "Detalle del cliente" */}
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef6ff_100%)] px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">Detalle del cliente</h2>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        {/* Aviso visual en amarillo: indica que no se pudo vincular con un cliente conocido */}
        <div className="rounded-[20px] border border-dashed border-amber-200 bg-[linear-gradient(180deg,#fffaf0_0%,#fff7ed_100%)] px-4 py-5">
          <div className="flex items-start gap-3">
            {/* Icono de usuario con una X (usuario no encontrado) */}
            <UserRoundX className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-semibold text-slate-950">Cliente desconocido</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Esta consulta todavía no se ha podido vincular con un cliente registrado
                en la base de datos.
              </p>
            </div>
          </div>
        </div>

        {/* Caja que muestra el email del remitente para referencia manual */}
        <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Email remitente
          </p>
          <div className="mt-3 flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            {/* Si no hay email disponible, muestra "No disponible" */}
            <p className="break-all text-sm text-slate-900">
              {senderEmail ?? 'No disponible'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * ============================================================================
 * COMPONENTE PRINCIPAL: PAGINA DE DETALLE DE CONSULTA ENTRANTE
 * ============================================================================
 *
 * Esta es la funcion principal de la pagina. Es una funcion "async" (asincrona)
 * porque necesita esperar a que la base de datos devuelva los datos antes de
 * mostrar la pagina.
 *
 * Recibe como parametro:
 * - params.id: el identificador unico de la consulta que se quiere ver.
 *   Este "id" viene de la URL. Por ejemplo, si la URL es
 *   /quotations/incoming/abc123, entonces id = "abc123".
 *
 * FLUJO GENERAL DE LA PAGINA:
 * 1. Obtiene el ID de la consulta desde la URL
 * 2. Se conecta a Supabase (la base de datos)
 * 3. Busca la consulta entrante por su ID
 * 4. Si no la encuentra, muestra un mensaje de error
 * 5. Si la encuentra, carga tambien los clientes y contactos
 * 6. Intenta emparejar la consulta con un cliente existente
 * 7. Si hay cliente, carga su historial de proyectos
 * 8. Muestra toda la informacion en pantalla
 * ============================================================================
 */
export default async function IncomingQuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // --- PASO 1: Obtener el ID de la consulta desde la URL ---
  const { id } = await params

  // --- PASO 2: Crear la conexion con la base de datos Supabase ---
  const supabase = await createClient()

  // --- PASO 3: Buscar la consulta entrante en la tabla 'doa_consultas_entrantes' ---
  // Se busca la fila cuyo campo 'id' coincida con el ID de la URL.
  // "maybeSingle" significa que puede devolver un resultado o ninguno (sin error si no existe).
  const { data, error } = await supabase
    .from('doa_consultas_entrantes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  // --- PASO 4: Si hubo un error o no se encontro la consulta, mostrar pantalla de error ---
  // Esto pasa cuando alguien accede a una URL con un ID que no existe en la base de datos.
  if (error || !data) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#f8fbff_34%,#f8fafc_100%)]">
        <TopBar
          title="Detalle de consulta"
          subtitle="Entrada comercial previa a quotation"
        />
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">
          {/* Boton para volver a la lista de quotations */}
          <Link
            href="/quotations"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a quotations
          </Link>
          {/* Mensaje de error explicando que la consulta no fue encontrada */}
          <section className="rounded-[34px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Consulta no encontrada
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                {error ? `Error: ${error.message}` : 'No se encontró una consulta con este identificador.'}
              </p>
            </div>
          </section>
        </div>
      </div>
    )
  }

  /**
   * --- PASO 5: Cargar TODOS los clientes y contactos de la base de datos ---
   *
   * Se hacen DOS consultas a Supabase al mismo tiempo (en paralelo con Promise.all)
   * para que sea mas rapido:
   *
   * 1) 'doa_clientes_datos_generales' = Tabla con los datos generales de cada cliente
   *    (nombre de la empresa, pais, etc.). Se ordena alfabeticamente por nombre.
   *
   * 2) 'doa_clientes_contactos' = Tabla con las personas de contacto de cada cliente
   *    (nombre, email, telefono, etc.). Se ordena priorizando:
   *    - Primero los contactos principales (es_principal)
   *    - Luego los activos
   *    - Luego por fecha de creacion
   *
   * Se cargan TODOS los clientes porque luego se necesitan para buscar
   * cual de ellos coincide con el remitente de esta consulta.
   */
  const [{ data: clientRows, error: clientError }, { data: contactRows, error: contactError }] =
    await Promise.all([
      supabase
        .from('doa_clientes_datos_generales')
        .select('*')
        .order('nombre', { ascending: true }),
      supabase
        .from('doa_clientes_contactos')
        .select('*')
        .order('es_principal', { ascending: false })
        .order('activo', { ascending: false })
        .order('created_at', { ascending: true }),
    ])

  // Si hay errores al cargar clientes o contactos, se registran en la consola del servidor
  // (no se muestra al usuario, pero queda en los logs para que los desarrolladores lo vean)
  if (clientError) {
    console.error('Error cargando clientes para la consulta entrante:', clientError)
  }

  if (contactError) {
    console.error('Error cargando contactos para la consulta entrante:', contactError)
  }

  /**
   * --- PASO 6: Logica de emparejamiento de cliente ---
   *
   * Aqui es donde el sistema intenta averiguar AUTOMATICAMENTE a que cliente
   * pertenece esta consulta. El proceso es:
   *
   * 1. Se preparan las listas de clientes y contactos (si la base de datos
   *    no devolvio datos, se usan listas vacias como respaldo).
   *
   * 2. "buildIncomingClientLookup" crea un mapa de busqueda rapida que
   *    relaciona emails y dominios con clientes. Es como un "directorio
   *    telefonico" pero para buscar clientes por su email.
   *
   * 3. "toIncomingQuery" convierte los datos crudos de la base de datos en un
   *    formato mas organizado y facil de usar, incluyendo la clasificacion
   *    que hizo la IA y la identidad del remitente.
   *
   * 4. "resolveIncomingClientRecord" busca en la base de datos el cliente que
   *    coincide con el email del remitente de la consulta. Si encuentra uno,
   *    devuelve sus datos completos; si no, devuelve null (vacio).
   */
  const clients: Cliente[] = clientRows ?? []
  const contacts: ClienteContacto[] = contactRows ?? []
  const clientLookup = buildIncomingClientLookup(clients, contacts)
  const query = toIncomingQuery(data as ConsultaEntrante, clientLookup)
  const matchedClient = resolveIncomingClientRecord(query.remitente, clients, contacts)

  /**
   * --- PASO 6b: Verificar si el TCDS existe en la base de datos de aeronaves ---
   *
   * Si la consulta tiene un numero de TCDS, se busca en la tabla 'doa_aeronaves'
   * para saber si ya esta registrado en nuestra base de datos interna.
   * Se obtienen TODAS las variantes (puede haber multiples modelos bajo un
   * mismo TCDS, ej: PC-12, PC-12/45, PC-12/47, PC-12/47E, PC-12/47G
   * comparten TCDS A.089).
   *
   * Si no hay TCDS pero si modelo o fabricante, se intenta busqueda por fallback.
   */
  let aeronaveVariants: {
    tcds_code: string
    tcds_code_short: string
    tcds_issue: string
    tcds_date: string
    fabricante: string
    pais: string
    tipo: string
    modelo: string
    motor: string
    mtow_kg: number | null
    mlw_kg: number | null
    regulacion_base: string
    categoria: string
    msn_elegibles: string
    notas: string
  }[] = []
  let tcdsFallbackUsed = false

  if (data.tcds_number) {
    // Busqueda primaria: por codigo TCDS exacto
    const { data: aeronaveRows } = await supabase
      .from('doa_aeronaves')
      .select('tcds_code, tcds_code_short, tcds_issue, tcds_date, fabricante, pais, tipo, modelo, motor, mtow_kg, mlw_kg, regulacion_base, categoria, msn_elegibles, notas')
      .eq('tcds_code', data.tcds_number)

    if (aeronaveRows && aeronaveRows.length > 0) {
      aeronaveVariants = aeronaveRows
    }
  }

  // Fallback: si no hay TCDS o no se encontro nada, buscar por modelo o fabricante
  if (aeronaveVariants.length === 0 && (data.aircraft_model || data.aircraft_manufacturer)) {
    tcdsFallbackUsed = true
    let fallbackQuery = supabase
      .from('doa_aeronaves')
      .select('tcds_code, tcds_code_short, tcds_issue, tcds_date, fabricante, pais, tipo, modelo, motor, mtow_kg, mlw_kg, regulacion_base, categoria, msn_elegibles, notas')

    if (data.aircraft_model) {
      fallbackQuery = fallbackQuery.ilike('modelo', `%${data.aircraft_model}%`)
    } else if (data.aircraft_manufacturer) {
      fallbackQuery = fallbackQuery.ilike('fabricante', `%${data.aircraft_manufacturer}%`)
    }

    const { data: fallbackRows } = await fallbackQuery

    if (fallbackRows && fallbackRows.length > 0) {
      aeronaveVariants = fallbackRows
    }
  }

  /**
   * --- PASO 7: Cargar el historial de proyectos del cliente (si se identifico) ---
   *
   * Solo se ejecuta si el paso anterior encontro un cliente que coincide.
   * Busca en la tabla 'doa_proyectos_historico' todos los proyectos anteriores
   * que se hayan hecho con ese cliente, ordenados del mas reciente al mas antiguo.
   *
   * Esto le permite al equipo comercial ver de un vistazo:
   * - Cuantos proyectos se han hecho con este cliente
   * - En que estado estan (completados, en curso, etc.)
   * - Los numeros y titulos de proyecto para referencia rapida
   *
   * Si no se encontro cliente, la lista queda vacia y esta seccion
   * no se mostrara en la pantalla.
   */
  let projectHistory: { id: string; numero_proyecto: string | null; titulo: string | null; descripcion: string | null; estado: string | null; created_at: string | null }[] = []
  if (matchedClient) {
    const { data: historyRows, error: historyError } = await supabase
      .from('doa_proyectos_historico')
      .select('id, numero_proyecto, titulo, descripcion, estado, created_at')
      .eq('client_id', matchedClient.id)
      .order('created_at', { ascending: false })

    if (historyError) {
      console.error('Error cargando historial de proyectos del cliente:', historyError)
    } else {
      projectHistory = historyRows ?? []
    }
  }

  /**
   * ============================================================================
   * PASO 8: RENDERIZADO DE LA INTERFAZ VISUAL
   * ============================================================================
   *
   * Todo lo que sigue a continuacion es la parte visual de la pagina: lo que
   * el usuario realmente ve en su pantalla. Usa los datos que se cargaron
   * en los pasos anteriores para mostrar la informacion de forma organizada.
   *
   * La pagina se divide en estas secciones principales:
   * - Barra superior (TopBar) con titulo
   * - Boton para volver a la lista de quotations
   * - Cabecera con el codigo y asunto de la consulta
   * - Columna izquierda: correo original + borrador de respuesta IA
   * - Columna derecha: datos del cliente, datos de aeronave, historial de proyectos
   * ============================================================================
   */
  return (
    // Contenedor principal de toda la pagina con fondo degradado azul suave
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#f8fbff_34%,#f8fafc_100%)]">
      {/* Barra superior fija con el titulo de la pagina */}
      <TopBar
        title="Detalle de consulta"
        subtitle="Entrada comercial previa a quotation"
      />

      {/* Contenido principal de la pagina (con scroll si el contenido es largo) */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-5 pb-8 pt-5">
        {/* --- BARRA DE NAVEGACION Y ETIQUETA DE ESTADO --- */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Boton para volver a la lista general de quotations */}
          <Link
            href="/quotations"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a quotations
          </Link>

          {/* Etiqueta que indica que este registro es una "Consulta entrante" */}
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
            <ScanSearch className="h-3.5 w-3.5" />
            Consulta entrante
          </div>
        </div>

        {/* --- CABECERA PRINCIPAL DE LA CONSULTA --- */}
        {/* Muestra el codigo unico de la consulta, el asunto (tema), y una descripcion */}
        <section className="rounded-[34px] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-6 shadow-[0_24px_50px_rgba(14,165,233,0.10)]">
          <div className="space-y-2">
            {/* Codigo de la consulta (ej: "CE-2024-001") */}
            <p className="font-mono text-xs text-slate-500">{query.codigo}</p>
            {/* Asunto / tema de la consulta (viene del correo original) */}
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              {query.asunto}
            </h1>
            {/* Texto explicativo para el usuario sobre el proposito de esta vista */}
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              Vista preparada para revisar la consulta, trabajar la comunicación con el
              cliente y seguir incorporando contexto operativo a medida que el workflow avance.
            </p>
          </div>
        </section>

        {/*
          ============================================================================
          AREA DE CONTENIDO PRINCIPAL - DISTRIBUCION EN DOS COLUMNAS
          ============================================================================

          La pagina se divide en dos columnas (en pantallas grandes):
          - COLUMNA IZQUIERDA (mas ancha): Correo original del cliente + Borrador de
            respuesta generado por la IA
          - COLUMNA DERECHA (mas estrecha): Datos del cliente, datos de aeronave,
            e historial de proyectos

          En pantallas pequenas (movil/tablet), las columnas se apilan verticalmente.
        */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
          {/* --- COLUMNA IZQUIERDA: CORREO ORIGINAL Y RESPUESTA (colapsable) --- */}
          {/*
            CenterColumnCollapsible organiza el correo original y el compositor
            de respuesta en secciones colapsables para reducir el espacio vertical.
            El correo original se muestra colapsado por defecto (con resumen),
            y la respuesta al cliente se muestra expandida (es la accion principal).
          */}
          <CenterColumnCollapsible
            query={{
              id: query.id,
              codigo: query.codigo,
              asunto: query.asunto,
              remitente: query.remitente,
              urlFormulario: query.urlFormulario,
              clasificacion: query.clasificacion,
              cuerpoOriginal: query.cuerpoOriginal,
              respuestaIa: query.respuestaIa,
              // Campos de fecha para el hilo de comunicacion
              creadoEn: data.created_at,
              correoClienteEnviadoAt: data.correo_cliente_enviado_at ?? null,
              correoClienteEnviadoBy: data.correo_cliente_enviado_by ?? null,
              ultimoBorradorCliente: data.ultimo_borrador_cliente ?? null,
            }}
          />

          {/* --- COLUMNA DERECHA: CLIENTE, AERONAVE E HISTORIAL --- */}
          <div className="grid min-h-0 gap-5">
            {/*
              PANEL DE CLIENTE: Muestra los datos del cliente identificado.
              - Si se encontro un cliente que coincide con el remitente de la
                consulta (matchedClient existe), se muestra el panel completo
                con todos sus datos (ClientDetailPanel).
              - Si NO se encontro ninguna coincidencia, se muestra el panel de
                "Cliente desconocido" (UnknownClientPanel) con el email del
                remitente para busqueda manual.
            */}
            {matchedClient ? (
              <ClientDetailPanel client={matchedClient} />
            ) : (
              <UnknownClientPanel
                senderEmail={
                  query.clientIdentity.kind === 'unknown'
                    ? query.clientIdentity.senderEmail
                    : query.clientIdentity.email
                }
              />
            )}

            {/*
              ============================================================================
              SECCION DE DATOS DE AERONAVE (Aircraft Data / TCDS)
              ============================================================================

              Muestra la informacion tecnica de la aeronave asociada a la consulta.
              TCDS = Type Certificate Data Sheet (Hoja de Datos del Certificado de Tipo),
              que es el documento oficial de la FAA/EASA que describe las caracteristicas
              aprobadas de un modelo de avion.

              Esta seccion es desplegable (se abre al hacer clic en "Ver datos de
              aeronave") para no ocupar espacio si no se necesita ver.

              Campos que muestra:
              - TCDS Number: Numero del certificado de tipo
              - Manufacturer: Fabricante de la aeronave (ej: Airbus, Boeing)
              - Model: Modelo de la aeronave (ej: A320, 737-800)
              - Aircraft count: Cantidad de aeronaves afectadas
              - MSN: Manufacturer Serial Number (numero de serie del fabricante)
              - Enlace para descargar el PDF del TCDS (si esta disponible)

              Si el campo tcds_number no tiene datos, se muestra un mensaje
              indicando que aun no se han enviado datos de aeronave.
            */}
            <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-950">Aircraft Data</h2>
              </div>
              {/* Seccion desplegable: se abre/cierra al hacer clic */}
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
                  {/* Flecha que rota cuando la seccion esta abierta */}
                  <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  Ver datos de aeronave
                </summary>
                <div className="space-y-3 px-5 pb-4">
                  {/* Si hay numero TCDS, se muestran todos los datos de la aeronave */}
                  {data.tcds_number ? (
                    <>
                      {/* Numero del certificado de tipo */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">TCDS Number</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-900">{data.tcds_number}</p>
                      </div>
                      {/* Banner de verificacion del TCDS contra doa_aeronaves */}
                      <TcdsStatusBanner
                        found={aeronaveVariants.length > 0}
                        tcdsNumber={data.tcds_number}
                        tcdsPdfUrl={data.tcds_pdf_url}
                        variants={aeronaveVariants}
                        fallbackUsed={tcdsFallbackUsed}
                        aircraftModel={data.aircraft_model ?? null}
                      />
                      {/* Fabricante de la aeronave */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Manufacturer</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-900">{data.aircraft_manufacturer ?? '—'}</p>
                      </div>
                      {/* Modelo de la aeronave */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Model</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-900">{data.aircraft_model ?? '—'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Cantidad de aeronaves */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Aircraft count</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">{data.aircraft_count ?? '—'}</p>
                        </div>
                        {/* Numero de serie del fabricante (MSN) */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">MSN</p>
                          <p className="mt-0.5 text-sm font-medium text-slate-900">{data.aircraft_msn ?? '—'}</p>
                        </div>
                      </div>
                      {/* Boton para descargar el PDF del TCDS (solo aparece si hay URL) */}
                      {data.tcds_pdf_url ? (
                        <a
                          href={data.tcds_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100"
                        >
                          Download TCDS PDF
                        </a>
                      ) : null}
                    </>
                  ) : (
                    // Si no hay datos TCDS, se muestra este mensaje
                    <p className="text-xs italic text-slate-400">No aircraft data submitted yet.</p>
                  )}
                </div>
              </details>
            </section>

            {/*
              ============================================================================
              SECCION DE HISTORIAL DE PROYECTOS DEL CLIENTE
              ============================================================================

              Esta seccion SOLO aparece cuando se identifico un cliente (matchedClient).
              Muestra una lista de todos los proyectos que se han realizado
              anteriormente con ese mismo cliente, sacados de la tabla
              'doa_proyectos_historico' de Supabase.

              Es desplegable y muestra para cada proyecto:
              - Su numero de proyecto (ej: "PRJ-2024-015")
              - El titulo del proyecto
              - El estado actual (completado, en curso, etc.)
              - Un boton para abrir la ficha completa del proyecto

              Esto es muy util para el equipo comercial porque pueden ver
              rapidamente si el cliente es recurrente y que tipo de trabajos
              se han hecho para el en el pasado.
            */}
            {matchedClient && (
              <section className="rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
                {/* Cabecera con el titulo y un contador de cuantos proyectos hay */}
                <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0f9ff_100%)] px-5 py-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-950">Project History</h2>
                    {/* Etiqueta azul que muestra la cantidad total de proyectos */}
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                      {projectHistory.length} {projectHistory.length === 1 ? 'project' : 'projects'}
                    </span>
                  </div>
                </div>
                {/* Seccion desplegable: se abre/cierra al hacer clic */}
                <details className="group">
                  <summary className="flex cursor-pointer items-center gap-1 px-5 py-3 text-xs font-medium text-sky-600 hover:text-sky-700">
                    <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    Ver historial de proyectos
                  </summary>
                  <div className="space-y-3 px-5 pb-4">
                    {/* Si hay proyectos, se muestra una tarjeta por cada uno */}
                    {projectHistory.length > 0 ? (
                      projectHistory.map((project) => (
                        <div key={project.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {/* Numero del proyecto (si tiene) */}
                              {project.numero_proyecto && (
                                <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                                  {project.numero_proyecto}
                                </span>
                              )}
                              {/* Titulo del proyecto */}
                              <p className="mt-1 text-sm font-medium text-slate-900">{project.titulo ?? '—'}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {/* Estado del proyecto (ej: "Completado", "En curso") */}
                              {project.estado && (
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  {project.estado}
                                </span>
                              )}
                              {/* Boton para abrir la ficha completa de este proyecto */}
                              <Link
                                href={`/proyectos-historico/${project.id}`}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition-colors hover:bg-sky-100"
                                title="Abrir ficha"
                                aria-label={`Abrir ficha de ${project.numero_proyecto}`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      // Si el cliente no tiene proyectos previos, se muestra este mensaje
                      <p className="text-xs italic text-slate-400">No previous projects found for this client.</p>
                    )}
                  </div>
                </details>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
