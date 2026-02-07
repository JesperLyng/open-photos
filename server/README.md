# Server

Node.js API and background workers.

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `tsx scripts/reprocess-assets.ts` (reprocess all assets)
- `tsx scripts/reprocess-assets.ts <assetId>` (reprocess single)

## Environment
- `MONGODB_URI` (default: `mongodb://127.0.0.1:27017/open-photos`)
- `PORT` (default: `3000`)
- `HOST` (default: `0.0.0.0`)
- `OIDC_ISSUER` (default: `http://localhost:8080/realms/open-photos`)
- `OIDC_AUDIENCE` (default: `account,open-photos-client`)
- `OIDC_JWKS_URI` (default: `http://localhost:8080/realms/open-photos/protocol/openid-connect/certs`)
- `S3_ENDPOINT` (default: `https://s3.fr-par.scw.cloud`)
- `S3_REGION` (default: `fr-par`)
- `S3_BUCKET` (required)
- `S3_ACCESS_KEY_ID` (required)
- `S3_SECRET_ACCESS_KEY` (required)

## Routes
- `GET /health`
- `GET /api/health`
- `GET /api/auth/me` (requires Bearer token)
- `POST /api/uploads/init` (requires Bearer token)
- `POST /api/uploads/complete` (requires Bearer token)
- `GET /api/library` (requires Bearer token)
- `DELETE /api/assets/:id` (requires Bearer token)
- `GET /api/assets/:id` (requires Bearer token)
