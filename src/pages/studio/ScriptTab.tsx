import { MotionPanel } from '@/components/MotionPanel';
import { bareWord, newBubble, retokenize, type Bubble, type BubbleStyle, type Level, type SceneDraft } from '@/lib/format';
import { FEATURES } from '@/lib/features';
import { hasWordList, wordsAboveLevel } from '@/lib/levels';

interface ScriptTabProps {
  draft: SceneDraft;
  level: Level;
  generating: boolean;
  onChange: (fn: (d: SceneDraft) => SceneDraft) => void;
  onGenerate: () => void;
  onOpenPanel: () => void;
}

const STYLES: { id: BubbleStyle; label: string }[] = [
  { id: 'speech', label: 'Says' },
  { id: 'thought', label: 'Thinks' },
  { id: 'narration', label: 'Narration' },
];

export function ScriptTab({ draft, level, generating, onChange, onGenerate, onOpenPanel }: ScriptTabProps) {
  const speakers = [...new Set(draft.bubbles.map((b) => b.speaker).filter(Boolean))];
  const taught = draft.bubbles.flatMap((b) => (b.tokens.en ?? []).filter((t) => t.v).map((t) => bareWord(t.t)));

  function updateBubble(id: string, fields: Partial<Bubble>) {
    onChange((d) => ({ ...d, bubbles: d.bubbles.map((b) => (b.id === id ? { ...b, ...fields } : b)) }));
  }

  function setText(b: Bubble, text: string) {
    // Keep the tappable words in sync with the line, preserving meanings already added.
    updateBubble(b.id, { text: { ...b.text, en: text }, tokens: { ...b.tokens, en: retokenize(text, b.tokens.en) } });
  }

  function addLine() {
    const last = draft.bubbles[draft.bubbles.length - 1];
    onChange((d) => ({ ...d, bubbles: [...d.bubbles, newBubble(d.bubbles.length, last?.speaker ?? '')] }));
  }

  function removeLine(id: string) {
    onChange((d) => ({ ...d, bubbles: d.bubbles.filter((b) => b.id !== id) }));
  }

  return (
    <div className="script-tab">
      <section className="studio-section">
        <label className="field-label" htmlFor="scene-description">What does the scene look like?</label>
        <textarea
          id="scene-description"
          className="narration-input"
          rows={3}
          value={draft.description}
          placeholder='e.g. "A girl walks her water buffalo through a rice field at sunrise."'
          onChange={(e) => onChange((d) => ({ ...d, description: e.target.value }))}
        />
        {!FEATURES.rendering && (
          <p className="hint">Describe what readers should see. Illustrations will be made from this when they’re ready.</p>
        )}
        {FEATURES.rendering && <div className="generate-row">
          <button className="generate-btn" onClick={onGenerate} disabled={generating || !draft.description.trim()}>
            {generating ? 'Generating in the cloud…' : draft.layers.length ? 'Regenerate scene art' : 'Generate scene art'}
          </button>
          <span className="hint">
            {generating
              ? 'You can keep editing. The art appears when it’s ready.'
              : 'Art is made in the cloud, not on your phone. One character per speaker.'}
          </span>
        </div>}
        {FEATURES.rendering && draft.layers.length > 0 && (
          <button className="script-preview" onClick={onOpenPanel} aria-label="Edit panel layout">
            <MotionPanel aspect={draft.aspect} layers={draft.layers} bubbles={draft.bubbles} assets={draft.assets} still />
            <span>Edit layout →</span>
          </button>
        )}
      </section>

      <section className="studio-section">
        <div className="section-header">
          <h3>Lines</h3>
          {!hasWordList(level) && <span className="hint">No word list for {level} yet, so level checks are off.</span>}
        </div>
        <datalist id="speakers">{speakers.map((s) => <option key={s} value={s} />)}</datalist>

        {draft.bubbles.length === 0 && <p className="hint">Add the first line of dialogue or narration.</p>}

        {draft.bubbles.map((b, i) => {
          const hard = wordsAboveLevel(b.text.en, level, [...speakers, ...taught]);
          return (
            <div key={b.id} className="line-card">
              <div className="line-meta">
                <span className="line-number">{i + 1}</span>
                <input
                  aria-label={`Line ${i + 1} speaker`}
                  className="speaker-input"
                  list="speakers"
                  value={b.speaker}
                  placeholder={b.style === 'narration' ? 'Narrator' : 'Who?'}
                  onChange={(e) => updateBubble(b.id, { speaker: e.target.value })}
                />
                <select
                  aria-label={`Line ${i + 1} type`}
                  value={b.style}
                  onChange={(e) => updateBubble(b.id, { style: e.target.value as BubbleStyle })}
                >
                  {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <button className="icon-btn" onClick={() => removeLine(b.id)} aria-label={`Delete line ${i + 1}`}>✕</button>
              </div>
              <textarea
                aria-label={`Line ${i + 1} text`}
                className="line-input"
                lang="en"
                rows={2}
                value={b.text.en}
                placeholder="Short and simple, e.g. “Come on! We’re late!”"
                onChange={(e) => setText(b, e.target.value)}
              />
              {hard.length > 0 && (
                <p className="level-warning">
                  Above {level}: {hard.map((w) => <span key={w} className="chip chip--warn">{w}</span>)}
                  <span className="hint"> Simplify, or teach these words in the Words tab.</span>
                </p>
              )}
            </div>
          );
        })}
        <button className="ghost-btn" onClick={addLine}>+ Add line</button>
      </section>
    </div>
  );
}
