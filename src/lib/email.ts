import type { WholesaleApplication, ContactMessage } from '@/types/api';

// Interfaces para datos específicos
interface AddressData {
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

// Email templates (solo las plantillas, sin la lógica de envío)
export const emailTemplates = {
  contactMessage: (data: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
  }) => ({
    subject: `Nuevo mensaje de contacto: ${data.subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Nuevo mensaje de contacto</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Nombre:</strong> ${data.name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          ${data.phone ? `<p><strong>Teléfono:</strong> ${data.phone}</p>` : ''}
          <p><strong>Asunto:</strong> ${data.subject}</p>
          <p><strong>Mensaje:</strong></p>
          <div style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #6366f1;">
            ${data.message.replace(/\n/g, '<br>')}
          </div>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Este mensaje fue enviado desde el formulario de contacto de ARTEMA.
        </p>
      </div>
    `,
  }),

  quoteRequest: (data: {
    customer_name: string;
    customer_email: string;
    customer_phone?: string;
    company?: string;
    quantity: number;
    description: string;
    reference_image?: string;
  }) => ({
    subject: `Nueva solicitud de cotización - ${data.customer_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Nueva solicitud de cotización</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Cliente:</strong> ${data.customer_name}</p>
          <p><strong>Email:</strong> ${data.customer_email}</p>
          ${data.customer_phone ? `<p><strong>Teléfono:</strong> ${data.customer_phone}</p>` : ''}
          ${data.company ? `<p><strong>Empresa:</strong> ${data.company}</p>` : ''}
          <p><strong>Cantidad:</strong> ${data.quantity}</p>
          <p><strong>Descripción:</strong></p>
          <div style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #6366f1;">
            ${data.description.replace(/\n/g, '<br>')}
          </div>
          ${data.reference_image ? `<p><strong>Imagen de referencia:</strong> <a href="${data.reference_image}" target="_blank">Ver imagen</a></p>` : ''}
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Este mensaje fue enviado desde el formulario de cotizaciones de ARTEMA.
        </p>
      </div>
    `,
  }),

  wholesaleRegistration: (data: {
    company_name: string;
    contact_name: string;
    email: string;
    phone: string;
    business_type: string;
    tax_id?: string;
    expected_volume: string;
    address: AddressData;
  }) => ({
    subject: `Nuevo registro de comercio mayorista - ${data.company_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">Nuevo registro de comercio mayorista</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Empresa:</strong> ${data.company_name}</p>
          <p><strong>Persona de contacto:</strong> ${data.contact_name}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Teléfono:</strong> ${data.phone}</p>
          <p><strong>Tipo de negocio:</strong> ${data.business_type}</p>
          ${data.tax_id ? `<p><strong>RUT/ID Fiscal:</strong> ${data.tax_id}</p>` : ''}
          <p><strong>Volumen esperado:</strong> ${data.expected_volume}</p>
          <p><strong>Dirección:</strong></p>
          <div style="background: white; padding: 15px; border-radius: 4px;">
            ${data.address.address_1}<br>
            ${data.address.address_2 ? data.address.address_2 + '<br>' : ''}
            ${data.address.city}, ${data.address.state} ${data.address.postcode}<br>
            ${data.address.country}
          </div>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Este mensaje fue enviado desde el formulario de registro mayorista de ARTEMA.
        </p>
      </div>
    `,
  }),
};

// Funciones para enviar emails usando API routes (solo para el cliente)
export async function sendContactMessage(data: {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}) {
  const response = await fetch('/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function sendQuoteRequest(data: {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  company?: string;
  quantity: number;
  description: string;
  reference_image?: string;
}) {
  const response = await fetch('/api/quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function sendWholesaleRegistration(data: {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  business_type: string;
  tax_id?: string;
  expected_volume: string;
  address: AddressData;
}) {
  const response = await fetch('/api/wholesale', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}
