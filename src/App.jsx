import { useState, useMemo, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  TouchSensor
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { BRANDS, BRAND_LIST } from './constants/brands';
import { IDOLS } from './constants/idols';
import { getUnitsByBrand, UNITS } from './constants/units';

const TEMPLATES = [
  { id: 'standard', name: 'Standard', description: '定番・シンプル' },
  { id: 'dynamic', name: 'Dynamic', description: '躍動・斜線' },
  { id: 'modern', name: 'Modern', description: '近未来・透過' },
  { id: 'ticket', name: 'Ticket', description: 'チケット風' },
];

const BACK_TEMPLATES = [
  { id: 'logo-focus', name: 'Logo Focus', description: 'ロゴ中心' },
  { id: 'idol-full', name: 'Idol Full', description: 'アイドル全身' },
  { id: 'minimal', name: 'Minimal', description: 'ミニマル' },
  { id: 'custom', name: 'Custom', description: '自由画像' },
];

function SortableIdolTag({ idol, onRemove, onImageClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idol.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : 1, opacity: isDragging ? 0.6 : 1 };
  const mergedStyle = { ...style, borderLeft: `4px solid ${idol.hex}` };
  return (
    <div ref={setNodeRef} style={mergedStyle} className="idol-tag">
      <div className="drag-handle" {...attributes} {...listeners}>⠿</div>
      <span className="tag-name">{idol.name}</span>
      <div className="tag-actions">
        <button className="tag-icon-btn" onClick={() => onImageClick(idol.id)}>📷</button>
        <button className="tag-icon-btn remove" onClick={() => onRemove(idol.id)}>×</button>
      </div>
    </div>
  );
}

function App() {
  const [cardData, setCardData] = useState(() => {
    const saved = localStorage.getItem('imas-p-card-data');
    const defaultData = {
      name: 'プロデューサー名',
      title: '担当プロデューサー',
      selectedIdols: [],
      brandId: 'allstars',
      snsId: '@twitter_id',
      templateId: 'standard',
      backTemplateId: 'logo-focus',
      backMessage: 'いつも応援ありがとうございます！',
      qrUrl: '',
      showQr: true,
      imageMode: 'individual',
      groupImage: null,
      backImage: null,
      fontMode: 'gothic',
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Safety check for selectedIdols to prevent crash
        const safeSelectedIdols = Array.isArray(parsed.selectedIdols) ? parsed.selectedIdols : [];
        return { 
          ...defaultData, 
          ...parsed, 
          groupImage: null, 
          backImage: null, 
          selectedIdols: safeSelectedIdols.map(i => ({...i, image: null})) 
        };
      } catch (e) { return defaultData; }
    }
    return defaultData;
  });

  useEffect(() => {
    const dataToSave = { ...cardData, groupImage: null, backImage: null, selectedIdols: cardData.selectedIdols.map(i => ({...i, image: null})) };
    localStorage.setItem('imas-p-card-data', JSON.stringify(dataToSave));
  }, [cardData]);

  const [activeSide, setActiveSide] = useState('front');
  const [idolSearch, setIdolSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSearchBrand, setActiveSearchBrand] = useState('allstars');
  const [activeUnit, setActiveUnit] = useState(null);
  
  const fileInputRef = useRef(null);
  const groupImageRef = useRef(null);
  const backImageRef = useRef(null);
  const cardRefFront = useRef(null);
  const cardRefBack = useRef(null);
  const [currentIdolForImage, setCurrentIdolForImage] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (cardData.snsId.startsWith('@') && !cardData.qrUrl) {
      setCardData(prev => ({ ...prev, qrUrl: `https://x.com/${prev.snsId.substring(1)}` }));
    }
  }, [cardData.snsId]);

  const selectedBrand = BRANDS[cardData.brandId] || BRANDS.allstars;
  
  const themeGradient = useMemo(() => {
    const colors = cardData.selectedIdols.length > 0 
      ? cardData.selectedIdols.map(idol => idol.hex)
      : [selectedBrand.color, selectedBrand.color];
    if (colors.length === 1) return colors[0];
    return `linear-gradient(135deg, ${colors.join(', ')})`;
  }, [cardData.selectedIdols, selectedBrand.color]);

  const filteredIdols = useMemo(() => {
    const s = idolSearch.toLowerCase();
    return IDOLS.filter(i => 
      !cardData.selectedIdols.find(sel => sel.name === i.name) && 
      (s ? i.name.toLowerCase().includes(s) : 
        (i.brand === activeSearchBrand && (!activeUnit || i.unit === activeUnit))
      )
    ).slice(0, s ? 15 : 100);
  }, [idolSearch, activeSearchBrand, activeUnit, cardData.selectedIdols]);

  const currentBrandUnits = useMemo(() => getUnitsByBrand(activeSearchBrand), [activeSearchBrand]);

  const handleIdolSelect = (idol) => {
    if (cardData.selectedIdols.length >= 5) return;
    setCardData(prev => ({
      ...prev,
      selectedIdols: [...prev.selectedIdols, { ...idol, id: `idol-${Date.now()}` }],
      brandId: prev.selectedIdols.length === 0 ? idol.brand : prev.brandId
    }));
    setIdolSearch('');
    setShowSuggestions(false);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCardData((prev) => {
        const oldIndex = prev.selectedIdols.findIndex(i => i.id === active.id);
        const newIndex = prev.selectedIdols.findIndex(i => i.id === over.id);
        return { ...prev, selectedIdols: arrayMove(prev.selectedIdols, oldIndex, newIndex) };
      });
    }
  };

  const handleExportPNG = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const f = await toPng(cardRefFront.current, { pixelRatio: 3, cacheBust: true });
      const b = await toPng(cardRefBack.current, { pixelRatio: 3, cacheBust: true });
      const dl = (u, n) => { const a = document.createElement('a'); a.download = n; a.href = u; a.click(); };
      dl(f, `p-card-front.png`); dl(b, `p-card-back.png`);
    } catch (err) { console.error(err); } finally { setIsExporting(false); }
  };

  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const fImg = await toPng(cardRefFront.current, { pixelRatio: 2, cacheBust: true });
      const bImg = await toPng(cardRefBack.current, { pixelRatio: 2, cacheBust: true });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const cardW = 91, cardH = 55, marginX = 14, marginY = 22;
      [fImg, bImg].forEach((img, pageIdx) => {
        if (pageIdx > 0) pdf.addPage();
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 2; j++) {
            pdf.addImage(img, 'PNG', marginX + j * cardW, marginY + i * cardH, cardW, cardH);
          }
        }
      });
      pdf.save(`p-card-print.pdf`);
    } catch (err) { console.error(err); } finally { setIsExporting(false); }
  };

  return (
    <div className="app-container">
      <div className="aurora-bg"><div className="aurora-orb orb-red" /><div className="aurora-orb orb-blue" /><div className="aurora-orb orb-yellow" /></div>

      <header className="header glass-panel">
        <h1 className="allstars-text">imas P-Card Designer</h1>
        <p className="subtitle">新世代プロデューサー名刺ジェネレーター</p>
      </header>

      <main className="main-content">
        <section className="editor-section glass-panel">
          <div className="side-toggle">
            <button className={`toggle-btn ${activeSide === 'front' ? 'active' : ''}`} onClick={() => setActiveSide('front')}>表面エディタ</button>
            <button className={`toggle-btn ${activeSide === 'back' ? 'active' : ''}`} onClick={() => setActiveSide('back')}>裏面エディタ</button>
          </div>

          <div className="editor-body">
            {activeSide === 'front' ? (
              <div className="animate-in">
                <div className="section-group">
                  <h3>1. デザインを選択</h3>
                  <div className="template-grid">
                    {TEMPLATES.map(t => (
                      <button key={t.id} className={`template-btn ${cardData.templateId === t.id ? 'active' : ''}`} onClick={() => setCardData(p => ({...p, templateId: t.id}))}>
                        {t.name}<small>{t.description}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <hr className="divider" />
                <div className="section-group">
                  <h3>2. フォント設定</h3>
                  <div className="template-grid">
                    {['gothic', 'mincho'].map(f => (
                      <button key={f} className={`template-btn ${cardData.fontMode === f ? 'active' : ''}`} onClick={() => setCardData(p => ({...p, fontMode: f}))}>
                        {f === 'gothic' ? 'ゴシック' : '明朝体'}
                      </button>
                    ))}
                  </div>
                </div>
                <hr className="divider" />
                <div className="section-group">
                  <h3>3. アイドルを選択 (最大5人)</h3>
                  <div className="selected-idols-tags">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={cardData.selectedIdols.map(i => i.id)} strategy={verticalListSortingStrategy}>
                        {cardData.selectedIdols.map(idol => (
                          <SortableIdolTag key={idol.id} idol={idol} onRemove={(id) => setCardData(p => ({...p, selectedIdols: p.selectedIdols.filter(i => i.id !== id)}))} onImageClick={(id) => { setCurrentIdolForImage(id); fileInputRef.current.click(); }} />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                  <div className="search-container">
                    <input type="text" value={idolSearch} onChange={(e) => { setIdolSearch(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} placeholder="🔍 アイドルを検索..." className="form-input" />
                    {showSuggestions && (
                      <div className="idol-picker-dropdown glass-panel animate-in">
                        {!idolSearch && (
                          <div className="brand-tabs">
                            {BRAND_LIST.map(b => (
                              <button key={b.id} className={`brand-tab-btn ${activeSearchBrand === b.id ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveSearchBrand(b.id); setActiveUnit(null); }} style={{ '--brand-tab-color': b.color }}>
                                {b.id === 'cinderella' ? 'DERE' : b.id === 'million' ? 'MILLION' : b.id === 'shiny' ? 'SHINY' : b.id === 'gakuen' ? 'GAKUEN' : b.id === 'valive' ? 'VALIVE' : b.name.split(' ')[0]}
                              </button>
                            ))}
                          </div>
                        )}
                        {!idolSearch && currentBrandUnits.length > 0 && (
                          <div className="unit-tabs">
                            <button className={`unit-tab-btn ${!activeUnit ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveUnit(null); }}>ALL</button>
                            {currentBrandUnits.map(u => (
                              <button key={u.id} className={`unit-tab-btn ${activeUnit === u.id ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveUnit(u.id); }} style={{ '--unit-color': u.hex }}>
                                {u.name}
                              </button>
                            ))}
                          </div>
                        )}
                        <ul className="idol-list">
                          {filteredIdols.map(i => (
                            <li key={i.name} onClick={() => handleIdolSelect(i)} className="idol-item">
                              <span className="color-dot" style={{ backgroundColor: i.hex }}></span> {i.name}
                            </li>
                          ))}
                        </ul>
                        <div className="picker-footer"><button className="close-btn" onClick={() => setShowSuggestions(false)}>閉じる</button></div>
                      </div>
                    )}
                  </div>
                </div>
                <hr className="divider" />
                <div className="section-group">
                  <h3>4. イラスト配置モード</h3>
                  <div className="image-mode-toggle">
                    <button className={`mode-btn ${cardData.imageMode === 'individual' ? 'active' : ''}`} onClick={() => setCardData(p => ({...p, imageMode: 'individual'}))}>
                      <span className="mode-icon">👤👤👤</span>
                      <span className="mode-label">個別画像</span>
                      <small>キャラ毎に1枚ずつ</small>
                    </button>
                    <button className={`mode-btn ${cardData.imageMode === 'group' ? 'active' : ''}`} onClick={() => setCardData(p => ({...p, imageMode: 'group'}))}>
                      <span className="mode-icon">🖼️</span>
                      <span className="mode-label">集合イラスト</span>
                      <small>1枚の画像を配置</small>
                    </button>
                  </div>
                  {cardData.imageMode === 'group' && (
                    <div className="group-image-controls">
                      <button className="upload-group-btn" onClick={() => groupImageRef.current.click()}>
                        {cardData.groupImage ? '🖼️ 画像を変更' : '📁 集合イラストを選択'}
                      </button>
                      {cardData.groupImage && (
                        <button className="upload-group-btn remove" onClick={() => setCardData(p => ({...p, groupImage: null}))}>✕ 削除</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="animate-in">
                <div className="section-group">
                  <h3>1. デザインを選択</h3>
                  <div className="template-grid">
                    {BACK_TEMPLATES.map(t => (
                      <button key={t.id} className={`template-btn ${cardData.backTemplateId === t.id ? 'active' : ''}`} onClick={() => setCardData(p => ({...p, backTemplateId: t.id}))}>
                        {t.name}<small>{t.description}</small>
                      </button>
                    ))}
                  </div>
                </div>
                {cardData.backTemplateId === 'custom' && (
                  <>
                    <hr className="divider" />
                    <div className="section-group">
                      <h3>1.5. 裏面背景画像</h3>
                      <div className="group-image-controls">
                        <button className="upload-group-btn" onClick={() => backImageRef.current.click()}>
                          {cardData.backImage ? '🖼️ 画像を変更' : '📁 背景画像を選択'}
                        </button>
                        {cardData.backImage && (
                          <button className="upload-group-btn remove" onClick={() => setCardData(p => ({...p, backImage: null}))}>✕ 削除</button>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <hr className="divider" />
                <div className="section-group">
                  <h3>2. QRコード設定</h3>
                  <label className="checkbox-label"><input type="checkbox" checked={cardData.showQr} onChange={(e) => setCardData(p => ({...p, showQr: e.target.checked}))} /> 表示する</label>
                  <input type="text" value={cardData.qrUrl} onChange={(e) => setCardData(p => ({...p, qrUrl: e.target.value}))} placeholder="URL..." className="form-input" />
                </div>
                <div className="section-group">
                  <h3>3. 裏面メッセージ</h3>
                  <textarea value={cardData.backMessage} onChange={(e) => setCardData(p => ({...p, backMessage: e.target.value}))} rows="3" className="form-input" />
                </div>
              </div>
            )}
            <hr className="divider" />
            <div className="section-group">
              <h3>プロフィール共通</h3>
              <div className="form-grid">
                <div className="form-group"><label>ブランド</label><select className="form-input" value={cardData.brandId} onChange={(e) => setCardData(p => ({...p, brandId: e.target.value}))}>{BRAND_LIST.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                <div className="form-group"><label>P名</label><input type="text" className="form-input" value={cardData.name} onChange={(e) => setCardData(p => ({...p, name: e.target.value}))} /></div>
                <div className="form-group"><label>SNS ID</label><input type="text" className="form-input" value={cardData.snsId} onChange={(e) => setCardData(p => ({...p, snsId: e.target.value}))} /></div>
              </div>
            </div>
          </div>
        </section>

        <section className="preview-section">
          <div className="preview-sticky">
            <div className="preview-header">
              <h2>プレビュー</h2>
              <div className="export-controls">
                <button className="download-btn png" onClick={handleExportPNG} disabled={isExporting}>{isExporting ? '...' : 'PNG保存'}</button>
                <button className="download-btn pdf" onClick={handleExportPDF} disabled={isExporting}>{isExporting ? '...' : '印刷用PDF'}</button>
              </div>
            </div>

            <div className="card-outer-container">
              <div ref={cardRefFront} className={`card-mockup front template-${cardData.templateId} font-${cardData.fontMode}`} style={{ '--theme-gradient': themeGradient, '--brand-color': selectedBrand.color, display: activeSide === 'front' ? 'block' : 'none' }}>
                <div className="card-inner">
                  {cardData.templateId === 'ticket' && (
                    <div className="ticket-stub">
                      <div className="stub-brand">{selectedBrand.name}</div>
                      <div className="stub-deco">NO. {Math.floor(Date.now()/100000)}</div>
                    </div>
                  )}
                  {cardData.imageMode === 'group' && cardData.groupImage ? (
                    <div className="group-image-layer">
                      <img src={cardData.groupImage} className="group-image" />
                    </div>
                  ) : (
                    <div className="idol-images-layer">
                      {cardData.selectedIdols.filter(i => i.image).map((idol, idx) => (
                        <img key={idol.id} src={idol.image} className="idol-image-auto" style={{ '--index': idx, '--total': cardData.selectedIdols.filter(i => i.image).length, zIndex: 10 + idx }} />
                      ))}
                    </div>
                  )}
                  <div className="card-content">
                    <div className="card-header"><span className="brand-label">{selectedBrand.name}</span></div>
                    <div className="card-body">
                      <div className="name-area"><span className="p-name">{cardData.name}</span><span className="p-suffix">P</span></div>
                      <div className="idol-area">{cardData.selectedIdols.map(i => i.name).join(' / ')}</div>
                    </div>
                    <div className="card-footer"><span className="sns-label">𝕏 {cardData.snsId}</span></div>
                  </div>
                  {cardData.templateId === 'standard' && <div className="deco-stripe" />}
                  {cardData.templateId === 'dynamic' && <div className="deco-lines" />}
                  {cardData.templateId === 'modern' && <div className="deco-glow" />}
                  {cardData.templateId === 'ticket' && <div className="deco-perforation" />}
                </div>
              </div>

              {/* BACK */}
              <div ref={cardRefBack} className={`card-mockup back template-${cardData.backTemplateId} font-${cardData.fontMode}`} style={{ '--theme-gradient': themeGradient, '--brand-color': selectedBrand.color, display: activeSide === 'back' ? 'block' : 'none' }}>
                <div className="card-inner">
                  {cardData.backTemplateId === 'custom' && cardData.backImage && (
                    <div className="back-custom-bg">
                      <img src={cardData.backImage} className="back-custom-img" />
                      <div className="back-custom-overlay" />
                    </div>
                  )}
                  <div className="back-content">
                    {cardData.backTemplateId === 'logo-focus' && <div className="brand-logo-large">{selectedBrand.name}</div>}
                    {cardData.backTemplateId === 'idol-full' && (
                      <div className="idol-full-bg">
                        {cardData.selectedIdols.filter(i => i.image).slice(0, 1).map(i => <img key={i.id} src={i.image} className="full-idol-img" />)}
                      </div>
                    )}
                    <p className="back-msg">{cardData.backMessage}</p>
                    {cardData.showQr && cardData.qrUrl && (
                      <div className="qr-container glass-panel">
                        <QRCodeSVG value={cardData.qrUrl} size={64} fgColor="#fff" bgColor="transparent" />
                        <small>SCAN ME</small>
                      </div>
                    )}
                  </div>
                  <div className="back-footer">Designed by imas P-Card Designer</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => {
        const file = e.target.files[0];
        if (file) {
          const url = URL.createObjectURL(file);
          setCardData(prev => ({ ...prev, selectedIdols: prev.selectedIdols.map(i => i.id === currentIdolForImage ? {...i, image: url} : i) }));
        }
      }} />
      <input type="file" ref={groupImageRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => {
        const file = e.target.files[0];
        if (file) {
          const url = URL.createObjectURL(file);
          setCardData(prev => ({ ...prev, groupImage: url }));
        }
      }} />
      <input type="file" ref={backImageRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => {
        const file = e.target.files[0];
        if (file) {
          const url = URL.createObjectURL(file);
          setCardData(prev => ({ ...prev, backImage: url }));
        }
      }} />

      <style>{`
        :root {
          --color-765: #f12520; --color-cinderella: #2681c8; --color-million: #ffc30b;
          --color-sidem: #30bb94; --color-shiny: #8dbaff; --color-gakuen: #ff6600;
          --color-valive: #f82c44;
          --allstars-gradient: linear-gradient(90deg, var(--color-765), var(--color-cinderella), var(--color-million), var(--color-sidem), var(--color-shiny), var(--color-gakuen), var(--color-valive));
          --glass-bg: rgba(255, 255, 255, 0.85);
          --glass-border: rgba(0, 0, 0, 0.08);
        }

        body { background: #f7f8fc; margin: 0; font-family: 'Outfit', sans-serif; color: #1a202c; }
        .aurora-bg { position: fixed; inset: 0; z-index: -1; opacity: 0.12; }
        .aurora-orb { position: absolute; border-radius: 50%; filter: blur(120px); animation: drift 20s infinite alternate; }
        .orb-red { width: 500px; height: 500px; background: var(--color-765); top: -10%; left: -10%; }
        .orb-blue { width: 600px; height: 600px; background: var(--color-cinderella); bottom: -10%; right: -10%; }
        .orb-yellow { width: 400px; height: 400px; background: var(--color-million); top: 40%; left: 30%; }
        @keyframes drift { from { transform: translate(0, 0); } to { transform: translate(10%, 10%); } }

        .app-container { max-width: 1240px; margin: 0 auto; padding: 2rem; }
        .glass-panel { background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--glass-border); border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
        
        .header { text-align: center; padding: 2rem; margin-bottom: 2.5rem; position: relative; overflow: hidden; }
        .header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: var(--allstars-gradient); }
        .allstars-text { font-size: 3rem; font-weight: 900; background: var(--allstars-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
        .subtitle { color: #718096; letter-spacing: 0.3em; font-size: 0.8rem; margin-top: 0.5rem; }

        .main-content { display: grid; grid-template-columns: 420px 1fr; gap: 2.5rem; }
        .editor-section { padding: 1.5rem; }
        .section-group h3 { font-size: 0.95rem; margin: 0 0 0.8rem 0; color: #2d3748; }
        .divider { border: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(0,0,0,0.08), transparent); margin: 1.5rem 0; }

        .side-toggle { display: flex; gap: 0.5rem; background: #edf2f7; padding: 0.4rem; border-radius: 14px; margin-bottom: 1.5rem; }
        .toggle-btn { flex: 1; padding: 0.8rem; border: none; border-radius: 10px; background: transparent; color: #718096; cursor: pointer; font-weight: 700; transition: 0.3s; font-size: 0.85rem; }
        .toggle-btn.active { background: #fff; color: #1a202c; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }

        .template-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
        .template-btn { padding: 1rem; border-radius: 14px; border: 1px solid #e2e8f0; background: #fff; color: #2d3748; cursor: pointer; text-align: left; transition: 0.2s; font-size: 0.85rem; }
        .template-btn:hover { border-color: #cbd5e0; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .template-btn.active { border-color: #2681c8; background: #ebf4ff; color: #1a365d; }
        .template-btn small { display: block; font-size: 0.6rem; color: #a0aec0; margin-top: 2px; }

        .form-input { width: 100%; padding: 0.9rem 1.2rem; border-radius: 12px; border: 1px solid #e2e8f0; background: #fff; color: #1a202c; margin-top: 0.4rem; outline: none; box-sizing: border-box; font-size: 0.9rem; font-family: inherit; transition: 0.2s; }
        .form-input:focus { border-color: #2681c8; box-shadow: 0 0 0 3px rgba(38,129,200,0.1); }
        select.form-input { appearance: auto; }
        select.form-input option { background: #fff; color: #1a202c; }
        textarea.form-input { resize: vertical; min-height: 80px; }
        .form-grid { display: flex; flex-direction: column; gap: 1rem; }
        .form-group label { display: block; font-size: 0.8rem; color: #718096; margin-bottom: 0; }
        .checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #4a5568; cursor: pointer; margin-top: 0.5rem; }

        /* Idol Tags */
        .selected-idols-tags { margin-bottom: 0.8rem; }
        .idol-tag { background: #fff; padding: 0.6rem 0.8rem; border-radius: 12px; display: flex; align-items: center; gap: 0.8rem; border: 1px solid #e2e8f0; margin-bottom: 0.6rem; transition: 0.2s; }
        .idol-tag:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .drag-handle { cursor: grab; opacity: 0.3; font-size: 1.1rem; user-select: none; }
        .drag-handle:active { cursor: grabbing; }
        .tag-name { flex: 1; font-weight: 600; font-size: 0.9rem; color: #2d3748; }
        .tag-actions { display: flex; gap: 6px; }
        .tag-icon-btn { background: #edf2f7; border: none; width: 28px; height: 28px; border-radius: 6px; color: #4a5568; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; transition: 0.2s; }
        .tag-icon-btn:hover { background: #e2e8f0; }
        .tag-icon-btn.remove:hover { background: #fed7d7; color: #e53e3e; }

        /* PREVIEW AREA */
        .preview-sticky { position: sticky; top: 2rem; }
        .preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .preview-header h2 { font-size: 1.1rem; margin: 0; }
        .export-controls { display: flex; gap: 0.5rem; }

        /* PREVIEW AREA */
        .preview-sticky { position: sticky; top: 2rem; }
        .preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .preview-header h2 { font-size: 1.1rem; margin: 0; }
        .export-controls { display: flex; gap: 0.5rem; }

        /* 3D Tilt Effect & Card Base */
        .card-outer-container { perspective: 1200px; margin-top: 0.5rem; }
        .card-mockup { 
          width: 100%; aspect-ratio: 91/55; background: #fff; color: #1a202c; 
          position: relative; overflow: hidden; 
          box-shadow: 0 15px 45px rgba(0,0,0,0.1); border-radius: 4px; 
          transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.6s;
          transform-style: preserve-3d;
        }
        .card-mockup:hover { 
          transform: rotateY(6deg) rotateX(3deg) scale(1.01); 
          box-shadow: -15px 35px 70px rgba(0,0,0,0.1); 
        }
        .card-inner { height: 100%; width: 100%; position: relative; }
        .card-content { height: 100%; padding: 2.2rem 2.5rem; display: flex; flex-direction: column; justify-content: space-between; position: relative; z-index: 50; box-sizing: border-box; }
        
        .p-name { font-size: 2.2rem; font-weight: 900; line-height: 1; color: #1a202c; }
        .p-suffix { font-size: 1.2rem; font-weight: 700; margin-left: 0.2rem; color: #1a202c; }
        .brand-label { font-size: 0.75rem; font-weight: 800; color: var(--brand-color); letter-spacing: 0.1em; }
        .idol-area { font-size: 0.8rem; color: #4a5568; margin-top: 0.5rem; font-weight: 600; }
        .sns-label { font-size: 0.75rem; color: #718096; }

        /* Fonts */
        .font-gothic { font-family: 'Noto Sans JP', sans-serif !important; }
        .font-mincho { font-family: 'Noto Serif JP', serif !important; }
        .font-mincho .p-name { font-weight: 900; }
        
        /* Template: Standard */
        .template-standard .deco-stripe { position: absolute; top: 0; left: 0; right: 0; height: 12px; background: var(--theme-gradient); }
        /* Template: Dynamic */
        .template-dynamic .deco-lines { position: absolute; top: -50%; right: -10%; width: 60%; height: 200%; background: var(--theme-gradient); opacity: 0.1; transform: rotate(15deg); }
        /* Template: Modern */
        .template-modern { background: #0a0c10; }
        .template-modern .p-name, .template-modern .brand-label, .template-modern .p-suffix { color: #fff; }
        .template-modern .idol-area { color: rgba(255,255,255,0.6); }
        .template-modern .sns-label { color: rgba(255,255,255,0.5); }
        .template-modern .deco-glow { position: absolute; inset: 0; background: radial-gradient(circle at 80% 20%, var(--brand-color), transparent 70%); opacity: 0.25; filter: blur(40px); }
        /* Template: Ticket */
        .template-ticket .card-content { padding-left: 28%; }
        .template-ticket .ticket-stub { position: absolute; left: 0; top: 0; bottom: 0; width: 20%; background: var(--brand-color); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 20; }
        .stub-brand { font-size: 0.6rem; font-weight: 900; writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: 2px; }
        .stub-deco { position: absolute; bottom: 0.6rem; font-size: 0.35rem; font-weight: 700; opacity: 0.6; font-family: monospace; }
        .template-ticket .deco-perforation { position: absolute; left: 20%; top: 0; bottom: 0; width: 4px; border-left: 2px dashed rgba(0,0,0,0.15); z-index: 25; }

        /* Image Mode Toggle */
        .image-mode-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
        .mode-btn { padding: 1.2rem; border-radius: 14px; border: 1px solid #e2e8f0; background: #fff; color: #4a5568; cursor: pointer; text-align: center; transition: 0.2s; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .mode-btn:hover { border-color: #cbd5e0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .mode-btn.active { border-color: #2681c8; background: #ebf4ff; color: #1a365d; box-shadow: 0 4px 15px rgba(38,129,200,0.1); }
        .mode-icon { font-size: 1.5rem; }
        .mode-label { font-weight: 800; font-size: 0.9rem; }
        .mode-btn small { font-size: 0.65rem; color: #718096; }
        .mode-btn.active small { color: #2b6cb0; }
        
        .group-image-controls { display: flex; gap: 0.6rem; margin-top: 1rem; }
        .upload-group-btn { flex: 1; padding: 0.9rem; border-radius: 12px; border: 1px dashed #cbd5e0; background: #fff; color: #4a5568; cursor: pointer; font-size: 0.85rem; font-weight: 700; transition: 0.2s; }
        .upload-group-btn:hover { border-color: #2681c8; color: #2681c8; background: #f7fafc; }
        .upload-group-btn.remove { flex: 0 0 auto; border-color: #feb2b2; color: #e53e3e; }
        .upload-group-btn.remove:hover { background: #fff5f5; border-color: #e53e3e; }

        /* Individual Idol Images */
        .idol-images-layer { position: absolute; inset: 0; left: 35%; z-index: 10; pointer-events: none; }
        .idol-image-auto { position: absolute; height: 110%; bottom: -5%; object-fit: contain; right: calc(var(--index) * 12% - 5%); filter: drop-shadow(-10px 10px 20px rgba(0,0,0,0.3)); }
        /* Group Image */
        .group-image-layer { position: absolute; inset: 0; z-index: 10; pointer-events: none; display: flex; align-items: center; justify-content: flex-end; }
        .group-image { height: 100%; max-width: 70%; object-fit: contain; object-position: right center; filter: drop-shadow(-10px 10px 25px rgba(0,0,0,0.3)); }

        /* Back Card */
        .card-mockup.back { background: var(--brand-color); color: #fff; }
        .back-content { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; box-sizing: border-box; position: relative; }
        .brand-logo-large { font-size: 2.2rem; font-weight: 900; opacity: 0.9; }
        .back-msg { margin-top: 1rem; font-size: 0.9rem; opacity: 0.8; max-width: 80%; text-align: center; }
        .idol-full-bg { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: center; opacity: 0.2; overflow: hidden; }
        .full-idol-img { height: 130%; object-fit: contain; }
        .back-footer { position: absolute; bottom: 0.5rem; width: 100%; text-align: center; font-size: 0.45rem; opacity: 0.3; }
        /* Custom Back Image */
        .back-custom-bg { position: absolute; inset: 0; z-index: 0; }
        .back-custom-img { width: 100%; height: 100%; object-fit: cover; }
        .back-custom-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.3) 100%); }
        .template-custom .back-content { z-index: 5; position: relative; }
        .template-custom .back-footer { z-index: 5; }
        .qr-container { position: absolute; bottom: 1.2rem; right: 1.2rem; padding: 0.6rem; border-radius: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .qr-container small { font-size: 0.5rem; font-weight: 800; }

        /* IDOL PICKER DROPDOWN */
        .search-container { position: relative; }
        .idol-picker-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 200; margin-top: 8px; padding: 1.2rem; max-height: 400px; overflow-y: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.12); }
        .brand-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 1rem; padding-bottom: 0.8rem; border-bottom: 1px solid #edf2f7; }
        .brand-tab-btn { padding: 0.45rem 0.9rem; border-radius: 20px; border: 1px solid #e2e8f0; background: #f7fafc; color: #718096; cursor: pointer; font-size: 0.7rem; font-weight: 800; transition: 0.2s; }
        .brand-tab-btn:hover { background: #edf2f7; color: #2d3748; }
        .brand-tab-btn.active { background: var(--brand-tab-color); color: #fff; border-color: transparent; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
        .unit-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 0.8rem; padding-bottom: 0.6rem; border-bottom: 1px solid #edf2f7; }
        .unit-tab-btn { padding: 0.3rem 0.7rem; border-radius: 14px; border: 1px solid #e2e8f0; background: transparent; color: #718096; cursor: pointer; font-size: 0.6rem; font-weight: 700; transition: 0.2s; }
        .unit-tab-btn:hover { color: #2d3748; background: #f7fafc; }
        .unit-tab-btn.active { background: var(--unit-color, #2681c8); color: #fff; border-color: transparent; text-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        .idol-list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
        .idol-item { padding: 0.55rem 0.7rem; border-radius: 10px; cursor: pointer; transition: 0.15s; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 500; color: #2d3748; }
        .idol-item:hover { background: #edf2f7; }
        .color-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .picker-footer { margin-top: 1rem; border-top: 1px solid #edf2f7; padding-top: 0.8rem; text-align: right; }
        .close-btn { background: #edf2f7; color: #2d3748; border: none; padding: 0.5rem 1.4rem; border-radius: 20px; font-weight: 800; cursor: pointer; font-size: 0.8rem; transition: 0.2s; }
        .close-btn:hover { background: #e2e8f0; }

        .download-btn { padding: 0.8rem 1.5rem; border-radius: 30px; font-weight: 800; cursor: pointer; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px; transition: 0.2s; }
        .download-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .download-btn.png { background: #edf2f7; color: #2d3748; border: none; }
        .download-btn.pdf { background: var(--color-765); color: #fff; border: none; margin-left: 0.5rem; box-shadow: 0 4px 15px rgba(241,37,32,0.2); }
        .download-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .animate-in { animation: fadeIn 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

      `}</style>
    </div>
  );
}

export default App;
