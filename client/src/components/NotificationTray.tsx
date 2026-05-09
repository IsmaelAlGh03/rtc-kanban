import { useEffect, useRef, useState } from 'react';
import { INotification } from '../types';
import { getSocket } from '../socket';

const API = 'http://localhost:4000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('rtc-token')}`,
  };
}

interface Props {
  onBoardsChange: () => void;
}

export default function NotificationTray({ onBoardsChange }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    fetch(`${API}/notifications`, { headers: authHeaders() })
      .then(r => r.json())
      .then(setNotifications)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const socket = getSocket();
    function onNew(notif: INotification) {
      setNotifications(prev => [notif, ...prev]);
    }
    socket.on('notification:new', onNew);
    return () => { socket.off('notification:new', onNew); };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggleOpen() {
    if (!open && unreadCount > 0) {
      fetch(`${API}/notifications/read`, { method: 'PATCH', headers: authHeaders() }).catch(() => {});
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
    setOpen(o => !o);
  }

  async function accept(notif: INotification) {
    const res = await fetch(`${API}/notifications/${notif._id}/accept`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (res.ok) {
      setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, read: true, type: 'invite_accepted' } : n));
      onBoardsChange();
    }
  }

  async function reject(notif: INotification) {
    const res = await fetch(`${API}/notifications/${notif._id}/reject`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (res.ok) {
      setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, read: true, type: 'invite_rejected' } : n));
    }
  }

  function label(n: INotification) {
    if (n.type === 'invite') return <><strong>{n.fromUsername}</strong> invited you to <strong>{n.boardTitle}</strong></>;
    if (n.type === 'invite_accepted') return <><strong>{n.fromUsername}</strong> accepted your invite to <strong>{n.boardTitle}</strong></>;
    return <><strong>{n.fromUsername}</strong> declined your invite to <strong>{n.boardTitle}</strong></>;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No notifications</p>
            ) : (
              notifications.map(n => (
                <div key={n._id} className={`px-4 py-3 border-b border-gray-50 last:border-0 ${!n.read ? 'bg-blue-50/50' : ''}`}>
                  <p className="text-sm text-gray-700 leading-snug">{label(n)}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                  {n.type === 'invite' && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => accept(n)}
                        className="text-xs px-3 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => reject(n)}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
