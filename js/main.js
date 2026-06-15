import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { buildRoom, ROOM } from './room.js';
import { buildLights } from './lights.js';
import { buildFurniture } from './furniture.js';
import { Player } from './player.js';
import { setupUI } from './ui.js';
import { createMinimap } from './minimap.js';

// ---- Renderer ------------------------------------------------------------
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;

// ---- Scene / camera ------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 200);
scene.add(camera);

// Image-based lighting: gives every surface realistic soft fill + reflections
// (visible on the glass, metal lamp/legs and screen) without extra light cost.
const pmrem = new THREE.PMREMGenerator(renderer);
const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTexture;

// ---- World ---------------------------------------------------------------
const room = buildRoom(scene);
const lights = buildLights(scene, envTexture);
const furniture = buildFurniture(scene);

const player = new Player(camera, renderer.domElement, {
  getColliders: () => furniture.getColliders(),
});

// ---- Furniture mover (pick up & reposition) ------------------------------
const FBOUNDS = {
  minX: -ROOM.w / 2 + 0.15, maxX: ROOM.w / 2 - 0.15,
  minZ: -ROOM.d / 2 + 0.15, maxZ: ROOM.d / 2 - 0.15,
};
const mover = createMover();

// ---- UI ------------------------------------------------------------------
setupUI({ room, lights, furniture, player, mover });

// ---- Minimap HUD ---------------------------------------------------------
const minimap = createMinimap(document.getElementById('minimap'), {
  w: ROOM.w, d: ROOM.d,
  getColliders: () => furniture.getColliders(),
  getPose: () => ({ x: camera.position.x, z: camera.position.z, yaw: player.yaw }),
});

// ---- WebXR button --------------------------------------------------------
document.body.appendChild(VRButton.createButton(renderer));

// ---- Post-processing (bloom + anti-alias), bypassed in XR ----------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 0.5, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass(innerWidth, innerHeight));
let hq = true;
const hqBtn = document.getElementById('btn-hq');
const setHqLabel = () => { hqBtn.classList.toggle('on', hq); hqBtn.querySelector('.state').textContent = hq ? 'ON' : 'OFF'; };
setHqLabel();
hqBtn.addEventListener('click', () => { hq = !hq; setHqLabel(); });

// ---- Real glTF furniture models (loaded async, added via the catalogue) ---
loadModels();
function loadModels() {
  const loader = new GLTFLoader();
  const specs = [
    { type: 'realSofa', url: 'assets/models/sofa.glb', width: 2.2 },
    { type: 'realChair', url: 'assets/models/armchair.glb', width: 0.95 },
  ];
  for (const spec of specs) {
    loader.load(spec.url, (gltf) => {
      const root = gltf.scene;
      // Strip any baked-in lights and enable shadows.
      const lightsToRemove = [];
      root.traverse((o) => {
        if (o.isLight) lightsToRemove.push(o);
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      lightsToRemove.forEach((l) => l.parent && l.parent.remove(l));
      // Normalise: centre on X/Z, sit on the floor, scale to a target width.
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      root.position.set(-centre.x, -box.min.y, -centre.z);
      const s = spec.width / (size.x || 1);
      const wrap = new THREE.Group();
      wrap.add(root);
      wrap.scale.setScalar(s);
      furniture.registerModel(spec.type, wrap, { w: size.x * s, d: size.z * s });
    }, undefined, (err) => console.warn('model load failed', spec.url, err));
  }
}

// ---- Resize --------------------------------------------------------------
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---- Loop ----------------------------------------------------------------
const clock = new THREE.Clock();
let wasPresenting = false;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const presenting = renderer.xr.isPresenting;

  if (presenting !== wasPresenting) {
    player.xrPresenting = presenting;
    // In XR the headset supplies eye height, so drop the rig to the floor.
    camera.position.y = presenting ? 0 : 1.65;
    wasPresenting = presenting;
  }

  if (presenting) xrLocomotion(dt);
  else player.update(dt);

  mover.update();
  minimap.update();
  if (presenting || !hq) renderer.render(scene, camera);
  else composer.render();
});

