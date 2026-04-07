import { useState, useCallback, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EmailBlock } from '../../types';
import Modal from '../../components/Modal';

export interface EmailBuilderProps {
  value: EmailBlock[];
  onChange: (blocks: EmailBlock[]) => void;
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

const blockDefaults: Record<string, Partial<EmailBlock>> = {
  text: { content: 'Edit this text...', settings: { padding: { top: 16, bottom: 16, left: 16, right: 16 } } },
  image: { settings: { url: '', alt: '', linkUrl: '', alignment: 'center' } },
  button: { settings: { label: 'Click Here', url: '#', color: '#4f46e5', alignment: 'center' } },
  divider: { settings: { color: '#e5e7eb', spacingTop: 8, spacingBottom: 8 } },
  spacer: { settings: { height: 24 } },
  columns: { settings: { columns: [{ blocks: [] }, { blocks: [] }] } },
  html: { content: '<!-- Enter HTML here -->' },
};

export function renderBlocksToHtml(blocks: EmailBlock[]): string {
  const renderBlock = (block: EmailBlock): string => {
    const s = block.settings || {};
    switch (block.type) {
      case 'text': {
        const p = s.padding || { top: 16, bottom: 16, left: 16, right: 16 };
        return `<div style="padding:${p.top}px ${p.right}px ${p.bottom}px ${p.left}px;font-family:Arial,sans-serif;font-size:14px;color:#374151;line-height:1.6;">${block.content || ''}</div>`;
      }
      case 'image': {
        const align = s.alignment || 'center';
        const textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
        const img = s.url
          ? `<img src="${s.url}" alt="${s.alt || ''}" style="max-width:100%;height:auto;display:inline-block;" />`
          : `<div style="background:#f3f4f6;padding:40px;text-align:center;color:#9ca3af;font-family:Arial,sans-serif;">[Image]</div>`;
        const content = s.linkUrl ? `<a href="${s.linkUrl}" style="display:block;">${img}</a>` : img;
        return `<div style="text-align:${textAlign};padding:8px 16px;">${content}</div>`;
      }
      case 'button': {
        const align = s.alignment || 'center';
        const textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
        return `<div style="text-align:${textAlign};padding:12px 16px;"><a href="${s.url || '#'}" style="display:inline-block;background-color:${s.color || '#4f46e5'};color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">${s.label || 'Click Here'}</a></div>`;
      }
      case 'divider': {
        return `<div style="padding:${s.spacingTop || 8}px 16px ${s.spacingBottom || 8}px;"><hr style="border:none;border-top:1px solid ${s.color || '#e5e7eb'};margin:0;" /></div>`;
      }
      case 'spacer': {
        return `<div style="height:${s.height || 24}px;line-height:${s.height || 24}px;">&nbsp;</div>`;
      }
      case 'columns': {
        const cols = s.columns || [{ blocks: [] }, { blocks: [] }];
        const colHtml = cols.map((col: any) => `<td style="width:50%;vertical-align:top;padding:8px;">${(col.blocks || []).map(renderBlock).join('')}</td>`).join('');
        return `<table style="width:100%;border-collapse:collapse;"><tr>${colHtml}</tr></table>`;
      }
      case 'html': {
        return block.content || '';
      }
      default:
        return '';
    }
  };

  const body = blocks.map(renderBlock).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#f9fafb;"><table style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;">${body.replace(/<div/g, '<tr><td').replace(/<\/div>/g, '</td></tr>').replace(/<table/g, '<tr><td><table').replace(/<\/table>/g, '</table></td></tr>')}</table></body></html>`;
}

const paletteItems = [
  { type: 'text', label: 'Text', icon: 'T' },
  { type: 'image', label: 'Image', icon: '🖼' },
  { type: 'button', label: 'Button', icon: '▶' },
  { type: 'divider', label: 'Divider', icon: '—' },
  { type: 'spacer', label: 'Spacer', icon: '↕' },
  { type: 'columns', label: 'Columns', icon: '⊞' },
  { type: 'html', label: 'HTML', icon: '<>' },
];

function PaletteItem({ type, label, icon }: { type: string; label: string; icon: string }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('blockType', type)}
      className="flex flex-col items-center gap-1 p-3 bg-white border border-gray-200 rounded-lg cursor-grab hover:border-indigo-400 hover:bg-indigo-50 transition-colors select-none"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}

