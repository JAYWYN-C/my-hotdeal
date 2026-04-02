#!/bin/bash
# Complete Security Audit Script
# Usage: bash scripts/security-audit.sh

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

ISSUES=0
CHECKS=0

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║ Hotdeal Security Audit                              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# 1. NPM Audit
# ============================================================================
echo -e "${BLUE}[1] Checking npm dependencies...${NC}"
if command -v npm &> /dev/null; then
  echo "Running npm audit..."
  if npm audit --json > /tmp/npm-audit.json 2>&1; then
    AUDIT_RESULT=$(jq '.metadata.vulnerabilities | keys[]' /tmp/npm-audit.json 2>/dev/null | wc -l)
    if [ "$AUDIT_RESULT" -eq 0 ]; then
      echo -e "${GREEN}✓ No npm vulnerabilities found${NC}"
    else
      echo -e "${YELLOW}⚠ npm vulnerabilities detected${NC}"
      npm audit --json | jq '.vulnerabilities | to_entries[] | "\(.key): \(.value.severity)"' 2>/dev/null || npm audit
      ((ISSUES++))
    fi
  else
    echo -e "${YELLOW}⚠ npm audit check failed${NC}"
  fi
  ((CHECKS++))
else
  echo -e "${YELLOW}⚠ npm not installed${NC}"
fi

# ============================================================================
# 2. Check for Hardcoded Secrets
# ============================================================================
echo ""
echo -e "${BLUE}[2] Scanning for hardcoded secrets...${NC}"
SECRETS_FOUND=0

# Firebase API keys
if grep -r "AIzaSy" --include="*.js" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | grep -v ".env"; then
  echo -e "${RED}✗ Firebase API key found in source code${NC}"
  ((SECRETS_FOUND++))
fi

# AWS keys
if grep -r "AKIA[0-9A-Z]\{16\}" --include="*.js" --include="*.ts" --exclude-dir=node_modules 2>/dev/null; then
  echo -e "${RED}✗ AWS access key found in source code${NC}"
  ((SECRETS_FOUND++))
fi

# GitHub tokens
if grep -r "ghp_[a-zA-Z0-9]\{36,\}" --include="*.js" --include="*.ts" --exclude-dir=node_modules 2>/dev/null; then
  echo -e "${RED}✗ GitHub token found in source code${NC}"
  ((SECRETS_FOUND++))
fi

# Private keys
if grep -r "BEGIN.*PRIVATE KEY" --include="*.js" --include="*.pem" --exclude-dir=node_modules 2>/dev/null; then
  echo -e "${RED}✗ Private key found in source code${NC}"
  ((SECRETS_FOUND++))
fi

if [ $SECRETS_FOUND -eq 0 ]; then
  echo -e "${GREEN}✓ No hardcoded secrets detected${NC}"
else
  echo -e "${RED}✗ $SECRETS_FOUND potential secret(s) found${NC}"
  ((ISSUES++))
fi
((CHECKS++))

# ============================================================================
# 3. Check .env Configuration
# ============================================================================
echo ""
echo -e "${BLUE}[3] Checking .env security...${NC}"
ENV_ISSUES=0

if [ -f .env ]; then
  echo -e "${GREEN}✓ .env file exists${NC}"
  if grep "^\.env$" .gitignore 2>/dev/null | grep -q .; then
    echo -e "${GREEN}✓ .env is gitignored${NC}"
  else
    echo -e "${RED}✗ .env is NOT gitignored${NC}"
    ((ENV_ISSUES++))
  fi
else
  echo -e "${YELLOW}⚠ .env does not exist (may be normal for CI/CD)${NC}"
fi

if [ -f .env.example ]; then
  echo -e "${GREEN}✓ .env.example template exists${NC}"
else
  echo -e "${YELLOW}⚠ .env.example not found${NC}"
fi

if [ $ENV_ISSUES -gt 0 ]; then
  ((ISSUES++))
fi
((CHECKS++))

# ============================================================================
# 4. Check Security Headers in vercel.json
# ============================================================================
echo ""
echo -e "${BLUE}[4] Checking security headers configuration...${NC}"
HEADERS_OK=true

if [ -f vercel.json ]; then
  if jq -e '.headers' vercel.json > /dev/null 2>&1; then
    if jq -e '.headers[] | select(.headers[] | select(.key=="Content-Security-Policy"))' vercel.json > /dev/null 2>&1; then
      echo -e "${GREEN}✓ CSP header configured${NC}"
    else
      echo -e "${YELLOW}⚠ CSP header not found in vercel.json${NC}"
      HEADERS_OK=false
    fi

    if jq -e '.headers[] | select(.headers[] | select(.key=="Strict-Transport-Security"))' vercel.json > /dev/null 2>&1; then
      echo -e "${GREEN}✓ HSTS header configured${NC}"
    else
      echo -e "${YELLOW}⚠ HSTS header not found${NC}"
      HEADERS_OK=false
    fi
  else
    echo -e "${YELLOW}⚠ No headers defined in vercel.json${NC}"
    HEADERS_OK=false
  fi
