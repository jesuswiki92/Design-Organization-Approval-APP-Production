# Bases de Datos - Inventario Completo

## Estado actual

Este documento resume las tablas de Supabase que la app usa hoy o tiene preparadas en su estructura actual. No mezcla el catalogo visible en la UI con el estado real de las migraciones, para evitar afirmar que algo esta eliminado o activo sin confirmarlo primero.

**Que significa cada estado:**
- ⏸️ **Desconectada** — La tabla existe en Supabase con sus datos, pero el codigo de la app todavia no la esta usando (o se desconecto durante la reestructuracion).
- 🔌 **Reconectando** — Se esta trabajando en reconectar esta tabla.
- ✅ **Activa** — La tabla esta conectada y funcionando en la app.

---

## Tablas activas actuales

Estas son las tablas públicas que siguen presentes y visibles en el proyecto tras la limpieza del esquema a fecha 2026-04-01.

### Clientes

| Tabla | Para que sirve | Usada en | Estado |
|-------|----------------|----------|--------|
| `doa_clientes_datos_generales` | Datos maestros de cada cliente: nombre de la empresa, CIF (identificacion fiscal), pais, ciudad, y tipo de cliente. Es como la "ficha" principal de cada cliente. | /clients, /engineering/portfolio, /quotations | ✅ Conectada |
| `doa_clientes_contactos` | Las personas de contacto de cada cliente: nombre, email, cargo que ocupa, y si es el contacto principal. Un cliente puede tener varios contactos. | /clients | ⏸️ Desconectada |

### Proyectos

| Tabla | Para que sirve | Usada en | Estado |
|-------|----------------|----------|--------|
| `doa_proyectos_generales` | Los proyectos de ingenieria: numero de proyecto, titulo, estado actual, presupuesto asignado y horas estimadas. Es la tabla central de cada proyecto. | /engineering/portfolio, /engineering/projects/[id] | ⏸️ Desconectada |
| `doa_proyectos_historico` | Registro historico de proyectos completados. Cada registro tiene: numero de proyecto (unico), titulo, descripcion, nombre del cliente, client_id (FK a `doa_clientes_datos_generales`), estado, anio, ruta de origen en disco, nombre de la carpeta de origen, y timestamps. Se usa para consultar el portfolio historico. | /engineering/portfolio (historico) | ✅ Conectada |
| `doa_proyectos_historico_documentos` | Inventario documental de cada proyecto historico. Cada registro vincula un proyecto historico con una carpeta documental: orden documental, familia documental, carpeta de origen, ruta de origen, archivo de referencia, total de archivos, formatos disponibles (text[]), y timestamps. Se elimina en cascada al borrar el proyecto. | /engineering/portfolio (historico) | ✅ Conectada |

### Cotizaciones / Ofertas

| Tabla | Para que sirve | Usada en | Estado |
|-------|----------------|----------|--------|
| `doa_consultas_entrantes` | Las consultas que llegan de clientes por email. Cada registro tiene: asunto del email, remitente, contenido, clasificacion automatica (hecha por IA), respuesta sugerida por la IA, estado del workflow, borrador de respuesta al cliente, y timestamps de envio de correo. Tambien incluye `url_formulario` (enlace al formulario de recopilacion de datos del cliente) y columnas de aeronave: `tcds_number`, `aircraft_manufacturer`, `aircraft_model`, `aircraft_count`, `aircraft_msn`, `tcds_pdf_url`. Es el punto de entrada del flujo principal. | /quotations, /quotations/incoming/[id] | ✅ Conectada |

### Usuarios

| Tabla | Para que sirve | Usada en | Estado |
|-------|----------------|----------|--------|
| `doa_usuarios` | Los usuarios internos del equipo DOA: nombre completo, email, rol dentro del equipo (ingeniero, jefe de proyecto, etc.), y titulo profesional. | /engineering/portfolio, /engineering/projects/[id] | ⏸️ Desconectada |

### Chat, IA y tablas auxiliares visibles en `/databases`

