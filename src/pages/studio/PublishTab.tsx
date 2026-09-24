import { useState } from 'react';
import { LEVELS, buildPackage, buildVocab, publishChecklist, validatePackage, type Level, type Package } from '@/lib/format';
import { FEATURES } from '@/lib/features';
import { wordsAboveLevel } from '@/lib/levels';
import type { StudioProject, StudioScene } from './useStudioProject';

interface PublishTabProps {
  project: StudioProject;
  scenes: StudioScene[];
  onUpdate: (fields: Partial<Pick<StudioProject, 'title' | 'description' | 'level'>>) => void;
  onPublish: (pkg: Package) => Promise<void>;
  onUnpublish: () => Promise<void>;
  onJumpToScene: (index: number) => void;
}

export function PublishTab({ project, scenes, onUpdate, onPublish, onUnpublish, onJumpToScene }: PublishTabProps) {
  const [problems, setProblems] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

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

  async function publish() {
    setPublishing(true);
    const pkg = buildPackage(settings, drafts, project.quiz);
    const found = validatePackage(pkg);
    setProblems(found);
    if (found.length === 0) {
      try {
        await onPublish(pkg);
      } catch (e) {
        setProblems([(e as Error).message]);
      }
    }
    setPublishing(false);
  }

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
        {errors.length > 0 && <p className="hint">Fix the ✕ items before publishing. The ! items are recommendations.</p>}
      </section>

      <section className="studio-section">
        {!FEATURES.cloudStudio ? (
          <p className="studio-note">
            Publishing to the library opens once accounts are ready. Your draft is saved on this device.
          </p>
        ) : project.status === 'published' ? (
          <>
            <p className="check-ok">
              ✓ Published. The cloud packager builds the final images and audio for the Lite edition. Free for every reader.
            </p>
            <button className="ghost-btn" onClick={() => onUnpublish().catch((e: Error) => setProblems([e.message]))}>
              Back to draft
            </button>
          </>
        ) : (
          <button className="buy-btn" onClick={publish} disabled={errors.length > 0 || publishing}>
            {publishing ? 'Publishing…' : 'Publish episode'}
          </button>
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
