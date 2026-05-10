// backend/tests/unit/validationMiddleware.test.js
const {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateVerifyEmail,
  validateRefreshToken,
  validateChatMessage,
  validateGuestChatMessage,
  validateNimParam,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateRegisterEmail,
} = require('../../src/middleware/validationMiddleware');

/**
 * Runs a validation middleware chain (array of middlewares) against a fake request.
 * express-validator chains need .run(req) to populate validation results on the req.
 * Returns { status, body } from the mock response, or null if next() was called (valid).
 */
async function runValidation(chain, req) {
  const res = {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };

  let nextCalled = false;
  const next = () => { nextCalled = true; };

  for (const middleware of chain) {
    if (nextCalled) break;
    if (res._status) break; // response already sent (e.g. 400 from custom middleware)

    // express-validator ValidationChain has a .run() method
    if (typeof middleware.run === 'function') {
      await middleware.run(req);
    } else {
      // Regular middleware (like handleValidationErrors or custom functions)
      const result = middleware(req, res, next);
      if (result && typeof result.then === 'function') {
        await result;
      }
    }
  }

  if (nextCalled && !res._status) return null; // validation passed
  return { status: res._status, body: res._body };
}

function buildReq(body = {}, params = {}, query = {}) {
  return { body, params, query };
}

// ─── handleValidationErrors ──────────────────────────────────────────────────

describe('handleValidationErrors', () => {
  it('calls next() when there are no errors', async () => {
    // Run a chain with no validators — just the handler
    const result = await runValidation([handleValidationErrors], buildReq());
    expect(result).toBeNull();
  });
});

// ─── validateRegister ────────────────────────────────────────────────────────

describe('validateRegister', () => {
  const validBody = {
    fullName: 'John Doe',
    nim: '12345678',
    email: 'john@example.com',
    password: 'Secret123',
  };

  it('passes with valid data', async () => {
    const result = await runValidation(validateRegister, buildReq(validBody));
    expect(result).toBeNull();
  });

  it('fails when fullName is empty', async () => {
    const result = await runValidation(validateRegister, buildReq({ ...validBody, fullName: '' }));
    expect(result.status).toBe(422);
    expect(result.body.errors.some(e => e.field === 'fullName')).toBe(true);
  });

  it('fails when nim is too short', async () => {
    const result = await runValidation(validateRegister, buildReq({ ...validBody, nim: 'ab' }));
    expect(result.status).toBe(422);
    expect(result.body.errors.some(e => e.field === 'nim')).toBe(true);
  });

  it('fails when email is invalid', async () => {
    const result = await runValidation(validateRegister, buildReq({ ...validBody, email: 'notanemail' }));
    expect(result.status).toBe(422);
    expect(result.body.errors.some(e => e.field === 'email')).toBe(true);
  });

  it('fails when password is too short', async () => {
    const result = await runValidation(validateRegister, buildReq({ ...validBody, password: 'Ab1' }));
    expect(result.status).toBe(422);
    expect(result.body.errors.some(e => e.field === 'password')).toBe(true);
  });

  it('fails when password has no number', async () => {
    const result = await runValidation(validateRegister, buildReq({ ...validBody, password: 'Abcdefgh' }));
    expect(result.status).toBe(422);
    expect(result.body.errors.some(e => e.field === 'password')).toBe(true);
  });

  it('fails when password has no letter', async () => {
    const result = await runValidation(validateRegister, buildReq({ ...validBody, password: '12345678' }));
    expect(result.status).toBe(422);
    expect(result.body.errors.some(e => e.field === 'password')).toBe(true);
  });
});

// ─── validateRegisterEmail ───────────────────────────────────────────────────

describe('validateRegisterEmail', () => {
  it('passes with valid email', async () => {
    const result = await runValidation(validateRegisterEmail, buildReq({ email: 'test@example.com' }));
    expect(result).toBeNull();
  });

  it('fails with invalid email', async () => {
    const result = await runValidation(validateRegisterEmail, buildReq({ email: 'bad' }));
    expect(result.status).toBe(422);
  });
});

// ─── validateLogin ───────────────────────────────────────────────────────────

describe('validateLogin', () => {
  it('passes with nim + password', async () => {
    const result = await runValidation(validateLogin, buildReq({ nim: '123456', password: 'pass123' }));
    expect(result).toBeNull();
  });

  it('passes with email + password', async () => {
    const result = await runValidation(validateLogin, buildReq({ email: 'a@b.com', password: 'pass123' }));
    expect(result).toBeNull();
  });

  it('fails when password is missing', async () => {
    const result = await runValidation(validateLogin, buildReq({ nim: '123456' }));
    expect(result.status).toBe(422);
    expect(result.body.errors.some(e => e.field === 'password')).toBe(true);
  });
});

// ─── validateVerifyEmail ─────────────────────────────────────────────────────

