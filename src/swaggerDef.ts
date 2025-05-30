// src/swaggerDef.ts
// Definiciones de componentes para Swagger (securitySchemes y schemas)

export const swaggerComponents = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT'
    }
  },
  schemas: {
    ErrorResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    HealthResponse: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'OK' },
        timestamp: { type: 'string', format: 'date-time' },
        database: { type: 'string', example: 'Connected' },
        environment: { type: 'string', example: 'development' }
      }
    },
    LoginRequest: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string' },
        password: { type: 'string' }
      }
    },
    LoginResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            usuario: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                username: { type: 'string' },
                nombre_completo: { type: 'string' },
                email: { type: 'string' },
                rol: { type: 'string' },
                permisos: {
                  type: 'array',
                  items: { type: 'string' }
                },
                codigo_vendedor: { type: 'string' }
              }
            }
          }
        },
        message: { type: 'string' }
      }
    },
    RefreshRequest: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string' }
      }
    },
    RefreshResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            token: { type: 'string' }
          }
        },
        message: { type: 'string' }
      }
    },
    VerifyResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            usuario: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                username: { type: 'string' },
                nombre_completo: { type: 'string' },
                email: { type: 'string' },
                rol: { type: 'string' },
                permisos: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            },
            token_exp: { type: 'integer' }
          }
        }
      }
    },
    GenericListResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'array', items: {} }
      }
    },
    CreateUsuarioRequest: {
      type: 'object',
      required: ['usuario', 'password', 'nombre_completo', 'id_rol'],
      properties: {
        usuario: { type: 'string' },
        password: { type: 'string' },
        nombre_completo: { type: 'string' },
        email: { type: 'string' },
        telefono: { type: 'string' },
        rut: { type: 'string' },
        codigo_vendedor: { type: 'string' },
        id_rol: { type: 'integer' },
        activo: { type: 'boolean', default: true }
      }
    },
    CreateUsuarioResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { $ref: '#/components/schemas/CreateUsuarioRequest' },
        message: { type: 'string' }
      }
    }
  }
};
