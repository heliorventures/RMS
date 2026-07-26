<#
.SYNOPSIS
    Build the RMS Docker image, save it as a tar archive, and upload it to the VPS.

.EXAMPLE
    .\scripts\build-save-upload-image.ps1 -Tag rms-001 -VpsHost 159.198.70.19 -VpsUser deploy

.EXAMPLE
    .\scripts\build-save-upload-image.ps1 -Tag rms-001 -VpsHost 159.198.70.19 -VpsUser deploy -PublicBaseUrl https://rms.heliorsoft.com -DeployAfterUpload
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-zA-Z0-9_.-]+$')]
    [string]$Tag,

    [string]$VpsHost,

    [string]$VpsUser = 'deploy',

    [int]$SshPort = 22,

    [string]$SshIdentityFile,

    [string]$RemoteDir = '/opt/apps/rms/images',

    [string]$OutputDir = 'dist-images',

    [string]$PublicBaseUrl,

    [switch]$DeployAfterUpload,

    [switch]$SkipDeploymentValidation,

    [switch]$SkipUpload
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$OutDir = Join-Path $Root $OutputDir
$Image = "rms:$Tag"
$TarName = "rms-$Tag.tar"
$TarPath = Join-Path $OutDir $TarName
$DeployScript = Join-Path $PSScriptRoot 'deploy-on-vps.ps1'

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required but was not found on PATH"
    }
}

function Run-Command {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )

    Write-Host "==> $Description" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE"
    }
}

Require-Command docker

if (-not $SkipUpload) {
    Require-Command ssh
    Require-Command scp
    if ([string]::IsNullOrWhiteSpace($VpsHost)) {
        throw "VpsHost is required unless -SkipUpload is set"
    }
}

if ($SkipUpload -and $DeployAfterUpload) {
    throw "DeployAfterUpload cannot be used with SkipUpload"
}

if ($DeployAfterUpload) {
    if ([string]::IsNullOrWhiteSpace($PublicBaseUrl)) {
        throw "PublicBaseUrl is required when DeployAfterUpload is set"
    }
    if (-not (Test-Path $DeployScript)) {
        throw "Missing deploy script: $DeployScript"
    }
}

$SshArgs = @('-p', $SshPort)
$ScpArgs = @('-P', $SshPort)
if (-not [string]::IsNullOrWhiteSpace($SshIdentityFile)) {
    if (-not (Test-Path $SshIdentityFile)) {
        throw "SSH identity file does not exist: $SshIdentityFile"
    }
    $SshArgs += @('-i', $SshIdentityFile)
    $ScpArgs += @('-i', $SshIdentityFile)
}

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

Run-Command "Building $Image" {
    docker build -t $Image $Root
}

Run-Command "Saving $Image to $TarPath" {
    docker save $Image -o $TarPath
}

if ($SkipUpload) {
    Write-Host ""
    Write-Host "Image archive is ready: $TarPath" -ForegroundColor Green
    exit 0
}

if ($RemoteDir.Contains("'")) {
    throw "RemoteDir cannot contain a single quote"
}

$Remote = "${VpsUser}@${VpsHost}"
$DeploymentStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$RemoteArchiveDir = "$RemoteDir/archive/$DeploymentStamp"
$RemotePrepareCommand = "set -eu; mkdir -p '$RemoteDir' '$RemoteDir/archive'; if ls '$RemoteDir'/rms-*.tar >/dev/null 2>&1; then mkdir -p '$RemoteArchiveDir'; mv '$RemoteDir'/rms-*.tar '$RemoteArchiveDir'/; fi"

Run-Command "Preparing remote image directory and archive on $Remote" {
    ssh @SshArgs $Remote $RemotePrepareCommand
}

Run-Command "Uploading image archive to ${Remote}:$RemoteDir" {
    scp @ScpArgs $TarPath "${Remote}:$RemoteDir/"
}

if ($DeployAfterUpload) {
    $DeployArgs = @{
        Tag = $Tag
        VpsHost = $VpsHost
        VpsUser = $VpsUser
        SshPort = $SshPort
        PublicBaseUrl = $PublicBaseUrl
        Deploy = $true
    }

    if (-not [string]::IsNullOrWhiteSpace($SshIdentityFile)) {
        $DeployArgs.SshIdentityFile = $SshIdentityFile
    }

    if ($SkipDeploymentValidation) {
        $DeployArgs.SkipValidation = $true
    }

    Run-Command "Deploying uploaded RMS image on $Remote" {
        & $DeployScript @DeployArgs
    }
}
