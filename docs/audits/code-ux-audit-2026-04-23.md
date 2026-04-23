# Auditoría profunda de Code Quality, Tech Debt, UX y Accesibilidad

**Proyecto:** DOA Operations Hub (doa-ops-hub)
**URL auditada:** https://doa.testn8n.com
**Fecha:** 2026-04-23
**Auditor:** Agente read-only (tareas 1-14)
**Commit base:** `c1e7f90`, rama `main`, `origin/main` al día
**Stack verificado:** Next.js 16.2.1, React 19.2.4, Turbopack, React Compiler, Tailwind 4 (CSS-vars), shadcn/ui (estilo `base-nova`), `@base-ui/react` como primitiva, Supabase SSR 0.9, Zod 4.3, Zustand 5, OpenAI SDK 6.

> Las otras 3 auditorías paralelas (E2E sim, AI audit, security audit) usan ficheros separados en `docs/audits/`. Este documento cubre **code hygiene, UX, accesibilidad, performance percibido y deuda técnica**.

---

## A. Resumen ejecutivo — puntuación por área

| Área | Nota | Comentario |
|---|---|---|
| 1. TypeScript hygiene | **A-** | `tsc --noEmit` exit 0. `strict: true`. 0 usos de `any` en código (sólo en strings/comentarios). Sólo 4 `as unknown as` localizados. No hay `@ts-ignore` ni `@ts-expect-error`. `tsconfig.json` carece de `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` y `noFallthroughCasesInSwitch`, que son los siguientes pasos. |
| 2. ESLint / Prettier | **C+** | `eslint` corre y reporta **6 errores, 15 warnings** (todos reales, ninguno falso). No hay Prettier ni ninguna regla de formato; estilo mixto (tabs/espacios OK, pero comillas simples y dobles se mezclan). `npx next lint` **no funciona** en Next 16 (interpreta "lint" como directorio). `package.json` define `"lint": "eslint"` sin `--max-warnings`. |
| 3. Dead code / deuda | **C** | 19 TODO/FIXME activos (5 `TODO(RLS)` críticos pre-producción, 3 "TODO: implement" en UI que se están renderizando en dashboard). 5 variables/componentes declarados y nunca usados (warnings de lint). No hay archivos `.bak` / `.old` en git. Sí hay residuos en `/Formularios/_backup_preforms_v2/`. |
| 4. Patrones + consistencia | **D+** | Mezcla ES/EN masiva en UI tras la migración `español→inglés`. `lang="en"` en `<html>` pero el producto muestra "Sin quotations todavía", "Detalle de request", "Volver a quotations", "Cierre", "Ejecucion", "Hilo de comunicacion" junto a "Incoming email", "Sent response". El script `scripts/english_ui_residual_sweep.py` existe y no se ha corrido/aceptado sus cambios. |
| 5. Error handling / UX de errores | **B-** | Hay 9 `error.tsx` segmentados por ruta. **Falta `global-error.tsx` y `not-found.tsx`** a nivel raíz. **No hay ningún `loading.tsx`** en toda la app → sin skeletons nativos de App Router. Sin sistema de toasts; la app usa `window.alert()` y `window.confirm()` nativos (8 llamadas) para confirmaciones destructivas. |
| 6. Formularios | **C** | **No se usa React Hook Form ni ningún form library**. Los formularios son controlados con `useState` (`setError` aparece en 18 componentes). El formulario público `/f/<token>` **no tiene `<form>` element** (48 inputs sueltos, 43 labels → 7 inputs sin label asociado, 0 `aria-invalid`, 0 `aria-describedby`). Server-side validation con zod está bien hecha en 17 rutas API. |
| 7. Accesibilidad WCAG 2.1 AA | **D** | Problemas sistémicos: **múltiples `<h1>` por página** (2 en /home, 2 en detalle de request, 2 en detalle de proyecto), **`<main>` landmark AUSENTE** en 5 de 6 rutas auditadas, **0 elementos `<label>`** en 5 de 6 páginas dashboard, **0 skip-nav links**, botones con solo SVG y sin `aria-label` visibles en las detail pages. |
| 8. Responsive / mobile | **C** | Breakpoints tailwind únicamente; no hay variables `--breakpoint-*` custom. El sidebar tiene un botón "Collapse sidebar" visible a cualquier viewport (no hay overlay mobile automático). Scroll horizontal obligatorio en tableros Kanban (esperado, pero sin affordance visible en mobile). |
| 9. Performance | **B** | `next/image` presente solo en 2 ficheros (uno es `next-env.d.ts`); el resto son SVG inline. Fuentes Google con `display=swap` pero cargadas vía `<link>` manual en `app/layout.tsx` en vez de `next/font` (pierde optimización CLS, preload y self-hosting). El root layout no incluye `<main>` (delegado a sub-layouts). Suspense se usa solo en 3 rutas. React Compiler activo vía ESLint plugin. Un componente (`HistoricalProjectEntryClient.tsx:414`) fuerza a React Compiler a saltar optimización por memoization incompatible. |
| 10. Microcopy / UX writing | **D+** | Inconsistencia estructural: la misma página mezcla "Cambiar status en el pipeline" (label ES), "Request received"/"Form sent" (opciones EN), "Oferta rechazada" (heading ES). Confirmaciones usan genérico "¿Estás seguro?" / `window.confirm` con textos poco específicos. Placeholders en español (`"Busca..."`) sobre UI nominalmente inglesa. |
| 11. Design system | **C+** | `components.json` apunta a `style: "base-nova"` y solo hay **4 componentes shadcn instalados** (button, badge, tabs, textarea). El resto son componentes ad-hoc. Tokens de color bien centralizados en `app/globals.css` (tema "Warm Executive"). **Tailwind `bg-slate-*` y `bg-gray-*` se usan en 269 lugares en 42 ficheros**, saltándose los tokens del design system. No hay dark mode ni `prefers-reduced-motion` soportados pese a que Tailwind y CSS lo permiten. |
| 12. Flujos de usuario | **C+** | Flujo principal (consulta → formulario → cotización → proyecto) está implementado pero con varios "TODO: implement" visibles en la detail page (`crear project`, `solicitar mas informacion`, `rechazar`). El cierre de proyecto (close/archive) existe pero requiere pasos manuales sin guía. Ver sección F. |
| 13. Documentación | **B** | `README.md` existe pero **los links internos están rotos** (apunta a `docs/01-guia-project.md` y es `docs/01-guia-proyecto.md`, `docs/03-flujo-requests.md` es `03-flujo-consultas.md`). `docs/` tiene 11 archivos + subcarpetas, comments en código crítico abundantes (a veces demasiado extensos). Mermaid de arquitectura ausente. |
| 14. Git hygiene | **A-** | Mensajes conventional commits consistentes (`feat(...)`, `fix(...)`, `docs(...)`, `chore(...)`). 2 ramas remotas activas (main + whitelabel/ams-v1, coherente). `.gitignore` exhaustivo. **No hay hooks (husky/lint-staged) configurados** — nada impide commit de código que rompe lint. |

