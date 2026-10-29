export const SUBSCRIPTION = '11111111-1111-4111-8111-111111111111';
export const OTHER = '22222222-2222-4222-8222-222222222222';
export const TENANT = '33333333-3333-4333-8333-333333333333';
export const AUDIENCE = '44444444-4444-4444-8444-444444444444';
export const CLIENT = '55555555-5555-4555-8555-555555555555';
export const USER = '66666666-6666-4666-8666-666666666666';

export function snapshot() {
  const resource = (name, type, extras = {}) => ({
    id: `/subscriptions/${SUBSCRIPTION}/resourceGroups/rg-demo/providers/${type}/${name}`,
    name,
    type,
    subscriptionId: SUBSCRIPTION,
    resourceGroup: 'rg-demo',
    location: 'westeurope',
    tags: { Environment: 'dev', shared: 'false' },
    properties: {},
    ...extras,
  });
  return {
    catalog: [
      {
        subscriptionId: SUBSCRIPTION,
        subscriptionName: 'Demo',
        state: 'Enabled',
        tenantId: TENANT,
      },
      { subscriptionId: OTHER, subscriptionName: 'Empty', state: 'Enabled', tenantId: TENANT },
    ],
    groups: [{ subscriptionId: SUBSCRIPTION, name: 'rg-demo', location: 'westeurope', tags: {} }],
    resources: [
      resource('vm', 'Microsoft.Compute/virtualMachines', {
        properties: {
          hardwareProfile: { vmSize: 'Standard_B1s' },
          storageProfile: { osDisk: { osType: 'Linux' } },
          instanceView: { statuses: [{ code: 'PowerState/running' }] },
        },
      }),
      resource('aks', 'Microsoft.ContainerService/managedClusters', {
        pools: [{ name: 'system', count: 0, enableAutoScaling: false }],
      }),
      resource('vnet', 'Microsoft.Network/virtualNetworks', {
        properties: { subnets: [{ name: 'app', properties: { addressPrefix: '10.0.0.0/24' } }] },
      }),
      resource('nsg', 'Microsoft.Network/networkSecurityGroups', {
        properties: {
          securityRules: [{ name: 'Custom', properties: { priority: 100, access: 'Deny' } }],
          defaultSecurityRules: [
            { name: 'Default', properties: { priority: 65000, access: 'Allow' } },
          ],
        },
      }),
      resource('private', 'Microsoft.Network/privateEndpoints', {
        properties: {
          privateLinkServiceConnections: [
            {
              properties: {
                privateLinkServiceId: '/service',
                groupIds: ['blob'],
                privateLinkServiceConnectionState: { status: 'Approved' },
              },
            },
          ],
          manualPrivateLinkServiceConnections: [
            { properties: { privateLinkServiceConnectionState: { status: 'Pending' } } },
          ],
        },
      }),
      resource('function', 'Microsoft.Web/sites', {
        kind: 'functionapp,linux',
        properties: {
          httpsOnly: false,
          functionAppConfig: { runtime: { name: 'node', version: '22' } },
          secret: 'never-publish-this',
        },
      }),
      resource('logic', 'Microsoft.Web/sites', { kind: 'functionapp,workflowapp' }),
      resource('container', 'Microsoft.App/containerApps', {
        properties: {
          template: { scale: { minReplicas: 0, maxReplicas: 3 } },
          configuration: { ingress: { external: false } },
        },
      }),
    ],
  };
}

export function memoryStore() {
  const state = { operations: new Map(), latest: null, writes: [], messages: [] };
  return {
    state,
    getCurrent: async () => state.current || null,
    putCurrent: async (id) => {
      state.current = { operationId: id };
    },
    withRequestLock: async (work, signal) => await work(signal),
    getOperation: async (id) => state.operations.get(id) || null,
    putOperation: async (id, value) => {
      state.operations.set(id, value);
    },
    latestProperties: async () => state.latest,
    enqueue: async (job) => {
      state.messages.push(job);
    },
    withLock: async (work, signal) => await work(signal),
    publish: async (bytes, expected, metadata) => {
      if (expected !== state.latest?.etag) throw new Error('ETag incorrecto.');
      state.writes.push(JSON.parse(bytes.toString('utf8')));
      state.latest = { etag: `"etag-${state.writes.length}"`, metadata };
      return state.latest;
    },
  };
}
