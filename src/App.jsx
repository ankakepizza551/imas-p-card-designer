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
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { IDOLS } from './constants/idols';
import { BRANDS, BRAND_LIST } from './constants/brands';
import { getUnitsByBrand } from './constants/units';
import { SortableIdolTag } from './components/SortableIdolTag';

const TEMPLATES = [
  { id: 'standard', name: 'Standard', description: '王道のシンプルデザイン' },
  { id: 'dynamic', name: 'Dynamic', description: '躍動感のある斜線スタイル' },
  { id: 'modern', name: 'Modern', description: '洗練されたダークモード風' },
  { id: 'ticket', name: 'Ticket', description: 'ライブチケット風デザイン' },
  { id: 'splash', name: 'Splash', description: 'ダイナミックな分割デザイン' },
  { id: 'classic', name: 'Classic', description: 'エレガントな罫線デザイン' },
];

const BACK_TEMPLATES = [
  { id: 'idolfull', name: 'Idol Full', description: 'アイドルを大きく配置' },
  { id: 'minimal', name: 'Minimal', description: 'ロゴ中心のシンプル構成' },
  { id: 'custom', name: 'Custom Image', description: '自作画像を背景に使用' },
];

export default function App() {
  const [cardData, setCardData] = useState(() => {
    const saved = localStorage.getItem('imas-p-card-data');
    const defaultData = {
      templateId: 'standard',
      backTemplateId: 'idolfull',
      brandIds: ['allstars'],
      mainBrandId: 'allstars',
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
      showIdols: true,
      showBackBg: true,
      showBrand: true,
      showSns: true,
      textVAlign: 'top',
      textHAlign: 'left',
      textFreePos: false,
      textX: 8,
      textY: 8,
      fontSize: 'medium',
      fontWeight: 'bold',
      imageScale: 1.0,
      imageOffsetX: 0,
      imageOffsetY: 0,
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 互換性処理: brandId(単体)をbrandIds(配列)に変換
        if (parsed.brandId && !parsed.brandIds) {
          parsed.brandIds = [parsed.brandId];
          parsed.mainBrandId = parsed.brandId;
        }
        if (parsed.brandIds && !parsed.mainBrandId) {
          parsed.mainBrandId = parsed.brandIds[0];
        }
        return { 
          ...defaultData, 
          ...parsed, 
          groupImage: null, 
          backImage: null, 
          selectedIdols: (parsed.selectedIdols || []).map(i => ({...i, image: null})) 
        };
      } catch { return defaultData; }
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

  const selectedBrand = BRANDS[cardData.mainBrandId] || BRANDS[cardData.brandIds[0]] || BRANDS.allstars;
  
  const themeGradient = useMemo(() => {
    const colors = cardData.selectedIdols.length > 0 
      ? cardData.selectedIdols.map(idol => idol.hex)
      : (cardData.brandIds.length > 1 
          ? cardData.brandIds.map(id => BRANDS[id].color)
          : [selectedBrand.color, selectedBrand.color]);
    if (colors.length === 1) return colors[0];
    return `linear-gradient(135deg, ${colors.join(', ')})`;
  }, [cardData.selectedIdols, cardData.brandIds, selectedBrand.color]);

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

  const handleTextDragStart = (e) => {
    if (isExporting) return;
    e.preventDefault();
    const card = cardRefFront.current;
    const rect = card.getBoundingClientRect();
    const getXY = (ev) => ev.touches
      ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY }
      : { x: ev.clientX, y: ev.clientY };
    const onMove = (mv) => {
      const { x, y } = getXY(mv);
      const nx = Math.max(0, Math.min(80, (x - rect.left) / rect.width * 100));
      const ny = Math.max(0, Math.min(85, (y - rect.top) / rect.height * 100));
      setCardData(p => ({ ...p, textX: +nx.toFixed(1), textY: +ny.toFixed(1) }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
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

  // 書き出し前に両面を一時的に表示し、終了後に元に戻すヘルパー
  const withBothSidesVisible = async (fn) => {
    const frontEl = cardRefFront.current;
    const backEl = cardRefBack.current;
    const origFront = frontEl.style.display;
    const origBack = backEl.style.display;
    // 両面を強制表示（非表示側もレンダリングさせる）
    frontEl.style.display = 'block';
    backEl.style.display = 'block';
    // レイアウト反映を待つ
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      return await fn();
    } finally {
      frontEl.style.display = origFront;
      backEl.style.display = origBack;
    }
  };

  // Safari/iOS では async コールバック内での window.open がブロックされるため、
  // ユーザー操作と同期のタイミングで先に window を開いておく
  const isSafariOrIOS = () => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    return isIOS || isSafari;
  };

  // Safari では toPng の初回レンダが崩れることがあるため2回呼ぶ（2回目でキャッシュが効く）
  const safeToPng = async (el, options) => {
    if (isSafariOrIOS()) {
      try { await toPng(el, options); } catch (_) { /* warm-up */ }
      await new Promise(r => setTimeout(r, 100));
    }
    return toPng(el, options);
  };

  const handleExportPNG = async () => {
    if (isExporting) return;
    // Safari/iOS: window.open はユーザー操作と同期で呼ぶ必要がある
    const safari = isSafariOrIOS();
    const winF = safari ? window.open('', '_blank') : null;
    const winB = safari ? window.open('', '_blank') : null;
    setIsExporting(true);
    try {
      await withBothSidesVisible(async () => {
        const isMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
        const options = {
          pixelRatio: isMobile ? 2 : 3,
          cacheBust: false,
          style: { transform: 'none' },
          fontEmbedCSS: '',
        };
        const f = await safeToPng(cardRefFront.current, options);
        const b = await safeToPng(cardRefBack.current, options);

        if (safari) {
          // iOS/Safari: 事前に開いたウィンドウに画像を書き込む（長押しで保存）
          const writeImg = (win, dataUrl, label) => {
            if (!win) return;
            win.document.write(
              `<!DOCTYPE html><html><head><meta charset="utf-8">` +
              `<meta name="viewport" content="width=device-width,initial-scale=1">` +
              `<title>${label}</title></head>` +
              `<body style="margin:0;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px">` +
              `<img src="${dataUrl}" style="max-width:100%;height:auto;border-radius:8px">` +
              `<p style="color:#fff;font-family:sans-serif;font-size:14px;text-align:center;padding:0 16px">` +
              `画像を長押し →「写真に保存」を選択してください</p></body></html>`
            );
            win.document.close();
          };
          writeImg(winF, f, '表面');
          writeImg(winB, b, '裏面');
        } else {
          const dl = (u, n) => {
            const a = document.createElement('a');
            a.download = n;
            a.href = u;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          };
          dl(f, 'p-card-front.png');
          setTimeout(() => dl(b, 'p-card-back.png'), 300);
        }
      });
    } catch (err) {
      if (winF) winF.close();
      if (winB) winB.close();
      console.error('PNG export error:', err);
      alert(`保存に失敗しました\n${err?.message || err}\n\nブラウザのコンソール (F12) に詳細が出ています。`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (isExporting) return;
    const safari = isSafariOrIOS();
    const preWin = safari ? window.open('', '_blank') : null;
    setIsExporting(true);
    try {
      await withBothSidesVisible(async () => {
        const options = {
          pixelRatio: 2,
          cacheBust: false,
          style: { transform: 'none' },
          fontEmbedCSS: '',
        };
        const fImg = await safeToPng(cardRefFront.current, options);
        const bImg = await safeToPng(cardRefBack.current, options);

        // 縦A4: 210mm x 297mm / 名刺: 91mm x 55mm → 2列 x 5行 = 10枚
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const cardW = 91, cardH = 55;
        const marginX = (210 - cardW * 2) / 2;
        const marginY = (297 - cardH * 5) / 2;

        [fImg, bImg].forEach((img, pageIdx) => {
          if (pageIdx > 0) pdf.addPage();
          for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 2; col++) {
              pdf.addImage(img, 'PNG', marginX + col * cardW, marginY + row * cardH, cardW, cardH);
            }
          }
        });

        if (safari && preWin) {
          // Safari/iOS: blob URL を事前に開いたウィンドウで表示（PDFビューアで開く）
          const blob = pdf.output('blob');
          const blobUrl = URL.createObjectURL(blob);
          preWin.location.href = blobUrl;
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        } else {
          if (preWin) preWin.close();
          pdf.save('p-card-print.pdf');
        }
      });
    } catch (err) {
      if (preWin) preWin.close();
      alert(`PDF生成に失敗しました: ${err.message}`);
      console.error(err);
    } finally {
      setIsExporting(false);
    }
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

                  {cardData.selectedIdols.length > 1 && cardData.imageMode === 'individual' && (
                    <p className="layer-hint">↕ ドラッグで並び順 = レイヤー前後（上が前面）</p>
                  )}
                  <div className="selected-idols-tags">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={cardData.selectedIdols.map(i => i.id)} strategy={verticalListSortingStrategy}>
                        {cardData.selectedIdols.map(idol => (
                          <SortableIdolTag key={idol.id} idol={idol}
                            onRemove={() => setCardData(p => ({ ...p, selectedIdols: p.selectedIdols.filter(i => i.id !== idol.id) }))}
                            onImageUpload={handleIdolImageUpload}
                            onImageAdjust={(idolId, adj) => setCardData(p => ({
                              ...p,
                              selectedIdols: p.selectedIdols.map(i => i.id === idolId ? { ...i, ...adj } : i)
                            }))}
                          />
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

                  {cardData.imageMode === 'group' && cardData.groupImage && (
                    <div className="img-adjust-controls">
                      <div className="img-adjust-header">
                        <span>画像調整</span>
                        <button className="reset-adjust-btn" onClick={() => setCardData(p => ({...p, imageScale: 1.0, imageOffsetX: 0, imageOffsetY: 0}))}>リセット</button>
                      </div>
                      <div className="form-group">
                        <label>サイズ: {Math.round(cardData.imageScale * 100)}%</label>
                        <input type="range" min="40" max="200" value={Math.round(cardData.imageScale * 100)}
                          onChange={e => setCardData(p => ({...p, imageScale: e.target.value / 100}))}
                          className="range-input" />
                      </div>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>横位置: {cardData.imageOffsetX > 0 ? '+' : ''}{cardData.imageOffsetX}%</label>
                          <input type="range" min="-150" max="150" value={cardData.imageOffsetX}
                            onChange={e => setCardData(p => ({...p, imageOffsetX: Number(e.target.value)}))}
                            className="range-input" />
                        </div>
                        <div className="form-group">
                          <label>縦位置: {cardData.imageOffsetY > 0 ? '+' : ''}{cardData.imageOffsetY}%</label>
                          <input type="range" min="-80" max="80" value={cardData.imageOffsetY}
                            onChange={e => setCardData(p => ({...p, imageOffsetY: Number(e.target.value)}))}
                            className="range-input" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <hr className="divider" />

                <div className="section-group">
                  <h3>4. プロフィール設定</h3>
                  <div className="form-group">
                    <label>ブランド (複数選択可 / ★をクリックでメイン設定)</label>
                    <div className="unit-tabs" style={{ marginTop: '0.5rem' }}>
                      {BRAND_LIST.map(id => {
                        const isSelected = cardData.brandIds.includes(id);
                        const isMain = cardData.mainBrandId === id;
                        return (
                          <div key={id} className="brand-select-item">
                            <button className={`unit-tab-btn ${isSelected ? 'active' : ''}`} style={{ '--unit-color': BRANDS[id].color }} onClick={() => {
                              setCardData(p => {
                                let nextIds = p.brandIds.includes(id) 
                                  ? (p.brandIds.length > 1 ? p.brandIds.filter(x => x !== id) : p.brandIds)
                                  : [...p.brandIds, id];
                                let nextMain = p.mainBrandId;
                                if (!nextIds.includes(nextMain)) nextMain = nextIds[0];
                                return { ...p, brandIds: nextIds, mainBrandId: nextMain };
                              });
                            }}>
                              {BRANDS[id].name}
                            </button>
                            {isSelected && (
                              <button className={`main-set-btn ${isMain ? 'active' : ''}`} title="メインに設定" onClick={() => setCardData(p => ({...p, mainBrandId: id}))}>
                                {isMain ? '★' : '☆'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
                    <input type="text" className="form-input" value={cardData.snsId} onChange={(e) => {
                      const val = e.target.value;
                      setCardData(p => {
                        const next = { ...p, snsId: val };
                        if (val.startsWith('@') && (!p.qrUrl || p.qrUrl.includes('x.com'))) {
                          next.qrUrl = `https://x.com/${val.substring(1)}`;
                        }
                        return next;
                      });
                    }} />
                  </div>
                  <div className="checkbox-group">
                    <input type="checkbox" id="showIdols" checked={cardData.showIdols} onChange={(e) => setCardData(p => ({...p, showIdols: e.target.checked}))} />
                    <label htmlFor="showIdols">担当アイドル名を表示する</label>
                  </div>
                  <div className="checkbox-group">
                    <input type="checkbox" id="showTanto" checked={cardData.showTanto} disabled={!cardData.showIdols} onChange={(e) => setCardData(p => ({...p, showTanto: e.target.checked}))} />
                    <label htmlFor="showTanto" style={{ opacity: cardData.showIdols ? 1 : 0.4 }}>アイドル名の後に「担当」をつける</label>
                  </div>
                  <div className="checkbox-group">
                    <input type="checkbox" id="showSns" checked={cardData.showSns} onChange={(e) => setCardData(p => ({...p, showSns: e.target.checked}))} />
                    <label htmlFor="showSns">X アカウントを表示する</label>
                  </div>
                  <div className="checkbox-group">
                    <input type="checkbox" id="showBrand" checked={cardData.showBrand} onChange={(e) => setCardData(p => ({...p, showBrand: e.target.checked}))} />
                    <label htmlFor="showBrand">ブランド名を表示する</label>
                  </div>
                </div>

                <hr className="divider" />

                <div className="section-group">
                  <h3>5. テキスト位置</h3>
                  <div className="text-pos-grid" style={{ marginBottom: '1rem' }}>
                    <button className={`pos-btn ${!cardData.textFreePos ? 'active' : ''}`} onClick={() => setCardData(p => ({...p, textFreePos: false}))}>固定位置</button>
                    <button className={`pos-btn ${cardData.textFreePos ? 'active' : ''}`} onClick={() => setCardData(p => ({...p, textFreePos: true}))}>自由配置</button>
                  </div>
                  {!cardData.textFreePos ? (
                    <>
                      <div className="form-group">
                        <label>縦方向</label>
                        <div className="text-pos-grid">
                          {[{id:'top',label:'上'},{id:'center',label:'中央'},{id:'bottom',label:'下'}].map(p => (
                            <button key={p.id} className={`pos-btn ${cardData.textVAlign === p.id ? 'active' : ''}`} onClick={() => setCardData(d => ({...d, textVAlign: p.id}))}>{p.label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="form-group">
                        <label>横方向</label>
                        <div className="text-pos-grid">
                          {[{id:'left',label:'左寄せ'},{id:'right',label:'右寄せ'}].map(p => (
                            <button key={p.id} className={`pos-btn ${cardData.textHAlign === p.id ? 'active' : ''}`} onClick={() => setCardData(d => ({...d, textHAlign: p.id}))}>{p.label}</button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="pos-hint">プレビューのテキストをドラッグして自由に移動できます</p>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>横: {Math.round(cardData.textX ?? 8)}%</label>
                          <input type="range" min="0" max="80" value={Math.round(cardData.textX ?? 8)}
                            onChange={e => setCardData(p => ({...p, textX: Number(e.target.value)}))}
                            className="range-input" />
                        </div>
                        <div className="form-group">
                          <label>縦: {Math.round(cardData.textY ?? 8)}%</label>
                          <input type="range" min="0" max="85" value={Math.round(cardData.textY ?? 8)}
                            onChange={e => setCardData(p => ({...p, textY: Number(e.target.value)}))}
                            className="range-input" />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>横揃え</label>
                        <div className="text-pos-grid">
                          {[{id:'left',label:'左寄せ'},{id:'right',label:'右寄せ'}].map(p => (
                            <button key={p.id} className={`pos-btn ${cardData.textHAlign === p.id ? 'active' : ''}`} onClick={() => setCardData(d => ({...d, textHAlign: p.id}))}>{p.label}</button>
                          ))}
                        </div>
                      </div>
                      <button className="reset-adjust-btn" style={{ marginTop: '0.8rem' }}
                        onClick={() => setCardData(p => ({...p, textX: 8, textY: 8}))}>位置リセット</button>
                    </>
                  )}
                </div>

                <hr className="divider" />

                <div className="section-group">
                  <h3>6. テキスト詳細</h3>
                  <div className="form-group">
                    <label>サイズ</label>
                    <div className="text-pos-grid">
                      {[{id:'small',label:'小'},{id:'medium',label:'中'},{id:'large',label:'大'}].map(p => (
                        <button key={p.id} className={`pos-btn ${cardData.fontSize === p.id ? 'active' : ''}`} onClick={() => setCardData(d => ({...d, fontSize: p.id}))}>{p.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>太さ</label>
                    <div className="text-pos-grid">
                      {[{id:'normal',label:'標準'},{id:'bold',label:'太字'}].map(p => (
                        <button key={p.id} className={`pos-btn ${cardData.fontWeight === p.id ? 'active' : ''}`} onClick={() => setCardData(d => ({...d, fontWeight: p.id}))}>{p.label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <hr className="divider" />

                <div className="section-group">
                  <h3>7. 書体設定</h3>
                  <div className="template-grid">
                    <button className={`template-btn ${cardData.fontMode === 'gothic' ? 'active' : ''}`} onClick={() => setCardData(p => ({...p, fontMode: 'gothic'}))}>ゴシック体</button>
                    <button className={`template-btn ${cardData.fontMode === 'mincho' ? 'active' : ''}`} onClick={() => setCardData(p => ({...p, fontMode: 'mincho'}))}>明朝体</button>
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
                  <h3>{cardData.backTemplateId === 'custom' ? '3' : '2'}. QRコード設定</h3>
                  <label className="checkbox-group"><input type="checkbox" checked={cardData.showQr} onChange={(e) => setCardData(p => ({...p, showQr: e.target.checked}))} /> <span>表示する</span></label>
                  <input type="text" value={cardData.qrUrl} onChange={(e) => setCardData(p => ({...p, qrUrl: e.target.value}))} placeholder="URL..." className="form-input" />
                </div>
                <div className="section-group">
                  <h3>{cardData.backTemplateId === 'custom' ? '4' : '3'}. 裏面メッセージ</h3>
                  <textarea value={cardData.backMessage} onChange={(e) => setCardData(p => ({...p, backMessage: e.target.value}))} maxLength={100} className="form-input" />
                  <div className="checkbox-group">
                    <input type="checkbox" id="showBackBg" checked={cardData.showBackBg} onChange={(e) => setCardData(p => ({...p, showBackBg: e.target.checked}))} />
                    <label htmlFor="showBackBg">背景にブランドカラーを塗る</label>
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
                      {(() => {
                        const visible = cardData.selectedIdols.filter(i => i.image);
                        const total = visible.length;
                        return visible.map((idol, di) => (
                          <img key={idol.id} src={idol.image} className="idol-image-auto" style={{
                            '--index': di,
                            '--total': total,
                            '--img-scale': idol.imgScale ?? 1,
                            '--img-x': `${idol.imgOffsetX ?? 0}%`,
                            '--img-y': `${idol.imgOffsetY ?? 0}%`,
                          }} />
                        ));
                      })()}
                    </div>
                  ) : (
                    cardData.groupImage && (
                      <div className="group-image-layer" style={{
                        transform: `scale(${cardData.imageScale}) translate(${cardData.imageOffsetX}%, ${cardData.imageOffsetY}%)`,
                        transformOrigin: 'right center',
                      }}>
                        <img src={cardData.groupImage} className="group-image animate-in" />
                      </div>
                    )
                  )}
                  <div
                    className={`card-content${cardData.textFreePos ? ' free-pos' : ''} text-v-${cardData.textVAlign} text-h-${cardData.textHAlign} f-size-${cardData.fontSize} f-weight-${cardData.fontWeight}`}
                    style={cardData.textFreePos ? { left: `${cardData.textX ?? 8}%`, top: `${cardData.textY ?? 8}%` } : {}}
                    onMouseDown={cardData.textFreePos && !isExporting ? handleTextDragStart : undefined}
                    onTouchStart={cardData.textFreePos && !isExporting ? handleTextDragStart : undefined}
                  >
                    {cardData.showBrand && (
                      <div className="card-header">
                        <span className="brand-label">
                          {cardData.brandIds.map(id => BRANDS[id]?.name || id).join(' / ')}
                        </span>
                      </div>
                    )}
                    <div className="card-body">
                      <div className="name-area"><span className="p-name">{cardData.name}</span><span className="p-suffix">P</span></div>
                      {cardData.title && <div className="p-title">{cardData.title}</div>}
                      {cardData.showIdols && <div className="idol-area">
                        {cardData.selectedIdols.map(i => i.name + (cardData.showTanto ? '担当' : '')).join(' / ')}
                      </div>}
                    </div>
                    {cardData.showSns && <div className="card-footer"><span className="sns-label">𝕏 {cardData.snsId}</span></div>}
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
                  {cardData.templateId === 'splash' && (
                    <>
                      <div className="deco-splash"></div>
                      <div className="deco-splash-line"></div>
                    </>
                  )}
                  {cardData.templateId === 'classic' && (
                    <>
                      <div className="deco-frame"></div>
                      <div className="deco-corner tl"></div>
                      <div className="deco-corner tr"></div>
                      <div className="deco-corner bl"></div>
                      <div className="deco-corner br"></div>
                    </>
                  )}
                </div>
              </div>

              {/* BACK */}
              <div ref={cardRefBack} className={`card-mockup back template-${cardData.backTemplateId} font-${cardData.fontMode} ${!cardData.showBackBg ? 'no-bg' : ''}`} style={{ '--theme-gradient': themeGradient, '--brand-color': selectedBrand.color, '--brand-text': selectedBrand.textColor || '#ffffff', display: activeSide === 'back' ? 'block' : 'none' }}>
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
                    <div className="brand-logo-large">
                      {cardData.brandIds.length > 3 ? 'PRODUCER' : cardData.brandIds.map(id => id === 'allstars' ? '765PRO' : (BRANDS[id]?.name || id)).join(' / ')}
                    </div>
                    <p className="back-msg">{cardData.backMessage}</p>
                    {cardData.showQr && cardData.qrUrl && (
                      <div className="qr-container">
                        <QRCodeSVG value={cardData.qrUrl} size={48} level="M" marginSize={0} />
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
    </div>
  );
}
