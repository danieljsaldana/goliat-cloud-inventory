#Requires -Version 5.1
[CmdletBinding()]
param(
    [string] $SubscriptionId,
    [ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')][string] $Name = 'goliat-dev',
    [string] $ConfigPath,
    [string] $AzPath,
    [switch] $DatabaseFromWeb
)
. (Join-Path $PSScriptRoot 'common.ps1')
. (Join-Path $PSScriptRoot 'project-config.ps1')
. (Join-Path $PSScriptRoot 'entra.ps1')
$script:GoliatAz = Resolve-GoliatAz $AzPath
$SubscriptionId = Resolve-GoliatSubscriptionId $SubscriptionId $PSScriptRoot
Assert-GoliatSubscription $SubscriptionId
if (-not $ConfigPath) { $ConfigPath = Join-Path $PSScriptRoot ".azure/$Name.project.local.json" }
$settings = Read-GoliatProject $ConfigPath
if ($settings.authentication.mode -ne 'azure-ad' -or -not @($settings.administration.objectIds).Count) {
    throw 'Miembros requiere autenticacion tenant y al menos un administrador inicial.'
}
$outputs = Read-GoliatProjectOutputs $SubscriptionId $Name
$account = (Invoke-GoliatAz @('account', 'show', '--output', 'json')) -join "`n" | ConvertFrom-Json
if ($account.tenantId -ne $settings.authentication.tenantId) { throw 'Inicia sesion en Azure CLI con el tenant del proyecto.' }
$application = (Invoke-GoliatAz @('ad', 'sp', 'show', '--id', $settings.authentication.clientId, '--output', 'json')) -join "`n" | ConvertFrom-Json
if ($application.appRoleAssignmentRequired) {
    throw 'Esta vista utiliza acceso por tenant. La aplicacion exige asignaciones individuales; no se modifica esa politica ni se habilita Miembros.'
}
$identity = (Invoke-GoliatAz @('webapp', 'identity', 'show', '--subscription', $SubscriptionId,
    '--resource-group', $outputs.resourceGroupName, '--name', $outputs.webAppName, '--output', 'json')) -join "`n" | ConvertFrom-Json
if ($identity.tenantId -ne $settings.authentication.tenantId -or -not $identity.principalId) { throw 'La identidad web debe pertenecer al mismo tenant.' }
if ($DatabaseFromWeb) {
    # Ejecuta solo el esquema de miembros desde la red ya autorizada de la web.
    # Se autentica con Entra; no habilita autenticacion basica ni muestra tokens o credenciales.
    $authorization = (Invoke-GoliatAz @('account', 'get-access-token', '--subscription', $SubscriptionId,
        '--resource', 'https://management.azure.com/', '--query', 'accessToken', '--output', 'tsv')) -join ''
    $sqlPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'server/schema/members.sql'
    $sql = [Convert]::ToBase64String([IO.File]::ReadAllBytes($sqlPath))
    $javascript = @'
const fs=require('fs'),path=require('path'),cp=require('child_process');
const state={temporary:null};
function loadPg(){try{return require('pg');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;state.temporary=fs.mkdtempSync('/tmp/goliat-members-');cp.execFileSync('tar',['-xzf','/home/site/wwwroot/node_modules.tar.gz','-C',state.temporary]);const root=fs.existsSync(path.join(state.temporary,'node_modules','pg'))?path.join(state.temporary,'node_modules'):state.temporary;process.env.NODE_PATH=root;require('module').Module._initPaths();return require(path.join(root,'pg'));}}
const pg=loadPg();
const v=n=>process.env[n]||process.env['APPSETTING_'+n];
const p=new pg.Pool({host:v('DB_HOST'),port:Number(v('DB_PORT')||5432),database:v('DB_NAME'),user:v('DB_USER'),password:v('DB_PASSWORD'),ssl:v('DB_SSL')==='false'?undefined:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:15000});
(async()=>{try{const c=await p.connect();try{await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('goliat-members-schema'))");await c.query(Buffer.from('SQL_BASE64','base64').toString('utf8'));await c.query('COMMIT');console.log(JSON.stringify({membersReady:true}));}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}catch(e){console.error(e.code||e.name);process.exitCode=1;}finally{await p.end();if(state.temporary)fs.rmSync(state.temporary,{recursive:true,force:true});}})();
'@
    $javascript = $javascript.Replace('SQL_BASE64', $sql)
    $encodedScript = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($javascript))
    $command = "node -e `"eval(Buffer.from('$encodedScript','base64').toString('utf8'))`""
    $scmHost = ([Uri]$outputs.webUrl).Host.Replace('.azurewebsites.net', '.scm.azurewebsites.net')
    $result = Invoke-RestMethod -Method Post -Uri "https://$scmHost/api/command" -TimeoutSec 120 `
        -Headers @{ Authorization = "Bearer $authorization" } -ContentType 'application/json' `
        -Body (@{ command = $command; dir = '/home/site/wwwroot' } | ConvertTo-Json)
    if ($result.ExitCode -ne 0 -or $result.Output -notmatch '"membersReady":true') {
        throw 'No se pudieron preparar las tablas desde la web. Comprueba su despliegue y la conexion a PostgreSQL.'
    }
    Write-Host 'Tablas de Miembros preparadas desde la web, sin abrir el firewall al equipo local.'
} elseif ($settings.database.create) {
    & (Join-Path $PSScriptRoot 'initialize-project.ps1') -SubscriptionId $SubscriptionId -Name $Name -ConfigPath $ConfigPath -AzPath $script:GoliatAz
} else {
    Write-Host 'PostgreSQL externo: ejecuta npm run db:init con sus credenciales antes de usar Miembros.'
}
# Solo lectura de usuarios. Los roles de Goliat se guardan en PostgreSQL; Graph no recibe escrituras de usuarios.
$graph = (Invoke-GoliatAz @('ad', 'sp', 'show', '--id', '00000003-0000-0000-c000-000000000000', '--output', 'json')) -join "`n" | ConvertFrom-Json
$role = @($graph.appRoles | Where-Object { $_.value -eq 'User.Read.All' -and $_.isEnabled -and 'Application' -in $_.allowedMemberTypes })
if ($role.Count -ne 1) { throw 'No se ha encontrado el permiso User.Read.All de Microsoft Graph.' }
$assignments = Invoke-GoliatGraph 'GET' "https://graph.microsoft.com/v1.0/servicePrincipals/$($identity.principalId)/appRoleAssignments"
if (-not @($assignments.value | Where-Object { $_.resourceId -eq $graph.id -and $_.appRoleId -eq $role[0].id }).Count) {
    try {
        Invoke-GoliatGraph 'POST' "https://graph.microsoft.com/v1.0/servicePrincipals/$($identity.principalId)/appRoleAssignments" @{
            principalId = $identity.principalId; resourceId = $graph.id; appRoleId = $role[0].id
        } | Out-Null
    } catch {
        throw 'No se pudo consentir User.Read.All para la identidad web. Se requiere un administrador de Entra autorizado para conceder permisos de aplicacion de Microsoft Graph. Miembros no se habilita.'
    }
}
Invoke-GoliatAz @('webapp', 'config', 'appsettings', 'set', '--subscription', $SubscriptionId,
    '--resource-group', $outputs.resourceGroupName, '--name', $outputs.webAppName,
    '--settings', 'DASHBOARD_MEMBERS_ENABLED=true', '--output', 'none') | Out-Null
$settings.administration.membersEnabled = $true
Write-GoliatProject $ConfigPath $settings
Write-Host 'Miembros habilitado. La identidad web puede leer usuarios; los permisos de Goliat se gestionan en PostgreSQL.'

