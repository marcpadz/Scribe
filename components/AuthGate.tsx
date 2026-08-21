import React, { useState } from 'react';
import { createAuthClient } from 'better-auth/react';
import { Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

/**
 * Premium-style auth gate (glass-morphism, animated bg, validation, error/success).
 * Implements the standard sign-up flow: sign up -> email verification required
 * before the account can be used. Built in the spirit of the 21st.dev premium-auth
 * component (raw source not fetched from registry).
 */
const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL || 'http://localhost:8787',
});

type Mode = 'signin' | 'signup' | 'verify';

// Google OAuth is deferred until the app is registered with Google. When ready,
// flip this to true and uncomment the social provider in worker/src/auth.ts.
const GOOGLE_OAUTH_ENABLED = false;

const AuthGate: React.FC<{ onAuthed: () => void }> = ({ onAuthed }) => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const validate = (): string | null => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Enter a valid email address.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const v = validate();
    if (v) { setError(v); return; }
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await authClient.signUp.email({ email, password, name: email.split('@')[0] });
        if (error) throw new Error(error.message);
        setSuccess('Account created! Check your email to verify before signing in.');
        setMode('verify');
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message);
        setSuccess('Signed in!');
        onAuthed();
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      // No-op until Google OAuth creds are configured server-side.
      await authClient.signIn.social({ provider: 'google', callbackURL: window.location.origin });
    } catch (err: any) {
      setError(err?.message || 'Google sign-in not configured yet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-[#0b0f19] via-[#121a2e] to-[#0b0f19] text-white">
      {/* animated orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-[#4ECDC4] opacity-20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-[#FFE900] opacity-10 rounded-full blur-3xl animate-pulse" />

      <div className="relative z-10 w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black uppercase tracking-tighter">
              Neo<span className="text-[#FFE900]">Scriber</span>
            </h1>
            <p className="text-sm text-white/60 mt-1">
              {mode === 'signup' ? 'Create your account' : mode === 'verify' ? 'Verify your email' : 'Welcome back'}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              <XCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
            </div>
          )}

          {mode !== 'verify' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#FFE900] outline-none"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (8+ chars)"
                  className="w-full pl-10 pr-10 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#FFE900] outline-none"
                  required
                />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-[#FFE900] text-black font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {mode === 'signup' ? 'Sign Up' : 'Sign In'}
              </button>
            </form>
          ) : (
            <p className="text-center text-white/70 text-sm py-4">
              We sent a verification link to <b>{email}</b>. Click it to activate your account, then sign in.
            </p>
          )}

          {mode !== 'verify' && GOOGLE_OAUTH_ENABLED && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs uppercase text-white/40">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full py-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center gap-2 font-medium disabled:opacity-60"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="" />
                Continue with Google
              </button>
            </>
          )}

          {mode !== 'verify' && (
            <p className="text-center text-sm text-white/60 mt-6">
              {mode === 'signin' ? (
                <>New here? <button onClick={() => { setMode('signup'); setError(null); }} className="text-[#FFE900] font-semibold">Create an account</button></>
              ) : (
                <>Have an account? <button onClick={() => { setMode('signin'); setError(null); }} className="text-[#FFE900] font-semibold">Sign in</button></>
              )}
            </p>
          )}

          <p className="text-[10px] text-center text-white/40 mt-6 leading-tight">
            Free accounts can transcribe up to 2 minutes. Verify your email to unlock full features.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthGate;
