import { useEffect, useRef, useState } from 'react';
import { ICard } from '../types';

interface Props {
  card: ICard;
  columnId: string;
  username: string;
  members: string[];
  onClose: () => void;
  onUpdate: (fields: { assignedTo?: string; urgency?: 'low' | 'medium' | 'high' }) => void;
  onAddComment: (text: string, mentions: string[]) => void;
}

const URGENCY_CONFIG = {
  low:    { label: 'Low',    bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-500',  activeBg: 'bg-green-100'  },
  medium: { label: 'Medium', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500', activeBg: 'bg-yellow-100' },
  high:   { label: 'High',   bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-500',    activeBg: 'bg-red-100'    },
} as const;

export default function CardModal({ card, username, members, onClose, onUpdate, onAddComment }: Props) {
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
        return <span key={i} className="text-blue-600 font-semibold">{part}</span>;
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

  return (
    <div
      className="fixed inset-0 bg-black/45 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-bold text-gray-900 leading-snug flex-1">{card.title}</h2>
          <button
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none bg-transparent border-0 cursor-pointer transition-colors shrink-0"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Metadata */}
        <div className="px-5 py-4 border-b border-gray-200 flex flex-col gap-3 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 w-24 shrink-0">Added by</span>
            <span className="text-sm text-gray-800">{card.addedBy}</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 w-24 shrink-0">Assigned to</span>
            <div className="relative flex-1">
              <input
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                value={assignedInput}
                onChange={e => { setAssignedInput(e.target.value); setFocused(true); }}
                onFocus={() => setFocused(true)}
                onBlur={() => { setFocused(false); saveAssignedTo(); }}
                onKeyDown={e => { if (e.key === 'Enter') { setFocused(false); saveAssignedTo(); } }}
                placeholder="Unassigned"
              />
              {suggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {suggestions.map(member => (
                    <li
                      key={member}
                      className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => selectSuggestion(member)}
                    >
                      {member}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 w-24 shrink-0">Urgency</span>
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
                        ? `${cfg.activeBg} ${cfg.text} ${cfg.border}`
                        : 'bg-transparent text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="flex flex-col flex-1 overflow-hidden px-5 py-4 gap-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2 shrink-0">
            Comments
            {card.comments.length > 0 && (
              <span className="bg-gray-100 text-gray-500 text-[10px] rounded-full px-2 py-0.5">
                {card.comments.length}
              </span>
            )}
          </h3>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2">
            {card.comments.length === 0 && (
              <p className="text-sm text-gray-400">No comments yet.</p>
            )}
            {card.comments.map(c => (
              <div
                key={c._id}
                className={`rounded-lg px-3 py-2 ${c.username === username ? 'bg-blue-50' : 'bg-gray-50'}`}
              >
                <div className="flex justify-between items-baseline gap-2 mb-1">
                  <span className={`text-[11px] font-bold ${c.username === username ? 'text-blue-700' : 'text-gray-500'}`}>
                    {c.username}
                  </span>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {new Date(c.timestamp).toLocaleString([], {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm leading-snug break-words">{renderCommentText(c.text, c.mentions ?? [])}</p>
              </div>
            ))}
            <div ref={commentsBottomRef} />
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <div className="relative">
              {mentionSuggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {mentionSuggestions.map(member => (
                    <li
                      key={member}
                      className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
                className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
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
