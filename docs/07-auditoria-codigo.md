# Auditoria de codigo - DOA Operations Hub

## Informacion general

- **Fecha**: 5 abril 2026
- **Alcance**: auditoria completa del codigo fuente del repositorio
- **Estado de la aplicacion**: fase de desarrollo activo. Los hallazgos de seguridad se documentan aqui como referencia y se implementaran antes de la puesta en produccion.
- **Auditor**: revision asistida por IA sobre el codigo fuente actual

---

## Resumen ejecutivo

Se auditaron mas de 50 archivos del repositorio en 4 areas principales: seguridad, estabilidad, rendimiento/UX y calidad de codigo.

### Conteo por severidad

| Severidad | Cantidad | Descripcion |
|-----------|----------|-------------|
| **CRITICAL** | 8 | Vulnerabilidades de seguridad (pre-produccion) |
| **HIGH** | 12 | Problemas de estabilidad y codigo muerto |
| **MEDIUM** | 18 | Rendimiento y experiencia de usuario |
| **LOW** | 20 | Calidad de codigo y mejores practicas |
| **Total** | **58** | |

### Patrones positivos destacados

A pesar de los hallazgos, el codigo muestra buenas practicas de arquitectura: separacion servidor/cliente impecable, sistema de estados robusto, TypeScript strict mode activo y documentacion interna clara. Los detalles se listan en la seccion de patrones positivos.

---

## Estado de implementacion

Seguimiento de las correcciones aplicadas tras la auditoria. Regla #1: **no romper la app**. Cada fase pasa por `npm run lint`, `npm run build` y `npm run smoke` antes de commit.

### Fase 1 — Quick wins (✅ completada)

Commit: `00adbc3` — "Fase 1. Auditoria"

| Item | Descripcion | Estado |
|------|-------------|--------|
| H7 | Borrar `IncomingQueriesPanel` (dead code) | ✅ |
| H8 | Borrar `ConsultaFormPreview` (dead code) | ✅ |
| H9 | Eliminar `PROJECT_STATUS_CONFIG` no usado | ✅ |
| H10 | Mover `AeronaveRow` a `types/database.ts` | ✅ |
| H11 | Mover `ProyectoHistoricoRow` a `types/database.ts` | ✅ |
| H12 | Añadir `error.tsx` a 7 rutas del dashboard | ✅ |
| M8 | Fix CSS typo `#f8fasc` → `#f8fafc` | ✅ |
| M10 | Fix redirect `/proyectos` → `/engineering/portfolio` | ✅ |
| M13 | Eliminar barra de progreso engañosa (siempre 0) | ✅ |
| L19 | `lib/app-release.ts` lee version desde `package.json` | ✅ |
| C6 | Eliminar fallback hardcoded de webhook en `ProyectosClient.tsx` | ✅ |

Extra: `eslint.config.mjs` ignora `rag-backend/**` (JS vendored del venv Python que hacia fallar lint).

### Fase 2 — Estabilidad (✅ completada)

