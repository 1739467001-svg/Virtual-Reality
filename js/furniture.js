// Procedural furniture plus the controls to swap styles / colours and to query
// collision footprints. Each movable piece lives in a "holder" group whose
// position is the piece's spot on the floor, so moving = setting holder.position
// and re-styling = clearing the holder and rebuilding its contents.
import * as THREE from 'three';
import { makeRugTexture, makeFabricTexture, makePictureTexture } from './textures.js';

// Cache woven-cloth textures so swapping the sofa doesn't regenerate canvases.
const _fabricTex = new Map();
function fabricTex(color) {
  if (!_fabricTex.has(color)) _fabricTex.set(color, makeFabricTexture(color));
  return _fabricTex.get(color);
}

const SOFA_COLORS = ['#3d5a80', '#9c6b4f', '#6b7a5e', '#7d4f5a', '#41434a', '#c98b5a'];
const SOFA_STYLES = ['modern', 'classic'];
const TABLE_STYLES = ['wood', 'glass', 'round'];
const RUG_COLORS = [['#c0392b', '#922b21'], ['#2c6e8f', '#1f4e63'], ['#caa94a', '#9c8030'], ['#555', '#333']];

// Catalogue of items the user can add to / remove from the room. The "real*"
// entries are real glTF models registered asynchronously at runtime.
const CATALOG = ['realSofa', 'realChair', 'realVase', 'realLamp', 'armchair', 'stool', 'sideTable', 'pouf', 'plant', 'vase', 'books', 'frame', 'globe', 'candle', 'bed', 'diningSet', 'floorLamp', 'sideboard'];
const CATALOG_LABELS = {
  realSofa: '真皮沙发 Sofa·3D', realChair: '锦缎单椅 Chair·3D', realVase: '花瓶花艺 Vase·3D',
  realLamp: '真实灯具 Lantern·3D', armchair: '扶手椅 Armchair', stool: '凳子 Stool', sideTable: '边几 Side table',
  pouf: '坐墩 Pouf', plant: '绿植 Plant', vase: '花瓶摆件 Vase', books: '书籍 Books', frame: '相框 Frame',
  globe: '地球仪 Globe', candle: '蜡烛 Candles', bed: '床 Bed', diningSet: '餐桌椅 Dining set',
  floorLamp: '落地灯 Lamp', sideboard: '边柜 Sideboard',
};
// type -> { object: Object3D template, foot } for loaded glTF models.
const MODELS = new Map();
const EXTRA_COLORS = ['#7a9e9f', '#9c6b4f', '#41434a', '#c98b5a', '#6b7a5e', '#7d4f5a'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function enableShadows(obj) {
  obj.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return obj;
}
function clearGroup(g) {
  for (let i = g.children.length - 1; i >= 0; i--) {
    const c = g.children[i];
    g.remove(c);
    c.traverse?.((o) => {
      o.geometry?.dispose?.();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.());
    });
  }
}

// Recolour a placed catalogue item by tinting every material (cloned once so we
// never bleed onto shared/cached materials or other instances of a glTF model).
function setItemColor(piece, hex) {
  if (!piece._mats) {
    piece._mats = [];
    piece.holder.traverse((o) => {
      if (o.isMesh && o.material) {
        const arr = Array.isArray(o.material) ? o.material : [o.material];
        const cloned = arr.map((m) => m.clone());
        o.material = Array.isArray(o.material) ? cloned : cloned[0];
        piece._mats.push(...cloned);
      }
    });
  }
  for (const m of piece._mats) if (m.color) m.color.set(hex);
  piece.color = hex;
}

// Uniformly scale a placed item (clamped) and keep its collision footprint in sync.
function setItemScale(piece, scale) {
  const s = Math.max(0.5, Math.min(2, scale));
  piece.holder.scale.setScalar(s);
  piece.scale = s;
  if (piece.baseFoot) piece.foot = { w: piece.baseFoot.w * s, d: piece.baseFoot.d * s };
  return s;
}

