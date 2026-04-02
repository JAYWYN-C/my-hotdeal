#!/bin/bash
# Pre-push hook: Verify .env files won't be pushed to remote
# This script runs when you try to push to remote repository

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Pre-Push Security Check: Verifying .env safety...${NC}"

# Get the current branch and remote
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
REMOTE=${1:-origin}

echo ""
echo "📋 Checking commits that will be pushed to: $REMOTE/$CURRENT_BRANCH"

# ============================================================================
# Check 1: Verify .env files are NOT in commits to be pushed
# ============================================================================
echo ""
echo "Check 1: Scanning for .env files in commits..."

ENV_IN_COMMITS=$(git diff --name-only "$REMOTE/$CURRENT_BRANCH...HEAD" | grep -E '\.env($|\..*\.local$)' || true)

if [ -n "$ENV_IN_COMMITS" ]; then
    echo -e "${RED}❌ BLOCKED: .env files detected in commits to push:${NC}"
    echo "$ENV_IN_COMMITS" | sed 's/^/   /'
    echo ""
    echo -e "${RED}DO NOT PUSH: .env files should never be in version control!${NC}"
    echo ""
    echo "To fix:"
    echo "   1. git reset HEAD~1  (unstage the commit)"
    echo "   2. Verify .env is in .gitignore"
    echo "   3. Verify the commit does not contain .env content"
    echo ""
    exit 1
fi

# ============================================================================
# Check 2: Scan commit content for hardcoded secrets
# ============================================================================
echo ""
echo "Check 2: Scanning commits for hardcoded secrets..."

DANGEROUS_PATTERNS=(
    'FIREBASE_API_KEY\s*[:=]\s*["\047][^"\047]+["\047]'
    'VERCEL_TOKEN\s*[:=]\s*["\047][^"\047]+["\047]'
    'GITHUB_TOKEN\s*[:=]\s*["\047]ghp_[a-zA-Z0-9]+["\047]'
    'api.key\s*[:=]\s*["\047][^"\047]+["\047]'
    'sk-[a-zA-Z0-9]{40,}'
    'BEGIN PRIVATE KEY'
)

FOUND_SECRETS=0
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    secrets=$(git diff "$REMOTE/$CURRENT_BRANCH...HEAD" -i | grep -E "$pattern" || true)
    if [ -n "$secrets" ]; then
        if [ $FOUND_SECRETS -eq 0 ]; then
            echo -e "${RED}❌ BLOCKED: Hardcoded secrets detected in commits:${NC}"
            FOUND_SECRETS=1
        fi
        echo "$secrets" | head -3 | sed 's/^/   /'
    fi
done

if [ $FOUND_SECRETS -eq 1 ]; then
    echo ""
    echo -e "${RED}DO NOT PUSH: Remove secrets and amend commits!${NC}"
    echo ""
    echo "🔒 Use environment variables instead:"
    echo "   ✅ const apiKey = process.env.FIREBASE_API_KEY;"
    echo "   ❌ const apiKey = 'AIzaSyDx...'; // NEVER hardcode!"
    echo ""
    exit 1
fi

# ============================================================================
# Check 3: Verify commit message quality (if applicable)
# ============================================================================
echo ""
echo "Check 3: Verifying all commits exist..."

# Simple check: ensure we have commits to push
UNPUSHED_COMMITS=$(git log "$REMOTE/$CURRENT_BRANCH..HEAD" --oneline 2>/dev/null | wc -l)
if [ "$UNPUSHED_COMMITS" -eq 0 ]; then
    echo -e "${GREEN}ℹ️  No commits to push (already up to date)${NC}"
    exit 0
fi

echo "   Found $UNPUSHED_COMMITS commit(s) to push"

# ============================================================================
# Final Result
# ============================================================================
echo ""
echo -e "${GREEN}✅ Pre-push security check passed!${NC}"
echo "   Ready to push $UNPUSHED_COMMITS commit(s) to $REMOTE/$CURRENT_BRANCH"
echo ""

exit 0
