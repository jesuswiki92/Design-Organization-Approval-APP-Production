# Guia del Proyecto - DOA Operations Hub

## Que es esta aplicacion?

DOA Operations Hub es una herramienta interna para el equipo de DOA (Design Organisation Approval) bajo la normativa EASA Part 21J. Sirve para gestionar el dia a dia del departamento de ingenieria:

- **Cotizaciones y ofertas**: recibir consultas de clientes, preparar presupuestos
- **Proyectos de ingenieria**: seguimiento de proyectos activos, documentos, tareas
- **Clientes**: base de datos de clientes con sus contactos
- **Aeronaves**: catalogo de modelos de aeronave con los que trabajamos
- **Asistente IA**: un chat experto que ayuda con dudas tecnicas

Es como un "centro de operaciones" digital donde todo el equipo puede ver que esta pasando con cada proyecto y cada cliente.

---

## Tecnologia que usamos

Aqui explicamos cada herramienta y por que la elegimos:

| Tecnologia | Que es | Por que la usamos |
|------------|--------|-------------------|
| **Next.js** | Un "framework" (estructura base) para construir aplicaciones web. Piensa en el como los cimientos y la estructura de una casa. | Nos permite crear tanto las paginas que ves en el navegador como la logica del servidor, todo en un solo proyecto. |
| **React** | Una libreria (coleccion de herramientas) para construir interfaces de usuario. | Nos permite crear la interfaz como piezas de Lego: cada boton, cada tabla, cada formulario es una pieza que se puede reutilizar. |
| **Supabase** | Nuestra base de datos y sistema de autenticacion (login). Es como una hoja de calculo muy potente en la nube. | Guarda todos los datos (clientes, proyectos, ofertas) y gestiona quien puede entrar a la app. |
| **Tailwind CSS** | Un sistema para dar estilo y diseno a las paginas. En vez de escribir CSS clasico, usamos clases cortas directamente en el HTML. | Permite disenar rapido sin salir del codigo del componente. |
| **shadcn/ui** | Una coleccion de componentes visuales ya hechos: botones, dialogos, pestanas, tablas, etc. | No tenemos que disenar cada boton desde cero. Son componentes bonitos y accesibles que ya funcionan. |
| **OpenRouter** | Un servicio que nos conecta con modelos de inteligencia artificial. | Lo usamos para el "Experto IA", un chat donde puedes hacer preguntas tecnicas y recibir respuestas inteligentes. |
| **n8n** | Una plataforma de automatizaciones. Piensa en ella como "robots" que hacen tareas repetitivas. | Procesa emails entrantes de clientes automaticamente y los convierte en consultas dentro de la app. Tambien envia respuestas por email. |
| **Zustand** | Una libreria pequena para gestionar el "estado" de la interfaz (que pestana esta abierta, que filtro esta activo, etc.). | Mantiene sincronizada la informacion entre diferentes partes de la pantalla sin complicaciones. |

---

## Estructura de carpetas

A continuacion explicamos que hay en cada carpeta y para que sirve.

### `app/` — Las paginas de la aplicacion

En Next.js, cada carpeta dentro de `app/` se convierte en una pagina web (una URL). Asi es como esta organizado:

| Carpeta / Archivo | URL que crea | Que ve el usuario | Datos que necesita |
|-------------------|-------------|-------------------|-------------------|
| `app/page.tsx` | `/` | Redirige automaticamente a `/home` | Ninguno |
| `app/login/` | `/login` | Pagina de inicio de sesion con email y contrasena | Supabase Auth |
| `app/home/` | `/home` | Panel principal (dashboard) con resumen general | Estadisticas generales |
| `app/engineering/` | `/engineering` | Pagina indice visible como `Proyectos` con tablero y lista mock | Ninguno (es un menu) |
| `app/engineering/portfolio/` | `/engineering/portfolio` | Lista de todos los proyectos de ingenieria con filtros | `doa_proyectos_generales`, `doa_clientes_datos_generales`, `doa_aeronaves_modelos` |
| `app/engineering/projects/[id]/` | `/engineering/projects/123` | Espacio de trabajo de un proyecto individual: documentos, tareas, detalles | `doa_proyectos_generales`, `doa_proyectos_documentos`, `doa_proyectos_tareas`, `doa_usuarios` |
| `app/quotations/` | `/quotations` | Workspace de quotations con selector `Tablero` / `Lista` | `doa_ofertas`, `doa_consultas_entrantes`, `doa_clientes_datos_generales` |
| `app/quotations/[id]/` | `/quotations/456` | Detalle de una quotation con bloques preparados para crecer | Datos mock de quotations mientras no exista backend final |
| `app/quotations/incoming/[id]/` | `/quotations/incoming/456` | Detalle de una consulta entrante especifica: email original, datos del cliente, respuesta IA | `doa_consultas_entrantes`, `doa_clientes_datos_generales` |
| `app/clients/` | `/clients` | Gestion de clientes: lista, busqueda, detalles y contactos | `doa_clientes_datos_generales`, `doa_clientes_contactos` |
| `app/databases/` | `/databases` | Navegador de tablas: permite ver todas las tablas de la base de datos | Catalogo de tablas (`lib/databases.ts`) |
| `app/databases/[table]/` | `/databases/nombre_tabla` | Vista de los datos de una tabla especifica en formato tabla | Datos dinamicos segun la tabla seleccionada |
| `app/tools/` | `/tools` | Seccion de herramientas | Ninguno (es un menu) |
| `app/tools/experto/` | `/tools/experto` | Chat con el asistente de IA experto | OpenRouter API |

