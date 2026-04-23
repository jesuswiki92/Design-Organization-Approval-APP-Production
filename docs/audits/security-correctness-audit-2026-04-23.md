# Auditoría de Seguridad y Correctitud — DOA Operations Hub

- **Fecha**: 2026-04-23
- **Alcance**: Aplicación Next.js 16 completa (`01.Desarrollo de App/`), Supabase (proyecto `gterzsoapepzozgqbljk`), infra Docker/Traefik, integraciones n8n/OpenRouter.
- **Modalidad**: Read-only. Cero escrituras en producción, cero DDL, cero DELETE/UPDATE. Cambios restringidos a este único fichero dentro de `docs/audits/`.
- **Instancia viva testeada**: `https://doa.testn8n.com`
- **Analista**: auditoría asistida por Claude (Sonnet/Opus), evidencias recogidas en vivo vía Supabase MCP, `curl`, y lectura directa del repo.

---

## 0. Resumen ejecutivo

La app tiene cimientos muy buenos (arquitectura Next.js 16 con `proxy.ts`, Supabase SSR + service-role separados, HMAC en todos los webhooks *outbound*, Zod en las superficies públicas), pero arrastra **cuatro problemas de severidad alta o crítica** que hay que cerrar antes de que más clientes vean la URL:

| # | Severidad | Hallazgo | Impacto |
|---|-----------|----------|---------|
| H1 | **Crítico** | **17 tablas de `public.*` con RLS deshabilitado** (`doa_clients`, `doa_incoming_requests`, `doa_quotations`, `doa_users`, `doa_emails`, etc.) | Cualquier JWT autenticado puede leer/borrar/modificar cualquier fila, incluido datos de todos los clientes. |
| H2 | **Crítico** | **No hay tests automatizados ni pipeline de CI** | No existe forma de detectar regresiones antes de desplegar; `npm run test` ni siquiera está definido en `package.json`. |
| H3 | **Alto** | **Endpoint `DELETE /api/incoming-requests/[id]` sin verificación de ownership** (TODO explícito en el código) | Cualquier usuario autenticado puede borrar la request de cualquier otro usuario, cascadeando a `doa_emails`, `doa_form_tokens`, `doa_form_submissions`, `doa_quotations`. |
| H4 | **Alto** | **HTTP security headers totalmente ausentes** en producción (HSTS / CSP / X-Frame / X-Content / Referrer-Policy / Permissions-Policy) y `X-Powered-By: Next.js` expuesto. | Habilita clickjacking, MIME sniffing, downgrade TLS y enumeración de framework. |

También se identifican siete vulnerabilidades conocidas de dependencias (tres *high*), **8 buckets de Storage totalmente públicos**, 39+ funciones PostgreSQL con `search_path` mutable (153 en total sin `SET search_path` blindado), una clave de idempotencia **ausente** en `open-project` y `send-client`, CHECK constraints bilingües que permiten pulmón de estados en español e inglés simultáneamente, y un *fail-open* silencioso en `requireWebhookSignature` cuando la variable `DOA_N8N_INBOUND_SECRET` no está fijada.

### Quick wins (<2 h cada uno)

1. Añadir `async headers()` en `next.config.ts` con HSTS/CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy y `poweredByHeader: false`. (15 min)
2. Actualizar Next.js `16.2.2` → `16.2.4+` para cerrar GHSA-q4gf-8mx6-v5v3 (DoS de Server Components, CVSS 7.5). (10 min)
3. Cambiar `fail-open` de `requireWebhookSignature`: si `DOA_N8N_INBOUND_SECRET` no está fijado, **fallar en `NODE_ENV==='production'`** en vez de permitir todo. (20 min)
4. Añadir `HEALTHCHECK` al `Dockerfile` (`curl --fail http://localhost:3000/api/build-info`). (10 min)
5. Aplicar `SET search_path = ''` + `pg_temp` a las dos funciones SECURITY DEFINER (`doa_new_current_user_role`, `doa_new_handle_new_user`). Migración sencilla. (30 min)
6. Cambiar `startupProbe`/CI: añadir `npm audit --omit=dev --audit-level=high` como *gate*. (30 min)
7. Borrar `X-Powered-By` via `poweredByHeader: false` en `next.config.ts`. (5 min)
8. Hardening de `deploy.sh`: reemplazar `StrictHostKeyChecking=no` por `UserKnownHostsFile` fijo (evita MITM on-first-connect). (30 min)
9. Privatizar los 8 buckets de Storage (cambiar a `public=false`) si ninguno necesita ser realmente público. (45 min, pendiente validar consumo actual).

### Proyectos (>1 día cada uno)

1. **Activar RLS en las 17 tablas pendientes** y redactar policies (ver §2). Estimación 3-5 días con testing.
2. **Introducir framework de tests (Vitest + Playwright) y pipeline de CI** con `audit/lint/typecheck/test` + build. 3-5 días.
3. **Añadir columna `owner_user_id` (o modelo de roles en `doa_users`) y condiciones de ownership a rutas destructivas**. 2 días.
4. **Rate limiting + quota** en `/api/tools/chat` (OpenRouter facturable) y en cualquier endpoint AI (`*/analyze`, `*/suggest`). 1.5 días (ej. Upstash Redis + sliding window).
5. **Idempotency keys** (header `Idempotency-Key`) en `open-project`, `send-client`, `send-delivery`, `validate`. 2 días.
6. **Normalizar estados a un único idioma** (borrar las mitades españolas de los CHECK constraints, migrar filas legacy). 2-3 días.
7. **Observability: alarmas sobre `doa_app_events.severity='warn'|'error'`** (webhook rejects, RLS-pending deletes, AI failures). 1-2 días.

---

## 1. Autenticación y autorización (API routes)

### 1.1 Cobertura de `requireUserApi`

- De las **~53 rutas** bajo `app/api/**`, **49 invocan `requireUserApi`** (`grep` en anexo). Excepciones correctas:
  - `app/api/build-info/route.ts` — público por diseño.
  - `app/api/forms/issue-link/route.ts` — HMAC o Bearer interno (`requireServerAuth`).
  - `app/api/webhooks/*` — HMAC (`requireWebhookSignature`).
  - `app/f/[token]/submit/route.ts` — gatekeeping dentro del RPC `fn_submit_form_intake`.
- `lib/auth/require-user.ts` está bien: `requireUserApi()` devuelve `Response` en error; los call-sites usan `if (auth instanceof Response) return auth`. Patrón correcto, se respeta en todos los archivos inspeccionados.
- El `proxy.ts` (Next.js 16) excluye `/api/*` del matcher, delegando toda la verificación al handler. Correcto y documentado.

### 1.2 Hallazgo H3 — DELETE sin ownership

**Severidad: Alto — CVSS 3.1: AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:H (7.3)**

**Archivo**: `app/api/incoming-requests/[id]/route.ts` (líneas 12-16, 22-50).

