import { useState, useEffect } from 'react';
import { IBoard } from './types';
import Board from './components/Board';
import BoardModal from './components/BoardModal';
import { resetSocket } from './socket';

const API = 'http://localhost:4000/api';

function isColorLight(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('rtc-token')}`,
  };
}

export default function App() {
  const [username, setUsername] = useState<string>(() => localStorage.getItem('rtc-username') ?? '');
  const [boards, setBoards] = useState<IBoard[]>([]);
  const [currentBoard, setCurrentBoard] = useState<IBoard | null>(null);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [editingBoard, setEditingBoard] = useState<IBoard | null>(null);

  // Auth form state
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (username) fetchBoards();
  }, [username]);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setLoading(true);
    try {
      const body = mode === 'register'
        ? { username: nameInput.trim(), email: emailInput.trim(), password: passwordInput }
        : { identifier: nameInput.trim(), password: passwordInput };
      const res = await fetch(`${API}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error ?? 'Something went wrong');
        return;
      }
      if (mode === 'register') {
        setAuthSuccess(`Account created! Welcome, ${data.username}.`);
        setTimeout(() => {
          localStorage.setItem('rtc-token', data.token);
          localStorage.setItem('rtc-username', data.username);
          setUsername(data.username);
        }, 1200);
      } else {
        localStorage.setItem('rtc-token', data.token);
        localStorage.setItem('rtc-username', data.username);
        setUsername(data.username);
      }
      setNameInput('');
      setEmailInput('');
      setPasswordInput('');
    } catch {
      setAuthError('Could not connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('rtc-token');
    localStorage.removeItem('rtc-username');
    resetSocket();
    setUsername('');
    setCurrentBoard(null);
    setBoards([]);
  }

  async function fetchBoards() {
    const res = await fetch(`${API}/boards`, { headers: authHeaders() });
    if (res.status === 401) { logout(); return; }
    setBoards(await res.json());
  }

  async function saveBoard(id: string, updates: Pick<IBoard, 'title' | 'description' | 'color'>) {
    const res = await fetch(`${API}/boards/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    });
    if (res.status === 401) { logout(); return; }
    setBoards(prev => prev.map(b => b._id === id ? { ...b, ...updates } : b));
  }

  async function deleteBoard(id: string) {
    const res = await fetch(`${API}/boards/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.status === 401) { logout(); return; }
    setBoards(prev => prev.filter(b => b._id !== id));
    setEditingBoard(null);
  }

  async function createBoard() {
    if (!newBoardTitle.trim()) return;
    const res = await fetch(`${API}/boards`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title: newBoardTitle.trim() }),
    });
    if (res.status === 401) { logout(); return; }
    const board = await res.json();
    setBoards(prev => [...prev, board]);
    setNewBoardTitle('');
  }

  // ── Auth screen ─────────────────────────────────────────
  if (!username) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 bg-gray-100">
        <h1 className="text-4xl font-bold text-gray-800">RTC Kanban</h1>

        <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8 flex flex-col gap-5">
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${mode === 'login' ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              onClick={() => { setMode('login'); setAuthError(''); setAuthSuccess(''); setEmailInput(''); }}
            >
              Login
            </button>
            <button
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${mode === 'register' ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              onClick={() => { setMode('register'); setAuthError(''); setAuthSuccess(''); }}
            >
              Register
            </button>
          </div>

          <form className="flex flex-col gap-3" onSubmit={submitAuth}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {mode === 'login' ? 'Username or Email' : 'Username'}
              </label>
              <input
                autoFocus
                autoComplete="username"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder={mode === 'login' ? 'Username or email' : 'Your username'}
              />
            </div>

            {mode === 'register' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Password</label>
              <input
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="Your password"
              />
              {mode === 'register' && passwordInput.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {[
                    { label: '8+ characters', ok: passwordInput.length >= 8 },
                    { label: 'Uppercase letter', ok: /[A-Z]/.test(passwordInput) },
                    { label: 'Number', ok: /[0-9]/.test(passwordInput) },
                    { label: 'Special character', ok: /[^A-Za-z0-9]/.test(passwordInput) },
                  ].map(({ label, ok }) => (
                    <li key={label} className={`text-xs flex items-center gap-1.5 ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                      <span>{ok ? '✓' : '○'}</span>
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {authError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}
            {authSuccess && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                {authSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mt-1"
            >
              {loading ? '...' : mode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Board view ───────────────────────────────────────────
  if (currentBoard) {
    return (
      <Board
        board={currentBoard}
        username={username}
        onLeave={() => setCurrentBoard(null)}
      />
    );
  }

  // ── Board list ───────────────────────────────────────────
  const myBoards = boards.filter(b => b.owner === username);
  const sharedBoards = boards.filter(b => b.owner !== username);

  function renderBoardCard(b: (typeof boards)[0]) {
    const bg = b.color || null;
    const light = bg ? isColorLight(bg) : true;
    const textColor = bg ? (light ? 'text-gray-900' : 'text-white') : 'text-gray-800';
    const iconColor = bg ? (light ? 'text-gray-700 hover:text-gray-900' : 'text-white/70 hover:text-white') : 'text-gray-400 hover:text-gray-700';
    const isOwned = b.owner === username;

    return (
      <div
        key={b._id}
        className={`relative group rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer ${!isOwned ? 'border-2 border-dashed border-gray-300' : ''}`}
        style={{ backgroundColor: bg ?? '#ffffff' }}
        onClick={() => setCurrentBoard(b)}
      >
        <p className={`font-semibold ${textColor}`}>{b.title}</p>
        {b.description && (
          <p className={`text-xs mt-1 line-clamp-2 ${bg ? (light ? 'text-gray-600' : 'text-white/70') : 'text-gray-500'}`}>
            {b.description}
          </p>
        )}
        {!isOwned && (
          <p className={`text-[11px] mt-2 ${bg ? (light ? 'text-gray-500' : 'text-white/60') : 'text-gray-400'}`}>
            by {b.owner}
          </p>
        )}
        {isOwned && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className={`p-1 rounded ${iconColor} transition-colors`}
              onClick={e => { e.stopPropagation(); setEditingBoard(b); }}
              title="Edit board"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Boards</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Logged in as <strong className="text-gray-700">{username}</strong>
          </span>
          <button
            onClick={logout}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors bg-white"
          >
            Logout
          </button>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">My Boards</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {myBoards.map(renderBoardCard)}
        </div>
      </section>

      {sharedBoards.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Shared with me</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {sharedBoards.map(renderBoardCard)}
          </div>
        </section>
      )}

      {editingBoard && (
        <BoardModal
          board={editingBoard}
          username={username}
          onClose={() => setEditingBoard(null)}
          onSave={updates => saveBoard(editingBoard._id, updates)}
          onDelete={() => deleteBoard(editingBoard._id)}
          onMembersChange={members => {
            setBoards(prev => prev.map(b => b._id === editingBoard._id ? { ...b, members } : b));
            setEditingBoard(prev => prev ? { ...prev, members } : prev);
          }}
        />
      )}

      <div className="flex gap-2 max-w-sm">
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 flex-1"
          value={newBoardTitle}
          onChange={e => setNewBoardTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createBoard()}
          placeholder="New board title..."
        />
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          onClick={createBoard}
        >
          Create Board
        </button>
      </div>
    </div>
  );
}
