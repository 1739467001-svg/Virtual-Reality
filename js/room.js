// Builds the architectural shell: floor, ceiling, walls (with a real window
// opening and a door opening), baseboards, framed pictures and the exterior
// view seen through the window.
import * as THREE from 'three';
import { makeWoodTexture, makeWallTexture, makePictureTexture, makeFabricTexture, makeClockTexture } from './textures.js';

// The living room (dimensions unchanged across layouts; furniture & details
// are all authored against this box centred on the origin).
export const ROOM = { w: 10, d: 8, h: 3.2, wall: 0.15 };

// Floor-plan layouts:
//   studio — the single living room (default).
//   oneBed — living room + a bedroom (一室一厅).
//   suite  — oneBed plus an en-suite bathroom carved into the bedroom (一室一厅一卫).
const BED_D = 6;                       // bedroom depth, appended past z = +d/2
export const LAYOUTS = ['studio', 'oneBed', 'suite', 'twoBed'];
export const LAYOUT_LABELS = {
  studio: '单间 Studio', oneBed: '一室一厅 1B·1L', suite: '一室一厅一卫 +Bath', twoBed: '两室一厅 2B·1L',
};
function normLayout(v) {
  if (v === 'oneBed' || v === 'apartment') return 'oneBed';  // 'apartment' = legacy name
  if (v === 'suite') return 'suite';
  if (v === 'twoBed') return 'twoBed';
  return 'studio';
}
export function readLayout() {
  try {
    if (globalThis.__VH_LAYOUT__) return normLayout(globalThis.__VH_LAYOUT__);
    if (globalThis.localStorage) return normLayout(localStorage.getItem('vh_layout'));
  } catch { /* no localStorage (e.g. Node tests) */ }
  return 'studio';
}
export const LAYOUT = readLayout();
const zMax = (layout) => (layout === 'studio' ? ROOM.d / 2 : ROOM.d / 2 + BED_D);

// Keep the player a little away from the surfaces. maxZ extends into the
// bedroom when the apartment layout is active.
export const BOUNDS = {
  minX: -ROOM.w / 2 + 0.4,
  maxX: ROOM.w / 2 - 0.4,
  minZ: -ROOM.d / 2 + 0.4,
  maxZ: zMax(LAYOUT) - 0.4,
};

const WOOD_THEMES = {
  oak: '#a9743b',
  walnut: '#6b4423',
  ash: '#cbb187',
  grey: '#8d8d8d',
};

const PICTURE_SETS = 3;   // makePictureTexture has 3 art variants
const KITCHEN_THEMES = [
  { cab: '#3f4a52', top: '#d9d9d2' },   // slate / light stone
  { cab: '#6b4a32', top: '#e8e2d6' },   // walnut / cream
  { cab: '#2f5d50', top: '#1f2123' },   // forest green / black
  { cab: '#c7cdd2', top: '#caa46a' },   // light grey / wood
];
// Exterior foliage / ground colours per season (seen through the windows).
const SEASONS = {
  spring: { leaf: '#84b54a', ground: '#6fa34d' },
  summer: { leaf: '#3f7d34', ground: '#6a9a4a' },
  autumn: { leaf: '#c8732a', ground: '#8f7a3f' },
  winter: { leaf: '#d6dee2', ground: '#e3e9ec' },
};

