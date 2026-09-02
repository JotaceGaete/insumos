// Ruta para regenerar embeddings de todos los fragmentos que no los tienen
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin, getUser } from '@/lib/supabaseServer';
import OpenAI from 'openai';

const ALLOWED_ADMIN_EMAILS = new Set<string>([
  'jotacegaete@gmail.com',
  'artesellos@outlook.com',
]);

export async function POST(req: NextRequest) {
  try {
    const BYPASS = process.env.NEXT_PUBLIC_ADMIN_BYPASS === 'true' || process.env.NODE_ENV !== 'production';
    if (!BYPASS) {
      const user = await getUser();
      if (!user?.email || !ALLOWED_ADMIN_EMAILS.has(user.email)) {
        return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
      }
    }

    // Cliente OpenAI: construido aquí (no a nivel de módulo) para que la
    // ausencia de OPENAI_API_KEY en un ambiente distinto a Artesellos no
    // rompa `next build` — solo falla si este endpoint se invoca.
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const supabase = createSupabaseAdmin();
    
    // Obtener todos los fragmentos
    const { data: fragments, error: fetchError } = await (supabase as any)
      .from('knowledge_base')
      .select('id, content, embedding')
      .order('id', { ascending: false });

    if (fetchError) {
      return NextResponse.json({ 
        error: 'Error al obtener fragmentos',
        details: fetchError.message 
      }, { status: 500 });
    }

    if (!fragments || fragments.length === 0) {
      return NextResponse.json({ 
        message: 'No hay fragmentos en la base de datos' 
      }, { status: 400 });
    }

    // Filtrar fragmentos sin embeddings o con embeddings inválidos
    const fragmentsWithoutEmbeddings = fragments.filter((f: any) => 
      !f.embedding || 
      !Array.isArray(f.embedding) || 
      f.embedding.length === 0
    );

    console.log(`📊 Total fragmentos: ${fragments.length}`);
    console.log(`📊 Fragmentos sin embeddings: ${fragmentsWithoutEmbeddings.length}`);

    if (fragmentsWithoutEmbeddings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Todos los fragmentos ya tienen embeddings',
        total: fragments.length,
        processed: 0,
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Regenerar embeddings para cada fragmento
    for (const fragment of fragmentsWithoutEmbeddings) {
      try {
        console.log(`🔄 Generando embedding para fragmento ID ${fragment.id}...`);
        
        // Generar embedding
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: fragment.content,
        });

        const embedding = embeddingResponse.data[0].embedding;

        // Actualizar en la base de datos
        const { error: updateError } = await (supabase as any)
          .from('knowledge_base')
          .update({ embedding })
          .eq('id', fragment.id);

        if (updateError) {
          throw updateError;
        }

        successCount++;
        console.log(`✅ Embedding generado para fragmento ID ${fragment.id}`);
        
        // Pequeña pausa para evitar rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error: any) {
        errorCount++;
        const errorMsg = `Error en fragmento ID ${fragment.id}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Proceso completado: ${successCount} embeddings generados, ${errorCount} errores`,
      total: fragments.length,
      processed: successCount,
      errors: errorCount,
      errorDetails: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('❌ Error en regenerate-embeddings:', err);
    return NextResponse.json({ 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}