```ts
// TODO(RLS): authz no garantiza ownership — depende de RLS [audit Fase pre-prod]
// doa_incoming_requests no tiene columna de ownership (no owner_user_id). Hasta
// que se introduzca una table de roles + columna owner, cualquier user_label
// autenticado puede borrar cualquier request. Se emite un evento severity=warn
// cuando el actor no es admin para que quede trazable en la auditoria.
```

**Evidencia de ejecución**:
- El handler usa el cliente `supabase` SSR (anon key + JWT), **no** `createAdminClient()`. Dado que `doa_incoming_requests` **tiene RLS desactivado** (ver §2), las policies no filtran nada y cualquier JWT autenticado pasa a través.
- El código registra `request.delete.non_admin` pero **no bloquea**, solo deja rastro en `doa_app_events`.
- El DELETE cascadea manualmente a `doa_emails`, `doa_form_tokens`, `doa_form_submissions`, `doa_quotations`, `doa_projects` antes de borrar la request (para sortear la FK `NO ACTION` de `doa_projects.incoming_request_id`). Con RLS off, el cascade manual también se ejecuta como el usuario autenticado sin restricciones.

**Impacto**: Cualquier cuenta válida (ej. un nuevo usuario registrado, o una cuenta comprometida de un colaborador) puede destruir datos de cualquier cliente. En un escenario multi-cliente/multi-departamento esto es pérdida irreparable (sin soft-delete).

**Fix (Alto esfuerzo, proyecto)**:
1. Añadir `owner_user_id uuid references auth.users(id)` a `doa_incoming_requests` y rellenar con `created_by` o el primer usuario que tocó la request.
2. Añadir un check explícito en el handler: si `!isAdmin && row.owner_user_id !== user.id` → 403.
3. Luego activar RLS (§2) con policy `DELETE USING (owner_user_id = auth.uid() OR is_admin(auth.uid()))`.

**Fix intermedio (<2 h, quick win parcial)**: rechazar DELETE de no-admin con 403 hasta que exista columna de ownership. Un solo cambio: reemplazar el `await logServerEvent(...)` por `return jsonResponse(403, 'admin_required')`. Bloquea el daño inmediato sin tocar schema.

### 1.3 Otros hallazgos de authz

- **`projects/create-manual`**: autentica pero no exige rol. Cualquier usuario puede crear un proyecto sin request de origen. No es crítico (auditado por `created_by`), pero documentar el decisión.
- **`/api/incoming-requests/[id]/open-project`**: verifica auth pero la creación del proyecto + llamada a n8n + archivado de la request no se hacen en una sola transacción (ver §6). Además no hay idempotency key → doble clic = proyecto duplicado + dos carpetas en Drive.
- **`/api/tools/chat`**: autenticado pero sin *rate limit*. Un usuario malicioso puede drenar el presupuesto de OpenRouter. Crítico en producción porque el backend paga por tokens (ver §4.3).

---

## 2. RLS en Supabase (Row-Level Security)

### 2.1 Hallazgo H1 — RLS deshabilitado en 17 tablas públicas

**Severidad: Crítico — CVSS 3.1: AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H (9.9)**

**Evidencia** (consulta directa sobre el proyecto Supabase `gterzsoapepzozgqbljk`, 2026-04-23):

```sql
SELECT tablename FROM pg_tables
WHERE schemaname='public' AND rowsecurity=false;
```

Resultado — **17 tablas sin RLS**:

1. `DocumentacionCertificacion`
2. `chat_history`
3. `doa_aircraft`
4. `doa_client_contacts`
5. `doa_clients`
6. `doa_compliance_templates`
7. `doa_emails`
8. `doa_historical_project_documents`
9. `doa_historical_project_files`
10. `doa_historical_projects`
11. `doa_incoming_requests`
12. `doa_part21_embeddings`
13. `doa_quotation_items`
14. `doa_quotations`
15. `doa_users`
16. `doa_workflow_state_config`
17. `salud_sintomas`

**Impacto**: Cualquier cliente Supabase que posea el anon key + una sesión autenticada válida (o incluso el anon key suelto dependiendo de las policies de la base) puede leer e incluso modificar estas tablas. Como la app usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` en cada cliente SSR (ver `proxy.ts:54`), todas esas tablas están abiertas para el JWT de cualquier usuario logueado.

**Verificación empírica** (la razón por la que §1.2 es directamente explotable): la ruta `DELETE /api/incoming-requests/[id]` usa el cliente anon SSR y ejecuta `supabase.from('doa_incoming_requests').delete().eq('id', id)`. Si RLS estuviera activo con una policy razonable (p.ej. `USING (owner_user_id = auth.uid())`), ese DELETE fallaría para un no-owner. Con RLS off, tiene éxito.

**Fix (Proyecto, 3-5 días)**:
```sql
-- Plantilla por tabla. Ejemplo para doa_incoming_requests:
ALTER TABLE public.doa_incoming_requests ENABLE ROW LEVEL SECURITY;

-- Lectura: admins o el owner.
CREATE POLICY "own_or_admin_select"
  ON public.doa_incoming_requests FOR SELECT
  USING (
    (SELECT role FROM public.doa_users WHERE id = auth.uid()) = 'admin'
    OR owner_user_id = auth.uid()
  );

-- Modificación: solo owner o admin.
CREATE POLICY "own_or_admin_write"
  ON public.doa_incoming_requests FOR UPDATE
  USING (
    (SELECT role FROM public.doa_users WHERE id = auth.uid()) = 'admin'
    OR owner_user_id = auth.uid()
  )
  WITH CHECK (
    (SELECT role FROM public.doa_users WHERE id = auth.uid()) = 'admin'
    OR owner_user_id = auth.uid()
  );
