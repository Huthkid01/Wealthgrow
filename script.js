// Supabase Configuration
const SUPABASE_URL = CONFIG.SUPABASE.URL;
const SUPABASE_ANON_KEY = CONFIG.SUPABASE.ANON_KEY;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let isAdmin = false;
let realtimeUpdateInterval = null;

// Security: HTML escaping function
function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Page loader functions - moved to top to fix ReferenceError
function showPageLoader() {
    const existingLoader = document.getElementById('page-loader');
    if (existingLoader) return;

    const loader = document.createElement('div');
    loader.id = 'page-loader';
    loader.innerHTML = `
        <div class="page-loader-overlay">
            <div class="page-loader-content">
                <div class="page-loader-spinner">
                    <div class="spinner-ring"></div>
                    <div class="spinner-ring"></div>
                    <div class="spinner-ring"></div>
                    <div class="spinner-ring"></div>
                </div>
                <div class="page-loader-text">Loading Wealth Grow...</div>
                <div class="page-loader-progress">
                    <div class="progress-bar"></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(loader);

    // Animate progress bar
    const progressBar = loader.querySelector('.progress-bar');
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
        }
        progressBar.style.width = progress + '%';
    }, 200);
}

function hidePageLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.remove();
        }, 300);
    }
}

// Update navigation based on login status
function updateNavigation() {
    try {
        const user = JSON.parse(localStorage.getItem('wealthgrow_user'));
        const isLoggedIn = !!user;

        // Desktop navigation
        const dashboardLink = document.getElementById('dashboard-link');
        const loginLink = document.getElementById('login-link');
        const logoutLink = document.getElementById('logout-link');
        const notificationsSection = document.getElementById('notifications-section');

        // Mobile navigation
        const mobileDashboardLink = document.getElementById('mobile-dashboard-link');
        const mobileLoginLink = document.getElementById('mobile-login-link');
        const mobileLogoutLink = document.getElementById('mobile-logout-link');
        const mobileNotificationsLink = document.getElementById('mobile-notifications-link');

        if (isLoggedIn) {
            // Show logged-in navigation
            if (dashboardLink) dashboardLink.style.display = 'block';
            if (loginLink) loginLink.style.display = 'none';
            if (logoutLink) logoutLink.style.display = 'block';
            if (notificationsSection) notificationsSection.style.display = 'block';

            if (mobileDashboardLink) mobileDashboardLink.style.display = 'block';
            if (mobileLoginLink) mobileLoginLink.style.display = 'none';
            if (mobileLogoutLink) mobileLogoutLink.style.display = 'block';
            if (mobileNotificationsLink) mobileNotificationsLink.style.display = 'block';
        } else {
            // Show logged-out navigation
            if (dashboardLink) dashboardLink.style.display = 'none';
            if (loginLink) loginLink.style.display = 'block';
            if (logoutLink) logoutLink.style.display = 'none';
            if (notificationsSection) notificationsSection.style.display = 'none';

            if (mobileDashboardLink) mobileDashboardLink.style.display = 'none';
            if (mobileLoginLink) mobileLoginLink.style.display = 'block';
            if (mobileLogoutLink) mobileLogoutLink.style.display = 'none';
            if (mobileNotificationsLink) mobileNotificationsLink.style.display = 'none';
        }
    } catch (err) {
    }
}

// Safe API wrapper
async function safeApiCall(apiPromise, errorMessage = 'Operation failed') {
    try {
        return await apiPromise;
    } catch (err) {
        await showAlert(errorMessage, 'error');
        throw err;
    }
}

// Request notification permission
async function requestNotificationPermission() {
    if ('Notification' in window) {
        try {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        } catch (err) {
            return false;
        }
    }
    return false;
}

// Show browser notification
function showBrowserNotification(title, message, icon = '/favicon.ico') {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: message,
            icon: icon,
            badge: icon,
            tag: 'wealthgrow-notification'
        });

        notification.onclick = function() {
            window.focus();
            notification.close();
        };

        // Auto close after 5 seconds
        setTimeout(() => {
            notification.close();
        }, 5000);
    }
}

// Show toast notification
function showToast(title, message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${getToastIcon(type)}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    toastContainer.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);

    // Add click to close
    toast.addEventListener('click', () => toast.remove());
}

function getToastIcon(type) {
    switch (type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        case 'info':
        default: return 'ℹ️';
    }
}

function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// Create notification for user
async function createUserNotification(userId, title, message, type = 'info') {
    try {
        const { error } = await supabaseClient
            .from('notifications')
            .insert({
                user_id: userId,
                title: title,
                message: message,
                type: type,
                is_read: false
            });

        if (error) {
        } else {
            if (currentUser && currentUser.id === userId) {
                loadNotificationCount();
                loadNotifications();

                // Show toast notification for current user
                showToast(title, message, type);

                // Show browser notification if permission granted
                showBrowserNotification(title, message);
            }
        }
    } catch (err) {
    }
}

// Load notification count
async function loadNotificationCount() {
    if (!currentUser) return;

    try {
        const { data: notifications, error } = await supabaseClient
            .from('notifications')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('is_read', false);

        if (error) throw error;

        const count = notifications ? notifications.length : 0;
        const notificationCount = document.getElementById('notification-count');

        if (notificationCount) {
            notificationCount.textContent = count > 0 ? count : '';
            notificationCount.style.display = count > 0 ? 'inline-block' : 'none';
        }
    } catch (err) {
    }
}

// Load and display notifications
async function loadNotifications() {
    if (!currentUser) return;

    try {
        const { data: notifications, error } = await supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        const notificationsList = document.getElementById('notifications-list');
        if (!notificationsList) return;

        notificationsList.innerHTML = '';

        if (!notifications || notifications.length === 0) {
            notificationsList.innerHTML = '<div class="notification-item">No notifications yet.</div>';
            return;
        }

        notifications.forEach(notification => {
            const notificationDiv = document.createElement('div');
            notificationDiv.className = `notification-item ${notification.is_read ? 'read' : 'unread'}`;
            notificationDiv.innerHTML = `
                <div class="notification-header">
                    <strong>${notification.title}</strong>
                    <small>${new Date(notification.created_at).toLocaleDateString()}</small>
                </div>
                <div class="notification-message">${notification.message}</div>
                ${!notification.is_read ? '<button class="btn-small" onclick="markNotificationRead(' + notification.id + ')">Mark as Read</button>' : ''}
            `;
            notificationsList.appendChild(notificationDiv);
        });
    } catch (err) {
    }
}

// Mark notification as read
async function markNotificationRead(notificationId) {
    try {
        const { error } = await supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) throw error;

        loadNotifications();
        loadNotificationCount();
    } catch (err) {
    }
}



function showButtonLoading(button, text = 'Loading...') {
    if (button) {
        button.classList.add('loading');
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = text;
    }
}

function hideButtonLoading(button) {
    if (button) {
        button.classList.remove('loading');
        button.disabled = false;
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
        }
    }
}

// Helper function to get currency symbol
function getCurrencySymbol(currency) {
    switch (currency) {
        case 'USD': return '$';
        case 'RM':
        default: return 'RM';
    }
}

// Handle create user (admin creates user with investment amount)
async function handleCreateUser(e) {
    e.preventDefault();

    const investedAmount = parseFloat(document.getElementById('invested-amount').value);
    const targetAmount = investedAmount * 10;

    const userData = {
        name: document.getElementById('new-name').value,
        username: document.getElementById('new-username').value,
        password: document.getElementById('new-password').value,
        phone: document.getElementById('phone').value,
        currency: document.getElementById('currency').value,
        invested_amount: investedAmount,
        target_amount: targetAmount,
        current_balance: targetAmount,
        bank_name: document.getElementById('bank-name').value,
        account_number: document.getElementById('account-number').value,
        account_name: document.getElementById('account-name').value,
        role: 'user'
    };

    // Validate required fields
    if (!userData.name || !userData.username || !userData.password || !investedAmount) {
        document.getElementById('create-user-message').textContent = 'Please fill in all required fields';
        document.getElementById('create-user-message').style.color = '#f44336';
        return;
    }

    try {
        // Generate unique user ID for regular users (no Supabase Auth needed)
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Insert into users table directly (regular users don't use Supabase Auth)
        const { data: user, error: userError } = await supabaseClient
            .from('users')
            .insert({
                id: userId,
                username: userData.username,
                password: userData.password, // Direct table authentication
                email: userData.username + '@wealthgrow.local',
                role: userData.role,
                name: userData.name,
                currency: userData.currency,
                invested_amount: userData.invested_amount,
                target_amount: userData.target_amount,
                current_balance: userData.current_balance,
                total_earnings: userData.target_amount - userData.invested_amount
            })
            .select()
            .single();

        if (userError) throw userError;

        // Create investment record
        const { error: invError } = await supabaseClient
            .from('investments')
            .insert({
                user_id: userId,
                invested_amount: userData.invested_amount,
                target_amount: userData.target_amount,
                status: 'completed',
                investment_date: new Date().toISOString(),
                completion_date: new Date().toISOString()
            });

        if (invError) throw invError;

        // Success message
        document.getElementById('create-user-message').textContent =
            `User created successfully! Username: ${userData.username}, Password: ${userData.password}, Target: ${userData.currency}${userData.target_amount}`;
        document.getElementById('create-user-message').style.color = '#4CAF50';

        // Reset form
        document.getElementById('create-user-form').reset();

        // Reload admin data
        loadAdminData();

        // Send welcome notification
        await createUserNotification(userId, 'Welcome to Wealth Grow!', `Welcome ${userData.name}! Your investment of ${userData.currency}${userData.invested_amount} has been activated. Your target is ${userData.currency}${userData.target_amount}.`, 'success');

    } catch (err) {
        document.getElementById('create-user-message').textContent = 'Failed to create user: ' + err.message;
        document.getElementById('create-user-message').style.color = '#f44336';
    }
}

// View user profile (admin function)
async function viewUserProfile(userId) {
    try {
        const { data: user, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        document.getElementById('profile-username').textContent = user.username;
        document.getElementById('profile-name').textContent = user.name || 'N/A';
        document.getElementById('profile-username-display').textContent = user.username;
        document.getElementById('profile-email').textContent = user.email || 'N/A';
        document.getElementById('profile-phone').textContent = user.phone || 'N/A';
        document.getElementById('profile-currency').textContent = user.currency || 'RM';

        const currencySymbol = getCurrencySymbol(user.currency);
        document.getElementById('profile-currency-symbol').textContent = currencySymbol;
        document.getElementById('profile-currency-symbol-target').textContent = currencySymbol;
        document.getElementById('profile-currency-symbol-balance').textContent = currencySymbol;
        document.getElementById('profile-currency-symbol-earnings').textContent = currencySymbol;

        document.getElementById('profile-invested-amount').textContent = (user.invested_amount || 0).toFixed(2);
        document.getElementById('profile-target-amount').textContent = (user.target_amount || 0).toFixed(2);
        document.getElementById('profile-current-balance').textContent = (user.current_balance || 0).toFixed(2);
        document.getElementById('profile-total-earnings').textContent = (user.total_earnings || 0).toFixed(2);

        const createdDate = new Date(user.created_at).toLocaleDateString();
        document.getElementById('profile-created-at').textContent = createdDate;

        document.getElementById('profile-bank-name').textContent = user.bank_name || 'Not provided';
        document.getElementById('profile-account-number').textContent = user.account_number || 'Not provided';
        document.getElementById('profile-account-name').textContent = user.account_name || 'Not provided';

        document.getElementById('user-profile-modal').setAttribute('data-user-id', userId);

        loadUserInvestments(userId);
        loadUserWithdrawals(userId);

        document.getElementById('user-profile-modal').style.display = 'block';
    } catch (err) {
        await showAlert('Failed to load user profile', 'error');
    }
}

function closeUserProfile() {
    document.getElementById('user-profile-modal').style.display = 'none';
}

// Load user investments for profile
async function loadUserInvestments(userId) {
    try {
        const { data: investments, error } = await supabaseClient
            .from('investments')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const investmentsList = document.getElementById('user-investments-list');
        investmentsList.innerHTML = '';

        if (investments.length === 0) {
            investmentsList.innerHTML = '<p>No investment history found.</p>';
            return;
        }

        investments.forEach(inv => {
            const invDiv = document.createElement('div');
            invDiv.className = 'investment-item';
            invDiv.innerHTML = `
                <p><strong>Invested:</strong> ${getCurrencySymbol(inv.currency || "RM")}${inv.invested_amount}</p>
                <p><strong>Target:</strong> ${getCurrencySymbol(inv.currency || "RM")}${inv.target_amount}</p>
                <p><strong>Status:</strong> ${inv.status}</p>
                <p><strong>Date:</strong> ${new Date(inv.investment_date).toLocaleDateString()}</p>
            `;
            investmentsList.appendChild(invDiv);
        });
    } catch (err) {
        document.getElementById('user-investments-list').innerHTML = '<p>Error loading investments.</p>';
    }
}

// Load user withdrawals for profile
async function loadUserWithdrawals(userId) {
    try {
        const { data: withdrawals, error } = await supabaseClient
            .from('withdrawals')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const withdrawalsList = document.getElementById('user-withdrawals-list');
        withdrawalsList.innerHTML = '';

        if (withdrawals.length === 0) {
            withdrawalsList.innerHTML = '<p>No withdrawal history found.</p>';
            return;
        }

        withdrawals.forEach(withd => {
            const wdDiv = document.createElement('div');
            wdDiv.className = 'withdrawal-item';
            wdDiv.innerHTML = `
                <p><strong>Amount:</strong> ${getCurrencySymbol(withd.currency || "RM")}${withd.requested_amount}</p>
                <p><strong>Fee:</strong> ${getCurrencySymbol(withd.currency || "RM")}${withd.fee_required || 0}</p>
                <p><strong>Status:</strong> ${withd.status}</p>
                <p><strong>Date:</strong> ${new Date(withd.request_date).toLocaleDateString()}</p>
            `;
            withdrawalsList.appendChild(wdDiv);
        });
    } catch (err) {
        document.getElementById('user-withdrawals-list').innerHTML = '<p>Error loading withdrawals.</p>';
    }
}

// Pay withdrawal fee via WhatsApp
async function payWithdrawalFee(withdrawalId) {
    try {
        const { data: withdrawal, error } = await supabaseClient
            .from('withdrawals')
            .select('fee_required, requested_amount')
            .eq('id', withdrawalId)
            .single();

        if (error) throw error;

        const feeAmount = withdrawal.fee_required || 0;
        const withdrawalAmount = withdrawal.requested_amount || 0;

        // Create simple WhatsApp message as requested
        const message = `Hii admin i want to make payment of the fee for my ${withdrawalAmount} withdrawal`;

        const whatsappUrl = `https://wa.me/60147360259?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank');

        await showAlert(`WhatsApp opened with payment request. Please send the ${getCurrencySymbol(currentUser.currency)}${feeAmount} fee payment to admin and wait for approval.`, 'info');

    } catch (err) {
        await showAlert('Error opening WhatsApp. Please try again.', 'error');
    }
}

