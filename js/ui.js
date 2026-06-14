// Wires the on-screen control panel, the touch joystick and the enter/overlay
// flow to the scene modules. Pure DOM glue — no Three.js here.

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

  // ---- Enter overlay / pointer lock -------------------------------------
  const overlay = $('overlay');
  const enter = () => {
    overlay.classList.add('hidden');
    if (!isTouch) player.lockPointer();
  };
  $('btn-enter').addEventListener('click', enter);
  if (!isTouch) {
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) overlay.classList.add('hidden');
      else overlay.classList.remove('hidden');
    });
  }

  // ---- Light toggles -----------------------------------------------------
  const setBtn = (el, on, label) => {
    el.classList.toggle('on', on);
    el.querySelector('.state').textContent = on ? 'ON' : 'OFF';
    if (label) el.querySelector('.lbl').textContent = label;
  };
  const ceiling = $('btn-ceiling'), lamp = $('btn-lamp');
  setBtn(ceiling, lights.state.ceiling);
  setBtn(lamp, lights.state.lamp);
  ceiling.addEventListener('click', () => { lights.setCeiling(!lights.state.ceiling); setBtn(ceiling, lights.state.ceiling); });
  lamp.addEventListener('click', () => { lights.setLamp(!lights.state.lamp); setBtn(lamp, lights.state.lamp); });

  // ---- Time of day -------------------------------------------------------
  let timeIdx = 0;
  const timeBtn = $('btn-time');
  timeBtn.querySelector('.val').textContent = TIME_LABELS[lights.times[0]];
  timeBtn.addEventListener('click', () => {
    timeIdx = (timeIdx + 1) % lights.times.length;
    const t = lights.times[timeIdx];
    lights.setTimeOfDay(t);
    timeBtn.querySelector('.val').textContent = TIME_LABELS[t];
  });

  // ---- Furniture swaps ---------------------------------------------------
  $('btn-sofa-color').addEventListener('click', (e) => {
    const hex = furniture.cycleSofaColor();
    e.currentTarget.querySelector('.swatch').style.background = hex;
  });
  const sofaStyleBtn = $('btn-sofa-style');
  sofaStyleBtn.querySelector('.val').textContent = furniture.info().sofaStyle;
  sofaStyleBtn.addEventListener('click', () => {
    furniture.cycleSofaStyle();
    sofaStyleBtn.querySelector('.val').textContent = furniture.info().sofaStyle;
  });
  const tableBtn = $('btn-table');
  tableBtn.querySelector('.val').textContent = furniture.info().table;
  tableBtn.addEventListener('click', () => {
    furniture.cycleTable();
    tableBtn.querySelector('.val').textContent = furniture.info().table;
  });
  $('btn-rug').addEventListener('click', () => furniture.cycleRug());
  $('btn-rug-toggle').addEventListener('click', (e) => {
    const vis = furniture.toggleRug();
    setBtn(e.currentTarget, vis);
  });
  setBtn($('btn-rug-toggle'), furniture.state.rugVisible);

  // ---- Wall colour / floor ----------------------------------------------
  let wallIdx = 0;
  const wallBtn = $('btn-wall');
  wallBtn.querySelector('.val').textContent = WALL_COLORS[0].name;
  wallBtn.addEventListener('click', () => {
    wallIdx = (wallIdx + 1) % WALL_COLORS.length;
    room.setWallColor(WALL_COLORS[wallIdx].hex);
    wallBtn.querySelector('.val').textContent = WALL_COLORS[wallIdx].name;
  });
  let floorIdx = 0;
  const floorBtn = $('btn-floor');
  floorBtn.querySelector('.val').textContent = FLOOR_LABELS[room.themes[0]];
  floorBtn.addEventListener('click', () => {
    floorIdx = (floorIdx + 1) % room.themes.length;
    const t = room.themes[floorIdx];
    room.setFloorTheme(t);
    floorBtn.querySelector('.val').textContent = FLOOR_LABELS[t];
  });

  // ---- Move-furniture mode ----------------------------------------------
  const moveBtn = $('btn-move');
  const hint = $('hint');
  mover.onChange = (active, msg) => {
    moveBtn.classList.toggle('on', active);
    moveBtn.querySelector('.state').textContent = active ? 'ON' : 'OFF';
    hint.textContent = msg || '';
    hint.classList.toggle('show', !!msg);
  };
  moveBtn.addEventListener('click', () => mover.toggle());

  // ---- Panel collapse ----------------------------------------------------
  $('btn-collapse').addEventListener('click', () => {
    document.getElementById('panel').classList.toggle('collapsed');
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
