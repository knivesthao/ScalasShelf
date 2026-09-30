import { useEffect, useRef, type ReactNode } from 'react';

// A short message at the bottom of the screen that goes away by itself (or on tap).

export function Toast({ children, onDone, ms = 10_000 }: { children: ReactNode; onDone: () => void; ms?: number }) {
  // Keep the latest callback without restarting the timer when the page re-renders.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const timer = setTimeout(() => done.current(), ms);
    return () => clearTimeout(timer);
  }, [ms]);

  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{children}</span>
      <button className="toast-close" onClick={onDone} aria-label="Dismiss">×</button>
    </div>
  );
}