// Adjust user balance
async function adjustUserBalance() {
    const userId = document.getElementById('user-profile-modal').getAttribute('data-user-id');
    const adjustmentType = document.getElementById('balance-adjustment-type').value;
    const amount = parseFloat(document.getElementById('balance-adjustment-amount').value);
    const reason = document.getElementById('balance-adjustment-reason').value;

    if (!amount || amount <= 0) {
        await showAlert('Please enter a valid amount', 'warning');
        return;
    }

    if (!reason.trim()) {
        await showAlert('Please enter a reason for the adjustment', 'warning');
        return;
    }

    try {
        const { data: user, error: userError } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError) throw userError;

        let newBalance = user.current_balance || 0;
        let newTarget = user.target_amount || 0;
        let newEarnings = user.total_earnings || 0;

        if (adjustmentType === 'add') {
            newBalance += amount;
            newTarget += amount;
            newEarnings += amount;
        } else {
            newBalance -= amount;
            if (newBalance < 0) newBalance = 0;
            newTarget = Math.max(user.invested_amount || 0, newTarget - amount);
            newEarnings = Math.max(0, newEarnings - amount);
        }

        const { error: updateError } = await supabaseClient
            .from('users')
            .update({
                current_balance: newBalance,
                target_amount: newTarget,
                total_earnings: newEarnings
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        const notificationTitle = adjustmentType === 'add' ? 'Balance Increased' : 'Balance Adjusted';
        const notificationMessage = `Your balance has been ${adjustmentType === 'add' ? 'increased' : 'decreased'} by ${getCurrencySymbol(user.currency)}${amount}. Reason: ${reason}`;
        await createUserNotification(userId, notificationTitle, notificationMessage, adjustmentType === 'add' ? 'success' : 'warning');

        const balanceElement = document.getElementById('profile-current-balance');
        const targetElement = document.getElementById('profile-target-amount');
        const earningsElement = document.getElementById('profile-total-earnings');

        if (balanceElement) balanceElement.textContent = newBalance.toFixed(2);
        if (targetElement) targetElement.textContent = newTarget.toFixed(2);
        if (earningsElement) earningsElement.textContent = newEarnings.toFixed(2);

        document.getElementById('balance-adjustment-amount').value = '';
        document.getElementById('balance-adjustment-reason').value = '';

        await showAlert(`Balance ${adjustmentType === 'add' ? 'increased' : 'decreased'} by ${getCurrencySymbol(user.currency)}${amount}.`, 'success');

        // Refresh admin dashboard to update total profits
        loadAdminData();
    } catch (err) {
        await showAlert('Failed to adjust balance: ' + err.message, 'error');
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }

    try {
        // Delete related data first (due to foreign key constraints)
        await supabaseClient.from('notifications').delete().eq('user_id', userId);
        await supabaseClient.from('withdrawals').delete().eq('user_id', userId);
        await supabaseClient.from('balance_adjustments').delete().eq('user_id', userId);
        await supabaseClient.from('investments').delete().eq('user_id', userId);
        await supabaseClient.from('user_profiles').delete().eq('user_id', userId);

        // Finally delete the user
        const { error } = await supabaseClient
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        await showAlert('User deleted successfully', 'success');
        loadAdminData();
    } catch (err) {
        await showAlert('Failed to delete user: ' + err.message, 'error');
    }
}

// Password toggle function
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const button = event.target;

    if (input && button) {
        event.preventDefault();

        if (input.type === 'password') {
            input.type = 'text';
            button.textContent = '🙈';
        } else {
            input.type = 'password';
            button.textContent = '👁️';
        }
    }
}

