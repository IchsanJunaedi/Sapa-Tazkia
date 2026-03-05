/**
 * Prisma Client Singleton
 *
 * BUG-02 FIX: Sebelumnya setiap service file (authService, app.js, dll)
 * membuat `new PrismaClient()` sendiri-sendiri. Ini menyebabkan MySQL
 * connection pool exhaustion di production karena setiap instance membuka
 * koneksi baru ke database.
 *
 * Solusi: Ekspor satu instance PrismaClient yang di-share ke seluruh app.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
