const paths = {
  vmSize: [
    'properties.hardwareProfile.vmSize',
    'properties.virtualMachineProfile.hardwareProfile.vmSize',
    'sku.name',
  ],
  osType: [
    'properties.storageProfile.osDisk.osType',
    'properties.virtualMachineProfile.storageProfile.osDisk.osType',
  ],
  skuName: ['sku.name', 'properties.sku.name'],
  skuTier: ['sku.tier', 'properties.sku.tier'],
  capacity: ['sku.capacity', 'properties.sku.capacity'],
  version: ['properties.version', 'properties.redisVersion', 'properties.serverVersion'],
  state: ['properties.state', 'properties.status', 'properties.provisioningState'],
  addressPrefixes: ['properties.addressSpace.addressPrefixes'],
  dnsServers: ['properties.dhcpOptions.dnsServers'],
  privateCluster: ['properties.apiServerAccessProfile.enablePrivateCluster'],
  networkPlugin: ['properties.networkProfile.networkPlugin'],
  upgradeChannel: ['properties.autoUpgradeProfile.upgradeChannel'],
  subnetId: ['properties.subnet.id'],
  httpsOnly: ['properties.httpsOnly', 'properties.supportsHttpsTrafficOnly'],
  networkDefaultAction: [
    'properties.networkAcls.defaultAction',
    'properties.networkRuleSet.defaultAction',
  ],
  encryptionKeySource: ['properties.encryption.keySource'],
  encryptionType: ['properties.encryption.type'],
  sourceResourceId: ['properties.creationData.sourceResourceId'],
  virtualNetworkId: ['properties.virtualNetwork.id'],
  ipVersion: ['properties.publicIPAddressVersion'],
  allocationMethod: ['properties.publicIPAllocationMethod'],
  dnsName: ['properties.dnsSettings.fqdn', 'properties.dnsName'],
  publicNetworkAccess: ['properties.network.publicNetworkAccess', 'properties.publicNetworkAccess'],
  storageSizeGB: ['properties.storage.storageSizeGB'],
  storageAutoGrow: ['properties.storage.autoGrow'],
  backupRetentionDays: ['properties.backup.backupRetentionDays'],
  geoRedundantBackup: ['properties.backup.geoRedundantBackup'],
  highAvailabilityMode: ['properties.highAvailability.mode'],
  highAvailabilityState: ['properties.highAvailability.state'],
  sqlEndpoint: ['properties.connectivityEndpoints.sql'],
  developmentEndpoint: ['properties.connectivityEndpoints.dev'],
  frontendCount: ['properties.frontendIPConfigurations.length'],
  backendPoolCount: ['properties.backendAddressPools.length'],
  loadBalancingRuleCount: ['properties.loadBalancingRules.length'],
  firewallPolicyId: ['properties.firewallPolicy.id'],
  basePolicyId: ['properties.basePolicy.id'],
  virtualMachineId: ['properties.virtualMachine.id'],
  acceleratedNetworking: ['properties.enableAcceleratedNetworking'],
  ipConfigurationCount: ['properties.ipConfigurations.length'],
  workspaceResourceId: ['properties.WorkspaceResourceId', 'properties.workspaceResourceId'],
  appServicePlanId: ['properties.serverFarmId'],
  appServicePlan: ['properties.serverFarmId'],
  linuxFxVersion: ['properties.siteConfig.linuxFxVersion'],
  tenantId: ['properties.tenantId'],
  domainName: ['properties.domainName', 'properties.domain'],
  serverId: ['parentId'],
  automationAccountId: ['parentId'],
  displayName: ['properties.displayName', 'tags.hidden-title', 'name'],
  apiId: ['properties.api.id'],
  connectionState: ['properties.connectionState', 'properties.overallStatus'],
  dailyQuotaGb: ['properties.workspaceCapping.dailyQuotaGb'],
  identityType: ['identity.type'],
  environmentId: ['properties.managedEnvironmentId', 'properties.environmentId'],
  fqdn: ['properties.configuration.ingress.fqdn', 'properties.defaultDomain'],
  externalIngress: ['properties.configuration.ingress.external'],
  minReplicas: ['properties.template.scale.minReplicas'],
  maxReplicas: ['properties.template.scale.maxReplicas'],
  upgradeMode: ['properties.upgradePolicy.mode'],
  runbook: ['properties.runbook.name'],
  softDeleteState: ['properties.securitySettings.softDeleteSettings.softDeleteState'],
  immutabilityState: ['properties.securitySettings.immutabilitySettings.state'],
};

