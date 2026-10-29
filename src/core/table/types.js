/**
 * @typedef {object} TableFile
 * @property {string[]} headers Identificadores originales de las columnas.
 * @property {string[][]} rows Filas rectangulares; las celdas conservan datos del proveedor.
 *
 * @typedef {object} TableSort
 * @property {string} key
 * @property {1|-1} direction
 *
 * @typedef {object} TableOptions
 * @property {string} [search]
 * @property {Record<string, string>} [filters]
 * @property {string} [groupBy]
 * @property {TableSort|null} [sort]
 */
export {};
