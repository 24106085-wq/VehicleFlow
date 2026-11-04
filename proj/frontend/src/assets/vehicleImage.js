// Locally generated, colour-matched vehicle illustrations (no network needed).
const COLORS = {
  red: '#e11d2e', white: '#f3f6fb', blue: '#1d6fe0', black: '#1a1f2b', silver: '#b8c2d0', grey: '#7d8798', gray: '#7d8798',
  green: '#1f9d63', yellow: '#f5c518', orange: '#f97316', brown: '#8b5a3c', maroon: '#7f1d2d', beige: '#d9c7a3', gold: '#d4a537', purple: '#7c3aed', pink: '#ec6aa8',
};
const SUV = /creta|xuv|nexon|brezza|seltos|fortuner|scorpio|thar|harrier|safari|venue|sonet|punch|ecosport|duster|kicks|compass|tucson|hector|exter|jimny|gloster|innova|ertiga|carens|alcazar|suv|kushaq|taigun|grand vitara|bolero|magnite|kiger/i;
const SEDAN = /city|verna|ciaz|amaze|dzire|civic|camry|octavia|slavia|virtus|aura|accord|corolla|sedan|elantra|superb|tigor|xcent/i;

export const bodyType = (model = '') => (SUV.test(model) ? 'suv' : SEDAN.test(model) ? 'sedan' : 'hatch');

const hexOf = (name = '') => {
  const n = name.toLowerCase();
  const key = Object.keys(COLORS).find((k) => n.includes(k));
  return key ? COLORS[key] : '#3b82f6';
};
const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
};

const SHAPES = {
  hatch: { body: 'M25 90c0-10 6-16 18-19l36-9c12-15 30-25 52-26h30c24 0 40 12 52 30l22 6c12 3 18 9 18 18v12c0 4-3 7-7 7H32c-4 0-7-3-7-7Z', glass: 'M90 62c12-12 26-20 44-21h26c18 1 32 11 42 26H90Z', pillar: 'M152 41v26', wx: [82, 226], r: 17 },
  sedan: { body: 'M16 92c0-9 5-15 16-18l42-10c14-14 32-22 54-22h34c22 0 38 10 50 24l42 8c10 2 16 8 16 16v12c0 4-3 7-7 7H23c-4 0-7-3-7-7Z', glass: 'M90 64c12-11 26-17 44-17h34c16 0 30 8 40 17Z', pillar: 'M156 47v17', wx: [78, 236], r: 17 },
  suv: { body: 'M20 94c0-10 5-16 16-19l24-6c6-18 18-30 40-32h110c14 2 24 10 30 24l22 8c10 3 16 9 16 18v14c0 4-3 7-7 7H27c-4 0-7-3-7-7Z', glass: 'M82 66c4-12 12-20 30-21h104c10 1 18 8 22 21Z', pillar: 'M164 45v21', wx: [80, 236], r: 20 },
};

export function vehicleImage(v) {
  const t = SHAPES[bodyType(v.model)], base = hexOf(v.color);
  const wheel = (x) => `<circle cx="${x}" cy="102" r="${t.r}" fill="#0a1220"/><circle cx="${x}" cy="102" r="${t.r - 8}" fill="url(#rim)"/><circle cx="${x}" cy="102" r="3" fill="#1b2638"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 130"><defs>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(base, .35)}"/><stop offset=".6" stop-color="${base}"/><stop offset="1" stop-color="${shade(base, -.4)}"/></linearGradient>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c6ecff"/><stop offset="1" stop-color="#3a6aa8"/></linearGradient>
<radialGradient id="rim"><stop offset="0" stop-color="#eef6ff"/><stop offset="1" stop-color="#6f86a8"/></radialGradient></defs>
<ellipse cx="150" cy="118" rx="125" ry="7" fill="#000" opacity=".35"/>
<path d="${t.body}" fill="url(#b)"/><path d="${t.glass}" fill="url(#g)" opacity=".95"/><path d="${t.pillar}" stroke="${shade(base, -.5)}" stroke-width="3"/>
<path d="M30 84h245" stroke="#fff" stroke-opacity=".25" stroke-width="1.5"/>${t.wx.map(wheel).join('')}</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
