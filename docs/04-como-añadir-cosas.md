# Cómo Añadir Cosas a la Aplicación

Este document es una guía paso a paso para las modificaciones más comunes. Está pensado para que una IA (o una persona) sepa exactamente qué archivos tocar y en qué sort_order.

---

## Añadir una new page

1. **Crear la folder** en `app/(dashboard)/tu-new-page/`
2. **Crear `page.tsx`** — este es el componente del servidor (carga data)
3. **Crear `TuPaginaClient.tsx`** — este es el componente del client (interfaz interactiva)
4. **Añadir el enlace** en `components/layout/Sidebar.tsx`
5. **Protección**: La page ya está protegida por `proxy.ts` automáticamente si está dentro de `(dashboard)/`

### Plantilla básica de page.tsx (servidor)
```tsx
// ⏸️ BASE DE DATOS DESCONECTADA - ver docs/02-bases-de-data.md para reconectar
import TopBar from '@/components/layout/TopBar'
import TuPaginaClient from './TuPaginaClient'

export default async function TuPaginaPage() {
  // Cuando se reconecte la base de data, las queries irán aquí
  const data: TuTipo[] = []

  return (
    <>
      <TopBar title="Tu Page" subtitle="Description breve" />
      <TuPaginaClient data={data} />
    </>
  )
}
```

### Plantilla básica de Client.tsx
```tsx
'use client'

interface Props {
  data: TuTipo[]
}

export default function TuPaginaClient({ data }: Props) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-zinc-100">Tu contenido aquí</h2>
    </div>
  )
}
```

---

## Añadir un new status a un flujo

1. **Abrir `lib/workflow-states.ts`**
2. Añadir el status al objeto correspondiente (ej: `INCOMING_REQUEST_STATUSES`)
3. Añadir su configuración visual en el `_STATE_CONFIG` correspondiente
4. Definir las transiciones (desde qué statuses se puede llegar, a qué statuses puede ir)
5. Si necesitas lógica especial, actualizar el archivo de queries correspondiente

### Si solo quieres cambiar el name visible, color u sort_order

No cambies el valor technical del status.

- ✅ Sí: editar `label`, `short_label`, `description`, `color_token`, `sort_order`
- ❌ No: renombrar `state_code` como `new`, `awaiting_form`, `form_received`, etc.

La configuración visual se resuelve ahora así:

- **Defaults en código**: `lib/workflow-states.ts`
- **Overrides persistidos**: `public.doa_workflow_state_config` cuando la table existe en Supabase
- **Resolvedor común**: `lib/workflow-state-config.ts`
- **API segura de guardado**: `app/api/workflow/state-config/route.ts`

Regla clave: el workflow y Supabase siguen trabajando con el `state_code`; la app muestra el `label`.

Si la table `public.doa_workflow_state_config` no existe todavia, la capa de configuracion vuelve a defaults en codigo.

---

## Reconectar una base de data

1. **Consultar `docs/02-bases-de-data.md`** para ver qué table necesitas
2. **Abrir el `page.tsx`** de la page que la necesita
3. **Descomentar o añadir** la query de Supabase:
```tsx
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data, error } = await supabase
  .from('nombre_tabla')
  .select('*')
  .order('created_at', { ascending: false })

if (error) console.error('Error cargando data:', error)
const data = data ?? []
```
4. **Actualizar el status** en `docs/02-bases-de-data.md` de ⏸️ a ✅

---

## Añadir una new API (path del servidor)

1. **Crear folder** en `app/api/tu-path/`
2. **Crear `route.ts`** con el handler:
```tsx
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Verificar autenticación
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Tu lógica aquí
  const body = await request.json()

  return NextResponse.json({ ok: true })
}
```

---

## Añadir una conexión con n8n (webhook)

1. **Definir la URL** como variable de entorno en `.env.local`:
   ```
   TU_WEBHOOK_URL=https://tu-instancia-n8n.com/webhook/name
   ```
2. **Crear la API route** siguiendo la template de arriba
3. **Llamar al webhook** desde la API:
```tsx
const response = await fetch(process.env.TU_WEBHOOK_URL!, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* data */ }),
})
```
4. **Documentar** en `docs/02-bases-de-data.md` sección "Servicios externos"

> Ejemplo actual del project: `DOA_SEND_CLIENT_WEBHOOK_URL` para `app/api/incoming-requests/[id]/send-client/route.ts`

---

## Añadir un new componente shadcn/ui

```bash
npx shadcn@latest add name-componente
```
Esto creará el componente en `components/ui/`. Luego importar donde se necesite.
