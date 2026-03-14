/**
 * Goal Engine - Core Logic for Dream Goals Planner
 * Handles financial calculations, probability scoring, and milestone baseline generation.
 */

export class GoalEngine {
    /**
     * Calculates the required monthly investment to achieve a target amount.
     * Uses the Future Value of an Ordinary Annuity formula.
     * @param {number} targetAmount - Full target amount needed (₹)
     * @param {number} currentSaved - Amount already saved towards this goal (₹)
     * @param {number} months - Time horizon in months
     * @param {number} annualReturn - Expected annual return rate (e.g., 0.12 for 12%)
     * @returns {number} - Required monthly contribution (₹)
     */
    static calculateMonthlyRequired(targetAmount, currentSaved, months, annualReturn = 0.12) {
        if (months <= 0) return Math.max(0, targetAmount - currentSaved);
        
        const monthlyRate = annualReturn / 12;
        
        if (monthlyRate === 0) {
            return Math.max(0, (targetAmount - currentSaved) / months);
        }

        // Future value of existing savings (compound interest)
        const futureValueOfSaved = currentSaved * Math.pow(1 + monthlyRate, months);
        
        const remainingTarget = Math.max(0, targetAmount - futureValueOfSaved);
        
        // Future Value of Ordinary Annuity formula: P = FV * (r / ((1 + r)^n - 1))
        const requiredMonthly = remainingTarget * (monthlyRate / (Math.pow(1 + monthlyRate, months) - 1));
        
        return requiredMonthly;
    }

    /**
     * Determines the probability of reaching the goal based on financial state.
     * @param {number} requiredMonthly - The required monthly contribution
     * @param {object} financialState - User's financial state (from FinancialEngine)
     * @returns {number} - Probability score (0-100)
     */
    static calculateProbability(requiredMonthly, financialState) {
        if (requiredMonthly <= 0) return 100; // Goal already achievable

        // Extract average monthly income and expenses to find surplus
        const avgIncome = financialState.avgMonthlyIncome || 0;
        const avgExpense = financialState.monthlyBurnRate || 0;
        const currentMonthlySurplus = Math.max(0, avgIncome - avgExpense);
        
        // If there's no surplus or income data, use a base fallback of low probability
        if (currentMonthlySurplus === 0 && avgIncome === 0) {
            return 30; // Assuming they might have external funds, but highly risky
        }

        // Ratio of what they have to spare vs what they need
        const ratio = currentMonthlySurplus / requiredMonthly;

        let score = 0;
        if (ratio >= 1.5) {
            score = 95; // Extremely achievable
        } else if (ratio >= 1.0) {
            score = 80 + (ratio - 1.0) * 30; // 80 to 95 
        } else if (ratio >= 0.5) {
            score = 50 + (ratio - 0.5) * 60; // 50 to 80
        } else {
            score = ratio * 100; // 0 to 50
        }

        return Math.min(100, Math.max(5, Math.round(score))); // Clamp between 5 and 100
    }

    /**
     * Generates baseline milestones across the time horizon.
     * AI later overrides/enhances these, but this is a fallback skeleton.
     * @param {number} targetAmount - Full target amount needed
     * @param {number} currentSaved - Amount currently saved
     * @param {number} months - Duration
     * @param {number} requiredMonthly - The required monthly contribution
     * @param {number} annualReturn - Expeted return rate
     * @returns {Array} List of milestone objects
     */
    static generateMilestones(targetAmount, currentSaved, months, requiredMonthly, annualReturn = 0.12) {
        const milestones = [];
        const interval = months <= 12 ? 3 : (months <= 36 ? 6 : 12); // Breakpoints in months
        const monthlyRate = annualReturn / 12;

        let elapsedMonths = interval;
        while (elapsedMonths < months) {
            // How much will be saved by this milestone?
            // FV_Saved + FV_Annuity
            const fvSaved = currentSaved * Math.pow(1 + monthlyRate, elapsedMonths);
            const fvAnnuity = monthlyRate > 0 
                ? requiredMonthly * ((Math.pow(1 + monthlyRate, elapsedMonths) - 1) / monthlyRate)
                : requiredMonthly * elapsedMonths;
                
            const targetAtMilestone = Math.round(fvSaved + fvAnnuity);
            
            milestones.push({
                title: elapsedMonths % 12 === 0 ? `Year ${elapsedMonths / 12} Milestone` : `Month ${elapsedMonths} Checkpoint`,
                target: targetAtMilestone,
                isAchieved: false,
                monthOffset: elapsedMonths
            });
            elapsedMonths += interval;
        }

        // Final Milestone
        milestones.push({
            title: "Goal Achieved! \uD83C\uDF89",
            target: targetAmount,
            isAchieved: false,
            monthOffset: months
        });

        return milestones;
    }
}
