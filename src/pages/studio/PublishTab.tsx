import { useState } from 'react';
import { bookChecklist } from '@/lib/checklist';
import { cloudActive } from '@/lib/studioStore';
import type { StudioProject, StudioScene } from './useStudioProject';

interface PublishTabProps {
  project: StudioProject;
  scenes: StudioScene[];
  onSubmit: () => Promise<void>;
  onUnpublish: () => Promise<void>;
  onJumpToScene: (index: number) => void;
}

export function PublishTab({ project, scenes, onSubmit, onUnpublish, onJumpToScene }: PublishTabProps) {
  const [problems, setProblems] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const drafts = scenes.map((s) => s.draft);
  // The same checks the server runs when the book is sent (src/lib/checklist.ts).
  const issues = bookChecklist(project, drafts);
  const errors = issues.filter((i) => i.level === 'error');

  const warnings = issues.filter((i) => i.level === 'warning');

  /** The server builds the book from what's saved, checks it again, and queues it for review. */
  async function submit() {
    setSubmitting(true);
    setProblems([]);
    try {
      await onSubmit();
    } catch (e) {
      setProblems((e as Error).message.split('; '));
    }
    setSubmitting(false);
  }

  const submitButton = (label: string) => (
    <button className="buy-btn" onClick={submit} disabled={errors.length > 0 || submitting}>
      {submitting ? 'Sending…' : label}
    </button>
  );

  return (
    <div className="publish-tab">
      <section className="studio-section">
        <h2>Checklist</h2>
        {issues.length === 0 && <p className="check-ok">✓ Everything looks ready.</p>}
        <ul className="checklist">
          {[...errors, ...warnings].map((issue, i) => (
            <li key={i} className={`checklist-item checklist-item--${issue.level}`}>
              <span aria-hidden>{issue.level === 'error' ? '✕' : '!'}</span>
              <span>
                {issue.scene && (
                  <button className="link-btn" onClick={() => onJumpToScene(issue.scene! - 1)}>Scene {issue.scene}</button>
                )}{issue.scene ? ': ' : ''}{issue.message}
              </span>
            </li>
          ))}
        </ul>
        {errors.length > 0 && <p className="hint">Fix the ✕ items before sending for review. The ! items are recommendations.</p>}
      </section>

      <section className="studio-section">
        {!cloudActive() ? (
          <p className="studio-note">
            Sign in to send books for review. Your draft is saved on this device.
          </p>
        ) : project.review_status === 'in_review' ? (
          <p className="studio-note">
            Waiting for review. A reviewer checks every book before children can read it.
            You can keep editing; send it again to replace the version under review.
          </p>
        ) : null}
        {cloudActive() && project.review_status === 'changes_requested' && (
          <div className="review-note" role="status">
            <strong>A reviewer asked for changes:</strong>
            <p>{project.review_note}</p>
          </div>
        )}
        {cloudActive() && project.status === 'published' && project.review_status === 'none' && (
          <>
            <p className="check-ok">
              ✓ Published. The cloud packager builds the final images and audio for the Lite edition. Free for every reader.
            </p>
            <p className="hint">Changes you make now reach readers after a reviewer approves them again.</p>
          </>
        )}
        {cloudActive() && (
          <div className="new-project-actions">
            {submitButton(
              project.review_status === 'in_review' ? 'Send updated version'
                : project.review_status === 'changes_requested' ? 'Send for review again'
                : project.status === 'published' ? 'Send changes for review'
                : 'Send for review',
            )}
            {project.status === 'published' && (
              <button className="ghost-btn" onClick={() => onUnpublish().catch((e: Error) => setProblems([e.message]))}>
                Take off Scala’s Shelf
              </button>
            )}
          </div>
        )}
        {problems.length > 0 && (
          <ul className="checklist">
            {problems.map((p) => <li key={p} className="checklist-item checklist-item--error"><span>✕</span><span>{p}</span></li>)}
          </ul>
        )}
        {project.manifest && (
          <details className="package-preview">
            <summary>Package preview (manifest v2)</summary>
            <pre>{JSON.stringify(project.manifest.manifest, null, 2)}</pre>
          </details>
        )}
      </section>
    </div>
  );
}
