import { query } from '../config/database.js';

// ============== OFFER LETTERS ==============

export async function getOfferLetters(filters = {}) {
  let sql = `
    SELECT ol.*, u.name as creator_name, u.avatar as creator_avatar
    FROM offer_letters ol
    LEFT JOIN users u ON ol.created_by = u.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 0;

  if (filters.status) {
    paramCount++;
    sql += ` AND ol.status = $${paramCount}`;
    params.push(filters.status);
  }

  if (filters.search) {
    paramCount++;
    sql += ` AND (ol.candidate_name ILIKE $${paramCount} OR ol.position_title ILIKE $${paramCount})`;
    params.push(`%${filters.search}%`);
  }

  sql += ' ORDER BY ol.created_at DESC';

  const { rows } = await query(sql, params);
  return rows;
}

export async function getOfferLetterById(id) {
  const { rows } = await query(
    `SELECT ol.*, u.name as creator_name, u.avatar as creator_avatar
     FROM offer_letters ol
     LEFT JOIN users u ON ol.created_by = u.id
     WHERE ol.id = $1`,
    [id]
  );
  return rows[0];
}

export async function createOfferLetter(userId, data) {
  const { rows } = await query(
    `INSERT INTO offer_letters (
      created_by,
      candidate_name, candidate_email, candidate_phone, candidate_address,
      position_title, department, employment_type, start_date, reporting_to, work_location,
      base_salary, salary_currency, salary_frequency, bonus_percentage, equity_shares, equity_vesting_period,
      benefits, additional_terms, offer_expiry_date, offer_date,
      company_name, company_address, company_logo_url, signatory_name, signatory_title,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
    RETURNING *`,
    [
      userId,
      data.candidate_name, data.candidate_email, data.candidate_phone || null, data.candidate_address || null,
      data.position_title, data.department || null, data.employment_type || 'full-time', data.start_date, data.reporting_to || null, data.work_location || null,
      data.base_salary, data.salary_currency || 'USD', data.salary_frequency || 'annual', data.bonus_percentage || null, data.equity_shares || null, data.equity_vesting_period || null,
      JSON.stringify(data.benefits || []), data.additional_terms || null, data.offer_expiry_date || null, data.offer_date || null,
      data.company_name, data.company_address || null, data.company_logo_url || null, data.signatory_name || null, data.signatory_title || null,
      data.status || 'draft'
    ]
  );

  return rows[0];
}

export async function updateOfferLetter(id, userId, data) {
  const updates = [];
  const params = [id];
  let paramCount = 1;

  const allowedFields = [
    'candidate_name', 'candidate_email', 'candidate_phone', 'candidate_address',
    'position_title', 'department', 'employment_type', 'start_date', 'reporting_to', 'work_location',
    'base_salary', 'salary_currency', 'salary_frequency', 'bonus_percentage', 'equity_shares', 'equity_vesting_period',
    'benefits', 'additional_terms', 'offer_expiry_date', 'offer_date',
    'company_name', 'company_address', 'company_logo_url', 'signatory_name', 'signatory_title',
    'status'
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      paramCount++;
      if (field === 'benefits') {
        updates.push(`${field} = $${paramCount}`);
        params.push(JSON.stringify(data[field]));
      } else {
        updates.push(`${field} = $${paramCount}`);
        params.push(data[field]);
      }
    }
  }

  if (data.status === 'sent' && !data.sent_at) {
    updates.push('sent_at = NOW()');
  }

  updates.push('updated_at = NOW()');

  const { rows } = await query(
    `UPDATE offer_letters SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );

  return rows[0];
}

export async function deleteOfferLetter(id) {
  await query('DELETE FROM offer_letters WHERE id = $1', [id]);
}

// ============== PAYSLIPS ==============

