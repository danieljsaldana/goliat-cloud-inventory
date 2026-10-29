export function pageWindow(total, page, pageSize) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.max(0, Math.min(page, pages - 1));
  const offset = currentPage * pageSize;
  return {
    pages,
    currentPage,
    offset,
    start: total ? offset + 1 : 0,
    end: Math.min(offset + pageSize, total),
  };
}