| Item | Descripcion | Estado |
|------|-------------|--------|
| H2 | `QuotationDetailClient` ya no muestra "not found": el server carga `incomingQueries` y los pasa al cliente, que los inyecta en `defaultQuotationLanes` | ✅ |
| C8 | Guards explicitos de env vars en `lib/supabase/server.ts` y `lib/supabase/client.ts` (error claro si falta `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | ✅ |

### Fase 3 — Seguridad critica (pendiente, bloqueante pre-prod)

Pendiente: C1 (middleware auth), C2 (auth en API routes), C3 (auth en server action delete), C4 (DOMPurify), C5 (quitar `NEXT_PUBLIC_` de webhooks), C7 (SQL injection en `.or()` filters).

### Fase 4 — Refactor post-launch

Pendiente: H3, H4, H5, H6, M1, M2, M6 y resto de MEDIUM/LOW.

---

## CRITICAL — Seguridad (pre-produccion)

Estos hallazgos son vulnerabilidades de seguridad que deben resolverse antes de que la aplicacion salga a produccion. Se documentan ahora para tener visibilidad completa.

---

### C1. No hay middleware.ts — rutas del dashboard sin autenticacion

**Severidad**: CRITICAL
**Ubicacion**: raiz del proyecto (archivo ausente)

No existe archivo `middleware.ts` en la raiz del proyecto. Esto significa que todas las rutas del dashboard son accesibles sin autenticacion. Cualquier usuario puede navegar directamente a `/home`, `/quotations`, `/clients`, `/databases`, `/aeronaves`, `/tools` sin tener una sesion valida.

La pagina raiz `app/page.tsx` redirige a `/home` sin verificar autenticacion.

**Fix recomendado**: Crear `middleware.ts` con el patron Supabase SSR que verifique la sesion activa y redirija a `/login` cuando no exista sesion valida. Proteger todas las rutas bajo `(dashboard)`.

---

### C2. API routes sin autenticacion

**Severidad**: CRITICAL
**Ubicacion**: multiples archivos de API

Las siguientes rutas de API no verifican que el usuario tenga sesion activa:

- `app/api/tools/chat/route.ts` (POST) — permite usar creditos de OpenRouter sin autenticacion
- `app/api/consultas/[id]/route.ts` (DELETE) — permite borrar consultas entrantes
- `app/api/consultas/[id]/state/route.ts` (PATCH) — permite cambiar estados de consultas
- `app/api/consultas/[id]/send-client/route.ts` (POST) — permite enviar emails a clientes

Cualquier persona con acceso a la URL puede ejecutar estas operaciones: borrar consultas, cambiar estados, enviar emails a clientes o consumir creditos de la API de OpenRouter.

**Fix recomendado**: Anadir verificacion de sesion Supabase al inicio de cada route handler. Retornar 401 si no hay sesion.

---

### C3. Server action deleteProyectoHistorico sin verificacion de usuario

**Severidad**: CRITICAL
**Ubicacion**: `app/(dashboard)/proyectos-historico/actions.ts`

La server action `deleteProyectoHistorico` borra registros de la base de datos sin verificar que el usuario que ejecuta la accion tenga sesion activa o permisos para borrar.

**Fix recomendado**: Anadir auth check con Supabase antes de ejecutar el delete. Verificar sesion y permisos del usuario.

---

### C4. XSS en renderizado de emails — dangerouslySetInnerHTML sin sanitizar

**Severidad**: CRITICAL
**Ubicacion**: `components/quotations/CenterColumnCollapsible.tsx:248`

Se usa `dangerouslySetInnerHTML` para renderizar el contenido HTML de emails externos sin ninguna sanitizacion previa. Un email malicioso podria contener scripts que se ejecutarian en el navegador del usuario al abrir el detalle de la consulta.

**Fix recomendado**: Instalar y usar DOMPurify para sanitizar el HTML antes de pasarlo a `dangerouslySetInnerHTML`. Ejemplo: `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(emailHtml) }}`.

---

### C5. Webhook URLs con prefijo NEXT_PUBLIC_ expuestas en el cliente

**Severidad**: CRITICAL
**Ubicacion**: variables de entorno con prefijo `NEXT_PUBLIC_`

Las URLs de webhooks de n8n usan el prefijo `NEXT_PUBLIC_`, lo que hace que se incluyan en el bundle de JavaScript del cliente. Cualquier usuario puede abrir la consola del navegador, ver estas URLs y llamar directamente a los webhooks de n8n sin pasar por la aplicacion.

**Fix recomendado**: Quitar el prefijo `NEXT_PUBLIC_` de las variables de entorno de webhooks. Mover todas las llamadas a webhooks a API routes del servidor que incluyan verificacion de autenticacion.

---

### C6. URL de webhook hardcodeada como fallback

**Severidad**: CRITICAL
**Ubicacion**: `components/project/ProyectosClient.tsx:156`

Existe una URL de webhook hardcodeada como valor por defecto (fallback) en el codigo. Si la variable de entorno correspondiente no esta definida, las llamadas van silenciosamente al servidor de test en vez de fallar de forma visible. Esto viola la regla de CLAUDE.md que dice que las URLs externas deben estar en variables de entorno y nunca hardcodeadas.

**Fix recomendado**: Eliminar el fallback hardcodeado. Lanzar un error explicito si la variable de entorno no esta definida. El sistema debe fallar de forma visible, no redirigir a un servidor de test silenciosamente.

---

### C7. Inyeccion en filtros Supabase via template literals

**Severidad**: CRITICAL
**Ubicacion**: `app/(dashboard)/quotations/incoming/[id]/page.tsx:232,291`

Se usan template literals (interpolacion de strings) sin sanitizar dentro de los metodos `.or()` de Supabase. Esto permite potencialmente manipular las consultas a la base de datos inyectando valores en los filtros.

**Fix recomendado**: Usar los metodos encadenados de Supabase (`.eq()`, `.ilike()`, etc.) en vez de string interpolation dentro de `.or()`. Los metodos encadenados parametrizan los valores automaticamente.

---

### C8. Non-null assertions (!) en variables de entorno

**Severidad**: CRITICAL
**Ubicacion**: `lib/supabase/server.ts`, `lib/supabase/client.ts`

Se usan non-null assertions (`!`) al acceder a las variables de entorno de Supabase (`process.env.NEXT_PUBLIC_SUPABASE_URL!`, `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!`). Si estas variables faltan en el entorno, la aplicacion lanza un error criptico en tiempo de ejecucion sin indicar cual variable falta.

**Fix recomendado**: Anadir guards explicitos que verifiquen la existencia de cada variable y lancen errores con mensajes claros. Ejemplo: `if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL en .env.local')`.

---

## HIGH — Estabilidad y codigo muerto

Problemas que afectan la estabilidad de la aplicacion, codigo muerto que dificulta el mantenimiento, y errores funcionales.

---

### H1. Webhook response expone payload interno al cliente

**Severidad**: HIGH
**Ubicacion**: `app/api/consultas/[id]/send-client/route.ts:202`

La respuesta del webhook devuelve al cliente el payload interno completo, que incluye URLs internas, IDs de la base de datos y borradores generados por IA. Esta informacion no deberia exponerse al frontend.

**Fix recomendado**: Devolver solo un objeto con `{ success: true }` o un mensaje de confirmacion. No reenviar el payload del webhook al cliente.

---

### H2. QuotationDetailClient siempre muestra "no encontrada"

