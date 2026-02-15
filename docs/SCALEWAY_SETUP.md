# Scaleway Setup (CLI)

This document captures the full Scaleway setup for this project.

## Scope

- Region: `fr-par`
- Project ID: `de5cc1f0-47c1-42b6-bcd6-b10753f4d953`
- Database: MongoDB Atlas (kept outside Scaleway)
- Compute/runtime: Scaleway Serverless Containers
- Container images: Scaleway Container Registry
- Photo storage: Scaleway Object Storage (S3-compatible)

## Architecture Mapping

- `Container Registry` stores deployable images:
  - API image
  - Worker image
  - Web image
- `Object Storage` stores user files:
  - originals
  - derived thumbnails/previews

## Prerequisites

- `scw` CLI installed at `C:\Users\Jesper\bin\scw.exe`
- Docker installed and running
- Domain names ready (for example `api.yourdomain.com`, `app.yourdomain.com`)
- Keycloak/OpenID provider configured
- Redis reachable from API/Worker for BullMQ queue

## 1) Configure CLI Defaults

```powershell
$SCW = "C:\Users\Jesper\bin\scw.exe"
$PROJECT_ID = "de5cc1f0-47c1-42b6-bcd6-b10753f4d953"
$REGION = "fr-par"

& $SCW init
& $SCW config set default-project-id=$PROJECT_ID default-region=$REGION default-zone=fr-par-1
& $SCW config get
```

Optional for current shell:

```powershell
$env:PATH = "$env:PATH;C:\Users\Jesper\bin"
```

## 2) Create Namespaces

Create image registry namespace:

```powershell
& $SCW registry namespace create name=openphotos region=$REGION project-id=$PROJECT_ID
```

Create serverless containers namespace:

```powershell
& $SCW container namespace create name=open-photos region=$REGION project-id=$PROJECT_ID -w
```

Get the namespace ID:

```powershell
$CONTAINER_NS_ID = (& $SCW container namespace list region=$REGION -o json | ConvertFrom-Json |
  Where-Object { $_.name -eq "open-photos" } | Select-Object -First 1).id
$CONTAINER_NS_ID
```
35c6b386-a0bc-480a-882d-ef1cc010be7f

## 3) Create Object Storage Buckets

Create private buckets:

```powershell
& $SCW object bucket create open-photos-originals-fr-par region=$REGION acl=private
& $SCW object bucket create open-photos-derived-fr-par region=$REGION acl=private
```

Set in server env:

- `S3_ENDPOINT=https://s3.fr-par.scw.cloud`
- `S3_REGION=fr-par`
- `S3_BUCKET=<bucket-name>`
- `S3_ACCESS_KEY_ID=<key>`
- `S3_SECRET_ACCESS_KEY=<secret>`

### CORS for browser direct upload

Apply CORS on the upload bucket (via Scaleway S3 settings) to allow:

- Origins: your web app origin(s)
- Methods: `PUT`, `GET`, `HEAD`
- Headers: `Content-Type`, `Authorization`, `x-amz-*`

## 4) Build and Push Images

Login to Scaleway registry:

```powershell
& $SCW registry login
```

Build tags:

```powershell
$TAG = (git rev-parse --short HEAD)
$API_IMAGE = "rg.$REGION.scw.cloud/openphotos/open-photos-api:$TAG"
$WORKER_IMAGE = "rg.$REGION.scw.cloud/openphotos/open-photos-worker:$TAG"
$WEB_IMAGE = "rg.$REGION.scw.cloud/openphotos/open-photos-web:$TAG"
```

Build and push:

```powershell
docker build -f server/Dockerfile -t $API_IMAGE .
docker push $API_IMAGE

docker build -f server/Dockerfile.worker -t $WORKER_IMAGE .
docker push $WORKER_IMAGE

docker build -f client/Dockerfile `
  --build-arg VITE_API_ORIGIN=https://api.yourdomain.com `
  --build-arg VITE_OIDC_AUTHORITY=https://auth.yourdomain.com/realms/open-photos `
  --build-arg VITE_OIDC_CLIENT_ID=open-photos-client `
  --build-arg VITE_OIDC_REDIRECT_URI=https://app.yourdomain.com/callback `
  --build-arg VITE_OIDC_SILENT_REDIRECT_URI=https://app.yourdomain.com/silent-renew.html `
  --build-arg VITE_OIDC_POST_LOGOUT_REDIRECT_URI=https://app.yourdomain.com `
  --build-arg VITE_OIDC_SCOPE="openid profile email" `
  -t $WEB_IMAGE .
docker push $WEB_IMAGE
```