export function buildRoom(scene, layout = LAYOUT) {
  const group = new THREE.Group();
  scene.add(group);
  const apartment = layout !== 'studio';
  const hasBath = layout === 'suite';
  const twoBed = layout === 'twoBed';
  const colliders = [];   // static obstacles the player collides with (interior walls, bed)

  // ---- Floor -------------------------------------------------------------
  const woodTex = makeWoodTexture({ base: WOOD_THEMES.oak });
  woodTex.repeat.set(4, 3.2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: woodTex, bumpMap: woodTex, bumpScale: 0.015, roughness: 0.65, metalness: 0.05,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // ---- Ceiling -----------------------------------------------------------
  const ceilMat = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.95 });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.h;
  ceiling.receiveShadow = true;
  group.add(ceiling);

  // ---- Walls -------------------------------------------------------------
  const wallTex = makeWallTexture('#e9e3d7');
  wallTex.repeat.set(3, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: '#ffffff', roughness: 0.95 });

  // Back wall (z = -d/2), faces +z.
  const back = makeWallPanel(ROOM.w, ROOM.h, null, wallMat);
  back.position.set(0, ROOM.h / 2, -ROOM.d / 2);
  group.add(back);

  // Front wall (z = +d/2), faces -z, with a door opening. The panel is rotated
  // 180° about Y, which mirrors local X, so the hole's local x is negated to
  // make the opening line up with the world-space door slab below.
  const door = { x: 2.2, y: -ROOM.h / 2 + 1.05, w: 1.15, h: 2.1 };
  const front = makeWallPanel(ROOM.w, ROOM.h, { ...door, x: -door.x }, wallMat);
  front.position.set(0, ROOM.h / 2, ROOM.d / 2);
  front.rotation.y = Math.PI;
  group.add(front);
  group.add(buildDoor(door));

  // Left wall (x = -w/2), faces +x.
  const left = makeWallPanel(ROOM.d, ROOM.h, null, wallMat);
  left.position.set(-ROOM.w / 2, ROOM.h / 2, 0);
  left.rotation.y = Math.PI / 2;
  group.add(left);

  // Right wall (x = +w/2), faces -x, with a window opening.
  const win = { x: 0, y: 1.0 + 0.7 - ROOM.h / 2, w: 2.6, h: 1.6 };
  const right = makeWallPanel(ROOM.d, ROOM.h, win, wallMat);
  right.position.set(ROOM.w / 2, ROOM.h / 2, 0);
  right.rotation.y = -Math.PI / 2;
  group.add(right);
  group.add(buildWindow(win));

  // ---- Baseboards --------------------------------------------------------
  group.add(buildBaseboards(door));

  // ---- Framed pictures (art is swappable) -------------------------------
  const picA = makePicture(0, new THREE.Vector3(-2.4, 1.7, -ROOM.d / 2 + 0.09), 0);
  const picB = makePicture(1, new THREE.Vector3(0.2, 1.7, -ROOM.d / 2 + 0.09), 0);
  group.add(picA, picB);
  const picMats = [picA.userData.artMat, picB.userData.artMat];
  let picIdx = 0;

  // ---- Exterior seen through the window ---------------------------------
  const exterior = buildExterior();
  group.add(exterior);

  // ---- Soft furnishings & details ---------------------------------------
  group.add(buildCurtains(win));
  group.add(buildClock());

  // ---- Open kitchen along the living-room left wall ---------------------
  const kitchen = buildKitchen(group, colliders);

  // ---- Apartment: append a bedroom past the (now interior) front wall ----
  // Living-room geometry above is untouched; the existing door opening at
  // z = +d/2 becomes the doorway between the two rooms.
  const divZ = ROOM.d / 2;              // world z of the shared/interior wall
  const back2 = divZ + BED_D;           // world z of the bedroom's far wall
  const ext = apartment
    ? { minX: -ROOM.w / 2, maxX: ROOM.w / 2, minZ: -ROOM.d / 2, maxZ: back2 }
    : { minX: -ROOM.w / 2, maxX: ROOM.w / 2, minZ: -ROOM.d / 2, maxZ: ROOM.d / 2 };
  const walls = [];                     // interior wall line segments for the minimap

  if (apartment) {
    const cz = (divZ + back2) / 2;      // bedroom centre on z

    // Floor + ceiling covering the bedroom.
    const bFloor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, BED_D), floorMat);
    bFloor.rotation.x = -Math.PI / 2; bFloor.position.z = cz; bFloor.receiveShadow = true;
    group.add(bFloor);
    const bCeil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, BED_D), ceilMat);
    bCeil.rotation.x = Math.PI / 2; bCeil.position.set(0, ROOM.h, cz); bCeil.receiveShadow = true;
    group.add(bCeil);

    // Bedroom side walls. The right wall has a window; in the two-bedroom plan
    // the left wall gets one too (for the second bedroom).
    const bWinZ = divZ + 1.5, bWinY = 1.0 + 0.7 - ROOM.h / 2;
    const bLeft = twoBed
      ? makeWallPanel(BED_D, ROOM.h, { x: 0, y: bWinY, w: 1.8, h: 1.4 }, wallMat)   // centred window
      : makeWallPanel(BED_D, ROOM.h, null, wallMat);
    bLeft.position.set(-ROOM.w / 2, ROOM.h / 2, cz); bLeft.rotation.y = Math.PI / 2;
    group.add(bLeft);
    if (twoBed) group.add(buildWindow({ x: cz, y: bWinY, w: 1.8, h: 1.4 }, -1));
    const bRight = makeWallPanel(BED_D, ROOM.h, { x: bWinZ - cz, y: bWinY, w: 1.8, h: 1.4 }, wallMat);
    bRight.position.set(ROOM.w / 2, ROOM.h / 2, cz); bRight.rotation.y = -Math.PI / 2;
    group.add(bRight);
    group.add(buildWindow({ x: bWinZ, y: bWinY, w: 1.8, h: 1.4 }));

    // Far wall. One/suite plans put an outer entrance door here; the two-bedroom
    // plan keeps it solid (both bedrooms open off the living room instead).
    if (!twoBed) {
      const ent = { x: hasBath ? 0 : -2.2, y: -ROOM.h / 2 + 1.05, w: 1.15, h: 2.1 };
      const farWall = makeWallPanel(ROOM.w, ROOM.h, { ...ent, x: -ent.x }, wallMat);
      farWall.position.set(0, ROOM.h / 2, back2); farWall.rotation.y = Math.PI;
      group.add(farWall);
      group.add(buildDoor(ent, back2, -0.16));
    } else {
      const farWall = makeWallPanel(ROOM.w, ROOM.h, null, wallMat);
      farWall.position.set(0, ROOM.h / 2, back2); farWall.rotation.y = Math.PI;
      group.add(farWall);
    }

    // The shared front wall now divides two rooms: block it except the doorway.
    const dl = door.x - door.w / 2, dr = door.x + door.w / 2;
    const seg = (minX, maxX) => colliders.push({
      minX, maxX, minZ: divZ - ROOM.wall / 2, maxZ: divZ + ROOM.wall / 2,
    });
    seg(-ROOM.w / 2, dl);
    seg(dr, ROOM.w / 2);
    walls.push({ x1: -ROOM.w / 2, z: divZ, x2: dl }, { x1: dr, z: divZ, x2: ROOM.w / 2 });

    // Bed in the far-right corner, headboard to the back wall — clear of the
    // entrance door and (for the suite) of the bathroom in the far-left corner.
    const bed = buildBed();
    bed.position.set(3.6, 0, back2 - 1.6);
    bed.rotation.y = Math.PI;             // headboard faces the far wall (+z)
    group.add(bed);
    colliders.push({ minX: 2.55, maxX: 4.65, minZ: back2 - 2.75, maxZ: back2 - 0.45 });
    group.add(buildNightstand(2.3, back2 - 0.6));
    group.add(buildSoftRug(twoBed ? 2.6 : 0.4, cz + 0.3, '#7c6f63'));

    const bLamp = new THREE.PointLight('#ffe3b8', 14, 9, 2);
    bLamp.position.set(twoBed ? 2.5 : 0, ROOM.h - 0.35, cz);
    bLamp.castShadow = true;
    group.add(bLamp);
    group.add(buildCeilingFixture(twoBed ? 2.5 : 0, cz));

    if (hasBath) buildBathroom(group, colliders, walls, wallMat, back2);

    if (twoBed) {
      // Central partition splitting the back zone into two bedrooms, connected
      // by a doorway (living → right bedroom → left bedroom).
      const cwHole = { x: 0, y: -ROOM.h / 2 + 1.05, w: 1.1, h: 2.1 };
      const cWall = makeWallPanel(BED_D, ROOM.h, cwHole, wallMat);
      cWall.position.set(0, ROOM.h / 2, cz); cWall.rotation.y = Math.PI / 2;
      group.add(cWall);
      const gap = cwHole.w / 2;
      colliders.push({ minX: -ROOM.wall / 2, maxX: ROOM.wall / 2, minZ: divZ, maxZ: cz - gap });
      colliders.push({ minX: -ROOM.wall / 2, maxX: ROOM.wall / 2, minZ: cz + gap, maxZ: back2 });
      walls.push({ x1: 0, z1: divZ, x2: 0, z2: cz - gap }, { x1: 0, z1: cz + gap, x2: 0, z2: back2 });

      // Second bedroom (left): bed + nightstand + light.
      const bed2 = buildBed();
      bed2.position.set(-3.4, 0, back2 - 1.6); bed2.rotation.y = Math.PI;
      group.add(bed2);
      colliders.push({ minX: -4.45, maxX: -2.35, minZ: back2 - 2.75, maxZ: back2 - 0.45 });
      group.add(buildNightstand(-2.1, back2 - 0.6));
      const bLamp2 = new THREE.PointLight('#ffe3b8', 13, 8, 2);
      bLamp2.position.set(-2.5, ROOM.h - 0.35, cz); bLamp2.castShadow = true;
      group.add(bLamp2);
      group.add(buildCeilingFixture(-2.5, cz));
    }
  }

  // ---- API ---------------------------------------------------------------
  function setWallColor(hex) {
    wallMat.color.set(hex);
  }
  function setFloorTheme(themeKey) {
    const newTex = makeWoodTexture({ base: WOOD_THEMES[themeKey] || WOOD_THEMES.oak });
    newTex.repeat.set(4, 3.2);
    floorMat.map.dispose();
    floorMat.map = newTex;
    floorMat.needsUpdate = true;
  }
  function setPictures(i) {
    picIdx = ((Math.trunc(i) % PICTURE_SETS) + PICTURE_SETS) % PICTURE_SETS;
    picMats.forEach((m, k) => {
      m.map?.dispose?.();
      m.map = makePictureTexture(picIdx + k);
      m.needsUpdate = true;
    });
    return picIdx;
  }
  function setKitchen(i) {
    return kitchen.setTheme(i);
  }
  function setSeason(name) {
    const s = SEASONS[name] || SEASONS.summer;
    exterior.userData.leafMat.color.set(s.leaf);
    exterior.userData.groundMat.color.set(s.ground);
    return name;
  }

  // Room rectangles (centre + size) for the dimension-annotation tool.
  const rooms = [{ name: '起居室', cx: 0, cz: 0, w: ROOM.w, d: ROOM.d }];
  if (apartment && !twoBed) rooms.push({ name: '卧室', cx: 1.4, cz: (divZ + back2) / 2 - 0.3, w: ROOM.w, d: BED_D });
  if (twoBed) {
    rooms.push({ name: '主卧', cx: 2.5, cz: (divZ + back2) / 2, w: ROOM.w / 2, d: BED_D });
    rooms.push({ name: '次卧', cx: -2.5, cz: (divZ + back2) / 2, w: ROOM.w / 2, d: BED_D });
  }
  if (hasBath) rooms.push({ name: '卫生间', cx: -3.4, cz: back2 - 1.6, w: 3.2, d: 3.2 });

  return {
    group, setWallColor, setFloorTheme, themes: Object.keys(WOOD_THEMES),
    setPictures, cyclePictures: () => setPictures(picIdx + 1), pictureSets: PICTURE_SETS,
    setKitchen, cycleKitchen: () => kitchen.setTheme(kitchen.theme + 1), kitchenThemes: KITCHEN_THEMES.length,
    setSeason, seasons: Object.keys(SEASONS),
    rooms, layout, colliders, floorplan: { ext, walls },
  };
}

