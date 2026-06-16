// Procedural canvas textures — keeps the project asset-free so it runs from any
// static host without downloading external images.
import * as THREE from 'three';

function canvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Tileable wood plank floor.
export function makeWoodTexture({ base = '#a9743b', plank = 10 } = {}) {
  const size = 512;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const plankH = size / plank;
  for (let i = 0; i < plank; i++) {
    const y = i * plankH;
    // Slight per-plank tone variation.
    const shade = 0.85 + Math.random() * 0.3;
    ctx.fillStyle = shadeColor(base, shade);
    ctx.fillRect(0, y, size, plankH - 1);

    // Wood grain streaks.
    for (let g = 0; g < 22; g++) {
      ctx.strokeStyle = `rgba(60,35,15,${0.04 + Math.random() * 0.06})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gy = y + Math.random() * plankH;
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(size * 0.3, gy + (Math.random() - 0.5) * 6,
        size * 0.6, gy + (Math.random() - 0.5) * 6, size, gy);
      ctx.stroke();
    }
    // Plank seam shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, y + plankH - 2, size, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Soft striped rug.
export function makeRugTexture(colorA = '#c0392b', colorB = '#922b21') {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = colorA;
  ctx.fillRect(0, 0, size, size);
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    if (i % 2 === 0) continue;
    ctx.fillStyle = colorB;
    ctx.fillRect(0, (i * size) / stripes, size, size / stripes);
  }
  // Border.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, size - 16, size - 16);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Subtle wall texture with faint vertical noise so flat walls don't look dead.
export function makeWallTexture(base = '#e8e2d6') {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.025})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A simple framed picture for the walls.
export const PICTURE_VARIANTS = 6;
export function makePictureTexture(kind = 0) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const k = ((Math.trunc(kind) % PICTURE_VARIANTS) + PICTURE_VARIANTS) % PICTURE_VARIANTS;
  const vGrad = (a, b) => { const g = ctx.createLinearGradient(0, 0, 0, size); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  const hills = (col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.7);
    ctx.bezierCurveTo(size * 0.3, size * 0.55, size * 0.6, size * 0.82, size, size * 0.65);
    ctx.lineTo(size, size); ctx.lineTo(0, size); ctx.closePath(); ctx.fill();
  };
  if (k === 0) {                              // sunrise over hills
    ctx.fillStyle = vGrad('#ff9a3c', '#ffd56b'); ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#fff2c0'; ctx.beginPath(); ctx.arc(size * 0.68, size * 0.34, 26, 0, 7); ctx.fill();
    hills('rgba(40,60,45,0.8)');
  } else if (k === 1) {                       // blue-sky hills
    ctx.fillStyle = vGrad('#4a90d9', '#a8d0f0'); ctx.fillRect(0, 0, size, size); hills('#2f6e3f');
  } else if (k === 2) {                       // purple dusk
    ctx.fillStyle = vGrad('#2c3e50', '#8e44ad'); ctx.fillRect(0, 0, size, size); hills('#160e26');
  } else if (k === 3) {                       // ocean horizon
    ctx.fillStyle = vGrad('#bfe6f2', '#eaf7fb'); ctx.fillRect(0, 0, size, size * 0.58);
    ctx.fillStyle = vGrad('#2a7fb0', '#1d5e86'); ctx.fillRect(0, size * 0.58, size, size * 0.42);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(20, size * (0.66 + i * 0.07)); ctx.lineTo(size - 20, size * (0.66 + i * 0.07)); ctx.stroke(); }
  } else if (k === 4) {                       // forest
    ctx.fillStyle = '#e3efd8'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#3f7d34';
    for (let i = 0; i < 7; i++) {
      const x = 20 + i * 34;
      ctx.beginPath(); ctx.moveTo(x, size * 0.85); ctx.lineTo(x - 18, size * 0.85); ctx.lineTo(x, size * 0.3); ctx.lineTo(x + 18, size * 0.85); ctx.closePath(); ctx.fill();
    }
  } else {                                    // abstract colour blocks
    const cols = ['#e74c3c', '#f1c40f', '#2980b9', '#27ae60', '#8e44ad', '#e67e22'];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = cols[i];
      ctx.fillRect((i % 3) * (size / 3), Math.floor(i / 3) * (size / 2), size / 3, size / 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Subtle woven-cloth look for upholstery, cushions and curtains.
export function makeFabricTexture(color = '#3d5a80') {
  const size = 128;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 3) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, 0, 1, size);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x + 1, 0, 1, size);
  }
  for (let y = 0; y < size; y += 3) {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, y, size, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, y + 1, size, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A simple analog clock face.
export function makeClockTexture() {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const r = size / 2;
  ctx.fillStyle = '#fbfbf7';
  ctx.beginPath();
  ctx.arc(r, r, r - 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 6;
  ctx.stroke();
  // Hour ticks.
  ctx.strokeStyle = '#333';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x1 = r + Math.cos(a) * (r - 22), y1 = r + Math.sin(a) * (r - 22);
    const x2 = r + Math.cos(a) * (r - 14), y2 = r + Math.sin(a) * (r - 14);
    ctx.lineWidth = i % 3 === 0 ? 7 : 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // Hands (static, ~10:10).
  const hand = (ang, len, w, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.lineTo(r + Math.cos(ang) * len, r + Math.sin(ang) * len);
    ctx.stroke();
  };
  hand(-Math.PI * 0.83, r * 0.45, 8, '#222');  // hour
  hand(-Math.PI * 0.13, r * 0.7, 5, '#222');   // minute
  hand(Math.PI * 0.5, r * 0.75, 2, '#c0392b'); // second
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(r, r, 7, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function shadeColor(hex, factor) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}
