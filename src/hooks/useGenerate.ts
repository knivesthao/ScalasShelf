import { useCallback } from 'react';
import { api } from '@/lib/api';
import { newId, type AssetRef, type Layer } from '@/lib/format';
import { loadDemoPack, packBackground, packCharacter, stubBackground, stubCharacter, stubSceneArt } from '@/lib/stubArt';

export { stubSceneArt };

// Scene art is made in the cloud, never on the creator's phone (docs/plans/MVP.md →
// "What runs where"). The Studio queues a job through the API, the GPU worker
// claims it, and we poll until the low-res preview layers are ready.
// Dev/demo mode swaps in the demo art pack (public/demo-art) after a short delay,
// falling back to placeholder SVG shapes for scenes and speakers it doesn't cover.

export interface SceneArtRequest {
  projectId: string;
  sceneId: string;
  description: string;
  /** Speakers in the scene, in order of first line. One character layer each. */
  characters: string[];
}

export interface SceneArt {
  layers: Layer[];
  assets: Record<string, AssetRef>;
}

export interface LayerArtRequest {
  projectId: string;
  sceneId: string;
  description: string;
  layer: Layer;
}

type JobKind = 'scene' | 'layer';

const STUB_DELAY_MS = 1500;

export function useGenerate() {
  const generateScene = useCallback(async (req: SceneArtRequest): Promise<SceneArt> => {
    if (import.meta.env.DEV) {
      const [pack] = await Promise.all([loadDemoPack(), new Promise((r) => setTimeout(r, STUB_DELAY_MS))]);
      return stubSceneArt(req, pack);
    }
    return runJob<SceneArt>('scene', {
      project_id: req.projectId,
      scene_id: req.sceneId,
      description: req.description,
      characters: req.characters,
    });
  }, []);

  /** Re-generate one layer with a new seed; returns the new asset to swap in. */
  const rerollLayer = useCallback(async (req: LayerArtRequest): Promise<{ assetId: string; asset: AssetRef }> => {
    if (import.meta.env.DEV) {
      const [pack] = await Promise.all([loadDemoPack(), new Promise((r) => setTimeout(r, STUB_DELAY_MS / 2))]);
      const isBg = req.layer.role === 'background';
      // The pack has one image per character, so a character re-roll keeps it; backgrounds rotate.
      const hit = pack && (isBg ? packBackground(pack, req.description, req.layer.asset) : packCharacter(pack, req.layer.prompt ?? ''));
      if (hit) return { assetId: hit.id, asset: hit.asset };
      const seed = Math.floor(Math.random() * 1000) + 1;
      const asset = isBg ? stubBackground(req.description, seed) : stubCharacter(req.layer.prompt ?? '', seed);
      return { assetId: newId(isBg ? 'bg' : 'ch'), asset };
    }
    return runJob('layer', {
      project_id: req.projectId,
      scene_id: req.sceneId,
      description: req.description,
      layer: req.layer,
    });
  }, []);

  return { generateScene, rerollLayer };
}

async function runJob<T>(kind: JobKind, payload: Record<string, unknown>, maxAttempts = 100, intervalMs = 3000): Promise<T> {
  const { job_id } = await api.post<{ job_id: string }>('/render', { kind, payload });
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const job = await api.get<{ status: string; result?: T; error_message?: string }>(`/render/${job_id}`).catch(() => null);
    if (job?.status === 'complete' && job.result) return job.result;
    if (job?.status === 'failed') throw new Error(job.error_message || 'Generation failed');
  }
  throw new Error('Generation timed out');
}
