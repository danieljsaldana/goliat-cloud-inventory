Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-GoliatSubscriptionId {
    param([string] $SubscriptionId, [string] $Directory)
    if (-not [string]::IsNullOrWhiteSpace($SubscriptionId)) { return $SubscriptionId.Trim() }
    $path = Join-Path $Directory '.env'
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw 'Configura AZURE_SUBSCRIPTION_ID en iac/.env o indica -SubscriptionId.'
    }
    $entries = @(Get-Content -LiteralPath $path -Encoding UTF8 | Where-Object { $_ -match '^\s*AZURE_SUBSCRIPTION_ID\s*=' })
    if ($entries.Count -ne 1) { throw 'iac/.env debe contener un único AZURE_SUBSCRIPTION_ID.' }
    return ($entries[0] -replace '^\s*AZURE_SUBSCRIPTION_ID\s*=\s*', '').Trim().Trim('"', "'")
}

function Resolve-GoliatAz {
    param([string] $AzPath)

    if ($AzPath) {
        if (Test-Path -LiteralPath $AzPath -PathType Leaf) {
            return (Resolve-Path -LiteralPath $AzPath).Path
        }
        $command = Get-Command $AzPath -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command) { return $command.Source }
        throw "No se encuentra Azure CLI en '$AzPath'."
    }

    $command = Get-Command az -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source }

    if ($env:ProgramFiles) {
        $installed = Join-Path $env:ProgramFiles 'Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
        if (Test-Path -LiteralPath $installed -PathType Leaf) { return $installed }
    }
    throw 'Instala Azure CLI o indica su ruta con -AzPath.'
}

function Invoke-GoliatAz {
    param([Parameter(Mandatory)][string[]] $Arguments)

    $global:LASTEXITCODE = 0
    $result = & $script:GoliatAz @Arguments --only-show-errors
    if ($LASTEXITCODE -ne 0) {
        throw "Azure CLI ha fallado (código $LASTEXITCODE): $($Arguments[0..1] -join ' ')."
    }
    return $result
}

function Assert-GoliatSubscription {
    param([string] $SubscriptionId)

    if ($SubscriptionId -notmatch '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$') {
        throw 'Indica el ID de la suscripción con -SubscriptionId. Puedes verlo con az account list -o table.'
    }
    $account = (Invoke-GoliatAz @(
        'account', 'show', '--subscription', $SubscriptionId, '--output', 'json'
    )) -join "`n" | ConvertFrom-Json
    if ($account.id -ne $SubscriptionId -or $account.state -ne 'Enabled') {
        throw 'La suscripción solicitada no está disponible o no está habilitada.'
    }
    Write-Host "Suscripción: $($account.name) ($SubscriptionId)"
}

function Get-GoliatGroup {
    param([string] $SubscriptionId, [string] $Name)

    $groupName = "rg-$Name"
    $exists = (Invoke-GoliatAz @(
        'group', 'exists', '--subscription', $SubscriptionId, '--name', $groupName, '--output', 'tsv'
    )) -join ''
    if ($exists.Trim() -eq 'false') { return $null }
    if ($exists.Trim() -ne 'true') { throw 'Azure CLI no ha podido comprobar si existe el grupo.' }

    $group = (Invoke-GoliatAz @(
        'group', 'show', '--subscription', $SubscriptionId, '--name', $groupName, '--output', 'json'
    )) -join "`n" | ConvertFrom-Json
    $expectedId = "/subscriptions/$SubscriptionId/resourceGroups/$groupName"
    $tagProperties = if ($group.tags) { @($group.tags.PSObject.Properties.Name) } else { @() }
    if ($group.id -ne $expectedId -or
        'managedBy' -notin $tagProperties -or 'iacName' -notin $tagProperties -or
        'project' -notin $tagProperties -or
        $group.tags.managedBy -cne 'goliat-iac' -or $group.tags.iacName -cne $Name -or
        $group.tags.project -cne 'goliat-cloud-inventory') {
        throw "El grupo '$groupName' existe pero no pertenece a este entorno de Goliat. No se modificará."
    }
    return $group
}
