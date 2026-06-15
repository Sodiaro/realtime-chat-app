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

export async function sendOtpEmail(to: string, otp: string) {
  const subject = "Your DevChat verification code";
  const text = `Your verification code is ${otp}. It expires in 10 minutes.`;

  if (!transport) {
    // no SMTP configured — surface the code so dev/demo can still verify
    logger.info({ to, otp }, "📧 [DEV] OTP email (no SMTP configured)");
    return;
  }

  try {
    await transport.sendMail({ from: env.EMAIL_FROM, to, subject, text });
    logger.info({ to }, "OTP email sent");
  } catch (err) {
    // never fail the request on email errors — log the code as a fallback
    logger.error(
      { to, otp, err: (err as Error).message },
      "📧 OTP email send failed — code logged as fallback"
    );
  }
}
