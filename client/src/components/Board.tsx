import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getSocket } from '../socket';
import { toast } from 'sonner';
import { IBoard, ICard, IColumn, ChatMessage } from '../types';
import Chat from './Chat';
import CardModal from './CardModal';
import { useProfile } from '../context/UserProfileContext';
import { gravatarUrl } from '../utils/gravatar';

function MemberAvatar({ memberUsername }: { memberUsername: string }) {
  const profile = useProfile(memberUsername);
  const hash = profile?.gravatarHash ?? '';
  const label = profile?.displayName || memberUsername;
  return (
    <div title={`${label} (@${memberUsername})`} className="shrink-0">
      {hash ? (
        <img src={gravatarUrl(hash, 28)} alt={label} className="w-7 h-7 rounded-full ring-2 ring-[#1a1d30]" />
      ) : (
        <div className="w-7 h-7 rounded-full ring-2 ring-[#1a1d30] bg-white/10 flex items-center justify-center text-xs font-bold text-white/40">
          {memberUsername[0]?.toUpperCase()}
        </div>
      )}
    </div>
  );
}

interface Props {
  board: IBoard;
  username: string;
  initialCard?: { columnId: string; cardId: string };
  onLeave: () => void;
}

const URGENCY_STRIP: Record<string, { color: string; bg: string; shadow: string }> = {
  low:    { color: '#10b981', bg: '#21243a', shadow: '-2px 0 6px 0px rgba(16,185,129,0.15)' },
  medium: { color: '#f59e0b', bg: '#22243c', shadow: '-3px 0 8px 1px rgba(245,158,11,0.35), -1px 0 4px 0px rgba(245,158,11,0.20)' },
  high:   { color: '#f43f5e', bg: '#251f2e', shadow: '-4px 0 14px 2px rgba(244,63,94,0.50), -2px 0 28px 3px rgba(244,63,94,0.25), -1px 0 6px 0px rgba(244,63,94,0.60)' },
};

function findCardPosition(cardId: string, cols: IColumn[]) {
  for (const col of cols) {
    const index = col.cards.findIndex(c => c._id === cardId);
    if (index !== -1) return { columnId: col._id, index };
  }
  return null;
}

