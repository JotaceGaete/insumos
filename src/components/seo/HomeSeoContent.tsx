import Link from "next/link";

/**
 * Bloques de contenido SEO para la portada (no alteran carrusel ni grillas de producto).
 */
export default function HomeSeoContent() {
  return (
    <>
      <section className="border-t border-gray-100 bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            Timbres de goma y sellos personalizados para Chile
          </h2>
          <div className="space-y-4 text-base leading-relaxed text-gray-700">
            <p>
              En Artesellos fabricamos <strong>timbres de goma</strong> con acabado profesional,
              ideales para facturas, documentos internos, packaging y comunicación con clientes. Si
              buscas <strong>timbres personalizados</strong> que reflejen la identidad de tu marca,
              podemos trabajar desde tu logo, tipografías corporativas o un boceto sencillo: el
              objetivo es que cada impresión se vea nítida y consistente.
            </p>
            <p>
              Un <strong>timbre empresa</strong> agiliza la firma de guías, recibos y papeles de
              trabajo cotidiano. Muchas pymes y contadores también requieren un{" "}
              <strong>timbre RUT Chile</strong> que deje visible la razón social, el RUT y datos de
              contacto según lo que necesites validar frente a terceros. Nosotros te orientamos para
              que el diseño cumpla con buenas prácticas de legibilidad y tamaño de impresión.
            </p>
            <p>
              Trabajamos con emprendedores, talleres, comercios y oficinas que necesitan rapidez: te
              entregamos propuestas claras, plazos realistas y opciones de despacho para que recibas
              tu sello sin complicaciones. Explora nuestro catálogo en{" "}
              <Link href="/productos" className="font-medium text-indigo-600 underline hover:text-indigo-800">
                productos
              </Link>
              , pide un diseño a medida o escríbenos para una cotización al detalle.
            </p>
            <p>
              Más allá del uso administrativo, los sellos de caucho son versátiles: sirven para
              tarjetas de fidelización, bolsas, cajas y material promocional. Al combinar un buen
              grabado con tintas adecuadas, obtienes miles de impresiones uniformes. Si tienes dudas
              sobre formato automático o manual, revisa nuestras guías en el{" "}
              <Link href="/blog" className="font-medium text-indigo-600 underline hover:text-indigo-800">
                blog
              </Link>{" "}
              o solicita asesoría directa; queremos que elijas el timbre correcto para tu volumen de
              uso y tipo de papel.
            </p>
            <p>
              La confianza se construye con detalle: por eso revisamos contornos, contraste y
              espacios mínimos antes de producir. Ya sea que partas desde cero o lleves un archivo
              listo, en Artesellos encontrarás un equipo enfocado en calidad, cercanía y seguimiento
              hasta que tengas el sello en tus manos.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">
            Timbres de goma en Coronel y Concepción
          </h2>
          <p className="mb-4 text-base leading-relaxed text-gray-700">
            Atendemos con retiro y envíos desde nuestra base en la Región del Biobío, con foco en{" "}
            <strong>Coronel</strong> y <strong>Concepción</strong>, conectando también con{" "}
            <strong>Lota</strong>, <strong>Arauco</strong>, <strong>Curanilahue</strong>,{" "}
            <strong>San Pedro de la Paz</strong> y otras comunas de <strong>Chile</strong> dentro
            de la provincia y el <strong>Biobío</strong>. Si necesitas un timbre con urgencia para
            tu negocio local o despacho a otra región, coordina con nosotros y te indicamos
            alternativas según plazo y tipo de producto.
          </p>
          <p className="text-base leading-relaxed text-gray-700">
            Conocer el territorio nos permite orientarte en logística y tiempos reales; igual
            puedes cotizar en línea y recibir tu pedido donde estés. Nuestro objetivo es que{" "}
            <Link href="/timbres-empresa" className="font-medium text-indigo-600 underline hover:text-indigo-800">
              timbres para empresa
            </Link>{" "}
            y emprendimientos de la zona tengan el mismo estándar de calidad que ofrecemos a todo el
            país.
          </p>
        </div>
      </section>
    </>
  );
}