// Toggle maintenance mode
async function togglePlatform() {
    try {
        const { data: settings, error: fetchError } = await supabaseClient
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', 'platform_status')
            .single();

        if (fetchError) throw fetchError;

        const currentStatus = settings.setting_value;
        const newStatus = currentStatus === 'active' ? 'maintenance' : 'active';

        const { error: updateError } = await supabaseClient
            .from('platform_settings')
            .update({ setting_value: newStatus })
            .eq('setting_key', 'platform_status');

        if (updateError) throw updateError;

        document.getElementById('platform-status').textContent = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);

        await showAlert(`Platform status changed to: ${newStatus.toUpperCase()}`, 'info');
    } catch (err) {
        await showAlert('Failed to toggle platform status', 'error');
    }
}

// Handle logout
async function handleLogout() {
    // Show loading text on logout button
    const logoutBtn = event.target;
    if (logoutBtn) {
        showButtonLoading(logoutBtn, 'Logging out...');
    }

    try {
        // Clear user session
        localStorage.removeItem('wealthgrow_user');
        currentUser = null;
        isAdmin = false;

        // Update navigation immediately
        updateNavigation();

        // Small delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 500));

        // Redirect based on current page
        if (window.location.pathname.includes('admin')) {
            window.location.href = 'admin-login.html';
        } else {
            window.location.href = 'login.html';
        }
    } catch (err) {
        // Fallback: clear session and redirect anyway
        localStorage.removeItem('wealthgrow_user');
        currentUser = null;
        isAdmin = false;

        if (window.location.pathname.includes('admin')) {
            window.location.href = 'admin-login.html';
        } else {
            window.location.href = 'login.html';
        }
    }
}

// Load admin data
async function loadAdminData() {
    if (!isAdmin) return;

    try {
        const { data: users, error: usersError } = await supabaseClient
            .from('users')
            .select('*');

        if (usersError) throw usersError;
        populateUsersTable(users);

        const { data: investments, error: invError } = await supabaseClient
            .from('investments')
            .select('*, users(username)');

        if (invError) throw invError;
        populateInvestmentsTable(investments);

        const { data: withdrawals, error: withError } = await supabaseClient
            .from('withdrawals')
            .select('*, users(username)');

        if (withError) throw withError;
        populateWithdrawalsTable(withdrawals);

        updateDashboardMetrics(users, investments, withdrawals);
    } catch (err) {
    }
}

// Update dashboard metrics
function updateDashboardMetrics(users, investments, withdrawals) {
    document.getElementById('total-users').textContent = users.length;

    const activeInvestments = investments.filter(inv => inv.status !== 'completed').length;
    document.getElementById('active-investments').textContent = activeInvestments;

    const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending' || w.status === 'fee_required').length;
    document.getElementById('pending-withdrawals').textContent = pendingWithdrawals;

    // Calculate total profits as sum of all user earnings (total_earnings)
    const totalProfits = users.reduce((sum, user) => sum + (user.total_earnings || 0), 0);
    document.getElementById('total-profits').textContent = `RM${totalProfits.toFixed(2)}`;
}

