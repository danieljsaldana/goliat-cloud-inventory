# CLI simulada: solo se utiliza en las pruebas y nunca llama a Azure.
$arguments = @($args)
# El registro temporal debe incluir tambien las llamadas de lectura en modo WhatIf.
$arguments | ConvertTo-Json -Compress | Add-Content -LiteralPath $env:GOLIAT_IAC_TEST_LOG -WhatIf:$false
$global:LASTEXITCODE = 0
$subscriptionId = '11111111-1111-4111-8111-111111111111'

if ($arguments[0] -eq 'bicep') { Write-Output '{}'; return }
if ($arguments[0] -eq 'account') {
    $tenantId = '33333333-3333-4333-8333-333333333333'
    if ($env:GOLIAT_IAC_TEST_MODE -eq 'entra-wrong-tenant' -and '--subscription' -notin $arguments) {
        $tenantId = '44444444-4444-4444-8444-444444444444'
    }
    @{ id = $subscriptionId; name = 'Test subscription'; state = 'Enabled'; tenantId = $tenantId } | ConvertTo-Json
    return
}
if ($arguments[0] -eq 'provider') { Write-Output 'Registered'; return }
if ($arguments[0] -eq 'group') {
    if ($arguments[1] -eq 'exists') {
        if ($env:GOLIAT_IAC_TEST_MODE -eq 'missing') { Write-Output 'false' }
        else { Write-Output 'true' }
        return
    }
    if ($arguments[1] -eq 'show') {
        $tags = @{ managedBy = 'goliat-iac'; iacName = 'goliat-dev'; project = 'goliat-cloud-inventory' }
        if ($env:GOLIAT_IAC_TEST_MODE -eq 'foreign') { $tags.managedBy = 'another-project' }
        if ($env:GOLIAT_IAC_TEST_MODE -eq 'untagged') { $tags = @{} }
        $id = "/subscriptions/$subscriptionId/resourceGroups/rg-goliat-dev"
        if ($env:GOLIAT_IAC_TEST_MODE -eq 'wrong-subscription') {
            $id = '/subscriptions/22222222-2222-4222-8222-222222222222/resourceGroups/rg-goliat-dev'
        }
        @{ id = $id; name = 'rg-goliat-dev'; location = 'westeurope'; tags = $tags } | ConvertTo-Json
        return
    }
    if ($arguments[1] -eq 'delete') { return }
}
if ($arguments[0] -eq 'deployment') {
    if ($env:GOLIAT_IAC_TEST_MODE -eq 'deployment-failed') {
        $global:LASTEXITCODE = 17
        return
    }
    if (($arguments -join ' ') -match 'goliat-dev-project') {
        $parameterPath = $arguments[[Array]::IndexOf($arguments, '--parameters') + 1].Substring(1)
        $parameters = Get-Content -LiteralPath $parameterPath -Raw | ConvertFrom-Json
        $parameters.settings.value | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath "$($env:GOLIAT_IAC_TEST_LOG).parameters.json" -Encoding UTF8
        @{
            infrastructure = @{ type = 'Object'; value = @{
                resourceGroupName = 'rg-goliat-dev'; functionAppName = 'func-goliat-dev-abcdefghijklm'
                functionUrl = 'https://func-test.azurewebsites.net'; storageAccountName = 'stgoliatabcdefghijklm'
                inventorySubscriptionIds = @($subscriptionId); identityPrincipalId = '66666666-6666-4666-8666-666666666666'
            } }
            webAppName = @{ type = 'String'; value = 'web-goliat-dev-abcdefghijklm' }
            webUrl = @{ type = 'String'; value = 'https://web-test.azurewebsites.net' }
            postgresServerName = @{ type = 'String'; value = 'pg-goliat-dev-abcdefghijklm' }
            databaseHost = @{ type = 'String'; value = 'pg-test.postgres.database.azure.com' }
        } | ConvertTo-Json -Depth 6
        return
    }
    @{
        functionAppName = @{ type = 'String'; value = 'func-test' }
        storageAccountUrl = @{ type = 'String'; value = 'https://test.blob.core.windows.net/' }
    } | ConvertTo-Json -Depth 4
    return
}
if ($arguments[0] -in @('ad', 'rest')) {
    if ($env:GOLIAT_IAC_TEST_MODE -eq 'entra-denied') { $global:LASTEXITCODE = 42; return }
    $statePath = "$($env:GOLIAT_IAC_TEST_LOG).entra.json"
    $application = if (Test-Path -LiteralPath $statePath) { Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json } else { $null }
    if (-not $application -and $env:GOLIAT_IAC_TEST_MODE -in @('entra-existing', 'entra-foreign', 'entra-duplicate', 'entra-multitenant')) {
        $application = [pscustomobject]@{
            id = '55555555-5555-4555-8555-555555555555'
            appId = '77777777-7777-4777-8777-777777777777'
            displayName = 'Goliat - Cloud Inventory (goliat-dev)'
            description = "goliat-iac:${subscriptionId}:goliat-dev"
            signInAudience = 'AzureADMyOrg'
            requiredResourceAccess = @(
                @{ resourceAppId = '00000003-0000-0000-c000-000000000000'; resourceAccess = @(@{ id = '88888888-8888-4888-8888-888888888888'; type = 'Scope' }) },
                @{ resourceAppId = '99999999-9999-4999-8999-999999999999'; resourceAccess = @(@{ id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; type = 'Role' }) }
            )
            web = @{ redirectUris = @('http://localhost:4000/api/auth/callback/microsoft-entra-id') }
        }
        if ($env:GOLIAT_IAC_TEST_MODE -eq 'entra-foreign') { $application.description = 'another-project' }
        if ($env:GOLIAT_IAC_TEST_MODE -eq 'entra-multitenant') { $application.signInAudience = 'AzureADMultipleOrgs' }
    }
    if ($arguments[0] -eq 'rest') {
        $bodyPath = $arguments[[Array]::IndexOf($arguments, '--body') + 1].Substring(1)
        $body = Get-Content -LiteralPath $bodyPath -Raw | ConvertFrom-Json
        $method = $arguments[[Array]::IndexOf($arguments, '--method') + 1]
        if ($method -eq 'POST') {
            $application = [pscustomobject]@{
                id = '55555555-5555-4555-8555-555555555555'
                appId = '77777777-7777-4777-8777-777777777777'
                displayName = $body.displayName
                description = $body.description
                signInAudience = $body.signInAudience
                requiredResourceAccess = $body.requiredResourceAccess
                web = @{ redirectUris = @() }
            }
        } else {
            $application.requiredResourceAccess = $body.requiredResourceAccess
        }
        $application | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $statePath -Encoding UTF8
        if ($method -eq 'POST') { $application | ConvertTo-Json -Depth 12 }
        return
    }
    if ($arguments[1] -eq 'sp') {
        if ($arguments[2] -eq 'list') {
            if (Test-Path -LiteralPath "$statePath.sp") { Write-Output '[{"id":"test-service-principal"}]' }
            else { Write-Output '[]' }
        } else { Set-Content -LiteralPath "$statePath.sp" -Value 'created' }
        return
    }
    if ($arguments[2] -eq 'list') {
        if ($env:GOLIAT_IAC_TEST_MODE -eq 'entra-duplicate') { ConvertTo-Json -InputObject @($application, $application) -Depth 12 }
        elseif ($application) { ConvertTo-Json -InputObject @($application) -Depth 12 }
        else { Write-Output '[]' }
        return
    }
    if ($arguments[2] -eq 'show') { $application | ConvertTo-Json -Depth 12; return }
    if ($arguments[2] -eq 'credential') {
        if ($env:GOLIAT_IAC_TEST_MODE -eq 'entra-secret-failed') { $global:LASTEXITCODE = 43; return }
        @{ appId = $application.appId; password = 'synthetic-client-secret-for-test'; tenant = '33333333-3333-4333-8333-333333333333' } | ConvertTo-Json
        return
    }
    if ($arguments[2] -eq 'update') {
        if ($env:GOLIAT_IAC_TEST_MODE -eq 'entra-callback-failed') { $global:LASTEXITCODE = 44; return }
        $start = [Array]::IndexOf($arguments, '--web-redirect-uris') + 1
        $end = [Array]::IndexOf($arguments, '--output') - 1
        $application.web.redirectUris = @($arguments[$start..$end])
        $application | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $statePath -Encoding UTF8
        return
    }
}
if ($arguments[0] -eq 'webapp' -or $arguments[0] -eq 'functionapp') { return }
if ($arguments[0] -eq 'postgres') {
    if ($arguments[2] -eq 'show') {
        if ($env:GOLIAT_IAC_TEST_MODE -eq 'stopped') { Write-Output 'Stopped' }
        else { Write-Output 'Ready' }
    }
    return
}
throw 'Comando inesperado en la CLI simulada.'
