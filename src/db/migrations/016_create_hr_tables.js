export async function up(pool) {
  await pool.query(`
    -- Offer Letters table
    CREATE TABLE IF NOT EXISTS offer_letters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      
      -- Candidate Information
      candidate_name VARCHAR(255) NOT NULL,
      candidate_email VARCHAR(255) NOT NULL,
      candidate_phone VARCHAR(50),
      candidate_address TEXT,
      
      -- Position Details
      position_title VARCHAR(255) NOT NULL,
      department VARCHAR(255),
      employment_type VARCHAR(50) DEFAULT 'full-time'
        CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship')),
      start_date DATE NOT NULL,
      reporting_to VARCHAR(255),
      work_location VARCHAR(255),
      
      -- Compensation
      base_salary DECIMAL(12, 2) NOT NULL,
      salary_currency VARCHAR(10) DEFAULT 'USD',
      salary_frequency VARCHAR(20) DEFAULT 'annual'
        CHECK (salary_frequency IN ('hourly', 'weekly', 'bi-weekly', 'monthly', 'annual')),
      bonus_percentage DECIMAL(5, 2),
      equity_shares INTEGER,
      equity_vesting_period VARCHAR(100),
      
      -- Benefits
      benefits JSONB DEFAULT '[]'::jsonb,
      
      -- Letter Content
      additional_terms TEXT,
      offer_expiry_date DATE,
      
      -- Status
      status VARCHAR(20) DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'withdrawn')),
      sent_at TIMESTAMPTZ,
      responded_at TIMESTAMPTZ,
      
      -- Company Info (stored for historical purposes)
      company_name VARCHAR(255) NOT NULL,
      company_address TEXT,
      company_logo_url TEXT,
      signatory_name VARCHAR(255),
      signatory_title VARCHAR(255),
      
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Payslips table
    CREATE TABLE IF NOT EXISTS payslips (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      
      -- Employee Information
      employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
      employee_name VARCHAR(255) NOT NULL,
      employee_email VARCHAR(255) NOT NULL,
      employee_code VARCHAR(50),
      department VARCHAR(255),
      designation VARCHAR(255),
      date_of_joining DATE,
      bank_name VARCHAR(255),
      bank_account_number VARCHAR(100),
      pan_number VARCHAR(50),
      
      -- Pay Period
      pay_period_start DATE NOT NULL,
      pay_period_end DATE NOT NULL,
      payment_date DATE NOT NULL,
      
      -- Earnings
      basic_salary DECIMAL(12, 2) NOT NULL,
      hra DECIMAL(12, 2) DEFAULT 0,
      conveyance_allowance DECIMAL(12, 2) DEFAULT 0,
      medical_allowance DECIMAL(12, 2) DEFAULT 0,
      special_allowance DECIMAL(12, 2) DEFAULT 0,
      bonus DECIMAL(12, 2) DEFAULT 0,
      overtime_pay DECIMAL(12, 2) DEFAULT 0,
      other_earnings JSONB DEFAULT '[]'::jsonb,
      
      -- Deductions
      provident_fund DECIMAL(12, 2) DEFAULT 0,
      professional_tax DECIMAL(12, 2) DEFAULT 0,
      income_tax DECIMAL(12, 2) DEFAULT 0,
      health_insurance DECIMAL(12, 2) DEFAULT 0,
      other_deductions JSONB DEFAULT '[]'::jsonb,
      
      -- Totals (calculated)
      gross_earnings DECIMAL(12, 2) NOT NULL,
      total_deductions DECIMAL(12, 2) NOT NULL,
      net_salary DECIMAL(12, 2) NOT NULL,
      
      -- Currency
      currency VARCHAR(10) DEFAULT 'USD',
      
      -- Status
      status VARCHAR(20) DEFAULT 'draft'
        CHECK (status IN ('draft', 'generated', 'sent', 'paid')),
      sent_at TIMESTAMPTZ,
      
      -- Company Info
      company_name VARCHAR(255) NOT NULL,
      company_address TEXT,
      company_logo_url TEXT,
      
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_offer_letters_status ON offer_letters(status);
    CREATE INDEX IF NOT EXISTS idx_offer_letters_created ON offer_letters(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_offer_letters_creator ON offer_letters(created_by);
    
    CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);
    CREATE INDEX IF NOT EXISTS idx_payslips_period ON payslips(pay_period_start, pay_period_end);
    CREATE INDEX IF NOT EXISTS idx_payslips_created ON payslips(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payslips_creator ON payslips(created_by);
  `);
}

export async function down(pool) {
  await pool.query(`
    DROP TABLE IF EXISTS payslips CASCADE;
    DROP TABLE IF EXISTS offer_letters CASCADE;
  `);
}
