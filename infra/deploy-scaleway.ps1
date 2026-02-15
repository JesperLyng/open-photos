param(
  [string]$EnvFile = ".prod.env",
  [string]$ScwPath = "C:\Users\Jesper\bin\scw.exe",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
  param([string]$Path)

  $result = @{}
  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
      continue
    }

    $normalized = if ($trimmed.StartsWith("export ")) {
      $trimmed.Substring(7)
    } else {
      $trimmed
    }

    $eq = $normalized.IndexOf("=")
    if ($eq -lt 0) {
      continue
    }

    $key = $normalized.Substring(0, $eq).Trim()
    $value = $normalized.Substring($eq + 1).Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $result[$key] = $value
  }

  return $result
}

function Get-Required {
  param(
    [hashtable]$Config,
    [string]$Key
  )
  if (-not $Config.ContainsKey($Key) -or [string]::IsNullOrWhiteSpace($Config[$Key])) {
    throw "Missing required value in env file: $Key"
  }
  return $Config[$Key]
}

function Get-Optional {
  param(
    [hashtable]$Config,
    [string]$Key,
    [string]$Default = ""
  )
  if (-not $Config.ContainsKey($Key) -or [string]::IsNullOrWhiteSpace($Config[$Key])) {
    return $Default
  }
  return $Config[$Key]
}

function Invoke-Checked {
  param(
    [string]$Label,
    [string]$Binary,
    [string[]]$Args
  )
  Write-Host "==> $Label"
  & $Binary @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($Label): $Binary $($Args -join ' ')"
  }
}

function Ensure-Container {
  param(
    [string]$ScwBinary,
    [string]$Region,
    [string]$NamespaceId,
    [string]$Name,
    [string]$Image,
    [int]$Port,
    [int]$MinScale,
    [int]$MaxScale,
    [int]$CpuLimit,
    [int]$MemoryLimit,
    [hashtable]$EnvVars,
    [hashtable]$SecretVars,
    [string[]]$CommandArgs
  )

  $listRaw = & $ScwBinary container container list namespace-id=$NamespaceId region=$Region -o json
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to list containers"
  }
  $list = $listRaw | ConvertFrom-Json
  if ($null -eq $list) {
    $list = @()
  }
  if ($list -isnot [System.Collections.IEnumerable] -or $list -is [string]) {
    $list = @($list)
  }
  $existing = $list | Where-Object { $_.name -eq $Name } | Select-Object -First 1

  $args = @()
  if ($existing) {
    $args += @("container", "container", "update", $existing.id)
  } else {
    $args += @("container", "container", "create", "namespace-id=$NamespaceId", "name=$Name")
  }

  $args += @(
    "registry-image=$Image",
    "port=$Port",
    "min-scale=$MinScale",
    "max-scale=$MaxScale",
    "cpu-limit=$CpuLimit",
    "memory-limit=$MemoryLimit",
    "region=$Region"
  )

  foreach ($key in $EnvVars.Keys) {
    $value = [string]$EnvVars[$key]
    if ([string]::IsNullOrWhiteSpace($value)) {
      continue
    }
    $args += "environment-variables.$key=$value"
  }

  $secretIndex = 0
  foreach ($key in $SecretVars.Keys) {
    $value = [string]$SecretVars[$key]
    if ([string]::IsNullOrWhiteSpace($value)) {
      continue
    }
    $args += "secret-environment-variables.$secretIndex.key=$key"
    $args += "secret-environment-variables.$secretIndex.value=$value"
    $secretIndex += 1
  }

  if ($CommandArgs) {
    for ($i = 0; $i -lt $CommandArgs.Length; $i += 1) {
      $args += "command.$i=$($CommandArgs[$i])"
    }
  }

  if (-not $existing) {
    $args += "deploy=true"
  }
  $args += "-w"

  Invoke-Checked -Label "Deploy container: $Name" -Binary $ScwBinary -Args $args
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedEnvFile = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
  $EnvFile
} else {
  (Join-Path $repoRoot $EnvFile)
}

if (-not (Test-Path $resolvedEnvFile)) {
  throw "Env file not found: $resolvedEnvFile"
}
if (-not (Test-Path $ScwPath)) {
  throw "scw binary not found: $ScwPath"
}

$cfg = Read-EnvFile -Path $resolvedEnvFile

$projectId = Get-Required -Config $cfg -Key "SCW_PROJECT_ID"
$region = Get-Optional -Config $cfg -Key "SCW_REGION" -Default "fr-par"
$registryNamespace = Get-Optional -Config $cfg -Key "SCW_REGISTRY_NAMESPACE" -Default "openphotos"
$containerNamespace = Get-Optional -Config $cfg -Key "SCW_CONTAINER_NAMESPACE" -Default "open-photos"

$apiContainerName = Get-Optional -Config $cfg -Key "SCW_API_CONTAINER_NAME" -Default "open-photos-api"
$workerContainerName = Get-Optional -Config $cfg -Key "SCW_WORKER_CONTAINER_NAME" -Default "open-photos-worker"
$webContainerName = Get-Optional -Config $cfg -Key "SCW_WEB_CONTAINER_NAME" -Default "open-photos-web"