**Severidad**: HIGH
**Ubicacion**: `app/(dashboard)/quotations/[id]/QuotationDetailClient.tsx:112-128`

El componente siempre muestra el mensaje de "cotizacion no encontrada" porque no recibe datos de incoming queries. La funcion `defaultQuotationLanes` se invoca sin el parametro `incomingQueries`, por lo que las lanes siempre estan vacias y el detalle nunca se puede mostrar correctamente.

**Fix recomendado**: Pasar los datos de incoming queries desde el server component padre al client component, o reconectar la logica de carga de datos.

---

### H3. Race condition en ProjectTimerButton

**Severidad**: HIGH
**Ubicacion**: `components/project/ProjectTimerButton.tsx:168-201`

Dos usuarios pueden iniciar una sesion de timer simultaneamente sobre el mismo proyecto, creando entradas duplicadas en la base de datos. No hay indice unique parcial en la tabla que prevenga sesiones de timer concurrentes para el mismo proyecto.

**Fix recomendado**: Crear un indice unique parcial en la base de datos que impida multiples sesiones activas de timer para el mismo proyecto. Manejar el conflicto en el frontend con un mensaje informativo.

---

### H4. Optimistic delete con re-fetch completo en vez de rollback

**Severidad**: HIGH
**Ubicacion**: `components/quotations/CenterColumnCollapsible.tsx:340-359`

Cuando el delete optimista falla, el codigo hace un re-fetch completo de todos los emails en vez de restaurar el email original que se habia eliminado de la UI. Si el re-fetch tambien falla, la UI queda corrupta sin posibilidad de recuperacion.

**Fix recomendado**: Guardar el estado previo antes del delete optimista y restaurarlo si la operacion falla. Solo hacer re-fetch como ultima opcion.

---

### H5. ProyectosClient.tsx — archivo monolitico de 933 lineas

**Severidad**: HIGH
**Ubicacion**: `components/project/ProyectosClient.tsx` (~933 lineas)

El archivo contiene 8 componentes internos: `PrioridadBadge`, `ProjectStateControl`, `BoardCard`, `BoardLane`, `TableroView`, `ListaView` y otros. Esto dificulta el mantenimiento, la reutilizacion y el testing individual de cada componente.

**Fix recomendado**: Extraer cada componente interno a su propio archivo dentro de `components/project/`. Mantener `ProyectosClient.tsx` como componente orquestador que importa los demas.

---

### H6. QuotationStatesBoard.tsx — archivo monolitico de 1379 lineas

**Severidad**: HIGH
**Ubicacion**: `components/quotations/QuotationStatesBoard.tsx` (~1379 lineas)

El archivo contiene 9 sub-componentes: `IncomingQueryStateControl`, `IncomingQueryDeleteControl`, `IncomingQueryArchiveControl`, `IncomingClientIdentityBlock`, `BoardCard`, `BoardLane`, `ListRow`, `ScopeEditor` y `QuotationStatesBoard`. Es el archivo mas grande del proyecto y presenta los mismos problemas de mantenibilidad que H5.

**Fix recomendado**: Descomponer en archivos individuales dentro de `components/quotations/`. Cada sub-componente merece su propio archivo.

---

### H7. IncomingQueriesPanel.tsx es codigo muerto

**Severidad**: HIGH
**Ubicacion**: `components/quotations/IncomingQueriesPanel.tsx` (193 lineas)

Este componente no se importa en ningun otro archivo del modulo de quotations ni del resto de la aplicacion. Es codigo muerto que aumenta el tamano del proyecto sin aportar funcionalidad.

**Fix recomendado**: Eliminar el archivo. Si se necesita en el futuro, se puede recuperar del historial de git.

---

### H8. ConsultaFormPreview.tsx es codigo muerto con props sin usar

**Severidad**: HIGH
**Ubicacion**: `components/quotations/ConsultaFormPreview.tsx` (91 lineas)

Este componente no se importa en ningun otro archivo de la aplicacion. Ademas, tiene 4 props definidas que nunca se usan dentro del componente: `consultaId`, `consultaCode`, `senderEmail` y `matchedClient`.

**Fix recomendado**: Eliminar el archivo. Si la funcionalidad de preview es necesaria en el futuro, reescribir desde cero con las props correctas.

---

### H9. PROJECT_STATUS_CONFIG definido pero nunca usado

**Severidad**: HIGH
**Ubicacion**: `components/project/workspace-utils.ts:10-68`

La constante `PROJECT_STATUS_CONFIG` esta definida con configuracion de colores y labels para estados de proyecto, pero no se usa en ningun componente. El renderizado real de estados utiliza `getProjectStatusMeta()` de `lib/workflow-states.ts`, haciendo que esta constante sea codigo muerto que puede causar confusion.

**Fix recomendado**: Eliminar `PROJECT_STATUS_CONFIG` de `workspace-utils.ts`. Asegurar que todos los componentes usen `getProjectStatusMeta()`.

---

### H10. Tipo AeronaveRow duplicado en dos archivos

**Severidad**: HIGH
**Ubicacion**: `app/(dashboard)/aeronaves/page.tsx:33-51` y `app/(dashboard)/aeronaves/AeronavesPageClient.tsx:39-57`

