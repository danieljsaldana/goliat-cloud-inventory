targetScope = 'subscription'

@minLength(3)
@maxLength(20)
param name string = 'goliat-dev'
param location string = 'westeurope'
@allowed(['F1', 'B1'])
param webSku string = 'F1'
@secure()
param settings object

module base './main.bicep' = {
  name: '${name}-base'
  params: {
    name: name
    location: location
    inventorySubscriptionIds: empty(settings.inventory.subscriptionIds)
      ? [subscription().subscriptionId]
      : settings.inventory.subscriptionIds
    inventoryTagKeys: settings.inventory.tagKeys
    functionApiClientId: settings.inventory.apiClientId
    allowedClientIds: settings.inventory.allowedClientIds
    disableInventoryTimer: settings.inventory.disableTimer
    inventorySchedule: settings.inventory.schedule
  }
}

module web './web.bicep' = {
  name: '${name}-web'
  scope: resourceGroup('rg-${name}')
  params: {
    name: name
    location: location
    webSku: webSku
    createPostgres: settings.database.create
    settings: settings
    functionUrl: base.outputs.functionUrl
    tags: {
      project: 'goliat-cloud-inventory'
      managedBy: 'goliat-iac'
      iacName: name
    }
  }
  dependsOn: [base]
}

// Únicamente IDs y endpoints. Los secretos no forman parte de las salidas.
output infrastructure object = {
  resourceGroupName: base.outputs.resourceGroupName
  functionAppName: base.outputs.functionAppName
  functionUrl: base.outputs.functionUrl
  storageAccountName: base.outputs.storageAccountName
  storageAccountUrl: base.outputs.storageAccountUrl
  storageAccountId: base.outputs.storageAccountId
  inventoryContainerName: base.outputs.inventoryContainerName
  inventoryContainerId: base.outputs.inventoryContainerId
  inventoryBlobName: base.outputs.inventoryBlobName
  identityClientId: base.outputs.identityClientId
  identityPrincipalId: base.outputs.identityPrincipalId
  identityResourceId: base.outputs.identityResourceId
  inventorySubscriptionIds: base.outputs.inventorySubscriptionIds
}
output webAppName string = web.outputs.webAppName
output webUrl string = web.outputs.webUrl
output webIdentityPrincipalId string = web.outputs.webIdentityPrincipalId
output postgresServerName string = web.outputs.postgresServerName
output databaseHost string = web.outputs.databaseHost
output outboundIps array = web.outputs.outboundIps
