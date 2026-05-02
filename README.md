# Admin Dashboard Backend + Frontend Integration

## Promote a user to ADMIN

### Option 1: seed/create a dev admin user

```bash
cd server
node -r ts-node/register scripts/seed_admin_user.ts
```

Environment overrides:

- `ADMIN_SEED_USERNAME`
- `ADMIN_SEED_PHONE`
- `ADMIN_SEED_PASSWORD`
- `ADMIN_SEED_NAME`

### Option 2: update existing user (SQL)

```sql
UPDATE "User" SET "role" = 'ADMIN', "status" = 'ACTIVE' WHERE "id" = '<USER_ID>';
```

Also ensure RBAC `UserRole` contains `ADMIN` if you rely on permission-gated admin screens.

## Grant Complimentary PRO_ACCESS

```bash
curl -X POST "$API_URL/admin/entitlements/grant" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"<USER_ID>",
    "featureKey":"PRO_ACCESS",
    "reason":"manual complimentary access"
  }'
```

## Admin API endpoints (high-level)

- `GET /admin/stats/overview`
- `GET /admin/users`
- `GET /admin/users/:id`
- `PATCH /admin/users/:id/role`
- `PATCH /admin/users/:id/status`
- `PATCH /admin/users/:id/note`
- `GET /admin/entitlements`
- `POST /admin/entitlements/grant`
- `POST /admin/entitlements/revoke`
- `GET /admin/ai/usage`
- `GET /admin/ai/users/top`
- `GET /admin/reports`
- `GET /admin/reports/:id`
- `PATCH /admin/reports/:id/status`
- `POST /admin/moderation/ban-user`
- `POST /admin/moderation/remove-message`
- `GET /admin/groups`
- `GET /admin/groups/:id`
- `PATCH /admin/groups/:id/freeze`
- `DELETE /admin/groups/:id`
- `GET /admin/calls`
- `GET /admin/calls/:id`
- `GET /admin/calls/stats`
- `GET /admin/health`

See `docs/ADMIN_DASHBOARD_API.md` for sample requests.

