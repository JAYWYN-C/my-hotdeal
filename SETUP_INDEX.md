# 🚀 Hotdeal Firebase Login - Complete Setup Guide

## TL;DR - Get Login Working NOW

```bash
# Option 1: Interactive (Easiest)
bash setup-interactive.sh

# Option 2: One command
./setup-firebase.sh "YOUR_API_KEY" "YOUR_AUTH_DOMAIN" "YOUR_PROJECT_ID" "YOUR_APP_ID"
```

---

## 📍 Quick Navigation

| Need | File |
|------|------|
| **🎯 Pick a setup method** | [SETUP_METHODS.md](SETUP_METHODS.md) |
| **⚡ 5-min quickstart** | [QUICK_START.md](QUICK_START.md) |
| **📖 Detailed guide** | [FIREBASE_SETUP.md](FIREBASE_SETUP.md) |
| **✓ Check status** | `bash check-setup.sh` |
| **💻 Run setup** | `bash setup-interactive.sh` |

---

## 🎯 4 Setup Scripts Available

```bash
# 1️⃣ Interactive (prompts you for each value)
bash setup-interactive.sh

# 2️⃣ Direct command (paste all 4 values)
./setup-firebase.sh "API_KEY" "DOMAIN" "PROJECT_ID" "APP_ID"

# 3️⃣ From file (edit firebase-credentials.txt, then run)
bash setup-from-file.sh

# 4️⃣ Manual Vercel CLI
npx vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
npx vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
npx vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production
npx vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production
npx vercel --prod --yes
```

---

## ✅ System Status

**App**: https://jachwi-hotdeal.vercel.app ✓  
**APIs**: Ready ✓  
**Credentials**: ⏳ Awaiting your input  

Check status anytime:
```bash
bash check-setup.sh
```

---

## 📚 Documentation Structure

```
hotdeal/
├── SETUP_METHODS.md              ← All setup options (choose 1)
├── START_LOGIN_HERE.md           ← Quick start (3 options)
├── QUICK_START.md                ← 5-minute guide
├── FIREBASE_SETUP.md             ← Detailed guide
├── LOGIN_SETUP_SUMMARY.md        ← System overview
│
├── setup-interactive.sh          ← Run this (easiest!)
├── setup-firebase.sh             ← Or this (direct)
├── setup-from-file.sh            ← Or this (file-based)
├── check-setup.sh                ← Status check
│
└── firebase-credentials.template.txt  ← Optional credentials file
```

---

## 🚀 Let's Do This!

### Step 1: Get Firebase Credentials (1 min)
```
Visit: https://console.firebase.google.com
Project Settings → General → Your apps → Web
Copy: API Key, Auth Domain, Project ID, App ID
```

### Step 2: Run Setup (2 min)
Choose one:
```bash
bash setup-interactive.sh
```

### Step 3: Test (1 min)
```
Visit: https://jachwi-hotdeal.vercel.app
Click: Login button
Sign in: With your Google account
```

---

## ⚡ Quick Commands Reference

```bash
# Get Firebase status
bash check-setup.sh

# Run interactive setup
bash setup-interactive.sh

# Run direct setup
./setup-firebase.sh "KEY" "DOMAIN" "ID" "APPID"

# Run file-based setup
bash setup-from-file.sh firebase-credentials.txt

# Test current config
curl -s https://jachwi-hotdeal.vercel.app/api/firebase-config | jq .

# Check Vercel env vars
npx vercel env ls
```

---

## 📞 Need Help?

1. **Can't find credentials?** → [FIREBASE_SETUP.md](FIREBASE_SETUP.md#step-1-get-your-firebase-credentials)
2. **Setup failed?** → `bash check-setup.sh` then pick method from [SETUP_METHODS.md](SETUP_METHODS.md)
3. **Login not working?** → Check [FIREBASE_SETUP.md#troubleshooting](FIREBASE_SETUP.md)
4. **Want details?** → See [LOGIN_SETUP_SUMMARY.md](LOGIN_SETUP_SUMMARY.md)

---

## ✨ What's Ready

✅ Frontend login UI  
✅ Backend auth API  
✅ Session management  
✅ Firestore integration  
✅ Vercel deployment  
✅ Setup automation  

**Just need:** Your Firebase credentials

---

**Ready?** 👇
```bash
bash setup-interactive.sh
```
