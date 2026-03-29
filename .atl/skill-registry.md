# Skill Registry - doa-operations-hub

Generated: 2026-03-28
Persistence: local file only

---

## User-Level Skills (`~/.codex/skills/` and `~/.agents/skills/`)

| Skill | Path | Trigger |
|-------|------|---------|
| continuous-project-documentation | `C:\Users\Jesús Andrés\.codex\skills\continuous-project-documentation\SKILL.md` | Create and maintain project documentation, handoffs, specs, and progress state across sessions |
| frontend-design | `C:\Users\Jesús Andrés\.agents\skills\frontend-design\SKILL.md` | Build web components, pages, dashboards, React components, HTML/CSS layouts, or style frontend UIs |
| n8n-code-javascript | `C:\Users\Jesús Andrés\.codex\skills\n8n-code-javascript\SKILL.md` | Write JavaScript in n8n Code nodes, use $input/$json/$node syntax, HTTP requests with $helpers, DateTime, or troubleshoot Code node errors |
| n8n-code-python | `C:\Users\Jesús Andrés\.codex\skills\n8n-code-python\SKILL.md` | Write Python in n8n Code nodes, use _input/_json/_node syntax, standard library, or understand Python limitations in n8n |
| n8n-expression-syntax | `C:\Users\Jesús Andrés\.codex\skills\n8n-expression-syntax\SKILL.md` | Validate and fix n8n expressions, use {{}} syntax, access $json/$node variables, or troubleshoot expression errors |
| n8n-mcp-tools-expert | `C:\Users\Jesús Andrés\.codex\skills\n8n-mcp-tools-expert\SKILL.md` | Use n8n-mcp tools to search nodes, validate configs, access templates, and manage workflows |
| n8n-node-configuration | `C:\Users\Jesús Andrés\.codex\skills\n8n-node-configuration\SKILL.md` | Configure n8n nodes, understand property dependencies, and determine required fields |
| n8n-validation-expert | `C:\Users\Jesús Andrés\.codex\skills\n8n-validation-expert\SKILL.md` | Interpret and fix n8n validation errors, false positives, and operator structure issues |
| n8n-workflow-patterns | `C:\Users\Jesús Andrés\.codex\skills\n8n-workflow-patterns\SKILL.md` | Design n8n workflow architecture for webhooks, HTTP APIs, database ops, AI agents, and scheduled tasks |
| sdd-apply | `C:\Users\Jesús Andrés\.codex\skills\sdd-apply\SKILL.md` | Implement tasks from a change using specs and design |
| sdd-archive | `C:\Users\Jesús Andrés\.codex\skills\sdd-archive\SKILL.md` | Sync delta specs to main specs and archive completed changes |
| sdd-design | `C:\Users\Jesús Andrés\.codex\skills\sdd-design\SKILL.md` | Create technical design documents with architecture decisions and rationale |
| sdd-explore | `C:\Users\Jesús Andrés\.codex\skills\sdd-explore\SKILL.md` | Explore and investigate ideas before committing to a change |
| sdd-init | `C:\Users\Jesús Andrés\.codex\skills\sdd-init\SKILL.md` | Initialize SDD context in a project, detect stack and conventions, and bootstrap persistence |
| sdd-propose | `C:\Users\Jesús Andrés\.codex\skills\sdd-propose\SKILL.md` | Create a change proposal with intent, scope, and approach |
| sdd-spec | `C:\Users\Jesús Andrés\.codex\skills\sdd-spec\SKILL.md` | Write specifications with requirements and scenarios |
| sdd-tasks | `C:\Users\Jesús Andrés\.codex\skills\sdd-tasks\SKILL.md` | Break down a change into an implementation task checklist |
| sdd-verify | `C:\Users\Jesús Andrés\.codex\skills\sdd-verify\SKILL.md` | Validate that implementation matches specs, design, and tasks |
| skill-registry | `C:\Users\Jesús Andrés\.codex\skills\skill-registry\SKILL.md` | Create or update the project skill registry and write `.atl/skill-registry.md` |
| streamlit-best-practices | `C:\Users\Jesús Andrés\.codex\skills\streamlit-best-practices\SKILL.md` | Create or review Streamlit apps: project structure, state, caching, Supabase integration, theming, and deployment |

### System Skills (`~/.codex/skills/.system/`)

| Skill | Path | Trigger |
|-------|------|---------|
| imagegen | `C:\Users\Jesús Andrés\.codex\skills\.system\imagegen\SKILL.md` | Generate or edit bitmap images, mockups, textures, illustrations, or raster assets |
| openai-docs | `C:\Users\Jesús Andrés\.codex\skills\.system\openai-docs\SKILL.md` | Use when working with OpenAI products or APIs and you need current official docs |
| plugin-creator | `C:\Users\Jesús Andrés\.codex\skills\.system\plugin-creator\SKILL.md` | Scaffold local plugin directories and `.codex-plugin/plugin.json` files |
| skill-creator | `C:\Users\Jesús Andrés\.codex\skills\.system\skill-creator\SKILL.md` | Create or update a skill for Codex |
| skill-installer | `C:\Users\Jesús Andrés\.codex\skills\.system\skill-installer\SKILL.md` | Install Codex skills from a curated list or a GitHub repository path |

## Project-Level Convention Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | DOA Operations Hub conventions, stack, Supabase usage, deployment, and mock data rules |
| `CLAUDE.md` | Detailed architecture, auth, route map, known bugs, and phase 2 roadmap |

## SDD Persistence

| Path | Purpose |
|------|---------|
| `openspec/config.yaml` | Project SDD configuration and rules |
| `openspec/specs/` | Specification source of truth |
| `openspec/changes/` | Active change workspace |
| `openspec/changes/archive/` | Archived completed changes |

## Shared Conventions (`~/.codex/skills/_shared/`)

| File | Purpose |
|------|---------|
| `engram-convention.md` | Topic key naming, mem_save/mem_search usage patterns |
| `openspec-convention.md` | File-based artifact structure and conventions |
| `persistence-contract.md` | Rules for when and how sub-agents read and write artifacts |
| `sdd-phase-common.md` | Shared logic across all SDD phase skills |