// Populate users table
function populateUsersTable(users) {
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id.substring(0, 8)}...</td>
            <td>${user.name || 'N/A'}</td>
            <td>${user.username}</td>
            <td>${getCurrencySymbol(user.currency)}${user.invested_amount || 0}</td>
            <td>${getCurrencySymbol(user.currency)}${user.target_amount || 0}</td>
            <td>${getCurrencySymbol(user.currency)}${user.current_balance || 0}</td>
            <td>
                <button class="btn" onclick="viewUserProfile('${user.id}')" style="margin-right: 0.5rem;">View Profile</button>
                <button class="btn" onclick="deleteUser('${user.id}')" style="background: #f44336; margin-right: 0.5rem;">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Populate investments table
function populateInvestmentsTable(investments) {
    const tbody = document.querySelector('#investments-table tbody');
    tbody.innerHTML = '';
    investments.forEach(inv => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${inv.id}</td>
            <td>${inv.users?.username || 'N/A'}</td>
            <td>${getCurrencySymbol(inv.currency)}${inv.invested_amount}</td>
            <td>${getCurrencySymbol(inv.currency)}${inv.target_amount}</td>
            <td>${inv.status}</td>
            <td>${new Date(inv.investment_date).toLocaleDateString()}</td>
        `;
        tbody.appendChild(row);
    });
}

// Populate withdrawals table
function populateWithdrawalsTable(withdrawals) {
    const tbody = document.querySelector('#withdrawals-table tbody');
    tbody.innerHTML = '';
    withdrawals.forEach(withd => {
        const row = document.createElement('tr');
        let actions = '';

        if (withd.status === 'pending') {
            actions = `
                <button class="btn" onclick="approveWithdrawal(${withd.id}, '${withd.user_id}')" style="background: #4CAF50; margin-right: 0.5rem;">Approve</button>
                <button class="btn" onclick="rejectWithdrawal(${withd.id})" style="background: #f44336; margin-right: 0.5rem;">Reject</button>
                <button class="btn" onclick="setWithdrawalFee(${withd.id})" style="background: #FF9800;">Set Fee</button>
            `;
        } else if (withd.status === 'fee_required') {
            actions = `
                <button class="btn" onclick="approveWithdrawal(${withd.id}, '${withd.user_id}')" style="background: #4CAF50; margin-right: 0.5rem;">Approve</button>
                <button class="btn" onclick="rejectWithdrawal(${withd.id})" style="background: #f44336;">Reject</button>
            `;
        } else {
            actions = `<span style="color: ${withd.status === 'completed' ? '#4CAF50' : '#f44336'};">${withd.status}</span>`;
        }

        row.innerHTML = `
            <td>${withd.id}</td>
            <td>${withd.users?.username || 'N/A'}</td>
            <td>${getCurrencySymbol(withd.currency)}${withd.requested_amount}</td>
            <td>${withd.status}</td>
            <td>${new Date(withd.request_date).toLocaleDateString()}</td>
            <td>${actions}</td>
        `;
        tbody.appendChild(row);
    });
}

// Approve withdrawal
async function approveWithdrawal(withdrawalId, userId) {
    try {
        const { data: withdrawal, error: fetchError } = await supabaseClient
            .from('withdrawals')
            .select('requested_amount')
            .eq('id', withdrawalId)
            .single();

        if (fetchError) throw fetchError;

        const { data: user, error: userError } = await supabaseClient
            .from('users')
            .select('current_balance')
            .eq('id', userId)
            .single();

        if (userError) throw userError;

        const withdrawalAmount = withdrawal.requested_amount;
        const currentBalance = user.current_balance || 0;
        const newBalance = Math.max(0, currentBalance - withdrawalAmount);

        const { error: withdrawalError } = await supabaseClient
            .from('withdrawals')
            .update({ status: 'completed', approval_date: new Date().toISOString() })
            .eq('id', withdrawalId);

        if (withdrawalError) throw withdrawalError;

        const { error: balanceError } = await supabaseClient
            .from('users')
            .update({ current_balance: newBalance })
            .eq('id', userId);


        await createUserNotification(userId, 'Withdrawal Successful', `Your withdrawal of ${getCurrencySymbol(user.currency)}${withdrawalAmount} has been processed successfully.`, 'success');

        await showAlert(`Withdrawal approved! ${getCurrencySymbol(user.currency)}${withdrawalAmount} deducted.`, 'success');
        loadAdminData();
    } catch (err) {
        await showAlert('Failed to approve withdrawal', 'error');
    }
}

// Reject withdrawal
async function rejectWithdrawal(withdrawalId) {
    try {
        const { error } = await supabaseClient
            .from('withdrawals')
            .update({ status: 'rejected', approval_date: new Date().toISOString() })
            .eq('id', withdrawalId);

        if (error) throw error;

        await showAlert('Withdrawal rejected!', 'warning');
        loadAdminData();
    } catch (err) {
        await showAlert('Failed to reject withdrawal', 'error');
    }
}

// Set withdrawal fee with styled modal
async function setWithdrawalFee(withdrawalId) {
    return new Promise((resolve) => {
        // Create fee setting modal
        const modal = document.createElement('div');
        modal.className = 'alert-overlay';
        modal.innerHTML = `
            <div class="alert-dialog" style="max-width: 400px;">
                <div class="alert-icon info">💰</div>
                <div class="alert-title">Set Withdrawal Fee</div>
                <div class="alert-message">
                    <div style="margin-bottom: 1rem;">Enter the fee amount:</div>
                    <input type="number" id="fee-input" min="0" step="0.01" placeholder="0.00" style="width: 100%; padding: 0.5rem; border: 1px solid #333; border-radius: 4px; background: #1e1e1e; color: #fff;">
                </div>
                <div class="alert-buttons">
                    <button class="btn" style="background: #666; margin-right: 0.5rem;" onclick="resolveFeeModal(null)">Cancel</button>
                    <button class="btn" onclick="resolveFeeModal(document.getElementById('fee-input').value)">Set Fee</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Focus on input
        setTimeout(() => {
            const input = document.getElementById('fee-input');
            if (input) input.focus();
        }, 100);

        // Store resolve function
        window.resolveFeeModal = function(value) {
            modal.remove();
            delete window.resolveFeeModal;
            resolve(value);
        };
    }).then(async (fee) => {
        if (fee === null || fee === '') return;

        const feeAmount = parseFloat(fee);
        if (isNaN(feeAmount) || feeAmount < 0) {
            await showAlert('Please enter a valid fee amount', 'warning');
            return;
        }

        try {
            const { error } = await supabaseClient
                .from('withdrawals')
                .update({ fee_required: feeAmount, status: 'fee_required' })
                .eq('id', withdrawalId);

            if (error) throw error;

            await showAlert(`Fee set to ${getCurrencySymbol(currentUser.currency)}${feeAmount}. User will be notified.`, 'success');
            loadAdminData();
        } catch (err) {
            await showAlert('Failed to set fee', 'error');
        }
    });
}

