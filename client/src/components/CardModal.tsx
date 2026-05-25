import { useEffect, useRef, useState } from 'react';
import { ICard } from '../types';
import { useProfile } from '../context/UserProfileContext';
import { gravatarUrl } from '../utils/gravatar';

interface Props {
  card: ICard;
  columnId: string;
  username: string;
  members: string[];
  onClose: () => void;
  onUpdate: (fields: { assignedTo?: string; urgency?: 'low' | 'medium' | 'high'; dueDate?: string | null }) => void;
  onAddComment: (text: string, mentions: string[]) => void;
}

const URGENCY_CONFIG = {
  low:    { label: 'Low',    activeBg: 'bg-emerald-500/15', activeText: 'text-emerald-400', activeBorder: 'border-emerald-500/40' },
  medium: { label: 'Medium', activeBg: 'bg-amber-500/15',   activeText: 'text-amber-400',   activeBorder: 'border-amber-500/40'   },
  high:   { label: 'High',   activeBg: 'bg-rose-500/15',    activeText: 'text-rose-400',    activeBorder: 'border-rose-500/40'    },
} as const;

const inputCls = 'w-full bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 text-slate-100 placeholder-white/25';

export default function CardModal({ card, username, members, onClose, onUpdate, onAddComment }: Props) {
  const assigneeProfile = useProfile(card.assignedTo ?? '');
  const addedByProfile = useProfile(card.addedBy ?? '');
  const [assignedInput, setAssignedInput] = useState(card.assignedTo ?? '');
  const [focused, setFocused] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const mentionSuggestions = mentionQuery !== null
    ? members.filter(m => m !== username && m.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
    : [];

  function getActiveMentionQuery(text: string, cursorPos: number): string | null {
    const before = text.slice(0, cursorPos);
    const match = before.match(/(?:^|\s)@(\w*)$/);
    return match ? match[1] : null;
  }

  function extractMentions(text: string): string[] {
    const matches = [...text.matchAll(/\B@(\w+)/g)].map(m => m[1]);
    return [...new Set(matches.filter(m => members.includes(m)))];
  }
  const commentsBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAssignedInput(card.assignedTo ?? '');
  }, [card.assignedTo]);

  useEffect(() => {
    commentsBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [card.comments.length]);

  const suggestions = focused && assignedInput.trim()
    ? members.filter(m => m.toLowerCase().includes(assignedInput.trim().toLowerCase())).slice(0, 5)
    : [];

  function saveAssignedTo() {
    const val = assignedInput.trim();
    if (val !== '' && !members.includes(val)) {
      setAssignedInput(card.assignedTo ?? '');
      return;
    }
    if (val !== (card.assignedTo ?? '')) {
      onUpdate({ assignedTo: val });
    }
  }

  function renderCommentText(text: string, mentions: string[]) {
    if (!mentions.length) return text;
    const parts = text.split(/(\B@\w+)/g);
    return parts.map((part, i) => {
      const match = part.match(/^\B@(\w+)$/);
      if (match && mentions.includes(match[1])) {
        return <span key={i} className="text-rose-400 font-semibold">{part}</span>;
      }
      return part;
    });
  }

  function selectSuggestion(member: string) {
    setAssignedInput(member);
    setFocused(false);
    if (member !== (card.assignedTo ?? '')) {
      onUpdate({ assignedTo: member });
    }
  }

  function submitComment() {
    if (!commentInput.trim()) return;
    const text = commentInput.trim();
    const mentions = extractMentions(text);
    onAddComment(text, mentions);
    setCommentInput('');
    setMentionQuery(null);
  }

  const dropdownCls = 'absolute z-10 left-0 right-0 bg-[#1a1d30] border border-white/10 rounded-lg shadow-xl overflow-hidden';
  const dropdownItemCls = 'px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06] cursor-pointer';

  return (
    <div
      className="fixed inset-0 z-50 sm:bg-black/60 sm:flex sm:items-center sm:justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1d30] flex flex-col overflow-hidden w-full h-full sm:rounded-2xl sm:w-full sm:max-w-lg sm:h-auto sm:max-h-[85vh] sm:shadow-2xl border border-white/[0.07]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.08] shrink-0">
          <h2 className="text-base font-bold text-slate-100 leading-snug flex-1">{card.title}</h2>
          <button
            className="text-white/35 hover:text-white/70 text-2xl leading-none bg-transparent border-0 cursor-pointer transition-colors shrink-0"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Metadata */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex flex-col gap-3 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/35 w-24 shrink-0">Added by</span>
            <div className="flex items-center gap-2">
              {addedByProfile?.gravatarHash ? (
                <img src={gravatarUrl(addedByProfile.gravatarHash, 24)} alt={card.addedBy} className="w-6 h-6 rounded-full ring-1 ring-white/10" />
              ) : null}
              <span className="text-sm text-slate-300">{addedByProfile?.displayName || card.addedBy}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/35 w-24 shrink-0">Assigned to</span>
            <div className="flex items-center gap-2 flex-1">
              {card.assignedTo && assigneeProfile?.gravatarHash ? (
                <img src={gravatarUrl(assigneeProfile.gravatarHash, 24)} alt={card.assignedTo} className="w-6 h-6 rounded-full ring-1 ring-white/10 shrink-0" />
              ) : null}
            <div className="relative flex-1">
              <input
                className={inputCls}
                value={assignedInput}
                onChange={e => { setAssignedInput(e.target.value); setFocused(true); }}
                onFocus={() => setFocused(true)}
                onBlur={() => { setFocused(false); saveAssignedTo(); }}
                onKeyDown={e => { if (e.key === 'Enter') { setFocused(false); saveAssignedTo(); } }}
                placeholder="Unassigned"
              />
              {suggestions.length > 0 && (
                <ul className={`${dropdownCls} top-full mt-1`}>
                  {suggestions.map(member => (
                    <li key={member} className={dropdownItemCls} onMouseDown={e => e.preventDefault()} onClick={() => selectSuggestion(member)}>
                      {member}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/35 w-24 shrink-0">Urgency</span>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map(level => {
                const cfg = URGENCY_CONFIG[level];
                const active = card.urgency === level;
                return (
                  <button
                    key={level}
                    onClick={() => onUpdate({ urgency: level })}
                    className={`text-xs px-3 py-1 rounded-full border-2 font-semibold transition-opacity cursor-pointer ${
                      active
                        ? `${cfg.activeBg} ${cfg.activeText} ${cfg.activeBorder}`
                        : 'bg-transparent text-white/25 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/35 w-24 shrink-0">Due date</span>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="date"
                className={inputCls}
                value={card.dueDate ? card.dueDate.slice(0, 10) : ''}
                onChange={e => onUpdate({ dueDate: e.target.value || null })}
              />
              {card.dueDate && (
                <button
                  onClick={() => onUpdate({ dueDate: null })}
                  className="text-xs text-white/25 hover:text-rose-400 transition-colors"
                  title="Clear due date"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="flex flex-col flex-1 overflow-hidden px-5 py-4 gap-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/35 flex items-center gap-2 shrink-0">
            Comments
            {card.comments.length > 0 && (
              <span className="bg-indigo-500/15 text-indigo-400 text-xs rounded-full px-2 py-0.5">
                {card.comments.length}
              </span>
            )}
          </h3>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            {card.comments.length === 0 && (
              <p className="text-sm text-white/25">No comments yet.</p>
            )}
            {card.comments.map(c => (
              <div
                key={c._id}
                className={`rounded-lg px-3 py-2 ${c.username === username ? 'bg-rose-500/10' : 'bg-white/[0.05]'}`}
              >
                <div className="flex justify-between items-baseline gap-2 mb-1">
                  <span className={`text-[11px] font-bold ${c.username === username ? 'text-rose-400' : 'text-white/40'}`}>
                    {c.username}
                  </span>
                  <span className="text-xs text-white/20 whitespace-nowrap">
                    {new Date(c.timestamp).toLocaleString([], {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm leading-snug break-words text-slate-300">{renderCommentText(c.text, c.mentions ?? [])}</p>
              </div>
            ))}
            <div ref={commentsBottomRef} />
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <div className="relative">
              {mentionSuggestions.length > 0 && (
                <ul className={`${dropdownCls} bottom-full mb-1`}>
                  {mentionSuggestions.map(member => (
                    <li
                      key={member}
                      className={dropdownItemCls}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        const input = document.getElementById('comment-input') as HTMLInputElement;
                        const cursor = input?.selectionStart ?? commentInput.length;
                        const before = commentInput.slice(0, cursor).replace(/(?:^|\s)@(\w*)$/, (match) => {
                          const space = match.startsWith(' ') ? ' ' : '';
                          return `${space}@${member} `;
                        });
                        const after = commentInput.slice(cursor);
                        setCommentInput(before + after);
                        setMentionQuery(null);
                      }}
                    >
                      @{member}
                    </li>
                  ))}
                </ul>
              )}
              <input
                id="comment-input"
                className={inputCls}
                value={commentInput}
                onChange={e => {
                  setCommentInput(e.target.value);
                  setMentionQuery(getActiveMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length));
                }}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setMentionQuery(null); return; }
                  if (e.key === 'Enter') { setMentionQuery(null); submitComment(); }
                }}
                onBlur={() => setMentionQuery(null)}
                placeholder="Add a comment... (use @ to mention)"
              />
            </div>
            <div className="flex justify-end">
              <button
                className="bg-rose-500 hover:bg-rose-600 active:scale-[0.97] text-white text-sm px-4 py-2 rounded-lg transition-all whitespace-nowrap"
                onClick={submitComment}
              >
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
