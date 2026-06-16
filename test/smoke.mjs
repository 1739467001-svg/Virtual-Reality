// Headless smoke test: stubs just enough DOM to let the Three.js scene-building
// modules run in Node, then constructs the room, lights and furniture and
// exercises every swap / toggle path. Catches bad Three.js API usage and math
// errors without needing a browser or GPU. Run with: node test/smoke.mjs
import assert from 'node:assert';

// ---- Minimal DOM shim (canvas + 2D context as no-ops) --------------------
const ctx2d = new Proxy({}, {
  get(_t, p) {
    if (p === 'createLinearGradient' || p === 'createRadialGradient') {
      return () => ({ addColorStop() {} });
    }
    return typeof p === 'string' ? () => {} : undefined;
  },
  set() { return true; },
});
const makeCanvas = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d });
globalThis.document = {
  createElement: (t) => (t === 'canvas' ? makeCanvas() : { style: {}, appendChild() {}, setAttribute() {} }),
};

// ---- Run ------------------------------------------------------------------
// `three` resolves from node_modules (devDependency); the scene modules import
// the same bare specifier, so everything shares one Three.js instance.
const THREE = await import('three');
const { buildRoom, ROOM, BOUNDS } = await import('../js/room.js');
const { buildLights } = await import('../js/lights.js');
const { buildFurniture } = await import('../js/furniture.js');

const scene = new THREE.Scene();

const room = buildRoom(scene);
assert.ok(ROOM.w > 0 && ROOM.h > 0, 'room dimensions set');
assert.ok(BOUNDS.maxX > BOUNDS.minX, 'bounds valid');
assert.ok(Array.isArray(room.colliders) && room.floorplan && room.floorplan.ext, 'room exposes colliders + floorplan');
assert.ok(Array.isArray(room.rooms) && room.rooms[0].w > 0, 'room exposes room rectangles for dimensions');
assert.ok(Array.isArray(room.fixtures), 'room exposes movable fixtures');
// The suite drops bedroom + bathroom items in as movable fixtures.
const suiteTypes = buildRoom(new THREE.Scene(), 'suite').fixtures.map((f) => f.type);
assert.ok(suiteTypes.length >= 5, 'suite places bed/nightstand + bathroom fixtures');
for (const ty of ['bed', 'nightstand', 'toilet', 'sink', 'shower']) {
  assert.ok(suiteTypes.includes(ty), `suite includes a ${ty}`);
}
room.setWallColor('#b9c7cf');
for (const t of room.themes) room.setFloorTheme(t);
// Swappable wall art + kitchen colour cycle through all variants.
for (let i = 0; i < room.pictureSets + 1; i++) assert.strictEqual(room.cyclePictures(), (i + 1) % room.pictureSets, 'cyclePictures wraps');
for (let i = 0; i < room.kitchenThemes + 1; i++) assert.ok(room.cycleKitchen() < room.kitchenThemes, 'cycleKitchen in range');
for (const s of room.seasons) assert.strictEqual(room.setSeason(s), s, `setSeason(${s})`);

// Multi-room layouts build without error and add a divided plan.
for (const layout of ['oneBed', 'suite']) {
  const apt = buildRoom(new THREE.Scene(), layout);
  assert.strictEqual(apt.layout, layout, `${layout} layout flagged`);
  assert.ok(apt.floorplan.ext.maxZ > room.floorplan.ext.maxZ, `${layout} extends past the studio`);
  assert.ok(apt.colliders.length >= 3, `${layout} adds interior-wall + furniture obstacles`);
  assert.ok(apt.floorplan.walls.length >= 2, `${layout} has interior wall segments`);
  for (const c of apt.colliders) assert.ok(c.maxX > c.minX && c.maxZ > c.minZ, `${layout} obstacle box valid`);
}
// The suite adds the bathroom partition (more obstacles + wall segments than oneBed).
const oneBed = buildRoom(new THREE.Scene(), 'oneBed');
const suite = buildRoom(new THREE.Scene(), 'suite');
assert.ok(suite.colliders.length > oneBed.colliders.length, 'suite adds bathroom obstacles');
assert.ok(suite.floorplan.walls.length > oneBed.floorplan.walls.length, 'suite adds bathroom walls');

const lights = buildLights(scene);
for (const t of lights.times) lights.setTimeOfDay(t);
lights.setCeiling(false); lights.setCeiling(true);
lights.setLamp(false); lights.setLamp(true);
assert.ok(scene.background && scene.fog, 'background + fog applied');

const furniture = buildFurniture(scene);
let colliders = furniture.getColliders();
assert.ok(Array.isArray(colliders) && colliders.length >= 4, 'colliders produced');
for (const c of colliders) assert.ok(c.maxX > c.minX && c.maxZ > c.minZ, 'collider box valid');
assert.ok(furniture.getMovable().length >= 3, 'has movable pieces');

// Exercise every swap a couple of full cycles.
for (let i = 0; i < 8; i++) {
  furniture.cycleSofaColor();
  furniture.cycleSofaStyle();
  furniture.cycleTable();
  furniture.cycleRug();
}
furniture.toggleRug(); furniture.toggleRug();