El tipo `AeronaveRow` esta definido de forma identica en dos archivos distintos. Esto viola la regla de CLAUDE.md que indica que los tipos deben estar solo en `types/database.ts`.

**Fix recomendado**: Mover el tipo `AeronaveRow` a `types/database.ts` e importarlo en ambos archivos. Eliminar las definiciones locales.

---

### H11. Tipo ProyectoHistoricoRow duplicado en dos archivos

**Severidad**: HIGH
**Ubicacion**: `app/(dashboard)/proyectos-historico/page.tsx:33-46` y `app/(dashboard)/proyectos-historico/ProyectosHistoricoPageClient.tsx:43-56`

El tipo `ProyectoHistoricoRow` esta definido de forma identica en dos archivos distintos. Mismo problema que H10: viola la regla de tipos centralizados en `types/database.ts`.

**Fix recomendado**: Mover el tipo `ProyectoHistoricoRow` a `types/database.ts` e importarlo en ambos archivos. Eliminar las definiciones locales.

---

### H12. Faltan error.tsx en la mayoria de rutas del dashboard

**Severidad**: HIGH
**Ubicacion**: multiples rutas

Las siguientes rutas no tienen archivo `error.tsx` para manejar errores de forma elegante:

- `/proyectos` (`app/(dashboard)/engineering/`)
- `/engineering/projects/[id]` (`app/(dashboard)/engineering/projects/[id]/`)
- `/home` (`app/(dashboard)/home/`)
- `/databases` (`app/(dashboard)/databases/`)
- `/aeronaves` (`app/(dashboard)/aeronaves/`)
- `/tools` (`app/(dashboard)/tools/`)
- `/settings` (`app/(dashboard)/settings/`)

Solo existen `error.tsx` en `/clients` y `/engineering/portfolio`. Cuando una de las rutas sin error boundary falla, el usuario ve la pagina de error generica de Next.js sin posibilidad de recuperacion.

**Fix recomendado**: Crear `error.tsx` en cada ruta del dashboard, siguiendo el patron ya establecido en `clients/error.tsx`.

---

## MEDIUM — Rendimiento y UX

Problemas que afectan al rendimiento de la aplicacion o a la experiencia del usuario.

---

### M1. N+1 Realtime subscriptions — un canal WebSocket por cada ProjectTimerButton

**Severidad**: MEDIUM
**Ubicacion**: `components/project/ProjectTimerButton.tsx`

Cada instancia de `ProjectTimerButton` crea su propio canal de WebSocket con Supabase Realtime. Si hay 50 proyectos visibles, se crean 50 conexiones WebSocket simultaneas. Esto afecta al rendimiento del navegador y puede alcanzar limites de conexiones.

**Fix recomendado**: Centralizar las subscripciones Realtime en un componente padre que mantenga un solo canal y distribuya las actualizaciones a cada `ProjectTimerButton` via props o contexto.

---

### M2. Stale closure en ProjectDetailClient — rollback con datos obsoletos

**Severidad**: MEDIUM
**Ubicacion**: `app/(dashboard)/engineering/projects/[id]/ProjectDetailClient.tsx:241-312`

Las funciones `saveEdit` y `handleDelete` capturan el valor de `entries` en el momento de crear el callback. Si `entries` cambia por una actualizacion de Realtime antes de que el usuario ejecute la accion, el rollback restaurara datos obsoletos en vez de los datos actuales.

**Fix recomendado**: Usar `useRef` para mantener siempre la referencia actualizada de `entries`, o reestructurar para que el rollback use el estado mas reciente.

---

### M3. JSX duplicado 3 veces en incoming/[id]/page.tsx

**Severidad**: MEDIUM
**Ubicacion**: `app/(dashboard)/quotations/incoming/[id]/page.tsx` (~1118 lineas)

El archivo tiene JSX duplicado 3 veces, una vez por cada estado posible de la consulta (nuevo, esperando_formulario, formulario_recibido). La seccion "Proyectos del cliente" se copia entera 3 veces con la misma logica y estructura.

**Fix recomendado**: Extraer las secciones comunes a componentes reutilizables. Usar renderizado condicional en vez de duplicar bloques enteros.

---

### M4. NEXT_PUBLIC_RAG_API_URL expone URL del backend FastAPI RAG

**Severidad**: MEDIUM
**Ubicacion**: variables de entorno

La variable `NEXT_PUBLIC_RAG_API_URL` expone la URL del backend FastAPI del sistema RAG al navegador. Si esta URL solo se usa desde el servidor (API routes o server components), no necesita el prefijo `NEXT_PUBLIC_`.

**Fix recomendado**: Verificar si la URL se usa desde el cliente. Si solo es server-side, quitar el prefijo `NEXT_PUBLIC_` para que no se incluya en el bundle del cliente.

---

### M5. createClient() de Supabase llamado multiples veces sin memoizar

**Severidad**: MEDIUM
**Ubicacion**: `components/quotations/CenterColumnCollapsible.tsx:295,344`, `components/project/ProjectTimerButton.tsx:63,126`, `app/(dashboard)/engineering/projects/[id]/ProjectDetailClient.tsx:153,267,298`

Se llama a `createClient()` de Supabase multiples veces dentro de `useEffect` y handlers de eventos sin memoizar. Cada llamada crea una nueva instancia del cliente, lo que es innecesario y puede afectar al rendimiento.

