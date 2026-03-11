// gamification-service.js
import { DBService } from './db-service.js';
import { AuthService } from './auth-service.js';

export const GamificationService = {
    // Level formula: Total XP for Level L = 50 * L * (L + 1)
    // Level 0: 0 XP
    // Level 1: 100 XP (50 * 1 * 2)
    // Level 2: 300 XP (50 * 2 * 3)
    // Level 3: 600 XP (50 * 3 * 4)

    async getStats() {
        const user = AuthService.getCurrentUser();
        const uid = AuthService.isLocalOnly() ? null : (user ? user.uid : null);
        const data = await DBService.fetchData(uid, 'userStats');
        const stats = data.find(d => d.id === 'gamification') || { xp: 0, level: 0 };
        return stats;
    },

    async awardPoints(amount) {
        const user = AuthService.getCurrentUser();
        const uid = AuthService.isLocalOnly() ? null : (user ? user.uid : null);
        const currentStats = await this.getStats();

        const newXp = (currentStats.xp || 0) + amount;
        const newLevel = this.calculateLevel(newXp);

        const updatedStats = {
            id: 'gamification',
            xp: newXp,
            level: newLevel,
            lastUpdated: new Date().toISOString()
        };

        await DBService.saveData(uid, 'userStats', 'gamification', updatedStats);

        if (newLevel > currentStats.level) {
            this.triggerLevelUpEffect(newLevel);
        }

        return updatedStats;
    },

    calculateLevel(xp) {
        // Solving 50 * L * (L + 1) = XP
        // 50L^2 + 50L - XP = 0
        // L = [-50 + sqrt(50^2 - 4 * 50 * (-XP))] / (2 * 50)
        // L = [-50 + sqrt(2500 + 200 * XP)] / 100
        if (xp < 100) return 0;

        const L = (-50 + Math.sqrt(2500 + 200 * xp)) / 100;
        return Math.floor(L);
    },

    getXpForLevel(level) {
        if (level === 0) return 0;
        return 50 * level * (level + 1);
    },

    getXpProgress(xp) {
        const currentLevel = this.calculateLevel(xp);
        const xpForCurrent = this.getXpForLevel(currentLevel);
        const xpForNext = this.getXpForLevel(currentLevel + 1);

        const progress = ((xp - xpForCurrent) / (xpForNext - xpForCurrent)) * 100;
        return {
            currentLevel,
            xpInLevel: xp - xpForCurrent,
            xpRequiredForNext: xpForNext - xpForCurrent,
            percent: Math.min(progress, 100)
        };
    },

    triggerLevelUpEffect(newLevel) {
        // Dispatch custom event for UI to listen to
        window.dispatchEvent(new CustomEvent('levelUp', { detail: { level: newLevel } }));
    }
};
