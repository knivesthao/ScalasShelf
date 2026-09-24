import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGenerate } from '@/hooks/useGenerate';
import { FEATURES } from '@/lib/features';
import type { AssetRef, Layer, SceneDraft } from '@/lib/format';
import { useStudioProject, type StudioScene } from './useStudioProject';
import { ScriptTab } from './ScriptTab';
import { PanelTab } from './PanelTab';
import { AudioTab } from './AudioTab';
import { WordsTab } from './WordsTab';
import { QuizTab } from './QuizTab';
import { PublishTab } from './PublishTab';

type Tab = 'script' | 'panel' | 'audio' | 'words' | 'quiz' | 'publish';

const SCENE_TABS: { id: Tab; label: string }[] = [
  { id: 'script', label: 'Script' },
  // Art layout and voice recording need the rendering pipeline (FEATURES.rendering).
  ...(FEATURES.rendering ? [{ id: 'panel' as Tab, label: 'Panel' }, { id: 'audio' as Tab, label: 'Audio' }] : []),
  { id: 'words', label: 'Words' },
];
const EPISODE_TABS: { id: Tab; label: string }[] = [
  { id: 'quiz', label: 'Quiz' },
  { id: 'publish', label: 'Publish' },
];

/** Speakers with a character on screen (narration has no character). */
export function sceneCharacters(draft: SceneDraft): string[] {
  const names = draft.bubbles.filter((b) => b.style !== 'narration').map((b) => b.speaker.trim());
  return [...new Set(names.filter(Boolean))];
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
  const { generateScene, rerollLayer } = useGenerate();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [tab, setTab] = useState<Tab>('script');
  /** sceneId → 'scene' while the whole scene generates, or the layer id being re-rolled */
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [genError, setGenError] = useState<string | null>(null);

  const { project, scenes, loading, loadError, saveState } = studio;
  const scene: StudioScene | undefined = scenes[Math.min(sceneIndex, scenes.length - 1)];

  function setBusyFor(sceneId: string, value: string | null) {
    setBusy((b) => {
      const next = { ...b };
      if (value) next[sceneId] = value;
      else delete next[sceneId];
      return next;
    });
  }

  async function handleGenerate(target: StudioScene) {
    if (!project || !target.draft.description.trim()) return;
    setGenError(null);
    setBusyFor(target.id, 'scene');
    try {
      const art = await generateScene({
        projectId: project.id,
        sceneId: target.id,
        description: target.draft.description,
        characters: sceneCharacters(target.draft),
      });
      studio.updateScene(target.id, (d) => ({ ...d, layers: art.layers, assets: pruneAssets(art.layers, art.assets) }));
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
  const isEpisodeTab = EPISODE_TABS.some((t) => t.id === tab);

  return (
    <div className="studio-editor">
      <div className="editor-toolbar">
        <button className="back-btn" onClick={() => navigate('/studio')}>← Studio</button>
        <input
          className="title-input"
          aria-label="Title"
          value={project.title}
          onChange={(e) => studio.updateProject({ title: e.target.value })}
        />
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

      <div className="studio-tabs" role="tablist">
        {SCENE_TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-active' : ''}
            onClick={() => setTab(t.id)} disabled={!scene}>
            {t.label}
          </button>
        ))}
        <span className="studio-tabs-divider" aria-hidden />
        {EPISODE_TABS.map((t) => (
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
              draft={scene.draft}
              level={project.level}
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
          {tab === 'words' && <WordsTab draft={scene.draft} scenes={scenes} onChange={update} />}
        </div>
      )}

      {tab === 'quiz' && (
        <div className="studio-pane">
          <QuizTab scenes={scenes} quiz={project.quiz} onChange={(quiz) => studio.updateProject({ quiz })} />
        </div>
      )}
      {tab === 'publish' && (
        <div className="studio-pane">
          <PublishTab
            project={project}
            scenes={scenes}
            onUpdate={studio.updateProject}
            onPublish={studio.publish}
            onUnpublish={studio.unpublish}
            onJumpToScene={(i) => { setSceneIndex(i); setTab('script'); }}
          />
        </div>
      )}
    </div>
  );
}
