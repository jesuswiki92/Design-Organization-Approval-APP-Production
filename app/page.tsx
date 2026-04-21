/**
 * ============================================================================
 * PAGINA RAIZ DE LA APLICACION (/)
 * ============================================================================
 *
 * Esta es la primera page que se carga cuando alguien abre la aplicacion
 * sin especificar una path concreta (por ejemplo: https://miapp.com/).
 *
 * Lo unico que hace es REDIRIGIR automaticamente a la page de started_at
 * (/home). Es decir, el user_label nunca ve esta page: en cuanto entra,
 * el navegador lo lleva directamente a /home.
 *
 * NOTA TECNICA: "redirect" es una funcion de Next.js que ejecuta la
 * redireccion en el servidor, antes de send nada al navegador.
 * ============================================================================
 */

import { redirect } from "next/navigation";

export default function RootPage() {
  // Redirigir al user_label automaticamente a la page de started_at (/home)
  redirect("/home");
}