// A flat wall panel in its local XY plane (normal +z), centred on origin, with
// an optional rectangular hole. Built from up to four border segments.
function makeWallPanel(width, height, hole, material) {
  const g = new THREE.Group();
  const t = ROOM.wall;
  const add = (w, h, cx, cy) => {
    if (w <= 0.001 || h <= 0.001) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), material);
    m.position.set(cx, cy, 0);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  };

  if (!hole) {
    add(width, height, 0, 0);
    return g;
  }

  const hx = hole.x, hy = hole.y, hw = hole.w, hh = hole.h;
  const leftW = hx - hw / 2 - -width / 2;
  const rightW = width / 2 - (hx + hw / 2);
  // Left and right full-height columns.
  add(leftW, height, -width / 2 + leftW / 2, 0);
  add(rightW, height, width / 2 - rightW / 2, 0);
  // Bottom and top pieces spanning the hole width.
  const bottomH = hy - hh / 2 - -height / 2;
  const topH = height / 2 - (hy + hh / 2);
  add(hw, bottomH, hx, -height / 2 + bottomH / 2);
  add(hw, topH, hx, height / 2 - topH / 2);
  return g;
}

function buildBaseboards(door) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.8 });
  const h = 0.12, t = 0.04;
  const mk = (w, x, z, ry) => {
    if (w <= 0.01) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mat);
    m.position.set(x, h / 2, z);
    m.rotation.y = ry;
    g.add(m);
  };
  mk(ROOM.w, 0, -ROOM.d / 2 + 0.08, 0);                  // back
  mk(ROOM.d, -ROOM.w / 2 + 0.08, 0, Math.PI / 2);        // left
  mk(ROOM.d, ROOM.w / 2 - 0.08, 0, Math.PI / 2);         // right

  // Front wall split around the door opening.
  const z = ROOM.d / 2 - 0.08;
  const dl = door.x - door.w / 2, dr = door.x + door.w / 2;
  mk(dl + ROOM.w / 2, (-ROOM.w / 2 + dl) / 2, z, 0);     // left of door
  mk(ROOM.w / 2 - dr, (dr + ROOM.w / 2) / 2, z, 0);      // right of door
  return g;
}

