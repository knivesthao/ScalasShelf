// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildPackage, type SceneDraft } from '../../src/lib/format';
import { testApi } from './testing';

function withArt(data: SceneDraft): SceneDraft {
  return {
    ...data,
    assets: { bg1: { url: '/demo-art/bg-ricefield-sunrise.webp' } },
    layers: [{ id: 'l1', asset: 'bg1', role: 'background', x: 0, y: 0, w: 1, z: 0 }],
  };
}

describe('library (public)', () => {
  it('lists published books to anyone, with the full package', async () => {
    const { call } = await testApi();
    const books = (await call('GET', '/books')).json;
    expect(books).toMatchObject([
      { id: 'book-demo-noy', title: 'Noy and the Buffalo', level: 'A1' },
      { id: 'book-demo-market', title: 'Morning Market', level: 'A1' },
    ]);
    const book = (await call('GET', '/books/book-demo-market')).json;
    expect(book.package.text.vocab.map((v: { headword: string }) => v.headword)).toEqual(['market', 'sweet', 'morning', 'mango', 'please', 'thank you']);
    expect(book.package.text.quiz.length).toBeGreaterThanOrEqual(3);
    expect((await call('GET', '/books/nope')).status).toBe(404);
  });

  it('filters by level', async () => {
    const { call } = await testApi();
    expect((await call('GET', '/books?level=B1')).json).toEqual([]);
    expect((await call('GET', '/books?level=A1')).json).toHaveLength(2);
  });

  it('is empty without the demo seed', async () => {
    const { call } = await testApi({ seed: false });
    expect((await call('GET', '/books')).json).toEqual([]);
  });
});

describe('studio projects', () => {
  it('lists only the caller’s projects', async () => {
    const { call } = await testApi();
    const mine = await call('GET', '/studio/projects');
    expect(mine.json.map((p: { title: string }) => p.title)).toEqual(['Noy and the Buffalo', 'Morning Market']);
    expect((await call('GET', '/studio/projects', { user: 'someone-else' })).json).toEqual([]);
  });

  it('creates a project with a first empty scene, and no price', async () => {
    const { call } = await testApi({ seed: false });
    const created = await call('POST', '/studio/projects', { body: { title: '  Market Day ', level: 'A2' } });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ title: 'Market Day', level: 'A2', status: 'draft', quiz: [], manifest: null });
    expect(created.json).not.toHaveProperty('price_kip');
    const loaded = await call('GET', `/studio/projects/${created.json.id}`);
    expect(loaded.json.scenes).toHaveLength(1);
    expect(loaded.json.scenes[0].data).toMatchObject({ layers: [], bubbles: [] });
  });

  it('rejects bad input', async () => {
    const { call } = await testApi();
    expect((await call('POST', '/studio/projects', { body: { title: '' } })).status).toBe(400);
    expect((await call('PUT', '/studio/projects/demo-noy', { body: { project: { level: 'C9' } } })).status).toBe(400);
    expect((await call('PUT', '/studio/projects/demo-noy', { body: { scenes: [{ id: 'demo-noy-s1', data: { nope: 1 } }] } })).status).toBe(400);
  });

  it('keeps other people out of a project', async () => {
    const { call } = await testApi();
    expect((await call('GET', '/studio/projects/demo-noy', { user: 'intruder' })).status).toBe(403);
    expect((await call('PUT', '/studio/projects/demo-noy', { user: 'intruder', body: { project: { title: 'Mine now' } } })).status).toBe(403);
    expect((await call('DELETE', '/studio/scenes/demo-noy-s1', { user: 'intruder' })).status).toBe(403);
  });

  it('saves project fields and scene drafts in one request', async () => {
    const { call } = await testApi();
    const before = (await call('GET', '/studio/projects/demo-noy')).json;
    const data = { ...before.scenes[0].data, description: 'A new description' };
    const quiz = [{ id: 'q1', type: 'meaning', prompt: 'late', options: ['not on time', 'early'], answer: 0 }];
    expect((await call('PUT', '/studio/projects/demo-noy', { body: { project: { title: 'Noy Is Late', quiz }, scenes: [{ id: before.scenes[0].id, data }] } })).status).toBe(200);
    const after = (await call('GET', '/studio/projects/demo-noy')).json;
    expect(after.project).toMatchObject({ title: 'Noy Is Late', quiz });
    expect(after.scenes[0].data.description).toBe('A new description');
  });

  it('adds scenes at the end and renumbers after a delete', async () => {
    const { call } = await testApi();
    const added = await call('POST', '/studio/projects/demo-noy/scenes');
    expect(added.json.scene_number).toBe(4);
    await call('DELETE', '/studio/scenes/demo-noy-s2');
    const scenes = (await call('GET', '/studio/projects/demo-noy')).json.scenes;
    expect(scenes.map((s: { scene_number: number }) => s.scene_number)).toEqual([1, 2, 3]);
    expect(scenes.map((s: { id: string }) => s.id)).toEqual(['demo-noy-s1', 'demo-noy-s3', added.json.id]);
  });
});

