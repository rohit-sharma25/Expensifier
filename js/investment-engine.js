import { DBService } from './db-service.js';

export class InvestmentEngine {
    /**
     * Calculates total value and gain/loss.
     */
    static calculatePortfolioMetrics(holdings, cachedPrices) {
        let totalValue = 0;
        let totalCost = 0;
        let dailyGain = 0;

        holdings.forEach(holding => {
            const qty = holding.quantity || 0;
            const avg = holding.avgPrice || 0;
            const priceData = cachedPrices[holding.symbol];
            const currentPrice = (priceData && typeof priceData === 'object' ? priceData.price : priceData) || avg;
            const prevClose = (priceData && typeof priceData === 'object' ? priceData.prevClose : holding.prevClose) || avg;

            const marketValue = qty * currentPrice;
            const costBasis = qty * avg;

            totalValue += marketValue;
            totalCost += costBasis;

            // Daily gain: (Current Price - Previous Close) * Quantity
            dailyGain += (currentPrice - prevClose) * qty;
        });

        const totalGain = totalValue - totalCost;
        const gainPercentage = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

        // Diversification Score (0-100)
        // Calculated based on concentration in a single asset (use numeric price values)
        let diversificationScore = 100;
        if (holdings.length > 0 && totalValue > 0) {
            const concentrations = holdings.map(h => {
                const priceObj = cachedPrices[h.symbol];
                const priceVal = (priceObj && typeof priceObj === 'object') ? priceObj.price : priceObj || h.avgPrice || 0;
                return (h.quantity * priceVal) / totalValue;
            });
            const maxConcentration = Math.max(...concentrations);
            diversificationScore = Math.max(0, 100 - (maxConcentration * 100));
        }

        return {
            totalValue,
            investedValue: totalCost,
            totalGain,
            gainPercentage,
            dailyGain,
            diversificationScore
        };
    }

    /**
     * Calculates progress for SIP, FD, and RD.
     */
    static calculateSavingsMetrics(sipPlans, fdAccounts, rdAccounts) {
        let totalSaved = 0;
        let totalTarget = 0;

        sipPlans.forEach(sip => {
            totalSaved += sip.currentInvested;
            totalTarget += sip.targetAmount;
        });

        fdAccounts.forEach(fd => {
            totalSaved += fd.principal;
            totalTarget += fd.maturityValue;
        });

        rdAccounts.forEach(rd => {
            totalSaved += rd.currentBalance;
            totalTarget += rd.targetAmount;
        });

        const completionStatus = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

        return {
            totalSaved,
            totalTarget,
            completionStatus
        };
    }

    /**
     * Calculates asset allocation for charting.
     */
    static calculateAllocation(holdings, savingsMetrics, prices = {}) {
        const allocation = {
            'Stocks/Equity': 0,
            'Cash/Gold': 0,
            'Fixed Income': 0
        };

        holdings.forEach(h => {
            const priceData = prices[h.symbol];
            const currentPrice = (priceData && typeof priceData === 'object' ? priceData.price : priceData) || h.avgPrice || 0;
            const val = h.quantity * currentPrice;

            if (h.symbol === 'GOLD' || h.symbol === 'SILVER') allocation['Cash/Gold'] += val;
            else allocation['Stocks/Equity'] += val;
        });

        allocation['Fixed Income'] += (savingsMetrics.totalSaved || 0);

        return allocation;
    }

    /**
     * Estimates monthly passive income from holdings and accounts.
     */
    static calculatePassiveIncome(fdAccounts, sipPlans) {
        let monthly = 0;

        fdAccounts.forEach(fd => {
            // Rough estimate: Principal * ROI / 12
            monthly += (fd.principal * (fd.interestRate / 100)) / 12;
        });

        // Add small yield estimate for stocks/SIPs if any (optional)

        return {
            monthlyEstimated: monthly,
            annualEstimated: monthly * 12
        };
    }

    /**
     * Prepares summary for AI processing.
     */
    static generateSummaryForAI(portfolioMetrics, savingsMetrics) {
        return {
            totalWealth: portfolioMetrics.totalValue + savingsMetrics.totalSaved,
            portfolioGain: portfolioMetrics.gainPercentage,
            diversification: portfolioMetrics.diversificationScore,
            savingsProgress: savingsMetrics.completionStatus,
            riskProfile: portfolioMetrics.diversificationScore < 40 ? 'High' : 'Low'
        };
    }

    /**
     * Smart SIP Booster Logic
     * Suggests a SIP increase based on market dips or extra savings.
     */
    static calculateSmartSIPBoost(sipPlans, financialState, marketPrices) {
        // Provide a default "Starter SIP" of 2000 if none exist
        const hasExistingSIP = sipPlans && sipPlans.length > 0;
        const currentAmount = hasExistingSIP ? sipPlans[0].monthlyAmount : 2000;
        let suggestedBoost = 0;
        let reasons = [];

        // 1. Market Dip Detection
        const marketDip = Object.values(marketPrices).some(p => p.changePercent < -1.5);
        if (marketDip) {
            suggestedBoost += currentAmount * 0.5;
            reasons.push("Market dip detected: Low prices offer high recovery potential.");
        }

        // 2. Savings Surplus Detection
        if (financialState.safetyLevel === 'Stable' && financialState.balanceLeft > (financialState.monthExpenses * 0.2)) {
            const extraSavingsBoost = Math.min(2000, financialState.balanceLeft * 0.1);
            suggestedBoost += extraSavingsBoost;
            if (hasExistingSIP) {
                reasons.push("Healthy savings detected: You have extra capital to invest.");
            } else {
                reasons.push("Healthy savings detected: Start your investment journey today!");
            }
        }

        // Round to nearest 500
        suggestedBoost = Math.ceil(suggestedBoost / 500) * 500;

        // If no boost logic triggered but no SIP exists, suggest starting one with the base amount
        if (suggestedBoost === 0 && !hasExistingSIP) {
            suggestedBoost = 0; // Just keep currentAmount as suggestion
        } else if (suggestedBoost === 0) {
            return null;
        }

        return {
            isStarter: !hasExistingSIP,
            currentAmount,
            boostedAmount: currentAmount + suggestedBoost,
            suggestedIncrease: suggestedBoost,
            reasons: reasons,
            insight: reasons[0] || (hasExistingSIP ? "AI suggests boosting your SIP for better growth." : "Start your wealth building journey with a Smart SIP.")
        };
    }

    /**
     * Calculates future growth for comparison.
     */
    static calculateFutureGrowth(monthlyAmount, rate = 12, years = 15) {
        const monthlyRate = rate / 100 / 12;
        const months = years * 12;
        
        // Final Value = P * [((1 + i)^n - 1) / i] * (1 + i)
        const finalValue = monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
        const totalInvested = monthlyAmount * months;
        const returns = finalValue - totalInvested;

        return {
            totalInvested,
            finalValue,
            returns,
            years
        };
    }
}
