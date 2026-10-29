#Requires -Version 5.1
[CmdletBinding()]
param(
    [string] $SubscriptionId,
    [ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')][string] $Name = 'goliat-dev',
    [string] $ConfigPath,
    [string[]] $ObjectIds,
    [string] $AzPath
)
. (Join-Path $PSScriptRoot 'common.ps1')
. (Join-Path $PSScriptRoot 'project-config.ps1')
$script:GoliatAz = Resolve-GoliatAz $AzPath
$SubscriptionId = Resolve-GoliatSubscriptionId $SubscriptionId $PSScriptRoot
Assert-GoliatSubscription $SubscriptionId
if (-not $ConfigPath) { $ConfigPath = Join-Path $PSScriptRoot ".azure/$Name.project.local.json" }
$settings = Read-GoliatProject $ConfigPath
if ($PSBoundParameters.ContainsKey('ObjectIds')) {
    $settings.administration.objectIds = @($ObjectIds)
    # Validate before saving or changing Azure.
    $validationFile = [IO.Path]::GetTempFileName()
    try {
        Write-GoliatProject $validationFile $settings
        $null = Read-GoliatProject $validationFile
    } finally { Remove-Item -LiteralPath $validationFile -Force }
}
$outputs = Read-GoliatProjectOutputs $SubscriptionId $Name
$group = Get-GoliatGroup $SubscriptionId $Name
if (-not $group) { throw 'Despliega primero el proyecto antes de configurar Administración.' }
if ($settings.authentication.mode -eq 'azure-ad' -and @($settings.administration.objectIds).Count) {
    $webPrincipalId = (Invoke-GoliatAz @('webapp', 'identity', 'show', '--subscription', $SubscriptionId,
        '--resource-group', $outputs.resourceGroupName, '--name', $outputs.webAppName,
        '--query', 'principalId', '--output', 'tsv')) -join ''
    if ($webPrincipalId.Trim() -notmatch '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$') {
        throw 'La web requiere una identidad administrada de sistema.'
    }
    Invoke-GoliatAz @('deployment', 'group', 'create', '--subscription', $SubscriptionId,
        '--resource-group', $outputs.resourceGroupName, '--name', "$Name-administration",
        '--template-file', (Join-Path $PSScriptRoot 'administration.bicep'), '--parameters',
        "functionAppName=$($outputs.functionAppName)", "webPrincipalId=$($webPrincipalId.Trim())",
        "storageAccountName=$($outputs.storageAccountName)", "postgresServerName=$($outputs.postgresServerName)", '--output', 'none') | Out-Null
}
$configuration = [IO.Path]::GetTempFileName()
try {
    $values = @{
        DASHBOARD_ADMIN_OBJECT_IDS = @($settings.administration.objectIds) -join ','
        AZURE_FUNCTION_RESOURCE_ID = "/subscriptions/$SubscriptionId/resourceGroups/$($outputs.resourceGroupName)/providers/Microsoft.Web/sites/$($outputs.functionAppName)"
        AZURE_STORAGE_RESOURCE_ID = "/subscriptions/$SubscriptionId/resourceGroups/$($outputs.resourceGroupName)/providers/Microsoft.Storage/storageAccounts/$($outputs.storageAccountName)"
        AZURE_POSTGRES_RESOURCE_ID = if ($outputs.postgresServerName) {
            "/subscriptions/$SubscriptionId/resourceGroups/$($outputs.resourceGroupName)/providers/Microsoft.DBforPostgreSQL/flexibleServers/$($outputs.postgresServerName)"
        } else { '' }
    }
    [IO.File]::WriteAllText($configuration, ($values | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    Invoke-GoliatAz @('webapp', 'config', 'appsettings', 'set', '--subscription', $SubscriptionId,
        '--resource-group', $outputs.resourceGroupName, '--name', $outputs.webAppName,
        '--settings', "@$configuration", '--output', 'none') | Out-Null
} finally { Remove-Item -LiteralPath $configuration -Force }
Write-GoliatProject $ConfigPath $settings
Write-Host 'Administración configurada. El acceso requiere sesión Entra del tenant y un ID de objeto autorizado.'
