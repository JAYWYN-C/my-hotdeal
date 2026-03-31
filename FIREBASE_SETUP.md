# Firebase Login Setup Guide

## Step 1: Get Your Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **Project Settings** (gear icon, top left)
4. Go to the **General** tab
5. Under "Your apps", find your Web app (or create one if missing)
6. Copy these 4 values:

```
API Key: [NEXT_PUBLIC_FIREBASE_API_KEY]
Auth Domain: [NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN]
Project ID: [NEXT_PUBLIC_FIREBASE_PROJECT_ID]
App ID: [NEXT_PUBLIC_FIREBASE_APP_ID]
```

**Example values:**
- API Key: `AIzaSyD_1234567890abcdefghijklmnop`
- Auth Domain: `my-project-12345.firebaseapp.com`
- Project ID: `my-project-12345`
- App ID: `1:123456789012:web:abcdef1234567890`

## Step 2: Add to Vercel

Run each command and when prompted, paste the corresponding value:

```bash
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production
npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production
```

## Step 3: Redeploy

```bash
npx vercel --prod --yes
```

## Step 4: Verify

Check that login is now active:

```bash
curl -s https://jachwi-hotdeal.vercel.app/api/firebase-config | jq .
```

You should see `"configured": true` with all 4 values in the config object.

## Step 5: Test Login

1. Go to https://jachwi-hotdeal.vercel.app
2. Click **Login** button in top right
3. Sign in with your Google account
4. You should see your email in the header

---

**Need Help?**
- Make sure you're logged into Firebase Console
- Verify the Web app exists in your project
- Check that values don't have extra spaces
