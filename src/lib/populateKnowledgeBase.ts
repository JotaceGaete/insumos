// Script helper para poblar la base de conocimiento
// Este archivo puede ser usado para insertar contenido en knowledge_base
// desde tu aplicación o scripts de migración

import OpenAI from 'openai';
import { createSupabaseAdmin } from './supabaseServer';

// Cliente OpenAI: construido de forma diferida (singleton memoizado) para
// que la ausencia de OPENAI_API_KEY en un ambiente distinto a ARTEMA no
// rompa `next build` en cualquier ruta que importe este módulo — solo falla
// si alguna de las funciones exportadas aquí abajo llega a invocarse.
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Genera un embedding para un texto usando OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await getOpenAIClient().embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Error al generar embedding:', error);
    throw error;
  }
}

/**
 * Inserta un fragmento de conocimiento en la base de datos
 */
export async function insertKnowledge(
  content: string,
  metadata?: Record<string, any>
): Promise<{ id: number; success: boolean }> {
  try {
    console.log('📝 Insertando conocimiento:', content.substring(0, 50) + '...');

    // Generar embedding
    const embedding = await generateEmbedding(content);
    console.log('✅ Embedding generado');

    // Insertar en Supabase
    const supabase = createSupabaseAdmin();
    const { data, error } = await (supabase as any)
      .from('knowledge_base')
      .insert({
        content,
        embedding,
        ...(metadata && { metadata }),
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Error al insertar:', error);
      throw error;
    }

    console.log('✅ Conocimiento insertado con ID:', data.id);
    return { id: data.id, success: true };
  } catch (error) {
    console.error('❌ Error en insertKnowledge:', error);
    return { id: 0, success: false };
  }
}

/**
 * Inserta múltiples fragmentos de conocimiento
 */
export async function insertMultipleKnowledge(
  contents: string[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const content of contents) {
    const result = await insertKnowledge(content);
    if (result.success) {
      success++;
    } else {
      failed++;
    }
    // Pequeña pausa para evitar rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { success, failed };
}

/**
 * Ejemplo de contenido inicial para poblar la base de conocimiento
 */
export const exampleKnowledge = [
  'ARTEMA es una tienda especializada en timbres personalizados ubicada en el centro de Santiago, Providencia, Chile.',
  'Los horarios de atención son: Lunes a Viernes de 9:00 a 18:00, y Sábados de 10:00 a 14:00.',
  'Para consultas rápidas, los clientes pueden contactar vía WhatsApp. El email de contacto es contacto@artema.cl.',
  'ARTEMA realiza envíos a todo Chile. Para pedidos superiores a $15.000, el envío tiene un costo de $3.500. Los pedidos superiores a $50.000 tienen envío gratis.',
  'La marca Shiny es una línea premium de timbres. El modelo Shiny 722 es un timbre de bolsillo con medidas de 14x38mm, ideal para profesionales.',
  'Trodat es una marca reconocida mundialmente de timbres. El modelo Trodat 4912 es un timbre automático estándar muy popular.',
  'Automatik es el nombre de una marca especializada en timbres automáticos. No debe confundirse con el término genérico "automáticos".',
  'El stock mostrado en línea es para compra online inmediata. La tienda física en el centro de Santiago cuenta con mayor stock disponible.',
  'Para pedidos mayoristas o cantidades grandes, se recomienda contactar directamente con la tienda física que tiene mayor disponibilidad.',
  'Los timbres pueden personalizarse con diseños custom, incluyendo texto, logos y diferentes colores de tinta (negro, rojo, azul, verde, morado).',
];

/**
 * Función helper para poblar la base de conocimiento con ejemplos
 * Ejecutar desde un script o API route de administración
 */
export async function populateExampleKnowledge(): Promise<void> {
  console.log('🚀 Iniciando población de base de conocimiento...');
  const result = await insertMultipleKnowledge(exampleKnowledge);
  console.log(`✅ Proceso completado: ${result.success} exitosos, ${result.failed} fallidos`);
}

