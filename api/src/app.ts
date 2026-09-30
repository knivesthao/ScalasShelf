import { Hono, type Context } from 'hono';
import { BadRequest, Forbidden, NotFound, Unauthorized } from './errors';
import { SESSION_COOKIE, readCookie, type Platform } from './platform';
import {
  aiUsage, metered, suggestDescription, suggestFromIdea, type DescribeInput, type IdeaInput,
} from './services/ai';
import { finishProject } from './services/finish';
import { getBook, listBooks } from './services/books';
import { bookStats, recordEvents, type EventBatch } from './services/events';
import { claimNextJob, finishJob, getJob, queueJob, runInBackground } from './services/jobs';
import {
  endSession, getStaff, listStaff, redeemSignInLink, removeStaff, requestSignInLink, requireRole,
  upsertStaff, SESSION_TTL_MS,
} from './services/staff';
import {
  addScene, approveProject, assertOwnsProject, createProject, deleteProject, deleteScene, getProject, getReviewItem,
  listProjects, listReviewQueue, requestChanges, saveProject, submitForReview, unpublishProject, type SaveInput,
} from './services/studio';

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

/** Same-origin check for state-changing auth requests (defence against cross-site form posts). */
function assertSameOrigin(c: Context): void {
  const origin = c.req.header('origin');
  if (origin && origin !== new URL(c.req.url).origin) throw new Forbidden('Cross-site request refused');
}

function sessionCookie(value: string, maxAgeSeconds: number, secure: boolean): string {
  return [`${SESSION_COOKIE}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`, secure ? 'Secure' : '']
    .filter(Boolean).join('; ');
}

