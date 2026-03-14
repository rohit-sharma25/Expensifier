import { AIService } from './ai-service.js';

export class GoalAIService {
    /**
     * Generates a personalized roadmap and strategic insights for a financial goal.
     * Enforces JSON output from Groq.
     * @param {object} goalData - The goal definition (target, months, etc.)
     * @param {object} financialState - User's current financial behavior
     * @returns {Promise<object>} parsed JSON roadmap
     */
    static async generateRoadmap(goalData, financialState) {
        const apiKey = AIService.majesticKey;
        if (!apiKey) throw new Error("API Key missing");

        const prompt = `
You are an elite, highly analytical "Dream Goal Planner" AI. 
The user wants to achieve a financial goal. Your job is to analyze their current financial stats and their goal, then output a structured JSON roadmap.

USER FINANCIAL STATE:
- Avg Monthly Income: ₹${financialState.avgMonthlyIncome || 0}
- Avg Monthly Expenses: ₹${financialState.monthlyBurnRate || 0}
- Current Monthly Surplus (Free Cash Flow): ₹${Math.max(0, (financialState.avgMonthlyIncome || 0) - (financialState.monthlyBurnRate || 0))}

GOAL DETAILS:
- Goal Name: "${goalData.name}"
- Target Amount: ₹${goalData.targetAmount}
- Time Horizon: ${goalData.deadlineValue} ${goalData.deadlineFormat}
- Already Saved for this Goal: ₹${goalData.currentSaved || 0}
- Monthly Required Investment (Math Baseline): ₹${goalData.requiredMonthly || 0}
- Base Probability Score: ${goalData.probabilityScore}%

YOUR TASK:
Return a RAW JSON object (no markdown, no code blocks, just pure JSON). The JSON must match this structure exactly:
{
    "probabilityScore": <number between 0-100, tweak the baseline based on your expert opinion>,
    "aiInsight": "<A punchy, 2-sentence highly encouraging advice/insight string. E.g., 'You need to allocate your entire monthly surplus to this to hit it. Consider shifting assets from your FD.'>",
    "suggestedAllocation": "<e.g., '70% Equity Mutual Funds, 30% FDs'>",
    "milestones": [
        {
            "monthOffset": <number, e.g., 6>,
            "title": "<e.g., 'Quarter 2: Accelerator'>",
            "target": <number, the expected accumulated amount at this point>,
            "isAchieved": false
        }
    ]
}

Make sure to provide 3 to 5 realistic milestones scaling up to the target amount. 
Output ONLY JSON.
        `;

        const payload = {
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3, // Lower temp for more deterministic JSON
            response_format: { type: "json_object" } // Enforce JSON mode
        };

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || "Goal AIService API Error");
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            return JSON.parse(content);

        } catch (error) {
            console.error("Goal AI Generation Failed:", error);
            // Fallback object to keep the UI from breaking
            return {
                probabilityScore: goalData.probabilityScore || 50,
                aiInsight: "We couldn't generate a custom insight right now, but your math looks solid. Stick to the plan!",
                suggestedAllocation: "Balanced (50% Equity / 50% Debt)",
                milestones: goalData.baselineMilestones || []
            };
        }
    }
}
