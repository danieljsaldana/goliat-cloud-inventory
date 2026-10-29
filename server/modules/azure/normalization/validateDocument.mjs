import { DOCUMENT_SCHEMA_VERSION, RAW_REPORT_IDS } from '../documentConstants.mjs';

export function validateAzureDocument(document) {
  const raw = document?.snapshot;
  if (
    document?.schemaVersion !== DOCUMENT_SCHEMA_VERSION ||
    document?.provider !== 'azure' ||
    typeof document.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(document.generatedAt)) ||
    new Date(document.generatedAt).toISOString() !== document.generatedAt ||
    !raw ||
    ['catalog', 'tagKeys', 'reports', 'totals', 'tags'].some((key) => !Array.isArray(raw[key]))
  ) {
    throw new Error('Documento Azure inválido o versión de contrato no soportada.');
  }
  if (
    !raw.catalog.length ||
    raw.catalog.some(
      (item) =>
        !item ||
        typeof item.subscriptionId !== 'string' ||
        !item.subscriptionId ||
        typeof item.subscriptionName !== 'string',
    ) ||
    new Set(raw.catalog.map((item) => item.subscriptionId)).size !== raw.catalog.length ||
    raw.tagKeys.some((key) => typeof key !== 'string' || !key || /[\r\n]/.test(key)) ||
    new Set(raw.tagKeys.map((key) => key.toLowerCase())).size !== raw.tagKeys.length
  ) {
    throw new Error('Catálogo de suscripciones o etiquetas Azure inválido.');
  }
  const ids = new Set(raw.reports.map((report) => report?.id));
  if (
    ids.size !== raw.reports.length ||
    RAW_REPORT_IDS.some((id) => !ids.has(id)) ||
    raw.reports.some(
      (report) =>
        !report ||
        !RAW_REPORT_IDS.includes(report.id) ||
        !(typeof report.headers === 'string' || Array.isArray(report.headers)) ||
        !report.headers.length ||
        (Array.isArray(report.headers) &&
          (report.headers.some((header) => typeof header !== 'string' || !header) ||
            new Set(report.headers).size !== report.headers.length)) ||
        !Array.isArray(report.rows) ||
        report.rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row)),
    ) ||
    [...raw.totals, ...raw.tags].some(
      (row) => !row || typeof row !== 'object' || Array.isArray(row),
    )
  ) {
    throw new Error('El documento Azure no contiene todos los informes brutos válidos.');
  }
}
