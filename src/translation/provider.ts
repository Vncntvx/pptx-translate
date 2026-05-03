// Provider configuration: resolves API settings from env vars

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  rpm: number;
  tpm: number;
}

const PROVIDER_PRESETS: Record<string, { baseUrl: string; defaultModel: string; defaultRpm: number; defaultTpm: number }> = {
  siliconflow: {
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3.2',
    defaultRpm: 1000,
    defaultTpm: 100000,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    defaultRpm: 500,
    defaultTpm: 300000,
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    defaultRpm: 60,
    defaultTpm: 100000,
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o',
    defaultRpm: 100,
    defaultTpm: 200000,
  },
};

export function resolveProviderConfig(env: Record<string, string | undefined>): ProviderConfig {
  const provider = (env.PROVIDER || 'siliconflow').toLowerCase();

  // Custom provider — all fields must be provided
  if (provider === 'custom') {
    const baseUrl = env.CUSTOM_BASE_URL;
    const apiKey = env.CUSTOM_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error('Custom provider requires CUSTOM_BASE_URL and CUSTOM_API_KEY');
    }
    return {
      baseUrl,
      apiKey,
      model: env.CUSTOM_MODEL || 'default',
      rpm: parseInt(env.CUSTOM_RPM || '60', 10),
      tpm: parseInt(env.CUSTOM_TPM || '100000', 10),
    };
  }

  const preset = PROVIDER_PRESETS[provider];
  if (!preset) {
    throw new Error(`Unknown provider: "${provider}". Supported: siliconflow, openai, deepseek, openrouter, custom`);
  }

  // Provider-specific env vars (uppercase provider name prefix)
  const keyPrefix = provider.toUpperCase();
  const apiKey = env[`${keyPrefix}_API_KEY`] || env.OPENAI_API_KEY || '';
  const modelOverride = env[`${keyPrefix}_MODEL`];
  const rpmOverride = env[`${keyPrefix}_RPM`];
  const tpmOverride = env[`${keyPrefix}_TPM`];

  if (!apiKey) {
    throw new Error(`API key required: set ${keyPrefix}_API_KEY or OPENAI_API_KEY`);
  }

  return {
    baseUrl: preset.baseUrl,
    apiKey,
    model: modelOverride || preset.defaultModel,
    rpm: parseInt(rpmOverride || String(preset.defaultRpm), 10),
    tpm: parseInt(tpmOverride || String(preset.defaultTpm), 10),
  };
}