// Switch admin tabs
function switchTab(e) {
    const tab = e.target.getAttribute('data-tab');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    e.target.classList.add('active');
    document.getElementById(tab + '-tab').classList.add('active');
}

// Switch admin tabs from mobile menu
function switchToTabMobile(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tab) {
            btn.classList.add('active');
        }
    });
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tab + '-tab').classList.add('active');

    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');
    if (hamburger && mobileMenu) {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('active');
        mobileMenu.style.display = 'none';
        const hamburgerSvg = hamburger.querySelector('.hamburger-svg');
        const xIcon = hamburger.querySelector('.x-icon');
        if (hamburgerSvg) hamburgerSvg.style.display = 'block';
        if (xIcon) xIcon.style.display = 'none';
    }
}

// Alert functions - fixed to prevent duplicates and ensure proper dismissal
let currentAlertPromise = null;
let currentAlertOverlay = null;

function showAlert(message, type = 'info', title = 'Notification') {
    // Prevent multiple alerts
    if (currentAlertPromise) {
        return currentAlertPromise;
    }

    return currentAlertPromise = new Promise((resolve) => {

        // Remove any existing alert overlay
        if (currentAlertOverlay) {
            try {
                if (currentAlertOverlay.parentNode) {
                    currentAlertOverlay.parentNode.removeChild(currentAlertOverlay);
                }
            } catch (e) {
            }
        }

        // Create new alert overlay
        const overlay = document.createElement('div');
        overlay.className = 'alert-overlay';
        currentAlertOverlay = overlay;

        // Create alert dialog
        const alertDialog = document.createElement('div');
        alertDialog.className = 'alert-dialog';

        // Create icon
        const iconDiv = document.createElement('div');
        iconDiv.className = `alert-icon ${type}`;
        iconDiv.textContent = getAlertIcon(type);

        // Create title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'alert-title';
        titleDiv.textContent = title;

        // Create message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'alert-message';
        messageDiv.textContent = message;

        // Create buttons
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'alert-buttons';

        const okButton = document.createElement('button');
        okButton.className = 'btn';
        okButton.textContent = 'OK';
        okButton.addEventListener('click', () => {
            resolveAlert(resolve, true);
        });

        buttonsDiv.appendChild(okButton);

        // Assemble dialog
        alertDialog.appendChild(iconDiv);
        alertDialog.appendChild(titleDiv);
        alertDialog.appendChild(messageDiv);
        alertDialog.appendChild(buttonsDiv);
        overlay.appendChild(alertDialog);

        // Add to DOM
        document.body.appendChild(overlay);
    });
}

function showConfirm(message, title = 'Confirm Action') {
    // Prevent multiple alerts
    if (currentAlertPromise) {
        return currentAlertPromise;
    }

    return currentAlertPromise = new Promise((resolve) => {

        // Remove any existing alert overlay
        if (currentAlertOverlay) {
            try {
                if (currentAlertOverlay.parentNode) {
                    currentAlertOverlay.parentNode.removeChild(currentAlertOverlay);
                }
            } catch (e) {
            }
        }

        // Create new alert overlay
        const overlay = document.createElement('div');
        overlay.className = 'alert-overlay';
        currentAlertOverlay = overlay;

        // Create confirm dialog
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'confirm-dialog';

        // Create icon
        const iconDiv = document.createElement('div');
        iconDiv.className = 'alert-icon warning';
        iconDiv.textContent = '⚠️';

        // Create title
        const titleDiv = document.createElement('div');
        titleDiv.className = 'alert-title';
        titleDiv.textContent = title;

        // Create message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'alert-message';
        messageDiv.textContent = message;

        // Create buttons
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'alert-buttons';

        const cancelButton = document.createElement('button');
        cancelButton.className = 'btn';
        cancelButton.style.background = '#f44336';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => {
            resolveAlert(resolve, false);
        });

        const confirmButton = document.createElement('button');
        confirmButton.className = 'btn';
        confirmButton.textContent = 'Confirm';
        confirmButton.addEventListener('click', () => {
            resolveAlert(resolve, true);
        });

        buttonsDiv.appendChild(cancelButton);
        buttonsDiv.appendChild(confirmButton);

        // Assemble dialog
        confirmDialog.appendChild(iconDiv);
        confirmDialog.appendChild(titleDiv);
        confirmDialog.appendChild(messageDiv);
        confirmDialog.appendChild(buttonsDiv);
        overlay.appendChild(confirmDialog);

        // Add to DOM
        document.body.appendChild(overlay);
    });
}

function getAlertIcon(type) {
    switch (type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        case 'info':
        default: return 'ℹ️';
    }
}

function resolveAlert(resolve, result) {

    // Remove overlay from DOM
    if (currentAlertOverlay) {
        try {
            if (currentAlertOverlay.parentNode) {
                currentAlertOverlay.parentNode.removeChild(currentAlertOverlay);
            }
        } catch (e) {
        }
        currentAlertOverlay = null;
    }

    // Resolve promise and reset
    if (resolve) {
        resolve(result);
    }
    currentAlertPromise = null;

}

// Toggle notifications dropdown
function toggleNotifications() {
    const notificationsDropdown = document.getElementById('notifications-list');
    if (notificationsDropdown) {
        notificationsDropdown.classList.toggle('active');
    }
}

// Toggle mobile notifications (show in mobile menu)
function toggleMobileNotifications() {
    // For mobile, we can show a modal or overlay with notifications
    const mobileNotificationsModal = document.createElement('div');
    mobileNotificationsModal.className = 'mobile-notifications-modal';
    mobileNotificationsModal.innerHTML = `
        <div class="mobile-notifications-content">
            <div class="mobile-notifications-header">
                <h3>Notifications</h3>
                <button class="close-mobile-notifications" onclick="closeMobileNotifications()">×</button>
            </div>
            <div class="mobile-notifications-list" id="mobile-notifications-list">
                <!-- Mobile notifications will be loaded here -->
            </div>
        </div>
    `;

    document.body.appendChild(mobileNotificationsModal);

    // Load notifications for mobile view
    loadMobileNotifications();

    // Close when clicking outside
    mobileNotificationsModal.addEventListener('click', function(e) {
        if (e.target === mobileNotificationsModal) {
            closeMobileNotifications();
        }
    });
}

// Load notifications for mobile view
async function loadMobileNotifications() {
    if (!currentUser) return;

    try {
        const { data: notifications, error } = await supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        const mobileNotificationsList = document.getElementById('mobile-notifications-list');
        if (!mobileNotificationsList) return;

        mobileNotificationsList.innerHTML = '';

        if (!notifications || notifications.length === 0) {
            mobileNotificationsList.innerHTML = '<div class="mobile-notification-item">No notifications yet.</div>';
            return;
        }

        notifications.forEach(notification => {
            const notificationDiv = document.createElement('div');
            notificationDiv.className = `mobile-notification-item ${notification.is_read ? 'read' : 'unread'}`;
            notificationDiv.innerHTML = `
                <div class="mobile-notification-header">
                    <strong>${notification.title}</strong>
                    <small>${new Date(notification.created_at).toLocaleDateString()}</small>
                </div>
                <div class="mobile-notification-message">${notification.message}</div>
                ${!notification.is_read ? '<button class="btn-small" onclick="markNotificationRead(' + notification.id + ')">Mark as Read</button>' : ''}
            `;
            mobileNotificationsList.appendChild(notificationDiv);
        });
    } catch (err) {
    }
}

