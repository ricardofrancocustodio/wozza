// Componente loader simples para wozza: injeta header, sidebar e footer.
(function () {
    const headerHtml = `
        <nav class="main-header navbar navbar-expand navbar-white navbar-light">
            <ul class="navbar-nav">
                <li class="nav-item">
                    <a class="nav-link" data-widget="pushmenu" href="#" role="button"><i class="fas fa-bars"></i></a>
                </li>
                <li class="nav-item d-none d-sm-inline-block">
                    <a href="/" class="nav-link">Início</a>
                </li>
            </ul>
        </nav>
    `;

    const sidebarHtml = `
        <aside class="main-sidebar sidebar-dark-primary elevation-4">
            <a href="/" class="brand-link">
                <span class="brand-text font-weight-light ml-2">Wozza</span>
            </a>
            <div class="sidebar">
                <nav class="mt-2">
                    <ul class="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu" data-accordion="false">
                        <li class="nav-item">
                            <a href="/" class="nav-link">
                                <i class="nav-icon fas fa-tachometer-alt"></i>
                                <p>Dashboard</p>
                            </a>
                        </li>
                        <li class="nav-item">
                            <a href="/social-monitor" class="nav-link">
                                <i class="nav-icon fas fa-shield-alt"></i>
                                <p>Monitor Social</p>
                            </a>
                        </li>
                    </ul>
                </nav>
            </div>
        </aside>
    `;

    const footerHtml = `
        <footer class="main-footer">
            <strong>Wozza</strong> &mdash; Monitor Social
        </footer>
    `;

    function inject() {
        const headerEl = document.getElementById('component-header');
        const sidebarEl = document.getElementById('component-sidebar');
        const footerEl = document.getElementById('component-footer');
        if (headerEl) headerEl.innerHTML = headerHtml;
        if (sidebarEl) sidebarEl.innerHTML = sidebarHtml;
        if (footerEl) footerEl.innerHTML = footerHtml;

        // Marca link ativo
        const path = window.location.pathname.replace(/\/$/, '') || '/';
        document.querySelectorAll('.nav-sidebar .nav-link').forEach((a) => {
            const href = a.getAttribute('href');
            if (!href) return;
            const target = href.replace(/\/$/, '') || '/';
            if (target === path) a.classList.add('active');
        });

        document.body.style.opacity = 1;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }
})();
