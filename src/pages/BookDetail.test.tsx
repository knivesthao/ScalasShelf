import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockBook = {
  id: '1',
  title: 'The Brave Buffalo',
  creator_name: 'Somsack',
  language: 'lao',
  reading_level: 'beginner',
  cover_image_url: '/mock/cover-placeholder.svg',
  price_kip: 5000,
  description: 'A story about a brave buffalo.',
};

// Mutable values so individual tests can override data/error per scenario
let contentData: typeof mockBook | null = mockBook;
let contentError: { message: string } | null = null;
let purchaseError: { message: string } | null = null;

// Separate builders per table so content fetch and purchase insert resolve independently
const contentBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  then: vi.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolve({ data: contentData, error: contentError })),
  ),
};

const purchaseBuilder = {
  insert: vi.fn().mockReturnThis(),
  then: vi.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolve({ data: null, error: purchaseError })),
  ),
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'content') return contentBuilder;
      if (table === 'purchases') return purchaseBuilder;
      return { then: vi.fn() };
    }),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-1', phone: '+8562055550000' },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { BookDetail } from './BookDetail';
import { useAuth } from '@/hooks/useAuth';

describe('BookDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default happy-path values
    contentData = mockBook;
    contentError = null;
    purchaseError = null;
    // Reset useAuth to logged-in user
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', phone: '+8562055550000' } as any,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
  });

  function renderBookDetail(id: string = '1') {
    return render(
      <MemoryRouter initialEntries={[`/book/${id}`]}>
        <Routes>
          <Route path="/book/:id" element={<BookDetail />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('shows loading state initially', () => {
    renderBookDetail();
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('shows book title, creator, description, and price after loading', async () => {
    renderBookDetail();

    await waitFor(() => {
      expect(screen.getByText('The Brave Buffalo')).toBeDefined();
    });

    expect(screen.getByText('by Somsack')).toBeDefined();
    expect(screen.getByText('A story about a brave buffalo.')).toBeDefined();
    expect(screen.getByText('5,000 kip')).toBeDefined();
  });

  it('shows language and reading level badges', async () => {
    renderBookDetail();

    await waitFor(() => {
      expect(screen.getByText('lao')).toBeDefined();
      expect(screen.getByText('beginner')).toBeDefined();
    });
  });

  it('shows "Book not found" when supabase returns null', async () => {
    contentData = null;

    renderBookDetail();

    await waitFor(() => {
      expect(screen.getByText('Book not found.')).toBeDefined();
    });
  });

  it('renders a buy button that is not disabled', async () => {
    renderBookDetail();

    await waitFor(() => {
      expect(screen.getByText('Buy')).toBeDefined();
    });

    const buyBtn = screen.getByText('Buy') as HTMLButtonElement;
    expect(buyBtn.disabled).toBe(false);
  });

  it('shows error message when purchase fails', async () => {
    purchaseError = { message: 'Database error' };

    renderBookDetail();

    await waitFor(() => {
      expect(screen.getByText('Buy')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Buy'));

    await waitFor(() => {
      expect(screen.getByText('Purchase failed. Please try again.')).toBeDefined();
    });
  });

  it('shows "Please log in" message when user is null and Buy is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    renderBookDetail();

    await waitFor(() => {
      expect(screen.getByText('Buy')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Buy'));

    await waitFor(() => {
      expect(screen.getByText('Please log in to purchase books.')).toBeDefined();
    });
  });

  it('shows "Processing..." text on the buy button while purchasing', async () => {
    // Make the insert never resolve so we stay in purchasing state
    purchaseBuilder.then.mockImplementationOnce(
      () => new Promise(() => {}), // never resolves
    );

    renderBookDetail();

    await waitFor(() => {
      expect(screen.getByText('Buy')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Buy'));

    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeDefined();
    });
  });

  it('renders a back button', async () => {
    renderBookDetail();

    await waitFor(() => {
      expect(screen.getByText('← Back')).toBeDefined();
    });
  });
});
