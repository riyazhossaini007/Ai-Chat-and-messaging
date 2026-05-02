# Reliability Rollout Playbook

## Zero-Downtime Migration Strategy

Use `expand -> migrate -> contract` for all schema changes.

1. Expand
- Add nullable columns/tables first.
- Add non-blocking indexes.
- Do not drop or rename old fields.

2. Migrate
- Deploy code that reads/writes both old and new fields (dual-write where needed).
- Backfill in batches.
- Keep compatibility with previous app version.

3. Contract
- Remove legacy fields in a separate deployment only after verification.

## Backfill Rules
- Batch size default: 1,000 rows.
- Persist progress cursor in `SystemConfig`.
- Backfills must be resumable and throttled.

## Rollback Rules
- Keep feature flags to disable new behavior instantly:
  - `FEATURE_AI_RELIABILITY`
  - `FEATURE_BG_QUEUE`
- Rollback app version must still run with expanded schema.
- Never release code that requires a field introduced in same deploy without fallback.

## Migration Version Tracking
- `SystemConfig` key: `MIGRATION_VERSION`.
- Update this during bootstrap/deploy validation.

