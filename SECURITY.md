# Security Architecture — Pumpchain Network

This document describes the security measures implemented in the Pumpchain Network prototype and known limitations.

## Classification

**This is a TESTNET PROTOTYPE.** It is NOT a production system, NOT a trustless bridge, and NOT an independent Solana L2. It demonstrates the architecture of an SVM-inspired Layer-2 execution network.

---

## Security Measures Implemented

### 1. No Private Key Storage

- Private keys are NEVER stored on the backend or in the database.
- No seed phrases are requested from users.
- All wallet signing happens client-side via Solana Wallet Adapter.
- The frontend never transmits private keys to any server.

### 2. Input Validation (Zod)

All API inputs are validated with strict Zod schemas before processing:

- **Addresses**: Base58 format, 32-44 characters, regex validated.
- **Amounts**: Non-negative integer strings only. No floats. No decimals. Max 78 digits.
- **Nonces**: Non-negative integers, max 2,147,483,647.
- **Gas limits**: Positive integers, capped at 50,000,000.
- **Gas price**: Non-negative integers, capped at 1,000,000.
- **Input data**: Max 10,000 characters, HTML stripped.
- **Signatures**: Non-empty strings, max 256 characters.

### 3. Integer Arithmetic

- All token amounts use `BigInt` (JavaScript) and `numeric(78,0)` (PostgreSQL).
- No floating point arithmetic for monetary values.
- Prevents rounding errors, precision loss, and overflow.

### 4. Rate Limiting

| Scope | Limit |
|-------|-------|
| Global API | 200 requests/minute/IP |
| Faucet | 5 requests/minute/IP |
| JSON-RPC | 100 requests/minute/IP |

Rate limits use in-memory counters with automatic cleanup.

### 5. Request Size Limits

- JSON body: max 100KB
- URL-encoded body: max 100KB
- String fields: max 10,000 characters
- Prevents payload-based DoS attacks.

### 6. CORS

- Configured to allow only the specific frontend origin.
- Restricted methods: GET, POST only.
- Restricted headers: Content-Type, Authorization only.

### 7. Security Headers (Helmet)

Helmet applies:
- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security
- X-XSS-Protection

### 8. Input Sanitization

- All string inputs are stripped of HTML tags.
- Whitespace is trimmed.
- Strings are truncated at 10,000 characters.
- Applied globally via middleware before route handlers.

### 9. SQL Injection Prevention

- All database queries use Drizzle ORM's parameterized query builder.
- No raw SQL string interpolation anywhere in the codebase.
- All user inputs go through ORM parameter binding.

### 10. IP Privacy

- IP addresses are NEVER stored raw in the database.
- IPs are hashed with SHA-256 (salted: `pumpchain_faucet:{ip}`) before storage.
- Used only for rate limiting, not identification.

### 11. Transaction Security

| Protection | Implementation |
|-----------|----------------|
| Negative amounts | Rejected by Zod schema + validation service |
| Integer overflow | 78-digit max enforced at schema level |
| Duplicate transactions | ExecutionMutex tracks executed hashes |
| Nonce replay | Sequential nonce validation per account |
| Double execution | Mutex lock + executed set prevents re-processing |
| Race conditions | Single-threaded execution lock during tx processing |
| Self-transfer | Rejected when sender === recipient for transfers |
| Insufficient balance | Checked at validation AND execution time |

### 12. Faucet Abuse Prevention

- 24-hour cooldown per wallet address.
- Per-IP rate limiting (hashed IPs).
- 5 requests/minute hard limit per IP.
- Claims persisted to PostgreSQL (idempotent checks).

### 13. Bridge Security

- Bridge operations are verified against Solana Devnet RPC.
- No backend-controlled keys are used for signing.
- All bridge operations are recorded in PostgreSQL with full audit trail.
- **IMPORTANT**: This is NOT a trustless bridge. It is a testnet prototype.

### 14. Environment Variables

- `DATABASE_URL` is backend-only, never exposed to frontend.
- Frontend only receives `VITE_`-prefixed public configuration.
- No secrets in version control (`.env` is gitignored).

### 15. Logging

- Request logging via Morgan (method, URL, status, time only).
- RPC logging redacts signatures: `signature → [REDACTED]`.
- Never logs request bodies (which may contain signatures).
- Never logs database credentials or environment secrets.

---

## Known Prototype Limitations

These are inherent to the testnet prototype nature of this project:

1. **Not a production bridge** — Bridge operations are simulated. No actual trustless verification exists.
2. **In-memory state** — Block/transaction state lives in memory and is lost on restart. PostgreSQL provides persistence for some data.
3. **Single sequencer** — No BFT consensus, no validator network. Single-process block production.
4. **No real cryptographic signatures** — Transaction signatures are placeholder strings, not Ed25519 verified.
5. **No MEV protection** — Transaction ordering is FIFO/deterministic but not MEV-resistant.
6. **Rate limiting is in-memory** — Resets on server restart. Production would use Redis.
7. **testnet tokens only** — tPUMP has no real-world value. This is by design.

---

## Dependency Audit

Last audit: Run via `npm audit --workspace=backend`

Known upstream vulnerabilities exist in `@solana/web3.js` dependency tree (jayson, ws transitive deps). These are:
- Not exploitable in our usage pattern (server-side only, no user-controlled WebSocket URLs)
- Inherited from the official Solana SDK
- Would be resolved by upgrading to `@solana/web3.js` v2 when stable

---

## Reporting Security Issues

This is a prototype/educational project. If you find a security issue:
1. Do NOT use it in a production environment.
2. Open an issue describing the vulnerability.
3. All testnet tokens have zero monetary value.

---

## Security Checklist

- [x] No private key storage
- [x] No seed phrase requests
- [x] No unnecessary signature logging
- [x] DATABASE_URL not exposed
- [x] All API input validated (Zod)
- [x] CORS configured
- [x] Helmet security headers
- [x] API rate limiting
- [x] Request size limits
- [x] Input sanitization
- [x] Faucet abuse prevention
- [x] IP addresses hashed
- [x] SQL injection prevented (ORM)
- [x] Duplicate transactions prevented
- [x] Nonce validation
- [x] Negative amounts prevented
- [x] Integer overflow prevented
- [x] BigInt arithmetic for tokens
- [x] Race condition guards (mutex)
- [x] Double-execution prevention
- [x] Bridge disclaimers present
- [x] Secrets in env vars only