export function buildFurniture(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const state = { sofaColor: 0, sofaStyle: 0, table: 0, rug: 0, rugVisible: true };

  // ---- Holders (movable anchors) ----------------------------------------
  const sofaHolder = new THREE.Group();
  sofaHolder.position.set(0, 0, -3.05);
  const chairHolder = new THREE.Group();
  chairHolder.position.set(3.1, 0, -1.6);
  chairHolder.rotation.y = -0.7;
  const tableHolder = new THREE.Group();
  tableHolder.position.set(0, 0, -1.1);
  const plantHolder = new THREE.Group();
  plantHolder.position.set(4.3, 0, -3.2);
  const rugHolder = new THREE.Group();
  rugHolder.position.set(0, 0, -1.1);
  group.add(sofaHolder, chairHolder, tableHolder, plantHolder, rugHolder);

  // ---- Static pieces -----------------------------------------------------
  const tv = buildTV();
  tv.position.set(-0.4, 0, 3.2);
  tv.rotation.y = Math.PI;
  group.add(tv);

  const shelf = buildBookshelf();
  shelf.position.set(-4.6, 0, 1.4);
  shelf.rotation.y = Math.PI / 2;
  group.add(shelf);

  // ---- Build initial movable/styled pieces ------------------------------
  rebuildSofa();
  rebuildTable();
  rebuildRug();
  plantHolder.add(buildPlant());

  // ---- Rebuild helpers ---------------------------------------------------
  function rebuildSofa() {
    clearGroup(sofaHolder);
    sofaHolder.add(buildSofa(SOFA_STYLES[state.sofaStyle], SOFA_COLORS[state.sofaColor]));
  }
  function rebuildTable() {
    clearGroup(tableHolder);
    tableHolder.add(buildCoffeeTable(TABLE_STYLES[state.table]));
  }
  function rebuildRug() {
    clearGroup(rugHolder);
    const r = buildRug(state.rug);
    r.visible = state.rugVisible;
    rugHolder.add(r);
  }

  // ---- Collision footprints (half-extents on the floor, world axes) ------
  // Movable pieces report from their holder position; rotation of 0/90° is
  // handled by giving the footprint already aligned to world axes.
  const pieces = [
    { name: 'Sofa', holder: sofaHolder, foot: { w: 2.5, d: 0.95 }, movable: true, rot: 0 },
    { name: 'Armchair', holder: chairHolder, foot: { w: 1.0, d: 1.0 }, movable: true, rot: 'free' },
    { name: 'Coffee table', holder: tableHolder, foot: { w: 1.25, d: 0.75 }, movable: true, rot: 0 },
    { name: 'Plant', holder: plantHolder, foot: { w: 0.85, d: 0.85 }, movable: true, rot: 0 },
    { name: 'TV unit', group: tv, foot: { w: 1.85, d: 0.5 }, movable: false },
    { name: 'Bookshelf', group: shelf, foot: { w: 0.4, d: 1.7 }, movable: false },
  ];
  chairHolder.add(enableShadows(buildArmchair(SOFA_COLORS[(state.sofaColor + 2) % SOFA_COLORS.length])));

  function getColliders(extraPadding = 0) {
    return pieces.map((p) => {
      const obj = p.holder || p.group;
      const x = obj.position.x, z = obj.position.z;
      const hw = p.foot.w / 2 + extraPadding;
      const hd = p.foot.d / 2 + extraPadding;
      return { minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd };
    });
  }

  // ---- Add / remove catalogue items -------------------------------------
  let nextId = 1;
  let onModelRequest = null;   // set by main: kick off lazy glTF loads on demand
  function addItem(type, x = 0, z = 0, rot) {
    const made = buildExtra(type);
    if (!made) { onModelRequest?.(type); return null; }
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    holder.rotation.y = typeof rot === 'number' ? rot : Math.random() * Math.PI * 2;
    holder.add(enableShadows(made.object));
    group.add(holder);
    const piece = {
      name: `${type}-${nextId++}`, type, holder, foot: made.foot,
      baseFoot: { ...made.foot }, scale: 1, color: null, movable: true, removable: true,
    };
    pieces.push(piece);
    return piece;
  }
  function removeItem(piece) {
    const i = pieces.indexOf(piece);
    if (i < 0 || !piece.removable) return false;
    pieces.splice(i, 1);
    group.remove(piece.holder);
    clearGroup(piece.holder);
    return true;
  }

  // ---- Public API --------------------------------------------------------
  return {
    group,
    getColliders,
    getMovable: () => pieces.filter((p) => p.movable),
    addItem,
    removeItem,
    setItemColor,
    setItemScale,
    registerModel: (type, object, foot) => MODELS.set(type, { object, foot }),
    hasModel: (type) => MODELS.has(type),
    setModelRequest: (fn) => { onModelRequest = fn; },
    catalogTypes: CATALOG,
    catalogLabel: (t) => CATALOG_LABELS[t] || t,
    state,
    cycleSofaColor() { state.sofaColor = (state.sofaColor + 1) % SOFA_COLORS.length; rebuildSofa(); return SOFA_COLORS[state.sofaColor]; },
    cycleSofaStyle() { state.sofaStyle = (state.sofaStyle + 1) % SOFA_STYLES.length; rebuildSofa(); return SOFA_STYLES[state.sofaStyle]; },
    cycleTable() { state.table = (state.table + 1) % TABLE_STYLES.length; rebuildTable(); return TABLE_STYLES[state.table]; },
    cycleRug() { state.rug = (state.rug + 1) % RUG_COLORS.length; rebuildRug(); return state.rug; },
    toggleRug() { state.rugVisible = !state.rugVisible; rebuildRug(); return state.rugVisible; },
    sofaColorHex() { return SOFA_COLORS[state.sofaColor]; },
    info() {
      return {
        sofaStyle: SOFA_STYLES[state.sofaStyle],
        table: TABLE_STYLES[state.table],
      };
    },
    // ---- Serialisable layout (for save / share via URL) ----
    getState() {
      const r2 = (v) => Math.round(v * 100) / 100;
      const KEY = { Sofa: 's', Armchair: 'a', 'Coffee table': 't', Plant: 'pl' };
      const p = {};
      for (const pc of pieces) {
        const k = KEY[pc.name];
        if (!k || !pc.holder) continue;
        p[k] = [r2(pc.holder.position.x), r2(pc.holder.position.z), r2(pc.holder.rotation.y)];
      }
      return {
        sc: state.sofaColor, ss: state.sofaStyle, tb: state.table, rg: state.rug,
        rv: state.rugVisible ? 1 : 0, p,
        ex: pieces.filter((pc) => pc.type).map((pc) => ({
          t: pc.type,
          p: [r2(pc.holder.position.x), r2(pc.holder.position.z)],
          r: r2(pc.holder.rotation.y),
          s: pc.scale && pc.scale !== 1 ? r2(pc.scale) : undefined,
          c: pc.color || undefined,
          y: pc.holder.position.y > 0.01 ? r2(pc.holder.position.y) : undefined,
        })),
      };
    },
    applyState(s) {
      if (!s) return;
      const mod = (v, n) => ((Math.trunc(v) % n) + n) % n;
      if (typeof s.sc === 'number') state.sofaColor = mod(s.sc, SOFA_COLORS.length);
      if (typeof s.ss === 'number') state.sofaStyle = mod(s.ss, SOFA_STYLES.length);
      if (typeof s.tb === 'number') state.table = mod(s.tb, TABLE_STYLES.length);
      if (typeof s.rg === 'number') state.rug = mod(s.rg, RUG_COLORS.length);
      if (s.rv !== undefined) state.rugVisible = !!s.rv;
      rebuildSofa(); rebuildTable(); rebuildRug();
      const KEY = { Sofa: 's', Armchair: 'a', 'Coffee table': 't', Plant: 'pl' };
      if (s.p) for (const pc of pieces) {
        const k = KEY[pc.name];
        if (!k || !pc.holder || !Array.isArray(s.p[k])) continue;
        pc.holder.position.x = s.p[k][0];
        pc.holder.position.z = s.p[k][1];
        if (typeof s.p[k][2] === 'number') pc.holder.rotation.y = s.p[k][2];
      }
      // Recreate dynamically-added items.
      for (const pc of pieces.filter((p) => p.removable)) removeItem(pc);
      if (Array.isArray(s.ex)) for (const it of s.ex) {
        if (it && it.t && Array.isArray(it.p)) {
          const pc = addItem(it.t, it.p[0], it.p[1], it.r);
          if (pc) {
            if (typeof it.s === 'number') setItemScale(pc, it.s);
            if (it.c) setItemColor(pc, it.c);
            if (typeof it.y === 'number') pc.holder.position.y = it.y;
          }
        }
      }
    },
  };
}

