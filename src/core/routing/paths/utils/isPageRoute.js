import { PAGE_ROUTES } from '../constants.js';

export function isPageRoute(route) {
  return PAGE_ROUTES.some((page) => page.join('/') === route.join('/'));
}