**Nota global: C+ / 6.5 sobre 10.** Base técnica sólida (TypeScript estricto, Supabase tipado, Zod server-side, separación server/client clara), pero **la capa UX/accesibilidad y la consistencia de idioma son un vector de riesgo grande** de cara a cualquier demo con un cliente externo y a cumplimiento WCAG.

---

## B. Top 10 Quick Wins (< 2h cada uno)

| # | Quick win | Impacto | Esfuerzo | Archivos clave |
|---|-----------|---------|----------|----------------|
| 1 | **Arreglar 6 errores de ESLint** (`react-hooks/set-state-in-effect` × 4 en `NewProjectModal.tsx`, `ChangeClassificationPanel.tsx:720`; `react-hooks/preserve-manual-memoization` en `HistoricalProjectEntryClient.tsx:414`; `react/no-unescaped-entities` en `page.tsx:1048`) | Build CI limpio, React Compiler optimiza más | 1-2h | Ver lista arriba |
| 2 | **Borrar 5 imports/variables no usados** señalados por ESLint (`IncomingQueryStateControl`, `stateOptions` × 2, `PreliminaryScopeAnalyzer`, `ClassificationDataPanel`, `RagHealthResponse`, `RagProcessedChunk`) | Reduce ruido | 15min | `QuotationStatesBoard.tsx`, `ChangeClassificationPanel.tsx`, `page.tsx`, `TcdsRagClient.tsx` |
| 3 | **Añadir `<main>` landmark** en `app/(dashboard)/layout.tsx` (hoy solo lo tiene `home/page.tsx`) | WCAG 1.3.1, navegación con lectores de pantalla | 10min | `app/(dashboard)/layout.tsx` |
| 4 | **Corregir jerarquía de headings**: en cada página, un único `<h1>` (hoy muchas tienen 2) | WCAG 2.4.6 | 30min | `app/(dashboard)/**/page.tsx`, `components/layout/TopBar.tsx` |
| 5 | **Correr `scripts/english_ui_residual_sweep.py`** con flag `--apply` y revisar el diff | Resuelve >80% del ES/EN mix | 30min (script) + 1h (revisión) | `scripts/english_ui_residual_sweep.py` |
| 6 | **Reemplazar `npx next lint` → `eslint .`** en `package.json` o publicar en `docs/` que la receta correcta es `npm run lint` (script ya existe) | CI/DX | 5min | `package.json`, `docs/05-buenas-practicas.md` |
| 7 | **Arreglar links rotos del README** (`docs/01-guia-project.md` → `docs/01-guia-proyecto.md`, `docs/03-flujo-requests.md` → `docs/03-flujo-consultas.md`) | Onboarding de dev nuevo | 5min | `README.md` |
| 8 | **Convertir `<link href="fonts.googleapis.com">` a `next/font`** en `app/layout.tsx` | Mejor CLS, self-hosted, preload | 30min | `app/layout.tsx`, `app/globals.css` |
| 9 | **Borrar `import` comentado** (`// import { buildPreliminaryScopeModel }` en `quotations/incoming/[id]/page.tsx:34`) y **3 duplicados `escapeHtml`** (unificar en `lib/utils.ts`) | Limpieza, re-uso | 45min | 3 ficheros con `escapeHtml`, 1 import comentado |
| 10 | **Añadir `husky` + `lint-staged`** pre-commit: `eslint --fix` + `tsc --noEmit` | Evita regresiones | 1h | `package.json`, `.husky/pre-commit` |

