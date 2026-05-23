import { useState } from 'react';

const API = 'http://localhost:4000/api';

interface Props {
  token: string;
}

export default function VerificationBanner({ token }: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function resend() {
    setStatus('sending');
    try {
      const res = await fetch(`${API}/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-4 text-sm">
      <p className="text-amber-300">
        <strong>Verify your email</strong> — check your inbox for a confirmation link.
      </p>
      <div className="shrink-0">
        {status === 'idle' && (
          <button onClick={resend} className="text-amber-400 underline hover:text-amber-200 font-medium">
            Resend email
          </button>
        )}
        {status === 'sending' && <span className="text-amber-400/60">Sending…</span>}
        {status === 'sent' && <span className="text-emerald-400 font-medium">Sent!</span>}
        {status === 'error' && (
          <button onClick={resend} className="text-rose-400 underline hover:text-rose-300 font-medium">
            Failed — try again
          </button>
        )}
      </div>
    </div>
  );
}
