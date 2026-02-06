# Keycloak Local Setup

This setup runs a local Keycloak instance for OIDC with PKCE. It matches the server defaults in `server/.env.example`.

## Start Keycloak
From repo root:

```bash
docker compose -f infra/docker-compose.keycloak.yml up
```

Keycloak will be available at `http://localhost:8080`.

## Create Realm and Client
1. Open `http://localhost:8080` and log in.
   - Username: `admin`
   - Password: `admin`
2. Create a realm:
   - Realm name: `open-photos`
3. Create a client:
   - Client ID: `open-photos-client`
   - Client type: `OpenID Connect`
   - Access type: `public`
   - Standard flow: `ON`
   - Direct access grants: `OFF`
   - Valid redirect URIs: `http://localhost:5173/*`
   - Web origins: `http://localhost:5173`

## Create a Test User
1. Users -> Add user
2. Set email and name, then save
3. Credentials -> Set password (temporary OFF)

## Enable Self-Service Registration
1. Realm settings -> Login
2. Toggle **User registration** to ON
3. Save

With this enabled, the Keycloak login screen shows a **Register** link.
The app also provides a **Create account** button that opens the registration flow.

## Confirm API Env Vars
`server/.env.example` defaults match:

```
OIDC_ISSUER=http://localhost:8080/realms/open-photos
OIDC_AUDIENCE=open-photos-client
OIDC_JWKS_URI=http://localhost:8080/realms/open-photos/protocol/openid-connect/certs
```

## Next
Once this is up, we can add the React PKCE flow and a protected route.
