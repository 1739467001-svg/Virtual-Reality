// Lightweight 2D minimap / floor-plan HUD drawn on its own canvas overlay.
// Shows the room outline, furniture footprints (live, so moved pieces update)
// and the player's position + facing.
export function createMinimap(canvasEl, { w, d, getColliders, getPose }) {
  const ctx = canvasEl.getContext('2d');
  const W = canvasEl.width, H = canvasEl.height;
  const pad = 12;
  const drawW = W - pad * 2, drawH = H - pad * 2;

  const tx = (x) => pad + ((x + w / 2) / w) * drawW;
  const tz = (z) => pad + ((z + d / 2) / d) * drawH;

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

    // Room outline.
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx(-w / 2), tz(-d / 2), drawW, drawH);

    // Furniture footprints.
    ctx.fillStyle = 'rgba(78,161,255,0.55)';
    for (const c of getColliders()) {
      ctx.fillRect(
        tx(c.minX), tz(c.minZ),
        ((c.maxX - c.minX) / w) * drawW,
        ((c.maxZ - c.minZ) / d) * drawH
      );
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
