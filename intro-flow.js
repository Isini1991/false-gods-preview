(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const force = params.get('intro') === '1';
  // Explicit deep links may bypass the intro; normal reloads show it again.
  if (!force && (location.hash || params.get('intro') === '0')) return;

  const site = document.querySelector('#site-content');
  const overlay = document.createElement('div');
  overlay.className = 'intro-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Enter False Gods');
  const frame = document.createElement('iframe');
  frame.src = 'intro/index.html?embedded=1';
  frame.title = 'False Gods — interactive eye intro';
  const skip = document.createElement('button');
  skip.className = 'intro-skip';
  skip.type = 'button';
  skip.textContent = 'SKIP INTRO';
  overlay.append(frame, skip);
  document.body.append(overlay);
  document.documentElement.classList.add('intro-active');
  site.inert = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let finishing = false;

  async function finish() {
    if (finishing) return;
    finishing = true;
    if (!reduced.matches) {
      try {
        await overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 850, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards'
        }).finished;
      } catch {}
    }
    overlay.remove();
    document.documentElement.classList.remove('intro-active');
    site.inert = false;
    const heading = document.querySelector('#band-name');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    window.removeEventListener('message', onMessage);
    document.removeEventListener('keydown', onKey);
  }
  function onMessage(event) {
    if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'false-gods:entered') finish();
  }
  function onKey(event) {
    if (event.key === 'Escape') finish();
  }
  window.addEventListener('message', onMessage);
  document.addEventListener('keydown', onKey);
  skip.addEventListener('click', finish);
  frame.addEventListener('load', () => {
    try {
      const enter = frame.contentDocument.querySelector('.enter-button');
      enter?.focus({ preventScroll: true });
      frame.contentDocument.addEventListener('keydown', onKey);
      // Keep keyboard focus inside the intro, including its skip control.
      frame.contentDocument.addEventListener('keydown', event => {
        if (event.key === 'Tab') { event.preventDefault(); skip.focus(); }
      });
    } catch { skip.focus(); }
  }, { once: true });
  skip.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    try { frame.contentDocument.querySelector('.enter-button')?.focus(); } catch {}
  });
})();
