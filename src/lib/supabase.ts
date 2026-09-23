import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isConfigured(): boolean {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.startsWith('http') &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.length > 0
  );
}

const MOCK_USER = {
  id: 'mock-user-1',
  phone: '+8562055550000',
  email: 'creator@admais.la',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockData: Record<string, any[]> = {
  content: [
    {
      id: '1',
      title: 'The Brave Buffalo',
      creator_name: 'Somsack',
      language: 'lao',
      reading_level: 'beginner',
      cover_image_url: '/mock/cover-placeholder.svg',
      price_kip: 5000,
      description: 'A story about a brave buffalo.',
    },
    {
      id: '2',
      title: 'Morning Market',
      creator_name: 'Noy',
      language: 'english',
      reading_level: 'intermediate',
      cover_image_url: '/mock/cover-placeholder.svg',
      price_kip: 8000,
      description: 'A day at the Luang Prabang morning market.',
    },
  ],
  payments: [
    {
      id: 'pay-1',
      user_id: 'mock-user-1',
      content_id: '1',
      amount_kip: 5000,
      status: 'pending',
      created_at: '2026-07-30T08:00:00Z',
    },
    {
      id: 'pay-2',
      user_id: 'mock-user-1',
      content_id: '2',
      amount_kip: 8000,
      status: 'confirmed',
      created_at: '2026-07-29T10:00:00Z',
    },
  ],
  projects: [
    {
      id: 'proj-1',
      creator_id: 'mock-user-1',
      type: 'comic',
      title: 'The Brave Buffalo',
      description: 'A Lao folk tale.',
      language: 'lao',
      reading_level: 'beginner',
      price_kip: 5000,
      status: 'draft',
      created_at: '2026-07-28T12:00:00Z',
    },
    {
      id: 'proj-2',
      creator_id: 'mock-user-1',
      type: 'book',
      title: 'Morning Market',
      description: 'A day at the Luang Prabang morning market.',
      language: 'english',
      reading_level: 'intermediate',
      price_kip: 8000,
      status: 'published',
      created_at: '2026-08-14T09:30:00Z',
    },
    {
      id: 'proj-3',
      creator_id: 'mock-user-1',
      type: 'book',
      title: 'Counting the Rice Harvest',
      description: 'Early numeracy through a harvest story.',
      language: 'lao',
      reading_level: 'beginner',
      price_kip: 0,
      status: 'draft',
      created_at: '2026-09-02T15:45:00Z',
    },
  ],
  scenes: [
    {
      id: 'scene-1',
      project_id: 'proj-1',
      scene_number: 1,
      narration_text: '\u0e84\u0ea7\u0eb2\u0e8d\u0e8d\u0ec8\u0eb2\u0e87\u0e9c\u0ec8\u0eb2\u0e99\u0e97\u0ebb\u0ec8\u0e87\u0e99\u0eb2\u0ec3\u0e99\u0e95\u0ead\u0e99\u0ec0\u0e8a\u0ebb\u0ec9\u0eb2',
      rendered_image_url: '/mock/scene-1.svg',
    },
    {
      id: 'scene-2',
      project_id: 'proj-1',
      scene_number: 2,
      narration_text: '\u0ec0\u0e94\u0eb1\u0e81\u0e99\u0ec9\u0ead\u0e8d\u0e99\u0eb1\u0ec8\u0e87\u0ec2\u0e94\u0e8d\u0ec0\u0e97\u0eb4\u0e87\u0ec4\u0e9b\u0e99\u0eb3\u0e84\u0ea7\u0eb2\u0e8d',
      rendered_image_url: '/mock/scene-2.svg',
    },
    {
      id: 'scene-3',
      project_id: 'proj-1',
      scene_number: 3,
      narration_text: '\u0e9d\u0ebb\u0e99\u0ec0\u0e8a\u0eb5\u0ec8\u0e87\u0e95\u0ebb\u0e81\u0ea5\u0ebb\u0e87\u0ec3\u0eaa\u0ec8\u0e97\u0ebb\u0ec8\u0e87\u0e99\u0eb2',
      rendered_image_url: '/mock/scene-3.svg',
    },
    {
      id: 'scene-4',
      project_id: 'proj-1',
      scene_number: 4,
      narration_text: '',
      rendered_image_url: null,
    },
    {
      id: 'scene-5',
      project_id: 'proj-2',
      scene_number: 1,
      narration_text: 'Before sunrise, the market stalls are already awake.',
      rendered_image_url: '/mock/scene-5.svg',
    },
  ],
  purchases: [] as any[],
  render_queue: [] as any[],
};

function mockAuthEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).__TEXTWEAVER_MOCK_AUTH__;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeBuilder(table: string, initialFilters?: { field: string; value: any }[]) {
  const filters = initialFilters ? [...initialFilters] : [];
  let orderField: string | null = null;
  let orderAsc = true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: Record<string, any> = {
    select: () => builder,

    eq: (field: string, value: any) => {
      filters.push({ field, value });
      return builder;
    },

    in: (field: string, values: any[]) => {
      // Simulate IN filter — store for resolution in final callback
      filters.push({ field, value: values });
      return builder;
    },

    order: (field: string, opts?: { ascending: boolean }) => {
      orderField = field;
      orderAsc = opts?.ascending ?? true;
      return builder;
    },

    single: () => {
      builder.then = (resolve: (v: unknown) => void) => {
        let rows = [...(mockData[table] ?? [])];
        for (const f of filters) {
          if (Array.isArray(f.value)) {
            rows = rows.filter((r) => f.value.includes(r[f.field]));
          } else {
            rows = rows.filter((r) => r[f.field] === f.value);
          }
        }
        const item = rows.length > 0 ? rows[0] : null;
        return Promise.resolve(resolve({ data: item, error: null }));
      };
      return builder;
    },

    insert: (rows: any) => {
      const entries = Array.isArray(rows) ? rows : [rows];
      if (!mockData[table]) mockData[table] = [];
      mockData[table].push(...entries);
      builder.then = (resolve: (v: unknown) => void) =>
        Promise.resolve(resolve({ data: entries, error: null }));
      return builder;
    },

    update: (fields: any) => {
      // Store fields, defer resolution to `then` so filters added after
      // update (via chained .eq()) are applied at resolution time.
      const updateFields = fields;
      builder.then = (resolve: (v: unknown) => void) => {
        let rows = [...(mockData[table] ?? [])];
        for (const f of filters) {
          if (Array.isArray(f.value)) {
            rows = rows.filter((r) => f.value.includes(r[f.field]));
          } else {
            rows = rows.filter((r) => r[f.field] === f.value);
          }
        }
        for (const row of rows) {
          Object.assign(row, updateFields);
        }
        return Promise.resolve(resolve({ data: null, error: null }));
      };
      return builder;
    },

    then: (resolve: (v: unknown) => void) => {
      let rows = [...(mockData[table] ?? [])];
      for (const f of filters) {
        if (Array.isArray(f.value)) {
          rows = rows.filter((r) => f.value.includes(r[f.field]));
        } else {
          rows = rows.filter((r) => r[f.field] === f.value);
        }
      }
      if (orderField) {
        rows.sort((a, b) => {
          const cmp = String(a[orderField!]).localeCompare(String(b[orderField!]));
          return orderAsc ? cmp : -cmp;
        });
      }
      return Promise.resolve(resolve({ data: rows, error: null }));
    },
  };
  return builder;
}

function createStubClient() {
  const authEnabled = mockAuthEnabled();

  return {
    from: (table: string) => makeBuilder(table),
    rpc: () => makeBuilder(''),
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: authEnabled ? { user: MOCK_USER } : null },
        }),
      onAuthStateChange: (cb: any) => {
        if (authEnabled) {
          setTimeout(() => cb('SIGNED_IN', { user: MOCK_USER }), 0);
        }
        return {
          data: { subscription: { unsubscribe: () => {} } },
        };
      },
      signInWithOtp: () => Promise.resolve({ error: null }),
      signOut: () => Promise.resolve({ error: null }),
      admin: {
        getUserById: () =>
          Promise.resolve({
            data: authEnabled ? { user: MOCK_USER } : null,
          }),
      },
    },
  } as unknown as ReturnType<typeof createClient>;
}

export const supabase = isConfigured()
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : createStubClient();
