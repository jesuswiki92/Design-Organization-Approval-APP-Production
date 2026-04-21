# DOA Operations Hub

Aplicación interna para la gestión de requests, cotizaciones y projects de ingeniería aeronáutica (EASA Part 21J DOA).

## Inicio rápido

```bash
npm install
npm run dev
```

Requiere `.env.local` con las variables de Supabase y OpenRouter. Ver `docs/01-guia-project.md` para la lista completa.

## Documentación

| Doc | Contenido |
|-----|-----------|
| [Guía del project](docs/01-guia-project.md) | Mapa de carpetas, tecnología, estructura |
| [Bases de datos](docs/02-bases-de-datos.md) | Inventario de tablas Supabase |
| [Flujo de requests](docs/03-flujo-requests.md) | Los 3 statuses del flujo principal |
| [Cómo añadir cosas](docs/04-como-añadir-cosas.md) | Recetas paso a paso |
| [Buenas prácticas](docs/05-buenas-practicas.md) | Reglas de código |
| [Estado actual](docs/06-status-actual.md) | Lo que hay implementado ahora mismo en la app |
| [Observability Fase 1](docs/07-observability.md) | Evento canÃ³nico `doa_app_events`, helpers y cobertura inicial |

## Para la IA

Lee `CLAUDE.md` antes de hacer cualquier cambio.
