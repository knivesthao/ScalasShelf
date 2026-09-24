import { useState } from 'react';
import { MotionPanel } from '@/components/MotionPanel';
import { MOTION_PRESETS, type Bubble, type BubbleStyle, type Layer, type MotionPreset, type SceneDraft } from '@/lib/format';

interface PanelTabProps {
  draft: SceneDraft;
  generating: boolean;
  busyLayerId: string | null;
  onChange: (fn: (d: SceneDraft) => SceneDraft) => void;
  onReroll: (layer: Layer) => void;
}

function MotionSelect({ value, onChange }: { value: MotionPreset | undefined; onChange: (p: MotionPreset) => void }) {
  return (
    <label className="inspector-field">
      Motion
      <select value={value ?? 'none'} onChange={(e) => onChange(e.target.value as MotionPreset)}>
        {MOTION_PRESETS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
    </label>
  );
}

function layerLabel(layer: Layer): string {
  if (layer.role === 'background') return 'Background';
  return layer.prompt || (layer.role === 'character' ? 'Character' : 'Prop');
}

export function PanelTab({ draft, generating, busyLayerId, onChange, onReroll }: PanelTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [still, setStill] = useState(false);
  const [playKey, setPlayKey] = useState(0);

  const layer = draft.layers.find((l) => l.id === selectedId);
  const bubble = draft.bubbles.find((b) => b.id === selectedId);

  const updateLayer = (id: string, fields: Partial<Layer>) =>
    onChange((d) => ({ ...d, layers: d.layers.map((l) => (l.id === id ? { ...l, ...fields } : l)) }));
  const updateBubble = (id: string, fields: Partial<Bubble>) =>
    onChange((d) => ({ ...d, bubbles: d.bubbles.map((b) => (b.id === id ? { ...b, ...fields } : b)) }));

  function move(id: string, x: number, y: number) {
    if (draft.layers.some((l) => l.id === id)) updateLayer(id, { x, y });
    else updateBubble(id, { x, y });
  }

  function removeLayer(id: string) {
    onChange((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== id) }));
    setSelectedId(null);
  }

  return (
    <div className="panel-tab">
      <div className="panel-stage">
        {generating && <div className="panel-stage-busy"><div className="spinner" /> Generating in the cloud…</div>}
        <MotionPanel
          aspect={draft.aspect}
          layers={draft.layers}
          bubbles={draft.bubbles}
          assets={draft.assets}
          editable
          still={still}
          playKey={playKey}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={move}
        />
        {draft.layers.length === 0 && !generating && (
          <p className="hint">No art yet. Describe the scene in the Script tab and generate it.</p>
        )}
      </div>

      <div className="panel-side">
        <div className="panel-controls">
          <button className="ghost-btn" onClick={() => setPlayKey((k) => k + 1)} disabled={still}>▶ Replay</button>
          <label className="toggle">
            <input type="checkbox" checked={still} onChange={(e) => setStill(e.target.checked)} />
            Still preview
          </label>
        </div>

        <div className="element-chips" aria-label="Panel elements">
          {draft.layers.map((l) => (
            <button key={l.id} className={`chip${l.id === selectedId ? ' is-active' : ''}`} onClick={() => setSelectedId(l.id)}>
              {layerLabel(l)}
            </button>
          ))}
          {draft.bubbles.map((b, i) => (
            <button key={b.id} className={`chip${b.id === selectedId ? ' is-active' : ''}`} onClick={() => setSelectedId(b.id)}>
              Line {i + 1}
            </button>
          ))}
        </div>

        {!layer && !bubble && <p className="hint">Tap anything in the panel to adjust it. Drag to move.</p>}

        {layer && (
          <div className="inspector">
            <h3>{layerLabel(layer)}</h3>
            {layer.role !== 'background' && (
              <label className="inspector-field">
                Size
                <input type="range" min={0.1} max={1.2} step={0.01} value={layer.w}
                  onChange={(e) => updateLayer(layer.id, { w: Number(e.target.value) })} />
              </label>
            )}
            <MotionSelect value={layer.motion?.preset} onChange={(preset) => updateLayer(layer.id, { motion: { preset } })} />
            {layer.role !== 'background' && (
              <div className="inspector-row">
                <button className="ghost-btn" onClick={() => updateLayer(layer.id, { z: Math.max(1, layer.z - 1) })}>Send back</button>
                <button className="ghost-btn" onClick={() => updateLayer(layer.id, { z: layer.z + 1 })}>Bring forward</button>
              </div>
            )}
            <div className="inspector-row">
              <button className="generate-btn" onClick={() => onReroll(layer)} disabled={busyLayerId === layer.id || generating}>
                {busyLayerId === layer.id ? 'Re-rolling…' : 'Re-roll this image'}
              </button>
              {layer.role !== 'background' && (
                <button className="ghost-btn ghost-btn--danger" onClick={() => removeLayer(layer.id)}>Remove</button>
              )}
            </div>
          </div>
        )}

        {bubble && (
          <div className="inspector">
            <h3>{bubble.speaker || 'Line'}: “{bubble.text.en || '…'}”</h3>
            <label className="inspector-field">
              Width
              <input type="range" min={0.25} max={0.95} step={0.01} value={bubble.w}
                onChange={(e) => updateBubble(bubble.id, { w: Number(e.target.value) })} />
            </label>
            <label className="inspector-field">
              Style
              <select value={bubble.style} onChange={(e) => updateBubble(bubble.id, { style: e.target.value as BubbleStyle })}>
                <option value="speech">Speech</option>
                <option value="thought">Thought</option>
                <option value="narration">Narration box</option>
              </select>
            </label>
            <MotionSelect value={bubble.motion?.preset}
              onChange={(preset) => updateBubble(bubble.id, { motion: { preset, delay: bubble.motion?.delay } })} />
            <label className="inspector-field">
              Appears after {((bubble.motion?.delay ?? 0) / 1000).toFixed(1)}s
              <input type="range" min={0} max={4000} step={100} value={bubble.motion?.delay ?? 0}
                onChange={(e) => updateBubble(bubble.id, {
                  motion: { preset: bubble.motion?.preset ?? 'pop', delay: Number(e.target.value) },
                })} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
