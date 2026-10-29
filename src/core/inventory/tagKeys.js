export function validateTagKeys(keys, { allowEmpty = true } = {}) {
  if (
    !Array.isArray(keys) ||
    keys.length > 128 ||
    (!allowEmpty && !keys.length) ||
    keys.some(
      (key) =>
        typeof key !== 'string' ||
        !key ||
        key !== key.trim() ||
        key.length > 512 ||
        /[,\u0000-\u001f\u007f]/.test(key),
    ) ||
    keys.join(',').length > 4096 ||
    new Set(keys.map((key) => key.toLowerCase())).size !== keys.length
  )
    throw new TypeError('invalid_tags');
  return keys;
}
