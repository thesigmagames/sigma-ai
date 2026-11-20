# Sigma AI • Security Specification & Payload-First TDD

## 1. Core Data Invariants

1. **Zero Guest Persistence Invariant**: Unauthenticated visitors (`request.auth == null`) NEVER read from or write to Firestore. Guest sessions live exclusively in browser volatile memory.
2. **Strict Owner & Verified Identity Isolation**: Every user document (`users/{userId}`), folder, chat session, and message can ONLY be read, created, updated, or deleted by the authenticated owner (`request.auth.uid == userId` AND `request.auth.token.email_verified == true` AND `incoming().ownerId == request.auth.uid`).
3. **Master Gate Parent Validation**: Messages under `/users/{userId}/chats/{chatId}/messages/{messageId}` MUST validate parent chat existence (`exists(...)`) and ownership on single-document writes.
4. **Temporal & Structural Integrity**: `createdAt` is immutable and strictly equals `request.time` on creation; `updatedAt` strictly equals `request.time` on updates; `keys().hasAll(...)` + `keys().hasOnly(...)` blocks shadow/ghost fields on creation and `affectedKeys().hasOnly(...)` restricts every update action.
5. **Path Variable Poisoning Protection**: Every document ID (`userId`, `folderId`, `chatId`, `messageId`) matches `^[a-zA-Z0-9_\-]+$` with `size() <= 128`.

---

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: `PERMISSION_DENIED`)

1. **Unauthenticated Guest Write** (`auth = null`, `POST /users/guest123/chats/chat1`): Missing authentication fails Master Gate.
2. **Unverified Email Spoofing** (`auth = { uid: "u1", token: { email_verified: false } }`, `SET /users/u1`): Unverified identity fails `isVerifiedUser()`.
3. **Cross-Tenant PII Read** (`auth = u2`, `GET /users/u1`): PII isolation rejects reading another user's profile (`email`, `name`).
4. **Cross-Tenant Chat List Scraping** (`auth = u2`, `LIST /users/u1/chats`): Enforced `resource.data.ownerId == request.auth.uid` rejects cross-user queries.
5. **Identity Spoofing on Chat Create** (`auth = u1`, `SET /users/u1/chats/c1` with `{ ownerId: "u2", ... }`): Rejected by `data.ownerId == request.auth.uid`.
6. **Self-Assigned Admin / Ghost Shadow Field** (`auth = u1`, `SET /users/u1` with `{ ..., isAdmin: true, role: "superadmin" }`): Rejected by `keys().hasOnly(...)`.
7. **ID Poisoning Attack** (`auth = u1`, `SET /users/u1/chats/bad$slash..id`): Rejected by `isValidId(chatId)` (`^[a-zA-Z0-9_\-]+$`).
8. **Backdated Client Timestamp Forgery** (`auth = u1`, `SET /users/u1/chats/c1` with `{ createdAt: Timestamp(2020-01-01) }`): Rejected by `data.createdAt == request.time`.
9. **Immutable Ownership Tampering on Update** (`auth = u1`, `UPDATE /users/u1/chats/c1` changing `ownerId` or `createdAt`): Rejected by `affectedKeys().hasOnly(...)` and `incoming().ownerId == existing().ownerId`.
10. **Oversized Denial-of-Wallet String Injection** (`auth = u1`, `SET /users/u1/chats/c1` with `title` = 5,000 chars or `message.text` = 500,000 chars): Rejected by explicit `.size() <= maxLength` checks.
11. **Invalid Enum / Value Poisoning** (`auth = u1`, `UPDATE /users/u1/chats/c1` with `persona: "hacked_mode"` or `pinned: "yes"`): Rejected by `isValidChatSession(incoming())`.
12. **Orphaned Message Write** (`auth = u1`, `SET /users/u1/chats/nonexistent_chat/messages/m1`): Rejected by `exists(/databases/$(database)/documents/users/$(userId)/chats/$(chatId))`.
