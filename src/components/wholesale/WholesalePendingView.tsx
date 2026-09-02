'use client'

import { Clock, FileText, CheckCircle, Mail, Phone } from 'lucide-react'
import { WholesaleAccount } from '@/types/wholesale'

interface WholesalePendingViewProps {
  account: WholesaleAccount
}

export default function WholesalePendingView({ account }: WholesalePendingViewProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Status Banner */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
            <Clock className="w-10 h-10 text-yellow-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Solicitud en Revisión
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Tu solicitud de cuenta mayorista está siendo evaluada por nuestro equipo. 
            Te contactaremos en los próximos 2-3 días hábiles.
          </p>
        </div>

        {/* Application Details */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Detalles de tu Solicitud
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Razón Social</h3>
              <p className="text-gray-900">{account.razon_social}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">RUT</h3>
              <p className="text-gray-900">{account.rut}</p>
            </div>
            
            {account.nombre_fantasia && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Nombre de Fantasía</h3>
                <p className="text-gray-900">{account.nombre_fantasia}</p>
              </div>
            )}
            
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Giro</h3>
              <p className="text-gray-900">{account.giro}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Ciudad</h3>
              <p className="text-gray-900">{account.ciudad}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Fecha de Solicitud</h3>
              <p className="text-gray-900">{formatDate(account.created_at)}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Contacto</h3>
              <p className="text-gray-900">{account.contacto_nombre}</p>
              <p className="text-sm text-gray-600">{account.contacto_email}</p>
              {account.contacto_telefono && (
                <p className="text-sm text-gray-600">{account.contacto_telefono}</p>
              )}
            </div>

            {account.comprobante_url && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Comprobante</h3>
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <a 
                    href={account.comprobante_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 text-sm"
                  >
                    Ver archivo adjunto
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Process Timeline */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Proceso de Evaluación
          </h2>
          
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Solicitud Recibida</h3>
                <p className="text-sm text-gray-500">{formatDate(account.created_at)}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Tu solicitud ha sido recibida y está en cola de revisión.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">En Revisión</h3>
                <p className="text-sm text-gray-500">En proceso</p>
                <p className="text-sm text-gray-600 mt-1">
                  Nuestro equipo comercial está evaluando tu solicitud y verificando la información proporcionada.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Respuesta</h3>
                <p className="text-sm text-gray-400">Pendiente</p>
                <p className="text-sm text-gray-500 mt-1">
                  Te contactaremos por email con el resultado de la evaluación.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Expected Timeline */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-8 mb-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              ¿Qué Sigue?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="font-medium text-gray-900 mb-2">Verificación</h3>
                <p className="text-sm text-gray-600">
                  Validamos tu información comercial y documentos
                </p>
              </div>
              
              <div>
                <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="font-medium text-gray-900 mb-2">Notificación</h3>
                <p className="text-sm text-gray-600">
                  Te enviamos el resultado por email en 2-3 días hábiles
                </p>
              </div>
              
              <div>
                <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="font-medium text-gray-900 mb-2">Activación</h3>
                <p className="text-sm text-gray-600">
                  Si eres aprobado, accedes inmediatamente a precios mayoristas
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            ¿Tienes Preguntas?
          </h2>
          <p className="text-gray-600 mb-6">
            Si necesitas actualizar información o tienes consultas sobre tu solicitud, 
            no dudes en contactarnos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:mayoristas@artema.cl"
              className="inline-flex items-center justify-center px-6 py-3 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Mail className="w-5 h-5 mr-2" />
              mayoristas@artema.cl
            </a>
            <a
              href="tel:+56912345678"
              className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Phone className="w-5 h-5 mr-2" />
              +56 9 1234 5678
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
