(function () {
  try {
    var stored = window.localStorage.getItem('peiq.theme');
    var mode = stored === 'auto' || stored === 'light' || stored === 'dark' ? stored : 'auto';
    var prefersLight =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = mode === 'auto' ? (prefersLight ? 'light' : 'dark') : mode;
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-mode', mode);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f5f5' : '#1c1e22');
  } catch (error) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-theme-mode', 'auto');
  }
})();
