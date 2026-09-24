import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { testApi } from '../../../api/src/testing';
import { demoDraft } from '@/lib/demoContent';

// The Studio with its switched-off features turned on (server storage, art generation,
// publishing), against the real API on in-memory SQLite: the browser's fetch('/api/...')
// is routed straight into the Hono app. Keeps that code working for when it comes back.
vi.mock('@/lib/features', () => ({ FEATURES: { rendering: true, cloudStudio: true } }));
let api: Awaited<ReturnType<typeof testApi>>;
let signedIn = true;

/** The seed publishes "Noy and the Buffalo"; these tests start from its plain draft instead. */
function resetNoyToDraft() {
  api.raw.prepare(`DELETE FROM books WHERE project_id = 'demo-noy'`).run();
  api.raw.prepare(`UPDATE projects SET status = 'draft', quiz = '[]' WHERE id = 'demo-noy'`).run();
  demoDraft().scenes.forEach((data, i) => {
    api.raw.prepare(`UPDATE scenes SET data = ? WHERE id = ?`).run(JSON.stringify(data), `demo-noy-s${i + 1}`);
  });
}

beforeEach(async () => {
  api = await testApi();
  resetNoyToDraft();
  signedIn = true;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (!url.startsWith('/api/')) throw new Error(`Unexpected fetch ${url}`);
    if (!signedIn) return new Response(JSON.stringify({ error: 'Sign in to use the Studio' }), { status: 401 });
    return api.app.request(url, init as RequestInit);
  });
});

afterEach(() => vi.restoreAllMocks());

const rows = (sql: string) => api.raw.prepare(sql).all() as Record<string, unknown>[];

vi.mock('@/hooks/useGenerate', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useGenerate')>('@/hooks/useGenerate');
  return {
    ...actual,
    useGenerate: () => ({
      generateScene: vi.fn(async (req) => actual.stubSceneArt(req)),
      rerollLayer: vi.fn(),
    }),
  };
});

import { StudioDashboard, StudioEditor } from './index';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/studio" element={<StudioDashboard />} />
        <Route path="/studio/:type/:id" element={<StudioEditor />} />
      </Routes>
    </MemoryRouter>
  );
}

const FIRST_LINE = 'It is morning. Noy walks to school with her buffalo.';

describe('StudioDashboard', () => {
  it('lists the creator’s comics with their level', async () => {
    renderAt('/studio');
    expect(await screen.findByText('Noy and the Buffalo')).toBeDefined();
    expect(screen.getByText('Morning Market')).toBeDefined();
    expect(screen.getAllByText('A1')).toHaveLength(2);
    expect(screen.getByText('published')).toBeDefined();
  });

  it('asks to log in when the API says so', async () => {
    signedIn = false;
    renderAt('/studio');
    expect(await screen.findByText('Log in to create content.')).toBeDefined();
  });

  it('creates a free English comic with a first scene', async () => {
    renderAt('/studio');
    fireEvent.click(await screen.findByText('+ New Comic'));
    fireEvent.change(screen.getByPlaceholderText(/Noy and the Buffalo/), { target: { value: 'Market Day' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'A2' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(rows(`SELECT title FROM projects WHERE title = 'Market Day'`)).toHaveLength(1));
    const [project] = rows(`SELECT * FROM projects WHERE title = 'Market Day'`);
    expect(project).toMatchObject({ level: 'A2', status: 'draft', creator_id: 'demo-creator' });
    expect(project).not.toHaveProperty('price_kip');
    expect(rows(`SELECT id FROM scenes WHERE project_id = '${project.id}'`)).toHaveLength(1);
  });
});

describe('StudioEditor', () => {
  it('shows the script with level warnings', async () => {
    renderAt('/studio/comic/demo-noy');
    expect(await screen.findByDisplayValue(FIRST_LINE)).toBeDefined();
    expect(screen.getByText('buffalo', { selector: '.chip' })).toBeDefined();
  });

  it('autosaves edits to the database', async () => {
    renderAt('/studio/comic/demo-noy');
    fireEvent.change(await screen.findByDisplayValue(FIRST_LINE), { target: { value: 'It is early. Noy walks to school.' } });
    await waitFor(() => {
      const [scene] = rows(`SELECT data FROM scenes WHERE id = 'demo-noy-s1'`);
      expect(JSON.parse(String(scene.data)).bubbles[0].text.en).toBe('It is early. Noy walks to school.');
    }, { timeout: 2000 });
    expect(await screen.findByText('Saved')).toBeDefined();
  });

  it('adds a line', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.click(screen.getByText('+ Add line'));
    expect(screen.getByLabelText('Line 3 text')).toBeDefined();
  });

  it('generates scene art and saves it', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.click(screen.getByText('Generate scene art'));
    expect(await screen.findByLabelText('Edit panel layout')).toBeDefined();
    await waitFor(() => {
      const [scene] = rows(`SELECT data FROM scenes WHERE id = 'demo-noy-s1'`);
      expect(JSON.parse(String(scene.data)).layers).toHaveLength(2); // background + Noy (narration has no character)
    }, { timeout: 2000 });
  });

  it('lets the writer star a word with a meaning', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.click(screen.getByRole('tab', { name: 'Words' }));
    fireEvent.click(await screen.findByRole('button', { name: 'buffalo.' }));
    fireEvent.change(screen.getByLabelText('Simple meaning'), { target: { value: 'a big farm animal' } });
    fireEvent.click(screen.getByLabelText(/Teach this word/));
    expect(screen.getByText('Episode vocabulary (1)')).toBeDefined();
    expect(screen.getByText(': a big farm animal')).toBeDefined();
  });

  it('adds and deletes scenes', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.click(screen.getByLabelText('Add scene'));
    expect(await screen.findByText('Scene 4')).toBeDefined();
    fireEvent.click(screen.getByText('Delete scene'));
    await waitFor(() => expect(rows(`SELECT id FROM scenes WHERE project_id = 'demo-noy'`)).toHaveLength(3));
  });

  it('blocks publishing until every scene has art', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.click(screen.getByRole('tab', { name: 'Publish' }));
    expect(screen.getAllByText(/No art yet/)).toHaveLength(3);
    expect((screen.getByText('Publish episode') as HTMLButtonElement).disabled).toBe(true);
  });

  it('publishes a finished episode into the public library', async () => {
    const withArt = { assets: { bg1: { url: '/demo-art/bg-school.webp' } }, layers: [{ id: 'l1', asset: 'bg1', role: 'background', x: 0, y: 0, w: 1, z: 0 }] };
    for (const id of ['demo-noy-s1', 'demo-noy-s2', 'demo-noy-s3']) {
      const [scene] = rows(`SELECT data FROM scenes WHERE id = '${id}'`);
      api.raw.prepare(`UPDATE scenes SET data = ? WHERE id = ?`).run(JSON.stringify({ ...JSON.parse(String(scene.data)), ...withArt }), id);
    }
    const titles = async () => ((await (await api.app.request('/api/books')).json()) as { title: string }[]).map((b) => b.title).sort();

    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.click(screen.getByRole('tab', { name: 'Publish' }));
    fireEvent.click(screen.getByText('Publish episode'));

    expect(await screen.findByText(/Published\. The cloud packager/)).toBeDefined();
    expect(await titles()).toEqual(['Morning Market', 'Noy and the Buffalo']);
    expect(rows(`SELECT kind FROM jobs`)).toEqual([{ kind: 'package' }]);

    fireEvent.click(screen.getByText('Back to draft'));
    await waitFor(async () => expect(await titles()).toEqual(['Morning Market']));
  });
});
