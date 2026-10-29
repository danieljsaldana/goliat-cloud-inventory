export function loginLocalePath(target, locale) {
  const destination = /^\/(?:[?#]|$)/.test(target)
    ? `/${locale}/${target.slice(1)}`
    : target.replace(/^\/(?:es|en)(?=\/|$|\?|#)/, `/${locale}`);
  const query = new URLSearchParams({ locale, callbackUrl: destination });
  return `/login/?${query}`;
}
