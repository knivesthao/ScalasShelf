import { useState } from 'react';
import { MotionPanel } from '@/components/MotionPanel';
import { sceneCharacters, type CastKind } from '@/lib/cast';
import { bareWord, newBubble, retokenize, type Bubble, type BubbleStyle, type Cast, type CastMember, type Level, type SceneDraft } from '@/lib/format';
import { FEATURES } from '@/lib/features';
import { hasWordList, wordsAboveLevel } from '@/lib/levels';

interface ScriptTabProps {
  draft: SceneDraft;
  cast: Cast;
  level: Level;
  generating: boolean;
  onChange: (fn: (d: SceneDraft) => SceneDraft) => void;
  onGenerate: () => void;
  onOpenPanel: () => void;
  /** Opens the new character / place popup; `onCreated` gets the member once it's added. */
  onCreate: (kind: CastKind, onCreated: (member: CastMember) => void) => void;
}

/** Select value for the "+ New …" option. */
const NEW = '__new__';

const STYLES: { id: BubbleStyle; label: string }[] = [
  { id: 'speech', label: 'Says' },
  { id: 'thought', label: 'Thinks' },
  { id: 'narration', label: 'Narration' },
];

/** A line is filled out when it has words and, unless it's narration, a character saying them. */
const lineReady = (b: Bubble) => Boolean(b.text.en.trim()) && (b.style === 'narration' || Boolean(b.characterId));

/** The scene can be drawn once it has a place, some words, and every line is filled out. */
export function scriptReady(draft: SceneDraft): boolean {
  const hasWords = draft.bubbles.length > 0 || Boolean(draft.caption?.trim());
  return Boolean(draft.placeId) && hasWords && draft.bubbles.every(lineReady);
}

