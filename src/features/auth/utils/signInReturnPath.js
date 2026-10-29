import { SIGN_IN_NOTICE_PARAM, SIGN_IN_NOTICE_VALUE } from '../constants.js';

export function signInReturnPath(target, origin) {
  const destination = new URL(target, origin);
  destination.searchParams.set(SIGN_IN_NOTICE_PARAM, SIGN_IN_NOTICE_VALUE);
  return `${destination.pathname}${destination.search}${destination.hash}`;
}
