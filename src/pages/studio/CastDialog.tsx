import { useEffect, useRef, useState } from 'react';
import type { CastKind } from '@/lib/cast';
import { newId, type AssetRef, type CastMember } from '@/lib/format';

// Create or edit one character or place, and draw its picture. Opened from the Cast tab,
// and from the Script tab's "+ New character…" / "+ New place…" options.

export interface CastDialogProps {
  kind: CastKind;
  /** Editing an existing member; omitted when creating. */
  member?: CastMember;
  /** False until the illustration pipeline is on (FEATURES.rendering). */
  canGenerate: boolean;
  generate: (name: string, description: string, previous?: AssetRef) => Promise<AssetRef>;
  onSave: (member: CastMember) => void;
  onClose: () => void;
  /** Cast tab only: remove the member. */
  onDelete?: () => void;
  /** Why it can't be removed (e.g. it's used in scenes). */
  deleteBlocked?: string;
}

const COPY = {
  character: {
    title: 'character',
    namePlaceholder: 'e.g. Noy',
    looks: 'What do they look like?',
    looksPlaceholder: 'e.g. "A 10-year-old girl with short black hair, a blue school shirt and sandals."',
  },
  place: {
    title: 'place',
    namePlaceholder: 'e.g. The morning market',
    looks: 'What does it look like?',
    looksPlaceholder: 'e.g. "A busy outdoor market with fruit stalls under colourful umbrellas, early morning."',
  },
};

export function CastDialog({ kind, member, canGenerate, generate, onSave, onClose, onDelete, deleteBlocked }: CastDialogProps) {
  const copy = COPY[kind];
  const [name, setName] = useState(member?.name ?? '');
  const [description, setDescription] = useState(member?.description ?? '');
  const [asset, setAsset] = useState<AssetRef | undefined>(member?.asset);
  const [drawing, setDrawing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !drawing) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, drawing]);

  async function draw() {
    setNote(null);
    if (!canGenerate) {
      setNote('Illustrations aren’t switched on yet. Save it now and draw it once they are.');
      return;
    }
    setDrawing(true);
    try {
      setAsset(await generate(name.trim(), description.trim(), asset));
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Drawing failed. Try again.');
    } finally {
      setDrawing(false);
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || drawing) return;
    onSave({ id: member?.id ?? newId(kind === 'place' ? 'place' : 'char'), name: name.trim(), description: description.trim(), asset });
  }

  const heading = `${member ? 'Edit' : 'New'} ${copy.title}`;

  return (
    <div className="cast-dialog-backdrop" onClick={() => !drawing && onClose()}>
      <form className="cast-dialog" role="dialog" aria-modal="true" aria-label={heading} onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <h2>{heading}</h2>

        <label className="inspector-field">
          Name
          <input ref={nameRef} value={name} maxLength={60} placeholder={copy.namePlaceholder} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="inspector-field">
          {copy.looks}
          <textarea rows={3} maxLength={600} value={description} placeholder={copy.looksPlaceholder} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <div className={`cast-art cast-art--${kind}`}>
          {asset ? <img src={asset.url} alt={`Picture of ${name || copy.title}`} /> : <span className="hint">No picture yet</span>}
          {drawing && <div className="panel-stage-busy"><div className="spinner" /> Drawing in the cloud…</div>}
        </div>
        <div className="generate-row">
          <button type="button" className="generate-btn" onClick={draw} disabled={drawing || !description.trim()}>
            {drawing ? 'Drawing…' : asset ? `Generate a new ${copy.title}` : `Generate ${copy.title}`}
          </button>
          <span className="hint">
            {note ?? (description.trim()
              ? `Drawn once and reused in every scene, so it looks the same throughout.`
              : `Describe the ${copy.title} to generate a picture.`)}
          </span>
        </div>

        <div className="new-project-actions">
          <button type="submit" className="buy-btn" disabled={!name.trim() || drawing}>{member ? 'Save' : `Add ${copy.title}`}</button>
          <button type="button" className="ghost-btn" onClick={onClose} disabled={drawing}>Cancel</button>
          {onDelete && (
            deleteBlocked ? <span className="hint">{deleteBlocked}</span>
              : confirmDelete ? (
                <button type="button" className="ghost-btn ghost-btn--danger" onClick={onDelete}>Yes, delete</button>
              ) : (
                <button type="button" className="ghost-btn ghost-btn--danger" onClick={() => setConfirmDelete(true)}>Delete</button>
              )
          )}
        </div>
      </form>
    </div>
  );
}
