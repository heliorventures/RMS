<#
.SYNOPSIS
    Deploy the RMS Docker image on the VPS without changing the shared Caddyfile.

.EXAMPLE
    .\scripts\deploy-on-vps.ps1 -Tag rms-001 -VpsHost 159.198.70.19 -VpsUser deploy -PublicBaseUrl https://rms.heliorsoft.com -Deploy
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-zA-Z0-9_.-]+$')]
    [string]$Tag,

    [Parameter(Mandatory = $true)]
    [string]$VpsHost,

    [string]$VpsUser = 'deploy',

    [int]$SshPort = 22,

    [string]$SshIdentityFile,

    [string]$AppDir = '/opt/apps/rms',

    [string]$ImageDir = '/opt/apps/rms/images',

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https?://')]
    [string]$PublicBaseUrl,

    [switch]$Deploy,

    [switch]$SyncCompose,

    [switch]$SyncEnvExample,

    [switch]$LoadImage,

    [switch]$Up,

    [switch]$Validate,

    [switch]$SkipValidation
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$ComposeTemplate = Join-Path $Root 'deploy/docker-compose.rms.yml'
$EnvExample = Join-Path $Root 'deploy/.env.example'
$Remote = "${VpsUser}@${VpsHost}"

$RemoteComposePath = "$AppDir/docker-compose.yml"
$RemoteEnvExamplePath = "$AppDir/.env.example"
$RemoteEnvReconcileScriptPath = "$AppDir/config/rms-reconcile-env.sh"
$RemoteValidationScriptPath = "$AppDir/config/rms-validate-deploy.sh"

$TarName = "rms-$Tag.tar"

function Require-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required but was not found on PATH"
    }
}

function Assert-NoSingleQuote {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [AllowEmptyString()][string]$Value
    )
    if ($null -ne $Value -and $Value.Contains("'")) {
        throw "$Name cannot contain a single quote"
    }
}

function Quote-Sh {
    param([AllowEmptyString()][string]$Value)
    return "'$Value'"
}

function Run-Command {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Host "==> $Description" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE"
    }
}

function Invoke-Remote {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][string]$RemoteCommand
    )
    Run-Command $Description {
        ssh @SshArgs $Remote $RemoteCommand
    }
}

function Copy-ToRemote {
    param(
        [Parameter(Mandatory = $true)][string]$Description,
        [Parameter(Mandatory = $true)][string]$LocalPath,
        [Parameter(Mandatory = $true)][string]$RemotePath
    )

    if (-not (Test-Path $LocalPath)) {
        throw "Missing local file: $LocalPath"
    }

    Run-Command $Description {
        scp @ScpArgs $LocalPath "${Remote}:$RemotePath"
    }
}

function Write-Utf8NoBomFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $Encoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
    $NormalizedContent = $Content.Replace("`r`n", "`n")
    [System.IO.File]::WriteAllText($Path, $NormalizedContent, $Encoding)
}

Require-Command ssh
Require-Command scp

if (-not (Test-Path $ComposeTemplate)) {
    throw "Missing compose template: $ComposeTemplate"
}
if (-not (Test-Path $EnvExample)) {
    throw "Missing env example: $EnvExample"
}

if ($Deploy) {
    $SyncCompose = $true
    $SyncEnvExample = $true
    $LoadImage = $true
    $Up = $true
}
if ($Up -and -not $SkipValidation) {
    $Validate = $true
}

Assert-NoSingleQuote -Name 'VpsHost' -Value $VpsHost
Assert-NoSingleQuote -Name 'VpsUser' -Value $VpsUser
Assert-NoSingleQuote -Name 'AppDir' -Value $AppDir
Assert-NoSingleQuote -Name 'ImageDir' -Value $ImageDir
Assert-NoSingleQuote -Name 'PublicBaseUrl' -Value $PublicBaseUrl

$SshArgs = @('-p', $SshPort)
$ScpArgs = @('-P', $SshPort)
if (-not [string]::IsNullOrWhiteSpace($SshIdentityFile)) {
    if (-not (Test-Path $SshIdentityFile)) {
        throw "SSH identity file does not exist: $SshIdentityFile"
    }
    $SshArgs += @('-i', $SshIdentityFile)
    $ScpArgs += @('-i', $SshIdentityFile)
}

