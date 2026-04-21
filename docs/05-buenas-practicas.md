# Buenas Practicas de Desarrollo

Reglas que seguimos en este proyecto. Estan pensadas para mantener el codigo limpio, predecible y facil de ampliar por lotes pequenos.

Estas reglas se apoyan en la documentacion ya existente del repo:

- `docs/01-guia-proyecto.md` para entender la estructura
- `docs/02-bases-de-datos.md` para saber que tablas estan activas, desconectadas o pendientes
- `docs/03-flujo-consultas.md` para el flujo comercial actual
- `docs/04-como-anadir-cosas.md` para recetas de cambio
- `docs/06-estado-actual.md` para saber que esta vivo de verdad hoy

---

## Estructura de archivos

### Regla: servidor vs cliente
- `page.tsx` = componente del servidor. Aqui se cargan datos, autenticacion y estado inicial
- `NombreClient.tsx` = componente del cliente. Aqui va la interfaz interactiva
- No mezclar: no poner queries de Supabase en componentes cliente, ni `useState` o `useEffect` en `page.tsx`

### Regla: un archivo, una responsabilidad
- Cada componente en su propio archivo
- Las constantes de estado van en `lib/workflow-states.ts`
- Las utilidades compartidas van en `lib/`
- Las utilidades de Supabase van en `lib/supabase/`

### Regla: antes de crear, intentar encajar
- Antes de abrir una carpeta nueva, revisar si el cambio encaja en `app/`, `components/`, `lib/`, `store/`, `types/` o `supabase/`
- Si el cambio afecta a una feature concreta, ampliar su carpeta actual antes que crear una variante paralela
- No abrir una segunda documentacion para el mismo tema si ya existe un doc en `docs/`

---

## Regla principal para modificar esta app

### Regla: la documentacion existente manda
Antes de tocar codigo, revisar el doc que ya describe esa zona:

- `docs/06-estado-actual.md` para confirmar si la superficie esta activa, mock o incompleta
- `docs/04-como-anadir-cosas.md` para cambios habituales de paginas, APIs, estados y webhooks
- `docs/02-bases-de-datos.md` para saber si una tabla esta activa, desconectada o pendiente de migracion
- `docs/03-flujo-consultas.md` si el cambio toca `Quotations`, consultas entrantes o n8n

Si el codigo y el doc no coinciden, primero aclarar la discrepancia y actualizar el doc correcto.

### Regla: tocar el recorrido completo de la feature
En esta app, una misma funcionalidad suele repartirse entre varios puntos. Antes de editar, revisar el circuito completo:

- Ruta `page.tsx` en `app/`
- Componente `*Client.tsx` asociado
- Helpers locales de la feature
- Utilidades compartidas en `lib/`
- Tipos implicados en `types/database.ts`
- API route si hay persistencia o integracion externa

Ejemplo real de `Quotations`:
- `app/(dashboard)/quotations/page.tsx`
- `app/(dashboard)/quotations/QuotationsClient.tsx`
- `app/(dashboard)/quotations/QuotationStatesBoard.tsx`
- `app/(dashboard)/quotations/quotation-board-data.ts`
- `lib/workflow-states.ts`
- `lib/workflow-state-config.ts`
- `app/api/workflow/state-config/route.ts`

### Regla: mantener la separacion server/client
- `page.tsx` y `route.ts` resuelven datos, autenticacion e integraciones
- `*Client.tsx` resuelve interaccion, estado local y UX
- No mover queries o secretos al cliente para ahorrar tiempo

### Regla: colocar cada tipo donde toca
- Tipos de esquema, tablas y contratos compartidos: `types/database.ts`
- Tipos locales de una sola feature o vista: junto al archivo que los usa
- No duplicar la misma forma de datos en dos sitios con nombres distintos

### Regla: cambios pequenos, no reescrituras silenciosas
- Si existe un componente o helper que ya soporta el flujo, ampliarlo antes que reemplazarlo
- Evitar renombrar rutas, carpetas o estados tecnicos sin una necesidad real
- No mezclar refactor, cambio visual y cambio funcional grande en el mismo lote si se pueden separar
- Si el arbol git ya esta sucio, no pisar cambios ajenos sin entender primero si pertenecen al mismo frente

### Regla: degradacion controlada cuando falte base de datos
El repo ya asume que parte del esquema esta desconectado o pendiente de migracion.

- Si una tabla puede no existir, mantener fallback seguro
- Reutilizar `isMissingSchemaError` cuando aplique
- Si una pantalla esta hoy en mock, no prometer persistencia hasta reconectar la tabla correspondiente
- Si una migracion falta, reflejarlo tambien en `docs/02-bases-de-datos.md`

### Regla: workflows y estados se cambian por capa
Los estados visibles de `Quotations` y consultas no se tocan solo en un sitio.

- Codigo tecnico: `lib/workflow-states.ts`
- Overrides visuales y resolucion: `lib/workflow-state-config.ts`
- Persistencia: `app/api/workflow/state-config/route.ts`

Cambiar solo el label visible, el color o el orden no justifica renombrar `state_code`.

### Regla: integraciones externas siempre encapsuladas
- OpenRouter solo desde `app/api/tools/chat/route.ts`
- n8n solo desde API routes o puntos de servidor
- URLs y claves siempre desde entorno
- Si cambias payloads de webhook, documentarlo en el doc correspondiente

---

## Nombres y convenciones

