'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Star, Clock, FileText, Shield, TrendingUp } from 'lucide-react'
import WholesaleApplicationForm from './WholesaleApplicationForm'
import { WholesaleAccount } from '@/types/wholesale'

interface WholesalePublicViewProps {
  showApplicationForm?: boolean
  rejectedAccount?: WholesaleAccount
}

export default function WholesalePublicView({ 
  showApplicationForm = false, 
  rejectedAccount 
}: WholesalePublicViewProps) {
  const [showForm, setShowForm] = useState(showApplicationForm)

  const benefits = [
    {
      icon: <TrendingUp className="w-8 h-8 text-indigo-600" />,
      title: "Descuentos por Nivel",
      description: "Hasta 30% de descuento según tu volumen de compras",
      details: ["Nivel A: 30% descuento", "Nivel B: 25% descuento", "Nivel C: 20% descuento"]
    },
    {
      icon: <Clock className="w-8 h-8 text-indigo-600" />,
      title: "Atención Prioritaria",
      description: "Soporte técnico especializado y tiempos de respuesta preferenciales",
      details: ["Asesoría técnica dedicada", "Plazos de producción prioritarios", "Servicio post-venta especializado"]
    },
    {
      icon: <FileText className="w-8 h-8 text-indigo-600" />,
      title: "Archivos Verificados",
      description: "Revisión profesional de tus diseños por nuestro equipo de expertos",
      details: ["Validación técnica previa", "Optimización de archivos", "Recomendaciones de mejora"]
    },
    {
      icon: <Shield className="w-8 h-8 text-indigo-600" />,
      title: "Condiciones Flexibles",
      description: "Opciones de pago y crédito adaptadas a tu negocio",
      details: ["Transferencia bancaria", "Pago seguro con Haulmer", "Crédito a 7 días (sujeto a aprobación)"]
    }
  ]

  const requirements = [
    "RUT activo y al día",
    "Razón social registrada",
    "Actividad comercial verificable",
    "Contacto comercial designado",
    "Comprobante de actividad (opcional)"
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Programa de Receptorías
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-indigo-100">
              Precios mayoristas, producción ágil y soporte técnico para tu negocio
            </p>
            
            {rejectedAccount && (
              <div className="bg-red-500/20 border border-red-300 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
                <p className="text-red-100 mb-2">
                  <strong>Solicitud anterior rechazada:</strong>
                </p>
                <p className="text-red-200 text-sm">
                  {rejectedAccount.rejection_reason || 'No se cumplieron los requisitos mínimos.'}
                </p>
                <p className="text-red-100 text-sm mt-2">
                  Puedes enviar una nueva solicitud corrigiendo los puntos indicados.
                </p>
              </div>
            )}
            
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="bg-white text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors inline-flex items-center space-x-2"
              >
                <span>Solicitar Alta de Comercio</span>
                <CheckCircle className="w-5 h-5" />
              </button>
            ) : (
              <div className="text-center">
                <p className="text-indigo-100 mb-4">
                  Completa el formulario a continuación para solicitar tu cuenta mayorista
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Beneficios Exclusivos
            </h2>
            <p className="text-lg text-gray-600">
              Diseñado especialmente para potenciar tu negocio
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {benefit.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {benefit.description}
                    </p>
                    <ul className="space-y-1">
                      {benefit.details.map((detail, idx) => (
                        <li key={idx} className="flex items-center text-sm text-gray-500">
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Requisitos para Aplicar
            </h2>
            <p className="text-lg text-gray-600">
              Cumple estos requisitos básicos para ser parte de nuestro programa
            </p>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {requirements.map((requirement, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">{requirement}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Application Form Section */}
      {showForm && (
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Solicitud de Alta
              </h2>
              <p className="text-lg text-gray-600">
                Completa los siguientes datos para evaluar tu solicitud
              </p>
            </div>

            <WholesaleApplicationForm onCancel={() => setShowForm(false)} />
          </div>
        </section>
      )}

      {/* Process Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Proceso de Aprobación
            </h2>
            <p className="text-lg text-gray-600">
              Así es como funciona nuestro proceso de alta
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                1. Solicitud
              </h3>
              <p className="text-gray-600">
                Completa el formulario con los datos de tu empresa
              </p>
            </div>

            <div className="text-center">
              <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                2. Evaluación
              </h3>
              <p className="text-gray-600">
                Nuestro equipo revisa tu solicitud en 2-3 días hábiles
              </p>
            </div>

            <div className="text-center">
              <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                3. Activación
              </h3>
              <p className="text-gray-600">
                Una vez aprobado, accedes inmediatamente a precios mayoristas
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-indigo-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            ¿Tienes Preguntas?
          </h2>
          <p className="text-xl text-indigo-100 mb-8">
            Nuestro equipo comercial está aquí para ayudarte
          </p>
          <div className="space-y-4 md:space-y-0 md:space-x-6 md:flex md:justify-center">
            <Link
              href="/contacto"
              className="bg-white text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block"
            >
              Contactar Asesor
            </Link>
            <Link
              href="mailto:mayoristas@artema.cl"
              className="border border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-indigo-600 transition-colors inline-block"
            >
              mayoristas@artema.cl
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
