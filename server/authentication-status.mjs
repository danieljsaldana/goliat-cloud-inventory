import { authenticationSettings } from './access.mjs';

export function authenticationStatus(env = process.env) {
  try {
    return authenticationSettings(env);
  } catch {
    return null;
  }
}
