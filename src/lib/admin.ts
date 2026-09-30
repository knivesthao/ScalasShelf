// The admin view's data (api/src/services/admin.ts).

import { api } from './api';

export interface TaskUsage {
  task: string;
  model: string;
  calls: number;
  failed: number;
  input_tokens: number;
  output_tokens: number;
  ms: number;
  estimated_cost: number | null;
}

export interface Overview {
  since: string | null;
  books: { total: number; published: number; in_review: number; drafts: number };
  ai: { calls: number; failed: number; input_tokens: number; output_tokens: number; ms: number; estimated_cost: number | null; by_task: TaskUsage[] };
  per_book: {
    books_with_ai: number;
    avg_estimated_cost: number | null;
    avg_ai_seconds: number | null;
    avg_hours_to_submit: number | null;
    avg_hours_in_review: number | null;
  };
  reading: { readers: number; opens: number; finishes: number };
}

export interface AdminBookRow {
  id: string;
  title: string;
  creator_id: string;
  purpose: string;
  status: string;
  review_status: string;
  created_at: string;
  ai_calls: number;
  input_tokens: number;
  output_tokens: number;
  ai_seconds: number;
  estimated_cost: number | null;
  opens: number;
  readers: number;
}

export interface AdminBook {
  project: {
    id: string; title: string; creator_id: string; purpose: string; level: string; status: string; review_status: string;
    created_at: string; updated_at: string; submitted_at: string | null; reviewed_at: string | null; reviewed_by: string | null;
    published_at: string | null; scenes: number;
  };
  ai: {
    estimated_cost: number | null;
    by_task: TaskUsage[];
    calls: { task: string; model: string; user_id: string; input_tokens: number | null; output_tokens: number | null; ms: number; ok: number; created_at: string }[];
  };
  reading: { opens: number | null; readers: number; finishes: number | null; quizzes: number | null; avg_quiz_score: number | null } | null;
}

export const adminOverview = (since?: string) => api.get<Overview>(`/admin/overview${since ? `?since=${encodeURIComponent(since)}` : ''}`);
export const adminBooks = () => api.get<AdminBookRow[]>('/admin/books');
export const adminBook = (id: string) => api.get<AdminBook>(`/admin/books/${id}`);

// ---- Formatting ----

export const money = (usd: number | null) =>
  usd === null ? 'No price set' : usd === 0 ? '$0' : usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
export const count = (n: number | null | undefined) => (n ?? 0).toLocaleString('en-US');
export const seconds = (s: number | null) => (s === null ? '—' : s < 60 ? `${s.toFixed(1)} s` : `${(s / 60).toFixed(1)} min`);
export const hours = (h: number | null) => (h === null ? '—' : h < 48 ? `${h.toFixed(1)} hours` : `${(h / 24).toFixed(1)} days`);
export const TASK_LABEL: Record<string, string> = {
  describe: 'Description', idea: 'New book idea', finish: 'Scala Finish', meanings: 'Word meanings', translate: 'Translation (characters)',
};
