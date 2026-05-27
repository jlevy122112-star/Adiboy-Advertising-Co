import { Resend } from "resend";

function getClient() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.EMAIL_FROM?.trim() ?? "Marketer Pro <noreply@marketerpro.com>";

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
  const client = getClient();
  if (!client) {
    console.warn(JSON.stringify({ level: "warn", event: "resend_not_configured", hint: "Set RESEND_API_KEY to enable email." }));
    return false;
  }
  const { error } = await client.emails.send({
    from: FROM,
    to: email,
    subject: "Reset your Marketer Pro password",
    text: `Click the link below to reset your password. It expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Reset your password</h2>
        <p style="font-size:14px;color:#475569;margin:0 0 24px">Click the button below. The link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:white;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">Reset password</a>
        <p style="font-size:12px;color:#94a3b8;margin:24px 0 0">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
  if (error) {
    console.error(JSON.stringify({ level: "error", event: "resend_send_failed", message: error.message }));
    return false;
  }
  return true;
}

export async function sendEmailVerification(email: string, verifyUrl: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const { error } = await client.emails.send({
    from: FROM,
    to: email,
    subject: "Verify your Marketer Pro email",
    text: `Verify your email address by clicking the link below. It expires in 24 hours.\n\n${verifyUrl}\n\nIf you didn't sign up, ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px">Verify your email</h2>
        <p style="font-size:14px;color:#475569;margin:0 0 24px">One click and you're in. Link expires in 24 hours.</p>
        <a href="${verifyUrl}" style="display:inline-block;background:#6366f1;color:white;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">Verify email</a>
        <p style="font-size:12px;color:#94a3b8;margin:24px 0 0">If you didn't create an account, ignore this email.</p>
      </div>
    `,
  });
  if (error) {
    console.error(JSON.stringify({ level: "error", event: "resend_verify_send_failed", message: error.message }));
    return false;
  }
  return true;
}