export function createApp(platform: Platform) {
  const { db, files, auth, mailer } = platform;
  const background = platform.background ?? ((task: Promise<unknown>) => { void task; });
  const secure = platform.secureCookies ?? true;

  /** Any staff member (creators, reviewers, admins) may use the Studio. */
  const requireStaff = async (c: Context<Env>) => {
    const userId = requireUser(c);
    await requireRole(db, userId, ['creator', 'reviewer']);
    return userId;
  };
  const app = new Hono<Env>();

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

  // Reading events from the app (anonymous; see services/events.ts). No sign-in: readers never have one.
  app.post('/events', async (c) => c.json(await recordEvents(db, await body<EventBatch>(c))));

  app.get('/books', async (c) => c.json(await listBooks(db, { level: c.req.query('level') })));
  app.get('/books/:id', async (c) => c.json(await getBook(db, c.req.param('id'))));

  // ---- Staff sign-in (readers never sign in) ----

  app.get('/auth/me', async (c) => {
    const userId = c.get('userId');
    return c.json({ user: userId ? await getStaff(db, userId) : null });
  });
  app.post('/auth/request', async (c) => {
    assertSameOrigin(c);
    const { email, next } = await body<{ email?: unknown; next?: unknown }>(c);
    const result = await requestSignInLink(db, mailer, email, new URL(c.req.url).origin, next);
    return c.json({ ok: true, ...result });
  });
  app.post('/auth/verify', async (c) => {
    assertSameOrigin(c);
    const { token } = await body<{ token?: unknown }>(c);
    const { sessionId, member } = await redeemSignInLink(db, token);
    c.header('set-cookie', sessionCookie(sessionId, SESSION_TTL_MS / 1000, secure));
    c.header('cache-control', 'no-store');
    return c.json({ user: member });
  });
  app.post('/auth/sign-out', async (c) => {
    assertSameOrigin(c);
    await endSession(db, readCookie(c.req.raw, SESSION_COOKIE));
    c.header('set-cookie', sessionCookie('', 0, secure));
    return c.json({ ok: true });
  });

  // ---- Studio (staff) ----

  // AI suggestions for the Publish tab. Staff only, so the free AI allowance can't be drained.
  // Every AI call is recorded in ai_usage (services/ai.ts → metered).
  const projectIdOf = (input: { project_id?: unknown }) => (typeof input?.project_id === 'string' ? input.project_id : null);
  app.post('/studio/suggest/description', async (c) => {
    const userId = await requireStaff(c);
    const input = await body<DescribeInput>(c);
    const model = metered(platform.text, db, { task: 'describe', userId, projectId: projectIdOf(input) });
    return c.json(await suggestDescription(model, input));
  });
  // Scala Finish: the server reads the saved book, writes the rest and saves it (services/finish.ts).
  // It can take half a minute, so it runs as a background job; the Studio polls /studio/jobs/:id.
  app.post('/studio/projects/:id/finish', async (c) => {
    const userId = await requireStaff(c);
    const projectId = c.req.param('id');
    await assertOwnsProject(db, userId, projectId);
    const model = metered(platform.text, db, { task: 'finish', userId, projectId });
    if (!model) throw new BadRequest('AI isn’t set up here. It works on the live site.');
    const jobId = await runInBackground(db, background, { userId, projectId, kind: 'finish' }, async () => {
      const book = await finishProject(db, model, userId, projectId);
      return { first_new_scene: book.first_new_scene };
    });
    return c.json({ job_id: jobId, status: 'running' }, 202);
  });
  app.post('/studio/suggest/idea', async (c) => {
    const userId = await requireStaff(c);
    return c.json(await suggestFromIdea(metered(platform.text, db, { task: 'idea', userId }), await body<IdeaInput>(c)));
  });

  app.get('/studio/projects', async (c) => c.json(await listProjects(db, await requireStaff(c))));
  app.post('/studio/projects', async (c) => c.json(await createProject(db, await requireStaff(c), await body(c)), 201));
  app.get('/studio/projects/:id', async (c) => c.json(await getProject(db, await requireStaff(c), c.req.param('id'))));
  app.put('/studio/projects/:id', async (c) => {
    await saveProject(db, await requireStaff(c), c.req.param('id'), await body<SaveInput>(c));
    return c.json({ ok: true });
  });
  app.post('/studio/projects/:id/scenes', async (c) => c.json(await addScene(db, await requireStaff(c), c.req.param('id')), 201));
  app.delete('/studio/projects/:id', async (c) => {
    await deleteProject(db, await requireStaff(c), c.req.param('id'));
    return c.json({ ok: true });
  });
  app.delete('/studio/scenes/:id', async (c) => {
    await deleteScene(db, await requireStaff(c), c.req.param('id'));
    return c.json({ ok: true });
  });
  // Creators submit; only reviewers publish (every book is checked by an adult first).
  app.post('/studio/projects/:id/submit', async (c) =>
    c.json(await submitForReview(db, await requireStaff(c), c.req.param('id'))));
  app.post('/studio/projects/:id/unpublish', async (c) => {
    const userId = await requireStaff(c);
    const member = await getStaff(db, userId);
    const isReviewer = member?.role === 'reviewer' || member?.role === 'admin';
    return c.json(await unpublishProject(db, c.req.param('id'), { userId, isReviewer }));
  });

  // ---- Review (reviewers and admins) ----

  const requireReviewer = async (c: Context<Env>) => {
    const userId = requireUser(c);
    await requireRole(db, userId, ['reviewer']);
    return userId;
  };
  app.get('/review/queue', async (c) => {
    await requireReviewer(c);
    return c.json(await listReviewQueue(db));
  });
  app.get('/review/projects/:id', async (c) => {
    await requireReviewer(c);
    return c.json(await getReviewItem(db, c.req.param('id')));
  });
  app.post('/review/projects/:id/approve', async (c) =>
    c.json(await approveProject(db, await requireReviewer(c), c.req.param('id'))));
  app.post('/review/projects/:id/request-changes', async (c) => {
    const reviewerId = await requireReviewer(c);
    const { note } = await body<{ note?: unknown }>(c);
    return c.json(await requestChanges(db, reviewerId, c.req.param('id'), note));
  });

  // ---- Staff list (admins) ----

  const requireAdmin = async (c: Context<Env>) => {
    const userId = requireUser(c);
    await requireRole(db, userId, []);
    return userId;
  };
  app.get('/admin/ai-usage', async (c) => {
    await requireAdmin(c);
    return c.json(await aiUsage(db, c.req.query('since')));
  });
  app.get('/admin/stats', async (c) => {
    await requireAdmin(c);
    return c.json(await bookStats(db, c.req.query('since')));
  });
  app.get('/admin/staff', async (c) => {
    await requireAdmin(c);
    return c.json(await listStaff(db));
  });
  app.post('/admin/staff', async (c) => {
    await requireAdmin(c);
    return c.json(await upsertStaff(db, await body(c)), 201);
  });
  app.delete('/admin/staff/:email', async (c) => {
    await removeStaff(db, await requireAdmin(c), decodeURIComponent(c.req.param('email')));
    return c.json({ ok: true });
  });

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
  app.get('/studio/jobs/:id', async (c) => {
    const job = await getJob(db, requireUser(c), c.req.param('id'));
    return c.json({ status: job.status, result: job.result, error_message: job.error });
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

  // Versioned for the mobile app: an installed app can't be updated instantly, so /api/v1
  // must keep working when /api/v2 arrives. The bare /api paths are the same routes, kept
  // for the web app and GPU worker deployed before versioning; new clients use /api/v1.
  const root = new Hono<Env>();
  root.route('/api/v1', app);
  root.route('/api', app);
  root.notFound((c) => c.json({ error: 'Not found' }, 404));
  return root;
}
