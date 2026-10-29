import {
  DefaultAzureCredential,
  ClientSecretCredential,
  ManagedIdentityCredential,
} from '@azure/identity';
import { required } from '../../../config.mjs';
export function azureCredential(env = process.env) {
  switch (env.AZURE_AUTH_MODE || 'default') {
    case 'client-secret':
      return new ClientSecretCredential(
        required('AZURE_TENANT_ID', env),
        required('AZURE_CLIENT_ID', env),
        required('AZURE_CLIENT_SECRET', env),
      );
    case 'managed-identity':
      return new ManagedIdentityCredential(
        env.AZURE_CLIENT_ID ? { clientId: env.AZURE_CLIENT_ID } : {},
      );
    case 'default':
      return new DefaultAzureCredential();
    default:
      throw new Error('AZURE_AUTH_MODE debe ser default, client-secret o managed-identity.');
  }
}
