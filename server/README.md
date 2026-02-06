# Server

Node.js API and background workers.

## Scripts
- `npm run dev`
- `npm run start`

## Environment
- `MONGODB_URI` (default: `mongodb://127.0.0.1:27017/open-photos`)
- `PORT` (default: `3000`)
- `HOST` (default: `0.0.0.0`)
- `OIDC_ISSUER` (default: `http://localhost:8080/realms/open-photos`)
- `OIDC_AUDIENCE` (default: `account,open-photos-client`)
- `OIDC_JWKS_URI` (default: `http://localhost:8080/realms/open-photos/protocol/openid-connect/certs`)

## Routes
- `GET /health`
- `GET /api/health`
- `GET /api/auth/me` (requires Bearer token)