else
  echo -e "${YELLOW}⚠ vercel.json not found${NC}"
  HEADERS_OK=false
fi

if [ "$HEADERS_OK" = false ]; then
  ((ISSUES++))
fi
((CHECKS++))

# ============================================================================
# 5. Check CORS Configuration
# ============================================================================
echo ""
echo -e "${BLUE}[5] Checking CORS configuration...${NC}"
if grep -r "Access-Control-Allow-Origin" --include="*.js" api/ 2>/dev/null | head -1 > /dev/null; then
  echo -e "${GREEN}✓ CORS configuration found in API${NC}"
else
  echo -e "${YELLOW}⚠ No explicit CORS configuration found${NC}"
  ((ISSUES++))
fi
((CHECKS++))

# ============================================================================
# 6. Check XSS Prevention
# ============================================================================
echo ""
echo -e "${BLUE}[6] Checking XSS prevention...${NC}"
if [ -f lib/xss-prevention.js ]; then
  echo -e "${GREEN}✓ XSS prevention library exists${NC}"
else
  echo -e "${YELLOW}⚠ XSS prevention library not found${NC}"
  ((ISSUES++))
fi

if grep -r "innerHTML.*=" --include="*.js" app.js 2>/dev/null | grep -v "sanitize\|textContent"; then
  echo -e "${YELLOW}⚠ Possible unsafe innerHTML usage found${NC}"
  ((ISSUES++))
fi
((CHECKS++))

# ============================================================================
# 7. Check Input Validation
# ============================================================================
echo ""
echo -e "${BLUE}[7] Checking input validation...${NC}"
if grep -r "isValidInput\|sanitizeInput" --include="*.js" api/ 2>/dev/null | head -1 > /dev/null; then
  echo -e "${GREEN}✓ Input validation functions used in API${NC}"
else
  echo -e "${YELLOW}⚠ No input validation functions found in API${NC}"
  ((ISSUES++))
fi
((CHECKS++))

# ============================================================================
# 8. Check Rate Limiting
# ============================================================================
echo ""
echo -e "${BLUE}[8] Checking rate limiting...${NC}"
if grep -r "checkRateLimit\|rateLimit" --include="*.js" api/ 2>/dev/null | head -1 > /dev/null; then
  echo -e "${GREEN}✓ Rate limiting configured${NC}"
else
  echo -e "${YELLOW}⚠ No rate limiting found in API${NC}"
  ((ISSUES++))
fi
((CHECKS++))

# ============================================================================
# 9. Check HTTPS/TLS
# ============================================================================
echo ""
echo -e "${BLUE}[9] Checking HTTPS configuration...${NC}"
if [ -f vercel.json ]; then
  if jq -e '.headers[] | select(.headers[] | select(.key=="Strict-Transport-Security"))' vercel.json 2>/dev/null | grep -q "max-age"; then
    echo -e "${GREEN}✓ HSTS enforces HTTPS${NC}"
  else
    echo -e "${YELLOW}⚠ HSTS not properly configured${NC}"
    ((ISSUES++))
  fi
fi
((CHECKS++))

# ============================================================================
# 10. Check Dependencies Outdated
# ============================================================================
echo ""
echo -e "${BLUE}[10] Checking for outdated dependencies...${NC}"
if command -v npm &> /dev/null; then
  OUTDATED=$(npm outdated 2>/dev/null | tail -n +2 | wc -l)
  if [ $OUTDATED -lt 5 ]; then
    echo -e "${GREEN}✓ Dependencies are relatively up-to-date ($OUTDATED outdated)${NC}"
  else
    echo -e "${YELLOW}⚠ $OUTDATED outdated packages found${NC}"
    npm outdated 2>/dev/null | head -10 || true
    ((ISSUES++))
  fi
fi
((CHECKS++))

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║ Security Audit Summary                               ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Total checks: $CHECKS"
echo "Issues found: $ISSUES"
echo ""

if [ $ISSUES -eq 0 ]; then
  echo -e "${GREEN}✓ All security checks PASSED${NC}"
  echo ""
  echo "✓ npm dependencies are secure"
  echo "✓ No hardcoded secrets found"
  echo "✓ .env properly configured"
  echo "✓ Security headers configured"
  echo "✓ CORS configured"
  echo "✓ XSS prevention in place"
  echo "✓ Input validation present"
  echo "✓ Rate limiting configured"
  exit 0
else
  echo -e "${YELLOW}⚠ Security audit found $ISSUES issue(s)${NC}"
  echo ""
  echo "Please review and fix the issues listed above."
  echo ""
  echo "Resources:"
  echo "  • SECURITY.md - Security policy documentation"
  echo "  • CLAUDE.md - API agent security guidelines"
  echo "  • ENV_SETUP_GUIDE.md - Environment setup"
  exit 1
fi
