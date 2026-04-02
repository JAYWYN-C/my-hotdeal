#!/bin/bash
# Pre-commit hook: Prevent accidental commit of .env files and secrets
# This script runs automatically when you try to commit

set -e

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Track if any secrets found
SECRETS_FOUND=0

echo -e "${YELLOW}🔒 Security Check: Scanning for secrets...${NC}"

# ============================================================================
# Check 1: Prevent .env files from being committed
# ============================================================================
echo ""
echo "📋 Check 1: Scanning for .env files..."

ENV_FILES=$(git diff --cached --name-only | grep -E '\.env($|\..*\.local$)' || true)
if [ -n "$ENV_FILES" ]; then
    echo -e "${RED}❌ BLOCKED: The following .env files are staged for commit:${NC}"
    echo "$ENV_FILES" | sed 's/^/   /'
    echo -e "${RED}To fix: git rm --cached <filename>${NC}"
    SECRETS_FOUND=1
fi

# ============================================================================
# Check 2: Scan staged files for common credential patterns
# ============================================================================
echo ""
echo "📋 Check 2: Scanning for credential patterns..."

# Patterns to search for
PATTERNS=(
    'FIREBASE_API_KEY.*[:=].*["\047]'
    'api_key.*[:=].*["\047]'
    'API_KEY.*[:=].*sk-'
    'VERCEL_TOKEN.*[:=].*["\047]'
    'GITHUB_TOKEN.*[:=].*ghp_'
    'password.*[:=].*["\047]'
    'secret.*[:=].*["\047]'
    'PRIVATE KEY'
    'RSA PRIVATE KEY'
    'BEGIN CERTIFICATE'
)

FOUND_SECRETS=""
for pattern in "${PATTERNS[@]}"; do
    found=$(git diff --cached -i --no-color -- '*.js' '*.py' '*.json' 2>/dev/null | \
            grep -i -- "$pattern" || true)
    if [ -n "$found" ]; then
        FOUND_SECRETS="$FOUND_SECRETS
$found"
        SECRETS_FOUND=1
    fi
done

if [ -n "$FOUND_SECRETS" ]; then
    echo -e "${RED}❌ BLOCKED: Suspected credential patterns found in staged files:${NC}"
    echo "$FOUND_SECRETS" | head -20 | sed 's/^/   /'
    echo -e "${RED}To fix: Review and remove secrets, then re-stage files${NC}"
fi

# ============================================================================
# Check 3: Verify .env is not included in staged changes
# ============================================================================
echo ""
echo "📋 Check 3: Verifying .gitignore compliance..."

UNTRACKED_ENV=$(git ls-files --others --exclude-standard | grep -E '\.env($|\..*\.local$)' || true)
if [ -n "$UNTRACKED_ENV" ]; then
    echo -e "${YELLOW}⚠️  WARNING: Untracked .env files detected:${NC}"
    echo "$UNTRACKED_ENV" | sed 's/^/   /'
    echo "   (These are not in .gitignore. Add them or delete them.)"
    # This is a warning, not a blocker
fi

# Check 4: Verify credentials.json files
echo ""
echo "📋 Check 4: Scanning for credentials files..."

CRED_FILES=$(git diff --cached --name-only | grep -E 'firebase-credentials|\.credentials\.|\.secret\.' | grep -v check-secrets | grep -v scripts || true)
if [ -n "$CRED_FILES" ]; then
    echo -e "${RED}❌ BLOCKED: Credential files detected:${NC}"
    echo "$CRED_FILES" | sed 's/^/   /'
    SECRETS_FOUND=1
fi

# ============================================================================
# Final Result
# ============================================================================
echo ""
if [ $SECRETS_FOUND -eq 1 ]; then
    echo -e "${RED}❌ COMMIT BLOCKED: Security issues found${NC}"
    echo ""
    echo "🔒 Security Guidelines:"
    echo "   1. NEVER commit .env files (add to .gitignore)"
    echo "   2. NEVER hardcode API keys, tokens, or passwords"
    echo "   3. Use environment variables: process.env.YOUR_KEY"
    echo "   4. Store sensitive data in GitHub Secrets or Vercel secrets"
    echo "   5. For testing, use .env.example as a template"
    echo ""
    echo "💡 To override (NOT RECOMMENDED): git commit --no-verify"
    echo ""
    exit 1
else
    echo -e "${GREEN}✅ Security check passed: No secrets detected${NC}"
    exit 0
fi
