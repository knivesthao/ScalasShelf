import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StudioDashboard, StudioEditor } from './index';
import { deviceStore } from '@/lib/studioStore';

// The Studio with the cloud Studio switched off: writing only, saved on this device,
// never touching the server.
vi.mock('@/lib/features', () => ({ FEATURES: { rendering: false, cloudStudio: false }, READER_ONLY: false }));

async function clearDevice() {
  const db = await new Promise<IDBDatabase>((resolve) => {
    const req = indexedDB.open('textweaver-studio', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('projects', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
  });
  await new Promise((resolve) => {
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').clear();
    tx.oncomplete = resolve;
  });
  db.close();
}

let fetchSpy: MockInstance<typeof fetch>;

beforeEach(async () => {
  await clearDevice();
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled(); // nothing reaches the server
  vi.restoreAllMocks();
});

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

describe('Studio (writing only, on this device)', () => {
  it('starts with a demo draft and says what’s coming', async () => {
    renderAt('/studio');
    expect(await screen.findByText('Noy and the Buffalo (my draft)')).toBeDefined();
    expect(screen.getByText(/Drafts are saved on this device\. Illustrations and publishing are coming soon\./)).toBeDefined();
  });

  it('creates a comic on the device', async () => {
    renderAt('/studio');
    fireEvent.click(await screen.findByText('+ New Comic'));
    fireEvent.change(screen.getByPlaceholderText(/Noy and the Buffalo/), { target: { value: 'Market Day' } });
    fireEvent.click(screen.getByText('Create'));
    await waitFor(async () => expect((await deviceStore.list()).map((p) => p.title)).toContain('Market Day'));
  });

  it('has no panel or audio tools, and says illustrations aren’t on yet', async () => {
    await deviceStoreReady();
    renderAt('/studio/comic/draft-noy');
    expect(await screen.findByDisplayValue(FIRST_LINE)).toBeDefined();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Cast', 'Script', 'Quiz', 'Publish']);
    fireEvent.click(screen.getByText('Generate scene'));
    expect(screen.getByText(/Illustrations aren’t switched on yet/)).toBeDefined();
  });

  it('autosaves writing to the device', async () => {
    await deviceStoreReady();
    renderAt('/studio/comic/draft-noy');
    fireEvent.change(await screen.findByDisplayValue(FIRST_LINE), { target: { value: 'It is early.' } });
    await waitFor(async () => {
      const { scenes } = await deviceStore.get('draft-noy');
      expect(scenes[0].data.bubbles[0].text.en).toBe('It is early.');
    }, { timeout: 2000 });

    cleanup();
    renderAt('/studio/comic/draft-noy');
    expect(await screen.findByDisplayValue('It is early.')).toBeDefined();
  });

  it('checks the book without art or audio, but doesn’t publish yet', async () => {
    await deviceStoreReady();
    renderAt('/studio/comic/draft-noy');
    await screen.findByDisplayValue(FIRST_LINE);
    fireEvent.click(screen.getByRole('tab', { name: 'Publish' }));
    expect(screen.queryByText(/No art yet/)).toBeNull();
    expect(screen.queryByText(/has no audio/)).toBeNull();
    expect(screen.queryByText(/vocab/)).toBeNull();
    expect(screen.getByText(/Sign in to send books for review\. Your draft is saved on this device\./)).toBeDefined();
    expect(screen.queryByText('Send for review')).toBeNull();
  });
});

/** The demo draft is created on first list(); opening the editor directly needs it too. */
async function deviceStoreReady() {
  await deviceStore.list();
}
