#Requires -Version 5.1
[CmdletBinding()]
param(
    [string] $SubscriptionId,
    [ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')]
    [string] $Name = 'goliat-dev',
    [string] $ConfigPath,
    [string] $AzPath
)
. (Join-Path $PSScriptRoot 'common.ps1')
. (Join-Path $PSScriptRoot 'project-config.ps1')
$script:GoliatAz = Resolve-GoliatAz $AzPath
$SubscriptionId = Resolve-GoliatSubscriptionId $SubscriptionId $PSScriptRoot
Assert-GoliatSubscription $SubscriptionId
$group = Get-GoliatGroup $SubscriptionId $Name
if (-not $group) { throw 'El entorno no existe.' }
$outputs = Read-GoliatProjectOutputs $SubscriptionId $Name
if ($outputs.postgresServerName -notmatch "^pg-$Name-[a-z0-9]{13}$") { throw 'Este comando requiere PostgreSQL creado por iac.' }
if (-not $ConfigPath) { $ConfigPath = Join-Path $PSScriptRoot ".azure/$Name.project.local.json" }
$ConfigPath = [IO.Path]::GetFullPath($ConfigPath)
$settings = Read-GoliatProject $ConfigPath
if (-not $settings.database.create) { throw 'Inicializa el PostgreSQL externo con db:init y su conexión autorizada.' }
$ip = [string](Invoke-RestMethod -Uri 'https://api.ipify.org?format=json' -TimeoutSec 20).ip
$parsed = $null
if (-not [Net.IPAddress]::TryParse($ip, [ref]$parsed) -or $parsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or $ip -eq '0.0.0.0') { throw 'No se pudo obtener la IPv4 pública de este equipo.' }
$target = @('--subscription', $SubscriptionId, '--resource-group', $group.name, '--server-name', $outputs.postgresServerName)
$rule = 'goliat-init-' + [guid]::NewGuid().ToString('N')
Invoke-GoliatAz (@('postgres', 'flexible-server', 'firewall-rule', 'create') + $target + @('--name', $rule, '--start-ip-address', $ip, '--end-ip-address', $ip)) | Out-Null
try {
    Push-Location (Split-Path $PSScriptRoot -Parent)
    try {
        & node (Join-Path $PSScriptRoot 'scripts/database-command.mjs') init $ConfigPath (Join-Path $PSScriptRoot ".azure/$Name.project.json")
        if ($LASTEXITCODE -ne 0) { throw 'Falló la inicialización; la base no se ha anunciado como preparada.' }
    } finally { Pop-Location }
} finally {
    Invoke-GoliatAz (@('postgres', 'flexible-server', 'firewall-rule', 'delete') + $target + @('--name', $rule, '--yes')) | Out-Null
}
Write-Host 'Base inicializada desde cero. Se ha retirado el acceso temporal de este equipo.'