**Fix recomendado**: Crear el cliente una sola vez fuera de los handlers (al nivel del componente o en un hook personalizado) y reutilizar la instancia.

---

### M6. Race condition con router.refresh() concurrentes

**Severidad**: MEDIUM
**Ubicacion**: `components/quotations/QuotationStatesBoard.tsx:270,350,432`

Cuando el usuario cambia estados rapidamente, se lanzan multiples llamadas a `router.refresh()` de forma concurrente. Esto puede causar estados inconsistentes en la UI porque cada refresh puede completarse en orden diferente al esperado.

**Fix recomendado**: Debounce o serializar las llamadas a `router.refresh()`. Usar un flag de "operacion en curso" para evitar acciones concurrentes.

---

### M7. No hay indicacion visual cuando queries de Supabase fallan

**Severidad**: MEDIUM
**Ubicacion**: `app/(dashboard)/quotations/page.tsx:92-104`

Cuando una consulta a Supabase falla, solo se hace `console.error`. El usuario ve el board completamente vacio sin ninguna indicacion de que hubo un error. No hay toast, mensaje, ni boton de reintentar.

**Fix recomendado**: Mostrar un componente de error visible al usuario cuando las consultas fallan, con boton de reintentar.

---

### M8. Typo en color CSS #f8fasc (invalido)

**Severidad**: MEDIUM
**Ubicacion**: `app/(dashboard)/clients/error.tsx:18` y `app/(dashboard)/engineering/portfolio/error.tsx:18`

El valor de color `#f8fasc` es un codigo hexadecimal invalido. Deberia ser `#f8fafc`. Aunque el navegador ignora el valor invalido y usa el color por defecto, es un bug visual que deberia corregirse.

**Fix recomendado**: Cambiar `#f8fasc` por `#f8fafc` en ambos archivos.

---

### M9. Timer setNow(Date.now()) corre cada segundo con tab invisible

**Severidad**: MEDIUM
**Ubicacion**: `app/(dashboard)/engineering/projects/[id]/ProjectDetailClient.tsx:133-149`

El timer que actualiza `setNow(Date.now())` cada segundo sigue corriendo incluso cuando la pestana del navegador no esta visible. Esto consume CPU innecesariamente.

**Fix recomendado**: Usar la Page Visibility API para pausar el timer cuando la pestana no es visible y reanudarlo cuando el usuario vuelve.

---

### M10. Redirect a /proyectos en vez de /engineering/portfolio

**Severidad**: MEDIUM
**Ubicacion**: `app/(dashboard)/engineering/projects/[id]/page.tsx:48`

Cuando un proyecto no existe, el redirect va a `/proyectos`. Deberia ir a `/engineering/portfolio` que es la pagina correcta dentro del modulo de ingenieria.

**Fix recomendado**: Cambiar el redirect a `/engineering/portfolio`.

---

### M11. EngineeringClient.tsx es 100% mock data sin indicacion

**Severidad**: MEDIUM
**Ubicacion**: `components/engineering/EngineeringClient.tsx` (531 lineas)

Todo el componente trabaja con datos mock sin ninguna indicacion visible para el usuario de que los datos que esta viendo no son reales. Esto puede generar confusion y expectativas incorrectas.

**Fix recomendado**: Anadir un banner o indicacion visual clara de que la vista contiene datos de ejemplo. Considerar conectar con datos reales cuando esten disponibles.

---

### M12. Portfolio page pasa array vacio — boton sin funcionalidad

**Severidad**: MEDIUM
**Ubicacion**: `app/(dashboard)/engineering/portfolio/page.tsx`

La pagina de portfolio pasa un array vacio `[]`. El boton "Nuevo Proyecto" no tiene handler `onClick` asignado, por lo que no hace nada al pulsarlo.

**Fix recomendado**: Implementar el handler del boton o deshabilitarlo/ocultarlo hasta que la funcionalidad este lista.

---

### M13. calcProjectProgress() siempre retorna 0 pero se muestra barra al 8%

**Severidad**: MEDIUM
**Ubicacion**: `components/project/workspace-utils.ts:115-117`

La funcion `calcProjectProgress()` siempre retorna `0` independientemente de los datos del proyecto. Sin embargo, la UI renderiza una barra de progreso que muestra un 8% falso, dando informacion incorrecta al usuario.

**Fix recomendado**: Implementar el calculo real de progreso o eliminar la barra de progreso hasta que los datos esten disponibles.

---

### M14. TopBar — botones de busqueda y notificaciones no funcionales

**Severidad**: MEDIUM
**Ubicacion**: componente TopBar

El boton de busqueda `Cmd+K` no tiene handler `onClick` asignado — no hace nada al pulsarlo. La campana de notificaciones muestra un punto rojo indicando notificaciones pendientes, pero es un indicador falso que no esta conectado a ningun sistema de notificaciones real.

**Fix recomendado**: Implementar las funcionalidades o eliminar los botones/indicadores hasta que esten listos. No mostrar indicadores falsos.

---

### M15. Deteccion fragil de errores de fetch en rag-api.ts

**Severidad**: MEDIUM
**Ubicacion**: `lib/rag-api.ts:67`

