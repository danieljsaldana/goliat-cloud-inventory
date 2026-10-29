const guid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function administratorAllowed(session, settings, env = process.env) {
  if (!settings?.enabled || settings.mode !== 'azure-ad' || session?.authMode !== 'azure-ad')
    return false;
  const { objectId, tenantId } = session?.identity || {};
  if (
    typeof objectId !== 'string' ||
    !guid.test(objectId) ||
    typeof tenantId !== 'string' ||
    tenantId.toLowerCase() !== settings.tenantId
  )
    return false;
  const ids = (env.DASHBOARD_ADMIN_OBJECT_IDS || '').split(',').map((id) => id.trim());
  // A malformed list fails closed; display names and email addresses never grant access.
  return (
    ids.every((id) => guid.test(id)) &&
    ids.some((id) => id.toLowerCase() === objectId.toLowerCase())
  );
}
