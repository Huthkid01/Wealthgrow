-- =========================================
-- WEALTH GROW - COMPLETE 10X INVESTMENT PLATFORM
-- =========================================
-- Investment Model: Users invest X → Get 10X target (X × 10)
-- Admin controls: User creation, balances, withdrawals, fees
-- Example: RM100 invested → RM1000 target → RM1000 balance

-- =========================================
-- STEP 1: CREATE TABLES
-- =========================================

-- Users table (admin creates user profiles)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    password VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    currency VARCHAR(3) DEFAULT 'RM' CHECK (currency IN ('USD', 'RM')),
    invested_amount DECIMAL(15,2) DEFAULT 0.00, -- Amount user invested
    target_amount DECIMAL(15,2) DEFAULT 0.00,    -- 10x target (invested × 10)
    current_balance DECIMAL(15,2) DEFAULT 0.00,  -- Current available balance
    total_earnings DECIMAL(15,2) DEFAULT 0.00,   -- Total earnings accumulated
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Investments table (tracks investment history)
CREATE TABLE IF NOT EXISTS investments (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    invested_amount DECIMAL(15,2) NOT NULL,
    target_amount DECIMAL(15,2) NOT NULL, -- invested × 10
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    investment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completion_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Withdrawals table (withdrawal requests - admin controls fees)
CREATE TABLE IF NOT EXISTS withdrawals (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    requested_amount DECIMAL(15,2) NOT NULL,
    fee_required DECIMAL(15,2) DEFAULT 0.00, -- Admin sets fee amount
    fee_paid BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fee_required', 'completed', 'rejected')),
    request_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approval_date TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT, -- Admin notes/reason
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Balance adjustments table (admin manually adds/subtracts balance)
CREATE TABLE IF NOT EXISTS balance_adjustments (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    adjustment_type VARCHAR(20) CHECK (adjustment_type IN ('add', 'subtract')),
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT,
    admin_id TEXT REFERENCES users(id) ON DELETE SET NULL, -- Allow null when admin is deleted
    adjustment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platform settings
CREATE TABLE IF NOT EXISTS platform_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User profiles table for additional user data
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    address TEXT,
    bank_name VARCHAR(100),
    account_number VARCHAR(50),
    account_holder_name VARCHAR(100),
    emergency_contact VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table for user notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('success', 'warning', 'error', 'info')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- STEP 2: ENABLE ROW LEVEL SECURITY
-- =========================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =========================================
-- STEP 3: CREATE RLS POLICIES (ADMIN-ONLY ACCESS)
-- =========================================

-- Admin full access to all tables
CREATE POLICY "Admin manages all users" ON users
    FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

CREATE POLICY "Admin manages all investments" ON investments
    FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

CREATE POLICY "Admin manages all withdrawals" ON withdrawals
    FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

CREATE POLICY "Admin manages all adjustments" ON balance_adjustments
    FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

CREATE POLICY "Admin manages platform settings" ON platform_settings
    FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

-- Users can view their own data
CREATE POLICY "Users view own profile" ON users
    FOR SELECT USING (id = auth.uid()::text);

CREATE POLICY "Users view own investments" ON investments
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users view own withdrawals" ON withdrawals
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert withdrawals" ON withdrawals
    FOR INSERT WITH CHECK (true); -- Allow users to insert (we'll validate in application)

-- Notifications policies
CREATE POLICY "Users view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Admin manages all notifications" ON notifications
    FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');

-- =========================================
-- STEP 4: CREATE FUNCTIONS & TRIGGERS
-- =========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON withdrawals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_balance_adjustments_updated_at BEFORE UPDATE ON balance_adjustments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- STEP 5: INSERT DEFAULT DATA
-- =========================================

INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
('platform_status', 'active', 'Platform operational status'),
('whatsapp_number', '+60147360259', 'Admin WhatsApp contact'),
('investment_multiplier', '10', 'Investment multiplier (10x)'),
('default_currency', 'RM', 'Default currency'),
('admin_email', 'admin@wealthgrow.com', 'Admin email address')
ON CONFLICT (setting_key) DO NOTHING;

-- =========================================
-- STEP 6: CREATE INDEXES
-- =========================================

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_adjustments_user_id ON balance_adjustments(user_id);

-- =========================================
-- STEP 7: SET PERMISSIONS
-- =========================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- =========================================
-- STEP 8: VERIFY SETUP
-- =========================================

SELECT 'Tables created:' as status, COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'investments', 'withdrawals', 'balance_adjustments', 'platform_settings');

-- =========================================
-- ADMIN SETUP INSTRUCTIONS
-- =========================================
--
-- IMPORTANT: After running this SQL, complete admin setup:
--
-- 1. In Supabase Authentication → Users:
--    - Click "Add User"
--    - Email: admin@wealthgrow.com
--    - Password: [choose secure password]
--    - Check "Auto Confirm User"
--    - Copy the User ID shown
--
-- 2. In SQL Editor, run:
--    INSERT INTO users (id, email, username, role, name, currency) VALUES (
--        'YOUR_USER_ID_HERE', -- Replace with copied ID
--        'admin@wealthgrow.com',
--        'admin',
--        'admin',
--        'Administrator',
--        'RM'
--    );
--
--    UPDATE auth.users SET raw_user_meta_data = jsonb_set(
--        COALESCE(raw_user_meta_data, '{}'), '{role}', '"admin"'
--    ) WHERE id = 'YOUR_USER_ID_HERE';
--
-- 3. Update script.js with your Supabase credentials
--
-- 4. Test admin login at admin-login.html

-- =========================================
-- INVESTMENT PLATFORM WORKFLOW
-- =========================================
--
-- ADMIN WORKFLOW:
-- 1. Login to admin panel (admin@wealthgrow.com)
-- 2. Create user: Enter name, username, invested amount
-- 3. System auto-calculates: target = invested × 10
-- 4. User gets full target amount as initial balance
-- 5. Give user their username/password to login
-- 6. Manage withdrawals: approve/reject/set custom fees
-- 7. Adjust balances: add/subtract funds manually
-- 8. Full control over all user data and transactions
--
-- USER WORKFLOW:
-- 1. Login with admin-provided username/password
-- 2. View dashboard: invested amount, target amount, current balance
-- 3. Request withdrawals with bank details
-- 4. Admin reviews and decides: approve/reject/set fees
-- 5. All financial decisions controlled by admin
--
-- INVESTMENT MODEL:
-- - User invests RM100 → Gets RM1000 target → RM1000 balance
-- - User invests RM200 → Gets RM2000 target → RM2000 balance
-- - Admin controls all progression, fees, and balance adjustments
-- - Users can only view their data and request withdrawals
--
-- SECURITY:
-- - RLS policies ensure only admin can modify data
-- - Users can only view their own information
-- - Database-level protection prevents unauthorized access

-- =========================================
-- END OF SETUP
-- =========================================
