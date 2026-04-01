# Cómo Añadir Cosas a la Aplicación

Este documento es una guía paso a paso para las modificaciones más comunes. Está pensado para que una IA (o una persona) sepa exactamente qué archivos tocar y en qué orden.

---

## Añadir una nueva página

1. **Crear la carpeta** en `app/(dashboard)/tu-nueva-pagina/`
2. **Crear `page.tsx`** — este es el componente del servidor (carga datos)
3. **Crear `TuPaginaClient.tsx`** — este es el componente del cliente (interfaz interactiva)
4. **Añadir el enlace** en `components/layout/Sidebar.tsx`
5. **Protección**: La página ya está protegida por `proxy.ts` automáticamente si está dentro de `(dashboard)/`

### Plantilla básica de page.tsx (servidor)
```tsx
// ⏸️ BASE DE DATOS DESCONECTADA - ver docs/02-bases-de-datos.md para reconectar
import TopBar from '@/components/layout/TopBar'
import TuPaginaClient from './TuPaginaClient'

export default async function TuPaginaPage() {
  // Cuando se reconecte la base de datos, las queries irán aquí
  const datos: TuTipo[] = []

  return (
    <>
      <TopBar title="Tu Página" subtitle="Descripción breve" />
      <TuPaginaClient datos={datos} />
    </>
  )
}
```

### Plantilla básica de Client.tsx
```tsx
'use client'

interface Props {
  datos: TuTipo[]
}

export default function TuPaginaClient({ datos }: Props) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-zinc-100">Tu contenido aquí</h2>
    </div>
  )
}
```

---

## Añadir un nuevo estado a un flujo

1. **Abrir `lib/workflow-states.ts`**
2. Añadir el estado al objeto correspondiente (ej: `CONSULTA_ESTADOS`)
3. Añadir su configuración visual en el `_STATE_CONFIG` correspondiente
4. Definir las transiciones (desde qué estados se puede llegar, a qué estados puede ir)
5. Si necesitas lógica especial, actualizar el archivo de queries correspondiente

---

## Reconectar una base de datos

1. **Consultar `docs/02-bases-de-datos.md`** para ver qué tabla necesitas
2. **Abrir el `page.tsx`** de la página que la necesita
3. **Descomentar o añadir** la query de Supabase:
```tsx
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data, error } = await supabase
  .from('nombre_tabla')
  .select('*')
  .order('created_at', { ascending: false })

if (error) console.error('Error cargando datos:', error)
const datos = data ?? []
```
4. **Actualizar el estado** en `docs/02-bases-de-datos.md` de ⏸️ a ✅

---

## Añadir una nueva API (ruta del servidor)

1. **Crear carpeta** en `app/api/tu-ruta/`
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
   TU_WEBHOOK_URL=https://tu-instancia-n8n.com/webhook/nombre
   ```
2. **Crear la API route** siguiendo la plantilla de arriba
3. **Llamar al webhook** desde la API:
```tsx
const response = await fetch(process.env.TU_WEBHOOK_URL!, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* datos */ }),
})
```
4. **Documentar** en `docs/02-bases-de-datos.md` sección "Servicios externos"

---

## Añadir un nuevo componente shadcn/ui

```bash
npx shadcn@latest add nombre-componente
```
Esto creará el componente en `components/ui/`. Luego importar donde se necesite.