| Que | Convencion | Ejemplo |
|-----|-----------|---------|
| Archivos de pagina | `page.tsx` | `app/(dashboard)/clients/page.tsx` |
| Componentes cliente | PascalCase + `Client` | `ClientsPageClient.tsx` |
| Archivos de utilidad | camelCase o kebab-case segun la feature ya existente | `incoming-queries.ts` |
| Variables CSS | kebab-case | `--color-primary` |
| Constantes | UPPER_SNAKE_CASE | `CONSULTA_ESTADOS` |
| Tipos TypeScript | PascalCase | `ConsultaEntrante` |
| Tablas Supabase | snake_case con prefijo `doa_` | `doa_consultas_entrantes` |

---

## Codigo limpio

### No hardcodear strings de estado
MAL:
```tsx
if (consulta.estado === 'nuevo') { ... }
```

BIEN:
```tsx
import { CONSULTA_ESTADOS } from '@/lib/workflow-states'

if (consulta.estado === CONSULTA_ESTADOS.NUEVO) { ... }
```

### No duplicar funciones
Si una funcion se usa en mas de un archivo, moverla a `lib/` o al helper compartido de la feature.

### No dejar codigo comentado
Si no se usa, se borra. Git ya guarda el historial.

### Errores con contexto
MAL:
```tsx
console.error(error)
```

BIEN:
```tsx
console.error('Error cargando consultas entrantes:', error)
```

### Preferir logs accionables
Cuando una zona tenga fallback controlado, el log debe dejar claro:

- que tabla o servicio fallo
- si la UI sigue con datos vacios o defaults
- si el error bloquea la funcionalidad o solo degrada la experiencia

### Variables de entorno para URLs externas
MAL:
```tsx
const url = 'https://mi-webhook.com/endpoint'
```

BIEN:
```tsx
const url = process.env.MI_WEBHOOK_URL!
```

---

## Supabase

### Siempre verificar autenticacion en APIs
Usar el helper centralizado `requireUserApi` de `@/lib/auth/require-user` en todas las API routes:

```tsx
import { requireUserApi } from '@/lib/auth/require-user'

export async function POST(request: Request) {
  const auth = await requireUserApi()
  if (auth instanceof Response) return auth
  const { user, supabase } = auth
  // ...
}
```

`requireUserApi` llama internamente a `createClient` de `@/lib/supabase/server`, hace `supabase.auth.getUser()` y devuelve `Response` 401 `{ error: 'Unauthorized' }` si no hay sesion. En server actions y server components, usar `requireUserAction` (misma firma pero hace `redirect('/login')` cuando no hay sesion).

### Proxy de rutas protegidas
El guard de rutas del dashboard vive en `proxy.ts` (raiz de `01.Desarrollo de App/`). En Next.js 16 el archivo DEBE llamarse `proxy.ts` y exportar una funcion llamada `proxy` — el antiguo nombre `middleware.ts` quedo deprecado y Next.js emite un warning en cada build si se usa. No renombrar. El matcher excluye `/_next/*`, `/favicon.ico`, recursos estaticos y `/api/*`; por eso la proteccion de API routes es responsabilidad de cada `route.ts` via `requireUserApi`.

Reglas que aplica `proxy.ts`:

- `/home`, `/engineering`, `/quotations`, `/clients`, `/databases`, `/tools` sin sesion -> 307 a `/login`
- `/login` con sesion valida -> 307 a `/home`
- Cualquier otra ruta (landing, publica) -> pasa sin verificar

### Usar `createClient` del servidor en `page.tsx`
```tsx
import { createClient } from '@/lib/supabase/server'
```

### Manejar errores de query
```tsx
const { data, error } = await supabase.from('tabla').select('*')

if (error) {
  console.error('Error en query de tabla:', error)
  return []
}
```

### Consultas en server components por defecto
- Si una pantalla del dashboard necesita datos iniciales, cargarlos en `page.tsx`
- Si la interaccion posterior necesita escritura, moverla a API route o server action cuando exista esa capa
- No duplicar la misma query en servidor y cliente sin una razon clara

---

## Estilos

- Usar Tailwind directamente y reutilizar patrones del repo antes que inventar un sistema nuevo
- Reutilizar `components/ui/` cuando un componente base ya exista
- Mantener el lenguaje visual claro que ya usa el dashboard: superficies, gradientes suaves y contraste legible
- Si el cambio es visual, comprobar la shell completa y no solo el componente aislado

---

## Antes de entregar cualquier cambio

1. El alcance es pequeno y localizado
2. Compila sin errores -> `npm run build`
3. Pasa lint -> `npm run lint`
4. No rompe rutas o proteccion basica -> `npm run smoke`
5. Los imports son correctos
6. Los strings de estado vienen de constantes o de la capa de config
7. La documentacion correspondiente en `docs/` se actualizo
8. Las URLs externas estan en variables de entorno

---

## Lo que conviene evitar en este repo

- Reintroducir tablas o nombres `doa_new_*` como si fueran runtime activo
- Tratar `Engineering` y `Proyectos` como dominios distintos en la UI actual; visualmente ya es `Proyectos`
- Meter logica comercial de `Quotations` dentro del workspace de `Proyectos`
- Crear mocks nuevos donde ya existe una superficie real conectada
- Tocar `proxy.ts` o `lib/supabase/server.ts` sin una razon concreta
- Renombrar `proxy.ts` a `middleware.ts`: Next.js 16 deprecó `middleware.ts` y emite warning; el nombre canonico es `proxy.ts` con export `proxy`
- Sobrescribir cambios locales ajenos en una rama de trabajo con el repo sucio

---

## Notas operativas

- No reutilizar `node_modules` copiado desde otro sistema operativo, porque puede dejar binarios nativos incorrectos y provocar errores como `Cannot find module '../lightningcss.linux-x64-gnu.node'`
- Ejecutar `npm install` en el entorno actual antes de validar con `npm run build` si hubo cambios de maquina o sistema operativo
