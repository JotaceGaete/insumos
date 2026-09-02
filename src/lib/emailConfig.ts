/**
 * Configuración del sistema de email
 * Maneja el modo receive_only vs active
 */

export const EMAIL_CONFIG = {
  MODE: (process.env.EMAIL_MODE || 'receive_only') as 'receive_only' | 'active',
  SUPPORT: process.env.EMAIL_SUPPORT || 'soporte@artema.cl',
  WHOLESALE: process.env.EMAIL_WHOLESALE || 'mayoristas@artema.cl',
  FROM: process.env.EMAIL_FROM || 'noreply@artema.cl',
} as const;

/**
 * Verifica si el sistema puede enviar emails
 */
export function canSendEmails(): boolean {
  return EMAIL_CONFIG.MODE === 'active';
}

/**
 * Genera un mailto: link con subject y body prellenados
 */
export function generateMailtoLink(
  to: string, 
  subject: string, 
  body: string = ''
): string {
  const params = new URLSearchParams();
  params.set('subject', subject);
  if (body) {
    params.set('body', body);
  }
  return `mailto:${to}?${params.toString()}`;
}

/**
 * Genera mailto para consulta de soporte
 */
export function generateSupportMailto(id: string | number): string {
  return generateMailtoLink(
    EMAIL_CONFIG.SUPPORT,
    `Consulta #${id}`,
    `Hola,\n\nMe comunico respecto a mi consulta #${id}.\n\n[Escribe tu mensaje aquí]\n\nSaludos.`
  );
}

/**
 * Genera mailto para solicitud mayorista
 */
export function generateWholesaleMailto(id: string | number): string {
  return generateMailtoLink(
    EMAIL_CONFIG.WHOLESALE,
    `Solicitud Mayorista #${id}`,
    `Hola,\n\nMe comunico respecto a mi solicitud mayorista #${id}.\n\n[Escribe tu mensaje aquí]\n\nSaludos.`
  );
}

// Log de configuración
console.log('📧 Email Config:', {
  mode: EMAIL_CONFIG.MODE,
  support: EMAIL_CONFIG.SUPPORT,
  wholesale: EMAIL_CONFIG.WHOLESALE,
  canSend: canSendEmails()
});
