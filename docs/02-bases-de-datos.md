# Bases de Data - Inventario Completo

## Status actual

Este document resume las tablas de Supabase que la app usa hoy o tiene preparadas en su estructura actual. No mezcla el catalogo visible en la UI con el status real de las migraciones, para evitar afirmar que algo esta eliminado o is_active sin confirmarlo primero.

**Que significa cada status:**
- ⏸️ **Desconectada** — La table existe en Supabase con sus data, pero el codigo de la app todavia no la esta usando (o se desconecto durante la reestructuracion).
- 🔌 **Reconectando** — Se esta trabajando en reconectar esta table.
- ✅ **Activa** — La table esta conectada y funcionando en la app.

---

## Tablas activas actuales

Estas son las tablas públicas que siguen presentes y visibles en el project tras la limpieza del esquema a date 2026-04-01.

### Clients

| Table | Para que sirve | Usada en | Status |
|-------|----------------|----------|--------|
| `doa_clients` | Data maestros de cada client: name de la empresa, CIF (identificacion fiscal), country, city, y type de client. Es como la "ficha" primary de cada client. | /clients, /engineering/portfolio, /quotations | ✅ Conectada |
| `doa_client_contacts` | Las personas de contacto de cada client: name, email, job_title que ocupa, y si es el contacto primary. Un client puede tener varios contacts. | /clients | ⏸️ Desconectada |

### Projects

| Table | Para que sirve | Usada en | Status |
|-------|----------------|----------|--------|
| `doa_general_projects` | Los projects de ingenieria: numero de project, title, status actual, presupuesto asignado y horas estimadas. Es la table central de cada project. | /engineering/portfolio, /engineering/projects/[id] | ⏸️ Desconectada |
| `doa_historical_projects` | Registro historical de projects completados. Cada registro tiene: numero de project (unico), title, description, name del client, client_id (FK a `doa_clients`), status, year, path de origen en disco, name de la folder de origen, y timestamps. Se usa para consultar el portfolio historical. | /engineering/portfolio (historical) | ✅ Conectada |
| `doa_historical_project_documents` | Inventario documental de cada project historical. Cada registro vincula un project historical con una folder documental: sort_order documental, family documental, folder de origen, path de origen, archivo de referencia, total de archivos, formatos disponibles (text[]), y timestamps. Se elimina en cascada al borrar el project. | /engineering/portfolio (historical) | ✅ Conectada |

### Cotizaciones / Ofertas

| Table | Para que sirve | Usada en | Status |
|-------|----------------|----------|--------|
| `doa_incoming_requests` | Las requests que llegan de clients por email. Cada registro tiene: subject del email, sender, contenido, classification automatica (hecha por IA), response sugerida por la IA, status del workflow, borrador de response al client, y timestamps de send de email. Tambien incluye `form_url` (enlace al form de recopilacion de data del client) y columnas de aircraft: `tcds_number`, `aircraft_manufacturer`, `aircraft_model`, `aircraft_count`, `aircraft_msn`, `tcds_pdf_url`. Es el punto de entrada del flujo primary. | /quotations, /quotations/incoming/[id] | ✅ Conectada |

### Usuarios

| Table | Para que sirve | Usada en | Status |
|-------|----------------|----------|--------|
| `doa_usuarios` | Los users internos del equipo DOA: name completo, email, role dentro del equipo (ingeniero, jefe de project, etc.), y title profesional. | /engineering/portfolio, /engineering/projects/[id] | ⏸️ Desconectada |

### Chat, IA y tablas auxiliares visibles en `/databases`

Estas tablas existen en la base de data y se muestran en la sección `/databases`, aunque no formen parte aún del model tipado primary de la app.

