export const BRANDS = {
  allstars: {
    id: 'allstars',
    name: '765PRO ALLSTARS',
    color: '#f12520',
    secondaryColor: '#ffffff',
    textColor: '#ffffff',
  },
  cinderella: {
    id: 'cinderella',
    name: 'CINDERELLA GIRLS',
    color: '#2681c8',
    secondaryColor: '#ffffff',
    textColor: '#ffffff',
  },
  million: {
    id: 'million',
    name: 'MILLION LIVE!',
    color: '#ffc30b',
    secondaryColor: '#333333',
    textColor: '#333333',
  },
  sidem: {
    id: 'sidem',
    name: 'SideM',
    color: '#30bb94',
    secondaryColor: '#ffffff',
    textColor: '#ffffff',
  },
  shiny: {
    id: 'shiny',
    name: 'SHINY COLORS',
    color: '#8dbaff',
    secondaryColor: '#ffffff',
    textColor: '#ffffff',
  },
  gakuen: {
    id: 'gakuen',
    name: '学園アイドルマスター',
    color: '#ff6600',
    secondaryColor: '#ffffff',
    textColor: '#ffffff',
  },
  valive: {
    id: 'valive',
    name: 'vα-liv',
    color: '#f82c44',
    secondaryColor: '#ffffff',
    textColor: '#ffffff',
  },
  other: {
    id: 'other',
    name: 'その他',
    color: '#607d8b',
    secondaryColor: '#ffffff',
    textColor: '#ffffff',
  }
};

export const BRAND_LIST = Object.keys(BRANDS);

export const getUnitsByBrand = (brandId) => {
  if (brandId === 'sidem') {
    return [
      { id: 'dramatic_stars', name: 'DRAMATIC STARS', color: '#e52128' },
      { id: 'jupiter', name: 'Jupiter', color: '#93ce41' },
      { id: 'altessimo', name: 'Altessimo', color: '#edde2d' },
      { id: 'beit', name: 'Beit', color: '#7dc9e1' },
      { id: 'high_joker', name: 'High×Joker', color: '#ff211d' },
      { id: 'w', name: 'W', color: '#f8c21a' },
      { id: 'frame', name: 'FRAME', color: '#15104d' },
      { id: 'sai', name: '彩', color: '#721a71' },
      { id: 'shinsoku_ikkon', name: '神速一魂', color: '#11172a' },
      { id: 'cafe_parade', name: 'Café Parade', color: '#f3caab' },
      { id: 'mofumofuen', name: 'もふもふえん', color: '#f4869a' },
      { id: 'sem', name: 'S.E.M', color: '#2c3971' },
      { id: 'the_kogado', name: 'THE 虎牙道', color: '#26489a' },
      { id: 'flags', name: 'F-LAGS', color: '#ed222e' },
      { id: 'legenders', name: 'Legenders', color: '#477e8a' },
      { id: 'c_first', name: 'C.FIRST', color: '#0b5ea9' }
    ];
  }
  // 他のブランドはユニット選択なし（今のところ）
  return [];
};
