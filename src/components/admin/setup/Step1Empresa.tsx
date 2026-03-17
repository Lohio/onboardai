'use client'

import { useState, useCallback } from 'react'
import { Building2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { SetupData } from '@/app/admin/setup/page'

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

const INDUSTRIAS = [
  'Tecnología', 'Logística', 'Retail', 'Salud',
  'Educación', 'Servicios', 'Manufactura', 'Otro',
]

const TAMANOS = ['1-10', '11-50', '51-200', '200+']

// ─────────────────────────────────────────────
// Estilos compartidos de select e input
// ─────────────────────────────────────────────

const inputCls = [
  'w-full h-10 text-sm text-white placeholder:text-white/25',
  'bg-surface-800/80 rounded-lg px-3',
  'border border-white/[0.07] hover:border-white/15',
  'transition-all duration-150 outline-none',
  'focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50',
].join(' ')

const selectCls = [
  'w-full h-10 text-sm text-white appearance-none cursor-pointer',
  'bg-surface-800/80 rounded-lg pl-3 pr-8',
  'border border-white/[0.07] hover:border-white/15',
  'transition-all duration-150 outline-none',
  'focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50',
].join(' ')

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────

interface Step1Props {
  setupData: SetupData
  onNext: () => void
}

export function Step1Empresa({ setupData, onNext }: Step1Props) {
  const [nombre, setNombre] = useState(setupData.empresaNombre)
  const [industria, setIndustria] = useState('')
  const [tamano, setTamano] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Iniciales para el avatar placeholder
  const iniciales = nombre
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  const handleLogoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen')
      return
    }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!nombre.trim()) {
      toast.error('El nombre de la empresa es obligatorio')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const updates: Record<string, string | boolean> = {
        nombre: nombre.trim(),
        ...(industria && { industria }),
        ...(tamano && { tamano }),
      }

      // Subir logo si se eligió uno
      if (logoFile) {
        const ext = logoFile.name.split('.').pop() ?? 'png'
        const path = `logos/${setupData.empresaId}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, logoFile, { upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(path)
          updates.logo_url = urlData.publicUrl
        } else {
          console.warn('[setup] Error subiendo logo:', uploadError.message)
          // Continuar sin logo — no es crítico
        }
      }

      const { error } = await supabase
        .from('empresas')
        .update(updates)
        .eq('id', setupData.empresaId)

      if (error) throw new Error(error.message)

      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [nombre, industria, tamano, logoFile, setupData.empresaId, onNext])

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8">
      {/* Ícono decorativo */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30
          flex items-center justify-center mb-4
          shadow-[0_0_32px_rgba(59,79,216,0.2)]">
          <Building2 className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-1">Tu empresa</h2>
        <p className="text-sm text-white/45 max-w-sm">
          Completá los datos básicos de tu organización
        </p>
      </div>

      <div className="space-y-5">
        {/* Logo */}
        <div>
          <label className="block text-[11px] font-medium text-white/45 mb-3 tracking-widest uppercase">
            Logo (opcional)
          </label>
          <div className="flex items-center gap-4">
            {/* Preview */}
            <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden
              border border-white/[0.08] bg-surface-700 flex items-center justify-center">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-indigo-300">{iniciales}</span>
              )}
            </div>

            {/* Input file */}
            <label className="flex-1 cursor-pointer">
              <div className={cn(
                inputCls,
                'flex items-center text-white/35 cursor-pointer h-10'
              )}>
                {logoFile ? logoFile.name : 'Subir imagen...'}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="sr-only"
              />
            </label>
          </div>
        </div>

        {/* Nombre de la empresa */}
        <div>
          <label
            htmlFor="s1-nombre"
            className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
          >
            Nombre de la empresa
          </label>
          <input
            id="s1-nombre"
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Acme S.A."
            className={inputCls}
          />
        </div>

        {/* Industria */}
        <div>
          <label
            htmlFor="s1-industria"
            className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
          >
            Industria
          </label>
          <div className="relative">
            <select
              id="s1-industria"
              value={industria}
              onChange={e => setIndustria(e.target.value)}
              className={cn(selectCls, !industria && 'text-white/30')}
            >
              <option value="" disabled>Seleccioná una industria</option>
              {INDUSTRIAS.map(i => (
                <option key={i} value={i} className="bg-[#0f1f3d]">{i}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          </div>
        </div>

        {/* Tamaño */}
        <div>
          <label
            htmlFor="s1-tamano"
            className="block text-[11px] font-medium text-white/45 mb-1.5 tracking-widest uppercase"
          >
            Cantidad de empleados
          </label>
          <div className="relative">
            <select
              id="s1-tamano"
              value={tamano}
              onChange={e => setTamano(e.target.value)}
              className={cn(selectCls, !tamano && 'text-white/30')}
            >
              <option value="" disabled>Seleccioná un rango</option>
              {TAMANOS.map(t => (
                <option key={t} value={t} className="bg-[#0f1f3d]">{t}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Botón continuar (paso 1 no se puede omitir) */}
      <div className="mt-8">
        <Button
          variant="primary"
          size="md"
          loading={saving}
          onClick={handleSubmit}
          className="w-full"
        >
          {saving ? 'Guardando...' : 'Continuar'}
        </Button>
      </div>
    </div>
  )
}
