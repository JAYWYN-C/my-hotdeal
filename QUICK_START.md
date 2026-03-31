# 🚀 Firebase Login Quick Start

## Current Status
✅ App deployed: https://jachwi-hotdeal.vercel.app  
❌ Login: **DISABLED** (Firebase credentials missing)

---

## Activate Login in 5 Minutes

### 1️⃣ Get Firebase Credentials
Go to: https://console.firebase.google.com/
1. Select your project
2. ⚙️ Settings (gear icon) → General tab
3. Scroll to "Your apps" → Find your Web app
4. Copy these 4 values:

```
API Key
Auth Domain  
Project ID
App ID
```

### 2️⃣ Add to Vercel (Choose One Method)

**Method A: Interactive (Recommended)**
```bash
cd /Users/jay/PycharmProjects/vscode/hotdeal
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production
npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production
npx vercel --prod --yes
```

**Method B: Automated Script**
```bash
cd /Users/jay/PycharmProjects/vscode/hotdeal
./setup-firebase.sh "YOUR_API_KEY" "YOUR_AUTH_DOMAIN" "YOUR_PROJECT_ID" "YOUR_APP_ID"
```

### 3️⃣ Verify
```bash
curl -s https://jachwi-hotdeal.vercel.app/api/firebase-config | jq .
```

✅ Should show: `"configured": true`

---

## Test Login
1. Open https://jachwi-hotdeal.vercel.app
2. Click **Login** (top right)
3. Sign in with Google
4. Your email appears in header ✅

---

## What Happens After Login?
- ✅ Browser remembers you (HttpOnly session cookie)
- ✅ Bookmarks saved to your Firestore profile
- ✅ Keyword alerts enabled
- ✅ Works across tabs/devices

---

## Troubleshooting

**"No Environment Variables found"**
→ Run the `npx vercel env add` commands above

**"configured: false" after deploy**
→ Wait 2-3 minutes for Vercel to rebuild, then refresh

**Google Sign-In button doesn't work**
→ Check Firebase Console > Authentication > Authorized domains
→ Make sure `jachwi-hotdeal.vercel.app` is listed

**Local testing**
→ Add to Firebase Console > Authorized domains: `localhost, localhost:3000`
→ Create `firebase-config.js` with your values:
```js
window.FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  appId: "..."
};
```

---

**Questions?** See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for detailed guide.
