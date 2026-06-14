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
export function makePictureTexture(kind = 0) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const skies = [['#ff9a3c', '#ffd56b'], ['#4a90d9', '#a8d0f0'], ['#2c3e50', '#8e44ad']];
  const [a, b] = skies[kind % skies.length];
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // Abstract hills / horizon.
  ctx.fillStyle = 'rgba(20,40,30,0.7)';
  ctx.beginPath();
  ctx.moveTo(0, size * 0.7);
  ctx.bezierCurveTo(size * 0.3, size * 0.55, size * 0.6, size * 0.8, size, size * 0.65);
  ctx.lineTo(size, size);
  ctx.lineTo(0, size);
  ctx.closePath();
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
