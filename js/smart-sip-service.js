import { InvestmentEngine } from './investment-engine.js';
import { FinancialEngine } from './financial-engine.js';

export class SmartSIPService {
    static getBoostSuggestion(sipPlans, finances, budget, marketPrices) {
        const financialState = FinancialEngine.calculateState(finances, budget);
        const boostData = InvestmentEngine.calculateSmartSIPBoost(sipPlans, financialState, marketPrices);
        
        if (!boostData) return null;

        // Calculate growth comparison
        const currentGrowth = InvestmentEngine.calculateFutureGrowth(boostData.currentAmount);
        const boostedGrowth = InvestmentEngine.calculateFutureGrowth(boostData.boostedAmount);

        return {
            ...boostData,
            growthComparison: {
                current: currentGrowth,
                boosted: boostedGrowth,
                extraReturns: boostedGrowth.returns - currentGrowth.returns
            }
        };
    }
}
