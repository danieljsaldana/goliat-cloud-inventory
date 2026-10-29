import { EMPTY_SELECT_VALUE } from '../constants.js';

export function selectValue(value) {
  return String(value ?? '') || EMPTY_SELECT_VALUE;
}
