import { authenticationSettings } from '../access.mjs';

export function membersSettings(env = process.env) {
  const settings = authenticationSettings(env);
  if (env.DASHBOARD_MEMBERS_ENABLED !== 'true' || !settings.enabled || settings.mode !== 'azure-ad')
    throw Object.assign(new Error('members_unconfigured'), { status: 503 });
  return settings;
}
