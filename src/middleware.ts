import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // The legacy Artesellos admin API has no place in the independent store.
  // Block it before its historical bypasses or credentials can be evaluated.
  if (request.nextUrl.pathname.startsWith('/api/admin/')) {
    return NextResponse.json({ message: 'API administrativa heredada deshabilitada.' }, { status: 410 });
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
