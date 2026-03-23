// ─────────────────────────────────────────────
// GET /api/v1/docs/openapi.json — spec OpenAPI 3.1 de la API pública de Heero
// Generada manualmente (sin librería externa)
// ─────────────────────────────────────────────

import { NextResponse } from 'next/server'

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Heero API',
    version: '1.0.0',
    description: 'API pública de Heero para integrar datos de onboarding en sistemas externos.',
    contact: {
      name: 'Soporte Heero',
      url: 'https://heero.app',
    },
  },
  servers: [
    { url: 'https://heero.app/api/v1', description: 'Producción' },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'API key en formato `oai_live_<32-char-hex>`. Obtener desde /admin/configuracion/api-keys.',
      },
    },
    schemas: {
      Empleado: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          nombre: { type: 'string' },
          email: { type: 'string', format: 'email' },
          puesto: { type: 'string', nullable: true },
          area: { type: 'string', nullable: true },
          rol: { type: 'string', enum: ['empleado', 'admin', 'dev'] },
          fecha_ingreso: { type: 'string', format: 'date-time', nullable: true },
          modalidad_trabajo: { type: 'string', nullable: true },
        },
      },
      EmpleadoDetalle: {
        allOf: [
          { $ref: '#/components/schemas/Empleado' },
          {
            type: 'object',
            properties: {
              manager_id: { type: 'string', format: 'uuid', nullable: true },
              buddy_id: { type: 'string', format: 'uuid', nullable: true },
            },
          },
        ],
      },
      ProgresoBloque: {
        type: 'object',
        properties: {
          modulo: { type: 'string' },
          bloque: { type: 'string' },
          completado: { type: 'boolean' },
          completado_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      EncuestaPulso: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          usuario_id: { type: 'string', format: 'uuid' },
          dia_onboarding: { type: 'integer', enum: [7, 30, 60] },
          pregunta_1: { type: 'string' },
          pregunta_2: { type: 'string' },
          pregunta_3: { type: 'string' },
          respuesta_1: { type: 'integer', minimum: 1, maximum: 5, nullable: true },
          respuesta_2: { type: 'integer', minimum: 1, maximum: 5, nullable: true },
          respuesta_3: { type: 'integer', minimum: 1, maximum: 5, nullable: true },
          comentario: { type: 'string', nullable: true },
          completada: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          respondida_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          requestId: { type: 'string' },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    '/empleados': {
      get: {
        summary: 'Listar empleados',
        description: 'Retorna los empleados de la empresa asociada a la API key, con paginación.',
        operationId: 'listEmpleados',
        tags: ['Empleados'],
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Número de página (default: 1)',
            schema: { type: 'integer', minimum: 1, default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Resultados por página (default: 20, máx: 100)',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          '200': {
            description: 'Lista paginada de empleados',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    empleados: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Empleado' },
                    },
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                  },
                },
              },
            },
          },
          '401': { description: 'API key inválida o faltante', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Scope insuficiente (requiere empleados:read)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
      post: {
        summary: 'Crear empleado',
        description: 'Crea un auth user y su perfil de empleado en la empresa.',
        operationId: 'createEmpleado',
        tags: ['Empleados'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'nombre'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  nombre: { type: 'string' },
                  puesto: { type: 'string' },
                  area: { type: 'string' },
                  fecha_ingreso: { type: 'string', format: 'date-time' },
                  modalidad_trabajo: { type: 'string' },
                  manager_id: { type: 'string', format: 'uuid' },
                  buddy_id: { type: 'string', format: 'uuid' },
                  sobre_mi: { type: 'string', maxLength: 1000 },
                  rol: { type: 'string', enum: ['empleado', 'admin'] },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Empleado creado exitosamente',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    empleado: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        nombre: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'API key inválida o faltante', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Scope insuficiente (requiere empleados:write)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '409': { description: 'Email ya registrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/empleados/{id}': {
      get: {
        summary: 'Detalle de empleado',
        description: 'Retorna el perfil completo de un empleado por ID.',
        operationId: 'getEmpleado',
        tags: ['Empleados'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'UUID del empleado',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Detalle del empleado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    empleado: { $ref: '#/components/schemas/EmpleadoDetalle' },
                  },
                },
              },
            },
          },
          '401': { description: 'API key inválida o faltante', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Scope insuficiente (requiere empleados:read)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '404': { description: 'Empleado no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/empleados/{id}/progreso': {
      get: {
        summary: 'Progreso del empleado',
        description: 'Retorna el progreso por módulo y bloque del empleado.',
        operationId: 'getEmpleadoProgreso',
        tags: ['Empleados'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'UUID del empleado',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Progreso del empleado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    progreso: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ProgresoBloque' },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'API key inválida o faltante', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Scope insuficiente (requiere progreso:read)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '404': { description: 'Empleado no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/encuestas': {
      get: {
        summary: 'Listar encuestas de pulso',
        description: 'Retorna las encuestas de pulso de la empresa. Filtrables por día y estado.',
        operationId: 'listEncuestas',
        tags: ['Encuestas'],
        parameters: [
          {
            name: 'dia',
            in: 'query',
            description: 'Filtrar por día de onboarding (7, 30 o 60)',
            schema: { type: 'integer', enum: [7, 30, 60] },
          },
          {
            name: 'completada',
            in: 'query',
            description: 'Filtrar por estado de completado',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          '200': {
            description: 'Lista de encuestas',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    encuestas: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/EncuestaPulso' },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Parámetro "dia" inválido', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'API key inválida o faltante', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '403': { description: 'Scope insuficiente (requiere encuestas:read)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
  },
}

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
