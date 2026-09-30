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

  it('answers on /api/v1 and on the older /api paths', async () => {
    const { app } = await testApi();
    const v1 = await app.request('/api/v1/books');
    const legacy = await app.request('/api/books');
    expect(v1.status).toBe(200);
    expect(await v1.json()).toEqual(await legacy.json());
    expect((await app.request('/api/v1/nope')).status).toBe(404);
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
    expect((await call('GET', '/studio/projects', { user: 'writer@example.org' })).json).toEqual([]);
    expect((await call('GET', '/studio/projects', { user: 'not-staff' })).status).toBe(403);
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
    expect((await call('PUT', '/studio/projects/demo-noy', { body: { project: { cast: { characters: [{ name: 'x' }], places: [] } } } })).status).toBe(400);
    expect((await call('PUT', '/studio/projects/demo-noy', { body: { project: { cast: [] } } })).status).toBe(400);
  });

  it('saves the cast (characters and places), starting empty', async () => {
    const { call } = await testApi();
    expect((await call('GET', '/studio/projects/demo-noy')).json.project.cast).toEqual({ characters: [], places: [] });
    const cast = {
      characters: [{ id: 'c1', name: 'Noy', description: 'a girl in a blue shirt', asset: { url: 'noy.webp' } }],
      places: [{ id: 'p1', name: 'The market', description: 'stalls and umbrellas' }],
    };
    expect((await call('PUT', '/studio/projects/demo-noy', { body: { project: { cast } } })).status).toBe(200);
    expect((await call('GET', '/studio/projects/demo-noy')).json.project.cast).toEqual(cast);
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

describe('review before publishing', () => {
  async function submittable() {
    const api = await testApi();
    api.raw.prepare(`DELETE FROM books WHERE project_id = 'demo-noy'`).run();
    api.raw.prepare(`UPDATE projects SET status = 'draft' WHERE id = 'demo-noy'`).run();
    const { project, scenes } = (await api.call('GET', '/studio/projects/demo-noy')).json;
    // Save the scenes with art: the server builds the package from what's saved.
    const drafts = scenes.map((s: { data: SceneDraft }) => withArt(s.data));
    await api.call('PUT', '/studio/projects/demo-noy', { body: { scenes: scenes.map((s: { id: string }, i: number) => ({ id: s.id, data: drafts[i] })) } });
    const pkg = buildPackage({ id: project.id, title: project.title, level: project.level }, drafts, []);
    const titles = async () => (await api.call('GET', '/books', { user: '' })).json.map((b: { title: string }) => b.title).sort();
    return { ...api, pkg, scenes, drafts, titles };
  }

  it('creators can no longer publish directly', async () => {
    const { call, pkg } = await submittable();
    expect((await call('POST', '/studio/projects/demo-noy/publish', { body: pkg })).status).toBe(404);
  });

  it('submitting puts the book in the review queue, not the library', async () => {
    const { call, pkg, titles } = await submittable();
    const res = await call('POST', '/studio/projects/demo-noy/submit', { body: pkg });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ status: 'draft', review_status: 'in_review' });
    expect(res.json.pending_package).toBeUndefined();
    expect(await titles()).toEqual(['Morning Market']);

    const queue = (await call('GET', '/review/queue', { user: 'demo-reviewer' })).json;
    expect(queue.map((p: { id: string }) => p.id)).toEqual(['demo-noy']);
    const item = (await call('GET', '/review/projects/demo-noy', { user: 'demo-reviewer' })).json;
    expect(item.package.manifest.id).toBe('demo-noy');
  });

  it('approving publishes the exact submitted book and records the reviewer', async () => {
    const { call, raw, pkg, titles } = await submittable();
    await call('POST', '/studio/projects/demo-noy/submit', { body: pkg });
    const res = await call('POST', '/review/projects/demo-noy/approve', { user: 'demo-reviewer' });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ status: 'published', review_status: 'none' });
    expect(res.json.manifest.manifest.format).toBe('textweaver.motion-comic/2');
    expect(await titles()).toEqual(['Morning Market', 'Noy and the Buffalo']);
    expect(raw.prepare(`SELECT reviewed_by, creator_id FROM projects WHERE id = 'demo-noy'`).get())
      .toEqual({ reviewed_by: 'demo-reviewer', creator_id: 'demo-creator' });
    expect(raw.prepare(`SELECT kind, status FROM jobs`).all()).toEqual([{ kind: 'package', status: 'queued' }]);
  });

  it('requesting changes sends the book back with a note', async () => {
    const { call, pkg, titles } = await submittable();
    await call('POST', '/studio/projects/demo-noy/submit', { body: pkg });
    expect((await call('POST', '/review/projects/demo-noy/request-changes', { user: 'demo-reviewer', body: { note: '' } })).status).toBe(400);
    const res = await call('POST', '/review/projects/demo-noy/request-changes', { user: 'demo-reviewer', body: { note: 'Scene 2: simplify “buffalo”.' } });
    expect(res.json).toMatchObject({ review_status: 'changes_requested', review_note: 'Scene 2: simplify “buffalo”.' });
    expect((await call('GET', '/studio/projects/demo-noy')).json.project.review_note).toBe('Scene 2: simplify “buffalo”.');
    expect((await call('GET', '/review/queue', { user: 'demo-reviewer' })).json).toEqual([]);
    expect(await titles()).toEqual(['Morning Market']);
  });

  it('only reviewers and admins can review', async () => {
    const { call, pkg } = await submittable();
    await call('POST', '/studio/projects/demo-noy/submit', { body: pkg });
    expect((await call('GET', '/review/queue')).status).toBe(403);
    expect((await call('POST', '/review/projects/demo-noy/approve')).status).toBe(403);
    expect((await call('GET', '/review/queue', { user: 'yee@admais.xyz' })).status).toBe(200);
  });

  it('builds the book itself and refuses one that fails the checklist', async () => {
    const { call, scenes, drafts } = await submittable();
    const broken = { ...drafts[0], bubbles: drafts[0].bubbles.map((b: SceneDraft['bubbles'][number], i: number) => (i === 0 ? { ...b, text: { en: '' } } : b)) };
    await call('PUT', '/studio/projects/demo-noy', { body: { scenes: [{ id: scenes[0].id, data: broken }] } });
    // Whatever package a phone sends is ignored: the server builds its own.
    const res = await call('POST', '/studio/projects/demo-noy/submit', { body: { manifest: 'anything' } });
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/Scene 1: .* is empty/);
  });

  it('back to draft removes it from the library; reviewers can pull any book', async () => {
    const { call, pkg, titles } = await submittable();
    await call('POST', '/studio/projects/demo-noy/submit', { body: pkg });
    await call('POST', '/review/projects/demo-noy/approve', { user: 'demo-reviewer' });
    expect((await call('POST', '/studio/projects/demo-noy/unpublish', { user: 'writer@example.org' })).status).toBe(403);
    expect((await call('POST', '/studio/projects/demo-noy/unpublish', { user: 'demo-reviewer' })).json.status).toBe('draft');
    expect(await titles()).toEqual(['Morning Market']);
  });
});

