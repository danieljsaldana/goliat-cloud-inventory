targetScope = 'resourceGroup'

param serverName string
param location string
param tags object
param databaseName string
param username string
@secure()
param password string
param allowedIps array

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2025-08-01' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    createMode: 'Default'
    version: '17'
    administratorLogin: username
    administratorLoginPassword: password
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
    storage: {
      storageSizeGB: 32
      autoGrow: 'Disabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2025-08-01' = {
  parent: server
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Solo IPs de salida de esta web y direcciones adicionales elegidas explícitamente.
resource firewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2025-08-01' = [
  for (ip, index) in allowedIps: {
    parent: server
    name: 'goliat-${index}'
    properties: {
      startIpAddress: ip
      endIpAddress: ip
    }
  }
]

output serverName string = server.name
output host string = server.properties.fullyQualifiedDomainName
