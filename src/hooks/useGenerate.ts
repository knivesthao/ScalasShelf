import { useCallback } from 'react';
import { api } from '@/lib/api';
import type { CastKind } from '@/lib/cast';
import { newId, type AssetRef, type Layer } from '@/lib/format';
import { loadDemoPack, packBackground, packCharacter, stubBackground, stubCharacter, stubSceneArt } from '@/lib/stubArt';

export { stubSceneArt };

// Art is made in the cloud, never on the creator's phone (docs/plans/MVP.md →
// "What runs where"). Characters and places are drawn once in the Cast tab and reused in
// every scene; a scene is then laid out from them (lib/cast.ts → composeScene) with no
// image model at all. Each drawing is a cloud job: the Studio queues it through the API,
// the GPU worker claims it, and we poll until it's ready.
// Dev/demo mode swaps in the demo art pack (public/demo-art) after a short delay,
// falling back to placeholder SVG shapes for anything it doesn't cover.

export interface CastArtRequest {
  projectId: string;
  kind: CastKind;
  name: string;
  description: string;
  /** Asks for a different picture than this one (regenerate). */
  previous?: AssetRef;
}

export interface LayerArtRequest {
  projectId: string;
  sceneId: string;
  description: string;
  layer: Layer;
}

type JobKind = 'layer';

const STUB_DELAY_MS = 1500;

export function useGenerate() {
  /** Draws one character (standing, plain background) or one place (no people). */
  const generateArt = useCallback(async (req: CastArtRequest): Promise<AssetRef> => {
    if (import.meta.env.DEV) {
      const [pack] = await Promise.all([loadDemoPack(), new Promise((r) => setTimeout(r, STUB_DELAY_MS))]);
      const hit = pack && (req.kind === 'place' ? packBackground(pack, req.description) : packCharacter(pack, req.name));
      if (hit && hit.asset.url !== req.previous?.url) return hit.asset;
      const seed = Math.floor(Math.random() * 1000) + 1;
      return req.kind === 'place' ? stubBackground(req.description, seed) : stubCharacter(req.name, seed);
    }
    // A single-image job, the same kind the Panel tab uses to re-roll one layer.
    const { asset } = await runJob<{ asset: AssetRef }>('layer', {
      project_id: req.projectId,
      description: req.description,
      layer: { role: req.kind === 'place' ? 'background' : 'character', prompt: `${req.name}: ${req.description}` },
    });
    return asset;
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

  return { generateArt, rerollLayer };
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
