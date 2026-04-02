#!/bin/bash
# Security verification script for Hotdeal project
# Usage: ./scripts/verify-env-security.sh

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

WARNINGS=0
ERRORS=0
CHECKS=0

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║ Hotdeal Environment Security Verification             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Helper functions
pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((CHECKS++))
}

fail() {
  echo -e "${RED}✗ [ERROR] $1${NC}"
  ((ERRORS++))
  ((CHECKS++))
}

warn() {
  echo -e "${YELLOW}⚠ [WARNING] $1${NC}"
  ((WARNINGS++))
  ((CHECKS++))
}

# ============================================================================
# CHECK 1: .env File Exists
# ============================================================================
echo -e "${BLUE}[1] Checking .env file...${NC}"
if [ -f .env ]; then
  pass ".env file exists"
  ENV_PERMS=$(stat -f%OLp .env 2>/dev/null || stat -c %a .env 2>/dev/null || echo "unknown")
  if [[ "$ENV_PERMS" == *"600"* ]] || [[ "$ENV_PERMS" == *"rw"* ]]; then
    pass ".env has restrictive permissions ($ENV_PERMS)"
  else
    warn ".env permissions are $ENV_PERMS (should be 600 or rw-------)"
  fi
else
  fail ".env file not found (run: cp .env.example .env)"
fi

# ============================================================================
# CHECK 2: .env.example Exists
# ============================================================================
echo ""
echo -e "${BLUE}[2] Checking .env.example...${NC}"
if [ -f .env.example ]; then
  pass ".env.example exists"
else
  fail ".env.example not found"
fi

# ============================================================================
# CHECK 3: .gitignore Configuration
# ============================================================================
echo ""
echo -e "${BLUE}[3] Checking .gitignore...${NC}"
if grep -q "^\.env$" .gitignore 2>/dev/null; then
  pass ".env is in .gitignore"
else
  fail ".env is NOT in .gitignore"
fi

if grep -q "\.env\..*local" .gitignore 2>/dev/null; then
  pass ".env.*.local is in .gitignore"
else
  warn ".env.*.local patterns not in .gitignore"
fi

if grep -q "*credentials*" .gitignore 2>/dev/null; then
  pass "Credential files (*credentials*) are in .gitignore"
else
  warn "Credential files pattern not in .gitignore"
fi

# ============================================================================
# CHECK 4: Pre-commit Hook
# ============================================================================
echo ""
echo -e "${BLUE}[4] Checking pre-commit hook...${NC}"
if [ -f .git/hooks/pre-commit ]; then
  pass "Pre-commit hook exists"
  
  if [ -x .git/hooks/pre-commit ]; then
    pass "Pre-commit hook is executable"
  else
    fail "Pre-commit hook is NOT executable (run: chmod +x .git/hooks/pre-commit)"
  fi
  
  if grep -q "CUSTOM_DEALS_STORAGE_KEY" .git/hooks/pre-commit 2>/dev/null || \
     grep -q "SECRET_PATTERNS" .git/hooks/pre-commit 2>/dev/null; then
    pass "Pre-commit hook includes secret scanning"
  else
    warn "Pre-commit hook may not include secret scanning"
  fi
else
  fail "Pre-commit hook not found (run: cp scripts/pre-commit-hook.sh .git/hooks/pre-commit)"
fi

# ============================================================================
# CHECK 5: Permissions Directory
# ============================================================================
echo ""
echo -e "${BLUE}[5] Checking permissions directory...${NC}"
if [ -d permissions ]; then
  pass "permissions/ directory exists"
  
  if [ -f permissions/.env.permissions ]; then
    pass "permissions/.env.permissions exists"
  else
    fail "permissions/.env.permissions not found"
  fi
  
  if [ -f permissions/README.md ]; then
    pass "permissions/README.md exists"
  else
    warn "permissions/README.md not found"
  fi
else
  fail "permissions/ directory not found"
fi

