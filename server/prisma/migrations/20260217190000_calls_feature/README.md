Migration notes for calling feature:

1. Update schema:
   - Added `CallSession`, `CallParticipant`, `CallEvent`, `UserSubscription`.
   - Added SFU fields on `CallSession`: `sfuProvider`, `roomName`, `hostUserId`.
   - Added call enums: `CallType`, `CallStatus`, `CallParticipantRole`, `CallParticipantStatus`.
   - Added `SfuProvider` enum (`NONE|LIVEKIT|MEDIASOUP`).
   - Added `UserSubscriptionStatus`.
   - Added new relations on `User` and `Chat`.

2. Generate migration locally:
   - `cd server`
   - `npx prisma migrate dev --name calls_feature`

3. Production deploy:
   - `npx prisma migrate deploy`

4. Regenerate Prisma client after migration:
   - `npx prisma generate`

5. Seed/ensure paid users in `UserSubscription`:
   - `status = active` and `validUntil > now()` to pass paid gating.
