Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-GoliatGraph {
    param([string] $Method, [string] $Url, $Body)
    $bodyFile = [IO.Path]::GetTempFileName()
    try {
        $arguments = @('rest', '--method', $Method, '--url', $Url, '--output', 'json')
        if ($PSBoundParameters.ContainsKey('Body')) {
            [IO.File]::WriteAllText($bodyFile, ($Body | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
            $arguments += @('--headers', 'Content-Type=application/json', '--body', "@$bodyFile")
        }
        return (Invoke-GoliatAz $arguments) -join "`n" | ConvertFrom-Json
    } finally { Remove-Item -LiteralPath $bodyFile -Force }
}

function Initialize-GoliatEntra {
    param([string] $SubscriptionId, [string] $Name, [string] $ConfigPath, $Settings, [switch] $RotateSecret)
    $authentication = $Settings.authentication
    # Los comandos az ad usan el tenant de la cuenta seleccionada, no un parámetro ARM --subscription.
    $subscriptionAccount = (Invoke-GoliatAz @('account', 'show', '--subscription', $SubscriptionId, '--output', 'json')) -join "`n" | ConvertFrom-Json
    $currentAccount = (Invoke-GoliatAz @('account', 'show', '--output', 'json')) -join "`n" | ConvertFrom-Json
    $tenantId = if ($authentication.tenantId) { $authentication.tenantId } else { $subscriptionAccount.tenantId }
    if ($tenantId -notmatch '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$') {
        throw 'Azure CLI no ha devuelto un tenant válido.'
    }
    if ($currentAccount.tenantId -ne $tenantId) {
        throw "La cuenta seleccionada en Azure CLI pertenece a otro tenant. Usa az login --tenant $tenantId y selecciona una suscripción de ese directorio."
    }
    $authentication.tenantId = $tenantId
    $displayName = "Goliat - Cloud Inventory ($Name)"
    $marker = "goliat-iac:${SubscriptionId}:$Name"
    try {
        if ($authentication.clientId) {
            $application = (Invoke-GoliatAz @('ad', 'app', 'show', '--id', $authentication.clientId, '--output', 'json')) -join "`n" | ConvertFrom-Json
        } else {
            $applications = (Invoke-GoliatAz @('ad', 'app', 'list', '--filter', "displayName eq '$displayName'", '--output', 'json')) -join "`n" | ConvertFrom-Json
            $matches = @($applications)
            if ($matches.Count -gt 1 -or ($matches.Count -eq 1 -and $matches[0].description -ne $marker)) {
                throw 'Ya existe una aplicación con ese nombre que no se puede identificar como propia. Indica su clientId explícitamente o utiliza otro Name.'
            }
            if ($matches.Count -eq 1) { $application = $matches[0] }
            else {
                $application = Invoke-GoliatGraph 'POST' 'https://graph.microsoft.com/v1.0/applications' @{
                    displayName = $displayName
                    description = $marker
                    signInAudience = 'AzureADMyOrg'
                    requiredResourceAccess = @(@{
                        resourceAppId = '00000003-0000-0000-c000-000000000000'
                        resourceAccess = @(@{ id = 'e1fe6dd8-ba31-4d61-89e7-88639da4683d'; type = 'Scope' })
                    })
                }
                Write-Host "Aplicación Entra creada: $displayName."
            }
            $authentication.clientId = $application.appId
            # Guardar el ID permite continuar si un paso posterior falla sin crear otra aplicación.
            $authentication.clientSecret = ''
            Write-GoliatProject $ConfigPath $Settings
        }
        if ($application.signInAudience -ne 'AzureADMyOrg') {
            throw 'La aplicación Entra debe admitir únicamente cuentas de su propio directorio (AzureADMyOrg).'
        }
        $permissions = @($application.requiredResourceAccess)
        $graphAccess = @($permissions | Where-Object { $_.resourceAppId -eq '00000003-0000-0000-c000-000000000000' })
        $hasUserRead = $graphAccess.Count -and @($graphAccess[0].resourceAccess | Where-Object {
            $_.id -eq 'e1fe6dd8-ba31-4d61-89e7-88639da4683d' -and $_.type -eq 'Scope'
        }).Count
        if (-not $hasUserRead) {
            $userRead = @{ id = 'e1fe6dd8-ba31-4d61-89e7-88639da4683d'; type = 'Scope' }
            if ($graphAccess.Count) { $graphAccess[0].resourceAccess = @($graphAccess[0].resourceAccess) + @($userRead) }
            else { $permissions += @{ resourceAppId = '00000003-0000-0000-c000-000000000000'; resourceAccess = @($userRead) } }
            Invoke-GoliatGraph 'PATCH' "https://graph.microsoft.com/v1.0/applications/$($application.id)" @{
                requiredResourceAccess = $permissions
            } | Out-Null
        }
        $principals = (Invoke-GoliatAz @('ad', 'sp', 'list', '--filter', "appId eq '$($authentication.clientId)'", '--output', 'json')) -join "`n" | ConvertFrom-Json
        if (-not @($principals).Count) {
            Invoke-GoliatAz @('ad', 'sp', 'create', '--id', $authentication.clientId, '--output', 'none') | Out-Null
        }
        $expired = $false
        if ('clientSecretExpiresAt' -in $authentication.PSObject.Properties.Name -and $authentication.clientSecretExpiresAt) {
            $expiry = [DateTimeOffset]::Parse($authentication.clientSecretExpiresAt)
            $expired = $expiry -le [DateTimeOffset]::UtcNow.AddDays(7)
        }
        if ([string]::IsNullOrWhiteSpace($authentication.clientSecret) -or $RotateSecret -or $expired) {
            $endDate = [DateTimeOffset]::UtcNow.AddYears(1).ToString('yyyy-MM-ddTHH:mm:ssZ')
            # --append conserva los demás secretos de la aplicación; nunca se muestran los valores.
            $credential = (Invoke-GoliatAz @('ad', 'app', 'credential', 'reset', '--id', $authentication.clientId,
                '--append', '--display-name', "goliat-$Name-login", '--end-date', $endDate, '--output', 'json')) -join "`n" | ConvertFrom-Json
            if ([string]::IsNullOrWhiteSpace($credential.password)) { throw 'Entra no ha devuelto el secreto de cliente.' }
            $authentication.clientSecret = $credential.password
            $authentication | Add-Member -MemberType NoteProperty -Name clientSecretExpiresAt -Value $endDate -Force
        }
        Write-GoliatProject $ConfigPath $Settings
        Write-Host "Autenticación: Microsoft Entra ID, tenant $tenantId. Credenciales guardadas en el archivo privado."
    } catch {
        throw "No se ha podido preparar Entra ID. Necesitas permisos de registro o administración sobre la aplicación en ese directorio; ser Owner de la suscripción no los concede. No se cambia a demo automáticamente. Detalle: $($_.Exception.Message)"
    }
}

function Register-GoliatEntraCallback {
    param([string] $ClientId, [string] $WebUrl)
    $origin = [Uri]$WebUrl
    if ($origin.Scheme -ne 'https' -or -not $origin.IsDefaultPort -or $origin.Host -notmatch '^[a-z0-9.-]+\.azurewebsites\.net$' -or
        $origin.UserInfo -or $origin.Query -or $origin.Fragment -or $origin.AbsolutePath -ne '/') {
        throw 'El despliegue no ha devuelto un origen web Azure válido para Entra.'
    }
    $callback = $origin.GetLeftPart([UriPartial]::Authority) + '/api/auth/callback/microsoft-entra-id'
    $application = (Invoke-GoliatAz @('ad', 'app', 'show', '--id', $ClientId, '--output', 'json')) -join "`n" | ConvertFrom-Json
    $redirects = @($application.web.redirectUris)
    if ($callback -notin $redirects) {
        # Incluir los callbacks existentes evita eliminar desarrollo local u otras URLs autorizadas.
        Invoke-GoliatAz (@('ad', 'app', 'update', '--id', $ClientId, '--web-redirect-uris') +
            @($redirects | Where-Object { $_ }) + @($callback, '--output', 'none')) | Out-Null
    }
    Write-Host "Retorno Entra registrado: $callback"
}
