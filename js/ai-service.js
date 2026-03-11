import { CONFIG } from './config.js';

export class AIService {
    /**
     * Smart Key Rotation System
     */
    static get majesticKey() {
        if (!CONFIG.GROQ_API_KEYS || CONFIG.GROQ_API_KEYS.length === 0) {
            // Fallback for backward compatibility
            return CONFIG.GROQ_API_KEY || null;
        }
        // Random Load Balancing
        const randomIndex = Math.floor(Math.random() * CONFIG.GROQ_API_KEYS.length);
        return CONFIG.GROQ_API_KEYS[randomIndex];
    }

    /**
     * Chat with Auto-Retry (Failover)
     */
    static async chatWithRetry(payload, attempt = 0) {
        if (attempt > 3) throw new Error("All API keys exhausted or service down.");

        const currentKey = this.majesticKey;
        if (!currentKey) throw new Error("No API Key configured.");

        try {
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${currentKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // If Rate Limit (429) or Auth Error (401), retry
                if (response.status === 429 || response.status === 401) {
                    console.warn(`Key failed (${response.status}). Retrying with fresh key...`);
                    return this.chatWithRetry(payload, attempt + 1);
                }
                const err = await response.json();
                throw new Error(err.error?.message || "Groq API Error");
            }

            return await response.json();
        } catch (error) {
            console.warn("Retrying due to network/API error:", error);
            // Simple exponential backoff could be added here, but for now just retry
            return this.chatWithRetry(payload, attempt + 1);
        }
    }

    static async chat(message, context) {
        if (!this.majesticKey) {
            return "Please add your Groq API Key in `js/config.js` to enable the AI assistant.";
        }

        // Detect if this is investment context or expense context
        const isInvestmentContext = context.portfolioMetrics || context.investments;

        let systemPrompt = "";

        if (isInvestmentContext) {
            // Investment Portfolio Context
            const {
                portfolioMetrics = {},
                savingsMetrics = {},
                totalWealth = 0,
                totalGain = 0,
                gainPercentage = 0,
                investments = [],
                sipPlans = [],
                fdAccounts = [],
                rdAccounts = []
            } = context;

            const holdingsCount = investments.length;
            const totalSipCount = sipPlans.length;
            const totalFdCount = fdAccounts.length;
            const totalRdCount = rdAccounts.length;

            // Format holdings for AI
            const holdingsList = investments.map(h => {
                const priceData = context.prices ? context.prices[h.symbol] : null;
                const price = (priceData && typeof priceData === 'object' ? priceData.price : priceData) || h.avgPrice || 0;
                const gain = (price - h.avgPrice) * h.quantity;
                return `- ${h.name || h.symbol}: ${h.quantity} units @ ₹${h.avgPrice.toLocaleString()} (Current: ₹${price.toLocaleString()}, Gain: ₹${Math.round(gain).toLocaleString()})`;
            }).join('\n');

            const sipList = sipPlans.map(s => `- SIP ${s.name}: ₹${s.monthlyAmount.toLocaleString()}/mo (Total Saved: ₹${s.currentInvested.toLocaleString()})`).join('\n');

            systemPrompt = `
                You are "GROWW Investment Advisor", a premium and friendly investment portfolio consultant.
                
                CRITICAL PORTFOLIO FACTS:
                - Total Portfolio Value: ₹${Math.round(totalWealth).toLocaleString('en-IN')}
                - Total Gains/Losses: ${totalGain >= 0 ? '+' : ''}₹${Math.round(totalGain).toLocaleString('en-IN')} (${gainPercentage.toFixed(2)}%)
                - Daily Returns: ₹${Math.round(portfolioMetrics.dailyGain || 0).toLocaleString('en-IN')}
                
                DETAILED HOLDINGS:
                ${holdingsList || 'No stocks/commodities yet.'}
                
                ACTIVE SAVINGS/DEPOSITS:
                ${sipList || 'No active SIPs.'}
                Fds: ${totalFdCount}, Rds: ${totalRdCount}
                
                Your Responsibilities:
                1. Provide portfolio analysis based on exact data above.
                2. If asked about a specific stock (e.g., Reliance), use the data from DETAILED HOLDINGS.
                3. Suggest rebalancing if portfolio is too concentrated.
                4. Recommend diversification with specific asset classes.
                
                Instructions:
                - Keep responses concise (max 4-5 sentences).
                - Use emojis and markdown (**bold**).
                - Always reference actual values from the lists above when discussing specific assets.
                - Be encouraging but realistic about market conditions.
            `;
        } else {
            // Expense Tracking Context (Original)
            const { finances = [], budget = 0, engineState = {} } = context;
            const { state = {}, risks = {}, behavior = {} } = engineState;

            // Get 10 most recent expenses
            const recentExpenses = finances
                .filter(f => f.type === 'expense')
                .sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO))
                .slice(0, 10)
                .map(f => `- ${f.dateISO}: ${f.desc} (₹${f.amount}) [${f.category}]`)
                .join('\n');

