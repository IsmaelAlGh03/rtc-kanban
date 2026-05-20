import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const API = 'http://localhost:4000/api';

export default function VerifyEmail() {
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
    <div className="flex flex-col items-center justify-center h-screen gap-6 bg-gray-100">
      <h1 className="text-4xl font-bold text-gray-800">RTC Kanban</h1>
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8 flex flex-col gap-5 items-center text-center">
        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Verifying your email…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-green-700 font-medium">{message}</p>
            <a href="/" className="text-sm text-blue-500 hover:underline">Go to login</a>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm text-red-600">{message}</p>
            <a href="/" className="text-sm text-blue-500 hover:underline">Back to login</a>
          </>
        )}
      </div>
    </div>
  );
}
