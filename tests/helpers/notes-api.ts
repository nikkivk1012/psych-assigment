import { randomUUID } from 'node:crypto';
import type { APIRequestContext, APIResponse } from '@playwright/test';

export const APP_URL = 'https://practice.expandtesting.com/notes/app';
export const API_URL = 'https://practice.expandtesting.com/notes/api';

export interface TestUser {
  id: string;
  name: string;
  email: string;
  password: string;
  token: string;
}

export interface Note {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
  category: string;
  user_id: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  status: number;
  message: string;
  data: T;
}

async function readJson<T>(response: APIResponse, expectedStatus: number): Promise<T> {
  const body = await response.text();
  if (response.status() !== expectedStatus) {
    throw new Error(`Expected HTTP ${expectedStatus}, received ${response.status()}: ${body}`);
  }
  return JSON.parse(body) as T;
}

function apiPath(path: string): string {
  return `${API_URL}${path}`;
}

function authHeaders(token: string): Record<string, string> {
  return { 'x-auth-token': token };
}

export async function createTestUser(
  request: APIRequestContext,
  label = 'Playwright Assessment',
): Promise<TestUser> {
  const user = {
    name: `${label.slice(0, 20)} ${randomUUID().slice(0, 8)}`,
    email: `playwright-${randomUUID()}@example.com`,
    password: `Pw-${randomUUID().slice(0, 12)}!`,
  };
  const registered = await readJson<ApiEnvelope<{ id: string }>>(
    await request.post(apiPath('/users/register'), { form: user }),
    201,
  );
  const login = await readJson<ApiEnvelope<{ token: string }>>(
    await request.post(apiPath('/users/login'), {
      form: { email: user.email, password: user.password },
    }),
    200,
  );
  return { ...user, id: registered.data.id, token: login.data.token };
}

export async function deleteTestUser(
  request: APIRequestContext,
  user: TestUser,
): Promise<void> {
  const response = await request.delete(apiPath('/users/delete-account'), {
    headers: authHeaders(user.token),
  });
  await readJson<ApiEnvelope<unknown>>(response, 200);
}

export async function createNote(
  request: APIRequestContext,
  token: string,
  note: Pick<Note, 'title' | 'description'> & { category?: string; completed?: boolean },
): Promise<Note> {
  const response = await request.post(apiPath('/notes/'), {
    headers: authHeaders(token),
    data: {
      title: note.title,
      description: note.description,
      category: note.category ?? 'Home',
      completed: note.completed ?? false,
    },
  });
  const result = await readJson<ApiEnvelope<Note>>(response, 200);
  return result.data;
}

export async function listNotes(request: APIRequestContext, token: string): Promise<Note[]> {
  const result = await readJson<ApiEnvelope<Note[]>>(
    await request.get(apiPath('/notes'), { headers: authHeaders(token) }),
    200,
  );
  return result.data;
}

export async function getNote(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<Note> {
  const result = await readJson<ApiEnvelope<Note>>(
    await request.get(apiPath(`/notes/${id}`), { headers: authHeaders(token) }),
    200,
  );
  return result.data;
}

export async function updateNote(
  request: APIRequestContext,
  token: string,
  note: Note,
  changes: Pick<Note, 'title' | 'description'>,
): Promise<Note> {
  const response = await request.put(apiPath(`/notes/${note.id}`), {
    headers: authHeaders(token),
    data: {
      title: changes.title,
      description: changes.description,
      completed: note.completed,
      category: note.category,
    },
  });
  const result = await readJson<ApiEnvelope<Note>>(response, 200);
  return result.data;
}

export async function deleteNote(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  await readJson<ApiEnvelope<unknown>>(
    await request.delete(apiPath(`/notes/${id}`), { headers: authHeaders(token) }),
    200,
  );
}
