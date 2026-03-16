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
  modalidad?: 'presencial' | 'remoto' | 'hibrido'
  bio?: string
  contacto_it_nombre?: string
  contacto_it_email?: string
  contacto_rrhh_nombre?: string
  contacto_rrhh_email?: string
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
