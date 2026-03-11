// js/bank-sync-service.js
import { AuthService } from './auth-service.js';
import { DBService } from './db-service.js';
import { TransactionMapper } from './transaction-mapper.js';

export class BankSyncService {
    static async initLink() {
        console.log("🔗 Initializing Bank Link Flow...");
        // In a real app, this would call your Firebase Function to get a link_token
        // For this demo/implementation, we'll simulate the linking process

        const confirmed = confirm("This will open the Secure Bank Link interface. Proceed?");
        if (!confirmed) return;

        try {
            // Simulate API call to backend
            const mockPublicToken = "public-sandbox-" + Math.random().toString(36).substring(7);
            await this.exchangeToken(mockPublicToken);
            alert("✅ Bank Account Linked Successfully!");
        } catch (error) {
            console.error("Link Error:", error);
            alert("❌ Failed to link bank account.");
        }
    }

    static async exchangeToken(publicToken) {
        const user = AuthService.getCurrentUser();
        const uid = user ? user.uid : 'guest';

        // Save mock access token/metadata to user profile
        await DBService.saveData(uid, 'bankConfig', 'connection', {
            linked: true,
            provider: 'Plaid (Sandbox)',
            lastSync: new Date().toISOString(),
            status: 'active'
        });
    }

    static async syncTransactions() {
        console.log("🔄 Syncing Bank Transactions...");
        const user = AuthService.getCurrentUser();
        const uid = user ? user.uid : 'guest';

        try {
            // 1. Fetch from mock backend (Simulated)
            const mockTransactions = [
                { transaction_id: 'tx_1', name: 'Starbucks', amount: 150.00, date: new Date().toISOString().split('T')[0], category: 'FOOD_AND_DRINK' },
                { transaction_id: 'tx_2', name: 'Apple Music', amount: 99.00, date: new Date().toISOString().split('T')[0], category: 'ENTERTAINMENT' },
                { transaction_id: 'tx_3', name: 'Zomato Office Lunch', amount: 450.00, date: new Date().toISOString().split('T')[0], category: 'FOOD_AND_DRINK' }
            ];

            // 2. Fetch existing to avoid duplicates
            const existing = await DBService.fetchData(uid, 'finances');
            const existingIds = new Set(existing.map(f => f.bankTransactionId).filter(Boolean));

            // 3. Map and Save
            let newCount = 0;
            for (const tx of mockTransactions) {
                if (!existingIds.has(tx.transaction_id)) {
                    const appExpense = TransactionMapper.mapToAppExpense(tx, uid);
                    await DBService.saveData(uid, 'finances', appExpense.id, appExpense);
                    newCount++;
                }
            }

            // 4. Update last sync time
            await DBService.saveData(uid, 'bankConfig', 'connection', {
                linked: true,
                lastSync: new Date().toISOString()
            });

            return newCount;
        } catch (error) {
            console.error("Sync Error:", error);
            throw error;
        }
    }

    static async isLinked() {
        const user = AuthService.getCurrentUser();
        const uid = user ? user.uid : 'guest';
        const config = await DBService.fetchData(uid, 'bankConfig');
        const connection = config.find(c => c.id === 'connection');
        return connection?.linked || false;
    }
}
