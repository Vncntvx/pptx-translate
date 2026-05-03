import { describe, it, expect } from 'vitest';
import { resolveProviderConfig } from '../../src/translation/provider.js';

describe('Provider configuration', () => {
  it('should resolve SiliconFlow provider', () => {
    const config = resolveProviderConfig({
      PROVIDER: 'siliconflow',
      SILICONFLOW_API_KEY: 'sk-test',
    });
    expect(config.baseUrl).toBe('https://api.siliconflow.cn/v1');
    expect(config.apiKey).toBe('sk-test');
    expect(config.model).toBe('deepseek-ai/DeepSeek-V3.2');
    expect(config.rpm).toBe(1000);
    expect(config.tpm).toBe(100000);
  });

  it('should resolve SiliconFlow with model override', () => {
    const config = resolveProviderConfig({
      PROVIDER: 'siliconflow',
      SILICONFLOW_API_KEY: 'sk-test',
      SILICONFLOW_MODEL: 'Qwen/Qwen2.5-72B',
    });
    expect(config.model).toBe('Qwen/Qwen2.5-72B');
  });

  it('should fall back to OPENAI_API_KEY', () => {
    const config = resolveProviderConfig({
      PROVIDER: 'siliconflow',
      OPENAI_API_KEY: 'sk-openai-test',
    });
    expect(config.apiKey).toBe('sk-openai-test');
  });

  it('should resolve OpenAI provider', () => {
    const config = resolveProviderConfig({
      PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-openai-test',
    });
    expect(config.baseUrl).toBe('https://api.openai.com/v1');
    expect(config.model).toBe('gpt-4o');
  });

  it('should resolve DeepSeek provider', () => {
    const config = resolveProviderConfig({
      PROVIDER: 'deepseek',
      DEEPSEEK_API_KEY: 'sk-ds-test',
    });
    expect(config.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(config.model).toBe('deepseek-chat');
  });

  it('should resolve OpenRouter provider', () => {
    const config = resolveProviderConfig({
      PROVIDER: 'openrouter',
      OPENROUTER_API_KEY: 'sk-or-test',
    });
    expect(config.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(config.model).toBe('openai/gpt-4o');
  });

  it('should resolve custom provider', () => {
    const config = resolveProviderConfig({
      PROVIDER: 'custom',
      CUSTOM_BASE_URL: 'https://my-api.example.com/v1',
      CUSTOM_API_KEY: 'my-key',
      CUSTOM_MODEL: 'my-model',
      CUSTOM_RPM: '30',
      CUSTOM_TPM: '50000',
    });
    expect(config.baseUrl).toBe('https://my-api.example.com/v1');
    expect(config.apiKey).toBe('my-key');
    expect(config.model).toBe('my-model');
    expect(config.rpm).toBe(30);
    expect(config.tpm).toBe(50000);
  });

  it('should default to SiliconFlow when no PROVIDER set', () => {
    const config = resolveProviderConfig({
      SILICONFLOW_API_KEY: 'sk-test',
    });
    expect(config.baseUrl).toBe('https://api.siliconflow.cn/v1');
  });

  it('should throw for unknown provider', () => {
    expect(() => resolveProviderConfig({
      PROVIDER: 'unknown',
      OPENAI_API_KEY: 'sk-test',
    })).toThrow('Unknown provider');
  });

  it('should throw for custom provider without required fields', () => {
    expect(() => resolveProviderConfig({
      PROVIDER: 'custom',
    })).toThrow('CUSTOM_BASE_URL and CUSTOM_API_KEY');
  });

  it('should throw when no API key is available', () => {
    expect(() => resolveProviderConfig({
      PROVIDER: 'openai',
    })).toThrow('API key required');
  });

  it('should apply RPM/TPM overrides', () => {
    const config = resolveProviderConfig({
      PROVIDER: 'siliconflow',
      SILICONFLOW_API_KEY: 'sk-test',
      SILICONFLOW_RPM: '500',
      SILICONFLOW_TPM: '200000',
    });
    expect(config.rpm).toBe(500);
    expect(config.tpm).toBe(200000);
  });
});