# MinIO Local Setup

This runs local S3-compatible storage for development.

## Start MinIO
From repo root:

```bash
docker compose -f infra/docker-compose.minio.yml up
```

MinIO API: `http://localhost:9000`
MinIO Console: `http://localhost:9001`

Default credentials:
- User: `minioadmin`
- Password: `minioadmin`

## Create a Bucket
1. Open the MinIO console
2. Create a bucket, e.g. `open-photos`

## Configure Server Env
Create `server/.env` with:

```
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=open-photos
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
```

## Notes
- Use `us-east-1` as a default region for MinIO.
- This is for local dev only.
