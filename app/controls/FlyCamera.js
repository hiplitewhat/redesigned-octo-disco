/**
 * First-person fly camera.
 * Desktop: click-drag to look, WASD / QE, Shift sprint, wheel for speed.
 * Mobile: one-finger drag to look, pinch to change speed; move flags driven by on-screen stick.
 */
export default class FlyCamera {
  constructor(cam, domElement) {
    this.cam = cam;
    this.domElement = domElement;
    this.movementSpeed = 0;
    this.horizontalMovementSpeed = 0;
    this.verticalMovementSpeed = 0;
    this.flySpeed = 8;
    this.maxSpeed = 80;
    this.lookSensitivity = 0.002;
    this.touchLookSensitivity = 0.0035;
    this.enabled = true;
    this.isLocked = false;
    this.dragging = false;
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.moveUp = false;
    this.moveDown = false;
    this.sprint = false;
    this._moved = false;
    this._lastX = 0;
    this._lastY = 0;
    this._pinch0 = 0;
    this._ptrs = new Map();

    const euler = { x: cam.rotation.x, y: cam.rotation.y };
    this._euler = euler;

    this._look = (dx, dy, sensitivity) => {
      euler.y -= dx * sensitivity;
      euler.x -= dy * sensitivity;
      const limit = Math.PI / 2 - 0.01;
      euler.x = Math.max(-limit, Math.min(limit, euler.x));
      this.cam.rotation.set(euler.x, euler.y, 0, "YXZ");
    };

    this._onMouseMove = (event) => {
      if (!this.enabled) return;
      if (!this.isLocked) return;
      this._look(event.movementX || 0, event.movementY || 0, this.lookSensitivity);
    };

    this._onPointerLockChange = () => {
      this.isLocked = document.pointerLockElement === this.domElement;
    };

    this._onPointerDown = (event) => {
      if (!this.enabled) return;
      if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 2) return;
      this._ptrs.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this._lastX = event.clientX;
      this._lastY = event.clientY;
      this._moved = false;
      if (this._ptrs.size === 1) {
        this.dragging = true;
        try {
          this.domElement.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
        if (event.pointerType === "mouse") {
          try {
            this.domElement.requestPointerLock();
          } catch {
            /* iframe may block pointer lock */
          }
        }
      } else {
        this.dragging = false;
        const pts = [...this._ptrs.values()];
        this._pinch0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    };

    this._onPointerMove = (event) => {
      if (!this.enabled) return;
      if (this._ptrs.has(event.pointerId)) {
        this._ptrs.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      if (this._ptrs.size >= 2) {
        const pts = [...this._ptrs.values()];
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (this._pinch0) {
          const dd = d - this._pinch0;
          this.flySpeed = Math.max(1, Math.min(40, this.flySpeed + dd * 0.04));
        }
        this._pinch0 = d;
        this._moved = true;
        return;
      }
      if (!this.dragging || this.isLocked) return;
      const dx = event.clientX - this._lastX;
      const dy = event.clientY - this._lastY;
      this._lastX = event.clientX;
      this._lastY = event.clientY;
      if (dx * dx + dy * dy > 4) this._moved = true;
      const sens = event.pointerType === "touch" ? this.touchLookSensitivity : this.lookSensitivity;
      this._look(dx, dy, sens);
    };

    this._onPointerUp = (event) => {
      this._ptrs.delete(event.pointerId);
      if (this._ptrs.size === 0) {
        this.dragging = false;
        this._pinch0 = 0;
      } else if (this._ptrs.size === 1) {
        const remaining = this._ptrs.values().next().value;
        this._lastX = remaining.x;
        this._lastY = remaining.y;
        this.dragging = true;
        this._pinch0 = 0;
      }
    };

    this._onContextMenu = (event) => event.preventDefault();

    this._onWheel = (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      this.flySpeed = Math.max(1, Math.min(40, this.flySpeed + (event.deltaY < 0 ? 1 : -1)));
    };

    this._onKeyDown = (event) => {
      if (!this.enabled) return;
      if (this._isTyping(event.target)) return;
      this._setKey(event.code, true);
    };

    this._onKeyUp = (event) => {
      this._setKey(event.code, false);
    };

    this.domElement.style.touchAction = "none";
    this.domElement.addEventListener("mousemove", this._onMouseMove);
    this.domElement.addEventListener("pointerdown", this._onPointerDown);
    this.domElement.addEventListener("pointermove", this._onPointerMove);
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);
    this.domElement.addEventListener("contextmenu", this._onContextMenu);
    this.domElement.addEventListener("wheel", this._onWheel, { passive: false });
    document.addEventListener("pointerlockchange", this._onPointerLockChange);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
  }

  wasTap() {
    return !this._moved;
  }

  _isTyping(target) {
    if (!target || !target.tagName) return false;
    const tag = target.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || target.isContentEditable;
  }

  _setKey(code, down) {
    switch (code) {
      case "KeyW":
        this.moveForward = down;
        break;
      case "KeyS":
        this.moveBackward = down;
        break;
      case "KeyA":
        this.moveLeft = down;
        break;
      case "KeyD":
        this.moveRight = down;
        break;
      case "KeyE":
      case "Space":
        this.moveUp = down;
        break;
      case "KeyQ":
      case "ControlLeft":
        this.moveDown = down;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.sprint = down;
        break;
    }
  }

  syncEulerFromCamera() {
    this.cam.rotation.order = "YXZ";
    this._euler.x = this.cam.rotation.x;
    this._euler.y = this.cam.rotation.y;
  }

  update(dt) {
    if (!this.enabled) return;
    const accel = this.flySpeed * (this.sprint ? 2.5 : 1);
    const max = this.maxSpeed * (this.sprint ? 2 : 1);

    const approach = (current, target) => {
      if (current < target) return Math.min(current + accel, target);
      if (current > target) return Math.max(current - accel, target);
      return current;
    };

    const forwardTarget = this.moveForward ? max : this.moveBackward ? -max : 0;
    const strafeTarget = this.moveRight ? max : this.moveLeft ? -max : 0;
    const verticalTarget = this.moveUp ? max : this.moveDown ? -max : 0;

    this.movementSpeed = approach(this.movementSpeed, forwardTarget);
    this.horizontalMovementSpeed = approach(this.horizontalMovementSpeed, strafeTarget);
    this.verticalMovementSpeed = approach(this.verticalMovementSpeed, verticalTarget);

    this.cam.translateX(this.horizontalMovementSpeed * dt);
    this.cam.translateY(this.verticalMovementSpeed * dt);
    this.cam.translateZ(-this.movementSpeed * dt);
  }

  dispose() {
    this.domElement.removeEventListener("mousemove", this._onMouseMove);
    this.domElement.removeEventListener("pointerdown", this._onPointerDown);
    this.domElement.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
    this.domElement.removeEventListener("contextmenu", this._onContextMenu);
    this.domElement.removeEventListener("wheel", this._onWheel);
    document.removeEventListener("pointerlockchange", this._onPointerLockChange);
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    if (document.pointerLockElement === this.domElement) document.exitPointerLock();
  }
}
