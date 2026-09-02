/** URL canónica del sitio en producción */
export const SITE_URL = "https://artema.cl";

/** Mismo número que en Footer (WhatsApp) */
export const WHATSAPP_E164 = "56922384216";

export function whatsappHref(message?: string) {
  const text =
    message ??
    "Hola ARTEMA, quiero cotizar un producto.";
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(text)}`;
}
