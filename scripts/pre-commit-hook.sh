#!/bin/bash
# Pre-commit hook to prevent accidental .env file commits and secret leaks
# Install: cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

SECRETS_LEAKED=0
ENV_COMMITTED=0

# Check 1: Prevent .env file commits
echo -e "${YELLOW}[Security] Checking for .env file in staged changes...${NC}"
if git diff --cached --name-only | grep -E "^\.env(\.local|\..*\.local)?$"; then
  echo -e "${RED}[ERROR] .env file is about to be committed! This file contains secrets.${NC}"
  echo -e "${RED}Run: git restore --staged .env${NC}"
  ENV_COMMITTED=1
fi

# Check 2: Scan for common secret patterns in staged code
echo -e "${YELLOW}[Security] Scanning for exposed secrets...${NC}"
SECRET_PATTERNS=(
  'FIREBASE_API_KEY=.*[a-zA-Z0-9]{20,}'
  'MAGIC_AUTH_API_KEY=.*[a-zA-Z0-9]{20,}'
  'VERCEL_TOKEN=.*[a-zA-Z0-9]{20,}'
  'GITHUB_TOKEN=.*ghp_[a-zA-Z0-9]{36,}'
  'aws_access_key_id.*AKIA[0-9A-Z]{16}'
  'aws_secret_access_key.*[a-zA-Z0-9/+=]{40}'
  'BEGIN RSA PRIVATE KEY'
  'BEGIN PRIVATE KEY'
  'password.*[= :]["'\''][^"'\''"]+["'\'']'
)

for pattern in "${SECRET_PATTERNS[@]}"; do
  if git diff --cached | grep -iE "$pattern" 2>/dev/null; then
    echo -e "${RED}[ERROR] Potential secret detected: $pattern${NC}"
    SECRETS_LEAKED=1
  fi
done

# Check 3: Verify no hardcoded API keys in .js/.ts files
echo -e "${YELLOW}[Security] Checking for hardcoded API keys in staged files...${NC}"
git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|jsx|tsx)$' | while read file; do
  if git diff --cached "$file" | grep -iE "const.*api.*key.*=.*['\"][a-zA-Z0-9]{20,}['\"]" 2>/dev/null; then
    echo -e "${RED}[ERROR] Hardcoded API key found in $file${NC}"
    SECRETS_LEAKED=1
  fi
done

# Results
if [ $ENV_COMMITTED -ne 0 ] || [ $SECRETS_LEAKED -ne 0 ]; then
  echo ""
  echo -e "${RED}════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}[COMMIT BLOCKED] Security violations detected!${NC}"
  echo -e "${RED}════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "ℹ️  Actions to take:"
  echo -e "  1. ${YELLOW}git restore --staged .env${NC}           (unstage .env if present)"
  echo -e "  2. Remove all hardcoded secrets from code"
  echo -e "  3. Use process.env.VARIABLE_NAME instead"
  echo -e "  4. Keep secrets only in .env file"
  echo ""
  exit 1
fi

echo -e "${GREEN}[✓] Security checks passed - commit allowed${NC}"
exit 0