// --------------------------------------------------------------------------
// Individual pieces
// --------------------------------------------------------------------------
function fabric(color) {
  return new THREE.MeshStandardMaterial({ color, map: fabricTex(color), roughness: 0.92, metalness: 0 });
}
function wood(color = '#7a5230') {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
}
function metal(color = '#9aa0a6') {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.85 });
}

function buildSofa(style, color) {
  const g = new THREE.Group();
  const mat = fabric(color);
  const classic = style === 'classic';

  const seatH = 0.42;
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, seatH, 0.9), mat);
  base.position.set(0, seatH / 2 + 0.08, 0);
  g.add(base);

  // Legs.
  const legMat = wood('#4a2a17');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12), legMat);
    leg.position.set(sx * 1.05, 0.06, sz * 0.38);
    g.add(leg);
  }

  // Back.
  const backH = classic ? 0.85 : 0.62;
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.3, backH, 0.2), mat);
  back.position.set(0, 0.08 + seatH + backH / 2 - 0.05, -0.35);
  g.add(back);

  // Arms.
  if (classic) {
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 16), mat);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(sx * 1.15, 0.55, 0);
      g.add(arm);
    }
  } else {
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.9), mat);
      arm.position.set(sx * 1.16, 0.5, 0);
      g.add(arm);
    }
  }

  // Seat + back cushions.
  const cushMat = fabric(color);
  cushMat.color.offsetHSL(0, 0, 0.05);
  for (const sx of [-1, 1]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.18, 0.82), cushMat);
    seat.position.set(sx * 0.56, 0.08 + seatH + 0.05, 0.02);
    g.add(seat);
    const bc = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.5, 0.16), cushMat);
    bc.position.set(sx * 0.56, 0.08 + seatH + 0.25, -0.3);
    g.add(bc);
  }

  // Throw pillows + a folded blanket for a lived-in look.
  const seatTop = 0.08 + seatH + 0.14;
  const pillowCols = ['#d8a657', '#7a9e9f'];
  pillowCols.forEach((pc, i) => {
    const sx = i ? 1 : -1;
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.14),
      new THREE.MeshStandardMaterial({ color: pc, map: fabricTex(pc), roughness: 0.95 })
    );
    pillow.position.set(sx * 0.78, seatTop + 0.18, -0.18);
    pillow.rotation.set(0.16, sx * -0.35, sx * 0.22);
    g.add(pillow);
  });
  const blanket = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.07, 0.86),
    new THREE.MeshStandardMaterial({ color: '#e7e2d6', map: fabricTex('#e7e2d6'), roughness: 0.95 })
  );
  blanket.position.set(0.36, seatTop + 0.04, 0.08);
  blanket.rotation.z = 0.04;
  g.add(blanket);

  return enableShadows(g);
}

