// js/transaction-mapper.js

export const CategoryMapping = {
    // Plaid/Salt Categories -> App Categories
    'FOOD_AND_DRINK': 'Dining',
    'GROCERIES': 'Groceries',
    'TRANSPORTATION': 'Transport',
    'TRAVEL': 'Travel',
    'RENT_AND_UTILITIES': 'Bills',
    'ENTERTAINMENT': 'Entertainment',
    'SHOPPING': 'Shopping',
    'HEALTHCARE': 'Healthcare',
    'INCOME': 'Salary',
    'TRANSFER': 'Transfer'
};

export class TransactionMapper {
    static mapToAppExpense(bankTx, userId) {
        const category = this.mapCategory(bankTx.category || bankTx.category_id);

        return {
            id: bankTx.transaction_id || crypto.randomUUID(),
            desc: bankTx.name || bankTx.description,
            amount: Math.abs(bankTx.amount),
            type: bankTx.amount < 0 ? 'income' : 'expense',
            dateISO: bankTx.date, // Assuming YYYY-MM-DD from API
            category: category,
            subCategory: bankTx.merchant_name || 'Bank Sync',
            mode: 'Bank Account',
            syncSource: 'plaid',
            bankTransactionId: bankTx.transaction_id,
            timestamp: new Date().toISOString()
        };
    }

    static mapCategory(bankCategory) {
        if (!bankCategory) return 'Other';

        // Simple string matching for now
        const upperCat = String(bankCategory).toUpperCase();
        for (const [key, value] of Object.entries(CategoryMapping)) {
            if (upperCat.includes(key)) return value;
        }

        return 'Other';
    }
}
