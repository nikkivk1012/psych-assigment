import { test, expect } from '@playwright/test';
import { createNote, createTestUser, deleteTestUser, getNote } from '../helpers/notes-api';
import { NotesAppPage } from '../pages/notes-app.page';

test('API-created note is visible and editable across the UI/API boundary', async ({
  page,
  request,
}) => {
  const user = await createTestUser(request, 'Integrated User');
  let noteId: string | undefined;
  const apiTitle = `Integrated note ${Date.now()}`;

  try {
    await test.step('create a note using the API', async () => {
      const note = await createNote(request, user.token, {
        title: apiTitle,
        description: 'Created by API for UI verification',
      });
      noteId = note.id;
    });

    await test.step('sign in through the UI and verify API data renders', async () => {
      const notesApp = new NotesAppPage(page);
      await notesApp.login(user.email, user.password);
      await expect(notesApp.noteCard(apiTitle)).toContainText(
        'Created by API for UI verification',
      );
    });

    await test.step('edit through the UI and verify the resulting API state', async () => {
      const notesApp = new NotesAppPage(page);
      const uiTitle = `${apiTitle} updated in UI`;
      await notesApp.editNote(apiTitle, uiTitle, 'Edited from UI and verified with API');

      await expect
        .poll(async () => (await getNote(request, user.token, noteId!)).title)
        .toBe(uiTitle);
      const persisted = await getNote(request, user.token, noteId!);
      expect(persisted.description).toBe('Edited from UI and verified with API');
    });
  } finally {
    await deleteTestUser(request, user);
  }
});
