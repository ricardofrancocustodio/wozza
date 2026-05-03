async function initSession() {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });

    if (!response.ok) {
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?returnTo=${returnTo}`;
        return null;
    }

    const data = await response.json();
    const user = data.user;

    sessionStorage.setItem('SCHOOL_ID', user.school_id || 'wozza-default-school');
    sessionStorage.setItem('USER_ROLE', user.role || 'admin');
    sessionStorage.setItem('USER_ID', user.id || '');
    sessionStorage.setItem('USER_EMAIL', user.email || '');
    sessionStorage.setItem('USER_NAME', user.name || (user.email ? user.email.split('@')[0] : 'Usuário'));
    sessionStorage.setItem('SCHOOL_NAME', 'Wozza');

    document.querySelectorAll('[data-user-name]').forEach((el) => {
        el.textContent = sessionStorage.getItem('USER_NAME');
    });
    document.querySelectorAll('[data-user-email]').forEach((el) => {
        el.textContent = sessionStorage.getItem('USER_EMAIL');
    });

    return user;
}

async function fazerLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    sessionStorage.clear();
    localStorage.removeItem('USER_ALLOWED_PAGES');
    window.location.href = '/login';
}

window.initSession = initSession;
window.fazerLogout = fazerLogout;

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.auth === 'required') {
        initSession().then(() => {
            if (typeof window.applyPermissions === 'function') window.applyPermissions();
        });
    }
});
