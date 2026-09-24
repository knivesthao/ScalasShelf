import { Hono, type Context } from 'hono';
import { BadRequest, Forbidden, NotFound, Unauthorized } from './errors';
import type { Platform } from './platform';
import { getBook, listBooks } from './services/books';
import { claimNextJob, finishJob, getJob, queueJob } from './services/jobs';
import {
  addScene, assertOwnsProject, createProject, deleteScene, getProject, listProjects,
  publishProject, saveProject, unpublishProject, type SaveInput,
} from './services/studio';
import type { Package } from '../../src/lib/format';

// Routes only: read the request, call a service, return JSON. Business rules live in
// ./services so the framework stays swappable (docs/plans/MVP.md → Decisions → Backend).

type Env = { Variables: { userId: string | null } };

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

async function body<T>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new BadRequest('Expected a JSON body');
  }
}

function requireUser(c: Context<Env>): string {
  const id = c.get('userId');
  if (!id) throw new Unauthorized('Sign in to use the Studio');
  return id;
}

export function createApp(platform: Platform) {
  const { db, files, auth } = platform;
  const app = new Hono<Env>().basePath('/api');

  app.onError((err, c) => {
    if (err instanceof BadRequest) return c.json({ error: err.message }, 400);
    if (err instanceof Unauthorized) return c.json({ error: err.message }, 401);
    if (err instanceof Forbidden) return c.json({ error: err.message }, 403);
    if (err instanceof NotFound) return c.json({ error: err.message }, 404);
    console.error(err);
    return c.json({ error: 'Something went wrong' }, 500);
  });

  app.use('*', async (c, next) => {
    c.set('userId', await auth.userId(c.req.raw));
    await next();
  });

  app.get('/health', (c) => c.json({ ok: true }));

  // ---- Library (public: reading needs no account) ----

  app.get('/books', async (c) => c.json(await listBooks(db, { level: c.req.query('level') })));
  app.get('/books/:id', async (c) => c.json(await getBook(db, c.req.param('id'))));

  // ---- Studio ----

  app.get('/studio/projects', async (c) => c.json(await listProjects(db, requireUser(c))));
  app.post('/studio/projects', async (c) => c.json(await createProject(db, requireUser(c), await body(c)), 201));
  app.get('/studio/projects/:id', async (c) => c.json(await getProject(db, requireUser(c), c.req.param('id'))));
  app.put('/studio/projects/:id', async (c) => {
    await saveProject(db, requireUser(c), c.req.param('id'), await body<SaveInput>(c));
    return c.json({ ok: true });
  });
  app.post('/studio/projects/:id/scenes', async (c) => c.json(await addScene(db, requireUser(c), c.req.param('id')), 201));
  app.delete('/studio/scenes/:id', async (c) => {
    await deleteScene(db, requireUser(c), c.req.param('id'));
    return c.json({ ok: true });
  });
  app.post('/studio/projects/:id/publish', async (c) =>
    c.json(await publishProject(db, requireUser(c), c.req.param('id'), await body<Package>(c))));
  app.post('/studio/projects/:id/unpublish', async (c) =>
    c.json(await unpublishProject(db, requireUser(c), c.req.param('id'))));

  // Voice recordings: raw audio body, stored under audio/<project>/…
  app.post('/studio/projects/:id/audio', async (c) => {
    const userId = requireUser(c);
    const projectId = c.req.param('id');
    await assertOwnsProject(db, userId, projectId);
    const type = c.req.header('content-type') ?? '';
    if (!type.startsWith('audio/')) throw new BadRequest('Expected an audio file');
    const audio = await c.req.arrayBuffer();
    if (!audio.byteLength || audio.byteLength > MAX_AUDIO_BYTES) throw new BadRequest('Recording is empty or too long');
    const bubble = (c.req.query('bubble') ?? 'line').replace(/[^\w-]/g, '').slice(0, 40);
    const key = `audio/${projectId}/${bubble}-${Date.now()}.webm`;
    await files.put(key, audio, type);
    return c.json({ key }, 201);
  });

  // Draft audio is private to the project's creator.
  async function audioKey(c: Context<Env>): Promise<string> {
    const key = c.req.path.replace(/^\/api\/files\//, '');
    const [area, projectId] = key.split('/');
    if (area !== 'audio' || !projectId || key.includes('..')) throw new NotFound('File not found');
    await assertOwnsProject(db, requireUser(c), projectId);
    return key;
  }

  app.get('/files/*', async (c) => {
    const file = await files.get(await audioKey(c));
    if (!file) throw new NotFound('File not found');
    return new Response(file.body as BodyInit, { headers: { 'content-type': file.contentType, 'cache-control': 'private, max-age=3600' } });
  });
  app.delete('/files/*', async (c) => {
    await files.delete(await audioKey(c));
    return c.json({ ok: true });
  });

  // ---- Cloud jobs (Studio side) ----

  app.post('/render', async (c) => {
    const { kind, payload } = await body<{ kind: unknown; payload: Record<string, unknown> }>(c);
    return c.json({ job_id: await queueJob(db, requireUser(c), kind, payload ?? {}), status: 'queued' }, 201);
  });
  app.get('/render/:id', async (c) => {
    const job = await getJob(db, requireUser(c), c.req.param('id'));
    return c.json({ status: job.status, result: job.result, error_message: job.error });
  });

  // ---- Cloud jobs (GPU worker side, shared secret) ----

  app.use('/worker/*', async (c, next) => {
    const secret = platform.workerSecret;
    if (!secret || c.req.header('authorization') !== `Bearer ${secret}`) throw new Unauthorized('Worker only');
    await next();
  });
  app.post('/worker/jobs/claim', async (c) => c.json({ job: await claimNextJob(db) }));
  app.post('/worker/jobs/:id/finish', async (c) => {
    await finishJob(db, c.req.param('id'), await body(c));
    return c.json({ ok: true });
  });

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  return app;
}
