# 🚀 Guía de Configuración de Supabase para ARTEMA App

Esta guía te ayudará a configurar Supabase para conectar tu aplicación de e-commerce de timbres personalizados.

## 📋 Prerrequisitos

- Cuenta en [Supabase](https://supabase.com) (gratuita)
- Node.js y npm instalados
- Tu aplicación Next.js funcionando localmente

## 🔧 Paso 1: Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Haz clic en "New Project"
3. Completa los datos:
   - **Name**: `artesellos-app`
   - **Database Password**: Elige una contraseña segura
   - **Region**: Elige la región más cercana (ej: `West US (North California)`)
4. Espera a que se cree el proyecto (aprox. 2 minutos)

## 🗄️ Paso 2: Configurar Base de Datos

### Opción A: Usar Scripts Automáticos (Recomendado)

1. Ve al **SQL Editor** en tu dashboard de Supabase
2. Copia y pega el contenido del archivo `supabase-setup.sql`
3. Haz clic en **"Run"** para ejecutar el script

### Opción B: Configuración Manual

Si prefieres configurar manualmente, crea las siguientes tablas:

#### Tablas Principales:

1. **categories** - Categorías de productos
2. **products** - Catálogo de productos
3. **orders** - Pedidos de clientes
4. **order_items** - Items de cada pedido
5. **contact_messages** - Mensajes de contacto
6. **custom_designs** - Diseños personalizados
7. **quote_requests** - Solicitudes de cotización
8. **wholesale_registrations** - Registros de comercios

## 🔑 Paso 3: Obtener Credenciales

1. Ve a **Settings > API** en tu dashboard de Supabase
2. Copia los siguientes valores:
   - **Project URL**: `https://tu-project-ref.supabase.co`
   - **anon/public key**: `tu-anon-key-aqui`

## ⚙️ Paso 4: Configurar Variables de Entorno

Crea un archivo `.env.local` en la raíz de tu proyecto:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://tu-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui

# WooCommerce (opcional - para migración de datos)
NEXT_PUBLIC_WOOCOMMERCE_URL=https://tu-sitio-wordpress.com
WOOCOMMERCE_CONSUMER_KEY=ck_tu_consumer_key
WOOCOMMERCE_CONSUMER_SECRET=cs_tu_consumer_secret

# Email Configuration (para envío de correos)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password

# Application Settings
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 🌱 Paso 5: Poblar con Datos de Ejemplo

1. Ve al **SQL Editor** nuevamente
2. Copia y pega el contenido del archivo `supabase-seed.sql`
3. Ejecuta el script para poblar las tablas con datos de ejemplo

## 🔒 Paso 6: Configurar Autenticación (Opcional)

Si necesitas autenticación de usuarios:

1. Ve a **Authentication > Settings**
2. Configura:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: Agrega `http://localhost:3000/auth/callback`
3. Habilita los proveedores de autenticación que necesites (Email, Google, etc.)

## 🧪 Paso 7: Probar la Conexión

1. Reinicia tu servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Verifica que puedas:
   - Ver productos en la página principal
   - Navegar por categorías
   - Agregar productos al carrito
   - Enviar formularios de contacto

## 📊 Estructura de Datos de Supabase

### Tablas y Campos Principales:

#### 🏷️ **products**
- `id`: UUID (Primary Key)
- `name`: Nombre del producto
- `slug`: URL amigable
- `description`: Descripción completa
- `price`: Precio actual
- `regular_price`: Precio regular
- `sale_price`: Precio de oferta (opcional)
- `on_sale`: Boolean para ofertas
- `images`: Array JSON de imágenes
- `categories`: Array JSON de categorías
- `stock_status`: Estado del inventario
- `featured`: Producto destacado

#### 📦 **orders**
- `id`: UUID (Primary Key)
- `customer_email`: Email del cliente
- `customer_name`: Nombre del cliente
- `total`: Total del pedido
- `status`: Estado del pedido
- `shipping_address`: Dirección JSON
- `payment_method`: Método de pago

#### 📝 **contact_messages**
- `id`: UUID (Primary Key)
- `name`: Nombre del contacto
- `email`: Email del contacto
- `subject`: Asunto del mensaje
- `message`: Contenido del mensaje
- `status`: Estado (unread/read/responded)

#### 🎨 **custom_designs**
- `id`: UUID (Primary Key)
- `customer_email`: Email del cliente
- `design_data`: Datos del diseño JSON
- `status`: Estado del diseño
- `price_quote`: Cotización de precio

## 🔐 Políticas de Seguridad (RLS)

El script configura automáticamente:

- ✅ **Lectura pública** para productos y categorías
- ✅ **Acceso restringido** para pedidos (solo el cliente)
- ✅ **Solo admin** para gestión de productos
- ✅ **Solo admin** para mensajes de contacto

## 🚀 Funcionalidades Habilitadas

Después de la configuración tendrás:

- ✅ **Catálogo de productos** completo
- ✅ **Sistema de carrito** de compras
- ✅ **Gestión de pedidos** con estados
- ✅ **Sistema de contacto** para clientes
- ✅ **Solicitudes de cotización** automáticas
- ✅ **Diseños personalizados** con aprobación
- ✅ **Registro de comercios** mayoristas
- ✅ **Búsqueda y filtrado** de productos

## 🛠️ Solución de Problemas

### Error de conexión:
1. Verifica que las variables de entorno sean correctas
2. Confirma que el proyecto de Supabase esté activo
3. Revisa la consola del navegador por errores

### Tablas no creadas:
1. Ejecuta nuevamente el script `supabase-setup.sql`
2. Verifica que no haya errores en el SQL Editor

### Datos no visibles:
1. Confirma que ejecutaste el script `supabase-seed.sql`
2. Verifica en el **Table Editor** de Supabase que los datos estén ahí

## 📞 Soporte

Si tienes problemas:

1. Revisa la documentación oficial de Supabase
2. Verifica los logs en la consola del navegador
3. Revisa los logs del SQL Editor en Supabase

## 🎯 Próximos Pasos

Una vez configurado Supabase, podrás:

- Migrar datos desde WooCommerce (si tienes)
- Configurar envío de emails automáticos
- Implementar autenticación de usuarios
- Agregar sistema de reseñas y calificaciones
- Configurar webhooks para pagos
- Implementar análisis y reportes

---

¡Tu aplicación ARTEMA ya está conectada con Supabase! 🎉
