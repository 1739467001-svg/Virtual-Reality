// First-person walker: pointer-lock mouse-look + WASD on desktop, drag-look +
// virtual joystick on touch. Movement is collision-checked against the room
// bounds and furniture footprints, resolved per-axis so you slide along walls
// instead of sticking.
import * as THREE from 'three';
import { BOUNDS } from './room.js';

const EYE = 1.65;
const CROUCH_EYE = 0.85;   // crouched eye height (peek under tables / at bedding)
const RADIUS = 0.3;
const WALK = 3.0;
const RUN = 5.4;

export class Player {
  constructor(camera, dom, { getColliders }) {
    this.camera = camera;
    this.dom = dom;
    this.getColliders = getColliders;

    this.yaw = Math.PI;          // start facing -Z (into the room)
    this.pitch = 0;
    this.keys = new Set();
    this.moveInput = { x: 0, y: 0 }; // touch joystick: x=strafe, y=forward
    this.locked = false;
    this.xrPresenting = false;
    this.crouch = false;
    this.eyeHeight = EYE;        // animated toward EYE / CROUCH_EYE

    camera.position.set(2.2, EYE, 3.0); // just inside the door
    camera.rotation.order = 'YXZ';
    this._applyLook();

    this._bind();
  }

  toggleCrouch() { this.crouch = !this.crouch; return this.crouch; }

  _bind() {
    // Keyboard.
    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));

    // Pointer lock (desktop).
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      document.body.classList.toggle('locked', this.locked);
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this._look(e.movementX, e.movementY);
    });

    // Touch look (drag on the right half of the screen).
    this._touchId = null;
    this.dom.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX > innerWidth / 2 && this._touchId === null) {
          this._touchId = t.identifier;
          this._lastTouch = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: true });
    this.dom.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._touchId) {
          this._look(t.clientX - this._lastTouch.x, t.clientY - this._lastTouch.y, 0.004);
          this._lastTouch = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: true });
    const endTouch = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this._touchId) this._touchId = null;
    };
    this.dom.addEventListener('touchend', endTouch);
    this.dom.addEventListener('touchcancel', endTouch);
  }

  lockPointer() {
    if (!this.xrPresenting) this.dom.requestPointerLock?.();
  }

  _look(dx, dy, sens = 0.0022) {
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    const lim = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
    this._applyLook();
  }

  _applyLook() {
    if (this.xrPresenting) return;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  collides(x, z) { return this._collides(x, z); }

  _collides(x, z) {
    if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return true;
    for (const c of this.getColliders()) {
      if (x > c.minX - RADIUS && x < c.maxX + RADIUS &&
          z > c.minZ - RADIUS && z < c.maxZ + RADIUS) return true;
    }
    return false;
  }

  update(dt) {
    // Heading from yaw only (ignore pitch) so we always walk along the floor.
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // Forward when yaw=PI is +Z? camera looks along -Z rotated by yaw.
    const fwdX = -sin, fwdZ = -cos;       // unit forward on XZ
    const rightX = cos, rightZ = -sin;    // unit right on XZ

    let f = 0, s = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) f += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) f -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) s += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) s -= 1;
    f += this.moveInput.y;
    s += this.moveInput.x;

    // Crouch / stand: animate eye height every frame (even when standing still).
    const targetEye = this.crouch ? CROUCH_EYE : EYE;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, dt * 10);

    if (f !== 0 || s !== 0) {
      let dx = fwdX * f + rightX * s;
      let dz = fwdZ * f + rightZ * s;
      const len = Math.hypot(dx, dz);
      if (len > 1) { dx /= len; dz /= len; }

      const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? RUN : WALK;
      dx *= speed * dt;
      dz *= speed * dt;

      const p = this.camera.position;
      if (!this._collides(p.x + dx, p.z)) p.x += dx;
      if (!this._collides(p.x, p.z + dz)) p.z += dz;
    }
    this.camera.position.y = this.eyeHeight;
  }
}
