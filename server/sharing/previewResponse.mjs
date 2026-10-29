import { sharingPageForPath } from '../../src/core/sharing/utils/sharingPageForPath.js';
import { SOCIAL_PREVIEW_AGENT } from './constants.mjs';
import { previewHtml } from './previewHtml.mjs';

export function previewResponse(request, env = process.env) {
  if (
    !['GET', 'HEAD'].includes(request.method) ||
    !SOCIAL_PREVIEW_AGENT.test(request.headers.get('user-agent') || '')
  )
    return null;
  const url = new URL(request.url);
  const page = sharingPageForPath(url.pathname, env.SITE_URL || url.origin + '/');
  if (!page) return null;
  return new Response(request.method === 'HEAD' ? null : previewHtml(page), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      Vary: 'User-Agent, Cookie',
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}
