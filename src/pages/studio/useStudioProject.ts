import { useCallback, useEffect, useRef, useState } from 'react';
import { studioStore, type ReviewStatus, type Purpose } from '@/lib/studioStore';
import { adoptCast } from '@/lib/cast';
import { emptyCast, emptyScene, type Cast, type Level, type Package, type QuizItem, type SceneDraft } from '@/lib/format';

// Loads a Studio project and its scenes, and autosaves edits. Storage is the API for
// signed-in staff, or this device when the cloud Studio is off (src/lib/studioStore.ts). Everything pending is
// saved in one call, and failed saves stay pending until the next attempt.

export interface StudioProject {
  id: string;
  creator_id: string;
  type: 'comic' | 'book';
  title: string;
  description: string;
  level: Level;
  purpose: Purpose;
  status: 'draft' | 'published';
  review_status: ReviewStatus;
  review_note: string;
  quiz: QuizItem[];
  cast: Cast;
  manifest: Package | null;
}

export interface StudioScene {
  id: string;
  scene_number: number;
  draft: SceneDraft;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type EditableFields = Partial<Pick<StudioProject, 'title' | 'description' | 'level' | 'purpose' | 'quiz' | 'cast'>>;

interface SceneDto {
  id: string;
  scene_number: number;
  data: SceneDraft;
}

const SAVE_DELAY_MS = 600;

const toScene = (s: SceneDto): StudioScene => ({ id: s.id, scene_number: s.scene_number, draft: { ...emptyScene(), ...s.data } });

export function useStudioProject(id: string | undefined) {
  const [project, setProject] = useState<StudioProject | null>(null);
  const [scenes, setScenes] = useState<StudioScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const scenesRef = useRef<StudioScene[]>([]);
  const projectRef = useRef<StudioProject | null>(null);
  const dirtyScenes = useRef(new Set<string>());
  const dirtyProject = useRef<EditableFields>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setAllScenes = (list: StudioScene[]) => {
    scenesRef.current = list;
    setScenes(list);
  };
  const setCurrentProject = (p: StudioProject) => {
    projectRef.current = p;
    setProject(p);
  };

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const projectId = projectRef.current?.id;
    const sceneIds = [...dirtyScenes.current];
    const fields = dirtyProject.current;
    if (!projectId || (!sceneIds.length && !Object.keys(fields).length)) return;
    dirtyScenes.current.clear();
    dirtyProject.current = {};

    setSaveState('saving');
    try {
      await studioStore.save(projectId, {
        project: Object.keys(fields).length ? fields : undefined,
        scenes: scenesRef.current.filter((s) => sceneIds.includes(s.id)).map((s) => ({ id: s.id, data: s.draft })),
      });
      setSaveState('saved');
    } catch {
      // Keep the changes pending; the next edit or flush retries them.
      sceneIds.forEach((sid) => dirtyScenes.current.add(sid));
      dirtyProject.current = { ...fields, ...dirtyProject.current };
      setSaveState('error');
    }
  }, []);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, SAVE_DELAY_MS);
  }, [flush]);

  useEffect(() => {
    if (!id) return;
    studioStore.get(id)
      .then(({ project: p, scenes: s }) => {
        const loaded = s.map(toScene);
        const cast = p.cast ?? emptyCast();
        // Older drafts: turn typed scene descriptions and speaker names into the cast.
        const adopted = adoptCast(cast, loaded.map((x) => x.draft));
        if (adopted) {
          setCurrentProject({ ...p, cast: adopted.cast });
          setAllScenes(loaded.map((x, i) => ({ ...x, draft: adopted.scenes[i] })));
          dirtyProject.current.cast = adopted.cast;
          loaded.forEach((x) => dirtyScenes.current.add(x.id));
          schedule();
        } else {
          setCurrentProject({ ...p, cast });
          setAllScenes(loaded);
        }
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [id, schedule]);

  // Save anything pending when leaving the editor.
  useEffect(() => () => { void flush(); }, [flush]);

  const updateProject = useCallback((fields: EditableFields) => {
    if (!projectRef.current) return;
    setCurrentProject({ ...projectRef.current, ...fields });
    Object.assign(dirtyProject.current, fields);
    schedule();
  }, [schedule]);

  const updateScene = useCallback((sceneId: string, update: (draft: SceneDraft) => SceneDraft) => {
    setAllScenes(scenesRef.current.map((s) => (s.id === sceneId ? { ...s, draft: update(s.draft) } : s)));
    dirtyScenes.current.add(sceneId);
    schedule();
  }, [schedule]);

  const addScene = useCallback(async (): Promise<StudioScene | null> => {
    if (!id) return null;
    await flush();
    const scene = toScene(await studioStore.addScene(id));
    setAllScenes([...scenesRef.current, scene]);
    return scene;
  }, [id, flush]);

  const deleteScene = useCallback(async (sceneId: string) => {
    await flush();
    if (!id) return;
    await studioStore.deleteScene(id, sceneId);
    setAllScenes(scenesRef.current.filter((s) => s.id !== sceneId).map((s, i) => ({ ...s, scene_number: i + 1 })));
  }, [id, flush]);

  /** Saves pending edits, then sends the book for review. The server validates the package. */
  const submit = useCallback(async (pkg: Package) => {
    await flush();
    if (!projectRef.current) return;
    setCurrentProject(await studioStore.submit(projectRef.current.id, pkg));
  }, [flush]);

  const unpublish = useCallback(async () => {
    if (!projectRef.current) return;
    setCurrentProject(await studioStore.unpublish(projectRef.current.id));
  }, []);

  return {
    project, scenes, loading, loadError, saveState,
    updateProject, updateScene, addScene, deleteScene, submit, unpublish, flush,
  };
}
