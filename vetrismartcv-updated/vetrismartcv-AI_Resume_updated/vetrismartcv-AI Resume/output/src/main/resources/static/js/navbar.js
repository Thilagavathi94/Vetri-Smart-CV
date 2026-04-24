// ============================================================
// VetriSmartCV - navbar.js  (v2 - robust session check)
// ============================================================

function makeUserPillOpenDashboard(root) {
    if (!root) return;
    if (root.dataset.dashboardBound === 'true') return;

    root.dataset.dashboardBound = 'true';
    root.style.cursor = 'pointer';
    root.setAttribute('role', 'link');
    root.setAttribute('tabindex', '0');
    root.setAttribute('title', 'Open Dashboard');

    root.addEventListener('click', function (e) {
        if (e.target && typeof e.target.closest === 'function' && e.target.closest('button, a')) return;
        window.location.href = '/dashboard';
    });

    root.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.location.href = '/dashboard';
        }
    });
}

async function initNavbar() {
    try {
        const res  = await fetch('/api/auth/session');
        const data = await res.json();

        if (data.loggedIn && data.user) {
            const user     = data.user;
            const initial  = (user.name || '?').charAt(0).toUpperCase();
            const userName = user.name || 'User';

            // ── INDEX PAGE ──────────────────────────────────────
            // Hide login dropdown wrap
            const loginWrap = document.getElementById('navLoginWrap');
            if (loginWrap) loginWrap.style.display = 'none';

            // Show user pill
            const userPill = document.getElementById('navUserPill');
            if (userPill) {
                userPill.style.display = 'flex';
                makeUserPillOpenDashboard(userPill);
            }

            // Set avatar initial
            const avatarEl = document.getElementById('navAvatar');
            if (avatarEl) avatarEl.textContent = initial;

            // Set username (only if navDashLi doesn't exist — avoid overwriting builder/review)
            const userNameEl = document.getElementById('navUserName');
            if (userNameEl && !document.getElementById('navDashLi')) {
                userNameEl.textContent = userName;
            }

            // Show logout button (index page)
            const logoutBtn = document.getElementById('navLogoutBtn');
            if (logoutBtn) logoutBtn.style.display = 'inline-block';

            // ── PRICING / TEMPLATES / PAYMENT pages ─────────────
            const widget = document.getElementById('navUserWidget');
            if (widget) {
                widget.style.display = 'flex';
                makeUserPillOpenDashboard(widget);
                const av = document.getElementById('navWidgetAvatar');
                const nm = document.getElementById('navWidgetName');
                if (av) av.textContent = initial;
                if (nm) nm.textContent = userName;
                // hide Login li item
                const loginItem = document.getElementById('navLoginItem');
                if (loginItem) loginItem.style.display = 'none';
                // show logout btn on these pages
                const lb = document.getElementById('navLogoutBtn');
                if (lb) lb.style.display = 'inline-block';
            }

            // ── BUILDER / REVIEW pages ───────────────────────────
            // (their checkSession in builder.js / review.js also runs,
            //  but we also handle it here in case navbar.js loads first)
            const loginLi = document.getElementById('navLoginLi');
            if (loginLi) loginLi.style.display = 'none';

            const dashLi = document.getElementById('navDashLi');
            if (dashLi) {
                dashLi.style.display = 'list-item';
                const nm = document.getElementById('navUserName');
                if (nm) nm.textContent = userName;
            }

            document.querySelectorAll('.nav-user-pill').forEach(makeUserPillOpenDashboard);
        }
    } catch (e) {
        // Session fetch failed — leave default logged-out state
        console.warn('Navbar session check failed:', e);
    }
}

// Run on DOMContentLoaded for reliability
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavbar);
} else {
    initNavbar(); // DOM already ready
}

// ── Global logout handler ──────────────────────────────────
window.doLogout = async function() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch(e) {}
    window.location.href = '/';
};

// ── Login dropdown toggle (index page) ────────────────────
window.toggleLoginDropdown = function(e) {
    if (e) e.stopPropagation();
    const wrap = document.getElementById('navLoginWrap');
    if (wrap) wrap.classList.toggle('open');
};

document.addEventListener('click', function(e) {
    const wrap = document.getElementById('navLoginWrap');
    if (wrap && !wrap.contains(e.target)) wrap.classList.remove('open');
});