-- … y DELETE equivalente, INSERT con WITH CHECK equivalente.
```
Repetir por cada tabla, añadiendo `owner_user_id` donde no exista. Validar con tests `pgTAP` o `supabase db reset` + seed.

### 2.2 RLS activo pero sin policies (otro anti-patrón)

**Severidad: Medio — CVSS 3.1: AV:N/AC:L/PR:H/UI:N/S:U/C:N/I:N/A:L (2.7)**

- `doa_ai_response_cache`, `doa_app_events`, `doa_form_tokens` **tienen RLS habilitado pero 0 policies**. El comportamiento por defecto de Postgres con RLS on + sin policies es *deny all*. Eso significa que el cliente SSR anon NO puede leerlas, lo cual es correcto para `doa_form_tokens` (solo se tocan con `createAdminClient()`), pero para `doa_ai_response_cache` y `doa_app_events` puede ser involuntario — merece confirmar que ningún cliente authenticated las necesite.

**Fix (Quick win)**: añadir una policy explícita (aunque sea `USING (false)`) con un comentario dejando constancia del diseño, para que en la próxima auditoría el revisor no tenga dudas. Alternativamente, desactivar RLS si realmente no aporta.

### 2.3 Hallazgo cruzado: `doa_form_tokens` sin columna `created_by`

La tabla `doa_form_tokens` (ver schema introspectado) tiene:
`token, slug, incoming_request_id, expires_at, used_at, first_viewed_at, view_count, created_at, is_demo`.

**No hay `created_by`**: cuando un admin emite un token vía `/api/forms/issue-link`, no queda constancia en la fila de quién lo emitió. Solo queda en `doa_app_events`. Para cumplimiento (EASA Part 21J pide trazabilidad nominal), debería añadirse `created_by uuid references auth.users(id)`.

**Severidad: Medio — Info disclosure + non-repudiation (CVSS 3.1: 4.3)**

**Fix (Proyecto, 2 h)**: migración `ALTER TABLE ... ADD COLUMN created_by uuid references auth.users(id)` + actualizar `app/api/forms/issue-link/route.ts` para persistirla.

---

## 3. Gestión de tokens y secretos

### 3.1 HMAC constant-time: ¿correcto?

- `lib/security/webhook.ts:63-77` (`verifyHmacRaw`): usa `createHmac('sha256', secret).digest('hex')` y compara con `timingSafeEqual(Buffer.from(expected,'hex'), Buffer.from(providedSig,'hex'))`. **Correcto**: comparación de Buffer, no de string, longitud pre-chequeada antes del TSE.
- `lib/security/n8n-outbound.ts`: firmas salientes usan el mismo primitive. OK.

**Severidad**: N/A (implementación OK).

### 3.2 Hallazgo — `requireWebhookSignature` *fail-open* en dev

**Severidad: Alto — CVSS 3.1: AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:H/A:N (7.1)**

**Archivo**: `lib/security/webhook.ts:94-110`.

```ts
if (!secret || secret.trim().length === 0) {
  if (!unconfiguredLogged) {
    unconfiguredLogged = true
    await logServerEvent({ eventName: 'webhook.auth.unconfigured', ... })
  }
  return { ok: true }    // ← ¡permite TODO!
}
```

**Impacto**: si la variable `DOA_N8N_INBOUND_SECRET` no está fijada en el entorno (p. ej. alguien borra el env-add en Swarm, o se despliega una nueva instancia sin esa var), los webhooks inbound se aceptan sin firma. Un atacante que descubra la URL puede forzar transiciones de estado, cerrar proyectos, etc.

**Fix (Quick win, 20 min)**:

```ts
if (!secret || secret.trim().length === 0) {
  if (process.env.NODE_ENV === 'production') {
    await logServerEvent({ eventName:'webhook.auth.unconfigured', severity:'error' })
    return { ok:false, reason:'secret_not_configured' }
  }
  // only in dev fallback
  ...
  return { ok:true }
}
```

### 3.3 Token de formulario `doa_form_tokens` — propiedades

- Generación: 256 bits aleatorios vía `crypto.randomBytes(32).toString('base64url')` → 43 chars. Longitud y entropía OK.
- TTL por defecto: 14 días, máx configurable 60 días (Zod valida `int(1..60)` en `lib/forms/schemas.ts`). OK.
- **Single-use**: enforced dentro de `fn_submit_form_intake` (transacción). Correcto.
- **Atomicidad**: la RPC marca `used_at` dentro de la misma transacción que inserta la submission. No hay race condition.
- **Reuso post-expiry**: la ruta `GET /f/[token]` evalúa `used_at` ANTES que `expires_at`, por lo que un token usado y expirado muestra "ya enviado" en vez de "expirado". Esto es una sutileza UX, no un bug de seguridad.
- **Fire-and-forget RPC**: `fn_touch_form_token_view` se llama sin `await`. El error solo se `console.error`-ea. Si el RPC falla silenciosamente, el `view_count` no sube. **Medio: observabilidad pobre** pero no crítico.

### 3.4 Service role key

- `lib/supabase/admin.ts`: singleton, throw si falta. **No exportado al cliente**. El `Dockerfile` **correctamente** NO pasa `SUPABASE_SERVICE_ROLE_KEY` como `ARG` (confirmado en líneas 20-22). Se inyecta en runtime vía `docker service update --env-add` en Swarm.
- **No evidencia** en `.next/standalone` de filtrado (no hemos podido verificar el bundle de producción, solo `.next/dev`). Recomendar una validación manual post-deploy: `docker exec … grep -R service_role /app` debe devolver vacío.

### 3.5 `.env*` en `.gitignore`

- `.gitignore:43` → `.env*`. OK.
- `.env.local`, `.env.*.local` adicionalmente listados. OK.
- `docker-compose.swarm.yml` (contiene secretos) en `.gitignore:59`. OK.
- `VPS_DEPLOYMENT_RUNBOOK_PRIVATE.txt` ignorado. OK.

**Pero**: `deploy.sh:24-26`:
```bash
if [ -f .env.production ]; then
  cp .env.production .env.local
fi
```
Esto es en el **VPS**, no en el repo. Asume que `.env.production` existe en el filesystem del VPS. Válido operacionalmente. Añadir comentario de cómo se inyecta ese fichero la primera vez (cuando sea parte del runbook privado).

---

## 4. Inyecciones (SQL / XSS / SSRF / command / open-redirect)

### 4.1 SQL injection

- Todas las consultas a Supabase usan el query builder (`.from().select().eq()` etc.) o RPCs parametrizadas. **No** se construyen strings SQL dinámicamente en el código de la app. Riesgo bajo.
- Las dos RPCs públicas (`fn_submit_form_intake`, `fn_touch_form_token_view`) toman parámetros tipados (`text`, `jsonb`, `uuid`). Su cuerpo (inspeccionado por MCP) usa `jsonb_extract_path_text` y parametrización estándar. OK.

**Severidad: N/A**.

### 4.2 XSS

- **`/f/[token]`**: sirve HTML crudo desde `doa_forms.html` **sin DOMPurify**. Documentado en header de archivo (`app/f/[token]/route.ts:23-29`).
  - **Modelo de confianza**: el HTML lo escriben sólo miembros del equipo DOA, nunca terceros.
  - **Riesgo actual**: bajo SIEMPRE QUE esa precondición se mantenga.
  - **Riesgo futuro**: si en algún momento el HTML del formulario se vuelve editable desde UI por un usuario común, pasa a ser un stored-XSS dirigido al cliente final.
  - **Sugerencia**: commitear un test de integración que falle si `doa_forms.html` contiene patrones sospechosos de fuentes no-curadas (difícil, pero un `mem_search` en el proceso de revisión ayuda).
- **`send-client/route.ts`**: tiene su propio `escapeHtml()` manual. Cubre `& < > " '`. **Correcto** — pero hay que verificar que nunca se usa `innerHTML` con contenido no escapado. Lectura: el body del mail se construye con plantilla + `escapeHtml(variables)`. OK.
- **Componentes React**: con React 19 por defecto no hay `dangerouslySetInnerHTML` salvo opt-in. No hemos encontrado uso no-justificado de esa prop en los componentes inspeccionados.

