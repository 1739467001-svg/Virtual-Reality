// Orchestrates the outdoor atmosphere seen through the windows: a gradient sky
// background, smooth (lerped) day/evening/night transitions, weather particles
// (rain / snow) outside, and seasonal exterior colours. It drives the existing
// lights (sun/ambient/hemi), the scene fog and tone-mapping exposure so all the
// look-and-feel stays in sync.
import * as THREE from 'three';

// Per-time-of-day palette. top/bot = sky gradient (zenith → horizon).
const TIME = {
  day:     { top: '#4a80c0', bot: '#bcd6ee', fog: '#cfe0ee', near: 20, far: 72, sunCol: '#fff4e0', sunI: 2.4,  sunPos: [18, 14, 6],  amb: 0.34, hemi: 0.42, exp: 1.0,  env: true },
  evening: { top: '#3a2f55', bot: '#f0a85a', fog: '#e8b27a', near: 18, far: 60, sunCol: '#ff9248', sunI: 1.1,  sunPos: [22, 5, 4],   amb: 0.32, hemi: 0.35, exp: 1.0,  env: true },
  night:   { top: '#05080f', bot: '#16233f', fog: '#10182b', near: 14, far: 55, sunCol: '#9db4e6', sunI: 0.12, sunPos: [16, 12, -6], amb: 0.10, hemi: 0.14, exp: 1.05, env: false },
};
// Weather greys the sky toward `grey`, dims the sun + interior, thickens fog.
const WEATHER = {
  clear: { grey: '#808080', greyAmt: 0.0, sunMul: 1.0,  fogMul: 1.0, ambMul: 1.0,  hemiMul: 1.0,  expMul: 1.0,  particle: null },
  rain:  { grey: '#6f7c88', greyAmt: 0.6, sunMul: 0.45, fogMul: 0.6, ambMul: 0.8,  hemiMul: 0.82, expMul: 0.9,  particle: 'rain' },
  snow:  { grey: '#b3bdc6', greyAmt: 0.6, sunMul: 0.6,  fogMul: 0.6, ambMul: 0.95, hemiMul: 1.0,  expMul: 0.96, particle: 'snow' },
};
// Subtle interior shift per season (exterior colours live in room.js).
const SEASON_LIGHT = {
  spring: { ambMul: 1.0,  expMul: 1.0 },
  summer: { ambMul: 1.03, expMul: 1.02 },
  autumn: { ambMul: 1.0,  expMul: 0.99 },
  winter: { ambMul: 0.96, expMul: 0.97 },
};
// Celestial body (sun by day, moon by night) + star visibility per time.
const SKY_BODY = {
  day:     { col: '#fff2d0', size: 26, op: 0.85, star: 0.0 },
  evening: { col: '#ff8a3a', size: 30, op: 0.9,  star: 0.12 },
  night:   { col: '#dfe6f5', size: 16, op: 0.9,  star: 0.9 },
};

const PARTICLE_VOL = { x0: 6, x1: 28, y0: 0, y1: 16, z0: -12, z1: 16 };  // outdoors, +x of the windows