// A book stack + mug to sit on the coffee table top.
function tableDecor(topY) {
  const d = new THREE.Group();
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.04, 0.35),
    new THREE.MeshStandardMaterial({ color: '#34495e', roughness: 0.7 }));
  b1.position.set(-0.24, topY + 0.02, 0.04);
  b1.rotation.y = 0.18;
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.31),
    new THREE.MeshStandardMaterial({ color: '#b5651d', roughness: 0.7 }));
  b2.position.set(-0.24, topY + 0.057, 0.04);
  b2.rotation.y = -0.06;
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.09, 20),
    new THREE.MeshStandardMaterial({ color: '#ecf0f1', roughness: 0.35 }));
  mug.position.set(0.26, topY + 0.045, -0.02);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 16),
    new THREE.MeshStandardMaterial({ color: '#ecf0f1', roughness: 0.35 }));
  handle.position.set(0.315, topY + 0.045, -0.02);
  handle.rotation.y = Math.PI / 2;
  d.add(b1, b2, mug, handle);
  return d;
}

function buildArmchair(color) {
  const g = new THREE.Group();
  const mat = fabric(color);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.4, 0.8), mat);
  base.position.y = 0.35;
  g.add(base);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.6, 0.18), mat);
  back.position.set(0, 0.6, -0.31);
  g.add(back);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.8), mat);
    arm.position.set(sx * 0.5, 0.5, 0);
    g.add(arm);
  }
  const cush = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.7), mat);
  cush.position.set(0, 0.58, 0.02);
  g.add(cush);
  return g;
}