function makePicture(kind, pos, ry) {
  const g = new THREE.Group();
  const w = 1.1, h = 0.8;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.05),
    new THREE.MeshStandardMaterial({ color: '#3b2a17', roughness: 0.5 })
  );
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: makePictureTexture(kind), roughness: 0.6 })
  );
  art.position.z = 0.03;
  g.add(frame, art);
  g.position.copy(pos);
  g.rotation.y = ry;
  g.userData.artMat = art.material;   // exposed so the art can be swapped
  return g;
}

// A door slab sitting slightly ajar inside a wall opening at world z = fz.
function buildDoor(door, fz = ROOM.d / 2, hingeAngle = -0.6) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: '#cfc8ba', roughness: 0.7 });
  const slabMat = new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.6 });

  // Frame.
  const sideH = door.h + 0.06;
  const mkFrame = (w, h, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.18), frameMat);
    m.position.set(x, y, fz);
    g.add(m);
  };
  const baseY = 0; // floor
  mkFrame(0.08, sideH, door.x - door.w / 2 - 0.04, baseY + sideH / 2);
  mkFrame(0.08, sideH, door.x + door.w / 2 + 0.04, baseY + sideH / 2);
  mkFrame(door.w + 0.16, 0.08, door.x, door.h + 0.04);

  // Slab on a hinge, opened ~35° inward.
  const hinge = new THREE.Group();
  hinge.position.set(door.x - door.w / 2, 0, fz - 0.02);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(door.w, door.h, 0.05), slabMat);
  slab.position.set(door.w / 2, door.h / 2, 0);
  slab.castShadow = true;
  hinge.add(slab);
  // Handle.
  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 16, 16),
    new THREE.MeshStandardMaterial({ color: '#caa84a', metalness: 0.8, roughness: 0.3 })
  );
  handle.position.set(door.w - 0.1, door.h / 2, 0.05);
  hinge.add(handle);
  hinge.rotation.y = hingeAngle;
  g.add(hinge);
  return g;
}

