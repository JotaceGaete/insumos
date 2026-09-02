'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Copy, Check, CreditCard, Building2, Send } from 'lucide-react';

// Componente interno que usa useSearchParams
function CheckoutContent() {
  const searchParams = useSearchParams();
  const monto = searchParams.get('monto') || '0';
  const detalle = searchParams.get('detalle') || 'Productos varios';

  const [activeTab, setActiveTab] = useState<'transferencia' | 'tarjeta'>('transferencia');
  const [copied, setCopied] = useState(false);

  // Formatear monto como pesos chilenos
  const formatCLP = (amount: string) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(parseFloat(amount));
  };

  // Datos bancarios de ARTEMA
  const datosBancarios = {
    banco: 'Banco Santander',
    tipoCuenta: 'Cuenta Corriente',
    numeroCuenta: '92139123',
    rut: '77804207-K',
    titular: 'ARTEMA SpA',
    email: 'contacto@artema.cl'
  };

  // Copiar datos bancarios al portapapeles
  const copiarDatos = () => {
    const texto = `Banco: ${datosBancarios.banco}
Tipo: ${datosBancarios.tipoCuenta}
N° Cuenta: ${datosBancarios.numeroCuenta}
RUT: ${datosBancarios.rut}
Titular: ${datosBancarios.titular}
Email: ${datosBancarios.email}
Monto: ${formatCLP(monto)}`;

    navigator.clipboard.writeText(texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Link de WhatsApp con mensaje pre-llenado
  const whatsappLink = `https://wa.me/56922384216?text=${encodeURIComponent(
    `¡Hola! Ya realicé el pago de ${formatCLP(monto)} por: ${detalle}. Adjunto comprobante.`
  )}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Completa tu Compra
          </h1>
          <p className="text-gray-600">
            Elige tu método de pago preferido
          </p>
        </div>

        {/* Tarjeta Principal - Tipo Ticket */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden mb-6">
          
          {/* Resumen del Pedido */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              Resumen de tu Pedido
            </h2>
            
            <div className="space-y-3">
              {/* Detalle */}
              <div className="flex justify-between items-start">
                <span className="text-indigo-100 text-sm">Detalle:</span>
                <span className="text-white font-medium text-right max-w-xs">{detalle}</span>
              </div>

              {/* Total */}
              <div className="border-t border-indigo-400/30 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-indigo-100 text-sm">Total a Pagar:</span>
                  <span className="text-3xl font-bold">{formatCLP(monto)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Opciones de Pago - Tabs */}
          <div className="p-6">
            {/* Tabs Header */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab('transferencia')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'transferencia'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Building2 className="w-4 h-4 inline-block mr-2" />
                Transferencia
              </button>
              <button
                onClick={() => setActiveTab('tarjeta')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  activeTab === 'tarjeta'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <CreditCard className="w-4 h-4 inline-block mr-2" />
                Tarjeta / Webpay
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'transferencia' ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Datos Bancarios de ARTEMA
                </h3>

                {/* Datos Bancarios */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Banco:</span>
                    <span className="text-sm font-semibold text-gray-900">{datosBancarios.banco}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Tipo de Cuenta:</span>
                    <span className="text-sm font-semibold text-gray-900">{datosBancarios.tipoCuenta}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">N° Cuenta:</span>
                    <span className="text-sm font-semibold text-gray-900">{datosBancarios.numeroCuenta}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">RUT:</span>
                    <span className="text-sm font-semibold text-gray-900">{datosBancarios.rut}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Titular:</span>
                    <span className="text-sm font-semibold text-gray-900">{datosBancarios.titular}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Email:</span>
                    <span className="text-sm font-semibold text-gray-900">{datosBancarios.email}</span>
                  </div>
                </div>

                {/* Botón Copiar */}
                <button
                  onClick={copiarDatos}
                  className="w-full py-3 px-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      <span>Copiar Datos Bancarios</span>
                    </>
                  )}
                </button>

                {/* Nota */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <p className="font-semibold mb-1">📌 Importante:</p>
                  <p>Después de realizar la transferencia, envíanos el comprobante por WhatsApp para confirmar tu pedido.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Pago con Tarjeta en Tuu.cl
                </h3>

                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-6 border border-purple-200">
                  <div className="text-center mb-4">
                    <CreditCard className="w-12 h-12 mx-auto text-indigo-600 mb-3" />
                    <p className="text-gray-700 mb-2">
                      Serás redirigido a <span className="font-bold">Tuu.cl</span> para completar tu pago de forma segura.
                    </p>
                  </div>

                  {/* Botón Principal */}
                  <a
                    href="https://www.tuu.cl/arteselloschile"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center rounded-lg font-bold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] duration-200"
                  >
                    Ir a Pagar en Tuu.cl →
                  </a>

                  {/* Instrucciones */}
                  <div className="mt-4 bg-white rounded-lg p-4 border border-indigo-200">
                    <p className="text-sm font-semibold text-gray-900 mb-2">
                      ⚠️ Al ingresar a Tuu.cl:
                    </p>
                    <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                      <li>Digita el monto exacto: <span className="font-bold text-indigo-600">{formatCLP(monto)}</span></li>
                      <li>Completa el formulario de pago</li>
                      <li>Confirma tu compra</li>
                    </ol>
                  </div>
                </div>

                {/* Nota de seguridad */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                  <p className="font-semibold mb-1">🔒 Pago Seguro</p>
                  <p>Tuu.cl es una plataforma certificada por Webpay. Tus datos están protegidos.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botón WhatsApp - Enviar Comprobante */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 text-center">
          <h3 className="font-semibold text-gray-900 mb-3">
            ¿Ya realizaste el pago?
          </h3>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors shadow-md hover:shadow-lg"
          >
            <Send className="w-5 h-5" />
            <span>Enviar Comprobante por WhatsApp</span>
          </a>
          <p className="text-xs text-gray-500 mt-3">
            Te contactaremos para confirmar tu pedido
          </p>
        </div>

        {/* Link Volver */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-indigo-600 transition-colors"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

// Componente principal con Suspense
export default function PagarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}

