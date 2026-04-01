# Skill Registry

**Orchestrator use only.** Read this once per session to resolve skill paths and project conventions before launching any sub-agent or continuing work.

**Project**: doa-ops-hub  
**Generated**: 2026-04-01  
**Persistence**: openspec + local registry + engram

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Buscar o instalar una skill para una necesidad concreta | `find-skills` | `/home/coder/.agents/skills/find-skills/SKILL.md` |
| Construir o refinar UI/frontend en React o web | `frontend-design` | `/home/coder/.agents/skills/frontend-design/SKILL.md` |
| Revisar o optimizar React/Next.js con prácticas de Vercel | `vercel-react-best-practices` | `/home/coder/.agents/skills/vercel-react-best-practices/SKILL.md` |
| Crear o mejorar una skill | `skill-creator` | `/home/coder/.agents/skills/skill-creator/SKILL.md` |
| Generar o editar imágenes raster | `imagegen` | `/root/.codex/skills/.system/imagegen/SKILL.md` |
| Consultar documentación oficial de OpenAI | `openai-docs` | `/root/.codex/skills/.system/openai-docs/SKILL.md` |
| Crear plugins locales de Codex | `plugin-creator` | `/root/.codex/skills/.system/plugin-creator/SKILL.md` |
| Instalar skills desde catálogo o repositorio | `skill-installer` | `/root/.codex/skills/.system/skill-installer/SKILL.md` |

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| `CLAUDE.md` | `CLAUDE.md` | Guía primaria del proyecto. Leer antes de tocar código. |
| `docs/01-guia-proyecto.md` | `docs/01-guia-proyecto.md` | Mapa funcional y estructural de la app. |
| `docs/02-bases-de-datos.md` | `docs/02-bases-de-datos.md` | Estado real de tablas, reconexión y servicios externos. |
| `docs/03-flujo-consultas.md` | `docs/03-flujo-consultas.md` | Flujo comercial principal y archivos implicados. |
| `docs/04-como-añadir-cosas.md` | `docs/04-como-añadir-cosas.md` | SOP para añadir páginas, APIs, estados y reconectar DB. |
| `docs/05-buenas-practicas.md` | `docs/05-buenas-practicas.md` | Reglas de estructura, Supabase, Tailwind y entrega. |
| `docs/06-estado-actual.md` | `docs/06-estado-actual.md` | Snapshot funcional más reciente de Quotations y Proyectos. |
| `openspec/config.yaml` | `openspec/config.yaml` | Configuración SDD ya inicializada para este repo. |

## SDD Persistence

| Path | Purpose |
|------|---------|
| `openspec/config.yaml` | Reglas SDD del proyecto y contexto detectado. |
| `openspec/specs/` | Fuente de verdad para especificaciones base. |
| `openspec/changes/` | Workspace para cambios activos. |
| `openspec/changes/archive/` | Historial de cambios completados. |

## Current Initialization Notes

- El repo ya tiene `openspec/` creado; no hace falta reinicializar desde cero.
- La guía operativa real del proyecto vive en `CLAUDE.md` + `docs/`.
- El stack detectado es Next.js 16 + React 19 + TypeScript + Tailwind v4 + Supabase + Zustand.
- Hay cambios locales sin commit en gran parte del repo; tomar el working tree actual como baseline antes de abrir un change nuevo.