describe('validateVerifyEmail', () => {
  it('passes with valid email + 6-digit code', async () => {
    const result = await runValidation(validateVerifyEmail, buildReq({ email: 'a@b.com', code: '123456' }));
    expect(result).toBeNull();
  });

  it('fails with non-numeric code', async () => {
    const result = await runValidation(validateVerifyEmail, buildReq({ email: 'a@b.com', code: 'abcdef' }));
    expect(result.status).toBe(422);
  });

  it('fails with wrong length code', async () => {
    const result = await runValidation(validateVerifyEmail, buildReq({ email: 'a@b.com', code: '123' }));
    expect(result.status).toBe(422);
  });
});

// ─── validateRefreshToken ────────────────────────────────────────────────────

describe('validateRefreshToken', () => {
  it('passes with refreshToken', async () => {
    const result = await runValidation(validateRefreshToken, buildReq({ refreshToken: 'abc123' }));
    expect(result).toBeNull();
  });

  it('fails without refreshToken', async () => {
    const result = await runValidation(validateRefreshToken, buildReq({}));
    expect(result.status).toBe(422);
  });
});

// ─── validateChatMessage ─────────────────────────────────────────────────────

describe('validateChatMessage', () => {
  it('passes with valid message', async () => {
    const result = await runValidation(validateChatMessage, buildReq({ message: 'Hello' }));
    expect(result).toBeNull();
  });

  it('passes with optional conversationId', async () => {
    const result = await runValidation(validateChatMessage, buildReq({ message: 'Hi', conversationId: 5 }));
    expect(result).toBeNull();
  });

  it('fails with empty message', async () => {
    const result = await runValidation(validateChatMessage, buildReq({ message: '' }));
    expect(result.status).toBe(422);
  });

  it('fails with message over 2000 chars', async () => {
    const result = await runValidation(validateChatMessage, buildReq({ message: 'x'.repeat(2001) }));
    expect(result.status).toBe(422);
  });
});

// ─── validateGuestChatMessage ────────────────────────────────────────────────

describe('validateGuestChatMessage', () => {
  it('passes with valid message', async () => {
    const result = await runValidation(validateGuestChatMessage, buildReq({ message: 'Hello' }));
    expect(result).toBeNull();
  });

  it('fails with message over 1000 chars', async () => {
    const result = await runValidation(validateGuestChatMessage, buildReq({ message: 'x'.repeat(1001) }));
    expect(result.status).toBe(422);
  });
});

// ─── validateNimParam ────────────────────────────────────────────────────────

describe('validateNimParam', () => {
  it('passes with valid nim param', async () => {
    const result = await runValidation(validateNimParam, { body: {}, params: { nim: '12345678' }, query: {} });
    expect(result).toBeNull();
  });

  it('fails with too short nim', async () => {
    const result = await runValidation(validateNimParam, { body: {}, params: { nim: 'ab' }, query: {} });
    expect(result.status).toBe(422);
  });
});

// ─── validateForgotPassword ──────────────────────────────────────────────────

describe('validateForgotPassword', () => {
  it('passes with email', async () => {
    const result = await runValidation(validateForgotPassword, buildReq({ email: 'a@b.com' }));
    expect(result).toBeNull();
  });

  it('passes with nim', async () => {
    const result = await runValidation(validateForgotPassword, buildReq({ nim: '12345678' }));
    expect(result).toBeNull();
  });

  it('fails when neither email nor nim provided', async () => {
    const result = await runValidation(validateForgotPassword, buildReq({}));
    expect(result.status).toBe(400);
    expect(result.body.message).toMatch(/Email atau NIM/);
  });
});

// ─── validateResetPassword ───────────────────────────────────────────────────

describe('validateResetPassword', () => {
  it('passes with valid token + newPassword', async () => {
    const result = await runValidation(validateResetPassword, buildReq({ token: 'abc', newPassword: 'Secret123' }));
    expect(result).toBeNull();
  });

  it('fails with short password', async () => {
    const result = await runValidation(validateResetPassword, buildReq({ token: 'abc', newPassword: 'Ab1' }));
    expect(result.status).toBe(422);
  });

  it('fails with missing token', async () => {
    const result = await runValidation(validateResetPassword, buildReq({ newPassword: 'Secret123' }));
    expect(result.status).toBe(422);
  });
});

// ─── validateChangePassword ──────────────────────────────────────────────────

describe('validateChangePassword', () => {
  it('passes with valid currentPassword + newPassword', async () => {
    const result = await runValidation(validateChangePassword, buildReq({ currentPassword: 'old', newPassword: 'NewPass1' }));
    expect(result).toBeNull();
  });

  it('fails with missing currentPassword', async () => {
    const result = await runValidation(validateChangePassword, buildReq({ newPassword: 'NewPass1' }));
    expect(result.status).toBe(422);
  });

  it('fails with weak newPassword (no number)', async () => {
    const result = await runValidation(validateChangePassword, buildReq({ currentPassword: 'old', newPassword: 'Abcdefgh' }));
    expect(result.status).toBe(422);
  });
});
