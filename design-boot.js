/*
 * SETU design boot. Applies the last known published design before first paint
 * so there is no flash of the default theme. Loaded as a same-origin script
 * (the app CSP forbids inline scripts). It only ever calls setProperty on
 * validated CSS custom properties and sets validated data-setu-* flags.
 * The payload is written by src/lib/design/cache.js (BOOT_KEY, version 1).
 */
(function () {
  try {
    var raw = window.localStorage.getItem('setu:design:v1:boot');
    if (!raw || raw.length > 20000) return;
    var boot = JSON.parse(raw);
    if (!boot || boot.v !== 1) return;
    var root = document.documentElement;
    var NAME = /^--[a-z0-9-]+$/;
    var UNSAFE = /[;{}<>]|url\(|expression\(|@import/i;
    var apply = function (map) {
      if (!map || typeof map !== 'object') return;
      for (var key in map) {
        if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
        var value = map[key];
        if (NAME.test(key) && typeof value === 'string' && value.length < 300 && !UNSAFE.test(value)) {
          root.style.setProperty(key, value);
        }
      }
    };
    apply(boot.common);
    apply(root.classList.contains('dark') ? boot.dark : boot.light);
    var dataset = boot.dataset;
    if (dataset && typeof dataset === 'object') {
      for (var name in dataset) {
        if (/^setu[A-Z][A-Za-z]*$/.test(name) && (dataset[name] === 'on' || dataset[name] === 'off')) {
          root.dataset[name] = dataset[name];
        }
      }
    }
  } catch (e) {
    /* a broken cache must never block the app */
  }
})();
