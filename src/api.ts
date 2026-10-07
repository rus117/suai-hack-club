import type { Session } from './types';

export class ApiError extends Error {
  constructor(message: string, public status: number, public fields?: Record<string, string[]>) { super(message); }
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { credentials: 'same-origin', ...options }); }
  catch { throw new ApiError('Нет связи с сервером. Проверь интернет и повтори попытку.', 0); }
  let body;
  try { body = await response.json(); }
  catch { throw new ApiError('Сервер временно недоступен. Попробуй ещё раз чуть позже.', response.status); }
  if (!response.ok) throw new ApiError(body.error || 'Не удалось выполнить запрос.', response.status, body.fields);
  return body as T;
}

export async function mutate<T>(path: string, payload: Record<string, unknown> | FormData, method = 'POST'): Promise<T> {
  const session = await request<Session>('/api/session');
  const multipart = payload instanceof FormData;
  return request<T>(path, {
    method, headers: { 'X-CSRF-Token': session.csrf, ...(!multipart ? { 'Content-Type': 'application/json' } : {}) },
    body: multipart ? payload : JSON.stringify(payload),
  });
}

export const readableError = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить действие. Попробуй ещё раз.';
