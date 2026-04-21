# CLAUDE.md - Instrucciones para la IA

## Sobre este project
DOA Operations Hub - aplicacion interna para gestion de requests, cotizaciones y projects de ingenieria aeronáutica (EASA Part 21J).

**Stack**: Next.js 16, React 19, Supabase, Tailwind CSS v4, shadcn/ui, OpenRouter, n8n, Zustand.

## Estado actual
La app esta en reestructuracion. Las bases de datos estan desconectadas. Se reconectan una a una segun se necesiten (ver `docs/02-bases-de-datos.md`).

Estado funcional reciente:
- `Quotations` tiene `Tablero` y `Lista`, high/borrado local de statuses y pagina de detalle en `/quotations/[id]`.
- `Engineering` se presenta al user_label como `Proyectos` y tiene `Tablero` y `Lista` mock.
- Ver `docs/06-status-actual.md` para el resumen de lo que esta implementado ahora mismo.

## Documentacion
Toda la documentacion esta en la folder `docs/`:
- `docs/01-guia-project.md` - Mapa completo del project
- `docs/02-bases-de-datos.md` - Inventario de tablas y plan de reconexion
- `docs/03-flujo-requests.md` - Flujo de requests entrantes y status actual de Quotations
- `docs/04-como-añadir-cosas.md` - Recetas para cambios comunes
- `docs/05-buenas-practicas.md` - Reglas de codigo
- `docs/06-status-actual.md` - Estado funcional actual de la app

Lee los docs relevantes ANTES de hacer cambios.

## Reglas obligatorias

### Estructura
- `page.tsx` = servidor (datos). `*Client.tsx` = client (interfaz). No mezclar.
- Tipos en `types/database.ts`. Estados en `lib/workflow-states.ts`. Utilidades en `lib/`.
- No crear archivos fuera de la estructura existente sin justificacion.

### Estados
- SIEMPRE usar constantes de `lib/workflow-states.ts` (ej: `INCOMING_REQUEST_STATUSES.NEW`)
- NUNCA hardcodear strings de status
- Para anadir statuses, seguir la receta en `docs/04-como-añadir-cosas.md`

### Base de datos
- Las tablas estan desconectadas. Ver `docs/02-bases-de-datos.md` para saber cuales reconectar.
- Para reconectar: seguir la receta en `docs/04-como-añadir-cosas.md`
- Usar `createClient` de `@/lib/supabase/server` en server components
- SIEMPRE verificar autenticacion en API routes con `requireUserApi()` de `@/lib/auth/require-user`
- En server actions o server components, usar `requireUserAction()` (redirige a `/login` si no hay sesion)

### Autenticacion de rutas
- El guard de rutas protegidas vive en `proxy.ts` (raiz de `01.Desarrollo de App/`). En Next.js 16 el archivo DEBE llamarse `proxy.ts` y el export DEBE ser `proxy` — `middleware.ts` quedo deprecado y emite warning en cada build. No renombrar.
- `proxy.ts` protege `/home`, `/engineering`, `/quotations`, `/clients`, `/databases`, `/tools`; redirige a `/login` si no hay sesion, y redirige a `/home` si un user_label ya autenticado entra a `/login`.
- Las rutas `/api/*` estan excluidas del matcher de `proxy.ts`, asi que la verificacion de sesion en APIs es responsabilidad de cada `route.ts` via `requireUserApi()`.

### Codigo limpio
- No dejar codigo comentado - borrar lo que no se use
- No duplicar funciones - si se repite, mover a `lib/`
- URLs externas en variables de entorno (.env.local), nunca hardcodeadas
- Errores con contexto: `console.error('Descripcion:', error)`
- Si tocas algo, actualiza el doc correspondiente en `docs/`

### Estilos
- Tailwind CSS directo, no CSS custom
- Modo oscuro siempre is_active
- Reutilizar componentes shadcn/ui de `components/ui/`

### Lo que NO hacer
- No crear archivos de documentacion en la raiz (van en `docs/`)
- No tocar `proxy.ts` ni `lib/supabase/server.ts` sin razon (son la base de la autenticacion)
- No renombrar `proxy.ts` a `middleware.ts` — Next.js 16 deprecó `middleware.ts` y emite warning; el name canonico es `proxy.ts` con export `proxy`
- No instalar dependencias nuevas sin justificar
- No crear tipos fuera de `types/database.ts`
