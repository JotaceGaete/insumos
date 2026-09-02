-- Script para insertar slides de ejemplo en Supabase
-- Ejecuta este script en el SQL Editor de Supabase

-- Limpiar slides existentes (opcional)
-- DELETE FROM public.slider_slides;

-- Insertar slides de ejemplo
INSERT INTO public.slider_slides (
  title, 
  subtitle, 
  description, 
  button_text, 
  button_link, 
  background_color, 
  text_color, 
  image_url, 
  slide_order, 
  active
) VALUES 
(
  'ARTEMA',
  'Timbres Personalizados Premium',
  'Crea recuerdos únicos con nuestros diseños exclusivos. Calidad profesional para todas tus ocasiones especiales.',
  'Explorar Productos',
  '/productos',
  'bg-gradient-to-r from-indigo-600 to-purple-600',
  'text-white',
  'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=1200&h=400&fit=crop',
  1,
  true
),
(
  'Personalización Total',
  'Diseña tu timbre ideal',
  'Personaliza dimensiones, texto y colores. Nuestro sistema te permite crear el timbre perfecto para cualquier ocasión.',
  'Personalizar Ahora',
  '/producto/shiny-842-automatico-medidas-38x14',
  'bg-gradient-to-r from-emerald-500 to-teal-600',
  'text-white',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=400&fit=crop',
  2,
  true
),
(
  'Entrega Rápida',
  'Recibe tu pedido en tiempo récord',
  'Envío express 24-48h disponible. Envío gratis en compras superiores a $50.000. Seguimiento en tiempo real.',
  'Ver Envíos',
  '/contacto',
  'bg-gradient-to-r from-orange-500 to-red-500',
  'text-white',
  'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=1200&h=400&fit=crop',
  3,
  true
),
(
  'Calidad Garantizada',
  '12 meses de garantía',
  'Materiales premium, fabricación profesional. Garantía completa y satisfacción asegurada en todos nuestros productos.',
  'Conoce Más',
  '/sobre-nosotros',
  'bg-gradient-to-r from-blue-600 to-indigo-600',
  'text-white',
  'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1200&h=400&fit=crop',
  4,
  true
);

-- Verificar que se insertaron correctamente
SELECT * FROM public.slider_slides WHERE active = true ORDER BY slide_order;
