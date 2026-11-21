// Keyboard + mouse input: held keys, edge-triggered presses, and camera
// look deltas (pointer lock when available, drag fallback otherwise).
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      this.pressed.add(event.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousedown', (event) => {
      this.mouseDown = true;
      this.mouseClicked = true;
      this.dragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      if (document.pointerLockElement !== canvas) {
        try {
          canvas.requestPointerLock();
        } catch (err) {
          // Pointer lock is a nicety; drag look still works without it.
        }
      }
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
      this.dragging = false;
    });
    document.addEventListener('pointerlockchange', () => {
      this.dragging = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (event) => {
      if (document.pointerLockElement === canvas) {
        this.mouseDX += event.movementX || 0;
        this.mouseDY += event.movementY || 0;
      } else if (this.dragging) {
        this.mouseDX += event.clientX - this.lastX;
        this.mouseDY += event.clientY - this.lastY;
        this.lastX = event.clientX;
        this.lastY = event.clientY;
      }
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  /** True only on the frame the key went down. */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** WASD / arrows: -1..1 on each axis (x = strafe, y = forward). */
  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return { x, y };
  }

  /** Consume this frame's look deltas (pixels). */
  takeLook() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  /** Consume this frame's click. */
  takeClick() {
    const clicked = this.mouseClicked;
    this.mouseClicked = false;
    return clicked;
  }

  /** Call at the end of each frame: clears edge-triggered state. */
  endFrame() {
    this.pressed.clear();
  }
}
