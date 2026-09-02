export const runtime = 'edge';

import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'
import ContactMessages from '@/components/admin/ContactMessages'

export const metadata = {
  title: 'Administrar Contacto - ARTEMA',
  description: 'Panel de administración para gestionar mensajes de contacto.',
}

export default async function AdminContactPage() {
  const supabase = await createSupabaseServer()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Verificar que el usuario es admin
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'ADMIN') {
    redirect('/cuenta')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-4">
              <li>
                <a href="/cuenta" className="text-gray-400 hover:text-gray-500">
                  Mi cuenta
                </a>
              </li>
              <li className="flex">
                <svg className="flex-shrink-0 h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <a href="/cuenta/admin" className="ml-4 text-gray-400 hover:text-gray-500">
                  Administración
                </a>
              </li>
              <li className="flex">
                <svg className="flex-shrink-0 h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span className="ml-4 text-gray-500">Contacto</span>
              </li>
            </ol>
          </nav>
        </div>

        <ContactMessages />
      </div>
    </div>
  )
}