            systemPrompt = `
                You are "Expensify AI", a premium, friendly financial advisor.
                
                CRITICAL DASHBOARD FACTS:
                - Monthly Budget: ₹${budget.toLocaleString('en-IN')}
                - Current Spending: ₹${(state.monthExpenses || 0).toLocaleString('en-IN')}
                - Health Score: ${risks.riskScore || 0}/100
                - Risk Level: ${state.safetyLevel || 'Stable'}
                
                RECENT TRANSACTIONS:
                ${recentExpenses || 'No recent expenses recorded.'}
                
                Instructions:
                - You MUST use the values and transactions above.
                - If asked about "recent expenses" or "where did I spend money", refer to the RECENT TRANSACTIONS list.
                - Keep responses concise (max 3-4 sentences).
                - Use emojis and markdown (**bold**).
            `;
        }

        try {
            const data = await this.chatWithRetry({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                temperature: 0.7,
                max_tokens: 500
            });

            let aiText = data.choices[0].message.content;

            // Simple Markdown Processing
            aiText = aiText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            aiText = aiText.replace(/\n/g, '<br>');

            return aiText;
        } catch (error) {
            console.error("Groq Error:", error);
            throw error;
        }
    }

    /**
     * Stable UI Handler
     */
    static init(elements, getContext) {
        const { fab, popup, close, input, send, body } = elements;

        if (!fab || !popup || !input) return;

        fab.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpening = popup.classList.contains('hidden');
            popup.classList.toggle('hidden');

            if (isOpening) {
                setTimeout(() => {
                    input.focus();
                }, 100);
            }
        });

        close?.addEventListener('click', () => popup.classList.add('hidden'));

        document.addEventListener('click', (e) => {
            if (!popup.contains(e.target) && !fab.contains(e.target)) {
                popup.classList.add('hidden');
            }
        });

        const sendMessage = async () => {
            const text = input.value.trim();
            if (!text) return;

            this.appendMessage(body, text, 'user');
            input.value = '';

            const aiMsg = this.appendMessage(body, '<span class="typing-dots">Thinking...</span>', 'ai');

            try {
                const response = await this.chat(text, getContext());
                aiMsg.innerHTML = response;
            } catch (err) {
                aiMsg.innerHTML = `<span style="color:var(--danger)">Error: ${err.message}</span><br><small style="color:var(--muted)">Ensure your GROQ_API_KEY is valid in config.js</small>`;
            }

            body.scrollTop = body.scrollHeight;
        };

        send?.addEventListener('click', sendMessage);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    static appendMessage(container, text, type) {
        const div = document.createElement('div');
        div.className = `msg-${type}`;
        div.innerHTML = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return div;
    }

    static async generateDashboardInsight(context) {
        if (!this.majesticKey) return null;

        // CACHE CHECK (10 Minutes)
        const CACHE_KEY = 'expensify_dashboard_insight';
        const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION) {
                console.log("[AI] Serving Dashboard Insight from Cache");
                return data;
            }
        }

        const { budget, state, risks, behavior } = context;

        const systemPrompt = `
            You are "Expensify Financial Manager", a high-end personal wealth advisor.
            Your goal is to provide a single, actionable, and professional financial insight.
            
            Context:
            - Budget: ₹${budget}
            - Spent: ₹${state.monthExpenses}
            - Safety Level: ${state.safetyLevel}
            - Risk Score: ${risks.riskScore}/100
            - Behavior: ${behavior.categorySpikes.length > 0 ? 'Spikes in ' + behavior.categorySpikes.join(', ') : 'Stable'}
            - Impulse Pattern: ${behavior.impulsePattern ? 'Detected' : 'None'}
            - Weekend Spike: ${behavior.weekendSpike ? 'DETECTED (>1.5x weekday avg)' : 'None'}
            - Late Night Spike: ${behavior.lateNightSpike ? 'DETECTED (>10PM spending)' : 'None'}
            
            Rules:
            1. MAX 20 WORDS.
            2. Be extremely specific and actionable.
            3. No generic advice like "save more".
            4. If 'Weekend Spike' is DETECTED, bluntly warn about weekend overspending.
            5. If 'Late Night Spike' is DETECTED, warn about late-night impulse buys.
            6. Sound like a premium human manager (slightly strict but helpful).
            
            Example: "Your dining velocity is 2x average. Cut luxury spending by ₹2k this week to stay on track."
            Example (Weekend): "Weekend spending is 50% higher than weekdays. Limit social outings this Saturday."
            Example (Late Night): "Late-night orders identified. Avoid shopping apps after 10PM to prevent impulse buys."
        `;

        try {
            const data = await this.chatWithRetry({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Provide manager insight based on the exact context provided." }
                ],
                temperature: 0.5,
                max_tokens: 100
            });

            const insight = data.choices[0].message.content.trim();

            // SAVE TO CACHE
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: insight
            }));

            return insight;
        } catch (error) {
            console.error("Dashboard AI Error:", error);
            return null;
        }
    }

    static async generateInvestmentInsight(context) {
        if (!this.majesticKey) return null;

        // CACHE CHECK (1 Hour)
        const CACHE_KEY = 'expensify_investment_insight';
        const CACHE_DURATION = 60 * 60 * 1000; // 1 Hour

        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION) {
                console.log("[AI] Serving Investment Insight from Cache");
                return data;
            }
        }

        const { totalWealth, portfolioGain, diversification, savingsProgress, riskProfile } = context;

        const systemPrompt = `
            You are "Wall Street Analyst", a sharp, high - conviction investment strategist.
            Your job is to spot GAPS in the portfolio and suggest SPECIFIC assets(Stocks / Gold / MFs).

            Context:
        - Net Wealth: ₹${totalWealth}
        - Portfolio Gain: ${portfolioGain.toFixed(2)}%
            - Diversification Score: ${diversification}/100
                - Risk Profile: ${riskProfile}
            
            Analysis Logic:
        1. If Diversification < 40: "Portfolio is too concentrated. Buy Nifty 50 Index Fund for stability."
        2. If Gain < 5 %: "Returns are sluggish. Consider high-growth stocks like Tata Motors or HAL."
        3. If Risk is 'High': "High risk detected. Hedge with Gold (SGB) or FD."
        4. If Wealth > 1L and Gold is missing: "Add Gold to your portfolio for recession-proofing."

        Rules:
        1. MAX 15 - 20 WORDS.
            2. Be direct.Use names(Nifty 50, Gold, Tata, HDFC).
            3. No vague advice like "research more".

            Example: "Equity exposure is high. Buy Gold Bees or Sovereign Gold Bonds to hedge against market crash."
                `;

        try {
            const data = await this.chatWithRetry({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Provide specific investment recommendation." }
                ],
                temperature: 0.6,
                max_tokens: 100
            });

            const insight = data.choices[0].message.content.trim();

            // SAVE TO CACHE
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: insight
            }));

            return insight;
        } catch (error) {
            console.error("Investment AI Error:", error);
            return null;
        }
    }

    /**
     * AI-Powered SMS Parsing Fallback
     */
    static async parseSMSWithAI(text) {
        if (!this.majesticKey) return null;

        const systemPrompt = `
            You are "Expensify SMS Engine". Your job is to extract data from bank transaction SMS.
            Extract: Amount (Number), Type (expense/income), Description (Merchant name or recipient), Category (One of: Food & Grocery, Traveling, Shopping, Bill & Subscription, Investment, Peoples, LLM Models, Miscellaneous), Date (YYYY-MM-DD).

            Valid Categories:
            - Food & Grocery (Resturants, UberEats, Supermarkets)
            - Traveling (Cabs, Flights, Petrol, Trains)
            - Shopping (Amazon, Retail, Clothing)
            - Bill & Subscription (Netflix, Mobile Recharge, Electricity)
            - Investment (Stocks, Mutual Funds, Gold)
            - Peoples (Transfer to friends/family)
            - LLM Models (OpenAI, Anthropic, etc.)
            - Miscellaneous (Everything else)

            Return ONLY a JSON object:
            {"amount": 500.0, "type": "expense", "description": "Zomato", "category": "Food & Grocery", "date": "2023-12-01"}
        `;

        try {
            const data = await this.chatWithRetry({
                model: "llama-3.1-8b-instant", // Use faster/cheaper model for parsing
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Parse this SMS: "${text}"` }
                ],
                temperature: 0.1, // Low temperature for extraction accuracy
                response_format: { type: "json_object" }
            });

            const result = JSON.parse(data.choices[0].message.content);
            return result;
        } catch (error) {
            console.error("AI SMS Parse Error:", error);
            return null;
        }
    }
}

