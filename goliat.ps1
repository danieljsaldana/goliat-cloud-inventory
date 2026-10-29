#Requires -Version 5.1
<#
.SYNOPSIS
Comandos del proyecto Goliat: .\goliat.ps1 help
.DESCRIPTION
Reutiliza los scripts de iac/ y lee la suscripcion de iac/.env.
Consulta iac/COMMANDS.md para requisitos, opciones y alcance del borrado.
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
    [Parameter(Position = 0)]
    [ValidateSet('help', 'init', 'validate', 'build', 'plan', 'deploy', 'members', 'start', 'stop', 'destroy-plan', 'destroy')]
    [string] $Command = 'help',
    [ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')]
    [string] $Name = 'goliat-dev',
    [string] $SubscriptionId,
    [string] $AzPath,
    [ValidateSet('demo', 'tenant')]
    [string] $AuthMode,
    [ValidatePattern('^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$')]
    [string] $TenantId,
    [ValidatePattern('^[a-z][a-z0-9]+$')]
    [string] $Location = 'westeurope',
    [ValidateSet('F1', 'B1')]
    [string] $WebSku = 'F1',
    [string] $ConfigPath,
    [switch] $RotateEntraSecret,
    [switch] $GrantReader,
    [switch] $RunAfterDeploy,
    [switch] $InfrastructureOnly,
    [switch] $DatabaseFromWeb
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Command = $Command.ToLowerInvariant()
$cloudOptions = @('Name', 'SubscriptionId', 'AzPath')
$deploymentOptions = $cloudOptions + @('AuthMode', 'TenantId', 'Location', 'WebSku', 'ConfigPath')
$allowedOptions = @{
    help = @()
    init = @('Name', 'AuthMode', 'TenantId')
    validate = @('Name', 'AzPath', 'ConfigPath', 'AuthMode', 'TenantId')
    build = @('Name')
    plan = $deploymentOptions
    deploy = $deploymentOptions + @('RotateEntraSecret', 'GrantReader', 'RunAfterDeploy', 'InfrastructureOnly')
    members = $cloudOptions + @('ConfigPath', 'DatabaseFromWeb')
    start = $cloudOptions
    stop = $cloudOptions
    'destroy-plan' = $cloudOptions
    destroy = $cloudOptions
}
$commonOptions = @(
    'Command', 'WhatIf', 'Confirm', 'Verbose', 'Debug', 'ErrorAction', 'WarningAction', 'InformationAction',
    'ErrorVariable', 'WarningVariable', 'InformationVariable', 'OutVariable', 'OutBuffer', 'PipelineVariable', 'ProgressAction'
)
foreach ($option in $PSBoundParameters.Keys) {
    if ($option -notin $allowedOptions[$Command] -and $option -notin $commonOptions) {
        throw "La opcion -$option no se utiliza con '$Command'. Consulta .\goliat.ps1 help."
    }
}

if ($Command -eq 'help') {
    Write-Host @'
Goliat - Cloud Inventory
Uso: .\goliat.ps1 <comando> [opciones]

  help          Muestra esta ayuda (tambien es el comando predeterminado).
  init          Prepara la configuracion privada local; conserva la existente.
  validate      Compila Bicep localmente, sin acceder a la suscripcion.
  build         Compila la web en Docker Linux y crea el ZIP local.
  plan          Consulta los cambios del despliegue, sin aplicarlos en Azure.
  deploy        Despliega infraestructura, PostgreSQL, web y Function.
  members       Habilita Miembros: prepara tablas y concede lectura de usuarios.
  start         Inicia PostgreSQL, Function y web.
  stop          Detiene web, Function y PostgreSQL; sigue habiendo costes.
  destroy-plan  Comprueba el grupo y muestra el borrado, sin ejecutarlo.
  destroy       ELIMINA el grupo completo y sus datos.

Suscripcion: AZURE_SUBSCRIPTION_ID de iac/.env, o -SubscriptionId <ID>.
Entorno: goliat-dev por defecto, o -Name <nombre>.
Login: deploy -AuthMode demo | deploy -AuthMode tenant [-TenantId <ID>].
Omitir AuthMode conserva la autenticacion configurada.
CLI: -AzPath <ruta> si az no esta disponible en PATH.
Primera generacion: deploy -GrantReader -RunAfterDeploy.
Previsualizar borrado: destroy-plan o destroy -WhatIf.

Guia y opciones por comando: iac/COMMANDS.md
'@
    return
}

$iacDirectory = Join-Path $PSScriptRoot 'iac'
. (Join-Path $iacDirectory 'common.ps1')
$arguments = @{ Name = $Name }
foreach ($option in $allowedOptions[$Command]) {
    if ($PSBoundParameters.ContainsKey($option)) { $arguments[$option] = $PSBoundParameters[$option] }
}
# Resuelve las rutas desde el directorio del llamante antes de cambiar a la raiz.
if ($ConfigPath) { $arguments.ConfigPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ConfigPath) }
if ($AzPath -and (Test-Path -LiteralPath $AzPath -PathType Leaf)) {
    $arguments.AzPath = (Resolve-Path -LiteralPath $AzPath).Path
}

$target = $iacDirectory
if ($Command -in @('plan', 'deploy', 'members', 'start', 'stop', 'destroy-plan', 'destroy')) {
    $arguments.SubscriptionId = Resolve-GoliatSubscriptionId $SubscriptionId $iacDirectory
    if ($arguments.SubscriptionId -notmatch '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$') {
        throw 'AZURE_SUBSCRIPTION_ID o -SubscriptionId debe ser el ID de una suscripcion de Azure.'
    }
    $target = "/subscriptions/$($arguments.SubscriptionId)/resourceGroups/rg-$Name"
}

switch ($Command) {
    'init' { $scriptFile = 'init-project.ps1'; $operation = 'Preparar la configuracion privada local' }
    'validate' { $scriptFile = 'deploy-project.ps1'; $arguments.ValidateOnly = $true; $operation = 'Validar Bicep localmente' }
    'build' { $scriptFile = 'package-web.ps1'; $operation = 'Compilar y empaquetar la web localmente' }
    'plan' { $scriptFile = 'deploy-project.ps1'; $arguments.Plan = $true; $operation = 'Consultar el plan de despliegue' }
    'deploy' { $scriptFile = 'deploy-project.ps1'; $operation = 'Desplegar el proyecto completo' }
    'members' { $scriptFile = 'configure-members.ps1'; $operation = 'Preparar Miembros y conceder lectura de usuarios a la identidad web' }
    'start' { $scriptFile = 'power-project.ps1'; $arguments.Action = 'Start'; $operation = 'Iniciar el entorno' }
    'stop' { $scriptFile = 'power-project.ps1'; $arguments.Action = 'Stop'; $operation = 'Detener el entorno' }
    default {
        $scriptFile = 'destroy.ps1'
        # El script de borrado comprueba la propiedad del grupo antes de ShouldProcess.
        # Conserva tambien el WhatIf heredado de una sesion o script superior.
        if ($Command -eq 'destroy-plan' -or $WhatIfPreference) { $arguments.WhatIf = $true }
        if ($PSBoundParameters.ContainsKey('Confirm')) { $arguments.Confirm = $PSBoundParameters['Confirm'] }
    }
}

if ($Command -notin @('destroy', 'destroy-plan') -and -not $PSCmdlet.ShouldProcess($target, $operation)) { return }
Push-Location -LiteralPath $PSScriptRoot
try {
    & (Join-Path $iacDirectory $scriptFile) @arguments
} finally {
    Pop-Location
}