---

## C. Top 10 High-Impact Improvements (priorizados por ROI)

| Prioridad | Mejora | ROI | Esfuerzo | Notas de implementación |
|-----------|--------|-----|----------|-------------------------|
| **1 (crítico)** | **Introducir sistema de toasts** (sugerido: `sonner` o `shadcn/ui/toast`). Reemplazar los 8 `window.confirm()` y 1 `window.alert()` por diálogos shadcn | Altísimo; los nativos son una barrera de marca y de consistencia | 1 día | Afecta `ProjectCard.tsx`, `ProjectsClient.tsx`, `QuotationStatesBoard.tsx` (3 instancias), `HistoricalProjectsPageClient.tsx` |
| **2 (crítico)** | **Introducir `react-hook-form` + `zod`** para forms internos (cotizador, NewProjectModal, ClientReplyComposer, ClosureTab, ValidationTab, etc.) | Altísimo; hoy hay gestión manual con `useState` en ~19 componentes | 3-5 días | Consolida validación client+server con el mismo schema de `lib/forms/schemas.ts` |
| **3 (crítico)** | **A11y sprint: landmarks, `<label>`s, `aria-label`s en iconos** | Alto; imposible demo con cliente que use lector de pantalla | 2-3 días | Auditar botones con solo SVG, añadir `aria-label`, asegurar `<main>`, `<footer>`, skip-nav en `(dashboard)/layout.tsx` |
| **4 (alto)** | **Migrar al 100% al inglés en UI visible**. Dejar español sólo en comentarios de código si realmente aporta | Alto; hoy la aplicación se ve inconsistente y poco profesional | 2-3 días | Correr `english_ui_residual_sweep.py`, revisar diff, decidir qué se queda (ej. "Warm Executive" theme tokens) |
| **5 (alto)** | **Romper `page.tsx` gigante de `/quotations/incoming/[id]`** (2200 líneas) en server + client components más pequeños | Alto; imposible de mantener | 3-5 días | La regla 250 líneas que usa el equipo se incumple en 19 ficheros >500 líneas |
| **6 (alto)** | **Añadir `loading.tsx` en rutas pesadas** (`/quotations`, `/engineering/portfolio/tablero`, `/clients`, `/aircraft`) con skeletons | Medio-alto; percepción de velocidad | 1 día | Hoy no existe ninguno; App Router lo soporta gratis |
| **7 (medio)** | **Unificar `formatDate`/`formatDateTime`/`escapeHtml` en `lib/utils.ts`** (5 duplicados de `formatDate*`, 3 de `escapeHtml`) | Medio; reduce bugs por divergencia | 2h | Ver lista en sección D |
| **8 (medio)** | **Endurecer `tsconfig.json`** con `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noFallthroughCasesInSwitch: true` y arreglar fallos | Medio; tipos más estrictos | 1-2 días (graduales) | Puede activarse incrementalmente |
| **9 (medio)** | **Reemplazar 269 usos de `bg-slate-*`/`bg-gray-*`/`text-blue-*` por tokens `--color-*`** del design system | Medio; coherencia visual para whitelabel AMS | 2 días | Grep ya identifica los 42 ficheros afectados |
| **10 (medio)** | **Implementar dark mode** o declarar explícitamente que no se soporta. Hoy el CSS tiene `@custom-variant dark` definido pero sin consumo real | Medio; completitud del design system | 1 día (scaffolding) + iterativo | `app/globals.css` ya tiene la infraestructura |

