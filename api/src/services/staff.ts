// Staff sign-in (creators, reviewers, admins) by one-time email link, and the staff list.
// Readers never sign in. Only SHA-256 hashes of links and session ids are stored, so a
// copy of the database can't be used to sign in. No password hashing, so it fits the
// free Workers plan's CPU limit (docs/plans/pilot-build-plan.md → Weeks 1–2).

import { BadRequest, Forbidden, NotFound } from '../errors';
import type { Db, Mailer } from '../platform';

export type Role = 'creator' | 'reviewer' | 'admin';
export const ROLES: Role[] = ['creator', 'reviewer', 'admin'];

export interface StaffMember {
  email: string;
  name: string;
  role: Role;
}

const TOKEN_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PENDING_LINKS = 3;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getStaff(db: Db, email: string): Promise<StaffMember | null> {
  return db.prepare(`SELECT email, name, role FROM staff WHERE email = ?`).bind(normalizeEmail(email)).first<StaffMember>();
}

/** Throws unless the user is staff with one of the given roles. Admins pass every check. */
export async function requireRole(db: Db, userId: string, roles: Role[]): Promise<StaffMember> {
  const member = await getStaff(db, userId);
  if (!member) throw new Forbidden('Your account is not on the Textweaver staff list');
  if (member.role !== 'admin' && !roles.includes(member.role)) throw new Forbidden('You don’t have access to this');
  return member;
}

/**
 * Emails a one-time sign-in link to a staff member. Returns the link only when the mailer
 * says it's a development mailer (so local sign-in works without email).
 */
export async function requestSignInLink(
  db: Db, mailer: Mailer, rawEmail: unknown, origin: string, redirect?: unknown,
): Promise<{ devLink?: string }> {
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_PATTERN.test(email)) throw new BadRequest('Enter your email address.');
  const member = await getStaff(db, email);
  if (!member) throw new Forbidden('That email isn’t on the Textweaver staff list. Ask an admin to add you.');

  const now = Date.now();
  await db.batch([
    db.prepare(`DELETE FROM login_tokens WHERE expires_at <= ?`).bind(now),
    db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).bind(now),
  ]);
  const pending = await db.prepare(`SELECT COUNT(*) AS n FROM login_tokens WHERE email = ?`).bind(email).first<{ n: number }>();
  if ((pending?.n ?? 0) >= MAX_PENDING_LINKS) {
    throw new BadRequest('Too many sign-in links requested. Use the latest email, or try again in 15 minutes.');
  }

  const token = randomToken();
  await db.prepare(`INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)`)
    .bind(await sha256(token), email, now + TOKEN_TTL_MS).run();

  const next = typeof redirect === 'string' && /^\/studio(\/[\w/-]*)?$/.test(redirect) ? redirect : '/studio';
  const link = `${origin}/sign-in?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
  try {
    await mailer.send({
      to: email,
      subject: 'Your Textweaver sign-in link',
      text: `Hi ${member.name || 'there'},\n\nSign in to the Textweaver Studio:\n\n${link}\n\nThis link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`,
      html: `<p>Hi ${escapeHtml(member.name || 'there')},</p><p><a href="${link}">Sign in to the Textweaver Studio</a></p><p>This link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.</p>`,
    });
  } catch (error) {
    console.error('Sign-in email failed:', error);
    throw new BadRequest('We couldn’t send the email. Ask an admin to check the email setup.');
  }
  return mailer.development ? { devLink: link } : {};
}

/** Uses up a sign-in link and starts a session. Returns the raw session id (for the cookie). */
export async function redeemSignInLink(db: Db, token: unknown): Promise<{ sessionId: string; member: StaffMember }> {
  if (typeof token !== 'string' || !token) throw new BadRequest('This sign-in link is invalid.');
  const row = await db.prepare(`DELETE FROM login_tokens WHERE token_hash = ? RETURNING email, expires_at`)
    .bind(await sha256(token)).first<{ email: string; expires_at: number }>();
  if (!row || row.expires_at <= Date.now()) throw new BadRequest('This sign-in link has expired or was already used. Request a new one.');
  const member = await getStaff(db, row.email);
  if (!member) throw new BadRequest('This account is no longer on the staff list.');

  const sessionId = randomToken();
  const now = Date.now();
  await db.prepare(`INSERT INTO sessions (id_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)`)
    .bind(await sha256(sessionId), member.email, now, now + SESSION_TTL_MS).run();
  return { sessionId, member };
}

/** The staff email for a session cookie value, or null. Removed staff lose access immediately. */
export async function sessionEmail(db: Db, sessionId: string | undefined): Promise<string | null> {
  if (!sessionId) return null;
  const row = await db.prepare(
    `SELECT s.email FROM sessions s JOIN staff st ON st.email = s.email WHERE s.id_hash = ? AND s.expires_at > ?`
  ).bind(await sha256(sessionId), Date.now()).first<{ email: string }>();
  return row?.email ?? null;
}

export async function endSession(db: Db, sessionId: string | undefined): Promise<void> {
  if (sessionId) await db.prepare(`DELETE FROM sessions WHERE id_hash = ?`).bind(await sha256(sessionId)).run();
}

// ---- Staff list (admins) ----

export async function listStaff(db: Db): Promise<StaffMember[]> {
  const { results } = await db.prepare(`SELECT email, name, role FROM staff ORDER BY role, name, email`).all<StaffMember>();
  return results;
}

export async function upsertStaff(db: Db, input: { email?: unknown; name?: unknown; role?: unknown }): Promise<StaffMember> {
  const email = normalizeEmail(input.email);
  if (!EMAIL_PATTERN.test(email)) throw new BadRequest('A valid email is required');
  if (!ROLES.includes(input.role as Role)) throw new BadRequest('Role must be creator, reviewer or admin');
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 120) : '';
  await db.prepare(
    `INSERT INTO staff (email, name, role, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (email) DO UPDATE SET name = excluded.name, role = excluded.role`
  ).bind(email, name, input.role, new Date().toISOString()).run();
  return { email, name, role: input.role as Role };
}

export async function removeStaff(db: Db, adminEmail: string, email: string): Promise<void> {
  const target = normalizeEmail(email);
  if (target === adminEmail) throw new BadRequest('You can’t remove yourself');
  const { meta } = await db.prepare(`DELETE FROM staff WHERE email = ?`).bind(target).run();
  if (!meta.changes) throw new NotFound('Not on the staff list');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
