(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    // Preserve the original artwork while removing near-white video residue.
    const cleanup = Array.from({ length: 256 }, (_, level) =>
      level >= 249 ? 1 : level / 255).join(' ');
    for (const id of ['clean-red', 'clean-green', 'clean-blue']) {
      document.getElementById(id).setAttribute('tableValues', cleanup);
    }
  });
})();
