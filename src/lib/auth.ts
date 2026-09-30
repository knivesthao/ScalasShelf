// Staff sign-in (creators, reviewers, admins). Readers never sign in.
// A one-time link is emailed; opening it on /sign-in swaps it for a session cookie.

import { api } from './api';

export type Role = 'creator' | 'reviewer' | 'admin';

/** What people see. Moderators (role "reviewer") approve books before they reach Scala’s Shelf. */
export const ROLE_LABEL: Record<Role, string> = { creator: 'Creator', reviewer: 'Moderator', admin: 'Admin' };

export interface StaffUser {
  email: string;
  name: string;
  role: Role;
}

export const canReview = (user: StaffUser | null) => user?.role === 'reviewer' || user?.role === 'admin';
export const isAdmin = (user: StaffUser | null) => user?.role === 'admin';

export async function currentUser(): Promise<StaffUser | null> {
  return (await api.get<{ user: StaffUser | null }>('/auth/me')).user;
}

/** Emails a sign-in link. Locally the API returns the link too (`devLink`), since nothing is emailed. */
export function requestSignInLink(email: string, next?: string): Promise<{ ok: true; devLink?: string }> {
  return api.post('/auth/request', { email, next });
}

export async function redeemSignInLink(token: string): Promise<StaffUser> {
  return (await api.post<{ user: StaffUser }>('/auth/verify', { token })).user;
}

export async function signOut(): Promise<void> {
  await api.post('/auth/sign-out');
}
