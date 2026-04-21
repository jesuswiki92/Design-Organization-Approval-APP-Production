# Guia del Project - DOA Operations Hub

## Que es esta aplicacion?

DOA Operations Hub es una herramienta internal para el equipo de DOA (Design Organisation Approval) bajo la normativa EASA Part 21J. Sirve para gestionar el dia a dia del departamento de ingenieria:

- **Cotizaciones y quotes**: recibir requests de clients, prepare presupuestos
- **Projects de ingenieria**: seguimiento de projects activos, documents, tareas
- **Clients**: base de data de clients con sus contacts
- **Aircraft**: catalogo de models de aircraft con los que trabajamos
- **Asistente IA**: un chat experto que ayuda con dudas tecnicas

Es como un "centro de operaciones" digital donde todo el equipo puede ver que esta pasando con cada project y cada client.

---

## Tecnologia que usamos

Aqui explicamos cada herramienta y por que la elegimos:

| Tecnologia | Que es | Por que la usamos |
|------------|--------|-------------------|
| **Next.js** | Un "framework" (estructura base) para construir aplicaciones website. Piensa en el como los cimientos y la estructura de una casa. | Nos permite crear tanto las paginas que ves en el navegador como la logica del servidor, todo en un solo project. |
| **React** | Una libreria (coleccion de tools) para construir interfaces de user_label. | Nos permite crear la interfaz como piezas de Lego: cada boton, cada table, cada form es una pieza que se puede reutilizar. |
| **Supabase** | Nuestra base de data y sistema de autenticacion (login). Es como una hoja de calculo muy potente en la nube. | Guarda todos los data (clients, projects, quotes) y gestiona quien puede entrar a la app. |
| **Tailwind CSS** | Un sistema para dar estilo y diseno a las paginas. En vez de escribir CSS clasico, usamos clases cortas directamente en el HTML. | Permite disenar rapido sin salir del codigo del componente. |
| **shadcn/ui** | Una coleccion de componentes visuales ya hechos: botones, dialogos, pestanas, tablas, etc. | No tenemos que disenar cada boton desde cero. Son componentes bonitos y accesibles que ya funcionan. |
| **OpenRouter** | Un servicio que nos conecta con models de inteligencia artificial. | Lo usamos para el "Experto IA", un chat donde puedes hacer preguntas tecnicas y recibir responses inteligentes. |
| **n8n** | Una plataforma de automatizaciones. Piensa en ella como "robots" que hacen tareas repetitivas. | Procesa emails entrantes de clients automaticamente y los convierte en requests dentro de la app. Tambien envia responses por email. |
| **Zustand** | Una libreria pequena para gestionar el "status" de la interfaz (que pestana esta abierta, que filtro esta is_active, etc.). | Mantiene sincronizada la informacion entre diferentes partes de la pantalla sin complicaciones. |

---

## Estructura de carpetas

A continuacion explicamos que hay en cada folder y para que sirve.

### `app/` — Las paginas de la aplicacion

En Next.js, cada folder dentro de `app/` se convierte en una page website (una URL). Asi es como esta organizado:

| Folder / Archivo | URL que crea | Que ve el user_label | Data que necesita |
|-------------------|-------------|-------------------|-------------------|
| `app/page.tsx` | `/` | Redirige automaticamente a `/home` | Ninguno |
| `app/login/` | `/login` | Page de started_at de sesion con email y contrasena | Supabase Auth |
| `app/home/` | `/home` | Panel primary (dashboard) con resumen general | Estadisticas generales |
| `app/engineering/` | `/engineering` | Page indice visible como `Projects` con tablero y lista mock | Ninguno (es un menu) |
| `app/engineering/portfolio/` | `/engineering/portfolio` | Lista de todos los projects de ingenieria con filtros | `doa_general_projects`, `doa_clients`, `doa_aircraft_models` |
| `app/engineering/projects/[id]/` | `/engineering/projects/123` | Espacio de trabajo de un project individual: documents, tareas, detalles | `doa_general_projects`, `doa_projects_documentos`, `doa_projects_tareas`, `doa_usuarios` |
| `app/quotations/` | `/quotations` | Workspace de quotations con selector `Tablero` / `Lista` | `doa_ofertas`, `doa_incoming_requests`, `doa_clients` |
| `app/quotations/[id]/` | `/quotations/456` | Detalle de una quotation con bloques preparados para crecer | Data mock de quotations mientras no exista backend final |
| `app/quotations/incoming/[id]/` | `/quotations/incoming/456` | Detalle de una request entrante especifica: email original, data del client, response IA | `doa_incoming_requests`, `doa_clients` |
| `app/clients/` | `/clients` | Gestion de clients: lista, search, detalles y contacts | `doa_clients`, `doa_client_contacts` |
| `app/databases/` | `/databases` | Navegador de tablas: permite ver todas las tablas de la base de data | Catalogo de tablas (`lib/databases.ts`) |
| `app/databases/[table]/` | `/databases/nombre_tabla` | Vista de los data de una table especifica en formato table | Data dinamicos segun la table seleccionada |
| `app/tools/` | `/tools` | Seccion de tools | Ninguno (es un menu) |
| `app/tools/expert/` | `/tools/expert` | Chat con el asistente de IA experto | OpenRouter API |