export async function getPayslips(filters = {}) {
  let sql = `
    SELECT p.*, u.name as creator_name, u.avatar as creator_avatar,
           e.name as employee_display_name, e.avatar as employee_avatar
    FROM payslips p
    LEFT JOIN users u ON p.created_by = u.id
    LEFT JOIN users e ON p.employee_id = e.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 0;

  if (filters.status) {
    paramCount++;
    sql += ` AND p.status = $${paramCount}`;
    params.push(filters.status);
  }

  if (filters.employee_id) {
    paramCount++;
    sql += ` AND p.employee_id = $${paramCount}`;
    params.push(filters.employee_id);
  }

  if (filters.month && filters.year) {
    paramCount++;
    sql += ` AND EXTRACT(MONTH FROM p.pay_period_start) = $${paramCount}`;
    params.push(filters.month);
    paramCount++;
    sql += ` AND EXTRACT(YEAR FROM p.pay_period_start) = $${paramCount}`;
    params.push(filters.year);
  }

  if (filters.search) {
    paramCount++;
    sql += ` AND (p.employee_name ILIKE $${paramCount} OR p.employee_code ILIKE $${paramCount})`;
    params.push(`%${filters.search}%`);
  }

  sql += ' ORDER BY p.created_at DESC';

  const { rows } = await query(sql, params);
  return rows;
}

export async function getPayslipById(id) {
  const { rows } = await query(
    `SELECT p.*, u.name as creator_name, u.avatar as creator_avatar,
            e.name as employee_display_name, e.avatar as employee_avatar
     FROM payslips p
     LEFT JOIN users u ON p.created_by = u.id
     LEFT JOIN users e ON p.employee_id = e.id
     WHERE p.id = $1`,
    [id]
  );
  return rows[0];
}

export async function createPayslip(userId, data) {
  // Calculate totals
  const basicSalary = parseFloat(data.basic_salary) || 0;
  const hra = parseFloat(data.hra) || 0;
  const conveyanceAllowance = parseFloat(data.conveyance_allowance) || 0;
  const medicalAllowance = parseFloat(data.medical_allowance) || 0;
  const specialAllowance = parseFloat(data.special_allowance) || 0;
  const bonus = parseFloat(data.bonus) || 0;
  const overtimePay = parseFloat(data.overtime_pay) || 0;
  
  const otherEarnings = (data.other_earnings || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  
  const grossEarnings = basicSalary + hra + conveyanceAllowance + medicalAllowance + 
                        specialAllowance + bonus + overtimePay + otherEarnings;

  const providentFund = parseFloat(data.provident_fund) || 0;
  const professionalTax = parseFloat(data.professional_tax) || 0;
  const incomeTax = parseFloat(data.income_tax) || 0;
  const healthInsurance = parseFloat(data.health_insurance) || 0;
  
  const otherDeductions = (data.other_deductions || []).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  
  const totalDeductions = providentFund + professionalTax + incomeTax + healthInsurance + otherDeductions;
  const netSalary = grossEarnings - totalDeductions;

  const { rows } = await query(
    `INSERT INTO payslips (
      created_by,
      employee_id, employee_name, employee_email, employee_code, department, designation,
      date_of_joining, bank_name, bank_account_number, pan_number,
      pay_period_start, pay_period_end, payment_date,
      basic_salary, hra, conveyance_allowance, medical_allowance, special_allowance,
      bonus, overtime_pay, other_earnings,
      provident_fund, professional_tax, income_tax, health_insurance, other_deductions,
      gross_earnings, total_deductions, net_salary,
      currency, company_name, company_address, company_logo_url, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
    RETURNING *`,
    [
      userId,
      data.employee_id || null, data.employee_name, data.employee_email, data.employee_code || null, 
      data.department || null, data.designation || null,
      data.date_of_joining || null, data.bank_name || null, data.bank_account_number || null, data.pan_number || null,
      data.pay_period_start, data.pay_period_end, data.payment_date,
      basicSalary, hra, conveyanceAllowance, medicalAllowance, specialAllowance,
      bonus, overtimePay, JSON.stringify(data.other_earnings || []),
      providentFund, professionalTax, incomeTax, healthInsurance, JSON.stringify(data.other_deductions || []),
      grossEarnings, totalDeductions, netSalary,
      data.currency || 'USD', data.company_name, data.company_address || null, data.company_logo_url || null,
      data.status || 'draft'
    ]
  );

  return rows[0];
}

export async function updatePayslip(id, userId, data) {
  // Recalculate totals if earnings/deductions changed
  let grossEarnings, totalDeductions, netSalary;
  
  if (data.basic_salary !== undefined) {
    const basicSalary = parseFloat(data.basic_salary) || 0;
    const hra = parseFloat(data.hra) || 0;
    const conveyanceAllowance = parseFloat(data.conveyance_allowance) || 0;
    const medicalAllowance = parseFloat(data.medical_allowance) || 0;
    const specialAllowance = parseFloat(data.special_allowance) || 0;
    const bonus = parseFloat(data.bonus) || 0;
    const overtimePay = parseFloat(data.overtime_pay) || 0;
    const otherEarnings = (data.other_earnings || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    
    grossEarnings = basicSalary + hra + conveyanceAllowance + medicalAllowance + 
                    specialAllowance + bonus + overtimePay + otherEarnings;

    const providentFund = parseFloat(data.provident_fund) || 0;
    const professionalTax = parseFloat(data.professional_tax) || 0;
    const incomeTax = parseFloat(data.income_tax) || 0;
    const healthInsurance = parseFloat(data.health_insurance) || 0;
    const otherDeductions = (data.other_deductions || []).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    
    totalDeductions = providentFund + professionalTax + incomeTax + healthInsurance + otherDeductions;
    netSalary = grossEarnings - totalDeductions;
  }

  const updates = [];
  const params = [id];
  let paramCount = 1;

  const allowedFields = [
    'employee_id', 'employee_name', 'employee_email', 'employee_code', 'department', 'designation',
    'date_of_joining', 'bank_name', 'bank_account_number', 'pan_number',
    'pay_period_start', 'pay_period_end', 'payment_date',
    'basic_salary', 'hra', 'conveyance_allowance', 'medical_allowance', 'special_allowance',
    'bonus', 'overtime_pay', 'other_earnings',
    'provident_fund', 'professional_tax', 'income_tax', 'health_insurance', 'other_deductions',
    'currency', 'company_name', 'company_address', 'company_logo_url', 'status'
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      paramCount++;
      if (field === 'other_earnings' || field === 'other_deductions') {
        updates.push(`${field} = $${paramCount}`);
        params.push(JSON.stringify(data[field]));
      } else {
        updates.push(`${field} = $${paramCount}`);
        params.push(data[field]);
      }
    }
  }

  if (grossEarnings !== undefined) {
    paramCount++;
    updates.push(`gross_earnings = $${paramCount}`);
    params.push(grossEarnings);
    paramCount++;
    updates.push(`total_deductions = $${paramCount}`);
    params.push(totalDeductions);
    paramCount++;
    updates.push(`net_salary = $${paramCount}`);
    params.push(netSalary);
  }

  if (data.status === 'sent' && !data.sent_at) {
    updates.push('sent_at = NOW()');
  }

  updates.push('updated_at = NOW()');

  const { rows } = await query(
    `UPDATE payslips SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );

  return rows[0];
}

export async function deletePayslip(id) {
  await query('DELETE FROM payslips WHERE id = $1', [id]);
}

// Get all employees (users) for payslip selection
export async function getAllEmployees() {
  const { rows } = await query(
    `SELECT id, name, email, avatar
     FROM users
     ORDER BY name`
  );
  return rows;
}