$AppDirQ = Quote-Sh $AppDir
$ConfigDirQ = Quote-Sh "$AppDir/config"
$ImageDirQ = Quote-Sh $ImageDir
$TagQ = Quote-Sh $Tag
$PublicBaseUrlQ = Quote-Sh $PublicBaseUrl.TrimEnd('/')
$RemoteEnvReconcileScriptPathQ = Quote-Sh $RemoteEnvReconcileScriptPath
$RemoteValidationScriptPathQ = Quote-Sh $RemoteValidationScriptPath
$TempFiles = @()

try {
    $EnvReconcileScriptPath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "rms-reconcile-env-$Tag.sh")
    $EnvReconcileScriptContent = @'
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$1"
TAG="$2"

cd "$APP_DIR"

fail() {
    echo "ERROR: $*" >&2
    exit 1
}

get_env_value() {
    local file="$1"
    local key="$2"
    awk -F= -v key="$key" '$1 == key { value = substr($0, length(key) + 2) } END { print value }' "$file"
}

set_env_value() {
    local file="$1"
    local key="$2"
    local value="$3"
    local tmp

    tmp="$(mktemp)"
    awk -v key="$key" -v value="$value" '
        BEGIN { done = 0 }
        $0 ~ "^" key "=" {
            print key "=" value
            done = 1
            next
        }
        { print }
        END {
            if (!done) {
                print key "=" value
            }
        }
    ' "$file" > "$tmp"
    cat "$tmp" > "$file"
    rm -f "$tmp"
}

test -f .env.example || fail "$APP_DIR/.env.example does not exist"

if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example. Review JWT_SECRET before exposing RMS publicly."
else
    cp .env ".env.backup.$(date +%Y%m%d-%H%M%S)"
fi

set_env_value .env RMS_IMAGE_TAG "$TAG"

mongodb_uri="$(get_env_value .env MONGODB_URI)"
jwt_secret="$(get_env_value .env JWT_SECRET)"
network_name="$(get_env_value .env RMS_DOCKER_NETWORK)"

if [ -z "$mongodb_uri" ] || printf "%s" "$mongodb_uri" | grep -q 'username:password'; then
    fail "MONGODB_URI must be configured in $APP_DIR/.env"
fi
if [ -z "$jwt_secret" ] || [ "$jwt_secret" = "change-this-rms-jwt-secret-min-32-chars" ] || [ "$jwt_secret" = "your-super-secret-jwt-key-change-in-production" ]; then
    fail "JWT_SECRET must be configured in $APP_DIR/.env before deployment"
fi
if [ -z "$network_name" ]; then
    fail "RMS_DOCKER_NETWORK must be configured in $APP_DIR/.env"
fi
docker network inspect "$network_name" >/dev/null || fail "Docker network does not exist: $network_name"

echo "==> Effective RMS deployment environment"
printf 'RMS_IMAGE_TAG=%s\n' "$(get_env_value .env RMS_IMAGE_TAG)"
printf 'MONGODB_URI=%s\n' '[set]'
printf 'JWT_SECRET=%s\n' '[set]'
printf 'RMS_DOCKER_NETWORK=%s\n' "$network_name"
'@
    Write-Utf8NoBomFile -Path $EnvReconcileScriptPath -Content $EnvReconcileScriptContent
    $TempFiles += $EnvReconcileScriptPath

    $ValidationScriptPath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "rms-validate-deploy-$Tag.sh")
    $ValidationScriptContent = @'
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$1"
IMAGE_DIR="$2"
TAG="$3"
PUBLIC_BASE_URL="$4"

cd "$APP_DIR"

fail() {
    echo "ERROR: $*" >&2
    exit 1
}

get_env_value() {
    local file="$1"
    local key="$2"
    awk -F= -v key="$key" '$1 == key { value = substr($0, length(key) + 2) } END { print value }' "$file"
}

echo "==> Validating RMS image archive"
test -f "$IMAGE_DIR/rms-$TAG.tar" || fail "Missing image archive: $IMAGE_DIR/rms-$TAG.tar"

echo "==> Validating loaded RMS Docker image"
docker image inspect "rms:$TAG" >/dev/null || fail "Docker image is not loaded: rms:$TAG"