function buildCoffeeTable(style) {
  const g = new THREE.Group();
  if (style === 'round') {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 32), wood('#6b4423'));
    top.position.y = 0.42;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 0.4, 16), wood('#4a3019'));
    ped.position.y = 0.2;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24), wood('#4a3019'));
    foot.position.y = 0.02;
    g.add(top, ped, foot);
  } else if (style === 'glass') {
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.04, 0.6),
      new THREE.MeshPhysicalMaterial({ color: '#bfe3ef', transmission: 0.9, transparent: true, opacity: 0.4, roughness: 0.05 })
    );
    top.position.y = 0.42;
    g.add(top);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42), metal());
      leg.position.set(sx * 0.5, 0.21, sz * 0.25);
      g.add(leg);
    }
  } else {
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.62), wood('#7a5230'));
    top.position.y = 0.4;
    g.add(top);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.38, 0.07), wood('#5a3a1f'));
      leg.position.set(sx * 0.5, 0.19, sz * 0.25);
      g.add(leg);
    }
  }
  g.add(tableDecor(style === 'round' ? 0.45 : 0.44));
  return enableShadows(g);
}

function buildTV() {
  const g = new THREE.Group();
  // Stand.
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.45), wood('#3a2a1c'));
  stand.position.y = 0.225;
  g.add(stand);
  for (let i = 0; i < 2; i++) {
    const draw = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.32, 0.02), wood('#5a4330'));
    draw.position.set(-0.45 + i * 0.9, 0.23, 0.23);
    g.add(draw);
  }
  // Screen.
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.86, 0.06), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.4 }));
  frame.position.set(0, 1.1, 0);
  const screenTex = makePictureTexture(1);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.42, 0.78),
    new THREE.MeshStandardMaterial({ map: screenTex, emissive: '#ffffff', emissiveMap: screenTex, emissiveIntensity: 0.45, roughness: 0.2 })
  );
  screen.position.set(0, 1.1, 0.035);
  g.add(frame, screen);
  return enableShadows(g);
}

function buildBookshelf() {
  const g = new THREE.Group();
  const frameMat = wood('#5a4330');
  const W = 1.6, H = 1.9, D = 0.32;
  const side = (sx) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, D), frameMat);
    m.position.set(sx * (W / 2), H / 2, 0);
    g.add(m);
  };
  side(-1); side(1);
  const shelfColors = ['#c0392b', '#27ae60', '#2980b9', '#f39c12', '#8e44ad', '#16a085', '#d35400'];
  for (let i = 0; i <= 4; i++) {
    const y = (H / 4) * i;
    const sh = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, D), frameMat);
    sh.position.set(0, y + 0.02, 0);
    g.add(sh);
    if (i < 4) {
      // Books on this shelf.
      let bx = -W / 2 + 0.1;
      while (bx < W / 2 - 0.1) {
        const bw = 0.05 + Math.random() * 0.05;
        const bh = 0.28 + Math.random() * 0.1;
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(bw, bh, 0.22),
          new THREE.MeshStandardMaterial({ color: shelfColors[Math.floor(Math.random() * shelfColors.length)], roughness: 0.8 })
        );
        book.position.set(bx + bw / 2, y + 0.04 + bh / 2, 0);
        g.add(book);
        bx += bw + 0.012;
      }
    }
  }
  // Back panel.
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.03), wood('#3a2a1c'));
  back.position.set(0, H / 2, -D / 2);
  g.add(back);
  return enableShadows(g);
}

function buildPlant() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.4, 20), new THREE.MeshStandardMaterial({ color: '#b5651d', roughness: 0.8 }));
  pot.position.y = 0.2;
  g.add(pot);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 20), new THREE.MeshStandardMaterial({ color: '#3b2a1a' }));
  soil.position.y = 0.4;
  g.add(soil);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#2f7d32', roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 10; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.7 + Math.random() * 0.4, 6), leafMat);
    const a = (i / 10) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.08, 0.8, Math.sin(a) * 0.08);
    leaf.rotation.set((Math.random() - 0.5) * 0.6, a, (Math.random() - 0.5) * 0.6);
    g.add(leaf);
  }
  return enableShadows(g);
}

