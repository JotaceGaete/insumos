/** URL canónica del sitio en producción */
export const SITE_URL = "https://artesellos.cl";

/** Mismo número que en Footer (WhatsApp) */
export const WHATSAPP_E164 = "56922384216";

export function whatsappHref(message?: string) {
  const text =
    message ??
    "Hola Artesellos, quiero cotizar un timbre de goma personalizado.";
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(text)}`;
}