La deteccion de errores usa `error.message.includes('fetch')`, que es fragil porque el texto del mensaje de error varia segun el runtime (Node.js, browser, edge). Un cambio de version del runtime podria romper la deteccion.

**Fix recomendado**: Usar `instanceof TypeError` o verificar el tipo de error de forma mas robusta.

---

### M16. ragChatHistory retorna Promise<unknown[]> sin tipos

**Severidad**: MEDIUM
**Ubicacion**: `lib/rag-api.ts:416`

La funcion `ragChatHistory` retorna `Promise<unknown[]>` en vez de un tipo definido. Esto pierde la seguridad de tipos y obliga a hacer casting manual en cada uso.

**Fix recomendado**: Definir un tipo `ChatHistoryEntry` en `types/database.ts` y usarlo como tipo de retorno.

---

### M17. Sidebar collapse state no se persiste

**Severidad**: MEDIUM
**Ubicacion**: `store/uiStore.ts`

El estado de colapso del sidebar se gestiona en el store de Zustand pero no se persiste en `localStorage`. Cada vez que el usuario recarga la pagina, el sidebar vuelve a su estado por defecto, perdiendo la preferencia del usuario.

**Fix recomendado**: Usar el middleware `persist` de Zustand para guardar el estado del sidebar en `localStorage`.

---

### M18. isProjectState() tiene nombre enganoso

**Severidad**: MEDIUM
**Ubicacion**: `lib/workflow-states.ts:513-515`

La funcion `isProjectState()` solo verifica workflow states, no legacy states. El nombre sugiere que cubre todos los estados de proyecto, pero no es asi. La funcion `isProjectStatePersisted()` es la que cubre ambos tipos.

**Fix recomendado**: Renombrar `isProjectState()` a `isProjectWorkflowState()` o documentar claramente la diferencia. Considerar deprecar la funcion enganosa.

---

## LOW — Calidad de codigo

Hallazgos menores de calidad de codigo, accesibilidad, consistencia y mejores practicas.

---

### L1. Icono Plus usado como "ver detalle" — semantica incorrecta

**Severidad**: LOW
**Ubicacion**: `components/project/ProyectosClient.tsx:338`

Se usa el icono `Plus` para la accion de "ver detalle" de un proyecto. Semanticamente, `Plus` indica "anadir" o "crear". Para "ver detalle" deberia usarse `Eye`, `ChevronRight` u otro icono que indique navegacion o visualizacion.

---

### L2. ESTADO_COLORS/ESTADO_LABELS duplican datos de workflow-states

**Severidad**: LOW
**Ubicacion**: `app/(dashboard)/engineering/projects/[id]/ProjectDetailClient.tsx:77-107`

Las constantes `ESTADO_COLORS` y `ESTADO_LABELS` replican informacion que ya existe en `lib/workflow-states.ts`. Si se cambia un color o label en un sitio, hay que recordar cambiarlo en el otro.

---

### L3. escapeHtml no escapa comillas simples

**Severidad**: LOW
**Ubicacion**: `app/api/consultas/[id]/send-client/route.ts:32-38`

La funcion `escapeHtml` escapa `&`, `<`, `>` y `"` pero no las comillas simples (`'`). Dependiendo del contexto donde se use el HTML escapado, esto podria permitir inyeccion en atributos que usan comillas simples.

---

### L4. UI mezcla espanol e ingles inconsistentemente

**Severidad**: LOW
**Ubicacion**: multiples archivos

La interfaz mezcla espanol e ingles sin un patron claro: la pagina de login esta en ingles, el sidebar mezcla ambos idiomas, y la TopBar tambien mezcla. Esto crea una experiencia inconsistente para el usuario.

---

### L5. Tablas clickeables sin accesibilidad por teclado

**Severidad**: LOW
**Ubicacion**: componentes de tabla en el dashboard

Las filas de tabla que son clickeables no tienen `tabIndex` ni handler `onKeyDown`. Esto impide la navegacion por teclado y afecta a usuarios que no usan raton.

---

### L6. Faltan aria-label en botones de interfaz

**Severidad**: LOW
**Ubicacion**: Sidebar, TopBar, filtros de busqueda

Botones del sidebar, de la TopBar y de los filtros de busqueda no tienen atributo `aria-label`. Los lectores de pantalla no pueden describir la funcion de estos botones a usuarios con discapacidad visual.

---

### L7. Falta loading.tsx en todas las rutas del dashboard

**Severidad**: LOW
**Ubicacion**: todas las rutas bajo `app/(dashboard)/`

Ninguna ruta del dashboard tiene archivo `loading.tsx`. Cuando una pagina tarda en cargar, el usuario no ve ningun indicador de carga y la interfaz parece congelada.

---

### L8. Parametro entity sin usar en requiresWorkflowReason

**Severidad**: LOW
**Ubicacion**: `lib/workflow-states.ts:490`

La funcion `requiresWorkflowReason` acepta un parametro `entity` que nunca se usa dentro del cuerpo de la funcion. Es codigo que confunde sobre la intencion original.

---

### L9. isIncomingQueryStateCode crea arrays intermedios en cada llamada

**Severidad**: LOW
**Ubicacion**: `lib/workflow-state-config.ts:663-665`

