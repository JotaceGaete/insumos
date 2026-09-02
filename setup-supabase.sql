-- Script de configuración inicial de Supabase para ARTEMA App
-- Ejecutar este script en el SQL Editor de Supabase

-- =====================================================
-- TABLAS PRINCIPALES
-- =====================================================

-- Tabla de Categorías
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image TEXT,
  parent_id UUID REFERENCES categories(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Productos
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  short_description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  regular_price DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2),
  on_sale BOOLEAN DEFAULT FALSE,
  images JSONB DEFAULT '[]',
  categories JSONB DEFAULT '[]',
  attributes JSONB DEFAULT '[]',
  stock_status TEXT DEFAULT 'instock' CHECK (stock_status IN ('instock', 'outofstock', 'onbackorder')),
  stock_quantity INTEGER DEFAULT 0,
  weight DECIMAL(10,2),
  dimensions JSONB,
  tags JSONB DEFAULT '[]',
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Pedidos
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  total DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'MXN',
  payment_method TEXT NOT NULL,
  shipping_address JSONB NOT NULL,
  billing_address JSONB NOT NULL,
  order_notes TEXT,
  tracking_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Items de Pedido
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  attributes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Mensajes de Contacto
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'responded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Diseños Personalizados
CREATE TABLE IF NOT EXISTS custom_designs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  design_data JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  price_quote DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Solicitudes de Cotización
CREATE TABLE IF NOT EXISTS quote_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  company TEXT,
  quantity INTEGER NOT NULL,
  description TEXT NOT NULL,
  reference_image TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'accepted', 'rejected')),
  response TEXT,
  price_quote DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Registros de Comercios
CREATE TABLE IF NOT EXISTS wholesale_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  business_type TEXT NOT NULL,
  tax_id TEXT,
  address JSONB NOT NULL,
  expected_volume TEXT DEFAULT 'small' CHECK (expected_volume IN ('small', 'medium', 'large')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA MEJOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_on_sale ON products(on_sale);
CREATE INDEX IF NOT EXISTS idx_products_stock_status ON products(stock_status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- =====================================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- =====================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_registrations ENABLE ROW LEVEL SECURITY;

-- Políticas para productos (lectura pública)
CREATE POLICY "Productos son públicos" ON products FOR SELECT USING (true);
CREATE POLICY "Solo admin puede modificar productos" ON products FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para categorías (lectura pública)
CREATE POLICY "Categorías son públicas" ON categories FOR SELECT USING (true);
CREATE POLICY "Solo admin puede modificar categorías" ON categories FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para pedidos
CREATE POLICY "Usuarios pueden ver sus propios pedidos" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden crear pedidos" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin puede ver todos los pedidos" ON orders FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para items de pedido
CREATE POLICY "Usuarios pueden ver items de sus pedidos" ON order_items FOR SELECT USING (
  order_id IN (SELECT id FROM orders WHERE auth.uid() = user_id)
);
CREATE POLICY "Admin puede gestionar items de pedido" ON order_items FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para mensajes de contacto (solo admin)
CREATE POLICY "Solo admin puede gestionar mensajes" ON contact_messages FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para diseños personalizados
CREATE POLICY "Usuarios pueden crear diseños" ON custom_designs FOR INSERT WITH CHECK (true);
CREATE POLICY "Usuarios pueden ver sus diseños" ON custom_designs FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Admin puede gestionar diseños" ON custom_designs FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para cotizaciones
CREATE POLICY "Usuarios pueden crear cotizaciones" ON quote_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin puede gestionar cotizaciones" ON quote_requests FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Políticas para registros mayoristas
CREATE POLICY "Usuarios pueden crear registros mayoristas" ON wholesale_registrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin puede gestionar registros mayoristas" ON wholesale_registrations FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- =====================================================
-- FUNCIONES ÚTILES
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_messages_updated_at BEFORE UPDATE ON contact_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_custom_designs_updated_at BEFORE UPDATE ON custom_designs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quote_requests_updated_at BEFORE UPDATE ON quote_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wholesale_registrations_updated_at BEFORE UPDATE ON wholesale_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
