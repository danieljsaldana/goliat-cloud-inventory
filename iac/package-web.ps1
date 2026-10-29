#Requires -Version 5.1
[CmdletBinding()]
param(
    [ValidatePattern('^[a-z][a-z0-9-]{1,18}[a-z0-9]$')]
    [string] $Name = 'goliat-dev'
)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$image = "goliat-web-package:$Name"
$os = & docker info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0 -or $os -ne 'linux') { throw 'Arranca Docker Desktop en modo Linux antes de empaquetar.' }
& docker build --platform linux/amd64 --target runner --tag $image $workspace
if ($LASTEXITCODE -ne 0) { throw 'La compilación Linux de la web ha fallado. No se despliega en Azure.' }

$outputDirectory = Join-Path $PSScriptRoot '.azure'
$null = New-Item -ItemType Directory -Path $outputDirectory -Force
$packer = Join-Path $PSScriptRoot 'scripts/package-web.mjs'
# Resolver los enlaces dentro de Linux, sin privilegios de symlink en Windows.
& docker run --rm --platform linux/amd64 --read-only --network none --entrypoint node `
    --mount "type=bind,source=$packer,target=/goliat-package.mjs,readonly" `
    --mount "type=bind,source=$outputDirectory,target=/out" `
    $image /goliat-package.mjs /app "/out/$Name.web.zip"
if ($LASTEXITCODE -ne 0) { throw 'Ha fallado el empaquetado de la web.' }
