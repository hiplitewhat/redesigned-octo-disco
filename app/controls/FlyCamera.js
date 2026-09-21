/**
 * First-person fly camera.
 * Click the viewport to capture the mouse (pointer lock when available).
 * Click-drag also works, which is more reliable inside iframes.
 * WASD move, Q/E down/up, Shift sprint, mouse wheel changes speed.
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

    const euler = { x: cam.rotation.x, y: cam.rotation.y };
    this._euler = euler;

    this._onMouseMove = (event) => {
      if (!this.enabled) return;
      if (!this.isLocked && !this.dragging) return;
      const dx = event.movementX || 0;
      const dy = event.movementY || 0;
      euler.y -= dx * this.lookSensitivity;
      euler.x -= dy * this.lookSensitivity;
      const limit = Math.PI / 2 - 0.01;
      euler.x = Math.max(-limit, Math.min(limit, euler.x));
      this.cam.rotation.set(euler.x, euler.y, 0, "YXZ");
    };

    this._onPointerLockChange = () => {
      this.isLocked = document.pointerLockElement === this.domElement;
    };

    this._onMouseDown = (event) => {
      if (!this.enabled) return;
      if (event.button === 0 || event.button === 2) {
        this.dragging = true;
        try {
          this.domElement.requestPointerLock();
        } catch {
          /* iframe may block pointer lock */
        }
      }
    };

    this._onMouseUp = () => {
      this.dragging = false;
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

    this.domElement.addEventListener("mousemove", this._onMouseMove);
    this.domElement.addEventListener("mousedown", this._onMouseDown);
    window.addEventListener("mouseup", this._onMouseUp);
    this.domElement.addEventListener("contextmenu", this._onContextMenu);
    this.domElement.addEventListener("wheel", this._onWheel, { passive: false });
    document.addEventListener("pointerlockchange", this._onPointerLockChange);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
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
    this.domElement.removeEventListener("mousedown", this._onMouseDown);
    window.removeEventListener("mouseup", this._onMouseUp);
    this.domElement.removeEventListener("contextmenu", this._onContextMenu);
    this.domElement.removeEventListener("wheel", this._onWheel);
    document.removeEventListener("pointerlockchange", this._onPointerLockChange);
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    if (document.pointerLockElement === this.domElement) document.exitPointerLock();
  }
}
