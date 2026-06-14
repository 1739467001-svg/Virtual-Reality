// All lighting: a daylight "sun" through the window (with day / evening / night
// presets), a ceiling fixture and a floor lamp. The visible fixtures and their
// emissive glow live here too, so light state and look stay in sync.
import * as THREE from 'three';
import { ROOM } from './room.js';

export const LAMP_POS = new THREE.Vector3(-4.2, 0, -3.0);

const TIMES = {
  day: {
    bg: '#aacbe6', fog: '#cfe0ee',
    sun: { color: '#fff4e0', intensity: 2.4, pos: [18, 14, 6] },
    ambient: 0.55, hemi: 0.6,
  },
  evening: {
    bg: '#f2a65a', fog: '#e8b27a',
    sun: { color: '#ff9248', intensity: 1.1, pos: [22, 5, 4] },
    ambient: 0.32, hemi: 0.35,
  },
  night: {
    bg: '#0c1426', fog: '#10182b',
    sun: { color: '#9db4e6', intensity: 0.12, pos: [16, 12, -6] },
    ambient: 0.1, hemi: 0.14,
  },
};

export function buildLights(scene) {
  const state = { ceiling: true, lamp: true, time: 'day' };

  // ---- Global fill -------------------------------------------------------
  const ambient = new THREE.AmbientLight('#ffffff', 0.55);
  const hemi = new THREE.HemisphereLight('#dfe9f2', '#5b4a36', 0.6);
  scene.add(ambient, hemi);

  // ---- Sun (daylight through window) ------------------------------------
  const sun = new THREE.DirectionalLight('#fff4e0', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.bias = -0.0004;
  sun.target.position.set(0, 1, 0);
  scene.add(sun, sun.target);

  // ---- Ceiling fixture ---------------------------------------------------
  const ceiling = buildCeilingFixture();
  scene.add(ceiling.group);

  // ---- Floor lamp --------------------------------------------------------
  const lamp = buildFloorLamp();
  lamp.group.position.copy(LAMP_POS);
  scene.add(lamp.group);

  // ---- API ---------------------------------------------------------------
  function setTimeOfDay(name) {
    const t = TIMES[name] || TIMES.day;
    state.time = name;
    scene.background = new THREE.Color(t.bg);
    scene.fog = new THREE.Fog(t.fog, 18, 60);
    sun.color.set(t.sun.color);
    sun.intensity = t.sun.intensity;
    sun.position.set(...t.sun.pos);
    ambient.intensity = t.ambient;
    hemi.intensity = t.hemi;
  }
  function setCeiling(on) {
    state.ceiling = on;
    ceiling.setOn(on);
  }
  function setLamp(on) {
    state.lamp = on;
    lamp.setOn(on);
  }

  setTimeOfDay('day');
  setCeiling(true);
  setLamp(true);

  return {
    state, setTimeOfDay, setCeiling, setLamp,
    times: Object.keys(TIMES),
    sun, ambient,
  };
}

function buildCeilingFixture() {
  const group = new THREE.Group();
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.5),
    new THREE.MeshStandardMaterial({ color: '#333' })
  );
  cord.position.y = ROOM.h - 0.25;
  group.add(cord);

  const shadeMat = new THREE.MeshStandardMaterial({
    color: '#fff7e6', emissive: '#ffdf9e', emissiveIntensity: 1.2, roughness: 0.4,
  });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.18, 24, 1, true), shadeMat);
  shade.position.y = ROOM.h - 0.55;
  group.add(shade);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 24),
    new THREE.MeshStandardMaterial({ color: '#fff7e6', emissive: '#ffdf9e', emissiveIntensity: 1.2, side: THREE.DoubleSide })
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.y = ROOM.h - 0.64;
  group.add(disc);

  const light = new THREE.PointLight('#ffe9c2', 32, 0, 2);
  light.position.set(0, ROOM.h - 0.6, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.001;
  group.add(light);

  function setOn(on) {
    light.visible = on;
    shadeMat.emissiveIntensity = on ? 1.2 : 0;
    disc.material.emissiveIntensity = on ? 1.2 : 0;
  }
  return { group, setOn, light };
}

function buildFloorLamp() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#2b2b2b', metalness: 0.7, roughness: 0.4 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.06, 24), metal);
  base.position.y = 0.03;
  base.castShadow = true;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 16), metal);
  pole.position.y = 0.78;
  pole.castShadow = true;
  group.add(base, pole);

  const shadeMat = new THREE.MeshStandardMaterial({
    color: '#f3e7cf', emissive: '#ffd98a', emissiveIntensity: 1.0,
    roughness: 0.6, side: THREE.DoubleSide,
  });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.32, 24, 1, true), shadeMat);
  shade.position.y = 1.62;
  group.add(shade);

  const light = new THREE.PointLight('#ffd98a', 16, 0, 2);
  light.position.set(0, 1.6, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.001;
  group.add(light);

  function setOn(on) {
    light.visible = on;
    shadeMat.emissiveIntensity = on ? 1.0 : 0;
  }
  return { group, setOn, light };
}
