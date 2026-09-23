// Textweaver API Gateway — Cloudflare Worker
//
// Deploy: wrangler deploy
// Routes: POST /api/render, GET /api/render/:id

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // POST /api/render — queue a generation job
    if (url.pathname === '/api/render' && request.method === 'POST') {
      try {
        const { scene_text, project_id, scene_number } = await request.json() as {
          scene_text: string;
          project_id: string;
          scene_number: number;
        };

        if (!scene_text?.trim() || !project_id) {
          return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/render_queue`, {
          method: 'POST',
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({
            user_id: null,  // Set by frontend auth context
            project_id,
            scene_number,
            scene_text,
            status: 'queued',
          }),
        });

        if (!res.ok) throw new Error(`Supabase error: ${res.status}`);

        const data = await res.json() as { id: string }[];
        return Response.json({ job_id: data[0]?.id, status: 'queued' });

      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : 'Internal error' },
          { status: 500 }
        );
      }
    }

    // GET /api/render/:id — check job status
    const renderMatch = url.pathname.match(/^\/api\/render\/(.+)$/);
    if (renderMatch && request.method === 'GET') {
      const jobId = renderMatch[1];

      try {
        const res = await fetch(
          `${env.SUPABASE_URL}/rest/v1/render_queue?id=eq.${jobId}&select=status,result_url`,
          {
            headers: {
              'apikey': env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            },
          }
        );

        if (!res.ok) throw new Error(`Supabase error: ${res.status}`);

        const data = await res.json() as { status: string; result_url: string | null }[];
        if (!data.length) return Response.json({ error: 'Not found' }, { status: 404 });

        return Response.json({ status: data[0].status, result_url: data[0].result_url });

      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : 'Internal error' },
          { status: 500 }
        );
      }
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
};
