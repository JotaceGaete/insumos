import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    // Cliente Supabase: construido dentro del handler (no a nivel de módulo)
    // para que la ausencia de estas variables legacy en un ambiente distinto
    // a Artesellos no rompa `next build` — solo falla si este endpoint se invoca.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const body = await req.json();
    const { email } = body;

    // Validación básica del email
    if (!email) {
      return NextResponse.json(
        { error: 'Email es requerido' },
        { status: 400 }
      );
    }

    // Validación de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    console.log('📧 Registrando lead:', email);

    // Verificar si el email ya existe (opcional)
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingLead) {
      console.log('ℹ️ Lead ya existente:', email);
      // No es error, permitimos acceso igual
      return NextResponse.json({
        success: true,
        message: 'Lead ya registrado',
        existing: true
      });
    }

    // Insertar lead en la base de datos
    const { data, error } = await supabase
      .from('leads')
      .insert([
        {
          email: email.toLowerCase().trim()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Error guardando lead:', error);
      // Aún así permitimos acceso (para no bloquear el chat)
      return NextResponse.json({
        success: true,
        message: 'Lead procesado',
        warning: 'Error al guardar pero acceso permitido'
      });
    }

    console.log('✅ Lead guardado exitosamente:', data);

    return NextResponse.json({
      success: true,
      message: 'Lead registrado exitosamente',
      leadId: data.id
    });

  } catch (error: any) {
    console.error('❌ Error en /api/lead:', error);
    
    // En caso de error, permitimos acceso igual
    return NextResponse.json({
      success: true,
      message: 'Acceso permitido',
      warning: 'Error al procesar pero acceso concedido'
    });
  }
}

