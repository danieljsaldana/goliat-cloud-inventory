import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPublicStars, readStarSnapshot, getStarSnapshot } from '../site/github.js';
const repository = 'https://github.com/example/nexus';
const memory = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('public stars include a real zero, omit credentials and are cached', async () => {
  const storage = memory();
  const state = { calls: 0, time: 1000 };
  const fetcher = async (url, options) => {
    state.calls++;
    assert.equal(url, 'https://api.github.com/repos/example/nexus');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    assert.equal(options.headers.Authorization, undefined);
    return {
      ok: true,
      json: async () => ({ private: false, full_name: 'example/nexus', stargazers_count: 0 }),
    };
  };
  assert.equal(await getPublicStars(repository, { fetcher, storage, now: () => state.time }), 0);
  assert.equal(
    await getPublicStars(repository, { fetcher, storage, now: () => state.time + 1000 }),
    0,
  );
  assert.equal(state.calls, 1);
  state.time += 900001;
  await getPublicStars(repository, { fetcher, storage, now: () => state.time });
  assert.equal(state.calls, 2);
});
test('private, rate limited, offline and malformed responses never invent a count', async () => {
  for (const fetcher of [
    async () => ({ ok: false, status: 404 }),
    async () => ({ ok: false, status: 429 }),
    async () => {
      throw Error('offline');
    },
    async () => ({
      ok: true,
      json: async () => ({ private: true, full_name: 'example/nexus', stargazers_count: 7 }),
    }),
    async () => ({
      ok: true,
      json: async () => ({
        private: false,
        full_name: 'different/repository',
        stargazers_count: 7,
      }),
    }),
    async () => ({
      ok: true,
      json: async () => ({ private: false, full_name: 'example/nexus', stargazers_count: -1 }),
    }),
  ])
    assert.equal(await getPublicStars(repository, { fetcher }), null);
});
test('failed requests are cached briefly and do not block retries after expiry', async () => {
  const storage = memory();
  const state = { calls: 0 };
  const fetcher = async () => {
    state.calls++;
    return { ok: false, status: 404 };
  };
  await getPublicStars(repository, { fetcher, storage, now: () => 1000 });
  await getPublicStars(repository, { fetcher, storage, now: () => 2000 });
  assert.equal(state.calls, 1);
  await getPublicStars(repository, { fetcher, storage, now: () => 302000 });
  assert.equal(state.calls, 2);
});
test('untrusted URLs are rejected and slow requests time out', async () => {
  for (const url of [
    'https://github.com.evil.test/example/nexus',
    'https://secret@github.com/example/nexus',
    'https://github.com/example/nexus?token=secret',
    'not-a-url',
  ]) {
    assert.equal(
      await getPublicStars(url, {
        fetcher: () => {
          assert.fail('must not fetch');
        },
      }),
      null,
    );
  }
  const fetcher = (_, options) =>
    new Promise((resolve, reject) =>
      options.signal.addEventListener('abort', () => reject(Error('aborted')), { once: true }),
    );
  assert.equal(await getPublicStars(repository, { fetcher, timeoutMs: 10 }), null);
});

test('verified snapshots retain real zero and reject mismatched or invalid metadata', () => {
  const snapshot = { repository, count: 0, checked_at: '2026-01-01T12:00:00Z' };
  assert.deepEqual(readStarSnapshot(repository, snapshot), {
    count: 0,
    checkedAt: snapshot.checked_at,
  });
  for (const invalid of [
    { ...snapshot, repository: 'https://github.com/someone/else' },
    { ...snapshot, count: -1 },
    { ...snapshot, count: '0' },
    { ...snapshot, checked_at: 'invalid' },
    { ...snapshot, checked_at: '2999-01-01T00:00:00Z' },
    null,
  ]) {
    assert.equal(readStarSnapshot(repository, invalid), null);
  }
});

test('fresh scheduled metadata includes zero without a GitHub API request and uses cache', async () => {
  const storage = memory();
  const state = { calls: 0 };
  const at = Date.now(),
    date = new Date(at - 3600000).toISOString();
  const fetcher = async (url, options) => {
    state.calls++;
    assert.equal(url, 'https://raw.githubusercontent.com/example/nexus/github-stats/stars.json');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers?.Authorization, undefined);
    return { ok: true, json: async () => ({ repository, count: 0, checked_at: date }) };
  };
  assert.deepEqual(await getStarSnapshot(repository, { fetcher, storage, now: () => at }), {
    count: 0,
    checkedAt: date,
  });
  assert.equal(
    (await getStarSnapshot(repository, { fetcher, storage, now: () => at + 1000 })).count,
    0,
  );
  assert.equal(state.calls, 1);
});

test('missing or stale daily data can use the live API, but never another repository snapshot', async () => {
  const at = Date.now();
  const state = { calls: 0 };
  const fetcher = async (url) => {
    state.calls++;
    return url === 'https://raw.githubusercontent.com/example/nexus/github-stats/stars.json'
      ? {
          ok: true,
          json: async () => ({
            repository: 'https://github.com/someone/else',
            count: 999,
            checked_at: new Date(at).toISOString(),
          }),
        }
      : {
          ok: true,
          json: async () => ({ private: false, full_name: 'example/nexus', stargazers_count: 3 }),
        };
  };
  assert.deepEqual(await getStarSnapshot(repository, { fetcher, now: () => at }), {
    count: 3,
    checkedAt: new Date(at).toISOString(),
  });
  assert.equal(state.calls, 2);
});

test('offline requests retain the dated known value without inventing zero or freshness', async () => {
  const checked_at = new Date(Date.now() - 259200000).toISOString();
  const fetcher = async () => {
    throw Error('offline');
  };
  assert.deepEqual(
    await getStarSnapshot(repository, { fetcher, fallback: { repository, count: 7, checked_at } }),
    { count: 7, checkedAt: checked_at },
  );
  assert.equal(await getStarSnapshot(repository, { fetcher }), null);
  const state = { calls: 0 };
  assert.equal(
    await getStarSnapshot('https://example.com/repo', {
      fetcher: async () => {
        state.calls++;
      },
    }),
    null,
  );
  assert.equal(state.calls, 0);
});
