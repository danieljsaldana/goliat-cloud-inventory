#Requires -Version 5.1
[CmdletBinding()]
param(
    [string] $SubscriptionId,
    [ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')][string] $Name = 'goliat-dev',
    [string] $ConfigPath,
    [string] $AzPath
)
. (Join-Path $PSScriptRoot 'common.ps1')
. (Join-Path $PSScriptRoot 'project-config.ps1')
. (Join-Path $PSScriptRoot 'entra.ps1')
$script:GoliatAz = Resolve-GoliatAz $AzPath
$SubscriptionId = Resolve-GoliatSubscriptionId $SubscriptionId $PSScriptRoot
Assert-GoliatSubscription $SubscriptionId
$group = Get-GoliatGroup $SubscriptionId $Name
if (-not $group) { throw 'Despliega la infraestructura del proyecto antes de configurar Actualizar.' }
if (-not $ConfigPath) { $ConfigPath = Join-Path $PSScriptRoot ".azure/$Name.project.local.json" }
$settings = Read-GoliatProject $ConfigPath
$outputs = Read-GoliatProjectOutputs $SubscriptionId $Name
$identity = (Invoke-GoliatAz @('webapp', 'identity', 'show', '--subscription', $SubscriptionId,
    '--resource-group', $outputs.resourceGroupName, '--name', $outputs.webAppName, '--output', 'json')) -join "`n" | ConvertFrom-Json
$account = (Invoke-GoliatAz @('account', 'show', '--output', 'json')) -join "`n" | ConvertFrom-Json
if ($identity.tenantId -ne $account.tenantId -or -not $identity.principalId) {
    throw 'Selecciona en Azure CLI el tenant de la identidad administrada de la web.'
}
$displayName = "Goliat Inventory API ($Name)"
$marker = "goliat-iac:${SubscriptionId}:$Name:function-api"
$inventory = $settings.inventory
$webPrincipal = Invoke-GoliatGraph 'GET' "https://graph.microsoft.com/v1.0/servicePrincipals/$($identity.principalId)"
if ($webPrincipal.appId -notmatch '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$') { throw 'La identidad de la web no tiene un client ID válido.' }
$inventory.allowedClientIds = @(@($inventory.allowedClientIds) + @($webPrincipal.appId) | Select-Object -Unique)
if ($inventory.apiClientId) {
    $application = (Invoke-GoliatAz @('ad', 'app', 'show', '--id', $inventory.apiClientId, '--output', 'json')) -join "`n" | ConvertFrom-Json
} else {
    $applications = (Invoke-GoliatAz @('ad', 'app', 'list', '--filter', "displayName eq '$displayName'", '--output', 'json')) -join "`n" | ConvertFrom-Json
    $matches = @($applications)
    if ($matches.Count -gt 1 -or ($matches.Count -eq 1 -and $matches[0].description -ne $marker)) {
        throw 'Existe una API con ese nombre que no pertenece al entorno. Indica inventory.apiClientId o utiliza otro Name.'
    }
    if ($matches.Count -eq 1) { $application = $matches[0] }
    else {
        $application = Invoke-GoliatGraph 'POST' 'https://graph.microsoft.com/v1.0/applications' @{
            displayName = $displayName; description = $marker; signInAudience = 'AzureADMyOrg'
            api = @{ requestedAccessTokenVersion = 2 }
            optionalClaims = @{ accessToken = @(@{ name = 'idtyp'; essential = $false }); idToken = @(); saml2Token = @() }
            appRoles = @(@{
                id = [Guid]::NewGuid().ToString(); value = 'Inventory.Generate'; displayName = 'Generate inventory'
                description = 'Request inventory generation and read operation status.'
                allowedMemberTypes = @('Application'); isEnabled = $true
            })
        }
    }
    $inventory.apiClientId = $application.appId
    Write-GoliatProject $ConfigPath $settings
}
if ($application.signInAudience -ne 'AzureADMyOrg') { throw 'La API de inventario debe ser de un único tenant.' }
$roles = @($application.appRoles)
$generate = @($roles | Where-Object { $_.value -eq 'Inventory.Generate' })
if ($generate.Count -ne 1 -or -not $generate[0].isEnabled -or 'Application' -notin $generate[0].allowedMemberTypes) {
    throw 'La API requiere un rol Inventory.Generate habilitado para Application.'
}
$scope = "api://$($application.appId)"
$patch = @{}
if ($scope -notin @($application.identifierUris)) { $patch.identifierUris = @($application.identifierUris) + @($scope) }
if ($application.api.requestedAccessTokenVersion -ne 2) { $patch.api = @{ requestedAccessTokenVersion = 2 } }
$optional = $application.optionalClaims
if (-not $optional) { $optional = [pscustomobject]@{ accessToken = @(); idToken = @(); saml2Token = @() } }
if (-not @($optional.accessToken | Where-Object { $_.name -eq 'idtyp' }).Count) {
    $optional.accessToken = @($optional.accessToken) + @(@{ name = 'idtyp'; essential = $false })
    $patch.optionalClaims = $optional
}
if ($patch.Count) { Invoke-GoliatGraph 'PATCH' "https://graph.microsoft.com/v1.0/applications/$($application.id)" $patch | Out-Null }
$principals = (Invoke-GoliatAz @('ad', 'sp', 'list', '--filter', "appId eq '$($application.appId)'", '--output', 'json')) -join "`n" | ConvertFrom-Json
if (-not @($principals).Count) {
    $principal = (Invoke-GoliatAz @('ad', 'sp', 'create', '--id', $application.appId, '--output', 'json')) -join "`n" | ConvertFrom-Json
} else { $principal = @($principals)[0] }
$assignments = Invoke-GoliatGraph 'GET' "https://graph.microsoft.com/v1.0/servicePrincipals/$($identity.principalId)/appRoleAssignments"
$assigned = @($assignments.value | Where-Object { $_.resourceId -eq $principal.id -and $_.appRoleId -eq $generate[0].id }).Count
if (-not $assigned) {
    Invoke-GoliatGraph 'POST' "https://graph.microsoft.com/v1.0/servicePrincipals/$($principal.id)/appRoleAssignedTo" @{
        principalId = $identity.principalId; resourceId = $principal.id; appRoleId = $generate[0].id
    } | Out-Null
}
Write-GoliatProject $ConfigPath $settings

function Set-GoliatRefreshSettings {
    param([string] $Kind, [string] $AppName, $Values)
    $path = [IO.Path]::GetTempFileName()
    try {
        [IO.File]::WriteAllText($path, ($Values | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
        Invoke-GoliatAz @($Kind, 'config', 'appsettings', 'set', '--subscription', $SubscriptionId,
            '--resource-group', $outputs.resourceGroupName, '--name', $AppName, '--settings', "@$path", '--output', 'none') | Out-Null
    } finally { Remove-Item -LiteralPath $path -Force }
}
Set-GoliatRefreshSettings 'functionapp' $outputs.functionAppName @{
    AZURE_TENANT_ID = $identity.tenantId
    FUNCTION_API_AUDIENCE = $application.appId
    FUNCTION_ALLOWED_CLIENT_IDS = $inventory.allowedClientIds -join ','
}
Set-GoliatRefreshSettings 'webapp' $outputs.webAppName @{
    AZURE_FUNCTION_BASE_URL = $outputs.functionUrl
    AZURE_FUNCTION_SCOPE = "$scope/.default"
}
Write-Host 'Actualizar configurado: identidad administrada de la web con Inventory.Generate. No se crean secretos ni se concede Inventory.Publish.'
