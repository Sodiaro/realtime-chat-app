import { config } from "dotenv";
import { z } from "zod";

config();

// Parse a boolean from an env string. NOTE: z.coerce.boolean() is unusable for env
// vars — it uses JS Boolean() semantics, so "false"/"0" (any non-empty string)
// become true. This accepts only explicit truthy tokens; anything else (including
// unset) resolves to the provided default.
const TRUTHY = new Set(["1", "true", "yes", "on"]);
const envBool = (def: boolean) =>
  z.preprocess(
    (v) => (typeof v === "string" ? TRUTHY.has(v.trim().toLowerCase()) : def),
    z.boolean()
  );

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5001),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:5173"), // comma-separated
  REDIS_URL: z.string().optional(), // set to enable multi-node scaling
  // optional SMTP for OTP emails; without it, OTPs are logged in dev
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("DevChat <no-reply@devchat.local>"),
  // optional Web Push (VAPID); without it, push is disabled
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:admin@devchat.local"),

  // ── Feature flags (Dev Mode rollout) ──────────────────────────────────────
  // Master kill-switch. When false, Dev Mode is off for everyone regardless of
  // the allowlist/rollout below.
  FEATURE_DEV_MODE: envBool(false),
  // CSV of userIds with always-on early access (bypasses the rollout percentage).
  DEV_MODE_ALLOWLIST: z.string().optional(),
  // Deterministic gradual rollout: 0–100 (% of users the flag is enabled for).
  DEV_MODE_ROLLOUT_PCT: z.coerce.number().min(0).max(100).default(0),
});

const rawEnv = {
  ...process.env,
  MONGODB_URI: process.env.MONGODB_URI || process.env.MONGODB_URL,
};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
