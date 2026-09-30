// Which model does which AI job (docs/plans/ai-models.md). Each task lists its models in
// order: the first one that's set up is used, and the rest are fallbacks when its answer
// fails our checks. Providers that aren't set up (no key yet) are skipped.

import type { TextModel } from '../platform';

export type AiTask = 'idea' | 'describe' | 'finish' | 'meanings';
export type Provider = 'workers-ai' | 'anthropic';

export interface ModelChoice {
  provider: Provider;
  model: string;
  /** How many answers to try from this model before moving to the next one. */
  attempts: number;
}

export const TASK_ROUTES: Record<AiTask, ModelChoice[]> = {
  // "+ New" popup: a description plus a level, as JSON. The cheapest model with JSON mode.
  idea: [{ provider: 'workers-ai', model: '@cf/meta/llama-3.1-8b-instruct', attempts: 1 }],
  // Details tab: one plain sentence. The quantized model: about a sixth of the input price.
  describe: [{ provider: 'workers-ai', model: '@cf/meta/llama-3.1-8b-instruct-fp8-fast', attempts: 1 }],
  // Word meanings for a whole book in one request (only words not in the shared dictionary), as JSON.
  meanings: [{ provider: 'workers-ai', model: '@cf/meta/llama-3.1-8b-instruct', attempts: 2 }],
  // Scala Finish: a whole story children will read. Claude Haiku, then Sonnet if Haiku's
  // answer fails validation twice. Until Claude is set up, the Workers AI model does it.
  finish: [
    { provider: 'anthropic', model: 'claude-haiku-4-5', attempts: 2 },
    { provider: 'anthropic', model: 'claude-sonnet-5-5', attempts: 1 },
    { provider: 'workers-ai', model: '@cf/meta/llama-3.1-8b-instruct', attempts: 2 },
  ],
};

/** Makes a model for a provider, or undefined when that provider isn't set up here. */
export type ModelFactory = Partial<Record<Provider, (model: string) => TextModel>>;

export interface AiRouter {
  /** The models for a task, in the order to try them, each with its number of attempts. */
  models(task: AiTask): { model: TextModel; attempts: number }[];
}

export function aiRouter(factory: ModelFactory, routes: Record<AiTask, ModelChoice[]> = TASK_ROUTES): AiRouter {
  return {
    models(task) {
      return routes[task].flatMap((choice) => {
        const make = factory[choice.provider];
        return make ? [{ model: make(choice.model), attempts: choice.attempts }] : [];
      });
    },
  };
}

/** One model for every task (tests, and a quick local setup). */
export const singleModel = (model: TextModel): AiRouter => ({ models: () => [{ model, attempts: 2 }] });
