# Skill Registry

**Orchestrator use only.** Read this registry once per session to resolve skill paths, then pass pre-resolved paths directly to each sub-agent's launch prompt. Sub-agents receive the path and load the skill directly - they do not read this registry.

## Project Context

DOA Ops Hub is a Next.js 16 + React 19 application with TypeScript, Supabase, Tailwind CSS v4, shadcn/ui, Zustand, OpenRouter, and n8n.
The workspace already has `openspec/` and `.atl/`; SDD should reuse the existing structure instead of bootstrapping a new one.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Create and maintain project documentation, initialize repos, and keep docs current. | continuous-project-documentation | `C:\Users\Jesús Andrés\.codex\skills\continuous-project-documentation\SKILL.md` |
| Build distinctive, production-grade frontend interfaces and UI artifacts. | frontend-design | `C:\Users\Jesús Andrés\.agents\skills\frontend-design\SKILL.md` |
| Generate or edit raster images, textures, mockups, and transparent assets. | imagegen | `C:\Users\Jesús Andrés\.codex\skills\.system\imagegen\SKILL.md` |
| Write JavaScript code in n8n Code nodes and troubleshoot node issues. | n8n-code-javascript | `C:\Users\Jesús Andrés\.claude\skills\n8n-code-javascript\SKILL.md` |
| Write Python code in n8n Code nodes and understand Python limitations. | n8n-code-python | `C:\Users\Jesús Andrés\.claude\skills\n8n-code-python\SKILL.md` |
| Validate and fix n8n expression syntax and variable access. | n8n-expression-syntax | `C:\Users\Jesús Andrés\.claude\skills\n8n-expression-syntax\SKILL.md` |
| Use n8n-mcp tools for node search, validation, templates, and workflow management. | n8n-mcp-tools-expert | `C:\Users\Jesús Andrés\.claude\skills\n8n-mcp-tools-expert\SKILL.md` |
| Configure n8n nodes and understand property dependencies. | n8n-node-configuration | `C:\Users\Jesús Andrés\.claude\skills\n8n-node-configuration\SKILL.md` |
| Interpret validation errors and fix validation warnings. | n8n-validation-expert | `C:\Users\Jesús Andrés\.claude\skills\n8n-validation-expert\SKILL.md` |
| Design n8n workflow architecture and proven automation patterns. | n8n-workflow-patterns | `C:\Users\Jesús Andrés\.claude\skills\n8n-workflow-patterns\SKILL.md` |
| Get current OpenAI API guidance with official docs and citations. | openai-docs | `C:\Users\Jesús Andrés\.codex\skills\.system\openai-docs\SKILL.md` |
| Scaffold local Codex plugins and plugin metadata. | plugin-creator | `C:\Users\Jesús Andrés\.codex\skills\.system\plugin-creator\SKILL.md` |
| Create or update skills with specialized knowledge and workflows. | skill-creator | `C:\Users\Jesús Andrés\.codex\skills\.system\skill-creator\SKILL.md` |
| Install Codex skills from curated or GitHub sources. | skill-installer | `C:\Users\Jesús Andrés\.codex\skills\.system\skill-installer\SKILL.md` |
| Build, refactor, and review Streamlit apps, state, caching, integrations, and deployment. | streamlit-best-practices | `C:\Users\Jesús Andrés\.claude\skills\streamlit-best-practices\SKILL.md` |

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| CLAUDE.md | `C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\CLAUDE.md` | Primary operating guide for the repo. Read before touching code. |
| docs/01-guia-proyecto.md | `C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\docs\01-guia-proyecto.md` | Project map and structure. |
| docs/02-bases-de-datos.md | `C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\docs\02-bases-de-datos.md` | Database state and reconnection plan. |
| docs/03-flujo-consultas.md | `C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\docs\03-flujo-consultas.md` | Commercial flow and related files. |
| docs/04-como-añadir-cosas.md | `C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\docs\04-como-añadir-cosas.md` | Recipes for common changes. |
| docs/05-buenas-practicas.md | `C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\docs\05-buenas-practicas.md` | Coding, Supabase, Tailwind, and delivery rules. |
| docs/06-estado-actual.md | `C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\docs\06-estado-actual.md` | Latest functional snapshot of the app. |
| .gitignore | `C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\.gitignore` | Ignores `.atl/`, build output, logs, env files, and local artifacts. |

## SDD Persistence

| Path | Purpose |
|------|---------|
| `C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\openspec\config.yaml` | SDD config and detected project context. |
| `C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\openspec\specs\` | Source of truth for specifications. |
| `C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\openspec\changes\` | Active change workspace. |
| `C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\openspec\changes\archive\` | Archived completed changes. |

## Current Initialization Notes

- `openspec/` already exists and is initialized; no fresh bootstrap was needed.
- The stack detected from `CLAUDE.md` and `package.json` is Next.js 16, React 19, TypeScript, Tailwind CSS v4, Supabase, shadcn/ui, Zustand, OpenRouter, and n8n.
- `CLAUDE.md` plus `docs/` are the primary project conventions.
- `.atl/` is already ignored in `.gitignore`, so the registry can live there safely.
