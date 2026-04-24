(function () {
  'use strict';

  if (window.__vetriScrollAnimationsLoaderAdded) return;
  window.__vetriScrollAnimationsLoaderAdded = true;

  var style = document.createElement('style');
  style.textContent = '.sv-nav-dot{display:none !important;}';
  document.head.appendChild(style);

  var script = document.createElement('script');
  script.src = '/js/Scroll%20animations.js';
  script.defer = true;
  document.head.appendChild(script);
})();
