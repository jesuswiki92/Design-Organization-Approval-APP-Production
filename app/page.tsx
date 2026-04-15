/**
 * ============================================================================
 * PAGINA RAIZ DE LA APLICACION (/)
 * ============================================================================
 *
 * Esta es la primera pagina que se carga cuando alguien abre la aplicacion
 * sin especificar una ruta concreta (por ejemplo: https://miapp.com/).
 *
 * Lo unico que hace es REDIRIGIR automaticamente a la pagina de inicio
 * (/home). Es decir, el usuario nunca ve esta pagina: en cuanto entra,
 * el navegador lo lleva directamente a /home.
 *
 * NOTA TECNICA: "redirect" es una funcion de Next.js que ejecuta la
 * redireccion en el servidor, antes de enviar nada al navegador.
 * ============================================================================
 */

import { redirect } from "next/navigation";

export default function RootPage() {
  // Redirigir al usuario automaticamente a la pagina de inicio (/home)
  redirect("/home");
}
