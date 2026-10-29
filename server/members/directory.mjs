import { azureCredential } from '../modules/azure/storage/credential.mjs';
import { objectIdPattern } from './constants.mjs';
import { readMemberPhoto } from './utils/readMemberPhoto.mjs';

const fields = 'id,displayName,mail,userPrincipalName,userType,accountEnabled';
const credentials = new Map();

export function memberDirectory({ env = process.env, credential, request = fetch } = {}) {
  if (!credential) {
    const key = JSON.stringify([
      env.AZURE_AUTH_MODE,
      env.AZURE_CLIENT_ID,
      env.AZURE_TENANT_ID,
      env.AZURE_CLIENT_SECRET,
    ]);
    if (!credentials.has(key)) credentials.set(key, azureCredential(env));
    credential = credentials.get(key);
  }
  async function read(path, signal) {
    const url = new URL(path, 'https://graph.microsoft.com');
    // Never forward the Graph token to an untrusted pagination URL.
    if (
      url.origin !== 'https://graph.microsoft.com' ||
      !/^\/v1\.0\/users(?:\/|$)/.test(url.pathname)
    )
      throw new Error('directory_unavailable');
    const abortSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000);
    const token = await credential.getToken('https://graph.microsoft.com/.default', {
      abortSignal,
    });
    const response = await request(url, {
      signal: abortSignal,
      cache: 'no-store',
      redirect: 'error',
      headers: { Authorization: `Bearer ${token.token}` },
    });
    if (!response.ok)
      throw Object.assign(
        new Error(response.status === 403 ? 'directory_forbidden' : 'directory_unavailable'),
        {
          status: response.status === 404 ? 404 : 503,
        },
      );
    return response;
  }
  function normalize(user) {
    if (
      typeof user?.id !== 'string' ||
      !objectIdPattern.test(user.id) ||
      typeof user.accountEnabled !== 'boolean'
    )
      throw new Error('directory_unavailable');
    return {
      objectId: user.id.toLowerCase(),
      name: user.displayName || user.userPrincipalName || user.id,
      email: user.mail || '',
      principalName: user.userPrincipalName || '',
      type: user.userType === 'Guest' ? 'guest' : 'member',
      enabled: user.accountEnabled,
    };
  }
  return {
    async list(signal) {
      const state = { next: `/v1.0/users?$select=${fields}&$top=999`, pages: 0 };
      const users = new Map();
      const seen = new Set();
      while (state.next) {
        if (seen.has(state.next) || ++state.pages > 100) throw new Error('directory_unavailable');
        seen.add(state.next);
        const page = await (await read(state.next, signal)).json();
        if (!Array.isArray(page.value)) throw new Error('directory_unavailable');
        for (const value of page.value) {
          const user = normalize(value);
          users.set(user.objectId, user);
        }
        state.next = page['@odata.nextLink'];
      }
      return [...users.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    async user(objectId, signal) {
      if (typeof objectId !== 'string' || !objectIdPattern.test(objectId))
        throw new TypeError('invalid_member');
      return normalize(
        await (await read(`/v1.0/users/${objectId}?$select=${fields}`, signal)).json(),
      );
    },
    async photo(objectId, signal) {
      if (typeof objectId !== 'string' || !objectIdPattern.test(objectId))
        throw new TypeError('invalid_member');
      try {
        const response = await read(`/v1.0/users/${objectId}/photos/48x48/$value`, signal);
        return await readMemberPhoto(response);
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    },
  };
}
