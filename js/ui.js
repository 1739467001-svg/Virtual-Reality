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
const WEATHER_LABELS = { clear: '☀️ 晴 Clear', rain: '🌧️ 雨 Rain', snow: '❄️ 雪 Snow' };
const SEASON_LABELS = { spring: '🌸 春 Spring', summer: '🌿 夏 Summer', autumn: '🍂 秋 Autumn', winter: '⛄ 冬 Winter' };

export function setupUI({ room, lights, furniture, player, mover, environment }) {
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
  const ceiling = $('btn-ceiling'), lamp = $('btn-lamp');
  const timeRange = $('time-range'), timeVal = $('time-val');
  const sofaColorBtn = $('btn-sofa-color'), sofaStyleBtn = $('btn-sofa-style');
  const tableBtn = $('btn-table'), rugToggle = $('btn-rug-toggle');
  const wallBtn = $('btn-wall'), floorBtn = $('btn-floor');
  const picBtn = $('btn-pic'), kitchenBtn = $('btn-kitchen');
  const weatherBtn = $('btn-weather'), seasonBtn = $('btn-season');

  // ---- Indexed finishes (apply functions double as cycle + restore) ------
  const idx = { wall: 0, floor: 0, timeMin: 720, pic: 0, kitchen: 0, weather: 0, season: 0 };
  const wrap = (v, n) => ((Math.trunc(v) % n) + n) % n;

  const fmtTime = (m) => `${Math.floor(m / 60)}:${String(Math.round(m) % 60).padStart(2, '0')}`;
  function applyTime(minutes) {
    idx.timeMin = Math.max(0, Math.min(1439, Math.round(minutes)));
    environment.setHour(idx.timeMin / 60);
    timeRange.value = idx.timeMin;
    timeVal.textContent = fmtTime(idx.timeMin);
  }
  function applyWeather(i) {
    idx.weather = wrap(i, environment.weathers.length);
    const w = environment.weathers[idx.weather];
    environment.setWeather(w);
    weatherBtn.querySelector('.val').textContent = WEATHER_LABELS[w] || w;
  }
  function applySeason(i) {
    idx.season = wrap(i, environment.seasons.length);
    const s = environment.seasons[idx.season];
    environment.setSeason(s);
    seasonBtn.querySelector('.val').textContent = SEASON_LABELS[s] || s;
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
  function applyPicture(i) {
    idx.pic = room.setPictures(i);
    picBtn.querySelector('.val').textContent = '画面 ' + (idx.pic + 1) + '/' + room.pictureSets;
  }
  function applyKitchen(i) {
    idx.kitchen = room.setKitchen(i);
    kitchenBtn.querySelector('.val').textContent = '配色 ' + (idx.kitchen + 1) + '/' + room.kitchenThemes;
  }
  function refreshFurnitureLabels() {
    sofaColorBtn.querySelector('.swatch').style.background = furniture.sofaColorHex();
    sofaStyleBtn.querySelector('.val').textContent = furniture.info().sofaStyle;
    tableBtn.querySelector('.val').textContent = furniture.info().table;
    setBtn(rugToggle, furniture.state.rugVisible);
  }

  // Initial labels (match the environment's default state).
  applyTime(720); applyWall(0); applyFloor(0); applyPicture(0); applyKitchen(0);
  applyWeather(environment.weathers.indexOf(environment.state.weather));
  applySeason(environment.seasons.indexOf(environment.state.season));
  setBtn(ceiling, lights.state.ceiling);
  setBtn(lamp, lights.state.lamp);
  refreshFurnitureLabels();

  // ---- Listeners: lights / time -----------------------------------------
  ceiling.addEventListener('click', () => { lights.setCeiling(!lights.state.ceiling); setBtn(ceiling, lights.state.ceiling); });
  lamp.addEventListener('click', () => { lights.setLamp(!lights.state.lamp); setBtn(lamp, lights.state.lamp); });
  timeRange.addEventListener('input', () => applyTime(+timeRange.value));

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
  picBtn.addEventListener('click', () => applyPicture(idx.pic + 1));
  kitchenBtn.addEventListener('click', () => applyKitchen(idx.kitchen + 1));
  weatherBtn.addEventListener('click', () => applyWeather(idx.weather + 1));
  seasonBtn.addEventListener('click', () => applySeason(idx.season + 1));

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
    {
      v: 1, wl: idx.wall, fl: idx.floor, hr: idx.timeMin, pk: idx.pic, kt: idx.kitchen,
      we: idx.weather, se: idx.season,
      cl: lights.state.ceiling ? 1 : 0, lp: lights.state.lamp ? 1 : 0,
    },
    furniture.getState()
  );
  const encode = (s) => btoa(encodeURIComponent(JSON.stringify(s)));
  const decode = (str) => JSON.parse(decodeURIComponent(atob(str)));
  function applyAll(s) {
    if (typeof s.hr === 'number') applyTime(s.hr);
    else if (typeof s.tm === 'number') applyTime([720, 1140, 1320][s.tm] ?? 720); // legacy day/evening/night
    if (typeof s.wl === 'number') applyWall(s.wl);
    if (typeof s.fl === 'number') applyFloor(s.fl);
    if (typeof s.pk === 'number') applyPicture(s.pk);
    if (typeof s.kt === 'number') applyKitchen(s.kt);
    if (typeof s.we === 'number') applyWeather(s.we);
    if (typeof s.se === 'number') applySeason(s.se);
    if (s.cl !== undefined) { lights.setCeiling(!!s.cl); setBtn(ceiling, !!s.cl); }
    if (s.lp !== undefined) { lights.setLamp(!!s.lp); setBtn(lamp, !!s.lp); }
    furniture.applyState(s);
    refreshFurnitureLabels();
  }

  const qrModal = $('qr-modal');
  function showQR(url) {
    $('qr-url').value = url;
    const img = $('qr-img'), err = $('qr-err');
    try {
      if (typeof globalThis.qrcode !== 'function') throw new Error('qr lib missing');
      const qr = globalThis.qrcode(0, 'L');   // auto version, low EC = max capacity
      qr.addData(url); qr.make();
      img.src = qr.createDataURL(6, 8); img.style.display = '';
      err.textContent = '';
    } catch (e) {
      img.style.display = 'none';
      err.textContent = '链接过长，无法生成二维码，请直接复制下面的链接。';
    }
    qrModal.classList.add('show');
  }
  $('qr-close').addEventListener('click', () => qrModal.classList.remove('show'));
  qrModal.addEventListener('click', (e) => { if (e.target === qrModal) qrModal.classList.remove('show'); });

  $('btn-share').addEventListener('click', () => {
    const url = location.origin + location.pathname + '#d=' + encode(gather());
    history.replaceState(null, '', url);
    const done = () => flash('🔗 已复制分享链接 · Link copied');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done).catch(done);
    else done();
    showQR(url);
  });

  // Re-open the welcome / controls guide.
  $('btn-help').addEventListener('click', () => {
    overlay.classList.remove('hidden');
    document.exitPointerLock?.();
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

  // ---- Panel: collapsible sections (desktop) / bottom sheet (mobile) -----
  const panel = $('panel');
  const sections = [...document.querySelectorAll('#panel section')];
  const smallScreen = matchMedia('(max-width: 600px)').matches;

  // Every section title folds / unfolds its section (accordion).
  sections.forEach((sec) => {
    const title = sec.querySelector('.sec-title');
    if (title) title.addEventListener('click', () => sec.classList.toggle('folded'));
  });

  $('btn-collapse').addEventListener('click', () => {
    if (smallScreen) panel.classList.remove('open');   // ✕ closes the sheet
    else panel.classList.toggle('collapsed');
  });

  if (smallScreen) {
    // Turn the panel into an app-style bottom sheet with a ☰ launcher + tabs.
    const handle = document.createElement('div'); handle.className = 'sheet-handle';
    panel.insertBefore(handle, panel.firstChild);
    const tabs = document.createElement('nav'); tabs.id = 'panel-tabs';
    panel.insertBefore(tabs, panel.querySelector('section'));
    const fab = document.createElement('button'); fab.id = 'panel-fab'; fab.textContent = '☰ 菜单';
    const backdrop = document.createElement('div'); backdrop.id = 'sheet-backdrop';
    document.body.append(fab, backdrop);

    const openSheet = () => { panel.classList.add('open'); backdrop.classList.add('show'); };
    const closeSheet = () => { panel.classList.remove('open'); backdrop.classList.remove('show'); };
    fab.addEventListener('click', openSheet);
    handle.addEventListener('click', closeSheet);
    backdrop.addEventListener('click', closeSheet);

    const chips = sections.map((sec) => {
      const label = (sec.querySelector('.sec-title')?.textContent || '·').trim();
      const chip = document.createElement('button');
      chip.className = 'ptab'; chip.textContent = label.split(/\s+/)[0] || '·';
      chip.title = label;
      chip.addEventListener('click', () => {
        sections.forEach((s) => s.classList.add('folded'));
        sec.classList.remove('folded');
        chips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        sec.scrollIntoView({ block: 'start' });
      });
      tabs.appendChild(chip);
      return chip;
    });
    sections.forEach((s) => s.classList.add('folded'));   // start folded
    if (chips[0]) { chips[0].classList.add('active'); sections[0].classList.remove('folded'); }
  }

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
