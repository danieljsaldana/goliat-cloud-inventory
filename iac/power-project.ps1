#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $SubscriptionId,
    [ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')]
    [string] $Name = 'goliat-dev',
    [ValidateSet('Stop', 'Start')]
    [string] $Action = 'Stop',
    [string] $AzPath
)
. (Join-Path $PSScriptRoot 'common.ps1')
. (Join-Path $PSScriptRoot 'project-config.ps1')
$script:GoliatAz = Resolve-GoliatAz $AzPath
Assert-GoliatSubscription $SubscriptionId
$group = Get-GoliatGroup $SubscriptionId $Name
if (-not $group) { throw 'El grupo del proyecto no existe.' }
$outputs = Read-GoliatProjectOutputs $SubscriptionId $Name
if ($outputs.webAppName -notmatch "^web-$Name-[a-z0-9]{13}$" -or
    $outputs.functionAppName -notmatch "^func-$Name-[a-z0-9]{13}$" -or
    ($outputs.postgresServerName -and $outputs.postgresServerName -notmatch "^pg-$Name-[a-z0-9]{13}$")) {
    throw 'Los nombres de los recursos no corresponden a este proyecto.'
}
$target = @('--subscription', $SubscriptionId, '--resource-group', $group.name)
if ($outputs.postgresServerName) {
    $databaseState = (Invoke-GoliatAz (@('postgres', 'flexible-server', 'show') + $target + @('--name', $outputs.postgresServerName, '--query', 'state', '--output', 'tsv'))) -join ''
    if ($databaseState.Trim() -notin @('Ready', 'Stopped')) { throw "PostgreSQL está en estado $databaseState. Espera a que termine esa operación." }
}

if ($Action -eq 'Start') {
    if ($outputs.postgresServerName -and $databaseState.Trim() -eq 'Stopped') {
        Invoke-GoliatAz (@('postgres', 'flexible-server', 'start') + $target + @('--name', $outputs.postgresServerName)) | Out-Null
    }
    Invoke-GoliatAz (@('functionapp', 'start') + $target + @('--name', $outputs.functionAppName)) | Out-Null
    Invoke-GoliatAz (@('webapp', 'start') + $target + @('--name', $outputs.webAppName)) | Out-Null
    Write-Host "Entorno iniciado: $($outputs.webUrl)"
} else {
    Invoke-GoliatAz (@('webapp', 'stop') + $target + @('--name', $outputs.webAppName)) | Out-Null
    Invoke-GoliatAz (@('functionapp', 'stop') + $target + @('--name', $outputs.functionAppName)) | Out-Null
    if ($outputs.postgresServerName -and $databaseState.Trim() -eq 'Ready') {
        Invoke-GoliatAz (@('postgres', 'flexible-server', 'stop') + $target + @('--name', $outputs.postgresServerName)) | Out-Null
    }
    Write-Host 'Entorno detenido. PostgreSQL sigue cobrando almacenamiento y se reinicia automáticamente tras siete días.'
    Write-Host 'Un plan web B1 sigue teniendo coste aunque detengas la web. Para eliminar los recursos utiliza destroy.ps1.'
}
