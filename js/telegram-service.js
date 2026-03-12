// js/telegram-service.js
// Telegram Bot Notification Service

export class TelegramService {
  // Initialize with your bot token and chat ID from BotFather
  // Get token: Chat BotFather -> /mybots -> Select bot -> API Token
  // Get chat ID: Chat @userinfobot -> will show your ID
  // NOTE: Use environment variables to load these securely, NOT hardcoded values!
  
  static BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN || "8319998354:AAFJAbvYOAIBLOW2xBfYXbbfMiTIkNKA6u0";
  static CHAT_ID = process.env.VITE_TELEGRAM_CHAT_ID || "5515681234";
  
  /**
   * Send a transaction notification to Telegram
   * @param {number} amount - Transaction amount
   * @param {string} type - 'expense' or 'income'
   * @param {string} category - Category name
   * @param {string} description - Transaction description
   * @param {string} subCategory - Sub-category name (optional)
   */
  static sendNotification(amount, type, category, description, subCategory = '') {
    // Check if credentials are set
    if (this.BOT_TOKEN === "8319998354:AAFJAbvYOAIBLOW2xBfYXbbfMiTIkNKA6u0                                                                                                                 " || this.CHAT_ID === "5515681234") {
      console.warn("Telegram credentials not configured. Please set BOT_TOKEN and CHAT_ID in telegram-service.js");
      return Promise.resolve();
    }

    const icon = type === 'income' ? '💰' : '💸';
    const typeLabel = type === 'income' ? 'Income' : 'Expense';
    const categoryText = subCategory ? `${category} → ${subCategory}` : category;

    const message = `${icon} New ${typeLabel}

Amount: ₹${Number(amount).toFixed(2)}
Category: ${categoryText}
Description: ${description}
Time: ${new Date().toLocaleString('en-IN')}`;

    return this._sendTelegramMessage(message);
  }

  /**
   * Send a raw message to Telegram
   * @param {string} message - The message text
   */
  static _sendTelegramMessage(message) {
    const url = `https://api.telegram.org/bot${this.BOT_TOKEN}/sendMessage`;
    
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: this.CHAT_ID,
        text: message,
        parse_mode: "HTML"
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          console.log("Telegram notification sent successfully");
          return data;
        } else {
          console.error("Telegram API error:", data.description);
          throw new Error(data.description);
        }
      })
      .catch(err => {
        console.error("Failed to send Telegram notification:", err);
        // Don't throw - silently fail so it doesn't interrupt the user's workflow
        return null;
      });
  }
}