// --------------------------------------------------------------------------
// Furniture mover: raycast from screen centre, click to pick up / drop, the
// selected piece follows where you look along the floor.
// --------------------------------------------------------------------------
function createMover() {
  const ray = new THREE.Raycaster();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const centre = new THREE.Vector2(0, 0);
  const hitPoint = new THREE.Vector3();
  let active = false;
  let selected = null;

  const api = {
    active,
    onChange: null,
    toggle() {
      active = !active;
      api.active = active;
      if (!active) drop();
      else announce('移动模式：走近家具，点击拾起 · Move mode: click furniture to pick up');
    },
    update() {
      if (!active || !selected) return;
      ray.setFromCamera(centre, camera);
      if (ray.ray.intersectPlane(floor, hitPoint)) {
        const hw = selected.foot.w / 2, hd = selected.foot.d / 2;
        selected.holder.position.x = clamp(hitPoint.x, FBOUNDS.minX + hw, FBOUNDS.maxX - hw);
        selected.holder.position.z = clamp(hitPoint.z, FBOUNDS.minZ + hd, FBOUNDS.maxZ - hd);
      }
    },
  };

  function pick() {
    const pieces = furniture.getMovable();
    ray.setFromCamera(centre, camera);
    const hits = ray.intersectObjects(pieces.map((p) => p.holder), true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o) {
      const p = pieces.find((pp) => pp.holder === o);
      if (p) return p;
      o = o.parent;
    }
    return null;
  }
  function announce(msg) { api.onChange?.(active, msg); }
  function drop() {
    if (selected) { selected.holder.position.y = 0; selected = null; }
    announce(active ? '移动模式：点击拾起 · 选中后按 Delete 删除 · Click to pick up, Delete to remove' : '');
  }

  // Delete the selected piece (catalogue items only).
  addEventListener('keydown', (e) => {
    if (!active || !selected) return;
    if (e.code === 'Delete' || e.code === 'Backspace' || e.code === 'KeyX') {
      if (furniture.removeItem(selected)) { selected = null; announce('已删除 · Removed'); }
      else announce('该家具不可删除 · This piece can\'t be removed');
    }
  });

  renderer.domElement.addEventListener('pointerdown', () => {
    if (!active) return;
    if (selected) drop();
    else {
      const p = pick();
      if (p) {
        selected = p;
        p.holder.position.y = 0.04;
        announce(`移动中 Moving: ${p.name} — 再次点击放下 · click to drop`);
      }
    }
  });

  return api;
}

// --------------------------------------------------------------------------
// Minimal VR thumbstick locomotion (left or right stick), heading taken from
// where the headset is looking.
// --------------------------------------------------------------------------
const _dir = new THREE.Vector3();
function xrLocomotion(dt) {
  const session = renderer.xr.getSession();
  if (!session) return;
  let sx = 0, sy = 0;
  for (const src of session.inputSources) {
    if (!src.gamepad) continue;
    const a = src.gamepad.axes;
    const ax = a[2] ?? a[0] ?? 0, ay = a[3] ?? a[1] ?? 0;
    if (Math.hypot(ax, ay) > 0.15) { sx = ax; sy = ay; }
  }
  if (sx === 0 && sy === 0) return;

  const xrCam = renderer.xr.getCamera();
  xrCam.getWorldDirection(_dir);
  _dir.y = 0;
  _dir.normalize();
  const rightX = _dir.z, rightZ = -_dir.x;
  const speed = 2.2 * dt;
  const dx = (-_dir.x * sy + rightX * sx) * speed;
  const dz = (-_dir.z * sy + rightZ * sx) * speed;
  const p = camera.position;
  if (!player.collides(p.x + dx, p.z)) p.x += dx;
  if (!player.collides(p.x, p.z + dz)) p.z += dz;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
