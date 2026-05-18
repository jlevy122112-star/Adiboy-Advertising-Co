import { createTransport } from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  return createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
  const transport = getTransport();
  const from = process.env.SMTP_FROM?.trim() ?? "noreply@marketer.pro";

  if (!transport) {
    console.warn(JSON.stringify({ level: "warn", event: "smtp_not_configured", hint: "Set SMTP_HOST, SMTP_USER, SMTP_PASS to send password reset emails." }));
    return false;
  }

  try {
    await transport.sendMail({
      from,
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
    return true;
  } catch (err) {
    console.error(JSON.stringify({ level: "error", event: "smtp_send_failed", message: err instanceof Error ? err.message : String(err) }));
    return false;
  }
}
