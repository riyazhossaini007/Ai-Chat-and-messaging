# Admin Dashboard API

## Auth

All endpoints require `Authorization: Bearer <jwt>`.

## Sample requests

### Overview stats

```bash
curl "$API_URL/admin/stats/overview?from=2026-02-15T00:00:00.000Z&to=2026-02-22T23:59:59.999Z" \
  -H "Authorization: Bearer $TOKEN"
```

### List users

```bash
curl "$API_URL/admin/users?q=john&status=ACTIVE&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Ban user

```bash
curl -X POST "$API_URL/admin/moderation/ban-user" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<USER_ID>","reason":"spam"}'
```

### Grant complimentary access

```bash
curl -X POST "$API_URL/admin/entitlements/grant" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<USER_ID>","featureKey":"PRO_ACCESS","reason":"support"}'
```

### Call stats

```bash
curl "$API_URL/admin/calls/stats?from=2026-02-15T00:00:00.000Z&to=2026-02-22T23:59:59.999Z" \
  -H "Authorization: Bearer $TOKEN"
```

