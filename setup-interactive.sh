#!/bin/bash
# Interactive Firebase setup with prompts

echo "🚀 Hotdeal Firebase Login Setup"
echo "================================="
echo ""

# Check if already configured
CONFIGURED=$(curl -s https://jachwi-hotdeal.vercel.app/api/firebase-config 2>/dev/null | jq -r '.configured // false')

if [ "$CONFIGURED" = "true" ]; then
  echo "✅ Firebase is already configured!"
  echo ""
  echo "Your login is active at: https://jachwi-hotdeal.vercel.app"
  exit 0
fi

echo "Get your Firebase credentials:"
echo "1. Go to: https://console.firebase.google.com"
echo "2. Select your project"
echo "3. Click ⚙️ (Settings) → General tab"
echo "4. Find 'Your apps' section → Web app"
echo "5. Copy the 4 values below"
echo ""

# Prompt for credentials
read -p "📝 Firebase API Key: " API_KEY
read -p "📝 Firebase Auth Domain (e.g., project.firebaseapp.com): " AUTH_DOMAIN
read -p "📝 Firebase Project ID: " PROJECT_ID
read -p "📝 Firebase App ID: " APP_ID

# Validate
if [ -z "$API_KEY" ] || [ -z "$AUTH_DOMAIN" ] || [ -z "$PROJECT_ID" ] || [ -z "$APP_ID" ]; then
  echo "❌ All 4 values are required"
  exit 1
fi

echo ""
echo "🔐 Setting up Firebase on Vercel..."
echo ""

# Add to Vercel
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production "$API_KEY" || exit 1
npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production "$AUTH_DOMAIN" || exit 1
npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production "$PROJECT_ID" || exit 1
npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production "$APP_ID" || exit 1

echo ""
echo "✅ Credentials added to Vercel!"
echo ""
echo "🚀 Redeploying..."
npx vercel --prod --yes || exit 1

echo ""
echo "⏳ Waiting for deployment (2-3 minutes)..."
sleep 5

# Check multiple times
for i in {1..6}; do
  RESULT=$(curl -s https://jachwi-hotdeal.vercel.app/api/firebase-config 2>/dev/null | jq -r '.configured // false')
  if [ "$RESULT" = "true" ]; then
    echo ""
    echo "✅ SUCCESS! Login is now active!"
    echo ""
    echo "🌐 Visit: https://jachwi-hotdeal.vercel.app"
    echo "✨ Click the 'Login' button and sign in with Google"
    echo ""
    exit 0
  fi
  echo "   Checking... ($i/6)"
  sleep 10
done

echo ""
echo "⚠️  Setup complete, but still waiting for deployment to go live"
echo "   Try again in 1-2 minutes:"
echo "   bash check-setup.sh"
