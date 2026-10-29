import type { AiOptions } from '../types';
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';
import { PuterProvider } from './PuterProvider';
import type { AiProvider } from './types';

export function createProvider(options: AiOptions): AiProvider {
  if (options.endpoint === undefined) return new PuterProvider();
  if (!options.model?.trim()) throw new Error('An AI model is required when an endpoint is configured');
  return new OpenAICompatibleProvider(options as AiOptions & { endpoint: string; model: string });
}
