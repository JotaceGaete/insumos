# 🖥️ Configuración de Variables de Entorno en VPS

## ❌ Problema: Chatbot no funciona en VPS

Si el chatbot funciona en local pero no en tu VPS, el problema es que **faltan variables de entorno** en el servidor.

---

## ✅ Solución: Configurar Variables de Entorno

### Variables Requeridas para el Chatbot

El chatbot necesita las siguientes variables de entorno:

1. **OPENAI_API_KEY** - Clave de API de OpenAI
2. **NEXT_PUBLIC_SUPABASE_URL** - URL de tu proyecto Supabase
3. **SUPABASE_SERVICE_ROLE_KEY** - Clave de servicio de Supabase
4. **NEXT_PUBLIC_SUPABASE_ANON_KEY** - Clave anónima de Supabase (pública)

---

## 🔧 Método 1: Usando archivo .env.local (Recomendado)

### Paso 1: Crear archivo .env.local en el VPS

Conecta a tu VPS y crea/edita el archivo `.env.local` en la raíz del proyecto:

```bash
# Conectar a tu VPS
ssh usuario@tu-vps-ip

# Navegar al directorio del proyecto
cd /ruta/a/tu/proyecto

# Crear/editar el archivo .env.local
nano .env.local
```

### Paso 2: Agregar las variables

Copia estas variables desde tu entorno local y pégalas en el archivo:

```bash
# OpenAI API Key (para el chatbot)
OPENAI_API_KEY=sk-proj-tu-api-key-aqui

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://tu-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui

# Otras variables que puedas necesitar
SMTP_HOST=smtp.zoho.com
SMTP_PORT=465
SMTP_USER=contacto@artema.cl
SMTP_PASSWORD=tu-password-aqui
CONTACT_MAIL_TO=contacto@artema.cl
```

### Paso 3: Guardar y reiniciar

```bash
# Guardar el archivo (Ctrl+X, luego Y, luego Enter en nano)
# O si usas vim: :wq

# Reiniciar el servidor Next.js
# Si usas PM2:
pm2 restart all

# Si usas systemd:
sudo systemctl restart tu-servicio

# Si usas npm directamente:
# Detener el proceso actual (Ctrl+C) y luego:
npm run build
npm run start
```

---

## 🔧 Método 2: Variables de Entorno del Sistema

Si prefieres usar variables de entorno del sistema en lugar de archivos `.env`:

### En Linux/Ubuntu:

```bash
# Editar el archivo de entorno del sistema
sudo nano /etc/environment

# Agregar las variables (una por línea):
OPENAI_API_KEY=sk-proj-tu-api-key-aqui
NEXT_PUBLIC_SUPABASE_URL=https://tu-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui

# Guardar y aplicar cambios
source /etc/environment

# Reiniciar el servicio
sudo systemctl restart tu-servicio
```

### En el servicio systemd (recomendado):

Si usas systemd para ejecutar Next.js, edita tu archivo de servicio:

```bash
sudo nano /etc/systemd/system/tu-servicio.service
```

Agrega las variables en la sección `[Service]`:

```ini
[Service]
Environment="OPENAI_API_KEY=sk-proj-tu-api-key-aqui"
Environment="NEXT_PUBLIC_SUPABASE_URL=https://tu-project-ref.supabase.co"
Environment="NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui"
Environment="SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui"
```

Luego recarga y reinicia:

```bash
sudo systemctl daemon-reload
sudo systemctl restart tu-servicio
```

---

## 🔧 Método 3: Usando PM2

Si usas PM2 para gestionar tu aplicación:

```bash
# Crear archivo de configuración PM2
nano ecosystem.config.js
```

Contenido del archivo:

```javascript
module.exports = {
  apps: [{
    name: 'artesellos-app',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      OPENAI_API_KEY: 'sk-proj-tu-api-key-aqui',
      NEXT_PUBLIC_SUPABASE_URL: 'https://tu-project-ref.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'tu-anon-key-aqui',
      SUPABASE_SERVICE_ROLE_KEY: 'tu-service-role-key-aqui',
      SMTP_HOST: 'smtp.zoho.com',
      SMTP_PORT: '465',
      SMTP_USER: 'contacto@artema.cl',
      SMTP_PASSWORD: 'tu-password-aqui',
      CONTACT_MAIL_TO: 'contacto@artema.cl'
    }
  }]
};
```

