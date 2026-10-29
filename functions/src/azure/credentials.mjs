import {
  ClientSecretCredential,
  DefaultAzureCredential,
  ManagedIdentityCredential,
} from '@azure/identity';

export function credential(env = process.env) {
  const mode = env.AZURE_AUTH_MODE || 'default';
  if (mode === 'default') return new DefaultAzureCredential();
  if (mode === 'managed-identity')
    return new ManagedIdentityCredential(
      env.AZURE_CLIENT_ID ? { clientId: env.AZURE_CLIENT_ID } : {},
    );
  if (
    mode === 'client-secret' &&
    env.AZURE_TENANT_ID &&
    env.AZURE_CLIENT_ID &&
    env.AZURE_CLIENT_SECRET
  ) {
    return new ClientSecretCredential(
      env.AZURE_TENANT_ID,
      env.AZURE_CLIENT_ID,
      env.AZURE_CLIENT_SECRET,
    );
  }
  throw new Error('Credencial Azure incompleta o modo no soportado.');
}
