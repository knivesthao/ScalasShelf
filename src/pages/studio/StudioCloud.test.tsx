import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { testApi } from '../../../api/src/testing';
import { demoDraft } from '@/lib/demoContent';
import { stubBackground, stubCharacter } from '@/lib/stubArt';
import { isGuest, setGuest } from '@/lib/studioStore';

// The Studio with its switched-off features turned on (server storage, art generation,
// review before publishing), against the real API on in-memory SQLite: the browser's fetch('/api/...')
// is routed straight into the Hono app. Keeps that code working for when it comes back.
vi.mock('@/lib/features', () => ({ FEATURES: { rendering: true, cloudStudio: true }, READER_ONLY: false }));
let api: Awaited<ReturnType<typeof testApi>>;
let signedIn = true;
/** When set, the browser's requests come from the demo reviewer instead of the creator. */
let reviewer = false;

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
    const headers = new Headers(init?.headers);
    if (reviewer) headers.set('x-dev-user', 'demo-reviewer');
    return api.app.request(url, { ...(init as RequestInit), headers });
  });
});

afterEach(() => { vi.restoreAllMocks(); setGuest(false); });

const rows = (sql: string) => api.raw.prepare(sql).all() as Record<string, unknown>[];
const libraryTitles = async () => ((await (await api.app.request('/api/books')).json()) as { title: string }[]).map((b) => b.title).sort();

function giveEveryNoySceneArt() {
  const withArt = { assets: { bg1: { url: '/demo-art/bg-school.webp' } }, layers: [{ id: 'l1', asset: 'bg1', role: 'background', x: 0, y: 0, w: 1, z: 0 }] };
  for (const id of ['demo-noy-s1', 'demo-noy-s2', 'demo-noy-s3']) {
    const [scene] = rows(`SELECT data FROM scenes WHERE id = '${id}'`);
    api.raw.prepare(`UPDATE scenes SET data = ? WHERE id = ?`).run(JSON.stringify({ ...JSON.parse(String(scene.data)), ...withArt }), id);
  }
}

vi.mock('@/hooks/useGenerate', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useGenerate')>('@/hooks/useGenerate');
  return {
    ...actual,
    useGenerate: () => ({
      generateArt: vi.fn(async (req: { kind: string; name: string; description: string }) =>
        req.kind === 'place' ? stubBackground(req.description) : stubCharacter(req.name)),
      rerollLayer: vi.fn(),
    }),
  };
});