Luego:

```bash
pm2 delete all  # Eliminar instancias anteriores
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Para que se inicie automáticamente al reiniciar el servidor
```

---

## 📋 Dónde Obtener las Variables

### 1. OPENAI_API_KEY

1. Ve a [OpenAI Platform](https://platform.openai.com/api-keys)
2. Inicia sesión en tu cuenta
3. Haz clic en "Create new secret key"
4. Copia la clave generada (solo se muestra una vez)

### 2. Variables de Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **Settings** → **API**
3. Copia los siguientes valores:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **Importante: Esta clave es secreta, no la compartas**

---

## 🧪 Verificar que Funciona

### 1. Verificar variables en el servidor

Crea un endpoint temporal de prueba (solo en desarrollo):

```bash
# En tu VPS, verifica que las variables estén disponibles
node -e "require('dotenv').config({ path: '.env.local' }); console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ No configurada');"
```

### 2. Probar el chatbot

1. Abre tu sitio en el navegador
2. Haz clic en el botón del chatbot (💬)
3. Escribe "hola"
4. Si funciona correctamente, deberías ver una respuesta del bot

### 3. Revisar logs

```bash
# Si usas PM2:
pm2 logs

# Si usas systemd:
sudo journalctl -u tu-servicio -f

# Si ejecutas directamente:
# Los logs aparecerán en la terminal
```

Si hay errores, busca mensajes que empiecen con `❌` para identificar qué variable falta.

---

## ⚠️ Seguridad: Mejores Prácticas

### ❌ NO hagas esto:

- **NO** subas el archivo `.env.local` a Git
- **NO** compartas las claves públicamente
- **NO** uses la misma clave en desarrollo y producción

### ✅ SÍ haz esto:

- Agrega `.env.local` a `.gitignore`
- Usa diferentes claves para desarrollo y producción si es posible
- Restringe el acceso al archivo `.env.local`:

```bash
chmod 600 .env.local
```

- Considera usar un gestor de secretos en producción (AWS Secrets Manager, HashiCorp Vault, etc.)

---

## 🔍 Troubleshooting

### Error: "Error de configuración del servidor"

**Causa:** Faltan variables de entorno

**Solución:**
1. Verifica que el archivo `.env.local` exista en la raíz del proyecto
2. Verifica que las variables estén escritas correctamente (sin espacios antes/después del `=`)
3. Reinicia el servidor después de cambiar las variables
4. En modo desarrollo, revisa los logs del servidor para ver qué variable específica falta

### El chatbot sigue sin funcionar después de configurar las variables

1. **Verifica que el servidor esté usando las variables:**
   ```bash
   # Detén el servidor completamente
   # Luego reinícialo desde cero
   ```

2. **Verifica que Next.js esté en modo producción:**
   ```bash
   npm run build
   npm run start
   ```

3. **Verifica los logs del servidor** para ver errores específicos

4. **Verifica la conectividad:**
   - ¿El VPS puede acceder a internet?
   - ¿Hay un firewall bloqueando conexiones?
   - ¿Las URLs de Supabase son accesibles desde el VPS?

### Variables no se cargan

Si usas Next.js, asegúrate de:
- El archivo se llama exactamente `.env.local` (no `.env.local.txt`)
- Está en la raíz del proyecto (mismo nivel que `package.json`)
- Reiniciaste el servidor después de agregar las variables

---

## 📝 Checklist de Configuración

- [ ] `OPENAI_API_KEY` configurada
- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurada
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurada
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada
- [ ] Servidor reiniciado después de agregar variables
- [ ] Variables verificadas en logs del servidor
- [ ] Chatbot probado y funcionando
- [ ] `.env.local` agregado a `.gitignore`
- [ ] Permisos del archivo `.env.local` configurados (600)

---

## 📞 Soporte Adicional

Si después de seguir esta guía el problema persiste:

1. Revisa los logs del servidor para errores específicos
2. Verifica que todas las dependencias estén instaladas: `npm install`
3. Verifica que la versión de Node.js sea compatible: `node --version` (recomendado: 18.x o superior)
4. Verifica que el build de Next.js sea exitoso: `npm run build`

---

<div align="center">

**🎉 Una vez configuradas las variables, el chatbot debería funcionar correctamente en tu VPS**

</div>
