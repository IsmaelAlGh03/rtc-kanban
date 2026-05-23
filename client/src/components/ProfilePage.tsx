import { useState } from 'react';
import { gravatarUrl } from '../utils/gravatar';

const API = 'http://localhost:4000/api';

interface Props {
  username: string;
  displayName: string;
  bio: string;
  gravatarHash: string;
  onClose: () => void;
  onSave: (displayName: string, bio: string) => void;
}

export default function ProfilePage({ username, displayName, bio, gravatarHash, onClose, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [bioInput, setBioInput] = useState(bio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`${API}/auth/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rtc-token')}`,
        },
        body: JSON.stringify({ displayName: nameInput.trim(), bio: bioInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to save'); return; }
      onSave(nameInput.trim(), bioInput.trim());
      setEditing(false);
    } catch {
      setError('Could not connect to the server');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#1a1d30] border border-white/[0.07] rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Profile</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <img
            src={gravatarUrl(gravatarHash, 80)}
            alt={displayName}
            className="w-20 h-20 rounded-full ring-2 ring-white/10"
          />
          {editing ? (
            <input
              className="text-center font-bold text-lg bg-transparent border-b border-white/20 focus:border-rose-400 outline-none text-slate-100 w-full"
              value={nameInput}
              maxLength={50}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Display name"
            />
          ) : (
            <p className="text-xl font-bold text-slate-100">{displayName || username}</p>
          )}
          <p className="text-sm text-white/35">@{username}</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-white/35 uppercase tracking-wide">Bio</label>
          {editing ? (
            <textarea
              className="mt-1 w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-white/25 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 resize-none"
              rows={3}
              maxLength={200}
              value={bioInput}
              onChange={e => setBioInput(e.target.value)}
              placeholder="Tell others a little about yourself…"
            />
          ) : (
            <p className="mt-1 text-sm text-white/60 min-h-[3rem]">
              {bio || <span className="text-white/25 italic">No bio yet</span>}
            </p>
          )}
          {editing && (
            <p className="text-right text-xs text-white/25 mt-0.5">{bioInput.length}/200</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          {editing ? (
            <>
              <button
                onClick={() => { setEditing(false); setNameInput(displayName); setBioInput(bio); setError(''); }}
                className="text-sm px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="text-sm px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:bg-white/[0.05] transition-colors"
            >
              Edit profile
            </button>
          )}
        </div>

        <p className="text-xs text-white/25 text-center">
          Avatar powered by{' '}
          <a href="https://gravatar.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/40">
            Gravatar
          </a>
        </p>
      </div>
    </div>
  );
}
