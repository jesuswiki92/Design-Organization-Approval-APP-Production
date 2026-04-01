# CLAUDE.md - Instrucciones para la IA

## Sobre este proyecto
DOA Operations Hub - aplicacion interna para gestion de consultas, cotizaciones y proyectos de ingenieria aeronáutica (EASA Part 21J).

**Stack**: Next.js 16, React 19, Supabase, Tailwind CSS v4, shadcn/ui, OpenRouter, n8n, Zustand.

## Estado actual
La app esta en reestructuracion. Las bases de datos estan desconectadas. Se reconectan una a una segun se necesiten (ver `docs/02-bases-de-datos.md`).

Estado funcional reciente:
- `Quotations` tiene `Tablero` y `Lista`, alta/borrado local de estados y pagina de detalle en `/quotations/[id]`.
- `Engineering` se presenta al usuario como `Proyectos` y tiene `Tablero` y `Lista` mock.
- Ver `docs/06-estado-actual.md` para el resumen de lo que esta implementado ahora mismo.

## Documentacion
Toda la documentacion esta en la carpeta `docs/`:
- `docs/01-guia-proyecto.md` - Mapa completo del proyecto
- `docs/02-bases-de-datos.md` - Inventario de tablas y plan de reconexion
- `docs/03-flujo-consultas.md` - Flujo de consultas entrantes y estado actual de Quotations
- `docs/04-como-añadir-cosas.md` - Recetas para cambios comunes
- `docs/05-buenas-practicas.md` - Reglas de codigo
- `docs/06-estado-actual.md` - Estado funcional actual de la app

Lee los docs relevantes ANTES de hacer cambios.

## Reglas obligatorias

### Estructura
- `page.tsx` = servidor (datos). `*Client.tsx` = cliente (interfaz). No mezclar.
- Tipos en `types/database.ts`. Estados en `lib/workflow-states.ts`. Utilidades en `lib/`.
- No crear archivos fuera de la estructura existente sin justificacion.

### Estados
- SIEMPRE usar constantes de `lib/workflow-states.ts` (ej: `CONSULTA_ESTADOS.NUEVO`)
- NUNCA hardcodear strings de estado
- Para anadir estados, seguir la receta en `docs/04-como-añadir-cosas.md`

### Base de datos
- Las tablas estan desconectadas. Ver `docs/02-bases-de-datos.md` para saber cuales reconectar.
- Para reconectar: seguir la receta en `docs/04-como-añadir-cosas.md`
- Usar `createClient` de `@/lib/supabase/server` en server components
- SIEMPRE verificar autenticacion en API routes

### Codigo limpio
- No dejar codigo comentado - borrar lo que no se use
- No duplicar funciones - si se repite, mover a `lib/`
- URLs externas en variables de entorno (.env.local), nunca hardcodeadas
- Errores con contexto: `console.error('Descripcion:', error)`
- Si tocas algo, actualiza el doc correspondiente en `docs/`

### Estilos
- Tailwind CSS directo, no CSS custom
- Modo oscuro siempre activo
- Reutilizar componentes shadcn/ui de `components/ui/`

### Lo que NO hacer
- No crear archivos de documentacion en la raiz (van en `docs/`)
- No tocar `proxy.ts` ni `lib/supabase/server.ts` sin razon
- No instalar dependencias nuevas sin justificar
- No crear tipos fuera de `types/database.ts`