$s3Region = Get-Optional -Config $cfg -Key "S3_REGION" -Default $region
$s3Endpoint = Get-Optional -Config $cfg -Key "S3_ENDPOINT" -Default "https://s3.$s3Region.scw.cloud"

$mongoUri = Get-Required -Config $cfg -Key "MONGODB_URI"
$s3Bucket = Get-Required -Config $cfg -Key "S3_BUCKET"
$s3AccessKeyId = Get-Required -Config $cfg -Key "S3_ACCESS_KEY_ID"
$s3SecretAccessKey = Get-Required -Config $cfg -Key "S3_SECRET_ACCESS_KEY"
$allowedOrigins = Get-Required -Config $cfg -Key "ALLOWED_ORIGINS"
$oidcIssuer = Get-Required -Config $cfg -Key "OIDC_ISSUER"
$oidcJwksUri = Get-Required -Config $cfg -Key "OIDC_JWKS_URI"
$oidcAudience = Get-Optional -Config $cfg -Key "OIDC_AUDIENCE" -Default "account,open-photos-client"
$rateLimitEnabled = Get-Optional -Config $cfg -Key "RATE_LIMIT_ENABLED" -Default "true"
$redisHost = Get-Required -Config $cfg -Key "REDIS_HOST"
$redisPort = Get-Optional -Config $cfg -Key "REDIS_PORT" -Default "6379"
$redisDb = Get-Optional -Config $cfg -Key "REDIS_DB" -Default "0"
$redisPassword = Get-Optional -Config $cfg -Key "REDIS_PASSWORD"

$viteApiOrigin = Get-Required -Config $cfg -Key "VITE_API_ORIGIN"
$viteOidcAuthority = Get-Required -Config $cfg -Key "VITE_OIDC_AUTHORITY"
$viteOidcClientId = Get-Required -Config $cfg -Key "VITE_OIDC_CLIENT_ID"
$viteOidcRedirectUri = Get-Required -Config $cfg -Key "VITE_OIDC_REDIRECT_URI"
$viteOidcSilentRedirectUri = Get-Required -Config $cfg -Key "VITE_OIDC_SILENT_REDIRECT_URI"
$viteOidcPostLogoutRedirectUri = Get-Required -Config $cfg -Key "VITE_OIDC_POST_LOGOUT_REDIRECT_URI"
$viteOidcScope = Get-Optional -Config $cfg -Key "VITE_OIDC_SCOPE" -Default "openid profile email"

Invoke-Checked -Label "Configure scw defaults" -Binary $ScwPath -Args @(
  "config",
  "set",
  "default-project-id=$projectId",
  "default-region=$region",
  "default-zone=$region-1"
)

$registryListRaw = & $ScwPath registry namespace list region=$region -o json
if ($LASTEXITCODE -ne 0) {
  throw "Failed to list registry namespaces"
}
$registryList = $registryListRaw | ConvertFrom-Json
if ($null -eq $registryList) {
  $registryList = @()
}
if ($registryList -isnot [System.Collections.IEnumerable] -or $registryList -is [string]) {
  $registryList = @($registryList)
}
$registry = $registryList | Where-Object { $_.name -eq $registryNamespace } | Select-Object -First 1
if (-not $registry) {
  Invoke-Checked -Label "Create registry namespace: $registryNamespace" -Binary $ScwPath -Args @(
    "registry", "namespace", "create", "name=$registryNamespace", "region=$region", "project-id=$projectId"
  )
}

$containerNsListRaw = & $ScwPath container namespace list region=$region -o json
if ($LASTEXITCODE -ne 0) {
  throw "Failed to list container namespaces"
}
$containerNsList = $containerNsListRaw | ConvertFrom-Json
if ($null -eq $containerNsList) {
  $containerNsList = @()
}
if ($containerNsList -isnot [System.Collections.IEnumerable] -or $containerNsList -is [string]) {
  $containerNsList = @($containerNsList)
}
$containerNs = $containerNsList | Where-Object { $_.name -eq $containerNamespace } | Select-Object -First 1
if (-not $containerNs) {
  Invoke-Checked -Label "Create container namespace: $containerNamespace" -Binary $ScwPath -Args @(
    "container", "namespace", "create", "name=$containerNamespace", "region=$region", "project-id=$projectId", "-w"
  )
  $containerNsListRaw = & $ScwPath container namespace list region=$region -o json
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to list container namespaces after creation"
  }
  $containerNsList = $containerNsListRaw | ConvertFrom-Json
  if ($containerNsList -isnot [System.Collections.IEnumerable] -or $containerNsList -is [string]) {
    $containerNsList = @($containerNsList)
  }
  $containerNs = $containerNsList | Where-Object { $_.name -eq $containerNamespace } | Select-Object -First 1
}
if (-not $containerNs) {
  throw "Container namespace not found: $containerNamespace"
}
$containerNamespaceId = $containerNs.id

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$gitTag = (& git -C $repoRoot rev-parse --short HEAD 2>$null).Trim()
$tag = if ([string]::IsNullOrWhiteSpace($gitTag)) { $timestamp } else { $gitTag }

