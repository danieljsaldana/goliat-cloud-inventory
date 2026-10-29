targetScope = 'resourceGroup'

param name string
param location string
param tags object
@allowed(['F1', 'B1'])
param webSku string
param createPostgres bool
@secure()
param settings object
param functionUrl string

var suffix = uniqueString(resourceGroup().id)
var functionAppName = 'func-${name}-${suffix}'
var postgresName = 'pg-${name}-${suffix}'
var databaseHost = createPostgres ? '${postgresName}.postgres.database.azure.com' : settings.database.host
var costSubscriptionIds = empty(settings.inventory.subscriptionIds) ? [subscription().subscriptionId] : settings.inventory.subscriptionIds

resource storage 'Microsoft.Storage/storageAccounts@2025-01-01' existing = {
  name: 'stgoliat${suffix}'
}
resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2025-01-01' existing = {
  parent: storage
  name: 'default'
}
resource inventory 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-01-01' existing = {
  parent: blobs
  name: 'cloud-inventory'
}

resource plan 'Microsoft.Web/serverfarms@2025-03-01' = {
  name: 'web-plan-${name}'
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: webSku
    tier: webSku == 'F1' ? 'Free' : 'Basic'
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

resource web 'Microsoft.Web/sites@2025-03-01' = {
  name: 'web-${name}-${suffix}'
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts'
      appCommandLine: 'node server.js'
      alwaysOn: webSku == 'B1'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
    }
  }
}

resource appSettings 'Microsoft.Web/sites/config@2025-03-01' = {
  parent: web
  name: 'appsettings'
  properties: {
    NODE_ENV: 'production'
    HOSTNAME: '0.0.0.0'
    NEXT_TELEMETRY_DISABLED: '1'
    SCM_DO_BUILD_DURING_DEPLOYMENT: 'false'
    SITE_URL: 'https://${web.properties.defaultHostName}/'
    AUTH_URL: 'https://${web.properties.defaultHostName}'
    AUTH_SECRET: settings.authentication.secret
    DASHBOARD_AUTH_ENABLED: 'true'
    DASHBOARD_AUTH_MODE: settings.authentication.mode
    DASHBOARD_ADMIN_OBJECT_IDS: join(settings.administration.objectIds, ',')
    DASHBOARD_MEMBERS_ENABLED: string(settings.authentication.mode == 'azure-ad' && contains(settings.administration, 'membersEnabled') && settings.administration.membersEnabled)
    DASHBOARD_USERNAME: settings.authentication.mode == 'demo' ? settings.authentication.username : ''
    DASHBOARD_PASSWORD: settings.authentication.mode == 'demo' ? settings.authentication.password : ''
    AUTH_MICROSOFT_ENTRA_ID_ID: settings.authentication.mode == 'azure-ad' ? settings.authentication.clientId : ''
    AUTH_MICROSOFT_ENTRA_ID_SECRET: settings.authentication.mode == 'azure-ad' ? settings.authentication.clientSecret : ''
    AUTH_MICROSOFT_ENTRA_ID_ISSUER: settings.authentication.mode == 'azure-ad'
      ? uri(environment().authentication.loginEndpoint, '${settings.authentication.tenantId}/v2.0')
      : ''
    DB_HOST: databaseHost
    DB_PORT: string(settings.database.port)
    DB_NAME: settings.database.name
    DB_USER: settings.database.username
    DB_PASSWORD: settings.database.password
    DB_SSL: 'true'
    DB_POOL_SIZE: '2'
    DB_APPLICATION_NAME: 'goliat-cloud-inventory'
    AZURE_AUTH_MODE: 'managed-identity'
    FINOPS_AUTH_MODE: 'managed-identity'
    FINOPS_SUBSCRIPTION_IDS: join(costSubscriptionIds, ',')
    AZURE_STORAGE_ACCOUNT_URL: storage.properties.primaryEndpoints.blob
    AZURE_STORAGE_CONTAINER: inventory.name
    AZURE_STORAGE_BLOB: 'azure/latest.json'
    AZURE_MAX_OBJECT_MB: '64'
    AZURE_FUNCTION_BASE_URL: functionUrl
    AZURE_FUNCTION_RESOURCE_ID: resourceId('Microsoft.Web/sites', functionAppName)
    AZURE_STORAGE_RESOURCE_ID: storage.id
    AZURE_POSTGRES_RESOURCE_ID: createPostgres ? resourceId('Microsoft.DBforPostgreSQL/flexibleServers', postgresName) : ''
    AZURE_FUNCTION_SCOPE: empty(settings.inventory.apiClientId) ? '' : 'api://${settings.inventory.apiClientId}/.default'
    INVENTORY_REFRESH_TIMEOUT_MS: '120000'
    LOG_ENABLED: 'true'
    LOG_LEVEL: 'info'
    LOG_HTTP_ENABLED: 'true'
  }
}

resource reader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(inventory.id, web.id, 'inventory-reader')
  scope: inventory
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'
    )
    principalId: web.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

module finops './finops.bicep' = [for subscriptionId in costSubscriptionIds: {
  name: '${name}-finops-${uniqueString(subscriptionId)}'
  scope: subscription(subscriptionId)
  params: {
    principalId: web.identity.principalId
  }
}]

module postgres './postgres.bicep' = if (createPostgres) {
  name: '${name}-postgres'
  params: {
    serverName: postgresName
    location: empty(settings.database.location) ? location : settings.database.location
    tags: tags
    databaseName: settings.database.name
    username: settings.database.username
    password: settings.database.password
    allowedIps: union(
      filter(split(web.properties.outboundIpAddresses, ','), ip => !empty(ip)),
      filter(split(web.properties.possibleOutboundIpAddresses, ','), ip => !empty(ip)),
      settings.database.allowedIps
    )
  }
}

module administration './administration.bicep' = if (settings.authentication.mode == 'azure-ad' && !empty(settings.administration.objectIds)) {
  name: '${name}-administration'
  params: {
    functionAppName: functionAppName
    webPrincipalId: web.identity.principalId
    storageAccountName: storage.name
    postgresServerName: createPostgres ? postgresName : ''
  }
  dependsOn: [postgres]
}

output webAppName string = web.name
output webUrl string = 'https://${web.properties.defaultHostName}'
output webIdentityPrincipalId string = web.identity.principalId
output postgresServerName string = createPostgres ? postgresName : ''
output databaseHost string = createPostgres ? postgres!.outputs.host : ''
output outboundIps array = filter(split(web.properties.outboundIpAddresses, ','), ip => !empty(ip))
