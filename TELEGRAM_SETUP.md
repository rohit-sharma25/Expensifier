# Telegram Notifications Setup Guide

## Steps to Get Your Telegram Bot Working

### Step 1: Get Your Bot Token from BotFather
1. Open **Telegram** app
2. Search for and chat with **@BotFather**
3. Send: `/mybots`
4. Select your bot
5. Select **API Token**
6. Copy the token (looks like: `123456789:AAExampleTokenABC123`)

### Step 2: Get Your Chat ID
1. Open Telegram and search for **@userinfobot**
2. Start the chat
3. You'll see your ID in the message (looks like: `123456789`)
4. Copy that number

### Step 3: Add Credentials to Your Code
1. Open: `js/telegram-service.js`
2. Find these lines:
   ```javascript
   static BOT_TOKEN = "YOUR_BOT_TOKEN";
   static CHAT_ID = "YOUR_CHAT_ID";
   ```

3. Replace them with your actual values:
   ```javascript
   static BOT_TOKEN = "123456789:AAExampleTokenABC123";
   static CHAT_ID = "987654321";
   ```

### Step 4: Test It
1. Go to your website: https://expensifier-ashy.vercel.app/expense.html
2. Add a new expense
3. You should instantly receive a Telegram message with details!

## Example Message Format
```
💸 New Expense

Amount: ₹500
Category: Dining → Restaurant
Description: Pizza Night
Time: 12/3/2026, 7:30:00 PM
```

## Security Note
- The bot token is visible in your frontend code (browser)
- This is fine for personal projects and demos
- For production apps with sensitive data, use Firebase Cloud Functions as a backend relay

## Troubleshooting

**"Telegram credentials not configured" warning?**
- Check that you've replaced `YOUR_BOT_TOKEN` and `YOUR_CHAT_ID` with actual values

**Not receiving messages?**
- Verify bot token is correct
- Verify chat ID matches your user ID (not bot ID)
- Check browser console (F12) for error messages
- Ensure @BotFather bot is still active in Telegram

**Bot not responding?**
- Start a new chat with your bot name and send `/start`
- Then try adding an expense again
