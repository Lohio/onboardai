// Roles disponibles en el sistema
export type UserRole = 'empleado' | 'admin' | 'dev'

export interface Usuario {
  id: string
  empresa_id: string
  nombre: string
  email: string
  rol: UserRole
  foto_url?: string
  puesto?: string
  area?: string
  fecha_ingreso?: string
  manager_id?: string
  buddy_id?: string
  /** Campo en tabla usuarios — algunas APIs usan 'modalidad', otras 'modalidad_trabajo' */
  modalidad?: 'presencial' | 'remoto' | 'hibrido'
  modalidad_trabajo?: 'presencial' | 'remoto' | 'hibrido'
  bio?: string
  contacto_it_nombre?: string
  contacto_it_email?: string
  contacto_rrhh_nombre?: string
  contacto_rrhh_email?: string
  password_corporativo?: string | null
  password_bitlocker?: string | null
  created_at: string
}


export interface MiembroEquipo {
  id: string
  nombre: string
  email: string
  puesto?: string
  foto_url?: string
  relacion: 'manager' | 'buddy' | 'companero'
}

export interface Acceso {
  id: string
  herramienta: string
  url?: string | null
  estado: 'activo' | 'pendiente' | 'sin_acceso'
  usuario_acceso?: string | null
  password_acceso?: string | null
  notas?: string | null
}

// Tipos de contenido soportados
export type TipoContenido = 'texto' | 'imagen' | 'video' | 'pdf' | 'link' | 'archivo'

// Metadata tipada por tipo de contenido
export interface MetadataVideo {
  plataforma: 'youtube' | 'vimeo'
  url_original: string
}
export interface MetadataLink {
  plataforma: string
}
export interface MetadataArchivo {
  nombre: string
  tamano: number
}

export interface ContenidoBloque {
  id: string
  empresa_id: string
  modulo: string
  bloque: string
  titulo: string
  contenido: string
  tipo: TipoContenido
  url?: string | null
  storage_path?: string | null
  metadata?: Record<string, string | number | boolean | null> | null
  created_at: string
}

export interface ProgresoModulo {
  id: string
  usuario_id: string
  modulo: string
  bloque: string
  completado: boolean
  completado_at?: string
}

export interface TareaOnboarding {
  id: string
  empresa_id: string
  usuario_id: string
  semana: number
  orden: number
  titulo: string
  completada: boolean
  completada_at?: string
  created_at: string
}

export interface GuiaHerramienta {
  titulo: string
  pasos: string[]
}

export interface HerramientaRol {
  id: string
  empresa_id: string
  nombre: string
  url?: string
  icono?: string
  guia?: GuiaHerramienta[]
  orden: number
  created_at: string
}

export interface ObjetivoRol {
  id: string
  empresa_id: string
  semana: number
  titulo: string
  descripcion?: string
  estado: 'pendiente' | 'en_progreso' | 'completado'
  created_at: string
}

export interface DecisionAutonomia {
  decision: string
  nivel: 'solo' | 'consultar' | 'escalar'
}

export interface EncuestaPulso {
  id: string
  empresa_id: string
  usuario_id: string
  dia_onboarding: number
  pregunta_1: string
  pregunta_2: string
  pregunta_3: string
  respuesta_1?: number | null
  respuesta_2?: number | null
  respuesta_3?: number | null
  comentario?: string | null
  completada: boolean
  created_at: string
  respondida_at?: string | null
}

export interface AdminEmpleadoConProgreso {
  id: string
  nombre: string
  puesto?: string
  area?: string
  foto_url?: string
  fecha_ingreso?: string
  progreso: number // 0-100, calculado client-side
}