La funcion `isIncomingQueryStateCode` crea arrays intermedios en cada invocacion en vez de usar una constante pre-calculada. Aunque el impacto en rendimiento es minimo, es una ineficiencia innecesaria.

---

### L10. ConsultaEntrante.estado tipado como string en vez de EstadoConsulta

**Severidad**: LOW
**Ubicacion**: `types/database.ts:454`

El campo `estado` de `ConsultaEntrante` esta tipado como `string` generico cuando deberia usar el tipo union `EstadoConsulta` que ya existe. Esto pierde la seguridad de tipos y permite valores invalidos.

---

### L11. Campos opcionales con ? cuando Supabase devuelve null

**Severidad**: LOW
**Ubicacion**: `types/database.ts` — tipo `ConsultaEntrante`

Varios campos de `ConsultaEntrante` usan `?` (opcional, valor puede ser `undefined`) cuando Supabase siempre devuelve `null` para campos sin valor, nunca `undefined`. Deberian tiparse como `campo: string | null` en vez de `campo?: string`.

---

### L12. Email delete sin dialogo de confirmacion

**Severidad**: LOW
**Ubicacion**: `components/quotations/CenterColumnCollapsible.tsx`

El borrado de emails no muestra dialogo de confirmacion previo. Esto es inconsistente con el borrado de cards en el board, que si usa `window.confirm()`. Acciones destructivas deberian tener confirmacion uniforme.

---

### L13. ClientReplyComposer no previene doble submit en handler

**Severidad**: LOW
**Ubicacion**: `components/quotations/ClientReplyComposer.tsx`

Aunque el boton de submit se deshabilita visualmente durante el envio, el handler de submit no tiene proteccion propia contra doble ejecucion. Si se llama al handler de otra forma (ej: submit del formulario por Enter), puede ejecutarse dos veces.

---

### L14. router.refresh() despues de router.push() redundante

**Severidad**: LOW
**Ubicacion**: `components/quotations/ClientReplyComposer.tsx:208-209`

Se llama a `router.refresh()` inmediatamente despues de `router.push()`. El `push` ya carga la nueva pagina con datos frescos, haciendo el `refresh` redundante.

---

### L15. .env.example no incluye las webhook URLs nuevas

**Severidad**: LOW
**Ubicacion**: `.env.example`

El archivo `.env.example` no documenta las variables de entorno de webhook que la aplicacion necesita. Un desarrollador nuevo no sabra que variables configurar para que los webhooks funcionen.

---

### L16. Sync effect dispara en cada re-render del padre

**Severidad**: LOW
**Ubicacion**: `components/quotations/CenterColumnCollapsible.tsx:289-291`

El efecto `setLiveEmails(initialEmails)` se ejecuta cada vez que el componente padre re-renderiza porque la referencia del array `initialEmails` cambia en cada render. Esto causa actualizaciones innecesarias del estado local.

---

### L17. Logica de project_board scope en modulo equivocado

**Severidad**: LOW
**Ubicacion**: `components/quotations/QuotationStatesBoard.tsx:163-179`

La gestion del scope `project_board` esta implementada dentro de `QuotationStatesBoard.tsx`, que pertenece al modulo de quotations. Esta logica deberia estar en el modulo de proyectos.

---

### L18. Proyecto.prioridad tipado como string | null

**Severidad**: LOW
**Ubicacion**: `types/database.ts`

El campo `prioridad` del tipo `Proyecto` esta tipado como `string | null` en vez de usar un union literal: `'baja' | 'normal' | 'alta' | 'urgente' | null`. Esto permite valores invalidos y pierde autocompletado en el IDE.

---

### L19. Version en lib/app-release.ts hardcodeada manualmente

**Severidad**: LOW
**Ubicacion**: `lib/app-release.ts`

La version de la aplicacion se mantiene hardcodeada en el archivo y se actualiza manualmente. Esto es propenso a errores y olvidos. Riesgo de proceso: la version mostrada puede no coincidir con la version real desplegada.

---

### L20. No hay metadata/titulo especifico por pagina del dashboard

**Severidad**: LOW
**Ubicacion**: todas las rutas bajo `app/(dashboard)/`

Ninguna pagina del dashboard define metadata o titulo especifico. Todas las pestanas del navegador muestran el mismo titulo generico, dificultando la identificacion cuando el usuario tiene multiples pestanas abiertas.

---

## Patrones positivos

La auditoria tambien identifico patrones positivos que demuestran buenas practicas de desarrollo:

### Arquitectura

- **Separacion server/client impecable**: el patron `page.tsx` (servidor, datos) + `*Client.tsx` (cliente, interfaz) se respeta de forma consistente en todo el proyecto. Es una de las mejores implementaciones de este patron que se pueden encontrar.

- **`as const satisfies` usado correctamente**: las constantes de estados usan `as const satisfies` para obtener inferencia de tipos literal con validacion de estructura. Uso avanzado y correcto de TypeScript.

- **Sistema de estados workflow robusto**: el sistema de transiciones de estados en `lib/workflow-states.ts` es sofisticado, con transiciones definidas, bridge para estados legacy, configuracion visual DB-driven y fallback elegante. Es la pieza mas madura del codebase.