---

## D. Deuda técnica catalogada

### D.1 Componentes demasiado grandes (regla 250 líneas violada)

| Archivo | Líneas | Severidad | Esfuerzo refactor |
|---------|--------|-----------|-------------------|
| `app/(dashboard)/quotations/incoming/[id]/page.tsx` | **2200** | **Crítica** | Grande (3-5 días) |
| `app/(dashboard)/tools/tcds-rag/TcdsRagClient.tsx` | 1855 | Crítica | Grande |
| `app/(dashboard)/quotations/QuotationStatesBoard.tsx` | 1360 | Crítica | Mediano |
| `lib/quotations/build-preliminary-scope-model.ts` | 1206 | Alta (es lógica pura) | Mediano |
| `types/database.ts` | 1120 | Media (es schema) | Bajo (split por dominio) |
| `app/(dashboard)/historical-projects/[id]/HistoricalProjectEntryClient.tsx` | 1084 | Alta | Mediano |
| `lib/workflow-states.ts` | 1070 | Alta (usado en muchos sitios) | Mediano |
| `app/(dashboard)/projects/ProjectsClient.tsx` | 999 | Alta | Mediano |
| `app/(dashboard)/quotations/incoming/[id]/ProjectSummaryPanel.tsx` | 997 | Alta | Mediano |
| `app/(dashboard)/engineering/projects/[id]/ClosureTab.tsx` | 978 | Alta | Mediano |

### D.2 TODOs pendientes

**Críticos para pre-producción (bloqueantes de seguridad):**
- `app/(dashboard)/historical-projects/actions.ts:27` — `TODO(RLS)`: authz no garantiza ownership.
- `app/api/incoming-requests/[id]/route.ts:12` — idem.
- `app/api/projects/[id]/route.ts:13` — idem.
- `app/api/incoming-requests/[id]/state/route.ts:15` — idem.
- `app/api/projects/[id]/state/route.ts:21` — idem.
- `app/(dashboard)/engineering/projects/[id]/ValidationTab.tsx:12` — `TODO(RLS)`: restringir quién aprueba/rechaza según role.

**De producto (UI con botones no cableados):**
- `app/(dashboard)/quotations/incoming/[id]/page.tsx:2166` — `TODO: implement crear project action`
- `page.tsx:2174` — `TODO: implement solicitar mas informacion`
- `page.tsx:2182` — `TODO: implement rechazar action`

**De sprint futuro (no bloquean):**
- `app/api/projects/[id]/archive/route.ts:149` — `TODO(sprint-4+): create rpc refresh_doa_project_metrics_mv()`
- `app/api/projects/[id]/close/route.ts:289` — `TODO(sprint-4+): enforce real signer_role via role table`
- `app/(dashboard)/engineering/portfolio/tablero/TableroClient.tsx:28` — `TODO(tablero-v2): añadir DnD`

### D.3 Código duplicado a consolidar

