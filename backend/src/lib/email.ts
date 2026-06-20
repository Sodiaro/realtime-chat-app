import nodemailer from "nodemailer";
import { env } from "./env.js";
import { logger } from "./logger.js";

// real transport if SMTP is configured, otherwise we just log (dev/demo)
const transport =
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: (env.SMTP_PORT || 587) === 465,
        // app passwords are shown with spaces; strip them so paste-as-is works
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS.replace(/\s+/g, "") },
      })
    : null;

// a clean, branded HTML email with the code shown prominently (inline styles for
// broad email-client support)
function codeEmailHtml({
  heading,
  intro,
  code,
  expiry,
}: {
  heading: string;
  intro: string;
  code: string;
  expiry: string;
}) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e8ee;">
            <tr>
              <td style="background:#6366f1;background:linear-gradient(135deg,#6366f1,#7c3aed);padding:24px 28px;">
                <span style="color:#ffffff;font:700 18px ${font};letter-spacing:-0.2px;">💬 DevChat</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 4px;">
                <h1 style="margin:0 0 10px;font:600 22px ${font};color:#1a1d24;">${heading}</h1>
                <p style="margin:0;font:400 15px/1.6 ${font};color:#5b616e;">${intro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;border:1px solid #e6e8ee;border-radius:12px;">
                  <tr>
                    <td align="center" style="padding:22px 12px;">
                      <div style="font:600 11px ${font};text-transform:uppercase;letter-spacing:1.5px;color:#8a909c;margin-bottom:8px;">Your code</div>
                      <div style="font:700 34px 'Courier New',monospace;letter-spacing:10px;color:#6366f1;">${code}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px;">
                <p style="margin:0;font:400 13px/1.6 ${font};color:#8a909c;">
                  This code expires in <strong style="color:#5b616e;">${expiry}</strong>.
                  🔒 For your security, never share it with anyone. If you didn't request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;margin-top:8px;border-top:1px solid #eef0f3;background:#fafbfc;">
                <span style="font:400 12px ${font};color:#9aa0ac;">Sent by DevChat — please don't reply to this email.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// shared best-effort delivery — never throws, logs the code if SMTP is absent/fails
async function deliver(
  to: string,
  subject: string,
  body: { text: string; html: string; otp: string }
) {
  if (!transport) {
    // no SMTP configured — surface the code so dev/demo can still proceed
    logger.info({ to, otp: body.otp }, "📧 [DEV] email (no SMTP configured)");
    return;
  }
  try {
    await transport.sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      text: body.text,
      html: body.html,
    });
    logger.info({ to }, "email sent");
  } catch (err) {
    logger.error(
      { to, otp: body.otp, err: (err as Error).message },
      "📧 email send failed — code logged as fallback"
    );
  }
}

export async function sendOtpEmail(to: string, otp: string) {
  return deliver(to, "Your DevChat verification code", {
    text: `Your DevChat verification code is ${otp}. It expires in 10 minutes.`,
    html: codeEmailHtml({
      heading: "Verify your email",
      intro: "Enter this code to verify your DevChat account and get started.",
      code: otp,
      expiry: "10 minutes",
    }),
    otp,
  });
}

export async function sendResetEmail(to: string, otp: string) {
  return deliver(to, "Reset your DevChat password", {
    text: `Your DevChat password reset code is ${otp}. It expires in 15 minutes. If you didn't request this, you can ignore this email.`,
    html: codeEmailHtml({
      heading: "Reset your password",
      intro: "We received a request to reset your DevChat password. Enter this code to choose a new one.",
      code: otp,
      expiry: "15 minutes",
    }),
    otp,
  });
}
