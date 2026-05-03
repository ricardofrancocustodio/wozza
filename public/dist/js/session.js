// Stub de sessão: define um school_id padrão no sessionStorage para que o
// social-monitor (e outras páginas) consigam identificar a "escola" atual.
(function () {
    if (!sessionStorage.getItem('SCHOOL_ID')) {
        sessionStorage.setItem('SCHOOL_ID', 'wozza-default-school');
    }
    if (!sessionStorage.getItem('USER_NAME')) {
        sessionStorage.setItem('USER_NAME', 'Diretoria');
    }
    if (!sessionStorage.getItem('SCHOOL_NAME')) {
        sessionStorage.setItem('SCHOOL_NAME', 'Wozza');
    }
})();
