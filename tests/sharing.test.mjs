import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPageMetadata, normalizeSiteUrl, SOCIAL_IMAGE } from '../src/core/sharing/metadata.js';
import { nextPageMetadata } from '../src/core/sharing/utils/nextPageMetadata.js';
import { PAGE_ROUTES, pageLocale, parsePagePath, routePath } from '../src/core/routing/paths.js';
import { REPORTS } from '../src/core/inventory/reports.js';
import { CATEGORY_SUMMARIES } from '../src/core/inventory/categories.js';
import { translate } from '../src/core/i18n/translate.js';

test('cada vista e idioma tiene metadatos propios para Next.js, Open Graph y Twitter', () => {
  const urls = new Set();
  for (const siteUrl of ['https://cloud.example/', 'https://cloud.example/dashboard/']) {
    for (const locale of ['es', 'en']) {
      for (const route of PAGE_ROUTES) {
        const page = getPageMetadata(route, locale, siteUrl);
        const metadata = nextPageMetadata(page);
        assert.ok(!urls.has(page.url), page.url);
        urls.add(page.url);
        assert.equal(metadata.alternates.canonical, page.url);
        assert.equal(metadata.alternates.languages[locale], page.url);
        assert.equal(metadata.openGraph.locale, locale === 'es' ? 'es_ES' : 'en_GB');
        assert.deepEqual(metadata.openGraph.images, [
          {
            url: `${siteUrl}${SOCIAL_IMAGE.path}`,
            width: SOCIAL_IMAGE.width,
            height: SOCIAL_IMAGE.height,
            alt: page.imageAlt,
            type: 'image/png',
          },
        ]);
        assert.equal(metadata.twitter.card, 'summary_large_image');
        assert.equal(metadata.twitter.title, page.title);
        assert.equal(metadata.openGraph.title, page.title);
        assert.equal(metadata.openGraph.type, 'website');
        assert.equal(metadata.openGraph.siteName, translate(locale, 'brand.name'));
        assert.deepEqual(metadata.twitter.images, [{ url: page.image, alt: page.imageAlt }]);
        assert.equal(metadata.openGraph.description, page.description);
        assert.equal(metadata.twitter.description, page.description);
        assert.ok(!page.title.includes('undefined'));
        assert.ok(!page.description.includes('{'));
        if (route[1]) {
          const report = [...REPORTS, ...CATEGORY_SUMMARIES].find(({ id }) => id === route[1]);
          assert.ok(page.title.includes(translate(locale, report.labelKey)));
          assert.ok(page.description.includes(translate(locale, report.labelKey)));
        }
      }
    }
  }
  assert.equal(urls.size, 4 * PAGE_ROUTES.length);
});

test('las rutas conservan los prefijos de idioma y admiten una base explícita', () => {
  for (const basePath of ['/', '/dashboard/']) {
    for (const locale of ['es', 'en']) {
      for (const route of PAGE_ROUTES) {
        const path = `${basePath}${routePath(route, locale)}`;
        assert.deepEqual(parsePagePath(path, basePath), { route, locale });
      }
    }
  }
  assert.equal(parsePagePath('/dashboard-other/inventario/', '/dashboard/'), null);
});

test('la URL prevalece sobre el idioma guardado y la raíz usa la preferencia válida', () => {
  assert.equal(routePath([], 'es'), 'es/');
  assert.equal(routePath(['inventario'], 'es'), 'es/inventario/');
  assert.equal(routePath(['inventario'], 'en'), 'en/inventario/');
  assert.equal(routePath([], 'fr'), 'es/');
  for (const locale of ['es', 'en']) {
    for (const route of PAGE_ROUTES) {
      const page = parsePagePath(`/${routePath(route, locale)}`);
      for (const preferred of ['es', 'en']) assert.equal(pageLocale(page, preferred), locale);
    }
  }
  assert.equal(pageLocale(parsePagePath('/'), 'en'), 'en');
  assert.equal(pageLocale(parsePagePath('/')), 'es');
  assert.equal(pageLocale(parsePagePath('/'), 'fr'), 'es');
});

test('solo se admiten vistas con idioma explícito y los metadatos de rutas inválidas son seguros', () => {
  for (const siteUrl of ['https://cloud.example/', 'https://cloud.example/dashboard/']) {
    const basePath = new URL(siteUrl).pathname;
    assert.deepEqual(parsePagePath(basePath, basePath), { route: [], locale: null });
    assert.equal(
      nextPageMetadata(getPageMetadata([], 'es', siteUrl)).alternates.canonical,
      `${siteUrl}es/`,
    );
    for (const path of [
      'inventario/',
      'unknown/',
      'inventario/virtual-machines/',
      'fr/inventario/',
    ])
      assert.equal(parsePagePath(`${basePath}${path}`, basePath), null);
  }
  const page = getPageMetadata(['<script>alert("x")</script>']);
  assert.equal(
    page.title,
    `${translate('es', 'notFound.title')} · ${translate('es', 'brand.name')}`,
  );
  assert.equal(page.description, translate('es', 'notFound.backHome'));
});

test('la URL del sitio se normaliza y rechaza protocolos, credenciales y fragmentos', () => {
  assert.equal(
    normalizeSiteUrl('https://cloud.example/dashboard').href,
    'https://cloud.example/dashboard/',
  );
  for (const value of [
    'javascript:alert(1)',
    'file:///tmp/',
    'https://user:secret@cloud.example/',
    'https://cloud.example/?q=1',
    'https://cloud.example/#/azure',
  ])
    assert.throws(() => normalizeSiteUrl(value));
});

test('la portada compartida existe en public y sus dimensiones coinciden con Open Graph', () => {
  const png = readFileSync(new URL(`../public/${SOCIAL_IMAGE.path}`, import.meta.url));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), SOCIAL_IMAGE.width);
  assert.equal(png.readUInt32BE(20), SOCIAL_IMAGE.height);
});
