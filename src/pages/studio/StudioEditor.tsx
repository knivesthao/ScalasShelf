import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useGenerate } from '@/hooks/useGenerate';
import { scalaFinish } from '@/lib/finish';
import { FEATURES } from '@/lib/features';
import { composeScene, putMember, removeMember, sceneCharacters, usedIn, type CastKind } from '@/lib/cast';
import type { AssetRef, CastMember, Layer, SceneDraft } from '@/lib/format';
import { useStudioProject, type StudioScene } from './useStudioProject';
import { CastDialog } from './CastDialog';
import { CastTab } from './CastTab';
import { ScriptTab } from './ScriptTab';
import { PanelTab } from './PanelTab';
import { AudioTab } from './AudioTab';
import { QuizTab } from './QuizTab';
import { PublishTab } from './PublishTab';
import { DetailsTab } from './DetailsTab';

type Tab = 'details' | 'cast' | 'script' | 'panel' | 'audio' | 'quiz' | 'publish';

/** First: the characters and places every scene is built from. */
const CAST_TAB = { id: 'cast' as Tab, label: 'Cast' };
/** Before everything: the book's title, description, type and level. */
const DETAILS_TAB = { id: 'details' as Tab, label: 'Details' };
const SCENE_TABS: { id: Tab; label: string }[] = [
  { id: 'script', label: 'Script' },
  // Art layout and voice recording need the rendering pipeline (FEATURES.rendering).
  ...(FEATURES.rendering ? [{ id: 'panel' as Tab, label: 'Panel' }, { id: 'audio' as Tab, label: 'Audio' }] : []),
];
const EPISODE_TABS: { id: Tab; label: string }[] = [
  { id: 'quiz', label: 'Quiz' },
  { id: 'publish', label: 'Publish' },
];

/** Asset id for a cast member's current picture: the same picture shares one file across scenes. */
function artId(member: CastMember, asset: AssetRef): string {
  let h = 0;
  for (let i = 0; i < asset.url.length; i++) h = (h * 31 + asset.url.charCodeAt(i)) | 0;
  return `${member.id}-${Math.abs(h).toString(36)}`;
}

interface DialogState {
  kind: CastKind;
  member?: CastMember;
  /** Script tab: pick the new member for the line or scene that asked for it. */
  onCreated?: (member: CastMember) => void;
}

/** Drop assets no layer uses any more, so drafts don't grow with every re-roll. */
function pruneAssets(layers: Layer[], assets: Record<string, AssetRef>): Record<string, AssetRef> {
  const used = new Set(layers.map((l) => l.asset));
  return Object.fromEntries(Object.entries(assets).filter(([id]) => used.has(id)));
}

