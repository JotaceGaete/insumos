import type { OrderEmailData } from '../orderEmailData';

// Plain string templating on purpose — no JSX/React rendering pulled in for
// a one-shot HTML string. Email clients need inline styles and table-based
// layout regardless, so nothing here would benefit from React's diffing.
// The .tsx extension is kept only to match the module layout this feature
// was scoped with.

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
}

function formatOrderDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' }).format(new Date(iso));
}

function shortOrderId(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

const CARRIER_LABELS: Record<string, string> = {
  starken: 'Starken',
  chilexpress: 'Chilexpress',
  blue_express: 'Blue Express',
};

function deliverySummary(data: OrderEmailData): { deliveryLabel: string; shippingLine: string; shippingNote: string | null } {
  const deliveryLabel = data.deliveryMethod === 'store_pickup' ? 'Retiro en tienda' : 'Despacho';

  if (data.shippingPolicy === 'pickup') {
    return { deliveryLabel, shippingLine: 'Retiro en tienda — Gratis', shippingNote: null };
  }
  if (data.shippingPolicy === 'free') {
    return { deliveryLabel, shippingLine: 'Envío gratis', shippingNote: null };
  }
  return {
    deliveryLabel,
    shippingLine: 'Por pagar',
    shippingNote: 'El despacho se paga directamente al transportista.',
  };
}

export function renderOrderReceivedEmail(data: OrderEmailData): RenderedEmail {
  const orderCode = shortOrderId(data.orderId);
  const subject = `ARTEMA — Recibimos tu pedido #${orderCode}`;
  const documentLabel = data.billingDocumentType === 'factura' ? 'Factura' : 'Boleta';
  const { deliveryLabel, shippingLine, shippingNote } = deliverySummary(data);
  const carrierLabel = data.preferredCarrier ? CARRIER_LABELS[data.preferredCarrier] || data.preferredCarrier : null;

  const itemsHtmlRows = data.items.map((item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e1d8;">
            <div style="font-weight:600;color:#1c1b17;">${escapeHtml(item.productName)}</div>
            <div style="font-size:12px;color:#78716c;">${escapeHtml(item.variantName)} · x${item.quantity}</div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e1d8;text-align:right;color:#1c1b17;white-space:nowrap;">${formatPrice(item.lineTotal)}</td>
        </tr>`).join('');

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f7f4ec;font-family:Arial,Helvetica,sans-serif;color:#1c1b17;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f4ec;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e5e1d8;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 24px 8px 24px;">
                <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#3f6b4f;">ARTEMA</p>
                <h1 style="margin:8px 0 0 0;font-size:22px;color:#1c1b17;">Recibimos tu pedido</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 0 24px;font-size:14px;line-height:1.5;color:#3f3d37;">
                <p style="margin:8px 0;">Hola ${escapeHtml(data.customerName)},</p>
                <p style="margin:8px 0;">Gracias por tu compra. Este es un resumen de tu pedido.</p>
                <p style="margin:8px 0;">
                  <strong>N.º de pedido:</strong> ${orderCode}<br />
                  <strong>Fecha:</strong> ${formatOrderDate(data.createdAt)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 0 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                  ${itemsHtmlRows}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 0 24px;font-size:14px;color:#3f3d37;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:4px 0;">Subtotal</td>
                    <td style="padding:4px 0;text-align:right;">${formatPrice(data.subtotal)}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;">${deliveryLabel}</td>
                    <td style="padding:4px 0;text-align:right;">${shippingLine}</td>
                  </tr>
                  ${carrierLabel ? `<tr><td style="padding:4px 0;">Transportista preferido</td><td style="padding:4px 0;text-align:right;">${escapeHtml(carrierLabel)}</td></tr>` : ''}
                  <tr>
                    <td style="padding:4px 0;">Documento</td>
                    <td style="padding:4px 0;text-align:right;">${documentLabel}</td>
                  </tr>
                </table>
                ${shippingNote ? `<p style="margin:8px 0 0 0;font-size:12px;color:#78716c;">${escapeHtml(shippingNote)}</p>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 0 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e1d8;padding-top:12px;">
                  <tr>
                    <td style="padding-top:12px;font-size:16px;font-weight:700;color:#1c1b17;">Total</td>
                    <td style="padding-top:12px;font-size:16px;font-weight:700;color:#1c1b17;text-align:right;">${formatPrice(data.total)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 24px 24px;font-size:13px;color:#78716c;line-height:1.5;">
                <p style="margin:0;">Te avisaremos cuando tengamos novedades sobre tu pedido.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines = [
    'ARTEMA — Recibimos tu pedido',
    '',
    `Hola ${data.customerName},`,
    'Gracias por tu compra. Este es un resumen de tu pedido.',
    '',
    `N.º de pedido: ${orderCode}`,
    `Fecha: ${formatOrderDate(data.createdAt)}`,
    '',
    ...data.items.map((item) => `- ${item.productName} (${item.variantName}) x${item.quantity} — ${formatPrice(item.lineTotal)}`),
    '',
    `Subtotal: ${formatPrice(data.subtotal)}`,
    `${deliveryLabel}: ${shippingLine}`,
    ...(carrierLabel ? [`Transportista preferido: ${carrierLabel}`] : []),
    `Documento: ${documentLabel}`,
    ...(shippingNote ? [shippingNote] : []),
    '',
    `Total: ${formatPrice(data.total)}`,
    '',
    'Te avisaremos cuando tengamos novedades sobre tu pedido.',
  ];

  return { subject, html, text: textLines.join('\n') };
}
