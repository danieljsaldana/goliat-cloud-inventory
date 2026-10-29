const GRAPH_PATH = '/providers/Microsoft.ResourceGraph/resources?api-version=2024-04-01';
const GRAPH_QUERY =
  'Resources | project id, name, type, location, resourceGroup, subscriptionId, kind, tags, sku, zones, identity, properties | order by id asc';
const NETWORK = new Set([
  'microsoft.network/virtualnetworks',
  'microsoft.network/networksecuritygroups',
  'microsoft.network/privateendpoints',
]);
const DATABASE_APIS = {
  'microsoft.dbforpostgresql/flexibleservers': '2024-08-01',
  'microsoft.dbformysql/flexibleservers': '2024-12-30',
};

async function graphResources(arm, subscriptionId, signal) {
  const state = { token: undefined, rows: [], tokens: new Set(), total: undefined };
  do {
    const result = await arm.request(GRAPH_PATH, {
      signal,
      body: {
        subscriptions: [subscriptionId],
        query: GRAPH_QUERY,
        options: {
          resultFormat: 'objectArray',
          $top: 1000,
          ...(state.token ? { $skipToken: state.token } : {}),
        },
      },
    });
    if (!Array.isArray(result.data)) throw new Error('Respuesta Resource Graph inválida.');
    state.total = result.totalRecords;
    state.rows.push(...result.data);
    if (state.rows.length > 100000)
      throw new Error('Inventario excesivo; divide el ámbito de recogida.');
    state.token = result.$skipToken;
    if (state.token && state.tokens.has(state.token))
      throw new Error('Paginación Resource Graph repetida.');
    state.tokens.add(state.token);
    if (state.tokens.size > 10000) throw new Error('Demasiadas páginas de Resource Graph.');
    if (!state.token && String(result.resultTruncated).toLowerCase() === 'true')
      throw new Error('Resource Graph truncó el inventario sin continuación.');
  } while (state.token);
  if (Number.isFinite(state.total) && state.rows.length !== state.total)
    throw new Error('Resource Graph devolvió un inventario incompleto.');
  return state.rows;
}

async function enrich(arm, resource, signal) {
  const type = resource.type.toLowerCase();
  if (NETWORK.has(type) || DATABASE_APIS[type]) {
    const version = DATABASE_APIS[type] || '2025-09-01';
    const live = await arm.request(`${resource.id}?api-version=${version}`, { signal });
    return {
      resources: [
        {
          ...resource,
          ...live,
          subscriptionId: resource.subscriptionId,
          resourceGroup: resource.resourceGroup,
        },
      ],
    };
  }
  if (type === 'microsoft.compute/virtualmachines') {
    const view = await arm.request(`${resource.id}/instanceView?api-version=2024-03-01`, {
      signal,
    });
    return {
      resources: [{ ...resource, properties: { ...resource.properties, instanceView: view } }],
    };
  }
  if (type === 'microsoft.containerservice/managedclusters') {
    const pools = await arm.list(`${resource.id}/agentPools?api-version=2026-04-01`, signal);
    return {
      resources: [
        { ...resource, pools: pools.map((pool) => ({ name: pool.name, ...pool.properties })) },
      ],
    };
  }
  const children = [];
  if (type === 'microsoft.automation/automationaccounts') {
    children.push(...(await arm.list(`${resource.id}/runbooks?api-version=2023-11-01`, signal)));
    children.push(...(await arm.list(`${resource.id}/webhooks?api-version=2023-11-01`, signal)));
  }
  if (type === 'microsoft.containerregistry/registries') {
    children.push(...(await arm.list(`${resource.id}/webhooks?api-version=2025-11-01`, signal)));
  }
  return {
    resources: [
      resource,
      ...children.map((child) => ({
        ...child,
        subscriptionId: resource.subscriptionId,
        resourceGroup: resource.resourceGroup,
        location: child.location ?? resource.location,
      })),
    ],
  };
}

async function mapConcurrent(rows, mapper) {
  const state = { cursor: 0, results: Array(rows.length) };
  const worker = async () => {
    while (state.cursor < rows.length) {
      const index = state.cursor++;
      state.results[index] = await mapper(rows[index]);
    }
  };
  // Esperar también a los trabajadores que siguen ejecutándose si uno falla.
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(4, rows.length) }, worker),
  );
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
  return state.results;
}

export async function collectAzure(arm, config, signal) {
  const catalog = [];
  const groups = [];
  const resources = new Map();
  for (const subscriptionId of config.subscriptionIds) {
    const subscription = await arm.request(
      `/subscriptions/${subscriptionId}?api-version=2022-12-01`,
      { signal },
    );
    if (subscription.subscriptionId?.toLowerCase() !== subscriptionId)
      throw new Error('Suscripción ARM inesperada.');
    catalog.push({
      subscriptionId,
      subscriptionName: subscription.displayName || subscriptionId,
      state: subscription.state,
      tenantId: subscription.tenantId || config.tenantId,
    });
    if (subscription.state !== 'Enabled') continue;
    const graph = await graphResources(arm, subscriptionId, signal);
    const listedGroups = await arm.list(
      `/subscriptions/${subscriptionId}/resourcegroups?api-version=2021-04-01`,
      signal,
    );
    groups.push(...listedGroups.map((group) => ({ ...group, subscriptionId })));
    for (const resource of graph) {
      if (
        resource.subscriptionId?.toLowerCase() !== subscriptionId ||
        !resource.id?.toLowerCase().startsWith(`/subscriptions/${subscriptionId}/`) ||
        !resource.type
      )
        throw new Error('Recurso fuera del ámbito configurado.');
    }
    const enriched = await mapConcurrent(graph, (resource) => enrich(arm, resource, signal));
    for (const resource of enriched.flatMap((entry) => entry.resources))
      resources.set(resource.id.toLowerCase(), resource);
    if (resources.size > 100000)
      throw new Error('Inventario excesivo; reduce el ámbito de recogida.');
  }
  return { catalog, groups, resources: [...resources.values()] };
}