// ---- Bedroom furnishings (apartment layout) ------------------------------
function buildBed() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.7 });
  const sheetMat = new THREE.MeshStandardMaterial({ color: '#eae4d8', roughness: 0.95 });
  const duvetMat = new THREE.MeshStandardMaterial({ color: '#5b7a8c', roughness: 0.9 });
  const pillowMat = new THREE.MeshStandardMaterial({ color: '#f5f1e8', roughness: 0.95 });
  const W = 1.8, L = 2.1;            // double bed footprint (x = width, z = length)

  const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.14, 0.28, L + 0.14), woodMat);
  frame.position.set(0, 0.18, 0); frame.castShadow = true; frame.receiveShadow = true;
  g.add(frame);
  const head = new THREE.Mesh(new THREE.BoxGeometry(W + 0.14, 0.8, 0.12), woodMat);
  head.position.set(0, 0.5, -L / 2 - 0.01); head.castShadow = true;
  g.add(head);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(W, 0.22, L), sheetMat);
  mattress.position.set(0, 0.43, 0); mattress.castShadow = true; mattress.receiveShadow = true;
  g.add(mattress);
  const duvet = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.1, L * 0.62), duvetMat);
  duvet.position.set(0, 0.55, L * 0.18); duvet.castShadow = true;
  g.add(duvet);
  for (const sx of [-1, 1]) {
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(W * 0.42, 0.12, 0.42), pillowMat);
    pillow.position.set(sx * W * 0.24, 0.6, -L / 2 + 0.34); pillow.castShadow = true;
    g.add(pillow);
  }
  return g;
}

function buildNightstand(x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.42), mat);
  body.position.y = 0.25; body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  const lampMat = new THREE.MeshStandardMaterial({ color: '#d9c08a', emissive: '#ffcf86', emissiveIntensity: 0.5, roughness: 0.6 });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.2, 20), lampMat);
  shade.position.y = 0.72; g.add(shade);
  g.position.set(x, 0, z);
  return g;
}

function buildSoftRug(x, z, color) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), mat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(x, 0.012, z);
  rug.receiveShadow = true;
  return rug;
}

function buildCeilingFixture(x, z) {
  const fixture = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.12, 24),
    new THREE.MeshStandardMaterial({ color: '#fff6e2', emissive: '#ffdca0', emissiveIntensity: 0.6, roughness: 0.6 })
  );
  fixture.position.set(x, ROOM.h - 0.08, z);
  return fixture;
}

