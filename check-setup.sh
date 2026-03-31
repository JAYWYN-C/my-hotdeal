#!/bin/bash
# Verify hotdeal Firebase setup status

echo "🔍 Checking Hotdeal Firebase Setup..."
echo ""

# Check Vercel env vars
echo "1️⃣  Vercel Environment Variables:"
echo "   Running: npx vercel env ls"
ENV_OUTPUT=$(npx vercel env ls 2>&1)
if echo "$ENV_OUTPUT" | grep -q "No Environment Variables"; then
  echo "   ❌ No variables set"
else
  echo "   ✅ Variables found:"
  echo "$ENV_OUTPUT" | sed 's/^/      /'
fi
echo ""

# Check deployment status
echo "2️⃣  API Status:"
CONFIG=$(curl -s https://jachwi-hotdeal.vercel.app/api/firebase-config 2>/dev/null)

if [ $? -eq 0 ]; then
  CONFIGURED=$(echo "$CONFIG" | jq -r '.configured // false')
  
  if [ "$CONFIGURED" = "true" ]; then
    echo "   ✅ Login is ACTIVE"
    echo "   Config:"
    echo "$CONFIG" | jq '.config' | sed 's/^/      /'
  else
    MISSING=$(echo "$CONFIG" | jq -r '.missingKeys[]' 2>/dev/null | wc -l)
    echo "   ❌ Login is INACTIVE"
    echo "   Missing $MISSING environment variables:"
    echo "$CONFIG" | jq -r '.missingKeys[]' 2>/dev/null | sed 's/^/      - /'
  fi
else
  echo "   ❌ Could not reach API"
fi
echo ""

# Check if setup script exists
echo "3️⃣  Setup Tools:"
if [ -f "./setup-firebase.sh" ]; then
  echo "   ✅ setup-firebase.sh available"
else
  echo "   ❌ setup-firebase.sh not found"
fi

if [ -f "./QUICK_START.md" ]; then
  echo "   ✅ QUICK_START.md available"
else
  echo "   ❌ QUICK_START.md not found"
fi
echo ""

# Check local git status
echo "4️⃣  Project Status:"
if [ -d ".git" ]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  LOCAL=$(git rev-parse HEAD 2>/dev/null | cut -c1-7)
  echo "   ✅ Git repo"
  echo "      Branch: $BRANCH"
  echo "      Local commit: $LOCAL"
else
  echo "   ❌ Not a git repo"
fi
echo ""

# Next steps
echo "📋 Next Steps:"
if [ "$CONFIGURED" = "true" ]; then
  echo "   ✅ Login is ready!"
  echo "   → Visit: https://jachwi-hotdeal.vercel.app"
  echo "   → Click Login button to test"
else
  echo "   1. Get Firebase credentials from:"
  echo "      https://console.firebase.google.com → Project Settings → General"
  echo ""
  echo "   2. Run setup (choose one):"
  echo "      Option A: ./setup-firebase.sh <api_key> <domain> <project_id> <app_id>"
  echo "      Option B: npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production"
  echo ""
  echo "   3. For details: cat QUICK_START.md"
fi
