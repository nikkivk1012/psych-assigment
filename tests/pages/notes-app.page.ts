import { expect, type Page } from '@playwright/test';
import { APP_URL } from '../helpers/notes-api';

export class NotesAppPage {
  constructor(private readonly page: Page) {}

  async login(email: string, password: string): Promise<void> {
    await this.page.goto(`${APP_URL}/login`);
    await this.page.getByLabel('Email address').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(this.page.getByRole('button', { name: 'Logout' })).toBeVisible();
  }

  noteCard(title: string) {
    return this.page
      .getByTestId('note-card')
      .filter({
        has: this.page.getByText(title, { exact: true }),
      });
  }

  async createNote(title: string, description: string): Promise<void> {
    await this.page.getByRole('button', { name: /Add Note/i }).click();
    await this.page.locator('#title').fill(title);
    await this.page.locator('#description').fill(description);
    await this.page.locator('#title').scrollIntoViewIfNeeded();
    await this.page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(this.noteCard(title)).toBeVisible();
  }

  async editNote(currentTitle: string, title: string, description: string): Promise<void> {
    const card = this.noteCard(currentTitle);
    await card.getByTestId('note-edit').click();
    await this.page.locator('#title').fill(title);
    await this.page.locator('#description').fill(description);
    await this.page.locator('#title').scrollIntoViewIfNeeded();
    await this.page.getByRole('button', { name: /Update|Save/i }).click();
    await expect(this.noteCard(title)).toBeVisible();
  }

  async deleteNote(title: string): Promise<void> {
    const card = this.noteCard(title);
    await card.getByTestId('note-delete').click();
    await this.page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(card).toHaveCount(0);
  }
}
