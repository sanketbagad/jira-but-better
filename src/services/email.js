import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

/**
 * Send email verification link after registration.
 */
export async function sendVerificationEmail({ to, name, verifyUrl }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] Simulated verification email to ${to} — Link: ${verifyUrl}`);
    return { simulated: true };
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 0;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 24px; border-radius: 16px 16px 0 0; text-align: center;">
        <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <span style="font-size: 24px;">⚡</span>
        </div>
        <h1 style="color: white; font-size: 22px; font-weight: 700; margin: 0;">Nexora</h1>
      </div>
      <div style="background: #ffffff; padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #111; margin: 0 0 8px;">Verify your email</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Hi ${name}, welcome to Nexora! Click the button below to verify your email and activate your account.
        </p>
        <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Verify Email Address
        </a>
        <p style="color: #888; font-size: 13px; margin-top: 24px; line-height: 1.5;">
          This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #f0f0f0; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 11px; margin: 0;">
          Can't click the button? Copy this link:<br/>
          <a href="${verifyUrl}" style="color: #6366f1; word-break: break-all;">${verifyUrl}</a>
        </p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: fromEmail,
    to,
    subject: 'Verify your Nexora email',
    html,
  });

  return { sent: true };
}

/**
 * Send an invite email with temp credentials.
 */
export async function sendWelcomeEmail({ to, name, orgName, role, password, loginUrl }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] Simulated welcome email to ${to} — Password: ${password}`);
    return { simulated: true };
  }

  const roleLabels = {
    owner: 'Owner', admin: 'Admin', hr: 'HR', manager: 'Manager',
    developer: 'Developer', designer: 'Designer', viewer: 'Viewer',
  };

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 0;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 24px; border-radius: 16px 16px 0 0; text-align: center;">
        <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <span style="font-size: 24px;">⚡</span>
        </div>
        <h1 style="color: white; font-size: 22px; font-weight: 700; margin: 0;">Nexora</h1>
      </div>
      <div style="background: #ffffff; padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #111; margin: 0 0 8px;">Welcome to ${orgName || 'the team'}!</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
          Hi ${name}, your account has been created on Nexora. You've been added as <strong>${roleLabels[role] || role}</strong>.
        </p>
        <div style="background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin: 0 0 24px;">
          <p style="margin: 0 0 10px; font-size: 14px; color: #333; font-weight: 600;">Your login credentials:</p>
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 4px 0; color: #888; width: 90px;">Email</td>
              <td style="padding: 4px 0; color: #111; font-weight: 500;">${to}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #888;">Password</td>
              <td style="padding: 4px 0; color: #111; font-family: monospace; font-weight: 600; font-size: 15px; letter-spacing: 0.5px;">${password}</td>
            </tr>
          </table>
        </div>
        <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Login to Nexora
        </a>
        <p style="color: #ef4444; font-size: 13px; margin-top: 20px; line-height: 1.5; font-weight: 500;">
          ⚠️ Please change your password after your first login.
        </p>
        <hr style="border: none; border-top: 1px solid #f0f0f0; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 11px; margin: 0;">
          If you didn't expect this email, please contact your organization admin.
        </p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: fromEmail,
    to,
    subject: `Welcome to ${orgName || 'Nexora'} — Your account is ready`,
    html,
  });

  return { sent: true };
}

/**
 * Send an invite email with temp credentials.
 */
export async function sendInviteEmail({ to, name, inviterName, projectName, role, tempPassword, loginUrl }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] Simulated invite to ${to} (RESEND_API_KEY not configured)`);
    return { simulated: true };
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #6366f1;">You've been invited to ${projectName}!</h2>
      <p>Hi ${name},</p>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${projectName}</strong> as a <strong>${role}</strong>.</p>
      <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Email:</strong> ${to}</p>
        <p style="margin: 4px 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>
      <p>Please change your password after your first login.</p>
      <a href="${loginUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">
        Login Now
      </a>
      <p style="color: #71717a; font-size: 12px; margin-top: 24px;">
        This invite expires in 7 days. If you didn't expect this email, please ignore it.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: fromEmail,
    to,
    subject: `You're invited to ${projectName}`,
    html,
  });

  return { sent: true };
}

