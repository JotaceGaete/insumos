// scripts/seedKnowledge.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// Cargar variables de entorno (ajusta la ruta si el script no está en la raíz)
dotenv.config({ path: './.env.local' });

// --- 1. Inicialización de Clientes ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Usamos la clave de ROL DE SERVICIO para poder escribir directamente a la base de datos (clave secreta).
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
    throw new Error('Las variables de entorno de Supabase y OpenAI deben estar configuradas en .env.local');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const EMBEDDING_MODEL = 'text-embedding-3-small'; // Modelo eficiente para embeddings

// --- 2. Base de Conocimiento de ARTEMA (Texto) ---
// Dividimos la información en bloques lógicos para mejorar la calidad del RAG.
const knowledgeChunks = [
    // Timbres de escritorio y portátiles
    "Los timbres de goma para instituciones son variados desde el automatik 912 ideal 3 líneas con 4 puede ir bien pero sus letras serán más chicas, lo que disminuye su definición, ten en cuenta que al presionar la tinta puede desparramar un poco hacia afuera de los bordes lo que hace menos legible especialmente en timbres sobretintados. El automatik 912 tiene una superficie de grabado de 18*47 mm. Si quieres un timbre porque tus datos son muchos y tiene muchas líneas de texto, para una organización o empresa te recomiendo el shiny printer 224 es un timbre muy robusto de mecánica excelente, su tamaño de 22 * 58 mm lo hace excelente para colocar gran cantidad de información. Si eres un profesional que siempre estará en el mismo lugar, te sugiero cualquier línea de timbres de escritorio.",
    
    // Timbres de bolsillo (Práctica y Uso)
    "Si eres un profesional te recomiendo nuestros timbres de bolsillo. Son muy prácticos si debes andar de un lado a otro, es fundamental este timbre, pero debes tener la suficiente práctica para que el timbrado sea bueno, porque tiene un eje central. Deberás acostumbrarte y ayudarte con tus dedos para que la impresión sea regular. Cuando te acostumbres, tus impresiones saldrán perfectas.",

    // Calidad de Goma y Durabilidad
    "Nosotros diseñamos nuestros timbres con tecnología de este año. Hay fabricantes de timbres que hacen sus timbres en gomas químicas que reaccionan a la luz. Pues bien, esos timbres son poco durables pues la goma se va endureciendo hasta quedar parecido a un plástico por su rigidez, lo que hace que no adhiera la tinta. En este caso, ten la seguridad que nuestros timbres son durables en el tiempo.",

    // Políticas de Envío (Starken, Costos, Tiempos)
    "Los envíos son generalmente por Staken. Se que estamos en Coronel (para gente de otras regiones puede parecer que estamos en Marte), pero los courier han hecho que el lapso de entrega sea rápido así sea en regiones o si vives en Santiago. Ejemplo: si vives en Valparaíso y pides tu timbre hoy, pasado mañana está en tu domicilio (si lo pides temprano quizá hasta despachemos en el día). El costo es uniforme a cualquier lugar de Chile, y si tu compra supera los $30.000 pesos el envío es gratis. Nosotros no cobramos adicional por la inclusión de un logo, hay lugares que sí lo hacen.",

    // Proceso de Diseño y Garantía de Satisfacción
    "Enviamos un diseño previo a tu WhatsApp. Ten en cuenta que detalles menores (un logo muy rebuscado) es posible que no se noten en el timbre. Los logos deben ser en blanco y negro, pero si tu diseño no es así, te sugiero que lo envíes para así poder ver qué solución tiene. No somos complicados, nos gusta ayudar. Queremos que estés contento con tu timbre, hay mucha gente que viene de hacer un timbre en otros lados y no les gustó. Nosotros trabajamos junto al cliente para una satisfacción total. Nosotros enviamos el diseño final antes de grabar, tú nos das el OK y recién ahí lo grabamos.",

    // Procesos de Compra y Pago
    "No tenemos carrito ya que hemos visto que el 100 por 100 de nuestros pedidos prefiere WhatsApp para completar el pedido. Puedes pagarlo mediante transferencia o link de pago que te enviaremos al recibir tu solicitud. No realizamos trabajos sin tener el trabajo pagado, tampoco realizamos el diseño previo sin el pago de la totalidad del timbre. Tampoco colocamos intrincados métodos de confección de timbre en la página porque el cliente necesita una solución, no es un diseñador gráfico. En eso te ayudamos nosotros vía WhatsApp.",

    // Descuentos y Contacto
    "Si necesitas hacer varios timbres, puedes consultar por un descuento, muchas empresas se benefician al hacer esto. Trata siempre de canalizar por correo o WhatsApp tu solicitud. Tenemos casi 30 años de experiencia en la fabricación de timbres. No tenemos modelos de timbres disponibles de momento, pero puedes buscar modelos en la web y nosotros nos ocupamos de que sea lo más cercano posible al diseño elegido."
];

// --- 3. Función Principal de Carga ---
async function loadKnowledgeBase() {
    console.log(`\nIniciando carga de ${knowledgeChunks.length} bloques de conocimiento a Supabase...`);

    const recordsToInsert = [];

    for (const [index, chunk] of knowledgeChunks.entries()) {
        try {
            console.log(`[${index + 1}/${knowledgeChunks.length}] Creando embedding para el chunk: "${chunk.substring(0, 50)}..."`);

            // Llamada a la API de OpenAI para obtener el vector
            const response = await openai.embeddings.create({
                model: EMBEDDING_MODEL,
                input: chunk,
            });

            // Extraer el vector
            const embedding = response.data[0].embedding;

            recordsToInsert.push({
                content: chunk,
                embedding: embedding,
            });

        } catch (error) {
            console.error(`Error procesando chunk ${index + 1}:`, error.message);
            // Salta este chunk y continúa con el siguiente
        }
    }

    // --- 4. Inserción Masiva en Supabase ---
    console.log('\nInsertando datos vectorizados en la tabla knowledge_base...');
    const { data, error } = await supabase
        .from('knowledge_base')
        .insert(recordsToInsert);

    if (error) {
        console.error('ERROR FATAL al insertar en Supabase:', error);
        return;
    }

    console.log(`\n✅ ¡Éxito! Se insertaron ${recordsToInsert.length} registros en la base de conocimiento.`);
    console.log('Tu chatbot ya puede acceder a esta información.');
}

// Ejecutar la función
loadKnowledgeBase();