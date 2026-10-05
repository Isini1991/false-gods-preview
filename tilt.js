export function setupTilt(onTilt, onActive) {
  const button = document.querySelector('.tilt-toggle');
  const mobile = matchMedia('(pointer: coarse), (max-width: 600px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const orientation = window.DeviceOrientationEvent;
  let listening = false, active = false, baseline = null, timeout;
  function stop() {
    window.removeEventListener('deviceorientation', read);
    clearTimeout(timeout);
    listening = active = false;
    baseline = null;
    onActive(false);
    button.textContent = 'ENABLE TILT';
    button.setAttribute('aria-pressed', 'false');
  }
  function update() {
    button.hidden = !mobile.matches || reduced.matches || !orientation || !isSecureContext;
    if (button.hidden && listening) stop();
  }
  function read(event) {
    if (document.hidden || reduced.matches || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    if (!baseline) baseline = { beta: event.beta, gamma: event.gamma };
    if (!active) {
      clearTimeout(timeout);
      active = true;
      onActive(true);
      button.textContent = 'TILT ON';
      button.setAttribute('aria-pressed', 'true');
    }
    const delta = value => ((value + 540) % 360) - 180;
    const dx = delta(event.gamma - baseline.gamma), dy = delta(event.beta - baseline.beta);
    const angle = (screen.orientation?.angle || window.orientation || 0) * Math.PI / 180;
    const clamp = value => Math.max(-1, Math.min(1, value / 18));
    onTilt(clamp(dx * Math.cos(angle) + dy * Math.sin(angle)), clamp(dy * Math.cos(angle) - dx * Math.sin(angle)));
  }
  button.addEventListener('click', async () => {
    if (listening) { stop(); return; }
    button.disabled = true;
    try {
      if (typeof orientation.requestPermission === 'function' && await orientation.requestPermission() !== 'granted') {
        button.textContent = 'TILT NOT ALLOWED';
        return;
      }
      baseline = null;
      listening = true;
      button.textContent = 'TILT TO BEGIN';
      window.addEventListener('deviceorientation', read, { passive: true });
      timeout = setTimeout(() => {
        if (!active) { stop(); button.textContent = 'TILT UNAVAILABLE'; }
      }, 6000);
    } catch {
      stop();
      button.textContent = 'TILT UNAVAILABLE';
    } finally { button.disabled = false; }
  });
  window.addEventListener('orientationchange', () => { baseline = null; });
  document.addEventListener('visibilitychange', () => { baseline = null; });
  mobile.addEventListener('change', update);
  reduced.addEventListener('change', update);
  update();
}
