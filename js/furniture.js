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

  // ---- Public API --------------------------------------------------------
  return {
    group,
    getColliders,
    movablePieces: pieces.filter((p) => p.movable),
    state,
    cycleSofaColor() { state.sofaColor = (state.sofaColor + 1) % SOFA_COLORS.length; rebuildSofa(); return SOFA_COLORS[state.sofaColor]; },
    cycleSofaStyle() { state.sofaStyle = (state.sofaStyle + 1) % SOFA_STYLES.length; rebuildSofa(); return SOFA_STYLES[state.sofaStyle]; },
    cycleTable() { state.table = (state.table + 1) % TABLE_STYLES.length; rebuildTable(); return TABLE_STYLES[state.table]; },
    cycleRug() { state.rug = (state.rug + 1) % RUG_COLORS.length; rebuildRug(); return state.rug; },
    toggleRug() { state.rugVisible = !state.rugVisible; rebuildRug(); return state.rugVisible; },
    info() {
      return {
        sofaStyle: SOFA_STYLES[state.sofaStyle],
        table: TABLE_STYLES[state.table],
      };
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
