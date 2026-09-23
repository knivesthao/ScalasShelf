import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

type MockFn = ReturnType<typeof vi.fn>;

const bookRows = [
  { id: '1', title: 'The Brave Buffalo', creator_name: 'Somsack', language: 'lao', reading_level: 'beginner', cover_image_url: '/mock/cover-placeholder.svg', price_kip: 5000 },
  { id: '2', title: 'Market Day', creator_name: 'Noy', language: 'english', reading_level: 'intermediate', cover_image_url: '/mock/cover-placeholder.svg', price_kip: 8000 },
];

let mockPurchaseData: Record<string, unknown>[] = [{ content_id: '1' }, { content_id: '2' }];

function makeBuilder(): Record<string, MockFn> {
  let count = 0;
  const b: Record<string, MockFn> = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.in = vi.fn(() => b);
  b.then = vi.fn((resolve: (v: Record<string, unknown>) => void) => {
    count++;
    if (count === 1) return Promise.resolve(resolve({ data: mockPurchaseData, error: null }));
    return Promise.resolve(resolve({ data: bookRows, error: null }));
  });
  return b;
}

let builder: ReturnType<typeof makeBuilder>;

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(() => builder) },
}));

vi.mock('@/lib/idb', () => ({
  storeScene: vi.fn(), getScene: vi.fn(), isSceneDownloaded: vi.fn(),
  getDownloadedScenes: vi.fn().mockResolvedValue([1, 2, 3]),
  removeContent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1' }, loading: false, signIn: vi.fn(), signOut: vi.fn() })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { MyLibrary } from './MyLibrary';

describe('MyLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPurchaseData = [{ content_id: '1' }, { content_id: '2' }];
    builder = makeBuilder();
  });

  function renderLibrary() {
    return render(<MemoryRouter><MyLibrary /></MemoryRouter>);
  }

  it('shows header', async () => {
    renderLibrary();
    await waitFor(() => { expect(screen.getByText('My Library')).toBeDefined(); });
  });

  it('shows link back to Browse Library', async () => {
    renderLibrary();
    await waitFor(() => { expect(screen.getByText('← Browse Library')).toBeDefined(); });
  });

  it('shows purchased book titles', async () => {
    renderLibrary();
    await waitFor(() => { expect(screen.getByText('The Brave Buffalo')).toBeDefined(); });
  });

  it('shows download badges', async () => {
    renderLibrary();
    await waitFor(() => { expect(document.querySelectorAll('.download-badge').length).toBe(2); });
  });

  it('shows empty state when no purchases', async () => {
    mockPurchaseData = [];
    builder = makeBuilder();
    renderLibrary();
    await waitFor(() => { expect(screen.getByText(/Browse books/)).toBeDefined(); });
  });
});
