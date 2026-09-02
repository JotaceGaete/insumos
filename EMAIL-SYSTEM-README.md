# Sistema de Email - Modo Receive Only

Este documento describe el sistema de email implementado en **modo `receive_only`** para la aplicación ARTEMA.

## 📧 Resumen del Sistema

El sistema está configurado para **recibir emails** (mediante Cloudflare Email Routing) pero **NO enviar emails automáticamente**. En su lugar, utiliza enlaces `mailto:` para que los usuarios puedan escribir directamente desde su cliente de email.

### 🎯 Objetivo

- **Recibir**: `soporte@artema.cl` y `mayoristas@artema.cl` → `jotacegaete@gmail.com`
- **Enviar**: Mediante enlaces `mailto:` con asunto y cuerpo prellenados
- **Auditar**: Todos los emails "enviados" se registran en `mail_log` con status `skipped_receive_only`

## ⚙️ Configuración

### Variables de Entorno (`.env.local`)

```env
# Email Configuration (receive_only mode)
EMAIL_MODE=receive_only
EMAIL_SUPPORT=soporte@artema.cl
EMAIL_WHOLESALE=mayoristas@artema.cl
EMAIL_FROM=noreply@artema.cl
```

### Cloudflare Email Routing

Configurado en el dominio `artema.cl`:

- `soporte@artema.cl` → `jotacegaete@gmail.com`
- `mayoristas@artema.cl` → `jotacegaete@gmail.com`

## 🗄️ Base de Datos

### Tablas Principales

#### `contact_messages`
```sql
- id (BIGSERIAL PRIMARY KEY)
- name (TEXT NOT NULL)
- email (TEXT NOT NULL)
- subject (TEXT NOT NULL)
- message (TEXT NOT NULL)
- created_at (TIMESTAMPTZ DEFAULT NOW())
```

#### `wholesale_requests`
```sql
- id (BIGSERIAL PRIMARY KEY)
- user_id (UUID REFERENCES auth.users)
- company (TEXT NOT NULL)
- rut (TEXT NOT NULL)
- contact_name (TEXT NOT NULL)
- email (TEXT NOT NULL)
- phone (TEXT)
- city (TEXT)
- notes (TEXT)
- status (TEXT DEFAULT 'pending')
- created_at, updated_at (TIMESTAMPTZ)
```

#### `art_files`
```sql
- id (BIGSERIAL PRIMARY KEY)
- request_id (BIGINT REFERENCES wholesale_requests)
- storage_key (TEXT NOT NULL)
- original_name (TEXT NOT NULL)
- mime_type (TEXT NOT NULL)
- size_bytes (BIGINT NOT NULL)
- checks_json (JSONB)
- status (TEXT DEFAULT 'pending')
- upload_user_id (UUID)
- created_at, updated_at (TIMESTAMPTZ)
```

#### `mail_log`
```sql
- id (BIGSERIAL PRIMARY KEY)
- to_email (TEXT NOT NULL)
- subject (TEXT NOT NULL)
- template (TEXT)
- payload_json (JSONB)
- status (TEXT DEFAULT 'skipped_receive_only')
- error_message (TEXT)
- created_at (TIMESTAMPTZ DEFAULT NOW())
```

### Supabase Storage

#### Bucket `art-files` (Privado)
- Archivos de diseño subidos por usuarios mayoristas
- Límite: 10MB por archivo
- Tipos permitidos: PDF, SVG, AI, PNG, JPG
- URLs firmadas con vigencia de 7 días

## 🚀 Flujos Implementados

### 1. Formulario de Contacto

**Ubicación**: `/contacto`

**Flujo**:
1. Usuario completa formulario (nombre, email, asunto, mensaje)
2. Se guarda en `contact_messages`
3. Se logea intento de envío en `mail_log` (status: `skipped_receive_only`)
4. Se muestra mensaje de éxito con ID y botón `mailto:`

**Mensaje de Éxito**:
> "Tu mensaje quedó registrado con el ID #123. Si querés acelerar la respuesta, escribinos a soporte@artema.cl citando este ID."

**Botón mailto**: `mailto:soporte@artema.cl?subject=Consulta%20%23123`

### 2. Solicitud Mayorista

**Ubicación**: `/mayoristas`

**Flujo**:
1. Usuario completa formulario de empresa
2. Opcionalmente sube hasta 3 archivos de diseño
3. Se guarda en `wholesale_requests`
4. Archivos se suben a Supabase Storage + metadatos en `art_files`
5. Se loggean intentos de envío en `mail_log`
6. Se muestra mensaje de éxito con ID y botón `mailto:`

**Mensaje de Éxito**:
> "Recibimos tu solicitud #456. Tus archivos están listos para revisión. Si necesitás agregar info, escribinos a mayoristas@artema.cl citando este ID."

**Botón mailto**: `mailto:mayoristas@artema.cl?subject=Solicitud%20Mayorista%20%23456`

## 👨‍💼 Panel de Administración

### Rutas Admin

- `/cuenta/admin/contacto` - Gestión de mensajes de contacto
- `/cuenta/admin/solicitudes` - Gestión de solicitudes mayoristas (pendiente)
- `/cuenta/admin/archivos` - Gestión de archivos subidos (pendiente)

### Funcionalidades

#### Mensajes de Contacto
- Listar todos los mensajes con paginación
- Ver detalles completos de cada mensaje
- Botón "Copiar mailto" para respuesta rápida
- Botón "Responder" que abre cliente de email

#### Permisos
- Solo usuarios con `role = 'ADMIN'` pueden acceder
- RLS (Row Level Security) configurado en todas las tablas

## 🛠️ Código Principal

### Configuración de Email