export function StudioEditor() {
  const { id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const studio = useStudioProject(id);
  const { generateArt, rerollLayer } = useGenerate();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [tab, setTab] = useState<Tab>('script');
  /** sceneId → 'scene' while the whole scene generates, or the layer id being re-rolled */
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [genError, setGenError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const openedOnce = useRef(false);

  const { project, scenes, loading, loadError, saveState } = studio;
  const scene: StudioScene | undefined = scenes[Math.min(sceneIndex, scenes.length - 1)];

  // A new episode starts on the Cast tab: characters and places come first.
  useEffect(() => {
    if (!project || openedOnce.current) return;
    openedOnce.current = true;
    if (!project.cast.characters.length && !project.cast.places.length) setTab('cast');
  }, [project]);

  const drawMember = (kind: CastKind, name: string, description: string, previous?: AssetRef) =>
    generateArt({ projectId: project!.id, kind, name, description: description || name, previous });

  function saveMember(kind: CastKind, member: CastMember) {
    if (!project) return;
    studio.updateProject({ cast: putMember(project.cast, kind, member) });
    // Readers see the character's name on their lines; keep it in step with renames.
    if (kind === 'character') {
      for (const s of scenes) {
        if (s.draft.bubbles.some((b) => b.characterId === member.id && b.speaker !== member.name)) {
          studio.updateScene(s.id, (d) => ({
            ...d,
            bubbles: d.bubbles.map((b) => (b.characterId === member.id ? { ...b, speaker: member.name } : b)),
          }));
        }
      }
    }
    dialog?.onCreated?.(member);
    setDialog(null);
  }

  function deleteMember(kind: CastKind, member: CastMember) {
    if (!project) return;
    studio.updateProject({ cast: removeMember(project.cast, kind, member.id) });
    setDialog(null);
  }

  /**
   * Scala writes the rest of the story on the server, which saves it; then the editor
   * shows the updated book. Pending edits are saved first so Scala sees them.
   */
  async function finishWithAi() {
    if (!project) return;
    await studio.flush();
    const { project: updated, scenes: all, first_new_scene } = await scalaFinish(project.id);
    studio.replaceBook(updated, all);
    setSceneIndex(first_new_scene);
    setTab('script');
    setConfirmFinish(false);
  }

  function setBusyFor(sceneId: string, value: string | null) {
    setBusy((b) => {
      const next = { ...b };
      if (value) next[sceneId] = value;
      else delete next[sceneId];
      return next;
    });
  }

  /** Lays the scene out from its place and characters, drawing any that have no picture yet. */
  async function handleGenerate(target: StudioScene) {
    if (!project) return;
    const place = project.cast.places.find((p) => p.id === target.draft.placeId);
    if (!place) return;
    setGenError(null);
    setBusyFor(target.id, 'scene');
    try {
      const withArt = async (kind: CastKind, m: CastMember): Promise<CastMember> =>
        m.asset ? m : { ...m, asset: await drawMember(kind, m.name, m.description) };
      const [drawnPlace, ...drawnCharacters] = await Promise.all([
        withArt('place', place),
        ...sceneCharacters(target.draft, project.cast).map((c) => withArt('character', c)),
      ]);

      let cast = project.cast;
      if (drawnPlace !== place) cast = putMember(cast, 'place', drawnPlace);
      drawnCharacters.forEach((c) => { if (!project.cast.characters.includes(c)) cast = putMember(cast, 'character', c); });
      if (cast !== project.cast) studio.updateProject({ cast });

      const art = composeScene(
        { id: artId(drawnPlace, drawnPlace.asset!), asset: drawnPlace.asset!, prompt: drawnPlace.description },
        drawnCharacters.map((c) => ({ id: artId(c, c.asset!), asset: c.asset!, name: c.name })),
      );
      studio.updateScene(target.id, (d) => ({
        ...d, description: drawnPlace.description, layers: art.layers, assets: pruneAssets(art.layers, art.assets),
      }));
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed. Try again.');
    } finally {
      setBusyFor(target.id, null);
    }
  }

  async function handleReroll(target: StudioScene, layer: Layer) {
    if (!project) return;
    setGenError(null);
    setBusyFor(target.id, layer.id);
    try {
      const { assetId, asset } = await rerollLayer({
        projectId: project.id,
        sceneId: target.id,
        description: target.draft.description,
        layer,
      });
      studio.updateScene(target.id, (d) => {
        const layers = d.layers.map((l) => (l.id === layer.id ? { ...l, asset: assetId } : l));
        return { ...d, layers, assets: pruneAssets(layers, { ...d.assets, [assetId]: asset }) };
      });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Re-roll failed. Try again.');
    } finally {
      setBusyFor(target.id, null);
    }
  }

  async function handleAddScene() {
    const created = await studio.addScene();
    if (created) {
      setSceneIndex(scenes.length);
      setTab('script');
    }
  }

  async function handleDeleteScene(target: StudioScene) {
    await studio.deleteScene(target.id);
    setSceneIndex((i) => Math.max(0, Math.min(i, scenes.length - 2)));
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (!project) return <div className="empty"><p>{loadError ?? 'Project not found.'}</p></div>;

  const update = (fn: (d: SceneDraft) => SceneDraft) => scene && studio.updateScene(scene.id, fn);
  const isEpisodeTab = tab === 'details' || tab === 'cast' || EPISODE_TABS.some((t) => t.id === tab);

  return (
    <div className="studio-editor">
      <div className="editor-toolbar">
        <button className="back-btn" onClick={() => navigate('/studio')}>← Studio</button>
        <span className={`saving-indicator saving-indicator--${saveState}`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Not saved' : ''}
        </span>
      </div>

      <nav className="scene-strip" aria-label="Scenes">
        {scenes.map((s, i) => {
          const bg = s.draft.layers.find((l) => l.role === 'background');
          const thumb = bg ? s.draft.assets[bg.asset]?.url : undefined;
          return (
            <button
              key={s.id}
              className={`scene-thumb${i === sceneIndex && !isEpisodeTab ? ' is-active' : ''}`}
              style={thumb ? { backgroundImage: `url("${thumb}")` } : undefined}
              onClick={() => { setSceneIndex(i); if (isEpisodeTab) setTab('script'); }}
              aria-label={`Scene ${i + 1}`}
            >
              <span>{i + 1}</span>
              {busy[s.id] && <span className="scene-thumb-busy" aria-hidden />}
            </button>
          );
        })}
        <button className="scene-thumb scene-thumb--add" onClick={handleAddScene} aria-label="Add scene">+</button>
      </nav>

      {confirmFinish && (
        <ConfirmDialog
          title="Let Scala finish the book?"
          message={
            'Scala, our AI, writes the rest of the story from your title, description, cast and the scenes you’ve written, and gives it an ending. ' +
            'Scenes you’ve written stay as they are; empty scenes are filled and new ones are added' +
            (project.purpose === 'reading' ? '.' : ', with new words marked and a quiz drafted.') +
            ' New characters and places join the cast without pictures. You can edit everything.'
          }
          confirmLabel="✨ Yes, let Scala finish it"
          onConfirm={finishWithAi}
          onClose={() => setConfirmFinish(false)}
        />
      )}

      <div className="studio-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'details'} className={tab === 'details' ? 'is-active' : ''} onClick={() => setTab('details')}>
          {DETAILS_TAB.label}
        </button>
        <button role="tab" aria-selected={tab === 'cast'} className={tab === 'cast' ? 'is-active' : ''} onClick={() => setTab('cast')}>
          {CAST_TAB.label}
        </button>
        <span className="studio-tabs-divider" aria-hidden />
        {SCENE_TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)} disabled={!scene}>
            {t.label}
          </button>
        ))}
        <span className="studio-tabs-divider" aria-hidden />
        {EPISODE_TABS.filter((t) => !(t.id === 'quiz' && project.purpose === 'reading')).map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {genError && <p className="studio-error" role="alert">{genError}</p>}

      {!isEpisodeTab && !scene && (
        <div className="empty"><p>No scenes yet.</p><button className="buy-btn" onClick={handleAddScene}>+ Add scene</button></div>
      )}

      {!isEpisodeTab && scene && (
        <div className="studio-pane">
          <div className="studio-pane-header">
            <h2>Scene {sceneIndex + 1}</h2>
            {scenes.length > 1 && (
              <button className="ghost-btn ghost-btn--danger" onClick={() => handleDeleteScene(scene)}>Delete scene</button>
            )}
          </div>
          {tab === 'script' && (
            <ScriptTab
              key={scene.id}
              draft={scene.draft}
              cast={project.cast}
              onCreate={(kind, onCreated) => setDialog({ kind, onCreated })}
              level={project.purpose === 'reading' ? null : project.level}
              generating={busy[scene.id] === 'scene'}
              onChange={update}
              onGenerate={() => handleGenerate(scene)}
              onOpenPanel={() => setTab('panel')}
            />
          )}
          {tab === 'panel' && (
            <PanelTab
              draft={scene.draft}
              busyLayerId={busy[scene.id] && busy[scene.id] !== 'scene' ? busy[scene.id] : null}
              generating={busy[scene.id] === 'scene'}
              onChange={update}
              onReroll={(layer) => handleReroll(scene, layer)}
            />
          )}
          {tab === 'audio' && <AudioTab projectId={project.id} draft={scene.draft} onChange={update} />}
        </div>
      )}

      {tab === 'cast' && (
        <div className="studio-pane">
          <CastTab cast={project.cast} scenes={scenes.map((s) => s.draft)} onOpen={(kind, member) => setDialog({ kind, member })} />
        </div>
      )}
      {tab === 'quiz' && (
        <div className="studio-pane">
          <QuizTab quiz={project.quiz} onChange={(quiz) => studio.updateProject({ quiz })} />
        </div>
      )}
      {tab === 'details' && (
        <div className="studio-pane">
          <DetailsTab project={project} scenes={scenes} onUpdate={studio.updateProject} onScalaFinish={() => setConfirmFinish(true)} />
        </div>
      )}
      {tab === 'publish' && (
        <div className="studio-pane">
          <PublishTab
            project={project}
            scenes={scenes}
            onSubmit={studio.submit}
            onUnpublish={studio.unpublish}
            onJumpToScene={(i) => { setSceneIndex(i); setTab('script'); }}
          />
        </div>
      )}
      {dialog && (() => {
        const using = dialog.member ? usedIn(scenes.map((s) => s.draft), dialog.kind, dialog.member.id) : [];
        return (
          <CastDialog
            kind={dialog.kind}
            member={dialog.member}
            canGenerate={FEATURES.rendering}
            generate={(name, description, previous) => drawMember(dialog.kind, name, description, previous)}
            onSave={(m) => saveMember(dialog.kind, m)}
            onClose={() => setDialog(null)}
            onDelete={dialog.member ? () => deleteMember(dialog.kind, dialog.member!) : undefined}
            deleteBlocked={using.length ? `Used in scene ${using.join(', ')}. Change those first to delete it.` : undefined}
          />
        );
      })()}
    </div>
  );
}