function BlockRenderer({ block, isSelected }: { block: EmailBlock; isSelected: boolean }) {
  const s = block.settings || {};

  switch (block.type) {
    case 'text':
      return (
        <div
          className="min-h-8 text-sm text-gray-700"
          style={{ padding: `${s.padding?.top || 16}px ${s.padding?.right || 16}px ${s.padding?.bottom || 16}px ${s.padding?.left || 16}px` }}
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: block.content || '' }}
        />
      );
    case 'image':
      return (
        <div className={`p-4 text-${s.alignment || 'center'}`}>
          {s.url ? (
            <img src={s.url} alt={s.alt || ''} className="max-w-full h-auto inline-block" />
          ) : (
            <div className="bg-gray-100 p-8 text-center text-gray-400 text-sm rounded">
              Drop image URL in settings panel
            </div>
          )}
        </div>
      );
    case 'button':
      return (
        <div className={`p-4 text-${s.alignment || 'center'}`}>
          <span
            className="inline-block px-6 py-3 rounded-md text-white text-sm font-bold cursor-default"
            style={{ backgroundColor: s.color || '#4f46e5' }}
          >
            {s.label || 'Click Here'}
          </span>
        </div>
      );
    case 'divider':
      return (
        <div style={{ paddingTop: s.spacingTop || 8, paddingBottom: s.spacingBottom || 8 }} className="px-4">
          <hr style={{ borderColor: s.color || '#e5e7eb', borderTopWidth: 1 }} />
        </div>
      );
    case 'spacer':
      return <div style={{ height: s.height || 24 }} className="bg-gray-50 border-t border-b border-dashed border-gray-200 flex items-center justify-center">
        <span className="text-xs text-gray-300">{s.height || 24}px spacer</span>
      </div>;
    case 'columns':
      return (
        <div className="flex gap-2 p-2">
          <div className="flex-1 border border-dashed border-gray-300 min-h-16 rounded p-2 bg-gray-50 text-center text-xs text-gray-400">Column 1</div>
          <div className="flex-1 border border-dashed border-gray-300 min-h-16 rounded p-2 bg-gray-50 text-center text-xs text-gray-400">Column 2</div>
        </div>
      );
    case 'html':
      return (
        <div className="p-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded p-1 mb-1 text-xs text-yellow-700">Raw HTML</div>
          <div dangerouslySetInnerHTML={{ __html: block.content || '' }} />
        </div>
      );
    default:
      return null;
  }
}

