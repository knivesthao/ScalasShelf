import { useEffect, useState } from 'react';
import {
  bareWord, buildVocab, mergeTokens, retokenize, splitToken, tokenize, tokensMatch, vocabId,
  type Bubble, type SceneDraft, type Token,
} from '@/lib/format';
import type { StudioScene } from './useStudioProject';

interface WordsTabProps {
  draft: SceneDraft;
  scenes: StudioScene[];
  onChange: (fn: (d: SceneDraft) => SceneDraft) => void;
}

export function WordsTab({ draft, scenes, onChange }: WordsTabProps) {
  const [selected, setSelected] = useState<{ bubbleId: string; index: number } | null>(null);

  // Lines written before words existed (or edited elsewhere) get their words split now.
  const outOfSync = draft.bubbles.some((b) => b.text.en && !tokensMatch(b.tokens.en, b.text.en));
  useEffect(() => {
    if (!outOfSync) return;
    onChange((d) => ({
      ...d,
      bubbles: d.bubbles.map((b) =>
        tokensMatch(b.tokens.en, b.text.en) ? b : { ...b, tokens: { ...b.tokens, en: retokenize(b.text.en, b.tokens.en) } }
      ),
    }));
  }, [outOfSync, onChange]);

  function setTokens(bubbleId: string, tokens: Token[]) {
    onChange((d) => ({
      ...d,
      bubbles: d.bubbles.map((b) => (b.id === bubbleId ? { ...b, tokens: { ...b.tokens, en: tokens } } : b)),
    }));
  }

  const vocab = buildVocab(scenes.map((s) => s.draft));
  const bubble = selected ? draft.bubbles.find((b) => b.id === selected.bubbleId) : undefined;
  const tokens = bubble?.tokens.en ?? [];
  const token = selected ? tokens[selected.index] : undefined;

  function updateToken(b: Bubble, index: number, fields: Partial<Token>) {
    const list = [...(b.tokens.en ?? [])];
    list[index] = { ...list[index], ...fields };
    setTokens(b.id, list);
  }

  return (
    <div className="words-tab">
      <p className="hint">
        Tap a word to give it a simple meaning. Learners see it when they tap the word.
        Star 5–10 words across the episode as its vocabulary; they become the word list and quiz.
      </p>

      {draft.bubbles.length === 0 && <p className="hint">Add lines in the Script tab first.</p>}

      {draft.bubbles.map((b, i) => (
        <div key={b.id} className="words-line">
          <span className="line-number">{i + 1}</span>
          <div className="word-chips" lang="en">
            {(b.tokens.en ?? []).map((tk, j) => {
              const isSel = selected?.bubbleId === b.id && selected.index === j;
              return (
                <button
                  key={j}
                  className={`word-chip${tk.v ? ' word-chip--vocab' : ''}${tk.gloss ? ' word-chip--glossed' : ''}${isSel ? ' is-active' : ''}`}
                  onClick={() => setSelected({ bubbleId: b.id, index: j })}
                >
                  {tk.v && '★ '}{tk.t.trim()}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {bubble && token && selected && (
        <div className="inspector word-inspector">
          <h3 lang="en">“{bareWord(token.t)}”</h3>
          <label className="inspector-field">
            Simple meaning
            <input
              value={token.gloss ?? ''}
              placeholder="e.g. a big farm animal with horns"
              onChange={(e) => updateToken(bubble, selected.index, { gloss: e.target.value || undefined })}
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!token.v}
              onChange={(e) =>
                updateToken(bubble, selected.index, { v: e.target.checked ? vocabId(bareWord(token.t)) : undefined })
              }
            />
            ★ Teach this word (episode vocabulary)
          </label>
          <div className="inspector-row">
            <button
              className="ghost-btn"
              disabled={selected.index >= tokens.length - 1}
              onClick={() => setTokens(bubble.id, mergeTokens(tokens, selected.index))}
            >
              Join with next word
            </button>
            {tokenize(token.t).length > 1 && (
              <button className="ghost-btn" onClick={() => setTokens(bubble.id, splitToken(tokens, selected.index))}>
                Split
              </button>
            )}
          </div>
        </div>
      )}

      <section className="studio-section">
        <h3>Episode vocabulary ({vocab.length})</h3>
        {vocab.length === 0 ? (
          <p className="hint">No words starred yet.</p>
        ) : (
          <ul className="vocab-list">
            {vocab.map((v) => (
              <li key={v.id}>
                <strong lang="en">{v.headword}</strong>
                {v.meaning ? <span>: {v.meaning}</span> : <span className="chip chip--warn">needs a meaning</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