**Severidad**: Medio (condicional al modelo de confianza del form HTML) — CVSS 3.1: 5.0.

**Fix (Proyecto, 1 día)**: introducir `isomorphic-dompurify` (ya en deps pero no en uso) con allow-list que preserve `<script>`, `onload`, `onclick`, `onchange`, `style`. Esto da defensa en profundidad.

### 4.3 SSRF

- `app/api/tools/chat/route.ts`: llama a OpenRouter vía SDK OpenAI. URL fija en env. **No acepta URLs de usuario**.
- `app/api/incoming-requests/[id]/send-client/route.ts`: llama al webhook n8n (`DOA_N8N_WEBHOOK_URL`). URL fija en env.
- `app/api/projects/[id]/send-delivery/route.ts`: igual, con timeout `AbortController(10s)`. Correcto.
- **No detectamos ningún endpoint que acepte URL arbitraria como input**. Riesgo SSRF: **bajo**.

### 4.4 Command injection

- No usamos `child_process`, `exec`, `spawn` en `app/**` (confirmado por `grep`). Riesgo: **nulo**.

### 4.5 Open redirect

- `proxy.ts` emite exactamente dos `NextResponse.redirect`: hacia `/login` o `/home`. Destino relativo construido con `new URL('/home', request.url)`. Seguro.
- Ninguna ruta de autenticación acepta `?next=`/`?redirect_to=` con validación laxa (no hemos encontrado patrón).

**Severidad: N/A**.

---

## 5. Correctitud de datos

### 5.1 Hallazgo — CHECK constraints bilingües

**Severidad: Medio — CVSS 3.1: AV:L/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:L (3.5)**

**Evidencia**:
```sql
-- constraint real en doa_projects
status = ANY (ARRAY['nuevo','en_progreso','revision','aprobacion','entregado',
                    'cerrado','archivado','new','in_progress','review','approval',
                    'delivered','closed','archived','op_01_data_collection']);
```

Seis tablas tienen CHECK constraints que aceptan tanto el valor en español como su traducción al inglés. Eso quiere decir que en una BD vieja puedes tener un proyecto con `status='entregado'` y en la misma BD otro con `status='delivered'` — lógicamente equivalentes pero tratados como distintos por cualquier query que filtre por string.

**Además** `op_01_data_collection` está colado en el mismo check, mezclando dos conceptos (estado principal vs estado de operación) en la misma columna. Eso es deuda de diseño.

**Fix (Proyecto, 2-3 días)**:
1. Migrar filas legacy (`UPDATE … SET status='delivered' WHERE status='entregado'` etc.) — necesita inventariar uso.
2. Reemplazar CHECK por el set inglés (canonical); eliminar mitad española.
3. Crear otra columna `operation_status` para `op_01_*` si de verdad hace falta distinguir.
4. Alinear `lib/workflow-states.ts` (fuente única de verdad) con la nueva realidad.

Hasta entonces: mantener vigilancia sobre `logServerEvent` donde `status` transita; un lint rule que prohíba string-literal de estados españoles ayuda.

### 5.2 Foreign keys y cascade

- `doa_projects.incoming_request_id → doa_incoming_requests.id` tiene `ON DELETE NO ACTION` (no declarado explícitamente; default Postgres). **Eso es intencional**: impide borrar una request que ya generó proyecto sin limpiar el proyecto antes. La ruta `DELETE /api/incoming-requests/[id]` lo maneja borrando primero los proyectos hijos (manual cascade, ver `route.ts:67-75`).
- `doa_quotations.incoming_request_id → doa_incoming_requests.id` con `ON DELETE CASCADE`. OK si una request se borra, sus cotizaciones también se van.
- `doa_emails → doa_incoming_requests ON DELETE CASCADE`. OK.
- `doa_form_tokens → doa_incoming_requests ON DELETE CASCADE`. OK.
- `doa_project_time_entries → doa_projects ON DELETE CASCADE`. OK.
- `doa_project_deliveries → doa_projects ON DELETE CASCADE`. OK.
- `doa_incoming_requests.client_id → doa_clients ON DELETE SET NULL`. Aceptable (no bloquear borrado de cliente).

**Sin hallazgo crítico**. Una anomalía: `doa_project_deliveries.signature_id → doa_project_signatures` **sin** cascade ni SET NULL; si se borra la signature con una delivery activa, el DELETE falla. Probablemente intencional; documentar.

### 5.3 Transiciones de estado

- `lib/workflow-states.ts` centraliza las constantes (según convención del proyecto). La verificación real de que un handler sólo acepta transiciones válidas depende de cada ruta. `projects/[id]/transition`, `projects/[id]/state` y `incoming-requests/[id]/state` son las llaves. No se ha auditado línea-por-línea cada transición (fuera del alcance), pero la existencia de CHECK bilingual (§5.1) permite UPDATE a valores-hermano en español sin que lo detecte nadie. Riesgo Medio.

### 5.4 Consistencia real en la BD (estado a 2026-04-23)

Query de integridad ejecutada en vivo:

| Check | Valor |
|---|---|
| tokens totales | 3 |
| orphan_tokens (FK rota) | 0 |
| expirados pero no usados | 0 |
| no usados, aún válidos | 2 |
| demo_tokens | 2 |
| clientes duplicados por `cif_vat` | 0 |
| clientes duplicados por `client_code` | 0 |
| proyectos totales | 1 |
| proyectos sin `incoming_request_id` | 0 |
| quotations sin request | 0 |
| `status:requests:archived` | 1 |
| `status:requests:awaiting_form` | 2 |
| `status:projects:new` | 1 |

La BD actual es diminuta, por lo que no se observa corrupción. Todos los valores de status presentes están en la mitad *inglesa* del CHECK bilingüe. Bien.

### 5.5 Timestamps

- `doa_clients` **no tiene `updated_at`**. Si cambias un cliente, pierdes la marca temporal. Medio.
- Resto de tablas inspeccionadas tienen `created_at` (+ `updated_at` en la mayoría). Asumimos triggers `set_updated_at()` aunque no se han validado.

---

## 6. Concurrencia y race conditions

### 6.1 Hallazgo — sin idempotency key en operaciones destructivas/billables

**Severidad: Medio — CVSS 3.1: AV:N/AC:L/PR:L/UI:R/S:U/C:N/I:L/A:L (3.8)**

Endpoints críticos sin `Idempotency-Key` ni deduplicación por contenido:

