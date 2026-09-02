export default function TerminosPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Términos y Condiciones
        </h1>
        <p className="text-lg text-gray-600">
          Última actualización: {new Date().toLocaleDateString('es-CL')}
        </p>
      </div>

      <div className="space-y-8">
        {/* Introducción */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            1. Introducción
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Bienvenido a ARTEMA. Estos términos y condiciones regulan el uso de nuestro sitio web
            y los servicios que ofrecemos. Al acceder y utilizar nuestros servicios, aceptas estar
            sujeto a estos términos.
          </p>
        </section>

        {/* Servicios */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            2. Servicios
          </h2>
          <div className="text-gray-600 leading-relaxed space-y-4">
            <p>
              ARTEMA ofrece los siguientes servicios:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Diseño y producción de timbres personalizados</li>
              <li>Venta de productos personalizados</li>
              <li>Servicio de cotizaciones personalizadas</li>
              <li>Registro de comercios mayoristas</li>
              <li>Atención al cliente y soporte técnico</li>
            </ul>
          </div>
        </section>

        {/* Precios y Pagos */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            3. Precios y Pagos
          </h2>
          <div className="text-gray-600 leading-relaxed space-y-4">
            <p>
              Todos los precios están expresados en pesos chilenos (CLP) e incluyen IVA.
            </p>
            <p>
              Los métodos de pago aceptados son:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Transferencia bancaria</li>
              <li>Tarjetas de crédito y débito</li>
              <li>PayPal y otros medios electrónicos</li>
            </ul>
            <p>
              Los pagos deben realizarse por adelantado. No procesamos pedidos hasta
              recibir confirmación de pago.
            </p>
          </div>
        </section>

        {/* Envíos y Entregas */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            4. Envíos y Entregas
          </h2>
          <div className="text-gray-600 leading-relaxed space-y-4">
            <p>
              Realizamos envíos a todo Chile a través de servicios de courier reconocidos.
            </p>
            <p>
              Los plazos de entrega son:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Santiago y alrededores: 2-3 días hábiles</li>
              <li>Regiones: 3-5 días hábiles</li>
              <li>Productos personalizados: 7-10 días hábiles</li>
            </ul>
            <p>
              Los costos de envío se calculan según el destino y peso del paquete.
            </p>
          </div>
        </section>

        {/* Devoluciones y Cambios */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            5. Devoluciones y Cambios
          </h2>
          <div className="text-gray-600 leading-relaxed space-y-4">
            <p>
              Aceptamos devoluciones dentro de los primeros 7 días hábiles desde la recepción
              del producto, siempre y cuando:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>El producto esté en perfectas condiciones</li>
              <li>Conserve su empaque original</li>
              <li>No haya sido usado o alterado</li>
              <li>Presente el comprobante de compra</li>
            </ul>
            <p>
              Los costos de envío de devolución corren por cuenta del cliente, salvo en casos
              de productos defectuosos o errores de nuestra parte.
            </p>
          </div>
        </section>

        {/* Propiedad Intelectual */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            6. Propiedad Intelectual
          </h2>
          <div className="text-gray-600 leading-relaxed space-y-4">
            <p>
              Todos los diseños, logos, textos e imágenes de nuestro sitio web son propiedad
              de ARTEMA o de nuestros proveedores de contenido.
            </p>
            <p>
              Al realizar un pedido de diseño personalizado, el cliente cede los derechos
              de uso del diseño final a ARTEMA para fines de producción únicamente.
            </p>
            <p>
              Queda estrictamente prohibida la reproducción, distribución o uso comercial
              de nuestros diseños sin autorización expresa.
            </p>
          </div>
        </section>

        {/* Privacidad y Datos Personales */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            7. Privacidad y Protección de Datos
          </h2>
          <div className="text-gray-600 leading-relaxed space-y-4">
            <p>
              Respetamos tu privacidad y nos comprometemos a proteger tus datos personales
              conforme a la legislación chilena (Ley 19.628 sobre Protección de Datos).
            </p>
            <p>
              Utilizamos tus datos únicamente para:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Procesar tus pedidos y entregas</li>
              <li>Comunicarnos contigo sobre tu compra</li>
              <li>Mejorar nuestros servicios</li>
              <li>Cumplir con obligaciones legales</li>
            </ul>
            <p>
              No compartimos tus datos con terceros sin tu consentimiento expreso.
            </p>
          </div>
        </section>

        {/* Limitación de Responsabilidad */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            8. Limitación de Responsabilidad
          </h2>
          <div className="text-gray-600 leading-relaxed space-y-4">
            <p>
              ARTEMA no se hace responsable por:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Retrasos en entregas causados por servicios de courier</li>
              <li>Pérdidas o daños durante el transporte (salvo negligencia nuestra)</li>
              <li>Uso indebido de nuestros productos</li>
              <li>Daños indirectos o consecuentes</li>
            </ul>
          </div>
        </section>

        {/* Modificaciones */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            9. Modificaciones a los Términos
          </h2>
          <div className="text-gray-600 leading-relaxed space-y-4">
            <p>
              Nos reservamos el derecho de modificar estos términos y condiciones en cualquier momento.
              Las modificaciones entrarán en vigor inmediatamente después de su publicación en nuestro sitio web.
            </p>
            <p>
              Te recomendamos revisar periódicamente estos términos para estar al tanto de cualquier cambio.
            </p>
          </div>
        </section>

        {/* Legislación Aplicable */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            10. Legislación Aplicable
          </h2>
          <div className="text-gray-600 leading-relaxed space-y-4">
            <p>
              Estos términos se rigen por las leyes de la República de Chile.
              Cualquier disputa será resuelta en los tribunales competentes de Santiago.
            </p>
          </div>
        </section>

        {/* Contacto */}
        <section className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Contacto
          </h2>
          <div className="text-gray-600 space-y-2">
            <p>
              Si tienes preguntas sobre estos términos y condiciones,
              puedes contactarnos en:
            </p>
            <ul className="space-y-1">
              <li>Email: jotacegaete@gmail.com</li>
              <li>Teléfono: +56 9 XXXX XXXX</li>
              <li>Dirección: Santiago, Chile</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
