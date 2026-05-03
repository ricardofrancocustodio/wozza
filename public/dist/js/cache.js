// Stub de cache em memória.
(function () {
    const store = new Map();
    window.appCache = {
        get(key) { return store.get(key); },
        set(key, value) { store.set(key, value); },
        del(key) { store.delete(key); },
        clear() { store.clear(); }
    };
})();
