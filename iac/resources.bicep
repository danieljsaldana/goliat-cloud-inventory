targetScope = 'resourceGroup'

param name string
param location string
param tags object
param nodeVersion string
param instanceMemoryMB int
param maximumInstanceCount int
param inventorySubscriptionIds array
param inventoryTagKeys array
param functionApiClientId string
param allowedClientIds array
param disableInventoryTimer bool
param inventorySchedule string

// Nombres estables al repetir el despliegue y distintos en cada suscripción/grupo.
var suffix = uniqueString(resourceGroup().id)
var inventoryContainerName = 'cloud-inventory'
var inventoryBlobName = 'azure/latest.json'
var deploymentContainerName = 'function-releases'

resource storage 'Microsoft.Storage/storageAccounts@2025-01-01' = {
  name: 'stgoliat${suffix}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    publicNetworkAccess: 'Enabled'
  }
}

resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2025-01-01' = {
  parent: storage
  name: 'default'
  properties: {
    isVersioningEnabled: false
    deleteRetentionPolicy: {
      enabled: false
    }
    containerDeleteRetentionPolicy: {
      enabled: false
    }
  }
}

resource inventory 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-01-01' = {
  parent: blobs
  name: inventoryContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource releases 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-01-01' = {
  parent: blobs
  name: deploymentContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource functionState 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-01-01' = {
  parent: blobs
  name: 'function-state'
  properties: {
    publicAccess: 'None'
  }
}

resource cleanup 'Microsoft.Storage/storageAccounts/managementPolicies@2025-01-01' = {
  parent: storage
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'expire-operation-status'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              prefixMatch: ['function-state/_operations/']
            }
            actions: {
              baseBlob: {
                delete: {
                  daysAfterModificationGreaterThan: 30
                }
              }
            }
          }
        }
      ]
    }
  }
}

// Identidad sin secretos; se crea y recibe permisos antes de arrancar la Function.
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: 'id-${name}'
  location: location
  tags: tags
}

var storageRoles = [
  // Blob Data Owner: almacenamiento interno del host y publicación del inventario.
  'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
  // Queue/Table Data Contributor: triggers y coordinación, incluido Durable Storage.
  '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
  '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
]

resource storagePermissions 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for role in storageRoles: {
    name: guid(storage.id, identity.id, role)
    scope: storage
    properties: {
      roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', role)
      principalId: identity.properties.principalId
      principalType: 'ServicePrincipal'
    }
  }
]

resource plan 'Microsoft.Web/serverfarms@2025-03-01' = {
  name: 'plan-${name}'
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
    zoneRedundant: false
  }
}

resource function 'Microsoft.Web/sites@2025-03-01' = {
  name: 'func-${name}-${suffix}'
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    functionAppConfig: {
      runtime: {
        name: 'node'
        version: nodeVersion
      }
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${releases.name}'
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: identity.id
          }
        }
      }
      scaleAndConcurrency: {
        instanceMemoryMB: instanceMemoryMB
        maximumInstanceCount: maximumInstanceCount
        alwaysReady: []
        triggers: {
          http: {
            perInstanceConcurrency: 4
          }
        }
      }
    }
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      appSettings: [
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storage.name
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__clientId'
          value: identity.properties.clientId
        }
        {
          name: 'AzureWebJobsStorage__blobServiceUri'
          value: storage.properties.primaryEndpoints.blob
        }
        {
          name: 'AzureWebJobsStorage__queueServiceUri'
          value: storage.properties.primaryEndpoints.queue
        }
        {
          name: 'AzureWebJobsStorage__tableServiceUri'
          value: storage.properties.primaryEndpoints.table
        }
        {
          name: 'AZURE_AUTH_MODE'
          value: 'managed-identity'
        }
        {
          name: 'AZURE_CLIENT_ID'
          value: identity.properties.clientId
        }
        {
          name: 'AZURE_TENANT_ID'
          value: tenant().tenantId
        }
        {
          name: 'AZURE_STORAGE_ACCOUNT_URL'
          value: storage.properties.primaryEndpoints.blob
        }
        {
          name: 'AZURE_STORAGE_CONTAINER'
          value: inventoryContainerName
        }
        {
          name: 'AZURE_STORAGE_BLOB'
          value: inventoryBlobName
        }
        {
          name: 'AZURE_MAX_OBJECT_MB'
          value: '64'
        }
        {
          name: 'INVENTORY_SUBSCRIPTION_IDS'
          value: join(inventorySubscriptionIds, ',')
        }
        {
          name: 'INVENTORY_TAG_KEYS'
          value: join(inventoryTagKeys, ',')
        }
        {
          name: 'INVENTORY_SCHEDULE'
          value: inventorySchedule
        }
        {
          name: 'AzureWebJobs.inventoryTimer.Disabled'
          value: string(disableInventoryTimer)
        }
        {
          name: 'FUNCTION_API_AUDIENCE'
          value: functionApiClientId
        }
        {
          name: 'FUNCTION_ALLOWED_CLIENT_IDS'
          value: join(allowedClientIds, ',')
        }
      ]
    }
  }
  dependsOn: [
    storagePermissions
    functionState
  ]
}

output functionAppName string = function.name
output functionUrl string = 'https://${function.properties.defaultHostName}'
output storageAccountName string = storage.name
output storageAccountUrl string = storage.properties.primaryEndpoints.blob
output storageAccountId string = storage.id
output inventoryContainerName string = inventory.name
output inventoryContainerId string = inventory.id
output inventoryBlobName string = inventoryBlobName
output identityClientId string = identity.properties.clientId
output identityPrincipalId string = identity.properties.principalId
output identityResourceId string = identity.id
