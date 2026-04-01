// backend/tests/helpers/appHelper.js
// Returns a supertest agent bound to the Express app.
// Requiring app.js will NOT start the HTTP server due to require.main guard.

const request = require('supertest');
const app = require('../../src/app');

const agent = request(app);

module.exports = { agent };
