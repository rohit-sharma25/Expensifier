// functions/sms-logic.js
/**
 * Portable SMS parsing logic for Cloud Functions (No DOM dependency)
 */

const tryRegexParse = (text) => {
    const result = {
        success: false,
        amount: null,
        type: 'expense',
        description: 'Bank Transaction',
        category: 'Miscellaneous',
        subCategory: 'Bank Sync',
        date: new Date().toISOString().split('T')[0]
    };

    if (!text) return result;

    // Transaction Type
    const expenseWords = /debited|spent|paid|vpa|sent|payment|dr\.?\s|dr:|[^-]dr\s/i;
    const incomeWords = /credited|received|added|deposited|refund|cr\.?\s|cr:|[^-]cr\s/i;

    if (expenseWords.test(text)) {
        result.type = 'expense';
    } else if (incomeWords.test(text)) {
        result.type = 'income';
    }

    // Amount patterns: Rs. 100, INR 100, 100.00
    const balancedWords = /balance|bal|avlbal|avl\sbal|available\sbalance|bal:|balance:/i;
    const amtRegex = /(?:Rs\.?|INR|VPA|Amt|₹)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:cr\.|dr\.|cr\s|dr\s|dr:|cr:)/gi;

    let match;
    while ((match = amtRegex.exec(text)) !== null) {
        const amtValue = match[1] || match[2];
        const matchIndex = match.index;
        const textBefore = text.substring(Math.max(0, matchIndex - 20), matchIndex).toLowerCase();

        if (!balancedWords.test(textBefore)) {
            result.amount = parseFloat(amtValue.replace(/,/g, ''));
            result.success = true;
            break;
        }
    }

    // Merchant / Description
    const merchantRegex = /(?:at|to|from|info)\s+([^,.\s]+(?:\s+[^,.\s]+)?)/i;
    const merchantMatch = text.match(merchantRegex);
    if (merchantMatch) {
        result.description = merchantMatch[1].trim();

        const merchantMap = {
            'swiggy': 'Food & Grocery',
            'zomato': 'Food & Grocery',
            'uber': 'Traveling',
            'ola': 'Traveling',
            'amazon': 'Shopping',
            'flipkart': 'Shopping',
            'netflix': 'Bill & Subscription',
            'spotify': 'Bill & Subscription',
            'lic': 'Bill & Subscription',
            'airtel': 'Bill & Subscription',
            'jio': 'Bill & Subscription',
            'openai': 'LLM Models',
            'anthropic': 'LLM Models',
            'google': 'LLM Models',
            'replicate': 'LLM Models'
        };

        const descLower = result.description.toLowerCase();
        for (const [key, cat] of Object.entries(merchantMap)) {
            if (descLower.includes(key)) {
                result.category = cat;
                if (cat === 'Food & Grocery') result.subCategory = 'Restaurant';
                if (cat === 'Traveling') result.subCategory = 'Cab/Taxi';
                if (cat === 'Shopping') result.subCategory = 'Clothing';
                if (cat === 'Bill & Subscription') result.subCategory = 'Mobile';
                if (cat === 'LLM Models') result.subCategory = 'Others';
                break;
            }
        }
    }

    if (result.amount && result.amount > 0) {
        result.success = true;
    }

    return result;
};

module.exports = { tryRegexParse };