export function ScriptTab({ draft, cast, level, generating, onChange, onGenerate, onOpenPanel, onCreate }: ScriptTabProps) {
  const [comingSoon, setComingSoon] = useState(false);
  // Names of the characters in this scene count as known words for the level check.
  const speakers = sceneCharacters(draft, cast).map((c) => c.name);
  const place = cast.places.find((p) => p.id === draft.placeId);
  const taught = draft.bubbles.flatMap((b) => (b.tokens.en ?? []).filter((t) => t.v).map((t) => bareWord(t.t)));
  const ready = scriptReady(draft);
  const captionHard = draft.caption?.trim() ? wordsAboveLevel(draft.caption, level, [...speakers, ...taught]) : [];

  function generate() {
    // Until the illustration pipeline is switched on (FEATURES.rendering), say so instead.
    if (FEATURES.rendering) onGenerate();
    else setComingSoon(true);
  }

  function updateBubble(id: string, fields: Partial<Bubble>) {
    onChange((d) => ({ ...d, bubbles: d.bubbles.map((b) => (b.id === id ? { ...b, ...fields } : b)) }));
  }

  function setText(b: Bubble, text: string) {
    // Keep the tappable words in sync with the line, preserving meanings already added.
    updateBubble(b.id, { text: { ...b.text, en: text }, tokens: { ...b.tokens, en: retokenize(text, b.tokens.en) } });
  }

  function setPlace(p: CastMember) {
    // The place's description stays on the scene too, for re-rolling the background.
    onChange((d) => ({ ...d, placeId: p.id, description: p.description }));
  }

  function pickPlace(value: string) {
    if (value === NEW) onCreate('place', setPlace);
    else {
      const p = cast.places.find((x) => x.id === value);
      if (p) setPlace(p);
    }
  }

  function setCharacter(b: Bubble, c: CastMember) {
    updateBubble(b.id, { characterId: c.id, speaker: c.name });
  }

  function pickCharacter(b: Bubble, value: string) {
    if (value === NEW) onCreate('character', (c) => setCharacter(b, c));
    else {
      const c = cast.characters.find((x) => x.id === value);
      if (c) setCharacter(b, c);
    }
  }

  function setStyle(b: Bubble, style: BubbleStyle) {
    // Narration isn't said by anyone in the scene.
    updateBubble(b.id, style === 'narration' ? { style, characterId: undefined, speaker: '' } : { style });
  }

  function addLine() {
    const last = draft.bubbles[draft.bubbles.length - 1];
    onChange((d) => {
      const line = newBubble(d.bubbles.length, last?.speaker ?? '');
      return { ...d, bubbles: [...d.bubbles, last?.characterId ? { ...line, characterId: last.characterId } : line] };
    });
  }

  function removeLine(id: string) {
    onChange((d) => ({ ...d, bubbles: d.bubbles.filter((b) => b.id !== id) }));
  }

  return (
    <div className="script-tab">
      <section className="studio-section">
        <label className="field-label" htmlFor="scene-place">Where does this scene happen?</label>
        <select id="scene-place" className="cast-select" value={draft.placeId && place ? draft.placeId : ''} onChange={(e) => pickPlace(e.target.value)}>
          {!place && <option value="">Choose a place…</option>}
          {cast.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value={NEW}>+ New place…</option>
        </select>
        {place && (
          <div className="place-summary">
            {place.asset && <img src={place.asset.url} alt="" />}
            <span className="hint">{place.description || 'No description yet. Add one in the Cast tab.'}</span>
          </div>
        )}

        <label className="field-label" htmlFor="scene-caption">Text on screen (optional)</label>
        <textarea
          id="scene-caption"
          className="narration-input"
          lang="en"
          rows={2}
          value={draft.caption ?? ''}
          placeholder='e.g. "The next morning, the market was busy."'
          onChange={(e) => onChange((d) => ({ ...d, caption: e.target.value }))}
        />
        <p className="hint">Narration or any words to show on this scene. Readers see it; it isn’t used to make the picture.</p>
        {captionHard.length > 0 && (
          <p className="level-warning">
            Above {level}: {captionHard.map((w) => <span key={w} className="chip chip--warn">{w}</span>)}
            <span className="hint"> Try simpler words.</span>
          </p>
        )}
        {FEATURES.rendering && draft.layers.length > 0 && (
          <button className="script-preview" onClick={onOpenPanel} aria-label="Edit panel layout">
            <MotionPanel aspect={draft.aspect} layers={draft.layers} bubbles={draft.bubbles} assets={draft.assets} caption={draft.caption} still />
            <span>Edit layout →</span>
          </button>
        )}
      </section>

      <section className="studio-section">
        <div className="section-header">
          <h3>Lines</h3>
          {!hasWordList(level) && <span className="hint">No word list for {level} yet, so level checks are off.</span>}
        </div>

        {draft.bubbles.length === 0 && <p className="hint">Add the first line of dialogue or narration.</p>}

        {draft.bubbles.map((b, i) => {
          const hard = wordsAboveLevel(b.text.en, level, [...speakers, ...taught]);
          return (
            <div key={b.id} className="line-card">
              <div className="line-meta">
                <span className="line-number">{i + 1}</span>
                {b.style === 'narration' ? (
                  <span className="speaker-input speaker-input--narrator">Narrator</span>
                ) : (
                  <select
                    aria-label={`Line ${i + 1} speaker`}
                    className="speaker-input cast-select"
                    value={b.characterId && cast.characters.some((c) => c.id === b.characterId) ? b.characterId : ''}
                    onChange={(e) => pickCharacter(b, e.target.value)}
                  >
                    {!b.characterId && <option value="">Who?</option>}
                    {cast.characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value={NEW}>+ New character…</option>
                  </select>
                )}
                <select
                  aria-label={`Line ${i + 1} type`}
                  value={b.style}
                  onChange={(e) => setStyle(b, e.target.value as BubbleStyle)}
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
                  <span className="hint"> Try simpler words.</span>
                </p>
              )}
            </div>
          );
        })}
        <button className="ghost-btn" onClick={addLine}>+ Add line</button>
      </section>

      <section className="studio-section generate-row">
        <button className="generate-btn" onClick={generate} disabled={!ready || generating}>
          {generating ? 'Generating in the cloud…' : draft.layers.length ? 'Regenerate scene' : 'Generate scene'}
        </button>
        <span className="hint">
          {generating
            ? 'You can keep editing. The art appears when it’s ready.'
            : comingSoon
              ? 'Illustrations aren’t switched on yet. Your script is saved, and you can generate the scene once they are.'
              : ready
                ? 'Art is made in the cloud, not on your phone. One character per speaker.'
                : 'Choose a place and fill in every line (who says it and what they say), or remove empty ones, to generate it.'}
        </span>
      </section>
    </div>
  );
}
