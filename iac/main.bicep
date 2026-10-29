targetScope = 'subscription'

@description('Nombre del entorno. Los scripts admiten letras minúsculas, números y guiones.')
@minLength(3)
@maxLength(20)
param name string = 'goliat-dev'

@description('Región con disponibilidad de Flex Consumption.')
param location string = 'westeurope'

@allowed([
  '22'
  '24'
])
param nodeVersion string = '22'

@allowed([
  512
  2048
  4096
])
param instanceMemoryMB int = 512

@minValue(1)
@maxValue(1000)
param maximumInstanceCount int = 1

@minLength(1)
param inventorySubscriptionIds array = [subscription().subscriptionId]
param inventoryTagKeys array = []
param functionApiClientId string = ''
param allowedClientIds array = []
param disableInventoryTimer bool = false
param inventorySchedule string = '0 0 2 * * *'

var tags = {
  project: 'goliat-cloud-inventory'
  managedBy: 'goliat-iac'
  iacName: name
}

resource group 'Microsoft.Resources/resourceGroups@2025-04-01' = {
  name: 'rg-${name}'
  location: location
  tags: tags
}

module resources './resources.bicep' = {
  name: '${name}-resources'
  scope: group
  params: {
    name: name
    location: location
    tags: tags
    nodeVersion: nodeVersion
    instanceMemoryMB: instanceMemoryMB
    maximumInstanceCount: maximumInstanceCount
    inventorySubscriptionIds: inventorySubscriptionIds
    inventoryTagKeys: inventoryTagKeys
    functionApiClientId: functionApiClientId
    allowedClientIds: allowedClientIds
    disableInventoryTimer: disableInventoryTimer
    inventorySchedule: inventorySchedule
  }
}

output resourceGroupName string = group.name
output functionAppName string = resources.outputs.functionAppName
output functionUrl string = resources.outputs.functionUrl
output storageAccountName string = resources.outputs.storageAccountName
output storageAccountUrl string = resources.outputs.storageAccountUrl
output storageAccountId string = resources.outputs.storageAccountId
output inventoryContainerName string = resources.outputs.inventoryContainerName
output inventoryContainerId string = resources.outputs.inventoryContainerId
output inventoryBlobName string = resources.outputs.inventoryBlobName
output identityClientId string = resources.outputs.identityClientId
output identityPrincipalId string = resources.outputs.identityPrincipalId
output identityResourceId string = resources.outputs.identityResourceId
output inventorySubscriptionIds array = inventorySubscriptionIds
