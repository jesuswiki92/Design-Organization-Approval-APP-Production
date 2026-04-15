# Estudio de viabilidad: n8n vs. scripts in-app para automatizaciones DOA

**Fecha:** 2026-04-15
**Ambito:** DOA Operations Hub (Next.js 16 standalone + n8n self-hosted en `sswebhook.testn8n.com`/`ssn8n.testn8n.com`)
**Autor:** research agent

---

## 1. Resumen ejecutivo

El hub DOA delega actualmente siete automatizaciones a n8n: intake de correos de Outlook, servidor dinamico de formularios HTML, envio de respuestas al cliente, guardado de documentos compliance, persistencia de cotizaciones, webhook de cambio de estado de proyecto y dispatch del Statement of Compliance con PDF adjunto. La app y n8n conviven en el mismo VPS (`testn8n.com`), por lo que los argumentos clasicos a favor de "consolidar" no aplican: un fallo del host derriba ambos simultaneamente.

**Recomendacion: hibrido (opcion C) con migracion parcial al codigo de la app**. Los workflows que son esencialmente "proxy HTTP con HMAC + notificacion" (`DOA-Project-State-Change`, `conteo-horas`, `quotation-state`, `compliance-docs`, `quotation-save`) se absorben en API routes Next.js con una cola de reintentos respaldada por Supabase. Los workflows que se benefician de credenciales oauth2 persistentes y UI operativa (`WF1 Outlook intake`, `WF2 Web Server Formularios`, `DOA-Enviar-Entregables` con Gmail/SMTP) permanecen en n8n porque: (a) el polling de Outlook cada minuto pide un proceso always-on, no un runtime orientado a requests; (b) los adjuntos PDF + reintentos SMTP son el tipo de nodo donde n8n aporta valor real; (c) el formulario publico servido en `/webhook/doa-form` no tiene equivalencia en la zona autenticada de la app.

La resiliencia aumenta moviendo los proxies triviales a la app (menos hops, menos superficie a fallar) pero se pierde si se migra el intake de correo, porque entonces el polling depende del mismo proceso Next.js.

---

## 2. Inventario de workflows n8n actuales

Las automatizaciones detectadas se agrupan en dos familias: **outbound** (la app dispara a n8n) e **inbound** (n8n llama a Supabase o sirve HTML a clientes).

### 2.1 Outbound desde la app (6 webhooks)

| Workflow | Disparo in-app | Env var URL | Ruta que dispara | Efecto externo |
|----------|----------------|-------------|------------------|----------------|
| `DOA-Project-State-Change` | Transicion de estado de proyecto "inline" | `N8N_PROJECT_STATE_WEBHOOK_URL` + `DOA_N8N_WEBHOOK_SECRET` | `app/api/proyectos/[id]/transicion/route.ts:123-259` (`fireProjectStateWebhook`) | Slack/email por branch segun `to_state` (ver tabla en `docs/n8n-workflows/DOA-Project-State-Change.md:80-91`) |
| `DOA-Enviar-Entregables` (Sprint 3) | Click "Enviar entrega" desde pestana Entrega | `N8N_DELIVERY_WEBHOOK_URL` + `DOA_N8N_WEBHOOK_SECRET` | `app/api/proyectos/[id]/enviar-entrega/route.ts:108-418` | Descarga signed URL del PDF, compone email Gmail/SMTP con adjunto, devuelve `execution_id` |
| `DOA - Guardar Documentos Compliance` (`FUmlV5uBEnacTVs2`) | Guardar checklist compliance en consulta | `DOA_COMPLIANCE_DOCS_WEBHOOK_URL` | `app/api/consultas/[id]/documentos/route.ts:34-80` | UPDATE 44 columnas booleanas en Supabase |
| `DOA - Guardar Cotizacion` | Guardar borrador de quotation | `DOA_QUOTATION_SAVE_WEBHOOK_URL` | `app/api/consultas/[id]/quotation/route.ts:22` | UPDATE cotizacion en Supabase |
| `DOA - Enviar Correo al Cliente` (WF3) | Aprobar borrador IA y enviar | `DOA_SEND_CLIENT_WEBHOOK_URL` | `app/api/consultas/[id]/send-client/route.ts:90` | UPDATE estado + envio Outlook al cliente |
| Legacy `project-state` proxy | Dropdown antiguo (pre Phase 9) | `DOA_PROJECT_STATE_WEBHOOK_URL` | `app/api/webhooks/project-state/route.ts:21-138` | Proxy HTTP plano. Se superpone con `DOA-Project-State-Change` |
| Legacy `quotation-state` proxy | Dropdown quotation | `DOA_QUOTATION_STATE_WEBHOOK_URL` | `app/api/webhooks/quotation-state/route.ts:17-56` | Proxy HTTP plano |
| `conteo-horas` (timer) | Start/stop timer de horas por proyecto | `DOA_CONTEO_HORAS_WEBHOOK_URL` | `app/api/webhooks/conteo-horas/route.ts:22-128` | Proxy a workflow de registro de sesion |

