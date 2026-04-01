// ⏸️ BASE DE DATOS DESCONECTADA - ver BASES-DE-DATOS.md para reconectar
import { redirect } from 'next/navigation'

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await params // consume the promise to avoid Next.js warnings

  // No hay datos - base de datos desconectada
  redirect('/engineering/portfolio')
}
