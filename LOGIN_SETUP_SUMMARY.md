# Firebase Login Setup - Summary

## Current System Status
- **App URL**: https://jachwi-hotdeal.vercel.app
- **Login Status**: ❌ AWAITING FIREBASE CREDENTIALS
- **Backend API**: ✅ Ready at `/api/firebase-config`
- **Session API**: ✅ Ready at `/api/auth-session`

## What's Already Built

### Frontend (Client-Side)
- ✅ Google Sign-In button in header
- ✅ `loadRuntimeFirebaseConfig()` - fetches Firebase config from Vercel API
- ✅ `syncServerAuthSession(user)` - creates secure session cookie
- ✅ Login state persistence across tabs/refreshes
- ✅ Logout functionality
- ✅ Browser Notification API integration for keyword alerts

### Backend APIs
- ✅ `/api/firebase-config` - exposes Firebase credentials from Vercel env vars
- ✅ `/api/auth-session` - validates Firebase tokens, manages HttpOnly cookies
- ✅ Firestore integration ready for user preferences

### Infrastructure
- ✅ Vercel production deployment
- ✅ Environment variable management setup
- ✅ GitHub Actions for data collection
- ✅ Automated deployment on deal collection

## What You Need to Do

### Step 1: Get Firebase Credentials (2 min)
Visit: https://console.firebase.google.com
1. Select your project
2. Click gear icon (⚙️) → General
3. Under "Your apps", find Web app entry
4. Copy 4 values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`

### Step 2: Add to Vercel (3 min)

**Quick Method:**
```bash
cd /Users/jay/PycharmProjects/vscode/hotdeal
./setup-firebase.sh <paste-api-key> <paste-auth-domain> <paste-project-id> <paste-app-id>
```

**Manual Method:**
```bash
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
# paste your API Key, then hit Enter
npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
# paste your Auth Domain, then hit Enter
npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production
# paste your Project ID, then hit Enter
npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production
# paste your App ID, then hit Enter

# Redeploy
npx vercel --prod --yes
```

### Step 3: Verify Setup (1 min)
```bash
bash check-setup.sh
```

Should show:
```
✅ Login is ACTIVE
```

## Expected Behavior After Setup

1. User visits https://jachwi-hotdeal.vercel.app
2. Clicks "Login" button (top right)
3. Redirected to Google Sign-In
4. After auth, session cookie created
5. Header shows user's email
6. Bookmarks/preferences save to Firestore
7. Keyword alerts work

## Files Added/Modified

### New Files
- `QUICK_START.md` - 5-minute setup guide
- `FIREBASE_SETUP.md` - Detailed setup documentation
- `setup-firebase.sh` - Automated setup script
- `check-setup.sh` - Diagnostic tool

### Modified Files
- `README.md` - Added Firebase setup section
- Already deployed: `api/firebase-config.js`, `api/auth-session.js`, `app.js`

## Troubleshooting

### Login button shows but doesn't work
→ Check that Firebase credentials were saved to Vercel
```bash
npx vercel env ls
```

### Getting "configured: false"
→ Run check-setup.sh to diagnose

### Want to test locally?
1. Create `firebase-config.js`:
```js
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_APP_ID"
};
```

2. Add `localhost` to Firebase Console > Authentication > Authorized domains

3. Open `index.html` in browser

## Support Resources

- **Firebase Console**: https://console.firebase.google.com
- **Quick Start**: [QUICK_START.md](QUICK_START.md)
- **Detailed Guide**: [FIREBASE_SETUP.md](FIREBASE_SETUP.md)
- **Diagnostic Tool**: `bash check-setup.sh`
- **Setup Script**: `./setup-firebase.sh`

---

**Status**: System ready, awaiting Firebase credentials from user.
