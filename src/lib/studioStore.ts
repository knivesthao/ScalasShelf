// Where the Studio keeps projects: the API for signed-in staff, or this device (IndexedDB)
// when the cloud Studio is switched off. Both backends expose the same functions, so the
// Studio doesn't care which. See FEATURES.cloudStudio.

import { api } from './api';
import { demoDraft } from './demoContent';
import { FEATURES } from './features';
import { emptyCast, emptyScene, type Cast, type Level, type Package, type QuizItem, type SceneDraft } from './format';

/** none → in_review (waiting for a reviewer) → changes_requested, or approved and published. */
export type ReviewStatus = 'none' | 'in_review' | 'changes_requested';
/** Learning books teach English (level, new words, quiz); reading books are just for reading. */
export type Purpose = 'learning' | 'reading';

export interface NewProject {
  title: string;
  level: Level;
  purpose: Purpose;
  description?: string;
}

export interface ProjectCard {
  id: string;
  type: 'comic' | 'book';
  title: string;
  level: Level;
  purpose: Purpose;
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
  project?: Partial<Pick<ProjectData, 'title' | 'description' | 'level' | 'purpose' | 'quiz' | 'cast'>>;
  scenes?: { id: string; data: SceneDraft }[];
}

export interface StudioStore {
  list(): Promise<ProjectCard[]>;
  create(input: NewProject): Promise<ProjectData>;
  get(id: string): Promise<{ project: ProjectData; scenes: SceneData[] }>;
  save(id: string, input: SaveInput): Promise<void>;
  /** Deletes a draft. Books on Scala’s Shelf have to be taken off first. */
  remove(id: string): Promise<void>;
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
  remove: async (id) => { await api.delete(`/studio/projects/${id}`); },
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
    req.onsuccess = () => {
      // Let a future version in another tab upgrade this database: close and reopen on next use.
      req.result.onversionchange = () => { req.result.close(); dbPromise = null; };
      resolve(req.result);
    };
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
const toCard = ({ id, type, title, level, purpose, status, review_status, created_at }: ProjectData): ProjectCard =>
  ({ id, type, title, level, purpose: purpose ?? 'learning', status, review_status: review_status ?? 'none', created_at });
const LOCAL_REVIEW = { review_status: 'none', review_note: '', submitted_at: null, reviewed_at: null } as const;
/** Fields added after the first drafts were saved on devices. */
const localDefaults = () => ({ ...LOCAL_REVIEW, cast: emptyCast() });

/** First visit: start with the demo draft so the Studio isn't empty. */
const SEEDED_KEY = 'studio-demo-seeded';

async function seedIfEmpty(): Promise<void> {
  // Only once per device, so deleting every draft doesn't bring the demo back.
  try { if (localStorage.getItem(SEEDED_KEY)) return; } catch { /* private mode: seed as before */ }
  const count = await wrap((await projects()).count());
  try { localStorage.setItem(SEEDED_KEY, '1'); } catch { /* private mode */ }
  if (count > 0) return;
  const draft = demoDraft();
  await write({
    id: draft.id,
    project: {
      id: draft.id, creator_id: 'this-device', type: 'comic', title: draft.title, description: draft.description,
      level: draft.level, purpose: 'learning', status: 'draft', quiz: [], manifest: null, created_at: new Date().toISOString(), ...localDefaults(),
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
  async create({ title, level, purpose, description = '' }) {
    const id = newId();
    const project: ProjectData = {
      id, creator_id: 'this-device', type: 'comic', title: title.trim(), description: description.trim(), level, purpose,
      status: 'draft', quiz: [], manifest: null, created_at: new Date().toISOString(), ...localDefaults(),
    };
    await write({ id, project, scenes: [{ id: newId(), scene_number: 1, data: emptyScene() }] });
    return project;
  },
  async get(id) {
    const { project, scenes } = await read(id);
    return { project: { ...localDefaults(), ...project, purpose: project.purpose ?? 'learning' }, scenes };
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
  async remove(id) {
    await wrap((await projects('readwrite')).delete(id));
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

// ---- Guests ----
// Visitors who aren't signed in can try the Studio as a guest: it runs the on-device
// store, so drafts stay in their browser and nothing can be sent for review or published.

const GUEST_KEY = 'textweaver-studio-guest';

function readGuest(): boolean {
  try {
    return localStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
}

let guest = readGuest();

export const isGuest = () => guest;

export function setGuest(on: boolean): void {
  guest = on;
  try {
    if (on) localStorage.setItem(GUEST_KEY, '1');
    else localStorage.removeItem(GUEST_KEY);
  } catch {
    // Storage can be blocked (private windows); guest mode then lasts until the page reloads.
  }
}

/** True when the Studio saves to the server: the cloud Studio is on and this isn't a guest. */
export const cloudActive = () => FEATURES.cloudStudio && !guest;

const active = (): StudioStore => (cloudActive() ? serverStore : deviceStore);

export const studioStore: StudioStore = {
  list: () => active().list(),
  create: (input) => active().create(input),
  get: (id) => active().get(id),
  save: (id, input) => active().save(id, input),
  remove: (id) => active().remove(id),
  addScene: (projectId) => active().addScene(projectId),
  deleteScene: (projectId, sceneId) => active().deleteScene(projectId, sceneId),
  submit: (id, pkg) => active().submit(id, pkg),
  unpublish: (id) => active().unpublish(id),
};

// ---- Moving guest drafts into a staff account ----

/** True when a demo draft was never touched, so there's nothing of the writer's in it. */
function untouchedDemo(rec: LocalRecord): boolean {
  const demo = demoDraft();
  return rec.id === demo.id && rec.project.title === demo.title
    && JSON.stringify(rec.scenes.map((s) => s.data)) === JSON.stringify(demo.scenes);
}

/**
 * After a staff sign-in: copies every draft made on this device (as a guest) into the
 * account, then deletes it from the device, so signing out leaves nothing behind.
 * A draft that fails to copy stays on the device and is tried again next time.
 * Returns how many drafts moved.
 */
let moving: Promise<number> | null = null;

export function moveDeviceDraftsToAccount(): Promise<number> {
  // One move at a time (React runs effects twice in development), so nothing is copied twice.
  moving ??= moveAll().finally(() => { moving = null; });
  return moving;
}

async function moveAll(): Promise<number> {
  const records = (await wrap((await projects()).getAll())) as LocalRecord[];
  let moved = 0;
  for (const rec of records) {
    if (untouchedDemo(rec)) {
      await deviceStore.remove(rec.id);
      continue;
    }
    const p: ProjectData = { ...localDefaults(), ...rec.project };
    let created: ProjectData | null = null;
    try {
      created = await serverStore.create({
        title: p.title.trim() || 'Untitled', level: p.level, purpose: p.purpose ?? 'learning', description: p.description,
      });
      // A new project starts with one scene; add the rest, then save everything in one go.
      const { scenes: [first] } = await serverStore.get(created.id);
      const ordered = [...rec.scenes].sort((a, b) => a.scene_number - b.scene_number);
      const ids = [first.id];
      for (let i = 1; i < ordered.length; i++) ids.push((await serverStore.addScene(created.id)).id);
      await serverStore.save(created.id, {
        project: { cast: p.cast ?? emptyCast(), quiz: p.quiz ?? [] },
        scenes: ordered.map((s, i) => ({ id: ids[i], data: s.data })),
      });
      await deviceStore.remove(rec.id);
      moved++;
    } catch (e) {
      // Don't leave half a copy in the account; the device copy is kept for next time.
      if (created) await serverStore.remove(created.id).catch(() => {});
      console.error(`Couldn’t move the draft “${p.title}” to your account`, e);
    }
  }
  return moved;
}
