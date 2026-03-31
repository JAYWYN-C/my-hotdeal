#!/bin/bash
# Setup Firebase credentials on Vercel
# Usage: ./setup-firebase.sh <api_key> <auth_domain> <project_id> <app_id>

if [ $# -ne 4 ]; then
  echo "Usage: $0 <api_key> <auth_domain> <project_id> <app_id>"
  echo ""
  echo "Example:"
  echo "  $0 'AIzaSyD_...' 'my-project.firebaseapp.com' 'my-project-12345' '1:123456789:web:abc...'"
  exit 1
fi

API_KEY="$1"
AUTH_DOMAIN="$2"
PROJECT_ID="$3"
APP_ID="$4"

echo "🔐 Setting up Firebase credentials on Vercel..."
echo ""

# Add environment variables one by one
echo "Adding NEXT_PUBLIC_FIREBASE_API_KEY..."
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production "$API_KEY" || exit 1

echo "Adding NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN..."
npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production "$AUTH_DOMAIN" || exit 1

echo "Adding NEXT_PUBLIC_FIREBASE_PROJECT_ID..."
npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production "$PROJECT_ID" || exit 1

echo "Adding NEXT_PUBLIC_FIREBASE_APP_ID..."
npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production "$APP_ID" || exit 1

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
  echo "❌ Setup may have failed. Check:"
  echo "   curl -s https://jachwi-hotdeal.vercel.app/api/firebase-config | jq ."
  exit 1
fi
