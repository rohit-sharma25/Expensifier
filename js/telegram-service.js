// js/telegram-service.js
// Telegram Bot Notification Service (Prototype - Direct API)
// NOTE: For production, this should use Firebase Cloud Functions

export class TelegramService {
  // Credentials for prototype (will migrate to Cloud Functions after upgrade)
  static BOT_TOKEN = "8319998354:AAFJAbvYOAIBLOW2xBfYXbbfMiTIkNKA6u0";
  static CHAT_ID = "5515681234";

  /**
   * Send a transaction notification to Telegram
   * @param {number} amount - Transaction amount
   * @param {string} type - 'expense' or 'income'
   * @param {string} category - Category name
   * @param {string} description - Transaction description
   * @param {string} subCategory - Sub-category name (optional)
   */
  static async sendNotification(amount, type, category, description, subCategory = '') {
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
  static async _sendTelegramMessage(message) {
    const url = `https://api.telegram.org/bot${this.BOT_TOKEN}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: this.CHAT_ID,
          text: message
        })
      });

      const data = await response.json();

      if (data.ok) {
        console.log('✅ Telegram notification sent successfully');
        return data;
      } else {
        console.error('❌ Telegram API error:', data.description);
        throw new Error(data.description);
      }
    } catch (error) {
      console.warn('⚠️ Telegram notification error (non-blocking):', error.message);
      // Don't throw - silently fail so it doesn't interrupt the user's workflow
      return null;
    }
  }
}
