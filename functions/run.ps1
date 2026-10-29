#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $SubscriptionId,
    [ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')]
    [string] $Name = 'goliat-dev',
    [string] $AzPath
)

$workspace = Split-Path $PSScriptRoot -Parent
. (Join-Path $workspace 'iac/common.ps1')
$script:GoliatAz = Resolve-GoliatAz $AzPath
Assert-GoliatSubscription $SubscriptionId
$group = Get-GoliatGroup $SubscriptionId $Name
if (-not $group) { throw 'Crea y despliega el entorno antes de ejecutarlo.' }
$outputs = Get-Content -LiteralPath (Join-Path $workspace "iac/.azure/$Name.json") -Raw | ConvertFrom-Json
if ($outputs.subscriptionId -ne $SubscriptionId -or $outputs.resourceGroupName -ne $group.name) { throw 'Las salidas no corresponden al grupo solicitado.' }
$app = (Invoke-GoliatAz @(
    'functionapp', 'show', '--subscription', $SubscriptionId,
    '--resource-group', $group.name, '--name', $outputs.functionAppName, '--output', 'json'
)) -join "`n" | ConvertFrom-Json
if ($app.tags.managedBy -cne 'goliat-iac' -or $app.tags.iacName -cne $Name) { throw 'La Function no pertenece a este entorno.' }
$properties = if ($app.PSObject.Properties.Name -contains 'properties') { $app.properties } else { $app }
$hostname = [string]$properties.defaultHostName
if ($hostname -notmatch '^[a-z0-9.-]+\.azurewebsites\.net$') { throw 'Azure no ha devuelto un hostname válido para la Function.' }

# La clave administrativa se obtiene con el usuario de Azure CLI, se usa en memoria
# y no se imprime ni se guarda. El host ejecuta el mismo trigger que la programación.
$key = (Invoke-GoliatAz @(
    'functionapp', 'keys', 'list', '--subscription', $SubscriptionId,
    '--resource-group', $group.name, '--name', $app.name,
    '--query', 'masterKey', '--output', 'tsv'
)) -join ''
if (-not $key.Trim()) { throw 'No se pudo obtener autorización administrativa para ejecutar la Function.' }
try {
    Invoke-RestMethod -Method Post -Uri "https://$hostname/admin/functions/inventoryTimer" `
        -Headers @{ 'x-functions-key' = $key.Trim() } -ContentType 'application/json' `
        -Body '{"input":""}' -TimeoutSec 60 | Out-Null
} finally { $key = $null }
Write-Host 'Solicitud de generación enviada. El worker publicará azure/latest.json al terminar.'
