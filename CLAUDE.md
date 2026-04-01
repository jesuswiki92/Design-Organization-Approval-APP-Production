# CLAUDE.md — Instrucciones para la IA

## Sobre este proyecto
DOA Operations Hub — aplicación interna para gestión de consultas, cotizaciones y proyectos de ingeniería aeronáutica (EASA Part 21J).

**Stack**: Next.js 16, React 19, Supabase, Tailwind CSS v4, shadcn/ui, OpenRouter, n8n, Zustand.

## Estado actual
La app está en reestructuración. Las bases de datos están desconectadas. Se reconectan una a una según se necesiten (ver `docs/02-bases-de-datos.md`).

## Documentación
Toda la documentación está en la carpeta `docs/`:
- `docs/01-guia-proyecto.md` — Mapa completo del proyecto
- `docs/02-bases-de-datos.md` — Inventario de tablas y plan de reconexión
- `docs/03-flujo-consultas.md` — Flujo de consultas entrantes (3 estados)
- `docs/04-como-añadir-cosas.md` — Recetas para cambios comunes
- `docs/05-buenas-practicas.md` — Reglas de código

Lee los docs relevantes ANTES de hacer cambios.

## Reglas obligatorias

### Estructura
- `page.tsx` = servidor (datos). `*Client.tsx` = cliente (interfaz). No mezclar.
- Tipos en `types/database.ts`. Estados en `lib/workflow-states.ts`. Utilidades en `lib/`.
- No crear archivos fuera de la estructura existente sin justificación.

### Estados
- SIEMPRE usar constantes de `lib/workflow-states.ts` (ej: `CONSULTA_ESTADOS.NUEVO`)
- NUNCA hardcodear strings de estado
- Para añadir estados, seguir la receta en `docs/04-como-añadir-cosas.md`

### Base de datos
- Las tablas están desconectadas. Ver `docs/02-bases-de-datos.md` para saber cuáles reconectar.
- Para reconectar: seguir la receta en `docs/04-como-añadir-cosas.md`
- Usar `createClient` de `@/lib/supabase/server` en server components
- SIEMPRE verificar autenticación en API routes

### Código limpio
- No dejar código comentado — borrar lo que no se use
- No duplicar funciones — si se repite, mover a `lib/`
- URLs externas en variables de entorno (.env.local), nunca hardcodeadas
- Errores con contexto: `console.error('Descripción:', error)`
- Si tocas algo, actualiza el doc correspondiente en `docs/`

### Estilos
- Tailwind CSS directo, no CSS custom
- Modo oscuro siempre activo
- Reutilizar componentes shadcn/ui de `components/ui/`

### Lo que NO hacer
- No crear archivos de documentación en la raíz (van en `docs/`)
- No tocar `proxy.ts` ni `lib/supabase/server.ts` sin razón
- No instalar dependencias nuevas sin justificar
- No crear tipos fuera de `types/database.ts`
