import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRef } from 'react';

export function SortableIdolTag({ idol, onRemove, onImageUpload }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: idol.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const fileInputRef = useRef(null);

  return (
    <div ref={setNodeRef} style={style} className="idol-tag animate-in">
      <div className="drag-handle" {...attributes} {...listeners}>⣿</div>
      <div className="color-dot" style={{ backgroundColor: idol.hex }}></div>
      <span className="tag-name">{idol.name}</span>
      <div className="tag-actions">
        <button className="tag-icon-btn" onClick={() => fileInputRef.current?.click()} title="画像をアップロード">📷</button>
        <button className="tag-icon-btn remove" onClick={onRemove}>✕</button>
      </div>
      <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => onImageUpload(idol.id, e)} />
    </div>
  );
}
