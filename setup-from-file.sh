#!/bin/bash
# Setup Firebase from credentials file

CRED_FILE="${1:-firebase-credentials.txt}"

if [ ! -f "$CRED_FILE" ]; then
  echo "❌ File not found: $CRED_FILE"
  echo ""
  echo "1. Copy firebase-credentials.template.txt to firebase-credentials.txt"
  echo "2. Edit firebase-credentials.txt with your Firebase values"
  echo "3. Run: bash setup-from-file.sh firebase-credentials.txt"
  exit 1
fi

# Source the file
source "$CRED_FILE"

# Validate
if [ -z "$FIREBASE_API_KEY" ] || [ -z "$FIREBASE_AUTH_DOMAIN" ] || [ -z "$FIREBASE_PROJECT_ID" ] || [ -z "$FIREBASE_APP_ID" ]; then
  echo "❌ Missing values in $CRED_FILE"
  echo ""
  echo "Make sure all 4 values are filled:"
  grep "FIREBASE_" "$CRED_FILE"
  exit 1
fi

echo "🔐 Setting up Firebase credentials..."
echo ""

# Add environment variables
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production --value "$FIREBASE_API_KEY" --yes --force || exit 1
npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production --value "$FIREBASE_AUTH_DOMAIN" --yes --force || exit 1
npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production --value "$FIREBASE_PROJECT_ID" --yes --force || exit 1
npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production --value "$FIREBASE_APP_ID" --yes --force || exit 1

echo ""
echo "✅ Environment variables set!"
echo ""
echo "🚀 Redeploying to Vercel..."
npx vercel --prod --yes || exit 1

echo ""
echo "🔍 Verifying setup..."
sleep 3
RESULT=$(curl -s https://jachwi-hotdeal.vercel.app/api/firebase-config | jq .configured)

if [ "$RESULT" = "true" ]; then
  echo "✅ Success! Login is now active."
  echo ""
  echo "🌐 Visit: https://jachwi-hotdeal.vercel.app"
  echo "   Click Login button to test Google Sign-In"
else
  echo "⚠️  Verifying... (this may take 1-2 minutes)"
  echo "   Try: bash check-setup.sh"
fi
