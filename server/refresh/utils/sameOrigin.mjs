export function sameOrigin(request, env = process.env) {
  try {
    const expected = new URL(env.AUTH_URL || env.SITE_URL || request.url).origin;
    return (
      request.headers.get('origin') === expected &&
      request.headers.get('sec-fetch-site') !== 'cross-site'
    );
  } catch {
    return false;
  }
}
