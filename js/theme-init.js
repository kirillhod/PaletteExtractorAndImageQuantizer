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

    var storedLocale = window.localStorage.getItem('peiq.locale');
    var localeMode =
      storedLocale === 'auto' || storedLocale === 'en' || storedLocale === 'ru'
        ? storedLocale
        : 'auto';
    var languages =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || 'en'];
    var detected = 'en';
    for (var i = 0; i < languages.length; i++) {
      var tag = String(languages[i] || '').toLowerCase();
      if (tag.indexOf('ru') === 0) {
        detected = 'ru';
        break;
      }
      if (tag.indexOf('en') === 0) {
        detected = 'en';
        break;
      }
    }
    var locale = localeMode === 'auto' ? detected : localeMode;
    root.setAttribute('lang', locale);
    root.setAttribute('data-locale', locale);
    root.setAttribute('data-locale-mode', localeMode);
  } catch (error) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-theme-mode', 'auto');
    document.documentElement.setAttribute('lang', 'en');
    document.documentElement.setAttribute('data-locale', 'en');
    document.documentElement.setAttribute('data-locale-mode', 'auto');
  }
})();
