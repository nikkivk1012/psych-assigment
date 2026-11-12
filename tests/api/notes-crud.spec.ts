import { test, expect } from '@playwright/test';
import {
  createNote,
  createTestUser,
  deleteNote,
  deleteTestUser,
  getNote,
  listNotes,
  updateNote,
} from '../helpers/notes-api';

test('authenticated CRUD, unauthorized access, and cross-user isolation', async ({ request }) => {
  const userA = await createTestUser(request, 'API User A');
  const userB = await createTestUser(request, 'API User B');
  let noteId: string | undefined;

  try {
    await test.step('reject a protected operation without a token', async () => {
      const response = await request.get('https://practice.expandtesting.com/notes/api/notes');
      expect([401, 403]).toContain(response.status());
    });

    await test.step('create, list, update, and retrieve a note as user A', async () => {
      const note = await createNote(request, userA.token, {
        title: `API note ${Date.now()}`,
        description: 'Original API description',
      });
      noteId = note.id;
      expect(note.id).toBeTruthy();
      expect(note.title).toContain('API note');
      expect(note.description).toBe('Original API description');
      expect(note.user_id).toBe(userA.id);

      const listed = await listNotes(request, userA.token);
      expect(listed.map((item) => item.id)).toContain(note.id);

      const updated = await updateNote(request, userA.token, note, {
        title: `${note.title} updated`,
        description: 'Updated API description',
      });
      expect(updated.id).toBe(note.id);
      expect(updated.title).toBe(`${note.title} updated`);
      expect(updated.description).toBe('Updated API description');

      const persisted = await getNote(request, userA.token, note.id);
      expect(persisted.title).toBe(updated.title);
      expect(persisted.description).toBe(updated.description);
    });

    await test.step('prove user B cannot see or modify user A note', async () => {
      const userBNotes = await listNotes(request, userB.token);
      expect(userBNotes.map((item) => item.id)).not.toContain(noteId);

      const directRead = await request.get(
        `https://practice.expandtesting.com/notes/api/notes/${noteId}`,
        { headers: { 'x-auth-token': userB.token } },
      );
      expect([403, 404]).toContain(directRead.status());

      const attemptedUpdate = await request.put(
        `https://practice.expandtesting.com/notes/api/notes/${noteId}`,
        {
          headers: { 'x-auth-token': userB.token },
          data: {
            title: 'Unauthorized change',
            description: 'Must not be applied',
            completed: false,
            category: 'Home',
          },
        },
      );
      expect([403, 404]).toContain(attemptedUpdate.status());
    });

    await test.step('delete user A note and verify it is absent', async () => {
      await deleteNote(request, userA.token, noteId!);
      const remaining = await listNotes(request, userA.token);
      expect(remaining.map((item) => item.id)).not.toContain(noteId);
      noteId = undefined;
    });
  } finally {
    if (noteId) {
      await deleteNote(request, userA.token, noteId);
    }
    await deleteTestUser(request, userA);
    await deleteTestUser(request, userB);
  }
});
