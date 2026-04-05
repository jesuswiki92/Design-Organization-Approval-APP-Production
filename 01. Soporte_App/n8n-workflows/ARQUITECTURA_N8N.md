# Arquitectura de Workflows n8n — DOA (Design Organization Approval)

## Visión General

El sistema DOA utiliza n8n como motor de automatización para gestionar todo el ciclo de vida de las consultas de clientes aeronáuticos. La arquitectura se divide en **workflows independientes** que se comunican entre sí a través de **URLs dinámicas con IDs de Supabase** y **webhooks**.

---

## Mapa de Workflows

```
┌─────────────────────────────────────┐
│   WF1: Correos Entrantes            │
│   (Trigger: Outlook cada 1 min)     │
│                                     │
│   Outlook → IA Clasifica → Prepara  │
│   Ruta → IA Redacta → Normaliza →   │
│   Supabase INSERT → Marcar Leído    │
│                                     │
│   Output: URL con ID embebido       │
│   enviada al cliente por email      │
└──────────────┬──────────────────────┘
               │
               │ (El cliente hace clic en la URL
               │  horas/días después)
               ▼
┌─────────────────────────────────────┐
│   WF2: Web Server Formularios       │
│   (Trigger: Webhook GET /doa-form)  │
│                                     │
│   Webhook → Supabase GET consulta → │
│   Supabase GET contacto →           │
│   Supabase GET empresa →            │
│   Google Drive HTML → Inyectar →    │
│   Responder HTML al navegador       │
│                                     │
│   Output: Formulario HTML           │
│   personalizado en el navegador     │
└──────────────┬──────────────────────┘
               │
               │ (El cliente llena y envía 
               │  el formulario)
               ▼
┌─────────────────────────────────────┐
│   WF3: Enviar Correo al Cliente     │
│   (Trigger: Llamada desde App)      │
│                                     │
│   Recibe payload → Supabase UPDATE  │
│   → Outlook envía correo            │
│                                     │
│   Output: Email enviado al cliente  │
└─────────────────────────────────────┘
```

---

## WF1: DOA - 0 - Outlook a App (Correos Entrantes)

**ID:** `pEFW1V46yyLR58c8`  
**Trigger:** Microsoft Outlook Trigger (polling cada 1 minuto, correos no leídos)  
**Estado:** Activo en producción  

### Cadena de Nodos (Versión Activa / Producción)

```
Outlook Trigger
    → Clasificar Correo IA (OpenAI GPT-5.2)
        → Preparar Ruta (Code JS)
            → Redactar Respuesta IA (OpenAI GPT-5.2)
                → Normalizar Correo (Code JS)
                    → Edit Fields (Set)
                        → Insertar en Supabase (INSERT doa_consultas_entrantes)
                            → Marcar Correo como Leído (Outlook Update)
```

### Cadena de Nodos (Versión Draft / En desarrollo)

```
Outlook Trigger
    → Clasificar Correo IA
        → Switch (Clasificación)
            ├─ Proyecto Nuevo ──┐
            └─ Modificación ────┤
                                ▼
                            Merge
                                → Crear fila en entrantes (Supabase INSERT)
                                    → Filtro Correo entrante (Set: extrae ID de Supabase)
                                        → Ver si el cliente es conocido (Supabase GET doa_clientes_contactos)
                                            → Actualizar Fila entrantes (Supabase UPDATE)
                                                → Switch1 (¿Cliente conocido?)
                                                    ├─ Conocido → Get a row1 (empresa) → Datos empresa (Set) → Generar URL Formulario → Redactar Respuesta IA → Normalizar → Edit Fields → Insertar Supabase → Marcar Leído
                                                    └─ No Conocido → Generar URL Formulario → ...
```

### Nodo Clave: "Preparar Ruta" (Code JS)

Este nodo centraliza toda la lógica de clasificación y enrutamiento:

- **Input:** Payload crudo de OpenAI con la clasificación
- **Lógica:**
  - Parsea el JSON de la IA (con fallback robusto para múltiples formatos)
  - Normaliza la clasificación a una de 3 etiquetas canónicas:
    - `Cliente solicita proyecto nuevo`
    - `Cliente solicita modificacion a proyecto existente`  
    - `Clasificacion pendiente`
  - Asigna `form_variant` (tipo de formulario) y `route_instruction` (instrucción operativa para la IA redactora)
  - **Genera la URL pública del formulario** con el dominio de producción

