import { NextRequest, NextResponse } from 'next/server';
import { createInsumosSupabaseServer } from '@/features/shared/server/supabase';

// Standard @supabase/ssr PKCE callback: exchanges the ?code= Supabase Auth
// appends to the confirmation-link redirect for a real session (cookies get
// set by createInsumosSupabaseServer's setAll). INSUMOS-only — never shares
// this route or its cookies with the legacy Artesellos auth.
//
// The session established here is already a verified identity (Supabase
// just confirmed the email/code) — claim_customer_for_current_user() is
// called right here, explicitly, with its result checked, so a freshly
// confirmed signup lands on /mi-cuenta already linked instead of bouncing
// through /mi-cuenta's failed guard and back to /iniciar-sesion's own
// single retry. No email/customer id is ever passed to the RPC — identity
// comes only from the session this handler just created.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/iniciar-sesion`);
  }

  const supabase = await createInsumosSupabaseServer();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/iniciar-sesion`);
  }

  const { error: claimError } = await supabase.rpc('claim_customer_for_current_user');
  if (claimError) {
    // Authenticated but not linked (e.g. this identity already belongs to
    // a different customer) — never fall back to a direct UPDATE here.
    // /iniciar-sesion's resolveBuyerSessionForAuthPages() will detect the
    // still-unlinked session on arrival and surface it safely, with its
    // own single bounded retry — not duplicated here.
    return NextResponse.redirect(`${origin}/iniciar-sesion`);
  }

  return NextResponse.redirect(`${origin}/mi-cuenta`);
}
