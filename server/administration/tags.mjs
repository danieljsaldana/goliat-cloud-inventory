import { createHash } from 'node:crypto';
import { validateTagKeys } from '../../src/core/inventory/tagKeys.js';

export function tagsVersion(properties) {
  return createHash('sha256')
    .update(properties.INVENTORY_TAG_KEYS || '')
    .digest('hex');
}

export function readTags(properties) {
  return {
    keys: (properties.INVENTORY_TAG_KEYS || '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean),
    version: tagsVersion(properties),
  };
}

export function validateTags(input) {
  if (!input || !/^[a-f0-9]{64}$/.test(input.version || '')) throw new TypeError('invalid_tags');
  return validateTagKeys(input.keys);
}
