"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { WaveformIcon, ChevronLeftIcon } from "@/components/icons";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const sendOtp = async () => {
    setLoading(true);
    setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });
      if (authError) throw authError;
      setOtpSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    setError("");
    try {
      const { error: authError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });
      if (authError) throw authError;
      router.push("/vault");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-surface-dim">
      <div className="w-full max-w-md">
        <div className="surface-card-elevated p-8">
          {otpSent && (
            <button
              onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}
              className="touch-target -ml-2 mb-2 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <ChevronLeftIcon size={20} />
            </button>
          )}

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <WaveformIcon size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-on-surface">
                {otpSent ? "Enter your code" : "Welcome back"}
              </h1>
              <p className="text-xs text-on-surface-variant">
                {otpSent
                  ? `We sent a code to ${email}`
                  : "Sign in or create an account"}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-error-container/30 text-error text-sm">
              {error}
            </div>
          )}

          {!otpSent ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-on-surface-variant mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field"
                  onKeyDown={(e) => e.key === "Enter" && email && sendOtp()}
                  autoFocus
                />
              </div>
              <button
                onClick={sendOtp}
                disabled={!email || loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? "Sending..." : "Continue with email"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-on-surface-variant mb-1.5">
                  Verification code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="input-field text-center text-xl tracking-[0.3em] font-mono"
                  maxLength={6}
                  onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && verifyOtp()}
                  autoFocus
                />
              </div>
              <button
                onClick={verifyOtp}
                disabled={otp.length !== 6 || loading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & sign in"}
              </button>
              <button
                onClick={() => { setOtpSent(false); setOtp(""); }}
                className="btn-text w-full text-xs"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
