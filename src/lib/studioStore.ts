// Where the Studio keeps projects: the API for signed-in staff, or this device (IndexedDB)
// when the cloud Studio is switched off. Both backends expose the same functions, so the
// Studio doesn't care which. See FEATURES.cloudStudio.

import { api } from './api';
import { demoDraft } from './demoContent';
import { FEATURES } from './features';
import { emptyCast, emptyScene, type Cast, type Level, type Package, type QuizItem, type SceneDraft } from './format';

/** none → in_review (waiting for a reviewer) → changes_requested, or approved and published. */
export type ReviewStatus = 'none' | 'in_review' | 'changes_requested';

export interface ProjectCard {
  id: string;
  type: 'comic' | 'book';
  title: string;
  level: Level;
  status: 'draft' | 'published';
  review_status: ReviewStatus;
  created_at: string;
}

export interface ProjectData extends ProjectCard {
  creator_id: string;
  description: string;
  quiz: QuizItem[];
  /** Characters and places, reused across scenes. */
  cast: Cast;
  manifest: Package | null;
  /** The reviewer's note when changes were requested. */
  review_note: string;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export interface SceneData {
  id: string;
  scene_number: number;
  data: SceneDraft;
}

export interface SaveInput {
  project?: Partial<Pick<ProjectData, 'title' | 'description' | 'level' | 'quiz' | 'cast'>>;
  scenes?: { id: string; data: SceneDraft }[];
}

export interface StudioStore {
  list(): Promise<ProjectCard[]>;
  create(input: { title: string; level: Level }): Promise<ProjectData>;
  get(id: string): Promise<{ project: ProjectData; scenes: SceneData[] }>;
  save(id: string, input: SaveInput): Promise<void>;
  addScene(projectId: string): Promise<SceneData>;
  deleteScene(projectId: string, sceneId: string): Promise<void>;
  /** Sends the finished book to a reviewer. Only reviewers put books in the library. */
  submit(id: string, pkg: Package): Promise<ProjectData>;
  unpublish(id: string): Promise<ProjectData>;
}

// ---- Server (signed-in staff) ----

export const serverStore: StudioStore = {
  list: () => api.get('/studio/projects'),
  create: (input) => api.post('/studio/projects', input),
  get: (id) => api.get(`/studio/projects/${id}`),
  save: async (id, input) => { await api.put(`/studio/projects/${id}`, input); },
  addScene: (projectId) => api.post(`/studio/projects/${projectId}/scenes`),
  deleteScene: async (_projectId, sceneId) => { await api.delete(`/studio/scenes/${sceneId}`); },
  submit: (id, pkg) => api.post(`/studio/projects/${id}/submit`, pkg),
  unpublish: (id) => api.post(`/studio/projects/${id}/unpublish`),
};

// ---- This device (cloud Studio off) ----

interface LocalRecord {
  id: string;
  project: ProjectData;
  scenes: SceneData[];
}

const DB_NAME = 'textweaver-studio';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('projects', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function projects(mode: IDBTransactionMode = 'readonly') {
  return (await openDb()).transaction('projects', mode).objectStore('projects');
}

async function read(id: string): Promise<LocalRecord> {
  const rec = (await wrap((await projects()).get(id))) as LocalRecord | undefined;
  if (!rec) throw new Error('Project not found');
  return rec;
}

async function write(rec: LocalRecord): Promise<void> {
  await wrap((await projects('readwrite')).put(rec));
}

const newId = () => crypto.randomUUID();
const toCard = ({ id, type, title, level, status, review_status, created_at }: ProjectData): ProjectCard =>
  ({ id, type, title, level, status, review_status: review_status ?? 'none', created_at });
const LOCAL_REVIEW = { review_status: 'none', review_note: '', submitted_at: null, reviewed_at: null } as const;
/** Fields added after the first drafts were saved on devices. */
const localDefaults = () => ({ ...LOCAL_REVIEW, cast: emptyCast() });

/** First visit: start with the demo draft so the Studio isn't empty. */
async function seedIfEmpty(): Promise<void> {
  const count = await wrap((await projects()).count());
  if (count > 0) return;
  const draft = demoDraft();
  await write({
    id: draft.id,
    project: {
      id: draft.id, creator_id: 'this-device', type: 'comic', title: draft.title, description: draft.description,
      level: draft.level, status: 'draft', quiz: [], manifest: null, created_at: new Date().toISOString(), ...localDefaults(),
    },
    scenes: draft.scenes.map((data, i) => ({ id: `${draft.id}-s${i + 1}`, scene_number: i + 1, data })),
  });
}

export const deviceStore: StudioStore = {
  async list() {
    await seedIfEmpty();
    const all = (await wrap((await projects()).getAll())) as LocalRecord[];
    return all.map((r) => toCard(r.project)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async create({ title, level }) {
    const id = newId();
    const project: ProjectData = {
      id, creator_id: 'this-device', type: 'comic', title: title.trim(), description: '', level,
      status: 'draft', quiz: [], manifest: null, created_at: new Date().toISOString(), ...localDefaults(),
    };
    await write({ id, project, scenes: [{ id: newId(), scene_number: 1, data: emptyScene() }] });
    return project;
  },
  async get(id) {
    const { project, scenes } = await read(id);
    return { project: { ...localDefaults(), ...project }, scenes };
  },
  async save(id, input) {
    const rec = await read(id);
    if (input.project) rec.project = { ...rec.project, ...input.project };
    for (const s of input.scenes ?? []) {
      const scene = rec.scenes.find((x) => x.id === s.id);
      if (scene) scene.data = s.data;
    }
    await write(rec);
  },
  async addScene(projectId) {
    const rec = await read(projectId);
    const scene: SceneData = { id: newId(), scene_number: rec.scenes.length + 1, data: emptyScene() };
    rec.scenes.push(scene);
    await write(rec);
    return scene;
  },
  async deleteScene(projectId, sceneId) {
    const rec = await read(projectId);
    rec.scenes = rec.scenes.filter((s) => s.id !== sceneId).map((s, i) => ({ ...s, scene_number: i + 1 }));
    await write(rec);
  },
  async submit() {
    throw new Error('Sign in to send books for review.');
  },
  async unpublish(id) {
    return (await read(id)).project;
  },
};

export const studioStore: StudioStore = FEATURES.cloudStudio ? serverStore : deviceStore;