/**
 * Send a task assignment notification.
 */
export async function sendTaskAssignmentEmail({ to, assigneeName, taskTitle, projectName, assignerName }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] Simulated task assignment notification to ${to}`);
    return { simulated: true };
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #6366f1;">New Task Assigned</h2>
      <p>Hi ${assigneeName},</p>
      <p><strong>${assignerName}</strong> has assigned you a task in <strong>${projectName}</strong>:</p>
      <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0; font-size: 18px; font-weight: bold;">${taskTitle}</p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: fromEmail,
    to,
    subject: `[${projectName}] Task assigned: ${taskTitle}`,
    html,
  });

  return { sent: true };
}

/**
 * Send an offer letter email to a candidate.
 */
export async function sendOfferLetterToCandidate(offerLetter, pdfBase64 = null) {
  const {
    candidate_name,
    candidate_email,
    candidate_phone,
    candidate_address,
    position_title,
    department,
    employment_type,
    start_date,
    reporting_to,
    work_location,
    base_salary,
    salary_currency,
    salary_frequency,
    bonus_percentage,
    equity_shares,
    equity_vesting_period,
    benefits,
    additional_terms,
    offer_expiry_date,
    offer_date,
    company_name,
    company_address,
    company_logo_url,
    signatory_name,
    signatory_title,
  } = offerLetter;

  const currencySymbols = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };
  const symbol = currencySymbols[salary_currency] || '$';
  const formattedSalary = `${symbol}${parseFloat(base_salary || 0).toLocaleString()}`;

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const refDate = offer_date ? new Date(offer_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const initials = candidate_name ? candidate_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'XX';
  const refNumber = `OL-${refDate.replace(/-/g, '')}-${initials}`;

  // Build benefits HTML
  let benefitsHtml = '';
  if (benefits && benefits.length > 0) {
    const benefitRows = benefits.map(b =>
      `<tr style="border-bottom:1px solid #f0f0f0"><td style="padding:8px 12px;font-weight:500">${b.name}</td><td style="padding:8px 12px;color:#555">${b.description || '—'}</td></tr>`
    ).join('');
    benefitsHtml = `
      <div style="margin-bottom:20px">
        <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin-bottom:12px">3. Benefits</h3>
        <p style="margin-bottom:10px">In addition to your compensation, you will be eligible for the following benefits, effective from your date of joining:</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="border-bottom:1px solid #ddd"><th style="padding:8px 12px;text-align:left;color:#1e3a5f;font-weight:600">Benefit</th><th style="padding:8px 12px;text-align:left;color:#1e3a5f;font-weight:600">Details</th></tr></thead>
          <tbody>${benefitRows}</tbody>
        </table>
        <p style="font-size:11px;color:#888;margin-top:8px;font-style:italic">Benefits are subject to the terms and conditions of the respective plan documents and may be modified from time to time at the Company's discretion.</p>
      </div>`;
  }

  const termsSection = benefitsHtml ? '4' : '3';

  // Build equity row
  let equityRow = '';
  if (equity_shares) {
    equityRow = `<tr><td style="padding:6px 0;color:#666;width:180px;vertical-align:top">Equity Grant:</td><td style="padding:6px 0;font-weight:500">${parseInt(equity_shares).toLocaleString()} stock options${equity_vesting_period ? `, vesting over ${equity_vesting_period}` : ''}, subject to the Company's Stock Option Plan</td></tr>`;
  }

  // Build bonus row
  let bonusRow = '';
  if (bonus_percentage) {
    bonusRow = `<tr><td style="padding:6px 0;color:#666;vertical-align:top">Performance Bonus:</td><td style="padding:6px 0;font-weight:500">Up to ${bonus_percentage}% of annual base salary, subject to performance targets</td></tr>`;
  }

  // Offer expiry
  let expiryHtml = '';
  if (offer_expiry_date) {
    expiryHtml = `<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:4px;padding:12px 16px;margin-bottom:20px"><p style="margin:0;font-size:12px"><strong>Offer Validity:</strong> This offer is valid until <strong>${formatDate(offer_expiry_date)}</strong>. Please confirm your acceptance on or before this date.</p></div>`;
  }

  // Additional terms
  let additionalHtml = '';
  if (additional_terms) {
    additionalHtml = `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:12px 16px;margin-top:12px"><p style="font-weight:600;font-size:12px;color:#1e3a5f;margin:0 0 6px 0">Additional Terms:</p><p style="white-space:pre-line;margin:0;color:#555">${additional_terms}</p></div>`;
  }

  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] Simulated offer letter email to ${candidate_email} (RESEND_API_KEY not configured)`);
    return { simulated: true };
  }

  const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:700px;margin:0 auto;color:#1a1a1a;font-size:13px;line-height:1.6">
      <!-- Letterhead -->
      <div style="border-bottom:3px solid #1e3a5f;padding:30px 40px 16px 40px">
        <table style="width:100%"><tr>
          <td>
            ${company_logo_url ? `<img src="${company_logo_url}" alt="Logo" style="height:40px;margin-bottom:8px;display:block" />` : ''}
            <h1 style="font-size:20px;font-weight:700;color:#1e3a5f;margin:0;letter-spacing:1px;text-transform:uppercase">${company_name || 'Company Name'}</h1>
            ${company_address ? `<p style="font-size:11px;color:#666;margin:4px 0 0 0">${company_address}</p>` : ''}
          </td>
          <td style="text-align:right;vertical-align:top">
            <p style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:2px;margin:0 0 4px 0">Ref No.</p>
            <p style="font-size:12px;color:#1e3a5f;font-weight:600;margin:0">${refNumber}</p>
          </td>
        </tr></table>
      </div>
      <div style="height:2px;background:linear-gradient(to right,#1e3a5f,#3b82f6,transparent)"></div>

      <div style="padding:24px 40px 32px 40px">
        <!-- Confidential & Title -->
        <div style="text-align:center;margin-bottom:24px">
          <span style="display:inline-block;background:#fef3cd;border:1px solid #ffc107;color:#856404;font-size:9px;letter-spacing:3px;text-transform:uppercase;padding:3px 16px;border-radius:2px;font-weight:600;margin-bottom:10px">Private &amp; Confidential</span>
          <h2 style="font-size:18px;font-weight:700;color:#1e3a5f;margin:0;letter-spacing:2px;text-transform:uppercase">Offer of Employment</h2>
        </div>

        <p style="text-align:right;color:#555;font-size:12px;margin-bottom:16px">Date: <strong>${formatDate(offer_date)}</strong></p>

        <div style="margin-bottom:20px">
          <p style="font-weight:600;margin:0 0 2px 0">${candidate_name || '[Candidate Name]'}</p>
          ${candidate_address ? `<p style="color:#555;margin:0 0 2px 0;font-size:12px">${candidate_address}</p>` : ''}
          ${candidate_email ? `<p style="color:#555;margin:0 0 2px 0;font-size:12px">${candidate_email}</p>` : ''}
          ${candidate_phone ? `<p style="color:#555;margin:0;font-size:12px">${candidate_phone}</p>` : ''}
        </div>

        <p style="font-weight:700;border-bottom:1px solid #ddd;padding-bottom:8px;margin-bottom:16px">Subject: Offer of Employment — ${position_title || '[Position Title]'}${department ? `, ${department}` : ''}</p>

        <p style="margin-bottom:14px">Dear ${candidate_name ? candidate_name.split(' ')[0] : '[Candidate]'},</p>

        <p style="margin-bottom:14px">On behalf of <strong>${company_name || '[Company Name]'}</strong>, I am pleased to extend this formal offer of employment for the position of <strong>${position_title || '[Position Title]'}</strong>${department ? ` within the <strong>${department}</strong> department` : ''}. After careful evaluation of your qualifications and experience, we are confident that you will make a significant contribution to our organization.</p>

        <p style="margin-bottom:20px">The terms and conditions of your employment are outlined below. Please review them carefully before indicating your acceptance.</p>

        <!-- 1. Position Details -->
        <div style="margin-bottom:20px">
          <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin-bottom:12px">1. Position Details</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:6px 0;color:#666;width:180px">Position Title:</td><td style="padding:6px 0;font-weight:500">${position_title || '—'}</td></tr>
            ${department ? `<tr><td style="padding:6px 0;color:#666">Department:</td><td style="padding:6px 0;font-weight:500">${department}</td></tr>` : ''}
            <tr><td style="padding:6px 0;color:#666">Employment Type:</td><td style="padding:6px 0;font-weight:500;text-transform:capitalize">${(employment_type || 'full-time').replace('-', ' ')}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Start Date:</td><td style="padding:6px 0;font-weight:500">${formatDate(start_date) || 'To be determined'}</td></tr>
            ${reporting_to ? `<tr><td style="padding:6px 0;color:#666">Reporting To:</td><td style="padding:6px 0;font-weight:500">${reporting_to}</td></tr>` : ''}
            ${work_location ? `<tr><td style="padding:6px 0;color:#666">Work Location:</td><td style="padding:6px 0;font-weight:500">${work_location}</td></tr>` : ''}
          </table>
        </div>

        <!-- 2. Compensation -->
        <div style="margin-bottom:20px">
          <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin-bottom:12px">2. Compensation</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:6px 0;color:#666;width:180px">Base Salary:</td><td style="padding:6px 0;font-weight:600">${formattedSalary} <span style="font-weight:400;color:#666">per ${salary_frequency === 'annual' ? 'annum' : salary_frequency}</span></td></tr>
            ${bonusRow}
            ${equityRow}
          </table>
          <p style="font-size:11px;color:#888;margin-top:8px;font-style:italic">Compensation is subject to applicable tax withholdings and deductions. Salary reviews are conducted annually.</p>
        </div>

        ${benefitsHtml}

        <!-- Terms -->
        <div style="margin-bottom:20px">
          <h3 style="font-size:13px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;margin-bottom:12px">${termsSection}. Terms of Employment</h3>
          <p style="margin-bottom:10px">Your employment with ${company_name || '[Company Name]'} is on an <strong>at-will</strong> basis, meaning either you or the Company may terminate the employment relationship at any time, with or without cause and with or without notice, subject to applicable law.</p>
          <p style="margin-bottom:10px">This offer is contingent upon successful completion of background verification and any other pre-employment requirements. You will also be required to sign a Confidentiality and Non-Disclosure Agreement.</p>
          ${additionalHtml}
        </div>

        ${expiryHtml}

        <p style="margin-bottom:12px">We are enthusiastic about the possibility of you joining ${company_name || '[Company Name]'} and are confident that this role will offer you a rewarding career path.</p>
        <p style="margin-bottom:20px">To accept this offer, please reply to this email with your confirmation.</p>
        <p style="margin-bottom:24px">Warm regards,</p>

        <!-- Signature -->
        <div>
          <p style="font-weight:600;margin:0;font-size:13px">${signatory_name || '[Authorized Signatory]'}</p>
          <p style="color:#666;margin:2px 0 0 0;font-size:12px">${signatory_title || '[Designation]'}</p>
          <p style="color:#666;margin:2px 0 0 0;font-size:12px">${company_name || '[Company Name]'}</p>
        </div>

        <!-- Footer -->
        <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center">
          <p style="font-size:10px;color:#aaa;margin:0 0 4px 0">This document is confidential and intended solely for the named recipient. Unauthorized use, distribution, or reproduction is strictly prohibited.</p>
          <p style="font-size:10px;color:#ccc;margin:0">${company_name || '[Company Name]'} &bull; ${company_address || '[Company Address]'}</p>
        </div>
      </div>
    </div>`;

  const emailPayload = {
    from: fromEmail,
    to: candidate_email,
    subject: `Offer of Employment — ${position_title} at ${company_name}`,
    html,
  };

  if (pdfBase64) {
    const filename = `Offer_Letter_${(candidate_name || 'Candidate').replace(/\s+/g, '_')}.pdf`;
    emailPayload.attachments = [
      {
        filename,
        content: pdfBase64,
      },
    ];
  }

  await resend.emails.send(emailPayload);

  return { sent: true };
}

