import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../types';
import { useProfile } from '../context/UserProfileContext';
import { gravatarUrl } from '../utils/gravatar';

interface Props {
  messages: ChatMessage[];
  username: string;
  onSend: (text: string) => void;
  onClose?: () => void;
}

function ChatAvatar({ msgUsername, isSelf }: { msgUsername: string; isSelf: boolean }) {
  const profile = useProfile(msgUsername);
  const hash = profile?.gravatarHash ?? '';
  return hash ? (
    <img src={gravatarUrl(hash, 28)} alt={msgUsername} className="w-7 h-7 rounded-full shrink-0 ring-1 ring-white/10" />
  ) : (
    <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ring-1 ring-white/10 ${isSelf ? 'bg-rose-500/30 text-rose-300' : 'bg-white/10 text-white/40'}`}>
      {msgUsername[0]?.toUpperCase()}
    </div>
  );
}

export default function Chat({ messages, username, onSend, onClose }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send() {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  }

  return (
    <div className="w-[300px] min-w-[300px] bg-[#1a1d30] border-l border-white/[0.07] flex flex-col">
      <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/40 border-b border-white/[0.07] shrink-0 flex items-center justify-between">
        Chat
        {onClose && (
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-lg leading-none transition-colors">×</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {messages.map((msg, i) => {
          const isSelf = msg.username === username;
          return (
            <div key={i} className={`flex gap-2 items-end ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
              <ChatAvatar msgUsername={msg.username} isSelf={isSelf} />
              <div
                className={`flex flex-col gap-0.5 rounded-lg px-3 py-2 text-sm max-w-[75%] ${
                  isSelf ? 'bg-rose-500/15' : 'bg-white/[0.05]'
                }`}
              >
                <span className={`text-[11px] font-bold ${isSelf ? 'text-rose-400' : 'text-white/40'}`}>
                  {msg.username}
                </span>
                <span className="break-words leading-snug text-slate-200">{msg.text}</span>
                <span className="text-[10px] text-white/20 self-end">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-white/[0.07] flex gap-2 shrink-0">
        <input
          className="flex-1 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-white/[0.06] text-slate-100 placeholder-white/25"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type a message..."
        />
        <button
          className="bg-rose-500 hover:bg-rose-600 text-white text-sm px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
          onClick={send}
        >
          Send
        </button>
      </div>
    </div>
  );
}
