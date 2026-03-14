// js/profile.js
import { AuthService } from './auth-service.js';
import { DBService } from './db-service.js';
import { GamificationService } from './gamification-service.js';
import { db } from './firebase-config.js';
import { doc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { AIService } from './ai-service.js';
import { FinancialEngine } from './financial-engine.js';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
    AuthService.onUserChange(async (user) => {
        if (user) {
            renderUserInfo(user);
            await renderGamificationStats();
            await initTelegramSync(user.uid);
            await initBankSync(user.uid);
            
            // Fetch budget first
            const budgetData = await DBService.fetchData(user.uid, 'monthlyBudget');
            const settings = budgetData.find(b => b.id === 'settings');
            const monthlyBudget = settings ? settings.value : 0;

            // Subscribe to finances to keep UI and AI context fresh
            DBService.subscribe(user.uid, 'finances', (data) => {
                const state = FinancialEngine.calculateState(data, monthlyBudget);
                const risks = FinancialEngine.runRiskEngine(state, monthlyBudget);
                const behavior = FinancialEngine.runBehaviorModel(data);
                
                renderFinancialSummary(data, state, risks, monthlyBudget);

                AIService.init({
                    fab: document.getElementById('ai-chat-fab'),
                    popup: document.getElementById('ai-chat-popup'),
                    close: document.getElementById('ai-chat-close'),
                    input: document.getElementById('ai-chat-input'),
                    send: document.getElementById('ai-chat-send'),
                    body: document.getElementById('ai-chat-body')
                }, () => ({
                    finances: data,
                    budget: monthlyBudget,
                    engineState: { state, risks, behavior }
                }));
            });

        } else {
            const isLocal = AuthService.isLocalOnly();
            if (isLocal) {
                renderUserInfo({
                    displayName: "Guest User",
                    email: "Local Mode",
                    photoURL: "https://ui-avatars.com/api/?name=Guest&background=5B6CF2&color=fff"
                });
                await renderGamificationStats();
                
                const budgetData = await DBService.fetchData(null, 'monthlyBudget');
                const settings = budgetData.find(b => b.id === 'settings');
                const monthlyBudget = settings ? settings.value : 0;
                
                // For local, we can just fetch once or listen if needed.
                // Reusing sub for simplicity
                DBService.subscribe(null, 'finances', (data) => {
                    const state = FinancialEngine.calculateState(data, monthlyBudget);
                    const risks = FinancialEngine.runRiskEngine(state, monthlyBudget);
                    renderFinancialSummary(data, state, risks, monthlyBudget);
                });
            } else {
                window.location.href = 'index.html';
            }
        }
    });
});