- **Output:** Objeto limpio con: `asunto`, `remitente`, `cuerpo_original`, `clasificacion_canonica`, `razon_clasificacion`, `form_variant`, `route_instruction`, `public_form_url`

### Nodo Clave: "Generar URL Formulario" (Set)

- **Expresión:** `={{ 'https://sswebhook.testn8n.com/webhook/doa-form?id=' + $('Filtro Correo entrante').first().json.id.supabase.doa.consultas.entrantes }}`
- **Propósito:** Construye la URL dinámica que conecta WF1 con WF2 a través del ID de Supabase

### Tablas Supabase Involucradas

| Tabla | Operación | Propósito |
|-------|-----------|-----------|
| `doa_consultas_entrantes` | INSERT | Guardar cada correo entrante clasificado |
| `doa_clientes_contactos` | GET | Buscar si el remitente es un contacto conocido |
| `doa_clientes_datos_generales` | GET | Obtener datos de la empresa del contacto |

### Credenciales Utilizadas

- **Microsoft Outlook OAuth2** (`LWbjIUOv0OUB6zRO`)
- **OpenAI API** (`vAmNhoKH5n8YHlp6`) — Modelo: GPT-5.2
- **Supabase API** (`H1ZHvBDstWZ1K6KS`)
- **Google Drive OAuth2** (`q2a47wq7RmewYPQG`)

---

## WF2: DOA - Web Server Formularios Clientes (Dinámico)

**ID:** `GCLA8OK26yNr90cd`  
**Trigger:** Webhook GET en `/webhook/doa-form`  
**URL Producción:** `https://sswebhook.testn8n.com/webhook/doa-form`  
**Estado:** Activo en producción  

### Cadena de Nodos

```
Webhook Servidor GET (recibe ?id=xxx)
    → Buscar Consulta (Supabase GET doa_consultas_entrantes por id)
        → Buscar Contacto (Supabase GET doa_clientes_contactos por email del remitente)
            → Buscar Empresa (Supabase GET doa_clientes_datos_generales por cliente_id)
                → Descargar Plantilla HTML (Google Drive: formulario_cliente_conocido.txt)
                    → Extraer Texto HTML (Extract from File → texto plano)
                        → Inyectar Datos en HTML (Code JS)
                            → Responder Navegador (Respond to Webhook con Content-Type: text/html)
```

### Nodo Clave: "Inyectar Datos en HTML" (Code JS)

Reemplaza placeholders en la plantilla HTML:

| Placeholder | Dato | Fuente |
|-------------|------|--------|
| `{{CLIENT_COMPANY_NAME}}` | Nombre de la empresa | Nodo "Buscar Empresa" |
| `{{CLIENT_CONTACT_FULL_NAME}}` | Nombre + Apellidos | Nodo "Buscar Contacto" |
| `{{CLIENT_CONTACT_EMAIL}}` | Email del contacto | Nodo "Buscar Contacto" |
| Campo oculto `consulta_id` | ID de la consulta | Query param del Webhook (`?id=xxx`) |

### Patrón de Comunicación con WF1

```
WF1 genera URL: https://sswebhook.testn8n.com/webhook/doa-form?id={UUID}
                                                                    │
WF2 Webhook recibe ─────────────────────────────────────────────────┘
    → Extrae: $json.query.id
    → Usa ese ID para buscar en Supabase
    → Sirve HTML personalizado
```

---

## WF3: DOA - Enviar Correo al Cliente

**Trigger:** Webhook (llamado desde la aplicación React)  
**Propósito:** Envía el correo final al cliente después de que un humano apruebe el borrador de la IA.

### Cadena de Nodos

```
Webhook (recibe payload con id, email, asunto, cuerpo)
    → Normalizar Payload Envio (Code JS)
        → Supabase UPDATE doa_consultas_entrantes (estado → "enviado")
            → Outlook Send Email
```

### Nodo Clave: "Update a row" (Supabase)

- **Match por:** columna `id` usando `consulta_id` del payload
- **Campos actualizados:** `estado`, `respuesta_enviada`, `fecha_envio`

---

## Tablas Supabase (Schema Completo)

