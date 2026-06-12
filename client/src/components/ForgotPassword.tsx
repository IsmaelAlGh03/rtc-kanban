import { useState } from 'react';
import { API } from '../api';

const pageCls = 'flex flex-col items-center justify-center min-h-screen gap-6 bg-[#0d0f1a] px-4';
const cardCls = 'bg-[#1a1d30] border border-white/[0.07] rounded-2xl shadow-xl w-full max-w-sm p-8 flex flex-col gap-5';
const inputCls = 'border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-white/[0.06] text-slate-100 placeholder-white/25 w-full';
const labelCls = 'text-xs font-semibold text-white/35 uppercase tracking-wide';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message ?? 'If that email exists, a reset link has been sent.');
        setEmail('');
      } else {
        setError(data.error ?? 'Something went wrong.');
      }
    } catch {
      setError('Could not connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={pageCls}>
      <h1 className="text-4xl font-bold text-slate-100">Kayro</h1>
      <div className={cardCls}>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Reset your password</h2>
          <p className="text-sm text-white/40 mt-1">Enter your email and we'll send you a reset link.</p>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Email</label>
            <input
              autoFocus
              type="email"
              autoComplete="email"
              className={inputCls}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-1"
          >
            {loading ? '…' : 'Send reset link'}
          </button>
        </form>

        <a href="/" className="text-sm text-rose-400 hover:underline text-center">Back to login</a>
      </div>
    </div>
  );
}
