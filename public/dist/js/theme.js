(function () {
  var STORAGE_KEY = 'wozza-theme';
  var root = document.documentElement;

  function getPreferredTheme() {
    var stored = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      stored = null;
    }
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function persistTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (err) {
      // noop
    }
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (document.body) {
      document.body.setAttribute('data-theme', theme);
    }
    var toggle = document.querySelector('[data-theme-toggle]');
    if (!toggle) return;

    var icon = toggle.querySelector('[data-theme-toggle-icon]');
    var label = toggle.querySelector('[data-theme-toggle-label]');
    var isDark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('title', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
    if (icon) {
      icon.textContent = isDark ? '☀' : '☾';
    }
    if (label) {
      label.textContent = isDark ? 'Tema claro' : 'Tema escuro';
    }
  }

  function ensureToggle() {
    if (!document.body || document.querySelector('[data-theme-toggle]')) return;

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'wozza-theme-toggle';
    button.setAttribute('data-theme-toggle', '');
    button.setAttribute('aria-label', 'Alternar tema');

    button.innerHTML = '' +
      '<span class="wozza-theme-toggle__icon" data-theme-toggle-icon>☾</span>' +
      '<span data-theme-toggle-label class="wozza-theme-toggle__label">Tema escuro</span>';

    button.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      persistTheme(next);
      applyTheme(next);
    });

    document.body.appendChild(button);
    applyTheme(root.getAttribute('data-theme') || getPreferredTheme());
  }

  root.setAttribute('data-theme', getPreferredTheme());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureToggle);
  } else {
    ensureToggle();
  }
})();