> **Nota sobre `[id]` y `[table]`**: Los corchetes significan que es una ruta "dinamica". Es decir, el valor cambia. Por ejemplo, `/engineering/projects/123` muestra el proyecto numero 123, y `/engineering/projects/456` muestra el 456.

> **Nota actual sobre `Engineering`**: En la interfaz visible, esta seccion se presenta como `Proyectos`. El nombre tecnico de la ruta sigue siendo `engineering`.

---

### `components/` — Piezas reutilizables de la interfaz

Los "componentes" son como piezas de Lego. En vez de escribir el mismo boton 50 veces, lo creamos una vez como componente y lo usamos donde haga falta. Si algun dia queremos cambiar como se ve el boton, lo cambiamos en un solo sitio y se actualiza en toda la app.

#### `components/layout/` — Estructura visual

Estos componentes forman la "carcasa" de la aplicacion, lo que siempre esta visible:

- **`Sidebar.tsx`** — El menu de navegacion lateral izquierdo. Tiene los enlaces a cada seccion (Home, Engineering, Quotations, Clients, etc.).
- **`TopBar.tsx`** — La barra superior con el titulo de la pagina actual y controles generales.

#### `components/ui/` — Componentes base (shadcn/ui)

Estos son componentes visuales genericos que vienen de la libreria shadcn/ui. Son los "ladrillos basicos":

- `button.tsx` — Botones
- `dialog.tsx` — Ventanas emergentes (popups)
- `tabs.tsx` — Pestanas
- `table.tsx` — Tablas
- `input.tsx` — Campos de texto
- `badge.tsx` — Etiquetas pequenas (como "Activo", "Pendiente")
- Y muchos mas...

> No necesitas modificar estos archivos normalmente. Son componentes estandar.

#### `components/workflow/` — Gestion de estados

- **`WorkflowStateChanger.tsx`** — Un componente que permite cambiar el estado de una oferta o proyecto (por ejemplo, de "Borrador" a "Enviada" a "Aceptada"). Muestra los estados posibles y permite hacer la transicion.

#### `components/project/` — Workspace de proyecto

Componentes especificos para la pagina de un proyecto individual:

- **`ProjectWorkspaceClient.tsx`** — El componente principal que organiza todo el workspace del proyecto
- **`Header.tsx`** — Cabecera del proyecto con titulo, estado y acciones
- **`DocumentsTable.tsx`** — Tabla con los documentos del proyecto
- **`ExpertPanel.tsx`** — Panel lateral con el asistente IA contextualizado al proyecto

---

### `lib/` — Logica y utilidades

Esta carpeta contiene codigo que NO es visual, sino logica de negocio y conexiones:

- **`lib/supabase/`** — Conexion a la base de datos Supabase
  - `server.ts` — Conexion desde el servidor (para las APIs)
  - `client.ts` — Conexion desde el navegador (para las paginas)
- **`lib/workflow-states.ts`** — Define la "maquina de estados": que estados puede tener una oferta o proyecto, y que transiciones son validas (por ejemplo, una oferta no puede pasar de "Borrador" a "Completada" directamente).
- **`lib/databases.ts`** — Catalogo de tablas para el navegador de bases de datos (`/databases`). Define que tablas se muestran y como se llaman.
- **`lib/utils.ts`** — Funciones de utilidad generales (formatear fechas, combinar clases CSS, etc.).
- **`lib/app-release.ts`** — Registro de la version actual de la aplicacion.

---

### `types/` — Definiciones de datos

- **`database.ts`** — Contiene todas las "definiciones de tipos" de TypeScript. Esto es como un diccionario que dice "un Cliente tiene: nombre (texto), CIF (texto), pais (texto), etc.". Ayuda a que el codigo no tenga errores porque siempre sabemos que forma tienen los datos.

