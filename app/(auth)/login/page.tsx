/**
 * ============================================================================
 * PAGINA DE INICIO DE SESION (LOGIN)
 * ============================================================================
 *
 * Esta pagina es la puerta de entrada a la aplicacion. El usuario debe
 * introducir su email y contrasena para acceder al DOA Operations Hub.
 *
 * QUE HACE:
 *   1. Muestra un formulario con campos de email y contrasena
 *   2. Cuando el usuario pulsa "Sign in", envia las credenciales a Supabase
 *   3. Si las credenciales son correctas, redirige a la pagina de inicio (/home)
 *   4. Si son incorrectas, muestra un mensaje de error en rojo
 *
 * FLUJO:
 *   Email + Password -> Supabase Auth -> Si OK -> /home
 *                                     -> Si Error -> Mensaje de error
 *
 * NOTA TECNICA: 'use client' porque necesita manejar el formulario,
 * los estados de carga/error y la autenticacion desde el navegador.
 * Usa createClient de @/lib/supabase/client (no server) porque esta
 * en el lado del cliente.
 * ============================================================================
 */

'use client'

// Hook de React para manejar estados (email, password, error, carga)
import { useState } from 'react'
// Conexion a Supabase desde el NAVEGADOR (no servidor)
import { createClient } from '@/lib/supabase/client'
// Hook de Next.js para navegar entre paginas
import { useRouter } from 'next/navigation'

/** Componente principal de la pagina de login */
export default function LoginPage() {
  // Estados del formulario: lo que el usuario escribe y el estado de la operacion
  const [email, setEmail] = useState('')         // Email que escribe el usuario
  const [password, setPassword] = useState('')   // Contrasena que escribe el usuario
  const [error, setError] = useState<string | null>(null) // Mensaje de error (si hay)
  const [loading, setLoading] = useState(false)  // Si se esta procesando el login
  const router = useRouter()                     // Para redirigir despues del login
  const supabase = createClient()                // Conexion a Supabase

  /**
   * Funcion que se ejecuta al enviar el formulario.
   * Intenta iniciar sesion con email y contrasena via Supabase Auth.
   */
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()    // Evitar que el formulario recargue la pagina
    setLoading(true)      // Mostrar estado "cargando"
    setError(null)        // Limpiar errores anteriores

    // Intentar autenticacion con Supabase
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // Si hay error: mostrar mensaje y permitir reintentar
      setError(error.message)
      setLoading(false)
    } else {
      // Si es exitoso: ir a la pagina de inicio
      router.push('/home')
      router.refresh()
    }
  }

  return (
    /* Pantalla completa con fondo oscuro y formulario centrado */
    <div className="min-h-screen flex items-center justify-center bg-[#0F1117]">
      <div className="w-full max-w-md">
        {/* === LOGO Y NOMBRE DE LA APLICACION === */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#6366F1] mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[#E8E9F0]">DOA Operations Hub</h1>
          <p className="text-sm text-[#6B7280] mt-1">Design Organization Approval</p>
        </div>

        {/* === TARJETA DEL FORMULARIO DE LOGIN === */}
        <div className="bg-[#1A1D27] border border-[#2A2D3E] rounded-xl p-8">
          <h2 className="text-lg font-semibold text-[#E8E9F0] mb-6">Sign in to your account</h2>

          {/* Formulario: al enviar ejecuta handleLogin */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Campo de email */}
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-lg px-3 py-2.5 text-sm text-[#E8E9F0] placeholder-[#6B7280] focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-colors"
                placeholder="engineer@doa.aero"
              />
            </div>
            {/* Campo de contrasena */}
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-[#0F1117] border border-[#2A2D3E] rounded-lg px-3 py-2.5 text-sm text-[#E8E9F0] placeholder-[#6B7280] focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {/* Mensaje de error: se muestra solo cuando hay un problema */}
            {error && (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-3 py-2.5 text-sm text-[#EF4444]">
                {error}
              </div>
            )}

            {/* Boton de envio: se deshabilita mientras se procesa */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors mt-2"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#6B7280] mt-6">
          Part 21J Design Organization — Internal workspace
        </p>
      </div>
    </div>
  )
}
