import { createHash } from 'node:crypto';

export function scheduleVersion(properties) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        properties.INVENTORY_SCHEDULE || '',
        properties['AzureWebJobs.inventoryTimer.Disabled'] || 'false',
      ]),
    )
    .digest('hex');
}

export function validateSchedule(input) {
  if (!input || typeof input.enabled !== 'boolean' || !/^[a-f0-9]{64}$/.test(input.version || ''))
    throw new TypeError('invalid_schedule');
  if (input.mode === 'daily' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || '')) {
    const [hour, minute] = input.time.split(':').map(Number);
    return { cron: `0 ${minute} ${hour} * * *`, enabled: input.enabled };
  }
  if (input.mode === 'hourly' && [1, 2, 3, 4, 6, 8, 12].includes(input.hours))
    return { cron: `0 0 */${input.hours} * * *`, enabled: input.enabled };
  throw new TypeError('invalid_schedule');
}

export function readSchedule(properties) {
  const cron = properties.INVENTORY_SCHEDULE || '';
  const daily = cron.match(/^0 (\d|[1-5]\d) (\d|1\d|2[0-3]) \* \* \*$/);
  const hourly = cron.match(/^0 0 \*\/(1|2|3|4|6|8|12) \* \* \*$/);
  const fallbackMode = hourly ? 'hourly' : 'custom';
  return {
    cron,
    enabled: properties['AzureWebJobs.inventoryTimer.Disabled'] !== 'true',
    mode: daily ? 'daily' : fallbackMode,
    time: daily ? `${daily[2].padStart(2, '0')}:${daily[1].padStart(2, '0')}` : '02:00',
    hours: hourly ? Number(hourly[1]) : 6,
    version: scheduleVersion(properties),
  };
}
