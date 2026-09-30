// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { testApi } from './testing';

const DEVICE = 'device-1234abcd';

describe('reading events', () => {
  it('stores known events from any reader, and skips unknown ones', async () => {
    const { call, raw } = await testApi();
    const res = await call('POST', '/events', {
      body: {
        device_id: DEVICE,
        app_version: 'web',
        events: [
          { name: 'book_opened', book_id: 'book-demo-noy', at: '2026-09-30T10:00:00.000Z' },
          { name: 'quiz_finished', book_id: 'book-demo-noy', props: { score: 4, total: 5 } },
          { name: 'not_a_real_event' },
          { name: 'book_opened', book_id: 'bad id with spaces' },
        ],
      },
    });
    expect(res.json).toEqual({ stored: 3 });
    const rows = raw.prepare(`SELECT name, book_id, device_id FROM events ORDER BY id`).all();
    expect(rows).toEqual([
      { name: 'book_opened', book_id: 'book-demo-noy', device_id: DEVICE },
      { name: 'quiz_finished', book_id: 'book-demo-noy', device_id: DEVICE },
      { name: 'book_opened', book_id: null, device_id: DEVICE },
    ]);
  });

  it('refuses a missing device id or an oversized batch', async () => {
    const { call } = await testApi();
    expect((await call('POST', '/events', { body: { events: [] } })).status).toBe(400);
    const events = Array.from({ length: 51 }, () => ({ name: 'app_opened' }));
    expect((await call('POST', '/events', { body: { device_id: DEVICE, events } })).status).toBe(400);
  });

  it('sums opens, finishes, readers and quiz scores per book for admins', async () => {
    const { call, raw } = await testApi();
    raw.prepare(`INSERT INTO staff (email, name, role, created_at) VALUES ('admin@example.org', 'Admin', 'admin', '2026-01-01')`).run();
    const send = (device: string, events: unknown[]) => call('POST', '/events', { body: { device_id: device, events } });
    await send('device-aaaaaaaa', [
      { name: 'book_opened', book_id: 'book-demo-noy' },
      { name: 'book_finished', book_id: 'book-demo-noy' },
      { name: 'quiz_finished', book_id: 'book-demo-noy', props: { score: 5, total: 5 } },
    ]);
    await send('device-bbbbbbbb', [
      { name: 'book_opened', book_id: 'book-demo-noy' },
      { name: 'quiz_finished', book_id: 'book-demo-noy', props: { score: 3, total: 5 } },
    ]);

    expect((await call('GET', '/admin/stats')).status).toBe(403);
    const stats = (await call('GET', '/admin/stats', { user: 'admin@example.org' })).json;
    expect(stats.devices).toBe(2);
    expect(stats.books).toEqual([
      { book_id: 'book-demo-noy', title: 'Noy and the Buffalo', opened: 2, finished: 1, readers: 2, quizzes: 2, avg_quiz_score: 0.8 },
    ]);
  });
});

describe('AI usage', () => {
  it('records each Scala call with its task, book and tokens, for admins to see', async () => {
    const { db, raw } = await testApi();
    const { metered, suggestDescription, aiUsage } = await import('./services/ai');
    const fake = { name: 'fake/model', complete: async () => ({ text: 'Noy and her buffalo are late for school.', inputTokens: 120, outputTokens: 12 }) };
    const model = metered(fake, db, { task: 'describe', userId: 'demo-creator', projectId: 'draft-1' });
    const out = await suggestDescription(model, { title: 'Noy', level: 'A1', lines: ['Noy: Come on!'] });
    expect(out).toEqual({ description: 'Noy and her buffalo are late for school.', source: 'ai' });

    const failing = metered({ name: 'fake/model', complete: async () => { throw new Error('down'); } }, db, { task: 'describe', userId: 'demo-creator', projectId: 'draft-1' });
    await suggestDescription(failing, { title: 'Noy', level: 'A1', lines: ['Noy: Come on!'] }); // falls back to rules

    expect(raw.prepare(`SELECT task, model, project_id, input_tokens, output_tokens, ok FROM ai_usage ORDER BY id`).all()).toEqual([
      { task: 'describe', model: 'fake/model', project_id: 'draft-1', input_tokens: 120, output_tokens: 12, ok: 1 },
      { task: 'describe', model: 'fake/model', project_id: 'draft-1', input_tokens: null, output_tokens: null, ok: 0 },
    ]);
    expect((await aiUsage(db)).rows).toMatchObject([{ project_id: 'draft-1', task: 'describe', calls: 2, failed: 1, input_tokens: 120 }]);
  });
});
