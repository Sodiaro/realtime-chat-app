import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";

const OtpForm = ({ email }) => {
  const { verifyEmail, resendOtp } = useAuthStore();
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setVerifying(true);
    await verifyEmail(email, otp);
    setVerifying(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-base-content/70">
        Enter the 6-digit code we sent to <span className="font-medium">{email}</span>
      </p>
      <input
        className="input input-bordered w-full tracking-[0.5em] text-center text-lg"
        maxLength={6}
        inputMode="numeric"
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
        placeholder="------"
        autoFocus
      />
      <button type="submit" disabled={otp.length !== 6 || verifying} className="btn btn-primary w-full">
        {verifying ? "Verifying…" : "Verify email"}
      </button>
      <button type="button" onClick={() => resendOtp(email)} className="btn btn-ghost btn-sm w-full">
        Resend code
      </button>
    </form>
  );
};

export default OtpForm;
