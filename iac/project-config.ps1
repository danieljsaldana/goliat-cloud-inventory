Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function New-GoliatSecret {
    $bytes = [byte[]]::new(32)
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    return 'Gl1!' + [Convert]::ToBase64String($bytes)
}

function Write-GoliatProject {
    param([string] $Path, $Settings)
    [IO.File]::WriteAllText($Path, ($Settings | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
}

function Initialize-GoliatProject {
    param([string] $Path)
    if (Test-Path -LiteralPath $Path) { return }
    $settings = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'project.example.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $settings.database.password = New-GoliatSecret
    $settings.authentication.password = New-GoliatSecret
    $settings.authentication.secret = New-GoliatSecret
    $directory = Split-Path $Path -Parent
    $null = New-Item -ItemType Directory -Path $directory -Force
    Write-GoliatProject $Path $settings
    Write-Host "Configuración privada creada: $Path. No se muestran contraseñas."
}

function Read-GoliatProject {
    param(
        [string] $Path,
        [ValidateSet('', 'demo', 'tenant')][string] $AuthMode = '',
        [string] $TenantId,
        [switch] $AllowPendingEntra
    )
    $settings = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $settings.PSObject.Properties['administration']) {
        $settings | Add-Member -NotePropertyName administration -NotePropertyValue ([pscustomobject]@{ objectIds = @() })
    }
    if (-not $settings.administration.PSObject.Properties['membersEnabled']) {
        $settings.administration | Add-Member -NotePropertyName membersEnabled -NotePropertyValue $false
    }
    if ($settings.administration.membersEnabled -isnot [bool]) { throw 'administration.membersEnabled debe ser true o false.' }
    if (-not $settings.inventory.PSObject.Properties['schedule']) {
        $settings.inventory | Add-Member -NotePropertyName schedule -NotePropertyValue '0 0 2 * * *'
    }
    $database = $settings.database
    $authentication = $settings.authentication
    $inventory = $settings.inventory
    if ($AuthMode) { $authentication.mode = if ($AuthMode -eq 'tenant') { 'azure-ad' } else { 'demo' } }
    if ($TenantId) {
        if ($authentication.mode -ne 'azure-ad') { throw 'TenantId solo se utiliza con AuthMode tenant.' }
        if ($authentication.clientId -and $authentication.tenantId -and $authentication.tenantId -ne $TenantId) {
            throw 'Para otro tenant utiliza un archivo de configuración con su propia aplicación Entra.'
        }
        $authentication.tenantId = $TenantId
    }
    if ($database.create -isnot [bool]) { throw 'database.create debe ser true o false.' }
    if ($database.location -and $database.location -notmatch '^[a-z][a-z0-9]+$') { throw 'Región de PostgreSQL inválida.' }
    if ($database.name -notmatch '^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$' -or
        $database.username -notmatch '^[a-zA-Z][a-zA-Z0-9_]{2,31}$' -or
        [string]::IsNullOrWhiteSpace($database.password) -or
        ($database.port -isnot [int] -and $database.port -isnot [long]) -or
        $database.port -lt 1 -or $database.port -gt 65535) {
        throw 'Configuración de PostgreSQL inválida.'
    }
    if ($database.create -and ($database.port -ne 5432 -or $database.password.Length -lt 16)) {
        throw 'El PostgreSQL creado usa puerto 5432 y requiere una contraseña de al menos 16 caracteres.'
    }
    if (-not $database.create -and ([string]::IsNullOrWhiteSpace($database.host) -or
        $database.host -match '[/\s@:]' -or $database.host -in @('localhost', '127.0.0.1'))) {
        throw 'Indica el hostname de un PostgreSQL accesible desde Azure y con TLS.'
    }
    foreach ($ip in $database.allowedIps) {
        $parsed = $null
        if (-not [Net.IPAddress]::TryParse([string]$ip, [ref]$parsed) -or
            $parsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or
            $parsed.ToString() -ne $ip -or $ip -in @('0.0.0.0', '255.255.255.255')) {
            throw 'allowedIps solo permite IPv4 concretas; no permite abrir todos los clientes de Azure.'
        }
    }
    if ($authentication.mode -notin @('demo', 'azure-ad') -or
        [Text.Encoding]::UTF8.GetByteCount([string]$authentication.secret) -lt 32) {
        throw 'Configura modo demo o azure-ad y un secreto de sesión de al menos 32 bytes.'
    }
    if ($authentication.mode -eq 'demo' -and
        ([string]::IsNullOrWhiteSpace($authentication.username) -or [string]::IsNullOrWhiteSpace($authentication.password))) {
        throw 'El modo demo requiere usuario y contraseña.'
    }
    $guidPattern = '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
    if ($settings.administration.objectIds -isnot [array] -or
        @($settings.administration.objectIds | Where-Object { $_ -isnot [string] -or $_ -notmatch $guidPattern }).Count -or
        @($settings.administration.objectIds | Sort-Object -Unique).Count -ne @($settings.administration.objectIds).Count) {
        throw 'administration.objectIds requiere una lista de IDs de objeto Entra únicos.'
    }
    if ($inventory.schedule -notmatch '^0 (\d|[1-5]\d) (\d|1\d|2[0-3]) \* \* \*$' -and
        $inventory.schedule -notmatch '^0 0 \*/(1|2|3|4|6|8|12) \* \* \*$') {
        throw 'inventory.schedule debe ser una frecuencia diaria o por horas en UTC.'
    }
    if ($authentication.mode -eq 'azure-ad' -and
        (($authentication.clientId -and $authentication.clientId -notmatch $guidPattern) -or
        ($authentication.tenantId -and $authentication.tenantId -notmatch $guidPattern))) {
        throw 'clientId y tenantId deben ser GUID válidos.'
    }
    if ($authentication.mode -eq 'azure-ad' -and -not $AllowPendingEntra -and
        ($authentication.clientId -notmatch $guidPattern -or $authentication.tenantId -notmatch $guidPattern -or
        [string]::IsNullOrWhiteSpace($authentication.clientSecret))) {
        throw 'Configura clientId, tenantId y clientSecret de la aplicación Entra del dashboard.'
    }
    foreach ($id in @($inventory.subscriptionIds) + @($inventory.allowedClientIds) + @($inventory.apiClientId | Where-Object { $_ })) {
        if ($id -notmatch $guidPattern) { throw 'ID de inventario o API Entra inválido.' }
    }
    if ($inventory.apiClientId -and -not @($inventory.allowedClientIds).Count) { throw 'La API de la Function requiere clientes permitidos.' }
    if (@($inventory.subscriptionIds | Sort-Object -Unique).Count -ne @($inventory.subscriptionIds).Count) {
        throw 'No repitas suscripciones en el ámbito.'
    }
    if ($inventory.disableTimer -isnot [bool]) { throw 'inventory.disableTimer debe ser true o false.' }
    if (@($inventory.tagKeys | ForEach-Object { $_.ToLowerInvariant() } | Sort-Object -Unique).Count -ne @($inventory.tagKeys).Count -or
        @($inventory.tagKeys | Where-Object { [string]::IsNullOrWhiteSpace($_) -or $_ -match '[\r\n,]' }).Count) {
        throw 'Configura claves de etiqueta únicas, sin comas ni saltos de línea.'
    }
    return $settings
}

function Read-GoliatProjectOutputs {
    param([string] $SubscriptionId, [string] $Name)
    $outputs = Get-Content -LiteralPath (Join-Path $PSScriptRoot ".azure/$Name.project.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($outputs.subscriptionId -ne $SubscriptionId -or $outputs.resourceGroupName -ne "rg-$Name") {
        throw 'Las salidas no corresponden al entorno solicitado.'
    }
    return $outputs
}
