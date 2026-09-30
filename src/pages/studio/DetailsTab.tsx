import { useEffect, useRef, useState } from 'react';
import { LEVELS, buildVocab, type Level } from '@/lib/format';
import { api } from '@/lib/api';
import { cloudActive } from '@/lib/studioStore';
import { suggestDescription, suggestLevel, storyLines } from '@/lib/suggest';
import type { StudioProject, StudioScene } from './useStudioProject';

// The book's details: title, description, type and level, all editable at any time.
// Scala (our AI) can write the description, and finish the whole book.

interface DetailsTabProps {
  project: StudioProject;
  scenes: StudioScene[];
  onUpdate: (fields: Partial<Pick<StudioProject, 'title' | 'description' | 'level' | 'purpose'>>) => void;
  /** Opens the "let Scala finish the book?" question. */
  onScalaFinish: () => void;
}

const levelLabel = (id: Level) => LEVELS.find((l) => l.id === id)?.label ?? id;

export function DetailsTab({ project, scenes, onUpdate, onScalaFinish }: DetailsTabProps) {
  const drafts = scenes.map((s) => s.draft);
  const learning = project.purpose !== 'reading';
  const allowed = [...drafts.flatMap((d) => d.bubbles.map((b) => b.speaker)), ...buildVocab(drafts).map((v) => v.headword)];
  // The level is checked against the word lists as the story changes (no AI needed).
  const levelSuggestion = learning ? suggestLevel(drafts, allowed) : null;
  const hasStory = storyLines(drafts).length > 0;
  const canUseAi = cloudActive();
  const [writing, setWriting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const autoWrote = useRef(false);
  const latest = useRef(project.description);
  latest.current = project.description;

  /** `auto`: only fill the description if it's still empty when Scala answers. */
  async function writeDescription(auto = false) {
    setWriting(true);
    setAiError(null);
    try {
      const { description } = await suggestDescription(project.id, project.title, project.level, drafts);
      if (!auto || !latest.current.trim()) onUpdate({ description });
    } catch (e) {
      setAiError((e as Error).message || 'Scala couldn’t write a description. Try again.');
    } finally {
      setWriting(false);
    }
  }

  // An empty description gets written once, as soon as there's some story to go on.
  useEffect(() => {
    if (autoWrote.current || !canUseAi || !hasStory || project.description.trim()) return;
    autoWrote.current = true;
    void writeDescription(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseAi, hasStory]);

  return (
    <div className="details-tab">
      <section className="studio-section">
        <h2>Book details</h2>
        <label className="inspector-field">
          Title
          <input value={project.title} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="e.g. Noy and the Buffalo" />
        </label>
        <label className="inspector-field">
          Short description (shown on Scala’s Shelf)
          <textarea
            rows={3}
            value={project.description}
            placeholder={writing ? 'Scala is writing a description…' : 'What’s the story about?'}
            onChange={(e) => onUpdate({ description: e.target.value })}
          />
        </label>
        {canUseAi && (
          <div className="suggest-row">
            <button className="ghost-btn" onClick={() => writeDescription()} disabled={writing || !hasStory}>
              {writing ? 'Writing…' : project.description.trim() ? '✨ Ask Scala for a new one' : '✨ Ask Scala to write it'}
            </button>
            <span className="hint">{hasStory ? 'Scala writes a draft from your story. Edit it as you like.' : 'Write some of the story first.'}</span>
          </div>
        )}
        {aiError && <p className="studio-error" role="alert">{aiError}</p>}
        <label className="inspector-field">
          Type
          <select value={project.purpose} onChange={(e) => onUpdate({ purpose: e.target.value as 'learning' | 'reading' })}>
            <option value="learning">Learning book: teaches English, with a level and a quiz</option>
            <option value="reading">Reading book: just for reading</option>
          </select>
        </label>
        {learning && (
          <label className="inspector-field">
            Level
            <select value={project.level} onChange={(e) => onUpdate({ level: e.target.value as Level })}>
              {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
        )}
        {levelSuggestion && (
          <div className="suggest-row">
            {levelSuggestion === project.level ? (
              <span className="check-ok">✓ The words in your story fit {levelLabel(levelSuggestion)}.</span>
            ) : (
              <>
                <span className="hint">The words in your story fit <strong>{levelLabel(levelSuggestion)}</strong>.</span>
                <button className="ghost-btn" onClick={() => onUpdate({ level: levelSuggestion })}>Use {levelSuggestion}</button>
              </>
            )}
          </div>
        )}
      </section>

      {canUseAi && <TranslationSection projectId={project.id} />}

      {canUseAi && (
        <section className="studio-section scala-finish">
          <h2>Scala Finish</h2>
          <p className="hint">
            Let Scala, our AI, write the rest of the story and give it an ending. Scenes you’ve written stay as they are.
          </p>
          <button className="buy-btn" onClick={onScalaFinish}>✨ Scala Finish</button>
        </section>
      )}
    </div>
  );
}

interface TranslationStatus {
  texts: { text: string; translation: string | null }[];
  done: number;
  waiting: number;
  failed: number;
  queued?: number;
}

/**
 * Lao translation of the book's text. The server queues what isn't translated yet and
 * sends it in batches (api/src/services/translation.ts); sentences translated before, in
 * any book, come straight from the cache. Every translation is a draft a Lao speaker checks.
 */
function TranslationSection({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<TranslationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get<TranslationStatus>(`/studio/projects/${projectId}/translations?target=lo`).then(setStatus).catch(() => {});
  }, [projectId]);

  // While texts are waiting, check back every few seconds (for up to two minutes).
  useEffect(() => {
    if (!status?.waiting) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      api.get<TranslationStatus>(`/studio/projects/${projectId}/translations?target=lo`)
        .then((s) => { setStatus(s); if (!s.waiting || tries > 40) clearInterval(timer); })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [projectId, status?.waiting]);

  async function translate() {
    setBusy(true);
    setError(null);
    try {
      setStatus(await api.post<TranslationStatus>(`/studio/projects/${projectId}/translations`, { source: 'en', target: 'lo' }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const total = status?.texts.length ?? 0;
  return (
    <section className="studio-section">
      <h2>Lao translation</h2>
      <p className="hint">
        Translates the description, text on screen, lines and word meanings into Lao. Sentences already translated in any book are reused for free.
        A Lao speaker should check every translation.
      </p>
      {status && total > 0 && (
        <p className={status.done === total ? 'check-ok' : 'hint'}>
          {status.done === total ? `✓ All ${total} texts are translated.` : `${status.done} of ${total} texts translated`}
          {status.waiting > 0 && ` · ${status.waiting} in the queue`}
          {status.failed > 0 && ` · ${status.failed} failed`}
        </p>
      )}
      {error && <p className="studio-error" role="alert">{error}</p>}
      <div className="suggest-row">
        <button className="ghost-btn" onClick={translate} disabled={busy || (status !== null && total > 0 && status.done === total)}>
          {busy ? 'Adding to the queue…' : 'Translate to Lao'}
        </button>
        {status && status.done > 0 && (
          <button className="link-btn" onClick={() => setOpen((o) => !o)}>{open ? 'Hide translations' : 'Show translations'}</button>
        )}
      </div>
      {open && status && (
        <ul className="translation-list">
          {status.texts.filter((t) => t.translation).map((t) => (
            <li key={t.text}><span>{t.text}</span><span lang="lo">{t.translation}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}
