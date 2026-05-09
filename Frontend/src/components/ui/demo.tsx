'use client';

import { useEffect, useState } from 'react';
import { SplineScene } from '@/components/ui/splite';
import { Spotlight } from '@/components/ui/spotlight';
import { useLanguage } from '@/contexts/LanguageContext';
import { registerLocalAccount, loginLocalAccount } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, UserRound, ArrowLeft } from 'lucide-react';

interface SplineSceneBasicProps {
  onSignIn?: () => void;
}

export function SplineSceneBasic({ onSignIn }: SplineSceneBasicProps) {
  const { t } = useLanguage();
  const { user, login } = useAuth();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // OTP flow states
  const [step, setStep] = useState<'email' | 'otp' | 'password'>('email');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpResendCountdown, setOtpResendCountdown] = useState(0);

  useEffect(() => {
    if (user) {
      setMode('register');
    }
  }, [user]);

  // Handle OTP resend countdown
  useEffect(() => {
    if (otpResendCountdown > 0) {
      const timer = setTimeout(() => setOtpResendCountdown(otpResendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpResendCountdown]);

  async function handleSendOTP() {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/login/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to send OTP');
      }

      setOtpSent(true);
      setOtpResendCountdown(60);
      setStep('otp');
    } catch (err: any) {
      setError(err?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/login/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          otp_code: otp.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Invalid OTP');
      }

      setOtpVerified(true);
      setStep('password');
    } catch (err: any) {
      setError(err?.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleLocalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const payload: { email: string; password: string; name?: string; otp_code?: string } = {
      email: form.email.trim(),
      password: form.password,
    };

    if (mode === 'register') {
      payload.name = form.name.trim();
      if (otpVerified) {
        payload.otp_code = otp; // Include OTP code for registration
      }
    }

    try {
      const response = mode === 'register'
        ? await registerLocalAccount(payload)
        : await loginLocalAccount(payload);
      login(response.data.access_token);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Unable to complete email sign in.');
    } finally {
      setLoading(false);
    }
  }

  const handleReset = () => {
    setStep('email');
    setOtpSent(false);
    setOtpVerified(false);
    setOtp('');
    setError('');
    setForm({ name: '', email: '', password: '' });
  };

  return (
    <section className="relative w-screen min-h-screen bg-black overflow-hidden">
      <Spotlight
        className="-top-40 -left-20 md:left-40 md:-top-20"
        fill="white"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/35 z-[2]" />

      <div className="relative z-10 min-h-screen grid grid-cols-1 md:grid-cols-2">
        <div className="p-8 md:p-14 lg:p-20 flex flex-col justify-center">
          <h1 className="mt-3 text-4xl md:text-5xl lg:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
            SQUEE LEARN
          </h1>
          <p className="mt-5 text-neutral-300 max-w-xl text-base md:text-lg leading-relaxed">
            {t('signInTagline')}
          </p>

          {mode === 'login' ? (
            <>
              <button
                type="button"
                onClick={onSignIn}
                className="mt-8 w-fit rounded-xl bg-white text-black px-6 py-3 font-semibold hover:bg-neutral-200 transition inline-flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path fill="#EA4335" d="M24 9.5c3.2 0 6.1 1.1 8.4 3.2l6.3-6.3C34.8 2.9 29.7 1 24 1 14.7 1 6.6 6.4 2.7 14.3l7.4 5.7C12.1 14 17.6 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.5 24.6c0-1.6-.1-2.8-.4-4.1H24v8h12.8c-.3 2-1.8 5-5.2 7.1l8 6.2c4.8-4.4 7.6-10.9 7.6-17.2z"/>
                  <path fill="#FBBC05" d="M10.1 28.7c-.6-1.8-.9-3.7-.9-5.7s.3-3.9.9-5.7l-7.4-5.7C1 15.2 0 19 0 23s1 7.8 2.7 11.4l7.4-5.7z"/>
                  <path fill="#34A853" d="M24 47c6.5 0 11.9-2.1 15.9-5.8l-8-6.2c-2.1 1.4-4.9 2.4-7.9 2.4-6.4 0-11.9-4.5-13.9-10.6l-7.4 5.7C6.6 40.6 14.7 47 24 47z"/>
                </svg>
                {t('signInButton')}
              </button>

              <div className="mt-3 flex items-center gap-3">
                <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                  <button
                    type="button"
                    onClick={() => { setMode('register'); handleReset(); }}
                    className="rounded-lg px-4 py-2 text-sm font-semibold transition text-neutral-300 hover:bg-white/10"
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-4 py-2 text-sm font-semibold transition bg-white text-black"
                  >
                    Sign in
                  </button>
                </div>

                <div className="group relative">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-bold text-neutral-200 hover:bg-white/10"
                    aria-label="Local account disclaimer"
                  >
                    ?
                  </button>
                  <div className="pointer-events-none absolute left-1/2 top-12 z-20 w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-black/90 px-4 py-3 text-left text-xs leading-relaxed text-neutral-200 opacity-0 shadow-2xl transition group-hover:opacity-100 group-focus-within:opacity-100">
                    Local accounts are stored in the database, but they do not get Google Classroom sync or classroom benefits. They can still use uploaded documents and the study tools.
                  </div>
                </div>
              </div>

              <form onSubmit={handleLocalSubmit} className="mt-5 max-w-xl space-y-3">
                <label className="relative block">
                  <span className="sr-only">Email</span>
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                    placeholder="Email"
                    className="w-full rounded-xl border border-white/10 bg-black/60 px-10 py-3 text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/30"
                    required
                  />
                </label>

                <label className="relative block">
                  <span className="sr-only">Password</span>
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                    placeholder="Password"
                    className="w-full rounded-xl border border-white/10 bg-black/60 px-10 py-3 text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/30"
                    required
                  />
                </label>

                {error && <p className="text-sm text-rose-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-fit rounded-xl bg-white text-black px-6 py-3 font-semibold hover:bg-neutral-200 transition disabled:opacity-70"
                >
                  {loading ? 'Please wait...' : 'Sign in with email'}
                </button>
              </form>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onSignIn}
                className="mt-8 w-fit rounded-xl bg-white text-black px-6 py-3 font-semibold hover:bg-neutral-200 transition inline-flex items-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path fill="#EA4335" d="M24 9.5c3.2 0 6.1 1.1 8.4 3.2l6.3-6.3C34.8 2.9 29.7 1 24 1 14.7 1 6.6 6.4 2.7 14.3l7.4 5.7C12.1 14 17.6 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.5 24.6c0-1.6-.1-2.8-.4-4.1H24v8h12.8c-.3 2-1.8 5-5.2 7.1l8 6.2c4.8-4.4 7.6-10.9 7.6-17.2z"/>
                  <path fill="#FBBC05" d="M10.1 28.7c-.6-1.8-.9-3.7-.9-5.7s.3-3.9.9-5.7l-7.4-5.7C1 15.2 0 19 0 23s1 7.8 2.7 11.4l7.4-5.7z"/>
                  <path fill="#34A853" d="M24 47c6.5 0 11.9-2.1 15.9-5.8l-8-6.2c-2.1 1.4-4.9 2.4-7.9 2.4-6.4 0-11.9-4.5-13.9-10.6l-7.4 5.7C6.6 40.6 14.7 47 24 47z"/>
                </svg>
                {t('signInButton')}
              </button>

              <div className="mt-3 flex items-center gap-3">
                <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                  <button
                    type="button"
                    className="rounded-lg px-4 py-2 text-sm font-semibold transition bg-white text-black"
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); handleReset(); }}
                    className="rounded-lg px-4 py-2 text-sm font-semibold transition text-neutral-300 hover:bg-white/10"
                  >
                    Sign in
                  </button>
                </div>

                <div className="group relative">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-bold text-neutral-200 hover:bg-white/10"
                    aria-label="Local account disclaimer"
                  >
                    ?
                  </button>
                  <div className="pointer-events-none absolute left-1/2 top-12 z-20 w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-black/90 px-4 py-3 text-left text-xs leading-relaxed text-neutral-200 opacity-0 shadow-2xl transition group-hover:opacity-100 group-focus-within:opacity-100">
                    Local accounts are stored in the database, but they do not get Google Classroom sync or classroom benefits. They can still use uploaded documents and the study tools.
                  </div>
                </div>
              </div>

              {/* Registration Flow - Email Step */}
              {step === 'email' && !otpVerified && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendOTP();
                  }}
                  className="mt-5 max-w-xl space-y-3"
                >
                  <label className="relative block">
                    <span className="sr-only">Email</span>
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                      placeholder="Your email address"
                      className="w-full rounded-xl border border-white/10 bg-black/60 px-10 py-3 text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/30"
                      required
                      disabled={otpSent && !otpVerified}
                    />
                  </label>

                  {error && <p className="text-sm text-rose-400">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading || (otpSent && !otpVerified)}
                    className="w-fit rounded-xl bg-white text-black px-6 py-3 font-semibold hover:bg-neutral-200 transition disabled:opacity-70"
                  >
                    {loading ? 'Sending...' : otpSent ? 'OTP Sent' : 'Send OTP'}
                  </button>
                </form>
              )}

              {/* Registration Flow - OTP Step */}
              {step === 'otp' && !otpVerified && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleVerifyOTP();
                  }}
                  className="mt-5 max-w-xl space-y-3"
                >
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-neutral-300">
                    We sent a verification code to {form.email}
                  </div>

                  <label className="relative block">
                    <span className="sr-only">OTP Code</span>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-center text-2xl tracking-widest font-mono text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/30"
                      required
                      autoFocus
                    />
                  </label>

                  {error && <p className="text-sm text-rose-400">{error}</p>}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="rounded-xl bg-white text-black px-6 py-3 font-semibold hover:bg-neutral-200 transition disabled:opacity-70"
                    >
                      {loading ? 'Verifying...' : 'Verify OTP'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={loading || otpResendCountdown > 0}
                      className="rounded-xl border border-white/20 text-white px-4 py-3 font-semibold hover:bg-white/10 transition disabled:opacity-50"
                    >
                      {otpResendCountdown > 0 ? `Resend in ${otpResendCountdown}s` : 'Resend'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200 transition"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                </form>
              )}

              {/* Registration Flow - Password Step (after OTP verified) */}
              {step === 'password' && otpVerified && (
                <form onSubmit={handleLocalSubmit} className="mt-5 max-w-xl space-y-3">
                  <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-300">
                    ✓ Email verified
                  </div>

                  <label className="relative block">
                    <span className="sr-only">Name</span>
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      autoComplete="name"
                      value={form.name}
                      onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                      placeholder="Your name"
                      className="w-full rounded-xl border border-white/10 bg-black/60 px-10 py-3 text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/30"
                      required
                    />
                  </label>

                  <label className="relative block">
                    <span className="sr-only">Password</span>
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                      placeholder="Password"
                      className="w-full rounded-xl border border-white/10 bg-black/60 px-10 py-3 text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/30"
                      required
                    />
                  </label>

                  {error && <p className="text-sm text-rose-400">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-fit rounded-xl bg-white text-black px-6 py-3 font-semibold hover:bg-neutral-200 transition disabled:opacity-70"
                  >
                    {loading ? 'Creating account...' : 'Create account'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <div className="relative min-h-[45vh] md:min-h-screen">
          <SplineScene
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
        </div>
      </div>
    </section>
  );
}
