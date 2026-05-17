'use client';

import { useEffect, useRef, useState } from 'react';
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
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const [pupilL, setPupilL] = useState({ x: 49.5, y: 55 });
  const [pupilR, setPupilR] = useState({ x: 70.5, y: 55 });

  const EYE_L = { cx: 49.5, cy: 55 };
  const EYE_R = { cx: 70.5, cy: 55 };
  const MAX_PUPIL = 1.8;

  useEffect(() => {
    if (user) {
      setMode('register');
    }
  }, [user]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const avatar = avatarRef.current;
      if (!avatar) return;

      const rect = avatar.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const scaleX = 120 / rect.width;
      const scaleY = 130 / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const movePupil = (eye: { cx: number; cy: number }) => {
        const dx = mx - eye.cx;
        const dy = my - eye.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clamp = Math.min(dist, MAX_PUPIL) / (dist || 1);
        return {
          x: eye.cx + dx * clamp,
          y: eye.cy + dy * clamp,
        };
      };

      setPupilL(movePupil(EYE_L));
      setPupilR(movePupil(EYE_R));
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Handle OTP resend countdown
  useEffect(() => {
    if (otpResendCountdown > 0) {
      const timer = setTimeout(() => setOtpResendCountdown(otpResendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpResendCountdown]);

  const isValidEmail = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  };

  async function handleSendOTP() {
    setError('');
    setLoading(true);

    if (!isValidEmail(form.email)) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

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
                    Local accounts are stored in the database, but they do not get Google Classroom sync or classroom benefits. They can still use manual PDF uploads inside the study tools.
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
                    Local accounts are stored in the database, but they do not get Google Classroom sync or classroom benefits. They can still use manual PDF uploads inside the study tools.
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
                    disabled={loading || (otpSent && !otpVerified) || !isValidEmail(form.email)}
                    className="w-fit rounded-xl bg-white text-black px-6 py-3 font-semibold hover:bg-neutral-200 transition disabled:opacity-70"
                  >
                    {loading ? 'Sending...' : otpSent ? 'OTP Sent' : 'Verify email'}
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

        <div className="relative min-h-[45vh] md:min-h-screen flex items-center justify-center p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/10" />
          <div ref={avatarRef} className="relative z-10 h-[260px] w-[240px] md:h-[320px] md:w-[300px]">
            <svg viewBox="0 0 120 130" className="h-full w-full" aria-label="Scholar avatar">
              <g id="body">
                <path d="M30 90 Q35 78 60 74 Q85 78 90 90 L95 130 L25 130 Z" fill="#1c1c3a" />
                <path d="M48 78 Q60 83 72 78 L70 88 Q60 84 50 88 Z" fill="#c0392b" />
                <rect x="52" y="65" width="16" height="14" rx="4" fill="#f4c89a" />
                <ellipse cx="60" cy="54" rx="22" ry="22" fill="#f4c89a" />
                <ellipse cx="38" cy="54" rx="4" ry="5" fill="#f0b987" />
                <ellipse cx="82" cy="54" rx="4" ry="5" fill="#f0b987" />
                <path d="M38 45 Q40 30 60 28 Q80 30 82 45 Q75 35 60 34 Q45 35 38 45Z" fill="#3d2b1f" />
                <rect x="43" y="50" width="13" height="10" rx="5" fill="none" stroke="#5a3e2b" strokeWidth="1.5" />
                <rect x="64" y="50" width="13" height="10" rx="5" fill="none" stroke="#5a3e2b" strokeWidth="1.5" />
                <line x1="56" y1="55" x2="64" y2="55" stroke="#5a3e2b" strokeWidth="1.2" />
                <line x1="39" y1="55" x2="43" y2="55" stroke="#5a3e2b" strokeWidth="1.2" />
                <line x1="77" y1="55" x2="82" y2="55" stroke="#5a3e2b" strokeWidth="1.2" />

                <g>
                  <ellipse cx="49.5" cy="55" rx="4.5" ry="4" fill="white" />
                  <circle cx={pupilL.x} cy={pupilL.y} r="2.2" fill="#1a1a2e" />
                  <circle cx={pupilL.x + 1.3} cy={pupilL.y - 1.2} r="0.7" fill="white" />
                </g>
                <g>
                  <ellipse cx="70.5" cy="55" rx="4.5" ry="4" fill="white" />
                  <circle cx={pupilR.x} cy={pupilR.y} r="2.2" fill="#1a1a2e" />
                  <circle cx={pupilR.x + 1.3} cy={pupilR.y - 1.2} r="0.7" fill="white" />
                </g>

                <path d="M54 64 Q60 69 66 64" fill="none" stroke="#c07a50" strokeWidth="1.5" strokeLinecap="round" />
                <g>
                  <ellipse cx="60" cy="34" rx="25" ry="5" fill="#1c1c3a" />
                  <rect x="42" y="22" width="36" height="13" rx="2" fill="#1c1c3a" />
                </g>
                <line x1="76" y1="26" x2="82" y2="42" stroke="#f0c040" strokeWidth="1.5" />
                <rect x="79" y="42" width="6" height="8" rx="1" fill="#f0c040" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
