**Scope**
- Capture multi-tenant groundwork (tenantId = user id for now).
- Add tag suggestion catalog.
- Add albums with tenant scoping.
- Add left sidebar UI for albums and global actions.

**Decisions**
- `tenantId` exists on all user-scoped objects; for now it equals the user id.
- Tag suggestions are loaded on-demand (e.g., when opening the filter dialog).
- Albums are per-user for now, but also include `tenantId` for future multi-tenant.

**Backend - TenantId**
- Add `tenantId` to all user-scoped schemas (assets, tags, albums, album items).
- Ensure all queries and mutations filter by `tenantId`.
- Backfill `tenantId` on existing data.
- Audit auth middleware to expose `tenantId` (currently user id).

**Backend - Tag Catalog**
- Create `tags` collection with `{ tenantId, key, label, count, lastUsedAt }`.
- Update tag mutations to upsert tag entries and maintain `count`.
- Add endpoint to list tags (for suggestions), filtered by `tenantId`.

**Backend - Albums**
- Create `albums` collection `{ tenantId, name, description?, createdAt }`.
- Create `album_items` collection `{ tenantId, albumId, assetId, createdAt }`.
- Add endpoints: create, rename, delete albums; add/remove assets; list albums; list assets by album.

**Frontend - Filter Tag Suggestions**
- Load tags on filter dialog open.
- Show suggestions under tag input (click to add).

**Frontend - Sidebar**
- Add collapsible left sidebar with Albums and global actions.
- Display albums list, create/delete album actions.

**Frontend - Albums**
- Allow adding/removing selected photos to album.
- Add album filter view (e.g., select album in sidebar to filter grid).

**Open Questions**
- Decide whether `tenantId` should be derived from auth token claims or a new tenant table.
- Decide how to handle tag `count` decrements when removing tags from assets.