// Close mobile notifications modal
function closeMobileNotifications() {
    const modal = document.querySelector('.mobile-notifications-modal');
    if (modal) {
        modal.remove();
    }
}

// Language translations
const translations = {
    en: {
        home: "Home", login: "Login", help: "Help", dashboard: "Dashboard", logout: "Logout",
        welcomeTitle: "Welcome to Wealth Grow", welcomeDesc: "Grow your wealth with secure investments.",
        getStarted: "Get Started", loginTitle: "Login to Your Account",
        username: "Username:", password: "Password:", rememberMe: "Remember me", loginBtn: "Login",
        copyright: "Wealth Grow. All rights reserved."
    },
    ms: {
        home: "Laman Utama", login: "Log Masuk", help: "Bantuan", dashboard: "Papan Pemuka", logout: "Log Keluar",
        welcomeTitle: "Selamat Datang ke Wealth Grow", welcomeDesc: "Tingkatkan kekayaan anda.",
        getStarted: "Mulakan", loginTitle: "Log Masuk ke Akaun Anda",
        username: "Nama Pengguna:", password: "Kata Laluan:", rememberMe: "Ingat saya", loginBtn: "Log Masuk",
        copyright: "Wealth Grow. Hak cipta terpelihara."
    },
    ta: {
        home: "Mukapatta Peyar", login: "Ullanam", help: "Utavi", dashboard: "Kutchi", logout: "Veliyeru",
        welcomeTitle: "Wealth Grow il Ullanam", welcomeDesc: "Ungal varamai valarntu kollungal.",
        getStarted: "Thodangal", loginTitle: "Ungal Kanaakku Ullanam",
        username: "Pangali Peyar:", password: "Kural Kod:", rememberMe: "Ennai Ninarungal", loginBtn: "Ullanam",
        copyright: "Wealth Grow. Hakkural anaithum."
    }
};

let currentLanguage = 'en';

function initLanguageSystem() {
    if (window.location.pathname.includes('admin')) return;

    const savedLang = localStorage.getItem('wealthgrow_language') || 'en';
    if (savedLang !== 'en') applyTranslations(savedLang);

    const currentLangBtn = document.getElementById('current-lang');
    if (currentLangBtn) {
        const langCode = savedLang === 'en' ? 'EN' : savedLang === 'ms' ? 'MY' : 'TA';
        currentLangBtn.querySelector('span').textContent = langCode;
    }

    const langDropdown = document.getElementById('lang-dropdown');
    const langOptions = document.querySelectorAll('.lang-option');

    if (currentLangBtn && langDropdown) {
        currentLangBtn.addEventListener('click', function(e) {
            e.preventDefault();
            langDropdown.classList.toggle('active');
        });

        langOptions.forEach(option => {
            option.addEventListener('click', function(e) {
                e.preventDefault();
                switchLanguage(this.getAttribute('data-lang'));
                langDropdown.classList.remove('active');
            });
        });

        document.addEventListener('click', function(e) {
            if (!currentLangBtn.contains(e.target) && !langDropdown.contains(e.target)) {
                langDropdown.classList.remove('active');
            }
        });
    }
}

function switchLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('wealthgrow_language', lang);

    const currentLangBtn = document.getElementById('current-lang');
    if (currentLangBtn) {
        const langCode = lang === 'en' ? 'EN' : lang === 'ms' ? 'MY' : 'TA';
        currentLangBtn.querySelector('span').textContent = langCode;
    }

    applyTranslations(lang);
    document.documentElement.lang = lang === 'ms' ? 'ms' : lang === 'ta' ? 'ta' : 'en';
}

function applyTranslations(lang) {
    const t = translations[lang];
    if (!t) return;

    const navLinks = document.querySelectorAll('nav ul li a');
    if (navLinks.length >= 3) {
        navLinks[0].textContent = t.home;
        navLinks[1].textContent = t.login;
        navLinks[2].textContent = t.help;
    }

    const loginTitle = document.querySelector('.login-section h1');
    if (loginTitle) loginTitle.textContent = t.loginTitle;

    const usernameLabel = document.querySelector('label[for="username"]');
    if (usernameLabel) usernameLabel.textContent = t.username;

    const passwordLabel = document.querySelector('label[for="password"]');
    if (passwordLabel) passwordLabel.textContent = t.password;

    const loginBtn = document.querySelector('#login-form button[type="submit"]');
    if (loginBtn) loginBtn.textContent = t.loginBtn;
}

// Load user data for dashboard
async function loadUserData() {
    if (!currentUser) return;

    try {
        // Fetch user data
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (userError) throw userError;

        currentUser = userData;
        localStorage.setItem('wealthgrow_user', JSON.stringify(currentUser));

        const currencySymbol = getCurrencySymbol(currentUser.currency);

        // Update balance display
        const balanceEl = document.getElementById('current-balance');
        if (balanceEl) balanceEl.textContent = `${currencySymbol} ${(currentUser.current_balance || 0).toFixed(2)}`;

        const investedEl = document.getElementById('invested-amount');
        if (investedEl) investedEl.textContent = `Invested: ${currencySymbol} ${(currentUser.invested_amount || 0).toFixed(2)}`;

        const targetEl = document.getElementById('target-amount');
        if (targetEl) targetEl.textContent = `Target: ${currencySymbol} ${(currentUser.target_amount || 0).toFixed(2)}`;

        const earningsEl = document.getElementById('total-earnings');
        if (earningsEl) earningsEl.textContent = `Earnings: ${currencySymbol} ${(currentUser.total_earnings || 0).toFixed(2)}`;

        // Fetch investment status and date
        const { data: investments, error: invError } = await supabaseClient
            .from('investments')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(1);

        if (!invError && investments && investments.length > 0) {
            const inv = investments[0];

            // Update investment status with better display
            const statusEl = document.getElementById('investment-status');
            if (statusEl) {
                let statusText = 'Active';
                let statusColor = '#FFD700';

                if (inv.status === 'completed') {
                    statusText = 'Completed';
                    statusColor = '#4CAF50';
                } else if (inv.status === 'pending') {
                    statusText = 'Processing';
                    statusColor = '#FF9800';
                }

                statusEl.textContent = statusText;
                statusEl.style.color = statusColor;
            }

            // Calculate and display progress
            const progressEl = document.getElementById('investment-progress');
            if (progressEl && inv.target_amount && inv.invested_amount) {
                const progress = ((currentUser.current_balance - inv.invested_amount) / (inv.target_amount - inv.invested_amount)) * 100;
                const progressPercent = Math.min(100, Math.max(0, progress)).toFixed(1);
                progressEl.textContent = `Progress: ${progressPercent}%`;
                progressEl.style.color = progress >= 100 ? '#4CAF50' : '#FFD700';
            }

            // Update investment date
            const dateEl = document.getElementById('investment-date');
            if (dateEl) {
                dateEl.textContent = 'Started: ' + new Date(inv.investment_date).toLocaleDateString();
            }
        }

        loadNotificationCount();
        loadNotifications();
        loadWithdrawalHistory();
        startRealTimeUpdates();

        // Load investment growth chart
        loadInvestmentGrowthChart();
    } catch (err) {
    }
}

