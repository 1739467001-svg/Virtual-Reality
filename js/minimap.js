// Lightweight 2D minimap / floor-plan HUD drawn on its own canvas overlay.
// Shows the room outline, furniture footprints (live, so moved pieces update)
// and the player's position + facing.
export function createMinimap(canvasEl, { ext, walls = [], getColliders, getObstacles, getPose }) {
  const ctx = canvasEl.getContext('2d');
  const W = canvasEl.width, H = canvasEl.height;
  const pad = 12;
  const drawW = W - pad * 2, drawH = H - pad * 2;

  // Map world X/Z into the canvas using the floor-plan extent, preserving aspect
  // ratio so non-square apartments aren't stretched.
  const w = ext.maxX - ext.minX, d = ext.maxZ - ext.minZ;
  const scale = Math.min(drawW / w, drawH / d);
  const offX = pad + (drawW - w * scale) / 2;
  const offY = pad + (drawH - d * scale) / 2;
  const tx = (x) => offX + (x - ext.minX) * scale;
  const tz = (z) => offY + (z - ext.minZ) * scale;
  const sz = (v) => v * scale;

  function roundRect(x, y, ww, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + ww, y, x + ww, y + hh, r);
    ctx.arcTo(x + ww, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r);
    ctx.arcTo(x, y, x + ww, y, r);
    ctx.closePath();
  }

  function update() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(16,20,28,0.72)';
    roundRect(1, 1, W - 2, H - 2, 12);
    ctx.fill();

    // Room / apartment outline.
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx(ext.minX), tz(ext.minZ), sz(w), sz(d));

    // Interior walls (with doorway gaps).
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    for (const wl of walls) {
      ctx.beginPath();
      ctx.moveTo(tx(wl.x1), tz(wl.z ?? wl.z1));
      ctx.lineTo(tx(wl.x2), tz(wl.z ?? wl.z2));
      ctx.stroke();
    }

    // Static obstacles (bed, etc.).
    ctx.fillStyle = 'rgba(170,170,180,0.4)';
    for (const c of (getObstacles ? getObstacles() : [])) {
      if (Math.abs(c.maxZ - c.minZ) < 0.2) continue; // skip thin wall slabs (drawn as lines)
      ctx.fillRect(tx(c.minX), tz(c.minZ), sz(c.maxX - c.minX), sz(c.maxZ - c.minZ));
    }

    // Furniture footprints.
    ctx.fillStyle = 'rgba(78,161,255,0.55)';
    for (const c of getColliders()) {
      ctx.fillRect(tx(c.minX), tz(c.minZ), sz(c.maxX - c.minX), sz(c.maxZ - c.minZ));
    }

    // Player arrow.
    const p = getPose();
    const px = tx(p.x), py = tz(p.z);
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(fz, fx));
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, 5);
    ctx.lineTo(-6, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return { update };
}