describe('staff sign-in', () => {
  async function session() {
    const api = await testApi({ auth: 'session' });
    const post = (path: string, body: unknown, cookie?: string) => api.app.request(`/api${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
    });
    const tokenFrom = (text: string) => decodeURIComponent(/token=([^&\s]+)/.exec(text)?.[1] ?? '');
    return { ...api, post, tokenFrom };
  }

  it('emails a link to staff, and the link starts a session', async () => {
    const { app, post, sent, tokenFrom } = await session();
    const res = await post('/auth/request', { email: ' Writer@Example.org ', next: '/studio/review' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('writer@example.org');
    expect(sent[0].text).toContain('next=%2Fstudio%2Freview');

    const verify = await post('/auth/verify', { token: tokenFrom(sent[0].text) });
    expect(verify.status).toBe(200);
    const cookie = verify.headers.get('set-cookie')!;
    expect(cookie).toMatch(/tw_session=.+; Path=\/; HttpOnly; SameSite=Lax/);
    expect(cookie).toContain('Secure');

    const sessionCookie = cookie.split(';')[0];
    const me = await (await app.request('/api/auth/me', { headers: { cookie: sessionCookie } })).json();
    expect(me.user).toEqual({ email: 'writer@example.org', name: 'Writer', role: 'creator' });
    expect((await app.request('/api/studio/projects', { headers: { cookie: sessionCookie } })).status).toBe(200);

    await post('/auth/sign-out', {}, sessionCookie);
    expect((await app.request('/api/studio/projects', { headers: { cookie: sessionCookie } })).status).toBe(401);
  });

  it('refuses people who aren’t staff, and reused links', async () => {
    const { post, sent, tokenFrom } = await session();
    expect((await post('/auth/request', { email: 'stranger@example.org' })).status).toBe(403);
    expect(sent).toHaveLength(0);
    await post('/auth/request', { email: 'writer@example.org' });
    const token = tokenFrom(sent[0].text);
    expect((await post('/auth/verify', { token })).status).toBe(200);
    expect((await post('/auth/verify', { token })).status).toBe(400);
  });

  it('limits outstanding links, and refuses cross-site requests', async () => {
    const { app, post } = await session();
    for (let i = 0; i < 3; i++) expect((await post('/auth/request', { email: 'writer@example.org' })).status).toBe(200);
    expect((await post('/auth/request', { email: 'writer@example.org' })).status).toBe(400);
    const crossSite = await app.request('http://localhost/api/auth/request', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: JSON.stringify({ email: 'writer@example.org' }),
    });
    expect(crossSite.status).toBe(403);
  });

  it('removing someone from the staff list ends their access at once', async () => {
    const { app, post, raw, sent, tokenFrom } = await session();
    await post('/auth/request', { email: 'writer@example.org' });
    const cookie = (await post('/auth/verify', { token: tokenFrom(sent[0].text) })).headers.get('set-cookie')!.split(';')[0];
    raw.prepare(`DELETE FROM staff WHERE email = 'writer@example.org'`).run();
    expect((await app.request('/api/studio/projects', { headers: { cookie } })).status).toBe(401);
  });
});

describe('staff list (admins)', () => {
  it('admins add, change and remove staff; others can’t', async () => {
    const { call } = await testApi();
    expect((await call('GET', '/admin/staff')).status).toBe(403);
    const admin = 'yee@admais.xyz';
    const added = await call('POST', '/admin/staff', { user: admin, body: { email: 'Didy@Example.org', name: 'Didy', role: 'reviewer' } });
    expect(added.json).toEqual({ email: 'didy@example.org', name: 'Didy', role: 'reviewer' });
    expect((await call('POST', '/admin/staff', { user: admin, body: { email: 'x@example.org', role: 'owner' } })).status).toBe(400);
    expect((await call('GET', '/admin/staff', { user: admin })).json.map((s: { email: string }) => s.email)).toContain('didy@example.org');
    expect((await call('DELETE', '/admin/staff/didy%40example.org', { user: admin })).status).toBe(200);
    expect((await call('DELETE', `/admin/staff/${encodeURIComponent(admin)}`, { user: admin })).status).toBe(400);
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
