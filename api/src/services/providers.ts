// Every AI and language service the API can use, and the secret (Worker secret) each one
// needs. This is the one place to add or swap a provider. Which model does which job is
// configuration (ai-routes.ts, or the AI_ROUTES variable), so trying another model needs
// no code change. Research and costs: docs/plans/ai-models.md.
//
// status "built": works when its key (or binding) is there.
// status "stub": declared so its key and routes can be set up, but not written yet; the
// router skips it (and says so in the log) until it's built.

import type { TextModel } from '../platform';
import { workersAiText, type WorkersAi } from './ai';
import { googleTranslate, type Translator } from './translation';

export type ProviderKind = 'text' | 'translate' | 'image';

export interface ProviderInfo {
  id: string;
  kind: ProviderKind;
  status: 'built' | 'stub';
  /** Worker secret holding the key; null when it uses a Cloudflare binding instead. */
  secret: string | null;
  /** Extra settings the provider needs (e.g. a region). */
  extra?: string[];
  docs: string;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'workers-ai', kind: 'text', status: 'built', secret: null, docs: 'https://developers.cloudflare.com/workers-ai/' },
  // Needs the official @anthropic-ai/sdk package (not installed yet).
  { id: 'anthropic', kind: 'text', status: 'stub', secret: 'ANTHROPIC_API_KEY', docs: 'https://docs.anthropic.com/' },
  { id: 'together', kind: 'text', status: 'stub', secret: 'TOGETHER_API_KEY', docs: 'https://docs.together.ai/' },
  { id: 'google-translate', kind: 'translate', status: 'built', secret: 'GOOGLE_TRANSLATE_KEY', docs: 'https://docs.cloud.google.com/translate/docs/reference/rest/v2/translate' },
  { id: 'microsoft-translator', kind: 'translate', status: 'stub', secret: 'MICROSOFT_TRANSLATOR_KEY', extra: ['MICROSOFT_TRANSLATOR_REGION'], docs: 'https://learn.microsoft.com/azure/ai-services/translator/' },
  // Images are switched off (FEATURES.rendering); these are where illustration will plug in.
  { id: 'workers-ai-image', kind: 'image', status: 'stub', secret: null, docs: 'https://developers.cloudflare.com/workers-ai/models/' },
  { id: 'together-image', kind: 'image', status: 'stub', secret: 'TOGETHER_API_KEY', docs: 'https://docs.together.ai/' },
];

/** What the Worker (or dev server) has: the Workers AI binding, and secrets by name. */
export interface ProviderEnv {
  ai?: WorkersAi;
  secrets: Record<string, string | undefined>;
}

type TextFactory = (model: string) => TextModel;
type TranslateFactory = (model: string) => Translator;

/** The built providers, given what's set up. A provider without its key isn't offered. */
export function buildProviders(env: ProviderEnv): { text: Record<string, TextFactory>; translate: Record<string, TranslateFactory> } {
  const key = (name: string | null) => (name ? env.secrets[name]?.trim() || undefined : undefined);
  const text: Record<string, TextFactory> = {};
  const translate: Record<string, TranslateFactory> = {};

  if (env.ai) text['workers-ai'] = (model) => workersAiText(env.ai!, model);
  const google = key('GOOGLE_TRANSLATE_KEY');
  if (google) translate['google-translate'] = () => googleTranslate(google);

  // Stubs with a key set: say once that they're not built, so a route pointing at them is explained.
  for (const p of PROVIDERS) {
    if (p.status === 'stub' && p.secret && key(p.secret)) {
      console.warn(`[providers] ${p.id} has ${p.secret} set but isn't built yet; routes to it are skipped.`);
    }
  }
  return { text, translate };
}
