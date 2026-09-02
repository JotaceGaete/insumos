/**
 * Rutas públicas ya migradas al modelo de datos INSUMOS.
 * Se usa para que la carcasa global (header/footer/widgets) sepa
 * cuándo mostrar la identidad neutral INSUMOS en lugar de la legacy ARTEMA,
 * sin tener que reestructurar el layout raíz compartido.
 */
export function isInsumosRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/productos")) return true;
  if (pathname.startsWith("/producto/")) return true;
  if (pathname.startsWith("/categoria/")) return true;
  if (pathname.startsWith("/carrito")) return true;
  if (pathname.startsWith("/finalizar-compra")) return true;
  if (pathname.startsWith("/pedido/")) return true;
  if (pathname.startsWith("/pago/")) return true;
  if (pathname.startsWith("/iniciar-sesion")) return true;
  if (pathname.startsWith("/crear-cuenta")) return true;
  if (pathname.startsWith("/mi-cuenta")) return true;
  return false;
}
