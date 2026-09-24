import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Quiz } from './Quiz';
import type { QuizItem } from '@/lib/format';

const items: QuizItem[] = [
  { id: 'q1', type: 'meaning', prompt: 'mango', options: ['a sweet yellow fruit', 'a market'], answer: 0 },
  { id: 'q2', type: 'fill-blank', prompt: 'Three mangoes, ____.', options: ['sweet', 'please'], answer: 1 },
];

describe('Quiz', () => {
  it('gives feedback and a final score', () => {
    const onFinish = vi.fn();
    render(<Quiz items={items} onFinish={onFinish} />);
    expect(screen.getByText(/What does/)).toBeDefined();
    fireEvent.click(screen.getByText('a market'));
    expect(screen.getByText('The answer is “a sweet yellow fruit”.')).toBeDefined();
    fireEvent.click(screen.getByText('Next'));

    expect(screen.getByText('Three mangoes, ____.')).toBeDefined();
    fireEvent.click(screen.getByText('please'));
    expect(screen.getByText('✓ Correct!')).toBeDefined();
    fireEvent.click(screen.getByText('See score'));

    expect(screen.getByText('1 / 2')).toBeDefined();
    expect(onFinish).toHaveBeenCalledWith(1, 2);
    fireEvent.click(screen.getByText('Try again'));
    expect(screen.getByText('Question 1 of 2')).toBeDefined();
  });

  it('only counts the first answer', () => {
    render(<Quiz items={items.slice(0, 1)} />);
    fireEvent.click(screen.getByText('a sweet yellow fruit'));
    fireEvent.click(screen.getByText('a sweet yellow fruit'));
    fireEvent.click(screen.getByText('See score'));
    expect(screen.getByText('1 / 1')).toBeDefined();
  });
});
