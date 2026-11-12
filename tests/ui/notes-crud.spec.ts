import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser } from '../helpers/notes-api';
import { NotesAppPage } from '../pages/notes-app.page';

test('create, edit, reload, and delete a note in the UI', async ({ page, request }) => {
  const user = await createTestUser(request);
  const notesApp = new NotesAppPage(page);
  const originalTitle = `UI note ${Date.now()}`;
  const updatedTitle = `${originalTitle} updated`;

  try {
    await test.step('log in through the UI as the API-registered unique user', async () => {
      await notesApp.login(user.email, user.password);
    });

    await test.step('create a note and verify its rendered fields', async () => {
      await notesApp.createNote(originalTitle, 'Created by the Notes UI CRUD test');
      await expect(notesApp.noteCard(originalTitle)).toContainText(
        'Created by the Notes UI CRUD test',
      );
    });

    await test.step('edit the note and verify persistence after reload', async () => {
      await notesApp.editNote(
        originalTitle,
        updatedTitle,
        'Edited description survives a fresh load',
      );
      await page.reload();
      await expect(notesApp.noteCard(updatedTitle)).toContainText(
        'Edited description survives a fresh load',
      );
      await expect(notesApp.noteCard(originalTitle)).toHaveCount(0);
    });

    await test.step('delete the note and verify absence after a fresh load', async () => {
      await notesApp.deleteNote(updatedTitle);
      await page.reload();
      await expect(notesApp.noteCard(updatedTitle)).toHaveCount(0);
    });
  } finally {
    await deleteTestUser(request, user);
  }
});
