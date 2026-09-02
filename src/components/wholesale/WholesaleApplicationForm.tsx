'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, X, CheckCircle, AlertCircle, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { WholesaleApplication } from '@/types/wholesale'
import { generateWholesaleMailto } from '@/lib/emailConfig'
import { createWholesaleRequest, saveFileMetadata } from '@/lib/actions/wholesaleActions'

interface WholesaleApplicationFormProps {
  onCancel: () => void
}

export default function WholesaleApplicationForm({ onCancel }: WholesaleApplicationFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ requestId: number; mailtoLink: string } | null>(null)
  const [error, setError] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])

  const [formData, setFormData] = useState({
    rut: '',
    company: '', // razon_social
    nombre_fantasia: '',
    giro: '',
    contact_name: '', // contacto_nombre
    email: '', // contacto_email
    phone: '', // contacto_telefono
    city: '', // ciudad
    notes: ''
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    for (const file of files) {
      // Validar tamaño (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Los archivos no pueden superar los 10MB cada uno')
        return
      }

      // Validar tipo (PDF, SVG, AI, PNG, JPG)
      const validTypes = ['application/pdf', 'image/svg+xml', 'application/postscript', 'image/png', 'image/jpeg', 'image/jpg']
      if (!validTypes.includes(file.type)) {
        setError('Solo se permiten archivos PDF, SVG, AI, PNG o JPG')
        return
      }
    }

    // Máximo 3 archivos
    const newFiles = [...uploadedFiles, ...files].slice(0, 3)
    setUploadedFiles(newFiles)
    setError('')
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async (files: File[], requestId: number): Promise<string[]> => {
    const uploadedKeys: string[] = []
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileExt = file.name.split('.').pop()
        const timestamp = Date.now()
        const storageKey = `${user.id}/request-${requestId}/file-${i}-${timestamp}.${fileExt}`

        // Upload to Supabase Storage only
        const { error: uploadError } = await supabase.storage
          .from('art-files')
          .upload(storageKey, file, {
            contentType: file.type
          })

        if (uploadError) {
          console.error('Error uploading file:', uploadError)
          continue
        }

        // Save file metadata using server action
        const metadataResult = await saveFileMetadata(
          requestId,
          storageKey,
          file.name,
          file.type,
          file.size
        )

        if (!metadataResult.success) {
          console.error('Error saving file metadata:', metadataResult.error)
          continue
        }

        uploadedKeys.push(storageKey)
      }

      return uploadedKeys
    } catch (error) {
      console.error('Error in uploadFiles:', error)
      return uploadedKeys
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccess(null)
    setError('')

    try {
      // Crear FormData para la server action
      const form = new FormData()
      Object.entries(formData).forEach(([key, value]) => {
        form.append(key, value)
      })

      // Crear solicitud usando server action
      const result = await createWholesaleRequest(form)

      if (!result.success || !result.requestId) {
        setError(result.error || 'Error al crear la solicitud')
        return
      }

      const requestId = result.requestId

      // Subir archivos si existen
      if (uploadedFiles.length > 0) {
        const uploadedKeys = await uploadFiles(uploadedFiles, requestId)
        console.log(`✅ Uploaded ${uploadedKeys.length} files for request #${requestId}`)
      }

      // Preparar mailto link
      const mailtoLink = generateWholesaleMailto(requestId)

      setSuccess({ requestId, mailtoLink })
      console.log(`✅ Wholesale request created: #${requestId} for ${formData.company}`)

    } catch (error: any) {
      setError(`Error inesperado: ${error.message}`)
      console.error('Wholesale form error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="ml-3 text-lg font-medium text-green-800">
              ¡Solicitud Mayorista Enviada!
            </h3>
          </div>
          
          <div className="text-green-700 mb-6">
            <p className="mb-3">
              Recibimos tu solicitud <strong>#{success.requestId}</strong>. 
              Tus archivos están listos para revisión. Si necesitás agregar info, 
              escribinos a <strong>mayoristas@artema.cl</strong> citando este ID.
            </p>
            <p className="text-sm mb-3">
              Las respuestas llegan a nuestro buzón verificado. Si adjuntaste archivos, 
              ya quedaron registrados en tu solicitud.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={success.mailtoLink}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              <Mail className="w-4 h-4 mr-2" />
              Avisar por correo
            </a>
            
            <button
              onClick={() => router.push('/mayoristas')}
              className="inline-flex items-center justify-center px-4 py-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
            >
              Volver a mayoristas
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Datos de la Empresa */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Datos de la Empresa
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                RUT *
              </label>
              <input
                type="text"
                name="rut"
                value={formData.rut}
                onChange={handleInputChange}
                placeholder="12.345.678-9"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Razón Social *
              </label>
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleInputChange}
                placeholder="Empresa Ejemplo S.A."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de Fantasía
              </label>
              <input
                type="text"
                name="nombre_fantasia"
                value={formData.nombre_fantasia}
                onChange={handleInputChange}
                placeholder="Tienda Ejemplo"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Giro Comercial *
              </label>
              <input
                type="text"
                name="giro"
                value={formData.giro}
                onChange={handleInputChange}
                placeholder="Venta de artículos de oficina"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ciudad *
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="Santiago"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
          </div>
        </div>

        {/* Datos de Contacto */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Datos de Contacto
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Contacto *
              </label>
              <input
                type="text"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleInputChange}
                placeholder="Juan Pérez"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email de Contacto *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="contacto@empresa.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+56 9 1234 5678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Archivos */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Archivos de Diseño (Opcional)
          </h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <div className="flex text-sm text-gray-600">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                  <span>Subir archivos</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept=".pdf,.svg,.ai,.png,.jpg,.jpeg"
                    multiple
                    onChange={handleFileChange}
                    disabled={uploadedFiles.length >= 3}
                  />
                </label>
                <p className="pl-1">o arrastra y suelta</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                PDF, SVG, AI, PNG, JPG hasta 10MB cada uno (máx. 3 archivos)
              </p>
              
              {uploadedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500">
                        ({(file.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Sube tus diseños, logos, o cualquier archivo que quieras convertir en timbre. 
            Formatos vectoriales (SVG, AI) son ideales para la mejor calidad.
          </p>
        </div>

        {/* Notas adicionales */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas adicionales
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Información adicional sobre tu solicitud, necesidades especiales, etc."
          />
        </div>

        {/* Buttons */}
        <div className="flex space-x-4 pt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
        </div>
      </form>
    </div>
  )
}
