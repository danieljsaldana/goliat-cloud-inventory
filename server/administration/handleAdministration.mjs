import { functionAdministration } from './functionAdministration.mjs';
import { sameOrigin } from '../refresh/utils/sameOrigin.mjs';
import { RefreshBusyError } from '../refresh/errors.mjs';
import { getLogger } from '../logging/logger.mjs';
import { validateMetricPeriod } from '../../src/features/administration/metricPeriods.js';

export async function handleAdministration(request, { env = process.env, client } = {}) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (request.method === 'POST' && !sameOrigin(request, env))
    return Response.json({ error: 'invalid_origin' }, { status: 403, headers });
  try {
    if (request.method === 'GET') {
      const period = new URL(request.url).searchParams.get('hours');
      const hours = validateMetricPeriod(period === null ? 24 : Number(period));
      client ||= functionAdministration({ env });
      return Response.json(await client.read(request.signal, hours), { headers });
    }
    client ||= functionAdministration({ env });
    if (
      !request.headers.get('content-type')?.startsWith('application/json') ||
      Number(request.headers.get('content-length') || 0) > 32768
    )
      return Response.json({ error: 'invalid_schedule' }, { status: 400, headers });
    const body = await request.text();
    if (body.length > 32768) throw new TypeError('invalid_schedule');
    const input = (() => {
      try {
        return JSON.parse(body);
      } catch {
        throw new TypeError('invalid_schedule');
      }
    })();
    if (input?.action === 'tags') {
      const tags = await client.updateTags(input, request.signal);
      getLogger().info(
        {
          event: 'administration.tags.updated',
          objectId: request.auth?.identity?.objectId,
          count: tags.keys.length,
        },
        'Etiquetas del inventario actualizadas.',
      );
      return Response.json({ tags }, { headers });
    }
    if (body.length > 2048 || (input?.action && input.action !== 'schedule'))
      throw new TypeError('invalid_schedule');
    const schedule = await client.updateSchedule(input, request.signal);
    getLogger().info(
      {
        event: 'administration.schedule.updated',
        objectId: request.auth?.identity?.objectId,
        enabled: schedule.enabled,
        cron: schedule.cron,
      },
      'Programación del inventario actualizada.',
    );
    return Response.json({ schedule }, { headers });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'invalid_metric_period')
      return Response.json({ error: 'invalid_metric_period' }, { status: 400, headers });
    if (error instanceof TypeError && error.message === 'invalid_schedule')
      return Response.json({ error: 'invalid_schedule' }, { status: 400, headers });
    if (error instanceof TypeError && error.message === 'invalid_tags')
      return Response.json({ error: 'invalid_tags' }, { status: 400, headers });
    if (error.status === 409 || error instanceof RefreshBusyError)
      return Response.json(
        {
          error: ['generation_running', 'tags_changed'].includes(error.message)
            ? error.message
            : 'schedule_changed',
        },
        { status: 409, headers },
      );
    getLogger().warn(
      { event: 'administration.unavailable', code: error.code },
      'No se pudo consultar o configurar la Function.',
    );
    return Response.json({ error: 'administration_unavailable' }, { status: 503, headers });
  }
}
