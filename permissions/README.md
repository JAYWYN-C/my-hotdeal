# Permissions System Documentation

## Overview

The `/permissions/` directory contains access control rules for sensitive files and resources in the Hotdeal project. This system prevents accidental exposure of secrets and enforces security best practices across development, build, and deployment processes.

## File Structure

```
permissions/
├── .env.permissions        # Access control rules for .env file
├── README.md              # This documentation
└── enforcement.js         # (Optional) Runtime enforcement module
```

## Permission Rules Format

Each permission rule follows this format:

```
TARGET  PERMISSION  [CONDITIONS]
```

### Components

- **TARGET**: File or resource path (supports glob patterns)
  - `.env` - exact match
  - `*.env.local` - glob pattern
  - `config/*` - directory pattern

- **PERMISSION**: Action to allow or deny
  - `ALLOW` - permit access
  - `DENY` - block access
  - `LOG` - record access attempt

- **CONDITIONS** (optional): Comma-separated key=value pairs
  - `process=node` - only when Node.js process
  - `ENVIRONMENT=production` - only in production
  - `RUNNER=ubuntu-latest` - specific CI runner
  - `action=read` - specific file operation

## .env File Protection

### Current Rules

The `.env.permissions` file enforces:

1. **Complete Denial**: No direct .env reads/writes by default
2. **Version Control Block**: Git cannot stage/commit .env
3. **AI Agent Restriction**: Claude/Copilot cannot access .env context
4. **Limited Exceptions**: Only Node.js runtime with dotenv can load

### Usage

To view or modify rules:

```bash
# View current rules
cat permissions/.env.permissions

# Edit rules (requires admin access)
nano permissions/.env.permissions
```

## Enforcement Methods

### 1. Git Hooks (Pre-Commit)

Installed in `.git/hooks/pre-commit`:

```bash
# Automatically prevents .env commits
git add .env                    # Blocked by hook
git commit -m "Add config"      # Will fail
```

### 2. Node.js Module Wrapper (Optional)

Create `lib/secure-env.js`:

```javascript
const fs = require('fs');
const path = require('path');

// Override fs.readFileSync for .env protection
const original = fs.readFileSync;
fs.readFileSync = function(file, ...args) {
  const filePath = path.resolve(file);
  if (filePath.endsWith('.env')) {
    throw new Error('❌ Direct .env access denied. Use process.env instead.');
  }
  return original.apply(fs, [file, ...args]);
};

require('dotenv').config();
```

Usage:
```javascript
// In entry point (app.js, index.js, etc.)
require('./lib/secure-env');
```

### 3. IDE/Editor Rules

Add to `.vscode/settings.json`:

```json
{
  "files.exclude": {
    ".env**": true,
    "**/credentials**": true
  },
  "search.exclude": {
    ".env**": true
  },
  "editor.gotoSymbol.skipComments": true
}
```

### 4. CI/CD Integration

For GitHub Actions (`.github/workflows/build.yml`):

```yaml
- name: Verify no .env in artifacts
  run: |
    if git ls-files --cached | grep '\.env'; then
      echo "❌ .env file detected in git"
      exit 1
    fi
```

## Troubleshooting

### "ℹ️ Can't access .env from code"

✅ **Solution**: Use `process.env` with dotenv loader

```javascript
// ❌ Wrong
const apiKey = require('./env').FIREBASE_API_KEY;

// ✅ Correct
require('dotenv').config();
const apiKey = process.env.FIREBASE_API_KEY;
```

### ".env keeps getting staged in git"

✅ **Solution**: Run the pre-commit hook setup

```bash
chmod +x scripts/pre-commit-hook.sh
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
```

### "Need to bypass .env protection for CI/CD"

✅ **Solution**: Use environment variables from secret manager

```bash
# In GitHub Actions secrets
export FIREBASE_API_KEY=${{ secrets.FIREBASE_API_KEY }}
npm run build
```

## Security Checklist

- [ ] `.env` file exists and is gitignored
- [ ] `.env.example` has all required keys
- [ ] Pre-commit hooks are installed and executable
- [ ] `.vscode/settings.json` excludes `.env` from search
- [ ] All team members have copied `.env.example` to `.env`
- [ ] No hardcoded secrets in source code
- [ ] CI/CD uses secret manager, not `.env` file
- [ ] Monthly rotation of all API keys
- [ ] Audit log maintained for credential access

## Updating Permissions

To add new permission rules:

1. Edit `permissions/.env.permissions`
2. Document the change in this README
3. Test the rules locally
4. Commit changes (the .permissions file itself)
5. Notify team of updated restrictions

Example:

```bash
# Allow new CI service
echo "ALLOW process=gitlab-runner ENVIRONMENT=gitlab-ci" >> permissions/.env.permissions
```

## Support

If you encounter permission issues:

1. Check `.env` file exists: `ls -la .env`
2. Verify file permissions: `stat .env` (should show `600` or `rw-------`)
3. Review rules: `cat permissions/.env.permissions`
4. Check git hooks: `ls -la .git/hooks/pre-commit`

For persistent issues, see CLAUDE.md security guidelines.
