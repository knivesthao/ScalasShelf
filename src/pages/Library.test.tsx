import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockContent = [
  {
    id: '1',
    title: 'The Brave Buffalo',
    creator_name: 'Somsack',
    language: 'lao',
    reading_level: 'beginner',
    cover_image_url: '/mock/cover-placeholder.svg',
    price_kip: 5000,
    description: 'A story about a brave buffalo.',
  },
  {
    id: '2',
    title: 'Market Day',
    creator_name: 'Noy',
    language: 'english',
    reading_level: 'intermediate',
    cover_image_url: '/mock/cover-placeholder.svg',
    price_kip: 8000,
    description: 'A day at the Luang Prabang market.',
  },
];

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      // Simulate the thenable pattern — resolve with mock data
      then: vi.fn((resolve) => Promise.resolve(resolve({ data: mockContent, error: null }))),
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
    },
  })),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: null, loading: false, signIn: vi.fn(), signOut: vi.fn() })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { Library } from './Library';

describe('Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderLibrary() {
    return render(
      <MemoryRouter>
        <Library />
      </MemoryRouter>
    );
  }

  it('renders the library header', async () => {
    renderLibrary();
    await waitFor(() => {
      expect(screen.getByText('Textweaver')).toBeDefined();
    });
  });

  it('shows loading state initially', () => {
    renderLibrary();
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('displays content cards after loading', async () => {
    renderLibrary();
    await waitFor(() => {
      expect(screen.getByText('The Brave Buffalo')).toBeDefined();
      expect(screen.getByText('Market Day')).toBeDefined();
    });
  });

  it('shows search input and language filter after loading', async () => {
    renderLibrary();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search books...')).toBeDefined();
      expect(screen.getByLabelText('Filter by language')).toBeDefined();
    });
  });
});
