/* ─────────────────────────────────────────────────────────────────
   Gerrymandering Revealed — theme toggle
   Loads early to prevent flash. Reads localStorage; falls back to
   system preference; lets the user toggle and persists their choice.
   Injects a toggle button into the site nav after DOM is ready.
   ───────────────────────────────────────────────────────────────── */

(function () {
  var STORAGE_KEY = 'gerry-theme';

  // Apply theme as early as possible (script tag should be in <head>)
  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function readStored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function writeStored(v) {
    try { localStorage.setItem(STORAGE_KEY, v); } catch (e) {}
  }

  function currentTheme() {
    var stored = readStored();
    if (stored === 'light' || stored === 'dark') return stored;
    // First visit: honor system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  // Apply immediately so there's no flash of wrong theme
  applyTheme(currentTheme());

  function toggleTheme() {
    var next = (document.documentElement.getAttribute('data-theme') === 'light') ? 'dark' : 'light';
    applyTheme(next);
    writeStored(next);
  }

  function buildButton() {
    var btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'Toggle light/dark theme');
    btn.setAttribute('title', 'Toggle light/dark');
    btn.innerHTML =
      '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' +
      '</svg>' +
      '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="4"/>' +
        '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>' +
      '</svg>';
    btn.addEventListener('click', toggleTheme);
    return btn;
  }

  function inject() {
    // Don't double-inject (e.g., if the script accidentally loads twice)
    if (document.querySelector('.theme-toggle')) return;
    var nav = document.querySelector('.site-nav');
    var btn = buildButton();
    if (nav) {
      nav.appendChild(btn);
    } else {
      // No site-nav (shouldn't happen on this site, but be defensive):
      // park the button top-right so it's still reachable.
      btn.style.position = 'fixed';
      btn.style.top = '12px';
      btn.style.right = '12px';
      btn.style.zIndex = '1000';
      document.body.appendChild(btn);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