// ---- En-suite bathroom (suite layout): far-left corner of the bedroom -----
function buildBathroom(group, colliders, walls, wallMat, back2) {
  const x0 = -ROOM.w / 2, x1 = -1.8;        // x span
  const z1 = back2, z0 = back2 - 3.2;       // z span (against the far wall)
  const midX = (x0 + x1) / 2, midZ = (z0 + z1) / 2;
  const t = ROOM.wall;

  // Tiled floor.
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0),
    new THREE.MeshStandardMaterial({ color: '#cfd6da', roughness: 0.35, metalness: 0.05 }));
  tile.rotation.x = -Math.PI / 2; tile.position.set(midX, 0.02, midZ); tile.receiveShadow = true;
  group.add(tile);

  // Partition A: vertical wall at x = x1 (solid).
  const wA = makeWallPanel(z1 - z0, ROOM.h, null, wallMat);
  wA.position.set(x1, ROOM.h / 2, midZ); wA.rotation.y = Math.PI / 2;
  group.add(wA);
  colliders.push({ minX: x1 - t / 2, maxX: x1 + t / 2, minZ: z0, maxZ: z1 });
  walls.push({ x1, z1: z0, x2: x1, z2: z1 });

  // Partition B: horizontal wall at z = z0 with the bathroom door (centred).
  const bdx = midX, bdw = 1.0;
  const wB = makeWallPanel(x1 - x0, ROOM.h, { x: bdx - midX, y: -ROOM.h / 2 + 1.025, w: bdw, h: 2.05 }, wallMat);
  wB.position.set(midX, ROOM.h / 2, z0);
  group.add(wB);
  group.add(buildDoor({ x: bdx, y: -ROOM.h / 2 + 1.025, w: bdw, h: 2.05 }, z0, -0.5));
  const bl = bdx - bdw / 2, br = bdx + bdw / 2;
  colliders.push({ minX: x0, maxX: bl, minZ: z0 - t / 2, maxZ: z0 + t / 2 });
  colliders.push({ minX: br, maxX: x1, minZ: z0 - t / 2, maxZ: z0 + t / 2 });
  walls.push({ x1: x0, z: z0, x2: bl }, { x1: br, z: z0, x2: x1 });

  // Fixtures: toilet + sink along the left wall, shower in the far-right corner.
  group.add(buildToilet(x0 + 0.55, z1 - 0.55));
  group.add(buildSink(x0 + 0.45, midZ + 0.1));
  colliders.push({ minX: x0, maxX: x0 + 1.0, minZ: z1 - 1.05, maxZ: z1 });
  group.add(buildShower(x1 - 0.45, z1 - 0.45));
  colliders.push({ minX: x1 - 0.9, maxX: x1, minZ: z1 - 0.9, maxZ: z1 });

  const light = new THREE.PointLight('#eaf2ff', 7, 6, 2);
  light.position.set(midX, ROOM.h - 0.3, midZ);
  group.add(light);
  group.add(buildCeilingFixture(midX, midZ));
}

function buildToilet(x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#f4f6f7', roughness: 0.3 });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 20), mat);
  bowl.position.y = 0.2; bowl.castShadow = true; g.add(bowl);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20), mat);
  lid.position.y = 0.42; g.add(lid);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.4, 0.18), mat);
  tank.position.set(0, 0.6, -0.18); g.add(tank);
  g.position.set(x, 0, z);
  return g;
}

function buildSink(x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#f4f6f7', roughness: 0.3 });
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.78, 16), mat);
  pedestal.position.y = 0.39; g.add(pedestal);
  const basin = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.34), mat);
  basin.position.y = 0.82; basin.castShadow = true; g.add(basin);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5),
    new THREE.MeshStandardMaterial({ color: '#9fb8c8', roughness: 0.1, metalness: 0.6 }));
  mirror.rotation.y = Math.PI / 2; mirror.position.set(-0.08, 1.45, 0); g.add(mirror);
  g.position.set(x, 0, z);
  return g;
}

// Corner shower: tray + two glass panels + a wall-mounted head. Centred on a
// 0.9 m square footprint whose +x / +z sides are the room walls.
function buildShower(x, z) {
  const g = new THREE.Group();
  const s = 0.9;
  const tray = new THREE.Mesh(new THREE.BoxGeometry(s, 0.06, s),
    new THREE.MeshStandardMaterial({ color: '#e7ebed', roughness: 0.3 }));
  tray.position.y = 0.03; tray.receiveShadow = true; g.add(tray);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#cfe0ea', transmission: 0.9, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0,
  });
  const panelF = new THREE.Mesh(new THREE.BoxGeometry(s, 1.95, 0.03), glassMat);
  panelF.position.set(0, 1.0, -s / 2); g.add(panelF);          // panel facing -z
  const panelL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.95, s), glassMat);
  panelL.position.set(-s / 2, 1.0, 0); g.add(panelL);          // panel facing -x
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 16),
    new THREE.MeshStandardMaterial({ color: '#c9ccce', metalness: 0.8, roughness: 0.3 }));
  head.position.set(s / 2 - 0.08, 1.95, s / 2 - 0.08); g.add(head);
  g.position.set(x, 0, z);
  return g;
}

