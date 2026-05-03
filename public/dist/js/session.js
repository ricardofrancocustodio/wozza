const BILLING_EXEMPT_PATHS = [
    '/plans', '/onboarding', '/billing',
    '/login', '/forgot-password', '/reset-password', '/first-password',
    '/privacy-policy', '/terms-of-service'
];

function isExemptPath(pathname) {
    return BILLING_EXEMPT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

function showTrialBanner(daysLeft, planName) {
    if (document.getElementById('wozza-trial-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'wozza-trial-banner';
    banner.style.cssText = [
        'background: linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
        'color:#fff', 'padding:9px 20px', 'text-align:center',
        'font-size:13px', 'position:relative', 'z-index:1050',
        'display:flex', 'align-items:center', 'justify-content:center', 'gap:12px'
    ].join(';');

    const label = daysLeft === 0 ? 'Seu teste termina hoje!'
                : daysLeft === 1 ? 'Último dia de teste grátis!'
                : `${daysLeft} dias de teste grátis restantes`;
    const icon  = daysLeft <= 1 ? '⚠️' : daysLeft <= 3 ? '⏰' : '🎉';

    banner.innerHTML = `
        <span>${icon} ${label}${planName ? ' · ' + planName : ''}</span>
        <a href="/billing" style="color:#fff;font-weight:700;border:1px solid rgba(255,255,255,.7);padding:2px 14px;border-radius:12px;text-decoration:none;font-size:12px;white-space:nowrap;">Assinar agora</a>
        <button onclick="document.getElementById('wozza-trial-banner').remove()" aria-label="Fechar"
            style="background:none;border:none;color:#fff;position:absolute;right:14px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:20px;line-height:1;padding:0;">×</button>
    `;

    const target = document.querySelector('.content-wrapper') || document.body;
    target.insertBefore(banner, target.firstChild);
}

async function initSession() {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });

    if (!response.ok) {
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?returnTo=${returnTo}`;
        return null;
    }

    const data = await response.json();
    const user = data.user;
    const billing = data.billing || {};
    const pathname = window.location.pathname;

    // Redirect away from /plans if plan is already chosen
    if (pathname === '/plans' && billing.status && billing.status !== 'plan_required') {
        window.location.href = '/dashboard';
        return null;
    }

    // Redirect to /plans if no plan and not on an exempt page
    if (billing.status === 'plan_required' && !isExemptPath(pathname)) {
        window.location.href = '/plans';
        return null;
    }

    sessionStorage.setItem('SCHOOL_ID',       user.school_id || billing.account_id || 'wozza-default-school');
    sessionStorage.setItem('USER_ROLE',        user.role     || 'admin');
    sessionStorage.setItem('USER_ID',          user.id       || '');
    sessionStorage.setItem('USER_EMAIL',       user.email    || '');
    sessionStorage.setItem('USER_NAME',        user.name     || (user.email ? user.email.split('@')[0] : 'Usuário'));
    sessionStorage.setItem('SCHOOL_NAME',      billing.account_name || 'Wozza');
    sessionStorage.setItem('BILLING_STATUS',   billing.status       || 'plan_required');
    sessionStorage.setItem('BILLING_ACCOUNT_ID', billing.account_id || '');
    sessionStorage.setItem('TRIAL_DAYS_LEFT',  billing.trial_days_left != null ? String(billing.trial_days_left) : '');

    document.querySelectorAll('[data-user-name]').forEach(el => { el.textContent = sessionStorage.getItem('USER_NAME'); });
    document.querySelectorAll('[data-user-email]').forEach(el => { el.textContent = sessionStorage.getItem('USER_EMAIL'); });

    if (billing.status === 'trialing' && billing.trial_days_left != null) {
        showTrialBanner(billing.trial_days_left, billing.plan_name);
    }

    return user;
}

async function fazerLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    sessionStorage.clear();
    localStorage.removeItem('USER_ALLOWED_PAGES');
    window.location.href = '/login';
}

window.initSession  = initSession;
window.fazerLogout  = fazerLogout;
window.showTrialBanner = showTrialBanner;

document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.auth === 'required') {
        initSession().then(() => {
            if (typeof window.applyPermissions === 'function') window.applyPermissions();
        });
    }
});
