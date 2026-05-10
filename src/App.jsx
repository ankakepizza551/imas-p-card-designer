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
import { IDOLS } from './constants/idols';
import { BRANDS, BRAND_LIST, getUnitsByBrand } from './constants/brands';
import './styles/tokens.css';

const TEMPLATES = [
  { id: 'standard', name: 'Standard', description: '王道のシンプルデザイン' },
  { id: 'dynamic', name: 'Dynamic', description: '躍動感のある斜線スタイル' },
  { id: 'modern', name: 'Modern', description: '洗練されたダークモード風' },
  { id: 'ticket', name: 'Ticket', description: 'ライブチケット風デザイン' },
];

const BACK_TEMPLATES = [
  { id: 'idolfull', name: 'Idol Full', description: 'アイドルを大きく配置' },
  { id: 'minimal', name: 'Minimal', description: 'ロゴ中心のシンプル構成' },
  { id: 'custom', name: 'Custom Image', description: '自作画像を背景に使用' },
];

// --- Components ---

function SortableIdolTag({ idol, onRemove, onImageUpload }) {
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

// --- Main App ---

export default function App() {
  const [cardData, setCardData] = useState(() => {
    const saved = localStorage.getItem('imas-p-card-data');
    const defaultData = {
      templateId: 'standard',
      backTemplateId: 'idolfull',
      brandId: 'allstars',
      name: 'プロデューサー',
      title: 'PRODUCER',
      snsId: '@twitter_id',
      selectedIdols: [],
      backMessage: 'いつも応援ありがとうございます！',
      qrUrl: '',
      showQr: true,
      imageMode: 'individual',
      groupImage: null,
      backImage: null,
      fontMode: 'gothic',
      showTanto: true,
      showBackBg: true,
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...defaultData, 
          ...parsed, 
          groupImage: null, 
          backImage: null, 
          selectedIdols: (parsed.selectedIdols || []).map(i => ({...i, image: null})) 
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
  const [activeSearchBrands, setActiveSearchBrands] = useState(['allstars']);
  const [activeUnit, setActiveUnit] = useState(null);
  
  const fileInputRef = useRef(null);
  const groupImageRef = useRef(null);
  const backImageRef = useRef(null);
  const cardRefFront = useRef(null);
  const cardRefBack = useRef(null);
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
        (activeSearchBrands.includes(i.brand) && (!activeUnit || i.unit === activeUnit))
      )
    ).slice(0, s ? 15 : 100);
  }, [idolSearch, activeSearchBrands, activeUnit, cardData.selectedIdols]);

  const currentBrandUnits = useMemo(() => {
    if (activeSearchBrands.length !== 1) return [];
    return getUnitsByBrand(activeSearchBrands[0]);
  }, [activeSearchBrands]);

  const toggleSearchBrand = (brandId) => {
    setActiveSearchBrands(prev => {
      if (prev.includes(brandId)) {
        if (prev.length === 1) return prev;
        return prev.filter(b => b !== brandId);
      }
      return [...prev, brandId];
    });
    setActiveUnit(null);
  };

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

  const handleIdolImageUpload = (idolId, e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCardData(prev => ({
        ...prev,
        selectedIdols: prev.selectedIdols.map(i => i.id === idolId ? { ...i, image: url } : i)
      }));
    }
  };

  const handleExportPNG = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const options = { pixelRatio: 3, cacheBust: true, style: { transform: 'none' } };
      const f = await toPng(cardRefFront.current, options);
      const b = await toPng(cardRefBack.current, options);
      const dl = (u, n) => { const a = document.createElement('a'); a.download = n; a.href = u; a.click(); };
      dl(f, `p-card-front.png`); dl(b, `p-card-back.png`);
    } catch (err) { console.error(err); } finally { setIsExporting(false); }
  };

  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const options = { pixelRatio: 2, cacheBust: true, style: { transform: 'none' } };
      const fImg = await toPng(cardRefFront.current, options);
      const bImg = await toPng(cardRefBack.current, options);
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
      <header className="app-header">
        <div className="header-bg"></div>
        <div className="header-content">
          <div className="logo-area">
            <h1 className="allstars-text">P-CARD DESIGNER</h1>
            <p className="subtitle">IDOLMASTER PRODUCER CARD TOOL</p>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="editor-section glass-panel">
          <div className="side-toggle">
            <button className={`toggle-btn ${activeSide === 'front' ? 'active' : ''}`} onClick={() => setActiveSide('front')}>表面デザイン</button>
            <button className={`toggle-btn ${activeSide === 'back' ? 'active' : ''}`} onClick={() => setActiveSide('back')}>裏面デザイン</button>
          </div>

          <div className="editor-scroll">
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
                  <h3>2. アイドルを選択 (最大5名)</h3>
                  <div className="search-container">
                    <input type="text" value={idolSearch} onChange={(e) => { setIdolSearch(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} placeholder="🔍 アイドルを検索..." className="form-input" />
                    {showSuggestions && (
                      <div className="idol-picker-dropdown glass-panel animate-in">
                        <div className="unit-tabs" style={{ marginBottom: '1rem' }}>
                          {BRAND_LIST.map(brandId => (
                            <button key={brandId} className={`unit-tab-btn ${activeSearchBrands.includes(brandId) ? 'active' : ''}`} style={{ '--unit-color': BRANDS[brandId].color }} onClick={() => toggleSearchBrand(brandId)}>
                              {BRANDS[brandId].name}
                            </button>
                          ))}
                        </div>
                        {!idolSearch && currentBrandUnits.length > 0 && (
                          <div className="unit-tabs">
                            <button className={`unit-tab-btn ${!activeUnit ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveUnit(null); }}>ALL</button>
                            {currentBrandUnits.map(u => (
                              <button key={u.id} className={`unit-tab-btn ${activeUnit === u.id ? 'active' : ''}`} style={{ '--unit-color': u.color }} onClick={(e) => { e.stopPropagation(); setActiveUnit(u.id); }}>
                                {u.name}
                              </button>
                            ))}
                          </div>
                        )}
                        <ul className="idol-list">
                          {filteredIdols.map(idol => (
                            <li key={idol.name} className="idol-item" onClick={() => handleIdolSelect(idol)}>
                              <span className="color-dot" style={{ backgroundColor: idol.hex }}></span>
                              {idol.name}
                            </li>
                          ))}
                        </ul>
                        <div className="picker-footer">
                          <button className="close-btn" onClick={() => setShowSuggestions(false)}>閉じる</button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="selected-idols-tags">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={cardData.selectedIdols.map(i => i.id)} strategy={verticalListSortingStrategy}>
                        {cardData.selectedIdols.map(idol => (
                          <SortableIdolTag key={idol.id} idol={idol} 
                            onRemove={() => setCardData(p => ({ ...p, selectedIdols: p.selectedIdols.filter(i => i.id !== idol.id) }))} 
                            onImageUpload={handleIdolImageUpload} />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>

                <hr className="divider" />

                <div className="section-group">
                  <h3>3. イラスト配置モード</h3>
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
                      <input type="file" ref={groupImageRef} hidden accept="image/*" onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) setCardData(p => ({ ...p, groupImage: URL.createObjectURL(file) }));
                      }} />
                      {cardData.groupImage && (
                        <button className="upload-group-btn remove" onClick={() => setCardData(p => ({...p, groupImage: null}))}>✕ 削除</button>
                      )}
                    </div>
                  )}
                </div>

                <hr className="divider" />

                <div className="section-group">
                  <h3>4. プロフィール設定</h3>
                  <div className="form-group">
                    <label>ブランド</label>
                    <select className="form-input" value={cardData.brandId} onChange={(e) => setCardData(p => ({...p, brandId: e.target.value}))}>
                      {BRAND_LIST.map(id => <option key={id} value={id}>{BRANDS[id].name}</option>)}
                    </select>
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>名前</label>
                      <input type="text" className="form-input" value={cardData.name} onChange={(e) => setCardData(p => ({...p, name: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label>役職</label>
                      <input type="text" className="form-input" value={cardData.title} onChange={(e) => setCardData(p => ({...p, title: e.target.value}))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>SNS ID</label>
                    <input type="text" className="form-input" value={cardData.snsId} onChange={(e) => setCardData(p => ({...p, snsId: e.target.value}))} />
                  </div>
                  <div className="checkbox-group">
                    <input type="checkbox" id="showTanto" checked={cardData.showTanto} onChange={(e) => setCardData(p => ({...p, showTanto: e.target.checked}))} />
                    <label htmlFor="showTanto">アイドル名の後に「担当」をつける</label>
                  </div>
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
                  <div className="section-group">
                    <h3>2. 背景画像をアップロード</h3>
                    <button className="upload-group-btn" onClick={() => backImageRef.current.click()}>
                      {cardData.backImage ? '🖼️ 画像を変更' : '📁 自作画像を選択'}
                    </button>
                    <input type="file" ref={backImageRef} hidden accept="image/*" onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) setCardData(p => ({ ...p, backImage: URL.createObjectURL(file) }));
                    }} />
                  </div>
                )}
                <div className="section-group">
                  <h3>2. QRコード設定</h3>
                  <label className="checkbox-group"><input type="checkbox" checked={cardData.showQr} onChange={(e) => setCardData(p => ({...p, showQr: e.target.checked}))} /> <span>表示する</span></label>
                  <input type="text" value={cardData.qrUrl} onChange={(e) => setCardData(p => ({...p, qrUrl: e.target.value}))} placeholder="URL..." className="form-input" />
                </div>
                <div className="section-group">
                  <h3>3. 裏面メッセージ</h3>
                  <textarea value={cardData.backMessage} onChange={(e) => setCardData(p => ({...p, backMessage: e.target.value}))} maxLength={100} className="form-input" />
                  <div className="checkbox-group">
                    <input type="checkbox" id="showBackBg" checked={cardData.showBackBg} onChange={(e) => setCardData(p => ({...p, showBackBg: e.target.checked}))} />
                    <label htmlFor="showBackBg">背景にブランドカラーを塗る</label>
                  </div>
                </div>
                <hr className="divider" />
                <div className="section-group">
                  <h3>4. フォント設定</h3>
                  <div className="template-grid">
                    <button className={`template-btn ${cardData.fontMode === 'gothic' ? 'active' : ''}`} onClick={() => setCardData(p => ({...p, fontMode: 'gothic'}))}>ゴシック体</button>
                    <button className={`template-btn ${cardData.fontMode === 'mincho' ? 'active' : ''}`} onClick={() => setCardData(p => ({...p, fontMode: 'mincho'}))}>明朝体</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="preview-section">
          <div className="preview-sticky">
            <div className="preview-header">
              <h2>Card Preview</h2>
              <div className="export-controls">
                <button className="download-btn" onClick={handleExportPNG} disabled={isExporting} style={{ background: '#2681c8', color: '#fff' }}>
                  {isExporting ? '生成中...' : 'PNG保存'}
                </button>
                <button className="download-btn" onClick={handleExportPDF} disabled={isExporting} style={{ background: '#1a202c', color: '#fff' }}>
                  {isExporting ? '...' : 'PDF (印刷用)'}
                </button>
              </div>
            </div>

            <div className="card-outer-container">
              {/* FRONT */}
              <div ref={cardRefFront} className={`card-mockup template-${cardData.templateId} font-${cardData.fontMode}`} style={{ '--theme-gradient': themeGradient, '--brand-color': selectedBrand.color, display: activeSide === 'front' ? 'block' : 'none' }}>
                <div className="card-inner">
                  {cardData.imageMode === 'individual' ? (
                    <div className="idol-images-layer">
                      {cardData.selectedIdols.map((idol, idx) => idol.image && (
                        <img key={idol.id} src={idol.image} className="idol-image-auto animate-in" style={{ '--index': idx }} />
                      ))}
                    </div>
                  ) : (
                    cardData.groupImage && (
                      <div className="group-image-layer">
                        <img src={cardData.groupImage} className="group-image animate-in" />
                      </div>
                    )
                  )}
                  <div className="card-content">
                    <div className="card-header"><span className="brand-label">{selectedBrand.name}</span></div>
                    <div className="card-body">
                      <div className="name-area"><span className="p-name">{cardData.name}</span><span className="p-suffix">P</span></div>
                      <div className="idol-area">
                        {cardData.selectedIdols.map(i => i.name + (cardData.showTanto ? '担当' : '')).join(' / ')}
                      </div>
                    </div>
                    <div className="card-footer"><span className="sns-label">𝕏 {cardData.snsId}</span></div>
                  </div>
                  {cardData.templateId === 'standard' && <div className="deco-stripe"></div>}
                  {cardData.templateId === 'dynamic' && <div className="deco-lines"></div>}
                  {cardData.templateId === 'modern' && <div className="deco-glow"></div>}
                  {cardData.templateId === 'ticket' && (
                    <>
                      <div className="ticket-stub"><div className="stub-brand">{selectedBrand.name}</div><div className="stub-deco">P-CARD v2.0</div></div>
                      <div className="deco-perforation"></div>
                    </>
                  )}
                </div>
              </div>

              {/* BACK */}
              <div ref={cardRefBack} className={`card-mockup back template-${cardData.backTemplateId} font-${cardData.fontMode} ${!cardData.showBackBg ? 'no-bg' : ''}`} style={{ '--theme-gradient': themeGradient, '--brand-color': selectedBrand.color, display: activeSide === 'back' ? 'block' : 'none' }}>
                <div className="card-inner">
                  {cardData.backTemplateId === 'custom' && cardData.backImage && (
                    <div className="back-custom-bg">
                      <img src={cardData.backImage} className="back-custom-img" />
                      <div className="back-custom-overlay"></div>
                    </div>
                  )}
                  {cardData.backTemplateId === 'idolfull' && cardData.selectedIdols[0]?.image && (
                    <div className="idol-full-bg">
                      <img src={cardData.selectedIdols[0].image} className="full-idol-img" />
                    </div>
                  )}
                  <div className="back-content">
                    <div className="brand-logo-large">{selectedBrand.id === 'allstars' ? '765PRO' : selectedBrand.name}</div>
                    <p className="back-msg">{cardData.backMessage}</p>
                    {cardData.showQr && cardData.qrUrl && (
                      <div className="qr-container">
                        <QRCodeSVG value={cardData.qrUrl} size={48} level="M" includeMargin={false} />
                        <small>SCAN ME</small>
                      </div>
                    )}
                  </div>
                  <div className="back-footer">©BANDAI NAMCO Entertainment Inc. / P-Card Designer</div>
                </div>
              </div>
            </div>
            
            <p className="instruction-text">
              ※ PCの方はマウスで、スマホの方はスワイプでカードが傾きます。<br/>
              ※ 画像はブラウザを閉じると消えるため、保存はお早めに。
            </p>
          </div>
        </section>
      </main>

      <style>{`
        .app-container { min-height: 100vh; background-color: #f7f8fc; color: #1a202c; padding-bottom: 5rem; }
        .glass-panel { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.04); }
        .animate-in { animation: fadeIn 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* HEADER */
        .app-header { height: 180px; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 2rem; background: #fff; border-bottom: 1px solid #e2e8f0; }
        .header-bg { position: absolute; inset: 0; background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%); opacity: 0.5; }
        .header-content { position: relative; z-index: 10; text-align: center; }
        .allstars-text { font-size: 3rem; font-weight: 900; background: linear-gradient(45deg, #1a365d, #2681c8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
        .subtitle { color: #718096; letter-spacing: 0.3em; font-size: 0.8rem; margin-top: 0.5rem; font-weight: 700; }

        .main-content { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 420px 1fr; gap: 2.5rem; padding: 0 1.5rem; }
        .editor-section { padding: 2rem; height: calc(100vh - 250px); display: flex; flex-direction: column; }
        .editor-scroll { overflow-y: auto; flex: 1; padding-right: 0.5rem; }
        .editor-scroll::-webkit-scrollbar { width: 4px; }
        .editor-scroll::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }

        .section-group h3 { font-size: 0.95rem; margin: 0 0 1rem 0; color: #2d3748; font-weight: 800; border-left: 4px solid #2681c8; padding-left: 0.8rem; }
        .divider { border: 0; height: 1px; background: #edf2f7; margin: 2rem 0; }

        .side-toggle { display: flex; gap: 0.5rem; background: #edf2f7; padding: 0.4rem; border-radius: 16px; margin-bottom: 1.5rem; }
        .toggle-btn { flex: 1; padding: 0.9rem; border: none; border-radius: 12px; background: transparent; color: #718096; cursor: pointer; font-weight: 800; transition: 0.3s; font-size: 0.85rem; }
        .toggle-btn.active { background: #fff; color: #2681c8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

        .template-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
        .template-btn { padding: 1rem; border-radius: 14px; border: 1px solid #e2e8f0; background: #fff; color: #2d3748; cursor: pointer; text-align: left; transition: 0.2s; font-size: 0.85rem; font-weight: 700; }
        .template-btn:hover { border-color: #cbd5e0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .template-btn.active { border-color: #2681c8; background: #ebf4ff; color: #1a365d; }
        .template-btn small { display: block; font-size: 0.65rem; color: #a0aec0; margin-top: 2px; font-weight: 500; }

        .form-input { width: 100%; padding: 1rem 1.2rem; border-radius: 14px; border: 1px solid #e2e8f0; background: #fcfcfd; color: #1a202c; margin-top: 0.5rem; outline: none; box-sizing: border-box; font-size: 0.9rem; font-family: inherit; transition: 0.2s; }
        .form-input:focus { border-color: #2681c8; box-shadow: 0 0 0 4px rgba(38,129,200,0.08); background: #fff; }
        select.form-input { appearance: auto; cursor: pointer; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .form-group { margin-bottom: 1.2rem; }
        .form-group label { display: block; font-size: 0.8rem; font-weight: 800; color: #4a5568; margin-bottom: 0; }

        .checkbox-group { display: flex; align-items: center; gap: 10px; margin-top: 1rem; cursor: pointer; }
        .checkbox-group input { width: 20px; height: 20px; cursor: pointer; accent-color: #2681c8; }
        .checkbox-group span { font-size: 0.85rem; font-weight: 700; color: #4a5568; }

        /* PREVIEW AREA */
        .preview-sticky { position: sticky; top: 2rem; }
        .preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
        .preview-header h2 { font-size: 1.2rem; margin: 0; font-weight: 900; color: #2d3748; }
        .export-controls { display: flex; gap: 0.8rem; }
        .download-btn { padding: 0.9rem 1.8rem; border-radius: 30px; border: none; font-weight: 800; cursor: pointer; font-size: 0.8rem; transition: 0.3s; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .download-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
        .download-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .card-outer-container { perspective: 1200px; margin-top: 1rem; }
        .card-mockup { 
          width: 100%; aspect-ratio: 91/55; background: #fff; color: #1a202c; 
          position: relative; overflow: hidden; 
          box-shadow: 0 20px 60px rgba(0,0,0,0.1); border-radius: 8px; 
          transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.6s;
          transform-style: preserve-3d;
        }
        .card-mockup:hover { 
          transform: rotateY(10deg) rotateX(5deg) scale(1.02); 
          box-shadow: -20px 40px 80px rgba(0,0,0,0.12); 
        }
        .card-inner { height: 100%; width: 100%; position: relative; }
        .card-content { height: 100%; padding: 2.2rem 2.8rem; display: flex; flex-direction: column; justify-content: space-between; position: relative; z-index: 50; box-sizing: border-box; }
        
        .p-name { font-size: 2.4rem; font-weight: 900; line-height: 1; color: #1a202c; letter-spacing: -0.02em; }
        .p-suffix { font-size: 1.2rem; font-weight: 800; margin-left: 0.2rem; color: #1a202c; }
        .brand-label { font-size: 0.8rem; font-weight: 900; color: var(--brand-color); letter-spacing: 0.15em; }
        .idol-area { font-size: 0.85rem; color: #4a5568; margin-top: 0.6rem; font-weight: 700; }
        .sns-label { font-size: 0.8rem; color: #718096; font-weight: 600; }

        .font-gothic { font-family: 'Noto Sans JP', sans-serif !important; }
        .font-mincho { font-family: 'Noto Serif JP', serif !important; }
        
        .template-standard .deco-stripe { position: absolute; top: 0; left: 0; right: 0; height: 14px; background: var(--theme-gradient); }
        .template-dynamic .deco-lines { position: absolute; top: -50%; right: -10%; width: 60%; height: 200%; background: var(--theme-gradient); opacity: 0.12; transform: rotate(15deg); }
        .template-modern { background: #0f1115; }
        .template-modern .p-name, .template-modern .p-suffix { color: #fff; }
        .template-modern .idol-area { color: rgba(255,255,255,0.6); }
        .template-modern .sns-label { color: rgba(255,255,255,0.4); }
        .template-modern .deco-glow { position: absolute; inset: 0; background: radial-gradient(circle at 80% 20%, var(--brand-color), transparent 70%); opacity: 0.3; filter: blur(40px); }
        .template-ticket .card-content { padding-left: 30%; }
        .template-ticket .ticket-stub { position: absolute; left: 0; top: 0; bottom: 0; width: 22%; background: var(--brand-color); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 20; }
        .stub-brand { font-size: 0.65rem; font-weight: 900; writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: 3px; }
        .deco-perforation { position: absolute; left: 22%; top: 0; bottom: 0; width: 4px; border-left: 2px dashed rgba(0,0,0,0.1); z-index: 25; }

        .image-mode-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
        .mode-btn { padding: 1.2rem; border-radius: 14px; border: 1px solid #e2e8f0; background: #fff; color: #4a5568; cursor: pointer; text-align: center; transition: 0.2s; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .mode-btn:hover { border-color: #cbd5e0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .mode-btn.active { border-color: #2681c8; background: #ebf4ff; color: #1a365d; box-shadow: 0 4px 15px rgba(38,129,200,0.1); }
        .mode-icon { font-size: 1.5rem; }
        .mode-label { font-weight: 800; font-size: 0.9rem; }
        .mode-btn small { font-size: 0.65rem; color: #718096; font-weight: 500; }
        .mode-btn.active small { color: #2b6cb0; }

        .idol-images-layer { position: absolute; inset: 0; left: 35%; z-index: 10; pointer-events: none; }
        .idol-image-auto { position: absolute; height: 110%; bottom: -5%; object-fit: contain; right: calc(var(--index) * 12% - 5%); filter: drop-shadow(-10px 10px 20px rgba(0,0,0,0.3)); }
        .group-image-layer { position: absolute; inset: 0; z-index: 10; pointer-events: none; display: flex; align-items: center; justify-content: flex-end; }
        .group-image { height: 100%; max-width: 70%; object-fit: contain; object-position: right center; filter: drop-shadow(-10px 10px 25px rgba(0,0,0,0.3)); }

        .card-mockup.back { background: var(--brand-color); color: #fff; }
        .back-content { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.5rem; box-sizing: border-box; position: relative; z-index: 5; }
        .brand-logo-large { font-size: 2.5rem; font-weight: 900; letter-spacing: 0.05em; text-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .back-msg { margin-top: 1.2rem; font-size: 0.95rem; font-weight: 600; opacity: 0.9; max-width: 85%; text-align: center; line-height: 1.6; }
        .no-bg { background: #fff !important; color: #1a202c !important; border: 1px solid #e2e8f0; }
        .no-bg .brand-logo-large { color: var(--brand-color); }
        .no-bg .back-msg { color: #4a5568; }
        .no-bg .qr-container { background: #f7fafc; border-color: #e2e8f0; }
        .no-bg .qr-container small { color: #718096; }
        .no-bg .back-footer { color: #a0aec0; }

        .qr-container { position: absolute; bottom: 1.5rem; right: 1.5rem; padding: 0.8rem; border-radius: 16px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); display: flex; flex-direction: column; align-items: center; gap: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        .qr-container small { font-size: 0.55rem; font-weight: 900; letter-spacing: 0.1em; opacity: 0.8; }
        .back-footer { position: absolute; bottom: 0.8rem; width: 100%; text-align: center; font-size: 0.5rem; opacity: 0.4; font-weight: 700; }

        .idol-picker-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 200; margin-top: 8px; padding: 1.5rem; max-height: 450px; overflow-y: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; box-shadow: 0 25px 70px rgba(0,0,0,0.15); }
        .unit-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 1.2rem; }
        .unit-tab-btn { padding: 0.45rem 1rem; border-radius: 20px; border: 1px solid #e2e8f0; background: #f7fafc; color: #718096; cursor: pointer; font-size: 0.7rem; font-weight: 800; transition: 0.2s; }
        .unit-tab-btn.active { background: var(--unit-color, #2681c8); color: #fff; border-color: transparent; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .idol-list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .idol-item { padding: 0.7rem 1rem; border-radius: 12px; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 10px; font-size: 0.9rem; font-weight: 700; color: #2d3748; border: 1px solid transparent; }
        .idol-item:hover { background: #f7fafc; border-color: #edf2f7; transform: translateX(2px); }
        .color-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,0.05); }

        .idol-tag { background: #fff; padding: 0.8rem 1rem; border-radius: 16px; display: flex; align-items: center; gap: 1rem; border: 1px solid #e2e8f0; margin-bottom: 0.8rem; box-shadow: 0 2px 6px rgba(0,0,0,0.02); }
        .tag-name { flex: 1; font-weight: 800; font-size: 0.95rem; color: #1a202c; }
        .tag-icon-btn { background: #f7fafc; border: 1px solid #edf2f7; width: 32px; height: 32px; border-radius: 10px; color: #4a5568; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; transition: 0.2s; }
        .tag-icon-btn:hover { background: #2681c8; color: #fff; border-color: #2681c8; }
        .tag-icon-btn.remove:hover { background: #e53e3e; color: #fff; border-color: #e53e3e; }
        
        .instruction-text { margin-top: 1.5rem; font-size: 0.7rem; color: #a0aec0; text-align: center; line-height: 1.6; font-weight: 600; }
        
        @media (max-width: 1000px) {
          .main-content { grid-template-columns: 1fr; }
          .editor-section { height: auto; margin-bottom: 2rem; }
          .preview-sticky { position: static; }
        }
      `}</style>
    </div>
  );
}
