targetScope = 'resourceGroup'

param functionAppName string
param webPrincipalId string
param storageAccountName string = ''
param postgresServerName string = ''

resource functionApp 'Microsoft.Web/sites@2025-03-01' existing = {
  name: functionAppName
}

// Permisos de gestión limitados a esta Function. La API web limita las escrituras al timer y las etiquetas.
resource role 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid(resourceGroup().id, functionAppName, 'goliat-function-administrator')
  properties: {
    roleName: 'Goliat Function Administrator (${resourceGroup().name})'
    description: 'Consulta de métricas y configuración del timer desde la web Goliat.'
    type: 'CustomRole'
    assignableScopes: [resourceGroup().id]
    permissions: [
      {
        actions: [
          'Microsoft.Web/sites/read'
          'Microsoft.Web/sites/config/read'
          'Microsoft.Web/sites/config/list/action'
          'Microsoft.Web/sites/config/write'
          'Microsoft.Insights/metrics/read'
        ]
        notActions: []
        dataActions: []
        notDataActions: []
      }
    ]
  }
}

resource assignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(functionApp.id, webPrincipalId, 'goliat-function-administrator')
  scope: functionApp
  properties: {
    roleDefinitionId: role.id
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Lectura exclusiva de métricas, sin configuración ni acceso a los datos de estos servicios.
resource metricsRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' = if (!empty(storageAccountName) || !empty(postgresServerName)) {
  name: guid(resourceGroup().id, 'goliat-data-metrics-reader')
  properties: {
    roleName: 'Goliat Data Metrics Reader (${resourceGroup().name})'
    description: 'Consulta de métricas de PostgreSQL y Blob Storage desde Goliat.'
    type: 'CustomRole'
    assignableScopes: [resourceGroup().id]
    permissions: [
      {
        actions: ['Microsoft.Insights/metrics/read']
        notActions: []
        dataActions: []
        notDataActions: []
      }
    ]
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = if (!empty(storageAccountName)) {
  name: storageAccountName
}
resource storageMetrics 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(storageAccountName)) {
  name: guid(storage!.id, webPrincipalId, 'goliat-data-metrics-reader')
  scope: storage
  properties: {
    roleDefinitionId: metricsRole!.id
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' existing = if (!empty(postgresServerName)) {
  name: postgresServerName
}
resource postgresMetrics 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(postgresServerName)) {
  name: guid(postgres!.id, webPrincipalId, 'goliat-data-metrics-reader')
  scope: postgres
  properties: {
    roleDefinitionId: metricsRole!.id
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
  }
}
