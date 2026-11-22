(() => {
  const root = (window.Commitscape = window.Commitscape || {});

  function prefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** Enables drag-to-orbit camera control on spatial stages without blocking child clicks. */
  function bindOrbitStage(sceneEl, options = {}) {
    if (!sceneEl) return null;
    const {
      defaultRx = -17,
      defaultRy = -22,
      minRx = -42,
      maxRx = 18,
      minRy = -75,
      maxRy = 75,
      invertY = false,
      autoRotate = false
    } = options;

    let rx = defaultRx;
    let ry = defaultRy;
    let auto = autoRotate && !prefersReducedMotion();

    function apply() {
      sceneEl.style.setProperty('--stage-rx', rx.toFixed(1) + 'deg');
      sceneEl.style.setProperty('--stage-ry', ry.toFixed(1) + 'deg');
      sceneEl.classList.toggle('is-auto', auto);
    }

    apply();

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startRx = rx;
    let startRy = ry;

    sceneEl.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 && ev.pointerType === 'mouse') return;
      dragging = true;
      moved = false;
      startX = ev.clientX;
      startY = ev.clientY;
      startRx = rx;
      startRy = ry;
      if (auto) {
        auto = false;
        apply();
      }
      sceneEl.classList.add('is-dragging');
    });

    const onMove = (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.hypot(dx, dy) > 8) moved = true;
      const signY = invertY ? -1 : 1;
      ry = Math.max(minRy, Math.min(maxRy, startRy + dx * 0.35));
      rx = Math.max(minRx, Math.min(maxRx, startRx - dy * 0.28 * signY));
      apply();
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      sceneEl.classList.remove('is-dragging');
      if (moved) {
        sceneEl.dataset.justDragged = '1';
        setTimeout(() => {
          delete sceneEl.dataset.justDragged;
        }, 60);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return {
      reset() {
        rx = defaultRx;
        ry = defaultRy;
        apply();
      },
      toggleAuto() {
        if (prefersReducedMotion()) return false;
        auto = !auto;
        apply();
        return auto;
      },
      isAuto() {
        return auto;
      }
    };
  }

  root.stage3d = {
    prefersReducedMotion,
    bindOrbitStage
  };
})();
