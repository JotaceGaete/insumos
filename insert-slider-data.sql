-- Insertar datos de ejemplo en slider_slides
-- Primero eliminar datos existentes para evitar duplicados
DELETE FROM public.slider_slides WHERE slide_order IN (0, 1, 2, 3);

-- Insertar los nuevos datos
INSERT INTO public.slider_slides (title, subtitle, description, button_text, button_link, background_color, text_color, image_url, slide_order, active)
VALUES
('ARTEMA', 'Timbres Personalizados Premium', 'Crea recuerdos únicos con nuestros diseños exclusivos. Calidad profesional para todas tus ocasiones especiales.', 'Explorar Productos', '/productos', 'bg-gradient-to-r from-indigo-600 to-purple-600', 'text-white', 'https://media.artesellos.cl/sliders/1.jpg', 0, true),
('Personalización Total', 'Diseña tu timbre ideal', 'Personaliza dimensiones, texto y colores. Nuestro sistema te permite crear el timbre perfecto para cualquier ocasión.', 'Personalizar Ahora', '/producto/shiny-842-automatico-medidas-38x14', 'bg-gradient-to-r from-emerald-500 to-teal-600', 'text-white', 'https://media.artesellos.cl/sliders/2.jpg', 1, true),
('Entrega Rápida', 'Recibe tu pedido en tiempo récord', 'Envío express 24-48h disponible. Envío gratis en compras superiores a $50.000. Seguimiento en tiempo real.', 'Ver Envíos', '/contacto', 'bg-gradient-to-r from-orange-500 to-red-500', 'text-white', 'https://media.artesellos.cl/sliders/3.jpg', 2, true),
('Calidad Garantizada', '12 meses de garantía', 'Materiales premium, fabricación profesional. Garantía completa y satisfacción asegurada en todos nuestros productos.', 'Conoce Más', '/sobre-nosotros', 'bg-gradient-to-r from-blue-600 to-indigo-600', 'text-white', 'https://media.artesellos.cl/sliders/4.jpg', 3, true);
