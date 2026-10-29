targetScope = 'subscription'

param principalId string

resource costReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(subscription().id, principalId, 'finops-cost-reader')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '72fafb9e-0641-4937-9268-a91bfd8191a3')
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
