/**
 * ============================================================================
 * /f/[token] — placeholder del formulario público para clientes
 * ============================================================================
 *
 * Sub-Slice B. El correo enviado al cliente contiene un link tipo
 * `${NEXT_PUBLIC_APP_URL}/f/<uuid>`. Hasta que implementemos el formulario
 * real (slice futuro), esta página simplemente confirma que el enlace está
 * vivo y muestra el token recibido para depuración.
 * ============================================================================
 */

export default async function FormPlaceholderPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="font-[family-name:var(--font-heading)] text-3xl font-semibold text-[color:var(--ink)]">
        Formulario en preparación
      </h1>
      <p className="max-w-md text-sm text-[color:var(--ink-2)]">
        Estamos preparando el formulario para esta solicitud. En breve recibirás
        un nuevo enlace o podrás continuar desde aquí.
      </p>
      <p className="font-mono text-xs text-[color:var(--ink-3)]">{token}</p>
    </main>
  )
}

export const dynamic = 'force-dynamic'
