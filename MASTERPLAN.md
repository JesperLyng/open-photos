# Open Photos Masterplan

This document sketches a top-to-bottom plan for building an online photo platform comparable to Google Photos, using React, Node.js, and MongoDB.

## Vision
Provide a fast, reliable, and privacy-respecting photo platform with effortless upload, smart organization, search, sharing, and cross-device access.

## Product Goals
- Simple, delightful upload and viewing experience.
- Fast, accurate search across large libraries.
- Safe sharing with granular permissions.
- Durable storage with predictable costs.
- Privacy-first defaults with transparent controls.

## Key User Journeys
- Import: upload from web and mobile, background sync.
- Organize: albums, favorites, tags, people, places, dates.
- Search: text, objects, people, places, and metadata.
- Share: private links, shared albums, family spaces.
- Consume: grid, timeline, map view, and slide shows.

## Architecture Overview

### Frontend (React)
- SPA with responsive layouts for desktop and mobile.
- Client-side virtualized grids for performance.
- Upload manager with background retry and resumable uploads.
- Media viewer with progressive loading and prefetching.

### Backend (Node.js)
- REST API (or GraphQL later), organized by domain.
- Background jobs for processing (thumbnails, metadata extraction, AI tagging).
- Signed upload URLs for direct-to-storage uploads.
- Search service abstraction (start with Mongo text, evolve to dedicated search).

### Database (MongoDB)
- Users, sessions, auth providers, and devices.
- Media objects, albums, tags, and share metadata.
- Processing jobs and audit logs.

### Storage
- Object storage (S3-compatible). Track original plus derived assets.
- CDN for delivery of optimized images and video.

### Search
- Phase 1: Mongo text search + metadata filters.
- Phase 2: Dedicated search (OpenSearch/Elastic) for scale and relevance.

### AI/ML (Optional, staged)
- Local or hosted service for auto-tagging and face clustering.
- Feature flags and async pipelines.

## Core Domains and Data Model

### Users
- `User`: profile, storage quota, preferences.
- `AuthIdentity`: email/pass, OAuth, passkeys.

### Media
- `MediaAsset`: original file, metadata, EXIF, upload status.
- `DerivedAsset`: thumbnails, previews, video transcodes.
- `AssetTag`: system tags, user tags, AI tags.

### Organization
- `Album`: shared or private, collaborators.
- `AlbumItem`: asset ordering, metadata overrides.

### Sharing
- `ShareLink`: public/private, expires, access rules.
- `ShareAccess`: per-user access, role, activity.

### System
- `Job`: processing pipeline state.
- `AuditLog`: share/access actions.

## Non-Functional Requirements
- Performance: smooth scrolling across 50k+ photos.
- Reliability: background retries and resumable uploads.
- Security: encrypted tokens, signed URLs, least privilege.
- Privacy: data minimization, granular sharing controls.
- Cost: storage tiering, lifecycle rules, caching.

## Milestones

### Phase 0: Foundation
- Repo structure, CI, linting, test harness.
- Base auth and user profiles.

### Phase 1: Core Upload + Library
- Upload to object storage via signed URLs.
- Process thumbnails and basic metadata.
- Library grid, timeline view.

### Phase 2: Albums + Sharing
- Create albums, add/remove items.
- Share links, access control.

### Phase 3: Search + Filters
- Search by filename, tags, date range.
- Filters: type, favorite, album.

### Phase 4: Smart Features
- Automatic tagging, people clustering.
- Map view from EXIF location.

### Phase 5: Reliability + Scale
- Caching, pagination, optimized queries.
- Storage lifecycle and backups.

## Tech Stack Proposal
- React + Vite, React Query, Zustand, Tailwind or CSS modules.
- Node.js + Express or Fastify.
- MongoDB with Mongoose or native driver.
- Redis for job queues (BullMQ).
- S3-compatible storage (AWS, Backblaze, MinIO for dev).
- OpenSearch (later phase).

## Deployment and Hosting (EU, Non-US Owned)
- Default provider: Scaleway (EU-owned, EU data residency).
- Primary region: `fr-par` (Paris) for database and storage locality.
- Compute: Scaleway Serverless Functions for autoscaling API and background jobs.
- Database: Scaleway Managed MongoDB (Paris region).
- Storage: Scaleway Object Storage (S3-compatible) for originals and derived assets.

Scaling strategy:
- Stateless API and workers autoscale via serverless functions.
- Object storage scales capacity automatically.
- Database scales vertically first; add replicas as usage grows.

## Provider Decision Rationale
- Non-US owned with EU data residency as a hard requirement.
- Single-provider preference to minimize ops overhead.
- Scaleway offers EU regions and a cohesive serverless + storage + managed DB stack.
- Starting scale (few hundred GB) fits a simple serverless + S3-compatible storage model.

## Infrastructure Checklist
- Account and region setup: project, `fr-par`, IAM.
- Object storage buckets: originals, derived assets, lifecycle rules.
- Managed MongoDB: instance, users, backups, network access.
- Serverless functions: namespaces, env vars, secrets, logs.
- DNS and TLS: domain setup and HTTPS.
- Observability: logs, metrics, alerts.
- Cost controls: quotas and alert thresholds.

## Security Plan (Baseline)
- JWT or session tokens with rotation.
- Signed upload URLs with short TTL.
- Rate limits on auth and uploads.
- Audit logging on share access.
- Encryption at rest on storage.

## Observability
- Structured logs, request IDs.
- Metrics: uploads/sec, processing times, error rates.
- Alerts for failed jobs and backlogs.

## API Sketch (Phase 1)
- `POST /auth/login`
- `POST /auth/logout`
- `POST /uploads/init`
- `POST /uploads/complete`
- `GET /library`
- `GET /assets/:id`
- `GET /assets/:id/derived/:size`

## Risks and Mitigations
- Large media processing costs: tiered processing and quotas.
- Search relevance: phased rollout with usage feedback.
- Privacy concerns: transparent controls and secure defaults.

## First Areas to Implement (Recommended)

### 1) Project Skeleton and Developer Workflow
Chunk A
- Create `client/` and `server/` workspaces.
- Add linting, formatting, and commit hooks.
- Basic CI pipeline for tests and lint.

Chunk B
- Shared config, environment handling, `.env.example`.
- Docker compose for MongoDB and MinIO (optional).

### 2) Auth and User Baseline
Chunk A
- User schema and auth routes.
- Email+password auth with hashed credentials.

Chunk B
- Session/JWT middleware, refresh strategy.
- Basic profile endpoints.

### 3) Upload Pipeline (Core Value)
Chunk A
- Create upload init/complete endpoints.
- Generate signed upload URLs (S3/MinIO).

Chunk B
- Upload UI, progress tracking, retries.
- Store metadata and link original asset.

### 4) Processing and Library View
Chunk A
- Background job queue and thumbnail worker.
- Store derived assets, update asset status.

Chunk B
- Library API with pagination.
- Virtualized grid and detail viewer.

### 5) Albums and Sharing (Next Core Value)
Chunk A
- Album CRUD and album items.
- UI for create/edit/add/remove.

Chunk B
- Share link generation and access control.
- Shared album view.

## Suggested Next Steps
- Confirm scope: MVP vs full feature parity.
- Choose storage and hosting target (AWS vs self-hosted).
- Decide on search path (Mongo text vs OpenSearch later).
