'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function DiseñoPersonalizadoPage() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [notas, setNotas] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // Formatos permitidos
  const allowedFormats = {
    'application/pdf': ['.pdf'],
    'application/postscript': ['.ai'],
    'application/x-coreldraw': ['.cdr'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setArchivo(acceptedFiles[0]);
      setSubmitStatus({ type: null, message: '' });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: allowedFormats,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = () => {
    setArchivo(null);
    setSubmitStatus({ type: null, message: '' });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileExtension = (fileName: string): string => {
    return fileName.split('.').pop()?.toUpperCase() || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!archivo) {
      setSubmitStatus({
        type: 'error',
        message: 'Por favor, sube un archivo de diseño',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      const formData = new FormData();
      formData.append('nombre', nombre);
      formData.append('email', email);
      formData.append('notas', notas);
      formData.append('archivo', archivo);

      const response = await fetch('/api/upload-design', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitStatus({
          type: 'success',
          message: data.message || 'Tu diseño ha sido enviado exitosamente.',
        });
        // Limpiar formulario
        setNombre('');
        setEmail('');
        setNotas('');
        setArchivo(null);
      } else {
        setSubmitStatus({
          type: 'error',
          message: data.error || 'Hubo un error al enviar tu diseño. Por favor intenta nuevamente.',
        });
      }
    } catch (error) {
      console.error('Error al enviar diseño:', error);
      setSubmitStatus({
        type: 'error',
        message: 'Error de conexión. Por favor verifica tu internet e intenta nuevamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Diseño Personalizado
          </h1>
          <p className="text-lg text-gray-600">
            Sube tu diseño y te enviaremos una cotización personalizada
          </p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre */}
            <div>
              <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="Tu nombre completo"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="tu@email.com"
              />
            </div>

            {/* Notas */}
            <div>
              <label htmlFor="notas" className="block text-sm font-medium text-gray-700 mb-2">
                Notas y Especificaciones
              </label>
              <textarea
                id="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
                placeholder="Especifica el tamaño, color de tinta, cantidad aproximada, o cualquier detalle importante para tu cotización..."
              />
            </div>

            {/* Zona de carga de archivo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivo de Diseño <span className="text-red-500">*</span>
              </label>
              
              {!archivo ? (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  {isDragActive ? (
                    <p className="text-indigo-600 font-medium">Suelta el archivo aquí...</p>
                  ) : (
                    <>
                      <p className="text-gray-600 mb-2">
                        Arrastra tu archivo aquí o haz clic para seleccionar
                      </p>
                      <p className="text-sm text-gray-500">
                        Formatos permitidos: PDF, AI, CDR, JPG, PNG (máx. 10MB)
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <File className="w-8 h-8 text-indigo-600" />
                    <div>
                      <p className="font-medium text-gray-900">{archivo.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(archivo.size)} • {getFileExtension(archivo.name)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    aria-label="Eliminar archivo"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Mensaje de estado */}
            {submitStatus.type && (
              <div
                className={`p-4 rounded-lg flex items-start gap-3 ${
                  submitStatus.type === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {submitStatus.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <p
                  className={
                    submitStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }
                >
                  {submitStatus.message}
                </p>
              </div>
            )}

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={isSubmitting || !archivo}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Enviar Diseño para Cotización
                </>
              )}
            </button>
          </form>

          {/* Información adicional */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-2">
              <strong>¿Necesitas ayuda?</strong>
            </p>
            <p className="text-sm text-gray-500">
              Si tienes dudas sobre el proceso o prefieres contactarnos directamente, puedes{' '}
              <Link href="/contacto" className="text-indigo-600 hover:text-indigo-700 underline">
                visitar nuestra página de contacto
              </Link>
              {' '}o escribirnos a{' '}
              <a
                href="mailto:contacto@artema.cl"
                className="text-indigo-600 hover:text-indigo-700 underline"
              >
                contacto@artema.cl
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

