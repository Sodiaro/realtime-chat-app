import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import AuthImagePattern from "../components/AuthImagePattern";
import { KeyRound, Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";

const ForgotPasswordPage = () => {
  const { forgotPassword, resetPassword } = useAuthStore();
  const navigate = useNavigate();

  const [step, setStep] = useState("request"); // "request" | "reset"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const requestCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const res = await forgotPassword(email.trim());
    setBusy(false);
    if (res) setStep("reset");
  };

  const doReset = async (e) => {
    e.preventDefault();
    if (!otp.trim() || newPassword.length < 6) return;
    setBusy(true);
    const ok = await resetPassword(email.trim(), otp.trim(), newPassword);
    setBusy(false);
    if (ok) navigate("/login");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex flex-col justify-center items-center p-6 sm:p-12 bg-base-200/30">
        <div className="w-full max-w-md">
          <div className="bg-base-100 border border-base-300/60 rounded-2xl shadow-card p-7 sm:p-8 space-y-7">
            <div className="text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="size-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <KeyRound className="size-6 text-primary" />
                </div>
                <h1 className="text-2xl font-bold mt-2 tracking-tight">Reset password</h1>
                <p className="text-base-content/60">
                  {step === "request"
                    ? "Enter your email or username and we'll send a reset code"
                    : "Enter the code we sent to your email"}
                </p>
              </div>
            </div>

            {step === "request" ? (
              <form onSubmit={requestCode} className="space-y-5">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Email or username</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="size-5 text-base-content/40" />
                    </div>
                    <input
                      type="text"
                      autoFocus
                      className="input input-bordered w-full pl-10"
                      placeholder="you@example.com or username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary w-full" disabled={busy || !email.trim()}>
                  {busy ? "Sending…" : "Send reset code"}
                </button>
              </form>
            ) : (
              <form onSubmit={doReset} className="space-y-5">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Reset code</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    className="input input-bordered w-full tracking-[0.4em] text-center font-semibold"
                    placeholder="------"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">New password</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="size-5 text-base-content/40" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="input input-bordered w-full pl-10"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? (
                        <EyeOff className="size-5 text-base-content/40" />
                      ) : (
                        <Eye className="size-5 text-base-content/40" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={busy || !otp.trim() || newPassword.length < 6}
                >
                  {busy ? "Resetting…" : "Reset password"}
                </button>

                <button
                  type="button"
                  onClick={() => setStep("request")}
                  className="btn btn-ghost btn-sm w-full"
                >
                  Use a different email
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-sm text-base-content/60 mt-6">
            <Link to="/login" className="link link-primary font-medium inline-flex items-center gap-1">
              <ArrowLeft className="size-4" /> Back to sign in
            </Link>
          </p>
        </div>
      </div>

      <AuthImagePattern
        title="Forgot your password?"
        subtitle="No worries — we'll help you get back into your account in a moment."
      />
    </div>
  );
};

export default ForgotPasswordPage;
