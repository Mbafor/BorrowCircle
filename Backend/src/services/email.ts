import { isProduction, isTest } from '../config/env';

/**
 * Stubbed email sender. No real provider is wired up yet — this is the only
 * place that needs to change when one (e.g. Resend, SendGrid) is added.
 */
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  if (isTest) {
    return;
  }

  if (isProduction) {
    // Never log the raw reset link/token in production.
    // eslint-disable-next-line no-console
    console.warn(`Password reset requested for ${email}, but no email provider is configured.`);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[dev] Password reset link for ${email}: ${resetLink}`);
}
