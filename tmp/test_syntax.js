
        import { AuthService } from './js/auth-service.js';
        import { DBService } from './js/db-service.js';
        import { AIService } from './js/ai-service.js';
        import { PriceService } from './js/price-service.js';
        import { InvestmentEngine } from './js/investment-engine.js';
        import { FinancialEngine } from './js/financial-engine.js';
        import { NotificationService } from './js/notification-service.js';
        import { SmartSIPService } from './js/smart-sip-service.js';
        import { GoalEngine } from './js/goal-engine.js';
        import { GoalAIService } from './js/goal-ai-service.js';

        let contextData = {
            investments: { holdings: [], sipPlans: [], fdAccounts: [], rdAccounts: [], prices: {} },
            expenses: [],
            goals: []
        };
        let portfolioChart = null;
        let portfolioHistory = [];
        let currentUser = null;
        let activeModalTab = 'tab-stock';
        let syncInterval = null;
        let lastChartData = null;

        // Debounce utility to prevent excessive re-renders
        function debounce(func, wait = 500) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // Tab Logic
        document.querySelectorAll('.invest-nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.invest-nav-link').forEach(l => l.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                link.classList.add('active');
                document.getElementById(link.dataset.tab).classList.add('active');
            });
        });

        // Theme Toggle Logic
        const themeToggle = document.getElementById('theme-toggle');
        const body = document.body;

        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'light') {
            body.classList.add('light-mode');
            themeToggle.textContent = '☀️';
        }

        themeToggle.addEventListener('click', () => {
            body.classList.toggle('light-mode');
            const isLight = body.classList.contains('light-mode');
            themeToggle.textContent = isLight ? '☀️' : '🌙';
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            
            // Re-render chart to pick up theme colors if needed
            if (portfolioChart) {
                renderPortfolioChart(lastChartData);
            }
        });

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            // Escape to close modals/chat
            if (e.key === 'Escape') {
                document.getElementById('add-holding-modal').style.display = 'none';
                const aiChatPopup = document.getElementById('ai-chat-popup');
                if (aiChatPopup && !aiChatPopup.classList.contains('hidden')) {
                    aiChatPopup.classList.add('hidden');
                }
            }
            // 'I' to open Add Investment modal
            if (e.key.toLowerCase() === 'i' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                document.getElementById('add-holding-modal').style.display = 'flex';
                // Focus first input
                setTimeout(() => {
                    const firstInput = document.querySelector('#add-holding-modal input[type="text"]');
                    if (firstInput) firstInput.focus();
                }, 100);
            }
        });

        // Modal Tab Logic
        document.querySelectorAll('.modal-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.modal-tab').forEach(t => {
                    t.classList.remove('active');
                    t.style.color = 'var(--muted)';
                    t.style.borderBottom = 'none';
                });
                document.querySelectorAll('.modal-section').forEach(s => s.style.display = 'none');

                tab.classList.add('active');
                tab.style.color = 'var(--text)';
                tab.style.borderBottom = '2px solid var(--groww-green)';
                document.getElementById(tab.dataset.target).style.display = 'block';
                activeModalTab = tab.dataset.target;
            });
        });

        // DOM Elements for Auth
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const loggedOutView = document.getElementById('logged-out-view');
        const userInfo = document.getElementById('user-info');
        const userName = document.getElementById('user-name');
        const userEmail = document.getElementById('user-email');
        const userPhoto = document.getElementById('user-photo');

        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                try { await AuthService.login(); } catch (e) { showToast(e.message, 'error'); }
            });
        }

        AuthService.onUserChange(async (user) => {
            currentUser = user;
            if (user) {
                if (userInfo) userInfo.classList.remove('hidden');
                if (loggedOutView) loggedOutView.classList.add('hidden');
                if (userName) userName.textContent = user.displayName || "Unknown User";
                if (userEmail) userEmail.textContent = user.email || "";
                if (userPhoto) {
                    userPhoto.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=5B6CF2&color=fff`;
                }

                // 🔔 Request notification permission early (before any alerts are triggered)
                if (NotificationService.isSupported() && Notification.permission === 'default') {
                    NotificationService.requestPermission()
                        .then(permission => {
                            console.log('📢 Notification permission:', permission);
                            if (permission === 'granted') {
                                NotificationService.show('Investment Alerts Active', 'You\'ll receive portfolio and price notifications.');
                            }
                        })
                        .catch(err => console.warn('⚠️ Notification permission request failed:', err));
                }

                loadData(user.uid);
            } else {
                if (userInfo) userInfo.classList.add('hidden');
                if (loggedOutView) loggedOutView.classList.remove('hidden');
                // Optional: handle local mode or guest
                const isLocal = AuthService.isLocalOnly(); // Assuming this method exists or similar logic
                // For now, if logged out, we might want to show empty state or guest
                if (AuthService.isLocalOnly && AuthService.isLocalOnly()) {
                    // Local mode handling if needed
                }
                loadData(null);
            }
            updateHeaderLevel();
        });

        async function loadData(uid) {
            // Create debounced version of updateUI to prevent excessive renders
            const debouncedUpdateUI = debounce(() => {
                updateUI();
            }, 300);

            // ⚡ Force initial render for immediate visibility
            updateUI();

            // Subscriptions
            DBService.subscribe(uid, 'holdings', (data) => {
                contextData.investments.holdings = data;
                debouncedUpdateUI();
                // 🔔 Process investment alerts when holdings change
                processInvestmentAlerts(data, contextData.investments.prices);
            });

            DBService.subscribe(uid, 'sipPlans', (data) => {
                contextData.investments.sipPlans = data;
                debouncedUpdateUI();
            });

            DBService.subscribe(uid, 'fdAccounts', (data) => {
                contextData.investments.fdAccounts = data;
                debouncedUpdateUI();
            });

            DBService.subscribe(uid, 'rdAccounts', (data) => {
                contextData.investments.rdAccounts = data;
                debouncedUpdateUI();
            });

            DBService.subscribe(uid, 'finances', (data) => {
                contextData.expenses = data;
                debouncedUpdateUI();
            });

            DBService.subscribe(uid, 'goals', (data) => {
                contextData.goals = data;
                debouncedUpdateUI();
            });

            DBService.subscribe(uid, 'cachedMarketData', (data) => {
                console.log('📡 [cachedMarketData Listener] Received data:', data);
                const prices = {};
                if (data) {
                    data.forEach(p => {
                        console.log(`  → Document: ${p.id}`, p);
                        if (p.id === 'portfolioHistory') {
                            // Render Chart with History - only if data changed
                            if (p.history && JSON.stringify(p.history) !== JSON.stringify(lastChartData)) {
                                lastChartData = p.history;
                                renderPortfolioChart(p.history);
                            }
                        } else {
                            prices[p.id] = p;
                            console.log(`  ✅ Added ${p.id} to prices object`);
                        }
                    });
                }
                console.log('📊 Final prices object:', prices);
                contextData.investments.prices = prices;
                debouncedUpdateUI();
                updateTickerUI(prices);
                // 🔔 Process investment alerts when prices update
                processInvestmentAlerts(contextData.investments.holdings, prices);
            });

            // Form Handling for Goals
            const goalForm = document.getElementById('add-goal-form');
            if (goalForm) {
                goalForm.onsubmit = async (e) => {
                    e.preventDefault();
                    if (!currentUser) return showToast("Must be logged in", "error");

                    const submitBtn = goalForm.querySelector('button[type="submit"]');
                    const origText = submitBtn.textContent;
                    submitBtn.textContent = "⏳ Strategizing with AI...";
                    submitBtn.disabled = true;

                    try {
                        const name = document.getElementById('goal-name').value;
                        const targetAmount = parseFloat(document.getElementById('goal-target').value);
                        const deadlineValue = parseInt(document.getElementById('goal-timeline').value);
                        const deadlineFormat = document.getElementById('goal-timeline-unit').value;
                        const currentSaved = parseFloat(document.getElementById('goal-saved').value) || 0;

                        const months = deadlineFormat === 'years' ? deadlineValue * 12 : deadlineValue;
                        
                        // Generate baseline logic
                        const requiredMonthly = GoalEngine.calculateMonthlyRequired(targetAmount, currentSaved, months, 12);
                        
                        // Parse finances to find average monthly surplus
                        const finances = contextData.expenses || [];
                        const state = FinancialEngine.calculateState(finances, 30000);
                        const currentSurplus = Math.max(0, (state.monthIncome || 40000) - (state.monthExpenses || 20000));
                        
                        const probabilityScore = GoalEngine.calculateProbability(requiredMonthly, currentSurplus);
                        const baselineMilestones = GoalEngine.generateMilestones(targetAmount, months);

                        const goalData = {
                            id: crypto.randomUUID(),
                            name,
                            targetAmount,
                            deadlineValue,
                            deadlineFormat,
                            currentSaved,
                            requiredMonthly,
                            probabilityScore,
                            baselineMilestones,
                            status: "active",
                            createdAt: new Date().toISOString()
                        };

                        const financialState = {
                            avgMonthlyIncome: state.monthIncome || 40000,
                            monthlyBurnRate: state.monthExpenses || 20000
                        };

                        // Ask Groq for the personalized roadmap
                        const aiResponse = await GoalAIService.generateRoadmap(goalData, financialState);

                        // Merge
                        const finalGoal = {
                            ...goalData,
                            probabilityScore: Number.isFinite(aiResponse.probabilityScore) ? aiResponse.probabilityScore : probabilityScore,
                            aiInsight: aiResponse.aiInsight || "Keep saving consistently via SIPs to reach your dream faster.",
                            suggestedAllocation: aiResponse.suggestedAllocation || "Balanced Equity focus.",
                            milestones: Array.isArray(aiResponse.milestones) ? aiResponse.milestones : baselineMilestones
                        };

                        await DBService.saveData(uid, 'goals', finalGoal.id, finalGoal);
                        
                        document.getElementById('add-goal-modal').style.display = 'none';
                        goalForm.reset();
                        showToast('✅ Dream Goal AI Roadmap Created!', 'success');

                        try {
                            const { GamificationService } = await import('./js/gamification-service.js');
                            await GamificationService.awardPoints(200); // 200 XP for setting a goal
                            updateHeaderLevel();
                        } catch (err) {}

                    } catch (err) {
                        showToast('Error generating AI map: ' + err.message, 'error');
                        console.error('Goal AI Error:', err);
                    } finally {
                        submitBtn.textContent = origText;
                        submitBtn.disabled = false;
                    }
                };
            }

            // Form Handling
            const form = document.getElementById('add-investment-form');
            form.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(form);

                try {
                    let collection = '';
                    let id = '';
                    let data = {};

                    if (activeModalTab === 'tab-stock') {
                        collection = 'holdings';
                        id = formData.get('stock_symbol').toUpperCase();
                        data = {
                            symbol: id,
                            name: formData.get('stock_name'),
                            quantity: parseFloat(formData.get('stock_qty')),
                            avgPrice: parseFloat(formData.get('stock_price')),
                            type: 'STOCK',
                            timestamp: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}Z`; })()
                        };
                    }
                    else if (activeModalTab === 'tab-gold') {
                        collection = 'holdings';
                        id = formData.get('gold_type'); // GOLD or SILVER
                        data = {
                            symbol: id,
                            name: id === 'GOLD' ? '24K Digital Gold' : 'Silver Petal',
                            quantity: parseFloat(formData.get('gold_qty')),
                            avgPrice: parseFloat(formData.get('gold_price')) / parseFloat(formData.get('gold_qty')), // Calc avg per gram
                            type: 'COMMODITY',
                            timestamp: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}Z`; })()
                        };
                    }
                    else if (activeModalTab === 'tab-fixed') {
                        const type = formData.get('fixed_type');
                        collection = type === 'FD' ? 'fdAccounts' : 'rdAccounts';
                        id = crypto.randomUUID();
                        data = {
                            id,
                            name: formData.get('fixed_name'),
                            principal: parseFloat(formData.get('fixed_amount')), // For RD this acts as monthly
                            interestRate: parseFloat(formData.get('fixed_roi')),
                            maturityValue: parseFloat(formData.get('fixed_maturity')),
                            startDate: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}Z`; })(),
                            // RD specific
                            currentBalance: type === 'RD' ? parseFloat(formData.get('fixed_amount')) : parseFloat(formData.get('fixed_amount')),
                            targetAmount: parseFloat(formData.get('fixed_maturity'))
                        };
                    }
                    else if (activeModalTab === 'tab-sip') {
                        collection = 'sipPlans';
                        id = crypto.randomUUID();
                        data = {
                            id,
                            name: formData.get('sip_name'),
                            monthlyAmount: parseFloat(formData.get('sip_amount')),
                            currentInvested: parseFloat(formData.get('sip_invested')),
                            targetAmount: parseFloat(formData.get('sip_target')),
                            startDate: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}Z`; })()
                        };
                    }

                    if (!id) throw new Error("Invalid ID generated");

                    await DBService.saveData(uid, collection, id, data);
                    document.getElementById('add-holding-modal').style.display = 'none';
                    form.reset();
                    showToast('Investment added successfully!', 'success');

                    if (collection === 'holdings') {
                        // once a new holding is saved, refresh price cache immediately
                        if (typeof triggerSync === 'function') {
                            triggerSync();
                        }
                    }

                    // Gamification: Award 10 XP
                    try {
                        const { GamificationService } = await import('./js/gamification-service.js');
                        await GamificationService.awardPoints(10);
                        updateHeaderLevel();
                    } catch (err) {
                        console.warn("Gamification points not awarded:", err);
                    }
                } catch (err) { showToast('Error: ' + err.message, 'error'); }
            };

            // Backend Simulation Trigger (Simulating Cloud Function)
            // In a real app, this would be a scheduled job on the server.
            // Here, the client triggers the sync to update Firestore 'cachedMarketData'.
            const triggerSync = async () => {
                await PriceService.syncMarketData(uid, contextData.investments.holdings);
            };

            triggerSync(); // Initial sync
            // ⚡ FIX: Changed from 60s to 15s for more responsive updates
            // Store interval ID for cleanup
            if (syncInterval) clearInterval(syncInterval);
            syncInterval = setInterval(triggerSync, 15000); // Sync every 15s (4x faster)
        }

        // Process investment-specific alerts (price changes, gains/losses)
        function processInvestmentAlerts(holdings, prices) {
            if (!holdings || holdings.length === 0) return;

            holdings.forEach(holding => {
                const priceData = prices[holding.symbol];
                if (!priceData || !priceData.price) return;

                const currentValue = holding.quantity * priceData.price;
                const investmentCost = holding.quantity * holding.avgPrice;
                const gainLoss = currentValue - investmentCost;
                const gainLossPercent = ((gainLoss / investmentCost) * 100).toFixed(2);

                // Alert for significant gains (> 5%)
                if (gainLossPercent > 5) {
                    const alertKey = `investment_gain_${holding.symbol}`;
                    const lastShown = sessionStorage.getItem(alertKey);
                    const now = Date.now();

                    if (!lastShown || (now - parseInt(lastShown)) > (120 * 60 * 1000)) {
                        NotificationService.show(
                            `📈 ${holding.symbol} Gained ${gainLossPercent}%`,
                            `Your ${holding.name} holding is up by ₹${gainLoss.toFixed(2)}!`
                        );
                        sessionStorage.setItem(alertKey, now.toString());
                    }
                }
                // Alert for significant losses (< -5%)
                else if (gainLossPercent < -5) {
                    const alertKey = `investment_loss_${holding.symbol}`;
                    const lastShown = sessionStorage.getItem(alertKey);
                    const now = Date.now();

                    if (!lastShown || (now - parseInt(lastShown)) > (120 * 60 * 1000)) {
                        NotificationService.show(
                            `📉 ${holding.symbol} Lost ${Math.abs(gainLossPercent)}%`,
                            `Your ${holding.name} holding is down by ₹${Math.abs(gainLoss).toFixed(2)}.`
                        );
                        sessionStorage.setItem(alertKey, now.toString());
                    }
                }
            });
        }

        // Removed client-side syncPrices function - Logic moved to PriceService "Backend"

        // Display API cache status
        function updateAPIStatus() {
            const now = Date.now();
            let mostRecent = null;
            let apiName = null;

            for (const [key, ts] of Object.entries(PriceService.apiCallCache)) {
                if (!mostRecent || ts > mostRecent) {
                    mostRecent = ts;
                    apiName = key;
                }
            }

            let statusText = '📦 Using Cached Prices';
            if (mostRecent && apiName) {
                const timeSince = now - mostRecent;
                const mins = Math.floor(timeSince / 60000);
                const hours = Math.floor(timeSince / 3600000);
                let timeStr;
                if (hours > 0) {
                    timeStr = `${hours}h ago`;
                } else {
                    timeStr = `${mins}m ago`;
                }
                statusText = `✅ Last API call (${apiName}): ${timeStr}`;
            }
            const statusElement = document.getElementById('api-status-text');
            if (statusElement) statusElement.textContent = statusText;
        }

        function updateUI() {
            try {
                const metrics = InvestmentEngine.calculatePortfolioMetrics(
                    contextData.investments.holdings,
                    contextData.investments.prices
                );

                const savings = InvestmentEngine.calculateSavingsMetrics(
                    contextData.investments.sipPlans,
                    contextData.investments.fdAccounts,
                    contextData.investments.rdAccounts
                );

                // Summary Stats
                const totalWealthEl = document.getElementById('total-wealth');
                if (totalWealthEl) {
                    totalWealthEl.textContent = `₹${Math.round(metrics.totalValue + savings.totalSaved).toLocaleString('en-IN')}`;
                }

                const totalRet = metrics.totalGain;
                const retSign = totalRet >= 0 ? '+' : '';
                const retEl = document.getElementById('total-returns');
                if (retEl) {
                    const gainPerc = isNaN(metrics.gainPercentage) ? 0 : metrics.gainPercentage;
                    const gainVal = isNaN(totalRet) ? 0 : Math.abs(Math.round(totalRet));
                    retEl.textContent = `${retSign}₹${gainVal.toLocaleString('en-IN')} (${gainPerc.toFixed(2)}%)`;
                    retEl.className = `return-badge ${totalRet >= 0 ? '' : 'negative'}`;
                }

                const dailySign = metrics.dailyGain >= 0 ? '+' : '';
                const dailyEl = document.getElementById('daily-gain');
                if (dailyEl) {
                    const dailyGainVal = isNaN(metrics.dailyGain) ? 0 : metrics.dailyGain;
                    const dailyPerc = metrics.totalValue > dailyGainVal ? (dailyGainVal / (metrics.totalValue - dailyGainVal)) * 100 : 0;
                    dailyEl.textContent = `${dailySign}₹${Math.abs(Math.round(dailyGainVal)).toLocaleString('en-IN')} (${dailyPerc.toFixed(2)}%)`;
                    dailyEl.className = `p-value ${dailyGainVal >= 0 ? 'up' : 'down'}`;
                }

                // Sub-components
                updateAPIStatus();
                renderGoldList();
                renderStocksList();
                renderSavingsList();
                updateMarketCards(contextData.investments.prices);
                renderAllocationChart(metrics, savings);
                updatePassiveIncomeUI(savings);
                updateAIInsight(metrics, savings);
                
                // Smart SIP Booster
                renderSmartSIPBooster();
                
                // SIP Calculator
                renderSIPCalculator();
                
                // Goals List
                renderGoalsList();
            } catch (err) {
                console.error("❌ Error in updateUI:", err);
            }
        }

        function updateMarketCards(prices) {
            const gold = prices['GOLD'];
            const silver = prices['SILVER'];

            if (gold) {
                // show two decimals rather than rounding to nearest rupee
                document.getElementById('price-gold').textContent = `₹${PriceService.formatGoldPrice(gold.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                const el = document.getElementById('change-gold');
                el.textContent = gold.changePercent;
                el.className = `change ${gold.changePercent.startsWith('-') ? 'down' : 'up'}`;
                el.style.color = gold.changePercent.startsWith('-') ? '#EF4444' : '#10B981';
                const statusEl = document.getElementById('status-gold');
                statusEl.textContent = gold.isLive ? `🟢 ${gold.source || 'Live'}` : '🟡 Cached';
            }

            if (silver) {
                document.getElementById('price-silver').textContent = `₹${PriceService.formatSilverPrice(silver.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                const el = document.getElementById('change-silver');
                el.textContent = silver.changePercent;
                el.className = `change ${silver.changePercent.startsWith('-') ? 'down' : 'up'}`;
                el.style.color = silver.changePercent.startsWith('-') ? '#EF4444' : '#10B981';
                const statusEl = document.getElementById('status-silver');
                statusEl.textContent = silver.isLive ? `🟢 ${silver.source || 'Live'}` : '🟡 Cached';
            }
        }

        function updateTickerUI(prices) {
            const ticker = document.getElementById('price-ticker');
            if (!ticker) return;
            // Show top 5 movers + Gold/Silver
            const items = Object.values(prices).slice(0, 10);

            if (items.length === 0) {
                ticker.innerHTML = '<div style="padding:0 20px; font-style:italic; opacity:0.7;">Initializing real-time market data feed...</div>';
                return;
            }

            ticker.innerHTML = items.map(data => {
                if (!data) return '';
                // Try to guess name from id if symbol is missing, or use ID
                const symbol = data.id || '---';
                const price = data.price || 0;
                const change = data.changePercent || '0%';
                const isDown = change.startsWith('-');
                const priceStr = price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                return `
                  <div class="ticker-item">
                    <span class="ticker-symbol">${symbol}</span> 
                    <span class="ticker-price">₹${priceStr}</span> 
                    <span class="ticker-change ${isDown ? 'down' : 'up'}">${change}</span>
                    <span style="font-size:0.6rem; opacity:0.5; margin-left:4px;">${data.source || ''}</span>
                  </div>
                `;
            }).join('');
        }

        function renderPortfolioChart(historyData) {
            const chartEl = document.getElementById('portfolio-performance-chart');
            if (!chartEl) return;

            // Normalize data: historyData is [{x, y}]
            const seriesData = historyData || [];
            if (seriesData.length === 0) return;

            // Calculate min/max for Y-axis scaling to make fluctuation visible
            const prices = seriesData.map(d => d.y);
            const minPrice = Math.min(...prices) * 0.999;
            const maxPrice = Math.max(...prices) * 1.001;

            const options = {
                series: [{ name: 'Portfolio Value', data: seriesData }],
                chart: {
                    type: 'area',
                    height: 350,
                    fontFamily: 'Inter, sans-serif',
                    animations: { enabled: false }, // Disabled animations for better performance
                    toolbar: { show: false },
                    zoom: { enabled: false }
                },
                colors: ['#00D09C'],
                dataLabels: { enabled: false },
                stroke: { curve: 'smooth', width: 2 },
                fill: {
                    type: 'gradient',
                    gradient: {
                        shadeIntensity: 1,
                        opacityFrom: 0.7,
                        opacityTo: 0.1,
                        stops: [0, 100]
                    }
                },
                grid: {
                    show: false, // Cleaner look
                    padding: { top: 0, right: 0, bottom: 0, left: 10 }
                },
                xaxis: {
                    type: 'datetime',
                    tooltip: { enabled: false },
                    axisBorder: { show: false },
                    axisTicks: { show: false },
                    labels: {
                        show: true,
                        style: { colors: '#9CA3AF', fontSize: '12px' },
                        datetimeFormatter: { hour: 'hh:mm tt' }
                    }
                },
                yaxis: {
                    show: true,
                    min: minPrice, // Auto-scale to show small fluctuations
                    max: maxPrice,
                    labels: {
                        formatter: (value) => '₹' + Math.round(value).toLocaleString('en-IN'),
                        style: { colors: 'var(--muted)', fontSize: '12px' }
                    }
                },
                tooltip: {
                    x: { format: 'dd MMM hh:mm tt' },
                    theme: body.classList.contains('light-mode') ? 'light' : 'dark'
                }
            };

            // Initial Render
            if (!portfolioChart) {
                // Ensure div
                if (chartEl.tagName === 'CANVAS') {
                    const div = document.createElement('div');
                    div.id = 'portfolio-performance-chart';
                    chartEl.parentNode.replaceChild(div, chartEl);
                    portfolioChart = new ApexCharts(document.querySelector("#portfolio-performance-chart"), options);
                } else {
                    portfolioChart = new ApexCharts(chartEl, options);
                }
                portfolioChart.render();
            } else {
                // Only update series data, not options (more efficient)
                portfolioChart.updateSeries([{ data: seriesData }]);
            }
        }

        let allocationChart = null;
        function renderAllocationChart(metrics, savings) {
            const chartEl = document.getElementById('allocation-chart');
            if (!chartEl) return;

            const allocation = InvestmentEngine.calculateAllocation(contextData.investments.holdings, savings, contextData.investments.prices);

            const options = {
                series: Object.values(allocation),
                labels: Object.keys(allocation),
                chart: { type: 'donut', height: 250, background: 'transparent' },
                colors: ['#5B6CF2', '#FFD700', '#00D09C'],
                dataLabels: { enabled: false },
                stroke: { show: false },
                legend: { position: 'bottom', fontSize: '10px', labels: { colors: 'var(--muted)' } },
                plotOptions: {
                    pie: { donut: { size: '65%', labels: { show: true, total: { show: true, color: 'var(--text)' }, value: { color: 'var(--text)' } } } }
                }
            };

            if (!allocationChart) {
                allocationChart = new ApexCharts(chartEl, options);
                allocationChart.render();
            } else {
                allocationChart.updateSeries(Object.values(allocation));
            }
        }

        function updatePassiveIncomeUI(savings) {
            const data = InvestmentEngine.calculatePassiveIncome(contextData.investments.fdAccounts, contextData.investments.sipPlans);
            document.getElementById('monthly-passive').textContent = Math.round(data.monthlyEstimated).toLocaleString('en-IN');
        }

        async function updateAIInsight(metrics, savings) {
            const summary = InvestmentEngine.generateSummaryForAI(metrics, savings);
            const insight = await AIService.generateInvestmentInsight(summary);
            if (insight) document.getElementById('ai-wealth-insight').innerHTML = insight;
        }

        function renderStocksList() {
            const container = document.getElementById('stocks-list');
            if (!container) return;
            // Filter only true stocks
            const holdings = contextData.investments.holdings.filter(h => h.type === 'STOCK');
            if (holdings.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 60px; background: var(--glass); border-radius: 24px; border: 1px dashed var(--border);">
                        <p style="color: var(--muted); margin-bottom: 20px; font-weight: 500;">No stocks found in your portfolio.</p>
                        <button class="btn btn-primary" onclick="document.getElementById('add-holding-modal').style.display='flex'">+ Add Stocks</button>
                    </div>
                `;
                return;
            }
            container.innerHTML = holdings.map(h => {
                const priceData = contextData.investments.prices[h.symbol];
                const price = (priceData && typeof priceData === 'object' ? priceData.price : priceData) || h.avgPrice || 0;
                const currentVal = price * h.quantity;
                const investedVal = (h.avgPrice || 0) * h.quantity;
                const returns = currentVal - investedVal;
                const returnPerc = investedVal > 0 ? (returns / investedVal) * 100 : 0;
                return `
                    <div class="instrument-card" style="position: relative;">
                        <!-- Delete Button -->
                        <button onclick="deleteInvestment('${h.id}', 'holdings')" style="position: absolute; right: 8px; top: 8px; background: rgba(255,0,0,0.1); color: var(--danger); border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;" title="Delete Holding">🗑️</button>
                        
                        <div style="display: flex; justify-content: space-between; padding-right: 28px;">
                            <h4 style="margin:0; font-size: 1.1rem; color: var(--text);">${h.name || h.symbol}</h4>
                            <span style="font-size: 0.75rem; background: var(--bg); padding: 4px 10px; border-radius: 8px; font-weight: 700; color: var(--primary); border: 1px solid var(--border);">${h.symbol}</span>
                        </div>
                        <p style="font-size:0.8rem; color:var(--muted); margin-top: 4px;">${h.quantity} Qty • Avg: ₹${(h.avgPrice || 0).toLocaleString()}</p>
                        <div style="margin-top:16px; display:flex; justify-content:space-between; align-items:flex-end;">
                            <div>
                                <span style="font-size:0.75rem; color:var(--muted);">Market Value</span>
                                <div style="font-weight:800; font-size: 1.1rem;">₹${Math.round(currentVal).toLocaleString('en-IN')}</div>
                            </div>
                            <div class="return-badge ${returns >= 0 ? '' : 'negative'}">
                                ${returns >= 0 ? '+' : ''}${returnPerc.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderGoldList() {
            const container = document.getElementById('gold-list');
            if (!container) return;
            const goldPrice = contextData.investments.prices['GOLD'] ? contextData.investments.prices['GOLD'].price : 0;
            const silverPrice = contextData.investments.prices['SILVER'] ? contextData.investments.prices['SILVER'].price : 0;
            const goldIsLive = contextData.investments.prices['GOLD'] ? contextData.investments.prices['GOLD'].isLive : false;
            const silverIsLive = contextData.investments.prices['SILVER'] ? contextData.investments.prices['SILVER'].isLive : false;

            const goldHolding = contextData.investments.holdings.find(h => h.symbol === 'GOLD');
            const silverHolding = contextData.investments.holdings.find(h => h.symbol === 'SILVER');

            // Calculate value
            const goldVal = goldHolding ? goldHolding.quantity * goldPrice : 0;
            const silverVal = silverHolding ? silverHolding.quantity * silverPrice : 0;

            container.innerHTML = `
                <div class="instrument-card" style="position: relative; overflow: hidden;">
                  ${goldHolding ? `<button onclick="deleteInvestment('${goldHolding.id}', 'holdings')" style="position: absolute; right: 8px; top: 8px; background: rgba(255,0,0,0.1); color: var(--danger); border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; z-index: 10;" title="Delete Gold">🗑️</button>` : ''}
                  <div style="display:flex; justify-content:space-between; align-items:center; padding-right: 28px; position: relative; z-index: 1;">
                    <h4 style="font-size: 1.1rem; color: var(--text);">Gold (24K)</h4> 
                    ${goldHolding ? `<span class="return-badge">Owning ₹${Math.round(goldVal).toLocaleString()}</span>` : ''}
                  </div>
                  <p style="font-size:0.85rem; color:var(--muted); font-weight: 500;">Digital Gold • Safe Haven</p>
                  <p style="font-size:0.75rem; color:var(--muted); margin:6px 0 16px 0; font-weight: 600;">${goldIsLive ? `🟢 ${contextData.investments.prices['GOLD'].source || 'Live'}` : '🟡 Cached Data'}</p>
                  <div style="margin-top:12px; position: relative; z-index: 1;">
                    <span style="font-size:1.8rem; font-weight:800; color: #F59E0B;">₹${Math.round(PriceService.formatGoldPrice(goldPrice)).toLocaleString('en-IN')}</span> <span style="font-size:0.8rem; color:var(--muted); font-weight: 600;">/10g</span>
                    ${goldHolding ? `<div style="margin-top:12px; font-weight:700; color: #00D09C; background: rgba(0, 208, 156, 0.1); padding: 6px 12px; border-radius: 8px; display: inline-block;">Holdings: ${goldHolding.quantity} g</div>` : ''}
                  </div>
                </div>

                <div class="instrument-card" style="position: relative; overflow: hidden;">
                  ${silverHolding ? `<button onclick="deleteInvestment('${silverHolding.id}', 'holdings')" style="position: absolute; right: 8px; top: 8px; background: rgba(255,0,0,0.1); color: var(--danger); border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; z-index: 10;" title="Delete Silver">🗑️</button>` : ''}
                  <div style="display:flex; justify-content:space-between; align-items:center; padding-right: 28px; position: relative; z-index: 1;">
                    <h4 style="font-size: 1.1rem; color: var(--text);">Silver</h4> 
                    ${silverHolding ? `<span class="return-badge">Owning ₹${Math.round(silverVal).toLocaleString()}</span>` : ''}
                  </div>
                  <p style="font-size:0.85rem; color:var(--muted); font-weight: 500;">Industrial • Precious</p>
                  <p style="font-size:0.75rem; color:var(--muted); margin:6px 0 16px 0; font-weight: 600;">${silverIsLive ? `🟢 ${contextData.investments.prices['SILVER'].source || 'Live'}` : '🟡 Cached Data'}</p>
                  <div style="margin-top:12px; position: relative; z-index: 1;">
                    <span style="font-size:1.8rem; font-weight:800; color: #94A3B8;">₹${Math.round(PriceService.formatSilverPrice(silverPrice)).toLocaleString('en-IN')}</span> <span style="font-size:0.8rem; color:var(--muted); font-weight: 600;">/kg</span>
                    ${silverHolding ? `<div style="margin-top:12px; font-weight:700; color: #00D09C; background: rgba(0, 208, 156, 0.1); padding: 6px 12px; border-radius: 8px; display: inline-block;">Holdings: ${silverHolding.quantity} g</div>` : ''}
                  </div>
                </div>
            `;
        }

        function renderSavingsList() {
            const container = document.getElementById('savings-list');
            if (!container) return;

            let html = '';

            // SIPs
            contextData.investments.sipPlans.forEach(s => {
                const perc = Math.min(100, (s.currentInvested / s.targetAmount) * 100);
                html += `
                <div class="instrument-card" style="position: relative;">
                  <button onclick="deleteInvestment('${s.id}', 'sipPlans')" style="position: absolute; right: 8px; top: 8px; background: rgba(255,0,0,0.1); color: var(--danger); border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;" title="Delete SIP">🗑️</button>
                  <div style="display:flex; justify-content:space-between; padding-right: 28px;">
                    <h4 style="font-size: 1.1rem; color: var(--text);">SIP: ${s.name}</h4>
                    <span style="font-size:0.75rem; background:var(--glass); border: 1px solid var(--border); padding:4px 10px; border-radius:8px; font-weight: 700; color: var(--muted);">Mutual Fund</span>
                  </div>
                  <p style="font-size:0.8rem; color:var(--muted);">Monthly Investment: ₹${s.monthlyAmount.toLocaleString('en-IN')}</p>
                  <div style="margin-top:12px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:4px;">
                        <span>₹${s.currentInvested.toLocaleString()} saved</span>
                        <span>Goal: ₹${s.targetAmount.toLocaleString()}</span>
                    </div>
                    <div class="savings-bar-container"><div class="savings-bar" style="width: ${perc}%;"></div></div>
                  </div>
                </div>`;
            });

            // FDs
            contextData.investments.fdAccounts.forEach(fd => {
                html += `
                <div class="instrument-card" style="position: relative;">
                  <button onclick="deleteInvestment('${fd.id}', 'fdAccounts')" style="position: absolute; right: 8px; top: 8px; background: rgba(255,0,0,0.1); color: var(--danger); border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;" title="Delete FD">🗑️</button>
                  <div style="display:flex; justify-content:space-between; padding-right: 28px;">
                    <h4 style="font-size: 1.1rem; color: var(--text);">FD: ${fd.name}</h4>
                    <span style="font-size:0.75rem; background:rgba(76, 175, 80, 0.1); color:#10B981; padding:4px 10px; border-radius:8px; font-weight: 700;">${fd.interestRate}% Return</span>
                  </div>
                  <p style="font-size:0.85rem; color:var(--muted); font-weight: 500; margin-top: 4px;">Principal: ₹${fd.principal.toLocaleString('en-IN')}</p>
                  <div style="margin-top:16px;">
                     <div style="font-size:1rem; font-weight:800; color: #10B981;">Maturity: ₹${fd.maturityValue.toLocaleString()}</div>
                     <span style="font-size:0.75rem; color:var(--muted); font-weight: 500;">Fixed Deposit</span>
                  </div>
                </div>`;
            });

            // RDs
            contextData.investments.rdAccounts.forEach(rd => {
                const perc = Math.min(100, (rd.currentBalance / rd.targetAmount) * 100);
                html += `
                <div class="instrument-card" style="position: relative;">
                  <button onclick="deleteInvestment('${rd.id}', 'rdAccounts')" style="position: absolute; right: 8px; top: 8px; background: rgba(255,0,0,0.1); color: var(--danger); border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;" title="Delete RD">🗑️</button>
                  <div style="display:flex; justify-content:space-between; padding-right: 28px;">
                    <h4 style="font-size: 1.1rem; color: var(--text);">RD: ${rd.name}</h4>
                    <span style="font-size:0.75rem; background:rgba(33, 150, 243, 0.1); color:#2196F3; padding:4px 10px; border-radius:8px; font-weight: 700;">Recurring</span>
                  </div>
                  <p style="font-size:0.85rem; color:var(--muted); font-weight: 500; margin-top: 4px;">Current Balance: ₹${rd.currentBalance.toLocaleString('en-IN')}</p>
                  <div style="margin-top:16px;">
                     <div class="savings-bar-container" style="background: rgba(255,255,255,0.05); height: 8px;"><div class="savings-bar" style="background: linear-gradient(90deg, #2196F3, #64B5F6); width: ${perc}%;"></div></div>
                     <span style="font-size:0.75rem; color:var(--muted); font-weight: 600;">${perc.toFixed(0)}% completed</span>
                  </div>
                </div>`;
            });

            container.innerHTML = html || '<p style="color:var(--muted); padding:20px; grid-column:1/-1; text-align:center;">No active savings plans found. Add one to start tracking!</p>';
        }

        function renderGoalsList() {
            const container = document.getElementById('goals-list');
            if (!container) return;

            if (!contextData.goals || contextData.goals.length === 0) {
                container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; background: var(--glass); border: 1px dashed var(--border); border-radius: 20px;">
                    <span style="font-size: 3rem; opacity: 0.5;">🎯</span>
                    <h4 style="margin: 12px 0 4px 0; color: var(--text);">No goals set yet!</h4>
                    <p style="margin: 0; font-size: 0.9rem; color: var(--muted);">Dream big. Hit "New Dream Goal" to generate your first AI roadmap.</p>
                </div>`;
                return;
            }

            container.innerHTML = contextData.goals.map(goal => {
                const probabilityScore = goal.probabilityScore || 0;
                let colorVar = '--groww-green';
                if (probabilityScore < 40) colorVar = '--danger';
                else if (probabilityScore < 70) colorVar = '--warning';
                
                const gaugeStyle = `background: conic-gradient(var(${colorVar}) ${probabilityScore}%, rgba(255,255,255,0.1) 0);`;

                return `
                <div class="goal-card">
                    <button onclick="deleteInvestment('${goal.id}', 'goals')" style="position: absolute; right: 16px; top: 16px; background: rgba(255,0,0,0.1); color: var(--danger); border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; z-index: 10;" title="Delete Goal">🗑️</button>
                    <div class="goal-header">
                        <div>
                            <h3 class="goal-title">${goal.name}</h3>
                            <div class="goal-meta">
                                <span style="font-weight: 600; color: var(--text);">🎯 ₹${goal.targetAmount.toLocaleString('en-IN')}</span>
                                <span>⏳ ${goal.deadlineValue} ${goal.deadlineFormat}</span>
                                <span style="color: var(--groww-green);">💰 Saved: ₹${goal.currentSaved.toLocaleString('en-IN')}</span>
                            </div>
                            <div style="margin-top: 12px; font-size: 0.8rem; color: var(--muted);">
                                Required SIP: <strong style="color: var(--primary);">₹${Math.round(goal.requiredMonthly || 0).toLocaleString('en-IN')} / mo</strong>
                            </div>
                        </div>
                        <div class="probability-gauge" style="${gaugeStyle}">
                            <span class="probability-text" style="color: var(${colorVar});">${probabilityScore}%</span>
                        </div>
                    </div>
                    
                    <div class="roadmap-timeline">
                        <h4 style="margin: 0 0 12px 0; font-size: 1rem; color: var(--text);">🚀 AI Strategy & Roadmap</h4>
                        ${(goal.milestones || []).map(m => `
                            <div class="milestone ${m.isAchieved ? 'achieved' : ''}">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: 700; color: var(--text); font-size: 0.95rem;">${m.title}</div>
                                        <div style="font-size: 0.75rem; color: var(--muted); margin-top: 2px;">Target amount to accumulate</div>
                                    </div>
                                    <div style="font-weight: 800; font-size: 1.1rem; color: var(--primary);">₹${(m.target || 0).toLocaleString('en-IN')}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    ${goal.aiInsight ? `
                    <div class="goal-insight">
                        <strong>💎 AI Insight:</strong> ${goal.aiInsight}
                        <br><br>
                        <strong>📊 Suggested Allocation:</strong> ${goal.suggestedAllocation || 'Balanced Investment'}
                    </div>` : ''}
                </div>
                `;
            }).join('');
        }

        window.toggleTool = function(tool) {
            const booster = document.getElementById('sip-booster-container');
            const calculator = document.getElementById('sip-calculator-container');
            
            if (tool === 'booster') {
                const isHidden = booster.style.display === 'none';
                booster.style.display = isHidden ? 'block' : 'none';
                if (isHidden) {
                    renderSmartSIPBooster(true); // Force render and scroll
                    booster.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } else if (tool === 'calculator') {
                const isHidden = calculator.style.display === 'none';
                calculator.style.display = isHidden ? 'block' : 'none';
                if (isHidden) {
                    renderSIPCalculator(true); // Force render and scroll
                    calculator.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        };

        function renderSmartSIPBooster(force = false) {
            const container = document.getElementById('sip-booster-container');
            if (!container) return;
            
            // Only render if visible or forced
            if (container.style.display === 'none' && !force) return;

            console.log('💎 [SmartSIP] Initializing render...');
            try {
                // Get feedback from service
                const suggestion = SmartSIPService.getBoostSuggestion(
                    contextData.investments.sipPlans,
                    contextData.expenses || [], 
                    localStorage.getItem('monthly_budget') || 30000, // Reasonable default for analysis
                    contextData.investments.prices
                );

                if (!suggestion) {
                    console.log('💎 [SmartSIP] No suggestion returned from service.');
                    containers.forEach(c => { if(c) c.style.display = 'none'; });
                    return;
                }

            console.log('💎 [SmartSIP] Suggestion found:', suggestion);

            const buttonText = suggestion.isStarter ? `Start SIP at ₹${suggestion.boostedAmount.toLocaleString()}` : `Boost to ₹${suggestion.boostedAmount.toLocaleString()}`;
            const description = suggestion.isStarter ? 
                `Starting a <strong>₹${suggestion.boostedAmount.toLocaleString()}</strong> SIP could result in massive wealth over 15 years.` :
                `Increasing your <strong>₹${suggestion.currentAmount.toLocaleString()}</strong> SIP by <strong>₹${suggestion.suggestedIncrease.toLocaleString()}</strong> could significantly boost your long-term wealth.`;

            const html = `
                <div class="booster-card animate-fade-in-up">
                    <div class="booster-header">
                        <span class="booster-badge">Smart Booster</span>
                        <h4 class="booster-title">AI Investment Strategy</h4>
                    </div>
                    
                    <div class="booster-content">
                        <div class="booster-insight">
                            <p style="margin:0; font-weight:600; color:var(--groww-green);">🚀 ${suggestion.insight}</p>
                            <p style="margin:8px 0 0 0; font-size:0.85rem; color:var(--muted);">
                                ${description}
                            </p>
                            
                            <div class="growth-comparison">
                                <div class="growth-item">
                                    <div class="growth-label">Growth (15y)</div>
                                    <div class="growth-value">₹${Math.round(suggestion.growthComparison.current.finalValue / 100000).toLocaleString()}L</div>
                                </div>
                                <div class="growth-item" style="border-color: var(--groww-green); background: rgba(0,208,156,0.05);">
                                    <div class="growth-label">Goal Projection</div>
                                    <div class="growth-value highlight">₹${Math.round(suggestion.growthComparison.boosted.finalValue / 100000).toLocaleString()}L</div>
                                </div>
                            </div>
                            
                            <p style="margin:12px 0 0 0; font-size:0.75rem; color:var(--groww-green); font-weight:700;">
                                ✨ Potential extra returns: ₹${Math.round(suggestion.growthComparison.extraReturns).toLocaleString('en-IN')}
                            </p>
                        </div>
                        
                        <div class="booster-action">
                            <button class="btn btn-primary" onclick="applyBoost(${suggestion.boostedAmount}, ${suggestion.isStarter})" style="width:100%; padding: 12px; font-weight:700;">
                                ${buttonText}
                            </button>
                            <button class="btn btn-ghost" onclick="this.closest('.booster-card').parentElement.style.display='none'" style="width:100%; border:none; padding:8px; font-size:0.8rem;">
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            `;

            if (container) {
                container.innerHTML = html;
                console.log(`💎 [SmartSIP] Rendered in container: ${container.id}`);
            }
        } catch (err) {
            console.error('💎 [SmartSIP] Render error:', err);
        }
    }

        window.applyBoost = async function(newAmount, isStarter = false) {
            let sip = contextData.investments.sipPlans[0];
            const uid = currentUser ? currentUser.uid : null;

            try {
                if (isStarter) {
                    // Create new SIP
                    const id = crypto.randomUUID();
                    sip = {
                        id,
                        name: "Smart Booster SIP",
                        monthlyAmount: newAmount,
                        currentInvested: 0,
                        targetAmount: 5000000, // Default 50L goal
                        startDate: new Date().toISOString()
                    };
                    await DBService.saveData(uid, 'sipPlans', id, sip);
                    showToast(`Started Smart SIP at ₹${newAmount.toLocaleString()}!`, 'success');
                } else {
                    if (!sip) return;
                    await DBService.saveData(uid, 'sipPlans', sip.id, {
                        ...sip,
                        monthlyAmount: newAmount
                    });
                    showToast(`SIP boosted to ₹${newAmount.toLocaleString()}!`, 'success');
                }
                
                // Award points for building wealth
                try {
                    const { GamificationService } = await import('./js/gamification-service.js');
                    await GamificationService.awardPoints(isStarter ? 50 : 25);
                    updateHeaderLevel();
                } catch(e) {}
            } catch (err) {
                showToast('Failed to apply boost: ' + err.message, 'error');
            }
        };

        // Global delete function attached to window for inline onclick handlers
        window.deleteInvestment = async function (id, collection) {
            if (confirm('Are you sure you want to delete this investment?')) {
                try {
                    const uid = currentUser ? currentUser.uid : null;
                    await DBService.deleteData(uid, collection, id);
                    showToast('Investment deleted successfully.', 'info');
                } catch (err) {
                    showToast('Failed to delete: ' + err.message, 'error');
                }
            }
        };

        // SIP Calculator Logic
        let sipCalculatorInitialized = false;

        function renderSIPCalculator(force = false) {
            const container = document.getElementById('sip-calculator-container');
            if (!container) return;
            
            // Only render if visible or forced
            if (container.style.display === 'none' && !force) return;
            if (sipCalculatorInitialized && !force) return;

            container.innerHTML = `
                <div class="section-header">
                    <h3 class="section-title">Interactive SIP Calculator</h3>
                </div>
                <div class="sip-calculator animate-fade-in-up">
                    <div class="calc-inputs">
                        <div class="calc-group">
                            <div class="calc-label-row">
                                <span class="calc-label">Monthly Investment</span>
                                <span class="calc-value-display">₹<span id="calc-amt-val">25000</span></span>
                            </div>
                            <input type="range" id="calc-amt" class="calc-slider" min="500" max="100000" step="500" value="25000" oninput="updateSIPCalculator()">
                        </div>
                        
                        <div class="calc-group">
                            <div class="calc-label-row">
                                <span class="calc-label">Expected Return Rate (p.a)</span>
                                <span class="calc-value-display"><span id="calc-rate-val">12</span>%</span>
                            </div>
                            <input type="range" id="calc-rate" class="calc-slider" min="1" max="30" step="0.5" value="12" oninput="updateSIPCalculator()">
                        </div>
                        
                        <div class="calc-group">
                            <div class="calc-label-row">
                                <span class="calc-label">Time Period</span>
                                <span class="calc-value-display"><span id="calc-period-val">10</span> Yr</span>
                            </div>
                            <input type="range" id="calc-period" class="calc-slider" min="1" max="40" step="1" value="10" oninput="updateSIPCalculator()">
                        </div>
                    </div>
                    
                    <div class="calc-results">
                        <div class="result-stats">
                            <div class="result-card">
                                <div class="result-label">Invested Amount</div>
                                <div class="result-value" id="res-invested">₹0</div>
                            </div>
                            <div class="result-card">
                                <div class="result-label">Est. Returns</div>
                                <div class="result-value" id="res-returns">₹0</div>
                            </div>
                        </div>
                        <div class="result-card" style="grid-column: 1/-1; background: rgba(0, 208, 156, 0.05); border-color: var(--groww-green);">
                            <div class="result-label">Total Value</div>
                            <div class="result-value highlight" id="res-total" style="font-size: 1.8rem;">₹0</div>
                        </div>
                        
                        <p style="font-size: 0.7rem; color: var(--muted); margin-top: 16px; font-style: italic;">
                            *This is an estimate based on compounding. Mutual fund investments are subject to market risks.
                        </p>
                    </div>
                </div>
            `;
            
            sipCalculatorInitialized = true;
            updateSIPCalculator();
        }

        window.updateSIPCalculator = function() {
            const amtElem = document.getElementById('calc-amt');
            const rateElem = document.getElementById('calc-rate');
            const periodElem = document.getElementById('calc-period');

            if (!amtElem || !rateElem || !periodElem) return;

            const amt = parseInt(amtElem.value);
            const rate = parseFloat(rateElem.value);
            const period = parseInt(periodElem.value);
            
            // Update labels
            document.getElementById('calc-amt-val').textContent = amt.toLocaleString();
            document.getElementById('calc-rate-val').textContent = rate;
            document.getElementById('calc-period-val').textContent = period;
            
            // Calculate
            const growth = InvestmentEngine.calculateFutureGrowth(amt, rate, period);
            
            // Update results
            document.getElementById('res-invested').textContent = `₹${Math.round(growth.totalInvested).toLocaleString('en-IN')}`;
            document.getElementById('res-returns').textContent = `₹${Math.round(growth.returns).toLocaleString('en-IN')}`;
            document.getElementById('res-total').textContent = `₹${Math.round(growth.finalValue).toLocaleString('en-IN')}`;
        }

        // AI CHAT INITIALIZATION FOR INVEST PAGE
        AIService.init({
            fab: document.getElementById('ai-chat-fab'),
            popup: document.getElementById('ai-chat-popup'),
            close: document.getElementById('ai-chat-close'),
            input: document.getElementById('ai-chat-input'),
            send: document.getElementById('ai-chat-send'),
            body: document.getElementById('ai-chat-body')
        }, () => {
            const metrics = InvestmentEngine.calculatePortfolioMetrics(
                contextData.investments.holdings,
                contextData.investments.prices
            );
            const savings = InvestmentEngine.calculateSavingsMetrics(
                contextData.investments.sipPlans,
                contextData.investments.fdAccounts,
                contextData.investments.rdAccounts
            );
            return {
                investments: contextData.investments.holdings,
                sipPlans: contextData.investments.sipPlans,
                fdAccounts: contextData.investments.fdAccounts,
                rdAccounts: contextData.investments.rdAccounts,
                prices: contextData.investments.prices,
                portfolioMetrics: metrics,
                savingsMetrics: savings,
                totalWealth: metrics.totalValue + savings.totalSaved,
                totalGain: metrics.totalGain,
                gainPercentage: metrics.gainPercentage
            };
        });

        async function updateHeaderLevel() {
            try {
                const { GamificationService } = await import('./js/gamification-service.js');
                const stats = await GamificationService.getStats();
                const badge = document.getElementById('header-level-badge');
                if (badge) {
                    badge.textContent = `LVL ${stats.level || 0}`;
                    badge.style.display = 'inline-block';
                }
            } catch (err) {
                console.warn("Failed to update header level:", err);
            }
        }
    
