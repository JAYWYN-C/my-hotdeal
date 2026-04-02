# Hotdeal Project - AI Agent Security Guidelines

## Critical Security Rules

### 🔒 .env File Access Prohibition
**NEVER** directly access, read, display, or modify the `.env` file in any context.

- ❌ **FORBIDDEN:** Reading `.env` file contents
- ❌ **FORBIDDEN:** Displaying API keys or secrets from `.env`
- ❌ **FORBIDDEN:** Modifying `.env` values directly
- ❌ **FORBIDDEN:** Suggesting `.env` changes in code

### ✅ Approved Secure Alternatives
When you need to work with configuration:

1. **Refer to `.env.example`** - Always point users to edit `.env.example` template
2. **Use environment variable names** - Reference `process.env.FIREBASE_API_KEY` syntax, never the actual value
3. **Document setup steps** - Guide users to manually set variables in `.env`
4. **Reference configuration files** - Use `config/` directory for non-secret configs

### 📋 .gitignore Verification
The `.env` file MUST be in `.gitignore`:
```
.env
.env.local
.env.*.local
```

## Code Safety Practices

### Loading Environment Variables
✅ **Correct approach:**
```javascript
const apiKey = process.env.FIREBASE_API_KEY;
```

❌ **Incorrect approach:**
```javascript
const apiKey = "actual-key-12345"; // NEVER hardcode
```

### Logging and Debugging
- NEVER log values of `process.env.FIREBASE_API_KEY` or any secret
- When debugging, mask secrets: `console.log("API Key: " + apiKey.slice(0, 4) + "****")`
- Use structured logging that excludes sensitive fields

### API Credential Leaks
If you detect an API key has been exposed:
1. Immediately report it to the project maintainer
2. Do NOT attempt to revoke or modify it yourself
3. Document the incident for audit trail
4. The key MUST be regenerated outside this environment

## Hook Script Protection

The project includes pre-commit hooks that:
- Block accidental `.env` file commits
- Prevent environment variable exposure in code
- Scan for common secret patterns (AWS keys, API keys, tokens)

**Run these before committing:**
```bash
npm run pre-check  # Runs security scan
```

## Permission Rules

See `/permissions/.env.permissions` for detailed access control rules:
- Deny all direct .env reads for non-build processes
- Allow only config loader functions to access env vars
- Require explicit approval for any env var debug output

## Additional Security Standards

### 1. DEPENDENCY MANAGEMENT (CRITICAL)
- ❌ **FORBIDDEN:** Installing, importing, or recommending external libraries without explicit approval
- ✅ **REQUIRED:** Before proposing a new package: explain necessity, wait for permission, document in package.json
- ✅ **ENFORCE:** Review all `npm install` operations against approved dependencies list

### 2. NO SENSITIVE LOGGING
- ❌ **FORBIDDEN:** Logging statements that output API keys, tokens, passwords, session IDs, or PII
- ✅ **REQUIRED:** Mask secrets in logs: `apiKey.slice(0, 4) + "****"`
- ✅ **ENFORCE:** Audit all `console.log`, `logger.info`, `print` statements for sensitive content

### 3. NO AUTHENTICATION BYPASS
- ❌ **FORBIDDEN:** Mock authentication, hardcoded bypasses, or temporary backdoors
- ✅ **REQUIRED:** All auth flows remain production-ready, never create test bypasses
- ✅ **ENFORCE:** Use proper test doubles (stubs, mocks) that maintain security contracts

### 4. FRONTEND SECURITY & SECRETS
- ❌ **FORBIDDEN:** Hardcoded API keys, tokens, or URLs in client-side code (JS, HTML, CSS)
- ✅ **REQUIRED:** Route all sensitive operations through secure backend API
- ✅ **APPROVED:** Only expose `VITE_PUBLIC_*` or `NEXT_PUBLIC_*` prefixed variables to frontend
- ✅ **ENFORCE:** Backend verifies and validates all API requests (never trust frontend)

