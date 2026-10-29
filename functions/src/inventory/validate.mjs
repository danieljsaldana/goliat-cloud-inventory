import contract from './contract.json' with { type: 'json' };
import { UUID } from '../config.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function counts(rows, fields) {
  const result = new Map();
  for (const row of rows) {
    const key = JSON.stringify(fields.map((field) => row[field] ?? ''));
    result.set(key, (result.get(key) || 0) + 1);
  }
  return result;
}

function assertCounts(rows, expected, fields, counter = 'resources') {
  const keys = rows.map((row) => JSON.stringify(fields.map((field) => row[field] ?? '')));
  assert(
    rows.length === expected.size &&
      new Set(keys).size === rows.length &&
      rows.every(
        (row, index) =>
          Number.isInteger(row[counter]) && row[counter] === expected.get(keys[index]),
      ),
    'Agrupaciones de recursos incoherentes.',
  );
}

function canonicalTags(tags) {
  return JSON.stringify(
    Object.fromEntries(Object.entries(tags).sort(([a], [b]) => a.localeCompare(b))),
  );
}

export function validateDocument(document, maxBytes = 64 * 1024 * 1024) {
  const s = document?.snapshot;
  assert(
    document?.schemaVersion === contract.schemaVersion &&
      document.provider === 'azure' &&
      typeof document.generatedAt === 'string' &&
      Number.isFinite(Date.parse(document.generatedAt)) &&
      new Date(document.generatedAt).toISOString() === document.generatedAt,
    'Cabecera del documento inválida.',
  );
  assert(
    s && ['catalog', 'tagKeys', 'reports', 'totals', 'tags'].every((key) => Array.isArray(s[key])),
    'Snapshot inválido.',
  );
  assert(
    s.catalog.length > 0 &&
      s.catalog.every(
        (r) => UUID.test(r?.subscriptionId) && typeof r.subscriptionName === 'string',
      ),
    'Catálogo inválido.',
  );
  const ids = new Set(s.catalog.map((r) => r.subscriptionId));
  assert(ids.size === s.catalog.length, 'Suscripciones duplicadas.');
  assert(
    s.tagKeys.every((key) => typeof key === 'string' && key && !/[\r\n]/.test(key)) &&
      new Set(s.tagKeys.map((key) => key.toLowerCase())).size === s.tagKeys.length,
    'Etiquetas inválidas.',
  );
  assert(
    s.reports.length === contract.reports.length &&
      new Set(s.reports.map((r) => r?.id)).size === contract.reports.length,
    'Faltan informes o hay duplicados.',
  );
  for (const expected of contract.reports) {
    const report = s.reports.find((r) => r.id === expected.id);
    assert(
      report &&
        Array.isArray(report.headers) &&
        expected.headers.every((header) => report.headers.includes(header)) &&
        (!expected.headers.includes('tags_json') ||
          s.tagKeys.every((key) => report.headers.includes(`tag_${key}`))) &&
        report.headers.every((header) => typeof header === 'string' && header) &&
        new Set(report.headers).size === report.headers.length &&
        Array.isArray(report.rows),
      `Informe inválido: ${expected.id}.`,
    );
    assert(
      report.rows.every(
        (row) =>
          row && typeof row === 'object' && !Array.isArray(row) && ids.has(row.subscriptionId),
      ),
      `Filas fuera del catálogo: ${expected.id}.`,
    );
  }
  const detail = s.reports.find((r) => r.id === 'resources').rows;
  assert(
    detail.every(
      (r) =>
        typeof r.id === 'string' &&
        r.id &&
        typeof r.type === 'string' &&
        r.type &&
        r.tags &&
        typeof r.tags === 'object' &&
        !Array.isArray(r.tags) &&
        Object.values(r.tags).every((value) => typeof value === 'string') &&
        r.resourceProvider === r.type.split('/')[0],
    ),
    'Detalle de recursos inválido.',
  );
  assert(
    new Set(detail.map((r) => r.id.toLowerCase())).size === detail.length,
    'Recursos duplicados.',
  );
  assert(
    detail.every((r) =>
      r.id.toLowerCase().startsWith(`/subscriptions/${r.subscriptionId.toLowerCase()}/`),
    ),
    'IDs de recursos fuera del ámbito.',
  );
  const typeFields = ['subscriptionId', 'resourceProvider', 'type', 'kind'];
  assertCounts(
    s.reports.find((r) => r.id === 'resource-types').rows,
    counts(detail, typeFields),
    typeFields,
  );
  const coverageFields = ['subscriptionId', 'resourceProvider'];
  const coverage = s.reports.find((r) => r.id === 'tag-coverage').rows;
  assertCounts(coverage, counts(detail, coverageFields), coverageFields);
  const tagged = counts(
    detail.filter((r) => Object.keys(r.tags).length),
    coverageFields,
  );
  assert(
    coverage.every(
      (r) =>
        r.withTags === (tagged.get(JSON.stringify(coverageFields.map((field) => r[field]))) || 0) &&
        r.withoutTags === r.resources - r.withTags,
    ),
    'Cobertura de etiquetas incoherente.',
  );
  assert(
    s.totals.length === ids.size &&
      new Set(s.totals.map((r) => r.subscriptionId)).size === ids.size,
    'Totales incompletos.',
  );
  for (const total of s.totals) {
    const rows = detail.filter((r) => r.subscriptionId === total.subscriptionId);
    assert(
      ids.has(total.subscriptionId) &&
        Number.isInteger(total.resources) &&
        total.resources === rows.length &&
        total.distinctTypes === new Set(rows.map((r) => r.type)).size,
      'Totales incoherentes.',
    );
  }
  assert(
    s.tags.every(
      (r) =>
        ids.has(r?.subscriptionId) &&
        Number.isInteger(r.resources) &&
        r.resources > 0 &&
        typeof r.tagsJson === 'string' &&
        JSON.parse(r.tagsJson) &&
        typeof JSON.parse(r.tagsJson) === 'object' &&
        !Array.isArray(JSON.parse(r.tagsJson)),
    ),
    'Agrupaciones de etiquetas inválidas.',
  );
  const tagFields = ['subscriptionId', 'resourceProvider', 'type', 'tagsJson'];
  assertCounts(
    s.tags.map((r) => ({ ...r, tagsJson: canonicalTags(JSON.parse(r.tagsJson)) })),
    counts(
      detail.map((r) => ({ ...r, tagsJson: canonicalTags(r.tags) })),
      tagFields,
    ),
    tagFields,
  );
  const bytes = Buffer.from(JSON.stringify(document), 'utf8');
  assert(bytes.length <= maxBytes, 'Documento demasiado grande.');
  return bytes;
}
