(() => {
  if (window.parent === window || !new URLSearchParams(location.search).has('embedded')) return;
  document.addEventListener('hero:entered', () => {
    window.parent.postMessage({ type: 'false-gods:entered' }, location.origin);
  }, { once: true });
})();
