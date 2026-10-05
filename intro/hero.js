(() => {
  'use strict';
  const SOURCE_WIDTH = 1920, SOURCE_HEIGHT = 1080;
  const FRAME_WIDTH = 192, FRAME_HEIGHT = 108, FRAME_COUNT = 301;
  // The source has a sparse, non-linear gaze path. Keep the original iris rigid
  // by default; ?mode=frames retains calibrated video-frame scrubbing.
  const useFrames = new URLSearchParams(location.search).get('mode') === 'frames';
  const canvas = document.querySelector('#eye');
  const hero = document.querySelector('.hero');
  const status = document.querySelector('#status');
  const ctx = canvas.getContext('2d', { alpha: false });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const idleImage = new Image(), sheet = new Image();
  const gazeFrames = window.EYE_GAZE_FRAMES;
  const iris = { x: 951, y: 560, radius: 53, travelX: 34, travelY: 22 };
  const pupilLayer = document.createElement('canvas');
  const pupilContext = pupilLayer.getContext('2d');
  const opening = new Path2D();
  opening.moveTo(866, 570);
  opening.bezierCurveTo(889, 536, 915, 510, 948, 506);
  opening.bezierCurveTo(982, 505, 1020, 523, 1043, 549);
  opening.bezierCurveTo(1051, 560, 1039, 579, 1017, 593);
  opening.bezierCurveTo(973, 621, 913, 614, 881, 592);
  opening.bezierCurveTo(872, 585, 866, 578, 866, 570);
  opening.closePath();
  let currentX = 0, currentY = 0, targetX = 0, targetY = 0;
  let raf = 0, previousTime = 0, ready = false, selectedFrame = 0;
  let resting = true, lastPaintX = NaN, lastPaintY = NaN, lastPaintFrame = -1;
  let interactionLocked = false;

  function pointerTarget(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width * iris.x / SOURCE_WIDTH;
    const centerY = rect.top + rect.height * iris.y / SOURCE_HEIGHT;
    const dx = clientX - centerX, dy = clientY - centerY;
    // Independent axes: below the eye always means a positive vertical gaze.
    const x = Math.tanh(dx / Math.max(90, rect.width * .23));
    const y = Math.tanh(dy / Math.max(70, rect.height * .26));
    const magnitude = Math.hypot(x, y);
    return magnitude > 1 ? [x / magnitude, y / magnitude] : [x, y];
  }
  function nearestFrame(x, y) {
    if (Math.hypot(x, y) < .035) return 0;
    let best = selectedFrame, bestDistance = Infinity;
    for (const [frame, gx, gy] of gazeFrames) {
      const distance = (gx - x) ** 2 + (gy - y) ** 2;
      const cost = distance + Math.min(Math.abs(frame - selectedFrame), 40) * .000015;
      if (cost < bestDistance) { bestDistance = cost; best = frame; }
    }
    const previous = gazeFrames[selectedFrame];
    const previousDistance = (previous[1] - x) ** 2 + (previous[2] - y) ** 2;
    return previousDistance <= bestDistance + .001 ? selectedFrame : best;
  }
  function buildPupilLayer() {
    const size = iris.radius * 2;
    pupilLayer.width = pupilLayer.height = size;
    pupilContext.save();
    pupilContext.beginPath();
    pupilContext.arc(iris.radius, iris.radius, iris.radius, 0, Math.PI * 2);
    pupilContext.clip();
    pupilContext.drawImage(idleImage, iris.x - iris.radius, iris.y - iris.radius,
      size, size, 0, 0, size, size);
    pupilContext.restore();
  }
  function render(force = false) {
    if (!ready) return;
    if (useFrames) {
      selectedFrame = resting && currentX === 0 && currentY === 0 ? 0 : nearestFrame(currentX, currentY);
      if (!force && selectedFrame === lastPaintFrame) return;
      ctx.drawImage(sheet, selectedFrame * FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT,
        0, 0, canvas.width, canvas.height);
      lastPaintFrame = selectedFrame;
    } else {
      if (!force && currentX === lastPaintX && currentY === lastPaintY) return;
      ctx.save();
      ctx.scale(canvas.width / SOURCE_WIDTH, canvas.height / SOURCE_HEIGHT);
      ctx.drawImage(idleImage, 0, 0);
      if (currentX !== 0 || currentY !== 0) {
        ctx.save();
        ctx.clip(opening);
        const patch = ctx.createRadialGradient(iris.x, iris.y, 49, iris.x, iris.y, 54);
        patch.addColorStop(0, 'rgba(250,250,250,1)');
        patch.addColorStop(.8, 'rgba(250,250,250,1)');
        patch.addColorStop(1, 'rgba(250,250,250,0)');
        ctx.fillStyle = patch;
        ctx.fillRect(iris.x - 54, iris.y - 54, 108, 108);
        ctx.drawImage(pupilLayer,
          iris.x - iris.radius + currentX * iris.travelX,
          iris.y - iris.radius + currentY * iris.travelY);
        ctx.restore();
      }
      ctx.restore();
      lastPaintX = currentX; lastPaintY = currentY;
    }
    hero.dataset.gazeX = currentX.toFixed(4);
    hero.dataset.gazeY = currentY.toFixed(4);
    hero.dataset.frame = String(selectedFrame);
  }
  function tick(time) {
    raf = 0;
    const dt = previousTime ? Math.min((time - previousTime) / 1000, .05) : 1 / 60;
    previousTime = time;
    const easing = 1 - Math.exp(-(resting ? 7.5 : 12) * dt);
    currentX += (targetX - currentX) * easing;
    currentY += (targetY - currentY) * easing;
    if (Math.hypot(targetX - currentX, targetY - currentY) < .0004) {
      currentX = targetX; currentY = targetY;
    }
    render();
    if (currentX !== targetX || currentY !== targetY) raf = requestAnimationFrame(tick);
    else previousTime = 0;
  }
  function wake() { if (ready && !raf) raf = requestAnimationFrame(tick); }
  function idle(immediate = false) {
    resting = true; targetX = targetY = 0;
    if (immediate) { currentX = currentY = 0; render(true); }
    else wake();
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    render(true);
  }
  hero.addEventListener('pointermove', event => {
    if (reducedMotion.matches || interactionLocked) return;
    [targetX, targetY] = pointerTarget(event.clientX, event.clientY);
    resting = false;
    wake();
  }, { passive: true });
  hero.addEventListener('hero:prepare-entry', () => { interactionLocked = true; idle(); });
  hero.addEventListener('hero:reset-entry', () => { interactionLocked = false; idle(true); });
  hero.addEventListener('pointerleave', () => idle());
  hero.addEventListener('pointercancel', () => idle());
  hero.addEventListener('pointerup', event => { if (event.pointerType === 'touch') idle(); });
  window.addEventListener('blur', () => idle());
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) idle(true); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; previousTime = 0; idle(true);
    }
  });
  new ResizeObserver(resize).observe(canvas);
  hero.dataset.renderMode = useFrames ? 'frames' : 'rigid';
  const image = useFrames ? sheet : idleImage;
  image.onload = () => {
    const expectedWidth = useFrames ? FRAME_WIDTH * FRAME_COUNT : SOURCE_WIDTH;
    const expectedHeight = useFrames ? FRAME_HEIGHT : SOURCE_HEIGHT;
    if (image.naturalWidth !== expectedWidth || image.naturalHeight !== expectedHeight) {
      status.textContent = 'The animation image has unexpected dimensions.'; return;
    }
    if (!useFrames) buildPupilLayer();
    ready = true; status.hidden = true; resize();
    wake();
  };
  image.onerror = () => { status.textContent = 'Unable to load the eye. Please reload.'; };
  image.src = useFrames ? 'assets/eye-sprite.png' : 'assets/eye-idle.png';
})();
