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

interface Props {
  board: IBoard;
  username: string;
  initialCard?: { columnId: string; cardId: string };
  onLeave: () => void;
}

const URGENCY_BORDER: Record<string, string> = {
  low: '#38a169',
  medium: '#d69e2e',
  high: '#e53e3e',
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

  function updateCard(columnId: string, cardId: string, fields: { assignedTo?: string; urgency?: 'low' | 'medium' | 'high' }) {
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
        {boardLoading ? (
          <div className="flex gap-4 p-4 overflow-x-auto flex-1 items-start">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-xl p-3 min-w-[260px] flex flex-col gap-2">
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
              <div className="flex gap-4 p-4 overflow-x-auto flex-1 items-start">
                {columns.map(col => (
                  <Column
                    key={col._id}
                    column={col}
                    onAddCard={addCard}
                    onDeleteCard={deleteCard}
                    onSelectCard={(cardId) => openCard(col._id, cardId)}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeCard && (
                <div
                  className="bg-white rounded-lg px-3 py-2.5 shadow-lg opacity-90 min-w-[220px]"
                  style={{ borderLeft: `3px solid ${URGENCY_BORDER[activeCard.urgency ?? 'low']}` }}
                >
                  <span className="text-sm leading-snug">{activeCard.title}</span>
                  {activeCard.assignedTo && (
                    <span className="text-[11px] font-semibold text-gray-500 block">@{activeCard.assignedTo}</span>
                  )}
                </div>
              )}
              {activeColumn && (
                <div className="bg-gray-200 rounded-xl p-3 min-w-[260px] opacity-90">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 px-1">
                    {activeColumn.title}
                  </h3>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        <Chat messages={messages} onSend={sendMessage} username={username} />
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
      className="bg-gray-200 rounded-xl p-3 min-w-[260px] max-w-[260px] flex flex-col gap-2 max-h-[calc(100vh-110px)]"
    >
      <h3
        className="text-xs font-bold uppercase tracking-widest text-gray-500 px-1 cursor-grab active:cursor-grabbing select-none"
        {...attributes}
        {...listeners}
      >
        {column.title}
      </h3>

      <SortableContext items={column.cards.map(c => c._id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 overflow-y-auto flex-1">
          {column.cards.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center py-4 text-xs text-gray-400">
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    borderLeft: `3px solid ${URGENCY_BORDER[card.urgency ?? 'low']}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-lg px-3 py-2.5 flex justify-between items-start shadow-xs hover:shadow-sm transition-shadow cursor-pointer"
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className="text-sm leading-snug break-words">{card.title}</span>
        {card.assignedTo && (
          <span className="text-[11px] font-semibold text-gray-500">@{card.assignedTo}</span>
        )}
      </div>
      <button
        className="text-gray-300 hover:text-red-500 text-lg leading-none px-1 shrink-0 bg-transparent border-0 cursor-pointer transition-colors"
        onClick={e => { e.stopPropagation(); onDelete(); }}
      >
        ×
      </button>
    </div>
  );
}
