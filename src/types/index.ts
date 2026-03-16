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
  modalidad_trabajo?: 'presencial' | 'remoto' | 'hibrido'
  sobre_mi?: string
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
  url?: string
  estado: 'activo' | 'pendiente' | 'sin_acceso'
}

export interface ContenidoBloque {
  id: string
  empresa_id: string
  modulo: string
  bloque: string
  titulo: string
  contenido: string
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

export interface AdminEmpleadoConProgreso {
  id: string
  nombre: string
  puesto?: string
  area?: string
  foto_url?: string
  fecha_ingreso?: string
  progreso: number // 0-100, calculado client-side
}