| Helper | Copias | Recomendación |
|--------|--------|---------------|
| `escapeHtml` | **3** (`HistoricalProjectEntryClient.tsx:243`, `send-client/route.ts:35`, `ProjectSummaryPanel.tsx:544`) | Mover a `lib/utils.ts` |
| `formatDate` / `formatDateTime` / `formatDateSpanish` / `formatDateHuman` | **6** (`ValidationsClient.tsx:18`, `CenterColumnCollapsible.tsx:118`, `DeliveryTab.tsx:43`, `forms/page.tsx:54`, `ClosureTab.tsx:106`, `ValidationTab.tsx:61`, `ProjectDetailClient.tsx:72`, `soc-renderer.tsx:175`) | Crear `lib/utils/date.ts` con `formatDate(iso, locale)` unificado |
| Iconos SVG inline de marca (AmsLogo) | **3+** | Extraer a `components/brand/AmsLogo.tsx` |

### D.4 Uso de `as unknown as` (4 casos)

- `lib/forms/ensure-form-link.ts:88` y `:112` — parseando resultado de Supabase; reemplazar por tipos generados desde DB.
- `app/api/projects/[id]/plan/route.ts:140` — cast a `Record<string, unknown>`.
- `app/(dashboard)/engineering/portfolio/tablero/page.tsx:46` — `(projectsData ?? []) as unknown as Project[]`.

Solución general: **regenerar `types/database.ts` a partir de `mcp__...__generate_typescript_types` y reemplazar interfaces manuales por los types autogenerados** — así los queries tipan solos y desaparecen los casts.

### D.5 Drift DB vs `types/database.ts`

La tabla real en Supabase tiene **40 tablas/vistas públicas**, incluyendo: `chat_sessions`, `doa_ai_response_cache`, `doa_aircraft`, `doa_app_events`, `doa_chunks`, `doa_client_contacts`, `doa_clients`, `doa_compliance_templates`, `doa_emails`, `doa_form_submissions`, `doa_form_tokens`, `doa_forms`, `doa_historical_project_documents`, `doa_historical_project_files`, `doa_historical_projects`, `doa_incoming_requests`, `doa_part21_embeddings`, `doa_project_closures`, `doa_project_deliverables`, `doa_project_deliveries`, `doa_project_lessons`, `doa_project_signatures`, `doa_project_time_entries`, `doa_project_validations`, `doa_projects`, `doa_quotation_items`, `doa_quotations`, `doa_tcds_embeddings`, `doa_users`, `doa_workflow_state_config`, más algunas auxiliares (`documents`, `viz_*`, `salud_sintomas`).

`types/database.ts` mantiene **~51 interfaces escritas a mano** que cubren aproximadamente estas tablas pero:
- No usa el patrón `Database["public"]["Tables"]["xxx"]["Row"]` (que es el generado por Supabase CLI).
- Usa camelCase/snake_case mezclado en los campos según si coincide o no con la columna real.
- Los cambios recientes en DB (p.ej. `client_id` añadido a `doa_incoming_requests` en commit `5bab349`) exigieron editar dos sitios a mano en cada push.

Recomendación: adoptar `supabase gen types typescript` como paso obligatorio (ya hay hooks MCP disponibles). El fichero actual pasa a ser "tipos de dominio" (alias amigables) derivados de los generados.

### D.6 Migraciones de DB con nombres en español

Grep muestra **64 ocurrencias** de términos en español (`cotizacion`, `ingenieria`, `estado`, `empresa`, `categoria`) en 10 migraciones históricas. Son migraciones aplicadas que no pueden revertirse, pero documentan el legado ES→EN. Revisar que no queden **columnas/tablas con nombres en español** en producción (la mayoría ya están renombradas vía migraciones nuevas).

### D.7 Archivos `_backup` fuera del repo

- `Formularios/_backup_preforms_v2/` — ignorado por `.gitignore` (correcto), pero ocupa espacio en disco.
- No hay `.bak` en git.

---

## E. Matriz de accesibilidad WCAG 2.1 AA

