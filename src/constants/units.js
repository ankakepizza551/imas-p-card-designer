// ユニットカラー定義
// brand: 所属ブランド, name: ユニット名, hex: ユニットカラー

export const UNITS = {
  // === SHINY COLORS ===
  'illumination_stars':  { brand: 'shiny',  name: 'illumination STARS',    hex: '#ffed00' },
  'lantica':             { brand: 'shiny',  name: "L'Antica",              hex: '#5a0e6b' },
  'hokago_climax':       { brand: 'shiny',  name: '放課後クライマックスガールズ', hex: '#ff7f0a' },
  'alstroemeria':        { brand: 'shiny',  name: 'ALSTROEMERIA',          hex: '#f195c6' },
  'straylight':          { brand: 'shiny',  name: 'Straylight',            hex: '#0054a6' },
  'noctchill':           { brand: 'shiny',  name: 'noctchill',             hex: '#1d1d1d' },
  'cometik':             { brand: 'shiny',  name: 'CoMETIK',               hex: '#f31469' },
  'shhis':               { brand: 'shiny',  name: 'SHHis',                 hex: '#a5d9f5' },

  // === SideM ===
  'jupiter':             { brand: 'sidem',  name: 'Jupiter',               hex: '#ff9800' },
  'dramatic_stars':      { brand: 'sidem',  name: 'DRAMATIC STARS',        hex: '#00549e' },
  'beit':                { brand: 'sidem',  name: 'Beit',                  hex: '#3bbcb8' },
  'w':                   { brand: 'sidem',  name: 'W',                     hex: '#ff5722' },
  'sem':                 { brand: 'sidem',  name: 'S.E.M',                 hex: '#8bc34a' },
  'high_joker':          { brand: 'sidem',  name: 'High×Joker',            hex: '#ffc107' },
  'the_kogado':          { brand: 'sidem',  name: 'THE 虎牙道',             hex: '#e91e63' },
  'shinsoku_ikkon':      { brand: 'sidem',  name: '神速一魂',               hex: '#9c27b0' },
  'cafe_parade':         { brand: 'sidem',  name: 'Café Parade',           hex: '#795548' },
  'mofumofuen':          { brand: 'sidem',  name: 'もふもふえん',            hex: '#4caf50' },
  'altessimo':           { brand: 'sidem',  name: 'Altessimo',             hex: '#607d8b' },
  'sai':                 { brand: 'sidem',  name: '彩',                    hex: '#f44336' },
  'frame':               { brand: 'sidem',  name: 'FRAME',                 hex: '#1565c0' },
  'legenders':           { brand: 'sidem',  name: 'Legenders',             hex: '#6a1b9a' },
  'cfirst':              { brand: 'sidem',  name: 'C.FIRST',               hex: '#e65100' },
  'flags':               { brand: 'sidem',  name: 'F-LAGS',                hex: '#2e7d32' },

  // === MILLION LIVE (3属性) ===
  'princess':            { brand: 'million', name: 'Princess',             hex: '#ffc30b' },
  'fairy':               { brand: 'million', name: 'Fairy',                hex: '#3278c1' },
  'angel':               { brand: 'million', name: 'Angel',                hex: '#f7a0ba' },

  // === CINDERELLA GIRLS (3属性) ===
  'cute':                { brand: 'cinderella', name: 'Cute',              hex: '#ff69b4' },
  'cool':                { brand: 'cinderella', name: 'Cool',              hex: '#3366ff' },
  'passion':             { brand: 'cinderella', name: 'Passion',           hex: '#ffaa00' },
};

// ブランドごとのユニット一覧を取得するヘルパー
export const getUnitsByBrand = (brandId) => {
  return Object.entries(UNITS)
    .filter(([, u]) => u.brand === brandId)
    .map(([id, u]) => ({ id, ...u }));
};

// ユニットIDの配列を返す
export const UNIT_LIST = Object.entries(UNITS).map(([id, u]) => ({ id, ...u }));