### 5. CORS AND SECURITY HEADERS
- ❌ **FORBIDDEN:** Using wildcard `*` for CORS `Access-Control-Allow-Origin` in production
- ✅ **REQUIRED:** Specify exact allowed origins: `['https://jachwi-hotdeal.vercel.app', ...]`
- ✅ **ENFORCE:** Implement strict security headers:
  - `Content-Security-Policy` (CSP) for XSS prevention
  - `X-Frame-Options: DENY` for clickjacking protection
  - `X-Content-Type-Options: nosniff` for MIME type sniffing
  - `Strict-Transport-Security` for HTTPS enforcement
  - `Referrer-Policy: strict-origin-when-cross-origin` for data leakage

### 6. ERROR HANDLING & RATE LIMITING
- ❌ **FORBIDDEN:** "Happy Path" only code without robust error handling
- ✅ **REQUIRED:** Graceful degradation, user-friendly error messages, no stack traces exposed
- ✅ **ENFORCE:** For external APIs:
  - Implement safe timeout limits (e.g., 5-30s)
  - Use exponential backoff for retries (e.g., 100ms, 200ms, 400ms)
  - Never create infinite loops on failure
  - Log errors with context but mask sensitive data
  - Implement rate limiting per IP/user:
    - Basic API: 100 requests/minute
    - Auth API: 10 requests/minute
    - Public endpoints: 1000 requests/hour

### 7. DATABASE & STORAGE SECURITY
- ❌ **FORBIDDEN:** Storing passwords in plaintext; storing unencrypted PII
- ✅ **REQUIRED:** Hash passwords (bcrypt/Argon2), encrypt sensitive data
- ✅ **ENFORCE:** Validate all database queries against SQL injection; use parameterized queries
- ✅ **ENFORCE:** Firestore rules enforce row-level access control

### 8. GIT & VERSION CONTROL
- ❌ **FORBIDDEN:** Committing `.env`, `*.credentials.*`, `*secret*` files
- ✅ **REQUIRED:** All secret files in `.gitignore` with redundant pre-commit hooks
- ✅ **ENFORCE:** Pre-commit hook scans for patterns: API keys, tokens, passwords (see `scripts/check-secrets.sh`)
- ✅ **ENFORCE:** Pre-push hook prevents `.env` from being included in commits

### 9. AUDIT & MONITORING
- ✅ **REQUIRED:** All security-sensitive operations logged:
  - Authentication attempts (success/failure with timestamp, IP, user ID)
  - API access with unusual patterns
  - `.env` access attempts (denied and allowed)
- ✅ **REQUIRED:** Monthly audit of access logs and credential rotation
- ✅ **ENFORCE:** Alert on failed auth attempts, rate limit violations, suspicious patterns

## Compliance Checklist

- [ ] `.env` file is in `.gitignore` with multiple pattern entries
- [ ] All API keys use `process.env.VARIABLE_NAME` references
- [ ] No hardcoded secrets, credentials, or URLs in source code
- [ ] All team members use `.env.example` as template for setup
- [ ] Pre-commit hooks enabled and tested
- [ ] Pre-push hooks verify `.env` not included
- [ ] `.env` file permissions set to `600` (owner read-write only)
- [ ] `.env` passwords/tokens rotated monthly, documented in audit log
- [ ] All dependencies approved and minimized
- [ ] No mock authentication or test backdoors in codebase
- [ ] All external API calls have timeout + exponential backoff
- [ ] Error messages don't expose stack traces or internal paths
- [ ] Frontend has NO hardcoded secrets or private API endpoints
- [ ] CORS restricts to exact allowed origins
- [ ] Security headers configured on server (CSP, HSTS, X-Frame-Options, etc.)
- [ ] Rate limiting implemented across API endpoints
- [ ] Database uses parameterized queries (no SQL injection)
- [ ] Password hashing uses bcrypt with proper cost factor
- [ ] Git hooks scan for credential patterns before commits
- [ ] Audit log maintained and reviewed monthly