export async function sendPayslipToEmployee(payslip, pdfBase64 = null) {
  const {
    employee_name,
    employee_email,
    employee_code,
    department,
    designation,
    date_of_joining,
    bank_name,
    bank_account_number,
    pan_number,
    pay_period_start,
    pay_period_end,
    payment_date,
    basic_salary,
    hra,
    conveyance_allowance,
    medical_allowance,
    special_allowance,
    bonus,
    overtime_pay,
    other_earnings,
    provident_fund,
    professional_tax,
    income_tax,
    health_insurance,
    other_deductions,
    gross_earnings,
    total_deductions,
    net_salary,
    currency,
    company_name,
    company_address,
    company_logo_url,
  } = payslip;

  const currencySymbols = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };
  const symbol = currencySymbols[currency] || '$';
  const fmt = (v) => `${symbol}${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const maskPAN = (pan) => {
    if (!pan || pan.length < 4) return pan || '—';
    return pan.substring(0, 2) + '****' + pan.substring(pan.length - 2);
  };

  const payMonth = pay_period_start
    ? new Date(pay_period_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'N/A';

  // Build earnings rows
  let earningsRows = '';
  const addEarning = (label, val) => {
    if (parseFloat(val) > 0) earningsRows += `<tr style="border-bottom:1px solid #f0f0f0"><td style="padding:7px 14px;font-size:11.5px;color:#374151">${label}</td><td style="padding:7px 14px;font-size:11.5px;color:#111827;text-align:right;font-weight:500">${fmt(val)}</td></tr>`;
  };
  addEarning('Basic Salary', basic_salary);
  addEarning('House Rent Allowance (HRA)', hra);
  addEarning('Conveyance Allowance', conveyance_allowance);
  addEarning('Medical Allowance', medical_allowance);
  addEarning('Special Allowance', special_allowance);
  addEarning('Bonus', bonus);
  addEarning('Overtime Pay', overtime_pay);
  if (other_earnings && Array.isArray(other_earnings)) {
    other_earnings.forEach(e => addEarning(e.name, e.amount));
  }

  // Build deduction rows
  let deductionRows = '';
  const addDeduction = (label, val) => {
    if (parseFloat(val) > 0) deductionRows += `<tr style="border-bottom:1px solid #f0f0f0"><td style="padding:7px 14px;font-size:11.5px;color:#374151">${label}</td><td style="padding:7px 14px;font-size:11.5px;color:#111827;text-align:right;font-weight:500">${fmt(val)}</td></tr>`;
  };
  addDeduction('Provident Fund (PF)', provident_fund);
  addDeduction('Professional Tax', professional_tax);
  addDeduction('Income Tax (TDS)', income_tax);
  addDeduction('Health Insurance', health_insurance);
  if (other_deductions && Array.isArray(other_deductions)) {
    other_deductions.forEach(d => addDeduction(d.name, d.amount));
  }

  const html = `
    <div style="max-width:700px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;color:#111827">
      <!-- Top Bar -->
      <div style="height:6px;background:linear-gradient(90deg,#1e3a5f 0%,#2563eb 50%,#1e3a5f 100%)"></div>
      <div style="padding:28px 36px 20px">
        <!-- Header -->
        <table style="width:100%;margin-bottom:16px"><tr>
          <td style="vertical-align:top">
            ${company_logo_url ? `<img src="${company_logo_url}" alt="Logo" style="height:40px;margin-bottom:4px" />` : ''}
            <div style="font-size:17px;font-weight:700;color:#1e3a5f">${company_name || 'Company Name'}</div>
            ${company_address ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">${company_address}</div>` : ''}
          </td>
          <td style="text-align:right;vertical-align:top">
            <div style="font-size:11px;font-weight:700;color:#fff;background:#1e3a5f;padding:5px 14px;border-radius:4px;letter-spacing:2px;display:inline-block;margin-bottom:4px">PAYSLIP</div>
            <div style="font-size:13px;font-weight:600;color:#1e3a5f">${payMonth}</div>
            <div style="font-size:10px;color:#9ca3af;margin-top:2px">Ref: PS-${employee_code || 'XXX'}-${pay_period_start ? new Date(pay_period_start).toISOString().split('T')[0].replace(/-/g, '').slice(0, 6) : 'YYYYMM'}</div>
          </td>
        </tr></table>

        <div style="height:2px;background:linear-gradient(90deg,#1e3a5f,#2563eb,#1e3a5f);margin-bottom:16px;border-radius:1px"></div>

        <!-- Employee Details -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;border:1px solid #e5e7eb">
          <tr><td colspan="4" style="background:#f8fafc;padding:7px 14px;font-size:11px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #e5e7eb">Employee Details</td></tr>
          <tr>
            <td style="padding:6px 12px;font-size:10.5px;color:#6b7280;border-bottom:1px solid #f3f4f6;width:22%">Employee Name</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6;width:28%">${employee_name || '—'}</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#6b7280;border-bottom:1px solid #f3f4f6;width:22%">Employee Code</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6;width:28%">${employee_code || '—'}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px;font-size:10.5px;color:#6b7280;border-bottom:1px solid #f3f4f6">Department</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6">${department || '—'}</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#6b7280;border-bottom:1px solid #f3f4f6">Designation</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6">${designation || '—'}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px;font-size:10.5px;color:#6b7280;border-bottom:1px solid #f3f4f6">Date of Joining</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6">${formatDate(date_of_joining) || '—'}</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#6b7280;border-bottom:1px solid #f3f4f6">PAN Number</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6">${maskPAN(pan_number)}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px;font-size:10.5px;color:#6b7280;border-bottom:1px solid #f3f4f6">Bank Name</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6">${bank_name || '—'}</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#6b7280;border-bottom:1px solid #f3f4f6">Account Number</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6">${bank_account_number ? '****' + bank_account_number.slice(-4) : '—'}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px;font-size:10.5px;color:#6b7280">Payment Date</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#111827;font-weight:600">${formatDate(payment_date) || '—'}</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#6b7280">Pay Period</td>
            <td style="padding:6px 12px;font-size:10.5px;color:#111827;font-weight:600">${formatDate(pay_period_start)} — ${formatDate(pay_period_end)}</td>
          </tr>
        </table>

        <!-- Earnings & Deductions -->
        <table style="width:100%;margin-bottom:14px"><tr style="vertical-align:top">
          <td style="width:49%;padding-right:6px">
            <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
              <tr><td colspan="2" style="background:#065f46;padding:7px 14px;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px">Earnings</td></tr>
              <tr style="border-bottom:2px solid #e5e7eb;background:#f0fdf4">
                <td style="padding:5px 14px;font-size:10px;font-weight:600;color:#065f46;text-transform:uppercase">Component</td>
                <td style="padding:5px 14px;font-size:10px;font-weight:600;color:#065f46;text-transform:uppercase;text-align:right">Amount</td>
              </tr>
              ${earningsRows}
              <tr style="background:#f0fdf4;border-top:2px solid #065f46">
                <td style="padding:7px 14px;font-weight:700;color:#065f46;font-size:12px">Gross Earnings</td>
                <td style="padding:7px 14px;font-weight:700;color:#065f46;font-size:12px;text-align:right">${fmt(gross_earnings)}</td>
              </tr>
            </table>
          </td>
          <td style="width:49%;padding-left:6px">
            <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
              <tr><td colspan="2" style="background:#991b1b;padding:7px 14px;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px">Deductions</td></tr>
              <tr style="border-bottom:2px solid #e5e7eb;background:#fef2f2">
                <td style="padding:5px 14px;font-size:10px;font-weight:600;color:#991b1b;text-transform:uppercase">Component</td>
                <td style="padding:5px 14px;font-size:10px;font-weight:600;color:#991b1b;text-transform:uppercase;text-align:right">Amount</td>
              </tr>
              ${deductionRows}
              <tr style="background:#fef2f2;border-top:2px solid #991b1b">
                <td style="padding:7px 14px;font-weight:700;color:#991b1b;font-size:12px">Total Deductions</td>
                <td style="padding:7px 14px;font-weight:700;color:#991b1b;font-size:12px;text-align:right">${fmt(total_deductions)}</td>
              </tr>
            </table>
          </td>
        </tr></table>

        <!-- Net Pay -->
        <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%);border-radius:8px;padding:14px 22px;margin-bottom:10px;color:#fff">
          <table style="width:100%"><tr>
            <td>
              <div style="font-size:10px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;font-weight:600">Net Pay</div>
              <div style="font-size:26px;font-weight:800;margin-top:2px">${fmt(net_salary)}</div>
            </td>
            <td style="text-align:right;font-size:10px;color:rgba(255,255,255,0.6)">
              <div>Gross: ${fmt(gross_earnings)}</div>
              <div style="margin-top:2px">Deductions: ${fmt(total_deductions)}</div>
            </td>
          </tr></table>
        </div>

        <!-- Footer -->
        <div style="text-align:center;margin-top:20px;padding-top:12px;border-top:2px solid #e5e7eb">
          <p style="font-size:9px;color:#9ca3af;margin:0 0 3px">This is a system-generated payslip. For any discrepancies, please contact the HR department within 7 working days.</p>
          <p style="font-size:9px;color:#d1d5db;margin:0">${company_name || 'Company'}${company_address ? ' • ' + company_address : ''}</p>
        </div>
      </div>
      <div style="height:4px;background:linear-gradient(90deg,#1e3a5f 0%,#2563eb 50%,#1e3a5f 100%)"></div>
    </div>`;

  const emailPayload = {
    from: fromEmail,
    to: employee_email,
    subject: `Payslip for ${payMonth} — ${company_name || 'Your Company'}`,
    html,
  };

  if (pdfBase64) {
    const filename = `Payslip_${(employee_name || 'Employee').replace(/\s+/g, '_')}_${payMonth.replace(/\s+/g, '_')}.pdf`;
    emailPayload.attachments = [
      {
        filename,
        content: pdfBase64,
      },
    ];
  }

  await resend.emails.send(emailPayload);

  return { sent: true };
}

/**
 * Send an interview invitation email to a candidate.
 */
export async function sendInterviewInvite(interview, companyName = 'Nexora') {
  const {
    candidate_name,
    candidate_email,
    position_title,
    department,
    round,
    round_number,
    interviewer_name,
    scheduled_at,
    duration_minutes,
    meeting_link,
    interview_type,
    notes,
  } = interview;

  const roundLabels = {
    screening: 'Screening Round',
    technical: 'Technical Round',
    coding: 'Coding Round',
    system_design: 'System Design Round',
    behavioral: 'Behavioral Round',
    hr: 'HR Round',
    culture_fit: 'Culture Fit Round',
    final: 'Final Round',
    other: 'Interview',
  };

  const typeLabels = {
    video: '📹 Video Call',
    in_person: '🏢 In Person',
    phone: '📞 Phone Call',
  };

  const roundLabel = roundLabels[round] || 'Interview';
  const typeLabel = typeLabels[interview_type] || 'Video Call';
  const dateStr = new Date(scheduled_at).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = new Date(scheduled_at).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const endTime = new Date(new Date(scheduled_at).getTime() + (duration_minutes || 60) * 60000);
  const endTimeStr = endTime.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const fullMeetingLink = meeting_link?.startsWith('http') ? meeting_link : `${baseUrl}${meeting_link}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] Simulated interview invite to ${candidate_email}`);
    console.log(`  → ${roundLabel} for ${position_title}`);
    console.log(`  → ${dateStr} at ${timeStr}`);
    console.log(`  → Link: ${fullMeetingLink}`);
    return { simulated: true };
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 0;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 24px; border-radius: 16px 16px 0 0; text-align: center;">
        <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <span style="font-size: 24px;">⚡</span>
        </div>
        <h1 style="color: white; font-size: 22px; font-weight: 700; margin: 0;">${companyName}</h1>
        <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 8px 0 0;">Interview Invitation</p>
      </div>

      <div style="background: #ffffff; padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #111; margin: 0 0 8px;">Hi ${candidate_name},</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          We're excited to invite you for the <strong>${roundLabel}</strong> (Round ${round_number})
          for the <strong>${position_title}</strong>${department ? ` in the ${department} department` : ''}
          position at ${companyName}.
        </p>

        <div style="background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #888; width: 110px; vertical-align: top;">📅 Date</td>
              <td style="padding: 8px 0; color: #111; font-weight: 600;">${dateStr}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888; vertical-align: top;">🕐 Time</td>
              <td style="padding: 8px 0; color: #111; font-weight: 600;">${timeStr} — ${endTimeStr} (${duration_minutes} min)</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888; vertical-align: top;">📋 Round</td>
              <td style="padding: 8px 0; color: #111; font-weight: 600;">${roundLabel}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888; vertical-align: top;">📍 Format</td>
              <td style="padding: 8px 0; color: #111; font-weight: 600;">${typeLabel}</td>
            </tr>
            ${interviewer_name ? `
            <tr>
              <td style="padding: 8px 0; color: #888; vertical-align: top;">👤 Interviewer</td>
              <td style="padding: 8px 0; color: #111; font-weight: 600;">${interviewer_name}</td>
            </tr>` : ''}
          </table>
        </div>

        ${interview_type === 'video' || interview_type === 'phone' ? `
        <div style="text-align: center; margin: 0 0 24px;">
          <a href="${fullMeetingLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Join Interview Call
          </a>
          <p style="color: #888; font-size: 12px; margin-top: 12px;">
            Or copy this link: <a href="${fullMeetingLink}" style="color: #6366f1; word-break: break-all;">${fullMeetingLink}</a>
          </p>
        </div>` : `
        <div style="background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin: 0 0 24px;">
          <p style="margin: 0; font-size: 13px; color: #92400e;">
            <strong>📍 In-Person Interview</strong> — Please arrive at the office 10 minutes before the scheduled time.
          </p>
        </div>`}

        ${notes ? `
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px 16px; margin: 0 0 24px;">
          <p style="margin: 0 0 4px; font-size: 12px; color: #0369a1; font-weight: 600;">📝 Additional Notes</p>
          <p style="margin: 0; font-size: 13px; color: #0c4a6e;">${notes}</p>
        </div>` : ''}

        <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
          Please reply to confirm your attendance. If you need to reschedule, let us know at your earliest convenience.
        </p>
        <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          We look forward to speaking with you!
        </p>

        <p style="color: #888; font-size: 14px;">
          Best regards,<br/>
          <strong>The ${companyName} Hiring Team</strong>
        </p>

        <hr style="border: none; border-top: 1px solid #f0f0f0; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 11px; margin: 0; text-align: center;">
          This is an automated message from ${companyName}. Please do not reply to this email directly.
        </p>
      </div>
    </div>`;

  await resend.emails.send({
    from: fromEmail,
    to: candidate_email,
    subject: `Interview Invitation: ${roundLabel} — ${position_title} at ${companyName}`,
    html,
  });

  return { sent: true };
}
