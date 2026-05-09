// __mocks__/axios.js auto-mocks. axios.create returns the same instance.

import axios from 'axios';
jest.mock('axios');
import api, { clearAuthHeaders, setAuthHeaders, testConnection } from './axiosConfig';

const [reqOnSuccess, reqOnError] = axios.interceptors.request.use.mock.calls[0];
const [resOnSuccess, resOnError] = axios.interceptors.response.use.mock.calls[0];

beforeEach(() => {
  axios.get.mockReset();
  jest.spyOn(window.localStorage.__proto__, 'getItem');
  jest.spyOn(window.localStorage.__proto__, 'removeItem').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('api/axiosConfig', () => {
  it('exports default api + helpers', () => {
    expect(api).toBeDefined();
    expect(typeof clearAuthHeaders).toBe('function');
    expect(typeof setAuthHeaders).toBe('function');
    expect(typeof testConnection).toBe('function');
  });

  it('registers request and response interceptors on import', () => {
    expect(reqOnSuccess).toBeDefined();
    expect(resOnSuccess).toBeDefined();
  });

  it('request interceptor injects bearer token + content-type', () => {
    window.localStorage.getItem.mockReturnValue('jwt');
    const cfg = reqOnSuccess({ headers: {} });
    expect(cfg.headers.Authorization).toBe('Bearer jwt');
    expect(cfg.headers['Content-Type']).toBe('application/json');
  });

  it('request interceptor preserves existing content-type', () => {
    window.localStorage.getItem.mockReturnValue(null);
    const cfg = reqOnSuccess({ headers: { 'Content-Type': 'multipart/form-data' } });
    expect(cfg.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('request interceptor error rejects', async () => {
    await expect(reqOnError(new Error('x'))).rejects.toThrow('x');
  });

  it('response interceptor passes through success', () => {
    const r = { data: 'x' };
    expect(resOnSuccess(r)).toBe(r);
  });

  it('response interceptor on 401 clears auth and dispatches event', async () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: '/foo', pathname: '/foo' };
    const dispatch = jest.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
    jest.useFakeTimers();
    await expect(resOnError({ response: { status: 401 } })).rejects.toBeDefined();
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('user');
    expect(dispatch).toHaveBeenCalled();
    jest.useRealTimers();
    window.location = originalLocation;
    dispatch.mockRestore();
  });

  it('response interceptor on network error calls showNotification when present', async () => {
    window.showNotification = jest.fn();
    await expect(resOnError({ request: {} })).rejects.toBeDefined();
    expect(window.showNotification).toHaveBeenCalled();
    delete window.showNotification;
  });

  it('response interceptor on non-401 error rejects without side effects', async () => {
    await expect(resOnError({ response: { status: 500 } })).rejects.toBeDefined();
  });

  it('clearAuthHeaders deletes default Authorization', () => {
    axios.defaults.headers.common['Authorization'] = 'Bearer x';
    clearAuthHeaders();
    expect(axios.defaults.headers.common['Authorization']).toBeUndefined();
  });

  it('setAuthHeaders with token sets header, without token clears', () => {
    setAuthHeaders('abc');
    expect(axios.defaults.headers.common['Authorization']).toBe('Bearer abc');
    setAuthHeaders(null);
    expect(axios.defaults.headers.common['Authorization']).toBeUndefined();
  });

  it('testConnection returns true on /health success', async () => {
    axios.get.mockResolvedValue({ data: { ok: true } });
    const ok = await testConnection();
    expect(ok).toBe(true);
  });

  it('testConnection returns false on failure', async () => {
    axios.get.mockRejectedValue(new Error('boom'));
    const ok = await testConnection();
    expect(ok).toBe(false);
  });
});
