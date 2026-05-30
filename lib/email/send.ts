import { JobReadyEmail } from "@/emails/job-ready";
import { PurchaseConfirmationEmail } from "@/emails/purchase-confirmation";
import { WelcomeEmail } from "@/emails/welcome";
import { getResend } from "@/lib/email/client";

function canSendEmail() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

async function sendSafely(label: string, send: () => Promise<unknown>) {
  try {
    await send();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Email skipped (${label}): ${message}`);
  }
}

export async function sendWelcomeEmail(email: string, credits: number) {
  if (!canSendEmail()) return;
  await sendSafely("welcome", () =>
    getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject: "Welcome",
      react: WelcomeEmail({ credits })
    })
  );
}

export async function sendPurchaseConfirmationEmail(email: string, credits: number) {
  if (!canSendEmail()) return;
  await sendSafely("purchase confirmation", () =>
    getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject: "Credits added",
      react: PurchaseConfirmationEmail({ credits })
    })
  );
}

export async function sendJobReadyEmail(email: string, resultUrl: string) {
  if (!canSendEmail()) return;
  await sendSafely("job ready", () =>
    getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: email,
      subject: "Your AI job is ready",
      react: JobReadyEmail({ resultUrl })
    })
  );
}
