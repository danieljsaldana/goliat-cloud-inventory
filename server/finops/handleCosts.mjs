import { getCosts } from './service.mjs';
import { getLogger } from '../logging/logger.mjs';

export async function handleCosts(request, { read = getCosts } = {}) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const query = new URL(request.url).searchParams;
  if (
    [...query.keys()].some((key) => !['month', 'basis'].includes(key)) ||
    query.getAll('month').length > 1 ||
    query.getAll('basis').length > 1
  )
    return Response.json({ error: 'invalid_cost_query' }, { status: 400, headers });
  try {
    const costs = await read({
      month: query.get('month') || undefined,
      basis: query.get('basis') || 'ActualCost',
    });
    return Response.json(costs, { headers });
  } catch (error) {
    if (error.message === 'cost_queries_busy')
      return Response.json(
        { error: 'cost_queries_busy' },
        { status: 429, headers: { ...headers, 'Retry-After': '5' } },
      );
    if (['invalid_cost_period', 'invalid_cost_basis'].includes(error.message))
      return Response.json({ error: error.message }, { status: 400, headers });
    getLogger().warn(
      { event: 'finops.unavailable' },
      'No se pudieron consultar los costes de Azure.',
    );
    return Response.json({ error: 'costs_unavailable' }, { status: 503, headers });
  }
}
