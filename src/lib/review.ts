// Review before publishing: reviewers check each book exactly as children will read it,
// then approve it into the library or send it back with a note. Admins manage the staff list.

import { api } from './api';
import type { StaffUser, Role } from './auth';
import type { Level, Package } from './format';
import type { ProjectData } from './studioStore';

export interface QueueItem {
  id: string;
  type: 'comic' | 'book';
  title: string;
  level: Level;
  status: 'draft' | 'published';
  creator_id: string;
  submitted_at: string;
}

export interface ReviewItem {
  project: ProjectData;
  package: Package;
}

export const reviewQueue = () => api.get<QueueItem[]>('/review/queue');
export const reviewItem = (id: string) => api.get<ReviewItem>(`/review/projects/${id}`);
export const approve = (id: string) => api.post<ProjectData>(`/review/projects/${id}/approve`);
export const requestChanges = (id: string, note: string) => api.post<ProjectData>(`/review/projects/${id}/request-changes`, { note });

export const listStaff = () => api.get<StaffUser[]>('/admin/staff');
export const saveStaff = (member: { email: string; name: string; role: Role }) => api.post<StaffUser>('/admin/staff', member);
export const removeStaff = (email: string) => api.delete(`/admin/staff/${encodeURIComponent(email)}`);
