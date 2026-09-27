import { castList, usedIn, type CastKind } from '@/lib/cast';
import type { Cast, CastMember, SceneDraft } from '@/lib/format';

// The first tab: the episode's characters and places. Each is drawn once and reused in
// every scene, so it looks the same on every page. Scenes can only use what's made here.

interface CastTabProps {
  cast: Cast;
  scenes: SceneDraft[];
  onOpen: (kind: CastKind, member?: CastMember) => void;
}

const SECTIONS: { kind: CastKind; title: string; add: string; empty: string }[] = [
  { kind: 'character', title: 'Characters', add: '+ New character', empty: 'No characters yet. Add the people and animals in your story.' },
  { kind: 'place', title: 'Places', add: '+ New place', empty: 'No places yet. Add where your scenes happen.' },
];

export function CastTab({ cast, scenes, onOpen }: CastTabProps) {
  return (
    <div className="cast-tab">
      <p className="hint">
        Make your characters and places first. Each one is drawn once and reused in every scene, so it looks the same on
        every page. In the Script tab, you choose from them.
      </p>
      {SECTIONS.map(({ kind, title, add, empty }) => {
        const list = castList(cast, kind);
        return (
          <section key={kind} className="studio-section">
            <div className="section-header">
              <h3>{title} ({list.length})</h3>
              <button className="ghost-btn" onClick={() => onOpen(kind)}>{add}</button>
            </div>
            {list.length === 0 && <p className="hint">{empty}</p>}
            <div className="cast-grid">
              {list.map((m) => {
                const scenesUsing = usedIn(scenes, kind, m.id);
                return (
                  <button key={m.id} className={`cast-card cast-card--${kind}`} onClick={() => onOpen(kind, m)} aria-label={`Edit ${m.name}`}>
                    <span className="cast-card-art">
                      {m.asset ? <img src={m.asset.url} alt="" /> : <span aria-hidden>{m.name.slice(0, 1).toUpperCase()}</span>}
                    </span>
                    <strong>{m.name}</strong>
                    <span className="hint">
                      {scenesUsing.length ? `Scene ${scenesUsing.join(', ')}` : 'Not in a scene yet'}
                      {!m.asset && ' · no picture'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
