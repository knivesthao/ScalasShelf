import { useEffect, useState } from 'react';

// An in-page "are you sure?" popup (we never use the browser's confirm()).

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  /** Red confirm button, for things that can't be undone. */
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="cast-dialog-backdrop" onClick={() => !busy && onClose()}>
      <div className="cast-dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{message}</p>
        {error && <p className="studio-error" role="alert">{error}</p>}
        <div className="new-project-actions">
          <button className={danger ? 'buy-btn danger-btn' : 'buy-btn'} onClick={confirm} disabled={busy} autoFocus>
            {busy ? 'Working…' : confirmLabel}
          </button>
          <button className="ghost-btn" onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
