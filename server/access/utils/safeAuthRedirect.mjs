export function safeAuthRedirect(value, origin) {
  try {
    const url = new URL(value, origin);
    if (url.origin === origin && !url.username && !url.password) return url.href;
  } catch {
    /* Un destino inválido vuelve al dashboard. */
  }
  return new URL('/es/', origin).href;
}
