import { unique } from './unique.mjs';

export const arrayField = (properties, single, multiple) =>
  JSON.stringify(unique([properties[single], ...(properties[multiple] || [])]));