---

### `app/api/` — Rutas del servidor (APIs)

Las APIs son "puertas traseras" de la aplicacion. No las ve el usuario directamente, pero las paginas las usan para hacer operaciones:

- **`/api/workflow/transition`** — Cambia el estado de una oferta o proyecto. Cuando el usuario hace clic en "Enviar oferta", la pagina llama a esta API, que valida la transicion y la guarda en la base de datos.
- **`/api/tools/chat`** — Gestiona el chat con la IA. Envia tu pregunta a OpenRouter y devuelve la respuesta.
- **`/api/consultas/[id]/send-client`** — Envia un email de respuesta al cliente. Llama al webhook de n8n que se encarga de enviar el email real.

---

### `supabase/` — Migraciones de base de datos

Aqui hay archivos SQL (el lenguaje de las bases de datos). Cada archivo es una "migracion": un cambio que se hizo a la estructura de la base de datos.

Por ejemplo, una migracion podria ser "crear la tabla de clientes" o "anadir la columna telefono a la tabla de contactos". Se guardan en orden para poder reproducir la base de datos desde cero si fuera necesario.

---

### Otros archivos importantes

| Archivo | Para que sirve |
|---------|---------------|
| `proxy.ts` (middleware) | Protege las rutas de la app. Si no has iniciado sesion, te redirige a `/login`. Sin esto, cualquiera podria acceder. |
| `package.json` | Lista todas las dependencias (librerias externas) del proyecto. Cuando ejecutas `npm install`, lee este archivo para saber que instalar. |
| `.env.local` | Contiene las claves secretas y configuracion (URLs de Supabase, claves API, etc.). **NUNCA compartas este archivo ni lo subas a Git.** |
| `next.config.ts` | Configuracion de Next.js (como se comporta el framework). |
| `globals.css` | Estilos CSS globales que aplican a toda la aplicacion. |
| `components.json` | Configuracion de shadcn/ui (de donde se instalan los componentes). |
| `docker-compose.yml` | Configuracion para ejecutar la app en Docker (contenedores). |
| `deploy.sh` | Script para desplegar la aplicacion en el servidor. |

---

## Como funciona el flujo principal

El flujo mas importante de la aplicacion es el de **consultas entrantes**. Funciona asi:

1. **Un cliente envia un email** pidiendo un presupuesto o haciendo una consulta tecnica.

2. **n8n (la automatizacion) procesa el email** automaticamente:
   - Lee el email
   - Extrae la informacion relevante (asunto, remitente, contenido)
   - Usa IA para clasificar la consulta y preparar un borrador de respuesta
   - Crea un registro en la tabla `doa_consultas_entrantes`

3. **La app muestra la consulta** en la seccion `/quotations` como una "consulta entrante" nueva.

4. **Un ingeniero del equipo la revisa**:
   - Abre el detalle de la consulta (`/quotations/incoming/[id]`)
   - Ve el email original, la clasificacion automatica y la respuesta sugerida por la IA
   - Puede editar la respuesta o escribir una nueva
   - Hace clic en "Enviar al cliente"

5. **La app envia la respuesta** a traves de n8n (que gestiona el envio real del email).

6. **El estado cambia** para reflejar el progreso: la consulta pasa de "Nueva" a "Respondida", y si se genera una oferta, esta sigue su propio flujo de estados (Borrador -> Enviada -> Aceptada/Rechazada).

---

## Variables de entorno necesarias

Estas se configuran en el archivo `.env.local` en la raiz del proyecto. **Son secretas** — nunca las compartas.

| Variable | Que es | Ejemplo |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | La URL de tu proyecto en Supabase. Es la direccion donde esta tu base de datos. | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La clave publica de Supabase. Permite que la app se conecte a la base de datos (con permisos limitados). | `eyJhbGci...` (texto largo) |
| `OPENROUTER_API_KEY` | Clave para conectarse a OpenRouter (el servicio de IA). Sin esto, el chat experto no funciona. | `sk-or-v1-...` |
| `NEXT_PUBLIC_APP_URL` | La URL donde corre tu aplicacion. En desarrollo es localhost. | `http://localhost:3000` |

> **Nota**: Las variables que empiezan con `NEXT_PUBLIC_` son visibles en el navegador. Las que NO tienen ese prefijo solo estan disponibles en el servidor (mas seguras para claves sensibles).

### Como configurarlas

1. Copia el archivo `.env.example` (si existe) o crea un archivo nuevo llamado `.env.local`
2. Rellena cada variable con los valores reales
3. Reinicia la aplicacion (`npm run dev`) para que tome los cambios
