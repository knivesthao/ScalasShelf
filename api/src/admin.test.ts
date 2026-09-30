// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { estimateCost, PRICES_PER_MILLION } from './services/admin';
import { testApi } from './testing';

const MODEL = Object.keys(PRICES_PER_MILLION)[0];

describe('admin view', () => {
  it('is for admins only', async () => {
    const { call } = await testApi();
    for (const path of ['/admin/overview', '/admin/books', '/admin/books/demo-noy']) {
      expect((await call('GET', path)).status, path).toBe(403);
      expect((await call('GET', path, { user: 'demo-reviewer' })).status, path).toBe(403);
    }
  });

  it('estimates cost from tokens, and says so when a model has no price', () => {
    const price = PRICES_PER_MILLION[MODEL];
    expect(estimateCost([{ model: MODEL, input_tokens: 1_000_000, output_tokens: 1_000_000 }])).toBeCloseTo(price.input + price.output, 4);
    expect(estimateCost([{ model: 'unknown/model', input_tokens: 10, output_tokens: 0 }])).toBeNull();
  });

  it('adds up Scala’s tokens, time and cost overall and per book', async () => {
    const { call, raw } = await testApi();
    raw.prepare(`INSERT INTO staff (email, name, role, created_at) VALUES ('admin@example.org', 'Admin', 'admin', '2026-01-01')`).run();
    const insert = raw.prepare(
      `INSERT INTO ai_usage (task, model, project_id, user_id, input_tokens, output_tokens, ms, ok, created_at) VALUES (?, ?, ?, 'demo-creator', ?, ?, ?, 1, ?)`
    );
    insert.run('finish', MODEL, 'demo-noy', 1500, 900, 12_000, '2026-09-30T10:00:00Z');
    insert.run('describe', MODEL, 'demo-noy', 300, 20, 1_000, '2026-09-30T10:05:00Z');
    const admin = { user: 'admin@example.org' };

    const overview = (await call('GET', '/admin/overview', admin)).json;
    expect(overview.ai).toMatchObject({ calls: 2, input_tokens: 1800, output_tokens: 920, ms: 13_000 });
    expect(overview.per_book.books_with_ai).toBe(1);
    expect(overview.per_book.avg_ai_seconds).toBe(13);
    expect(overview.per_book.avg_estimated_cost).toBeGreaterThan(0);

    const books = (await call('GET', '/admin/books', admin)).json;
    expect(books.find((b: { id: string }) => b.id === 'demo-noy')).toMatchObject({ ai_calls: 2, input_tokens: 1800, output_tokens: 920, ai_seconds: 13 });

    const book = (await call('GET', '/admin/books/demo-noy', admin)).json;
    expect(book.ai.by_task.map((t: { task: string }) => t.task).sort()).toEqual(['describe', 'finish']);
    expect(book.ai.calls).toHaveLength(2);
    expect((await call('GET', '/admin/books/nope', admin)).status).toBe(404);
  });
});

describe('Review checks', () => {
  it('uses the spell checker, ignores cast names, and blocks sending until everything is green', async () => {
    const { call, raw } = await testApi();
    raw.prepare(`UPDATE projects SET status = 'draft', description = '' WHERE id = 'demo-noy'`).run();
    const checks = (await call('POST', '/studio/projects/demo-noy/check')).json.checks as { id: string; status: string }[];
    expect(checks.map((c) => c.id)).toEqual(['details', 'pages', 'lines', 'art', 'spelling', 'level', 'words', 'quiz']);
    expect(checks.find((c) => c.id === 'details')?.status).toBe('fail'); // no description
    expect(checks.find((c) => c.id === 'spelling')?.status).toBe('skipped'); // no spell checker in tests
    const res = await call('POST', '/studio/projects/demo-noy/submit');
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/Fix these first/);
  });

  it('turns LanguageTool’s matches into page-by-page problems', async () => {
    const { spellingCheck } = await import('./services/spelling');
    const drafts = [
      { description: '', aspect: '9:16' as const, layers: [], assets: {}, caption: '', bubbles: [
        { id: 'b1', speaker: 'Noy', characterId: 'c1', style: 'speech' as const, x: 0, y: 0, w: 1, text: { en: 'Noy is late for scool.' }, tokens: {}, audio: {} },
      ] },
    ];
    const checker = {
      check: async (text: string) => [
        { offset: text.indexOf('Noy'), length: 3, suggestions: ['Now'] },
        { offset: text.indexOf('scool'), length: 5, suggestions: ['school'] },
      ],
    };
    const cast = { characters: [{ id: 'c1', name: 'Noy', description: '' }], places: [] };
    const check = await spellingCheck(checker, drafts, cast);
    expect(check.status).toBe('fail');
    expect(check.problems).toEqual([{ scene: 1, message: '“scool”: did you mean “school”?' }]);
  });
});