### 2.2 Workflows independientes (no disparados por la app)

Documentados en `01. Soporte_App/n8n-workflows/ARQUITECTURA_N8N.md`:

| Workflow | ID n8n | Trigger | Funcion |
|----------|--------|---------|---------|
| `DOA - 0 - Outlook a App (Correos Entrantes)` | `pEFW1V46yyLR58c8` | Outlook polling cada 1 min | IA clasifica → IA redacta → INSERT `doa_consultas_entrantes` → marca leido |
| `DOA - Web Server Formularios Clientes (Dinamico)` | `GCLA8OK26yNr90cd` | Webhook GET `/webhook/doa-form?id=` | Sirve HTML personalizado al cliente desde Google Drive |
| `DOA - Receptor Formularios Clientes (POST)` | (pendiente) | Webhook POST | TODO segun roadmap: recoge respuesta del form cliente |

### 2.3 Verificacion inbound (app como receptor)

`lib/security/webhook.ts:42-137` define `requireWebhookSignature` con `DOA_N8N_INBOUND_SECRET`. La documentacion de ese archivo confirma que **no hay consumidores inbound actuales**: la app puede recibir webhooks firmados de n8n pero el primitivo aun no se usa en ninguna ruta. Solo el callback publico `/api/proyectos/{id}/confirmar-entrega?token=` es golpeado directamente por el cliente final.

### 2.4 Workflows NO detectados (posibles huecos)

- No se encontro integracion con Slack directa desde la app; todo slack pasa por n8n.
- No hay cron in-app. Cualquier tarea programada vive en n8n (ej. recordatorios, reindex de precedentes periodico).
- No se detecto workflow de "email entrante → quotation" mas alla de WF1. El roadmap menciona WF4 receptor de formularios pero no esta implementado.

---

## 3. Analisis workflow por workflow (coste de sustitucion)

### 3.1 `DOA-Project-State-Change` (cambio de estado → notificacion)

- **Sustituir en app**: trivial. 40-80 LOC. Se sustituye el `fireProjectStateWebhook` por un switch sobre `to_state` que llama a la Slack Web API (`@slack/web-api`, ~400KB) y/o Resend/SMTP.
- **Runtime**: no requiere proceso persistente; se ejecuta dentro del request-response de la transicion.
- **Integraciones nuevas**: Slack OAuth token, SMTP o Resend.
- **Estado / retries**: n8n no persiste reintentos automaticos en el diseno actual (el Function de HMAC re-ejecuta el flujo completo si lo reenvias a mano). Con Supabase se puede modelar una tabla `outbound_notifications` con `status/retry_count` y un cron pequeno (ver 3.7).
- **Observabilidad**: se pierde el panel "Executions" de n8n. Hay que sustituirlo con `doa_app_events` (ya existe la infraestructura, p. ej. `project.state.transicion.webhook_failed` en `route.ts:215`).
- **Riesgo operacional**: si el proceso Next.js cae a las 3am, la notificacion se pierde igual que hoy (n8n tambien cae porque vive en el mismo host). Neto: igual.