// Load withdrawal history for user dashboard
async function loadWithdrawalHistory() {
    if (!currentUser) return;

    try {
        const { data: withdrawals, error } = await supabaseClient
            .from('withdrawals')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('request_date', { ascending: false })
            .limit(10);

        if (error) throw error;

        const withdrawalHistory = document.getElementById('withdrawal-history');
        if (!withdrawalHistory) return;

        if (!withdrawals || withdrawals.length === 0) {
            withdrawalHistory.innerHTML = '<p>No withdrawal history yet.</p>';
            return;
        }

        let html = '';
        withdrawals.forEach(withdrawal => {
            const statusColor = withdrawal.status === 'completed' ? '#4CAF50' :
                              withdrawal.status === 'pending' ? '#FF9800' :
                              withdrawal.status === 'fee_required' ? '#2196F3' : '#f44336';

            const statusIcon = withdrawal.status === 'completed' ? '✅' :
                             withdrawal.status === 'pending' ? '⏳' :
                             withdrawal.status === 'fee_required' ? '💰' : '❌';

            html += `
                <div class="withdrawal-item" style="background: rgba(255,255,255,0.05); padding: 1rem; margin-bottom: 0.5rem; border-radius: 8px; border-left: 4px solid ${statusColor};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${getCurrencySymbol(withdrawal.currency)}${withdrawal.requested_amount}</strong>
                            ${withdrawal.fee_required ? `<br><small>Fee: ${getCurrencySymbol(withdrawal.currency)}${withdrawal.fee_required}</small>` : ''}
                        </div>
                        <div style="text-align: right;">
                            <div style="color: ${statusColor}; font-weight: bold;">
                                ${statusIcon} ${withdrawal.status.replace('_', ' ').toUpperCase()}
                            </div>
                            <small style="color: #B0B0B0;">${new Date(withdrawal.request_date).toLocaleDateString()}</small>
                        </div>
                    </div>
                    ${withdrawal.status === 'fee_required' ?
                        `<button class="btn" onclick="payWithdrawalFee('${withdrawal.id}')" style="margin-top: 0.5rem; font-size: 0.8rem;">Pay Fee ${getCurrencySymbol(withdrawal.currency)}${withdrawal.fee_required}</button>` : ''}
                </div>
            `;
        });

        withdrawalHistory.innerHTML = html;
    } catch (err) {
        document.getElementById('withdrawal-history').innerHTML = '<p>Error loading withdrawal history.</p>';
    }
}

// Load withdrawal history for withdrawal page
async function loadWithdrawalHistoryForPage() {
    if (!currentUser) return;

    try {
        const { data: withdrawals, error } = await supabaseClient
            .from('withdrawals')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('request_date', { ascending: false })
            .limit(20);

        if (error) throw error;

        const withdrawalHistoryList = document.getElementById('withdrawal-history-list');
        if (!withdrawalHistoryList) return;

        if (!withdrawals || withdrawals.length === 0) {
            withdrawalHistoryList.innerHTML = '<div class="withdrawal-item" style="text-align: center; padding: 2rem;">No withdrawal history yet.</div>';
            return;
        }

        let html = '';
        withdrawals.forEach(withdrawal => {
            const statusColor = withdrawal.status === 'completed' ? '#4CAF50' :
                              withdrawal.status === 'pending' ? '#FF9800' :
                              withdrawal.status === 'fee_required' ? '#2196F3' : '#f44336';

            const statusIcon = withdrawal.status === 'completed' ? '✅' :
                             withdrawal.status === 'pending' ? '⏳' :
                             withdrawal.status === 'fee_required' ? '💰' : '❌';

            html += `
                <div class="withdrawal-item" style="background: rgba(255,255,255,0.05); padding: 1.5rem; margin-bottom: 1rem; border-radius: 12px; border-left: 4px solid ${statusColor};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h4 style="margin: 0 0 0.5rem 0; color: #FFD700;">${getCurrencySymbol(withdrawal.currency)}${withdrawal.requested_amount}</h4>
                            ${withdrawal.fee_required ? `<p style="margin: 0.5rem 0; color: #FF9800;">Fee Required: ${getCurrencySymbol(withdrawal.currency)}${withdrawal.fee_required}</p>` : ''}
                            <small style="color: #B0B0B0;">${new Date(withdrawal.request_date).toLocaleDateString()}</small>
                        </div>
                        <div style="text-align: right;">
                            <div style="color: ${statusColor}; font-weight: bold; font-size: 1.1rem;">
                                ${statusIcon} ${withdrawal.status.replace('_', ' ').toUpperCase()}
                            </div>
                        </div>
                    </div>
                    ${withdrawal.status === 'fee_required' ?
                        `<div style="margin-top: 1rem;">
                            <button class="btn" onclick="payWithdrawalFee('${withdrawal.id}')" style="font-size: 0.9rem;">Pay Fee ${getCurrencySymbol(withdrawal.currency)}${withdrawal.fee_required}</button>
                        </div>` : ''}
                </div>
            `;
        });

        withdrawalHistoryList.innerHTML = html;
    } catch (err) {
        document.getElementById('withdrawal-history-list').innerHTML = '<div class="withdrawal-item" style="text-align: center; padding: 2rem; color: #f44336;">Error loading withdrawal history.</div>';
    }
}

// Start real-time updates for user dashboard
function startRealTimeUpdates() {
    if (!currentUser) return;

    // Update every 30 seconds for real-time feel
    setInterval(async () => {
        try {
            // Update notifications
            await loadNotificationCount();
            await loadNotifications();

            // Update withdrawal history
            await loadWithdrawalHistory();

            // Update user balance (in case admin made changes)
            const { data: userData, error } = await supabaseClient
                .from('users')
                .select('current_balance, target_amount, total_earnings')
                .eq('id', currentUser.id)
                .single();

            if (!error && userData) {
                // Update current user data
                currentUser.current_balance = userData.current_balance;
                currentUser.target_amount = userData.target_amount;
                currentUser.total_earnings = userData.total_earnings;
                localStorage.setItem('wealthgrow_user', JSON.stringify(currentUser));

                // Update display
                const currencySymbol = getCurrencySymbol(currentUser.currency);
                const balanceEl = document.getElementById('current-balance');
                if (balanceEl) balanceEl.textContent = `${currencySymbol} ${(currentUser.current_balance || 0).toFixed(2)}`;

                const targetEl = document.getElementById('target-amount');
                if (targetEl) targetEl.textContent = `Target: ${currencySymbol} ${(currentUser.target_amount || 0).toFixed(2)}`;

                const earningsEl = document.getElementById('total-earnings');
                if (earningsEl) earningsEl.textContent = `Earnings: ${currencySymbol} ${(currentUser.total_earnings || 0).toFixed(2)}`;
            }
        } catch (err) {
        }
    }, 30000); // 30 seconds
}