| Table | Para que sirve | Usada en | Status |
|-------|----------------|----------|--------|
| `chat_sessions` | Sesiones de conversación persistidas para el asistente IA. | /databases | ⏸️ Desconectada |
| `chat_history` | Historial de mensajes por sesión de chat. | /databases | ⏸️ Desconectada |
| `salud_sintomas` | Table auxiliar usada en pruebas o classification de síntomas. | /databases | ⏸️ Desconectada |
| `DocumentacionCertificacion` | Corpus documental de certificación indexado para search. | /databases | ⏸️ Desconectada |
| `documents` | Metadatos de documents vectorizados del sistema RAG. | /databases | ⏸️ Desconectada |
| `doa_chunks` | Fragmentos indexados del corpus DOA para recuperación semántica. | /databases | ⏸️ Desconectada |

### Plantillas de compliance

| Table | Para que sirve | Usada en | Status |
|-------|----------------|----------|--------|
| `doa_compliance_templates` | Catalogo maestro de las 44 templates de documents de compliance (G12-xx, G18-xx). Cada registro tiene: code (unico), name, category, sort_order, active. Se usa para la seleccion de documentacion en requests entrantes y se reutilizara en projects. | /quotations/incoming/[id] (seccion "Definir documentacion") | ✅ Conectada |

### Forms dinamicos

| Table | Para que sirve | Usada en | Status |
|-------|----------------|----------|--------|
| `doa_formularios` | Plantillas HTML de los forms de recopilacion de data del client. PK `slug` (actualmente `cliente_conocido` y `cliente_desconocido`), columna `html` con el document completo y placeholders `{{...}}`, `description`, `created_at`, `updated_at` (trigger auto). RLS con lectura anon para permitir fetch desde el webhook n8n. Reemplaza la descarga desde Google Drive. | Workflow n8n `AMS - Web Server Forms Clients (Dinamico)` (webhook `sswebhook.testn8n.com/webhook/doa-form`) | ✅ Activa |

### Configuracion de workflow

| Table | Para que sirve | Usada en | Status |
|-------|----------------|----------|--------|
| `doa_workflow_state_config` | Overrides persistidos para el label visible, el color y el sort_order de los statuses del workflow. | /quotations, `app/api/workflow/state-config/route.ts` | ⚠️ Pending de migracion en este repo |

---

## Tablas legacy (doa_new_*)

Las tablas legacy `doa_new_*` ya fueron eliminadas de Supabase y no forman parte del esquema is_active. Si vuelven a aparecer en algun entorno, deben tratarse como deriva de esquema y no como parte soportada por la app.

## Tablas de soporte del workflow

Estas tablas siguen apareciendo en las migraciones del repositorio y no deben tratarse como eliminadas del esquema mientras ese status se mantenga:

- `doa_project_status_history`
- `doa_quote_status_history`
- `doa_workflow_state_config` (pending de migracion en este repo)
- `doa_form_responses` — Respuestas de forms de clients, con FK cascade a `doa_incoming_requests`

## Tablas eliminadas del esquema público

Estas tablas aparecian en documentación o en catálogos antiguos del project, pero ya no forman parte del esquema público actual:

- `doa_projects_documentos`
- `doa_projects_tareas`
- `doa_projects_hitos`
- `doa_ofertas`
- `doa_aircraft_models`
- `doa_aircraft_registro`
- `doa_aircraft_tcds`
- `doa_solicitudes`
- `doa_request_form_links` — Eliminada en migracion `202604021950` (reemplazada por flujo externo)
- `doa_request_form_responses` — Eliminada en migracion `202604021950` (reemplazada por flujo externo)

## Nota sobre migraciones del repositorio

Las migraciones actuales del repo son estas:

