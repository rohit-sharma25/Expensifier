// js/telegram-service.js
// Telegram Bot Notification Service (Direct API)
// Uses the unified Expensifier Bot token.
// Sends notifications to the logged-in user's linked Telegram chat ID.

export class TelegramService {
  // Unified Expensifier Bot Token (matches functions/index.js and config.js)
  static BOT_TOKEN = "8320318012:AAEn76oOBff6OjGLzgWXygktGeUxALEcm2g";

  /**
   * Send a transaction notification to Telegram
   * @param {number} amount - Transaction amount
   * @param {string} type - 'expense' or 'income'
   * @param {string} category - Category name
   * @param {string} description - Transaction description
   * @param {string} subCategory - Sub-category name (optional)
   * @param {string} chatId - The user's Telegram chat ID (fetched from Firestore)
   */
  static async sendNotification(amount, type, category, description, subCategory = '', chatId = null) {
    if (!chatId) {
      console.warn('⚠️ No Telegram Chat ID provided — notification skipped.');
      return null;
    }

    const icon = type === 'income' ? '💰' : '💸';
    const typeLabel = type === 'income' ? 'Income' : 'Expense';
    const categoryText = subCategory ? `${category} → ${subCategory}` : category;

    const message = `${icon} New ${typeLabel}

Amount: ₹${Number(amount).toFixed(2)}
Category: ${categoryText}
Description: ${description}
Time: ${new Date().toLocaleString('en-IN')}`;

    return this._sendTelegramMessage(message, chatId);
  }

  /**
   * Send a raw message to Telegram
   * @param {string} message - The message text
   * @param {string} chatId - Target chat ID
   */
  static async _sendTelegramMessage(message, chatId) {
    const url = `https://api.telegram.org/bot${this.BOT_TOKEN}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
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