### 3.2 `DOA-Enviar-Entregables` (email + PDF adjunto)

- **Sustituir en app**: moderado. ~150-250 LOC. Descargar el PDF ya se hace en `enviar-entrega/route.ts:280-288` via signed URL; faltaria componer el mensaje HTML, adjuntar el binario y enviar con Gmail API (`googleapis`, pesado) o SMTP (`nodemailer`).
- **Runtime**: se ejecuta sincronamente. Con SMTP lento (2-5s) el handler puede tocar el timeout de la plataforma; en este despliegue standalone (sin limite serverless) es aceptable. La app ya tiene `N8N_TIMEOUT_MS = 10_000` (linea 46).
- **Integraciones nuevas**: OAuth Gmail (requiere `refresh_token` persistente, rotacion y UI de reconexion que la app no tiene) o credenciales SMTP planas. Para MJML/plantillas HTML se anade un renderer.
- **Estado**: n8n actualmente no retry-ea transitorios SMTP (ver `TODO` linea 121 de `DOA-Enviar-Entregables.md`). En la app tambien habria que construirlo.
- **Observabilidad**: clave. El `execution_id` que devuelve n8n se guarda en `doa_project_deliveries.n8n_execution_id` (`enviar-entrega/route.ts:426`). Al migrar, ese campo se reusa o se renombra a un id propio.
- **Riesgo operacional**: el email va a clientes externos y es el punto mas sensible legal/comercial (Statement of Compliance EASA Part 21J). Perder un envio o duplicarlo tiene coste real. Migrar SMTP sin capa de colas maduras suma riesgo.

### 3.3 `DOA - Guardar Documentos Compliance` (UPDATE 44 booleans)

- **Sustituir en app**: trivial. <30 LOC. El handler ya tiene el body; bastaria un `supabase.update()` en vez del `fetch()` al webhook.
- **Runtime**: sincrono, ya dentro del request.
- **Integraciones**: ninguna, es solo Supabase.
- **Observabilidad**: n8n no aporta valor aqui (solo hace proxy). Migrar elimina un hop.
- **Justificacion para migrar**: muy alta. Es el ejemplo canonico de "n8n como proxy innecesario".

### 3.4 `DOA - Guardar Cotizacion`, `quotation-state`, `conteo-horas` (proxies HTTP)

Mismo diagnostico que 3.3: son **tuneles HTTP autenticados sin logica externa**. Revisando `webhooks/project-state/route.ts:77-104` se ve que el handler ya hace todo (auth, logging, fetch upstream). El workflow n8n es ornamental. **Migrar a UPDATE directo en Supabase elimina 2 saltos y reduce superficie**.

### 3.5 WF1 — Outlook intake + clasificacion IA + insert entrantes

- **Sustituir en app**: alto coste y cambio de modelo. Next.js API routes no corren polling. Hay dos caminos:
  1. **Pull (cron externo)**: un job cada minuto que llame a `/api/_internal/poll-outlook`. Requiere gestor de cron (Traefik no tiene; systemd timer en el VPS; o `mcp__scheduled-tasks`).
  2. **Push (Graph subscription)**: Microsoft Graph permite webhooks con renovacion cada ~3 dias. La app recibe en `/api/webhooks/outlook-mail` (firmado). Mas complejo: hay que mantener la `subscription_id`, renovar, y aguantar picos de burst.