// Move a piece and confirm its collider tracks the holder position.
const sofa = furniture.getMovable().find((p) => p.name === 'Sofa');
sofa.holder.position.set(1.0, 0, -2.0);
colliders = furniture.getColliders();
const moved = colliders.find((c) => c.minX <= 1.0 && c.maxX >= 1.0 && c.minZ <= -2.0 && c.maxZ >= -2.0);
assert.ok(moved, 'collider follows moved furniture');

// Save / restore round-trip (the share-by-URL feature).
furniture.cycleSofaStyle(); furniture.cycleTable();
sofa.holder.rotation.y = 1.23;
const saved = furniture.getState();
sofa.holder.position.set(-2.5, 0, 2.0);
sofa.holder.rotation.y = 0;
furniture.cycleSofaStyle(); furniture.cycleTable();
furniture.applyState(saved);
assert.ok(Math.abs(sofa.holder.position.x - saved.p.s[0]) < 0.001 &&
  Math.abs(sofa.holder.position.z - saved.p.s[1]) < 0.001, 'applyState restores position');
assert.ok(Math.abs(sofa.holder.rotation.y - 1.23) < 0.01, 'applyState restores rotation');
assert.strictEqual(furniture.getState().ss, saved.ss, 'applyState restores sofa style');
assert.strictEqual(furniture.getState().tb, saved.tb, 'applyState restores table style');

// Real-model catalogue types resolve once a template is registered.
furniture.registerModel('realSofa', new THREE.Group(), { w: 2, d: 1 });
furniture.registerModel('realChair', new THREE.Group(), { w: 1, d: 1 });
furniture.registerModel('realVase', new THREE.Group(), { w: 0.4, d: 0.4 });
furniture.registerModel('realLamp', new THREE.Group(), { w: 0.6, d: 0.6 });

// Lazy models: addItem of an unregistered model fires the request hook + returns null.
let requested = null;
furniture.setModelRequest((t) => { requested = t; });
assert.strictEqual(furniture.addItem('realCouchNope', 0, 0), null, 'unknown model returns null');
assert.strictEqual(requested, 'realCouchNope', 'addItem fires model-request hook for unloaded models');

// Add / remove catalogue items.
const before = furniture.getMovable().length;
for (const t of furniture.catalogTypes) assert.ok(furniture.addItem(t, 0, 0), `addItem(${t})`);
assert.strictEqual(furniture.getMovable().length, before + furniture.catalogTypes.length, 'items added');
const added = furniture.getMovable().find((p) => p.removable);
assert.ok(furniture.removeItem(added), 'removeItem works');

// Room fixtures are buildable + movable like any catalogue piece.
for (const ty of ['nightstand', 'wardrobe', 'toilet', 'sink', 'shower']) {
  const f = furniture.addItem(ty, 0, 0);
  assert.ok(f && f.movable && f.removable, `fixture ${ty} is a movable piece`);
}

// addItem honours an explicit rotation (used to restore shared layouts).
const rotated = furniture.addItem('stool', 1, 1, 0.77);
assert.ok(Math.abs(rotated.holder.rotation.y - 0.77) < 0.001, 'addItem applies rotation');

// Recolour + scale a placed item, and check the footprint tracks the scale.
furniture.setItemColor(rotated, '#3d6b8f');
assert.strictEqual(rotated.color, '#3d6b8f', 'setItemColor records colour');
assert.ok(rotated._mats && rotated._mats.length, 'setItemColor cloned materials');
const baseW = rotated.foot.w;
const s = furniture.setItemScale(rotated, 1.5);
assert.strictEqual(s, 1.5, 'setItemScale returns clamped scale');
assert.ok(Math.abs(rotated.holder.scale.x - 1.5) < 1e-6, 'holder scaled');
assert.ok(Math.abs(rotated.foot.w - baseW * 1.5) < 1e-6, 'footprint tracks scale');
assert.strictEqual(furniture.setItemScale(rotated, 9), 2, 'scale is clamped to max 2');

// Extras survive a save / restore round-trip (incl. rotation, scale, colour).
const withExtras = furniture.getState();
assert.ok(withExtras.ex.length >= 1, 'extras serialised');
assert.ok(withExtras.ex.every((e) => typeof e.r === 'number'), 'extras carry rotation');
assert.ok(withExtras.ex.some((e) => e.c === '#3d6b8f' && e.s === 2), 'extras carry colour + scale');
furniture.applyState({ ...withExtras, ex: [] });
assert.strictEqual(furniture.getState().ex.length, 0, 'applyState clears extras');
furniture.applyState(withExtras);
const restored = furniture.getState();
assert.strictEqual(restored.ex.length, withExtras.ex.length, 'applyState restores extras');
assert.ok(restored.ex.some((e) => e.c === '#3d6b8f' && e.s === 2), 'restored extras keep colour + scale');

// Scene should now hold a healthy number of objects.
let meshes = 0;
scene.traverse((o) => { if (o.isMesh) meshes++; });
assert.ok(meshes > 40, `expected a populated scene, got ${meshes} meshes`);

console.log(`✅ smoke test passed — ${meshes} meshes, ${colliders.length} colliders`);
