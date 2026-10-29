/**
 * @typedef {Object} AzureRawSnapshot
 * @property {Array<Object>} catalog Suscripciones accesibles, incluidas las deshabilitadas.
 * @property {string[]} tagKeys
 * @property {Array<{id: string, headers: string[]|string, rows: Object[]}>} reports Filas brutas del documento de Storage.
 * @property {Object[]} totals
 * @property {Object[]} tags
 *
 * @typedef {Object} AzureSnapshot
 * @property {Object<string, {headers: string[], rows: string[][]}>} files
 * @property {{provider: 'azure', normalizationVersion: number, generatedAt: string}} metadata
 */
export {};
