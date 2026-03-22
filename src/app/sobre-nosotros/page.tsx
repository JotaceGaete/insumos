import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sobre nosotros",
  description:
    "Artesellos: timbres personalizados y sellos de goma con taller en la Región del Biobío, Chile.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/sobre-nosotros" },
};

export default function SobreNosotrosPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Sobre Artesellos
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Somos especialistas en timbres personalizados, creando recuerdos únicos
          para momentos especiales desde 2018.
        </p>
      </div>

      {/* Nuestra Historia */}
      <section className="mb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Nuestra Historia
            </h2>
            <div className="space-y-4 text-gray-600">
              <p>
                Artesellos nació en 2018 como un pequeño taller familiar en Santiago,
                Chile. Todo comenzó con la pasión por crear recuerdos únicos y
                personalizados para ocasiones especiales.
              </p>
              <p>
                Lo que empezó como un hobby se convirtió rápidamente en un negocio
                dedicado a ofrecer timbres personalizados de la más alta calidad,
                utilizando técnicas artesanales tradicionales combinadas con
                tecnología moderna.
              </p>
              <p>
                Hoy, somos líderes en el mercado de timbres personalizados en Chile,
                sirviendo a miles de clientes satisfechos que confían en nosotros
                para crear recuerdos inolvidables.
              </p>
            </div>
          </div>
          <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500">Imagen de nuestro taller</p>
            </div>
          </div>
        </div>
      </section>

      {/* Nuestros Valores */}
      <section className="mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Nuestros Valores
          </h2>
          <p className="text-lg text-gray-600">
            Los principios que guían todo lo que hacemos
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Calidad Superior
            </h3>
            <p className="text-gray-600">
              Utilizamos los mejores materiales y técnicas artesanales
              para garantizar productos duraderos y de alta calidad.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Personalización
            </h3>
            <p className="text-gray-600">
              Cada timbre es único y diseñado específicamente para
              las necesidades y gustos de nuestros clientes.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Puntualidad
            </h3>
            <p className="text-gray-600">
              Cumplimos con nuestros plazos de entrega y mantenemos
              una comunicación constante con nuestros clientes.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Atención Personalizada
            </h3>
            <p className="text-gray-600">
              Cada cliente es único y recibe atención personalizada
              desde la consulta inicial hasta la entrega final.
            </p>
          </div>
        </div>
      </section>

      {/* Nuestro Equipo */}
      <section className="mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Nuestro Equipo
          </h2>
          <p className="text-lg text-gray-600">
            Las personas detrás de Artesellos
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="bg-gray-100 w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Juan Pérez
            </h3>
            <p className="text-indigo-600 mb-2">Fundador & Diseñador</p>
            <p className="text-gray-600 text-sm">
              Artesano con más de 15 años de experiencia en diseño gráfico
              y técnicas tradicionales de impresión.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-gray-100 w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              María González
            </h3>
            <p className="text-indigo-600 mb-2">Gerente de Ventas</p>
            <p className="text-gray-600 text-sm">
              Especialista en atención al cliente con amplia experiencia
              en el sector retail y ventas B2B.
            </p>
          </div>

          <div className="text-center">
            <div className="bg-gray-100 w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Carlos Rodríguez
            </h3>
            <p className="text-indigo-600 mb-2">Producción</p>
            <p className="text-gray-600 text-sm">
              Encargado de la producción y control de calidad,
              asegurando que cada timbre cumpla con nuestros estándares.
            </p>
          </div>
        </div>
      </section>

      {/* Estadísticas */}
      <section className="mb-16">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">
              Artesellos en Números
            </h2>
            <p className="text-indigo-100">
              Nuestra trayectoria y crecimiento año tras año
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">2018</div>
              <div className="text-indigo-100">Año de fundación</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">5000+</div>
              <div className="text-indigo-100">Clientes satisfechos</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">25000+</div>
              <div className="text-indigo-100">Timbres producidos</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">98%</div>
              <div className="text-indigo-100">Satisfacción cliente</div>
            </div>
          </div>
        </div>
      </section>

      {/* Nuestra Misión y Visión */}
      <section className="mb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="bg-white p-8 rounded-lg shadow-sm border">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Nuestra Misión
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Crear timbres personalizados de excepcional calidad que preserven
              momentos únicos y especiales en la vida de nuestros clientes.
              Nos comprometemos a ofrecer productos artesanales, atención
              personalizada y un servicio que exceda las expectativas.
            </p>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-sm border">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Nuestra Visión
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Ser la empresa líder en timbres personalizados en Latinoamérica,
              reconocida por nuestra innovación, calidad artesanal y compromiso
              con la satisfacción total de nuestros clientes. Aspiramos a
              expandir nuestros servicios y convertirnos en el referente
              indiscutible del sector.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center">
        <div className="bg-gray-50 rounded-lg p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            ¿Listo para crear tu timbre personalizado?
          </h2>
          <p className="text-lg text-gray-600 mb-6">
            Contacta con nosotros y comienza a diseñar el timbre perfecto
            para tu ocasión especial.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/productos"
              className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Ver Productos
            </Link>
            <Link
              href="/contacto"
              className="border border-indigo-600 text-indigo-600 px-8 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors"
            >
              Contactar
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
