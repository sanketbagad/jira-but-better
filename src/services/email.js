import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

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
