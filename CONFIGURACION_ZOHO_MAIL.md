# 📧 Configuración Zoho Mail para Formulario de Contacto

## 🎯 Variables de Entorno Necesarias

Necesitas configurar estas variables en tu archivo `.env.local`:

```bash
# Servidor SMTP de Zoho
SMTP_HOST=smtp.zoho.com

# Puerto SMTP (465 para SSL, 587 para TLS)
SMTP_PORT=465

# Tu correo completo de Zoho
SMTP_USER=tu-email@artema.cl

# Contraseña de la cuenta de Zoho
# IMPORTANTE: Usa una contraseña de aplicación si tienes 2FA activado
SMTP_PASSWORD=tu-contraseña-aqui

# Email de destino (donde se recibirán los mensajes)
# Si no se especifica, se usa SMTP_USER
CONTACT_MAIL_TO=contacto@artema.cl
```

---

## 📋 Pasos para Configurar

### 1. Obtener Credenciales de Zoho

**Si NO tienes 2FA (autenticación de dos factores):**
- Usuario: Tu email completo de Zoho
- Contraseña: Tu contraseña normal de Zoho

**Si TIENES 2FA activado (Recomendado):**
1. Ve a https://accounts.zoho.com/home#security/app_specific_password
2. Click en "Generate New Password"
3. Dale un nombre: "ARTEMA Formulario Contacto"
4. Copia la contraseña generada
5. Usa esa contraseña en `SMTP_PASSWORD`

### 2. Crear/Editar `.env.local`

En la raíz de tu proyecto, crea o edita el archivo `.env.local`:

```bash
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=contacto@artema.cl
SMTP_PASSWORD=tu-contraseña-o-app-password
CONTACT_MAIL_TO=contacto@artema.cl
```

### 3. Reiniciar el Servidor

```bash
# Detener el servidor (Ctrl + C)
# Iniciar de nuevo
npm run dev
```

---

## 🧪 Probar la Configuración

### 1. Verificar Variables de Entorno

Agrega un console.log temporal en `src/app/api/contact/route.ts`:

```typescript
console.log('SMTP Config:', {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  hasPassword: !!process.env.SMTP_PASSWORD
});
```

### 2. Enviar Mensaje de Prueba

1. Ve a http://localhost:3000/contacto
2. Llena el formulario:
   - Nombre: Test Usuario
   - Email: test@test.com
   - Mensaje: Mensaje de prueba
3. Click en "Enviar Mensaje"
4. Revisa la consola del servidor

### 3. Revisar Logs

La consola debe mostrar:

```
📧 Configurando transporter de Zoho Mail...
✅ Conexión SMTP verificada
📤 Enviando email a: contacto@artema.cl
✅ Email enviado exitosamente: <message-id>
```

---

## ⚠️ Troubleshooting

### Error: "Invalid login"

**Causa:** Usuario o contraseña incorrectos

**Solución:**
1. Verifica que `SMTP_USER` sea tu email completo
2. Si tienes 2FA, genera una contraseña de aplicación
3. Copia la contraseña exactamente (sin espacios)

### Error: "Connection timeout"

**Causa:** Puerto bloqueado o firewall

**Solución:**
1. Verifica que el puerto 465 no esté bloqueado
2. Intenta con puerto 587 y cambia `secure: false`:

```typescript
port: 587,
secure: false,
```

### Error: "Self signed certificate"

**Causa:** Problema con certificados SSL (normal en desarrollo)

**Solución:**
Agregar en la configuración del transporter:

```typescript
tls: {
  rejectUnauthorized: false, // Solo en desarrollo
}
```

### Error: "Authentication failed"

**Causa:** Zoho puede requerir configuración adicional

**Solución:**
1. Verifica que IMAP/POP esté habilitado en Zoho:
   - Settings → Mail → POP/IMAP Access → Enable
2. Genera una contraseña de aplicación específica
3. Verifica que tu plan de Zoho permita SMTP

---

## 🔐 Seguridad

### Buenas Prácticas:

1. ✅ **Nunca** subas el archivo `.env.local` a Git
2. ✅ Usa **contraseñas de aplicación** en lugar de tu contraseña principal
3. ✅ Configura **2FA** en tu cuenta de Zoho
4. ✅ Limita el acceso SMTP solo a IPs conocidas (en Zoho)
5. ✅ Rota las contraseñas periódicamente

### Variables en Producción (Cloudflare Pages):

```bash
# En Cloudflare Pages Dashboard:
# Settings → Environment Variables → Add Variable

SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=contacto@artema.cl
SMTP_PASSWORD=xxx (contraseña de aplicación)
CONTACT_MAIL_TO=contacto@artema.cl
```

---

## 📊 Verificación de Funcionamiento

### Checklist:

- [ ] Variables configuradas en `.env.local`
- [ ] Servidor reiniciado
- [ ] Puerto 465 no bloqueado
- [ ] 2FA configurado (si aplica)
- [ ] Contraseña de aplicación generada (si aplica)
- [ ] Logs muestran "Conexión SMTP verificada"
- [ ] Email recibido en bandeja de entrada
- [ ] Usuario ve mensaje de éxito

---

## 📧 Formato del Email Recibido

Recibirás emails con este formato:

```
De: Formulario ARTEMA <contacto@artema.cl>
Para: contacto@artema.cl
Responder a: email-del-cliente@example.com
Asunto: 💬 Nuevo mensaje de Juan Pérez

[HTML formateado con]
- Datos del cliente (nombre, email, teléfono)
- Mensaje completo
- Fecha y hora
```

---

## 🎨 Personalización

### Cambiar Email de Destino:

Edita `.env.local`:

```bash
CONTACT_MAIL_TO=ventas@artema.cl,soporte@artema.cl
```

### Cambiar Remitente:

Edita `src/app/api/contact/route.ts`:

```typescript
from: `"ARTEMA Contacto" <${process.env.SMTP_USER}>`,
```

---

## 📈 Monitoreo

### Ver Emails Enviados:

1. Ve a Zoho Mail
2. Carpeta "Sent" (Enviados)
3. Busca por asunto: "💬 Nuevo mensaje"

### Estadísticas:

Zoho Mail muestra:
- Total de emails enviados
- Tasa de entrega
- Bounces (rebotes)

---

## 🚀 Siguiente Paso

Una vez configurado:

1. ✅ Prueba enviando un mensaje desde http://localhost:3000/contacto
2. ✅ Verifica que llegue a tu bandeja de Zoho
3. ✅ Responde al cliente usando "Reply" en Zoho
4. ✅ Deploy a producción y configura las variables en Cloudflare

---

**Fecha:** 25 de noviembre, 2025  
**Estado:** ✅ Configuración actualizada para Zoho Mail  
**Runtime:** Node.js (compatible con nodemailer)