// Open kitchen run along the living-room left wall (x = -w/2), present in every
// layout so the home reads as a proper studio/apartment.
function buildKitchen(group, colliders) {
  const x = -ROOM.w / 2, depth = 0.6;
  const z0 = -3.4, z1 = 0.3, len = z1 - z0, cz = (z0 + z1) / 2;   // ends before the bookshelf
  const cabMat = new THREE.MeshStandardMaterial({ color: KITCHEN_THEMES[0].cab, roughness: 0.5 });
  const topMat = new THREE.MeshStandardMaterial({ color: KITCHEN_THEMES[0].top, roughness: 0.3, metalness: 0.1 });
  const upMat = new THREE.MeshStandardMaterial({ color: '#eae6de', roughness: 0.6 });
  const steelMat = new THREE.MeshStandardMaterial({ color: '#aab0b4', metalness: 0.7, roughness: 0.3 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(depth, 0.85, len), cabMat);
  base.position.set(x + depth / 2, 0.425, cz); base.castShadow = true; base.receiveShadow = true; group.add(base);
  const top = new THREE.Mesh(new THREE.BoxGeometry(depth + 0.04, 0.06, len), topMat);
  top.position.set(x + depth / 2, 0.88, cz); group.add(top);
  const up = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.7, len * 0.66), upMat);
  up.position.set(x + 0.17, 1.85, cz - 0.3); up.castShadow = true; group.add(up);

  // Sink basin + faucet.
  const sink = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.5), steelMat);
  sink.position.set(x + depth / 2, 0.85, cz - 1.4); group.add(sink);
  const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 10), steelMat);
  faucet.position.set(x + 0.2, 1.02, cz - 1.4); group.add(faucet);

  // Cooktop with four burners + range hood.
  const hob = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.5),
    new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.4 }));
  hob.position.set(x + depth / 2, 0.915, cz + 0.9); group.add(hob);
  for (const dx of [-0.12, 0.12]) for (const dz of [-0.12, 0.12]) {
    const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 16),
      new THREE.MeshStandardMaterial({ color: '#2b2b2e', roughness: 0.5 }));
    burner.position.set(x + depth / 2 + dx, 0.93, cz + 0.9 + dz); group.add(burner);
  }
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.6), steelMat);
  hood.position.set(x + 0.21, 1.72, cz + 0.9); group.add(hood);

  // Fridge at the +z end.
  const fridge = new THREE.Mesh(new THREE.BoxGeometry(0.64, 1.9, 0.66),
    new THREE.MeshStandardMaterial({ color: '#dfe3e6', metalness: 0.4, roughness: 0.4 }));
  fridge.position.set(x + 0.34, 0.95, z1 - 0.33); fridge.castShadow = true; group.add(fridge);

  colliders.push({ minX: x, maxX: x + depth, minZ: z0 - 0.05, maxZ: z1 + 0.05 });

  // Theme controller: recolour cabinets (base + uppers) and countertop.
  const ctrl = {
    theme: 0,
    setTheme(i) {
      ctrl.theme = ((Math.trunc(i) % KITCHEN_THEMES.length) + KITCHEN_THEMES.length) % KITCHEN_THEMES.length;
      const t = KITCHEN_THEMES[ctrl.theme];
      cabMat.color.set(t.cab); upMat.color.set(t.cab); topMat.color.set(t.top);
      return ctrl.theme;
    },
  };
  return ctrl;
}

// Window frame + glass inside a side-wall opening. side=+1 right wall, -1 left.
function buildWindow(win, side = 1) {
  const g = new THREE.Group();
  const x = side * ROOM.w / 2;
  const inset = x - side * 0.02;          // just inside the wall
  const frameMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#bcd6e8', transmission: 0.9, transparent: true, opacity: 0.35,
    roughness: 0.05, metalness: 0, reflectivity: 0.3,
  });

  const y = ROOM.h / 2 + win.y; // world height of window centre
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), glassMat);
  glass.position.set(inset, y, win.x);
  glass.rotation.y = -side * Math.PI / 2;
  g.add(glass);

  const fmk = (w, h, oy, oz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, w), frameMat);
    m.position.set(inset, y + oy, win.x + oz);
    g.add(m);
  };
  fmk(win.w + 0.1, 0.08, win.h / 2, 0);      // top
  fmk(win.w + 0.1, 0.08, -win.h / 2, 0);     // bottom
  const vmk = (oz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, win.h, 0.06), frameMat);
    m.position.set(inset, y, win.x + oz);
    g.add(m);
  };
  vmk(win.w / 2);
  vmk(-win.w / 2);
  vmk(0); // centre mullion
  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, win.w + 0.2),
    new THREE.MeshStandardMaterial({ color: '#e8e2d6', roughness: 0.7 }));
  sill.position.set(x - side * 0.06, y - win.h / 2 - 0.03, win.x);
  g.add(sill);
  return g;
}

