import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useGenerate } from '@/hooks/useGenerate';

interface Project {
  id: string;
  creator_id: string;
  type: 'comic' | 'book';
  title: string;
  description: string;
  language: 'lao' | 'english';
  reading_level: string;
  price_kip: number;
  status: string;
}

interface Scene {
  id: string;
  project_id: string;
  scene_number: number;
  narration_text: string;
  rendered_image_url: string | null;
}

export function StudioDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from('projects')
      .select('*')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setProjects(data || []); setLoading(false); });
  }, [user]);

  const createProject = useCallback(async (type: 'comic' | 'book') => {
    if (!user) return;
    const { data } = await supabase
      .from('projects')
      .insert({
        creator_id: user.id, type, title: 'Untitled',
        description: '', language: 'lao', reading_level: 'beginner',
        price_kip: 5000, status: 'draft',
      })
      .select().single();
    if (data) navigate(`/studio/${type}/${data.id}`);
  }, [user, navigate]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <div className="empty"><p>Log in to create content.</p></div>;

  return (
    <div className="studio">
      <header className="library-header">
        <h1>Creator Studio</h1>
        <Link to="/">← Library</Link>
      </header>
      <div className="studio-actions">
        <button className="buy-btn" onClick={() => createProject('comic')}>+ New Comic</button>
        <button className="buy-btn" onClick={() => createProject('book')}>+ New Book</button>
      </div>
      {projects.length === 0 ? (
        <div className="empty"><p>No projects yet.</p></div>
      ) : (
        <div className="content-grid">
          {projects.map((p) => (
            <Link to={`/studio/${p.type}/${p.id}`} key={p.id} className="content-card">
              <div className="card-body">
                <h2>{p.title}</h2>
                <span className="badge">{p.type}</span>
                <span className="badge">{p.language}</span>
                <span className="badge">{p.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Generate a polished comic-panel SVG preview for the Studio editor */
function previewHtml(narration: string, sceneNumber: number, isBook: boolean): string {
  const label = isBook ? 'Scene' : 'Panel';
  const text = narration || `${label} ${sceneNumber} — awaiting narration…`;
  // Truncate long text for display
  const lines = text.length > 120 ? text.slice(0, 117) + '…' : text;
  const accent = '#ff6b6b';
  const dark = '#1a1a2e';
  const muted = '#8892b0';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;align-items:center;justify-content:center;min-height:100dvh;background:${dark};font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:16px}
.panel{width:100%;max-width:420px;aspect-ratio:16/10;border:2px solid #2a2a4a;border-radius:12px;overflow:hidden;position:relative;background:linear-gradient(135deg,${dark} 0%,#16213e 100%)}
.panel-inner{display:flex;flex-direction:column;height:100%;padding:24px}
.panel-header{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.panel-badge{background:${accent};color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:1px}
.panel-divider{flex:1;height:1px;background:#2a2a4a}
.panel-art{flex:1;background:linear-gradient(135deg,#2a1a4a 0%,#1a2a3a 50%,#2a1a2a 100%);border-radius:8px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;margin-bottom:12px}
.panel-art::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 30% 40%,rgba(255,107,107,.08) 0%,transparent 60%)}
.art-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:24px 24px}
.art-icon{font-size:48px;opacity:.15;z-index:1}
.panel-text{font-size:13px;line-height:1.7;color:#e4e4e4;text-align:center;padding:0 12px}
.panel-footer{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid #2a2a4a}
.dot-row{display:flex;gap:6px}
.dot{width:6px;height:6px;border-radius:50%;background:#2a2a4a}
.dot.active{background:${accent}}
.meta{font-size:10px;color:${muted};letter-spacing:1px}
</style></head><body><div class="panel"><div class="panel-inner">
<div class="panel-header"><span class="panel-badge">${label} ${sceneNumber}</span><div class="panel-divider"></div></div>
<div class="panel-art"><div class="art-grid"></div><span class="art-icon">${isBook ? '📖' : '🖼'}</span></div>
<div class="panel-text">${lines}</div>
<div class="panel-footer"><div class="dot-row">${Array.from({length:5},(_,j)=>`<span class="dot${j===sceneNumber%5?' active':''}"></span>`).join('')}</div><span class="meta">AI-GENERATED</span></div>
</div></div></body></html>`;
}

export function StudioEditor() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const generate = useGenerate();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('scenes').select('*').eq('project_id', id).order('scene_number'),
    ]).then(([p, s]) => { setProject(p.data); setScenes(s.data || []); setLoading(false); });
  }, [id]);

  async function addScene() {
    if (!id) return;
    const next = scenes.length + 1;
    const { data } = await supabase
      .from('scenes').insert({ project_id: id, scene_number: next, narration_text: '' })
      .select().single();
    if (data) setScenes([...scenes, data]);
  }

  async function updateScene(sceneId: string, text: string) {
    setScenes(scenes.map((s) => (s.id === sceneId ? { ...s, narration_text: text } : s)));
  }

  async function saveScene(sceneId: string, text: string) {
    await supabase.from('scenes').update({ narration_text: text }).eq('id', sceneId);
    setSaving(true);
    setTimeout(() => setSaving(false), 800);
  }

  // Stub: simulate generation, return a mock image
  async function handleGenerate(scene: Scene) {
    if (!scene.narration_text.trim()) return;
    setGeneratingId(scene.id);
    try {
      const url = await generate(scene.narration_text, scene.scene_number, project?.id ?? '');
      await supabase.from('scenes').update({ rendered_image_url: url }).eq('id', scene.id);
      setScenes(scenes.map((s) =>
        s.id === scene.id ? { ...s, rendered_image_url: url } : s
      ));
    } catch {
      // Generation failed — silently retryable
    }
    setGeneratingId(null);
  }

  async function updateProject(fields: Partial<Project>) {
    if (!id || !project) return;
    setProject({ ...project, ...fields });
    await supabase.from('projects').update(fields).eq('id', id);
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (!project) return <div className="empty"><p>Project not found.</p></div>;

  const isBook = type === 'book';

  return (
    <div className="studio-editor">
      <div className="editor-toolbar">
        <button className="back-btn" onClick={() => navigate('/studio')}>← Studio</button>
        <input
          className="title-input"
          value={project.title}
          onChange={(e) => setProject({ ...project, title: e.target.value })}
          onBlur={() => updateProject({ title: project.title })}
        />
        {saving && <span className="saving-indicator">Saved</span>}
      </div>

      <div className="scene-list">
        {scenes.map((scene, i) => (
          <div key={scene.id} className="scene-card">
            <div className="scene-number">{i + 1}</div>
            <div className="scene-body">
              <textarea
                className="narration-input"
                placeholder={isBook
                  ? `Describe scene ${i + 1}... (e.g. "A boy walks through a rice field at sunset. His water buffalo follows.")`
                  : `Panel ${i + 1} narration...`}
                value={scene.narration_text}
                onChange={(e) => updateScene(scene.id, e.target.value)}
                onBlur={(e) => saveScene(scene.id, e.target.value)}
                rows={3}
              />
              <div className="scene-preview">
                {generatingId === scene.id ? (
                  <div className="generating">
                    <div className="spinner" />
                    <span>Reading story…</span>
                  </div>
                ) : scene.rendered_image_url ? (
                  <iframe
                    srcDoc={previewHtml(scene.narration_text, i + 1, isBook)}
                    title={`Preview ${i + 1}`}
                    className="scene-preview-frame"
                  />
                ) : null}
              </div>
              <button
                className="generate-btn"
                onClick={() => handleGenerate(scene)}
                disabled={generatingId === scene.id || !scene.narration_text.trim()}
              >
                {generatingId === scene.id ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="editor-footer">
        <button className="buy-btn" onClick={addScene}>
          + Add {isBook ? 'Scene' : 'Panel'}
        </button>
        <button
          className="buy-btn"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          onClick={() => updateProject({ status: 'published' })}
        >
          Publish
        </button>
      </div>
    </div>
  );
}
