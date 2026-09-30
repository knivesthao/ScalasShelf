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
