import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MotionPanel, type PanelBubble, type PanelLayer } from './MotionPanel';

const assets = { bg1: { url: 'bg.webp' }, ch1: { url: 'noy.webp' } };
const layers: PanelLayer[] = [
  { id: 'l2', asset: 'ch1', role: 'character', x: 0.3, y: 0.5, w: 0.4, z: 1, motion: { preset: 'idle' } },
  { id: 'l1', asset: 'bg1', role: 'background', x: 0, y: 0, w: 1, z: 0, motion: { preset: 'kenburns' } },
];
const bubbles: PanelBubble[] = [
  {
    id: 'b1', speaker: 'Noy', style: 'speech', x: 0.1, y: 0.1, w: 0.5,
    text: { en: "We're late!" },
    tokens: { en: [{ t: "We're " }, { t: 'late!', gloss: 'not on time', v: 'late' }] },
  },
];

describe('MotionPanel', () => {
  it('draws layers back to front and positions them as fractions of the panel', () => {
    const { container } = render(<MotionPanel aspect="9:16" layers={layers} bubbles={[]} assets={assets} />);
    const imgs = container.querySelectorAll('img');
    expect([...imgs].map((i) => i.getAttribute('src'))).toEqual(['bg.webp', 'noy.webp']);
    expect((imgs[1] as HTMLElement).style.left).toBe('30%');
    expect((imgs[1] as HTMLElement).style.width).toBe('40%');
  });

  it('keeps dialogue as real text, marked as English', () => {
    render(<MotionPanel aspect="9:16" layers={[]} bubbles={bubbles} assets={assets} />);
    const bubble = screen.getByText("We're late!");
    expect(bubble.closest('[lang]')?.getAttribute('lang')).toBe('en');
  });

  it('makes words tappable when a tap handler is given', () => {
    const onWordTap = vi.fn();
    render(<MotionPanel aspect="9:16" layers={[]} bubbles={bubbles} assets={assets} onWordTap={onWordTap} />);
    fireEvent.click(screen.getByRole('button', { name: 'late!' }));
    expect(onWordTap).toHaveBeenCalledWith('b1', 1);
  });

  it('selects elements in edit mode, but not otherwise', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <MotionPanel aspect="9:16" layers={layers} bubbles={bubbles} assets={assets} onSelect={onSelect} />
    );
    fireEvent.pointerDown(screen.getByText("We're late!"));
    expect(onSelect).not.toHaveBeenCalled();

    rerender(<MotionPanel aspect="9:16" layers={layers} bubbles={bubbles} assets={assets} onSelect={onSelect} editable />);
    fireEvent.pointerDown(screen.getByText("We're late!"));
    expect(onSelect).toHaveBeenCalledWith('b1');
  });
});