- **Runtime**: `nodejs` (no edge) obligatorio. Next.js standalone en Docker puede hacerlo, pero pierdes la UI de n8n para pausar, ver el payload crudo o reejecutar una ejecucion concreta.
- **Integraciones nuevas**: Microsoft Graph OAuth2 con refresh, OpenAI (ya esta como dep `openai ^6.32.0`), parseo MIME. LOC estimada 400-800.
- **Estado**: n8n guarda cada ejecucion (200 mas en una semana tipica). Migrar sin reconstruir esa trazabilidad en `doa_app_events` crea un agujero forense.
- **Riesgo operacional**: alto. Es el primer contacto con el cliente; si se pierde un correo, se pierde un lead. La actual arquitectura ya tiene cadena OpenAI + fallback robusto de JSON parsing (`ARQUITECTURA_N8N.md:99-109`) que replicar fidedignamente es trabajo.

### 3.6 WF2 — Web Server Formularios Dinamicos

- **Sustituir en app**: directo conceptualmente pero rompe la arquitectura. La app tiene guard `proxy.ts` que protege `/engineering`, `/quotations`, etc. Los clientes **externos** (sin sesion Supabase) entran por `sswebhook.testn8n.com/webhook/doa-form?id=`. Migrar implica:
  1. Exponer una ruta publica `/formularios/cliente?id=...` **fuera** del matcher de `proxy.ts`.
  2. Validar `id` contra `doa_consultas_entrantes` en server component.
  3. Renderizar el HTML desde `Formularios/formulario_cliente_conocido.html` (ya en repo).
  4. Gestionar el POST del formulario (WF4 pendiente).
- **Runtime**: simple SSR; no requiere nada especial.
- **Integraciones**: Google Drive deja de hacer falta porque el HTML ya vive en repo (`Formularios/*.html`). Ganancia clara.
- **Justificacion para migrar**: media-alta. Elimina dominio cruzado y dependencia de Google Drive como CMS. Pero exige revisar CSP, CORS y hardening de la ruta publica (rate limit, token de un uso).

### 3.7 Cola de reintentos in-app (primitivo necesario si se migra outbound)

Para cualquier migracion outbound, la app necesita **una cola ligera** que hoy no existe. Esquema minimo:

- Tabla `doa_outbound_jobs (id, kind, payload jsonb, status, attempts, next_attempt_at, last_error)`.
- Endpoint interno `/api/jobs/tick` (protegido con secret) que procesa N jobs por tick.
- Cron externo (systemd timer en el VPS, o `pg_cron` en Supabase) que lo llama cada 30s.

Coste: 200-300 LOC. Es reusable para todas las migraciones outbound y da paridad con el retry de n8n.

---

## 4. Matriz pros/contras

### 4.1 Mantener todo en n8n (estado actual)

| Dimension | Pro | Con |
|-----------|-----|-----|
| Fiabilidad | Reintentos manuales desde UI | Sin retry automatico configurado; un SMTP 5xx pierde el envio |
| Observabilidad | Panel "Executions" con payload crudo, diff entre runs | Silos: hay que correlacionar `execution_id` entre n8n y `doa_app_events` |
| Mantenimiento | Cambiar un texto Slack no toca el repo ni pide deploy | Credenciales viven fuera de git, auditoria debil |
| Debugging | Re-ejecucion con mismo payload + breakpoints visuales | Cuando el bug esta en la frontera (HMAC, timezone) hay que saltar entre Code nodes y la app |
| Deploy | Deploy n8n = `git pull` + `docker compose up` del workflow JSON | n8n tiene su propio ciclo (actualizaciones semanales, breaking changes ocasionales) |
| Vendor lock-in | Workflows JSON son portables | Creds OAuth atadas a la instancia; mover a otro n8n exige re-autorizar todo |
| Aislamiento de fallos | Si n8n cae, la app sigue sirviendo paginas | App y n8n en el MISMO VPS (`testn8n.com` dominio compartido) → un incidente de host los tumba a los dos |
| Coste | n8n comunity es free, solo coste VPS | Hay que monitorear memory leaks de n8n (workers largos) |
| Seguridad (HMAC) | Frontera HMAC clara: `DOA_N8N_WEBHOOK_SECRET` entre app y n8n | Dos secretos que rotar (outbound + inbound); HMAC se salta en dev (`webhook.ts:96-109`) |
| Accesibilidad no-dev | Operaciones puede editar plantillas de email sin tocar codigo | En la practica nadie fuera del equipo tecnico edita workflows |
| Long-running / cron | Polling Outlook cada minuto es el caso perfecto | Requiere que n8n este always-on; no sobrevive a un reboot sin systemd |
| Idempotencia | Function node permite dedupe por `execution_id` | No implementado hoy (ver TODO linea 145 de `DOA-Project-State-Change.md`) |

