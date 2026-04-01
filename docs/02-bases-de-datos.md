# Bases de Datos - Inventario Completo

## Estado actual

Este documento es el inventario de TODAS las tablas de la base de datos (Supabase) que usa la aplicacion. Durante la reestructuracion del proyecto, las conexiones a estas tablas se han "desconectado" temporalmente. Se iran reconectando una por una segun se necesiten.

**Que significa cada estado:**
- ⏸️ **Desconectada** — La tabla existe en Supabase con sus datos, pero el codigo de la app todavia no la esta usando (o se desconecto durante la reestructuracion).
- 🔌 **Reconectando** — Se esta trabajando en reconectar esta tabla.
- ✅ **Activa** — La tabla esta conectada y funcionando en la app.

---

## Tablas activas (doa_*)

Estas son las tablas que la aplicacion realmente usa. Todas empiezan con el prefijo `doa_` (por Design Organisation Approval).

### Clientes

| Tabla | Para que sirve | Usada en | Estado |
|-------|----------------|----------|--------|
| `doa_clientes_datos_generales` | Datos maestros de cada cliente: nombre de la empresa, CIF (identificacion fiscal), pais, ciudad, y tipo de cliente. Es como la "ficha" principal de cada cliente. | /clients, /engineering/portfolio, /quotations | ⏸️ Desconectada |
| `doa_clientes_contactos` | Las personas de contacto de cada cliente: nombre, email, cargo que ocupa, y si es el contacto principal. Un cliente puede tener varios contactos. | /clients | ⏸️ Desconectada |

### Proyectos

| Tabla | Para que sirve | Usada en | Estado |
|-------|----------------|----------|--------|
| `doa_proyectos_generales` | Los proyectos de ingenieria: numero de proyecto, titulo, estado actual, presupuesto asignado, horas estimadas. Es la tabla central de cada proyecto. | /engineering/portfolio, /engineering/projects/[id], /quotations | ⏸️ Desconectada |
| `doa_proyectos_documentos` | Documentos asociados a un proyecto: tipo de documento (informe, plano, etc.), version, estado de revision, y URL donde esta guardado el archivo. | /engineering/projects/[id] | ⏸️ Desconectada |
| `doa_proyectos_tareas` | Tareas dentro de un proyecto: titulo de la tarea, quien es el responsable, prioridad (alta, media, baja), y estado (pendiente, en progreso, completada). | /engineering/projects/[id] | ⏸️ Desconectada |
| `doa_proyectos_hitos` | Hitos (milestones) de un proyecto: descripcion del hito, fecha prevista para completarlo, y si ya esta completado o no. Los hitos son los "puntos clave" del proyecto. | /databases (solo en el navegador de tablas) | ⏸️ Desconectada |
| `doa_proyectos_estado_historial` | Historial de cambios de estado de los proyectos. Cada vez que un proyecto cambia de estado (por ejemplo de "En progreso" a "En revision"), se guarda un registro aqui con la fecha, quien lo cambio, y el estado anterior y nuevo. | /api/workflow/transition | ⏸️ Desconectada |

### Cotizaciones / Ofertas

| Tabla | Para que sirve | Usada en | Estado |
|-------|----------------|----------|--------|
| `doa_ofertas` | Las ofertas o cotizaciones: numero de oferta, cliente asociado, estado actual (Borrador, Enviada, Aceptada, Rechazada), horas estimadas de trabajo. | /quotations, /api/workflow/transition | ⏸️ Desconectada |
| `doa_ofertas_estado_historial` | Historial de cambios de estado de las ofertas. Similar al historial de proyectos: guarda cada transicion con fecha y detalle. | /api/workflow/transition | ⏸️ Desconectada |
| `doa_consultas_entrantes` | Las consultas que llegan de clientes por email. Cada registro tiene: asunto del email, remitente, contenido, clasificacion automatica (hecha por IA), y la respuesta sugerida por la IA. Es el punto de entrada del flujo principal. | /quotations, /quotations/incoming/[id] | ✅ Conectada |

### Aeronaves

| Tabla | Para que sirve | Usada en | Estado |
|-------|----------------|----------|--------|
| `doa_aeronaves_modelos` | Catalogo de modelos de aeronave: fabricante (Airbus, Boeing, etc.), familia (A320, 737, etc.), y modelo especifico. Se usa para asociar proyectos con las aeronaves sobre las que se trabaja. | /engineering/portfolio, /engineering/projects/[id] | ⏸️ Desconectada |

### Usuarios

| Tabla | Para que sirve | Usada en | Estado |
|-------|----------------|----------|--------|
| `doa_usuarios` | Los usuarios internos del equipo DOA: nombre completo, email, rol dentro del equipo (ingeniero, jefe de proyecto, etc.), y titulo profesional. | /engineering/portfolio, /engineering/projects/[id] | ⏸️ Desconectada |

### Solo visibles en el navegador de tablas (/databases)

Estas tablas existen en la base de datos y se pueden ver desde la seccion `/databases`, pero no tienen un tipo TypeScript definido (es decir, el codigo no sabe exactamente que columnas tienen).

| Tabla | Para que sirve | Usada en | Estado |
|-------|----------------|----------|--------|
| `doa_solicitudes` | Solicitudes internas. No tiene tipo TypeScript definido, por lo que solo se puede explorar visualmente desde el navegador de tablas. | /databases (solo navegador) | ⏸️ Desconectada |
| `doa_aeronaves_registro` | Registro de aeronaves individuales (no modelos, sino aeronaves concretas con matricula). No tiene tipo TypeScript definido. | /databases (solo navegador) | ⏸️ Desconectada |
| `doa_aeronaves_tcds` | TCDs (Type Certificate Data Sheets) de aeronaves. Son los certificados de tipo emitidos por la autoridad. No tiene tipo TypeScript definido. | /databases (solo navegador) | ⏸️ Desconectada |

---

## Tablas legacy (doa_new_*)

Las tablas legacy `doa_new_*` ya fueron eliminadas de Supabase y no forman parte del esquema activo. Si vuelven a aparecer en algun entorno, deben tratarse como deriva de esquema y no como parte soportada por la app.

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