function renderUserInfo(user) {
    document.getElementById('profile-name').textContent = user.displayName || "User";
    document.getElementById('profile-email').textContent = user.email || "Offline Account";

    const photoElement = document.getElementById('profile-photo');
    if (photoElement) {
        const displayName = user.displayName || "User";
        const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=5B6CF2&color=fff`;
        const photoUrl = user.photoURL || fallbackUrl;

        photoElement.src = photoUrl;
        photoElement.onerror = () => {
            photoElement.src = fallbackUrl;
        };
    }
}

async function renderGamificationStats() {
    const stats = await GamificationService.getStats();
    const progress = GamificationService.getXpProgress(stats.xp || 0);

    document.getElementById('profile-level').textContent = stats.level;
    document.getElementById('current-xp').textContent = stats.xp;
    document.getElementById('next-level-xp').textContent = GamificationService.getXpForLevel(progress.currentLevel + 1);
    document.getElementById('xp-bar-fill').style.width = `${progress.percent}%`;
    document.getElementById('xp-away').textContent = progress.xpRequiredForNext - progress.xpInLevel;
    document.getElementById('next-level-num').textContent = progress.currentLevel + 1;
    document.getElementById('total-xp-earned').textContent = `${stats.xp || 0} XP`;

    // Rank logic - RPG Style
    const ranks = ["NOVICE", "APPRENTICE", "SAVER", "STRATEGIST", "ELITE", "MAESTRO", "FINANCE SENSEI", "WEALTH GRANDMASTER"];
    const rankIndex = Math.min(Math.floor(stats.level / 2), ranks.length - 1);
    const rankElement = document.getElementById('rank-name');
    if (rankElement) {
        rankElement.textContent = ranks[rankIndex];
        // Dynamic colors for high ranks
        if (stats.level >= 10) rankElement.style.color = '#FFD700'; // Gold
        else if (stats.level >= 6) rankElement.style.color = '#A78BFA'; // Violet
    }

    await renderAchievements(stats);
}

async function renderAchievements(stats) {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;

    // Standard achievements logic
    const achievements = [
        { id: 'starter', icon: '🚀', title: 'Fast Starter', desc: 'Add 3 transactions', check: (s) => (s.xp || 0) >= 100 },
        { id: 'saver', icon: '💎', title: 'Wealth Builder', desc: 'Reach Level 5', check: (s) => (s.level || 0) >= 5 },
        { id: 'master', icon: '🔥', title: 'Finance Master', desc: 'Reach Level 10', check: (s) => (s.level || 0) >= 10 }
    ];

    let unlockedCount = 0;
    grid.innerHTML = achievements.map(a => {
        const isUnlocked = a.check(stats);
        if (isUnlocked) unlockedCount++;
        
        return `
            <div class="achievement-item animate-fade-in-up" style="${isUnlocked ? '' : 'opacity: 0.6; filter: grayscale(1);'}">
                <span class="achievement-icon">${a.icon}</span>
                <h4 style="font-weight: 800; margin-bottom: 8px; color: white;">${a.title}</h4>
                <p style="font-size: 0.85rem; color: #64748B;">${a.desc}</p>
                <span class="status-badge ${isUnlocked ? 'status-unlocked' : 'status-locked'}">
                    ${isUnlocked ? 'UNLOCKED' : 'LOCKED'}
                </span>
            </div>
        `;
    }).join('');

    const countElement = document.getElementById('achievement-count');
    if (countElement) countElement.textContent = unlockedCount;
}

function renderFinancialSummary(finances, state, risks, monthlyBudget) {
    document.getElementById('total-tx').textContent = finances.length;

    // 1. Calculate and Render Savings Score (Grade)
    const scoreElement = document.getElementById('savings-score');
    if (scoreElement) {
        let grade = 'A+';
        let color = '#00D09C'; // Neon Green

        if (monthlyBudget > 0) {
            const risk = risks.riskScore || 0;
            if (risk < 20) { grade = 'A+'; color = '#00D09C'; }
            else if (risk < 40) { grade = 'B'; color = '#34D399'; }
            else if (risk < 60) { grade = 'C'; color = '#FBBF24'; }
            else if (risk < 80) { grade = 'D'; color = '#F59E0B'; }
            else { grade = 'F'; color = '#EF4444'; }
        } else {
            grade = 'N/A';
            color = '#64748B';
        }

        scoreElement.textContent = grade;
        scoreElement.style.color = color;
    }

    // 2. Projected Balance / Burn Rate logic
    const projectedElement = document.getElementById('projected-balance');
    if (projectedElement) {
        const amt = state.projectedEndBalance || 0;
        projectedElement.textContent = `₹${Math.abs(Math.round(amt)).toLocaleString('en-IN')}${amt < 0 ? ' (Deficit)' : ''}`;
        projectedElement.style.color = amt < 0 ? '#EF4444' : '#00D09C';
    }

    if (finances.length > 0) {
        // Top Category
        const cats = {};
        finances.forEach(f => {
            if (f.type === 'expense') cats[f.category] = (cats[f.category] || 0) + 1;
        });
        const sortedCats = Object.entries(cats).sort((a, b) => b[1] - a[1]);
        const top = sortedCats[0];
        if (top) document.getElementById('top-category').textContent = top[0];

        // Active Days
        const dates = new Set(finances.map(f => f.dateISO));
        document.getElementById('active-days').textContent = dates.size;
        
        // Burn Rate
        const burnElement = document.getElementById('daily-burn');
        if (burnElement) {
            burnElement.textContent = `₹${Math.round(state.burnRatePerDay || 0).toLocaleString('en-IN')}/day`;
        }
    }
}

async function initTelegramSync(uid) {
    const syncCard = document.getElementById('telegram-sync-card');
    const syncCodeText = document.getElementById('sync-code-text');
    const generateSyncBtn = document.getElementById('generate-sync-btn');
    const linkedStatus = document.getElementById('linked-status');
    const syncInstruction = document.getElementById('sync-instruction');

    if (!syncCard) return;

    // Check if already linked
    const userProfile = await DBService.getUserProfile(uid);
    if (userProfile && userProfile.telegramLinked) {
        linkedStatus.style.display = 'block';
        generateSyncBtn.style.display = 'none';
        syncInstruction.style.display = 'none';
        return;
    }

    // Handle Generate Sync Code
    generateSyncBtn.addEventListener('click', async () => {
        generateSyncBtn.disabled = true;
        generateSyncBtn.textContent = 'Generating...';

        try {
            if (!uid) throw new Error('User UID is missing. Please log in again.');

            // Generate 6-digit Sync Code
            const code = Math.floor(100000 + Math.random() * 900000).toString();

            // Using a plain Date object which Firestore handles as a Timestamp
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            console.log('🔗 Attempting to save sync code to Firestore root collection...');

            // Save directly to Firestore 
            // NOTE: This requires 'syncCodes' collection to have write permissions for authenticated users
            await setDoc(doc(db, 'syncCodes', code), {
                uid: uid,
                expiresAt: expiresAt,
                createdAt: new Date()
            });

            syncCodeText.textContent = code;
            syncCodeText.style.display = 'block';
            generateSyncBtn.style.display = 'none';

            syncInstruction.innerHTML = `Send code <b>${code}</b> to <a href="https://t.me/ExpensifierBot" target="_blank" style="color: #24A1DE; font-weight: 700;">@ExpensifierBot</a><br><small>(Expires in 10 mins)</small>`;
        } catch (err) {
            console.error('Frontend Sync Code Error:', err);
            generateSyncBtn.disabled = false;
            generateSyncBtn.textContent = 'Try Again';

            // Helping the user identify if it's a permission issue or something else
            const errorMsg = err.code === 'permission-denied'
                ? 'Permission Denied: Please check your Firebase Firestore rules for "syncCodes" collection.'
                : err.message;
            showToast('Sync Error: ' + errorMsg, 'error', 5000);
        }
    });
}

// Logout Logic
document.getElementById('logout-btn')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to logout?')) {
        await AuthService.logout();
        window.location.href = 'index.html';
    }
});

async function initBankSync(uid) {
    const setupBtn = document.getElementById('setup-bank-sync-btn');
    const syncDisplay = document.getElementById('sync-key-display');
    const secretKeyDisplay = document.getElementById('sms-secret-key');
    const webhookUrlDisplay = document.getElementById('webhook-url');
    const copyKeyBtn = document.getElementById('copy-secret-btn');
    const copyUrlBtn = document.getElementById('copy-webhook-btn');

    if (!setupBtn) return;

    // Load existing key if any
    const profile = await DBService.getUserProfile(uid);
    if (profile && profile.smsSyncKey) {
        syncDisplay.style.display = 'block';
        setupBtn.textContent = 'Regenerate Key';
        secretKeyDisplay.textContent = profile.smsSyncKey;
    }

    setupBtn.addEventListener('click', async () => {
        if (setupBtn.textContent.includes('Regenerate') && !confirm('Regenerating will invalidate your current key. Continue?')) {
            return;
        }

        setupBtn.disabled = true;
        setupBtn.textContent = 'Generating...';

        try {
            // Generate a secure random alphanumeric key (16 chars)
            const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            let newKey = "";
            for (let i = 0; i < 16; i++) {
                newKey += charset.charAt(Math.floor(Math.random() * charset.length));
            }

            // Save to Firestore
            await setDoc(doc(db, 'users', uid), {
                smsSyncKey: newKey
            }, { merge: true });

            secretKeyDisplay.textContent = newKey;
            syncDisplay.style.display = 'block';
            setupBtn.textContent = 'Regenerate Key';
            showToast('Sync Key Generated!', 'success');
        } catch (err) {
            console.error('Bank Sync Key Error:', err);
            showToast('Failed to generate key', 'error');
        } finally {
            setupBtn.disabled = false;
        }
    });

    // Copying logic
    copyKeyBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(secretKeyDisplay.textContent);
        showToast('Key copied to clipboard', 'success');
    });

    copyUrlBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(webhookUrlDisplay.textContent);
        showToast('Webhook URL copied', 'success');
    });
}
