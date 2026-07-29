import { type MediaAuthenticityStatus } from '@/lib/types';

export function getFriendlyAuthenticityMessage(status?: MediaAuthenticityStatus): string {
  switch (status) {
    case 'ai_generated':
      return 'This media appears to be AI-generated.';
    case 'likely_human':
      return 'This media does not strongly appear to be AI-generated.';
    case 'inconclusive':
      return 'We could not determine this confidently.';
    case 'unsupported':
      return 'This file type is not supported for AI-generation detection yet.';
    default:
      return 'AI-generation detection is currently unavailable for this file.';
  }
}

export function getAuthenticityToneClass(status?: MediaAuthenticityStatus): 'danger' | 'safe' | 'neutral' {
  if (status === 'ai_generated') return 'danger';
  if (status === 'likely_human') return 'safe';
  return 'neutral';
}
