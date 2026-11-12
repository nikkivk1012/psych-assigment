import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser } from '../helpers/notes-api';
import { NotesAppPage } from '../pages/notes-app.page';

const notesEndpoint = /^https:\/\/practice\.expandtesting\.com\/notes\/api\/notes\/?$/;

function syntheticNote(id: string, title: string, description: string) {
  const timestamp = '2026-01-15T10:00:00.000Z';
  return {
    id,
    title,
    description,
    completed: false,
    created_at: timestamp,
    updated_at: timestamp,
    category: 'Home',
    user_id: '65a000000000000000000001',
  };
}

test('renders a deterministic synthetic notes list from the real list endpoint', async ({
  page,
  request,
}) => {
  const user = await createTestUser(request, 'Mock List User');
  let intercepted = 0;

  try {
    await test.step('install a narrow GET mock before login triggers list loading', async () => {
      await page.route(notesEndpoint, async (route) => {
        if (route.request().method() !== 'GET') {
          await route.continue();
          return;
        }
        intercepted += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            status: 200,
            message: 'Retrieved notes successfully',
            data: [
              syntheticNote('65a000000000000000000011', 'Mocked Home Note', 'Synthetic home data'),
              syntheticNote('65a000000000000000000012', 'Mocked Work Note', 'Synthetic work data'),
            ],
          }),
        });
      });
      const notesApp = new NotesAppPage(page);
      await notesApp.login(user.email, user.password);
    });

    await test.step('assert intercepted data is rendered in the actual app', async () => {
      const notesApp = new NotesAppPage(page);
      await expect(notesApp.noteCard('Mocked Home Note')).toContainText('Synthetic home data');
      await expect(notesApp.noteCard('Mocked Work Note')).toContainText('Synthetic work data');
      expect(intercepted).toBeGreaterThan(0);
    });
  } finally {
    await deleteTestUser(request, user);
  }
});

test('records dashboard behavior when the real notes endpoint returns 401', async ({
  page,
  request,
}) => {
  const user = await createTestUser(request, 'Mock Unauthorized User');
  let intercepted = 0;

  try {
    await page.route(notesEndpoint, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      intercepted += 1;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          status: 401,
          message: 'Invalid authentication token',
        }),
      });
    });
    await page.goto('https://practice.expandtesting.com/notes/app/login');
    await page.getByLabel('Email address').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    const unauthorizedResponse = page.waitForResponse(
      (response) =>
        notesEndpoint.test(response.url()) &&
        response.request().method() === 'GET' &&
        response.status() === 401,
    );
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await unauthorizedResponse;

    await test.step('verify the intercepted failure and actual dashboard response', async () => {
      expect(intercepted).toBe(1);
      await expect(page).toHaveURL(/\/notes\/app$/);
      await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
      await expect(page.getByTestId('note-card')).toHaveCount(0);
    });
  } finally {
    await deleteTestUser(request, user);
  }
});

test('failed note creation does not appear successful and leaves a retry path', async ({
  page,
  request,
}) => {
  const user = await createTestUser(request, 'Mock Failed Create User');
  const title = `Failed create ${Date.now()}`;
  let intercepted = 0;

  try {
    await page.goto('https://practice.expandtesting.com/notes/app/login');
    await page.getByLabel('Email address').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

    await page.route(notesEndpoint, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      intercepted += 1;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          status: 500,
          message: 'Internal server error',
        }),
      });
    });

    await test.step('submit a note while the actual mutation endpoint is forced to fail', async () => {
      await page.getByRole('button', { name: /Add Note/i }).click();
      await page.locator('#title').fill(title);
      await page.locator('#description').fill('This failed mutation must not persist');
      await page.locator('#title').scrollIntoViewIfNeeded();
      const failedCreate = page.waitForResponse(
        (response) =>
          notesEndpoint.test(response.url()) &&
          response.request().method() === 'POST' &&
          response.status() === 500,
      );
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await failedCreate;

      expect(intercepted).toBe(1);
      await expect(page.getByTestId('note-card-title').getByText(title, { exact: true })).toHaveCount(0);
      await expect(page.locator('#title')).toBeVisible();
    });

    await test.step('confirm the server has no state from the mocked request', async () => {
      const liveNotes = await request.get('https://practice.expandtesting.com/notes/api/notes', {
        headers: { 'x-auth-token': user.token },
      });
      expect(liveNotes.ok()).toBeTruthy();
      const body = (await liveNotes.json()) as {
        data: Array<{ title: string }>;
      };
      expect(body.data.map((note) => note.title)).not.toContain(title);
    });
  } finally {
    await deleteTestUser(request, user);
  }
});