- `POST /api/incoming-requests/[id]/open-project` — crea proyecto + llama a webhook n8n (crea carpeta en Drive) + archiva request. Doble clic = doble proyecto, dos carpetas, estado final indeterminado.
- `POST /api/incoming-requests/[id]/send-client` — dispara webhook n8n que envía email al cliente. Doble clic = doble email. Mala experiencia de cliente.
- `POST /api/projects/[id]/send-delivery` — envía entregable al cliente (email + archivo). Mismo problema.
- `POST /api/projects/[id]/validate` — multi-step: DB + webhook. Timeout de 10s (`AbortController`). Si n8n tarda 11s, el cliente reintentará y se disparará dos veces en el n8n aunque el cliente vea error.

**Fix (Proyecto, 2 días)**: añadir tabla `doa_idempotency` con `key, first_seen_at, response_hash`, middleware que short-circuitea peticiones con key repetida dentro de una ventana. O más simple: clave secundaria natural (`incoming_request_id + action`) + `ON CONFLICT DO NOTHING`.

### 6.2 Transacciones parciales

- `open-project/route.ts`: crea fila en `doa_projects`, luego llama al webhook n8n, luego actualiza `doa_incoming_requests.status='archived'`. Si el webhook falla después del INSERT, queda un proyecto huérfano sin carpeta. No hay compensación automática.
- `send-delivery/route.ts`: tiene recovery paths y el timeout; aceptable.
- `fn_submit_form_intake` **es atómico** (PL/pgSQL transaction). OK.

**Fix (Medio esfuerzo)**: mover el INSERT + webhook + UPDATE a una función Postgres (o una Edge Function de Supabase) que haga BEGIN/COMMIT. Alternativa: outbox pattern → persistir la intent, un worker n8n la consume.

---

## 7. Manejo de errores

### 7.1 Errores silenciados

- `app/f/[token]/route.ts:285-294`: `void supabase.rpc('fn_touch_form_token_view', ...).then(({error}) => console.error(...))`. Es un fire-and-forget aceptable (no queremos hacer esperar al usuario). Pero **no hay log estructurado**, solo `console.error` → no queda en `doa_app_events`.
- `app/api/incoming-requests/[id]/route.ts:86-93`: `if (isMissingSchemaError(...)) continue`. Si la tabla no existe, se continúa sin advertir. Para el contexto actual (app en reestructuración con tablas desconectadas) es aceptable; **añadir un `logServerEvent` de severity='info'** para tener rastro.
- `lib/security/webhook.ts:124-133`: logs correctos.

### 7.2 Missing awaits

- Un `grep` rápido de `\.then(` sin `await` encuentra el caso de `/f/[token]` arriba. No se ha detectado otro patrón sistemático, pero con 53 rutas recomiendo hacer un lint específico (`@typescript-eslint/no-floating-promises` activado en `eslint.config.mjs`).

### 7.3 Códigos de estado HTTP

- Varias rutas devuelven 500 para casos que deberían ser 400 (validation) o 409 (conflict). Ejemplo: DELETE request con `isMissingSchemaError` devuelve 409 (bien), pero otras rutas colapsan en `jsonResponse(500, error.message)`. Limpieza de contratos HTTP queda como quick win (1 h).

---

## 8. Validación de input con Zod

### 8.1 Cobertura

- `lib/forms/schemas.ts` define schemas para `issueLink` y `submitForm`. Bien.
- `app/api/forms/issue-link/route.ts` valida con Zod. OK.
- `app/f/[token]/submit/route.ts` valida con Zod antes del RPC. OK.
- **La mayoría del resto de rutas NO usa Zod**. Muchas hacen `await request.json()` directo y acceden a propiedades arbitrarias (ej. `app/api/incoming-requests/[id]/state/route.ts`, `workflow/transition/route.ts`).

**Severidad: Medio — CVSS 3.1: AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:L (4.3)**

**Impacto**: enviar un JSON con shape inesperado puede provocar queries mal formadas (Supabase devuelve error, no Prime consecuencia), pero aumenta la superficie de bug. No es injection (el query builder sanea), pero sí DoS (mandar 1 MB de campos bogus) y comportamiento no-definido.

**Fix (Proyecto, 2-3 días)**: crear `lib/api/schemas.ts` con schemas por ruta, middleware `validateBody(schema)`. Fácil con Zod ya instalado.

### 8.2 Schemas existentes — validación de campos

El `submitForm` schema es extenso y bien tipado. El único matiz: `email: z.string().email()` acepta cualquier cosa con formato email; no valida DNS/reales. Para formularios públicos esto es deliberado (no ralentizar UX). OK.

---

## 9. RPCs y Edge Functions

### 9.1 Introspección

- **2** SECURITY DEFINER con `search_path` fijado: `fn_submit_form_intake`, `fn_touch_form_token_view`. OK.
- **2** SECURITY DEFINER **sin** `search_path`: `doa_new_current_user_role`, `doa_new_handle_new_user`. Vulnerables a search-path hijacking. **Medio**.

### 9.2 Hallazgo — 153 funciones SQL sin `SET search_path`

**Severidad: Medio — CVSS 3.1: AV:L/AC:H/PR:H/UI:N/S:U/C:L/I:L/A:L (3.0)**

**Evidencia**:
```sql
SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proconfig IS NULL AND p.prokind='f';
-- resultado: 153
```

Por defecto, Supabase Advisor reporta esto como `function_search_path_mutable`. En combinación con `SECURITY DEFINER`, puede escalar privilegios si un atacante con permisos de CREATE en algún schema más prioritario (p.ej. `pg_temp`) define una función con el mismo nombre.

**Fix (Quick win para las 2 SECURITY DEFINER críticas, 30 min)**:
```sql
ALTER FUNCTION public.doa_new_current_user_role() SET search_path = '';
ALTER FUNCTION public.doa_new_handle_new_user() SET search_path = '';
```

Para las 151 restantes (INVOKER), la recomendación es añadir `SET search_path = public, pg_temp` en cada una. Proyecto de 1-2 días (migración masiva + test).

### 9.3 Edge Functions

- `list_edge_functions` MCP: (no ejecutado en esta pasada por tiempo). **TODO**: validar si hay edge functions desplegadas y auditar su código.

---

## 10. Observabilidad

### 10.1 `logServerEvent` y `doa_app_events`

- Instrumentación presente en webhooks, auth flows, operaciones destructivas. Buena cobertura.
- La tabla `doa_app_events` tiene **RLS habilitado pero 0 policies** (§2.2). Solo el service role puede leerla/escribirla. Eso impide que un dashboard de admin leyendo con JWT de usuario la muestre. Decidir: añadir policy `SELECT` para admins.

### 10.2 Ausencia de alertas

- No se detecta integración con Sentry/Logtail/Grafana ni alarmas sobre severity='error'. Una política mínima: cron que consulte `doa_app_events WHERE severity IN ('warn','error') AND created_at > now() - interval '5 min'` y dispare un webhook a Slack/Telegram.

**Severidad: Medio** — no hay señal cuando algo rompe.

### 10.3 `/api/build-info`

