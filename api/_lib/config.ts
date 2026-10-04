// Server-only configuration. API keys are read here and never sent to the browser.
//
// Two provider styles are supported:
// - "anthropic": Claude through the Anthropic SDK (ANTHROPIC_API_KEY).
// - "openai": any OpenAI-compatible chat API, e.g. Google Gemini, Featherless or
//   Backboard (AI_BASE_URL + AI_API_KEY + AI_MODEL).

export type AiMode = 'live' | 'demo';
export type ProviderKind = 'anthropic' | 'openai';

function providerLabel(baseUrl: string): string {
  let host = '';
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return 'an OpenAI-compatible AI provider';
  }
  if (/googleapis\.com$/.test(host)) return 'Google (Gemini)';
  if (/featherless/.test(host)) return 'Featherless.ai';
  if (/backboard/.test(host)) return 'Backboard.io';
  if (/openai\.com$/.test(host)) return 'OpenAI';
  return host;
}

export function aiConfig() {
  const forcedDemo = (process.env.AI_MODE ?? '').trim().toLowerCase() === 'demo';
  const baseUrl = (process.env.AI_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const explicit = (process.env.AI_PROVIDER ?? '').trim().toLowerCase();
  const kind: ProviderKind = explicit === 'anthropic' ? 'anthropic' : explicit === 'openai' || baseUrl ? 'openai' : 'anthropic';

  const key = (kind === 'openai' ? process.env.AI_API_KEY : process.env.ANTHROPIC_API_KEY)?.trim() ?? '';
  const model = (process.env.AI_MODEL ?? '').trim() || (kind === 'anthropic' ? 'claude-opus-5-5' : '');
  const missing =
    kind === 'openai'
      ? [!baseUrl && 'AI_BASE_URL', !key && 'AI_API_KEY', !model && 'AI_MODEL'].filter(Boolean).join(', ')
      : key
        ? ''
        : 'ANTHROPIC_API_KEY';
  const mode: AiMode = !forcedDemo && !missing ? 'live' : 'demo';
  return {
    mode,
    kind,
    key,
    model,
    baseUrl,
    provider: kind === 'anthropic' ? 'Anthropic (Claude)' : providerLabel(baseUrl),
    reason: forcedDemo ? 'AI_MODE=demo is set' : missing ? `${missing} is not configured` : '',
  };
}
