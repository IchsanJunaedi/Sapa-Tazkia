const { describe, it, expect } = require('@jest/globals');
// backend/tests/unit/smoke.test.js
describe('Jest setup', () => {
  it('should run tests', () => {
    expect(1 + 1).toBe(2);
  });
});