- Expone `gitSha`, `gitBranch`, `buildTime`, `imageTag`, `nodeEnv`. El primero y el último son la preocupación.
- `nodeEnv` revela que estamos en `production`. Info mínima.
- `gitSha` permite correlacionar con commits públicos (repo existe en GitHub: `jesuswiki92/Design-Organization-Approval-APP-Production`). **Si el repo se vuelve privado, esto pasa de Info a Medio**.

**Severidad actual: Info. Si el repo se privatiza: Medio**.

**Fix (opcional)**: requerir Bearer token para `/api/build-info` como mínimo, o al menos bloquearlo detrás de rate limit.

---

## 11. Deploy e infra

### 11.1 Dockerfile — puntos buenos

- Multi-stage (deps / builder / runner). Capas cacheables.
- Usuario no-root (`nextjs:nodejs` uid 1001). OK.
- `NEXT_TELEMETRY_DISABLED=1`. OK.
- `output: 'standalone'` en `next.config.ts`. OK.
- `SUPABASE_SERVICE_ROLE_KEY` NO pasado como `ARG`. OK (comentario explícito en Dockerfile:16-19).

### 11.2 Hallazgos Dockerfile

| # | Sev | Issue |
|---|-----|-------|
| D1 | Medio | **Sin `HEALTHCHECK`** — Swarm / docker compose no tiene forma de saber si la app está viva. |
| D2 | Bajo | `node:20-alpine` — cambiar a `node:20-alpine@sha256:…` pinning por digest. Alpine cambia frecuentemente. |
| D3 | Bajo | No se corre `npm prune --production` tras el build (aunque `standalone` ya trim-ea). |

**Fix D1 (Quick win, 10 min)**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/build-info || exit 1
```

### 11.3 docker-compose.yml — puntos buenos

- Traefik router con TLS Let's Encrypt, `websecure`, certresolver correcto.
- `restart: unless-stopped`. OK.
- `NODE_ENV=production`. OK.

### 11.4 Hallazgo H4 — HTTP security headers ausentes

**Severidad: Alto — CVSS 3.1: AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N (5.4)**

**Evidencia en vivo** (`curl -sI --ssl-no-revoke https://doa.testn8n.com`):
- **No** `Strict-Transport-Security`
- **No** `Content-Security-Policy`
- **No** `X-Frame-Options` (clickjacking → 1-click *takeover* si un atacante iframea la UI)
- **No** `X-Content-Type-Options: nosniff`
- **No** `Referrer-Policy`
- **No** `Permissions-Policy`
- **Sí** `X-Powered-By: Next.js` → leak del framework y versión implícita.

**Fix (Quick win, 15 min)** — añadir a `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname) },
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // CSP laxo para no romper /f/[token] con inline scripts; tightener en otro sprint
          { key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co https://openrouter.ai" },
        ],
      },
    ]
  },
}
```

Alternativa: middleware Traefik (`headers.customResponseHeaders`). Ambas válidas.

### 11.5 Hallazgos `deploy.sh`

| # | Sev | Issue |
|---|-----|-------|
| X1 | Medio | `ssh -o StrictHostKeyChecking=no` → vulnerable a MITM en *first connect*. |
| X2 | Bajo | `git reset --hard origin/main` en VPS puede wipear stash inesperado (si alguien hizo un hotfix manual). Documentar que eso NO debe hacerse. |
| X3 | Bajo | `docker compose build --no-cache` siempre — deploys de 5 min. Aceptable para una app así. |

**Fix X1 (Quick win, 30 min)**:
```bash
ssh -i ~/.ssh/id_ed25519 \
    -o UserKnownHostsFile=~/.ssh/doa_known_hosts \
    -o StrictHostKeyChecking=yes \
    root@145.223.116.37 << 'ENDSSH'
...
```

Y snapshot del fingerprint del VPS en `~/.ssh/doa_known_hosts` la primera vez.

---

## 12. Testing

### 12.1 Hallazgo H2 — No hay tests ni CI

**Severidad: Crítico — Correctitud (no CVSS directo, pero habilita TODAS las demás regresiones)**

**Evidencia**:
- `package.json` sin `"test"` script.
- No hay archivos `*.test.ts`, `*.spec.ts`, `__tests__/`, `vitest.config.ts`, `jest.config.js` ni `playwright.config.ts`.
- No hay `.github/workflows/`, no hay `deploy.sh` con `npm test` gate.
- Repo privado (no se observa pipeline externo).

**Impacto**: cualquier cambio (incluida esta auditoría si recomendara fixes) se despliega sin un solo test corriendo. Un PR que rompe el login, un RPC migrado mal, un webhook que deja de firmar — todo pasa a producción sin alerta.

**Fix (Proyecto, 3-5 días)**:
1. **Vitest** para unit (`lib/security/*`, `lib/forms/schemas`, `lib/workflow-states`): 1 día.
2. **Supertest/undici** para rutas API con Next.js local test server: 1-2 días.
3. **Playwright** para el flujo de login + `/f/[token]` + submit: 1 día.
4. **CI GitHub Actions** con matriz `lint/typecheck/test/audit/build`: 0.5 día.
5. Gate en `deploy.sh` que lea `git log -1` y solo deploye si el último commit tiene status success de CI (via `gh run list`).

Sugerencia de primer PR: cubrir `lib/security/webhook.ts` (§3.2). Tiene un path negativo clarísimo (secret ausente → debe rechazar en prod) y evita la regresión del fix.

---

## 13. Dependencias

### 13.1 `npm audit` (2026-04-23)

**Vulnerabilidades**: 7 totales (3 High, 4 Moderate, 0 Critical).

| Paquete | Sev | Ruta | Título | Fix |
|---|-----|------|--------|-----|
| **`next`** | **High** | direct | GHSA-q4gf-8mx6-v5v3 — DoS vía Server Components (CVSS 7.5) | `16.2.2` → `16.2.4` (**minor, no semver-major**) |
| `@hono/node-server` | Moderate | transitiva | Middleware bypass vía repeated slashes (CVSS 5.3) | upgrade transitive |
| `brace-expansion` | Moderate | transitiva | Zero-step sequence causes DoS (CVSS 6.5) | upgrade transitive |
| `dompurify` | Moderate | transitiva (via `isomorphic-dompurify`) | 4 advisories incluida bypass de FORBID_TAGS (CVSS 6.8) | upgrade a 3.4.0+ |
| `hono` | Moderate | transitiva | 6 advisories (cookie name bypass, path traversal, XSS via JSX) | upgrade transitive |
| `path-to-regexp` | **High** | transitiva | ReDoS vía sequential optional groups (CVSS 7.5) | upgrade transitive |
| `picomatch` | **High** | transitiva | ReDoS vía extglob quantifiers (CVSS 7.5) | upgrade transitive |

**Fix (Quick win Next.js — 10 min)**:
```bash
npm install next@16.2.4
```