### 4.2 Mover todo a scripts in-app

| Dimension | Pro | Con |
|-----------|-----|-----|
| Fiabilidad | Transaccionalidad con Supabase en el mismo request; retry cola dedicada | Para SMTP / Graph hay que escribir el retry a mano |
| Observabilidad | Una sola stack: `doa_app_events` + logs de Next.js | Se pierde la vista UI de "que ejecuciones fallaron hoy" (hay que construirla) |
| Mantenimiento | Un solo repo, un solo deploy, code review obligatorio | Cambios triviales (texto Slack) exigen PR + deploy |
| Debugging | Stack traces completas, breakpoints en VSCode, logs coherentes | Perdida del "replay con payload exacto" de n8n |
| Deploy | `docker compose up` una unica imagen | Cada cambio requiere rebuild Next.js (~2 min) |
| Vendor lock-in | Bajo: solo Supabase + libs npm | Alto acoplamiento a Next.js 16 (`proxy.ts` convention ya es no estandar) |
| Aislamiento de fallos | N/A — todo lo que estaba en n8n ahora compite por el mismo event loop que la UI | Una fuga de memoria en un workflow mata la UI tambien |
| Coste | Sin coste extra; se reusa el VPS | Mas RAM para Node (polling Outlook, colas, renderer PDF) |
| Seguridad | Menos fronteras, menos secretos | Si Next.js se compromete, credenciales Gmail/Slack caen con ella |
| Accesibilidad no-dev | Nula — todo exige deploy | — |
| Long-running / cron | Se puede hacer con `node-cron` en `instrumentation.ts` o sidecar worker | Requiere patron "worker separado" si hay tareas pesadas; Next.js standalone no ofrece BackgroundTasks |
| Idempotencia | Facil: `UNIQUE(kind, key)` en `doa_outbound_jobs` | — |

---

## 5. Recomendacion detallada y plan de migracion

### 5.1 Decision: opcion C (hibrido)

**Migrar**: workflows que son proxy trivial sobre Supabase (3.3, 3.4), y el formulario publico (3.6).

**Mantener en n8n**: workflows que tocan (a) procesos always-on con OAuth persistente (WF1 Outlook intake, 3.5) y (b) SMTP/Gmail con adjuntos PDF (`DOA-Enviar-Entregables`, 3.2) hasta que exista cola outbound robusta.

**Argumento de resiliencia (core)**: la arquitectura actual *no* tiene aislamiento de fallos fisico — app y n8n comparten VPS `testn8n.com`. Por tanto el beneficio de "aislar en dos procesos" es teorico. Lo que **si** existe es aislamiento de *proceso*: un crash de n8n no mata la app y viceversa. Eso se pierde si absorbes el polling Outlook en Next.js (memory leak del parser MIME = pagina caida). Por eso el intake se queda en n8n.

Inversamente, los "proxies" son superficie extra sin beneficio: cada hop tiene su propio modo de fallo (red interna docker, Traefik rule, n8n cold reload). Migrar 3.3/3.4/3.5a a UPDATE directo **reduce** surface.

El dispatch de entregables (3.2) es el caso limite: el email al cliente con PDF. Migrarlo a nodemailer + Gmail OAuth es posible pero pierdes el pattern "staff operacion revisa el draft en la UI de n8n antes de reenviar un fallo". Recomiendo mantenerlo en n8n hasta que la cola outbound (3.7) este madura.