describe('publishing', () => {
  async function publishable() {
    const api = await testApi();
    const { project, scenes } = (await api.call('GET', '/studio/projects/demo-noy')).json;
    const drafts = scenes.map((s: { data: SceneDraft }) => withArt(s.data));
    const pkg = buildPackage({ id: project.id, title: project.title, level: project.level }, drafts, []);
    return { ...api, pkg };
  }

  it('puts the episode in the public library and queues the packager', async () => {
    const { call, raw, pkg } = await publishable();
    const res = await call('POST', '/studio/projects/demo-noy/publish', { body: pkg });
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('published');
    expect(res.json.manifest.manifest.format).toBe('textweaver.motion-comic/2');

    const books = (await call('GET', '/books')).json;
    expect(books.map((b: { title: string }) => b.title).sort()).toEqual(['Morning Market', 'Noy and the Buffalo']);
    const noy = books.find((b: { title: string }) => b.title === 'Noy and the Buffalo');
    expect(noy).toMatchObject({ level: 'A1', reading_level: 'beginner', cover_url: '/demo-art/bg-ricefield-sunrise.webp' });
    const book = (await call('GET', `/books/${noy.id}`, { user: '' })).json;
    expect(book.package.manifest.editions.lite.chunks).toHaveLength(1);

    const jobs = raw.prepare(`SELECT kind, status FROM jobs`).all();
    expect(jobs).toEqual([{ kind: 'package', status: 'queued' }]);
  });

  it('refuses an invalid package', async () => {
    const { call, pkg } = await publishable();
    pkg.manifest.editions.lite.assets = {};
    const res = await call('POST', '/studio/projects/demo-noy/publish', { body: pkg });
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/image bg1 is missing/);
  });

  it('back to draft removes it from the library', async () => {
    const { call, pkg } = await publishable();
    await call('POST', '/studio/projects/demo-noy/publish', { body: pkg });
    expect((await call('POST', '/studio/projects/demo-noy/unpublish')).json.status).toBe('draft');
    expect((await call('GET', '/books')).json.map((b: { title: string }) => b.title)).toEqual(['Morning Market']);
  });
});

describe('audio', () => {
  it('stores recordings privately for the project’s creator', async () => {
    const { call } = await testApi();
    const up = await call('POST', '/studio/projects/demo-noy/audio?bubble=b_demo1', { raw: new Uint8Array([1, 2, 3]), headers: { 'content-type': 'audio/webm' } });
    expect(up.status).toBe(201);
    expect(up.json.key).toMatch(/^audio\/demo-noy\/b_demo1-\d+\.webm$/);

    expect((await call('GET', `/files/${up.json.key}`)).status).toBe(200);
    expect((await call('GET', `/files/${up.json.key}`, { user: 'intruder' })).status).toBe(403);
    expect((await call('GET', '/files/../secrets')).status).toBe(404);
    await call('DELETE', `/files/${up.json.key}`);
    expect((await call('GET', `/files/${up.json.key}`)).status).toBe(404);
  });

  it('rejects non-audio uploads', async () => {
    const { call } = await testApi();
    const res = await call('POST', '/studio/projects/demo-noy/audio', { raw: 'hi', headers: { 'content-type': 'text/plain' } });
    expect(res.status).toBe(400);
  });
});

describe('cloud jobs', () => {
  it('runs a job from the Studio through the GPU worker', async () => {
    const { call } = await testApi();
    const queued = await call('POST', '/render', { body: { kind: 'scene', payload: { project_id: 'demo-noy', description: 'rice field' } } });
    expect(queued.status).toBe(201);
    expect((await call('GET', `/render/${queued.json.job_id}`)).json.status).toBe('queued');

    const worker = { authorization: 'Bearer test-secret' };
    expect((await call('POST', '/worker/jobs/claim')).status).toBe(401);
    const claimed = await call('POST', '/worker/jobs/claim', { headers: worker });
    expect(claimed.json.job).toMatchObject({ id: queued.json.job_id, kind: 'scene', status: 'running' });
    expect((await call('POST', '/worker/jobs/claim', { headers: worker })).json.job).toBeNull();

    await call('POST', `/worker/jobs/${queued.json.job_id}/finish`, { headers: worker, body: { result: { layers: [], assets: {} } } });
    expect((await call('GET', `/render/${queued.json.job_id}`)).json).toMatchObject({ status: 'complete', result: { layers: [] } });
    expect((await call('GET', `/render/${queued.json.job_id}`, { user: 'intruder' })).status).toBe(404);
  });

  it('only queues jobs for your own projects', async () => {
    const { call } = await testApi();
    const res = await call('POST', '/render', { user: 'intruder', body: { kind: 'scene', payload: { project_id: 'demo-noy' } } });
    expect(res.status).toBe(403);
  });
});
