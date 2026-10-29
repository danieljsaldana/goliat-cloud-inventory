#Requires -Version 5.1
[CmdletBinding()]
param(
    [ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')]
    [string] $Name = 'goliat-dev',
    [ValidateSet('demo', 'tenant')]
    [string] $AuthMode,
    [ValidatePattern('^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$')]
    [string] $TenantId
)
. (Join-Path $PSScriptRoot 'project-config.ps1')
$path = Join-Path $PSScriptRoot ".azure/$Name.project.local.json"
Initialize-GoliatProject $path
if ($AuthMode -or $TenantId) {
    $settings = Read-GoliatProject $path -AuthMode $AuthMode -TenantId $TenantId -AllowPendingEntra
    Write-GoliatProject $path $settings
    Write-Host "Modo de autenticación guardado: $($settings.authentication.mode). Entra se preparará al desplegar."
}
Write-Host "Configuración: $path. Se conservan las credenciales existentes."
