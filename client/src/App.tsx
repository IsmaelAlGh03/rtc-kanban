import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { IBoard } from './types';
import Board from './components/Board';
import BoardModal from './components/BoardModal';
import NotificationTray from './components/NotificationTray';
import VerificationBanner from './components/VerificationBanner';
import VerifyEmail from './components/VerifyEmail';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import ProfilePage from './components/ProfilePage';
import { resetSocket } from './socket';
import { toast } from 'sonner';
import { gravatarUrl } from './utils/gravatar';

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
  const [displayName, setDisplayName] = useState<string>('');
  const [gravatarHash, setGravatarHash] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [showProfile, setShowProfile] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean>(true);
  const [boards, setBoards] = useState<IBoard[]>([]);
  const [currentBoard, setCurrentBoard] = useState<IBoard | null>(null);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [boardsLoading, setBoardsLoading] = useState(false);
  const newBoardInputRef = useRef<HTMLInputElement>(null);
  const [editingBoard, setEditingBoard] = useState<IBoard | null>(null);
  const [pendingCard, setPendingCard] = useState<{ columnId: string; cardId: string } | null>(null);

  // Auth form state
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Account deletion state
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const location = useLocation();

  useEffect(() => {
    if (username) fetchBoards();
  }, [username]);

  useEffect(() => {
    if (!username) return;
    fetch(`${API}/auth/me`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setEmailVerified(data.emailVerified);
          setDisplayName(data.displayName ?? username);
          setGravatarHash(data.gravatarHash ?? '');
          setBio(data.bio ?? '');
        }
      })
      .catch(() => {});
  }, [username]);

  useEffect(() => {
    if (!username) return;
    const match = window.location.pathname.match(/^\/join\/([a-f0-9]+)$/);
    if (!match) return;
    const token = match[1];
    window.history.replaceState(null, '', '/');
    fetch(`${API}/boards/join/${token}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(board => {
        if (!board) { toast.error('Invalid or expired invite link'); return; }
        setBoards(prev => prev.some(b => b._id === board._id) ? prev : [...prev, board]);
        setCurrentBoard(board);
        toast.success(`Joined "${board.title}"`);
      })
      .catch(() => toast.error('Failed to join board'));
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
    setDisplayName('');
    setGravatarHash('');
    setBio('');
    setEmailVerified(true);
    setCurrentBoard(null);
    setBoards([]);
  }

  async function fetchBoards() {
    setBoardsLoading(true);
    try {
      const res = await fetch(`${API}/boards`, { headers: authHeaders() });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) { toast.error('Failed to load boards', { duration: 6000 }); return; }
      setBoards(await res.json());
    } catch {
      toast.error('Failed to load boards', { duration: 6000 });
    } finally {
      setBoardsLoading(false);
    }
  }

  async function saveBoard(id: string, updates: Pick<IBoard, 'title' | 'description' | 'color'>) {
    try {
      const res = await fetch(`${API}/boards/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) { toast.error('Failed to save board', { duration: 6000 }); return; }
      setBoards(prev => prev.map(b => b._id === id ? { ...b, ...updates } : b));
      toast.success('Board saved');
    } catch {
      toast.error('Failed to save board', { duration: 6000 });
    }
  }

  async function deleteBoard(id: string) {
    try {
      const res = await fetch(`${API}/boards/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) { toast.error('Failed to delete board', { duration: 6000 }); return; }
      setBoards(prev => prev.filter(b => b._id !== id));
      setEditingBoard(null);
      toast.error('Board deleted');
    } catch {
      toast.error('Failed to delete board', { duration: 6000 });
    }
  }

  async function createBoard() {
    if (!newBoardTitle.trim()) return;
    try {
      const res = await fetch(`${API}/boards`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ title: newBoardTitle.trim() }),
      });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) { toast.error('Failed to create board', { duration: 6000 }); return; }
      const board = await res.json();
      setBoards(prev => [...prev, board]);
      setNewBoardTitle('');
      toast.success('Board created');
    } catch {
      toast.error('Failed to create board', { duration: 6000 });
    }
  }

  // ── Special routes (always accessible regardless of auth state) ─────
  if (location.pathname === '/verify-email') return <VerifyEmail onVerified={() => setEmailVerified(true)} />;
  if (location.pathname === '/forgot-password') return <ForgotPassword />;
  if (location.pathname === '/reset-password') return <ResetPassword />;

  // ── Auth screen ─────────────────────────────────────────
  if (!username) {
    return (
      <Routes>
        <Route path="*" element={
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-[#0d0f1a] px-4">
        <h1 className="text-4xl font-bold text-slate-100">Kayro</h1>

        <div className="bg-[#1a1d30] border border-white/[0.07] rounded-2xl shadow-xl w-full max-w-sm p-8 flex flex-col gap-5">
          <div className="flex rounded-lg overflow-hidden border border-white/[0.09]">
            <button
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${mode === 'login' ? 'bg-rose-500 text-white' : 'bg-transparent text-white/40 hover:bg-white/[0.05]'}`}
              onClick={() => { setMode('login'); setAuthError(''); setAuthSuccess(''); setEmailInput(''); }}
            >
              Login
            </button>
            <button
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${mode === 'register' ? 'bg-rose-500 text-white' : 'bg-transparent text-white/40 hover:bg-white/[0.05]'}`}
              onClick={() => { setMode('register'); setAuthError(''); setAuthSuccess(''); }}
            >
              Register
            </button>
          </div>

          <form className="flex flex-col gap-3" onSubmit={submitAuth}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-white/35 uppercase tracking-wide">
                {mode === 'login' ? 'Username or Email' : 'Username'}
              </label>
              <input
                autoFocus
                autoComplete="username"
                className="border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-white/[0.06] text-slate-100 placeholder-white/25"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder={mode === 'login' ? 'Username or email' : 'Your username'}
              />
            </div>

            {mode === 'register' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-white/35 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  className="border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-white/[0.06] text-slate-100 placeholder-white/25"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-white/35 uppercase tracking-wide">Password</label>
              <input
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-white/[0.06] text-slate-100 placeholder-white/25"
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
                    <li key={label} className={`text-xs flex items-center gap-1.5 ${ok ? 'text-emerald-400' : 'text-white/30'}`}>
                      <span>{ok ? '✓' : '○'}</span>
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {authError && (
              <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}
            {authSuccess && (
              <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2">
                {authSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-rose-500 hover:bg-rose-600 active:scale-[0.98] disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-all mt-1"
            >
              {loading ? '...' : mode === 'login' ? 'Login' : 'Create Account'}
            </button>
            {mode === 'login' && (
              <a href="/forgot-password" className="text-xs text-rose-400 hover:underline text-center">
                Forgot password?
              </a>
            )}
          </form>
        </div>
      </div>
        } />
      </Routes>
    );
  }

  async function navigateToCard(boardId: string, columnId: string, cardId: string) {
    const res = await fetch(`${API}/boards/${boardId}`, { headers: authHeaders() });
    if (!res.ok) return;
    const freshBoard: IBoard = await res.json();
    setBoards(prev => prev.map(b => b._id === boardId ? freshBoard : b));
    setPendingCard({ columnId, cardId });
    setCurrentBoard(freshBoard);
  }

  // ── Board view ───────────────────────────────────────────
  if (currentBoard) {
    return (
      <Board
        board={currentBoard}
        username={username}
        initialCard={pendingCard ?? undefined}
        onLeave={() => { setCurrentBoard(null); setPendingCard(null); }}
      />
    );
  }

  async function deleteAccount() {
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API}/auth/account`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) { toast.error('Failed to delete account'); return; }
      logout();
    } catch {
      toast.error('Could not connect to the server');
    } finally {
      setDeleteLoading(false);
    }
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
        className={`relative group rounded-xl p-6 hover:-translate-y-0.5 transition-all cursor-pointer ${!bg ? 'bg-[#1a1d30] border border-white/[0.07]' : ''} ${!isOwned && !bg ? 'border-dashed' : ''}`}
        style={bg ? { backgroundColor: bg } : undefined}
        onClick={() => { setPendingCard(null); setCurrentBoard(b); }}
      >
        <p className={`font-semibold ${bg ? textColor : 'text-slate-100'}`}>{b.title}</p>
        {b.description && (
          <p className={`text-xs mt-1 line-clamp-2 ${bg ? (light ? 'text-gray-600' : 'text-white/70') : 'text-gray-500'}`}>
            {b.description}
          </p>
        )}
        {!isOwned && (
          <p className={`text-xs mt-2 ${bg ? (light ? 'text-gray-500' : 'text-white/60') : 'text-gray-400'}`}>
            by {b.owner}
          </p>
        )}
        {isOwned && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-25 group-hover:opacity-100 transition-opacity">
            <button
              className={`p-1 rounded ${iconColor} transition-colors`}
              onClick={e => { e.stopPropagation(); setEditingBoard(b); }}
              title="Edit board"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 0110 16.414H8v-2a2 2 0 01.586-1.414z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {!emailVerified && <VerificationBanner token={localStorage.getItem('rtc-token') ?? ''} />}
    <div className="min-h-screen bg-[#0d0f1a]">
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="flex items-center flex-wrap gap-3 mb-6">
        <h1 className="text-3xl font-bold text-slate-100">Boards</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="View profile"
          >
            {gravatarHash ? (
              <img
                src={gravatarUrl(gravatarHash, 32)}
                alt={displayName || username}
                className="w-8 h-8 rounded-full ring-1 ring-white/20"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/40">
                {username[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-sm text-white/40 hidden sm:inline">
              <strong className="text-slate-200">{displayName || username}</strong>
            </span>
          </button>
          <NotificationTray onBoardsChange={fetchBoards} onNavigateToCard={navigateToCard} />
          <button
            onClick={() => { setShowDeleteAccount(true); setDeleteConfirmInput(''); }}
            className="text-sm px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            Delete account
          </button>
          <button
            onClick={logout}
            className="text-sm px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:bg-white/[0.05] transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-white/30 uppercase tracking-wide mb-3">My Boards</h2>
        {boardsLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton rounded-xl h-20" />
            ))}
          </div>
        ) : myBoards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-3">📋</span>
            <p className="font-semibold text-slate-300 mb-1">No boards yet</p>
            <p className="text-sm text-white/30 mb-4">Create your first board to get started</p>
            <button
              className="bg-rose-500 hover:bg-rose-600 active:scale-[0.97] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              onClick={() => newBoardInputRef.current?.focus()}
            >
              + Create Board
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {myBoards.map(renderBoardCard)}
          </div>
        )}
      </section>

      {sharedBoards.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-indigo-400/60 uppercase tracking-wide mb-3">Shared with me</h2>
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
          ref={newBoardInputRef}
          className="border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-white/[0.06] text-slate-100 placeholder-white/25 flex-1"
          value={newBoardTitle}
          onChange={e => setNewBoardTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createBoard()}
          placeholder="New board title..."
        />
        <button
          className="bg-rose-500 hover:bg-rose-600 active:scale-[0.97] text-white text-sm px-4 py-2 rounded-lg transition-all whitespace-nowrap"
          onClick={createBoard}
        >
          Create Board
        </button>
      </div>
    </div>
    </div>

    {showProfile && (
      <ProfilePage
        username={username}
        displayName={displayName || username}
        bio={bio}
        gravatarHash={gravatarHash}
        onClose={() => setShowProfile(false)}
        onSave={(newDisplayName, newBio) => {
          setDisplayName(newDisplayName);
          setBio(newBio);
        }}
      />
    )}

    {showDeleteAccount && (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1a1d30] border border-white/[0.07] rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Delete account</h2>
            <p className="text-sm text-white/40 mt-1">
              Your account will be permanently deleted. Boards you own with other members will be transferred to the next member — boards with no members will be deleted.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-white/35 uppercase tracking-wide">
              Type <span className="text-slate-200 font-bold">{username}</span> to confirm
            </label>
            <input
              autoFocus
              className="border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-white/[0.06] text-slate-100 placeholder-white/25"
              value={deleteConfirmInput}
              onChange={e => setDeleteConfirmInput(e.target.value)}
              placeholder={username}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowDeleteAccount(false)}
              className="text-sm px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={deleteAccount}
              disabled={deleteConfirmInput !== username || deleteLoading}
              className="text-sm px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-[0.97] disabled:opacity-50 text-white font-semibold transition-all"
            >
              {deleteLoading ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
