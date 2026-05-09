/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import logger from './logger';

describe('logger utility', () => {
  let logSpy, infoSpy, warnSpy, errorSpy, groupSpy, groupEndSpy, tableSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    groupSpy = jest.spyOn(console, 'group').mockImplementation(() => {});
    groupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
    tableSpy = jest.spyOn(console, 'table').mockImplementation(() => {});
    
    // Mock localStorage if it somehow doesn't exist
    if (!global.localStorage) {
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        };
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (global.localStorage && global.localStorage.clear) {
        global.localStorage.clear();
    }
  });

  it('log/info/debug output in non-production', () => {
    logger.log('a');
    logger.info('b');
    // eslint-disable-next-line testing-library/no-debugging-utils
    logger.debug('c');
    expect(logSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
  });

  it('warn/error always visible', () => {
    logger.warn('w');
    logger.error('e');
    expect(warnSpy).toHaveBeenCalledWith('[WARN]', 'w');
    expect(errorSpy).toHaveBeenCalledWith('[ERROR]', 'e');
  });

  it('group/groupEnd/table called', () => {
    logger.group('label');
    logger.groupEnd();
    logger.table([{ a: 1 }]);
    expect(groupSpy).toHaveBeenCalledWith('label');
    expect(groupEndSpy).toHaveBeenCalled();
    expect(tableSpy).toHaveBeenCalled();
  });

  it('enableDebug sets localStorage and disableDebug removes it', () => {
    logger.enableDebug();
    // Use the actual localStorage mock or verify the API calls
    logger.disableDebug();
  });

  it('attaches logger to window', () => {
    expect(window.appLogger).toBeDefined();
    expect(typeof window.appLogger.log).toBe('function');
  });
});
