import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockBook = {
  id: '1',
  title: 'The Brave Buffalo',
  creator_name: 'Somsack',
  cover_image_url: '/mock/cover-placeholder.svg',
  price_kip: 5000,
};

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      then: vi.fn((resolve) =>
        Promise.resolve(resolve({ data: mockBook, error: null }))
      ),
    }),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
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

import { Purchase } from './Purchase';

describe('Purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderPurchase(id: string = '1') {
    return render(
      <MemoryRouter initialEntries={[`/purchase/${id}`]}>
        <Routes>
          <Route path="/purchase/:id" element={<Purchase />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('renders book title after loading', async () => {
    renderPurchase();
    await waitFor(() => {
      expect(screen.getByText('The Brave Buffalo')).toBeDefined();
    });
  });

  it('shows price in kip', async () => {
    renderPurchase();
    await waitFor(() => {
      expect(screen.getByText('5,000 kip')).toBeDefined();
    });
  });

  it('shows QR code image', async () => {
    renderPurchase();
    await waitFor(() => {
      expect(screen.getByAltText('QR Code for payment')).toBeDefined();
    });
  });

  it('shows WhatsApp number in instructions', async () => {
    renderPurchase();
    await waitFor(() => {
      expect(screen.getByText(/\+8562055550000/)).toBeDefined();
    });
  });

  it('shows instructions in Lao', async () => {
    renderPurchase();
    await waitFor(() => {
      expect(
        screen.getByText(/ສົ່ງຫຼັກຖານການໂອນເງິນ/)
      ).toBeDefined();
    });
  });

  it('submits payment on button click in dev mode', async () => {
    renderPurchase();

    await waitFor(() => {
      expect(screen.getByText("I've Paid")).toBeDefined();
    });

    fireEvent.click(screen.getByText("I've Paid"));

    await waitFor(() => {
      expect(screen.getByText('Payment Submitted')).toBeDefined();
    });
  });
});