echo "==> Validating docker compose config"
RMS_IMAGE_TAG="$TAG" docker compose config --quiet

echo "==> Waiting for rms-app"
deadline=$((SECONDS + 120))
while true; do
    state="$(docker inspect -f '{{.State.Status}}' rms-app 2>/dev/null || true)"
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' rms-app 2>/dev/null || true)"

    if [ "$state" = "running" ] && { [ "$health" = "healthy" ] || [ "$health" = "none" ]; }; then
        break
    fi

    if [ "$SECONDS" -ge "$deadline" ]; then
        docker compose ps || true
        docker logs rms-app --tail=100 2>&1 || true
        fail "rms-app is not healthy; state=$state health=$health"
    fi

    sleep 5
done

docker compose ps

echo "==> Validating RMS HTTP routes"
command -v curl >/dev/null 2>&1 || fail "curl is required on the VPS for HTTP validation"
network_name="$(get_env_value .env RMS_DOCKER_NETWORK)"
test -n "$network_name" || fail "RMS_DOCKER_NETWORK is not configured in $APP_DIR/.env"
docker run --rm --network "$network_name" curlimages/curl:8.10.1 -fsS --max-time 10 "http://rms-app:3000/api/health" >/dev/null || fail "RMS health is not reachable inside Docker network"
curl -fsS --max-time 10 "$PUBLIC_BASE_URL/api/health" >/dev/null || fail "RMS health is not reachable at $PUBLIC_BASE_URL/api/health. Check shared Caddy route."

echo "==> RMS deployment validation passed"
'@
    Write-Utf8NoBomFile -Path $ValidationScriptPath -Content $ValidationScriptContent
    $TempFiles += $ValidationScriptPath

    Invoke-Remote "Creating remote RMS directories on $Remote" "set -eu; mkdir -p $AppDirQ $ConfigDirQ $ImageDirQ '$AppDir/uploads' '$AppDir/logs'"

    if ($SyncCompose) {
        Copy-ToRemote "Uploading RMS docker-compose.yml" $ComposeTemplate $RemoteComposePath
    } else {
        Write-Host "==> Skipping compose sync. Use -SyncCompose for first deployment or compose changes." -ForegroundColor Yellow
    }

    if ($SyncEnvExample) {
        Copy-ToRemote "Uploading RMS .env.example" $EnvExample $RemoteEnvExamplePath
        Copy-ToRemote "Uploading RMS environment reconciliation script" $EnvReconcileScriptPath $RemoteEnvReconcileScriptPath
        Invoke-Remote "Reconciling remote RMS .env" "set -eu; bash $RemoteEnvReconcileScriptPathQ $AppDirQ $TagQ"
    }

    if ($LoadImage) {
        Invoke-Remote "Loading uploaded RMS Docker image" "set -eu; cd $ImageDirQ; test -f $TarName; docker load -i $TarName"
    } else {
        Write-Host "==> Skipping docker load. Use -LoadImage after the image archive is uploaded." -ForegroundColor Yellow
    }

    if ($Up) {
        Invoke-Remote "Starting RMS container with docker compose" "set -eu; cd $AppDirQ; test -f docker-compose.yml; test -f .env; RMS_IMAGE_TAG=$TagQ docker compose up -d --force-recreate rms-app"
    } else {
        Write-Host "==> Skipping docker compose up. Use -Up when you are ready to recreate rms-app." -ForegroundColor Yellow
    }

    if ($Validate) {
        Copy-ToRemote "Uploading RMS deployment validation script" $ValidationScriptPath $RemoteValidationScriptPath
        Invoke-Remote "Running RMS deployment validation" "set -eu; bash $RemoteValidationScriptPathQ $AppDirQ $ImageDirQ $TagQ $PublicBaseUrlQ"
    } else {
        Write-Host "==> Skipping deployment validation. Use -Validate or -Deploy to run image, compose, container, and HTTP checks." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "RMS deployment commands completed." -ForegroundColor Green
    Write-Host "  URL: $PublicBaseUrl"
} finally {
    foreach ($TempFile in $TempFiles) {
        if (Test-Path $TempFile) {
            Remove-Item -LiteralPath $TempFile -Force
        }
    }
}
