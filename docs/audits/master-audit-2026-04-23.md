# Master Audit — Consolidación de Auditorías 2026-04-23

**Proyecto:** DOA Operations Hub (doa-ops-hub)
**Fecha de consolidación:** 2026-04-23
**Rama:** `main`
**Auditor consolidador:** Agente de síntesis (read-only de los 4 documentos fuente)

**Fuentes consolidadas:**
1. `docs/audits/code-ux-audit-2026-04-23.md` (commit `281ce44`) — Code quality, tech debt, UX, A11y
2. `docs/audits/security-correctness-audit-2026-04-23.md` (commit `5387210`, 864 líneas) — Seguridad + correctitud
3. `docs/audits/ai-audit-2026-04-23.md` (commit `87800a6`, 1036 líneas) — Capa de IA
4. `docs/simulation-end-to-end-2026-04-23.md` (commit `91f4db6`, 233 líneas) — E2E gap report Part 21J

---

## 1. Resumen ejecutivo (veredicto de readiness)

**Veredicto global: NO APTO para onboarding de clientes externos sin Sprint 0.** La aplicación tiene una base técnica sólida (Next.js 16 estricto, Supabase SSR correcto, HMAC bien implementado, prompts de copilotos G12-01/G12-17 de calidad aeronáutica A/B+) pero arrastra cuatro bloqueantes que, combinados, convierten el producto en un riesgo de reputación y cumplimiento:

1. **17 tablas públicas sin RLS** (H1 security): cualquier JWT autenticado lee/borra/modifica cualquier fila. Es la vulnerabilidad más grave y es explotable hoy mismo vía el `DELETE /api/incoming-requests/[id]` sin ownership (H3).
2. **Cero tests ni CI** (H2 security): cualquier regresión sale a producción sin alerta. Habilita todas las demás regresiones.
3. **La app es agnóstica de Part 21J** (E2E GAP-12): no modela Certification Basis, CRIs, Calculations, EASA correspondence. Un ingeniero puede "cerrar" un proyecto sin el Structural Analysis (el único MoC real del caso 20884). Sumado a **1 solo auth user = DOH+DOS firmando como la misma persona** (GAP-16), un auditor EASA rechaza directamente.
4. **3 bugs críticos de IA en producción** (AI P1.2/P2.1/P3.1): clasificador de correos con `temperature` sin fijar (no-determinista), marker literal frágil `[Acceder al formulario del proyecto]` que si el LLM traduce rompe el envío de link al cliente, y el placeholder `info@gmail.com` visible al cliente en respuestas off-topic.

**Top 5 riesgos ordenados por severidad × explotabilidad:**

| # | Riesgo | Severidad | Fuente |
|---|--------|-----------|--------|
| 1 | RLS off en 17 tablas + DELETE sin ownership → pérdida/fuga masiva de datos | P0 | Security H1 + H3 |
| 2 | Sin tests ni CI → imposible validar cualquier fix | P0 | Security H2 |
| 3 | Cumplimiento Part 21J imposible (GAP-12 entidades + GAP-16 identidad DOH/DOS) | P0 | E2E GAP-12/16 |
| 4 | Bugs de IA visibles al cliente (marker frágil + info@gmail.com + clasificador no-determinista) | P0 | AI P2.1/P3.1/P1.2 |
| 5 | HTTP security headers ausentes + Next 16.2.2 con GHSA-q4gf-8mx6-v5v3 | P1 | Security H4 + D1 (ya parcheado parcialmente en 91e6188) |

**Lo que funciona bien:** arquitectura Next.js 16 con `proxy.ts`, HMAC outbound, Zod en la superficie pública, prompts de semantic chunker (A+), FSM de 13 estados bien ejecutada, handshakes n8n firmados, Supabase SSR + service-role bien separados.

**Recomendación:** ejecutar Sprint 0 (todos los auto-fixables de abajo) antes de exponer la URL a cualquier cliente nuevo. Luego Sprint 1 (decisiones críticas de arquitectura) y Sprint 2 (refactor + cobertura).

---

## 2. Matriz deduplicada de hallazgos

Leyenda: **P0**=bloqueante, **P1**=alto, **P2**=medio. Esfuerzo: **S**=<1d, **M**=1-3d, **L**=4d+. ROI = impacto / esfuerzo (Alto/Medio/Bajo). AF = auto-fixable. DR = decision-required.