function read(source, path) {
  return path.split('.').reduce((value, key) => value?.[key], source);
}

export function resourceRow(resource, headers, names) {
  const properties = resource.properties || {};
  const parentId = resource.id.slice(0, resource.id.lastIndexOf('/')).replace(/\/[^/]+$/, '');
  const source = { ...resource, parentId };
  const row = Object.fromEntries(
    headers.map((header) => {
      const value = (paths[header] || [`properties.${header}`, header])
        .map((path) => read(source, path))
        .find((item) => item !== undefined && item !== null);
      return [header, value ?? ''];
    }),
  );
  const kind = (resource.kind || '').toLowerCase();
  const type = resource.type.toLowerCase();
  const image = properties.storageProfile?.imageReference || {};
  const appTypes = [
    [kind.includes('workflowapp'), 'Logic App Standard'],
    [kind.includes('functionapp'), 'Function App'],
    [true, 'Web App'],
  ];
  const computed = {
    ...row,
    subscriptionId: resource.subscriptionId.toLowerCase(),
    subscriptionName: names.get(resource.subscriptionId.toLowerCase()),
    resourceGroup: resource.resourceGroup,
    resourceProvider: type.split('/')[0],
    type,
    name: resource.name,
    location: resource.location ?? '',
    kind: resource.kind ?? '',
    id: resource.id,
    tags: resource.tags || {},
    sku: resource.sku || properties.sku || {},
    powerState:
      properties.instanceView?.statuses?.find((status) => status.code?.startsWith('PowerState/'))
        ?.code ??
      properties.extended?.instanceView?.powerState?.code ??
      properties.powerState?.code ??
      '',
    image:
      image.id ||
      [image.publisher, image.offer, image.sku, image.version].filter(Boolean).join('/'),
    appType: appTypes.find(([matches]) => matches)[1],
    runtime: properties.functionAppConfig?.runtime
      ? `${properties.functionAppConfig.runtime.name}|${properties.functionAppConfig.runtime.version}`
      : (properties.siteConfig?.linuxFxVersion ?? ''),
    nodePools: resource.pools?.length ?? properties.agentPoolProfiles?.length ?? 0,
    cluster: resource.name,
    pools: resource.pools || [],
    virtualNetwork: resource.name,
    subnets: properties.subnets || [],
    connections: properties.privateLinkServiceConnections || [],
    manualConnections: properties.manualPrivateLinkServiceConnections || [],
    networkSecurityGroup: resource.name,
    customRules: properties.securityRules || [],
    defaultRules: properties.defaultSecurityRules || [],
    subnetCount: properties.subnets?.length ?? 0,
    peeringCount: properties.virtualNetworkPeerings?.length ?? 0,
    customRuleCount: properties.securityRules?.length ?? 0,
    defaultRuleCount: properties.defaultSecurityRules?.length ?? 0,
    networkInterfaceCount: properties.networkInterfaces?.length ?? 0,
    networkInterfaces: (properties.networkInterfaces || []).map((entry) => entry.id),
    subnetIds: (properties.subnets || []).map((entry) => entry.id),
    lensCount: Object.keys(properties.lenses || {}).length,
  };
  return {
    ...Object.fromEntries(headers.map((header) => [header, computed[header] ?? ''])),
    tags: resource.tags || {},
    sku: resource.sku || properties.sku || {},
    ...(headers.includes('poolName') ? { pools: computed.pools } : {}),
    ...(headers.includes('virtualNetwork') ? { subnets: computed.subnets } : {}),
    ...(headers.includes('connectionStates')
      ? { connections: computed.connections, manualConnections: computed.manualConnections }
      : {}),
    ...(headers.includes('ruleType')
      ? { customRules: computed.customRules, defaultRules: computed.defaultRules }
      : {}),
  };
}
