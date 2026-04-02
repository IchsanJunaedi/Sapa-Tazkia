const requestId = require('../../src/middleware/requestId');

function mockRes() {
  const headers = {};
  return {
    setHeader: (k, v) => { headers[k] = v; },
    getHeaders: () => headers,
    _headers: headers,
  };
}

describe('requestId middleware', () => {
  it('sets req.id to a UUID when no header present', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    requestId(req, res, next);

    expect(req.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(res._headers['X-Request-Id']).toBe(req.id);
    expect(next).toHaveBeenCalled();
  });

  it('reuses x-request-id header if already present', () => {
    const existingId = 'existing-id-123';
    const req = { headers: { 'x-request-id': existingId } };
    const res = mockRes();
    const next = jest.fn();

    requestId(req, res, next);

    expect(req.id).toBe(existingId);
    expect(res._headers['X-Request-Id']).toBe(existingId);
  });
});
