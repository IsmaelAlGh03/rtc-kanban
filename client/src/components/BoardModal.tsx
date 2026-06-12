import { useState, useEffect, useRef } from 'react';
import { IBoard } from '../types';

const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#ec4899', '#8b5cf6',
  '#fca5a5', '#fdba74', '#fde68a', '#86efac', '#67e8f9', '#a5b4fc', '#f9a8d4', '#c4b5fd',
];

import { API } from '../api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('rtc-token')}`,
  };
}

function isLight(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

interface Props {
  board: IBoard;
  username: string;
  onClose: () => void;
  onSave: (updated: Pick<IBoard, 'title' | 'description' | 'color'>) => Promise<void>;
  onDelete: () => Promise<void>;
  onMembersChange: (members: string[]) => void;
}

export default function BoardModal({ board, username, onClose, onSave, onDelete, onMembersChange }: Props) {
  const isOwner = board.owner === username;

  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description ?? '');
  const [color, setColor] = useState(board.color ?? '');
  const [saving, setSaving] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm'>('idle');
  const [deleting, setDeleting] = useState(false);

  const [members, setMembers] = useState<string[]>(board.members);
  const [pendingInvites, setPendingInvites] = useState<string[]>(board.pendingInvites ?? []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [inviteLink, setInviteLink] = useState(
    board.inviteToken ? `${window.location.origin}/join/${board.inviteToken}` : ''
  );
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      const res = await fetch(`${API}/users/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const all: string[] = await res.json();
        setSearchResults(all.filter(u => !members.includes(u)));
      }
    }, 250);
  }, [searchQuery, members, username]);

  async function addMember(target: string) {
    const res = await fetch(`${API}/boards/${board._id}/members`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ username: target }),
    });
    if (res.ok) {
      setPendingInvites(prev => [...prev, target]);
      setSearchQuery('');
      setSearchResults([]);
    }
  }

  async function removeMember(target: string) {
    const res = await fetch(`${API}/boards/${board._id}/members/${target}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) {
      const updated = members.filter(m => m !== target);
      setMembers(updated);
      onMembersChange(updated);
    }
  }

  async function generateLink() {
    setGeneratingLink(true);
    const res = await fetch(`${API}/boards/${board._id}/invite`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (res.ok) {
      const { token } = await res.json();
      setInviteLink(`${window.location.origin}/join/${token}`);
    }
    setGeneratingLink(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({ title, description, color });
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (deleteStep === 'idle') { setDeleteStep('confirm'); return; }
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#1a1d30] rounded-2xl shadow-2xl border border-white/[0.07] w-full max-w-md p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100">Edit Board</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 text-xl leading-none transition-colors">&times;</button>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wide">Name</label>
          <input
            className="border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-white/[0.06] text-slate-100 placeholder-white/25"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wide">Description</label>
          <textarea
            className="border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-white/[0.06] text-slate-100 placeholder-white/25 resize-none"
            rows={3}
            placeholder="What is this board for?"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Color palette */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wide">Color</label>
          <div className="grid grid-cols-8 gap-2">
            <button
              onClick={() => setColor('')}
              title="No color"
              className={`w-7 h-7 rounded-full border-2 bg-white/[0.08] flex items-center justify-center ${color === '' ? 'border-rose-500' : 'border-white/20'}`}
            >
              <span className="text-white/40 text-xs">✕</span>
            </button>
            {PALETTE.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${color === c ? 'border-rose-400 scale-110' : 'border-transparent'} transition-transform`}
              >
                {color === c && (
                  <span style={{ color: isLight(c) ? '#1f2937' : '#ffffff' }} className="text-xs font-bold">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Share */}
        {isOwner && (
          <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-4">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wide">Share</label>

            {/* Search */}
            <div className="relative">
              <input
                className="w-full border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-white/[0.06] text-slate-100 placeholder-white/25"
                placeholder="Search by username or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1d30] border border-white/[0.08] rounded-lg shadow-xl z-10 overflow-hidden">
                  {searchResults.map(u => (
                    <button
                      key={u}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/[0.06] transition-colors flex items-center justify-between text-slate-200"
                      onClick={() => !pendingInvites.includes(u) && addMember(u)}
                    >
                      <span>{u}</span>
                      {pendingInvites.includes(u) && (
                        <span className="text-xs text-amber-400 font-semibold">Pending</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Member list */}
            {members.length > 0 && (
              <div className="flex flex-col gap-1">
                {members.map(m => (
                  <div key={m} className="flex items-center justify-between px-3 py-1.5 bg-white/[0.04] rounded-lg border border-white/[0.05]">
                    <span className="text-sm text-slate-200">{m}</span>
                    <button
                      className="text-white/30 hover:text-rose-400 transition-colors text-lg leading-none"
                      onClick={() => removeMember(m)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pending invites */}
            {pendingInvites.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-white/40 font-semibold uppercase tracking-wide">Pending invites</p>
                {pendingInvites.map(u => (
                  <div key={u} className="flex items-center justify-between px-3 py-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <span className="text-sm text-slate-200">{u}</span>
                    <span className="text-xs text-amber-400 font-semibold">Pending</span>
                  </div>
                ))}
              </div>
            )}

            {/* Invite link */}
            <div className="flex flex-col gap-2">
              {inviteLink ? (
                <div className="flex gap-2">
                  <input
                    readOnly
                    className="flex-1 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/40 bg-white/[0.04] outline-none"
                    value={inviteLink}
                  />
                  <button
                    onClick={copyLink}
                    className="text-xs px-3 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-slate-200 transition-colors whitespace-nowrap active:scale-[0.97]"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ) : null}
              <button
                onClick={generateLink}
                disabled={generatingLink}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors text-left"
              >
                {generatingLink ? 'Generating...' : inviteLink ? 'Regenerate link' : 'Generate invite link'}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.07]">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors active:scale-[0.97] ${
              deleteStep === 'confirm'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'text-red-400 hover:bg-red-500/10'
            }`}
          >
            {deleting ? 'Deleting...' : deleteStep === 'confirm' ? 'Are you sure?' : 'Delete Board'}
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm px-3 py-1.5 rounded-lg border border-white/[0.10] text-white/60 hover:bg-white/[0.06] transition-colors active:scale-[0.97]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="text-sm px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold transition-colors active:scale-[0.97]"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