> **Nota sobre `[id]` y `[table]`**: Los corchetes significan que es una path "dinamica". Es decir, el valor cambia. Por ejemplo, `/engineering/projects/123` muestra el project numero 123, y `/engineering/projects/456` muestra el 456.

> **Nota actual sobre `Engineering`**: En la interfaz visible, esta seccion se presenta como `Projects`. El name technical de la path sigue siendo `engineering`.

---

### `components/` — Piezas reutilizables de la interfaz

Los "componentes" son como piezas de Lego. En vez de escribir el mismo boton 50 veces, lo creamos una vez como componente y lo usamos donde haga falta. Si algun dia queremos cambiar como se ve el boton, lo cambiamos en un solo sitio y se actualiza en toda la app.

#### `components/layout/` — Estructura visual

Estos componentes forman la "carcasa" de la aplicacion, lo que siempre esta visible:

- **`Sidebar.tsx`** — El menu de navegacion lateral izquierdo. Tiene los enlaces a cada seccion (Home, Engineering, Quotations, Clients, etc.).
- **`TopBar.tsx`** — La barra superior con el title de la page actual y controles generales.

#### `components/ui/` — Componentes base (shadcn/ui)

Estos son componentes visuales genericos que vienen de la libreria shadcn/ui. Son los "ladrillos basicos":

- `button.tsx` — Botones
- `dialog.tsx` — Ventanas emergentes (popups)
- `tabs.tsx` — Pestanas
- `table.tsx` — Tablas
- `input.tsx` — Campos de text
- `badge.tsx` — Etiquetas pequenas (como "Active", "Pending")
- Y muchos mas...

> No necesitas modificar estos archivos normalmente. Son componentes estandar.

#### `components/workflow/` — Gestion de statuses

- **`WorkflowStateChanger.tsx`** — Un componente que permite cambiar el status de una quote o project (por ejemplo, de "Borrador" a "Enviada" a "Accepted"). Muestra los statuses posibles y permite hacer la transicion.

#### `components/project/` — Workspace de project

Componentes especificos para la page de un project individual:

- **`ProjectWorkspaceClient.tsx`** — El componente primary que organiza todo el workspace del project
- **`Header.tsx`** — Cabecera del project con title, status y acciones
- **`DocumentsTable.tsx`** — Table con los documents del project
- **`ExpertPanel.tsx`** — Panel lateral con el asistente IA contextualizado al project

---

### `lib/` — Logica y utilidades

Esta folder contiene codigo que NO es visual, sino logica de negocio y conexiones:

- **`lib/supabase/`** — Conexion a la base de data Supabase
  - `server.ts` — Conexion desde el servidor (para las APIs)
  - `client.ts` — Conexion desde el navegador (para las paginas)
- **`lib/workflow-states.ts`** — Define la "maquina de statuses": que statuses puede tener una quote o project, y que transiciones son validas (por ejemplo, una quote no puede pasar de "Borrador" a "Completada" directamente).
- **`lib/databases.ts`** — Catalogo de tablas para el navegador de bases de data (`/databases`). Define que tablas se muestran y como se llaman.
- **`lib/utils.ts`** — Funciones de utilidad generales (formatear dates, combinar clases CSS, etc.).
- **`lib/app-release.ts`** — Registro de la version actual de la aplicacion.

---

### `types/` — Definiciones de data

- **`database.ts`** — Contiene todas las "definiciones de tipos" de TypeScript. Esto es como un diccionario que dice "un Client tiene: name (text), CIF (text), country (text), etc.". Ayuda a que el codigo no tenga errores porque siempre sabemos que forma tienen los data.

---

### `app/api/` — Rutas del servidor (APIs)

Las APIs son "puertas traseras" de la aplicacion. No las ve el user_label directamente, pero las paginas las usan para hacer operaciones:

- **`/api/workflow/transition`** — Endpoint reservado para la transicion de status de quotes o projects. En el status actual devuelve `503`, asi que no debe considerarse operativo todavia.
- **`/api/tools/chat`** — Gestiona el chat con la IA. Envia tu pregunta a OpenRouter y devuelve la response.
- **`/api/incoming-requests/[id]/send-client`** — Envia un email de response al client. Llama al webhook de n8n que se encarga de send el email real.