### `doa_consultas_entrantes`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK, auto) | Identificador único de la consulta |
| `asunto` | text | Asunto del correo |
| `remitente` | text | Email del remitente |
| `cuerpo_original` | text | Preview del cuerpo del correo |
| `clasificacion` | text | Clasificación canónica de la IA |
| `respuesta_ia` | text | Borrador de respuesta generado por IA |
| `estado` | text | Estado del ciclo: nuevo, enviado, completado |
| `created_at` | timestamptz | Fecha de creación |

### `doa_clientes_contactos`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK) | ID del contacto |
| `email` | text | Email del contacto (clave de búsqueda) |
| `nombre` | text | Nombre del contacto |
| `apellidos` | text | Apellidos del contacto |
| `cliente_id` | UUID (FK) | Referencia a doa_clientes_datos_generales |

### `doa_clientes_datos_generales`
| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID (PK) | ID de la empresa |
| `nombre` | text | Nombre de la empresa |
| `cif_vat` | text | CIF/VAT de la empresa |
| `pais` | text | País |
| `ciudad` | text | Ciudad |
| `direccion` | text | Dirección |
| `telefono` | text | Teléfono |
| `web` | text | Sitio web |
| `dominio_email` | text | Dominio de email corporativo |
| `tipo_cliente` | text | Tipo de cliente |

---

## Plantillas HTML (Google Drive)

| Archivo | ID Google Drive | Uso |
|---------|-----------------|-----|
| `formulario_cliente_conocido.txt` | `1Clb0bv9zeGTRcBdLEHKAoO6cBCelx-pS` | Formulario para clientes ya registrados en la base de datos |

### Placeholders disponibles en el HTML

- `{{CLIENT_COMPANY_NAME}}` — Nombre de la empresa
- `{{CLIENT_CONTACT_FULL_NAME}}` — Nombre completo del contacto
- `{{CLIENT_CONTACT_EMAIL}}` — Email del contacto
- Campo oculto `consulta_id` — Se inyecta dinámicamente con el UUID de la consulta

---

## URLs y Endpoints

| Endpoint | Método | Workflow | Propósito |
|----------|--------|----------|-----------|
| `/webhook/doa-form` | GET | WF2 | Servir formulario HTML al cliente |
| Dominio: `sswebhook.testn8n.com` | — | Producción webhooks | Base URL para webhooks de producción |
| Dominio: `ssn8n.testn8n.com` | — | Test webhooks | Base URL para webhooks de desarrollo/test |

---

## Restricciones y Lecciones Aprendidas

1. **Trim obligatorio en emails:** Los emails de Outlook vienen con espacios invisibles. Siempre usar `.trim()` antes de buscar en Supabase.
2. **Nodo HTML de n8n ≠ servidor HTML:** El nodo "HTML" de n8n sirve para *extraer* datos de HTML, NO para servir páginas web. Usar "Respond to Webhook" con Content-Type `text/html`.
3. **Variables con puntos en n8n:** Si nombras una variable `id.supabase.doa`, n8n la convierte en un objeto anidado (`json.id.supabase.doa`), NO en una clave con puntos literales. Acceder con notación de puntos, no con corchetes.
4. **Webhook URLs:** El dominio de producción para webhooks es `sswebhook.testn8n.com`, diferente al dominio de la interfaz `ssn8n.testn8n.com`.
5. **API de n8n para schema del Switch:** La API de n8n rechaza payloads del Switch si faltan campos internos como `version`, `id`, etc. Es más seguro hacer cambios en el Switch desde la interfaz visual.
6. **responseMode del Webhook:** Para servir HTML, el Webhook debe usar `responseMode: "responseNode"` y tener un nodo "Respond to Webhook" al final de la cadena.

---

## Pendientes / Roadmap

1. **WF4: Receptor de Formularios (POST)** — Workflow con Webhook POST que reciba los datos que el cliente llena en el formulario HTML y actualice `doa_consultas_entrantes` en Supabase.
2. **Rama "Cliente No Conocido"** — Implementar lógica para clientes nuevos no registrados en la base de datos (onboarding).
3. **Formulario para modificaciones** — Crear plantilla HTML diferenciada para solicitudes de modificación de proyectos existentes.
4. **Activación en producción** — Migrar las URLs de test a las URLs de producción definitivas cuando el servidor n8n se estabilice.