- `001_initial_schema.sql` — Esquema inicial (tablas `doa_new_*`, ya eliminadas)
- `202603281710_project_and_quotation_states.sql` — Columnas de status en projects y quotes, tablas de historial de statuses
- `202603291840_incoming_requests_estado.sql` — Columna `status` y campos de email en `doa_incoming_requests`
- `202604010800_drop_legacy_doa_new_tables.sql` — Eliminacion de tablas legacy `doa_new_*`
- `202604021305_app_hosted_client_project_forms.sql` — Tablas `doa_request_form_links` y `doa_request_form_responses` (luego eliminadas)
- `202604021833_add_form_url_to_incoming_requests.sql` — Columna `form_url` en `doa_incoming_requests`
- `202604021950_drop_app_hosted_forms_tables.sql` — Eliminacion de `doa_request_form_links` y `doa_request_form_responses`
- `202604031630_cascade_delete_form_responses_on_consulta.sql` — FK cascade en `doa_form_responses` hacia `doa_incoming_requests`
- `202604031700_doa_historical_projects.sql` — Creacion de table `doa_historical_projects`
- `202604031810_add_client_id_to_doa_historical_projects.sql` — Columna `client_id` (FK a `doa_clients`) en `doa_historical_projects`
- `202604031820_add_origin_metadata_to_doa_historical_projects.sql` — Columnas `year`, `source_path`, `source_folder_name` en `doa_historical_projects`
- `202604031830_add_doa_document_inventory_to_historico.sql` — Creacion de table `doa_historical_project_documents` (inventario documental)
- `202604031830_add_doa_documentos_to_historical_projects.sql` — Variante alternativa de la table de documents del historical

No existe todavia una migracion que cree `public.doa_workflow_state_config`.

Las columnas de aircraft en `doa_incoming_requests` (`tcds_number`, `aircraft_manufacturer`, `aircraft_model`, `aircraft_count`, `aircraft_msn`, `tcds_pdf_url`) existen en el esquema de Supabase y en los tipos TypeScript pero no tienen migracion en este repositorio.

---

## Servicios externos

Ademas de las tablas, la aplicacion se conecta a estos servicios:

| Servicio | Para que sirve | Donde se configura |
|----------|---------------|-------------------|
| **Supabase Auth** | Gestiona el started_at de sesion (login) y las sesiones de user_label. Controla quien puede entrar a la app. | Variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local` |
| **OpenRouter** | Conexion con models de inteligencia artificial. Es lo que hace funcionar el chat "Experto IA" en `/tools/expert`. | Variable `OPENROUTER_API_KEY` en `.env.local` |
| **n8n (webhook)** | Automatizacion para send emails a clients. Cuando un ingeniero responde a una request, la app llama a un webhook de n8n que envia el email real. | Variable `DOA_SEND_CLIENT_WEBHOOK_URL` en `.env.local` / entorno de despliegue. |

---

## Plan de reconexion

Orden recomendado para ir reconectando las tablas durante la reestructuracion. Se priorizan las que afectan al flujo primary (requests entrantes) y luego las demas:

1. 🔌 `doa_incoming_requests` — Es la table mas importante para el flujo primary. Sin ella, no se pueden ver las requests de clients.
2. 🔌 `doa_clients` — Necesaria para mostrar los data del client en las requests y en la seccion de clients.
3. 🔌 `doa_ofertas` — Para poder crear y gestionar cotizaciones a partir de las requests.
4. 🔌 `doa_general_projects` — Para el portfolio de projects y la creacion de nuevos projects.
5. 🔌 Resto de tablas segun necesidad:
   - `doa_client_contacts` — Cuando se trabaje en la gestion detallada de clients
   - `doa_projects_documentos` y `doa_projects_tareas` — Cuando se active el workspace de project
   - `doa_usuarios` — Cuando se necesite mostrar responsables y miembros del equipo
   - `doa_aircraft_models` — Cuando se necesite el catalogo de aircraft
   - `doa_quote_status_history` y `doa_project_status_history` — Cuando se active el sistema de workflow
   - `doa_projects_hitos`, `doa_solicitudes`, `doa_aircraft_registro`, `doa_aircraft_tcds` — Al final, ya que solo se usan en el navegador de tablas