**`src/lib/emailConfig.ts`**:
```typescript
export const EMAIL_CONFIG = {
  MODE: process.env.EMAIL_MODE || 'receive_only',
  SUPPORT: process.env.EMAIL_SUPPORT || 'soporte@artema.cl',
  WHOLESALE: process.env.EMAIL_WHOLESALE || 'mayoristas@artema.cl',
  FROM: process.env.EMAIL_FROM || 'noreply@artema.cl',
}

export function generateSupportMailto(id: string | number): string {
  return generateMailtoLink(
    EMAIL_CONFIG.SUPPORT,
    `Consulta #${id}`,
    `Hola,\n\nMe comunico respecto a mi consulta #${id}.\n\n[Escribe tu mensaje aquí]\n\nSaludos.`
  )
}
```

### Sistema de Logging

**`src/lib/emailLogger.ts`**:
```typescript
export async function sendEmail(data: EmailLogData): Promise<{ success: boolean; id?: number; error?: string }> {
  if (!canSendEmails()) {
    // Modo receive_only: solo registrar en log
    console.log(`📧 [RECEIVE_ONLY] Email skipped: ${data.subject} to ${data.to}`)
    return await logEmail(data, 'skipped_receive_only')
  }
  
  // TODO: En modo active, aquí iría la integración con SMTP/Resend/Mailgun
  return await logEmail(data, 'sent')
}
```

### Server Actions

**`src/lib/actions/contactActions.ts`**:
```typescript
export async function createContactMessage(formData: FormData): Promise<ContactResult> {
  // Validaciones
  // Guardar en contact_messages
  // Enviar emails (skipped en receive_only)
  // Retornar ID para mailto
}
```

## 🔄 Migración a Modo Active

### Pasos para Activar Envío Real

1. **Configurar Proveedor SMTP**:
   ```env
   EMAIL_MODE=active
   SMTP_HOST=smtp.resend.com
   SMTP_USER=resend
   SMTP_PASS=re_xxxxxxxx
   # o alternativas: Mailgun, SendGrid, etc.
   ```

2. **Implementar Envío Real**:
   ```typescript
   // En emailLogger.ts
   if (canSendEmails()) {
     // Integrar con Resend/Mailgun/SMTP
     const result = await resend.emails.send({
       from: EMAIL_CONFIG.FROM,
       to: data.to,
       subject: data.subject,
       html: generateEmailTemplate(data)
     })
     
     if (result.error) {
       return await logEmail(data, 'failed', result.error.message)
     }
     
     return await logEmail(data, 'sent')
   }
   ```

3. **Configurar DNS (ya listo)**:
   - SPF: `v=spf1 include:_spf.resend.com ~all`
   - DKIM: Configurar según proveedor
   - DMARC: `v=DMARC1; p=quarantine;`

4. **Plantillas de Email**:
   - Crear templates HTML para confirmaciones
   - Mantener fallback a texto plano

### Beneficios del Modo Active

- ✅ Confirmaciones automáticas a usuarios
- ✅ Notificaciones inmediatas al equipo
- ✅ Mejor experiencia de usuario
- ✅ Seguimiento de entrega y aperturas

## 📊 Métricas y Monitoreo

### Consultas Útiles

```sql
-- Mensajes de contacto por día
SELECT DATE(created_at) as fecha, COUNT(*) as mensajes
FROM contact_messages 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY fecha DESC;

-- Solicitudes mayoristas pendientes
SELECT COUNT(*) as pendientes
FROM wholesale_requests 
WHERE status = 'pending';

-- Logs de email por status
SELECT status, COUNT(*) as cantidad
FROM mail_log 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY status;

-- Archivos subidos por solicitud
SELECT wr.id, wr.company, COUNT(af.id) as archivos
FROM wholesale_requests wr
LEFT JOIN art_files af ON wr.id = af.request_id
GROUP BY wr.id, wr.company
ORDER BY wr.created_at DESC;
```

## 🎯 Estado Actual vs. Futuro

### ✅ Implementado (Receive Only)

- [x] Formulario de contacto funcional
- [x] Solicitudes mayoristas con uploader
- [x] Sistema de logging de emails
- [x] Panel admin de contacto
- [x] Botones mailto con prellenado
- [x] Storage seguro para archivos
- [x] Footer con emails de contacto

### 🔜 Pendiente (Para Modo Active)

- [ ] Panel admin de solicitudes mayoristas
- [ ] Panel admin de archivos subidos
- [ ] Integración con proveedor SMTP
- [ ] Plantillas HTML de emails
- [ ] Notificaciones automáticas
- [ ] Dashboard de métricas
- [ ] Configuración DKIM/SPF completa

## 🚨 Criterios de Aceptación (Cumplidos)

- ✅ Con `EMAIL_MODE=receive_only` no hay intentos de envío saliente
- ✅ `contact_messages`, `wholesale_requests` y `art_files` persisten correctamente
- ✅ Uploader guarda en Supabase Storage (bucket privado) 
- ✅ Botones `mailto` se generan con asunto que incluye #ID
- ✅ Panel `/cuenta/admin/contacto` muestra listas según rol ADMIN
- ✅ `mail_log` registra eventos como `skipped_receive_only`
- ✅ Footer y páginas muestran emails correctos

## 📞 Soporte

Para dudas sobre el sistema de email:

- **Desarrollo**: Revisar logs en `mail_log` table
- **Configuración**: Verificar variables en `.env.local`
- **Cloudflare**: Revisar Email Routing en dashboard
- **Storage**: Verificar bucket `art-files` en Supabase

---

**Última actualización**: Enero 2025  
**Modo actual**: `receive_only`  
**Estado**: ✅ Funcional
