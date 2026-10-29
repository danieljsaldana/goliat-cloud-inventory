/**
 * @typedef {import('../../core/table/types.js').TableFile} TableFile
 * @typedef {{generatedAt?: string, source?: string, complete?: boolean}} InventoryMetadata
 * @typedef {{id: string, code: string, status?: number}} InventoryError
 * @typedef {object} InventorySnapshot
 * @property {Record<string, TableFile>} files
 * @property {InventoryMetadata|null} metadata
 * @property {InventoryError[]} errors
 * @property {boolean} loading
 * @property {() => Promise<import('../../hooks/types.js').AsyncResourceResult>} reload
 *
 * @typedef {object} DashboardPageProps
 * @property {'azure'} provider
 * @property {string} [reportId]
 * @property {InventorySnapshot} inventory
 * @property {string} subscription
 * @property {(id: string) => void} setSubscription
 */
export {};
