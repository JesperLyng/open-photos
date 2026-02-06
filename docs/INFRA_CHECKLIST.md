# Infrastructure Checklist (Scaleway)

## Account and Regions
- [ ] Create Scaleway account and choose `fr-par` as primary region.
- [ ] Create project and workspace.

## Object Storage
- [ ] Create bucket for originals (private).
- [ ] Create bucket for derived assets (private, CDN later).
- [ ] Create IAM app and access keys with least privilege.
- [ ] Define lifecycle rules (e.g., keep originals, tier derived if needed).

## Managed MongoDB
- [ ] Create MongoDB instance in `fr-par`.
- [ ] Configure network access (allow API/worker origins).
- [ ] Create DB user with least privilege.
- [ ] Backups enabled and retention set.

## Serverless Functions
- [ ] Create functions namespace.
- [ ] Configure env vars for DB and storage.
- [ ] Set secrets for access keys.
- [ ] Configure logs and alerting.

## DNS and TLS
- [ ] Choose domain and set DNS.
- [ ] TLS via provider or reverse proxy.

## Observability
- [ ] Log aggregation and alerting for failed jobs.
- [ ] Metrics for upload throughput, failures, processing time.

## Cost Controls
- [ ] Storage quotas and user-level caps.
- [ ] Alert thresholds for storage and compute.