| ID | Sev | Área | Título | Impacto | Esfuerzo | ROI | Fuente(s) | Tipo |
|----|-----|------|--------|---------|----------|-----|-----------|------|
| M01 | **P0** | Security/DB | 17 tablas public sin RLS | Lectura/escritura/borrado masivo por cualquier JWT | L | Alto | Security H1 | **DR** |
| M02 | **P0** | AuthZ | DELETE `/incoming-requests/[id]` sin ownership | Borrado masivo de datos ajenos cascadeando | M | Alto | Security H3 + Code-UX D.2 (TODO(RLS)) | **DR** (requiere modelo de ownership) |
| M03 | **P0** | QA | Sin tests ni CI (`npm test` no existe) | Toda regresión va a prod sin alerta | L | Alto | Security H2 | **DR** (elegir stack: Vitest+Playwright vs Jest) |
| M04 | **P0** | Part 21J | No existen entidades: Certification Basis, CRIs, Calculations, EASA correspondence | App no puede producir dossier Part 21J | L | Alto | E2E GAP-12 | **DR** |
| M05 | **P0** | Part 21J | 1 auth user = DOH+DOS firmando como misma persona; no hay tabla de roles | Rechazo directo en auditoría EASA (21.A.245) | M | Alto | E2E GAP-16 + GAP-18/23 + Code-UX D.2 | **DR** |
| M06 | **P0** | Forms | `clientBlockSchema.customer_type` acepta strings libres, DB exige enum → 500 silencioso | Usuarios abandonan formulario sin feedback | S | Alto | E2E GAP-06 + Code-UX B.6 | **AF** |
| M07 | **P0** | IA | Clasificador emails n8n sin `temperature` (default ~1.0, no-determinista) | Mismo email clasificado distinto entre reintentos | S | Alto | AI P1.2 | **AF** |
| M08 | **P0** | IA | Writer usa marker literal `[Acceder al formulario del proyecto]`; si LLM traduce, link se pierde | Cliente recibe email sin link al formulario | S | Alto | AI P2.1 | **AF** |
| M09 | **P0** | IA | Placeholder `info@gmail.com` hardcoded en writer off-topic → llega al cliente real | Bug visible de imagen | S | Alto | AI P3.1 | **AF** |
| M10 | **P1** | Infra | HTTP security headers ausentes + `X-Powered-By: Next.js` | Clickjacking, MIME sniff, downgrade TLS | S | Alto | Security H4 | **AF** (ya parcheado 91e6188) |
| M11 | **P1** | Deps | Next.js 16.2.2 vulnerable a GHSA-q4gf-8mx6-v5v3 (CVSS 7.5 DoS) | DoS vía Server Components | S | Alto | Security D1 | **AF** |
| M12 | **P1** | Webhook | `requireWebhookSignature` fail-open si env var ausente | Webhooks aceptados sin firma | S | Alto | Security S1 | **AF** (ya parcheado d6ed649) |
| M13 | **P1** | DB | CHECK constraints bilingües (es/en) en 6 tablas | Estado con duplicados semánticos; queries pierden filas | M | Alto | Security C1 + E2E GAP-14/17/19/21 | **AF** |
| M14 | **P1** | IA | `bodyPreview` trunca a 255 chars → pierde contexto | Clasificador + writer con email incompleto | S | Alto | AI P1.3 + P2.5 | **AF** |
| M15 | **P1** | Part 21J | Estructura Drive app (6 dirs) ≠ estándar EASA real (5 dirs) | Toda carpetería futura diverge del estándar industrial | M | Alto | E2E GAP-02 | **DR** |
| M16 | **P1** | Part 21J | `doa_historical_projects` vacío → numeración fresh en vez de continuar legacy | Números nuevos no se alinean con 20884 legacy | M | Medio | E2E GAP-03 + GAP-10 + GAP-25 | **DR** |
| M17 | **P1** | Part 21J | No hay workflow de aceptación formal de quote (firma cliente, PO, fecha) | Sin evidencia legal de aceptación | M | Medio | E2E GAP-09 | **DR** |
| M18 | **P1** | DB | `doa_quotations` sin `client_id`, `currency`, `po_number`, `is_demo` | Sin PO no hay paper-trail; currency asumido EUR | S | Alto | E2E GAP-08 | **AF** |
| M19 | **P1** | DB | Sin workflow archive → historical (`doa_projects` no migra a `doa_historical_projects`) | GAP-03 nunca se resuelve sin esta pieza | M | Medio | E2E GAP-22 | **DR** |
| M20 | **P1** | Part 21J | No hay tabla captura interacción EASA (forms 21.A.95, respuestas) | Obligatorio en MAJOR changes | M | Medio | E2E GAP-26 | **DR** |
| M21 | **P1** | IA | Rate limit ausente en `/api/tools/chat` + endpoints AI | Usuario malicioso drena presupuesto OpenRouter | M | Alto | AI §9.2 + Security §1.3 | **DR** (Upstash vs tabla Supabase) |
| M22 | **P1** | IA | Sin defensa anti-prompt-injection en 5 rutas analyze | `additional_notes` malicioso manipula salida | M | Medio | AI §9.1 + P1.6 | **AF** |
| M23 | **P1** | UX/A11y | A11y sistémica: `<main>` ausente 5/6, múltiples `<h1>`, 0 `<label>` en 5/6 dashboards, form público sin `<form>` | Imposible demo con lectores; ~40% WCAG 2.1 AA | L | Medio | Code-UX §E + §F | **AF** (sprint dedicado) |
| M24 | **P1** | UX | Mezcla ES/EN tras migración incompleta; `english_ui_residual_sweep.py` no corrido | UI incoherente | S | Alto | Code-UX §A.4 + §B.5 | **AF** |
| M25 | **P1** | UX | `window.confirm`/`window.alert` nativos en 9 lugares | Barrera de marca, inconsistente | M | Medio | Code-UX §A.5 + §C.1 | **AF** |
| M26 | **P1** | Forms | Sin React Hook Form; 19 componentes con `useState` manual; 0 `aria-invalid` | Gestión frágil; sin validación declarativa | L | Medio | Code-UX §A.6 + §C.2 | **DR** (elegir lib de forms) |
| M27 | **P1** | Refactor | Ficheros gigantes: `page.tsx` quotations (2200), `TcdsRagClient.tsx` (1855), `QuotationStatesBoard.tsx` (1360); 19 ficheros >500 líneas | Imposible de mantener | L | Medio | Code-UX §D.1 | **AF** |
| M28 | **P1** | ESLint | 6 errores + 15 warnings activos | CI roto, React Compiler pierde optimizaciones | S | Alto | Code-UX §A.2 + Apéndice 1 | **AF** |
| M29 | **P1** | Deps transitivas | 7 vulns npm (3 high): path-to-regexp ReDoS, picomatch ReDoS, dompurify bypass | ReDoS + bypass sanitización | S | Medio | Security §13.1 | **AF** |
| M30 | **P1** | Storage | 8 buckets Supabase `public=true` | Objetos con path conocido descargables sin auth | S | Medio | Security C3 + §15.1 | **DR** |
| M31 | **P1** | Concurrencia | Sin Idempotency-Key en `open-project`, `send-client`, `send-delivery`, `validate` | Doble clic = doble proyecto/email/carpeta | M | Medio | Security C4 + §6.1 | **AF** |
| M32 | **P1** | Observabilidad | Cero logging de tokens/coste/latencia LLM por ruta | Imposible detectar spike de coste o fallo | M | Medio | AI §10.2 + Security §10 | **AF** (`doa_ai_events`) |
| M33 | **P2** | DB | 2 funciones SECURITY DEFINER sin `SET search_path`; 153 totales | Search-path hijacking potencial | S | Medio | Security C2 + §9.2 | **AF** |
| M34 | **P2** | DB | `doa_ai_response_cache`, `doa_app_events`, `doa_form_tokens` con RLS on + 0 policies | Deny-all involuntario | S | Medio | Security C7 + §2.2 | **AF** |
| M35 | **P2** | DB | `doa_clients` sin `updated_at`; `doa_form_tokens` sin `created_by` | Trazabilidad nominal (Part 21J) | S | Medio | Security B2 + C8 | **AF** |
| M36 | **P2** | DB | `is_demo` ausente en 9 tablas | Imposible filtrar demo vs real | S | Alto | E2E GAP-01/07/15 | **AF** |
| M37 | **P2** | Code hygiene | `escapeHtml` × 3, `formatDate*` × 6; 4 casts `as unknown as`; `types/database.ts` escrito a mano | Bugs por divergencia | M | Medio | Code-UX §D.3/4/5 | **AF** |
| M38 | **P2** | Docs | README con links rotos | Onboarding dev nuevo roto | S | Alto | Code-UX §A.13 + §B.7 | **AF** |
| M39 | **P2** | Git | Sin husky/lint-staged pre-commit | Regresiones triviales | S | Alto | Code-UX §A.14 + §B.10 | **AF** |
| M40 | **P2** | IA | Solo 3 categorías clasificador; sin thread continuity `In-Reply-To` | Duplicación operativa, clasificaciones falsas | M | Medio | AI §3.1/3.2 + P1.1/P1.7 | **AF** |
| M41 | **P2** | UX | Sin `loading.tsx`, `global-error.tsx`, `not-found.tsx` raíz | Sin skeletons App Router | S | Medio | Code-UX §A.5 | **AF** |
| M42 | **P2** | Infra | Dockerfile sin HEALTHCHECK | Swarm no sabe si app vive | S | Medio | Security C10 | **AF** |
| M43 | **P2** | Deploy | `ssh StrictHostKeyChecking=no` → MITM first-connect | Vector MITM primer despliegue | S | Medio | Security X1 | **AF** |
| M44 | **P2** | IA | Sin fallback LLM (OpenRouter → OpenAI → Anthropic) | SPOF del proveedor de modelos | M | Medio | AI §9.3 | **DR** |
| M45 | **P2** | IA | 2 índices paralelos: `doa_project_embeddings` (Supabase+OpenAI) vs `doa-precedentes` (Pinecone) | Drift; confusión consumidores | M | Medio | AI §1.2 + §7.1 | **DR** |
| M46 | **P2** | DB zombies | `chat_history`, `salud_sintomas`, `DocumentacionCertificacion` con RLS off | GDPR potencial | S | Medio | Security C11 | **DR** |
| M47 | **P2** | Design system | 269 usos `bg-slate-*`/`bg-gray-*` en 42 ficheros ignoran tokens Warm Executive | Incoherencia visual para whitelabel AMS | M | Medio | Code-UX §A.11 + §C.9 | **AF** |
| M48 | **P2** | Validación | Zod solo cubre 2 rutas de ~53 | Superficie de bug; DoS vía JSON bogus | M | Medio | Security C6 | **AF** |
| M49 | **P2** | Part 21J | No hay UI para subir/versionar .docx/.pdf de deliverables | Docs viven en Drive fuera de la app | M | Medio | E2E GAP-24 | **DR** |

