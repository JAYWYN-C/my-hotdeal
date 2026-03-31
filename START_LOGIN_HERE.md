# 🎯 Get Your Login Working in 5 Minutes

## Pick Your Option

### 🚀 **EASIEST** - Automated Setup
```bash
cd /Users/jay/PycharmProjects/vscode/hotdeal

# 1. Go get Firebase credentials from:
# https://console.firebase.google.com → Project Settings → General
# You need 4 values: API Key, Auth Domain, Project ID, App ID

# 2. Run this (paste your 4 values when prompted):
./setup-firebase.sh "YOUR_API_KEY" "YOUR_AUTH_DOMAIN" "YOUR_PROJECT_ID" "YOUR_APP_ID"

# 3. Done! Check your email at https://jachwi-hotdeal.vercel.app
```

### 📋 **STEP-BY-STEP** - Manual Setup
```bash
cd /Users/jay/PycharmProjects/vscode/hotdeal

# 1. Get credentials from Firebase Console
#    https://console.firebase.google.com

# 2. Add each one (Vercel will prompt you to paste):
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production
npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production

# 3. Redeploy
npx vercel --prod --yes

# 4. Wait 2-3 minutes...

# 5. Verify
bash check-setup.sh
```

### ✅ **CHECK** - See Your Status
```bash
bash check-setup.sh
```

---

## What Happens Next?

After setup, when users visit https://jachwi-hotdeal.vercel.app:
- ✅ Google Sign-In works
- ✅ Browser remembers them (secure cookie)
- ✅ Bookmarks save to their account
- ✅ Keyword alerts activate
- ✅ Settings persist across devices

---

## Need Help?

- **5-min guide**: [QUICK_START.md](QUICK_START.md)
- **Full details**: [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
- **Status check**: `bash check-setup.sh`
- **Firebase**: https://console.firebase.google.com

---

**That's it!** Pick one option above and run it. ✨
