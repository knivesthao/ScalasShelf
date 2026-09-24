import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { clearSavedBooks, stubApi, stubObjectUrls, type TestApi } from '@/__tests__/apiStub';
import { Library } from './Library';
import { BookDetail } from './BookDetail';
import { Reader } from './Reader';
import { MyLibrary } from './MyLibrary';

let api: TestApi;

beforeEach(async () => {
  api = await stubApi();
  stubObjectUrls();
});

afterEach(async () => {
  await clearSavedBooks();
  vi.restoreAllMocks();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/book/:id" element={<BookDetail />} />
        <Route path="/read/:id" element={<Reader />} />
        <Route path="/my-library" element={<MyLibrary />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Library', () => {
  it('lists published books, free, with no account', async () => {
    renderAt('/');
    const cards = await screen.findAllByRole('listitem');
    expect(cards.map((c) => within(c).getByRole('heading').textContent)).toEqual(['Noy and the Buffalo', 'Morning Market']);
    expect(within(cards[1]).getByText('A1')).toBeDefined();
    expect(screen.queryByText(/kip/)).toBeNull();
  });

  it('filters by level and search', async () => {
    renderAt('/');
    await screen.findByText('Morning Market');
    fireEvent.change(screen.getByLabelText('Search books'), { target: { value: 'dragons' } });
    expect(screen.getByText('No books found.')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Search books'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filter by level'), { target: { value: 'B1' } });
    expect(await screen.findByText('No books found.')).toBeDefined();
  });

  it('points to saved books when offline', async () => {
    api.setOnline(false);
    renderAt('/');
    expect(await screen.findByText(/You’re offline/)).toBeDefined();
    expect(screen.getByText('Open My Library')).toBeDefined();
  });
});

describe('Book page', () => {
  it('shows what the story teaches', async () => {
    renderAt('/book/book-demo-market');
    expect(await screen.findByRole('heading', { name: 'Morning Market' })).toBeDefined();
    expect(screen.getByText(/3 scenes · 6 new words · \d-question check/)).toBeDefined();
    expect(screen.getByText('mango')).toBeDefined();
    expect(screen.getByText('Free')).toBeDefined();
  });

  it('downloads for offline, then opens with no connection', async () => {
    renderAt('/book/book-demo-market');
    fireEvent.click(await screen.findByText('Download for offline'));
    expect(await screen.findByText('✓ Saved on this phone')).toBeDefined();

    cleanup();
    api.setOnline(false);
    renderAt('/my-library');
    expect(await screen.findByText('Morning Market')).toBeDefined();
    expect(screen.getByText(/1 book · \d+ KB on this phone/)).toBeDefined();
  });

  it('explains a failed download and keeps the button', async () => {
    renderAt('/book/book-demo-market');
    await screen.findByText('Download for offline');
    api.setOnline(false);
    fireEvent.click(screen.getByText('Download for offline'));
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByText('Download for offline')).toBeDefined();
  });
});

describe('Reader', () => {
  it('shows every panel with its dialogue', async () => {
    renderAt('/read/book-demo-market');
    expect(await screen.findByText('Morning Market')).toBeDefined();
    expect(document.querySelectorAll('.motion-panel')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'mango?' })).toBeDefined();
    expect(document.querySelectorAll('.mp-layer').length).toBeGreaterThan(3);
  });

  it('tapping a word shows its meaning', async () => {
    renderAt('/read/book-demo-market');
    fireEvent.click(await screen.findByRole('button', { name: 'market' }));
    const sheet = screen.getByRole('dialog', { name: 'Word meaning' });
    expect(within(sheet).getByText('a place where people buy and sell food')).toBeDefined();
    expect(within(sheet).getByText('New word')).toBeDefined();
    fireEvent.click(within(sheet).getByText('Close'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ends with the quiz and a score', async () => {
    const { text } = (await (await api.app.request('/api/books/book-demo-market')).json()).package;
    renderAt('/read/book-demo-market');
    expect(await screen.findByText('Check your understanding')).toBeDefined();
    for (let i = 0; i < text.quiz.length; i++) {
      const q = text.quiz[i];
      fireEvent.click(screen.getAllByText(q.options[q.answer]).find((el) => el.classList.contains('quiz-option-btn'))!);
      expect(screen.getByText('✓ Correct!')).toBeDefined();
      fireEvent.click(screen.getByText(i + 1 < text.quiz.length ? 'Next' : 'See score'));
    }
    expect(screen.getByText(`${text.quiz.length} / ${text.quiz.length}`)).toBeDefined();
  });

  it('reads a saved book with no connection, using local images', async () => {
    renderAt('/book/book-demo-market');
    fireEvent.click(await screen.findByText('Download for offline'));
    await screen.findByText('✓ Saved on this phone');

    cleanup();
    api.setOnline(false);
    renderAt('/read/book-demo-market');
    await waitFor(() => expect(document.querySelectorAll('.reader .mp-layer').length).toBeGreaterThan(3));
    const srcs = [...document.querySelectorAll('.reader .mp-layer')].map((img) => img.getAttribute('src'));
    expect(srcs.every((s) => s?.startsWith('blob:'))).toBe(true);
  });

  it('explains when a book is not saved and there is no connection', async () => {
    api.setOnline(false);
    renderAt('/read/book-demo-market');
    expect(await screen.findByText(/isn’t on your phone/)).toBeDefined();
  });
});

describe('My Library', () => {
  it('starts empty and explains what it is for', async () => {
    renderAt('/my-library');
    expect(await screen.findByText(/Books you download appear here/)).toBeDefined();
  });

  it('removes a saved book', async () => {
    renderAt('/book/book-demo-market');
    fireEvent.click(await screen.findByText('Download for offline'));
    await screen.findByText('✓ Saved on this phone');
    cleanup();
    renderAt('/my-library');
    fireEvent.click(await screen.findByLabelText('Remove Morning Market'));
    expect(await screen.findByText(/Books you download appear here/)).toBeDefined();
  });
});
