// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { TASK_ROUTES, aiRouter } from './services/ai-routes';
import { finishStory } from './services/ai';
import type { TextModel } from './platform';

const named = (name: string, answer: () => Promise<string>): TextModel => ({ name, complete: async () => ({ text: await answer() }) });

describe('AI routing', () => {
  it('sends each job to its own model, skipping providers that aren’t set up', () => {
    const router = aiRouter({ 'workers-ai': (model) => named(`workers-ai/${model}`, async () => '') });
    expect(router.models('describe').map((m) => m.model.name)).toEqual(['workers-ai/@cf/meta/llama-3.1-8b-instruct-fp8-fast']);
    expect(router.models('idea').map((m) => m.model.name)).toEqual(['workers-ai/@cf/meta/llama-3.1-8b-instruct']);
    // No Claude here yet: Scala Finish falls back to Workers AI.
    expect(router.models('finish').map((m) => m.model.name)).toEqual(['workers-ai/@cf/meta/llama-3.1-8b-instruct']);

    const withClaude = aiRouter({
      anthropic: (model) => named(`anthropic/${model}`, async () => ''),
      'workers-ai': (model) => named(`workers-ai/${model}`, async () => ''),
    });
    expect(withClaude.models('finish').map((m) => [m.model.name, m.attempts])).toEqual(
      TASK_ROUTES.finish.map((c) => [`${c.provider}/${c.model}`, c.attempts]),
    );
  });

  it('moves to the next model when one keeps giving broken answers', async () => {
    const calls: string[] = [];
    const good = JSON.stringify({ scenes: [{ place: 'School', picture: '', caption: '', lines: [{ speaker: 'Noy', text: 'Hello!' }] }], characters: [], places: [] });
    const broken = named('cheap', async () => { calls.push('cheap'); return 'not json'; });
    const better = named('better', async () => { calls.push('better'); return good; });
    const result = await finishStory([{ model: broken, attempts: 2 }, { model: better, attempts: 1 }], {
      title: 'Noy', description: '', purpose: 'reading', level: 'A1', characters: [], places: [], scenes: [], sceneCount: 6,
    });
    expect(calls).toEqual(['cheap', 'cheap', 'better']);
    expect(result.scenes[0].lines[0].text).toBe('Hello!');
  });
});