import { ReviewBook, ReviewQueue, StudioDashboard, StudioEditor } from './index';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/studio" element={<StudioDashboard />} />
        <Route path="/studio/review" element={<ReviewQueue />} />
        <Route path="/studio/review/:id" element={<ReviewBook />} />
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

  it('asks staff to sign in when the API says so', async () => {
    signedIn = false;
    renderAt('/studio');
    expect(await screen.findByText('Staff sign in to write and send books for review.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Staff sign-in' }).getAttribute('href')).toBe('/sign-in?next=%2Fstudio');
  });

  it('lets visitors try the Studio as a guest, on this device only', async () => {
    signedIn = false;
    renderAt('/studio');
    fireEvent.click(await screen.findByRole('button', { name: 'Try the Studio as a guest' }));
    expect(await screen.findByText(/You’re trying the Studio as a guest/)).toBeDefined();
    expect(await screen.findByText('Noy and the Buffalo (my draft)')).toBeDefined();
    expect(isGuest()).toBe(true);
  });

  it('creates a free English comic with a first scene', async () => {
    renderAt('/studio');
    fireEvent.click(await screen.findByText('+ New'));
    fireEvent.change(screen.getByPlaceholderText(/Noy and the Buffalo/), { target: { value: 'Market Day' } });
    fireEvent.change(screen.getByPlaceholderText(/in your own words/), { target: { value: 'Noy sells mangoes at the market.' } });
    fireEvent.click(screen.getByLabelText(/Reading book/));
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => expect(rows(`SELECT title FROM projects WHERE title = 'Market Day'`)).toHaveLength(1));
    const [project] = rows(`SELECT * FROM projects WHERE title = 'Market Day'`);
    expect(project).toMatchObject({
      level: 'A1', purpose: 'reading', description: 'Noy sells mangoes at the market.', status: 'draft', creator_id: 'demo-creator',
    });
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
    fireEvent.click(screen.getByText('Generate scene'));
    expect(await screen.findByLabelText('Edit panel layout')).toBeDefined();
    await waitFor(() => {
      const [scene] = rows(`SELECT data FROM scenes WHERE id = 'demo-noy-s1'`);
      expect(JSON.parse(String(scene.data)).layers).toHaveLength(2); // background + Noy (narration has no character)
    }, { timeout: 2000 });
  });

  it('has no Words tab: it’s a reading book, not a dictionary', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Details', 'Cast', 'Script', 'Panel', 'Audio', 'Quiz', 'Publish']);
  });

  it('enables Generate scene only when every line is filled in', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    const button = () => screen.getByText('Generate scene') as HTMLButtonElement;
    expect(button().disabled).toBe(false);

    fireEvent.click(screen.getByText('+ Add line'));
    expect(button().disabled).toBe(true); // the new line is empty

    fireEvent.change(screen.getByLabelText('Line 3 text'), { target: { value: 'Let’s go!' } });
    expect(button().disabled).toBe(false);

    fireEvent.click(screen.getByText('+ Add line'));
    expect(button().disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Delete line 4'));
    expect(button().disabled).toBe(false);

    // A spoken line needs someone to say it.
    fireEvent.change(screen.getByLabelText('Line 3 type'), { target: { value: 'narration' } });
    fireEvent.change(screen.getByLabelText('Line 3 type'), { target: { value: 'speech' } });
    expect(button().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Line 3 speaker'), { target: { value: screen.getAllByRole('option', { name: 'Noy' })[0].getAttribute('value') } });
    expect(button().disabled).toBe(false);
  });

  it('saves text on screen separately from the scene description', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.change(screen.getByLabelText('Text on screen (optional)'), { target: { value: 'Later that day…' } });
    await waitFor(() => {
      const [scene] = rows(`SELECT data FROM scenes WHERE id = 'demo-noy-s1'`);
      const data = JSON.parse(String(scene.data));
      expect(data.caption).toBe('Later that day…');
      expect(data.description).not.toContain('Later that day');
    }, { timeout: 2000 });
  });

  it('adds and deletes scenes', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.click(screen.getByLabelText('Add scene'));
    expect(await screen.findByText('Scene 4')).toBeDefined();
    fireEvent.click(screen.getByText('Delete scene'));
    await waitFor(() => expect(rows(`SELECT id FROM scenes WHERE project_id = 'demo-noy'`)).toHaveLength(3));
  });

  it('blocks sending for review until every scene has art', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.click(screen.getByRole('tab', { name: 'Publish' }));
    expect(screen.getAllByText(/No art yet/)).toHaveLength(3);
    expect((screen.getByText('Send for review') as HTMLButtonElement).disabled).toBe(true);
  });

  it('sends a finished episode for review; nothing reaches the library yet', async () => {
    giveEveryNoySceneArt();
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.click(screen.getByRole('tab', { name: 'Publish' }));
    fireEvent.click(screen.getByText('Send for review'));

    expect(await screen.findByText(/Waiting for review/)).toBeDefined();
    expect(await libraryTitles()).toEqual(['Morning Market']);
    expect(rows(`SELECT review_status FROM projects WHERE id = 'demo-noy'`)).toEqual([{ review_status: 'in_review' }]);
  });

  it('shows the reviewer’s note when changes are requested', async () => {
    api.raw.prepare(`UPDATE projects SET review_status = 'changes_requested', review_note = 'Scene 2 needs a clearer picture.' WHERE id = 'demo-noy'`).run();
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.click(screen.getByRole('tab', { name: 'Publish' }));
    expect(screen.getByText('Scene 2 needs a clearer picture.')).toBeDefined();
    expect(screen.getByText('Send for review again')).toBeDefined();
  });
});

