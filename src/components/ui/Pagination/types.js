/**
 * @typedef {Object} PaginationProps
 * @property {number} total
 * @property {number} currentPage
 * @property {number} pageSize
 * @property {(page: number) => void} setPage
 * @property {(size: number) => void} [setPageSize]
 * @property {string} label
 * @property {number[]} [pageSizes]
 * @property {string} [pageSizeLabel]
 * @property {boolean} [showPageSize]
 * @property {string} [className]
 *
 * @typedef {Object} PaginationNavigationProps
 * @property {number} pages
 * @property {number} currentPage
 * @property {(page: number) => void} setPage
 *
 * @typedef {{type: 'page', page: number, key: string} | {type: 'ellipsis', key: string}} PageItem
 * @typedef {PaginationNavigationProps & {item: PageItem}} PaginationPageItemProps
 */
export {};