Estas tablas existen en la base de datos y se muestran en la sección `/databases`, aunque no formen parte aún del modelo tipado principal de la app.

| Tabla | Para que sirve | Usada en | Estado |
|-------|----------------|----------|--------|
| `chat_sessions` | Sesiones de conversación persistidas para el asistente IA. | /databases | ⏸️ Desconectada |
| `chat_history` | Historial de mensajes por sesión de chat. | /databases | ⏸️ Desconectada |
| `salud_sintomas` | Tabla auxiliar usada en pruebas o clasificación de síntomas. | /databases | ⏸️ Desconectada |
| `DocumentacionCertificacion` | Corpus documental de certificación indexado para búsqueda. | /databases | ⏸️ Desconectada |
| `documents` | Metadatos de documentos vectorizados del sistema RAG. | /databases | ⏸️ Desconectada |
| `doa_chunks` | Fragmentos indexados del corpus DOA para recuperación semántica. | /databases | ⏸️ Desconectada |

### Plantillas de compliance

| Tabla | Para que sirve | Usada en | Estado |
|-------|----------------|----------|--------|
| `doa_plantillas_compliance` | Catalogo maestro de las 44 plantillas de documentos de compliance (G12-xx, G18-xx). Cada registro tiene: code (unico), name, category, sort_order, active. Se usa para la seleccion de documentacion en consultas entrantes y se reutilizara en proyectos. | /quotations/incoming/[id] (seccion "Definir documentacion") | ✅ Conectada |

### Configuracion de workflow

| Tabla | Para que sirve | Usada en | Estado |
|-------|----------------|----------|--------|
| `doa_workflow_state_config` | Overrides persistidos para el label visible, el color y el orden de los estados del workflow. | /quotations, `app/api/workflow/state-config/route.ts` | ⚠️ Pendiente de migracion en este repo |

---

## Tablas legacy (doa_new_*)

Las tablas legacy `doa_new_*` ya fueron eliminadas de Supabase y no forman parte del esquema activo. Si vuelven a aparecer en algun entorno, deben tratarse como deriva de esquema y no como parte soportada por la app.

## Tablas de soporte del workflow

Estas tablas siguen apareciendo en las migraciones del repositorio y no deben tratarse como eliminadas del esquema mientras ese estado se mantenga:

- `doa_proyectos_estado_historial`
- `doa_ofertas_estado_historial`
- `doa_workflow_state_config` (pendiente de migracion en este repo)
- `doa_respuestas_formularios` — Respuestas de formularios de clientes, con FK cascade a `doa_consultas_entrantes`

## Tablas eliminadas del esquema público

Estas tablas aparecian en documentación o en catálogos antiguos del proyecto, pero ya no forman parte del esquema público actual:

- `doa_proyectos_documentos`
- `doa_proyectos_tareas`
- `doa_proyectos_hitos`
- `doa_ofertas`
- `doa_aeronaves_modelos`
- `doa_aeronaves_registro`
- `doa_aeronaves_tcds`
- `doa_solicitudes`
- `doa_consultas_form_links` — Eliminada en migracion `202604021950` (reemplazada por flujo externo)
- `doa_consultas_form_responses` — Eliminada en migracion `202604021950` (reemplazada por flujo externo)

## Nota sobre migraciones del repositorio

Las migraciones actuales del repo son estas:

