export const runtime = 'edge';

import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabaseServer'
import WholesalePublicView from '@/components/wholesale/WholesalePublicView'
import WholesaleDashboard from '@/components/wholesale/WholesaleDashboard'
import WholesalePendingView from '@/components/wholesale/WholesalePendingView'

export const metadata = {
  title: 'Programa de Receptorías - ARTEMA',
  description: 'Precios mayoristas, producción ágil y soporte técnico para tu negocio.',
}

export default async function MayoristasPage() {
  const supabase = await createSupabaseServer()
  
  const { data: { user } } = await supabase.auth.getUser()

  // Si no está logueado, mostrar vista pública
  if (!user) {
    return <WholesalePublicView />
  }

  // Obtener perfil del usuario
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role || 'CLIENTE'

  // Si es admin, redirigir al panel de administración
  if (userRole === 'ADMIN') {
    redirect('/admin/mayoristas')
  }

  // Si es comercio, obtener cuenta mayorista
  if (userRole === 'COMERCIO') {
    const { data: wholesaleAccount } = await (supabase as any)
      .from('wholesale_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (wholesaleAccount) {
      if (wholesaleAccount.status === 'approved') {
        // Mostrar dashboard mayorista
        return <WholesaleDashboard account={wholesaleAccount} />
      } else if (wholesaleAccount.status === 'pending') {
        // Mostrar vista de pendiente
        return <WholesalePendingView account={wholesaleAccount} />
      } else if (wholesaleAccount.status === 'rejected') {
        // Mostrar vista de rechazo con opción de nueva solicitud
        return <WholesalePublicView rejectedAccount={wholesaleAccount} />
      }
    }
  }

  // Usuario logueado pero sin cuenta mayorista - mostrar formulario
  return <WholesalePublicView showApplicationForm={true} />
}
