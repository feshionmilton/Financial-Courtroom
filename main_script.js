  <script>
    // Affiliate Configuration
    const AFFILIATE_CONFIG = {
      amazonTag: 'your-amazon-tag-20',
      ebayCampId: '5330000000',
      aliExpressId: 'your_aliexpress_id',
      acornsUrl: 'https://www.acorns.com',
      revolutUrl: 'https://www.revolut.com',
      wealthfrontUrl: 'https://www.wealthfront.com',
      hysaUrl: 'https://www.wealthfront.com',
      rocketMoneyUrl: 'https://www.rocketmoney.com',
      rakutenUrl: 'https://www.rakuten.com',
      zeroAprCardUrl: 'https://www.bankrate.com/finance/credit-cards/balance-transfer/'
    };

    // Persistent Savings Tracker
    function loadSavings() {
      const saved = localStorage.getItem('financialCourtroomSavings');
      return saved ? parseFloat(saved) : 0;
    }

    function saveSavings(amount) {
      localStorage.setItem('financialCourtroomSavings', amount.toString());
    }

    function updateSavingsDisplay() {
      const savings = loadSavings();
      const display = document.getElementById('savings-tracker');
      if (display) {
        display.textContent = `$${savings.toFixed(2)}`;
      }
    }

    // ==================================================
    // SUPABASE INTEGRATION
    // ==================================================

    const SUPABASE_URL = 'https://magyadhrypxpcfoeykdm.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hZ3lhZGhyeXB4cGNmb2V5a2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MzIwODcsImV4cCI6MjEwNDIwODA4N30.thiU6hsKkbGd_ZLOWlET_DXLgB1XlNIjBVinUpbu8H0';

    // Defensive check: Supabase client creation
    let supabase = null;
    try {
      if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      }
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
    }

    let currentUser = null;
    let isSignUpMode = false;
    let pendingEmail = '';
    let otpTimerInterval = null;
    let otpCountdown = 60;
    let currentOtpType = ''; // 'signup' or 'recovery'

    // Auth Modal Functions
    function openAuthModal() {
      const modal = document.getElementById('auth-modal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        const errorDiv = document.getElementById('auth-error');
        if (errorDiv) errorDiv.classList.add('hidden');
      }
    }

    function closeAuthModal() {
      const modal = document.getElementById('auth-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        const emailInput = document.getElementById('auth-email');
        const passwordInput = document.getElementById('auth-password');
        const errorDiv = document.getElementById('auth-error');
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (errorDiv) errorDiv.classList.add('hidden');
        // Reset to sign in mode
        isSignUpMode = false;
        pendingEmail = '';
        // Clear OTP timer
        clearOtpTimer();
      }
    }

    function clearOtpTimer() {
      if (otpTimerInterval) {
        clearInterval(otpTimerInterval);
        otpTimerInterval = null;
      }
      otpCountdown = 60;
    }

    function startOtpTimer(buttonId) {
      clearOtpTimer();
      const resendBtn = document.getElementById(buttonId);
      if (!resendBtn) return;

      otpCountdown = 60;
      resendBtn.disabled = true;
      resendBtn.textContent = `Resend code in ${otpCountdown}s`;

      otpTimerInterval = setInterval(() => {
        otpCountdown--;
        if (otpCountdown <= 0) {
          clearInterval(otpTimerInterval);
          otpTimerInterval = null;
          resendBtn.disabled = false;
          resendBtn.textContent = 'Resend Code';
        } else {
          resendBtn.textContent = `Resend code in ${otpCountdown}s`;
        }
      }, 1000);
    }

    function toggleAuthMode() {
      isSignUpMode = !isSignUpMode;
      const title = document.getElementById('auth-modal-title');
      const subtitle = document.getElementById('auth-modal-subtitle');
      const submitBtn = document.getElementById('auth-submit-btn');
      const toggleBtn = document.getElementById('auth-toggle-mode');

      if (isSignUpMode) {
        title.textContent = 'Sign Up';
        subtitle.textContent = 'Create an account to save your rulings';
        submitBtn.textContent = 'Sign Up';
        toggleBtn.textContent = 'Already have an account? Sign In';
      } else {
        title.textContent = 'Sign In';
        subtitle.textContent = 'Access your saved rulings and sync savings';
        submitBtn.textContent = 'Sign In';
        toggleBtn.textContent = "Don't have an account? Sign Up";
      }
    }

    async function handleAuth() {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const errorDiv = document.getElementById('auth-error');

      if (!email || !password) {
        errorDiv.textContent = 'Please enter both email and password';
        errorDiv.classList.remove('hidden');
        return;
      }

      try {
        if (isSignUpMode) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          });
          if (error) throw error;
          // Auto-create profile after signup
          if (data.user) {
            await createProfile(data.user.id);
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
        }
        closeAuthModal();
      } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.remove('hidden');
      }
    }

    async function handleSignOut() {
      if (supabase) {
        await supabase.auth.signOut();
      }
    }

    // Resend OTP for Sign Up
    async function resendOtp() {
      const messageDiv = document.getElementById('otp-message');
      const resendBtn = document.getElementById('resend-otp-btn');

      if (!supabase || !pendingEmail) {
        messageDiv.textContent = 'Session expired. Please try signing up again.';
        messageDiv.className = 'mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 text-center';
        messageDiv.classList.remove('hidden');
        return;
      }

      resendBtn.disabled = true;
      messageDiv.classList.add('hidden');

      try {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: pendingEmail,
        });

        if (error) throw error;

        messageDiv.textContent = 'A new 6-digit code has been sent!';
        messageDiv.className = 'mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 text-center';
        messageDiv.classList.remove('hidden');

        // Restart countdown timer
        startOtpTimer('resend-otp-btn');
      } catch (error) {
        messageDiv.textContent = error.message || 'Failed to resend code. Please try again.';
        messageDiv.className = 'mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 text-center';
        messageDiv.classList.remove('hidden');
        resendBtn.disabled = false;
      }
    }

    // Resend OTP for Password Recovery
    async function resendResetOtp() {
      const messageDiv = document.getElementById('reset-password-message');
      const resendBtn = document.getElementById('resend-reset-btn');

      if (!supabase || !pendingEmail) {
        messageDiv.textContent = 'Session expired. Please try again.';
        messageDiv.className = 'mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 text-center';
        messageDiv.classList.remove('hidden');
        return;
      }

      resendBtn.disabled = true;
      messageDiv.classList.add('hidden');

      try {
        const { error } = await supabase.auth.resend({
          type: 'recovery',
          email: pendingEmail,
        });

        if (error) throw error;

        messageDiv.textContent = 'A new 6-digit code has been sent!';
        messageDiv.className = 'mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 text-center';
        messageDiv.classList.remove('hidden');

        // Restart countdown timer
        startOtpTimer('resend-reset-btn');
      } catch (error) {
        messageDiv.textContent = error.message || 'Failed to resend code. Please try again.';
        messageDiv.className = 'mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400 text-center';
        messageDiv.classList.remove('hidden');
        resendBtn.disabled = false;
      }
    }

    async function createProfile(userId) {
      if (!supabase) return;
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          total_savings: 0,
          updated_at: new Date().toISOString(),
        });
      if (error) console.error('Error creating profile:', error);
    }

    // Auth State Change Handler
    if (supabase) {
      supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        updateAuthUI();

        if (currentUser) {
          // Load user's savings from Supabase
          loadSavingsFromSupabase();
          // Load case history
          loadCaseHistory();
        } else {
          // Show local savings when logged out
          updateSavingsDisplay();
          // Hide case history
          const historySection = document.getElementById('case-history-section');
          if (historySection) {
            historySection.classList.add('hidden');
          }
        }
      });
    }

    function updateAuthUI() {
      const authBtn = document.getElementById('open-auth-btn');
      const authBtnText = document.getElementById('auth-btn-text');

      if (authBtn && authBtnText) {
        if (currentUser) {
          authBtnText.textContent = currentUser.email;
          // Remove existing listeners and add sign out handler
          authBtn.replaceWith(authBtn.cloneNode(true));
          const newAuthBtn = document.getElementById('open-auth-btn');
          newAuthBtn.addEventListener('click', handleSignOut);
        } else {
          authBtnText.textContent = 'Sign In';
          // Remove existing listeners and add open modal handler
          authBtn.replaceWith(authBtn.cloneNode(true));
          const newAuthBtn = document.getElementById('open-auth-btn');
          newAuthBtn.addEventListener('click', openAuthModal);
        }
      }
    }

    // Save Ruling to Supabase
    async function saveRulingToSupabase() {
      if (!currentUser || !verdictData.productName) return;

      const { error } = await supabase
        .from('cases')
        .insert({
          user_id: currentUser.id,
          product_name: verdictData.productName,
          product_price: verdictData.price,
          hourly_wage: verdictData.wage,
          cost_per_use: verdictData.costPerUse,
          verdict_text: verdictData.verdict,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error saving ruling:', error);
      } else {
        // Refresh case history
        loadCaseHistory();
      }
    }

    // Load Savings from Supabase
    async function loadSavingsFromSupabase() {
      if (!currentUser) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('total_savings')
        .eq('id', currentUser.id)
        .single();

      if (error) {
        console.error('Error loading savings:', error);
        return;
      }

      if (data) {
        const savings = data.total_savings || 0;
        saveSavings(savings);
        updateSavingsDisplay();
      }
    }

    // Sync Savings to Supabase
    async function syncSavingsToSupabase(amount) {
      if (!currentUser) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          total_savings: amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id);

      if (error) {
        console.error('Error syncing savings:', error);
      }
    }

    // Load Case History
    async function loadCaseHistory() {
      if (!currentUser) return;

      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading case history:', error);
        return;
      }

      renderCaseHistory(data || []);
    }

    function renderCaseHistory(cases) {
      const historySection = document.getElementById('case-history-section');
      const historyList = document.getElementById('case-history-list');
      const noHistoryMsg = document.getElementById('no-history-msg');

      if (!historySection || !historyList) return;

      if (!cases || cases.length === 0) {
        historySection.classList.add('hidden');
        return;
      }

      historySection.classList.remove('hidden');
      historyList.innerHTML = '';

      cases.forEach((caseItem) => {
        const card = document.createElement('div');
        card.className = 'glass-card rounded-lg p-4';
        card.innerHTML = `
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-semibold dark:text-white text-gray-900">${caseItem.product_name}</h3>
            <span class="text-xs dark:text-gray-400 text-gray-600">${new Date(caseItem.created_at).toLocaleDateString()}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm dark:text-gray-300 text-gray-700">$${caseItem.product_price.toFixed(2)}</span>
            <span class="px-2 py-1 rounded text-xs font-bold ${
              caseItem.verdict_text === 'APPROVED' ? 'bg-green-500 text-white' :
              caseItem.verdict_text === 'PROBATION' ? 'bg-yellow-500 text-white' :
              'bg-red-500 text-white'
            }">${caseItem.verdict_text}</span>
          </div>
        `;
        historyList.appendChild(card);
      });
    }

    // Savings Menu Functions
    function openSavingsMenu() {
      const savings = loadSavings();
      const annualInterest = (savings * 0.045).toFixed(2);
      
      document.getElementById('modal-savings').textContent = `$${savings.toFixed(2)}`;
      document.getElementById('high-yield-total').textContent = `$${savings.toFixed(2)}`;
      document.getElementById('annual-interest').textContent = annualInterest;
      document.getElementById('wealthfront-link').href = AFFILIATE_CONFIG.wealthfrontUrl;
      
      document.getElementById('savings-modal').classList.remove('hidden');
      document.getElementById('savings-modal').classList.add('flex');
    }

    function closeSavingsMenu() {
      document.getElementById('savings-modal').classList.add('hidden');
      document.getElementById('savings-modal').classList.remove('flex');
    }

    function confirmDeduction() {
      const currentSavings = loadSavings();
      const input = document.getElementById('deduct-amount');
      const deduction = parseFloat(input.value);
      
      if (isNaN(deduction) || deduction <= 0) {
        alert('Please enter a valid positive amount.');
        return;
      }
      
      if (deduction > currentSavings) {
        alert(`Cannot deduct more than current savings ($${currentSavings.toFixed(2)}).`);
        return;
      }
      
      const newSavings = currentSavings - deduction;
      saveSavings(newSavings);
      updateSavingsDisplay();
      document.getElementById('modal-savings').textContent = `$${newSavings.toFixed(2)}`;
      input.value = '';
      alert(`$${deduction.toFixed(2)} has been deducted from your savings.`);
    }

    function resetSavings() {
      const currentSavings = loadSavings();

      if (currentSavings === 0) {
        alert('Savings are already at $0.00');
        return;
      }

      if (confirm(`Are you sure you want to reset your total savings from $${currentSavings.toFixed(2)} to $0.00?\n\nThis action cannot be undone.`)) {
        saveSavings(0);
        updateSavingsDisplay();
        document.getElementById('modal-savings').textContent = '$0.00';
        closeSavingsMenu();

        // Sync to Supabase if logged in
        if (currentUser) {
          syncSavingsToSupabase(0);
        }

        alert('Savings have been reset to $0.00');
      }
    }

    // Leak Scanner Functions
    function openLeakScanner() {
      document.getElementById('rocket-money-link').href = AFFILIATE_CONFIG.rocketMoneyUrl;
      document.getElementById('leak-scanner-modal').classList.remove('hidden');
      document.getElementById('leak-scanner-modal').classList.add('flex');
    }

    function closeLeakScanner() {
      document.getElementById('leak-scanner-modal').classList.add('hidden');
      document.getElementById('leak-scanner-modal').classList.remove('flex');
    }

    // Wizard State
    let currentStep = 1;
    let selectedGrowthYears = 3; // Default to 3 years
    let isCurrentCaseSaved = false; // Track if current case savings have been banked
    let verdictData = {
      productName: '',
      price: 0,
      wage: 0,
      intent: '',
      frequency: '',
      replaces: false,
      defense: '',
      verdict: '',
      laborHours: 0,
      investmentValue: 0,
      costPerUse: 0,
      speech: ''
    };

    // Compound Growth Calculator
    function setGrowthYears(years) {
      selectedGrowthYears = parseInt(years);
      
      // Update button styles
      document.querySelectorAll('.growth-year-btn').forEach(btn => {
        const btnYears = parseInt(btn.dataset.years);
        if (btnYears === selectedGrowthYears) {
          btn.className = 'growth-year-btn px-3 py-1 rounded-lg text-sm font-medium bg-green-500/30 border border-green-500/50 transition-all';
        } else {
          btn.className = 'growth-year-btn px-3 py-1 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 transition-all';
        }
      });
      
      // Recalculate and display
      updateGrowthDisplay();
    }

    function updateGrowthDisplay() {
      const price = verdictData.price || 0;
      const futureValue = price * Math.pow(1.07, selectedGrowthYears);
      const profit = futureValue - price;
      
      document.getElementById('investment-value').textContent = `$${futureValue.toFixed(2)}`;
      document.getElementById('growth-profit').textContent = `+$${profit.toFixed(2)} profit in ${selectedGrowthYears} year${selectedGrowthYears !== 1 ? 's' : ''}`;
    }

    // Set Wage Preset
    function setWage(amount) {
      document.getElementById('hourly-wage').value = amount;
    }

    // Step Navigation
    function goToStep(step) {
      // Validate current step before proceeding
      if (step > currentStep) {
        if (!validateStep(currentStep)) {
          return;
        }
      }

      // Hide all steps
      document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
      
      // Show target step
      document.getElementById(`step-${step}`).classList.remove('hidden');
      
      // Update indicators
      for (let i = 1; i <= 3; i++) {
        const indicator = document.getElementById(`step-${i}-indicator`);
        indicator.classList.remove('active', 'completed');
        if (i < step) {
          indicator.classList.add('completed');
        } else if (i === step) {
          indicator.classList.add('active');
        }
      }

      currentStep = step;

      // If going to step 3, calculate verdict
      if (step === 3) {
        isCurrentCaseSaved = false; // Reset save state for new case
        calculateVerdict();
      }
    }

    // Validate Step
    function validateStep(step) {
      if (step === 1) {
        const productName = document.getElementById('product-name').value.trim();
        const price = parseFloat(document.getElementById('product-price').value);
        const wage = parseFloat(document.getElementById('hourly-wage').value);

        if (!productName) {
          alert('Please enter a product name.');
          return false;
        }
        if (!price || price <= 0) {
          alert('Please enter a valid product price.');
          return false;
        }
        if (!wage || wage <= 0) {
          alert('Please enter a valid hourly wage.');
          return false;
        }

        verdictData.productName = productName;
        verdictData.price = price;
        verdictData.wage = wage;
      }

      if (step === 2) {
        const intent = document.getElementById('purchase-intent').value;
        const frequency = document.getElementById('usage-frequency').value;

        if (!intent) {
          alert('Please select a purchase intent.');
          return false;
        }
        if (!frequency) {
          alert('Please select a usage frequency.');
          return false;
        }

        verdictData.intent = intent;
        verdictData.frequency = frequency;
        verdictData.replaces = document.getElementById('replacement-toggle').checked;
        verdictData.defense = document.getElementById('custom-defense').value.trim();
      }

      return true;
    }

    // Calculate Verdict
    function calculateVerdict() {
      const { price, wage, intent, frequency, replaces, productName } = verdictData;

      // Calculate labor hours
      const laborHours = price / wage;
      verdictData.laborHours = laborHours;

      // Calculate 10-year investment value (7% compound interest)
      const investmentValue = price * Math.pow(1.07, 10);
      verdictData.investmentValue = investmentValue;

      // Calculate cost per use based on frequency
      let usesPerYear = 0;
      switch (frequency) {
        case 'daily': usesPerYear = 365; break;
        case 'weekly': usesPerYear = 52; break;
        case 'monthly': usesPerYear = 12; break;
        case 'rarely': usesPerYear = 4; break;
        case 'once': usesPerYear = 1; break;
      }
      const costPerUse = usesPerYear > 0 ? price / usesPerYear : price;
      verdictData.costPerUse = costPerUse;

      // Determine verdict based on multiple factors
      let score = 0;
      
      // Intent scoring
      const intentScores = {
        'essential': 10,
        'productivity': 8,
        'investment': 9,
        'entertainment': 5,
        'luxury': 3,
        'impulse': 0
      };
      score += intentScores[intent] || 0;

      // Frequency bonus
      const frequencyBonus = {
        'daily': 5,
        'weekly': 4,
        'monthly': 3,
        'rarely': 1,
        'once': 0
      };
      score += frequencyBonus[frequency] || 0;

      // Replacement bonus
      if (replaces) score += 3;

      // Labor hours penalty (more than 40 hours is a red flag)
      if (laborHours > 40) score -= 3;
      if (laborHours > 80) score -= 5;

      // Cost per use penalty
      if (costPerUse > 100) score -= 2;
      if (costPerUse > 500) score -= 4;

      // Determine verdict
      let verdict = '';
      let stampClass = '';
      let speech = '';

      if (score >= 12) {
        verdict = 'APPROVED';
        stampClass = 'stamp-approved';
        speech = `The court finds in favor of the purchase of ${productName}. This item serves a legitimate purpose with reasonable cost efficiency. The labor required (${laborHours.toFixed(1)} hours) is justified by the intended use. Case dismissed for good cause.`;
      } else if (score >= 6) {
        verdict = 'PROBATION';
        stampClass = 'stamp-probation';
        speech = `The court places the purchase of ${productName} on probation. While not entirely unjustified, careful consideration is advised. The cost per use of $${costPerUse.toFixed(2)} requires further reflection. Proceed with caution.`;
      } else {
        verdict = 'GUILTY OF IMPULSE';
        stampClass = 'stamp-guilty';
        speech = `The court finds the defendant guilty of impulse buying. The purchase of ${productName} at $${price.toFixed(2)} requires ${laborHours.toFixed(1)} hours of labor with questionable utility. This case is hereby dismissed. Consider the ${investmentValue.toFixed(2)} this could have grown to in 10 years.`;
      }

      verdictData.verdict = verdict;
      verdictData.speech = speech;

      // Update UI
      const stampContainer = document.getElementById('verdict-stamp');
      const stampDiv = stampContainer.querySelector('div');
      stampDiv.textContent = verdict;
      stampDiv.className = `inline-block px-8 py-4 rounded-lg text-3xl font-bold text-white uppercase tracking-wider ${stampClass}`;
      stampContainer.classList.remove('hidden');

      document.getElementById('labor-hours').textContent = `${laborHours.toFixed(1)} hours`;
      document.getElementById('cost-per-use').textContent = `$${costPerUse.toFixed(2)}`;
      
      // Update compound growth display with selected years
      updateGrowthDisplay();
      
      document.getElementById('calculations').classList.remove('hidden');

      // Store the English speech for display, but TTS will use translated versions
      verdictData.speech = speech;
      document.getElementById('ai-speech').textContent = speech;
      document.getElementById('speech-section').classList.remove('hidden');

      // Show save button only for approved verdicts (savings from NOT buying)
      const saveBtn = document.getElementById('save-btn');
      if (verdict !== 'APPROVED') {
        saveBtn.classList.remove('hidden');
        saveBtn.classList.remove('opacity-60', 'cursor-not-allowed', 'bg-green-900/40', 'text-green-300');
        saveBtn.textContent = `💰 Save $${price.toFixed(2)} to Total Savings`;
      } else {
        saveBtn.classList.add('hidden');
      }

      document.getElementById('action-buttons').classList.remove('hidden');

      // Save ruling to Supabase if logged in
      saveRulingToSupabase();

      // Module 4: Show cashback card for APPROVED verdicts
      const cashbackCard = document.getElementById('cashback-card');
      if (verdict === 'APPROVED') {
        const estCashback = Math.round(price * 0.05);
        const totalBenefit = estCashback + 30;
        
        document.getElementById('cashback-price').textContent = `$${price.toFixed(2)}`;
        document.getElementById('est-cashback').textContent = estCashback;
        document.getElementById('total-benefit').textContent = totalBenefit;
        document.getElementById('cta-cashback').textContent = estCashback;
        document.getElementById('rakuten-link').href = AFFILIATE_CONFIG.rakutenUrl;
        cashbackCard.classList.remove('hidden');
      } else {
        cashbackCard.classList.add('hidden');
      }

      // Module 5: Show 0% APR card for GUILTY verdicts
      const zeroAprCard = document.getElementById('zero-apr-card');
      if (verdict === 'GUILTY OF IMPULSE') {
        document.getElementById('zero-apr-link').href = AFFILIATE_CONFIG.zeroAprCardUrl;
        zeroAprCard.classList.remove('hidden');
      } else {
        zeroAprCard.classList.add('hidden');
      }

      // Module 6: Show HYSA card for PROBATION verdicts
      const hysaCard = document.getElementById('hysa-card');
      if (verdict === 'PROBATION') {
        document.getElementById('hysa-price').textContent = price.toFixed(2);
        document.getElementById('hysa-cta-price').textContent = price.toFixed(2);
        document.getElementById('hysa-link').href = AFFILIATE_CONFIG.hysaUrl;
        hysaCard.classList.remove('hidden');
      } else {
        hysaCard.classList.add('hidden');
      }
    }

    // ==================================================
    // DARK MODE / LIGHT MODE TOGGLE
    // ==================================================

    function toggleTheme() {
      const html = document.documentElement;
      const isDark = html.classList.toggle('dark');
      const themeIcon = document.getElementById('theme-icon');

      // Update icon
      if (themeIcon) {
        themeIcon.textContent = isDark ? '☀️' : '🌙';
      }

      // Save preference to localStorage
      localStorage.setItem('financial_courtroom_theme', isDark ? 'dark' : 'light');
    }

    function initTheme() {
      const html = document.documentElement;
      const themeIcon = document.getElementById('theme-icon');

      // Check localStorage first
      const savedTheme = localStorage.getItem('financial_courtroom_theme');

      if (savedTheme) {
        // Use saved preference
        if (savedTheme === 'dark') {
          html.classList.add('dark');
          if (themeIcon) themeIcon.textContent = '☀️';
        } else {
          html.classList.remove('dark');
          if (themeIcon) themeIcon.textContent = '🌙';
        }
      } else {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          html.classList.add('dark');
          if (themeIcon) themeIcon.textContent = '☀️';
        } else {
          html.classList.remove('dark');
          if (themeIcon) themeIcon.textContent = '🌙';
        }
      }
    }



    // ==================================================
    // CLEAN CROSS-DEVICE TEXT-TO-SPEECH (PLAY / STOP)
    // ==================================================

    // Global Utterance reference to prevent Chrome Garbage Collection
    window.currentUtterance = null;

    function getPreferredVoice() {
      if (!('speechSynthesis' in window)) return null;
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return null;

      // Pick standard male or natural English voice
      return voices.find(v =>
        v.lang.startsWith('en') &&
        (v.name.includes('Male') || v.name.includes('David') || v.name.includes('Google US English') || v.name.includes('Natural'))
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    }

    // Pre-warm voice engine for Chrome and Safari
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => getPreferredVoice();
    }

    function initTTS() {
      const ttsBtn = document.getElementById('tts-toggle-btn');
      const textCard = document.getElementById('ai-speech');
      if (!ttsBtn || !textCard) return;

      ttsBtn.addEventListener('click', () => {
        const synth = window.speechSynthesis;
        if (!synth) return;

        // STATE 1: If currently speaking, STOP cleanly
        if (synth.speaking) {
          synth.cancel();
          updateTTSUI(false);
          return;
        }

        // STATE 2: If stopped, START speaking synchronously
        synth.cancel(); // Clear any hung browser queues

        const rulingText = textCard.innerText.trim();
        if (!rulingText) return;

        window.currentUtterance = new SpeechSynthesisUtterance(rulingText);

        const voice = getPreferredVoice();
        if (voice) window.currentUtterance.voice = voice;

        window.currentUtterance.pitch = 0.9;
        window.currentUtterance.rate = 0.95;

        // State listeners
        window.currentUtterance.onstart = () => updateTTSUI(true);
        window.currentUtterance.onend = () => updateTTSUI(false);
        window.currentUtterance.onerror = () => updateTTSUI(false);

        // Execute synchronously to preserve touch gesture permissions on mobile
        synth.speak(window.currentUtterance);
      });
    }

    function updateTTSUI(isPlaying) {
      const icon = document.getElementById('tts-icon');
      const label = document.getElementById('tts-label');
      const btn = document.getElementById('tts-toggle-btn');
      if (!btn) return;

      if (isPlaying) {
        if (icon) icon.textContent = '⏹';
        if (label) label.textContent = 'Stop Ruling';
        btn.className = "w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md";
      } else {
        if (icon) icon.textContent = '🔊';
        if (label) label.textContent = 'Listen to Ruling';
        btn.className = "w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md";
      }
    }

    // Clean up speech when user leaves or hides tab
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        updateTTSUI(false);
      }
    });



    // Save to Savings
    function saveToSavings() {
      // Prevent spamming - check if already saved for this case
      if (isCurrentCaseSaved) {
        return;
      }

      const currentSavings = loadSavings();
      const newSavings = currentSavings + verdictData.price;
      saveSavings(newSavings);
      updateSavingsDisplay();

      // Sync to Supabase if logged in
      if (currentUser) {
        syncSavingsToSupabase(newSavings);
      }

      // Mark as saved
      isCurrentCaseSaved = true;

      // Update button UI to disabled state
      const saveBtn = document.getElementById('save-btn');
      saveBtn.textContent = `✓ $${verdictData.price.toFixed(2)} Saved to Total Savings`;
      saveBtn.classList.add('opacity-60', 'cursor-not-allowed', 'bg-green-900/40', 'text-green-300');

      // Show invest success modal
      const amount = verdictData.price.toFixed(2);
      document.getElementById('invest-amount-text').textContent = `$${amount}`;
      document.getElementById('invest-amount-card').textContent = `$${amount}`;
      document.getElementById('invest-amount-btn').textContent = amount;
      document.getElementById('acorns-link').href = AFFILIATE_CONFIG.acornsUrl;

      document.getElementById('invest-success-modal').classList.remove('hidden');
      document.getElementById('invest-success-modal').classList.add('flex');
    }

    function closeInvestModal() {
      document.getElementById('invest-success-modal').classList.add('hidden');
      document.getElementById('invest-success-modal').classList.remove('flex');
    }

    function openInvestChoiceModal() {
      const amount = verdictData.price.toFixed(2);
      document.getElementById('choice-amount').textContent = `$${amount}`;
      document.getElementById('acorns-choice-link').href = AFFILIATE_CONFIG.acornsUrl;
      document.getElementById('revolut-choice-link').href = AFFILIATE_CONFIG.revolutUrl;
      
      document.getElementById('invest-success-modal').classList.add('hidden');
      document.getElementById('invest-success-modal').classList.remove('flex');
      
      document.getElementById('invest-choice-modal').classList.remove('hidden');
      document.getElementById('invest-choice-modal').classList.add('flex');
    }

    function closeInvestChoiceModal() {
      document.getElementById('invest-choice-modal').classList.add('hidden');
      document.getElementById('invest-choice-modal').classList.remove('flex');
    }

    // Reset Wizard
    function resetWizard() {
      // Reset save state for new case
      isCurrentCaseSaved = false;

      // Reset form fields
      document.getElementById('product-name').value = '';
      document.getElementById('product-price').value = '';
      document.getElementById('hourly-wage').value = '';
      document.getElementById('purchase-intent').value = '';
      document.getElementById('usage-frequency').value = '';
      document.getElementById('replacement-toggle').checked = false;
      document.getElementById('custom-defense').value = '';

      // Reset verdict data
      verdictData = {
        productName: '',
        price: 0,
        wage: 0,
        intent: '',
        frequency: '',
        replaces: false,
        defense: '',
        verdict: '',
        laborHours: 0,
        investmentValue: 0,
        costPerUse: 0,
        speech: ''
      };

      // Hide verdict elements
      document.getElementById('verdict-stamp').classList.add('hidden');
      document.getElementById('calculations').classList.add('hidden');
      document.getElementById('speech-section').classList.add('hidden');
      document.getElementById('action-buttons').classList.add('hidden');

      // Go back to step 1
      goToStep(1);
    }



    // ============ BARGAIN ENGINE ============
    // Smart Price Keyword Dictionary
    const PRICE_KEYWORDS = {
      'iphone 15 pro max': 1199.00,
      '15 pro max': 1199.00,
      'iphone 15 pro': 999.00,
      '15 pro': 999.00,
      'iphone 15': 799.00,
      'iphone 14 pro max': 899.00,
      '14 pro max': 899.00,
      'iphone 14 pro': 799.00,
      '14 pro': 799.00,
      'iphone 14': 699.00,
      'iphone 13 pro max': 699.00,
      '13 pro max': 699.00,
      'iphone 13 pro': 599.00,
      '13 pro': 599.00,
      'iphone 13': 499.00,
      'iphone 12 pro max': 550.00,
      '12 pro max': 550.00,
      'iphone 12 pro': 499.00,
      '12 pro': 499.00,
      'iphone 12': 449.00,
      'iphone': 999.00,
      'flagship phone': 999.00,
      'smartphone': 999.00,
      'macbook': 999.00,
      'laptop': 999.00,
      'notebook': 999.00,
      'ps5': 499.00,
      'playstation 5': 499.00,
      'playstation': 499.00,
      'xbox': 499.00,
      'console': 499.00,
      'keyboard': 100.00,
      'mouse': 120.00,
      'headset': 120.00,
      'headphones': 120.00,
      'monitor': 299.00,
      'tv': 499.00,
      'television': 499.00,
      'tablet': 399.00,
      'ipad': 399.00,
      'watch': 399.00,
      'smartwatch': 399.00,
      'camera': 799.00,
      'speaker': 199.00,
      'earbuds': 149.00,
      'airpods': 149.00
    };

    // Specific marketplace price mappings for accurate pricing
    const MARKETPLACE_PRICES = {
      'iphone 15 pro max': { retail: 1199.00, amazon: 1049.00, ebay: 980.00, aliexpress: 920.00 },
      '15 pro max': { retail: 1199.00, amazon: 1049.00, ebay: 980.00, aliexpress: 920.00 },
      'iphone 14 pro max': { retail: 899.00, amazon: 780.00, ebay: 720.00, aliexpress: 670.00 },
      '14 pro max': { retail: 899.00, amazon: 780.00, ebay: 720.00, aliexpress: 670.00 },
      'iphone 13 pro max': { retail: 699.00, amazon: 590.00, ebay: 540.00, aliexpress: 490.00 },
      '13 pro max': { retail: 699.00, amazon: 590.00, ebay: 540.00, aliexpress: 490.00 },
      'iphone 12 pro max': { retail: 550.00, amazon: 460.00, ebay: 410.00, aliexpress: 380.00 },
      '12 pro max': { retail: 550.00, amazon: 460.00, ebay: 410.00, aliexpress: 380.00 }
    };

    function estimateRetailPrice(query) {
      const lowerQuery = query.toLowerCase();

      // Check if active case price exists and matches query
      if (verdictData.price > 0 && verdictData.productName) {
        const caseName = verdictData.productName.toLowerCase();
        if (lowerQuery.includes(caseName) || caseName.includes(lowerQuery)) {
          return verdictData.price;
        }
      }

      // Check for specific marketplace prices first
      for (const [keyword, prices] of Object.entries(MARKETPLACE_PRICES)) {
        if (lowerQuery.includes(keyword)) {
          return prices.retail;
        }
      }

      // Specific model number/keyword matching (more specific first)
      for (const [keyword, price] of Object.entries(PRICE_KEYWORDS)) {
        if (lowerQuery.includes(keyword)) {
          return price;
        }
      }

      // Default fallback for realistic market rate
      return 150.00;
    }

    function calculateBargains() {
      const query = document.getElementById('bargain-search-input').value.trim();
      if (!query) {
        return;
      }

      // Strict container wiping
      const resultsContainer = document.getElementById('bargain-results-container');
      resultsContainer.innerHTML = '';

      // Show loading indicator
      resultsContainer.innerHTML = `<div class="p-4 text-center text-slate-400">🔍 Scanning live market deals for "${query}"...</div>`;

      // Clean query sanitization for price matching
      const cleanQuery = query.trim().replace(/\s+/g, ' ');

      // Raw query for URL generation (no extra keywords)
      const rawQuery = query.trim().replace(/\s+/g, ' ');

      // Determine base price dynamically
      const basePrice = estimateRetailPrice(cleanQuery);

      // Get specific marketplace prices if available
      let marketplacePrices = null;
      const lowerQuery = cleanQuery.toLowerCase();
      for (const [keyword, prices] of Object.entries(MARKETPLACE_PRICES)) {
        if (lowerQuery.includes(keyword)) {
          marketplacePrices = prices;
          break;
        }
      }

      // Use specific marketplace prices or calculate from base price
      let amazonPrice, ebayPrice, aliexpressPrice;
      if (marketplacePrices) {
        amazonPrice = marketplacePrices.amazon;
        ebayPrice = marketplacePrices.ebay;
        aliexpressPrice = marketplacePrices.aliexpress;
      } else {
        // Fallback to percentage-based calculations
        amazonPrice = basePrice * 0.85;
        ebayPrice = basePrice * 0.72;
        aliexpressPrice = basePrice * 0.58;
      }

      const amazonSavings = basePrice - amazonPrice;
      const ebaySavings = basePrice - ebayPrice;
      const aliexpressSavings = basePrice - aliexpressPrice;

      // Generate live search links with raw query (no extra keywords)
      const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(rawQuery)}`;
      const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(rawQuery)}`;
      const aliexpressUrl = `https://www.aliexpress.com/w/wholesale-${encodeURIComponent(rawQuery)}.html`;

      // Update UI with results showing retail vs bargain prices
      resultsContainer.innerHTML = `
        <div class="p-4 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
          <div>
            <p class="font-semibold text-orange-400">Amazon Renewed</p>
            <p class="text-2xl font-mono font-bold">$${amazonPrice.toFixed(2)}</p>
            <p class="text-xs text-gray-400">Est. Retail: $${basePrice.toFixed(2)} → Est: $${amazonPrice.toFixed(2)} (Save $${amazonSavings.toFixed(2)})</p>
            <p class="text-sm text-gray-400 mt-1">~15% discount, 90-day warranty</p>
          </div>
          <a href="${amazonUrl}" target="_blank" rel="noopener noreferrer" class="glass-button px-4 py-2 rounded-lg text-sm font-medium">
            View Deal →
          </a>
        </div>

        <div class="p-4 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
          <div>
            <p class="font-semibold text-blue-400">eBay Certified Refurbished</p>
            <p class="text-2xl font-mono font-bold">$${ebayPrice.toFixed(2)}</p>
            <p class="text-xs text-gray-400">Est. Retail: $${basePrice.toFixed(2)} → Est: $${ebayPrice.toFixed(2)} (Save $${ebaySavings.toFixed(2)})</p>
            <p class="text-sm text-gray-400 mt-1">~28% discount, seller rating dependent</p>
          </div>
          <a href="${ebayUrl}" target="_blank" rel="noopener noreferrer" class="glass-button px-4 py-2 rounded-lg text-sm font-medium">
            View Deal →
          </a>
        </div>

        <div class="p-4 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
          <div>
            <p class="font-semibold text-red-400">AliExpress / Open-Box</p>
            <p class="text-2xl font-mono font-bold">$${aliexpressPrice.toFixed(2)}</p>
            <p class="text-xs text-gray-400">Est. Retail: $${basePrice.toFixed(2)} → Est: $${aliexpressPrice.toFixed(2)} (Save $${aliexpressSavings.toFixed(2)})</p>
            <p class="text-sm text-gray-400 mt-1">~42% discount, longer shipping</p>
          </div>
          <a href="${aliexpressUrl}" target="_blank" rel="noopener noreferrer" class="glass-button px-4 py-2 rounded-lg text-sm font-medium">
            View Deal →
          </a>
        </div>
      `;
    }

    // ============ SOCIAL CARD GENERATOR ============
    function generateSocialCard() {
      if (!verdictData.productName || !verdictData.price) {
        alert('Please complete the wizard first to generate a card');
        return;
      }

      document.getElementById('card-product').textContent = verdictData.productName;
      document.getElementById('card-price').textContent = `$${verdictData.price.toFixed(2)}`;
      document.getElementById('card-labor').textContent = verdictData.laborHours.toFixed(1);
      document.getElementById('card-investment').textContent = verdictData.investmentValue.toFixed(0);

      const verdictEl = document.getElementById('card-verdict');
      verdictEl.textContent = verdictData.verdict;
      
      if (verdictData.verdict === 'APPROVED') {
        verdictEl.className = 'px-3 py-1 rounded-full text-sm font-bold uppercase bg-green-500';
      } else if (verdictData.verdict === 'PROBATION') {
        verdictEl.className = 'px-3 py-1 rounded-full text-sm font-bold uppercase bg-yellow-500';
      } else {
        verdictEl.className = 'px-3 py-1 rounded-full text-sm font-bold uppercase bg-red-500';
      }

      document.getElementById('social-card').classList.remove('hidden');
    }

    function downloadCard() {
      const canvas = document.getElementById('card-canvas');
      
      // Use html2canvas to capture the card and download as PNG
      html2canvas(canvas, {
        scale: 2, // High quality output
        backgroundColor: null, // Transparent background
        logging: false
      }).then(canvasEl => {
        const link = document.createElement('a');
        link.download = 'financial-courtroom-verdict.png';
        link.href = canvasEl.toDataURL('image/png');
        link.click();
      }).catch(err => {
        console.error('Error generating image:', err);
        alert('Failed to generate image. Please try again.');
      });
    }

    function copyCardText() {
      const text = `Financial Courtroom Verdict:\n\nProduct: ${verdictData.productName}\nPrice: $${verdictData.price.toFixed(2)}\nVerdict: ${verdictData.verdict}\nLabor Hours: ${verdictData.laborHours.toFixed(1)}\n10-Year Investment Value: $${verdictData.investmentValue.toFixed(2)}\n\n#FinancialCourtroom #SmartSpending`;
      
      navigator.clipboard.writeText(text).then(() => {
        alert('Card text copied to clipboard!');
      }).catch(() => {
        alert('Failed to copy text');
      });
    }

    // ============ 48-HOUR WISHLIST VAULT ============
    function loadWishlist() {
      const saved = localStorage.getItem('financialCourtroomWishlist');
      const wishlist = saved ? JSON.parse(saved) : [];
      renderWishlist(wishlist);
    }

    function saveWishlist(wishlist) {
      localStorage.setItem('financialCourtroomWishlist', JSON.stringify(wishlist));
    }

    function addToWishlist() {
      const item = document.getElementById('wishlist-item').value.trim();
      const price = parseFloat(document.getElementById('wishlist-price').value);

      if (!item || !price || price <= 0) {
        alert('Please enter a valid item name and price');
        return;
      }

      const saved = localStorage.getItem('financialCourtroomWishlist');
      const wishlist = saved ? JSON.parse(saved) : [];

      wishlist.push({
        id: Date.now(),
        item,
        price,
        addedAt: new Date().toISOString()
      });

      saveWishlist(wishlist);
      renderWishlist(wishlist);

      document.getElementById('wishlist-item').value = '';
      document.getElementById('wishlist-price').value = '';
    }

    function renderWishlist(wishlist) {
      const container = document.getElementById('wishlist-items');
      
      if (wishlist.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No items in wishlist</p>';
        return;
      }

      const now = new Date();
      container.innerHTML = wishlist.map(w => {
        const addedDate = new Date(w.addedAt);
        const hoursElapsed = (now - addedDate) / (1000 * 60 * 60);
        const hoursRemaining = Math.max(0, 48 - hoursElapsed);
        const canPurchase = hoursRemaining <= 0;

        return `
          <div class="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 ${canPurchase ? 'border-green-500/50' : ''}">
            <div class="flex-1">
              <p class="font-medium">${w.item}</p>
              <p class="text-sm text-gray-400">$${w.price.toFixed(2)}</p>
              <p class="text-xs ${canPurchase ? 'text-green-400' : 'text-yellow-400'}">
                ${canPurchase ? '✅ Ready to purchase!' : `⏰ ${hoursRemaining.toFixed(1)}h remaining`}
              </p>
            </div>
            <button class="remove-wishlist-btn glass-button px-3 py-1 rounded-lg text-sm text-red-400 hover:text-red-300" data-id="${w.id}">
              Remove
            </button>
          </div>
        `;
      }).join('');

      // Add event listeners to remove buttons
      container.querySelectorAll('.remove-wishlist-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.id);
          removeFromWishlist(id);
        });
      });
    }

    function removeFromWishlist(id) {
      const saved = localStorage.getItem('financialCourtroomWishlist');
      const wishlist = saved ? JSON.parse(saved) : [];
      const filtered = wishlist.filter(w => w.id !== id);
      saveWishlist(filtered);
      renderWishlist(filtered);
    }

    function clearExpiredWishlist() {
      const saved = localStorage.getItem('financialCourtroomWishlist');
      const wishlist = saved ? JSON.parse(saved) : [];
      const now = new Date();
      
      const active = wishlist.filter(w => {
        const addedDate = new Date(w.addedAt);
        const hoursElapsed = (now - addedDate) / (1000 * 60 * 60);
        return hoursElapsed < 48;
      });

      saveWishlist(active);
      renderWishlist(active);
      alert(`Cleared ${wishlist.length - active.length} expired items`);
    }

    // ============ COMMUNITY WALL OF SHAME ============
    function loadWallOfShame() {
      const saved = localStorage.getItem('financialCourtroomWallOfShame');
      const wall = saved ? JSON.parse(saved) : [];
      renderWallOfShame(wall);
    }

    function saveWallOfShame(wall) {
      localStorage.setItem('financialCourtroomWallOfShame', JSON.stringify(wall));
    }

    function addToWallOfShame() {
      const item = document.getElementById('shame-item').value.trim();
      const price = parseFloat(document.getElementById('shame-price').value);

      if (!item || !price || price <= 0) {
        alert('Please enter a valid item name and price');
        return;
      }

      const saved = localStorage.getItem('financialCourtroomWallOfShame');
      const wall = saved ? JSON.parse(saved) : [];

      wall.push({
        id: Date.now(),
        item,
        price,
        confessedAt: new Date().toISOString()
      });

      saveWallOfShame(wall);
      renderWallOfShame(wall);

      document.getElementById('shame-item').value = '';
      document.getElementById('shame-price').value = '';
    }

    function renderWallOfShame(wall) {
      const container = document.getElementById('wall-of-shame-items');
      const totalRegretEl = document.getElementById('total-regret');
      
      if (wall.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No confessions yet - stay strong!</p>';
        totalRegretEl.textContent = '$0.00';
        return;
      }

      const totalRegret = wall.reduce((sum, w) => sum + w.price, 0);
      totalRegretEl.textContent = `$${totalRegret.toFixed(2)}`;

      container.innerHTML = wall.map(w => {
        const date = new Date(w.confessedAt).toLocaleDateString();
        return `
          <div class="flex items-center justify-between p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div class="flex-1">
              <p class="font-medium text-red-300">${w.item}</p>
              <p class="text-sm text-gray-400">$${w.price.toFixed(2)} • ${date}</p>
            </div>
            <button class="remove-wall-of-shame-btn glass-button px-3 py-1 rounded-lg text-sm text-gray-400 hover:text-white" data-id="${w.id}">
              🗑️
            </button>
          </div>
        `;
      }).join('');

      // Add event listeners to remove buttons
      container.querySelectorAll('.remove-wall-of-shame-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.id);
          removeFromWallOfShame(id);
        });
      });
    }

    function removeFromWallOfShame(id) {
      const saved = localStorage.getItem('financialCourtroomWallOfShame');
      const wall = saved ? JSON.parse(saved) : [];
      const filtered = wall.filter(w => w.id !== id);
      saveWallOfShame(filtered);
      renderWallOfShame(filtered);
    }

    function clearWallOfShame() {
      if (confirm('Are you sure you want to clear all confessions? This cannot be undone.')) {
        localStorage.removeItem('financialCourtroomWallOfShame');
        renderWallOfShame([]);
      }
    }

    // ==================================================
    // CONSOLIDATED INITIALIZATION
    // ==================================================
    document.addEventListener('DOMContentLoaded', () => {
      // Initialize theme
      initTheme();

      // Initialize TTS
      initTTS();

      // Initialize savings display
      updateSavingsDisplay();

      // Load wishlist and wall of shame
      loadWishlist();
      loadWallOfShame();

      // Theme toggle button
      const themeToggleBtn = document.getElementById('theme-toggle-btn');
      if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
      }

      // Auth modal close button
      const authCloseBtn = document.getElementById('auth-close-btn');
      if (authCloseBtn) {
        authCloseBtn.addEventListener('click', closeAuthModal);
      }

      // Initial auth button handler (will be updated by updateAuthUI on auth state change)
      const openAuthBtn = document.getElementById('open-auth-btn');
      if (openAuthBtn && !currentUser) {
        openAuthBtn.addEventListener('click', openAuthModal);
      }

      // Auth modal backdrop click to close
      const authModal = document.getElementById('auth-modal');
      if (authModal) {
        authModal.addEventListener('click', (e) => {
          if (e.target === authModal) {
            closeAuthModal();
          }
        });
      }

      // Auth submit button
      const authSubmitBtn = document.getElementById('auth-submit-btn');
      if (authSubmitBtn) {
        authSubmitBtn.addEventListener('click', handleAuth);
      }

      // Auth toggle mode button
      const authToggleMode = document.getElementById('auth-toggle-mode');
      if (authToggleMode) {
        authToggleMode.addEventListener('click', toggleAuthMode);
      }

      // Savings badge click handler
      const savingsBadge = document.getElementById('savings-badge');
      if (savingsBadge) {
        savingsBadge.addEventListener('click', openSavingsMenu);
      }

      // Audit leaks button
      const auditLeaksBtn = document.getElementById('audit-leaks-btn');
      if (auditLeaksBtn) {
        auditLeaksBtn.addEventListener('click', openLeakScanner);
      }

      // Wizard navigation buttons
      const goToStep2Btn = document.getElementById('go-to-step-2-btn');
      if (goToStep2Btn) {
        goToStep2Btn.addEventListener('click', () => goToStep(2));
      }

      const goToStep1Btn = document.getElementById('go-to-step-1-btn');
      if (goToStep1Btn) {
        goToStep1Btn.addEventListener('click', () => goToStep(1));
      }

      const goToStep3Btn = document.getElementById('go-to-step-3-btn');
      if (goToStep3Btn) {
        goToStep3Btn.addEventListener('click', () => goToStep(3));
      }

      const resetWizardBtn = document.getElementById('reset-wizard-btn');
      if (resetWizardBtn) {
        resetWizardBtn.addEventListener('click', resetWizard);
      }

      // Set wage buttons
      const setWageBtns = document.querySelectorAll('.set-wage-btn');
      setWageBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const wage = parseInt(btn.dataset.wage);
          setWage(wage);
        });
      });

      // Growth year buttons
      const growthYearBtns = document.querySelectorAll('.growth-year-btn');
      growthYearBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const years = parseInt(btn.dataset.years);
          setGrowthYears(years);
        });
      });

      // Save button
      const saveBtn = document.getElementById('save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', saveToSavings);
      }

      // Savings menu buttons
      const confirmDeductionBtn = document.getElementById('confirm-deduction-btn');
      if (confirmDeductionBtn) {
        confirmDeductionBtn.addEventListener('click', confirmDeduction);
      }

      const resetSavingsBtn = document.getElementById('reset-savings-btn');
      if (resetSavingsBtn) {
        resetSavingsBtn.addEventListener('click', resetSavings);
      }

      const closeSavingsMenuBtn = document.getElementById('close-savings-menu-btn');
      if (closeSavingsMenuBtn) {
        closeSavingsMenuBtn.addEventListener('click', closeSavingsMenu);
      }

      // Invest modal buttons
      const openInvestChoiceBtn = document.getElementById('open-invest-choice-btn');
      if (openInvestChoiceBtn) {
        openInvestChoiceBtn.addEventListener('click', openInvestChoiceModal);
      }

      const closeInvestModalBtn = document.getElementById('close-invest-modal-btn');
      if (closeInvestModalBtn) {
        closeInvestModalBtn.addEventListener('click', closeInvestModal);
      }

      const closeInvestChoiceBtn = document.getElementById('close-invest-choice-btn');
      if (closeInvestChoiceBtn) {
        closeInvestChoiceBtn.addEventListener('click', closeInvestChoiceModal);
      }

      const acornsChoiceLink = document.getElementById('acorns-choice-link');
      if (acornsChoiceLink) {
        acornsChoiceLink.addEventListener('click', closeInvestChoiceModal);
      }

      const revolutChoiceLink = document.getElementById('revolut-choice-link');
      if (revolutChoiceLink) {
        revolutChoiceLink.addEventListener('click', closeInvestChoiceModal);
      }

      // Leak scanner buttons
      const closeLeakScannerBtn = document.getElementById('close-leak-scanner-btn');
      if (closeLeakScannerBtn) {
        closeLeakScannerBtn.addEventListener('click', closeLeakScanner);
      }

      const rocketMoneyLink = document.getElementById('rocket-money-link');
      if (rocketMoneyLink) {
        rocketMoneyLink.addEventListener('click', closeLeakScanner);
      }

      // Wishlist buttons
      const clearExpiredWishlistBtn = document.getElementById('clear-expired-wishlist-btn');
      if (clearExpiredWishlistBtn) {
        clearExpiredWishlistBtn.addEventListener('click', clearExpiredWishlist);
      }

      const addToWishlistBtn = document.getElementById('add-to-wishlist-btn');
      if (addToWishlistBtn) {
        addToWishlistBtn.addEventListener('click', addToWishlist);
      }

      // Wall of shame buttons
      const clearWallOfShameBtn = document.getElementById('clear-wall-of-shame-btn');
      if (clearWallOfShameBtn) {
        clearWallOfShameBtn.addEventListener('click', clearWallOfShame);
      }

      const addToWallOfShameBtn = document.getElementById('add-to-wall-of-shame-btn');
      if (addToWallOfShameBtn) {
        addToWallOfShameBtn.addEventListener('click', addToWallOfShame);
      }

      // Social card buttons
      const generateSocialCardBtn = document.getElementById('generate-social-card-btn');
      if (generateSocialCardBtn) {
        generateSocialCardBtn.addEventListener('click', generateSocialCard);
      }

      const downloadCardBtn = document.getElementById('download-card-btn');
      if (downloadCardBtn) {
        downloadCardBtn.addEventListener('click', downloadCard);
      }

      const copyCardTextBtn = document.getElementById('copy-card-text-btn');
      if (copyCardTextBtn) {
        copyCardTextBtn.addEventListener('click', copyCardText);
      }

      // Bargain Engine event listeners
      const findBargainsBtn = document.getElementById('find-bargains-btn');
      const bargainSearchInput = document.getElementById('bargain-search-input');

      if (findBargainsBtn) {
        findBargainsBtn.addEventListener('click', calculateBargains);
      }

      if (bargainSearchInput) {
        bargainSearchInput.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            calculateBargains();
          }
        });
      }
    });

    // Immediate initialization for fast render
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      initTheme();
      initTTS();
      updateSavingsDisplay();
      loadWishlist();
      loadWallOfShame();
    }