function SortableBlock({
  block,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  block: EmailBlock;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const [hovered, setHovered] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative border-2 rounded transition-colors ${
        isSelected ? 'border-indigo-500' : 'border-transparent'
      } ${hovered ? 'border-indigo-300' : ''}`}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center text-gray-300 hover:text-gray-500 cursor-grab z-10"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 4h2v2H9V4zm4 0h2v2h-2V4zM9 8h2v2H9V8zm4 0h2v2h-2V8zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2zm-4 4h2v2H9v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </div>

      {/* Action buttons on hover */}
      {(hovered || isSelected) && (
        <div className="absolute top-1 right-1 flex gap-1 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="bg-white border border-gray-200 rounded p-1 text-gray-500 hover:text-indigo-600 shadow-sm"
            title="Duplicate"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="bg-white border border-gray-200 rounded p-1 text-gray-500 hover:text-red-600 shadow-sm"
            title="Delete"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      <div className="pl-6">
        <BlockRenderer block={block} isSelected={isSelected} />
      </div>
    </div>
  );
}

function SettingsPanel({
  block,
  onChange,
}: {
  block: EmailBlock;
  onChange: (b: EmailBlock) => void;
}) {
  const s = block.settings || {};

  const updateSettings = (updates: Record<string, any>) => {
    onChange({ ...block, settings: { ...s, ...updates } });
  };

  const AlignmentButtons = ({ value, onSet }: { value: string; onSet: (v: string) => void }) => (
    <div className="flex gap-1">
      {['left', 'center', 'right'].map((a) => (
        <button
          key={a}
          onClick={() => onSet(a)}
          className={`px-2 py-1 text-xs rounded border transition-colors ${value === a ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
        >
          {a.charAt(0).toUpperCase() + a.slice(1)}
        </button>
      ))}
    </div>
  );

  switch (block.type) {
    case 'text':
      return <p className="text-xs text-gray-500">Click the text block to edit inline.</p>;

    case 'image':
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Image URL</label>
            <input
              type="url"
              value={s.url || ''}
              onChange={(e) => updateSettings({ url: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Alt Text</label>
            <input
              type="text"
              value={s.alt || ''}
              onChange={(e) => updateSettings({ alt: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Link URL</label>
            <input
              type="url"
              value={s.linkUrl || ''}
              onChange={(e) => updateSettings({ linkUrl: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Alignment</label>
            <AlignmentButtons value={s.alignment || 'center'} onSet={(v) => updateSettings({ alignment: v })} />
          </div>
        </div>
      );

    case 'button':
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Label</label>
            <input
              type="text"
              value={s.label || ''}
              onChange={(e) => updateSettings({ label: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">URL</label>
            <input
              type="url"
              value={s.url || ''}
              onChange={(e) => updateSettings({ url: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={s.color || '#4f46e5'}
                onChange={(e) => updateSettings({ color: e.target.value })}
                className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
              />
              <span className="text-xs text-gray-500">{s.color || '#4f46e5'}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Alignment</label>
            <AlignmentButtons value={s.alignment || 'center'} onSet={(v) => updateSettings({ alignment: v })} />
          </div>
        </div>
      );

    case 'divider':
      return (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={s.color || '#e5e7eb'}
                onChange={(e) => updateSettings({ color: e.target.value })}
                className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Top spacing (px)</label>
              <input
                type="number"
                value={s.spacingTop || 8}
                onChange={(e) => updateSettings({ spacingTop: Number(e.target.value) })}
                className="w-16 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Bottom spacing (px)</label>
              <input
                type="number"
                value={s.spacingBottom || 8}
                onChange={(e) => updateSettings({ spacingBottom: Number(e.target.value) })}
                className="w-16 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      );

    case 'spacer':
      return (
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Height (px)</label>
          <input
            type="number"
            value={s.height || 24}
            onChange={(e) => updateSettings({ height: Number(e.target.value) })}
            className="w-20 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      );

    case 'html':
      return (
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">HTML Content</label>
          <div className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
            HTML is rendered directly. Use with caution.
          </div>
          <textarea
            value={block.content || ''}
            onChange={(e) => onChange({ ...block, content: e.target.value })}
            rows={8}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      );

    default:
      return <p className="text-xs text-gray-400">Select a block to edit its settings.</p>;
  }
}

export default function EmailBuilder({ value, onChange }: EmailBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const canvasRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const selectedBlock = value.find((b) => b.id === selectedId) || null;

  const handleDragStart = (e: DragStartEvent) => {
    setDragActiveId(String(e.active.id));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = e;
    if (!over) return;
    if (active.id !== over.id) {
      const oldIndex = value.findIndex((b) => b.id === active.id);
      const newIndex = value.findIndex((b) => b.id === over.id);
      onChange(arrayMove(value, oldIndex, newIndex));
    }
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const blockType = e.dataTransfer.getData('blockType');
    if (!blockType) return;
    const defaults = blockDefaults[blockType] || {};
    const newBlock: EmailBlock = {
      id: generateId(),
      type: blockType as EmailBlock['type'],
      ...defaults,
    };
    onChange([...value, newBlock]);
    setSelectedId(newBlock.id);
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const duplicateBlock = (id: string) => {
    const idx = value.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const copy = { ...value[idx], id: generateId() };
    const next = [...value];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  };

  const deleteBlock = (id: string) => {
    onChange(value.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateBlock = (updated: EmailBlock) => {
    onChange(value.map((b) => (b.id === updated.id ? updated : b)));
  };

  const previewHtml = `<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#f9fafb;">${value.map(block => {
    const s = block.settings || {};
    switch (block.type) {
      case 'text': return `<div style="padding:${s.padding?.top || 16}px ${s.padding?.right || 16}px ${s.padding?.bottom || 16}px ${s.padding?.left || 16}px;font-family:Arial,sans-serif;font-size:14px;color:#374151;line-height:1.6;">${block.content || ''}</div>`;
      case 'image': {
        const align = s.alignment || 'center';
        const img = s.url ? `<img src="${s.url}" alt="${s.alt||''}" style="max-width:100%;height:auto;" />` : `<div style="background:#f3f4f6;padding:40px;text-align:center;color:#9ca3af;">[Image placeholder]</div>`;
        return `<div style="text-align:${align};padding:8px 16px;">${img}</div>`;
      }
      case 'button': return `<div style="text-align:${s.alignment||'center'};padding:12px 16px;"><a href="${s.url||'#'}" style="display:inline-block;background:${s.color||'#4f46e5'};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">${s.label||'Click Here'}</a></div>`;
      case 'divider': return `<div style="padding:${s.spacingTop||8}px 16px ${s.spacingBottom||8}px;"><hr style="border:none;border-top:1px solid ${s.color||'#e5e7eb'};" /></div>`;
      case 'spacer': return `<div style="height:${s.height||24}px;"></div>`;
      case 'html': return block.content || '';
      default: return '';
    }
  }).join('')}</body></html>`;

  return (
    <div className="flex gap-0 h-full min-h-96">
      {/* Left palette */}
      <div className="w-40 flex-shrink-0 bg-gray-50 border-r border-gray-200 p-3">
        <p className="text-xs font-medium text-gray-500 uppercase mb-3">Blocks</p>
        <div className="grid grid-cols-2 gap-1.5">
          {paletteItems.map((item) => (
            <PaletteItem key={item.type} {...item} />
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex justify-end">
          <button
            onClick={() => setPreviewOpen(true)}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1.5 border border-indigo-300 rounded-md px-3 py-1 hover:bg-indigo-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview
          </button>
        </div>

        <div
          ref={canvasRef}
          className="flex-1 overflow-y-auto bg-gray-100 p-6"
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
          <div className="max-w-2xl mx-auto bg-white shadow-sm min-h-64">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={value.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                {value.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm border-2 border-dashed border-gray-300 m-4 rounded">
                    <svg className="w-8 h-8 mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Drag blocks from the left panel to start building
                  </div>
                ) : (
                  value.map((block) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onDuplicate={() => duplicateBlock(block.id)}
                      onDelete={() => deleteBlock(block.id)}
                    />
                  ))
                )}
              </SortableContext>
              <DragOverlay>
                {dragActiveId && (
                  <div className="bg-white border-2 border-indigo-400 rounded shadow-lg p-3 text-sm text-gray-600 opacity-80">
                    Moving block...
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      </div>

      {/* Right settings panel */}
      <div className="w-64 flex-shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-200">
          <p className="text-sm font-semibold text-gray-800">
            {selectedBlock ? `${selectedBlock.type.charAt(0).toUpperCase() + selectedBlock.type.slice(1)} Settings` : 'Settings'}
          </p>
        </div>
        <div className="p-4">
          {selectedBlock ? (
            <SettingsPanel block={selectedBlock} onChange={updateBlock} />
          ) : (
            <p className="text-xs text-gray-400">Select a block to configure its settings.</p>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title="Email Preview" size="xl">
        <div className="flex gap-2 mb-4">
          {(['desktop', 'mobile'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setPreviewMode(mode)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium capitalize transition-colors ${previewMode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="flex justify-center bg-gray-100 p-4 rounded-lg">
          <iframe
            srcDoc={previewHtml}
            style={{
              width: previewMode === 'mobile' ? 375 : 600,
              height: 500,
              border: 'none',
              borderRadius: 4,
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
            title="Email Preview"
          />
        </div>
      </Modal>
    </div>
  );
}
