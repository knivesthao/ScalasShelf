// Which model does which job (docs/plans/ai-models.md). Each job lists its models in
// order: the first one that's set up is used, and the rest are fallbacks when its answer
// fails our checks. Providers are in ./providers.ts; one without its key is skipped.
//
// To swap models without changing code, set the AI_ROUTES variable on the Worker to JSON
// with the jobs to override, e.g.
//   {"describe": [{"provider": "workers-ai", "model": "@cf/meta/llama-3.2-3b-instruct"}]}

import type { TextModel } from '../platform';
import type { Translator } from './translation';

export type AiTask = 'idea' | 'describe' | 'finish' | 'meanings';
export type RoutedTask = AiTask | 'translate';

export interface ModelChoice {
  /** A provider id from providers.ts. */
  provider: string;
  model: string;
  /** How many answers to try from this model before moving to the next one (default 1). */
  attempts?: number;
}

export type Routes = Record<RoutedTask, ModelChoice[]>;

export const DEFAULT_ROUTES: Routes = {
  // "+ New" popup: a description plus a level, as JSON. The cheapest model with JSON mode.
  idea: [{ provider: 'workers-ai', model: '@cf/meta/llama-3.1-8b-instruct' }],
  // Details tab: one plain sentence. The quantized model: about a sixth of the input price.
  describe: [{ provider: 'workers-ai', model: '@cf/meta/llama-3.1-8b-instruct-fp8-fast' }],
  // Word meanings for a whole book in one request (only words not in the shared dictionary), as JSON.
  meanings: [{ provider: 'workers-ai', model: '@cf/meta/llama-3.1-8b-instruct', attempts: 2 }],
  // Scala Finish: a whole story children will read. Claude Haiku, then Sonnet if Haiku's
  // answer fails validation twice. Until Claude is built, the Workers AI model does it.
  finish: [
    { provider: 'anthropic', model: 'claude-haiku-4-5', attempts: 2 },
    { provider: 'anthropic', model: 'claude-sonnet-5-5' },
    { provider: 'workers-ai', model: '@cf/meta/llama-3.1-8b-instruct', attempts: 2 },
  ],
  // Lao ↔ English: a translation service, not an LLM.
  translate: [
    { provider: 'google-translate', model: 'nmt' },
    { provider: 'microsoft-translator', model: 'default' },
  ],
};

const TASKS = Object.keys(DEFAULT_ROUTES) as RoutedTask[];

/**
 * The routes to use: the defaults, with any jobs overridden by AI_ROUTES. A malformed
 * override is ignored (and logged) rather than breaking every AI call.
 */
export function routesFrom(override?: string): Routes {
  if (!override?.trim()) return DEFAULT_ROUTES;
  try {
    const parsed = JSON.parse(override) as Record<string, unknown>;
    const routes: Routes = { ...DEFAULT_ROUTES };
    for (const task of TASKS) {
      const list = parsed[task];
      if (list === undefined) continue;
      if (!Array.isArray(list)) throw new Error(`${task} must be a list`);
      routes[task] = list.map((c) => {
        const choice = c as Partial<ModelChoice>;
        if (typeof choice.provider !== 'string' || typeof choice.model !== 'string') throw new Error(`${task}: each entry needs provider and model`);
        const attempts = Number.isInteger(choice.attempts) && choice.attempts! > 0 ? Math.min(choice.attempts!, 3) : 1;
        return { provider: choice.provider, model: choice.model, attempts };
      });
    }
    return routes;
  } catch (e) {
    console.error('AI_ROUTES is not valid JSON routes; using the defaults.', e);
    return DEFAULT_ROUTES;
  }
}

export interface AiRouter {
  /** The text models for a job, in the order to try them, each with its number of attempts. */
  models(task: AiTask): { model: TextModel; attempts: number }[];
  /** The translation service to use, if one is set up. */
  translator(): Translator | undefined;
}

export function aiRouter(
  providers: { text: Record<string, (model: string) => TextModel>; translate?: Record<string, (model: string) => Translator> },
  routes: Routes = DEFAULT_ROUTES,
): AiRouter {
  return {
    models(task) {
      return routes[task].flatMap((choice) => {
        const make = providers.text[choice.provider];
        return make ? [{ model: make(choice.model), attempts: choice.attempts ?? 1 }] : [];
      });
    },
    translator() {
      for (const choice of routes.translate) {
        const make = providers.translate?.[choice.provider];
        if (make) return make(choice.model);
      }
      return undefined;
    },
  };
}

/** One model for every job (tests, and a quick local setup). */
export const singleModel = (model: TextModel, translator?: Translator): AiRouter => ({
  models: () => [{ model, attempts: 2 }],
  translator: () => translator,
});
