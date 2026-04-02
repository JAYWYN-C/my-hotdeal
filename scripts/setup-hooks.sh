#!/bin/bash
# Setup git hooks for security checks
# Run this script once to install pre-commit and pre-push hooks

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

HOOKS_DIR=".git/hooks"
SCRIPTS_DIR="scripts"

echo -e "${GREEN}🔒 Setting up Git Hooks for Security${NC}"
echo ""

# ============================================================================
# Create hook files
# ============================================================================

# Pre-commit hook
echo "Installing pre-commit hook..."
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash
# Auto-generated pre-commit hook
# Run security checks before committing

bash scripts/check-secrets.sh
exit $?
EOF

chmod +x "$HOOKS_DIR/pre-commit"
echo -e "${GREEN}✅ Pre-commit hook installed${NC}"

# Pre-push hook
echo "Installing pre-push hook..."
cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/bin/bash
# Auto-generated pre-push hook
# Run security checks before pushing

bash scripts/check-push.sh
exit $?
EOF

chmod +x "$HOOKS_DIR/pre-push"
echo -e "${GREEN}✅ Pre-push hook installed${NC}"

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${GREEN}✅ Git hooks setup complete!${NC}"
echo ""
echo "📋 Installed hooks:"
for hook in pre-commit pre-push; do
    if [ -x "$HOOKS_DIR/$hook" ]; then
        echo -e "   ${GREEN}✓${NC} $HOOKS_DIR/$hook"
    fi
done
echo ""
echo -e "${YELLOW}ℹ️  What will happen now:${NC}"
echo "   • Before each commit: Security scan for secrets"
echo "   • Before each push: Verify no .env files included"
echo ""
echo -e "${YELLOW}To bypass hooks (not recommended):${NC}"
echo "   git commit --no-verify"
echo "   git push --no-verify"
echo ""
