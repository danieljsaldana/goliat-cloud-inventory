import '../src/styles/index.css';
import { headers } from 'next/headers';

export const metadata = { robots: { index: false, follow: false } };

export default async function RootLayout({ children }) {
  const locale = (await headers()).get('x-inventory-locale') === 'en' ? 'en' : 'es';
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
