export function getPayloadConfig(config, item, key) {
  if (!item || typeof item !== 'object') return undefined;
  if (typeof item[key] === 'string') return config[item[key]] || config[key];
  if (typeof item.payload?.[key] === 'string') return config[item.payload[key]] || config[key];
  return config[key];
}
