# Telegram Notifications Setup

## Current Implementation: Prototype Version ⚡

**Status:** Hardcoded direct API (prototype)  
**Planned:** Migrate to Firebase Cloud Functions (after Blaze upgrade)

---

## How It Works (Current)

1. **Frontend:** When you add an expense → directly calls Telegram API
2. **Telegram Bot:** Instantly sends notification to your chat
3. **Credentials:** Currently hardcoded in `js/telegram-service.js` (temporary for prototype)

## Quick Start

### No Deployment Needed! ✅
Just push the code and test:

```bash
# 1. Make sure latest code is pushed to GitHub
git add .
git commit -m "Add Telegram notifications"
git push origin main

# 2. Go to your Vercel app
https://expensifier-ashy.vercel.app/expense.html

# 3. Add a new expense

# 4. Check Telegram for notification 📱
```

### Test Steps

1. Open browser DevTools: **F12**
2. Go to **Console** tab
3. Add a new expense
4. You should see:
   - ✅ `Telegram notification sent successfully` (works!)
   - ❌ Error message (needs troubleshooting)

---

## Troubleshooting

### Issue: Notification not received

**Check 1:** Is your bot active?
- Open Telegram
- Search for your bot by name
- Send `/start` to activate it

**Check 2:** Browser console errors?
- Press **F12** → **Console** tab
- Add an expense and look for red errors
- Take a screenshot and check the error message

**Check 3:** Wrong chat ID?
- Get correct ID: Message @userinfobot (copy the ID shown)
- Update in `js/telegram-service.js` line 7

**Check 4:** Wrong bot token?
- Get new token: @BotFather → `/mybots` → select bot → **API Token**
- Update in `js/telegram-service.js` line 6
- Push to GitHub

---

## Production Migration Plan 🚀

**After you upgrade to Firebase Blaze (free tier):**

1. Deploy Cloud Functions:
   ```bash
   cd functions
   firebase deploy --only functions
   ```

2. Switch to secure version:
   - Update `js/telegram-service.js` to use Cloud Functions
   - Credentials will be hidden in Firebase backend
   - No more hardcoded secrets

**Timeline:** Do this after initial prototype testing works

---

## Security Note ⚠️

**For Prototype:** Credentials are visible in code (acceptable for personal testing)  
**For Production:** Will use Firebase Cloud Functions (credentials private)

This is fine for now since you're testing locally and on Vercel. Once live with users, upgrade to Cloud Functions version.