- `001_initial_schema.sql` — Esquema inicial (tablas `doa_new_*`, ya eliminadas)
- `202603281710_project_and_quotation_states.sql` — Columnas de estado en proyectos y ofertas, tablas de historial de estados
- `202603291840_consultas_entrantes_estado.sql` — Columna `estado` y campos de correo en `doa_consultas_entrantes`
- `202604010800_drop_legacy_doa_new_tables.sql` — Eliminacion de tablas legacy `doa_new_*`
- `202604021305_app_hosted_client_project_forms.sql` — Tablas `doa_consultas_form_links` y `doa_consultas_form_responses` (luego eliminadas)
- `202604021833_add_url_formulario_to_consultas_entrantes.sql` — Columna `url_formulario` en `doa_consultas_entrantes`
- `202604021950_drop_app_hosted_forms_tables.sql` — Eliminacion de `doa_consultas_form_links` y `doa_consultas_form_responses`
- `202604031630_cascade_delete_form_responses_on_consulta.sql` — FK cascade en `doa_respuestas_formularios` hacia `doa_consultas_entrantes`
- `202604031700_doa_proyectos_historico.sql` — Creacion de tabla `doa_proyectos_historico`
- `202604031810_add_client_id_to_doa_proyectos_historico.sql` — Columna `client_id` (FK a `doa_clientes_datos_generales`) en `doa_proyectos_historico`
- `202604031820_add_origin_metadata_to_doa_proyectos_historico.sql` — Columnas `anio`, `ruta_origen`, `nombre_carpeta_origen` en `doa_proyectos_historico`
- `202604031830_add_doa_document_inventory_to_historico.sql` — Creacion de tabla `doa_proyectos_historico_documentos` (inventario documental)
- `202604031830_add_doa_documentos_to_proyectos_historico.sql` — Variante alternativa de la tabla de documentos del historico

No existe todavia una migracion que cree `public.doa_workflow_state_config`.

Las columnas de aeronave en `doa_consultas_entrantes` (`tcds_number`, `aircraft_manufacturer`, `aircraft_model`, `aircraft_count`, `aircraft_msn`, `tcds_pdf_url`) existen en el esquema de Supabase y en los tipos TypeScript pero no tienen migracion en este repositorio.

---

## Servicios externos

Ademas de las tablas, la aplicacion se conecta a estos servicios:

| Servicio | Para que sirve | Donde se configura |
|----------|---------------|-------------------|
| **Supabase Auth** | Gestiona el inicio de sesion (login) y las sesiones de usuario. Controla quien puede entrar a la app. | Variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local` |
| **OpenRouter** | Conexion con modelos de inteligencia artificial. Es lo que hace funcionar el chat "Experto IA" en `/tools/experto`. | Variable `OPENROUTER_API_KEY` en `.env.local` |
| **n8n (webhook)** | Automatizacion para enviar emails a clientes. Cuando un ingeniero responde a una consulta, la app llama a un webhook de n8n que envia el email real. | Variable `DOA_SEND_CLIENT_WEBHOOK_URL` en `.env.local` / entorno de despliegue. |

---

## Plan de reconexion

Orden recomendado para ir reconectando las tablas durante la reestructuracion. Se priorizan las que afectan al flujo principal (consultas entrantes) y luego las demas:

1. 🔌 `doa_consultas_entrantes` — Es la tabla mas importante para el flujo principal. Sin ella, no se pueden ver las consultas de clientes.
2. 🔌 `doa_clientes_datos_generales` — Necesaria para mostrar los datos del cliente en las consultas y en la seccion de clientes.
3. 🔌 `doa_ofertas` — Para poder crear y gestionar cotizaciones a partir de las consultas.
4. 🔌 `doa_proyectos_generales` — Para el portfolio de proyectos y la creacion de nuevos proyectos.
5. 🔌 Resto de tablas segun necesidad:
   - `doa_clientes_contactos` — Cuando se trabaje en la gestion detallada de clientes
   - `doa_proyectos_documentos` y `doa_proyectos_tareas` — Cuando se active el workspace de proyecto
   - `doa_usuarios` — Cuando se necesite mostrar responsables y miembros del equipo
   - `doa_aeronaves_modelos` — Cuando se necesite el catalogo de aeronaves
   - `doa_ofertas_estado_historial` y `doa_proyectos_estado_historial` — Cuando se active el sistema de workflow
   - `doa_proyectos_hitos`, `doa_solicitudes`, `doa_aeronaves_registro`, `doa_aeronaves_tcds` — Al final, ya que solo se usan en el navegador de tablas
