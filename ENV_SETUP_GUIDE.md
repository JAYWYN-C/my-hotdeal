# Environment Variable Setup Guide

## Quick Start

### 1. Create Your .env File

```bash
# Copy the template to create your local .env
cp .env.example .env
```

### 2. Fill in Your API Keys

Edit `.env` with your actual credentials:

```bash
nano .env
# or
vim .env
```

Replace all `${VARIABLE_NAME}` placeholders with actual values.

### 3. Install Security Hooks

```bash
# Make the hook script executable
chmod +x scripts/pre-commit-hook.sh

# Install the pre-commit hook
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### 4. Verify Setup

```bash
# Check that .env is in .gitignore
grep "^\.env$" .gitignore

# Check git hook is installed
ls -la .git/hooks/pre-commit

# Test that .env is protected
git add .env 2>&1  # Should succeed in staging
git commit -m "test" 2>&1  # Should be BLOCKED by hook
git reset HEAD .env  # Unstage it
```

---

## Environment Variables Reference

### Firebase Configuration

**Where to get these values:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **Settings** (gear icon) → **Project Settings**
4. Find under **General** or **Service Accounts**

```
FIREBASE_API_KEY=AIzaSyD...           # From config snippet in Firebase Console
FIREBASE_AUTH_DOMAIN=hotdeal-xxxx.firebaseapp.com
FIREBASE_PROJECT_ID=hotdeal-xxxx
FIREBASE_STORAGE_BUCKET=hotdeal-xxxx.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcd1234...
```

### Magic Link Authentication (Passwordless Login)

**Where to get these:**

1. Go to [Magic Dashboard](https://dashboard.magic.link/)
2. Select your app
3. Copy API keys from **Setup** → **API Keys**

```
MAGIC_AUTH_API_KEY=pk_live_xxxxxxxxx    # Publishable key
MAGIC_AUTH_ENDPOINT=https://api.magic.link/v1/...
```

### Scraping/Data Collection API

**If using a third-party scraper service:**

```
SCRAPER_API_KEY=xxx-yyy-zzz            # From service dashboard
SCRAPER_ENDPOINT=https://api.scraper.io/scrape
```

### Vercel Deployment

**Generate token:**

```bash
vercel login
vercel token create --read-only hotdeal
```

Copy the token to `VERCEL_TOKEN`

### GitHub Actions Integration

**Generate token:**

```bash
# Go to https://github.com/settings/tokens
# Create new token with:
#   ✓ repo (full access to private repos)
#   ✓ workflow (update GitHub Actions workflows)
#   ✓ admin:repo_hook
```

Copy the token to `GITHUB_TOKEN`

---

## Security Best Practices

### ✅ DO

- ✅ Keep `.env` file **local only** (never commit)
- ✅ Use strong, unique API keys for each service
- ✅ Rotate API keys **monthly**
- ✅ Use `process.env.VARIABLE_NAME` in code
- ✅ Load env vars **once** at application startup
- ✅ Verify hook script is **installed and executable**
- ✅ Share `.env.example` with team, NOT actual `.env`

### ❌ DON'T

- ❌ Commit `.env` file to git
- ❌ Hardcode API keys in source code
- ❌ Send `.env` file via email or chat
- ❌ Log environment variables
- ❌ Share `.env` file with external parties
- ❌ Use same API key in dev and production
- ❌ Disable pre-commit hooks
- ❌ Post `.env` content in error reports

---

## Loading Environment Variables in Code

### Setup at Application Entry Point

**app.js or index.js:**

```javascript
// Load environment variables FIRST
require('dotenv').config();

// Then import other modules
const firebase = require('firebase/app');
const express = require('express');

// Access variables via process.env
const apiKey = process.env.FIREBASE_API_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID;

firebase.initializeApp({
  apiKey: apiKey,
  projectId: projectId,
  // ... other config
});
```

### For Browser/Client-Side

```html
<script>
  // ❌ NEVER expose secrets on frontend
  // The following is WRONG:
  // const key = "ahd3kdk3kd3k"; // DON'T DO THIS

  // ✅ CORRECT: Backend API loads sensitivity
  fetch('/api/config')
    .then(r => r.json())
    .then(config => {
      console.log(config.publicKey); // Only safe data
    });
</script>
```

**Backend endpoint:**

```javascript
app.get('/api/config', (req, res) => {
  res.json({
    publicKey: process.env.PUBLIC_KEY,
    // ❌ NEVER send SECRET keys to frontend
  });
});
```

---

## Deployment Setup

### Vercel

1. Go to Vercel dashboard → Project settings
2. Navigate to **Environment Variables**
3. Add each variable from `.env`:
   - Name: `FIREBASE_API_KEY`
   - Value: (paste from your `.env`)
   - Environments: `Production, Preview, Development`

### GitHub Actions

1. Go to repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add secrets matching `.env` variable names

Workflow file (`.github/workflows/deploy.yml`):

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run build
        env:
          FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
          # ... other secrets
```

---

## Troubleshooting

### ".env not found" Error

```bash
# Solution: Create .env from template
cp .env.example .env
```

### "Cannot find module 'dotenv'"

```bash
# Solution: Install dotenv package
npm install dotenv
```

### "process.env.VARIABLE_NAME is undefined"

**Check:**

1. Is `.env` file created? `ls -la .env`
2. Is variable in `.env`? `grep VARIABLE_NAME .env`
3. Did you call `require('dotenv').config()` first?
4. Restart dev server after editing `.env`

### Pre-commit Hook Not Blocking .env

```bash
# Solution: Reinstall and set permissions
chmod +x scripts/pre-commit-hook.sh
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Verify
ls -la .git/hooks/pre-commit  # Should show +x flag
```

### "Hook script permission denied"

```bash
# Solution: Make hook executable
chmod +x .git/hooks/pre-commit
```

---

## Rotating API Keys

Set calendar reminder for **1st of each month**:

1. **Firebase**: Go to console → Service Accounts → Create new key
2. **Magic Link**: Dashboard → Settings → Regenerate keys
3. **Vercel**: Dashboard → Settings → Tokens → Remove old → Create new
4. **GitHub**: Settings → Personal access tokens → Delete old → Create new
5. Update `.env` with new keys
6. Restart all services

---

## Emergency: Leaked API Key

If you suspect an API key has been leaked:

1. 🚨 **Stop**: Do NOT commit or push anything
2. 🔍 **Revoke**: Go to service (Firebase, Magic, etc.) and disable the key
3. 🔑 **Generate**: Create new key in service dashboard
4. 📝 **Update**: Edit `.env` with new key
5. 🔄 **Restart**: Restart dev server and redeploy
6. 📋 **Report**: Inform project maintainer/team
7. 📊 **Audit**: Check logs for unauthorized access

---

## See Also

- [CLAUDE.md](../CLAUDE.md) - AI agent security guidelines
- [permissions/README.md](../permissions/README.md) - Permission system documentation
- [.env.permissions](../permissions/.env.permissions) - Detailed access control rules