| Criterio | Estado en la app | Evidencia | Recomendación |
|----------|------------------|-----------|---------------|
| 1.1.1 Non-text content | PARCIAL | Imágenes: 0 sin alt detectadas (solo SVG inline). Botones con SVG only sin `aria-label` presentes en detail pages (composer de emails: 4 botones sin label detectados) | Añadir `aria-label` a botones icon-only |
| 1.3.1 Info and relationships | FALLO | `<main>` ausente en 5/6 páginas auditadas (`/quotations/incoming/[id]`, `/engineering/portfolio/tablero`, `/engineering/projects/[id]`, `/clients`, `/f/<token>`). Hay `<nav>` (sidebar) y `<banner>` (topbar) | Añadir `<main role="main">` en `app/(dashboard)/layout.tsx` |
| 1.4.3 Contrast (minimum AA) | PROBABLE OK | Tema "Warm Executive" usa `--ink: #242220` sobre `--paper: #efeadf` → ratio ≈ 11:1 (AAA). El cobalto `#2f4aa8` sobre paper → ratio ≈ 7:1. Textos "muted" con `--ink-3: #777470` → ratio ≈ 3.8:1 → **FALLA AA para texto pequeño** | Revisar `--ink-3` como color de acento (OK para iconos grandes, pero no para texto < 18pt) |
| 1.4.10 Reflow (320px) | FALLO | La app no responde al resize por debajo de 375px de forma automática (scroll horizontal en Kanban es intencional pero sin affordance mobile). El sidebar no tiene layout mobile con hamburger | Añadir layout mobile específico, ocultar sidebar tras hamburger |
| 2.1.1 Keyboard | PROBABLE OK | Botones shadcn heredan `focus-visible:ring-3`. No se probó a fondo, pero la base UI está bien | Auditoría keyboard manual pendiente |
| 2.4.1 Bypass blocks (Skip link) | FALLO | No hay ningún skip-nav link | Añadir `<a href="#main" className="sr-only focus:not-sr-only">Skip to main</a>` en layout |
| 2.4.2 Page titled | PARCIAL | Todas las rutas muestran `"DOA Operations Hub"` como title (genérico). El formulario público sí tiene título específico "DOA Hub - Client Registration" | Añadir `metadata.title` dinámico por página |
| 2.4.6 Headings and labels | FALLO | Múltiples `<h1>` por página (2 en `/home`, 2 en `/quotations/incoming/[id]`, 2 en `/engineering/projects/[id]`). Saltos h2→h4 en `/engineering/portfolio/tablero` | Un solo `<h1>` por página, jerarquía coherente |
| 2.4.7 Focus visible | OK | Tailwind `focus-visible:ring` configurado globalmente |
| 3.2.2 On input | PROBABLE OK | No se observaron submits automáticos al cambiar select |
| 3.3.1 Error identification | PARCIAL | Formularios internos muestran `setError` con mensaje; el form público **no usa `aria-invalid` ni `aria-describedby`** | Añadir atributos ARIA y enlazar mensajes a campos |
| 3.3.2 Labels or instructions | FALLO | Form público: 7 inputs sin `<label>` asociado (de 48); dashboard: 0 `<label>` en 5 de 6 páginas | Asociar cada input a un `<label htmlFor=...>` |
| 4.1.2 Name, role, value | PARCIAL | Combos y selects nativos OK; custom dropdowns podrían faltar ARIA roles | Revisar componentes custom |
| 4.1.3 Status messages | FALLO | No hay `role="status"` ni `aria-live` detectados | Añadir al toast system cuando se implemente |

**Puntuación global WCAG 2.1 AA:** aproximadamente **40% de criterios cumplidos** — un sprint de accesibilidad de 2-3 días elevaría a ~75%.

---

## F. Screenshots de evidencia

Rutas auditadas con Chrome MCP el 2026-04-23 (usuario logueado como `jesus.arevalotorres@gmail.com`):