// Handle withdrawal form
async function handleWithdrawal(e) {
    e.preventDefault();
    if (!currentUser) {
        await showAlert('Please login first', 'warning');
        return;
    }

    const amount = parseFloat(document.getElementById('amount').value);
    if (!amount || amount <= 0) {
        await showAlert('Please enter a valid amount', 'warning');
        return;
    }

    // Check if user has sufficient balance
    const currentBalance = currentUser.current_balance || 0;
    if (amount > currentBalance) {
        await showAlert(`Insufficient balance. You have ${getCurrencySymbol(currentUser.currency)}${currentBalance.toFixed(2)} available.`, 'error');
        return;
    }

    try {
        await supabaseClient.from('withdrawals').insert({
            user_id: currentUser.id,
            requested_amount: amount,
            currency: currentUser.currency || 'RM',
            status: 'pending',
            request_date: new Date().toISOString()
        });

        await showAlert('Withdrawal request submitted!', 'success');
        document.getElementById('withdrawal-form').reset();

        // Refresh withdrawal history immediately
        loadWithdrawalHistory();
    } catch (err) {
        await showAlert('Failed to submit withdrawal', 'error');
    }
}

// Handle user login (direct table authentication for regular users)
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const submitButton = e.target.querySelector('button[type="submit"]');


    if (!username || !password) {
        await showAlert('Please enter both username and password', 'warning');
        return;
    }

    // Ensure button is properly set up for loading state
    if (!submitButton) {
        await showAlert('Form error. Please refresh the page.', 'error');
        return;
    }

    // Don't show loading state - keep button as "Login"

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error('Login timeout'));
        }, 5000); // 5 second timeout
    });

    try {
        // Direct authentication against users table with timeout
        const authPromise = supabaseClient
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        const { data: userData, error: userError } = await Promise.race([authPromise, timeoutPromise]);

        if (userError || !userData) {
            throw new Error('Invalid credentials');
        }

        // Check if user is admin (admins use Supabase Auth)
        if (userData.role === 'admin') {
            // For admin, try Supabase Auth login
            const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
                email: userData.email,
                password: password
            });

            if (authError) {
                hideButtonLoading(submitButton);
                await showAlert('Admin authentication failed', 'error');
                return;
            }
        }

        // Set current user data
        currentUser = userData;
        isAdmin = userData.role === 'admin';
        localStorage.setItem('wealthgrow_user', JSON.stringify(currentUser));


        // Redirect based on role
        if (isAdmin) {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    } catch (err) {
        hideButtonLoading(submitButton);

        // Show appropriate error message
        if (err.message === 'Invalid credentials') {
            await showAlert('Invalid credentials', 'error');
        } else {
            await showAlert('Login failed. Please try again.', 'error');
        }
    }
}

// Handle admin login (using Supabase Auth)
async function handleAdminLogin(e) {
    e.preventDefault();

    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;

    if (!email || !password) {
        await showAlert('Please enter both email and password', 'warning');
        return;
    }

    showButtonLoading(e.target.querySelector('button[type="submit"]'), 'Logging in...');

    try {
        // Sign in with Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            hideButtonLoading(e.target.querySelector('button[type="submit"]'));
            await showAlert('Invalid admin credentials', 'error');
            return;
        }

        // Get user data from users table
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (userError || !userData || userData.role !== 'admin') {
            hideButtonLoading(e.target.querySelector('button[type="submit"]'));
            await showAlert('Access denied. Admin privileges required.', 'error');
            // Sign out if not admin
            await supabaseClient.auth.signOut();
            return;
        }

        // Set current user
        currentUser = userData;
        isAdmin = true;
        localStorage.setItem('wealthgrow_user', JSON.stringify(currentUser));

        // Redirect to admin panel
        window.location.href = 'admin.html';
    } catch (err) {
        hideButtonLoading(e.target.querySelector('button[type="submit"]'));
        await showAlert('Admin login failed. Please try again.', 'error');
    }
}



// DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Show loading animation
    showPageLoader();

    // Hide loader after page loads (simulate loading time)
    setTimeout(() => {
        hidePageLoader();
    }, 1500);

    // Check if user is logged in
    const user = JSON.parse(localStorage.getItem('wealthgrow_user'));
    if (user) {
        currentUser = user;
        isAdmin = user.role === 'admin';
        if (isAdmin && window.location.pathname.includes('admin.html')) {
            loadAdminData();
        }
    }

    // Update navigation based on login status
    updateNavigation();

    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Admin login form
    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', handleAdminLogin);
    }

    // Logout buttons (desktop and mobile)
    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    const mobileLogoutBtn = document.getElementById('mobile-logout');
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', handleLogout);
    }

    // Withdrawal form
    const withdrawalForm = document.getElementById('withdrawal-form');
    if (withdrawalForm) {
        withdrawalForm.addEventListener('submit', handleWithdrawal);
    }

    // Admin tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', switchTab);
    });

    // Create user form
    const createUserForm = document.getElementById('create-user-form');
    if (createUserForm) {
        createUserForm.addEventListener('submit', handleCreateUser);
    }

    // Hamburger menu - mobile only, original styling
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobile-menu');

    if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            // Toggle active class on hamburger and mobile menu
            hamburger.classList.toggle('active');
            mobileMenu.classList.toggle('active');

            // Update hamburger icon visibility
            const hamburgerSvg = hamburger.querySelector('.hamburger-svg');
            const xIcon = hamburger.querySelector('.x-icon');

            if (hamburger.classList.contains('active')) {
                if (hamburgerSvg) hamburgerSvg.style.display = 'none';
                if (xIcon) xIcon.style.display = 'block';
            } else {
                if (hamburgerSvg) hamburgerSvg.style.display = 'block';
                if (xIcon) xIcon.style.display = 'none';
            }
        });

        // Close mobile menu when clicking on menu links
        const mobileMenuLinks = mobileMenu.querySelectorAll('a');
        mobileMenuLinks.forEach(link => {
            link.addEventListener('click', function() {
                // Close the mobile menu after clicking a link
                hamburger.classList.remove('active');
                mobileMenu.classList.remove('active');
                const hamburgerSvg = hamburger.querySelector('.hamburger-svg');
                const xIcon = hamburger.querySelector('.x-icon');
                if (hamburgerSvg) hamburgerSvg.style.display = 'block';
                if (xIcon) xIcon.style.display = 'none';
            });
        });
    }

    // Set current year
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Initialize language system
    initLanguageSystem();

    // Load user data on dashboard
    if (window.location.pathname.includes('dashboard.html')) {
        loadUserData();
        // Request notification permission
        requestNotificationPermission();
    }

    // Load withdrawal history on withdrawal page
    if (window.location.pathname.includes('withdrawal.html')) {
        loadWithdrawalHistoryForPage();
        startRealTimeUpdates();
        // Request notification permission
        requestNotificationPermission();
    }

        // Close mobile menu when resizing to desktop
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            const hamburger = document.getElementById('hamburger');
            const mobileMenu = document.getElementById('mobile-menu');
            if (hamburger && mobileMenu) {
                hamburger.classList.remove('active');
                mobileMenu.classList.remove('active');
                mobileMenu.style.display = 'none';
                // Reset hamburger icon
                const hamburgerSvg = hamburger.querySelector('.hamburger-svg');
                const xIcon = hamburger.querySelector('.x-icon');
                if (hamburgerSvg) hamburgerSvg.style.display = 'block';
                if (xIcon) xIcon.style.display = 'none';
            }
        }
    });
});
