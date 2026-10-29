import { SOCIAL_IMAGE } from '../metadata.js';

export function nextPageMetadata(page) {
  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: page.url,
      languages: Object.fromEntries(page.alternates.map((item) => [item.locale, item.url])),
    },
    openGraph: {
      type: 'website',
      siteName: page.siteName,
      title: page.title,
      description: page.description,
      url: page.url,
      locale: page.ogLocale,
      images: [
        {
          url: page.image,
          width: SOCIAL_IMAGE.width,
          height: SOCIAL_IMAGE.height,
          alt: page.imageAlt,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: [{ url: page.image, alt: page.imageAlt }],
    },
  };
}