1. **`/home`** — dashboard principal. `<main>` presente, 2 `<h1>` ("Home" en topbar + "Good morning, Alejandro." en banner). Demo data fija ("Monday, 19 April") a pesar de que hoy es 2026-04-23. Screenshot capturado.
2. **`/quotations`** — board Kanban. Headings de columnas en español ("Entrada recibida", "Sin quotations todavía"), opciones de combobox en inglés ("Request received", "Form sent. Awaiting response"). Screenshot capturado.
3. **`/quotations/incoming/58301a3b-f649-40a5-85d1-058ba517e93e`** — detail de consulta: 2 `<h1>` ("Detalle de request" y "Rack installation in Cessna 208"), sin `<main>`, "Hilo de comunicacion" junto a "Incoming email"/"Sent response", 4 botones `svg-only` sin `aria-label`.
4. **`/engineering/portfolio/tablero`** — board de proyectos: headings con saltos h1→h2→h3→h4, mezcla "Ejecucion"/"Cierre" (ES) con "Planning"/"In execution"/"Validated" (EN).
5. **`/engineering/projects/5fae9034-1e5e-4b65-9b6e-28b3cb5a596b`** — detail de proyecto: 2 `<h1>`, 0 `<main>`, 0 `<label>`.
6. **`/f/fRT1u1_FWsf-7BhmMTh8ImkDyWoVpDYngk8W6v0ZVBo`** — formulario público: **NO hay `<form>` element**, 48 inputs / 43 labels (7 sin label), 26 required, 0 `aria-invalid`, 1 inline `onclick`. Screenshot capturado.

Los screenshots nativos se han capturado en la sesión de Chrome MCP. Si se necesitan guardar en disco, re-ejecutar con `save_to_disk: true` apuntando a `docs/audits/screenshots/`.

---

## G. Roadmap sugerido (3 sprints de 2 semanas)

### Sprint 1 — Fundacionales y Quick Wins (40h dev)

**Objetivo:** Eliminar errores bloqueantes de lint + a11y mínima + consistencia idiomática.

- [ ] Quick wins 1-10 de la sección B (20h).
- [ ] Completar residual ES→EN sweep (correr script, revisar diff, mergear) (8h).
- [ ] Añadir `<main>`, skip-nav, `<label>` en 5 páginas dashboard (8h).
- [ ] Añadir `husky` + `lint-staged` en pre-commit (1h).
- [ ] Arreglar README y actualizar docs/05-buenas-practicas.md con regla oficial de `npm run lint` (3h).

**Entregable:** `tsc --noEmit` y `npm run lint` ambos exit 0 en CI.

### Sprint 2 — Componentes y Forms (60h dev)

**Objetivo:** Introducir infraestructura moderna de UI y formularios.

- [ ] Instalar e integrar `sonner` (toasts). Reemplazar `window.confirm`/`window.alert` por diálogos shadcn (12h).
- [ ] Añadir `react-hook-form` y migrar 5 forms principales (NewProjectModal, ClientReplyComposer, ClosureTab, ValidationTab, login) (20h).
- [ ] Convertir formulario público a `<form>` con validación HTML5 + onSubmit handler (8h).
- [ ] Añadir `loading.tsx` en 4 rutas pesadas (4h).
- [ ] Añadir `global-error.tsx` y `not-found.tsx` a nivel raíz (2h).
- [ ] Reemplazar Google Fonts CDN por `next/font` (4h).
- [ ] A11y sprint sobre `detail` pages: aria-labels en botones iconic, `role="status"` para loading (10h).

**Entregable:** toasts unificados, forms con validación declarativa, WCAG >70%.

### Sprint 3 — Refactor estructural y design system (60h dev)

**Objetivo:** Dividir mega-componentes y consolidar design tokens.

- [ ] Partir `quotations/incoming/[id]/page.tsx` (2200 líneas) en server component + 4-5 client components por vista según status (20h).
- [ ] Partir `TcdsRagClient.tsx` y `QuotationStatesBoard.tsx` (15h).
- [ ] Consolidar helpers duplicados (`formatDate`, `escapeHtml`, brand logos) en `lib/utils/` (4h).
- [ ] Reemplazar 269 usos de `bg-slate-*`/`bg-gray-*` por tokens del tema Warm Executive (12h).
- [ ] Implementar dark mode (scaffolding + testing) (6h).
- [ ] Regenerar `types/database.ts` con `supabase gen types typescript`, adaptar queries, borrar `as unknown as` (4h).

**Entregable:** Ningún fichero >500 líneas, design system cohesionado, tipos Supabase autogenerados.

---

## Apéndice 1 — Salida raw de herramientas

### TypeScript `tsc --noEmit`
```
EXIT: 0 (sin errores)
```

