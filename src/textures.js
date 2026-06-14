// 程序化行星纹理：全部用 Canvas 生成，不依赖任何外部图片（环境 CDN 被网络策略拦截）。
// 输出 1024×512 的等距柱状（equirectangular）贴图，正好匹配 SphereGeometry 的 UV。
import * as THREE from "three";

// 确定性随机（mulberry32），保证每次生成的行星样子一致
function rng(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 把一个 0xRRGGBB 颜色按 amt(-1..1) 变暗(<0)或变亮(>0)
function shade(color, amt) {
  let r = (color >> 16) & 255,
    g = (color >> 8) & 255,
    b = color & 255;
  const target = amt < 0 ? 0 : 255;
  const t = Math.min(1, Math.abs(amt));
  r = Math.round(r + (target - r) * t);
  g = Math.round(g + (target - g) * t);
  b = Math.round(b + (target - b) * t);
  return `rgb(${r},${g},${b})`;
}

// 岩石行星：基色 + 斑块 + 极冠（水星/金星/火星）
function rockyTexture(base, seed) {
  return canvasTex(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = shade(base, 0);
    ctx.fillRect(0, 0, w, h);
    const rand = rng(seed);
    for (let i = 0; i < 1500; i++) {
      const x = rand() * w,
        y = rand() * h,
        r = 2 + rand() * 24;
      ctx.fillStyle = shade(base, (rand() - 0.5) * 0.5);
      ctx.globalAlpha = 0.18 + rand() * 0.3;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.6 + rand() * 0.7), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 极冠
    const capH = h * 0.09;
    ctx.fillStyle = "rgba(235,238,248,0.55)";
    ctx.fillRect(0, 0, w, capH);
    ctx.fillRect(0, h - capH, w, capH);
  });
}

// 地球：海洋 + 大陆 + 沙漠 + 冰盖
function earthTexture(seed) {
  return canvasTex(1024, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0a2a4a");
    g.addColorStop(0.5, "#15549a");
    g.addColorStop(1, "#0a2a4a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rand = rng(seed);
    for (let i = 0; i < 28; i++) {
      const cx = rand() * w,
        cy = h * 0.16 + rand() * h * 0.68;
      const blobs = 8 + ((rand() * 12) | 0);
      ctx.fillStyle = rand() < 0.5 ? "#3d7a37" : "#5a7d3a";
      ctx.globalAlpha = 0.85;
      for (let b = 0; b < blobs; b++) {
        const x = cx + (rand() - 0.5) * 130,
          y = cy + (rand() - 0.5) * 90,
          r = 8 + rand() * 42;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 沙漠点缀
    ctx.globalAlpha = 1;
    for (let i = 0; i < 320; i++) {
      const x = rand() * w,
        y = h * 0.3 + rand() * h * 0.4,
        r = 4 + rand() * 14;
      ctx.fillStyle = "rgba(190,158,96,0.25)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 冰盖
    ctx.fillStyle = "rgba(245,250,255,0.92)";
    ctx.fillRect(0, 0, w, h * 0.07);
    ctx.fillRect(0, h * 0.93, w, h * 0.07);
  });
}

// 地球云层（带透明通道，贴在略大的球上）
export function cloudTexture(seed = 13) {
  return canvasTex(1024, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const rand = rng(seed);
    for (let i = 0; i < 440; i++) {
      const x = rand() * w,
        y = rand() * h,
        r = 10 + rand() * 48;
      ctx.fillStyle = `rgba(255,255,255,${0.05 + rand() * 0.22})`;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// 气态巨行星：横向条纹 + 湍流 +（木星）大红斑
function gasGiantTexture(base, seed, redSpot) {
  return canvasTex(1024, 512, (ctx, w, h) => {
    const rand = rng(seed);
    let y = 0;
    while (y < h) {
      const bh = 6 + rand() * 30;
      ctx.fillStyle = shade(base, (rand() - 0.5) * 0.55);
      ctx.fillRect(0, y, w, bh + 1);
      y += bh;
    }
    // 湍流：波浪状细线
    for (let i = 0; i < 2400; i++) {
      const yy = rand() * h;
      ctx.strokeStyle = shade(base, (rand() - 0.5) * 0.4);
      ctx.globalAlpha = 0.1;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      const freq = 1 + rand() * 3;
      for (let x = 0; x <= w; x += 48) {
        ctx.lineTo(x, yy + Math.sin((x / w) * Math.PI * 2 * freq) * 4);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (redSpot) {
      const x = w * 0.7,
        yc = h * 0.62;
      const rg = ctx.createRadialGradient(x, yc, 2, x, yc, 64);
      rg.addColorStop(0, "#d05a3e");
      rg.addColorStop(0.6, "#b5462f");
      rg.addColorStop(1, "rgba(180,70,47,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(x, yc, 72, 34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// 冰巨行星：平滑渐变 + 少量淡带（天王星/海王星）
function iceGiantTexture(base, seed) {
  return canvasTex(1024, 512, (ctx, w, h) => {
    const rand = rng(seed);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade(base, 0.2));
    g.addColorStop(0.5, shade(base, -0.05));
    g.addColorStop(1, shade(base, 0.16));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {
      const yy = rand() * h,
        bh = 10 + rand() * 26;
      ctx.fillStyle = shade(base, (rand() - 0.5) * 0.25);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, yy, w, bh);
    }
    ctx.globalAlpha = 1;
  });
}

// 太阳：橙黄底 + 颗粒状米粒组织
export function sunTexture(seed = 99) {
  return canvasTex(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = "#ff9a1e";
    ctx.fillRect(0, 0, w, h);
    const rand = rng(seed);
    for (let i = 0; i < 3200; i++) {
      const x = rand() * w,
        y = rand() * h,
        r = 2 + rand() * 16;
      ctx.globalAlpha = 0.05 + rand() * 0.12;
      ctx.fillStyle = rand() < 0.5 ? "#ffd86b" : "#ff6a00";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

// 行星环（沿半径方向的明暗带 + 卡西尼缝），配合自定义 UV 使用
export function ringTexture(base, seed = 21) {
  return canvasTex(512, 8, (ctx, w, h) => {
    const rand = rng(seed);
    for (let x = 0; x < w; x++) {
      const t = x / w;
      let a = 0.85;
      if (t > 0.46 && t < 0.53) a = 0.08; // 卡西尼缝
      if (t > 0.72 && t < 0.75) a = 0.22; // 恩克缝
      if (t < 0.04) a = 0.0;
      ctx.fillStyle = shade(base, (rand() - 0.5) * 0.25);
      ctx.globalAlpha = a * (0.7 + rand() * 0.3);
      ctx.fillRect(x, 0, 1, h);
    }
    ctx.globalAlpha = 1;
  });
}

// 按行星类型分发纹理
export function planetTexture(p) {
  switch (p.type) {
    case "earth":
      return earthTexture(7);
    case "gasGiant":
      return gasGiantTexture(p.color, p.seed || 3, p.redSpot);
    case "iceGiant":
      return iceGiantTexture(p.color, p.seed || 5);
    case "rocky":
    default:
      return rockyTexture(p.color, p.seed || 1);
  }
}
