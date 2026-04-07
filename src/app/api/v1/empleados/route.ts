// ─────────────────────────────────────────────
// GET  /api/v1/empleados — lista empleados de la empresa (paginación: page, limit)
// POST /api/v1/empleados — crea empleado (scope: empleados:write)
// ─────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { withHandler } from '@/lib/api/withHandler'
import { hasScope } from '@/lib/api/apiKeys'
import { makeServiceClient } from '@/lib/api/serviceClient'
import { optionsResponse } from '@/lib/api/cors'
import { ApiError } from '@/lib/errors'
import { crearEmpleadoSchema } from '@/lib/schemas/admin'

// GET /api/v1/empleados
export const GET = withHandler(
  { auth: 'apiKey' },
  async ({ req, apiKeyRecord }) => {
    // Verificar scope requerido
    if (!hasScope(apiKeyRecord!, 'empleados:read')) {
      return ApiError.forbidden()
    }

    const empresaId = apiKeyRecord!.empresa_id

    // Parsear query params de paginación
    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const limitRaw = parseInt(url.searchParams.get('limit') ?? '20', 10) || 20
    const limit = Math.min(100, Math.max(1, limitRaw))
    const offset = (page - 1) * limit

    const sa = makeServiceClient()

    // Contar total de empleados de la empresa
    const { count, error: countError } = await sa
      .from('usuarios')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)

    if (countError) {
      return ApiError.internal(countError.message)
    }

    // Obtener página de empleados
    const { data: empleados, error } = await sa
      .from('usuarios')
      .select('id, nombre, email, puesto, area, rol, fecha_ingreso, modalidad_trabajo')
      .eq('empresa_id', empresaId)
      .order('nombre', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[GET v1/empleados] Error consultando:', error)
      return ApiError.internal()
    }

    return NextResponse.json({
      empleados: empleados ?? [],
      total: count ?? 0,
      page,
      limit,
    })
  }
)

// POST /api/v1/empleados
export const POST = withHandler(
  { auth: 'apiKey', schema: crearEmpleadoSchema },
  async ({ body, apiKeyRecord }) => {
    // Verificar scope requerido
    if (!hasScope(apiKeyRecord!, 'empleados:write')) {
      return ApiError.forbidden()
    }

    const empresaId = apiKeyRecord!.empresa_id
    const { email, password, nombre } = body

    const sa = makeServiceClient()

    // Validar que manager_id y buddy_id pertenecen a la empresa (si están presentes)
    if (body.manager_id) {
      const { data: manager } = await sa
        .from('usuarios')
        .select('id')
        .eq('id', body.manager_id)
        .eq('empresa_id', empresaId)
        .single()
      if (!manager) return ApiError.badRequest('manager_id no pertenece a esta empresa')
    }

    if (body.buddy_id) {
      const { data: buddy } = await sa
        .from('usuarios')
        .select('id')
        .eq('id', body.buddy_id)
        .eq('empresa_id', empresaId)
        .single()
      if (!buddy) return ApiError.badRequest('buddy_id no pertenece a esta empresa')
    }

    // 1. Crear auth user
    const { data: authData, error: authError } = await sa.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return ApiError.conflict('Ya existe un usuario con ese email')
      }
      return ApiError.badRequest(authError.message)
    }

    const userId = authData.user.id

    // 2. Insertar fila en usuarios
    const { data: nuevoEmpleado, error: insertError } = await sa
      .from('usuarios')
      .insert({
        id: userId,
        empresa_id: empresaId,
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        rol: body.rol ?? 'empleado',
        puesto: body.puesto?.trim() || null,
        area: body.area?.trim() || null,
        fecha_ingreso: body.fecha_ingreso || null,
        modalidad_trabajo: body.modalidad_trabajo || null,
        manager_id: body.manager_id || null,
        buddy_id: body.buddy_id || null,
        sobre_mi: body.sobre_mi?.trim() || null,
      })
      .select('id, nombre, email')
      .single()

    if (insertError) {
      // Rollback: eliminar auth user si falla la inserción
      const { error: rollbackError } = await sa.auth.admin.deleteUser(userId)
      if (rollbackError) {
        console.error('[POST /api/v1/empleados] rollback deleteUser falló:', rollbackError.message)
      }
      return ApiError.internal(insertError.message)
    }

    return NextResponse.json({ empleado: nuevoEmpleado }, { status: 201 })
  }
)

// OPTIONS /api/v1/empleados — preflight CORS
export async function OPTIONS() {
  return optionsResponse('*')
}
