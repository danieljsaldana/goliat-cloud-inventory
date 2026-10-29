#Requires -Version 5.1
[CmdletBinding()]
param(
    [string] $SubscriptionId,
    [ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')]
    [string] $Name = 'goliat-dev',
    [ValidatePattern('^[a-z][a-z0-9]+$')]
    [string] $Location = 'westeurope',
    [ValidateSet('22', '24')]
    [string] $NodeVersion = '22',
    [ValidateSet(512, 2048, 4096)]
    [int] $InstanceMemoryMB = 512,
    [ValidateRange(1, 1000)]
    [int] $MaximumInstanceCount = 1,
    [string[]] $InventorySubscriptionIds = @(),
    [string[]] $InventoryTagKeys = @(),
    [string] $FunctionApiClientId = '',
    [string[]] $AllowedClientIds = @(),
    [switch] $DisableInventoryTimer,
    [string] $AzPath,
    [switch] $Plan,
    [switch] $ValidateOnly
)

. (Join-Path $PSScriptRoot 'common.ps1')
if ($Plan -and $ValidateOnly) { throw 'Usa -Plan o -ValidateOnly, no ambos a la vez.' }
$script:GoliatAz = Resolve-GoliatAz $AzPath
$template = Join-Path $PSScriptRoot 'main.bicep'

# Compilar antes de cualquier cambio en Azure. No genera JSON en el repositorio.
Invoke-GoliatAz @('bicep', 'build', '--file', $template, '--stdout') | Out-Null
if ($ValidateOnly) {
    Write-Host 'Bicep compilado correctamente. No se ha accedido a Azure.'
    return
}

$SubscriptionId = Resolve-GoliatSubscriptionId $SubscriptionId $PSScriptRoot
Assert-GoliatSubscription $SubscriptionId
$inventoryIds = if ($InventorySubscriptionIds.Count) { $InventorySubscriptionIds } else { @($SubscriptionId) }
foreach ($id in @($inventoryIds) + @($AllowedClientIds) + @($FunctionApiClientId | Where-Object { $_ })) {
    if ($id -notmatch '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$') { throw 'ID de suscripción o cliente Entra inválido.' }
}
if ($FunctionApiClientId -and -not $AllowedClientIds.Count) { throw 'Indica -AllowedClientIds para habilitar la API HTTP.' }
$group = Get-GoliatGroup $SubscriptionId $Name
if ($group -and $group.location -ne $Location) {
    throw "El grupo ya está en '$($group.location)'. Usa esa región o un -Name distinto."
}
Write-Host "Entorno: $Name | Grupo: rg-$Name | Región: $Location"

if (-not $Plan) {
    foreach ($provider in @('Microsoft.Web', 'Microsoft.Storage', 'Microsoft.ManagedIdentity', 'Microsoft.App')) {
        $state = (Invoke-GoliatAz @(
            'provider', 'show', '--namespace', $provider, '--subscription', $SubscriptionId,
            '--query', 'registrationState', '--output', 'tsv'
        )) -join ''
        if ($state.Trim() -ne 'Registered') {
            Write-Host "Registrando $provider..."
            Invoke-GoliatAz @(
                'provider', 'register', '--namespace', $provider, '--subscription', $SubscriptionId, '--wait'
            ) | Out-Null
        }
    }
}

$operation = if ($Plan) { 'what-if' } else { 'create' }
$outputDirectory = Join-Path $PSScriptRoot '.azure'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$parameters = @{
    name = @{ value = $Name }; location = @{ value = $Location }; nodeVersion = @{ value = $NodeVersion }
    instanceMemoryMB = @{ value = $InstanceMemoryMB }; maximumInstanceCount = @{ value = $MaximumInstanceCount }
    inventorySubscriptionIds = @{ value = @($inventoryIds) }; inventoryTagKeys = @{ value = @($InventoryTagKeys) }
    functionApiClientId = @{ value = $FunctionApiClientId }; allowedClientIds = @{ value = @($AllowedClientIds) }
    disableInventoryTimer = @{ value = [bool]$DisableInventoryTimer }
}
$parameterPath = Join-Path $outputDirectory "$Name.parameters.json"
[IO.File]::WriteAllText($parameterPath, ($parameters | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
$arguments = @(
    'deployment', 'sub', $operation, '--subscription', $SubscriptionId,
    '--name', "$Name-infrastructure", '--location', $Location,
    '--template-file', $template, '--parameters', "@$parameterPath"
)
if ($Plan) {
    Invoke-GoliatAz $arguments
    return
}

$result = (Invoke-GoliatAz ($arguments + @('--query', 'properties.outputs', '--output', 'json'))) -join "`n" |
    ConvertFrom-Json
$outputs = [ordered]@{ subscriptionId = $SubscriptionId }
foreach ($property in $result.PSObject.Properties) { $outputs[$property.Name] = $property.Value.value }
$outputPath = Join-Path $outputDirectory "$Name.json"
$outputs | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $outputPath -Encoding UTF8

Write-Host "Infraestructura creada. Salidas sin secretos: $outputPath"
Write-Host "Function App: $($outputs.functionAppName)"
Write-Host "Storage: $($outputs.storageAccountUrl)"
Write-Host 'Publica el productor con functions/deploy.ps1.'
