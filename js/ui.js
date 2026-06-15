// Wires the on-screen control panel, the touch joystick, the enter/overlay flow
// and the save/share-by-URL feature to the scene modules. Pure DOM glue.

const WALL_COLORS = [
  { name: '暖白 Warm white', hex: '#ffffff' },
  { name: '米灰 Greige', hex: '#d9d2c5' },
  { name: '雾蓝 Misty blue', hex: '#b9c7cf' },
  { name: '鼠尾草 Sage', hex: '#b6c1a8' },
  { name: '浅杏 Apricot', hex: '#e9d9c5' },
];
const FLOOR_LABELS = { oak: '橡木 Oak', walnut: '胡桃 Walnut', ash: '白蜡 Ash', grey: '灰木 Grey' };
const TIME_LABELS = { day: '☀️ 白天 Day', evening: '🌇 黄昏 Evening', night: '🌙 夜晚 Night' };

export function setupUI({ room, lights, furniture, player, mover }) {
  const $ = (id) => document.getElementById(id);
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const hint = $('hint');
  const flash = (msg) => {
    hint.textContent = msg;
    hint.classList.add('show');
    clearTimeout(flash._t);
    flash._t = setTimeout(() => hint.classList.remove('show'), 2200);
  };

  // ---- Enter overlay / pointer lock -------------------------------------
  const overlay = $('overlay');
  $('btn-enter').addEventListener('click', () => {
    overlay.classList.add('hidden');
    if (!isTouch) player.lockPointer();
  });
  if (!isTouch) {
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) overlay.classList.add('hidden');
      else overlay.classList.remove('hidden');
    });
  }

  const setBtn = (el, on) => {
    el.classList.toggle('on', on);
    el.querySelector('.state').textContent = on ? 'ON' : 'OFF';
  };

  // ---- Element handles ---------------------------------------------------
  const ceiling = $('btn-ceiling'), lamp = $('btn-lamp'), timeBtn = $('btn-time');
  const sofaColorBtn = $('btn-sofa-color'), sofaStyleBtn = $('btn-sofa-style');
  const tableBtn = $('btn-table'), rugToggle = $('btn-rug-toggle');
  const wallBtn = $('btn-wall'), floorBtn = $('btn-floor');

  // ---- Indexed finishes (apply functions double as cycle + restore) ------
  const idx = { wall: 0, floor: 0, time: 0 };
  const wrap = (v, n) => ((Math.trunc(v) % n) + n) % n;

  function applyTime(i) {
    idx.time = wrap(i, lights.times.length);
    const t = lights.times[idx.time];
    lights.setTimeOfDay(t);
    timeBtn.querySelector('.val').textContent = TIME_LABELS[t];
  }
  function applyWall(i) {
    idx.wall = wrap(i, WALL_COLORS.length);
    room.setWallColor(WALL_COLORS[idx.wall].hex);
    wallBtn.querySelector('.val').textContent = WALL_COLORS[idx.wall].name;
  }
  function applyFloor(i) {
    idx.floor = wrap(i, room.themes.length);
    const t = room.themes[idx.floor];
    room.setFloorTheme(t);
    floorBtn.querySelector('.val').textContent = FLOOR_LABELS[t];
  }
  function refreshFurnitureLabels() {
    sofaColorBtn.querySelector('.swatch').style.background = furniture.sofaColorHex();
    sofaStyleBtn.querySelector('.val').textContent = furniture.info().sofaStyle;
    tableBtn.querySelector('.val').textContent = furniture.info().table;
    setBtn(rugToggle, furniture.state.rugVisible);
  }

  // Initial labels.
  applyTime(0); applyWall(0); applyFloor(0);
  setBtn(ceiling, lights.state.ceiling);
  setBtn(lamp, lights.state.lamp);
  refreshFurnitureLabels();

  // ---- Listeners: lights / time -----------------------------------------
  ceiling.addEventListener('click', () => { lights.setCeiling(!lights.state.ceiling); setBtn(ceiling, lights.state.ceiling); });
  lamp.addEventListener('click', () => { lights.setLamp(!lights.state.lamp); setBtn(lamp, lights.state.lamp); });
  timeBtn.addEventListener('click', () => applyTime(idx.time + 1));

  // ---- Listeners: furniture ---------------------------------------------
  sofaColorBtn.addEventListener('click', () => {
    furniture.cycleSofaColor();
    sofaColorBtn.querySelector('.swatch').style.background = furniture.sofaColorHex();
  });
  sofaStyleBtn.addEventListener('click', () => {
    furniture.cycleSofaStyle();
    sofaStyleBtn.querySelector('.val').textContent = furniture.info().sofaStyle;
  });
  tableBtn.addEventListener('click', () => {
    furniture.cycleTable();
    tableBtn.querySelector('.val').textContent = furniture.info().table;
  });
  $('btn-rug').addEventListener('click', () => furniture.cycleRug());
  rugToggle.addEventListener('click', () => setBtn(rugToggle, furniture.toggleRug()));

  // ---- Listeners: finishes ----------------------------------------------
  wallBtn.addEventListener('click', () => applyWall(idx.wall + 1));
  floorBtn.addEventListener('click', () => applyFloor(idx.floor + 1));

  // ---- Add furniture from the catalogue ---------------------------------
  let addIdx = 0;
  const addTypeBtn = $('btn-add-type');
  const setAddLabel = () => {
    addTypeBtn.querySelector('.val').textContent = furniture.catalogLabel(furniture.catalogTypes[addIdx]);
  };
  setAddLabel();
  addTypeBtn.addEventListener('click', () => {
    addIdx = (addIdx + 1) % furniture.catalogTypes.length;
    setAddLabel();
  });
  $('btn-add').addEventListener('click', () => {
    const t = furniture.catalogTypes[addIdx];
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    const x = Math.max(-4.6, Math.min(4.6, player.camera.position.x + fx * 1.6));
    const z = Math.max(-3.6, Math.min(3.6, player.camera.position.z + fz * 1.6));
    if (furniture.addItem(t, x, z)) flash('已添加 ' + furniture.catalogLabel(t) + ' · 开「移动家具」可拖动/删除');
    else flash('模型加载中，请稍候 · Model still loading…');
  });

  // ---- Move-furniture mode ----------------------------------------------
  const moveBtn = $('btn-move');
  mover.onChange = (active, msg) => {
    moveBtn.classList.toggle('on', active);
    moveBtn.querySelector('.state').textContent = active ? 'ON' : 'OFF';
    hint.textContent = msg || '';
    hint.classList.toggle('show', !!msg);
  };
  moveBtn.addEventListener('click', () => mover.toggle());

  // ---- Save & Share via URL ---------------------------------------------
  const gather = () => Object.assign(
    { v: 1, wl: idx.wall, fl: idx.floor, tm: idx.time, cl: lights.state.ceiling ? 1 : 0, lp: lights.state.lamp ? 1 : 0 },
    furniture.getState()
  );
  const encode = (s) => btoa(encodeURIComponent(JSON.stringify(s)));
  const decode = (str) => JSON.parse(decodeURIComponent(atob(str)));
  function applyAll(s) {
    if (typeof s.tm === 'number') applyTime(s.tm);
    if (typeof s.wl === 'number') applyWall(s.wl);
    if (typeof s.fl === 'number') applyFloor(s.fl);
    if (s.cl !== undefined) { lights.setCeiling(!!s.cl); setBtn(ceiling, !!s.cl); }
    if (s.lp !== undefined) { lights.setLamp(!!s.lp); setBtn(lamp, !!s.lp); }
    furniture.applyState(s);
    refreshFurnitureLabels();
  }

  $('btn-share').addEventListener('click', () => {
    const url = location.origin + location.pathname + '#d=' + encode(gather());
    history.replaceState(null, '', url);
    const done = () => flash('🔗 已复制分享链接 · Link copied');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done).catch(done);
    else done();
  });
  $('btn-reset').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    location.reload();
  });

  // Restore a shared layout if present in the URL.
  if (location.hash.startsWith('#d=')) {
    try { applyAll(decode(location.hash.slice(3))); flash('已载入分享的布置 · Shared layout loaded'); }
    catch (e) { /* ignore malformed link */ }
  }

  // ---- Panel collapse ----------------------------------------------------
  $('btn-collapse').addEventListener('click', () => {
    $('panel').classList.toggle('collapsed');
  });

  // ---- Touch joystick ----------------------------------------------------
  if (isTouch) {
    const joy = $('joystick');
    joy.classList.add('show');
    const knob = joy.querySelector('.knob');
    let id = null, cx = 0, cy = 0;
    const R = 50;
    joy.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      id = t.identifier;
      const r = joy.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      e.preventDefault();
    }, { passive: false });
    joy.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        let dx = t.clientX - cx, dy = t.clientY - cy;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        player.moveInput.x = dx / R;
        player.moveInput.y = -dy / R;
      }
      e.preventDefault();
    }, { passive: false });
    const end = () => { id = null; knob.style.transform = ''; player.moveInput.x = 0; player.moveInput.y = 0; };
    joy.addEventListener('touchend', end);
    joy.addEventListener('touchcancel', end);
  }
}