- **Degradacion elegante con isMissingSchemaError**: cuando una tabla de Supabase no existe o no esta migrada, la aplicacion degrada elegantemente en vez de crashear. Esto permite la reconexion progresiva de tablas documentada en los docs.

### Seguridad del servidor

- **React `cache()` correcto**: `workflow-state-config.server.ts` usa `cache()` de React correctamente para evitar refetches dentro del mismo render tree del servidor.

- **`import 'server-only'` donde corresponde**: los modulos que solo deben ejecutarse en el servidor tienen el import protector. Esto previene que codigo del servidor se incluya accidentalmente en bundles del cliente.

### Calidad de codigo

- **Documentacion interna excelente**: los comentarios en el codigo son claros, en espanol, y explican el "por que" ademas del "que". La carpeta `docs/` es una referencia util y actualizada.

- **TypeScript strict mode activado**: `tsconfig.json` tiene strict mode habilitado, lo que atrapa muchos errores en tiempo de compilacion.

- **Patrones inmutables con spreads**: el codigo usa spreads (`{ ...obj, campo: nuevoValor }`) de forma consistente para actualizaciones inmutables de estado. No se encontraron mutaciones directas.

### Despliegue

- **Standalone output correcto para Docker**: la configuracion de Next.js tiene `output: 'standalone'` configurado correctamente, lo que permite despliegues Docker optimizados.

---

## Plan de accion

Los hallazgos de seguridad (CRITICAL) se han documentado y se implementaran como parte de la fase de pre-produccion. Las prioridades actuales se organizan por fase.

### Fase actual — desarrollo

Tareas que se pueden abordar ahora sin riesgo y que mejoran la calidad del codigo inmediatamente:

1. **Eliminar codigo muerto** (H7, H8, H9)
   - Borrar `IncomingQueriesPanel.tsx`
   - Borrar `ConsultaFormPreview.tsx`
   - Borrar `PROJECT_STATUS_CONFIG` de `workspace-utils.ts`

2. **Mover tipos duplicados a types/database.ts** (H10, H11)
   - Centralizar `AeronaveRow` en `types/database.ts`
   - Centralizar `ProyectoHistoricoRow` en `types/database.ts`
   - Eliminar definiciones locales en los archivos de pagina y client

3. **Anadir error.tsx a rutas sin el** (H12)
   - Crear `error.tsx` en: `/engineering`, `/engineering/projects/[id]`, `/home`, `/databases`, `/aeronaves`, `/tools`, `/settings`
   - Seguir el patron de `clients/error.tsx`

4. **Arreglar typos CSS** (M8)
   - Cambiar `#f8fasc` por `#f8fafc` en `clients/error.tsx` y `engineering/portfolio/error.tsx`

5. **Arreglar QuotationDetailClient para recibir datos reales** (H2)
   - Pasar `incomingQueries` desde el server component al client component
   - Verificar que `defaultQuotationLanes` reciba los datos necesarios

6. **Eliminar fallback hardcodeado de webhook** (C6)
   - Quitar la URL hardcodeada de `ProyectosClient.tsx:156`
   - Lanzar error explicito si la variable de entorno no existe

### Pre-produccion — seguridad

Tareas que deben completarse ANTES de exponer la aplicacion a usuarios finales:

1. **Crear middleware.ts con auth** (C1)
   - Implementar verificacion de sesion Supabase SSR
   - Proteger todas las rutas bajo `(dashboard)`
   - Redirigir a `/login` cuando no hay sesion

2. **Anadir auth a todos los API routes** (C2, C3)
   - Verificar sesion en cada route handler
   - Verificar sesion en server actions
   - Retornar 401 para peticiones sin autenticacion

3. **Sanitizar HTML de emails** (C4)
   - Instalar DOMPurify
   - Sanitizar antes de pasar a `dangerouslySetInnerHTML`

4. **Quitar NEXT_PUBLIC_ de webhook URLs** (C5)
   - Mover variables de webhook a server-only
   - Redirigir llamadas a webhooks a traves de API routes con auth

5. **Parametrizar filtros Supabase** (C7)
   - Reemplazar template literals en `.or()` con metodos encadenados
   - Verificar todas las consultas Supabase del proyecto

6. **Verificar RLS en todas las tablas**
   - Confirmar que las politicas Row Level Security esten activas
   - Auditar permisos por rol

### Mejora continua

Tareas para iterar de forma progresiva despues de la consolidacion:

1. **Descomponer archivos grandes** (H5, H6, M3)
   - `QuotationStatesBoard.tsx` (1379 lineas) -> componentes individuales
   - `ProyectosClient.tsx` (933 lineas) -> componentes individuales
   - `incoming/[id]/page.tsx` (1118 lineas) -> componentes reutilizables

2. **Centralizar Realtime subscriptions** (M1)
   - Un canal por modulo en vez de uno por componente
   - Distribuir actualizaciones via props o contexto

3. **Anadir loading.tsx a rutas** (L7)
   - Crear loading states para todas las paginas del dashboard

4. **Accesibilidad** (L5, L6)
   - Anadir `aria-label` a todos los botones de interfaz
   - Implementar navegacion por teclado en tablas y listas

5. **Internacionalizacion consistente** (L4)
   - Decidir idioma principal de la interfaz
   - Unificar textos en ese idioma
