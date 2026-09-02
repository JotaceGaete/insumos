import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Usar Node.js runtime para nodemailer
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { nombre, email, telefono, mensaje } = await req.json();

    // Validación de campos requeridos
    if (!nombre || !email || !mensaje) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Validación de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Verificar que las variables de entorno estén configuradas
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error('❌ Variables de entorno SMTP no configuradas');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Configuración del servidor de correo incompleta. Por favor contacta al administrador.',
        },
        { status: 500 }
      );
    }

    console.log('📧 Configurando transporter de Zoho Mail...');
    console.log('🔍 Configuración:', {
      host: process.env.SMTP_HOST || 'smtp.zoho.com',
      port: process.env.SMTP_PORT || '465',
      user: process.env.SMTP_USER,
      hasPassword: !!process.env.SMTP_PASSWORD
    });

    // Configurar transporter para Zoho Mail
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.zoho.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, // true para puerto 465 (SSL)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false, // Permitir certificados autofirmados en desarrollo
      },
    });

    // Verificar conexión SMTP
    try {
      await transporter.verify();
      console.log('✅ Conexión SMTP verificada');
    } catch (verifyError: any) {
      console.error('❌ Error al verificar SMTP:', verifyError);
      console.error('Detalles del error:', {
        code: verifyError.code,
        command: verifyError.command,
        response: verifyError.response,
        message: verifyError.message
      });
      
      // Mensaje de error más específico
      let errorMessage = 'Error de configuración del servidor de correo.';
      
      if (verifyError.code === 'EAUTH') {
        errorMessage = 'Error de autenticación. Verifica usuario y contraseña.';
      } else if (verifyError.code === 'ETIMEDOUT' || verifyError.code === 'ECONNREFUSED') {
        errorMessage = 'No se pudo conectar al servidor de correo. Verifica la configuración.';
      } else if (verifyError.message?.includes('Invalid login')) {
        errorMessage = 'Usuario o contraseña incorrectos. Si tienes 2FA, usa una contraseña de aplicación.';
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? verifyError.message : undefined
        },
        { status: 500 }
      );
    }

    // Construir HTML del email
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #4b5563; }
          .value { color: #1f2937; }
          .message-box { background: white; border: 2px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-top: 20px; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📬 Nuevo Mensaje de Contacto</h1>
            <p>Desde artema.cl</p>
          </div>
          
          <div class="content">
            <h2>Datos del Cliente</h2>
            
            <div class="field">
              <span class="label">👤 Nombre:</span>
              <span class="value">${nombre}</span>
            </div>
            
            <div class="field">
              <span class="label">✉️ Email:</span>
              <a href="mailto:${email}" style="color: #4f46e5;">${email}</a>
            </div>
            
            ${telefono ? `
            <div class="field">
              <span class="label">📞 Teléfono:</span>
              <a href="tel:${telefono}" style="color: #4f46e5;">${telefono}</a>
            </div>
            ` : ''}
            
            <div class="message-box">
              <strong>💬 Mensaje:</strong><br><br>
              ${mensaje.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <div class="footer">
            Mensaje recibido el ${new Date().toLocaleString('es-CL', { 
              timeZone: 'America/Santiago',
              dateStyle: 'full',
              timeStyle: 'short'
            })}
          </div>
        </div>
      </body>
      </html>
    `;

    // Configurar email
    const mailOptions = {
      from: `"Formulario ARTEMA" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_MAIL_TO || process.env.SMTP_USER,
      replyTo: email,
      subject: `💬 Nuevo mensaje de ${nombre}`,
      html: htmlContent,
      text: `
Nuevo mensaje de contacto

Nombre: ${nombre}
Email: ${email}
${telefono ? `Teléfono: ${telefono}` : ''}

Mensaje:
${mensaje}

---
Enviado desde artema.cl
${new Date().toLocaleString('es-CL')}
      `.trim(),
    };

    console.log('📤 Enviando email a:', mailOptions.to);
    
    // Enviar email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email enviado exitosamente:', info.messageId);

    return NextResponse.json({
      success: true,
      message: 'Mensaje enviado correctamente',
      messageId: info.messageId,
    });

  } catch (error: any) {
    console.error('❌ Error al enviar email:', error);
    console.error('Detalles completos:', {
      code: error.code,
      command: error.command,
      response: error.response,
      message: error.message,
      stack: error.stack
    });
    
    // Mensaje de error más específico
    let errorMessage = 'Error al enviar el mensaje. Por favor intenta nuevamente.';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Error de autenticación con el servidor de correo.';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      errorMessage = 'No se pudo conectar al servidor de correo. Verifica tu conexión.';
    } else if (error.response) {
      errorMessage = `Error del servidor: ${error.response}`;
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
