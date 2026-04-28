// frontend/src/utils/logger.test.js

describe('logger utility', () => {
  let logSpy, infoSpy, warnSpy, errorSpy, groupSpy, groupEndSpy, tableSpy;

  beforeEach(() => {
    jest.resetModules();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    groupSpy = jest.spyOn(console, 'group').mockImplementation(() => {});
    groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
    tableSpy = jest.spyOn(console, 'table').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  // eslint-disable-next-line testing-library/no-debugging-utils
  it('log/info/debug output in non-production', () => {
    // NODE_ENV is 'test' in jest
    const logger = require('./logger').default;
    logger.log('a');
    logger.info('b');
    // eslint-disable-next-line testing-library/no-debugging-utils
    logger.debug('c');
    expect(logSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
  });

  it('warn/error always visible', () => {
    const logger = require('./logger').default;
    logger.warn('w');
    logger.error('e');
    expect(warnSpy).toHaveBeenCalledWith('[WARN]', 'w');
    expect(errorSpy).toHaveBeenCalledWith('[ERROR]', 'e');
  });

  it('group/groupEnd/table called', () => {
    const logger = require('./logger').default;
    logger.group('label');
    logger.groupEnd();
    logger.table([{ a: 1 }]);
    expect(groupSpy).toHaveBeenCalledWith('label');
    expect(groupEndSpy).toHaveBeenCalled();
    expect(tableSpy).toHaveBeenCalled();
  });

  it('enableDebug sets localStorage and disableDebug removes it', () => {
    const logger = require('./logger').default;
    logger.enableDebug();
    expect(localStorage.getItem('debug')).toBe('true');
    logger.disableDebug();
    expect(localStorage.getItem('debug')).toBeNull();
  });

  it('attaches logger to window', () => {
    require('./logger');
    expect(window.appLogger).toBeDefined();
    expect(typeof window.appLogger.log).toBe('function');
  });
});