**Totales:** 49 hallazgos únicos. **Auto-fixables: 32**. **Decision-required: 17**.

---

## 3. Patrones cruz-auditoría (findings en 2+ fuentes)

Los siguientes root-causes aparecen en múltiples auditorías — señal de que el fix es de alto leverage:

| Patrón | Fuentes | Hallazgos consolidados |
|--------|---------|-------------------------|
| **P-RLS**: Falta de ownership + RLS off es la raíz de H1, H3 y los 5 `TODO(RLS)` críticos | Security H1/H3 + Code-UX D.2 TODO(RLS) × 5 | M01, M02 |
| **P-BILINGUAL**: CHECK constraints en 2 idiomas (drift migración ES→EN) | Security C1 + E2E GAP-14/17/19/21 + Code-UX D.6 | M13 |
| **P-NUMBERING**: Sequencing falso sin historical backfill | E2E GAP-03 + GAP-10 + GAP-22 + GAP-25 | M16, M19 |
| **P-PART21J**: App agnóstica de Part 21J (no modela basis, roles, CRIs) | E2E GAP-12 + GAP-16 + GAP-18 + GAP-23 + Code-UX TODO(RLS) en ValidationTab | M04, M05, M20 |
| **P-IA-FRAGILE**: 3 bugs de IA visibles al cliente (marker, placeholder email, temperature) | AI P1.2/P2.1/P3.1 | M07, M08, M09 |
| **P-A11Y**: Sin `<main>`, múltiples `<h1>`, sin `<label>`, sin `<form>` en ruta pública | Code-UX §E matriz WCAG + §F screenshots | M23 |
| **P-IS-DEMO**: Columna `is_demo` ausente en múltiples tablas | E2E GAP-01/07/15 + Security §15 | M36 |
| **P-OBSERVABILITY**: Sin alertas, sin tokens logueados, `console.error` en stdout | Security C9 + §15.7 + AI §10.2 | M32 |
| **P-RATE-LIMIT**: Endpoints IA caros sin rate limiting | Security §1.3 + AI §9.2 | M21 |
| **P-PROMPT-INJECTION**: Input cliente concatenado al prompt sin sanitizer | AI §9.1 + P1.6 | M22 |