**Fix transitivas (Medio, 1-2 h)**:
```bash
npm audit fix
# Si fail, añadir "overrides" a package.json para pin-bumper seguro
```

### 13.2 Paquetes pesados innecesarios

- `dompurify` + `isomorphic-dompurify` instalados pero **no usados** donde deberían (ver §4.2). O se usan y se justifica la presencia, o se borran.
- No se ha detectado otro paquete claramente huérfano sin `depcheck` corrido; recomiendo añadirlo al CI.

---

## 14. Tests en vivo (curl)

### 14.1 Pruebas contra `https://doa.testn8n.com`

Todas con `--ssl-no-revoke` debido al comportamiento de schannel en Windows 11. **Ninguna** modificó datos.

```bash
curl -sI --ssl-no-revoke https://doa.testn8n.com
```

Headers relevantes:

```
HTTP/2 200
x-powered-by: Next.js              ← información del framework
content-type: text/html; charset=utf-8
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
```

**Sin** `strict-transport-security`, `content-security-policy`, `x-frame-options`, `x-content-type-options`, `referrer-policy`, `permissions-policy`.

Confirma el hallazgo **H4** (§11.4).

```bash
curl -s --ssl-no-revoke https://doa.testn8n.com/api/build-info
```

```json
{"gitSha":"...","gitShaShort":"...","gitBranch":"main","buildTime":"...","imageTag":"...","nodeEnv":"production","serverTime":"..."}
```

- Endpoint público sin auth. Expone `nodeEnv=production` y detalles de commit. Ver §10.3.

```bash
curl -sI --ssl-no-revoke https://doa.testn8n.com/f/nonexistent-token
```

Respuesta 404 con card HTML amigable. El handler distingue "no existe" vs "expirado" vs "usado" — **info leak mínimo pero detectable**: un atacante puede enumerar tokens aceptando-vs-rechazando. Cambios recomendados: devolver la misma card HTML para 404/410 desde el punto de vista del atacante (todavía diferenciable por status code); dejarlo igual no cambia sustancialmente la superficie, así que es **Info**.

```bash
curl -s -X POST --ssl-no-revoke https://doa.testn8n.com/api/forms/issue-link
# 401 Unauthorized  ← correcto, HMAC/Bearer requerido
```

```bash
curl -s -X POST --ssl-no-revoke https://doa.testn8n.com/api/webhooks/project-state
# 401 missing_signature_header  ← correcto
```

Confirmado: los webhooks inbound rechazan por falta de signature (lo cual prueba que `DOA_N8N_INBOUND_SECRET` **está configurado en prod**). Buena noticia. §3.2 sigue aplicando como defensa en profundidad por si alguien borra la env var.

### 14.2 Pruebas que NO se realizaron (por la restricción read-only)

- Crear un usuario en auth, loguearse, y probar a leer/borrar una fila de `doa_incoming_requests` de otro tenant. *Esta sería la prueba definitiva para H1/H3; debe hacerse en staging, no en prod*.
- Fuzzing de `/f/[token]/submit` con cuerpos malformados.

---

## 15. Hallazgos adicionales

### 15.1 Bucket de Storage públicos

**Severidad: Medio — CVSS 3.1: AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N (5.3)**

Los 8 buckets Supabase Storage están marcados `public=true`:

```
Certification_Data_Base_Pictures, crm_rag_images, doa-formularios,
doa-tcds-storage, StorageCertificacion, StoragePDFs-Imagenes,
tcds-documents, viz-files
```

**Impacto**: cualquier objeto cuyo path conozca alguien puede descargarse sin auth. Si hay PDFs con datos sensibles del cliente, es un problema.

**Fix (Quick win 45 min si se tolera el cambio de API)**: pasar a `public=false` y generar *signed URLs* con TTL corto (la infra ya tiene el service role). Validar primero que ningún componente frontend hace `getPublicUrl()` sin fallback.

### 15.2 Fire-and-forget observabilidad

`app/api/incoming-requests/[id]/route.ts:36-49` ejecuta `await logServerEvent(...)` sobre cada DELETE de no-admin. Si el log table es lenta, esto ralentiza el DELETE. Aceptable (el DELETE ya es costoso), pero considerar un `void logServerEvent(...)` consciente (error absorbido y explicitado con comment).

### 15.3 `chat_history` tabla sin RLS ni policies

Tabla suelta con contenido aparentemente AI-generado. Si almacena prompts/respuestas de usuarios, expone el historial de cualquier usuario sin filtrar. Investigar si se sigue usando y, si no, deprecar/eliminar.

### 15.4 `salud_sintomas` y `DocumentacionCertificacion`

Ambas con RLS off, schema sospechoso de otro proyecto (salud) o remanente de pruebas. **Potencial dato "zombie" en BD**. Confirmar con el owner y eliminar si no corresponde a DOA. Si contienen datos personales, GDPR aplica.

### 15.5 `next-env.d.ts` en `.gitignore:50` pero Next lo quiere regenerado

Ya ignorado correctamente. OK.

### 15.6 `proxy.ts` matcher excluye `/api/*`

Intencional y documentado. OK.

### 15.7 `console.error` sin structured log

Varios archivos usan `console.error('...', err)` en lugar de `logServerEvent`. Eso significa que en prod los errores se quedan en *stdout* del contenedor y desaparecen cuando se rota el log. **Medio para observabilidad**. Fix: canalizar todo por `logServerEvent` o, como mínimo, un adaptador `logger.ts` que escriba a ambos.

### 15.8 No hay `.nvmrc` ni `engines` en `package.json`

Hay riesgo de que alguien builde con Node 18 o 22. Dockerfile pin-ea `node:20-alpine` → en prod OK, pero localmente puede divergir. Añadir:
```json
"engines": { "node": ">=20 <21" }
```
(Quick win, 5 min.)

### 15.9 `docker-compose.yml` version '3.8' deprecated

Docker Compose v2+ ignora la key `version`. No es un bug, pero `docker compose` emite warning. Limpieza cosmética.

---

## 16. Consolidado de severidad