### 5.2 Plan de migracion propuesto (4 hitos, estimacion 3-4 sprints)

1. **Hito 1 — Absorber proxies triviales (quick win, 1 sprint)**
   Migrar `compliance-docs`, `quotation-save`, `quotation-state`, `conteo-horas` a UPDATE directo en Supabase. **Primero porque**: son <30 LOC cada uno, no hay integracion externa, reducen secretos y hops. Retirar sus env vars del runbook de deploy.

2. **Hito 2 — Formulario cliente publico in-app (1 sprint)**
   Crear `/formularios/cliente/[id]/page.tsx` excluido de `proxy.ts`, rate-limit por IP, servir `Formularios/formulario_cliente_conocido.html` inyectando datos de Supabase. Deprecar WF2. **Primero porque**: el HTML ya vive en el repo, Google Drive deja de ser CMS, y el dominio `doa.testn8n.com` queda como unico frontal.

3. **Hito 3 — Cola outbound (`doa_outbound_jobs`) + adaptador (1 sprint)**
   Implementar la tabla de jobs y un tick endpoint llamado por `pg_cron` cada 30s. Introducir un adaptador `enqueueOutbound(kind, payload)` que encapsule "enqueue + fallback a webhook n8n". Refactorizar `fireProjectStateWebhook` y `enviar-entrega` para usarlo. **Primero porque**: es el prerequisito para migraciones futuras; ademas anade retries que hoy faltan (TODO en `DOA-Enviar-Entregables.md:121`) incluso si seguimos usando n8n como ejecutor.

4. **Hito 4 (opcional, condicional) — Migrar notificaciones de estado de proyecto (1 sprint)**
   Sustituir `DOA-Project-State-Change` por un switch in-app que use `@slack/web-api` directo, encolando via hito 3. Mantener la ruta `/api/proyectos/[id]/transicion` sin cambios externos (el fire-and-forget se sustituye por un enqueue). Deprecar `N8N_PROJECT_STATE_WEBHOOK_URL`. **Primero porque** (despues de 3): una vez la cola existe, este workflow es el mas barato de absorber (solo branches de Slack, sin adjuntos).

5. **No-migrar (por ahora)**:
   - `WF1 Outlook intake` → se queda en n8n; el coste de paridad (Graph subscriptions + retry + UI de debug) supera el beneficio.
   - `DOA-Enviar-Entregables` → se queda hasta que la cola outbound tenga >30 dias en produccion sin incidentes. Cuando se migre, sera un caso de uso directo de hito 3.
   - Legacy `/api/webhooks/project-state` → marcar deprecated, retirar despues de hito 4 cuando todos los callers usen el nuevo endpoint de transicion.

### 5.3 Fallback pattern (recomendado dentro de hito 3)

Introducir `lib/outbound/dispatcher.ts` con interfaz unica:

```
dispatch(kind, payload) → first: try in-app handler; on error → enqueue n8n webhook
```

Esto da opcion D (migrar con n8n como fallback) de forma implicita: durante la migracion, si el handler in-app lanza, el sistema sigue funcionando. Se retira el fallback cuando hay confianza.

---

## 6. Riesgos y supuestos

**Supuestos verificados** (leidos directamente del codigo o docs):
- App Next.js 16 standalone en Docker (`Dockerfile:1-41`), corriendo siempre en `runtime: 'nodejs'` para los handlers con webhook. No es serverless, por tanto long-running es viable.
- Despliegue self-hosted tras Traefik en `doa.testn8n.com` (`docker-compose.yml:17`).
- n8n co-ubicado en el mismo dominio raiz (`testn8n.com`) → previsiblemente mismo VPS.
- HMAC bidireccional implementado: outbound `DOA_N8N_WEBHOOK_SECRET`, inbound `DOA_N8N_INBOUND_SECRET` (`lib/security/webhook.ts:35`).
- `lib/security/webhook.ts:39` declara explicitamente "there are no inbound webhooks yet".
- No hay cron in-app (no hay `node-cron`, no hay `app/api/cron/*`).
- Supabase es la unica base de datos; no hay Redis/BullMQ.

