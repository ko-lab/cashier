# Security + GDPR Hardening Plan (Admin Password & PIN Verification)

Last updated: 2026-03-30

## Goals

- Improve authentication security for admin password and member PIN flows.
- Align implementation with GDPR principles (security, minimization, retention, accountability).

---

## 1) Credential & PIN storage

### Requirements

- Never store admin password or member PIN in plaintext.
- Store hashes using **Argon2id** with per-secret random salt.
- Add server-side **pepper** from environment/secrets manager.
- Never return secrets in API responses.
- Never log secrets in plaintext.

### Notes

- Treat PIN as authentication data with password-grade protections.

---

## 2) PIN policy hardening

### Requirements

- Increase minimum PIN length (target: >= 6).
- Reject trivial PINs (e.g. 1234, 1111, 0000, repeated/sequential patterns).
- Keep PIN verification isolated from unrelated identity/profile fields.

### Optional

- Verify PIN once, then issue short-lived verification/session token instead of repeated PIN submission.

---

## 3) Brute-force protections

### Requirements

- Rate-limit verification endpoints by:
  - IP,
  - account/member target,
  - global endpoint bucket.
- Add progressive backoff for repeated failures.
- Add temporary lockout after threshold breaches.
- Return generic auth error messages (no credential validity hints).

---

## 4) Session/auth architecture

### Requirements

- Do not send admin password on each admin request.
- Introduce admin login endpoint and server session.
- Use secure cookie settings:
  - `HttpOnly`
  - `Secure`
  - `SameSite`
- Keep short session TTL and support logout/revocation.
- Add CSRF protection for state-changing admin endpoints.

---

## 5) Transport and secrets hygiene

### Requirements

- Enforce HTTPS in deployment.
- Redact auth fields in logs, errors, telemetry.
- Avoid detailed auth failure messages in responses.

---

## 6) Audit and monitoring

### Requirements

- Log security-relevant events:
  - admin login success/failure,
  - PIN verification success/failure,
  - lockout events,
  - sensitive admin actions (stock set/refill, credit changes, account status changes).
- Protect and restrict audit log access.
- Monitor anomalies (credential stuffing/brute-force patterns).

---

## 7) GDPR mapping

## 7.1 Integrity & confidentiality (Art. 5(1)(f), Art. 32)

- Hashing, session security, access controls, rate limits, and transport security are mandatory controls.

## 7.2 Data minimization (Art. 5(1)(c))

- Store only required auth/security metadata.
- Avoid collecting excessive or indefinite login metadata.

## 7.3 Purpose limitation (Art. 5(1)(b))

- Define and document security/auth purposes for processing.
- Do not reuse security logs for unrelated profiling.

## 7.4 Storage limitation (Art. 5(1)(e))

- Define retention windows:
  - failed auth attempts: e.g. 30–90 days,
  - audit/security logs: e.g. 6–12 months.
- Add automated deletion/aggregation jobs.

## 7.5 Accountability

- Maintain documentation:
  - ROPA entry for auth/security logs,
  - retention policy,
  - incident response process,
  - optional DPIA-lite if risk profile requires it.

---

## 8) Suggested phased delivery

### Phase 1 — Quick wins (short term)

- Argon2id hashing for admin password/PIN.
- Log redaction + generic auth errors.
- Basic rate limiting + lockout.
- Retention policy draft and config placeholders.

### Phase 2 — Auth/session redesign

- Replace password-per-request flow with session-based auth.
- Cookie security + CSRF controls.
- Session timeout/revocation.

### Phase 3 — GDPR operations

- Implement retention jobs.
- Finalize ROPA + policy docs.
- Add periodic audit review checklist.

---

## 9) Open decisions

- Final PIN minimum length.
- Exact lockout thresholds and durations.
- Retention durations by log category.
- Whether MFA is required for admin role.
