import { demoProvider } from './demo.mjs';
import { azureAdProvider } from './azureAd.mjs';

export function authenticationProviders(settings) {
  if (!settings.enabled) return [];
  if (settings.mode === 'demo') return [demoProvider(settings)];
  return [azureAdProvider(settings)];
}
