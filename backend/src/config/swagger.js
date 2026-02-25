// backend/src/config/swagger.js
// OpenAPI 3.0 documentation configuration

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Sapa-Tazkia API',
            version: '4.1.0',
            description: `
## Sapa-Tazkia Backend API

Sistem chatbot akademik cerdas berbasis **Retrieval-Augmented Generation (RAG)** untuk mahasiswa STMIK Tazkia.

### Arsitektur Hybrid Database
- **MySQL** — User data, sessions, akademik
- **Qdrant** — Vector database untuk RAG (embeddings)
- **Redis** — Rate limiting & caching

### Authentication
Gunakan JWT Bearer token untuk endpoint yang memerlukan autentikasi.
Token akses berlaku **1 hari**, gunakan refresh token untuk memperbarui.
      `,
            contact: {
                name: 'Tim Sapa-Tazkia',
                email: 'sapa@stmik.tazkia.ac.id'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: process.env.NODE_ENV === 'production'
                    ? 'https://sapa.tazkia.ac.id'
                    : 'http://localhost:5000',
                description: process.env.NODE_ENV === 'production' ? 'Production Server' : 'Development Server'
            }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT access token (berlaku 1 hari). Dapatkan dari POST /api/auth/login atau /api/auth/refresh'
                }
            },
            schemas: {
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'Terjadi kesalahan' },
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
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string' },
                        data: { type: 'object' }
                    }
                },
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', example: 1 },
                        nim: { type: 'string', example: '20230001' },
                        fullName: { type: 'string', example: 'Budi Santoso' },
                        email: { type: 'string', example: 'budi@student.tazkia.ac.id' },
                        userType: { type: 'string', enum: ['student', 'regular'], example: 'student' },
                        isEmailVerified: { type: 'boolean', example: true },
                        isProfileComplete: { type: 'boolean', example: true },
                        status: { type: 'string', enum: ['active', 'pending'], example: 'active' }
                    }
                },
                LoginRequest: {
                    type: 'object',
                    required: ['password'],
                    properties: {
                        nim: { type: 'string', example: '20230001', description: 'NIM (gunakan nim atau email)' },
                        email: { type: 'string', format: 'email', description: 'Email (alternatif dari NIM)' },
                        password: { type: 'string', format: 'password', example: 'password123' }
                    }
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        token: { type: 'string', description: 'JWT access token (valid 1 day)' },
                        refreshToken: { type: 'string', description: 'Refresh token (valid 30 days)' },
                        user: { '$ref': '#/components/schemas/User' }
                    }
                },
                ChatRequest: {
                    type: 'object',
                    required: ['message'],
                    properties: {
                        message: { type: 'string', maxLength: 2000, example: 'Apa itu sistem operasi?' },
                        conversationId: { type: 'integer', example: 1 }
                    }
                },
                ChatResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        response: { type: 'string', example: 'Sistem operasi adalah...' },
                        conversationId: { type: 'integer', example: 1 },
                        messageId: { type: 'integer', example: 42 },
                        sources: {
                            type: 'array',
                            items: { type: 'object', properties: { title: { type: 'string' }, score: { type: 'number' } } }
                        }
                    }
                },
                AcademicGrade: {
                    type: 'object',
                    properties: {
                        courseCode: { type: 'string', example: 'IF101' },
                        courseName: { type: 'string', example: 'Algoritma dan Pemrograman' },
                        sks: { type: 'integer', example: 3 },
                        grade: { type: 'string', example: 'A' },
                        gradePoint: { type: 'number', example: 4.0 },
                        semester: { type: 'string', example: '2023/2024-1' }
                    }
                }
            }
        },
        security: [{ BearerAuth: [] }],
        tags: [
            { name: 'Auth', description: 'Autentikasi pengguna' },
            { name: 'AI Chat', description: 'Chat dengan AI berbasis RAG' },
            { name: 'Guest', description: 'Akses tanpa login' },
            { name: 'Academic', description: 'Data akademik mahasiswa' },
            { name: 'Rate Limit', description: 'Monitoring rate limiting' },
            { name: 'System', description: 'Health check dan status sistem' }
        ]
    },
    apis: [
        './src/routes/*.js',
        './src/controllers/*.js',
        './server.js'
    ]
};

const specs = swaggerJsdoc(options);

module.exports = specs;
