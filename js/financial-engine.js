/**
 * GEN-3 Expensify Core Engine
 * Behavior-driven financial decision system.
 */

export class FinancialEngine {
    /**
     * Calculates the current financial state.
     */
    static calculateState(finances, monthlyBudget) {
        const now = new Date();
        const year = now.getFullYear();
        const monthNum = now.getMonth() + 1;
        const dayNum = now.getDate();

        const todayStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const currentMonth = `${year}-${String(monthNum).padStart(2, '0')}`;
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const currentDay = dayNum;

        const monthExpenses = finances
            .filter(f => f.type === 'expense' && f.dateISO.startsWith(currentMonth))
            .reduce((sum, f) => sum + f.amount, 0);

        const monthIncome = finances
            .filter(f => f.type === 'income' && f.dateISO.startsWith(currentMonth))
            .reduce((sum, f) => sum + f.amount, 0);

        const balanceLeft = (monthlyBudget || 0) - monthExpenses;
        const burnRatePerDay = currentDay > 0 ? monthExpenses / currentDay : 0;
        const projectedEndBalance = (monthlyBudget || 0) - (burnRatePerDay * daysInMonth);

        let safetyLevel = 'Stable';
        if (projectedEndBalance < 0) safetyLevel = 'Critical';
        else if (projectedEndBalance < (monthlyBudget * 0.15)) safetyLevel = 'Warning';

        return {
            balanceLeft,
            burnRatePerDay,
            projectedEndBalance,
            safetyLevel,
            monthExpenses,
            monthIncome
        };
    }

    /**
     * Runs the Risk Engine to identify financial threats.
     */
    static runRiskEngine(state, monthlyBudget) {
        if (!monthlyBudget) return { overspendRisk: 0, deficitRisk: 0, riskScore: 0 };

        const budgetUsedPercent = (state.monthExpenses / monthlyBudget) * 100;
        const daysPassedPercent = (new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100;

        // Overspend risk: is current spending velocity higher than time elapsed?
        const overspendRisk = Math.max(0, budgetUsedPercent - daysPassedPercent);

        // Deficit risk: probability of ending the month with negative balance
        const deficitRisk = state.projectedEndBalance < 0 ? Math.min(100, Math.abs(state.projectedEndBalance / monthlyBudget) * 100) : 0;

        // Composite risk score (0-100)
        const riskScore = Math.min(100, (overspendRisk * 0.6) + (deficitRisk * 0.4));

        return {
            overspendRisk: Math.round(overspendRisk),
            deficitRisk: Math.round(deficitRisk),
            riskScore: Math.round(riskScore)
        };
    }

    /**
     * Runs the Behavior Model to detect spending patterns.
     */
    static runBehaviorModel(finances) {
        const last7Days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            last7Days.push(dStr);
        }

        const recentExpenses = finances.filter(f => f.type === 'expense' && last7Days.includes(f.dateISO));

        // 1. Detect category spikes
        const catTotals = {};
        recentExpenses.forEach(f => {
            catTotals[f.category] = (catTotals[f.category] || 0) + f.amount;
        });

        const spikes = Object.entries(catTotals)
            .filter(([cat, amount]) => amount > 5000) // Arbitrary threshold for "spike"
            .map(([cat]) => cat);

        // 2. Detect impulse patterns (frequent small-medium purchases in short time)
        const impulseCount = recentExpenses.filter(f => f.amount > 100 && f.amount < 1000).length;
        const hasImpulsePattern = impulseCount > 5;

        // 3. Detect abnormal spending velocity
        const todayPrice = recentExpenses.filter(f => f.dateISO === last7Days[0]).reduce((s, f) => s + f.amount, 0);
        const avgDaily = recentExpenses.reduce((s, f) => s + f.amount, 0) / 7;
        const isAbnormalVelocity = todayPrice > (avgDaily * 2) && todayPrice > 1000;

        // 4. WEEKEND SPIKE DETECTION
        // Compare Sat/Sun average vs Mon-Fri average
        const weekends = recentExpenses.filter(f => {
            const day = new Date(f.dateISO).getDay(); // 0=Sun, 6=Sat
            return day === 0 || day === 6;
        });
        const weekdays = recentExpenses.filter(f => {
            const day = new Date(f.dateISO).getDay();
            return day >= 1 && day <= 5;
        });

        const avgWeekend = weekends.reduce((s, f) => s + f.amount, 0) / (weekends.length || 1);
        const avgWeekday = weekdays.reduce((s, f) => s + f.amount, 0) / (weekdays.length || 1);

        // Flag if weekend spending is > 1.5x weekday spending AND significant amount (> 2000)
        const isWeekendSpike = (avgWeekend > (avgWeekday * 1.5)) && (avgWeekend > 2000);

        // 5. LATE NIGHT SPENDING (10 PM - 5 AM)
        const lateNightCount = recentExpenses.filter(f => {
            if (!f.timestamp) return false; // Legacy data check
            const hour = new Date(f.timestamp).getHours();
            return hour >= 22 || hour <= 5; // 10 PM to 5 AM
        }).length;

        const isLateNightSpike = lateNightCount >= 2; // More than 2 late night orders in 7 days

        return {
            categorySpikes: spikes,
            impulsePattern: hasImpulsePattern,
            abnormalVelocity: isAbnormalVelocity,
            weekendSpike: isWeekendSpike,
            lateNightSpike: isLateNightSpike,
            recentFrequency: recentExpenses.length
        };
    }

    /**
     * Identifies urgent alerts that require user notification.
     */
    static getAlerts(finances, monthlyBudget) {
        const state = this.calculateState(finances, monthlyBudget);
        const risks = this.runRiskEngine(state, monthlyBudget);
        const behavior = this.runBehaviorModel(finances);

        const alerts = [];

        // 1. Budget Alerts
        if (monthlyBudget > 0) {
            const utilization = (state.monthExpenses / monthlyBudget);
            if (utilization >= 0.9) {
                alerts.push({
                    type: 'budget_critical',
                    title: '🛑 Critical Budget Alert',
                    message: `You have exhausted ${Math.round(utilization * 100)}% of your monthly budget!`
                });
            } else if (utilization >= 0.75) {
                alerts.push({
                    type: 'budget_warning',
                    title: '⚠️ Budget Warning',
                    message: `You have used ${Math.round(utilization * 100)}% of your budget.`
                });
            }
        }

        // 2. Velocity Alerts
        if (risks.overspendRisk > 40) {
            alerts.push({
                type: 'velocity_spike',
                title: '⚡ Spending Spike',
                message: 'Your spending velocity is significantly higher than usual for this time of month.'
            });
        }

        // 3. Behavioral Alerts
        if (behavior.lateNightSpike) {
            alerts.push({
                type: 'behavior_anomaly',
                title: '🌙 Late Night Spending',
                message: 'We noticed multiple late-night transactions. Consider setting a curfew for shopping apps!'
            });
        }

        if (behavior.abnormalVelocity) {
            alerts.push({
                type: 'velocity_spike',
                title: '📈 Unusual Activity',
                message: 'Your spending today is more than double your daily average.'
            });
        }

        return alerts;
    }
}
