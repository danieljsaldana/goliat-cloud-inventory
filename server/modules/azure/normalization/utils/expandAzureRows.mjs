import { unique } from './unique.mjs';
import { arrayField } from './arrayField.mjs';

export function expandAzureRows(id, rows) {
  if (id === 'aks-node-pools')
    return rows.flatMap((cluster) =>
      (cluster.pools || []).map((pool) => ({
        ...cluster,
        poolName: pool.name,
        mode: pool.mode,
        osType: pool.osType,
        vmSize: pool.vmSize,
        nodeCount: pool.count,
        orchestratorVersion: pool.orchestratorVersion,
        currentOrchestratorVersion: pool.currentOrchestratorVersion,
        autoscaling: pool.enableAutoScaling,
        minCount: pool.minCount,
        maxCount: pool.maxCount,
      })),
    );
  if (id === 'subnets')
    return rows.flatMap((network) =>
      (network.subnets || []).map((subnet) => {
        const properties = subnet.properties || {};
        return {
          ...network,
          virtualNetwork: network.virtualNetwork,
          name: subnet.name,
          addressPrefixes: arrayField(properties, 'addressPrefix', 'addressPrefixes'),
          networkSecurityGroupId: properties.networkSecurityGroup?.id,
          routeTableId: properties.routeTable?.id,
          natGatewayId: properties.natGateway?.id,
          privateEndpointNetworkPolicies: properties.privateEndpointNetworkPolicies,
          serviceEndpoints: JSON.stringify(
            (properties.serviceEndpoints || []).map((entry) => entry.service),
          ),
          delegations: JSON.stringify(
            (properties.delegations || []).map((entry) => entry.properties?.serviceName),
          ),
          id: subnet.id || `${network.id}/subnets/${subnet.name}`,
        };
      }),
    );
  if (id === 'private-endpoints')
    return rows.map((row) => {
      const connections = [...(row.connections || []), ...(row.manualConnections || [])];
      return {
        ...row,
        connectionStates: unique(
          connections.map((entry) => entry.properties?.privateLinkServiceConnectionState?.status),
        ).join('; '),
        privateLinkServiceIds: JSON.stringify(
          unique(connections.map((entry) => entry.properties?.privateLinkServiceId)),
        ),
        groupIds: JSON.stringify(
          unique(connections.flatMap((entry) => entry.properties?.groupIds || [])),
        ),
      };
    });
  if (id === 'network-security-rules')
    return rows.flatMap((group) =>
      [
        ['Custom', group.customRules || []],
        ['Default', group.defaultRules || []],
      ].flatMap(([ruleType, rules]) =>
        rules.map((rule) => {
          const properties = rule.properties || {};
          return {
            ...group,
            name: rule.name,
            ruleType,
            priority: properties.priority,
            direction: properties.direction,
            access: properties.access,
            protocol: properties.protocol,
            sourceAddressPrefixes: arrayField(
              properties,
              'sourceAddressPrefix',
              'sourceAddressPrefixes',
            ),
            sourcePortRanges: arrayField(properties, 'sourcePortRange', 'sourcePortRanges'),
            destinationAddressPrefixes: arrayField(
              properties,
              'destinationAddressPrefix',
              'destinationAddressPrefixes',
            ),
            destinationPortRanges: arrayField(
              properties,
              'destinationPortRange',
              'destinationPortRanges',
            ),
            description: properties.description,
            id:
              rule.id ||
              `${group.id}/${ruleType === 'Default' ? 'defaultSecurityRules' : 'securityRules'}/${rule.name}`,
          };
        }),
      ),
    );
  return rows;
}
