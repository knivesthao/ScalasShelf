import { useState } from 'react';
import { LEVELS, buildPackage, buildVocab, publishChecklist, validatePackage, type Level, type Package } from '@/lib/format';
import { FEATURES } from '@/lib/features';
import { wordsAboveLevel } from '@/lib/levels';
import type { StudioProject, StudioScene } from './useStudioProject';

interface PublishTabProps {
  project: StudioProject;
  scenes: StudioScene[];
  onUpdate: (fields: Partial<Pick<StudioProject, 'title' | 'description' | 'level'>>) => void;
  onSubmit: (pkg: Package) => Promise<void>;
  onUnpublish: () => Promise<void>;
  onJumpToScene: (index: number) => void;
}

export function PublishTab({ project, scenes, onUpdate, onSubmit, onUnpublish, onJumpToScene }: PublishTabProps) {
  const [problems, setProblems] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const settings = { id: project.id, title: project.title, level: project.level };
  const drafts = scenes.map((s) => s.draft);
  const allowed = [
    ...drafts.flatMap((d) => d.bubbles.map((b) => b.speaker)),
    ...buildVocab(drafts).map((v) => v.headword),
  ];
  const issues = publishChecklist(settings, drafts, project.quiz, (text) => wordsAboveLevel(text, project.level, allowed), {
    art: FEATURES.rendering,
    audio: FEATURES.rendering,
  });
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  async function submit() {
    setSubmitting(true);
    const pkg = buildPackage(settings, drafts, project.quiz);
    const found = validatePackage(pkg);
    setProblems(found);
    if (found.length === 0) {
      try {
        await onSubmit(pkg);
      } catch (e) {
        setProblems([(e as Error).message]);
      }
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
        <h2>Episode details</h2>
        <label className="inspector-field">
          Title
          <input value={project.title} onChange={(e) => onUpdate({ title: e.target.value })} />
        </label>
        <label className="inspector-field">
          Short description (shown in the library)
          <textarea rows={2} value={project.description} onChange={(e) => onUpdate({ description: e.target.value })} />
        </label>
        <label className="inspector-field">
          Level
          <select value={project.level} onChange={(e) => onUpdate({ level: e.target.value as Level })}>
            {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
      </section>

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
        {!FEATURES.cloudStudio ? (
          <p className="studio-note">
            Sign in to send books for review. Your draft is saved on this device.
          </p>
        ) : project.review_status === 'in_review' ? (
          <p className="studio-note">
            Waiting for review. A reviewer checks every book before children can read it.
            You can keep editing; send it again to replace the version under review.
          </p>
        ) : null}
        {FEATURES.cloudStudio && project.review_status === 'changes_requested' && (
          <div className="review-note" role="status">
            <strong>A reviewer asked for changes:</strong>
            <p>{project.review_note}</p>
          </div>
        )}
        {FEATURES.cloudStudio && project.status === 'published' && project.review_status === 'none' && (
          <>
            <p className="check-ok">
              ✓ Published. The cloud packager builds the final images and audio for the Lite edition. Free for every reader.
            </p>
            <p className="hint">Changes you make now reach readers after a reviewer approves them again.</p>
          </>
        )}
        {FEATURES.cloudStudio && (
          <div className="new-project-actions">
            {submitButton(
              project.review_status === 'in_review' ? 'Send updated version'
                : project.review_status === 'changes_requested' ? 'Send for review again'
                : project.status === 'published' ? 'Send changes for review'
                : 'Send for review',
            )}
            {project.status === 'published' && (
              <button className="ghost-btn" onClick={() => onUnpublish().catch((e: Error) => setProblems([e.message]))}>
                Take out of the library
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