| ID | Sev | Área | Hallazgo | Esfuerzo |
|----|-----|------|----------|----------|
| H1 | **Crítico** | RLS | 17 tablas public sin RLS | Proyecto 3-5d |
| H2 | **Crítico** | Testing | Sin tests ni CI | Proyecto 3-5d |
| H3 | **Alto** | AuthZ | DELETE /incoming-requests sin ownership | Proyecto 2d; quick fix 1h (403 no-admin) |
| H4 | **Alto** | Infra | HTTP security headers ausentes + X-Powered-By | **Quick win 15 min** |
| S1 | Alto | Webhook | `requireWebhookSignature` fail-open en prod | **Quick win 20 min** |
| D1 | Alto (deps) | Deps | Next 16.2.2 → 16.2.4 (GHSA-q4gf-8mx6-v5v3) | **Quick win 10 min** |
| D2 | Alto (deps) | Deps | path-to-regexp / picomatch ReDoS | Medio 1-2h |
| C1 | Medio | BD | CHECK bilingüe → state pollution | Proyecto 2-3d |
| C2 | Medio | BD | 153 funciones sin SET search_path | Proyecto 1-2d; fix 2 SECDEF en **30 min** |
| C3 | Medio | Storage | 8 buckets públicos | Quick win 45 min (validar primero) |
| C4 | Medio | Concurrencia | Sin Idempotency-Key en open-project / send-client / send-delivery | Proyecto 2d |
| C5 | Medio | Rate limit | `/api/tools/chat` sin rate limit (OpenRouter billable) | Proyecto 1.5d |
| C6 | Medio | Validación | Zod solo cubre 2 rutas de ~53 | Proyecto 2-3d |
| C7 | Medio | RLS | `doa_ai_response_cache` / `doa_app_events` con RLS on + 0 policies | Quick win 30 min (política explícita) |
| C8 | Medio | Audit trail | `doa_form_tokens` sin `created_by` | Proyecto 2h |
| C9 | Medio | Observabilidad | Sin alertas sobre `severity='error'` | Proyecto 1-2d |
| C10 | Medio | Infra | Dockerfile sin HEALTHCHECK | **Quick win 10 min** |
| X1 | Medio | Deploy | `ssh StrictHostKeyChecking=no` | Quick win 30 min |
| C11 | Medio | BD | `chat_history` / `salud_sintomas` / `DocumentacionCertificacion` tablas zombies | Proyecto 2h (revisión + DROP) |
| B1 | Bajo | Info | `/api/build-info` público expone nodeEnv | Opcional |
| B2 | Bajo | BD | `doa_clients` sin `updated_at` | Quick win 15 min |
| B3 | Bajo | Infra | docker-compose `version: '3.8'` deprecado | Cosmético |
| B4 | Bajo | Infra | `engines` ausente en package.json | Quick win 5 min |
| B5 | Info | Enumeración | `/f/[token]` devuelve status codes distintos para 404/410 | No accionable |

---

## 17. Plan de remediación sugerido

### Sprint inmediato (quick wins, ~1 día total)

1. Next.js 16.2.2 → 16.2.4 (cierra D1). **10 min**.
2. `next.config.ts` + security headers + `poweredByHeader:false` (H4). **15 min**.
3. `requireWebhookSignature` fail-closed en prod (S1). **20 min**.
4. HEALTHCHECK en Dockerfile (C10). **10 min**.
5. `ALTER FUNCTION ... SET search_path = ''` para las 2 SECDEF (C2 parcial). **30 min**.
6. Policy explícita en `doa_ai_response_cache` / `doa_app_events` (C7). **30 min**.
7. Hardening ssh en `deploy.sh` (X1). **30 min**.
8. `poweredByHeader: false` (ya cubierto en 2).
9. Bloqueo 403 para DELETE no-admin (H3 quick fix). **30 min**.
10. `npm audit fix` transitivas (D2). **1-2 h**.
11. Revisión + drop de tablas zombie (C11). **2 h**.
12. Añadir `"engines":{"node":">=20 <21"}` (B4). **5 min**.
13. Añadir `created_by` a `doa_form_tokens` (C8). **2 h**.

**Total sprint 1**: aprox. 8-10 h. Elimina las ventanas más visibles (headers + fail-open + auth) y cierra la vuln high conocida de Next.

### Sprint 2 (1-2 semanas)

1. Activar RLS en las 17 tablas (H1). 3-5 días.
2. Framework de tests + CI (H2). 3-5 días.
3. Privatizar 8 buckets + signed URLs (C3). 1 día.
4. Idempotency keys en 4 endpoints críticos (C4). 2 días.
5. Rate limiting en `/api/tools/chat` y endpoints AI (C5). 1.5 días.

### Sprint 3 (2 semanas)

1. Zod coverage en el resto de rutas API (C6). 2-3 días.
2. Normalización de estados (remover mitad española del CHECK) (C1). 2-3 días.
3. Alertas sobre `doa_app_events.severity='warn'|'error'` (C9). 1-2 días.
4. SET search_path en 151 funciones restantes (C2 resto). 1-2 días.
5. Edge functions audit (§9.3). 1 día.

---

## 18. Anexos

### 18.1 Comandos de verificación usados

```bash
# Supabase MCP (project: gterzsoapepzozgqbljk)
- list_tables
- execute_sql (consultas de schema, RLS, CHECK, FK, buckets)
- get_advisors security + performance

# Local repo
- grep en app/api/** para requireUserApi, rate limit, Zod
- glob **/*.test.* **/*.spec.* (0 matches)
- npm audit --json
- curl -sI --ssl-no-revoke https://doa.testn8n.com
- curl -s --ssl-no-revoke https://doa.testn8n.com/api/build-info
- curl -s -X POST https://doa.testn8n.com/api/webhooks/project-state
- curl -s -X POST https://doa.testn8n.com/api/forms/issue-link
```

### 18.2 Limitaciones de esta auditoría

1. **Read-only obligatorio** → no se han disparado ataques reales en prod (ej. probar a borrar una request de otro usuario). Pruebas equivalentes recomendadas en staging.
2. **Bundle de producción no inspeccionado** → no se ha descomprimido el contenedor Docker en prod para buscar `service_role_key` leak. Asumo (por lectura del Dockerfile) que no lo hay; validar manualmente es responsabilidad del siguiente turno.
3. **Edge Functions de Supabase**: MCP disponible pero no ejecutado por tiempo. **TODO** siguiente sesión.
4. **Rag-backend (Python FastAPI en `rag-backend/`)**: fuera del alcance declarado, tiene sus propios endpoints y su propia superficie. Auditar en ronda aparte.
5. **`n8n`**: las workflows inspeccionadas en `docs/` pero no las definiciones vivas vía MCP. `search_workflows` habría sido útil.
6. **Dependencias de `rag-backend/venv`**: `pip audit` pendiente.

### 18.3 Referencias

- Supabase Advisors (security + performance): `get_advisors` ejecutado 2026-04-23.
- OWASP Top 10 2021 A01/A03/A05/A07 aplicables.
- EASA Part 21J non-repudiation — referenciado por `hmac_key_id` en `doa_project_signatures`, no auditado en esta pasada; recomendar auditoría específica de la cadena HMAC cuando se active ese módulo.
- CWE-22 (path traversal), CWE-79 (XSS), CWE-352 (CSRF — no detectado), CWE-400 (DoS), CWE-862 (authz missing), CWE-732 (incorrect permission assignment).

---

**Fin del documento**. Este audit no modifica ningún dato de producción ni cambia código fuera de `docs/audits/`. Las mejoras propuestas deben implementarse en PRs separados, cada uno con tests cuando el framework de testing esté en pie.
