export function dashboardSessionAllowed(session, settings) {
  return !settings.enabled || Boolean(session?.user && session.authMode === settings.mode);
}