export function createEnvironment({ scene, renderer, lights, room, env }) {
  const state = { time: 'day', weather: 'clear', season: 'summer' };

  // ---- Sky gradient as the scene background -----------------------------
  const sky = makeSky();
  scene.background = sky.texture;
  scene.fog = new THREE.Fog('#cfe0ee', 20, 72);

  // ---- Weather particle systems -----------------------------------------
  const rain = makeParticles(1300, { color: '#9fb3c8', size: 0.07, opacity: 0.55, fall: 14, sway: 0 });
  const snow = makeParticles(900, { color: '#ffffff', size: 0.13, opacity: 0.9, fall: 1.6, sway: 0.5 });
  scene.add(rain.points, snow.points);

  // ---- Sun / moon billboard + starfield (sky, occluded by walls) --------
  const celestial = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlow(), color: 0xffffff, transparent: true, depthWrite: false,
    fog: false, blending: THREE.AdditiveBlending,
  }));
  celestial.scale.setScalar(20);
  scene.add(celestial);
  const stars = makeStars(700);
  scene.add(stars.points);

  // ---- Animated state (cur lerps toward tgt) ----------------------------
  const tgt = blank();
  const cur = blank();
  let settled = false;

  function recompute() {
    const t = TIME[state.time], w = WEATHER[state.weather];
    const sl = SEASON_LIGHT[state.season] || SEASON_LIGHT.summer;
    const b = SKY_BODY[state.time];
    const grey = new THREE.Color(w.grey);
    tgt.top.set(t.top).lerp(grey, w.greyAmt);
    tgt.bot.set(t.bot).lerp(grey, w.greyAmt);
    tgt.fog.set(t.fog).lerp(grey, w.greyAmt * 0.7);
    tgt.near = t.near; tgt.far = t.far * w.fogMul;
    tgt.sunCol.set(t.sunCol); tgt.sunI = t.sunI * w.sunMul;
    tgt.sunPos.set(...t.sunPos);
    tgt.amb = t.amb * w.ambMul * sl.ambMul;
    tgt.hemi = t.hemi * w.hemiMul;
    tgt.exp = t.exp * w.expMul * sl.expMul;
    // Clouds hide the sun/moon and stars.
    tgt.celCol.set(b.col); tgt.celSize = b.size;
    tgt.celOpacity = b.op * Math.max(0, 1 - w.greyAmt * 1.2);
    tgt.starOp = b.star * Math.max(0, 1 - w.greyAmt * 1.5);
    settled = false;
    scene.environment = t.env ? (env ?? null) : null;
    rain.points.visible = w.particle === 'rain';
    snow.points.visible = w.particle === 'snow';
  }

  function apply() {
    sky.redraw(cur.top, cur.bot);
    scene.fog.color.copy(cur.fog); scene.fog.near = cur.near; scene.fog.far = cur.far;
    lights.sun.color.copy(cur.sunCol); lights.sun.intensity = cur.sunI; lights.sun.position.copy(cur.sunPos);
    lights.ambient.intensity = cur.amb;
    if (lights.hemi) lights.hemi.intensity = cur.hemi;
    renderer.toneMappingExposure = cur.exp;
    celestial.position.copy(cur.sunPos).normalize().multiplyScalar(150);
    celestial.material.color.copy(cur.celCol);
    celestial.material.opacity = cur.celOpacity;
    celestial.scale.setScalar(cur.celSize);
    stars.points.material.opacity = cur.starOp;
    stars.points.visible = cur.starOp > 0.01;
  }

  // Snap to the initial target without animating.
  recompute();
  copyState(cur, tgt);
  apply();
  room.setSeason(state.season);

  function update(dt) {
    if (!settled) {
      const a = 1 - Math.exp(-dt * 2.4);
      cur.top.lerp(tgt.top, a); cur.bot.lerp(tgt.bot, a); cur.fog.lerp(tgt.fog, a);
      cur.near += (tgt.near - cur.near) * a; cur.far += (tgt.far - cur.far) * a;
      cur.sunCol.lerp(tgt.sunCol, a); cur.sunI += (tgt.sunI - cur.sunI) * a;
      cur.sunPos.lerp(tgt.sunPos, a);
      cur.amb += (tgt.amb - cur.amb) * a; cur.hemi += (tgt.hemi - cur.hemi) * a; cur.exp += (tgt.exp - cur.exp) * a;
      cur.celCol.lerp(tgt.celCol, a); cur.celSize += (tgt.celSize - cur.celSize) * a;
      cur.celOpacity += (tgt.celOpacity - cur.celOpacity) * a; cur.starOp += (tgt.starOp - cur.starOp) * a;
      apply();
      if (Math.abs(cur.sunI - tgt.sunI) < 0.005 && Math.abs(cur.far - tgt.far) < 0.1) { copyState(cur, tgt); settled = true; }
    }
    animate(rain, dt, false);
    animate(snow, dt, true);
  }

  function animate(sys, dt, drift) {
    if (!sys.points.visible) return;
    const p = sys.pos, v = PARTICLE_VOL, t = performance.now() * 0.001;
    for (let i = 0; i < p.length; i += 3) {
      p[i + 1] -= sys.fall * dt;
      if (drift) p[i] += Math.sin(t + i) * sys.sway * dt;
      if (p[i + 1] < v.y0) { p[i + 1] = v.y1; p[i] = rand(v.x0, v.x1); p[i + 2] = rand(v.z0, v.z1); }
    }
    sys.geo.attributes.position.needsUpdate = true;
  }

  return {
    state, update,
    times: Object.keys(TIME), weathers: Object.keys(WEATHER), seasons: room.seasons,
    setTime(name) { if (TIME[name]) { state.time = name; recompute(); } return state.time; },
    setWeather(name) { if (WEATHER[name]) { state.weather = name; recompute(); } return state.weather; },
    setSeason(name) { state.season = room.setSeason(name); recompute(); return state.season; },
  };
}

// --------------------------------------------------------------------------
function blank() {
  return {
    top: new THREE.Color(), bot: new THREE.Color(), fog: new THREE.Color(),
    near: 20, far: 72, sunCol: new THREE.Color(), sunI: 1, sunPos: new THREE.Vector3(),
    amb: 0.3, hemi: 0.4, exp: 1,
    celCol: new THREE.Color(), celSize: 20, celOpacity: 0, starOp: 0,
  };
}
function copyState(d, s) {
  d.top.copy(s.top); d.bot.copy(s.bot); d.fog.copy(s.fog);
  d.near = s.near; d.far = s.far; d.sunCol.copy(s.sunCol); d.sunI = s.sunI; d.sunPos.copy(s.sunPos);
  d.amb = s.amb; d.hemi = s.hemi; d.exp = s.exp;
  d.celCol.copy(s.celCol); d.celSize = s.celSize; d.celOpacity = s.celOpacity; d.starOp = s.starOp;
}
const rand = (a, b) => a + Math.random() * (b - a);

function makeSky() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const ctx = c.getContext('2d');
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  function redraw(top, bot) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#' + top.getHexString());
    grad.addColorStop(1, '#' + bot.getHexString());
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 16, 256);
    texture.needsUpdate = true;
  }
  return { texture, redraw };
}

function makeGlow() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStars(n) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * Math.PI * 2;
    const y = rand(0.05, 1);            // upper hemisphere
    const r = Math.sqrt(1 - y * y) * 180;
    pos[i * 3] = Math.cos(u) * r;
    pos[i * 3 + 1] = y * 180;
    pos[i * 3 + 2] = Math.sin(u) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: '#ffffff', size: 1.7, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  return { points };
}

function makeParticles(count, opts) {
  const v = PARTICLE_VOL;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rand(v.x0, v.x1);
    pos[i * 3 + 1] = rand(v.y0, v.y1);
    pos[i * 3 + 2] = rand(v.z0, v.z1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: opts.color, size: opts.size, transparent: true, opacity: opts.opacity,
    depthWrite: false, fog: true,
  });
  const points = new THREE.Points(geo, mat);
  points.visible = false;
  points.frustumCulled = false;
  return { points, geo, pos, fall: opts.fall, sway: opts.sway };
}