**Supuestos no verificados** (hipotesis del estudio):
- Que n8n corre en el mismo VPS. Podria estar en otro host alcanzable via `sswebhook.testn8n.com`; no lo confirmo ningun fichero. Si estuviera remoto, el argumento "mismo host" se debilita y la opcion D (fallback) gana peso.
- Que el volumen de ejecuciones n8n es moderado (<10k/dia). No hay metricas disponibles.
- Que el equipo tiene appetito de asumir Gmail/Graph OAuth in-app (credenciales renovables, riesgo de revocacion).
- Que `pg_cron` esta disponible en el plan Supabase. Si no, hay que usar systemd timer en el VPS.

**Riesgos principales**:
- Migrar `DOA-Enviar-Entregables` sin cola outbound ni observabilidad equivalente = riesgo legal (Statement of Compliance no entregado = incumplimiento de SLA con cliente aeronautico).
- Eliminar workflows n8n in-use sin feature flag rompe clientes externos que ya recibieron URLs con dominio `sswebhook.testn8n.com` (WF2).
- La ausencia de IdP de maquina (no hay Vault/Doppler) significa que rotar `DOA_N8N_WEBHOOK_SECRET` requiere downtime coordinado. Este estudio no resuelve eso.

---

## 7. Appendix: fuentes consultadas

### Codigo
- `app/api/proyectos/[id]/transicion/route.ts` — disparo `DOA-Project-State-Change`
- `app/api/proyectos/[id]/enviar-entrega/route.ts` — disparo `DOA-Enviar-Entregables`
- `app/api/webhooks/project-state/route.ts` — proxy legacy project-state
- `app/api/webhooks/quotation-state/route.ts` — proxy quotation-state
- `app/api/webhooks/conteo-horas/route.ts` — proxy conteo-horas
- `app/api/consultas/[id]/documentos/route.ts` — proxy compliance-docs
- `app/api/consultas/[id]/quotation/route.ts` — proxy quotation-save
- `app/api/consultas/[id]/send-client/route.ts` — proxy send-client (WF3)
- `lib/security/webhook.ts` — verificador HMAC inbound
- `lib/signatures/hmac.ts` — firma HMAC de release
- `Dockerfile`, `docker-compose.yml`, `next.config.ts`, `package.json` — stack y despliegue

### Documentacion
- `docs/n8n-workflows/DOA-Project-State-Change.md`
- `docs/n8n-workflows/DOA-Enviar-Entregables.md`
- `01. Soporte_App/n8n-workflows/ARQUITECTURA_N8N.md`
- `docs/06-estado-actual.md` (secciones Sprint 3 / Phase 9)
- `docs/02-bases-de-datos.md` (tabla de integraciones externas)
- `docs/04-como-añadir-cosas.md`
- `CLAUDE.md` (stack y reglas)

### Workflows exportados (JSON)
- `01. Soporte_App/n8n-workflows/DOA - 0 - Outlook a App _Correos Entrantes_.json`
- `01. Soporte_App/n8n-workflows/DOA - Web Server Formularios Clientes (Dinámico).json`
- `01. Soporte_App/n8n-workflows/DOA - Receptor Formularios Clientes (POST).json`
- `01. Soporte_App/n8n-workflows/DOA - Enviar Correo al Cliente.json`
- `01. Soporte_App/n8n-workflows/DOA-Formulario-Cliente-Interactivo.json`
- `01. Soporte_App/n8n-workflows/DOA-Formulario-Cliente.json`
- `01. Soporte_App/n8n-workflows/DOA-Formulario-Cliente-Nativo.json`
