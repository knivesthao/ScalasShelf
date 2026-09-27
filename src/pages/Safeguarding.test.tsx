import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Safeguarding, POLICY_URL } from './Safeguarding';

afterEach(cleanup);

describe('Safeguarding page', () => {
  it('states the child-safety commitments and links to the full ADMAIS policy', () => {
    render(
      <MemoryRouter initialEntries={['/about/safeguarding']}>
        <Routes>
          <Route path="/about/safeguarding" element={<Safeguarding />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Child safeguarding' })).toBeTruthy();
    expect(screen.getByText(/No child accounts/)).toBeTruthy();
    expect(screen.getByText(/safeguarding@admais.xyz/)).toBeTruthy();
    const links = screen.getAllByRole('link', { name: /policy/i });
    expect(links.every((a) => a.getAttribute('href') === POLICY_URL)).toBe(true);
  });
});
