import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRef, useState } from 'react';

export function SortableIdolTag({ idol, onRemove, onImageUpload, onImageAdjust }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: idol.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const fileInputRef = useRef(null);
  const [showAdjust, setShowAdjust] = useState(false);

  const scale = idol.imgScale ?? 1;
  const offX = idol.imgOffsetX ?? 0;
  const offY = idol.imgOffsetY ?? 0;

  return (
    <div ref={setNodeRef} style={style} className="idol-tag animate-in">
      <div className="idol-tag-row">
        <div className="drag-handle" {...attributes} {...listeners}>⣿</div>
        <div className="color-dot" style={{ backgroundColor: idol.hex }}></div>
        <span className="tag-name">{idol.name}</span>
        <div className="tag-actions">
          {idol.image && (
            <button
              className={`tag-icon-btn ${showAdjust ? 'active' : ''}`}
              onClick={() => setShowAdjust(s => !s)}
              title="画像位置を調整"
            >⚙︎</button>
          )}
          <button className="tag-icon-btn" onClick={() => fileInputRef.current?.click()} title="画像をアップロード">📷</button>
          <button className="tag-icon-btn remove" onClick={onRemove}>✕</button>
        </div>
        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => onImageUpload(idol.id, e)} />
      </div>
      {idol.image && showAdjust && (
        <div className="idol-img-adjust">
          <div className="adjust-row">
            <label>サイズ {Math.round(scale * 100)}%</label>
            <input
              type="range" min="40" max="200"
              value={Math.round(scale * 100)}
              onChange={e => onImageAdjust(idol.id, { imgScale: e.target.value / 100 })}
              className="range-input"
            />
          </div>
          <div className="adjust-row">
            <label>横 {offX > 0 ? '+' : ''}{offX}%</label>
            <input
              type="range" min="-50" max="50"
              value={offX}
              onChange={e => onImageAdjust(idol.id, { imgOffsetX: Number(e.target.value) })}
              className="range-input"
            />
          </div>
          <div className="adjust-row">
            <label>縦 {offY > 0 ? '+' : ''}{offY}%</label>
            <input
              type="range" min="-30" max="30"
              value={offY}
              onChange={e => onImageAdjust(idol.id, { imgOffsetY: Number(e.target.value) })}
              className="range-input"
            />
          </div>
          <button
            className="reset-adjust-btn"
            onClick={() => onImageAdjust(idol.id, { imgScale: 1, imgOffsetX: 0, imgOffsetY: 0 })}
          >リセット</button>
        </div>
      )}
    </div>
  );
}