# ============================================================================
# CHECK 6: Security Documentation
# ============================================================================
echo ""
echo -e "${BLUE}[6] Checking security documentation...${NC}"
if [ -f CLAUDE.md ]; then
  pass "CLAUDE.md exists"
  
  if grep -q ".env.*forbidden\|.env.*forbidden\|NEVER.*\.env" CLAUDE.md 2>/dev/null; then
    pass "CLAUDE.md includes .env access restrictions"
  else
    warn "CLAUDE.md may not clearly prohibit .env access"
  fi
else
  fail "CLAUDE.md not found"
fi

if [ -f ENV_SETUP_GUIDE.md ]; then
  pass "ENV_SETUP_GUIDE.md exists"
else
  warn "ENV_SETUP_GUIDE.md not found"
fi

# ============================================================================
# CHECK 7: No Hardcoded Secrets in Source Code
# ============================================================================
echo ""
echo -e "${BLUE}[7] Scanning for hardcoded secrets...${NC}"
SECRETS_FOUND=0

# Check for Firebase API keys hardcoded
if grep -r "AIzaSy" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v ".env" | grep -v ".example"; then
  warn "Potential Firebase API key found in source code"
  ((SECRETS_FOUND++))
fi

# Check for AWS keys
if grep -r "AKIA[0-9A-Z]\{16\}" --include="*.js" --include="*.ts" 2>/dev/null | grep -v node_modules; then
  warn "Potential AWS access key found in source code"
  ((SECRETS_FOUND++))
fi

# Check for GitHub tokens
if grep -r "ghp_[a-zA-Z0-9]\{36,\}" --include="*.js" --include="*.ts" 2>/dev/null | grep -v node_modules; then
  warn "Potential GitHub token found in source code"
  ((SECRETS_FOUND++))
fi

if [ $SECRETS_FOUND -eq 0 ]; then
  pass "No obvious hardcoded secrets detected"
else
  fail "$SECRETS_FOUND potential secrets found in source code"
fi

# ============================================================================
# CHECK 8: Environment Variables Usage
# ============================================================================
echo ""
echo -e "${BLUE}[8] Checking environment variable usage...${NC}"
if grep -r "process\.env\." --include="*.js" --include="*.ts" app.js 2>/dev/null | head -3 > /dev/null; then
  pass "process.env usage found in code"
else
  warn "No process.env usage found (verify dotenv is being used)"
fi

# ============================================================================
# CHECK 9: Git Status
# ============================================================================
echo ""
echo -e "${BLUE}[9] Checking git status...${NC}"
if git ls-files --cached | grep "\.env" | grep -v "\.env\.example"; then
  fail ".env file is staged in git (run: git restore --staged .env)"
else
  pass ".env is not staged in git"
fi

if git log --all --oneline | grep -i "add.*env\|env.*key\|api.*key" 2>/dev/null | head -3 > /dev/null; then
  warn "Git history contains commits about environment setup"
else
  pass "No suspicious environment commits in git history"
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║ Summary                                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

PASSED=$((CHECKS - ERRORS - WARNINGS))
echo -e "Total checks:     ${BLUE}$CHECKS${NC}"
echo -e "Passed:           ${GREEN}$PASSED${NC}"
echo -e "Warnings:         ${YELLOW}$WARNINGS${NC}"
echo -e "Errors:           ${RED}$ERRORS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✓ Security verification PASSED${NC}"
  echo ""
  echo "Your environment is properly secured:"
  echo "  • .env file is created and gitignored"
  echo "  • Pre-commit hooks are installed"
  echo "  • No hardcoded secrets detected"
  echo "  • Permission rules are in place"
  exit 0
else
  echo -e "${RED}✗ Security verification FAILED${NC}"
  echo ""
  echo "Please fix the errors above before committing code."
  echo ""
  echo "Quick fixes:"
  echo "  1. cp .env.example .env"
  echo "  2. chmod +x scripts/pre-commit-hook.sh"
  echo "  3. cp scripts/pre-commit-hook.sh .git/hooks/pre-commit"
  echo "  4. git restore --staged .env"
  exit 1
fi
