import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_ROUTES, routePath } from '../src/core/routing/paths.js';
import { getPageMetadata } from '../src/core/sharing/metadata.js';
import { sharingPageForPath } from '../src/core/sharing/utils/sharingPageForPath.js';
import { previewHtml } from '../server/sharing/previewHtml.mjs';
import { previewResponse } from '../server/sharing/previewResponse.mjs';

const SITE_URL = 'https://cloud.example/';
const BOT_HEADERS = { 'user-agent': 'facebookexternalhit/1.1' };

test('cada página comparte título, descripción y PNG en el head sin necesitar una sesión', async () => {
  for (const locale of ['es', 'en']) {
    for (const route of PAGE_ROUTES) {
      const page = getPageMetadata(route, locale, SITE_URL);
      const request = new Request(page.url, { headers: BOT_HEADERS });
      const response = previewResponse(request, { SITE_URL });
      assert.equal(response.status, 200, page.url);
      assert.match(response.headers.get('content-type'), /^text\/html/);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
      assert.equal(response.headers.get('vary'), 'User-Agent, Cookie');
      const html = await response.text();
      const head = html.split('</head>')[0];
      assert.ok(head.includes(`<title>${page.title}</title>`), page.url);
      assert.ok(head.includes(`property="og:title" content="${page.title}"`), page.url);
      assert.ok(head.includes(`property="og:description" content="${page.description}"`), page.url);
      assert.ok(head.includes(`property="og:url" content="${page.url}"`), page.url);
      assert.ok(
        head.includes(`property="og:image" content="${SITE_URL}social/cloud-inventory.png"`),
      );
      assert.ok(head.includes('property="og:image:type" content="image/png"'));
      assert.ok(head.includes('name="twitter:card" content="summary_large_image"'));
      assert.ok(head.includes(`name="twitter:description" content="${page.description}"`));
      assert.ok(head.includes(`name="twitter:image" content="${page.image}"`));
      assert.ok(!html.includes('<script'));
    }
  }
});

test('las redes sociales admiten GET y HEAD, pero su identificador nunca autoriza escrituras', async () => {
  for (const userAgent of [
    'facebookexternalhit/1.1',
    'Facebot',
    'Twitterbot/1.0',
    'LinkedInBot/1.0',
    'Slackbot-LinkExpanding 1.0',
    'Discordbot/2.0',
    'WhatsApp/2.0',
    'TelegramBot (like TwitterBot)',
    'SkypeUriPreview',
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const response = previewResponse(
        new Request(`${SITE_URL}es/inventario/`, {
          method,
          headers: { 'user-agent': userAgent },
        }),
        { SITE_URL },
      );
      assert.equal(response.status, 200, `${method} ${userAgent}`);
      if (method === 'HEAD') assert.equal(await response.text(), '');
    }
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal(
        previewResponse(
          new Request(`${SITE_URL}es/inventario/`, {
            method,
            headers: { 'user-agent': userAgent },
          }),
          { SITE_URL },
        ),
        null,
      );
    }
  }
});

test('las API, los documentos privados y las rutas desconocidas conservan el control de acceso', () => {
  for (const path of [
    'api/inventory/azure/',
    'api/inventory/azure/refresh/',
    'api/admin/function/',
    'api/auth/session/',
    'docs/architecture.html',
    'login/',
    'es/inventario/48_functions/',
    'es/inventario/unknown/',
    'fr/inventario/',
    'es/azure/',
    'en/azure/postgresql/',
  ]) {
    assert.equal(
      previewResponse(new Request(SITE_URL + path, { headers: BOT_HEADERS }), { SITE_URL }),
      null,
      path,
    );
  }
  for (const userAgent of ['', 'Mozilla/5.0', 'Googlebot/2.1']) {
    assert.equal(
      previewResponse(
        new Request(`${SITE_URL}es/inventario/`, {
          headers: { 'user-agent': userAgent },
        }),
        { SITE_URL },
      ),
      null,
    );
  }
});

test('la vista previa ignora cookies, cabeceras de identidad y filtros privados', async () => {
  const response = previewResponse(
    new Request(
      `${SITE_URL}es/inventario/postgresql/?subscription=private-subscription&secret=private-query`,
      {
        headers: {
          ...BOT_HEADERS,
          cookie: 'authjs.session-token=private-session',
          'x-ms-client-principal': 'private-identity',
        },
      },
    ),
    { SITE_URL },
  );
  const html = await response.text();
  for (const value of [
    'private-subscription',
    'private-query',
    'private-session',
    'private-identity',
  ]) {
    assert.ok(!html.includes(value));
  }
  assert.ok(html.includes('content="https://cloud.example/es/inventario/postgresql/"'));
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
});

test('los textos y atributos de la vista previa escapan HTML', () => {
  const attack = `"><script>alert('x')</script>&`;
  const page = getPageMetadata([], 'es', SITE_URL);
  const html = previewHtml({ ...page, title: attack, description: attack, imageAlt: attack });
  assert.ok(!html.includes(attack));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;'));
});

test('la resolución de la página mantiene el idioma, la base y el dominio configurado', async () => {
  const base = 'https://cloud.example/dashboard/';
  for (const locale of ['es', 'en']) {
    for (const route of PAGE_ROUTES) {
      const path = `/dashboard/${routePath(route, locale)}`;
      assert.deepEqual(sharingPageForPath(path, base), getPageMetadata(route, locale, base));
    }
  }
  assert.equal(sharingPageForPath('/dashboard-other/es/inventario/', base), null);
  assert.equal(sharingPageForPath('/es/inventario/', base), null);
  assert.equal(sharingPageForPath('/', SITE_URL, 'en').locale, 'en');
  const response = previewResponse(
    new Request('https://untrusted.example/es/inventario/', { headers: BOT_HEADERS }),
    { SITE_URL },
  );
  const html = await response.text();
  assert.ok(html.includes(`${SITE_URL}social/cloud-inventory.png`));
  assert.ok(!html.includes('untrusted.example'));
});