describe('Cast', () => {
  const cast = () => JSON.parse(String(rows(`SELECT cast_json FROM projects WHERE id = 'demo-noy'`)[0].cast_json));

  it('turns an older draft’s scene descriptions and speakers into characters and places', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    await waitFor(() => expect(cast().characters.map((c: { name: string }) => c.name)).toContain('Noy'), { timeout: 2000 });
    expect(cast().places.length).toBeGreaterThan(0);
    const [scene] = rows(`SELECT data FROM scenes WHERE id = 'demo-noy-s1'`);
    expect(JSON.parse(String(scene.data)).placeId).toBe(cast().places[0].id);
  });

  it('creates and draws a character in the Cast tab', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.click(screen.getByRole('tab', { name: 'Cast' }));
    fireEvent.click(screen.getByText('+ New character'));

    const dialog = screen.getByRole('dialog', { name: 'New character' });
    expect((screen.getByText('Generate character') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grandma Kham' } });
    fireEvent.change(screen.getByLabelText('What do they look like?'), { target: { value: 'An old woman with grey hair and a red scarf.' } });
    fireEvent.click(screen.getByText('Generate character'));
    expect(await screen.findByAltText('Picture of Grandma Kham')).toBeDefined();
    fireEvent.click(screen.getByText('Add character'));

    expect(dialog.isConnected).toBe(false);
    expect(screen.getByRole('button', { name: 'Edit Grandma Kham' })).toBeDefined();
    await waitFor(() => {
      const grandma = cast().characters.find((c: { name: string }) => c.name === 'Grandma Kham');
      expect(grandma).toMatchObject({ description: 'An old woman with grey hair and a red scarf.' });
      expect(grandma.asset.url).toMatch(/^data:image/);
    }, { timeout: 2000 });
  });

  it('lets the Script tab pick only from the cast, with “+ New character…” opening the popup', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    const speaker = screen.getByLabelText('Line 2 speaker') as HTMLSelectElement;
    expect(speaker.tagName).toBe('SELECT');

    fireEvent.change(speaker, { target: { value: '__new__' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Somchai' } });
    fireEvent.click(screen.getByText('Add character'));

    await waitFor(() => expect((screen.getByLabelText('Line 2 speaker') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Somchai'));
    await waitFor(() => {
      const [scene] = rows(`SELECT data FROM scenes WHERE id = 'demo-noy-s1'`);
      expect(JSON.parse(String(scene.data)).bubbles[1].speaker).toBe('Somchai');
    }, { timeout: 2000 });
  });

  it('creates a place from the scene’s place list', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.change(screen.getByLabelText('Where does this scene happen?'), { target: { value: '__new__' } });
    expect(screen.getByRole('dialog', { name: 'New place' })).toBeDefined();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'The river' } });
    fireEvent.change(screen.getByLabelText('What does it look like?'), { target: { value: 'A wide brown river with boats.' } });
    fireEvent.click(screen.getByText('Add place'));
    await waitFor(() => expect((screen.getByLabelText('Where does this scene happen?') as HTMLSelectElement).selectedOptions[0].textContent).toBe('The river'));
    expect(screen.getByText('A wide brown river with boats.')).toBeDefined();
  });

  it('won’t delete a character that scenes still use', async () => {
    renderAt('/studio/comic/demo-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.click(screen.getByRole('tab', { name: 'Cast' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Noy' }));
    expect(screen.getByText(/Used in scene 1.*Change those first/)).toBeDefined();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('opens a brand-new episode on the Cast tab', async () => {
    renderAt('/studio');
    fireEvent.click(await screen.findByText('+ New'));
    fireEvent.change(screen.getByPlaceholderText(/Noy and the Buffalo/), { target: { value: 'River Day' } });
    fireEvent.click(screen.getByText('Create'));
    expect(await screen.findByText(/Make your characters and places first/)).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Cast' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('Review', () => {
  beforeEach(() => { reviewer = true; });
  afterEach(() => { reviewer = false; });

  async function submitNoy() {
    giveEveryNoySceneArt();
    const { buildPackage } = await import('@/lib/format');
    const { project, scenes } = (await (await api.app.request('/api/studio/projects/demo-noy')).json()) as {
      project: { title: string; level: 'A1'; quiz: [] }; scenes: { data: import('@/lib/format').SceneDraft }[];
    };
    const pkg = buildPackage({ id: 'demo-noy', title: project.title, level: project.level }, scenes.map((s) => s.data), project.quiz);
    const res = await api.app.request('/api/studio/projects/demo-noy/submit', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pkg),
    });
    expect(res.status).toBe(200);
  }

  it('lets a reviewer read the book as children will, then approve it into the library', async () => {
    await submitNoy();
    renderAt('/studio/review');
    fireEvent.click(await screen.findByText('Noy and the Buffalo'));
    expect(await screen.findByLabelText('Book preview')).toBeDefined();
    expect(screen.getByText('The End')).toBeDefined();

    fireEvent.click(screen.getByText('Approve and publish'));
    expect(await screen.findByText('Nothing waiting for review.')).toBeDefined();
    expect(await libraryTitles()).toEqual(['Morning Market', 'Noy and the Buffalo']);
    expect(rows(`SELECT reviewed_by FROM projects WHERE id = 'demo-noy'`)).toEqual([{ reviewed_by: 'demo-reviewer' }]);
  });

  it('sends a book back with a note', async () => {
    await submitNoy();
    renderAt('/studio/review/demo-noy');
    const send = await screen.findByText('Send back with note');
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/what should the writer change/), { target: { value: 'Fix the quiz.' } });
    fireEvent.click(send);
    expect(await screen.findByText('Nothing waiting for review.')).toBeDefined();
    expect(rows(`SELECT review_status, review_note FROM projects WHERE id = 'demo-noy'`))
      .toEqual([{ review_status: 'changes_requested', review_note: 'Fix the quiz.' }]);
    expect(await libraryTitles()).toEqual(['Morning Market']);
  });
});
