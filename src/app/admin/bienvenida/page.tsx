'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Send, Copy, Check, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Empleado {
  id:            string
  nombre:        string | null
  puesto:        string | null
  fecha_ingreso: string | null
}

export default function BienvenidaPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading]     = useState(true)
  const [generando, setGenerando] = useState<string | null>(null)
  const [copiado, setCopiado]     = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: yo } = await supabase
      .from('usuarios')
      .select('empresa_id')
      .eq('id', user.id)
      .single()
    if (!yo) { setLoading(false); return }

    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre, puesto, fecha_ingreso')
      .eq('empresa_id', yo.empresa_id)
      .eq('rol', 'empleado')
      .eq('preboarding_activo', true)
      .order('fecha_ingreso', { ascending: true })

    setEmpleados((data ?? []) as Empleado[])
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function generarLink(id: string) {
    setGenerando(id)
    try {
      const res = await fetch('/api/admin/bienvenida/invitar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ usuarioId: id }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido' }))
        throw new Error(error ?? 'Error generando link')
      }
      const { link } = await res.json() as { link: string }
      await navigator.clipboard.writeText(link)
      setCopiado(id)
      toast.success('Link copiado. Mandáselo al empleado.')
      setTimeout(() => setCopiado(null), 2500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo generar el link.')
    } finally {
      setGenerando(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="flex items-center gap-2 mb-1">
        <Send className="w-5 h-5 text-[#38BDF8]" />
        <h1 className="text-lg font-semibold text-white">Agente de bienvenida</h1>
      </div>
      <p className="text-sm text-white/40 mb-6">
        Generá el link de Telegram para cada empleado en preboarding. Al abrirlo, el bot lo
        reconoce y le da info de su primer día: dónde queda, a qué hora llegar y por quién preguntar.
      </p>

      <Card>
        {loading ? (
          <p className="text-sm text-white/40 py-6 text-center">Cargando...</p>
        ) : empleados.length === 0 ? (
          <div className="py-10 text-center">
            <UserPlus className="w-6 h-6 text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/40">
              No hay empleados en preboarding. Activá el preboarding desde el detalle de un empleado.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {empleados.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white/85">{e.nombre ?? 'Sin nombre'}</p>
                  <p className="text-xs text-white/40">
                    {e.puesto ?? '—'}
                    {e.fecha_ingreso
                      ? ` · ingresa ${new Date(e.fecha_ingreso).toLocaleDateString('es-AR')}`
                      : ''}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={generando === e.id}
                  onClick={() => generarLink(e.id)}
                >
                  {copiado === e.id ? (
                    <><Check className="w-3.5 h-3.5 mr-1" />Copiado</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5 mr-1" />Generar link</>
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
