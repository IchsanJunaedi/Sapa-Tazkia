// Test the api service module — interceptors and exported helper APIs.
// __mocks__/axios.js auto-mocks axios. axios.create returns the same instance
// (the mock returns `this`), so api === axios.

import axios from 'axios';
jest.mock('axios');
import * as apiModule from './api';

const { authAPI, academicAPI, chatAPI } = apiModule;

// Capture interceptor handlers registered when the module was first imported.
const [reqOnSuccess, reqOnError] = axios.interceptors.request.use.mock.calls[0];
const [resOnSuccess, resOnError] = axios.interceptors.response.use.mock.calls[0];

beforeEach(() => {
  axios.get.mockReset();
  axios.post.mockReset();
  axios.delete.mockReset();
  jest.spyOn(window.localStorage.__proto__, 'getItem');
  jest.spyOn(window.localStorage.__proto__, 'removeItem').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('services/api — interceptors', () => {
  it('registers request and response interceptors on import', () => {
    expect(reqOnSuccess).toBeDefined();
    expect(resOnSuccess).toBeDefined();
  });

  it('request interceptor injects bearer token when present', () => {
    window.localStorage.getItem.mockReturnValue('jwt-token');
    const cfg = reqOnSuccess({ headers: {} });
    expect(cfg.headers.Authorization).toBe('Bearer jwt-token');
  });

  it('request interceptor skips when no token', () => {
    window.localStorage.getItem.mockReturnValue(null);
    const cfg = reqOnSuccess({ headers: {} });
    expect(cfg.headers.Authorization).toBeUndefined();
  });

  it('request interceptor error handler rejects', async () => {
    await expect(reqOnError(new Error('x'))).rejects.toThrow('x');
  });

  it('response interceptor passes through success responses', () => {
    const res = { data: { ok: true } };
    expect(resOnSuccess(res)).toBe(res);
  });

  it('response interceptor clears storage and redirects on 401', async () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };
    await expect(resOnError({ response: { status: 401 } })).rejects.toBeDefined();
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(window.localStorage.removeItem).toHaveBeenCalledWith('user');
    expect(window.location.href).toBe('/login');
    window.location = originalLocation;
  });

  it('response interceptor passes through non-401 errors', async () => {
    const err = { response: { status: 500 } };
    await expect(resOnError(err)).rejects.toBe(err);
  });
});

describe('services/api — authAPI', () => {
  it('login posts /auth/login with credentials', async () => {
    axios.post.mockResolvedValue({ data: { token: 'x' } });
    const out = await authAPI.login('123', 'pw');
    expect(axios.post).toHaveBeenCalledWith('/auth/login', { nim: '123', password: 'pw' });
    expect(out).toEqual({ token: 'x' });
  });

  it('logout posts /auth/logout', async () => {
    axios.post.mockResolvedValue({ data: { ok: true } });
    await authAPI.logout();
    expect(axios.post).toHaveBeenCalledWith('/auth/logout');
  });

  it('verify gets /auth/verify', async () => {
    axios.get.mockResolvedValue({ data: { ok: true } });
    await authAPI.verify();
    expect(axios.get).toHaveBeenCalledWith('/auth/verify');
  });

  it('getMe gets /auth/me', async () => {
    axios.get.mockResolvedValue({ data: { user: {} } });
    await authAPI.getMe();
    expect(axios.get).toHaveBeenCalledWith('/auth/me');
  });
});

describe('services/api — academicAPI', () => {
  it('getSummary gets /academic/summary', async () => {
    axios.get.mockResolvedValue({ data: {} });
    await academicAPI.getSummary();
    expect(axios.get).toHaveBeenCalledWith('/academic/summary');
  });

  it('getGrades without semester', async () => {
    axios.get.mockResolvedValue({ data: {} });
    await academicAPI.getGrades();
    expect(axios.get).toHaveBeenCalledWith('/academic/grades');
  });

  it('getGrades with semester filter', async () => {
    axios.get.mockResolvedValue({ data: {} });
    await academicAPI.getGrades('2024-1');
    expect(axios.get).toHaveBeenCalledWith('/academic/grades?semester=2024-1');
  });

  it('getTranscript gets /academic/transcript', async () => {
    axios.get.mockResolvedValue({ data: {} });
    await academicAPI.getTranscript();
    expect(axios.get).toHaveBeenCalledWith('/academic/transcript');
  });

  it('downloadTranscriptPDF requests blob', async () => {
    axios.get.mockResolvedValue({ data: new Blob() });
    await academicAPI.downloadTranscriptPDF();
    expect(axios.get).toHaveBeenCalledWith('/academic/transcript/pdf', { responseType: 'blob' });
  });
});

describe('services/api — chatAPI', () => {
  it('sendMessage posts to /chat with payload', async () => {
    axios.post.mockResolvedValue({ data: { reply: 'hi' } });
    await chatAPI.sendMessage('hello', 'cv1');
    expect(axios.post).toHaveBeenCalledWith('/chat', { message: 'hello', conversationId: 'cv1' });
  });

  it('getHistory gets /chat/history/:id', async () => {
    axios.get.mockResolvedValue({ data: {} });
    await chatAPI.getHistory('id');
    expect(axios.get).toHaveBeenCalledWith('/chat/history/id');
  });

  it('getConversations gets /chat/conversations/:userId', async () => {
    axios.get.mockResolvedValue({ data: {} });
    await chatAPI.getConversations('u1');
    expect(axios.get).toHaveBeenCalledWith('/chat/conversations/u1');
  });

  it('deleteConversation deletes /chat/conversation/:id', async () => {
    axios.delete.mockResolvedValue({ data: {} });
    await chatAPI.deleteConversation('cv1');
    expect(axios.delete).toHaveBeenCalledWith('/chat/conversation/cv1');
  });
});
