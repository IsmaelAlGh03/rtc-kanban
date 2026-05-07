import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../types';

interface Props {
  messages: ChatMessage[];
  username: string;
  onSend: (text: string) => void;
}

export default function Chat({ messages, username, onSend }: Props) {
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
    <div className="w-[300px] min-w-[300px] bg-white border-l border-gray-200 flex flex-col">
      <div className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-200 shrink-0">
        Chat
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col gap-0.5 rounded-lg px-3 py-2 text-sm ${
              msg.username === username
                ? 'bg-blue-50 self-end max-w-[85%]'
                : 'bg-gray-50'
            }`}
          >
            <span className={`text-[11px] font-bold ${msg.username === username ? 'text-blue-700' : 'text-gray-500'}`}>
              {msg.username}
            </span>
            <span className="break-words leading-snug">{msg.text}</span>
            <span className="text-[10px] text-gray-400 self-end">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-gray-200 flex gap-2 shrink-0">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type a message..."
        />
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
          onClick={send}
        >
          Send
        </button>
      </div>
    </div>
  );
}
