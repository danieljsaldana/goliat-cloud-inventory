#Requires -Version 5.1
[CmdletBinding()]
param(
    [string] $SubscriptionId,
    [ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')]
    [string] $Name = 'goliat-dev',
    [ValidatePattern('^[a-z][a-z0-9]+$')]
    [string] $Location = 'westeurope',
    [ValidateSet('F1', 'B1')]
    [string] $WebSku = 'F1',
    [string] $ConfigPath,
    [string] $AzPath,
    [ValidateSet('demo', 'tenant')]
    [string] $AuthMode,
    [ValidatePattern('^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$')]
    [string] $TenantId,
    [switch] $RotateEntraSecret,
    [switch] $GrantReader,
    [switch] $RunAfterDeploy,
    [switch] $InfrastructureOnly,
    [switch] $Plan,
    [switch] $ValidateOnly
)
. (Join-Path $PSScriptRoot 'common.ps1')
. (Join-Path $PSScriptRoot 'project-config.ps1')
. (Join-Path $PSScriptRoot 'entra.ps1')
if ($Plan -and $ValidateOnly) { throw 'Usa Plan o ValidateOnly, no ambos.' }
$script:GoliatAz = Resolve-GoliatAz $AzPath
$template = Join-Path $PSScriptRoot 'project.bicep'
Invoke-GoliatAz @('bicep', 'build', '--file', $template, '--stdout') | Out-Null
if ($ValidateOnly) {
    if ($ConfigPath) { $null = Read-GoliatProject ([IO.Path]::GetFullPath($ConfigPath)) -AuthMode $AuthMode -TenantId $TenantId -AllowPendingEntra }
    Write-Host 'Bicep del proyecto validado sin acceder a Azure. package-web.ps1 comprueba la compilación Linux.'
    return
}

$SubscriptionId = Resolve-GoliatSubscriptionId $SubscriptionId $PSScriptRoot
Assert-GoliatSubscription $SubscriptionId
$group = Get-GoliatGroup $SubscriptionId $Name
if ($group -and $group.location -ne $Location) { throw 'Usa la región del grupo existente o un nombre nuevo.' }
if (-not $ConfigPath) {
    $ConfigPath = Join-Path $PSScriptRoot ".azure/$Name.project.local.json"
    Initialize-GoliatProject $ConfigPath
}
$ConfigPath = [IO.Path]::GetFullPath($ConfigPath)
$settings = Read-GoliatProject $ConfigPath -AuthMode $AuthMode -TenantId $TenantId -AllowPendingEntra
if ($RotateEntraSecret -and $settings.authentication.mode -ne 'azure-ad') {
    throw 'RotateEntraSecret solo se utiliza con AuthMode tenant.'
}
if ($Plan -and $settings.authentication.mode -eq 'azure-ad') {
    Write-Host 'Modo tenant: el despliegue preparará Entra y su callback. Plan no crea ni modifica aplicaciones o secretos.'
}
if (-not $Plan) {
    # Compilar antes de crear recursos; no usa registro de contenedores ni build remoto de pago.
    if (-not $InfrastructureOnly) { & (Join-Path $PSScriptRoot 'package-web.ps1') -Name $Name }
    if ($settings.authentication.mode -eq 'azure-ad') {
        Initialize-GoliatEntra -SubscriptionId $SubscriptionId -Name $Name -ConfigPath $ConfigPath -Settings $settings -RotateSecret:$RotateEntraSecret
    } else {
        Write-GoliatProject $ConfigPath $settings
        Write-Host 'Autenticación: demo, con usuario y contraseña del archivo privado.'
    }
    $settings = Read-GoliatProject $ConfigPath
    foreach ($provider in @('Microsoft.Web', 'Microsoft.Storage', 'Microsoft.ManagedIdentity', 'Microsoft.App', 'Microsoft.DBforPostgreSQL')) {
        $state = (Invoke-GoliatAz @('provider', 'show', '--subscription', $SubscriptionId, '--namespace', $provider, '--query', 'registrationState', '--output', 'tsv')) -join ''
        if ($state.Trim() -ne 'Registered') {
            Invoke-GoliatAz @('provider', 'register', '--subscription', $SubscriptionId, '--namespace', $provider, '--wait') | Out-Null
        }
    }
}

$parameterFile = [IO.Path]::GetTempFileName()
try {
    $parameters = @{
        name = @{ value = $Name }; location = @{ value = $Location }; webSku = @{ value = $WebSku }
        settings = @{ value = $settings }
    }
    [IO.File]::WriteAllText($parameterFile, ($parameters | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
    $arguments = @('deployment', 'sub', '--subscription', $SubscriptionId, '--name', "$Name-project", '--location', $Location,
        '--template-file', $template, '--parameters', "@$parameterFile")
    if ($Plan) {
        # ResourceIdOnly evita mostrar valores de app settings y contraseñas en la previsualización.
        Invoke-GoliatAz (@('deployment', 'sub', 'what-if') + $arguments[2..($arguments.Length - 1)] + @('--result-format', 'ResourceIdOnly'))
        return
    }
    $result = (Invoke-GoliatAz (@('deployment', 'sub', 'create') + $arguments[2..($arguments.Length - 1)] + @('--query', 'properties.outputs', '--output', 'json'))) -join "`n" | ConvertFrom-Json
} finally {
    Remove-Item -LiteralPath $parameterFile -Force
}

$outputs = [ordered]@{ subscriptionId = $SubscriptionId }
foreach ($property in $result.infrastructure.value.PSObject.Properties) { $outputs[$property.Name] = $property.Value }
foreach ($property in $result.PSObject.Properties | Where-Object { $_.Name -ne 'infrastructure' }) { $outputs[$property.Name] = $property.Value.value }
if ($outputs.resourceGroupName -ne "rg-$Name") { throw 'Las salidas del despliegue no corresponden al grupo solicitado.' }
$outputDirectory = Join-Path $PSScriptRoot '.azure'
$null = New-Item -ItemType Directory -Path $outputDirectory -Force
$outputs | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $outputDirectory "$Name.json") -Encoding UTF8
$outputs | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $outputDirectory "$Name.project.json") -Encoding UTF8
if ($settings.authentication.mode -eq 'azure-ad') {
    Register-GoliatEntraCallback -ClientId $settings.authentication.clientId -WebUrl $outputs.webUrl
}
& (Join-Path $PSScriptRoot 'configure-refresh.ps1') -SubscriptionId $SubscriptionId -Name $Name -ConfigPath $ConfigPath -AzPath $script:GoliatAz
& (Join-Path $PSScriptRoot 'configure-administration.ps1') -SubscriptionId $SubscriptionId -Name $Name -ConfigPath $ConfigPath -AzPath $script:GoliatAz
if ($InfrastructureOnly) {
    Write-Host "Infraestructura creada: $($outputs.resourceGroupName)."
    return
}
if ($settings.database.create) {
    & (Join-Path $PSScriptRoot 'initialize-project.ps1') -SubscriptionId $SubscriptionId -Name $Name -ConfigPath $ConfigPath -AzPath $script:GoliatAz
} else {
    Push-Location (Split-Path $PSScriptRoot -Parent)
    try {
        & node (Join-Path $PSScriptRoot 'scripts/database-command.mjs') check $ConfigPath (Join-Path $outputDirectory "$Name.project.json")
        if ($LASTEXITCODE -ne 0) { throw 'El PostgreSQL externo no está preparado para el dashboard.' }
    } finally { Pop-Location }
}

if ($settings.authentication.mode -eq 'azure-ad' -and $settings.administration.membersEnabled) {
    & (Join-Path $PSScriptRoot 'configure-members.ps1') -SubscriptionId $SubscriptionId -Name $Name -ConfigPath $ConfigPath -AzPath $script:GoliatAz
}

Invoke-GoliatAz @('webapp', 'deploy', '--subscription', $SubscriptionId, '--resource-group', $outputs.resourceGroupName,
    '--name', $outputs.webAppName, '--src-path', (Join-Path $outputDirectory "$Name.web.zip"), '--type', 'zip', '--clean', 'true', '--restart', 'true', '--timeout', '1200000') | Out-Null
$workspace = Split-Path $PSScriptRoot -Parent
& (Join-Path $workspace 'functions/deploy.ps1') -SubscriptionId $SubscriptionId -Name $Name -AzPath $script:GoliatAz -CodeOnly -GrantReader:$GrantReader -RunAfterDeploy:$RunAfterDeploy

Write-Host "Proyecto desplegado: $($outputs.webUrl)"
Write-Host "Configuración y credenciales de acceso: $ConfigPath (no versionado)."
Write-Host 'Actualizar solicita una generación a la Function, espera su publicación en Storage y la importa a PostgreSQL.'