### One-command deploy (recommended)

You can deploy API, worker, and web in one command:

```powershell
npm run deploy:scaleway
```

This runs `infra/deploy-scaleway.ps1` and reads `server/.prod.env` explicitly.

## 5) Create and Deploy API Container

Set secrets in shell first:

```powershell
$env:MONGODB_URI = "<atlas-uri>"
$env:S3_ACCESS_KEY_ID = "<s3-access-key>"
$env:S3_SECRET_ACCESS_KEY = "<s3-secret-key>"
$env:REDIS_PASSWORD = "<redis-password>"   # optional
```

Deploy API:

```powershell
& $SCW container container create `
  namespace-id=$CONTAINER_NS_ID `
  name=open-photos-api `
  registry-image=$API_IMAGE `
  port=3000 `
  min-scale=0 `
  max-scale=5 `
  cpu-limit=500 `
  memory-limit=1024 `
  environment-variables.NODE_ENV=production `
  environment-variables.HOST=0.0.0.0 `
  environment-variables.PORT=3000 `
  environment-variables.ALLOWED_ORIGINS=https://app.yourdomain.com `
  environment-variables.OIDC_ISSUER=https://auth.yourdomain.com/realms/open-photos `
  environment-variables.OIDC_AUDIENCE=account,open-photos-client `
  environment-variables.OIDC_JWKS_URI=https://auth.yourdomain.com/realms/open-photos/protocol/openid-connect/certs `
  environment-variables.S3_ENDPOINT=https://s3.$REGION.scw.cloud `
  environment-variables.S3_REGION=$REGION `
  environment-variables.S3_BUCKET=open-photos-originals-fr-par `
  environment-variables.RATE_LIMIT_ENABLED=true `
  environment-variables.REDIS_HOST=<redis-host> `
  environment-variables.REDIS_PORT=6379 `
  environment-variables.REDIS_DB=0 `
  secret-environment-variables.0.key=MONGODB_URI `
  secret-environment-variables.0.value=$env:MONGODB_URI `
  secret-environment-variables.1.key=S3_ACCESS_KEY_ID `
  secret-environment-variables.1.value=$env:S3_ACCESS_KEY_ID `
  secret-environment-variables.2.key=S3_SECRET_ACCESS_KEY `
  secret-environment-variables.2.value=$env:S3_SECRET_ACCESS_KEY `
  secret-environment-variables.3.key=REDIS_PASSWORD `
  secret-environment-variables.3.value=$env:REDIS_PASSWORD `
  deploy=true `
  region=$REGION `
  -w
```

## 6) Create and Deploy Worker Container

`min-scale=1` is recommended so queue jobs are always consumed.

```powershell
& $SCW container container create `
  namespace-id=$CONTAINER_NS_ID `
  name=open-photos-worker `
  registry-image=$WORKER_IMAGE `
  port=3000 `
  min-scale=1 `
  max-scale=1 `
  cpu-limit=500 `
  memory-limit=1024 `
  command.0=npm `
  command.1=run `
  command.2=start:worker `
  environment-variables.NODE_ENV=production `
  environment-variables.S3_ENDPOINT=https://s3.$REGION.scw.cloud `
  environment-variables.S3_REGION=$REGION `
  environment-variables.S3_BUCKET=open-photos-originals-fr-par `
  environment-variables.REDIS_HOST=<redis-host> `
  environment-variables.REDIS_PORT=6379 `
  environment-variables.REDIS_DB=0 `
  secret-environment-variables.0.key=MONGODB_URI `
  secret-environment-variables.0.value=$env:MONGODB_URI `
  secret-environment-variables.1.key=S3_ACCESS_KEY_ID `
  secret-environment-variables.1.value=$env:S3_ACCESS_KEY_ID `
  secret-environment-variables.2.key=S3_SECRET_ACCESS_KEY `
  secret-environment-variables.2.value=$env:S3_SECRET_ACCESS_KEY `
  secret-environment-variables.3.key=REDIS_PASSWORD `
  secret-environment-variables.3.value=$env:REDIS_PASSWORD `
  deploy=true `
  region=$REGION `
  -w
```

## 7) Create and Deploy Web Container

