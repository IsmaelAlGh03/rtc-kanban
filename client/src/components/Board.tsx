import { useEffect, useState } from 'react';
import { getSocket } from '../socket';
import { IBoard, IColumn, ChatMessage } from '../types';
import Chat from './Chat';
import CardModal from './CardModal';

interface Props {
  board: IBoard;
  username: string;
  onLeave: () => void;
}

export default function Board({ board, username, onLeave }: Props) {
  const [localBoard, setLocalBoard] = useState(board);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedColId, setSelectedColId] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('board:join', board._id);

    function onBoardUpdated(updated: IBoard) { setLocalBoard(updated); }
    function onChatMessage(msg: ChatMessage) { setMessages(prev => [...prev, msg]); }

    socket.on('board:updated', onBoardUpdated);
    socket.on('chat:message', onChatMessage);

    return () => {
      socket.off('board:updated', onBoardUpdated);
      socket.off('chat:message', onChatMessage);
    };
  }, [board._id]);

  function addCard(columnId: string, title: string) {
    getSocket().emit('card:add', { boardId: localBoard._id, columnId, title });
  }

  function deleteCard(columnId: string, cardId: string) {
    getSocket().emit('card:delete', { boardId: localBoard._id, columnId, cardId });
    if (cardId === selectedCardId) closeModal();
  }

  function updateCard(columnId: string, cardId: string, fields: { assignedTo?: string; urgency?: 'low' | 'medium' | 'high' }) {
    getSocket().emit('card:update', { boardId: localBoard._id, columnId, cardId, ...fields });
  }

  function addComment(columnId: string, cardId: string, text: string) {
    getSocket().emit('card:comment:add', { boardId: localBoard._id, columnId, cardId, text });
  }

  function sendMessage(text: string) {
    getSocket().emit('chat:message', { boardId: localBoard._id, text });
  }

  function openCard(colId: string, cardId: string) {
    setSelectedColId(colId);
    setSelectedCardId(cardId);
  }

  function closeModal() {
    setSelectedCardId(null);
    setSelectedColId(null);
  }

  const selectedCard = selectedCardId && selectedColId
    ? localBoard.columns.find(c => c._id === selectedColId)?.cards.find(c => c._id === selectedCardId)
    : null;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 text-white shrink-0">
        <h2 className="text-lg font-semibold">{localBoard.title}</h2>
        <button
          className="text-sm px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
          onClick={onLeave}
        >
          ← Boards
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex gap-4 p-4 overflow-x-auto flex-1 items-start">
          {localBoard.columns.map(col => (
            <Column
              key={col._id}
              column={col}
              onAddCard={addCard}
              onDeleteCard={deleteCard}
              onSelectCard={(cardId) => openCard(col._id, cardId)}
            />
          ))}
        </div>
        <Chat messages={messages} onSend={sendMessage} username={username} />
      </div>

      {selectedCard && selectedColId && (
        <CardModal
          card={selectedCard}
          columnId={selectedColId}
          username={username}
          onClose={closeModal}
          onUpdate={(fields) => updateCard(selectedColId, selectedCard._id, fields)}
          onAddComment={(text) => addComment(selectedColId, selectedCard._id, text)}
        />
      )}
    </div>
  );
}

const URGENCY_BORDER: Record<string, string> = {
  low: '#38a169',
  medium: '#d69e2e',
  high: '#e53e3e',
};

function Column({ column, onAddCard, onDeleteCard, onSelectCard }: {
  column: IColumn;
  onAddCard: (colId: string, title: string) => void;
  onDeleteCard: (colId: string, cardId: string) => void;
  onSelectCard: (cardId: string) => void;
}) {
  const [newCard, setNewCard] = useState('');

  function submit() {
    if (!newCard.trim()) return;
    onAddCard(column._id, newCard.trim());
    setNewCard('');
  }

  return (
    <div className="bg-gray-200 rounded-xl p-3 min-w-[260px] max-w-[260px] flex flex-col gap-2 max-h-[calc(100vh-110px)]">
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 px-1">
        {column.title}
      </h3>

      <div className="flex flex-col gap-2 overflow-y-auto flex-1">
        {column.cards.map(card => (
          <div
            key={card._id}
            className="bg-white rounded-lg px-3 py-2.5 flex justify-between items-start shadow-xs hover:shadow-sm transition-shadow cursor-pointer"
            style={{ borderLeft: `3px solid ${URGENCY_BORDER[card.urgency ?? 'low']}` }}
            onClick={() => onSelectCard(card._id)}
          >
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="text-sm leading-snug break-words">{card.title}</span>
              {card.assignedTo && (
                <span className="text-[11px] font-semibold text-gray-500">@{card.assignedTo}</span>
              )}
            </div>
            <button
              className="text-gray-300 hover:text-red-500 text-lg leading-none px-1 shrink-0 bg-transparent border-0 cursor-pointer transition-colors"
              onClick={e => { e.stopPropagation(); onDeleteCard(column._id, card._id); }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-1">
        <input
          className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white"
          value={newCard}
          onChange={e => setNewCard(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Add a card..."
        />
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white text-base px-2 py-1 rounded-lg transition-colors leading-none"
          onClick={submit}
        >
          +
        </button>
      </div>
    </div>
  );
}