---

## 4. Decision bundle (10 decisiones que bloquean Sprint 0/1)

Estas son las decisiones yes/no o A/B/C que requieren input del usuario **antes** de ejecutar fixes estructurales, ordenadas por bloqueo de dependencias.

| # | Decisión | Opciones | Impacto |
|---|----------|----------|---------|
| **D1** | Modelo de ownership en `doa_incoming_requests` y tablas derivadas (pre-requisito RLS) | **A)** Columna `owner_user_id` por fila; **B)** Tabla de roles `doa_users.role` + policies por rol; **C)** Híbrido (owner + admin override) | Desbloquea M01, M02, M05 |
| **D2** | Stack de testing | **A)** Vitest (unit) + Playwright (E2E); **B)** Jest + Cypress; **C)** Solo Vitest + Supertest inicialmente | Desbloquea M03; define CI y gate de deploy |
| **D3** | Modelado Part 21J: crear entidades dedicadas ahora o deferred | **A)** Crear Sprint 1 (3 días): `doa_project_certification_basis`, `doa_project_crs`, `doa_project_calculations`, `doa_project_easa_correspondence`; **B)** Mantener `metadata jsonb` y aceptar no-cumplimiento hasta Q3; **C)** Solo Certification Basis + EASA correspondence | Desbloquea M04, M20. Define si la app "es CRM" o "es DOA tool" |
| **D4** | Separación DOH+DOS: ¿crear ahora usuarios dev + tabla de roles? | **A)** Sí, bloqueante antes de demo con auditor; **B)** Deferred, aceptar warning "simulación" en UI; **C)** Solo usuarios, sin tabla de roles (rol en metadata) | Desbloquea M05. Sin esto EASA rechaza |
| **D5** | Estructura carpetas Drive: alinear a estándar EASA o mantener app | **A)** Alinear a EASA 5-dir + script bulk-move; **B)** Mantener app 6-dir y documentar divergencia; **C)** Soportar ambos con feature flag | Desbloquea M15 |
| **D6** | Backfill `doa_historical_projects` desde `02. Datos DOA\05. Proyectos\` | **A)** Backfill completo Sprint 1 (2 días); **B)** Manual por prefijo solo cuando aparezca cliente del segmento; **C)** Aceptar numeración fresh y documentar | Desbloquea M16, M19 |
| **D7** | RLS rollout strategy | **A)** Activar 17 tablas en un sprint con policies uniformes; **B)** Por tabla en orden de criticidad (quotations/projects primero); **C)** Schema staging para validar antes de prod | Define shape del proyecto M01 |
| **D8** | 8 buckets Storage públicos: ¿privatizar todo? | **A)** Privatizar todos + signed URLs; **B)** Solo los con PII (`StoragePDFs-Imagenes`, `tcds-documents`); **C)** Auditar consumo primero y decidir bucket por bucket | Desbloquea M30 |
| **D9** | Rate limiting infra | **A)** Upstash Redis (managed, sliding window); **B)** Tabla Supabase `doa_rate_limits`; **C)** Middleware Next.js in-memory (no distribuido) | Desbloquea M21 |
| **D10** | Tablas zombie (`chat_history`, `salud_sintomas`, `DocumentacionCertificacion`): ¿confirmamos y DROP? | **A)** Sí, DROP todas tras confirmar; **B)** Solo `salud_sintomas` (otro proyecto); **C)** Mantener + RLS deny-all | Desbloquea M46. GDPR aplica si hay PII |

---

## 5. Plan de oleadas de fixes (3 sprints)

### Sprint 0 — AUTO-FIXABLES (1 semana, sin decisiones pendientes)

Ejecutar todo lo marcado **AF** en la matriz que no dependa de una decisión. 32 items; ~40-50 h dev.

**Quick wins inmediatos (<2 h cada uno, ~8 h total):**
- M06 — Estrechar `clientBlockSchema.customer_type` a `z.enum([...])` y propagar error legible.
- M07 — `temperature: 0.0` + `seed: 42` en clasificador n8n.
- M08 — Reemplazar marker por `{{FORM_LINK}}` + validación post-LLM (abortar si falta).
- M09 — Sustituir `info@gmail.com` por variable `{{DOA_GENERIC_EMAIL}}` en writer off-topic.
- M10 — Verificar 91e6188 cubre security headers + `poweredByHeader:false`.
- M11 — `npm install next@16.2.4` (GHSA-q4gf-8mx6-v5v3).
- M12 — Verificar d6ed649 aplicó fail-closed en `requireWebhookSignature`.
- M14 — Cambiar `bodyPreview` → `body.content` con truncado 8K.
- M28 — Arreglar 6 errores eslint + 15 warnings.
- M29 — `npm audit fix` transitivas.
- M33 — `ALTER FUNCTION ... SET search_path = ''` para las 2 SECURITY DEFINER.
- M38 — Arreglar links rotos README.
- M39 — Husky + lint-staged pre-commit.
- M42 — `HEALTHCHECK` en Dockerfile.
- M43 — `UserKnownHostsFile` fijo en deploy.sh.

**Migraciones DB AF (~8 h):**
- M13 — Normalizar CHECK bilingües a set inglés (UPDATE legacy + DROP+CREATE).
- M18 — `doa_quotations` += `client_id, currency, po_number, is_demo`.
- M34 — Policies explícitas en `doa_ai_response_cache`, `doa_app_events`, `doa_form_tokens`.
- M35 — `updated_at` en `doa_clients`; `created_by` en `doa_form_tokens`.
- M36 — `is_demo` en las 9 tablas listadas.
- M37 — Regenerar `types/database.ts` con `supabase gen types typescript`; consolidar helpers.

**UI/UX AF (~16 h):**
- M23 (parcial) — `<main>`, skip-nav, jerarquía `<h1>`, `<label>` en 5 dashboards.
- M24 — Correr `english_ui_residual_sweep.py --apply` y mergear.
- M25 — Instalar `sonner`; reemplazar `window.confirm`/`alert` por dialogs shadcn.
- M41 — `loading.tsx` en 4 rutas + `global-error.tsx` + `not-found.tsx`.

**IA/Observability AF (~8 h):**
- M22 — `lib/ai/sanitize.ts` + delimitadores `<CLIENT_DATA>` en 5 rutas analyze.
- M31 — Tabla `doa_idempotency` + middleware 4 endpoints críticos.
- M32 — Tabla `doa_ai_events` + insert en cada ruta LLM.
- M40 — Clasificador a 6 categorías + detección `In-Reply-To`.
- M48 (parcial) — Zod en 5 rutas API más críticas.

**Entregable Sprint 0:** `tsc --noEmit` y `npm run lint` exit 0; `npm audit` sin high; CI gate básico; 3 bugs IA cerrados; clasificador determinista.

### Sprint 1 — DECISIONES + BLOQUEANTES PART 21J (2-3 semanas)

Tras D1-D10 resueltas, ejecutar en orden:

1. **D1+M01+M02** — Ownership model + activar RLS en 17 tablas (5 días).
2. **D2+M03** — Vitest + Playwright + CI con gates `lint/typecheck/test/audit/build` (3-5 días).
3. **D3+M04+M20** — Crear entidades Part 21J + UI mínima (3 días).
4. **D4+M05** — Tabla `doa_users.role` + validar separation of duties; crear usuarios dev DOH/DOS (1-2 días).
5. **D5+M15** — Alinear estructura Drive EASA + bulk-move (1 día).
6. **D6+M16+M19** — Backfill historical + endpoint archive→historical (2 días).
7. **D8+M30** — Privatizar buckets + signed URLs (1 día).
8. **D9+M21** — Rate limiting en endpoints AI (1.5 días).
9. **D10+M46** — DROP tablas zombie (2 h).

### Sprint 2 — REFACTOR + COBERTURA (2-3 semanas)

- M17 — Workflow aceptación formal de quote.
- M26 — React-hook-form + migrar 5 forms; form público a `<form>`.
- M27 — Partir page.tsx quotations (2200), TcdsRagClient (1855), QuotationStatesBoard (1360).
- M44 — Fallback LLM chain.
- M45 — Consolidar índices Pinecone vs pgvector.
- M47 — Reemplazar 269 usos `bg-slate/gray-*` por tokens Warm Executive.
- M48 (completar) — Zod en 53 rutas API.
- M49 — UI upload/versionar documentos de deliverables.
- Prompt caching (`cache_control: ephemeral`) en 3 rutas analyze.
- Eval harness 20 gold cases (AI §8).
- Dashboard `/tools/ai-monitor`.
- Alertas sobre `doa_app_events.severity='warn'|'error'`.
- Migración `SET search_path` masiva en 151 funciones.

**Entregable Sprint 2:** ningún fichero >500 líneas, WCAG 2.1 AA ≥75%, cobertura tests ≥50% de lib + rutas críticas, dashboard IA operativo.

---

## 6. Apéndice

### 6.1 Conteos por auditoría fuente

| Auditoría | Hallazgos discretos originales | Severidad alta (P0/P1/High/Critical) | Consolidados en matriz |
|-----------|--------------------------------|---------------------------------------|------------------------|
| Code-UX (`code-ux-audit-2026-04-23.md`) | ~35 (14 áreas + 10 quick wins + 10 high-impact + deuda D.1-D.7) | 10 | M23-M28, M37-M39, M41, M47 |
| Security (`security-correctness-audit-2026-04-23.md`) | 29 (4 H + C1-C11 + D1-D3 + X1-X3 + B1-B5) | 4 críticos (H1-H4) + 2 altos (S1, D1) | M01-M03, M10-M13, M21, M29-M36, M42-M43, M46, M48 |
| AI (`ai-audit-2026-04-23.md`) | ~60 (10 LOW + 8 MED + 6 HIGH + 4 ARCH + P1.1-P5.1) | 5 críticos (P1.2, P1.7, P2.1, P3.1) | M07-M09, M14, M21-M22, M32, M40, M44-M45 |
| E2E (`simulation-end-to-end-2026-04-23.md`) | 29 (GAP-01 a GAP-28 + B01-B05) | 3 P0 (GAP-06, GAP-12, GAP-16) + 14 P1 | M04-M06, M15-M20, M49 |

**Total original:** ~153 hallazgos.
**Total deduplicado:** 49.
**Ratio solapamiento:** ~68% (cross-audit patterns sección 3 son los drivers principales).

### 6.2 Commits SHA de referencia

- Code-UX audit: `281ce44`
- Security audit: `5387210`
- AI audit: `87800a6`
- E2E simulation: `91f4db6`
- HEAD actual (main): `91e6188` (contiene ya fixes S1 + H4)

### 6.3 Estado de fixes ya aplicados (pre-consolidación)

| Commit | Hallazgo cubierto | Estado |
|--------|-------------------|--------|
| `d6ed649` | S1 / M12 — fail-closed en `requireWebhookSignature` | Aplicado |
| `91e6188` | H4 / M10 — HTTP security headers + `poweredByHeader:false` | Aplicado |

Verificar en Sprint 0 que ambos commits cubren completamente el alcance antes de marcarlos cerrados.

### 6.4 Archivos clave para los fixes principales

- `lib/forms/schemas.ts` — estrechar `customer_type` (M06).
- `app/api/incoming-requests/[id]/route.ts` — DELETE sin ownership (M02).
- `lib/security/webhook.ts` — fail-open (M12).
- `next.config.ts` — security headers (M10).
- n8n workflow `pEFW1V46yyLR58c8` — clasificador + writers (M07/M08/M09/M14/M40).
- `app/f/[token]/submit/route.ts` — propagación error sqlerrm (E2E B05).
- `lib/project-builder.ts` — `computeNextSequence` (M16).
- `app/(dashboard)/layout.tsx` — `<main>` landmark + skip-nav (M23).

---

_Fin del master audit — 2026-04-23._
