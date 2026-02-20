import { AppError } from '../middleware/errorHandler.js';
import { getSmtpConfig } from './admin-settings.service.js';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private resendApiKey = process.env.RESEND_API_KEY || '';
  private from = process.env.EMAIL_FROM || 'EE PostMind <no-reply@smmt.local>';

  async sendEmail(input: SendEmailInput): Promise<void> {
    // Try DB-configured SMTP first
    const smtpCfg = await getSmtpConfig();
    if (smtpCfg.smtp_host && smtpCfg.smtp_user) {
      return this.sendViaSmtp(input, smtpCfg);
    }

    // Fall back to Resend API
    if (!this.resendApiKey) {
      console.log(
        `[EMAIL DEV] To: ${input.to}\nSubject: ${input.subject}\n${input.text}\n`,
      );
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new AppError(
        `Email delivery failed: ${details || response.statusText}`,
        502,
        'EMAIL_DELIVERY_FAILED',
      );
    }
  }

  private async sendViaSmtp(input: SendEmailInput, cfg: { smtp_host: string; smtp_port: string; smtp_user: string; smtp_pass: string; smtp_from: string; smtp_secure: string }): Promise<void> {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.default.createTransport({
      host: cfg.smtp_host,
      port: parseInt(cfg.smtp_port, 10),
      secure: cfg.smtp_secure === 'true',
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
    });

    try {
      await transport.sendMail({
        from: cfg.smtp_from || cfg.smtp_user,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
    } catch (err: any) {
      throw new AppError(
        `Email delivery failed: ${err.message}`,
        502,
        'EMAIL_DELIVERY_FAILED',
      );
    }
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    verificationLink: string,
  ): Promise<void> {
    const subject = 'Verify your EE PostMind email';
    const text = `Hi ${name},\n\nVerify your email by clicking this link:\n${verificationLink}\n\nIf you did not create this account, you can ignore this email.`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
        <p>Hi ${name},</p>
        <p>Please verify your email address to secure your EE PostMind account.</p>
        <p>
          <a href="${verificationLink}" style="display:inline-block;background:#2563EB;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
            Verify Email
          </a>
        </p>
        <p>If the button does not work, use this link:</p>
        <p><a href="${verificationLink}">${verificationLink}</a></p>
      </div>
    `;

    await this.sendEmail({ to: email, subject, text, html });
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetLink: string,
  ): Promise<void> {
    const subject = 'Reset your EE PostMind password';
    const text = `Hi ${name},\n\nYou requested a password reset. Use this link to set a new password:\n${resetLink}\n\nIf you did not request this, you can ignore this email.`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
        <p>Hi ${name},</p>
        <p>You requested a password reset for your EE PostMind account.</p>
        <p>
          <a href="${resetLink}" style="display:inline-block;background:#2563EB;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
            Reset Password
          </a>
        </p>
        <p>If the button does not work, use this link:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
      </div>
    `;

    await this.sendEmail({ to: email, subject, text, html });
  }

  async sendWelcomeSetPasswordEmail(input: {
    email: string;
    name: string;
    setPasswordLink: string;
    loginLink: string;
    verifyEmailLink?: string;
  }): Promise<void> {
    const subject = 'Welcome to EE PostMind — set your password';
    const verifyLine = input.verifyEmailLink
      ? `\nVerify email (recommended): ${input.verifyEmailLink}`
      : '';
    const verifyHtml = input.verifyEmailLink
      ? `<p style="margin-top:12px">Verify email (recommended): <a href="${input.verifyEmailLink}">${input.verifyEmailLink}</a></p>`
      : '';
    const text = `Hi ${input.name},\n\nWelcome to EE PostMind!\n\nSet your password to access your new account:\n${input.setPasswordLink}\n\nLogin: ${input.loginLink}${verifyLine}\n\nIf you did not request this, you can ignore this email.`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
        <p>Hi ${input.name},</p>
        <p>Welcome to <strong>EE PostMind</strong>! Your account has been created.</p>
        <p>
          <a href="${input.setPasswordLink}" style="display:inline-block;background:#2563EB;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
            Set Password
          </a>
        </p>
        <p>If the button does not work, use this link:</p>
        <p><a href="${input.setPasswordLink}">${input.setPasswordLink}</a></p>
        ${verifyHtml}
        <p style="margin-top:12px">After setting your password, you can sign in here: <a href="${input.loginLink}">${input.loginLink}</a></p>
      </div>
    `;

    await this.sendEmail({ to: input.email, subject, text, html });
  }

  async sendWorkspaceInviteEmail(input: {
    email: string;
    workspaceName: string;
    inviterName: string;
    role: string;
    acceptLink: string;
    declineLink: string;
  }): Promise<void> {
    const subject = `${input.inviterName} invited you to ${input.workspaceName} on EE PostMind`;
    const text = `You've been invited to join ${input.workspaceName} as ${input.role}.

Accept invite: ${input.acceptLink}
Decline invite: ${input.declineLink}
`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
        <p>You've been invited to join <strong>${input.workspaceName}</strong> as <strong>${input.role}</strong>.</p>
        <p>Invited by: ${input.inviterName}</p>
        <p>
          <a href="${input.acceptLink}" style="display:inline-block;background:#2563EB;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;margin-right:8px">
            Accept Invitation
          </a>
          <a href="${input.declineLink}" style="display:inline-block;background:#E5E7EB;color:#111827;padding:10px 16px;border-radius:8px;text-decoration:none">
            Decline
          </a>
        </p>
      </div>
    `;

    await this.sendEmail({
      to: input.email,
      subject,
      text,
      html,
    });
  }

  async sendPaymentFailedEmail(input: {
    email: string;
    name: string;
    workspaceName: string;
    nextRetryAt: Date | null;
    billingLink: string;
  }) {
    const retryMessage = input.nextRetryAt
      ? `Stripe will automatically retry this payment on ${input.nextRetryAt.toLocaleString()}.`
      : 'Please update your payment method as soon as possible to avoid service interruption.';
    const subject = `Payment issue for ${input.workspaceName}`;
    const text = `Hi ${input.name},

We couldn't process your latest subscription payment for ${input.workspaceName}.
${retryMessage}

Update your billing details: ${input.billingLink}`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
        <p>Hi ${input.name},</p>
        <p>We couldn't process your latest subscription payment for <strong>${input.workspaceName}</strong>.</p>
        <p>${retryMessage}</p>
        <p>
          <a href="${input.billingLink}" style="display:inline-block;background:#DC2626;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
            Update Billing Method
          </a>
        </p>
      </div>
    `;

    await this.sendEmail({
      to: input.email,
      subject,
      text,
      html,
    });
  }

  async sendPaymentRecoveredEmail(input: {
    email: string;
    name: string;
    workspaceName: string;
    paidAt: Date | null;
    billingLink: string;
  }) {
    const paidMessage = input.paidAt
      ? `Your payment was successfully processed on ${input.paidAt.toLocaleString()}.`
      : 'Your payment was successfully processed.';
    const subject = `Payment restored for ${input.workspaceName}`;
    const text = `Hi ${input.name},

Good news — your subscription payment for ${input.workspaceName} was successful.
${paidMessage}

Manage billing: ${input.billingLink}`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
        <p>Hi ${input.name},</p>
        <p>Good news — your subscription payment for <strong>${input.workspaceName}</strong> was successful.</p>
        <p>${paidMessage}</p>
        <p>
          <a href="${input.billingLink}" style="display:inline-block;background:#059669;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
            Manage Billing
          </a>
        </p>
      </div>
    `;

    await this.sendEmail({
      to: input.email,
      subject,
      text,
      html,
    });
  }

  async sendSubscriptionCanceledEmail(input: {
    email: string;
    name: string;
    workspaceName: string;
    billingLink: string;
  }) {
    const subject = `Subscription canceled for ${input.workspaceName}`;
    const text = `Hi ${input.name},

Your paid subscription for ${input.workspaceName} has been canceled, and your workspace was moved to the Free plan.

You can reactivate anytime from billing settings: ${input.billingLink}`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
        <p>Hi ${input.name},</p>
        <p>Your paid subscription for <strong>${input.workspaceName}</strong> has been canceled, and your workspace was moved to the <strong>Free</strong> plan.</p>
        <p>
          <a href="${input.billingLink}" style="display:inline-block;background:#2563EB;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
            Reactivate Plan
          </a>
        </p>
      </div>
    `;

    await this.sendEmail({
      to: input.email,
      subject,
      text,
      html,
    });
  }

  async sendPostPublishedEmail(input: {
    email: string;
    name: string;
    authorName: string;
    contentPreview: string;
    publishedAt: Date;
    link: string;
  }) {
    const publishedAt = input.publishedAt.toLocaleString();
    const subject = 'Post published successfully';
    const text = `Hi ${input.name},

Your workspace post from ${input.authorName} was published successfully.
Published at: ${publishedAt}
Preview: "${input.contentPreview}"

View analytics: ${input.link}`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
        <p>Hi ${input.name},</p>
        <p>Your workspace post from <strong>${input.authorName}</strong> was published successfully.</p>
        <p><strong>Published at:</strong> ${publishedAt}</p>
        <p><strong>Preview:</strong> "${input.contentPreview}"</p>
        <p>
          <a href="${input.link}" style="display:inline-block;background:#2563EB;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
            View Analytics
          </a>
        </p>
      </div>
    `;

    await this.sendEmail({
      to: input.email,
      subject,
      text,
      html,
    });
  }

  async sendPostFailedEmail(input: {
    email: string;
    name: string;
    authorName: string;
    contentPreview: string;
    reason: string;
    link: string;
  }) {
    const subject = 'Post publishing failed';
    const text = `Hi ${input.name},

A post from ${input.authorName} failed to publish.
Reason: ${input.reason}
Preview: "${input.contentPreview}"

Review and retry: ${input.link}`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
        <p>Hi ${input.name},</p>
        <p>A post from <strong>${input.authorName}</strong> failed to publish.</p>
        <p><strong>Reason:</strong> ${input.reason}</p>
        <p><strong>Preview:</strong> "${input.contentPreview}"</p>
        <p>
          <a href="${input.link}" style="display:inline-block;background:#DC2626;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
            Review Post
          </a>
        </p>
      </div>
    `;

    await this.sendEmail({
      to: input.email,
      subject,
      text,
      html,
    });
  }

  async sendUpcomingScheduledPostEmail(input: {
    email: string;
    name: string;
    authorName: string;
    contentPreview: string;
    scheduledAt: Date;
    minutesUntil: number;
    leadMinutes: number;
    link: string;
  }) {
    const scheduledAt = input.scheduledAt.toLocaleString();
    const subject = `Upcoming scheduled post in about ${input.minutesUntil} minutes`;
    const text = `Hi ${input.name},

A scheduled post from ${input.authorName} is coming up soon.
Scheduled at: ${scheduledAt}
Preview: "${input.contentPreview}"

Open calendar: ${input.link}`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
        <p>Hi ${input.name},</p>
        <p>A scheduled post from <strong>${input.authorName}</strong> is coming up soon.</p>
        <p><strong>Scheduled at:</strong> ${scheduledAt}</p>
        <p><strong>Preview:</strong> "${input.contentPreview}"</p>
        <p><strong>Reminder window:</strong> ${input.leadMinutes} minutes before publish</p>
        <p>
          <a href="${input.link}" style="display:inline-block;background:#2563EB;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
            Open Calendar
          </a>
        </p>
      </div>
    `;

    await this.sendEmail({
      to: input.email,
      subject,
      text,
      html,
    });
  }

  async sendAnalyticsDigestEmail(input: {
    email: string;
    name: string;
    workspaceName: string;
    period: 'weekly' | 'monthly';
    days: number;
    totalPosts: number;
    publishedPosts: number;
    engagementRate: number;
    impressions: number;
    clicks: number;
    topPlatforms: string;
    topPosts: string[];
    link: string;
  }) {
    const periodLabel = input.period === 'weekly' ? 'Weekly' : 'Monthly';
    const topPostsText = input.topPosts.length > 0
      ? input.topPosts.map((entry) => `- ${entry}`).join('\n')
      : '- No top posts yet';
    const topPostsHtml = input.topPosts.length > 0
      ? input.topPosts.map((entry) => `<li>${entry}</li>`).join('')
      : '<li>No top posts yet</li>';
    const subject = `${periodLabel} analytics digest for ${input.workspaceName}`;
    const text = `Hi ${input.name},

Here is your ${periodLabel.toLowerCase()} analytics digest for ${input.workspaceName} (${input.days} days):

Total posts: ${input.totalPosts}
Published posts: ${input.publishedPosts}
Engagement rate: ${input.engagementRate.toFixed(2)}%
Impressions: ${input.impressions.toLocaleString()}
Clicks: ${input.clicks.toLocaleString()}
Top platforms: ${input.topPlatforms}

Top posts:
${topPostsText}

View full analytics: ${input.link}`;
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
        <p>Hi ${input.name},</p>
        <p>Here is your <strong>${periodLabel.toLowerCase()}</strong> analytics digest for <strong>${input.workspaceName}</strong> (${input.days} days).</p>
        <ul style="padding-left:18px;margin:12px 0">
          <li><strong>Total posts:</strong> ${input.totalPosts}</li>
          <li><strong>Published posts:</strong> ${input.publishedPosts}</li>
          <li><strong>Engagement rate:</strong> ${input.engagementRate.toFixed(2)}%</li>
          <li><strong>Impressions:</strong> ${input.impressions.toLocaleString()}</li>
          <li><strong>Clicks:</strong> ${input.clicks.toLocaleString()}</li>
          <li><strong>Top platforms:</strong> ${input.topPlatforms}</li>
        </ul>
        <p><strong>Top posts:</strong></p>
        <ul style="padding-left:18px;margin:8px 0">${topPostsHtml}</ul>
        <p>
          <a href="${input.link}" style="display:inline-block;background:#2563EB;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
            View Full Analytics
          </a>
        </p>
      </div>
    `;

    await this.sendEmail({
      to: input.email,
      subject,
      text,
      html,
    });
  }
}

export const emailService = new EmailService();
