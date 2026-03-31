# 🎯 Firebase Login - Pick Your Setup Method

## Quick Status Check
```bash
bash check-setup.sh
```

---

## 4 Setup Methods (Pick One)

### 🟢 Method 1: Interactive Prompts (Easiest!)
```bash
bash setup-interactive.sh
```
✅ **Best for:** First-time setup, don't want to remember all commands
- Asks for each value interactively
- Shows progress
- Auto-verifies when done

---

### 🟡 Method 2: One-Line Command
```bash
./setup-firebase.sh "API_KEY" "AUTH_DOMAIN" "PROJECT_ID" "APP_ID"
```
✅ **Best for:** Quick setup when you have all 4 values
- Replace values with your actual credentials (keep the quotes)
- Fast and direct

**Example:**
```bash
./setup-firebase.sh "AIzaSyD_abc123..." "my-project.firebaseapp.com" "my-project-id" "1:123456789:web:abc"
```

---

### 🔵 Method 3: Credentials File
```bash
cp firebase-credentials.template.txt firebase-credentials.txt
# Edit firebase-credentials.txt with your 4 values
bash setup-from-file.sh
```
✅ **Best for:** Keeping credentials in a file, batch processing

---

### 🟣 Method 4: Manual Vercel Setup
```bash
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
# Paste your API Key, press Enter

npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
# Paste your Auth Domain, press Enter

npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production
# Paste your Project ID, press Enter

npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production
# Paste your App ID, press Enter

npx vercel --prod --yes
```
✅ **Best for:** Understanding each step

---

## Where to Get Your Firebase Credentials

1. Go to: https://console.firebase.google.com/
2. Select your project
3. Click ⚙️ **Settings** (gear icon, top left)
4. Go to **General** tab
5. Under "Your apps", find your **Web app**
6. You'll see:
   ```
   apiKey: "YOUR_API_KEY"
   authDomain: "YOUR_AUTH_DOMAIN"
   projectId: "YOUR_PROJECT_ID"
   appId: "YOUR_APP_ID"
   ```

---

## What Happens After Setup?

1. ✅ `npx vercel --prod` redeploys your app
2. ✅ Firebase credentials loaded into production
3. ✅ `/api/firebase-config` starts returning `configured: true`
4. ✅ Login button on app becomes active
5. ✅ Users can sign in with Google
6. ✅ Bookmarks & preferences sync to Firestore

---

## Verify Setup
```bash
# Check status
bash check-setup.sh

# Should show: ✅ Login is ACTIVE
```

---

## Troubleshooting

**"curl: (7) Failed to connect"**
→ App might be redeploying, wait 2-3 minutes and try again

**"configured: false"** 
→ Vercel still deploying, wait and retry

**4 values pasted wrong**
→ Run the setup again, values will be replaced

**Forgot where credentials are?**
→ Firebase Console > Project Settings > General tab

---

## What's Next?

After setup:
1. Visit https://jachwi-hotdeal.vercel.app
2. Click **Login** button (top right)
3. Sign in with your Google account
4. Your email appears in the header ✅
5. Bookmarks and preferences now save to your account

---

**Choose Method 1 (Interactive) if unsure.** It's the easiest! 👇
```bash
bash setup-interactive.sh
```
