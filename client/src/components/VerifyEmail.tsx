import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const API = 'http://localhost:4000/api';

const pageCls = 'flex flex-col items-center justify-center min-h-screen gap-6 bg-[#0d0f1a] px-4';
const cardCls = 'bg-[#1a1d30] border border-white/[0.07] rounded-2xl shadow-xl w-full max-w-sm p-8 flex flex-col gap-5 items-center text-center';

interface Props {
  onVerified?: () => void;
}

export default function VerifyEmail({ onVerified }: Props) {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }
    fetch(`${API}/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async r => {
        const data = await r.json();
        if (r.ok) {
          setStatus('success');
          setMessage(data.message ?? 'Email verified!');
          onVerified?.();
        } else {
          setStatus('error');
          setMessage(data.error ?? 'Verification failed.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Could not connect to the server. Please try again.');
      });
  }, []);

  return (
    <div className={pageCls}>
      <h1 className="text-4xl font-bold text-slate-100">Kayro</h1>
      <div className={cardCls}>
        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-4 border-rose-500/30 border-t-rose-400 rounded-full animate-spin" />
            <p className="text-sm text-white/40">Verifying your email…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-emerald-300 font-medium">{message}</p>
            <a href="/" className="text-sm text-rose-400 hover:underline">Go to login</a>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center">
              <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm text-rose-300">{message}</p>
            <a href="/" className="text-sm text-rose-400 hover:underline">Back to login</a>
          </>
        )}
      </div>
    </div>
  );
}