---

### `supabase/` — Migraciones de base de data

Aqui hay archivos SQL (el lenguaje de las bases de data). Cada archivo es una "migracion": un cambio que se hizo a la estructura de la base de data.

Por ejemplo, una migracion podria ser "crear la table de clients" o "anadir la columna phone a la table de contacts". Se guardan en sort_order para poder reproducir la base de data desde cero si fuera necesario.

---

### Otros archivos importantes

| Archivo | Para que sirve |
|---------|---------------|
| `proxy.ts` (middleware) | Protege las rutas de la app. Si no has iniciado sesion, te redirige a `/login`. Sin esto, cualquiera podria acceder. |
| `package.json` | Lista todas las dependencias (librerias externas) del project. Cuando ejecutas `npm install`, lee este archivo para saber que instalar. |
| `.env.local` | Contiene las claves secretas y configuracion (URLs de Supabase, claves API, etc.). **NUNCA compartas este archivo ni lo subas a Git.** |
| `next.config.ts` | Configuracion de Next.js (como se comporta el framework). |
| `globals.css` | Estilos CSS globales que aplican a toda la aplicacion. |
| `components.json` | Configuracion de shadcn/ui (de donde se instalan los componentes). |
| `docker-compose.yml` | Configuracion para ejecutar la app en Docker (contenedores). |
| `deploy.sh` | Script para desplegar la aplicacion en el servidor. |

---

## Como funciona el flujo primary

El flujo mas importante de la aplicacion es el de **requests entrantes**. Funciona asi:

1. **Un client envia un email** pidiendo un presupuesto o haciendo una request technical.

2. **n8n (la automatizacion) procesa el email** automaticamente:
   - Lee el email
   - Extrae la informacion relevante (subject, sender, contenido)
   - Usa IA para clasificar la request y prepare un borrador de response
   - Crea un registro en la table `doa_incoming_requests`

3. **La app muestra la request** en la seccion `/quotations` como una "request entrante" new.

4. **Un ingeniero del equipo la revisa**:
   - Abre el detalle de la request (`/quotations/incoming/[id]`)
   - Ve el email original, la classification automatica y la response sugerida por la IA
   - Puede editar la response o escribir una new
   - Hace clic en "Send al client"

5. **La app envia la response** a traves de n8n (que gestiona el send real del email).

6. **El status cambia** para reflejar el progreso: la request pasa de "New" a "Respondida", y si se genera una quote, esta sigue su propio flujo de statuses (Borrador -> Enviada -> Accepted/Rejected).

---

## Variables de entorno necesarias

Estas se configuran en el archivo `.env.local` en la raiz del project. **Son secretas** — nunca las compartas.

| Variable | Que es | Ejemplo |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | La URL de tu project en Supabase. Es la address donde esta tu base de data. | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La clave publica de Supabase. Permite que la app se conecte a la base de data (con permisos limitados). | `eyJhbGci...` (text largo) |
| `OPENROUTER_API_KEY` | Clave para conectarse a OpenRouter (el servicio de IA). Sin esto, el chat experto no funciona. | `sk-or-v1-...` |
| `NEXT_PUBLIC_APP_URL` | La URL donde corre tu aplicacion. En desarrollo es localhost. | `http://localhost:3000` |

> **Nota**: Las variables que empiezan con `NEXT_PUBLIC_` son visibles en el navegador. Las que NO tienen ese prefijo solo estan disponibles en el servidor (mas seguras para claves sensibles).

### Como configurarlas

1. Copia el archivo `.env.example` (si existe) o crea un archivo new llamado `.env.local`
2. Rellena cada variable con los valores reales
3. Reinicia la aplicacion (`npm run dev`) para que tome los cambios

---

## Indice de documentacion

| Document | Contenido |
|-----------|-----------|
| `docs/01-guia-project.md` | Mapa completo del project (este archivo) |
| `docs/02-bases-de-data.md` | Inventario de tablas y plan de reconexion |
| `docs/03-flujo-requests.md` | Flujo de requests entrantes y status actual de Quotations |
| `docs/04-como-añadir-cosas.md` | Recetas para cambios comunes |
| `docs/05-buenas-practicas.md` | Reglas de codigo |
| `docs/06-status-actual.md` | Status funcional actual de la app |

---

## Documentacion estrategica (referencia)

La folder `estrategia_base_datos_proyecto/` contiene la vision a largo plazo para integrar search de precedentes tecnicos en quotations:
- Roadmap de 7 fases de implementacion
- Ejemplo de estructura de project historical (B30_058)
- Filosofia de testing y criterios de exito

> **Nota:** Estos documents describen planes FUTUROS, no status actual. Consultar `docs/06-status-actual.md` para el status funcional real.
