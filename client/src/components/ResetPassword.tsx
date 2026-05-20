import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const API = 'http://localhost:4000/api';

const rules = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token = params.get('token') ?? '';
  const allRulesMet = rules.every(r => r.test(password));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!allRulesMet) { setError('Password does not meet requirements.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message ?? 'Password reset! You can now log in.');
        setPassword('');
        setConfirm('');
      } else {
        setError(data.error ?? 'Something went wrong.');
      }
    } catch {
      setError('Could not connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-gray-100 px-4">
        <h1 className="text-4xl font-bold text-gray-800">RTC Kanban</h1>
        <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8 flex flex-col gap-4 items-center text-center">
          <p className="text-sm text-red-600">No reset token found in the link.</p>
          <a href="/" className="text-sm text-blue-500 hover:underline">Back to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-gray-100 px-4">
      <h1 className="text-4xl font-bold text-gray-800">RTC Kanban</h1>
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8 flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Choose a new password</h2>
        </div>

        {success ? (
          <div className="flex flex-col gap-4 items-center text-center">
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 w-full">{success}</p>
            <a href="/" className="text-sm text-blue-500 hover:underline">Go to login</a>
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">New password</label>
              <input
                autoFocus
                type="password"
                autoComplete="new-password"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password"
                required
              />
              {password.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {rules.map(r => (
                    <li key={r.label} className={`text-xs flex items-center gap-1.5 ${r.test(password) ? 'text-green-600' : 'text-gray-400'}`}>
                      <span>{r.test(password) ? '✓' : '○'}</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confirm password</label>
              <input
                type="password"
                autoComplete="new-password"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm password"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-1"
            >
              {loading ? '…' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
