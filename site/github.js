// Public repository metadata only. Tokens stay in the scheduled GitHub job.
function repositoryName(repository) {
  try {
    const url = new URL(repository);
    const match = url.pathname.match(/^\/([\w-]+)\/([\w.-]+)\/?$/);
    if (
      url.origin !== 'https://github.com' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !match
    )
      return null;
    return match.slice(1).join('/');
  } catch {
    return null;
  }
}

async function apiSnapshot(
  repository,
  { fetcher = globalThis.fetch, storage = null, now = Date.now, timeoutMs = 4000 } = {},
) {
  const name = repositoryName(repository);
  if (!name) return null;
  const key = 'goliat:github-api-stars:' + name;
  const valid = (value) => value === null || (Number.isSafeInteger(value) && value >= 0);
  try {
    const cached = JSON.parse(storage?.getItem(key) ?? 'null');
    if (
      cached &&
      valid(cached.count) &&
      Number.isFinite(cached.at) &&
      cached.at <= now() &&
      now() - cached.at < (cached.count === null ? 300000 : 900000)
    )
      return cached.count === null
        ? null
        : { count: cached.count, checkedAt: new Date(cached.at).toISOString() };
  } catch {
    /* Storage may be unavailable or contain an old value. */
  }
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeoutMs);
  const state = { count: null };
  try {
    const response = await fetcher('https://api.github.com/repos/' + name, {
      headers: { Accept: 'application/vnd.github+json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (response.ok) {
      const data = await response.json();
      if (
        data.private === false &&
        data.full_name?.toLowerCase() === name.toLowerCase() &&
        Number.isSafeInteger(data.stargazers_count) &&
        data.stargazers_count >= 0
      )
        state.count = data.stargazers_count;
    }
  } catch {
    /* Private, offline, rate limited or timed out: retain the plain GitHub link. */
  } finally {
    clearTimeout(timer);
  }
  try {
    storage?.setItem(key, JSON.stringify({ count: state.count, at: now() }));
  } catch {
    /* No storage is required. */
  }
  return state.count === null
    ? null
    : { count: state.count, checkedAt: new Date(now()).toISOString() };
}

export async function getPublicStars(repository, options = {}) {
  return (await apiSnapshot(repository, options))?.count ?? null;
}

export function formatStarCount(count, locale = 'en') {
  return new Intl.NumberFormat(
    count >= 1000 ? 'en' : locale,
    count >= 1000 ? { notation: 'compact', maximumFractionDigits: 1 } : {},
  ).format(count);
}

// A verified, dated snapshot keeps static/private previews useful without tokens.
export function readStarSnapshot(repository, snapshot, { now = Date.now } = {}) {
  if (
    snapshot?.repository !== repository ||
    !Number.isSafeInteger(snapshot.count) ||
    snapshot.count < 0 ||
    typeof snapshot.checked_at !== 'string'
  )
    return null;
  const checked = Date.parse(snapshot.checked_at);
  if (!Number.isFinite(checked) || checked > now() + 300000) return null;
  return { count: snapshot.count, checkedAt: snapshot.checked_at };
}

export async function getStarSnapshot(
  repository,
  {
    fetcher = globalThis.fetch,
    storage = null,
    now = Date.now,
    timeoutMs = 4000,
    fallback = null,
  } = {},
) {
  const name = repositoryName(repository);
  if (!name) return null;
  const key = 'goliat:github-stars-snapshot:' + name;
  const state = { known: readStarSnapshot(repository, fallback, { now }) };
  const prefer = (snapshot) => {
    if (
      snapshot &&
      (!state.known || Date.parse(snapshot.checkedAt) > Date.parse(state.known.checkedAt))
    )
      state.known = snapshot;
    return state.known;
  };
  const remember = (snapshot, at = now()) => {
    if (snapshot)
      try {
        storage?.setItem(
          key,
          JSON.stringify({
            at,
            snapshot: { repository, count: snapshot.count, checked_at: snapshot.checkedAt },
          }),
        );
      } catch {
        /* Optional cache or network metadata may be unavailable. */
      }
    return snapshot;
  };
  try {
    const cached = JSON.parse(storage?.getItem(key) ?? 'null');
    const value = readStarSnapshot(repository, cached?.snapshot, { now });
    if (value && Number.isFinite(cached.at) && cached.at >= 0 && cached.at <= now()) {
      prefer(value);
      if (now() - cached.at < 900000) return remember(state.known, cached.at);
    }
  } catch {
    /* Optional cache or network metadata may be unavailable. */
  }
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(
      `https://raw.githubusercontent.com/${name}/github-stats/stars.json`,
      {
        cache: 'no-cache',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      },
    );
    if (response.ok) {
      const daily = readStarSnapshot(repository, await response.json(), { now });
      if (daily) {
        prefer(daily);
        if (now() - Date.parse(daily.checkedAt) < 172800000) return remember(state.known);
      }
    }
  } catch {
    /* Optional cache or network metadata may be unavailable. */
  } finally {
    clearTimeout(timer);
  }
  const live = await apiSnapshot(repository, { fetcher, storage, now, timeoutMs });
  return remember(prefer(live));
}
