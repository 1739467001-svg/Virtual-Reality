// Builds the architectural shell: floor, ceiling, walls (with a real window
// opening and a door opening), baseboards, framed pictures and the exterior
// view seen through the window.
import * as THREE from 'three';
import { makeWoodTexture, makeWallTexture, makePictureTexture, makeFabricTexture, makeClockTexture } from './textures.js';

export const ROOM = { w: 10, d: 8, h: 3.2, wall: 0.15 };

// Keep the player a little away from the surfaces.
export const BOUNDS = {
  minX: -ROOM.w / 2 + 0.4,
  maxX: ROOM.w / 2 - 0.4,
  minZ: -ROOM.d / 2 + 0.4,
  maxZ: ROOM.d / 2 - 0.4,
};

const WOOD_THEMES = {
  oak: '#a9743b',
  walnut: '#6b4423',
  ash: '#cbb187',
  grey: '#8d8d8d',
};

export function buildRoom(scene) {
  const group = new THREE.Group();
  scene.add(group);

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

  // ---- Framed pictures ---------------------------------------------------
  group.add(makePicture(0, new THREE.Vector3(-2.4, 1.7, -ROOM.d / 2 + 0.09), 0));
  group.add(makePicture(1, new THREE.Vector3(0.2, 1.7, -ROOM.d / 2 + 0.09), 0));

  // ---- Exterior seen through the window ---------------------------------
  group.add(buildExterior());

  // ---- Soft furnishings & details ---------------------------------------
  group.add(buildCurtains(win));
  group.add(buildClock());

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

  return { group, setWallColor, setFloorTheme, themes: Object.keys(WOOD_THEMES) };
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
  return g;
}

// A door slab sitting slightly ajar inside the front-wall opening.
function buildDoor(door) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: '#cfc8ba', roughness: 0.7 });
  const slabMat = new THREE.MeshStandardMaterial({ color: '#8a5a2b', roughness: 0.6 });

  // Frame.
  const fz = ROOM.d / 2;
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
  hinge.rotation.y = -0.6;
  g.add(hinge);
  return g;
}

// Window frame + glass inside the right-wall opening.
function buildWindow(win) {
  const g = new THREE.Group();
  const x = ROOM.w / 2;
  const frameMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#bcd6e8', transmission: 0.9, transparent: true, opacity: 0.35,
    roughness: 0.05, metalness: 0, reflectivity: 0.3,
  });

  const y = ROOM.h / 2 + win.y; // world height of window centre
  // Glass.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), glassMat);
  glass.position.set(x - 0.02, y, win.x);
  glass.rotation.y = -Math.PI / 2;
  g.add(glass);

  // Frame + cross mullions.
  const fmk = (w, h, oy, oz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, w), frameMat);
    m.position.set(x - 0.02, y + oy, win.x + oz);
    g.add(m);
  };
  fmk(win.w + 0.1, 0.08, win.h / 2, 0);      // top
  fmk(win.w + 0.1, 0.08, -win.h / 2, 0);     // bottom
  // Verticals (use depth as width along z).
  const vmk = (oz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, win.h, 0.06), frameMat);
    m.position.set(x - 0.02, y, win.x + oz);
    g.add(m);
  };
  vmk(win.w / 2);
  vmk(-win.w / 2);
  vmk(0); // centre mullion
  // Sill.
  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, win.w + 0.2),
    new THREE.MeshStandardMaterial({ color: '#e8e2d6', roughness: 0.7 }));
  sill.position.set(x - 0.06, y - win.h / 2 - 0.03, win.x);
  g.add(sill);
  return g;
}

// Simple exterior: ground, a few "trees" and a distant building, placed beyond
// the right wall so they read through the window.
function buildExterior() {
  const g = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(40, 32),
    new THREE.MeshStandardMaterial({ color: '#6a9a4a', roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(14, -0.02, 0);
  g.add(ground);

  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4423' });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f7d34' });
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

  const bldg = new THREE.Mesh(
    new THREE.BoxGeometry(6, 9, 6),
    new THREE.MeshStandardMaterial({ color: '#b7c0c8', roughness: 0.9 })
  );
  bldg.position.set(20, 4.5, -6);
  g.add(bldg);
  return g;
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
