import { useEffect, useState } from 'react';
import { LEVELS, type Level } from '@/lib/format';
import { suggestFromIdea } from '@/lib/suggest';
import type { NewProject, Purpose } from '@/lib/studioStore';

// The "+ New" popup. The writer names the book and describes the story in their own
// words; AI tidies the description, and for learning books picks the level. AI needs a
// staff sign-in (it runs on the server), so guests write the description themselves.

interface NewBookDialogProps {
  canUseAi: boolean;
  onCreate: (input: NewProject) => Promise<void>;
  onClose: () => void;
}

const TYPES: { id: Purpose; label: string; hint: string }[] = [
  { id: 'learning', label: 'Learning book', hint: 'Teaches English. Scala picks the level, and you add new words and a quiz.' },
  { id: 'reading', label: 'Reading book', hint: 'Just for reading and enjoying. No level or quiz.' },
];

const levelLabel = (id: Level) => LEVELS.find((l) => l.id === id)?.label ?? id;

export function NewBookDialog({ canUseAi, onCreate, onClose }: NewBookDialogProps) {
  const [title, setTitle] = useState('');
  const [idea, setIdea] = useState('');
  const [purpose, setPurpose] = useState<Purpose>('learning');
  const [level, setLevel] = useState<Level | null>(null);
  /** The writer's words before AI tidied them, for Undo. */
  const [original, setOriginal] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !creating && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [creating, onClose]);

  // A level picked for one description doesn't hold once the writer changes it or the type.
  function changeIdea(value: string) {
    setIdea(value);
    setOriginal(null);
    setLevel(null);
  }

  async function fixUp() {
    setFixing(true);
    setError(null);
    try {
      const s = await suggestFromIdea(title.trim(), idea, purpose);
      setOriginal(idea);
      setIdea(s.description);
      setLevel(s.level);
    } catch (e) {
      setError((e as Error).message || 'Scala couldn’t help this time. Try again.');
    } finally {
      setFixing(false);
    }
  }

  function undo() {
    if (original === null) return;
    setIdea(original);
    setOriginal(null);
    setLevel(null);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      let chosen: Level = level ?? 'A1';
      // Learning book the writer didn't run through AI: still let AI pick the level.
      if (purpose === 'learning' && !level && canUseAi && idea.trim()) {
        chosen = (await suggestFromIdea(title.trim(), idea, purpose).catch(() => null))?.level ?? 'A1';
      }
      await onCreate({ title: title.trim(), description: idea.trim(), purpose, level: chosen });
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }

  return (
    <div className="cast-dialog-backdrop" onClick={() => !creating && onClose()}>
      <form
        className="cast-dialog new-book-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="New book"
        onSubmit={create}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>New book</h2>

        <label className="inspector-field">
          Title
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Noy and the Buffalo" />
        </label>

        <label className="inspector-field">
          What’s your story about?
          <textarea
            rows={4}
            value={idea}
            onChange={(e) => changeIdea(e.target.value)}
            placeholder="Tell us in your own words: who it’s about, what happens, who will read it."
          />
        </label>
        {canUseAi ? (
          <div className="suggest-row">
            <button type="button" className="ghost-btn" onClick={fixUp} disabled={fixing || !idea.trim()}>
              {fixing ? 'Fixing up…' : '✨ Fix up with Scala'}
            </button>
            {original !== null && <button type="button" className="link-btn" onClick={undo}>Undo</button>}
            <span className="hint">Scala, our AI, turns this into the book’s description. Edit it as you like.</span>
          </div>
        ) : (
          <p className="hint">Staff who sign in can have Scala, our AI, fix up the description.</p>
        )}

        <fieldset className="type-choice">
          <legend>Type</legend>
          {TYPES.map((t) => (
            <label key={t.id} className={`type-option${purpose === t.id ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="purpose"
                value={t.id}
                checked={purpose === t.id}
                onChange={() => { setPurpose(t.id); setLevel(null); }}
              />
              <span>
                <strong>{t.label}</strong>
                <span className="hint">{t.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {purpose === 'learning' && (
          <p className="hint">
            {level
              ? <>Level: <strong>{levelLabel(level)}</strong>, picked by Scala. You can change it later on the Details tab.</>
              : canUseAi
                ? 'Scala picks the level from your description when you create the book.'
                : 'The level starts at A1 · Beginner. The Details tab suggests one from your story’s words.'}
          </p>
        )}

        {error && <p className="studio-error" role="alert">{error}</p>}

        <div className="new-project-actions">
          <button type="submit" className="buy-btn" disabled={!title.trim() || creating || fixing}>
            {creating ? 'Creating…' : 'Create'}
          </button>
          <button type="button" className="ghost-btn" onClick={onClose} disabled={creating}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
