export function costSettings(env = process.env) {
  const ids = (env.FINOPS_SUBSCRIPTION_IDS || '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  if (
    ids.length > 20 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id))
  )
    throw new TypeError('invalid_cost_configuration');
  const mode = env.FINOPS_AUTH_MODE || env.AZURE_AUTH_MODE || 'default';
  if (!['default', 'client-secret', 'managed-identity'].includes(mode))
    throw new TypeError('invalid_cost_configuration');
  return { ids, mode };
}
