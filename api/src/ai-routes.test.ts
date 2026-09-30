// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DEFAULT_ROUTES, aiRouter, routesFrom } from './services/ai-routes';
import { PROVIDERS, buildProviders } from './services/providers';
import { finishStory } from './services/ai';
import type { TextModel } from './platform';

const named = (name: string, answer: () => Promise<string>): TextModel => ({ name, complete: async () => ({ text: await answer() }) });

describe('AI routing', () => {
  const fake = (model: string) => named(model, async () => '');

  it('sends each job to its own model, skipping providers that aren’t set up', () => {
    const router = aiRouter({ text: { 'workers-ai': (m) => fake(`workers-ai/${m}`) } });
    expect(router.models('describe').map((m) => m.model.name)).toEqual(['workers-ai/@cf/meta/llama-3.1-8b-instruct-fp8-fast']);
    expect(router.models('idea').map((m) => m.model.name)).toEqual(['workers-ai/@cf/meta/llama-3.1-8b-instruct']);
    // No Claude here yet: Scala Finish falls back to Workers AI.
    expect(router.models('finish').map((m) => m.model.name)).toEqual(['workers-ai/@cf/meta/llama-3.1-8b-instruct']);

    const withClaude = aiRouter({ text: { anthropic: (m) => fake(`anthropic/${m}`), 'workers-ai': (m) => fake(`workers-ai/${m}`) } });
    expect(withClaude.models('finish').map((m) => [m.model.name, m.attempts])).toEqual(
      DEFAULT_ROUTES.finish.map((c) => [`${c.provider}/${c.model}`, c.attempts ?? 1]),
    );
  });

  it('lets AI_ROUTES swap a job’s model without code changes, and ignores a broken override', () => {
    const routes = routesFrom(JSON.stringify({ describe: [{ provider: 'workers-ai', model: '@cf/meta/llama-3.2-3b-instruct' }] }));
    expect(routes.describe).toEqual([{ provider: 'workers-ai', model: '@cf/meta/llama-3.2-3b-instruct', attempts: 1 }]);
    expect(routes.idea).toEqual(DEFAULT_ROUTES.idea);
    expect(routesFrom('{not json')).toBe(DEFAULT_ROUTES);
    expect(routesFrom(JSON.stringify({ describe: [{ model: 'no provider' }] }))).toBe(DEFAULT_ROUTES);
  });

  it('declares every provider’s key, offers built ones that have keys, and skips stubs', () => {
    expect(PROVIDERS.find((p) => p.id === 'anthropic')).toMatchObject({ status: 'stub', secret: 'ANTHROPIC_API_KEY' });
    const none = buildProviders({ secrets: {} });
    expect(Object.keys(none.translate)).toEqual([]);
    const some = buildProviders({ secrets: { GOOGLE_TRANSLATE_KEY: 'k', ANTHROPIC_API_KEY: 'k' } });
    expect(Object.keys(some.translate)).toEqual(['google-translate']);
    expect(Object.keys(some.text)).not.toContain('anthropic'); // a stub, even with its key
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
