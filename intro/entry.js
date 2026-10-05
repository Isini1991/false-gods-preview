(() => {
  'use strict';
  const hero = document.querySelector('.hero');
  const button = document.querySelector('.enter-button');
  const actions = document.querySelector('.hero-actions');
  const canvas = document.querySelector('#eye');
  const layer = document.querySelector('.entry-layer');
  const logo = document.querySelector('.entry-logo');
  const status = document.querySelector('#status');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const asset = new Image();
  asset.src = 'assets/full-logo.png';
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const ease = 'cubic-bezier(.22,1,.36,1)';
  const animations = [];
  function animate(element, frames, options) {
    const animation = element.animate(frames, { fill: 'forwards', ...options });
    animations.push(animation);
    return animation.finished;
  }
  function maskOpacity(selector, duration, delay = 0) {
    return animate(document.querySelector(selector), [{ opacity: 0 }, { opacity: 1 }],
      { duration, delay, easing: 'ease-in-out' });
  }
  async function reveal() {
    const source = canvas.getBoundingClientRect();
    layer.hidden = false;
    const final = logo.getBoundingClientRect();
    // Align the existing pupil with the triangle in the supplied complete logo.
    const eyeX = source.left + source.width * 951 / 1920;
    const eyeY = source.top + source.height * 560 / 1080;
    const finalX = final.left + final.width * .535;
    const finalY = final.top + final.height * .917;
    const scale = (final.width * .226) / (source.width * 523 / 1920);
    canvas.style.transformOrigin = '49.53125% 51.85185%';
    const moved = `translate(${finalX - eyeX}px, ${finalY - eyeY}px) scale(${scale})`;
    const tasks = [
      animate(canvas, [{ transform: 'none' }, { transform: moved }], { duration: 550, easing: ease }),
      animate(canvas, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, delay: 470 }),
      maskOpacity('.logo-triangle-mask', 180, 470),
      maskOpacity('.logo-text-mask', 280, 730),
      maskOpacity('.logo-complete-mask', 180, 980)
    ];
    for (const ring of document.querySelectorAll('.logo-ring-mask')) {
      tasks.push(animate(ring, [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }],
        { duration: 620, delay: 400, easing: 'ease-in-out' }));
    }
    await Promise.all(tasks);
    hero.dataset.entryPhase = 'complete-logo';
    await pause(250);
  }
  async function dock() {
    const rect = logo.getBoundingClientRect();
    // An explicit header slot lets the finished mark remain visible even before
    // the actual site content or navigation destination is connected.
    const embedded = new URLSearchParams(location.search).has('embedded') && window.parent !== window;
    const stage = embedded ? window.parent.document.querySelector('.scene') : null;
    const stageRect = stage?.getBoundingClientRect();
    const size = stage ? Number(stage.dataset.logoSize) || Math.min(innerWidth * .5, 430) : Math.min(92, hero.clientWidth * .19);
    const left = stage ? stageRect.left + (stageRect.width - size) / 2 : 24;
    const top = stage ? stageRect.top + (Number(stage.dataset.logoTop) || 60) : 24;
    const scale = size / rect.width;
    const moveX = left + size / 2 - (rect.left + rect.width / 2);
    const moveY = top + size * 958 / 959 / 2 - (rect.top + rect.height / 2);
    await animate(logo, [
      { transform: 'translate(-50%, -50%)' },
      { transform: `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px)) scale(${scale})` }
    ], { duration: reducedMotion.matches ? 0 : 450, easing: ease });
    // Commit layout values so the header logo remains correctly positioned
    // after resizing or rotating the device.
    logo.style.width = `${size}px`;
    logo.style.left = `${left}px`;
    logo.style.top = `${top}px`;
    logo.style.transform = 'none';
    for (const animation of logo.getAnimations()) animation.cancel();
  }
  button.addEventListener('click', async () => {
    if (button.disabled || hero.classList.contains('is-entered')) return;
    button.disabled = true;
    try {
      await asset.decode();
      hero.dataset.entering = 'true';
      hero.dataset.entryPhase = 'centering';
      hero.dispatchEvent(new CustomEvent('hero:prepare-entry'));
      await animate(actions, [{ opacity: 1 }, { opacity: 0 }],
        { duration: reducedMotion.matches ? 0 : 180 });
      if (reducedMotion.matches) {
        layer.hidden = false;
        document.querySelector('.logo-complete-mask').style.opacity = '1';
        canvas.style.opacity = '0';
      } else {
        await pause(120);
        hero.dataset.entryPhase = 'revealing';
        await reveal();
      }
      await dock();
      hero.classList.add('is-entered');
      hero.dataset.entryPhase = 'entered';
      const content = document.querySelector('[data-site-content]');
      if (content) {
        hero.classList.add('has-site-content');
        content.hidden = false;
        await animate(content, [{ opacity: 0 }, { opacity: 1 }],
          { duration: reducedMotion.matches ? 0 : 350 });
        const focusTarget = content.querySelector('h1, a, button') || content;
        if (!focusTarget.hasAttribute('tabindex')) focusTarget.setAttribute('tabindex', '-1');
        focusTarget.focus({ preventScroll: true });
      } else {
        hero.focus({ preventScroll: true });
      }
      hero.dispatchEvent(new CustomEvent('hero:enter', { bubbles: true }));
      hero.dispatchEvent(new CustomEvent('hero:entered', { bubbles: true }));
      const destination = button.dataset.enterUrl.trim();
      if (destination) window.location.assign(destination);
    } catch (error) {
      for (const animation of animations) animation.cancel();
      layer.hidden = true;
      hero.dataset.entering = 'false';
      delete hero.dataset.entryPhase;
      button.disabled = false;
      canvas.style.opacity = '';
      hero.dispatchEvent(new CustomEvent('hero:reset-entry'));
      status.textContent = 'Unable to load the logo. Please try again.';
      status.hidden = false;
      console.error('Logo entry failed:', error);
    }
  });
})();
