# Architecture

## Goals
- Keep the core pipeline simple: upload -> store -> process -> view.
- Make compute stateless and autoscaling.
- Keep user data in EU regions (Scaleway default).

## High-Level Components
- Web Client (React): upload, library grid, albums, sharing.
- API (Node.js): auth, library, album, share, upload init/complete.
- Workers (Node.js): thumbnailing, metadata extraction, indexing.
- MongoDB: metadata, albums, shares, jobs.
- Object Storage (S3-compatible): originals + derived assets.

## Data Flow (Core)
1. Client requests upload init -> API returns signed URL.
2. Client uploads directly to object storage.
3. Client notifies API upload complete -> API creates asset record.
4. Worker processes asset -> creates thumbnails -> updates status.
5. Client fetches library -> API returns assets + derived URLs.

## Repository Layout
- `client/`
  - `src/` UI + state + API client
  - `src/features/` domain features (library, albums, sharing)
  - `src/components/` shared UI components
- `server/`
  - `src/api/` routes, controllers, validation
  - `src/services/` domain services
  - `src/models/` mongoose schemas
  - `src/workers/` background job processors
  - `src/lib/` storage, queue, logging, config
- `packages/`
  - `types/` shared types and DTOs
  - `sdk/` generated/handwritten API client
- `infra/`
  - `scaleway/` setup notes, environment config templates
  - `scripts/` small automation scripts

## Runtime Boundaries
- API is stateless.
- Workers are stateless and run jobs from a queue.
- Storage contains originals and derived assets.
- DB stores metadata only (no blobs).