```powershell
& $SCW container container create `
  namespace-id=$CONTAINER_NS_ID `
  name=open-photos-web `
  registry-image=$WEB_IMAGE `
  port=8080 `
  min-scale=0 `
  max-scale=3 `
  cpu-limit=200 `
  memory-limit=512 `
  deploy=true `
  region=$REGION `
  -w
```

## 8) Attach Custom Domains

Get container IDs:

```powershell
& $SCW container container list namespace-id=$CONTAINER_NS_ID region=$REGION
```

Attach domains:

```powershell
& $SCW container domain create container-id=<api-container-id> hostname=api.yourdomain.com region=$REGION
& $SCW container domain create container-id=<web-container-id> hostname=app.yourdomain.com region=$REGION
```

Then create DNS records as returned by Scaleway.

## 9) Rolling Updates

Build/push new tag, then update containers:

```powershell
& $SCW container container update <api-container-id> registry-image=$API_IMAGE region=$REGION -w
& $SCW container container update <worker-container-id> registry-image=$WORKER_IMAGE region=$REGION -w
& $SCW container container update <web-container-id> registry-image=$WEB_IMAGE region=$REGION -w
```

## 10) Validation Commands

```powershell
& $SCW container container list namespace-id=$CONTAINER_NS_ID region=$REGION
& $SCW container domain list region=$REGION
& $SCW registry image list region=$REGION
```

## server/.prod.env Template

```dotenv
SCW_PROJECT_ID=de5cc1f0-47c1-42b6-bcd6-b10753f4d953
SCW_REGION=fr-par
SCW_REGISTRY_NAMESPACE=openphotos
SCW_CONTAINER_NAMESPACE=open-photos
SCW_API_CONTAINER_NAME=open-photos-api
SCW_WORKER_CONTAINER_NAME=open-photos-worker
SCW_WEB_CONTAINER_NAME=open-photos-web

MONGODB_URI=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=https://s3.fr-par.scw.cloud
S3_REGION=fr-par

ALLOWED_ORIGINS=https://app.yourdomain.com
OIDC_ISSUER=https://auth.yourdomain.com/realms/open-photos
OIDC_AUDIENCE=account,open-photos-client
OIDC_JWKS_URI=https://auth.yourdomain.com/realms/open-photos/protocol/openid-connect/certs
RATE_LIMIT_ENABLED=true

# Optional: set REDIS_HOST to enable the BullMQ worker container.
# Without Redis, media processing runs inline in the API.
#REDIS_HOST=
#REDIS_PORT=6379
#REDIS_DB=0
#REDIS_PASSWORD=

VITE_API_ORIGIN=https://api.yourdomain.com
VITE_OIDC_AUTHORITY=https://auth.yourdomain.com/realms/open-photos
VITE_OIDC_CLIENT_ID=open-photos-client
VITE_OIDC_REDIRECT_URI=https://app.yourdomain.com/callback
VITE_OIDC_SILENT_REDIRECT_URI=https://app.yourdomain.com/silent-renew.html
VITE_OIDC_POST_LOGOUT_REDIRECT_URI=https://app.yourdomain.com
VITE_OIDC_SCOPE=openid profile email
```

## Current App Environment Variables

Server (`server/src/lib/config.ts`) expects:

- `NODE_ENV`
- `HOST`
- `PORT`
- `MONGODB_URI`
- `OIDC_ISSUER`
- `OIDC_AUDIENCE`
- `OIDC_JWKS_URI`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `ALLOWED_ORIGINS`
- `RATE_LIMIT_ENABLED`
- `REDIS_HOST` (optional — enables BullMQ worker; without it media processes inline)
- `REDIS_PORT` (optional)
- `REDIS_PASSWORD` (optional)
- `REDIS_DB` (optional)

Client build-time vars:

- `VITE_API_ORIGIN`
- `VITE_OIDC_AUTHORITY`
- `VITE_OIDC_CLIENT_ID`
- `VITE_OIDC_REDIRECT_URI`
- `VITE_OIDC_SILENT_REDIRECT_URI`
- `VITE_OIDC_POST_LOGOUT_REDIRECT_URI`

## Notes

- MongoDB Atlas allowlist must allow traffic from your API/Worker runtime.
- Object storage buckets should stay private. Access is done via presigned URLs.
- Worker deployment requires Redis. Without Redis, media processing runs inline in the API container.
