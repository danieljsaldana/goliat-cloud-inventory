import { nextPageMetadata } from '../../src/core/sharing/utils/nextPageMetadata.js';
import { escapeHtml } from './utils/escapeHtml.mjs';

export function previewHtml(page) {
  const metadata = nextPageMetadata(page);
  const image = metadata.openGraph.images[0];
  const tags = {
    description: page.description,
    robots: page.robots,
    'og:type': metadata.openGraph.type,
    'og:site_name': metadata.openGraph.siteName,
    'og:title': metadata.openGraph.title,
    'og:description': metadata.openGraph.description,
    'og:url': metadata.openGraph.url,
    'og:locale': metadata.openGraph.locale,
    'og:image': image.url,
    'og:image:type': image.type,
    'og:image:width': image.width,
    'og:image:height': image.height,
    'og:image:alt': image.alt,
    'twitter:card': metadata.twitter.card,
    'twitter:title': metadata.twitter.title,
    'twitter:description': metadata.twitter.description,
    'twitter:image': image.url,
    'twitter:image:alt': image.alt,
  };
  return `<!doctype html>
<html lang="${escapeHtml(page.locale)}" prefix="og: https://ogp.me/ns#">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)}</title>
${Object.entries(tags)
  .map(
    ([key, value]) =>
      `<meta ${key.startsWith('og:') ? 'property' : 'name'}="${key}" content="${escapeHtml(value)}">`,
  )
  .join('\n')}
<link rel="canonical" href="${escapeHtml(page.url)}">
</head><body><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.description)}</p>
<img src="${escapeHtml(page.image)}" alt="${escapeHtml(page.imageAlt)}" width="${image.width}" height="${image.height}">
</body></html>`;
}
