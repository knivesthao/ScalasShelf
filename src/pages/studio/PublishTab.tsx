import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { allClear, bookChecks, type Check } from '@/lib/checklist';
import { cloudActive } from '@/lib/studioStore';
import type { StudioProject, StudioScene } from './useStudioProject';

// Publish: one Review button. It checks the book (on the server, with the spell checker)
// and shows each check turning green or red, one after another. Anything red says what
// to fix. When everything is green, the button becomes "Send for publish", and a
// moderator approves the book for Scala’s Shelf.

interface PublishTabProps {
  project: StudioProject;
  scenes: StudioScene[];
  onSubmit: () => Promise<void>;
  onUnpublish: () => Promise<void>;
  onJumpToScene: (index: number) => void;
  /** Saves pending edits, so the server checks what's on screen. */
  onSave: () => Promise<void>;
}

/** How long each check takes to "tick" in the animation. */
const STEP_MS = 450;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What the checks were run on: any edit after that means reviewing again. */
const snapshot = (project: StudioProject, scenes: StudioScene[]) =>
  JSON.stringify([project.title, project.description, project.level, project.purpose, project.quiz, project.cast, scenes.map((s) => s.draft)]);

export function PublishTab({ project, scenes, onSubmit, onUnpublish, onJumpToScene, onSave }: PublishTabProps) {
  const [checks, setChecks] = useState<Check[] | null>(null);
  /** How many checks have finished animating. */
  const [shown, setShown] = useState(0);
  const [running, setRunning] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);

  const cloud = cloudActive();
  const current = snapshot(project, scenes);
  const stale = checkedAt !== null && checkedAt !== current;
  const done = checks !== null && !running;
  const clear = done && !stale && allClear(checks);

  async function review() {
    setError(null);
    setRunning(true);
    // Show the list straight away (spinners), then tick each one off as the answer arrives.
    const drafts = scenes.map((s) => s.draft);
    const skeleton = bookChecks(project, drafts);
    skeleton.splice(skeleton.findIndex((c) => c.id === 'art') + 1, 0, { id: 'spelling', label: 'Spelling', status: 'skipped', problems: [] });
    setChecks(skeleton);
    setShown(0);
    try {
      let result: Check[];
      if (cloud) {
        await onSave();
        [result] = await Promise.all([
          api.post<{ checks: Check[] }>(`/studio/projects/${project.id}/check`).then((r) => r.checks),
          wait(STEP_MS),
        ]);
      } else {
        // Guests: the same checks on this device; the spell checker needs a sign-in.
        await wait(STEP_MS);
        result = skeleton.map((c) => (c.id === 'spelling' ? { ...c, note: 'Sign in to check spelling.' } : c));
      }
      setChecks(result);
      for (let i = 1; i <= result.length; i++) {
        if (cancelled.current) return;
        setShown(i);
        await wait(STEP_MS);
      }
      setCheckedAt(snapshot(project, scenes));
    } catch (e) {
      setError((e as Error).message);
      setChecks(null);
    } finally {
      setRunning(false);
    }
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      await onSubmit();
      setChecks(null);
      setCheckedAt(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const failed = checks?.filter((c) => c.status === 'fail').length ?? 0;

  return (
    <div className="publish-tab">
      <section className="studio-section">
        {cloud && project.review_status === 'in_review' && (
          <p className="studio-note">Waiting for a moderator. You can keep editing; review and send it again to replace the version they’ll see.</p>
        )}
        {cloud && project.review_status === 'changes_requested' && (
          <div className="review-note" role="status">
            <strong>A moderator asked for changes:</strong>
            <p>{project.review_note}</p>
          </div>
        )}
        {cloud && project.status === 'published' && project.review_status === 'none' && (
          <p className="check-ok">✓ On Scala’s Shelf. Changes reach readers after a moderator approves them again.</p>
        )}

        {checks && (
          <ul className="review-checks" aria-live="polite">
            {checks.map((c, i) => {
              const state = i < shown ? c.status : 'checking';
              return (
                <li key={c.id} className={`review-check review-check--${state}`}>
                  <span className="review-check-icon" aria-hidden>
                    {state === 'checking' ? <span className="spinner" /> : state === 'pass' ? '✓' : state === 'fail' ? '✕' : '–'}
                  </span>
                  <div className="review-check-body">
                    <span className="review-check-label">{c.label}</span>
                    {state === 'fail' && (
                      <ul className="review-problems">
                        {c.problems.map((p, j) => (
                          <li key={j}>
                            {p.scene && <button className="link-btn" onClick={() => onJumpToScene(p.scene! - 1)}>Page {p.scene}</button>}
                            {p.scene ? ': ' : ''}{p.message}
                          </li>
                        ))}
                      </ul>
                    )}
                    {state === 'skipped' && c.note && <span className="hint">{c.note}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {done && !stale && failed > 0 && <p className="hint">Fix the {failed === 1 ? 'red item' : `${failed} red items`}, then review again.</p>}
        {stale && <p className="hint">You changed the book since the review. Review it again.</p>}
        {error && <p className="studio-error" role="alert">{error}</p>}

        <div className="publish-actions">
          {clear && cloud ? (
            <button className="buy-btn publish-btn" onClick={send} disabled={sending}>
              {sending ? 'Sending…' : 'Send for publish'}
            </button>
          ) : (
            <button className="buy-btn publish-btn" onClick={review} disabled={running}>
              {running ? 'Checking…' : 'Review'}
            </button>
          )}
          {clear && !cloud && <p className="hint">All clear. Sign in to send books for publishing.</p>}
          {cloud && project.status === 'published' && (
            <button className="ghost-btn" onClick={() => onUnpublish().catch((e: Error) => setError(e.message))}>
              Take off Scala’s Shelf
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
