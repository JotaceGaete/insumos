'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface BannerItem {
  id: string
  text: string
  url?: string
}

export default function TopBanner() {
  const [items, setItems] = useState<BannerItem[]>([])
  const [index, setIndex] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/admin/top-banner', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setItems((data.items || []).map((x: any) => ({ id: x.id, text: x.text, url: x.url })))
    } catch {}
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (items.length <= 1) return
    timerRef.current && clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length)
    }, 4000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [items.length])

  const fallback: BannerItem[] = [
    { id: 'f1', text: 'Soporte: soporte@artema.cl', url: 'mailto:soporte@artema.cl' },
    { id: 'f2', text: 'Mayoristas: mayoristas@artema.cl', url: '/mayoristas' },
  ]

  const renderItems = items.length > 0 ? items : fallback
  const current = renderItems[index % renderItems.length]
  const content = current.url ? (
    <Link href={current.url} className="underline">
      {current.text}
    </Link>
  ) : (
    <span>{current.text}</span>
  )

  return (
    <div className="w-full bg-purple-600 text-white text-xs md:text-sm">
      <div className="max-w-7xl mx-auto px-3 py-1 min-h-[28px] flex items-center justify-center whitespace-nowrap overflow-hidden">
        <div className="animate-marquee inline-block">
          {content}
        </div>
      </div>
      <style jsx>{`
        .animate-marquee { 
          animation: marquee 10s linear infinite; 
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-20%); }
        }
      `}</style>
    </div>
  )
}