export default function Board({ board, username, initialCard, onLeave }: Props) {
  const [localBoard, setLocalBoard] = useState(board);
  const [columns, setColumns] = useState(board.columns);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(initialCard?.cardId ?? null);
  const [selectedColId, setSelectedColId] = useState<string | null>(initialCard?.columnId ?? null);
  const [activeCard, setActiveCard] = useState<ICard | null>(null);
  const [activeColumn, setActiveColumn] = useState<IColumn | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const cardOrigin = useRef<{ cardId: string; columnId: string } | null>(null);
  const disconnectToastId = useRef<string | number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    const socket = getSocket();
    socket.emit('board:join', board._id);

    function onBoardUpdated(updated: IBoard) {
      setLocalBoard(updated);
      setColumns(updated.columns);
      setBoardLoading(false);
    }
    function onChatMessage(msg: ChatMessage) {
      setMessages(prev => [...prev, msg]);
    }
    function onDisconnect() {
      disconnectToastId.current = toast.error('Connection lost. Reconnecting…', { duration: Infinity });
    }
    function onReconnect() {
      if (disconnectToastId.current !== null) {
        toast.dismiss(disconnectToastId.current);
        disconnectToastId.current = null;
        toast.success('Reconnected');
      }
    }
    function onBoardError(msg: string) {
      toast.error(msg, { duration: 6000 });
    }

    socket.on('board:updated', onBoardUpdated);
    socket.on('chat:message', onChatMessage);
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onReconnect);
    socket.on('board:error', onBoardError);

    return () => {
      socket.off('board:updated', onBoardUpdated);
      socket.off('chat:message', onChatMessage);
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onReconnect);
      socket.off('board:error', onBoardError);
    };
  }, [board._id]);

  function addCard(columnId: string, title: string) {
    getSocket().emit('card:add', { boardId: localBoard._id, columnId, title });
  }

  function deleteCard(columnId: string, cardId: string) {
    getSocket().emit('card:delete', { boardId: localBoard._id, columnId, cardId });
    if (cardId === selectedCardId) closeModal();
    toast.error('Card deleted');
  }

  function updateCard(columnId: string, cardId: string, fields: { assignedTo?: string; urgency?: 'low' | 'medium' | 'high'; dueDate?: string | null }) {
    getSocket().emit('card:update', { boardId: localBoard._id, columnId, cardId, ...fields });
  }

  function addComment(columnId: string, cardId: string, text: string, mentions: string[]) {
    getSocket().emit('card:comment:add', { boardId: localBoard._id, columnId, cardId, text, mentions });
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
    ? columns.find(c => c._id === selectedColId)?.cards.find(c => c._id === selectedCardId)
    : null;

  function onDragStart({ active }: DragStartEvent) {
    if (active.data.current?.type === 'card') {
      setActiveCard(active.data.current.card);
      cardOrigin.current = { cardId: active.id as string, columnId: active.data.current.columnId };
    } else if (active.data.current?.type === 'column') {
      setActiveColumn(active.data.current.column);
    }
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || active.data.current?.type !== 'card') return;

    const activeCardId = active.id as string;
    const currentPos = findCardPosition(activeCardId, columns);
    if (!currentPos) return;

    let overColId: string;
    if (over.data.current?.type === 'column') {
      overColId = over.id as string;
    } else if (over.data.current?.type === 'card') {
      overColId = over.data.current.columnId as string;
    } else {
      return;
    }

    if (currentPos.columnId === overColId) return;

    setColumns(cols => {
      const fromCol = cols.find(c => c._id === currentPos.columnId);
      const toCol = cols.find(c => c._id === overColId);
      if (!fromCol || !toCol) return cols;

      const cardIdx = fromCol.cards.findIndex(c => c._id === activeCardId);
      if (cardIdx === -1) return cols;
      const card = fromCol.cards[cardIdx];

      let insertIdx: number;
      if (over.data.current?.type === 'card') {
        insertIdx = toCol.cards.findIndex(c => c._id === over.id);
        if (insertIdx === -1) insertIdx = toCol.cards.length;
      } else {
        insertIdx = toCol.cards.length;
      }

      return cols.map(col => {
        if (col._id === currentPos.columnId) {
          return { ...col, cards: col.cards.filter(c => c._id !== activeCardId) };
        }
        if (col._id === overColId) {
          const newCards = [...col.cards];
          newCards.splice(insertIdx, 0, card);
          return { ...col, cards: newCards };
        }
        return col;
      });
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const origin = cardOrigin.current;
    setActiveCard(null);
    setActiveColumn(null);
    cardOrigin.current = null;

    if (!over) return;

    if (active.data.current?.type === 'column') {
      const fromIdx = columns.findIndex(c => c._id === active.id);
      const toIdx = columns.findIndex(c => c._id === over.id);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
      setColumns(cols => arrayMove(cols, fromIdx, toIdx));
      getSocket().emit('column:move', {
        boardId: localBoard._id,
        columnId: active.id as string,
        toIndex: toIdx,
      });
      return;
    }

    if (active.data.current?.type === 'card' && origin) {
      const activeCardId = active.id as string;
      const currentPos = findCardPosition(activeCardId, columns);
      if (!currentPos) return;

      if (currentPos.columnId === origin.columnId) {
        if (over.data.current?.type !== 'card' || over.id === active.id) return;
        const col = columns.find(c => c._id === currentPos.columnId);
        if (!col) return;
        const fromIdx = col.cards.findIndex(c => c._id === activeCardId);
        const toIdx = col.cards.findIndex(c => c._id === over.id);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
        setColumns(cols => cols.map(c =>
          c._id === currentPos.columnId ? { ...c, cards: arrayMove(c.cards, fromIdx, toIdx) } : c
        ));
        getSocket().emit('card:move', {
          boardId: localBoard._id,
          cardId: activeCardId,
          fromColumnId: origin.columnId,
          toColumnId: currentPos.columnId,
          toIndex: toIdx,
        });
        return;
      }

      // Cross-column move already applied in onDragOver — just emit
      getSocket().emit('card:move', {
        boardId: localBoard._id,
        cardId: activeCardId,
        fromColumnId: origin.columnId,
        toColumnId: currentPos.columnId,
        toIndex: currentPos.index,
      });
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#0d0f1a]">
      <div className="flex items-center px-4 sm:px-6 py-3 bg-[#1a1d30] border-b border-white/[0.07] text-white shrink-0 gap-3 flex-wrap">
        <h2 className="text-base font-bold tracking-tight shrink-0 text-slate-100">{localBoard.title}</h2>
        <div className="relative flex-1 min-w-[120px] max-w-xs">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            className="w-full bg-white/[0.06] border border-white/10 text-slate-100 placeholder-white/25 text-sm rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 transition-colors"
            placeholder="Search cards…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="hidden sm:flex items-center -space-x-2 shrink-0">
          {[localBoard.owner, ...localBoard.members].map(m => (
            <MemberAvatar key={m} memberUsername={m} />
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            className="md:hidden p-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] transition-colors"
            onClick={() => setChatOpen(true)}
            aria-label="Open chat"
          >
            <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <button
            className="text-sm px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:bg-white/[0.06] transition-colors"
            onClick={onLeave}
          >
            ← Boards
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {boardLoading ? (
          <div className="flex gap-3 p-4 overflow-x-auto flex-1 items-start">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-[#171929] border border-white/[0.06] rounded-xl p-3 min-w-[260px] flex flex-col gap-2">
                <div className="skeleton h-4 w-24 rounded" />
                <div className="skeleton h-16 rounded-lg" />
                <div className="skeleton h-16 rounded-lg" />
                <div className="skeleton h-8 rounded-lg mt-auto" />
              </div>
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={columns.map(c => c._id)} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-3 p-4 overflow-x-auto flex-1 items-start">
                {columns.map(col => {
                  const displayCol = searchQuery.trim()
                    ? { ...col, cards: col.cards.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())) }
                    : col;
                  return (
                  <Column
                    key={col._id}
                    column={displayCol}
                    onAddCard={addCard}
                    onDeleteCard={deleteCard}
                    onSelectCard={(cardId) => openCard(col._id, cardId)}
                  />
                  );
                })}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeCard && (() => {
                const strip = URGENCY_STRIP[activeCard.urgency ?? 'low'];
                return (
                  <div
                    className="rounded-lg py-2.5 pr-3 shadow-lg opacity-90 min-w-[220px] relative overflow-visible"
                    style={{ background: strip.bg, paddingLeft: '16px' }}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ background: strip.color, boxShadow: strip.shadow }} />
                    <span className="text-sm leading-snug text-slate-200">{activeCard.title}</span>
                    {activeCard.assignedTo && (
                      <span className="text-[11px] font-semibold text-white/40 block">@{activeCard.assignedTo}</span>
                    )}
                  </div>
                );
              })()}
              {activeColumn && (
                <div className="bg-[#171929] border border-white/[0.06] rounded-xl p-3 min-w-[260px] opacity-90">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-1">
                    {activeColumn.title}
                  </h3>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Desktop chat panel */}
        <div className="hidden md:flex">
          <Chat messages={messages} onSend={sendMessage} username={username} />
        </div>

        {/* Mobile chat drawer */}
        <div className={`md:hidden fixed inset-0 z-40 transition-opacity duration-200 ${chatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setChatOpen(false)} />
          <div className={`absolute top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-[#1a1d30] flex flex-col transition-transform duration-200 ${chatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <Chat messages={messages} onSend={sendMessage} username={username} onClose={() => setChatOpen(false)} />
          </div>
        </div>
      </div>

      {selectedCard && selectedColId && (
        <CardModal
          card={selectedCard}
          columnId={selectedColId}
          username={username}
          members={[localBoard.owner, ...localBoard.members]}
          onClose={closeModal}
          onUpdate={(fields) => updateCard(selectedColId, selectedCard._id, fields)}
          onAddComment={(text, mentions) => addComment(selectedColId, selectedCard._id, text, mentions)}
        />
      )}
    </div>
  );
}

function Column({ column, onAddCard, onDeleteCard, onSelectCard }: {
  column: IColumn;
  onAddCard: (colId: string, title: string) => void;
  onDeleteCard: (colId: string, cardId: string) => void;
  onSelectCard: (cardId: string) => void;
}) {
  const [newCard, setNewCard] = useState('');

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column._id,
    data: { type: 'column', column },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  function submit() {
    if (!newCard.trim()) return;
    onAddCard(column._id, newCard.trim());
    setNewCard('');
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[#171929] border border-white/[0.06] rounded-xl p-3 min-w-[240px] max-w-[240px] sm:min-w-[260px] sm:max-w-[260px] flex flex-col gap-2 max-h-[calc(100vh-110px)]"
    >
      <h3
        className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-1 cursor-grab active:cursor-grabbing select-none"
        {...attributes}
        {...listeners}
      >
        {column.title}
      </h3>

      <SortableContext items={column.cards.map(c => c._id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 overflow-y-auto flex-1 pl-6 pr-4">
          {column.cards.length === 0 ? (
            <div className="border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center py-4 text-xs text-white/25">
              No cards yet
            </div>
          ) : (
            column.cards.map(card => (
              <SortableCard
                key={card._id}
                card={card}
                columnId={column._id}
                onDelete={() => onDeleteCard(column._id, card._id)}
                onSelect={() => onSelectCard(card._id)}
              />
            ))
          )}
        </div>
      </SortableContext>

      <div className="flex gap-1">
        <input
          className="flex-1 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-white/[0.05] text-slate-200 placeholder-white/25"
          value={newCard}
          onChange={e => setNewCard(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Add a card..."
        />
        <button
          className="bg-rose-500 hover:bg-rose-600 text-white text-base px-2 py-1 rounded-lg transition-colors leading-none"
          onClick={submit}
        >
          +
        </button>
      </div>
    </div>
  );
}

function dueDateLabel(dueDate: string): { label: string; className: string } {
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  const label = due.toLocaleDateString([], { month: 'short', day: 'numeric' });
  if (diff < 0) return { label, className: 'bg-rose-500/15 text-rose-400' };
  if (diff === 0) return { label: 'Today', className: 'bg-amber-500/15 text-amber-400' };
  return { label, className: 'bg-white/[0.08] text-white/35' };
}

function SortableCard({ card, columnId, onDelete, onSelect }: {
  card: ICard;
  columnId: string;
  onDelete: () => void;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card._id,
    data: { type: 'card', card, columnId },
  });

  const strip = URGENCY_STRIP[card.urgency ?? 'low'];
  const due = card.dueDate ? dueDateLabel(card.dueDate) : null;

  const wrapperStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    background: strip.bg,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...wrapperStyle, paddingLeft: '16px' }}
      className="rounded-lg pr-3 py-2.5 flex justify-between items-start cursor-pointer relative overflow-visible"
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
        style={{ background: strip.color, boxShadow: strip.shadow }}
      />
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className="text-sm leading-snug break-words text-slate-200">{card.title}</span>
        {card.assignedTo && (
          <span className="text-[11px] font-semibold text-white/40">@{card.assignedTo}</span>
        )}
        {due && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded self-start mt-0.5 ${due.className}`}>
            {due.label}
          </span>
        )}
      </div>
      <button
        className="text-white/20 hover:text-rose-400 text-lg leading-none px-1 shrink-0 bg-transparent border-0 cursor-pointer transition-colors"
        onClick={e => { e.stopPropagation(); onDelete(); }}
      >
        ×
      </button>
    </div>
  );
}
