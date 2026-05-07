import { useState } from 'react';
import { IBoard } from '../types';

const PALETTE = [
  // Lively
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#ec4899', '#8b5cf6',
  // Pastel
  '#fca5a5', '#fdba74', '#fde68a', '#86efac', '#67e8f9', '#a5b4fc', '#f9a8d4', '#c4b5fd',
];

function isLight(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

interface Props {
  board: IBoard;
  onClose: () => void;
  onSave: (updated: Pick<IBoard, 'title' | 'description' | 'color'>) => Promise<void>;
  onDelete: () => Promise<void>;
}

export default function BoardModal({ board, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description ?? '');
  const [color, setColor] = useState(board.color ?? '');
  const [saving, setSaving] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm'>('idle');
  const [deleting, setDeleting] = useState(false);

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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">
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
            {/* No color option */}
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

        {/* Share — coming soon */}
        <div className="flex flex-col gap-1 opacity-50 select-none">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Share</label>
          <div className="border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-400">
            Coming soon
          </div>
        </div>

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
