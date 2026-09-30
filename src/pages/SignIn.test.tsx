import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { testApi } from '../../api/src/testing';
import { SignIn } from './SignIn';

// Staff sign-in against the real API (session auth, in-memory SQLite). The browser's
// fetch is routed into the Hono app, with a one-cookie jar standing in for the browser's.

let api: Awaited<ReturnType<typeof testApi>>;
let cookie = '';

beforeEach(async () => {
  api = await testApi({ auth: 'session' });
  cookie = '';
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const headers = new Headers(init?.headers);
    if (cookie) headers.set('cookie', cookie);
    const res = await api.app.request(String(input), { ...(init as RequestInit), headers });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return res;
  });
});

afterEach(() => vi.restoreAllMocks());

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/studio/*" element={<p>Studio home</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SignIn', () => {
  it('emails a link, and the link signs the writer in', async () => {
    const view = renderAt('/sign-in');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'Writer@Example.org ' } });
    fireEvent.click(screen.getByText('Email me a sign-in link'));
    expect(await screen.findByText('Check your email')).toBeDefined();
    expect(api.sent.map((m) => m.to)).toEqual(['writer@example.org']);

    const link = new URL(api.sent[0].text.match(/https?:\/\/\S+/)![0]);
    view.unmount();
    renderAt(`/sign-in${link.search}`);
    expect(await screen.findByText('Studio home')).toBeDefined();
    expect(cookie).toMatch(/^tw_session=/);
    const me = await (await fetch('/api/auth/me')).json();
    expect(me.user).toMatchObject({ email: 'writer@example.org', role: 'creator' });
  });

  it('explains when an email isn’t on the staff list', async () => {
    renderAt('/sign-in');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'stranger@example.org' } });
    fireEvent.click(screen.getByText('Email me a sign-in link'));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/isn’t on the Scala’s Shelf staff list/));
    expect(api.sent).toHaveLength(0);
  });

  it('refuses a used or made-up link', async () => {
    renderAt('/sign-in?token=not-a-real-token');
    expect(await screen.findByText(/expired or was already used/)).toBeDefined();
    expect(cookie).toBe('');
  });
});
