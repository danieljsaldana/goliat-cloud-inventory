#Requires -Version 5.1
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
    [Parameter(Mandatory)]
    [string] $SubscriptionId,
    [ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')]
    [string] $Name = 'goliat-dev',
    [string] $AzPath
)

. (Join-Path $PSScriptRoot 'common.ps1')
$script:GoliatAz = Resolve-GoliatAz $AzPath
Assert-GoliatSubscription $SubscriptionId
$group = Get-GoliatGroup $SubscriptionId $Name
if (-not $group) {
    Write-Host "El grupo rg-$Name no existe. No hay nada que destruir."
    return
}

if ($PSCmdlet.ShouldProcess($group.id, 'Eliminar el grupo y todo su contenido, incluidos los blobs')) {
    Invoke-GoliatAz @(
        'group', 'delete', '--subscription', $SubscriptionId, '--name', $group.name, '--yes'
    ) | Out-Null
    Write-Host "Grupo eliminado: $($group.id)"
}
