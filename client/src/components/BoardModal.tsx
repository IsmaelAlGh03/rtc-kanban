import { useState, useEffect, useRef } from 'react';
import { IBoard } from '../types';

const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#ec4899', '#8b5cf6',
  '#fca5a5', '#fdba74', '#fde68a', '#86efac', '#67e8f9', '#a5b4fc', '#f9a8d4', '#c4b5fd',
];

const API = 'http://localhost:4000/api';

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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">Edit Board</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</label>
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
          <textarea
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
            rows={3}
            placeholder="What is this board for?"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Color palette */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Color</label>
          <div className="grid grid-cols-8 gap-2">
            <button
              onClick={() => setColor('')}
              title="No color"
              className={`w-7 h-7 rounded-full border-2 bg-white flex items-center justify-center ${color === '' ? 'border-blue-500' : 'border-gray-300'}`}
            >
              <span className="text-gray-400 text-xs">✕</span>
            </button>
            {PALETTE.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${color === c ? 'border-blue-500 scale-110' : 'border-transparent'} transition-transform`}
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
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Share</label>

            {/* Search */}
            <div className="relative">
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Search by username or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-md z-10 overflow-hidden">
                  {searchResults.map(u => (
                    <button
                      key={u}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                      onClick={() => !pendingInvites.includes(u) && addMember(u)}
                    >
                      <span>{u}</span>
                      {pendingInvites.includes(u) && (
                        <span className="text-xs text-amber-500 font-semibold">Pending</span>
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
                  <div key={m} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">{m}</span>
                    <button
                      className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
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
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Pending invites</p>
                {pendingInvites.map(u => (
                  <div key={u} className="flex items-center justify-between px-3 py-1.5 bg-amber-50 rounded-lg">
                    <span className="text-sm text-gray-700">{u}</span>
                    <span className="text-xs text-amber-500 font-semibold">Pending</span>
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
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500 bg-gray-50 outline-none"
                    value={inviteLink}
                  />
                  <button
                    onClick={copyLink}
                    className="text-xs px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors whitespace-nowrap"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ) : null}
              <button
                onClick={generateLink}
                disabled={generatingLink}
                className="text-xs text-blue-500 hover:text-blue-700 transition-colors text-left"
              >
                {generatingLink ? 'Generating...' : inviteLink ? 'Regenerate link' : 'Generate invite link'}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              deleteStep === 'confirm'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'text-red-500 hover:bg-red-50'
            }`}
          >
            {deleting ? 'Deleting...' : deleteStep === 'confirm' ? 'Are you sure?' : 'Delete Board'}
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="text-sm px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white font-semibold transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
