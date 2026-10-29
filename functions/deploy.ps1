#Requires -Version 5.1
[CmdletBinding()]
param(
    [string] $SubscriptionId,
    [ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')]
    [string] $Name = 'goliat-dev',
    [string] $Location = 'westeurope',
    [ValidateSet('22', '24')]
    [string] $NodeVersion = '22',
    [ValidateSet(512, 2048, 4096)]
    [int] $InstanceMemoryMB = 512,
    [string[]] $InventorySubscriptionIds = @(),
    [string[]] $InventoryTagKeys = @(),
    [string] $FunctionApiClientId = '',
    [string[]] $AllowedClientIds = @(),
    [switch] $DisableInventoryTimer,
    [switch] $GrantReader,
    [switch] $RunAfterDeploy,
    [string] $AzPath,
    [switch] $CodeOnly,
    [switch] $ValidateOnly
)

$workspace = Split-Path $PSScriptRoot -Parent
. (Join-Path $workspace 'iac/common.ps1')
$script:GoliatAz = Resolve-GoliatAz $AzPath
$deployment = Join-Path $workspace 'iac/deploy.ps1'
$parameters = @{
    SubscriptionId = $SubscriptionId; Name = $Name; Location = $Location; NodeVersion = $NodeVersion
    InstanceMemoryMB = $InstanceMemoryMB; InventorySubscriptionIds = $InventorySubscriptionIds
    InventoryTagKeys = $InventoryTagKeys; FunctionApiClientId = $FunctionApiClientId
    AllowedClientIds = $AllowedClientIds; DisableInventoryTimer = $DisableInventoryTimer
    AzPath = $script:GoliatAz
}
if (-not $ValidateOnly) {
    $SubscriptionId = Resolve-GoliatSubscriptionId $SubscriptionId (Join-Path $workspace 'iac')
    $parameters.SubscriptionId = $SubscriptionId
    Assert-GoliatSubscription $SubscriptionId
    $existingGroup = Get-GoliatGroup $SubscriptionId $Name
    if ($CodeOnly -and -not $existingGroup) { throw 'CodeOnly requiere un entorno existente creado por iac.' }
}

Push-Location $PSScriptRoot
try {
    foreach ($arguments in @(@('ci', '--no-audit', '--no-fund'), @('run', 'check'), @('test'), @('run', 'package'))) {
        & npm @arguments
        if ($LASTEXITCODE -ne 0) { throw "npm ha fallado: $($arguments -join ' ')." }
    }
} finally { Pop-Location }

if ($ValidateOnly) {
    & $deployment @parameters -ValidateOnly
    Write-Host 'Código, tests, ZIP y Bicep validados. No se ha desplegado en Azure.'
    return
}

if (-not $CodeOnly) { & $deployment @parameters }
$outputPath = Join-Path $workspace "iac/.azure/$Name.json"
$outputs = Get-Content -LiteralPath $outputPath -Raw | ConvertFrom-Json
if ($outputs.subscriptionId -ne $SubscriptionId -or $outputs.resourceGroupName -ne "rg-$Name") { throw 'Las salidas no corresponden al entorno solicitado.' }

if ($GrantReader) {
    foreach ($inventoryId in $outputs.inventorySubscriptionIds) {
        Write-Host "Concediendo Reader al productor en $inventoryId..."
        Invoke-GoliatAz @(
            'role', 'assignment', 'create', '--subscription', $inventoryId,
            '--assignee-object-id', $outputs.identityPrincipalId, '--assignee-principal-type', 'ServicePrincipal',
            '--role', 'Reader', '--scope', "/subscriptions/$inventoryId"
        ) | Out-Null
    }
}

Invoke-GoliatAz @(
    'functionapp', 'deployment', 'source', 'config-zip', '--subscription', $SubscriptionId,
    '--resource-group', $outputs.resourceGroupName, '--name', $outputs.functionAppName,
    '--src', (Join-Path $PSScriptRoot '.azure/function.zip'), '--build-remote', 'true', '--timeout', '600'
) | Out-Null
Write-Host "Function desplegada: $($outputs.functionUrl)"
Write-Host 'La generación diaria se ejecuta a las 02:00 UTC salvo que se haya desactivado.'
Write-Host 'HTTP exige configurar la API Entra, los clientes permitidos y sus roles.'
if ($RunAfterDeploy) {
    & (Join-Path $PSScriptRoot 'run.ps1') -SubscriptionId $SubscriptionId -Name $Name -AzPath $script:GoliatAz
}
