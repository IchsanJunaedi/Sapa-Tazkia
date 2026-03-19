// backend/tests/unit/logger.test.js
describe('Logger', () => {
  let logger;

  beforeEach(() => {
    jest.resetModules();
    logger = require('../../src/utils/logger');
  });

  it('should export all required methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.security).toBe('function');
    expect(typeof logger.request).toBe('function');
    expect(typeof logger.rateLimit).toBe('function');
    expect(typeof logger.redis).toBe('function');
  });

  it('should not throw when calling any method', () => {
    expect(() => logger.info('test info')).not.toThrow();
    expect(() => logger.error('test error')).not.toThrow();
    expect(() => logger.warn('test warn')).not.toThrow();
    expect(() => logger.debug('test debug')).not.toThrow();
    expect(() => logger.security('test security')).not.toThrow();
    expect(() => logger.request('GET', '/api/test', 200)).not.toThrow();
    expect(() => logger.rateLimit('test rateLimit')).not.toThrow();
    expect(() => logger.redis('test redis')).not.toThrow();
  });
});