$apiImage = "rg.$region.scw.cloud/$registryNamespace/open-photos-api:$tag"
$workerImage = "rg.$region.scw.cloud/$registryNamespace/open-photos-worker:$tag"
$webImage = "rg.$region.scw.cloud/$registryNamespace/open-photos-web:$tag"

if (-not $SkipBuild) {
  Invoke-Checked -Label "scw registry login" -Binary $ScwPath -Args @("registry", "login")

  Push-Location $repoRoot
  try {
    Invoke-Checked -Label "Build API image" -Binary "docker" -Args @("build", "-f", "server/Dockerfile", "-t", $apiImage, ".")
    Invoke-Checked -Label "Push API image" -Binary "docker" -Args @("push", $apiImage)

    Invoke-Checked -Label "Build worker image" -Binary "docker" -Args @("build", "-f", "server/Dockerfile.worker", "-t", $workerImage, ".")
    Invoke-Checked -Label "Push worker image" -Binary "docker" -Args @("push", $workerImage)

    Invoke-Checked -Label "Build web image" -Binary "docker" -Args @(
      "build",
      "-f", "client/Dockerfile",
      "--build-arg", "VITE_API_ORIGIN=$viteApiOrigin",
      "--build-arg", "VITE_OIDC_AUTHORITY=$viteOidcAuthority",
      "--build-arg", "VITE_OIDC_CLIENT_ID=$viteOidcClientId",
      "--build-arg", "VITE_OIDC_REDIRECT_URI=$viteOidcRedirectUri",
      "--build-arg", "VITE_OIDC_SILENT_REDIRECT_URI=$viteOidcSilentRedirectUri",
      "--build-arg", "VITE_OIDC_POST_LOGOUT_REDIRECT_URI=$viteOidcPostLogoutRedirectUri",
      "--build-arg", "VITE_OIDC_SCOPE=$viteOidcScope",
      "-t", $webImage,
      "."
    )
    Invoke-Checked -Label "Push web image" -Binary "docker" -Args @("push", $webImage)
  } finally {
    Pop-Location
  }
}

$apiEnv = @{
  NODE_ENV = "production"
  HOST = "0.0.0.0"
  PORT = "3000"
  ALLOWED_ORIGINS = $allowedOrigins
  OIDC_ISSUER = $oidcIssuer
  OIDC_AUDIENCE = $oidcAudience
  OIDC_JWKS_URI = $oidcJwksUri
  S3_ENDPOINT = $s3Endpoint
  S3_REGION = $s3Region
  S3_BUCKET = $s3Bucket
  RATE_LIMIT_ENABLED = $rateLimitEnabled
  REDIS_HOST = $redisHost
  REDIS_PORT = $redisPort
  REDIS_DB = $redisDb
}
$apiSecrets = @{
  MONGODB_URI = $mongoUri
  S3_ACCESS_KEY_ID = $s3AccessKeyId
  S3_SECRET_ACCESS_KEY = $s3SecretAccessKey
  REDIS_PASSWORD = $redisPassword
}

$workerEnv = @{
  NODE_ENV = "production"
  S3_ENDPOINT = $s3Endpoint
  S3_REGION = $s3Region
  S3_BUCKET = $s3Bucket
  REDIS_HOST = $redisHost
  REDIS_PORT = $redisPort
  REDIS_DB = $redisDb
}
$workerSecrets = @{
  MONGODB_URI = $mongoUri
  S3_ACCESS_KEY_ID = $s3AccessKeyId
  S3_SECRET_ACCESS_KEY = $s3SecretAccessKey
  REDIS_PASSWORD = $redisPassword
}

Ensure-Container `
  -ScwBinary $ScwPath `
  -Region $region `
  -NamespaceId $containerNamespaceId `
  -Name $apiContainerName `
  -Image $apiImage `
  -Port 3000 `
  -MinScale 0 `
  -MaxScale 5 `
  -CpuLimit 500 `
  -MemoryLimit 1024 `
  -EnvVars $apiEnv `
  -SecretVars $apiSecrets `
  -CommandArgs @()

Ensure-Container `
  -ScwBinary $ScwPath `
  -Region $region `
  -NamespaceId $containerNamespaceId `
  -Name $workerContainerName `
  -Image $workerImage `
  -Port 3000 `
  -MinScale 1 `
  -MaxScale 1 `
  -CpuLimit 500 `
  -MemoryLimit 1024 `
  -EnvVars $workerEnv `
  -SecretVars $workerSecrets `
  -CommandArgs @("npm", "run", "start:worker")

Ensure-Container `
  -ScwBinary $ScwPath `
  -Region $region `
  -NamespaceId $containerNamespaceId `
  -Name $webContainerName `
  -Image $webImage `
  -Port 8080 `
  -MinScale 0 `
  -MaxScale 3 `
  -CpuLimit 200 `
  -MemoryLimit 512 `
  -EnvVars @{} `
  -SecretVars @{} `
  -CommandArgs @()

Write-Host "Deployment completed."
Write-Host "API image: $apiImage"
Write-Host "Worker image: $workerImage"
Write-Host "Web image: $webImage"
