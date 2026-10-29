import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function architectureDocument(_request, { diagram = 'application' } = {}) {
  const filename = diagram === 'azure' ? 'azure-deployment.html' : 'architecture.html';
  const html = await readFile(join(process.cwd(), 'docs', filename), 'utf8');
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy':
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
    },
  });
}
