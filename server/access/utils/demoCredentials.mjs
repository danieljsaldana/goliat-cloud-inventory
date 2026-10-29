import { createHash, timingSafeEqual } from 'node:crypto';

export function demoCredentials(credentials, settings) {
  if (
    !settings.enabled ||
    settings.mode !== 'demo' ||
    typeof credentials?.username !== 'string' ||
    typeof credentials?.password !== 'string' ||
    credentials.username.length > 256 ||
    credentials.password.length > 1024
  )
    return null;
  const hash = (value) => createHash('sha256').update(value).digest();
  const userMatches = timingSafeEqual(hash(credentials.username), hash(settings.username));
  const passwordMatches = timingSafeEqual(hash(credentials.password), hash(settings.password));
  return userMatches && passwordMatches ? { id: 'demo', name: settings.username } : null;
}