// Simple exterior: ground, a few "trees" and a distant building, placed beyond
// the right wall so they read through the window.
function buildExterior() {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(95, 40),
    new THREE.MeshStandardMaterial({ color: '#6a9a4a', roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(26, -0.02, 0);
  g.add(ground);

  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4423' });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f7d34' });
  g.userData.leafMat = leafMat;
  g.userData.groundMat = ground.material;
  const tree = (x, z, s) => {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.2 * s), trunkMat);
    trunk.position.y = 0.6 * s;
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.7 * s, 12, 12), leafMat);
    leaves.position.y = 1.5 * s;
    t.add(trunk, leaves);
    t.position.set(x, 0, z);
    g.add(t);
  };
  tree(9, -3, 1.1);
  tree(11, 2.5, 1.4);
  tree(13, -1, 1.0);
  tree(10, 6, 1.2);     // visible through the bedroom window
  tree(12.5, 4.5, 1.0);

  // Distant mountains (hazy — the fog gives them aerial perspective).
  const mtnMat = new THREE.MeshStandardMaterial({ color: '#8b99ad', roughness: 1, flatShading: true });
  const mountain = (x, z, r, h) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5, 1), mtnMat);
    m.position.set(x, h / 2 - 1.5, z);
    g.add(m);
  };
  mountain(64, -12, 22, 16); mountain(73, 9, 27, 21); mountain(60, 20, 18, 13); mountain(80, -2, 24, 18);

  // City skyline: varied towers with faintly lit windows (read as a lit city
  // at night, washed out by daylight). Built once with stable pseudo-random.
  const winTex = makeBuildingWindows();
  let seed = 1337;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 18; i++) {
    const bw = 2 + rnd() * 3.5, bh = 6 + rnd() * 18, bd = 2 + rnd() * 3.5;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.6, 0.06, 0.4 + rnd() * 0.12), roughness: 0.85,
      emissive: '#ffe6b0', emissiveIntensity: 0.35, emissiveMap: winTex,
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
    b.position.set(30 + rnd() * 18, bh / 2, -30 + rnd() * 60);
    g.add(b);
  }
  return g;
}

// A dark tile with a grid of small lit windows, used as an emissive map so only
// the window cells of a building glow.
function makeBuildingWindows() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 32, 64);
  ctx.fillStyle = '#ffdca0';
  for (let y = 4; y < 62; y += 8) for (let x = 4; x < 30; x += 8) {
    if (Math.random() < 0.6) ctx.fillRect(x, y, 4, 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  return tex;
}

// Cloth curtain panels + rod flanking the window on the right wall.
function buildCurtains(win) {
  const g = new THREE.Group();
  const x = ROOM.w / 2 - 0.1;
  const cy = ROOM.h / 2 + win.y;           // window centre height (world)
  const topY = cy + win.h / 2;
  const col = '#cdd6cf';
  const mat = new THREE.MeshStandardMaterial({
    color: col, map: makeFabricTexture(col), roughness: 0.95, side: THREE.DoubleSide,
  });
  const h = topY + 0.04;
  for (const sz of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, 0.36), mat);
    panel.position.set(x, h / 2 + 0.02, sz * (win.w / 2 + 0.2));
    panel.castShadow = true;
    panel.receiveShadow = true;
    g.add(panel);
  }
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, win.w + 0.9, 12),
    new THREE.MeshStandardMaterial({ color: '#6b6b6b', metalness: 0.7, roughness: 0.3 })
  );
  rod.rotation.x = Math.PI / 2;
  rod.position.set(x, topY + 0.12, win.x);
  g.add(rod);
  return g;
}

// Analog wall clock on the back wall.
function buildClock() {
  const g = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 48),
    new THREE.MeshStandardMaterial({ map: makeClockTexture(), roughness: 0.5 })
  );
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.025, 12, 48),
    new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.5 })
  );
  g.add(face, rim);
  g.position.set(3.1, 2.05, -ROOM.d / 2 + 0.07);
  return g;
}