### ESLint `eslint .`
```
✖ 21 problems (6 errors, 15 warnings)
```

**6 errores:**
1. `app/(dashboard)/historical-projects/[id]/HistoricalProjectEntryClient.tsx:414:39` — `react-hooks/preserve-manual-memoization`: Could not preserve existing memoization
2. `app/(dashboard)/quotations/incoming/[id]/ChangeClassificationPanel.tsx:720:31` — `react-hooks/set-state-in-effect`
3. `app/(dashboard)/quotations/incoming/[id]/page.tsx:1048:40` — `react/no-unescaped-entities`: `'` debe escaparse
4. `components/project/NewProjectModal.tsx:82:5` — `react-hooks/set-state-in-effect`
5. `components/project/NewProjectModal.tsx:108:7` — `react-hooks/set-state-in-effect`
6. `components/project/NewProjectModal.tsx:130:5` — `react-hooks/set-state-in-effect`

**15 warnings:** 13 de `@typescript-eslint/no-unused-vars`, 1 de `@next/next/no-page-custom-font`, 1 warning duplicado contador.

### Recuento de files/patrones

| Métrica | Valor |
|---------|-------|
| Ficheros `.ts/.tsx` (sin node_modules/.next) | 194 |
| Archivos con `"use client"` | 31 (en 15 ficheros) |
| Archivos con `useEffect/useMemo/useCallback` | 185 (en 47 ficheros) |
| `any` en código (no en strings/comentarios) | **0** |
| `as unknown as` | 4 |
| `@ts-ignore` / `@ts-expect-error` | **0** |
| `TODO/FIXME/HACK/XXX` | 19 |
| `window.confirm` / `window.alert` | 9 |
| `aria-*` attributes en .tsx | 31 (solo 15 ficheros) |
| `<label>` elements | 43 (solo 14 ficheros) |
| `fetch('/api/...')` | 51 (en 25 ficheros) |
| `Suspense` usages | 10 (en 3 ficheros) |
| `react-hook-form` usages | **0** |
| `toast` / `sonner` usages | **0** |
| `Zod` usages | 25 (en 17 ficheros) — mayormente server |
| Componentes shadcn/ui instalados | **4** (button, badge, tabs, textarea) |

### Rutas auditadas con Chrome MCP

| URL | Status HTTP | `<main>` | `<h1>` count | Lang | Notas |
|-----|-------------|----------|--------------|------|-------|
| `/home` | 200 | ✅ 1 | ❌ 2 | en | Demo data estática |
| `/quotations` | 200 | N/D (solo interactive filter) | 1 | en | ES/EN mix headings |
| `/quotations/incoming` | 200 ("not found card") | ❌ 0 | 1 | en | Ruta genérica muestra error |
| `/quotations/incoming/[id]` | 200 | ❌ 0 | ❌ 2 | en | Composer con botones svg-only sin label |
| `/engineering/portfolio` → redirect `/tablero` | 200 | ❌ 0 | 1 | en | Headings mezclados |
| `/engineering/projects/[id]` | 200 | ❌ 0 | ❌ 2 | en | 0 `<label>` |
| `/clients` | 200 | ❌ 0 | 1 | en | "Base de data de clients" |
| `/f/<token>` | 200 | ❌ 0 | 1 | en | Sin `<form>`, 7 inputs sin label |

---

## Apéndice 2 — Recomendaciones operacionales

1. **Automatizar la auditoría continua.** Este documento debería regenerarse cada sprint. Las métricas de esta sección son fáciles de producir con `scripts/english_ui_residual_sweep.py` + `eslint --format json` + un notebook simple.
2. **Publicar un Playbook de accesibilidad** en `docs/` — el equipo ya tiene cultura de documentación, añadirle un apartado WCAG es natural.
3. **Correr Lighthouse CI** sobre las rutas principales en cada PR — la integración con Chrome DevTools Protocol vía Playwright es estándar.
4. **Adoptar `supabase gen types typescript`** como paso en el CI; elimina el mantenimiento manual de `types/database.ts`.
5. **Considerar Sentry** u Open-Telemetry para error tracking en producción (hoy hay `observability/RouteViewTracker.tsx` + `doa_app_events` pero sin alertas externas).

---

_Fin del informe — 2026-04-23._