function buildRug(colorIndex) {
  const [a, b] = RUG_COLORS[colorIndex % RUG_COLORS.length];
  const tex = makeRugTexture(a, b);
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 2.1),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.012;
  rug.receiveShadow = true;
  return rug;
}

// Factory for catalogue items the user can drop into the room.
// Returns { object, foot } or null for an unknown type.
function buildExtra(type) {
  // Real glTF models registered at runtime take priority.
  if (MODELS.has(type)) {
    const m = MODELS.get(type);
    return { object: m.object.clone(true), foot: m.foot };
  }
  switch (type) {
    case 'armchair':
      return { object: buildArmchair(pick(EXTRA_COLORS)), foot: { w: 1.0, d: 1.0 } };
    case 'plant':
      return { object: buildPlant(), foot: { w: 0.85, d: 0.85 } };
    case 'stool': {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 20), fabric(pick(EXTRA_COLORS)));
      seat.position.y = 0.46;
      g.add(seat);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.46), wood('#5a3a1f'));
        leg.position.set(Math.cos(a) * 0.15, 0.23, Math.sin(a) * 0.15);
        leg.rotation.set(Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12);
        g.add(leg);
      }
      return { object: g, foot: { w: 0.45, d: 0.45 } };
    }
    case 'pouf': {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.4, 24), fabric(pick(EXTRA_COLORS)));
      p.position.y = 0.2;
      return { object: p, foot: { w: 0.66, d: 0.66 } };
    }
    case 'sideTable': {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 28), wood('#6b4423'));
      top.position.y = 0.52;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 12), metal('#3a3a3a'));
      ped.position.y = 0.26;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 20), metal('#3a3a3a'));
      foot.position.y = 0.015;
      g.add(top, ped, foot);
      return { object: g, foot: { w: 0.6, d: 0.6 } };
    }
    case 'floorLamp': {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.05, 20), metal('#2b2b2b'));
      base.position.y = 0.025;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 12), metal('#2b2b2b'));
      pole.position.y = 0.72;
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.24, 0.3, 24, 1, true),
        new THREE.MeshStandardMaterial({ color: '#f3e7cf', emissive: '#ffd98a', emissiveIntensity: 0.6, roughness: 0.6, side: THREE.DoubleSide })
      );
      shade.position.y = 1.5;
      g.add(base, pole, shade);
      return { object: g, foot: { w: 0.5, d: 0.5 } };
    }
    case 'sideboard': {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.55, 0.45), wood('#6b4a2e'));
      body.position.y = 0.4;
      g.add(body);
      for (let i = 0; i < 2; i++) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.02), wood('#7d5836'));
        door.position.set(-0.3 + i * 0.6, 0.4, 0.235);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), metal('#caa84a'));
        knob.position.set(-0.3 + i * 0.6 + (i ? -0.2 : 0.2), 0.4, 0.26);
        g.add(door, knob);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16), wood('#3a2a1c'));
        leg.position.set(sx * 0.52, 0.08, sz * 0.18);
        g.add(leg);
      }
      return { object: g, foot: { w: 1.25, d: 0.5 } };
    }
    case 'bed': {
      const g = new THREE.Group();
      const frameMat = wood('#6b4a32');
      const W = 1.6, L = 2.05;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.28, L + 0.12), frameMat);
      frame.position.y = 0.18; g.add(frame);
      const head = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.7, 0.1), frameMat);
      head.position.set(0, 0.45, -L / 2 - 0.01); g.add(head);
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, L), new THREE.MeshStandardMaterial({ color: '#eae4d8', roughness: 0.95 }));
      mattress.position.y = 0.42; g.add(mattress);
      const duvet = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.1, L * 0.6), fabric(pick(EXTRA_COLORS)));
      duvet.position.set(0, 0.54, L * 0.18); g.add(duvet);
      for (const sx of [-1, 1]) {
        const pillow = new THREE.Mesh(new THREE.BoxGeometry(W * 0.4, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: '#f5f1e8', roughness: 0.95 }));
        pillow.position.set(sx * W * 0.22, 0.58, -L / 2 + 0.32); g.add(pillow);
      }
      return { object: g, foot: { w: W + 0.12, d: L + 0.12 } };
    }
    case 'diningSet': {
      const g = new THREE.Group();
      const topMat = wood('#7a5230');
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.85), topMat);
      top.position.y = 0.74; g.add(top);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.72), topMat);
        leg.position.set(sx * 0.62, 0.37, sz * 0.36); g.add(leg);
      }
      const chairMat = fabric(pick(EXTRA_COLORS));
      const chair = (px, pz, ry) => {
        const c = new THREE.Group();
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), chairMat);
        seat.position.y = 0.45; c.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.05), chairMat);
        back.position.set(0, 0.68, -0.18); c.add(back);
        for (const lx of [-1, 1]) for (const lz of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45), wood('#4a2a17'));
          leg.position.set(lx * 0.16, 0.225, lz * 0.16); c.add(leg);
        }
        c.position.set(px, 0, pz); c.rotation.y = ry; return c;
      };
      g.add(chair(0, 0.62, 0), chair(0, -0.62, Math.PI), chair(0.85, 0, -Math.PI / 2), chair(-0.85, 0, Math.PI / 2));
      return { object: g, foot: { w: 1.9, d: 1.9 } };
    }
    // ---- Decorative accents (placeable + pick-up-able) --------------------
    case 'vase': {
      const g = new THREE.Group();
      const cer = new THREE.MeshStandardMaterial({ color: pick(['#d9c7b8', '#7fa1a8', '#c98b6b', '#3f4a52']), roughness: 0.35 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.28, 18), cer);
      body.position.y = 0.14; body.castShadow = true; g.add(body);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.1, 18), cer);
      neck.position.y = 0.32; g.add(neck);
      const stemMat = new THREE.MeshStandardMaterial({ color: '#4f8a3a', roughness: 0.9 });
      const blooms = ['#e26d8a', '#e7b84b', '#9c6bd6'];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.32), stemMat);
        stem.position.set(Math.cos(a) * 0.04, 0.52, Math.sin(a) * 0.04);
        stem.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); g.add(stem);
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), new THREE.MeshStandardMaterial({ color: blooms[i], roughness: 0.7 }));
        bloom.position.set(Math.cos(a) * 0.1, 0.66, Math.sin(a) * 0.1); g.add(bloom);
      }
      return { object: g, foot: { w: 0.26, d: 0.26 } };
    }
    case 'pottedPlant': {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.28, 16), new THREE.MeshStandardMaterial({ color: '#b5651d', roughness: 0.8 }));
      pot.position.y = 0.14; pot.castShadow = true; g.add(pot);
      const fol = new THREE.MeshStandardMaterial({ color: '#3f7d34', roughness: 0.9 });
      for (let i = 0; i < 3; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), fol);
        leaf.position.set((i - 1) * 0.1, 0.42 + i * 0.13, (1 - i) * 0.07);
        leaf.scale.y = 1.4; leaf.castShadow = true; g.add(leaf);
      }
      return { object: g, foot: { w: 0.32, d: 0.32 } };
    }
    case 'books': {                          // a small leaning stack of books
      const g = new THREE.Group();
      const cols = ['#8c3b3b', '#3b5a8c', '#3b7d4f', '#caa94a', '#6d4c7d'];
      let y = 0;
      for (let i = 0; i < 4; i++) {
        const w = 0.22 + Math.random() * 0.06, h = 0.04 + Math.random() * 0.02, d = 0.16 + Math.random() * 0.04;
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.7 }));
        b.position.set((Math.random() - 0.5) * 0.02, y + h / 2, (Math.random() - 0.5) * 0.02);
        b.rotation.y = (Math.random() - 0.5) * 0.25; b.castShadow = true; g.add(b); y += h;
      }
      return { object: g, foot: { w: 0.3, d: 0.24 } };
    }
    case 'frame': {                          // a standing photo frame
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.02), wood('#3b2a17'));
      frame.position.y = 0.16; frame.castShadow = true; g.add(frame);
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.24),
        new THREE.MeshStandardMaterial({ map: makePictureTexture(Math.floor(Math.random() * 6)), roughness: 0.6 }));
      photo.position.set(0, 0.16, 0.012); g.add(photo);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.13, 0.02), wood('#3b2a17'));
      stand.position.set(0, 0.06, -0.04); stand.rotation.x = 0.3; g.add(stand);
      return { object: g, foot: { w: 0.26, d: 0.14 } };
    }
    case 'globe': {                          // desk globe on a stand
      const g = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 16),
        new THREE.MeshStandardMaterial({ color: '#3a6ea5', roughness: 0.5, metalness: 0.1 }));
      ball.position.y = 0.32; ball.castShadow = true; g.add(ball);
      const land = new THREE.MeshStandardMaterial({ color: '#5a8f4a', roughness: 0.7 });
      for (const [ax, ay, az] of [[0.06, 0.36, 0.08], [-0.07, 0.3, 0.05], [0.02, 0.4, -0.07]]) {
        const patch = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), land);
        patch.position.set(ax, ay, az); patch.scale.set(1.2, 0.7, 1); g.add(patch);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.008, 8, 24), metal('#c9a24a'));
      ring.position.y = 0.32; ring.rotation.x = 0.4; g.add(ring);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, 0.2, 12), wood('#5a3a22'));
      stand.position.y = 0.1; g.add(stand);
      return { object: g, foot: { w: 0.28, d: 0.28 } };
    }
    case 'candle': {                         // a trio of candles
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const h = 0.12 + i * 0.05;
        const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 12),
          new THREE.MeshStandardMaterial({ color: '#efe7d6', roughness: 0.6, emissive: '#ffcf86', emissiveIntensity: 0.12 }));
        wax.position.set((i - 1) * 0.08, h / 2, 0); g.add(wax);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 8),
          new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 1.2 }));
        flame.position.set((i - 1) * 0.08, h + 0.02, 0); g.add(flame);
      }
      return { object: g, foot: { w: 0.3, d: 0.12 } };
    }
    // ---- Room fixtures (placed per layout, but movable like everything else) --
    case 'nightstand': {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.42), wood('#6b4a32'));
      body.position.y = 0.25; g.add(body);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.2, 20),
        new THREE.MeshStandardMaterial({ color: '#d9c08a', emissive: '#ffcf86', emissiveIntensity: 0.5, roughness: 0.6 }));
      shade.position.y = 0.72; g.add(shade);
      return { object: g, foot: { w: 0.5, d: 0.42 } };
    }
    case 'wardrobe': {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 0.56), wood('#6b4a2e'));
      body.position.y = 1.0; g.add(body);
      for (const sx of [-1, 1]) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.9, 0.02), wood('#7d5836'));
        door.position.set(sx * 0.3, 1.0, 0.29); g.add(door);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), metal('#caa84a'));
        knob.position.set(sx * 0.08, 1.0, 0.31); g.add(knob);
      }
      return { object: g, foot: { w: 1.2, d: 0.56 } };
    }
    case 'toilet': {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: '#f4f6f7', roughness: 0.3 });
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 20), mat);
      bowl.position.y = 0.2; g.add(bowl);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20), mat);
      lid.position.y = 0.42; g.add(lid);
      const tank = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.4, 0.18), mat);
      tank.position.set(0, 0.6, -0.18); g.add(tank);
      return { object: g, foot: { w: 0.46, d: 0.6 } };
    }
    case 'sink': {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: '#f4f6f7', roughness: 0.3 });
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.78, 16), mat);
      ped.position.y = 0.39; g.add(ped);
      const basin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.34), mat);
      basin.position.y = 0.82; g.add(basin);
      const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5),
        new THREE.MeshStandardMaterial({ color: '#9fb8c8', roughness: 0.1, metalness: 0.6 }));
      mirror.rotation.y = Math.PI / 2; mirror.position.set(-0.08, 1.45, 0); g.add(mirror);
      return { object: g, foot: { w: 0.42, d: 0.34 } };
    }
    case 'shower': {
      const g = new THREE.Group();
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.9),
        new THREE.MeshStandardMaterial({ color: '#e7ebed', roughness: 0.3 }));
      tray.position.y = 0.03; g.add(tray);
      const glassMat = new THREE.MeshPhysicalMaterial({ color: '#cfe0ea', transmission: 0.9, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0 });
      const pf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.95, 0.03), glassMat);
      pf.position.set(0, 1.0, -0.45); g.add(pf);
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.95, 0.9), glassMat);
      pl.position.set(-0.45, 1.0, 0); g.add(pl);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16), metal('#c9ccce'));
      head.position.set(0.37, 1.95, 0.37); g.add(head);
      return { object: g, foot: { w: 0.9, d: 0.9 } };
    }
    default:
      return null;
  }
}
