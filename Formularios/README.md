# Formularios — reference copies only

Los ficheros HTML de este directorio son **copias de referencia**. El HTML que sirve la app en producción vive en la tabla `doa_forms` de Supabase. La ruta pública `/f/[token]` (ver `app/f/[token]/route.ts`) lee la columna `html` de esa tabla, resuelve placeholders y lo devuelve tal cual.

Cualquier edición real tiene que ir a la base de datos (vía Supabase MCP o el editor SQL). Editar aquí no propaga nada a la app desplegada.

Slugs disponibles (coinciden con `doa_forms.slug`):

- `cliente_conocido` — cliente ya identificado; menos campos, se rellena desde datos previos.
- `cliente_desconocido` — primer contacto; incluye sección de alta de cliente.

Si añades un nuevo slug: (1) inserta la fila en `doa_forms`, (2) amplía el CHECK correspondiente si aplica, (3) actualiza esta lista.
