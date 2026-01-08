'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRef, useEffect, useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatInterface() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCallout, setShowCallout] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll automático inteligente
  useEffect(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

      if (isNearBottom) {
        scrollToBottom();
      }
    }
  }, [messages]);

  // Mostrar el callout después de 2 segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) {
        setShowCallout(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Ocultar callout cuando se abre el chat
  useEffect(() => {
    if (isOpen) {
      setShowCallout(false);
    }
  }, [isOpen]);

  // Mensaje de bienvenida automático al abrir el chat por primera vez
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setTimeout(() => {
        setMessages([{
          id: Date.now().toString(),
          role: 'assistant',
          content: '¡Hola! 👋 Soy el asistente de Artesellos. ¿En qué puedo ayudarte hoy? Puedo ayudarte con información sobre timbres, precios, disponibilidad y más.'
        }]);
      }, 500);
    }
  }, [isOpen, messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    setTimeout(() => scrollToBottom(), 100);

    try {
      const requestBody = {
        messages: [...messages, userMessage],
        productInfo: null
      };
      const jsonString = JSON.stringify(requestBody);
      console.log('📤 Enviando petición a /api/chat');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/plain, */*',
        },
        body: jsonString,
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        let errorMessage = `Error en la respuesta del servidor: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.details) {
            errorMessage = errorData.details;
          }
        } catch {
          // Si no es JSON, usar el texto plano
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }
        console.error('❌ Error response:', errorMessage);
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No se pudo obtener el reader del stream');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: ''
      };

      setMessages(prev => [...prev, assistantMessage]);

      const decoder = new TextDecoder();
      let buffer = '';
      let hasContent = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') {
                console.log('✅ Stream completado');
                continue;
              }

              try {
                const data = JSON.parse(dataStr);
                
                if (data && typeof data === 'object' && data.content) {
                  hasContent = true;
                  setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessage.id
                      ? { ...msg, content: msg.content + data.content }
                      : msg
                  ));
                } else if (data && typeof data === 'string') {
                  hasContent = true;
                  setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessage.id
                      ? { ...msg, content: msg.content + data }
                      : msg
                  ));
                }
              } catch (parseError) {
                console.warn('⚠️ No se pudo parsear línea de streaming:', line, parseError);
              }
            }
          }

          buffer = lines[lines.length - 1];
        }
        
        if (!hasContent) {
          console.error('❌ No se recibió contenido del servidor');
          throw new Error('El servidor no devolvió contenido');
        }
      } finally {
        reader.releaseLock();
      }

    } catch (err) {
      console.error('Error al enviar mensaje:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Callout (Globo de texto) - Solo visible cuando el chat está cerrado */}
      {!isOpen && showCallout && (
        <div className="fixed bottom-20 sm:bottom-28 right-4 sm:right-6 left-4 sm:left-auto z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="relative bg-white rounded-2xl shadow-2xl p-4 max-w-[280px] sm:max-w-[280px] mx-auto sm:mx-0 border border-gray-100">
            {/* Contenido del callout */}
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">👋</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">
                  ¡Hola!
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Te ayudo a elegir el timbre que necesitas.
                </p>
              </div>
            </div>
            
            {/* Triángulo apuntando al botón (bocadillo de cómic) */}
            <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white border-b border-r border-gray-100 transform rotate-45"></div>
            
            {/* Botón de cerrar */}
            <button
              onClick={() => setShowCallout(false)}
              className="absolute -top-1 -right-1 w-5 h-5 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-xs transition-colors"
              aria-label="Cerrar mensaje"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Botón flotante REDISEÑADO */}
      <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50">
        {/* Efecto de onda/ping animado (solo cuando está cerrado) */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 animate-ping opacity-75"></span>
        )}
        
        {/* Anillo decorativo animado */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full ring-4 ring-indigo-400 ring-opacity-50 animate-pulse"></span>
        )}
        
        {/* Botón principal */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-5 rounded-full shadow-2xl transition-all duration-300 
            ${isOpen 
              ? 'hover:scale-105 hover:shadow-xl' 
              : 'hover:scale-110 hover:shadow-3xl hover:from-indigo-700 hover:to-purple-700'
            }
            focus:outline-none focus:ring-4 focus:ring-indigo-300
          `}
          aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
        >
          {isOpen ? (
            <span className="text-2xl">✕</span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-white drop-shadow-md animate-bounce group-hover:scale-110 transition-transform duration-300">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M9 10h.01" />
              <path d="M15 10h.01" />
              <path d="M12 10h.01" />
            </svg>
          )}
        </button>
      </div>

      {/* Widget del chat */}
      {isOpen && (
        <div className="fixed bottom-20 sm:bottom-28 left-2 right-2 sm:left-auto sm:right-6 sm:w-96 z-50 h-[calc(100vh-6rem)] sm:h-[500px] max-h-[600px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-300 flex flex-col">
          
          {/* Header con botón de WhatsApp */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-3 sm:p-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h2 className="text-white font-bold text-sm sm:text-base truncate">Estoy para ayudarte ¡¡</h2>
            </div>
            
            {/* Botón de WhatsApp */}
            <a
              href="https://wa.me/56922384216"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 sm:gap-2 bg-green-500 hover:bg-green-600 text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors duration-200 shadow-lg flex-shrink-0 ml-2"
              title="Hablar con un humano"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              <span className="hidden sm:inline">Humano</span>
            </a>
          </div>

          {/* Área de Mensajes */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50 min-h-0">
            {messages.length === 0 && !isLoading && (
              <div className="text-center mt-20 text-gray-400">
                <p className="text-4xl mb-2">👋</p>
                <p>Cargando...</p>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[85%] p-3 sm:p-4 rounded-2xl text-xs sm:text-sm shadow-sm break-words ${
                    m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-800'
                }`}>
                  {m.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // eslint-disable-next-line @next/next/no-img-element
                        img: ({node, ...props}) => <img {...props} className="rounded-lg mt-2 max-h-40 bg-white p-1 max-w-full" alt="img" />,
                        a: ({node, ...props}) => <a {...props} className="underline font-bold break-all" target="_blank" rel="noopener noreferrer" />,
                        p: ({node, ...props}) => <p {...props} className="break-words" />
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  ) : (
                    <div className="whitespace-pre-wrap break-words">
                      {m.content}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && <div className="text-xs text-gray-400 ml-4 animate-pulse">Escribiendo...</div>}

            {error && (
              <div className="text-xs text-red-500 ml-4 bg-red-50 p-2 rounded border border-red-200">
                Error: {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input del Chat - CRÍTICO: Control manual del estado */}
          <form onSubmit={handleSubmit} className="p-2 sm:p-4 bg-white border-t flex-shrink-0">
            <div className="flex gap-2">
              <input
                className="flex-1 p-2 sm:p-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-indigo-500 outline-none text-black text-sm sm:text-base"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe aquí..."
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-indigo-600 text-white px-3 sm:px-5 py-2 sm:py-0 rounded-full hover:bg-indigo-700 disabled:opacity-50 font-bold transition-colors duration-200 text-xs sm:text-base whitespace-nowrap"
              >
                Enviar
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
