/* =============================================
   REVIEW.JS — VetriSmartCV
   3 templates: robert (dark maroon), olivia (green two-col), mary (minimal)
   ============================================= */

const API_BASE = '/api/resume';
let resumeId   = null;
let resumeData = {};
let currentTemplate = 'olivia';   // default
let currentColor    = '#2daf7f';
let currentFontSize = 'medium';
let currentFont     = 'Inter';
let currentSectionSpacing = '16';
let currentLetterSpacing  = '0';
let currentLineSpacing    = '1.5';
let currentEditSection    = null;
let isLoggedIn  = false;
let userPlan    = 'FREE';
let userId      = null;
let activeSections = {};
let templatePageMarkup = null;
let reviewRenderSeq = 0;
let reviewRecoveryAttempts = 0;

function isPaidPlan(plan) {
    const normalized = String(plan || '').toUpperCase();
    return normalized === 'PRO' || normalized === 'PREMIUM';
}

function buildReviewReturnUrl(templateId) {
    const url = new URL(window.location.href);
    if (templateId) url.searchParams.set('template', normalizeReviewTemplate(templateId));
    return url.pathname + url.search;
}

function storePendingProTemplate(templateId) {
    const normalized = normalizeReviewTemplate(templateId);
    sessionStorage.setItem('pendingLockedTemplate', normalized);
    sessionStorage.setItem('pendingLockedTemplateCheckout', '1');
    sessionStorage.setItem('pendingReviewReturnUrl', buildReviewReturnUrl(normalized));
    if (resumeId) sessionStorage.setItem('pendingResumeId', resumeId);
}

function clearPendingProTemplateState() {
    sessionStorage.removeItem('pendingLockedTemplate');
    sessionStorage.removeItem('pendingLockedTemplateCheckout');
    sessionStorage.removeItem('pendingReviewReturnUrl');
}

function goToProTemplatePayment() {
    const returnUrl = sessionStorage.getItem('pendingReviewReturnUrl') || buildReviewReturnUrl(currentTemplate);
    window.location.href = '/payment?plan=PRO&redirect=' + encodeURIComponent(returnUrl);
}

function handleLockedTemplateSelection(templateId) {
    storePendingProTemplate(templateId);
    if (!isLoggedIn) {
        window.location.href = '/login?redirect=' + encodeURIComponent(sessionStorage.getItem('pendingReviewReturnUrl'));
        return;
    }
    if (isPaidPlan(userPlan)) {
        sessionStorage.removeItem('pendingLockedTemplateCheckout');
        changeTemplate(templateId);
        showToast('Template selected for editing');
        return;
    }
    goToProTemplatePayment();
}

function applyPendingProTemplateIfAllowed() {
    const pendingTemplate = sessionStorage.getItem('pendingLockedTemplate');
    if (!pendingTemplate || !isLoggedIn) return;

    if (isPaidPlan(userPlan)) {
        clearPendingProTemplateState();
        if (currentTemplate !== pendingTemplate) {
            changeTemplate(pendingTemplate);
            showToast('Pro template unlocked and applied!');
        }
        return;
    }

    if (sessionStorage.getItem('pendingLockedTemplateCheckout') === '1') {
        goToProTemplatePayment();
    }
}

function normalizeReviewTemplate(templateId) {
    const legacyMap = {
        minimal: 'template1',
        modern: 'template2',
        creative: 'template3'
    };
    const raw = String(templateId || '').trim();
    return legacyMap[raw] || raw;
}

function resolveExactTemplateId(templateId) {
    const normalized = normalizeReviewTemplate(templateId);
    const legacyExactMap = {
        robert: 'template46',
        olivia: 'template28',
        mary: 'template44',
        tanya: 'template10',
        samuel: 'template32',
        alexander: 'template40',
        minimal: 'template37',
        traditional: 'template33',
        'john-orange': 'template23',
        'john-purple': 'template31',
        'alex-creative': 'template11',
        lacy: 'template5',
        marina: 'template19',
        rick: 'template22',
        caroline: 'template28',
        narmatha: 'template34',
        'john-blue': 'template21',
        monica: 'template15',
        'narmatha-pro': 'template16',
        donna: 'template13',
        'john-purple-left': 'template6',
        'john-dark-teal': 'template7',
        'john-green-sidebar': 'template22',
        'product-manager': 'template43',
        botanica: 'template24',
        'smith-orange': 'template8',
        brian: 'template25',
        'dark-pro': 'template50',
        rudolf: 'template39',
        emily: 'template45',
        kelly: 'template26',
        suhail: 'template41',
        ricktang: 'template27',
        hani: 'template30',
        narmatha2: 'template35',
        'guy-hawkins': 'template42',
        'kate-bishop': 'template29',
        'smith-graphic': 'template49'
    };
    return legacyExactMap[normalized] || normalized;
}

function isUsableRenderedResume(doc, ctx, isExact = false) {
    if (!doc || !doc.isConnected) return false;
    const text = (doc.textContent || '').replace(/\s+/g, ' ').trim();
    const hasStructuredRoot = !!doc.querySelector('[class^="resume-t"], .resume-frame, .section-block, .editable-field');
    if (!hasStructuredRoot) return false;
    if (!text && !doc.querySelector('img,[class*="photo"],[class*="avatar"]')) return false;

    const d = ctx.resumeData || {};
    const normalizedText = text.toLowerCase();
    const includesValue = (value) => {
        const v = String(value || '').trim().toLowerCase();
        return v && normalizedText.includes(v);
    };

    const demoPatterns = [
        /lorem ipsum/i,
        /john smith|alex carter|marina wilkinson|jeremy clifford|mathew smith|andrew bolton|amanda griffin|saurabh rathore|maanvita kumari/i,
        /reallygreatsite\.com|example\.com|portfolio\.com|www\.webb\.com/i,
        /\[email(?:\s*protected)?\]/i,
        /wardiere university|xyz college|abc college|los angeles university/i
    ];
    const hasDemoContent = demoPatterns.some((pattern) => pattern.test(text));

    if (includesValue(d.fullName)) return true;
    if (includesValue(d.jobTitle) && !hasDemoContent) return true;
    if (includesValue(d.profileSummary)) return true;
    if (includesValue(d.email) || includesValue(d.phone) || includesValue(d.address || d.location)) return true;

    if ((ctx.projects || []).some(item => includesValue(item.title || item.name))) return true;
    if ((ctx.experience || []).some(item => includesValue(item.jobTitle || item.role || item.title || item.company))) return true;
    if ((ctx.edu || []).some(item => includesValue(item.school || item.university || item.degree || item.field))) return true;
    if ((ctx.skills || []).some(item => includesValue(typeof item === 'string' ? item : (item.name || item.skill)))) return true;

    if (!isExact) return text.length > 20;
    return text.length > 20 && !hasDemoContent;
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const pathParts = window.location.pathname.split('/');
    const parsedId  = parseInt(pathParts[pathParts.length - 1], 10);
    resumeId = (!isNaN(parsedId) && parsedId > 0) ? parsedId : null;

    // Read template from URL param (?template=olivia)
    const urlParams = new URLSearchParams(window.location.search);
    const tmplParam = urlParams.get('template');
    if (tmplParam) currentTemplate = normalizeReviewTemplate(tmplParam);

    await checkSession();

    if (resumeId) {
        await loadResume(resumeId);
    } else {
        const stored = sessionStorage.getItem('resumeData');
        if (stored) {
            try { resumeData = JSON.parse(stored); } catch {}
        }
        // Prefer saved templateName from session, then URL param, then default
        if (resumeData.templateName) currentTemplate = normalizeReviewTemplate(resumeData.templateName);
        renderResume();
    }

    buildColorSwatches();
    await buildTemplateGrid();
    applyPendingProTemplateIfAllowed();

    // Auto-trigger download if coming from dashboard or after login redirect
    if (urlParams.get('download') === '1' || urlParams.get('autoDownload') === '1') {
        setTimeout(() => openDownloadModal(), 800);
    }
});

function buildReviewRedirectUrl(forceDownload = false) {
    const url = new URL(window.location.href);
    if (forceDownload) {
        url.searchParams.set('download', '1');
        url.searchParams.delete('autoDownload');
    }
    return url.pathname + url.search;
}

function redirectToLoginForDownload() {
    window.location.href = '/login?redirect=' + encodeURIComponent(buildReviewRedirectUrl(true));
}

// ============================================================
// SESSION CHECK
// ============================================================
async function checkSession() {
    try {
        const res  = await fetch('/api/auth/session');
        const data = await res.json();
        isLoggedIn = data.loggedIn;
        if (data.loggedIn && data.user) {
            userPlan = data.user.plan || 'FREE';
            userId   = data.user.id;
            const user = data.user;
            const initial  = (user.name || '?').charAt(0).toUpperCase();
            const userName = user.name || 'User';
            const loginLi = document.getElementById('navLoginLi');
            const dashLi  = document.getElementById('navDashLi');
            const nameEl  = document.getElementById('navUserName');
            if (loginLi) loginLi.style.display = 'none';
            if (dashLi)  dashLi.style.display  = 'list-item';
            if (nameEl)  nameEl.textContent     = userName;
            // show user widget if present
            const widget = document.getElementById('navUserWidget');
            if (widget) {
                widget.style.display = 'flex';
                const av = document.getElementById('navWidgetAvatar');
                const nm = document.getElementById('navWidgetName');
                if (av) av.textContent = initial;
                if (nm) nm.textContent = userName;
            }
            const logoutBtn = document.getElementById('navLogoutBtn');
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
        }

        // Apply plan gates (color=all, font/spacing=premium only)
        initDesignLocks();
        updatePlanBadge();

        // Handle return from successful payment
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('upgraded') === '1' && isLoggedIn) {
            showUpgradeBanner(userPlan);
            // If Premium, features are now unlocked — show specific message
            if (userPlan === 'PREMIUM') {
                const feature = sessionStorage.getItem('upgradeFeature');
                if (feature) {
                    sessionStorage.removeItem('upgradeFeature');
                    setTimeout(() => {
                        showUnlockedToast(feature);
                    }, 2000);
                }
            }
            // Clean URL
            history.replaceState({}, '', window.location.pathname);
        }

        if (resumeId) sessionStorage.setItem('pendingResumeId', resumeId);
    } catch (e) {}
}

function showUnlockedToast(feature) {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;padding:14px 28px;border-radius:14px;font-weight:700;font-size:14px;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.25);display:flex;align-items:center;gap:10px;white-space:nowrap;`;
    t.innerHTML = `<span style="font-size:20px;">🔓</span> ${feature} is now unlocked! Try it in the Design panel.`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 5000);
}

// ============================================================
// LOAD RESUME FROM BACKEND
// ============================================================
async function loadResume(id) {
    try {
        const res = await fetch(`${API_BASE}/${id}`);
        if (!res.ok) throw new Error('Not found');
        resumeData = await res.json();
        // Prefer saved template, fall back to URL param, then default
        currentTemplate = resumeData.templateName || currentTemplate;
        if (resumeData.selectedColor)  currentColor          = resumeData.selectedColor;
        if (resumeData.fontFamily)     currentFont           = resumeData.fontFamily;
        if (resumeData.fontStyle)      currentFontSize       = resumeData.fontStyle.toLowerCase();
        if (resumeData.sectionSpacing) { currentSectionSpacing = resumeData.sectionSpacing; const el = document.getElementById('sectionSpacing'); if(el) el.value = resumeData.sectionSpacing; }
        if (resumeData.letterSpacing)  { currentLetterSpacing  = resumeData.letterSpacing;  const el = document.getElementById('letterSpacing');  if(el) el.value = resumeData.letterSpacing; }
        if (resumeData.lineSpacing)    { currentLineSpacing     = resumeData.lineSpacing;    const el = document.getElementById('lineSpacing');     if(el) el.value = resumeData.lineSpacing; }
        renderResume();
    } catch (err) {
        console.error('Failed to load resume:', err);
        showToast('Failed to load resume.', 'error');
        renderResume(); // render empty shell
    }
}

// ============================================================
// PANEL SWITCHING
// ============================================================
function showPanel(name) {
    // Legacy compatibility — route to toggleSidePanel for design/addsection
    if (name === 'design' || name === 'addsection') {
        toggleSidePanel(name);
    }
}

function toggleSidePanel(name) {
    const panel = document.getElementById('panel-' + name);
    const backdrop = document.getElementById('sidePanelBackdrop');
    
    const btn = document.getElementById('btn-' + name);
    if (!panel) return;

    const isOpen = panel.classList.contains('open');

    // Close all panels first
    document.querySelectorAll('.side-panel').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.sidebar-tool-btn').forEach(b => b.classList.remove('active'));
    if (backdrop) backdrop.classList.remove('open');

    if (!isOpen) {
        // Open this panel (only if it wasn't already open)
        panel.classList.add('open');
        if (backdrop) backdrop.classList.add('open');
        if (btn) btn.classList.add('active');
    }
    // If isOpen was true, we just closed it above — nothing more needed
}

function closeAllSidePanels() {
    document.querySelectorAll('.side-panel').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.sidebar-tool-btn').forEach(b => b.classList.remove('active'));
    const backdrop = document.getElementById('sidePanelBackdrop');
    if (backdrop) backdrop.classList.remove('open');
}

// ============================================================
// TEMPLATE GRID (left panel)
// ============================================================
async function buildTemplateGrid() {
    const grid = document.getElementById('templateGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="review-template-loading">Loading templates...</div>';
    if (await buildReviewTemplateCardsFromTemplatePage(grid)) return;
    buildReviewTemplateFallback(grid);
    return;
    // ── Original builder templates ──
    const templates = [
        { id: 'robert',      label: 'Executive Dark',  plan: 'Pro'  },
        { id: 'olivia',      label: 'Clean Two-Col',   plan: 'Free' },
        { id: 'mary',        label: 'Minimal Elegant', plan: 'Pro'  },
        { id: 'tanya',       label: 'Modern Bold',     plan: 'Free' },
        { id: 'samuel',      label: 'Classic Pro',     plan: 'Pro'  },
        { id: 'alexander',   label: 'Contemporary',    plan: 'Free' },
        { id: 'minimal',     label: 'Minimal Clean',   plan: 'Free' },
        { id: 'traditional', label: 'Traditional',     plan: 'Pro'  },
        { id: 'john-orange', label: 'Orange Dark',     plan: 'Pro'  },
        { id: 'john-purple', label: 'Purple Sidebar',  plan: 'Free' },
        { id: 'alex-creative', label: 'Colorful Creative', plan: 'Pro' },
        { id: 'lacy',        label: 'Bold Black',      plan: 'Free' },
        { id: 'marina',      label: 'Pink Teal',       plan: 'Pro'  },
        { id: 'rick',        label: 'Green Sidebar',   plan: 'Pro'  },
        { id: 'caroline',    label: 'Modern Pro',      plan: 'Pro'  },
        { id: 'narmatha',    label: 'Maroon Bold',     plan: 'Pro'  },
        { id: 'john-blue',          label: 'Blue Accent',        plan: 'Free' },
        { id: 'monica',             label: 'Grayscale Pro',      plan: 'Pro'  },
        { id: 'narmatha-pro',       label: 'Dark Maroon Pro',    plan: 'Pro'  },
        { id: 'donna',              label: 'Pink Accent Clean',  plan: 'Free' },
        { id: 'john-purple-left',   label: 'Purple Left Panel',  plan: 'Free' },
        { id: 'john-dark-teal',     label: 'Dark Teal Accent',   plan: 'Pro'  },
        { id: 'john-green-sidebar', label: 'Green Sidebar Pro',  plan: 'Pro'  },
        { id: 'product-manager',    label: 'Dark Wave Gold',      plan: 'Pro'  },
        { id: 'botanica',           label: 'Botanical Dark',      plan: 'Pro'  },
        { id: 'smith-orange',       label: 'Orange Split Pro',    plan: 'Pro'  },
        { id: 'brian',              label: 'Teal Header Pro',     plan: 'Free' },
        { id: 'dark-pro',           label: 'Full Dark Pro',       plan: 'Pro'  },
        { id: 'rudolf',             label: 'Dark Neon Purple',    plan: 'Pro'  },
        { id: 'emily',              label: 'Parchment Elegant',   plan: 'Pro'  },
        { id: 'kelly',              label: 'Orange & Black Bold',  plan: 'Pro'  },
        { id: 'suhail',             label: 'Colorful Geometric',  plan: 'Pro'  },
        { id: 'ricktang',           label: 'Clean White Blob',    plan: 'Pro'  },
        { id: 'hani',               label: 'Dark Sidebar Dev',    plan: 'Pro'  },
        { id: 'narmatha2',          label: 'Maroon Bold',         plan: 'Pro'  },
        { id: 'guy-hawkins',        label: 'Clean Two-Col Pro',   plan: 'Pro'  },
        { id: 'kate-bishop',        label: 'Light Minimal UX',    plan: 'Pro'  },
        { id: 'smith-graphic',      label: 'Orange Footer Bold',  plan: 'Pro'  },
        // ── New templates from Template page (template1–template45) ──
        { id: 'template1',  label: 'Vivid Pro',         plan: 'Free' },
        { id: 'template2',  label: 'Nordic Split',      plan: 'Free' },
        { id: 'template3',  label: 'Golden Edge',       plan: 'Free' },
        { id: 'template4',  label: 'Amber Bold',        plan: 'Pro'  },
        { id: 'template5',  label: 'Monochrome Bold',   plan: 'Pro'  },
        { id: 'template6',  label: 'Purple Dark',       plan: 'Free' },
        { id: 'template7',  label: 'Dark Teal',         plan: 'Free' },
        { id: 'template8',  label: 'Orange Geo',        plan: 'Pro'  },
        { id: 'template9',  label: 'Green Pro',         plan: 'Free' },
        { id: 'template10', label: 'Yellow Wave',       plan: 'Pro'  },
        { id: 'template11', label: 'Vivid Creative',    plan: 'Free' },
        { id: 'template12', label: 'Nordic Coral',      plan: 'Free' },
        { id: 'template13', label: 'Purple Soft',       plan: 'Free' },
        { id: 'template14', label: 'Navy Timeline',     plan: 'Free' },
        { id: 'template15', label: 'Classic Mono',      plan: 'Free' },
        { id: 'template16', label: 'Dark Khaki',        plan: 'Pro'  },
        { id: 'template17', label: 'Gradient Aura',     plan: 'Free' },
        { id: 'template18', label: 'Sky Blue Pro',      plan: 'Pro'  },
        { id: 'template19', label: 'Blush Manager',     plan: 'Free' },
        { id: 'template20', label: 'Azure Split',       plan: 'Pro'  },
        { id: 'template21', label: 'Harvard Blue',      plan: 'Free' },
        { id: 'template22', label: 'Forest Green',      plan: 'Free' },
        { id: 'template23', label: 'Orange Splash',     plan: 'Free' },
        { id: 'template24', label: 'Dark Olive',        plan: 'Pro'  },
        { id: 'template25', label: 'Cyan Banner',       plan: 'Free' },
        { id: 'template26', label: 'Amber Dark',        plan: 'Pro'  },
        { id: 'template27', label: 'Blob Navy',         plan: 'Free' },
        { id: 'template28', label: 'Caroline Clean',    plan: 'Free' },
        { id: 'template29', label: 'Mint Minimal',      plan: 'Free' },
        { id: 'template30', label: 'Slate Dev',         plan: 'Free' },
        { id: 'template31', label: 'Indigo Marketing',  plan: 'Pro'  },
        { id: 'template32', label: 'Cream Navy Gold',    plan: 'Free' },
        { id: 'template33', label: 'Navy Header 2-Col',  plan: 'Free' },
        { id: 'template34', label: 'Dark Header Modern', plan: 'Pro'  },
        { id: 'template35', label: 'Navy Bold 2-Panel',  plan: 'Pro'  },
        { id: 'template36', label: 'Teal Forest',        plan: 'Free' },
        { id: 'template37', label: 'ATS Classic White',  plan: 'Free' },
        { id: 'template38', label: 'Indigo Split Pro',   plan: 'Pro'  },
        { id: 'template39', label: 'Dark Split Dev',      plan: 'Free' },
        { id: 'template40', label: 'Clean Navy Strip',    plan: 'Free' },
        { id: 'template41', label: 'Blue Geo Light',      plan: 'Pro'  },
        { id: 'template42', label: 'Navy Timeline Pro',   plan: 'Pro'  },
        { id: 'template43', label: 'Charcoal Yellow Geo', plan: 'Pro'  },
        { id: 'template44', label: 'Clean Minimal UX',    plan: 'Free' },
        { id: 'template45', label: 'Parchment Warm Pro',  plan: 'Pro'  },
        { id: 'template46', label: 'Teal Executive',      plan: 'Pro'  },
        { id: 'template47', label: 'Blue UI Pro',         plan: 'Free' },
        { id: 'template48', label: 'Cyan Prism',          plan: 'Free' },
        { id: 'template49', label: 'Blue Geo Strip',      plan: 'Pro'  },
        { id: 'template50', label: 'Dark Navy Side',      plan: 'Pro'  },
        { id: 'template51', label: 'Timeline Classic',    plan: 'Free' },
        { id: 'template52', label: 'Minimal Timeline',    plan: 'Free' },
    ];
    grid.innerHTML = '';
    const isPaidUser = isPaidPlan(userPlan);
    templates.forEach(t => {
        const isProTemplate = t.plan === 'Pro';
        const isLocked = isProTemplate && !isPaidUser;
        const div = document.createElement('div');
        div.className = 'tmpl-thumb'
            + (t.id === currentTemplate ? ' selected' : '')
            + (isLocked ? ' pro-locked' : '');
        div.id = 'tgrid-' + t.id;
        div.onclick = () => {
            if (isLocked) {
                handleLockedTemplateSelection(t.id);
                return;
            }
            changeTemplate(t.id);
        };
        const lockHTML = isLocked ? `
            <div class="tmpl-pro-lock">
                <div class="lock-icon">&#x1F512;</div>
                <strong>Pro Template</strong>
                <div class="lock-cta">Upgrade to unlock</div>
            </div>` : '';
        const editBtnHTML = !isLocked ? `
            <div class="tmpl-thumb-edit-wrap">
                <button class="tmpl-thumb-edit-btn" title="Edit with this template" onclick="event.stopPropagation(); changeTemplate('${t.id}'); showToast('✏️ Switched to ${t.label}');">✏️ Edit</button>
            </div>` : '';
        div.innerHTML = `
            <div class="tmpl-thumb-inner">
                ${buildMiniPreview(t.id)}
                ${editBtnHTML}
                <div class="tmpl-thumb-label">
                    <span>${t.label}</span>
                    <span class="tmpl-plan-badge ${t.plan === 'Free' ? 'free' : 'pro'}">${t.plan}</span>
                </div>
            </div>
            ${lockHTML}`;
        grid.appendChild(div);
    });
}

async function buildReviewTemplateCardsFromTemplatePage(grid) {
    try {
        const res = await fetch('/template', { cache: 'no-store' });
        if (!res.ok) throw new Error('Template page unavailable');
        const html = await res.text();
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        templatePageMarkup = parsed;

        // Inject all template CSS into the review page so thumbnails render correctly
        ensureExactTemplateStylesInjected();

        const sourceCards = Array.from(parsed.querySelectorAll('.tpl-card[data-template^="template"]'))
            .filter(card => /^template([1-9]|[1-4][0-9]|5[0-2])$/.test(card.dataset.template || ''))
            .sort((a, b) => parseInt(a.dataset.template.replace('template',''), 10) - parseInt(b.dataset.template.replace('template',''), 10));

        if (sourceCards.length < 52) throw new Error('Expected 52 template cards, got ' + sourceCards.length);

        grid.innerHTML = '';
        grid.classList.add('review-template-card-grid');
        const isPaidUser = isPaidPlan(userPlan);

        sourceCards.slice(0, 52).forEach(card => {
            const tplId = card.dataset.template;
            const plan = (card.dataset.plan || 'free').toLowerCase();
            const locked = plan === 'pro' && !isPaidUser;
            const clone = card.cloneNode(true);

            clone.id = 'tgrid-' + tplId;
            clone.classList.add('review-tpl-card');
            clone.classList.toggle('selected', tplId === currentTemplate);
            clone.classList.toggle('pro-locked', locked);
            clone.removeAttribute('onclick');
            clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

            const actions = clone.querySelector('.tpl-preview-actions');
            if (actions) {
                actions.innerHTML = locked
                    ? '<button class="btn-preview edit" type="button">Upgrade</button>'
                    : '<button class="btn-preview edit" type="button">Edit</button>';
            }

            clone.addEventListener('click', () => {
                if (locked) {
                    handleLockedTemplateSelection(tplId);
                    return;
                }
                changeTemplate(tplId);
                showToast('Template selected for editing');
            });

            grid.appendChild(clone);
        });
        if (shouldUseExactGalleryTemplate(currentTemplate)) {
            renderResume();
        }
        return true;
    } catch (err) {
        console.warn('Review template import failed:', err);
        return false;
    }
}

function shouldUseExactGalleryTemplate(templateId) {
    return /^template\d+$/i.test(templateId || '');
}

function collectExactTemplateNodes(root, matcher) {
    const nodes = [];
    if (!root) return nodes;
    if (matcher(root)) nodes.push(root);
    root.querySelectorAll('*').forEach(node => {
        if (matcher(node)) nodes.push(node);
    });
    return nodes;
}

function buildExactTemplateContacts(d) {
    return [
        d.phone || '',
        d.email || '',
        d.address || d.location || '',
        d.linkedin || '',
        d.website || ''
    ].filter(Boolean);
}

function fillExactTemplatePhoto(root, d) {
    const photoTargets = collectExactTemplateNodes(root, node => {
        const cls = node.className || '';
        return typeof cls === 'string' && /(photo|avatar|placeholder|\bph\b|photo-ph|avatar-ph)/i.test(cls) && !/(graph|wrap|shape|meta|top-right|outer|section-title)/i.test(cls);
    });
    if (!photoTargets.length) return;
    const shouldShowPhoto = d.includePhoto !== false;
    const initials = ((d.fullName || 'U').trim().charAt(0) || 'U').toUpperCase();
    photoTargets.forEach(node => {
        if (!shouldShowPhoto) {
            node.innerHTML = '';
            node.style.display = 'none';
        } else if (d.profilePhotoData) {
            node.innerHTML = `<img src="${d.profilePhotoData}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
        } else {
            node.textContent = initials;
        }
        attachRvLineMeta(node, 'profilePhoto', 'Profile Photo', null, false);
    });
}

function fillExactTemplateText(root, classPattern, value, options = {}) {
    if (!value) return;
    const nodes = collectExactTemplateNodes(root, node => {
        const cls = node.className || '';
        return typeof cls === 'string' && classPattern.test(cls);
    });
    let filled = 0;
    nodes.forEach(node => {
        if (options.skip && options.skip(node)) return;
        if (options.limit && filled >= options.limit) return;
        if (options.preserveChildren && node.children.length) {
            const target = Array.from(node.children).find(child => child.children.length === 0) || node.lastElementChild;
            if (target) {
                target.textContent = value;
                if (options.field) attachRvLineMeta(target, options.field, options.label || options.field, options.index ?? null, !!options.canDelete);
                filled += 1;
                return;
            }
        }
        node.textContent = value;
        if (options.field) attachRvLineMeta(node, options.field, options.label || options.field, options.index ?? null, !!options.canDelete);
        filled += 1;
    });
}

function _isExactLeafNode(node) {
    return !!node && node.nodeType === 1 && node.children.length === 0;
}

function attachRvLineMeta(node, field, label, index = null, canDelete = false) {
    if (!node) return;
    node.dataset.rvLineField = field || '';
    node.dataset.rvLineLabel = label || '';
    if (index !== null && index !== undefined) node.dataset.rvLineIndex = String(index);
    else delete node.dataset.rvLineIndex;
    node.dataset.rvLineDelete = canDelete ? '1' : '0';
}

function _setExactNodeText(node, value) {
    if (!node) return;
    node.textContent = value || '';
}

function _setExactDecoratedValue(node, value) {
    if (!node) return false;
    const safeValue = value || '';
    const link = node.querySelector('a');
    if (link) {
        link.textContent = safeValue;
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeValue)) {
            link.setAttribute('href', `mailto:${safeValue}`);
        }
        return true;
    }

    const textNodes = Array.from(node.childNodes).filter(child =>
        child.nodeType === Node.TEXT_NODE && child.textContent.trim()
    );
    if (textNodes.length) {
        textNodes.forEach((textNode, index) => {
            textNode.textContent = index === 0 ? ` ${safeValue}` : '';
        });
        return true;
    }

    if (node.firstElementChild) {
        node.appendChild(document.createTextNode(` ${safeValue}`));
        return true;
    }

    _setExactNodeText(node, safeValue);
    return true;
}

function _findExactStructuredValueNode(section, fieldName) {
    const blocks = Array.from(section.querySelectorAll('[class*="field"], [class*="contact-item"], [class*="contact-row"]'));
    return blocks.find(block => {
        const label = block.querySelector('[class*="label"]');
        const text = _rvNormalizeHeading(label ? label.textContent : block.textContent);
        return text.includes(fieldName);
    });
}

function fillExactTemplateContacts(root, d) {
    const contacts = buildExactTemplateContacts(d);
    if (!contacts.length) return;
    const structuredMap = [
        { key: 'phone', value: d.phone || '' },
        { key: 'email', value: d.email || '' },
        { key: 'address', value: d.address || d.location || '' },
        { key: 'location', value: d.address || d.location || '' },
        { key: 'linkedin', value: d.linkedin || '' },
        { key: 'website', value: d.website || '' }
    ];

    const touched = new Set();
    structuredMap.forEach(({ key, value }) => {
        if (!value) return;
        const node = _findExactStructuredValueNode(root, key);
        if (!node) return;
        const valueNode = node.querySelector('[class*="field-val"]') || node.querySelector('[class*="contact-text"]') || node;
        _setExactNodeText(valueNode, value);
        attachRvLineMeta(valueNode, key === 'location' ? 'address' : key, 'Contact', null, false);
        touched.add(valueNode);
    });

    const decoratedContactMap = [
        { key: 'email', value: d.email || '', pattern: /email|@|\[email|✉/i },
        { key: 'phone', value: d.phone || '', pattern: /phone|📱|☎|tel|\+\d/i },
        { key: 'linkedin', value: d.linkedin || '', pattern: /linkedin|\bin\b/i },
        { key: 'website', value: d.website || '', pattern: /🌐|www|http|portfolio|dribbble|behance/i }
    ];

    decoratedContactMap.forEach(({ key, value, pattern }) => {
        if (!value) return;
        const node = collectExactTemplateNodes(root, el => {
            const cls = el.className || '';
            if (typeof cls !== 'string' || !/contact-item|contact-row|links/i.test(cls)) return false;
            return pattern.test((el.textContent || '').trim());
        }).find(el => !touched.has(el));
        if (!node) return;
        _setExactDecoratedValue(node, value);
        attachRvLineMeta(node, key, 'Contact', null, false);
        touched.add(node);
    });

    const leafNodes = collectExactTemplateNodes(root, node => {
        const cls = node.className || '';
        return typeof cls === 'string'
            && /(contact|links|footer-item|field-val|location)/i.test(cls)
            && !/(title|wrap|grid|row-gap|sec-title|list|label|icon)/i.test(cls)
            && _isExactLeafNode(node);
    }).filter(node => !touched.has(node));

    const orderedValues = [
        d.phone || '',
        d.email || '',
        d.address || d.location || '',
        d.linkedin || '',
        d.website || ''
    ].filter(Boolean);

    leafNodes.forEach((node, index) => {
        const value = orderedValues[index];
        if (value) {
            _setExactNodeText(node, value);
            const keys = ['phone', 'email', 'address', 'linkedin', 'website'];
            attachRvLineMeta(node, keys[index] || 'phone', 'Contact', null, false);
        } else if (index >= orderedValues.length) {
            node.style.display = 'none';
        }
    });
}

function fillExactTemplateList(root, itemPattern, values) {
    if (!values.length) return;
    const items = collectExactTemplateNodes(root, node => {
        const cls = node.className || '';
        return typeof cls === 'string' && itemPattern.test(cls);
    }).filter(node =>
        node.children.length === 0
        && !node.closest('.rv-exact-body')
        && !node.closest('.section-block')
    );

    items.forEach((node, index) => {
        const value = values[index] || '';
        if (value) {
            node.textContent = value;
            return;
        }

        const row = node.closest('[class*="timeline-item"], [class*="skill-row"], [class*="item"], [class*="job"], [class*="edu"], [class*="exp"], [class*="lang"], [class*="contact-item"]');
        if (row) {
            row.style.display = 'none';
        } else {
            node.textContent = '';
        }
    });
}

function splitExactSimpleEntries(value) {
    return (value || '')
        .toString()
        .split(/\r?\n|,/)
        .map(v => v.trim())
        .filter(Boolean);
}

function _getExactSectionHeadings(root) {
    return collectExactTemplateNodes(root, node => {
        const text = _rvNormalizeHeading(node.textContent || '');
        return !!RV_HEADING_MAP[text] && node.children.length <= 2 && text.length <= 32;
    });
}

function _collectExactTopCandidates(section, pattern, excludePattern = null) {
    const nodes = Array.from(section.querySelectorAll('*')).filter(node => {
        const cls = node.className || '';
        if (typeof cls !== 'string' || !pattern.test(cls)) return false;
        if (excludePattern && excludePattern.test(cls)) return false;
        return node.children.length > 0 || _isExactLeafNode(node);
    });
    return nodes.filter(node => !nodes.some(other => other !== node && other.contains(node) && other.parentElement === node.parentElement));
}

function _syncExactBlocks(section, pattern, count, excludePattern = null) {
    const candidates = _collectExactTopCandidates(section, pattern, excludePattern)
        .filter(node => !RV_HEADING_MAP[_rvNormalizeHeading(node.textContent || '')]);
    if (!candidates.length) return [];

    const template = candidates[0];
    const parent = template.parentElement;
    if (!parent) return candidates.slice(0, count);

    let blocks = Array.from(parent.children).filter(child => {
        const cls = child.className || '';
        return typeof cls === 'string' && pattern.test(cls) && !(excludePattern && excludePattern.test(cls));
    });
    if (!blocks.length) blocks = candidates;

    while (blocks.length > count) {
        const node = blocks.pop();
        if (node && node.parentElement) node.parentElement.removeChild(node);
    }
    while (blocks.length < count) {
        const clone = template.cloneNode(true);
        parent.appendChild(clone);
        blocks.push(clone);
    }
    return blocks;
}

function _exactSetFirstByClass(block, pattern, value, skipPattern = null) {
    if (!value) return false;
    const node = Array.from(block.querySelectorAll('*')).find(el => {
        const cls = el.className || '';
        return typeof cls === 'string'
            && pattern.test(cls)
            && !(skipPattern && skipPattern.test(cls))
            && _isExactLeafNode(el);
    });
    if (!node) return false;
    _setExactNodeText(node, value);
    return true;
}

function _populateExactSkillSection(section, skills) {
    if (!skills.length) return;
    const blocks = _syncExactBlocks(section, /(skill-bar|skill-row|skill-item|skill|lang-bar)/i, skills.length, /(section-title|skill-title|sec-title)/i);
    if (!blocks.length) return;

    blocks.forEach((block, index) => {
        const skill = skills[index] || {};
        const name = typeof skill === 'string' ? skill : (skill.name || skill.skill || '');
        const levelRaw = typeof skill === 'string' ? '' : (skill.level || '');
        const level = String(levelRaw || '80').replace('%', '');

        const labelNode = Array.from(block.querySelectorAll('*')).find(el => {
            const cls = el.className || '';
            return typeof cls === 'string'
                && /(label|name|skill-item|skill)$/.test(cls)
                && !/(fill|track|bar|title)/i.test(cls)
                && _isExactLeafNode(el);
        }) || (_isExactLeafNode(block) ? block : null);

        if (labelNode) _setExactNodeText(labelNode, name);
        attachRvLineMeta(block, 'skillsJson', 'Skills', index, true);

        const pctNode = Array.from(block.querySelectorAll('*')).find(el => {
            const txt = (el.textContent || '').trim();
            return _isExactLeafNode(el) && /%$/.test(txt);
        });
        if (pctNode) _setExactNodeText(pctNode, `${level}%`);

        block.querySelectorAll('[class*="fill"], [style*="width:"]').forEach(el => {
            if (el.style && (el.className || '').toString().match(/fill/i)) {
                el.style.width = `${level}%`;
            }
        });
    });
}

function _populateExactEducationSection(section, edu) {
    if (!edu.length) return;
    const blocks = _syncExactBlocks(section, /(edu-item|education-item|timeline-item|item|course)/i, edu.length, /(section-title|sec-title|title|content)/i);
    if (!blocks.length) {
        const heading = _getExactSectionHeading(section);
        const nameClass = Array.from(section.querySelectorAll('[class*="edu-name"], [class*="edu-org"], [class*="edu-school"]'))[0]?.className || '';
        const degreeClass = Array.from(section.querySelectorAll('[class*="edu-deg"], [class*="edu-degree"], [class*="qualification"]'))[0]?.className || '';
        const dateClass = Array.from(section.querySelectorAll('[class*="edu-date"], [class*="edu-year"], [class*="edu-years"], [class*="edu-yr"]'))[0]?.className || '';
        if (!heading) return;
        _clearExactSectionBody(section, heading);

        edu.forEach((item, index) => {
            const school = item.school || item.university || '';
            const degree = [item.degree || item.field || '', item.cgpa ? `${item.cgpa}` : ''].filter(Boolean).join(', ');
            const year = item.year || item.startYear || '';
            const itemWrap = document.createElement('div');
            itemWrap.className = 'rv-exact-edu-item';
            attachRvLineMeta(itemWrap, 'educationJson', 'Education', index, true);

            if (school) {
                const el = document.createElement('div');
                if (nameClass) el.className = nameClass;
                el.textContent = school;
                itemWrap.appendChild(el);
            }
            if (degree) {
                const el = document.createElement('div');
                if (degreeClass) el.className = degreeClass;
                el.textContent = degree;
                itemWrap.appendChild(el);
            }
            if (year) {
                const el = document.createElement('div');
                if (dateClass) el.className = dateClass;
                el.textContent = year;
                itemWrap.appendChild(el);
            }
            section.appendChild(itemWrap);
        });
        return;
    }

    blocks.forEach((block, index) => {
        const item = edu[index] || {};
        const degree = item.degree || item.field || '';
        const school = item.school || item.university || '';
        const year = item.year || item.startYear || '';
        _exactSetFirstByClass(block, /(edu-degree|edu-deg|degree|course-name|course|qualification)/i, degree, /(section-title|sec-title)/i);
        _exactSetFirstByClass(block, /(edu-uni|course-uni|school|university|college|org|uni)/i, school, /(section-title|sec-title)/i);
        _exactSetFirstByClass(block, /(edu-date|edu-year|edu-years|course-years|year|yr|date)/i, year, /(section-title|sec-title)/i);
        const desc = [item.description || '', item.cgpa ? `CGPA: ${item.cgpa}` : ''].filter(Boolean).join(' · ');
        if (desc) {
            _exactSetFirstByClass(block, /(desc|about|text|content)/i, desc, /(section-title|sec-title)/i);
        } else {
            block.querySelectorAll('[class*="desc"], [class*="about"], [class*="text"], [class*="content"]').forEach(el => {
                if (_isExactLeafNode(el)) el.style.display = 'none';
            });
        }
        attachRvLineMeta(block, 'educationJson', 'Education', index, true);
    });
}

function _populateExactExperienceSection(section, experience) {
    if (!experience.length) return;
    const blocks = _syncExactBlocks(section, /(timeline-item|job|exp-row|exp-item|experience-item)/i, experience.length, /(section-title|sec-title|title-r|title-l)$/i);
    if (!blocks.length) {
        const heading = _getExactSectionHeading(section);
        if (!heading) return;
        _clearExactSectionBody(section, heading);
        experience.forEach((item, index) => {
            const wrap = document.createElement('div');
            wrap.className = 'rv-exact-exp-item';
            wrap.style.cssText = 'margin-top:10px;';
            attachRvLineMeta(wrap, 'experienceJson', 'Experience', index, true);
            [
                [item.jobTitle || item.role || item.title || '', item.company || ''].filter(Boolean).join(' at '),
                [item.location || '', item.startDate || item.from || '', item.endDate || item.to || 'Present'].filter(Boolean).join(' | '),
                (item.description || item.bullets || '').toString().split('\n').map(s => s.trim()).filter(Boolean).join(' • ')
            ].filter(Boolean).forEach(line => {
                const row = document.createElement('div');
                row.textContent = line;
                wrap.appendChild(row);
            });
            section.appendChild(wrap);
        });
        return;
    }

    blocks.forEach((block, index) => {
        const item = experience[index] || {};
        const title = item.jobTitle || item.role || item.title || '';
        const company = item.company || '';
        const location = item.location || '';
        const companyLine = [company, location].filter(Boolean).join(' | ');
        const date = [item.startDate || item.from || '', item.endDate || item.to || 'Present'].filter(Boolean).join(' - ');
        const lines = (item.description || item.bullets || '').toString().split('\n').map(s => s.trim()).filter(Boolean);

        const titleNodeSet = _exactSetFirstByClass(block, /(job-title|tl-title|exp-title|role|position|title)/i, [title, company].filter(Boolean).join(' at '), /(section-title|sec-title|title-r|title-l|skill-title|edu-title)/i);
        if (!titleNodeSet) {
            _exactSetFirstByClass(block, /(job-title|tl-title|exp-title|role|position|title)/i, title, /(section-title|sec-title|title-r|title-l|skill-title|edu-title)/i);
        }
        const metaNode = block.querySelector('[class*="job-meta"], [class*="job-company"], [class*="meta"]');
        if (metaNode) {
            const spans = metaNode.querySelectorAll('span');
            if (spans[0]) _setExactNodeText(spans[0], companyLine);
            else _setExactDecoratedValue(metaNode, companyLine);
            if (spans[1]) _setExactNodeText(spans[1], date);
        } else {
            _exactSetFirstByClass(block, /(job-co|job-company|company|job-at|org|meta|co|loc)/i, companyLine, /(section-title|sec-title)/i);
            _exactSetFirstByClass(block, /(job-date|date|year|years|yr|tl-year|year-badge)/i, date, /(section-title|sec-title)/i);
        }

        const bulletNodes = Array.from(block.querySelectorAll('*')).filter(el => {
            const cls = el.className || '';
            return typeof cls === 'string' && /(bullet|desc|text|content|about)/i.test(cls) && _isExactLeafNode(el);
        });
        if (bulletNodes.length > 1 && lines.length) {
            bulletNodes.forEach((node, i) => {
                if (lines[i]) _setExactNodeText(node, lines[i]);
                else node.style.display = 'none';
            });
        } else {
            _exactSetFirstByClass(block, /(job-desc|desc|text|content|about)/i, lines.join(' • '), /(section-title|sec-title)/i);
        }
        attachRvLineMeta(block, 'experienceJson', 'Experience', index, true);
    });
}

function _populateExactProjectsSection(section, projects) {
    if (!projects.length) return;
    const blocks = _syncExactBlocks(section, /(project-item|project|job|portfolio-item|item)/i, projects.length, /(section-title|sec-title)/i);
    if (!blocks.length) {
        const heading = _getExactSectionHeading(section);
        if (!heading) return;
        _clearExactSectionBody(section, heading);
        projects.forEach((item, index) => {
            const wrap = document.createElement('div');
            wrap.className = 'rv-exact-project-item';
            wrap.style.cssText = 'margin-top:10px;';
            attachRvLineMeta(wrap, 'projectsJson', 'Projects', index, true);
            [item.title || item.name || '', item.tools || '', item.description || ''].filter(Boolean).forEach(line => {
                const row = document.createElement('div');
                row.textContent = line;
                wrap.appendChild(row);
            });
            section.appendChild(wrap);
        });
        return;
    }

    blocks.forEach((block, index) => {
        const item = projects[index] || {};
        const title = item.title || item.name || '';
        const tools = item.tools || item.url || item.year || '';
        const desc = item.description || '';
        _exactSetFirstByClass(block, /(project-title|job-title|title|name)/i, title, /(section-title|sec-title)/i);
        _exactSetFirstByClass(block, /(tools|tech|stack|meta|company|date|year)/i, tools, /(section-title|sec-title)/i);
        _exactSetFirstByClass(block, /(desc|text|content|bullet|about)/i, desc, /(section-title|sec-title)/i);
        attachRvLineMeta(block, 'projectsJson', 'Projects', index, true);
    });
}

function _populateExactSimpleSection(section, values, blockPattern, field = '', label = '') {
    if (!values.length) return;
    const blocks = _syncExactBlocks(section, blockPattern, values.length, /(section-title|sec-title|title)/i);
    if (!blocks.length) {
        const heading = _getExactSectionHeading(section);
        if (!heading) return;
        _clearExactSectionBody(section, heading);
        _appendExactSectionLines(section, field, label, values, true);
        return;
    }
    blocks.forEach((block, index) => {
        const leaf = Array.from(block.querySelectorAll('*')).find(_isExactLeafNode) || (_isExactLeafNode(block) ? block : null);
        if (leaf) _setExactNodeText(leaf, values[index] || '');
        if (field) attachRvLineMeta(block, field, label || field, index, true);
    });
}

function _populateExactProfileSection(section, summary) {
    const heading = _getExactSectionHeading(section);
    if (!heading) return;
    if (!summary) {
        section.style.display = 'none';
        return;
    }
    const descNode = Array.from(section.querySelectorAll('*')).find(el => {
        const cls = el.className || '';
        return typeof cls === 'string' && /(desc|text|content|about|profile)/i.test(cls) && _isExactLeafNode(el) && el !== heading;
    });
    if (descNode) {
        _setExactNodeText(descNode, summary);
        attachRvLineMeta(descNode, 'profileSummary', 'Profile Summary', null, false);
        return;
    }
    _clearExactSectionBody(section, heading);
    _appendExactSectionLines(section, 'profileSummary', 'Profile Summary', [summary], false);
}

function populateExactTemplateSections(root, ctx) {
    const headings = _getExactSectionHeadings(root);
    const seen = new Set();
    const d = ctx.resumeData || {};
    headings.forEach(heading => {
        const key = _rvNormalizeHeading(heading.textContent || '');
        const meta = RV_HEADING_MAP[key];
        if (!meta || seen.has(meta.field)) return;
        seen.add(meta.field);

        const section = resolveExactSectionContainer(root, heading);
        if (!section) return;

        if (meta.field === 'profileSummary') {
            const summary = d.profileSummary || '';
            if (!summary.trim()) { section.style.display = 'none'; return; }
            _populateExactProfileSection(section, summary);
        } else if (meta.field === 'skillsJson') {
            const skills = ctx.skills || [];
            if (!skills.length) { section.style.display = 'none'; return; }
            _populateExactSkillSection(section, skills);
        } else if (meta.field === 'educationJson') {
            const edu = ctx.edu || [];
            if (!edu.length) { section.style.display = 'none'; return; }
            _populateExactEducationSection(section, edu);
        } else if (meta.field === 'experienceJson') {
            const exp = ctx.experience || [];
            if (!exp.length) { section.style.display = 'none'; return; }
            _populateExactExperienceSection(section, exp);
        } else if (meta.field === 'projectsJson') {
            const projects = ctx.projects || [];
            if (!projects.length) { section.style.display = 'none'; return; }
            _populateExactProjectsSection(section, projects);
        } else if (meta.field === 'languages') {
            const entries = splitExactSimpleEntries(d.languages || '');
            if (!entries.length) { section.style.display = 'none'; return; }
            _populateExactSimpleSection(section, entries, /(lang-item|language|lang|skill|item)/i, 'languages', 'Languages');
        } else if (meta.field === 'certifications') {
            const entries = splitExactSimpleEntries(d.certifications || '');
            if (!entries.length) { section.style.display = 'none'; return; }
            _populateExactSimpleSection(section, entries, /(cert|certificate|course|item)/i, 'certifications', 'Certifications');
        } else if (meta.field === 'qualities') {
            const entries = splitExactSimpleEntries(d.qualities || '');
            if (!entries.length) { section.style.display = 'none'; return; }
            _populateExactSimpleSection(section, entries, /(quality|item|skill)/i, 'qualities', 'Qualities');
        } else if (meta.field === 'tools') {
            const entries = splitExactSimpleEntries(d.tools || '');
            if (!entries.length) { section.style.display = 'none'; return; }
            _populateExactSimpleSection(section, entries, /(tool|item|skill)/i, 'tools', 'Tools');
        }
    });
}

function removeExactItem(field, index) {
    try {
        if (['skillsJson', 'educationJson', 'experienceJson', 'projectsJson'].includes(field)) {
            let arr = [];
            try { arr = JSON.parse(resumeData[field] || '[]'); } catch {}
            arr = Array.isArray(arr) ? arr : [];
            arr.splice(index, 1);
            resumeData[field] = JSON.stringify(arr);
            persistField(field, resumeData[field]);
            renderResume();
            showToast('Item deleted.');
            return;
        }

        const entries = splitExactSimpleEntries(resumeData[field] || '');
        entries.splice(index, 1);
        resumeData[field] = entries.join('\n');
        persistField(field, resumeData[field]);
        renderResume();
        showToast('Item deleted.');
    } catch (err) {
        console.error('Failed to delete item:', err);
        showToast('Unable to delete item.', 'error');
    }
}

function exactSectionIdForField(field) {
    const map = {
        profileSummary: 'rv-section-profile',
        phone: 'rv-section-contact',
        skillsJson: 'rv-section-skills',
        educationJson: 'rv-edu-section',
        experienceJson: 'rv-experience-section',
        projectsJson: 'rv-projects-section',
        certifications: 'rv-section-certificates',
        languages: 'rv-section-languages',
        tools: 'rv-section-tools',
        awards: 'rv-section-awards',
        interests: 'rv-section-interests',
        website: 'rv-section-portfolio',
        linkedin: 'rv-section-portfolio'
    };
    return map[field] || ('rv-section-' + field.replace(/[^a-z0-9]+/gi, '-').toLowerCase());
}

function makeExactEditableLine(field, label, text, options = {}) {
    if (!text) return '';
    const tag = options.tag || 'div';
    const classes = [options.className, 'editable-field'].filter(Boolean).join(' ');
    const cls = classes ? ` class="${classes}"` : '';
    const style = options.style ? ` style="${options.style}"` : '';
    const deleteHtml = options.deleteButton || '';
    return `<${tag}${cls}${style} ${editBtn(field, label, text)}>${esc(text)} <span class="edit-pen">✏</span>${deleteHtml}</${tag}>`;
}

function makeExactDeleteButton(field, index) {
    return `<button type="button" onclick="event.stopPropagation(); removeExactItem('${field}', ${index})" style="margin-left:8px;border:none;background:rgba(239,68,68,0.12);color:#dc2626;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer;">Delete</button>`;
}

function buildExactSectionContent(field, label, ctx) {
    const d = ctx.resumeData || {};
    const wrapStyle = 'display:flex;flex-direction:column;gap:10px;margin-top:10px;';
    const itemStyle = 'font-size:12px;line-height:1.7;color:inherit;cursor:pointer;';

    if (field === 'profileSummary') {
        const summary = d.profileSummary || 'Add profile summary';
        return `<div style="${wrapStyle}">${makeExactEditableLine('profileSummary', 'Profile Summary', summary, { style: itemStyle })}</div>`;
    }

    if (field === 'phone') {
        const lines = [
            d.phone,
            d.email,
            d.address || d.location,
            d.linkedin,
            d.website
        ].filter(Boolean);
        if (!lines.length) lines.push('Add contact details');
        return `<div style="${wrapStyle}">${lines.map((line, index) => {
            const contactField = ['phone', 'email', 'address', 'linkedin', 'website'][index] || 'phone';
            return makeExactEditableLine(contactField, 'Contact', line, { style: itemStyle });
        }).join('')}</div>`;
    }

    if (field === 'skillsJson') {
        const skills = (ctx.skills || []).map(s => {
            if (typeof s === 'string') return { name: s, level: '' };
            return {
                name: s.name || s.skill || '',
                level: typeof s.level === 'number' ? `${s.level}%` : (s.level ? String(s.level) : '')
            };
        }).filter(s => s.name);
        if (!skills.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine('skillsJson', 'Skills', 'Add skills', { style: itemStyle })}</div>`;
        }
        return `<div style="${wrapStyle}">${skills.map((skill, index) =>
            makeExactEditableLine('skillsJson', 'Skills', [skill.name, skill.level].filter(Boolean).join(' - '), { style: itemStyle, deleteButton: makeExactDeleteButton('skillsJson', index) })
        ).join('')}</div>`;
    }

    if (field === 'educationJson') {
        const items = (ctx.edu || []);
        if (!items.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine('educationJson', 'Education', 'Add education', { style: itemStyle })}</div>`;
        }
        return `<div style="${wrapStyle}">${items.map((item, index) => {
            const title = [item.degree || item.field, item.school || item.university, item.year].filter(Boolean).join(' - ');
            const line = title || 'Education';
            return makeExactEditableLine('educationJson', 'Education', line, { style: itemStyle, deleteButton: makeExactDeleteButton('educationJson', index) });
        }).join('')}</div>`;
    }

    if (field === 'experienceJson') {
        const items = (ctx.experience || []);
        if (!items.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine('experienceJson', 'Experience', 'Add experience', { style: itemStyle })}</div>`;
        }
        return `<div style="${wrapStyle}">${items.map((item, index) => {
            const parts = [
                item.jobTitle || item.role || item.title,
                item.company,
                [item.startDate || item.from, item.endDate || item.to].filter(Boolean).join(' - ')
            ].filter(Boolean);
            return makeExactEditableLine('experienceJson', 'Experience', parts.join(' | '), { style: itemStyle, deleteButton: makeExactDeleteButton('experienceJson', index) });
        }).join('')}</div>`;
    }

    if (field === 'projectsJson') {
        const items = (ctx.projects || []);
        if (!items.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine('projectsJson', 'Projects', 'Add projects', { style: itemStyle })}</div>`;
        }
        return `<div style="${wrapStyle}">${items.map((item, index) => {
            const parts = [item.title || item.name, item.tools, item.description].filter(Boolean);
            return makeExactEditableLine('projectsJson', 'Projects', parts.join(' | '), { style: itemStyle, deleteButton: makeExactDeleteButton('projectsJson', index) });
        }).join('')}</div>`;
    }

    if (['certifications', 'languages', 'awards', 'interests'].includes(field)) {
        const entries = splitExactSimpleEntries(d[field] || '');
        if (!entries.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine(field, label, `Add ${label.toLowerCase()}`, { style: itemStyle })}</div>`;
        }
        return `<div style="${wrapStyle}">${entries.map((entry, index) =>
            makeExactEditableLine(field, label, entry, { style: itemStyle, deleteButton: makeExactDeleteButton(field, index) })
        ).join('')}</div>`;
    }

    if (field === 'tools') {
        const entries = splitExactSimpleEntries(d.tools || '');
        if (!entries.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine('tools', 'Tools', 'Add tools', { style: itemStyle })}</div>`;
        }
        return `<div style="${wrapStyle}">${entries.map((entry, index) =>
            makeExactEditableLine('tools', 'Tools', entry, { style: itemStyle, deleteButton: makeExactDeleteButton('tools', index) })
        ).join('')}</div>`;
    }

    if (field === 'website' || field === 'linkedin') {
        const lines = [d.website, d.linkedin].filter(Boolean);
        if (!lines.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine('website', label, 'Add links', { style: itemStyle })}</div>`;
        }
        return `<div style="${wrapStyle}">${lines.map(line =>
            makeExactEditableLine(line === d.linkedin ? 'linkedin' : 'website', label, line, { style: itemStyle })
        ).join('')}</div>`;
    }

    return '';
}

function resolveExactSectionContainer(root, heading) {
    const parent = heading.parentElement;
    if (!parent || parent === root) return null;

    const siblings = Array.from(parent.children);
    const idx = siblings.indexOf(heading);
    const siblingHeadings = siblings.filter(el => RV_HEADING_MAP[_rvNormalizeHeading(el.textContent || '')]);

    if (idx >= 0 && siblingHeadings.length > 1) {
        const group = document.createElement('div');
        group.className = 'section-block rv-exact-section';
        parent.insertBefore(group, heading);
        for (let i = idx; i < siblings.length; i++) {
            const node = siblings[i];
            if (i > idx && RV_HEADING_MAP[_rvNormalizeHeading(node.textContent || '')]) break;
            group.appendChild(node);
        }
        return group;
    }

    return parent;
}

function rebuildExactTemplateSections(root, ctx) {
    const headings = collectExactTemplateNodes(root, node => {
        const text = _rvNormalizeHeading(node.textContent || '');
        return !!RV_HEADING_MAP[text] && node.children.length <= 2 && text.length <= 32;
    });

    const done = new Set();
    headings.forEach(heading => {
        const key = _rvNormalizeHeading(heading.textContent || '');
        const meta = RV_HEADING_MAP[key];
        if (!meta || done.has(meta.field)) return;

        // Skip headings inside profile-strip — those are already handled directly
        // (rebuilding them would inject a duplicate summary)
        if (heading.closest('[class*="profile-strip"]')) return;

        const section = resolveExactSectionContainer(root, heading);
        if (!section) return;

        done.add(meta.field);
        section.id = exactSectionIdForField(meta.field);
        section.classList.add('section-block');

        const toRemove = Array.from(section.children).filter(child => child !== heading);
        toRemove.forEach(child => child.remove());

        const body = document.createElement('div');
        body.className = 'rv-exact-body';
        body.innerHTML = buildExactSectionContent(meta.field, meta.label, ctx);
        section.appendChild(body);
    });
}

function appendMissingExactSections(root, ctx) {
    const targetCandidates = Array.from(root.querySelectorAll('*')).filter(node => {
        const cls = node.className || '';
        return typeof cls === 'string'
            && /(body|right|content|br)/i.test(cls)
            && !/(top|header|photo|avatar|contact|strip|left|info)/i.test(cls);
    });
    let target = targetCandidates[targetCandidates.length - 1]
        || root.querySelector('[class*="body"]')
        || root.querySelector('[class*="content"]')
        || root;

    if (target && target.children.length === 1 && target.firstElementChild && !target.firstElementChild.id) {
        target = target.firstElementChild;
    }

    const hasContentForField = (field) => {
        const d = ctx.resumeData || {};
        if (field === 'profileSummary') return !!(d.profileSummary || '').trim();
        if (field === 'skillsJson') return (ctx.skills || []).length > 0;
        if (field === 'educationJson') return (ctx.edu || []).length > 0;
        if (field === 'experienceJson') return (ctx.experience || []).length > 0;
        if (field === 'projectsJson') return (ctx.projects || []).length > 0;
        if (field === 'languages') return splitExactSimpleEntries(d.languages || '').length > 0;
        if (field === 'certifications') return splitExactSimpleEntries(d.certifications || '').length > 0;
        if (field === 'awards') return splitExactSimpleEntries(d.awards || '').length > 0;
        if (field === 'interests') return splitExactSimpleEntries(d.interests || '').length > 0;
        if (field === 'tools') return splitExactSimpleEntries(d.tools || '').length > 0;
        if (field === 'website') return !!((d.website || '').trim() || (d.linkedin || '').trim());
        return false;
    };

    const shouldRenderSection = (item) => {
        if (Object.prototype.hasOwnProperty.call(activeSections, item.key)) {
            return activeSections[item.key] === true;
        }
        return hasContentForField(item.field);
    };

    const known = [
        { key: 'profile', field: 'profileSummary', label: 'Profile Summary' },
        { key: 'contact', field: 'phone', label: 'Contact' },
        { key: 'certificates', field: 'certifications', label: 'Certifications' },
        { key: 'experience', field: 'experienceJson', label: 'Experience' },
        { key: 'skills', field: 'skillsJson', label: 'Skills' },
        { key: 'education', field: 'educationJson', label: 'Education' },
        { key: 'projects', field: 'projectsJson', label: 'Projects' },
        { key: 'languages', field: 'languages', label: 'Languages' },
        { key: 'tools', field: 'tools', label: 'Tools' },
        { key: 'awards', field: 'awards', label: 'Awards' },
        { key: 'interests', field: 'interests', label: 'Interests' },
        { key: 'portfolio', field: 'website', label: 'Portfolio' }
    ];

    known.forEach(item => {
        const shouldShow = shouldRenderSection(item);
        const sectionId = exactSectionIdForField(item.field);
        if (!shouldShow || root.querySelector('#' + sectionId)) return;
        if (item.key === 'portfolio' && !Object.prototype.hasOwnProperty.call(activeSections, 'portfolio')) return;

        const section = document.createElement('div');
        section.id = sectionId;
        section.className = 'section-block rv-exact-appended';
        section.style.cssText = 'margin-top:18px;';
        section.innerHTML = `
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:currentColor;border-bottom:2px solid rgba(124,58,237,0.45);padding-bottom:5px;margin-bottom:10px;">${esc(item.label)}</div>
            <div class="rv-exact-body">${buildExactSectionContent(item.field, item.label, ctx)}</div>
        `;
        target.appendChild(section);
    });
}

function ensureExactCoreSections(root, ctx) {
    const d = ctx.resumeData || {};
    const targetCandidates = Array.from(root.querySelectorAll('*')).filter(node => {
        const cls = node.className || '';
        return typeof cls === 'string'
            && /(body|right|content|br)/i.test(cls)
            && !/(top|header|photo|avatar|contact|strip|left|info)/i.test(cls);
    });
    let target = targetCandidates[targetCandidates.length - 1]
        || root.querySelector('[class*="body"]')
        || root.querySelector('[class*="content"]')
        || root;

    if (target && target.children.length === 1 && target.firstElementChild && !target.firstElementChild.id) {
        target = target.firstElementChild;
    }

    const requiredSections = [
        { field: 'profileSummary', label: 'Profile Summary', show: !!(d.profileSummary || '').trim() },
        { field: 'phone', label: 'Contact', show: !!([d.phone, d.email, d.address || d.location, d.linkedin, d.website].filter(Boolean).length) },
        { field: 'skillsJson', label: 'Skills', show: (ctx.skills || []).length > 0 },
        { field: 'educationJson', label: 'Education', show: (ctx.edu || []).length > 0 },
        { field: 'experienceJson', label: 'Experience', show: (ctx.experience || []).length > 0 }
    ];

    requiredSections.forEach(sectionMeta => {
        if (!sectionMeta.show) return;
        const sectionId = exactSectionIdForField(sectionMeta.field);
        if (root.querySelector('#' + sectionId)) return;

        const section = document.createElement('div');
        section.id = sectionId;
        section.className = 'section-block rv-exact-appended rv-core-section';
        section.style.cssText = 'margin-top:18px;';
        section.innerHTML = `
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:currentColor;border-bottom:2px solid rgba(124,58,237,0.45);padding-bottom:5px;margin-bottom:10px;">${esc(sectionMeta.label)}</div>
            <div class="rv-exact-body">${buildExactSectionContent(sectionMeta.field, sectionMeta.label, ctx)}</div>
        `;
        target.appendChild(section);
    });
}

function hydrateExactGalleryTemplate(root, ctx) {
    const d = ctx.resumeData || {};
    fillExactTemplatePhoto(root, d);
    fillExactTemplateText(root, /(^|[\s-])name([-\s]|$)/i, d.fullName || 'Your Name', {
        field: 'fullName',
        label: 'Full Name',
        limit: 4,
        skip: node => /(edu-name|job-title|project-title|field-label|section-title|sec-title)/i.test(node.className || '')
    });
    fillExactTemplateText(root, /(^|[\s-])role([-\s]|$)|(^|[\s-])(job-title|position|subtitle)([-\s]|$)/i, d.jobTitle || 'Professional', {
        field: 'jobTitle',
        label: 'Job Title',
        limit: 1,
        skip: node => /(sec-title|section-title|title-l|title-r|sec-title-l|sec-title-r|job-title|edu-title|exp-title|skill-title|job|exp|timeline)/i.test(node.className || '')
    });
    // Fill summary only once — track filled nodes to prevent duplication
    const filledSummaryNodes = new Set();
    fillExactTemplateText(root, /(bio|summary|quote-box)/i, d.profileSummary || '', {
        field: 'profileSummary',
        label: 'Profile Summary',
        limit: 1,
        skip: node => {
            if (/(sec-title|title)/i.test(node.className || '')) return true;
            if (filledSummaryNodes.has(node)) return true;
            filledSummaryNodes.add(node);
            return false;
        }
    });
    // Fill profile-strip content: find strip nodes and replace LAST child text (content area, not title)
    if (d.profileSummary) {
        collectExactTemplateNodes(root, node => {
            const cls = node.className || '';
            return typeof cls === 'string' && /profile-strip/i.test(cls);
        }).forEach(stripNode => {
            const last = stripNode.lastElementChild;
            if (last) last.textContent = d.profileSummary;
        });
    }
    fillExactTemplateContacts(root, d);
    populateExactTemplateSections(root, ctx);
}

function renderExactGalleryTemplate(doc, ctx, templateId) {
    if (!templatePageMarkup || !shouldUseExactGalleryTemplate(templateId)) return false;
    const source = templatePageMarkup.querySelector(`.tpl-card[data-template="${templateId}"] .tpl-preview-inner [class^="resume-t"], .tpl-card[data-template="${templateId}"] .tpl-preview-inner [class*=" resume-t"], .tpl-card[data-template="${templateId}"] .tpl-preview-inner .resume-frame`);
    if (!source) return false;

    const clone = source.cloneNode(true);
    hydrateExactGalleryTemplate(clone, ctx);
    doc.innerHTML = '';
    doc.dataset.exactTemplate = 'true';
    doc.appendChild(clone);
    return true;
}

function buildReviewTemplateFallback(grid) {
    const names = [
        'Vivid Pro','Nordic Split','Golden Edge','Amber Bold','Monochrome Bold','Purple Dark','Dark Teal','Orange Geo',
        'Green Pro','Yellow Wave','Vivid Creative','Nordic Coral','Purple Soft','Navy Timeline','Classic Mono','Dark Khaki',
        'Gradient Aura','Sky Blue Pro','Blush Manager','Azure Split','Harvard Blue','Forest Green','Orange Splash','Dark Olive',
        'Cyan Banner','Amber Dark','Blob Navy','Caroline Clean','Mint Minimal','Slate Dev','Indigo Marketing','Cream Navy Gold',
        'Navy Header 2-Col','Dark Header Modern','Navy Bold 2-Panel','Teal Forest','ATS Classic White','Indigo Split Pro',
        'Dark Split Dev','Clean Navy Strip','Blue Geo Light','Navy Timeline Pro','Charcoal Yellow Geo','Clean Minimal UX',
        'Parchment Warm Pro','Teal Executive','Blue UI Pro','Cyan Prism','Blue Geo Strip','Dark Navy Side','Timeline Classic','Minimal Timeline'
    ];
    const proIds = new Set([4,5,8,10,16,18,20,24,26,31,34,35,38,41,42,43,45,46,49,50]);
    const isPaidUser = isPaidPlan(userPlan);

    grid.innerHTML = '';
    grid.classList.add('review-template-card-grid');
    names.forEach((name, index) => {
        const num = index + 1;
        const id = 'template' + num;
        const locked = proIds.has(num) && !isPaidUser;
        const div = document.createElement('div');
        div.className = 'tpl-card review-tpl-card' + (id === currentTemplate ? ' selected' : '') + (locked ? ' pro-locked' : '');
        div.id = 'tgrid-' + id;
        div.dataset.template = id;
        div.dataset.plan = proIds.has(num) ? 'pro' : 'free';
        div.innerHTML = `
            <span class="plan-badge ${proIds.has(num) ? 'pro' : 'free'}">${proIds.has(num) ? 'PRO' : 'FREE'}</span>
            <div class="tpl-preview"><div class="tpl-preview-inner">${buildMiniPreview(id)}</div><div class="preview-overlay"></div>
                <div class="tpl-preview-actions"><button class="btn-preview edit" type="button">${locked ? 'Upgrade' : 'Edit'}</button></div>
            </div>
            <div class="tpl-info"><div class="tpl-info-top"><div class="tpl-name">${name}</div></div>
                <div class="tpl-desc">Resume template ${num}</div><div class="tpl-tags-row"><span class="tpl-tag">Template</span><span class="tpl-tag">ATS</span></div>
            </div>`;
        div.addEventListener('click', () => {
            if (locked) { handleLockedTemplateSelection(id); return; }
            changeTemplate(id);
            showToast('Template selected for editing');
        });
        grid.appendChild(div);
    });
}

function buildMiniPreview(id) {
    if (id === 'robert') {
        return `<div style="height:90px;display:flex;background:#f5ede0;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:38%;background:#f5ede0;padding:6px;">
                <div style="width:24px;height:24px;border-radius:50%;background:#c9a87c;margin:0 auto 4px;"></div>
                <div style="background:#7a1e28;height:4px;border-radius:2px;margin:2px 0;width:80%;"></div>
                <div style="background:#d4bfb0;height:3px;border-radius:2px;margin:2px 0;width:70%;"></div>
                <div style="background:#d4bfb0;height:3px;border-radius:2px;margin:2px 0;width:60%;"></div>
            </div>
            <div style="flex:1;background:#fff;padding:6px;padding-top:18px;position:relative;">
                <div style="position:absolute;top:0;left:0;right:0;height:14px;background:#7a1e28;"></div>
                <div style="background:#7a1e28;height:3px;border-radius:2px;margin:2px 0;width:70%;opacity:0.6;"></div>
                <div style="background:#e0cfc2;height:3px;border-radius:2px;margin:2px 0;width:90%;"></div>
                <div style="background:#e0cfc2;height:3px;border-radius:2px;margin:2px 0;width:75%;"></div>
            </div>
        </div>`;
    }
    if (id === 'olivia') {
        return `<div style="height:90px;display:flex;background:#fff;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:40%;padding:5px;border-right:1px solid #f3f4f6;">
                <div style="height:36px;background:#8fa89a;border-radius:3px;margin-bottom:4px;"></div>
                <div style="background:#d6e8e2;height:3px;border-radius:2px;margin:2px 0;width:90%;"></div>
                <div style="background:#d6e8e2;height:3px;border-radius:2px;margin:2px 0;width:75%;"></div>
            </div>
            <div style="flex:1;padding:5px;">
                <div style="background:#1a1a2e;height:5px;border-radius:2px;margin-bottom:3px;width:80%;"></div>
                <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;"></div>
                <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;width:80%;"></div>
                <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;"></div>
                <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;width:70%;"></div>
            </div>
        </div>`;
    }
    if (id === 'tanya') {
        return `<div style="height:90px;display:flex;background:#fff;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:38%;background:#2b2b2b;padding:5px;">
                <div style="width:18px;height:18px;border-radius:50%;background:#c9a87c;margin:0 auto 3px;border:1px solid #f5c842;"></div>
                <div style="background:#f5c842;height:2px;border-radius:1px;margin:2px auto;width:60%;"></div>
                <div style="background:#555;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
                <div style="background:#555;height:2px;border-radius:1px;margin:2px 0;width:65%;"></div>
            </div>
            <div style="flex:1;background:#fff;padding:5px;position:relative;overflow:hidden;">
                <div style="position:absolute;top:0;right:0;width:14px;height:20px;background:#b8860b;clip-path:polygon(0 0,100% 0,100% 100%);"></div>
                <div style="background:#1a1a1a;height:5px;border-radius:2px;margin-bottom:2px;width:70%;"></div>
                <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;width:90%;"></div>
                <div style="background:#b8860b;height:3px;border-radius:2px;margin:2px 0;width:50%;"></div>
                <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;width:80%;"></div>
            </div>
        </div>`;
    }
    if (id === 'samuel') {
        return `<div style="height:90px;display:flex;background:#fff;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:38%;background:#1a1a1a;padding:5px;">
                <div style="width:18px;height:20px;border-radius:3px;background:#c9a87c;margin:0 auto 3px;"></div>
                <div style="background:#f5c842;height:4px;border-radius:2px;margin:2px 0;"></div>
                <div style="background:#333;height:4px;border-radius:2px;margin:2px 0;overflow:hidden;"><div style="width:75%;height:100%;background:#f5c842;"></div></div>
                <div style="background:#333;height:4px;border-radius:2px;margin:2px 0;overflow:hidden;"><div style="width:55%;height:100%;background:#f5c842;"></div></div>
            </div>
            <div style="flex:1;padding:5px;">
                <div style="background:#f5c842;height:6px;border-radius:2px;margin-bottom:3px;width:75%;"></div>
                <div style="display:flex;gap:2px;margin-bottom:3px;align-items:center;"><div style="width:8px;height:8px;background:#f5c842;border-radius:50%;"></div><div style="background:#d1d5db;height:3px;border-radius:2px;flex:1;"></div></div>
                <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;width:85%;"></div>
                <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;width:70%;"></div>
            </div>
        </div>`;
    }
    if (id === 'alexander') {
        return `<div style="height:90px;background:#fff;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="background:#1e3a5f;height:22px;padding:4px 5px;display:flex;align-items:center;gap:3px;">
                <div style="background:#fff;height:4px;border-radius:2px;width:50%;"></div>
                <div style="background:#f59e0b;width:5px;height:5px;border-radius:50%;margin-left:auto;"></div>
            </div>
            <div style="display:flex;padding:4px;gap:4px;">
                <div style="flex:1;border-left:2px solid #e5e7eb;padding-left:4px;">
                    <div style="background:#1e3a5f;height:3px;border-radius:2px;margin-bottom:3px;width:60%;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:90%;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:75%;"></div>
                    <div style="background:#1e3a5f;height:3px;border-radius:2px;margin:4px 0 2px;width:50%;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                </div>
                <div style="width:32%;background:#f8fafc;padding:3px;border-left:1px solid #e5e7eb;">
                    <div style="background:#1e3a5f;height:3px;border-radius:2px;margin-bottom:2px;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
                </div>
            </div>
        </div>`;
    }
    if (id === 'minimal') {
        return `<div style="height:90px;display:flex;background:#fff;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:35%;background:#f8f8f8;padding:5px;border-right:2px solid #e5e7eb;">
                <div style="width:18px;height:18px;border-radius:50%;background:#d1d5db;margin-bottom:3px;"></div>
                <div style="background:#111;height:4px;border-radius:2px;margin-bottom:2px;width:80%;"></div>
                <div style="background:#111;height:2px;border-radius:1px;margin-bottom:4px;width:60%;"></div>
                <div style="background:#111;height:2px;border-radius:1px;margin:2px 0;width:100%;border-bottom:1px solid #111;"></div>
                <div style="background:#888;height:2px;border-radius:1px;margin:2px 0;width:90%;"></div>
                <div style="background:#888;height:2px;border-radius:1px;margin:2px 0;width:75%;"></div>
            </div>
            <div style="flex:1;padding:5px;">
                <div style="background:#111;height:2px;border-radius:1px;margin-bottom:3px;width:60%;border-bottom:1px solid #111;"></div>
                <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;"></div>
                <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;width:85%;"></div>
                <div style="background:#111;height:2px;border-radius:1px;margin:5px 0 2px;width:50%;"></div>
                <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;"></div>
                <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;width:70%;"></div>
            </div>
        </div>`;
    }
    if (id === 'traditional') {
        return `<div style="height:90px;background:#fff;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="background:#1e3a5f;height:24px;padding:4px 6px;display:flex;align-items:center;gap:3px;">
                <div style="width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,0.3);"></div>
                <div><div style="background:#fff;height:4px;border-radius:2px;width:50%;margin-bottom:2px;"></div><div style="background:rgba(255,255,255,0.5);height:2px;border-radius:1px;width:35%;"></div></div>
            </div>
            <div style="display:flex;padding:4px;gap:4px;">
                <div style="flex:1;">
                    <div style="background:#1e3a5f;height:3px;border-radius:2px;margin-bottom:3px;width:60%;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
                    <div style="background:#1e3a5f;height:3px;border-radius:2px;margin:4px 0 2px;width:50%;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                </div>
                <div style="width:32%;background:#f8fafc;padding:3px;border-left:1px solid #e5e7eb;">
                    <div style="background:#1e3a5f;height:3px;border-radius:2px;margin-bottom:2px;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
                </div>
            </div>
        </div>`;
    }
    if (id === 'narmatha-pro') {
        return `<div style="height:90px;display:flex;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:38%;background:#f0f0f0;padding:5px;">
                <div style="width:18px;height:18px;border-radius:3px;background:#c9a87c;margin-bottom:3px;"></div>
                <div style="background:#ccc;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
                <div style="background:#ccc;height:2px;border-radius:1px;margin:2px 0;width:60%;"></div>
                <div style="height:4px;background:#8b1c1c;border-radius:2px;margin:3px 0;width:70%;"></div>
                <div style="height:4px;background:#8b1c1c;border-radius:2px;margin:2px 0;width:55%;"></div>
            </div>
            <div style="flex:1;background:#3d1a1a;padding:5px;">
                <div style="background:#fff;height:5px;border-radius:2px;margin-bottom:2px;width:55%;"></div>
                <div style="background:#d97706;height:4px;border-radius:2px;margin:3px 0;width:70%;"></div>
                <div style="background:rgba(255,255,255,0.3);height:2px;border-radius:1px;margin:2px 0;width:85%;"></div>
                <div style="background:rgba(255,255,255,0.2);height:2px;border-radius:1px;margin:2px 0;width:65%;"></div>
            </div>
        </div>`;
    }
    if (id === 'donna') {
        return `<div style="height:90px;background:#fff;padding:5px;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;border-bottom:1px solid #f0f0f0;padding-bottom:3px;">
                <div style="width:16px;height:16px;border-radius:50%;background:#c9a87c;flex-shrink:0;"></div>
                <div style="background:#1a1a2e;height:4px;border-radius:2px;width:50%;"></div>
            </div>
            <div style="background:#d946ef;height:3px;border-radius:2px;margin-bottom:2px;width:40%;"></div>
            <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:2px 0;"></div>
            <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
            <div style="background:#d946ef;height:3px;border-radius:2px;margin:3px 0 2px;width:40%;"></div>
            <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:2px 0;"></div>
            <div style="display:flex;gap:2px;margin-top:3px;flex-wrap:wrap;">
                <div style="background:#fce7f3;height:5px;width:18px;border-radius:99px;"></div>
                <div style="background:#fce7f3;height:5px;width:14px;border-radius:99px;"></div>
                <div style="background:#fce7f3;height:5px;width:16px;border-radius:99px;"></div>
            </div>
        </div>`;
    }
    if (id === 'john-purple-left') {
        return `<div style="height:90px;display:flex;background:#fff;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:38%;padding:5px;box-shadow:2px 0 5px rgba(0,0,0,0.05);">
                <div style="width:16px;height:16px;border-radius:3px;background:#c9a87c;margin-bottom:3px;border:1px solid #7c3aed;"></div>
                <div style="background:#7c3aed;height:3px;border-radius:2px;margin:2px 0;width:75%;"></div>
                <div style="background:#7c3aed;height:3px;border-radius:2px;margin:2px 0;width:60%;"></div>
                <div style="background:#7c3aed;height:3px;border-radius:2px;margin:2px 0;width:65%;"></div>
                <div style="background:#f3f4f6;height:5px;border-radius:3px;margin:4px 0 2px;width:80%;"></div>
                <div style="background:#f3f4f6;height:5px;border-radius:3px;margin:2px 0;width:65%;"></div>
            </div>
            <div style="flex:1;padding:5px;">
                <div style="background:#1a1a2e;height:5px;border-radius:2px;margin-bottom:2px;width:75%;"></div>
                <div style="background:#7c3aed;height:2px;border-radius:1px;margin-bottom:3px;width:50%;"></div>
                <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
                <div style="background:#7c3aed;height:2px;border-radius:1px;margin:3px 0 2px;width:60%;"></div>
                <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
            </div>
        </div>`;
    }
    if (id === 'john-dark-teal') {
        return `<div style="height:90px;display:flex;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:38%;background:#1a2a2e;padding:5px;display:flex;flex-direction:column;align-items:center;">
                <div style="width:18px;height:18px;border-radius:50%;background:#c9a87c;margin-bottom:3px;border:1px solid #f59e0b;"></div>
                <div style="background:rgba(255,255,255,0.3);height:2px;border-radius:1px;margin:2px 0;width:70%;"></div>
                <div style="background:#f59e0b;height:2px;border-radius:1px;margin:3px 0 2px;width:65%;"></div>
                <div style="background:rgba(255,255,255,0.2);height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
                <div style="display:flex;gap:2px;margin-top:3px;">
                    <div style="width:5px;height:5px;border-radius:50%;background:#f59e0b;"></div>
                    <div style="width:5px;height:5px;border-radius:50%;background:#f59e0b;opacity:0.6;"></div>
                    <div style="width:5px;height:5px;border-radius:50%;background:#f59e0b;opacity:0.3;"></div>
                </div>
            </div>
            <div style="flex:1;background:#fff;padding:5px;">
                <div style="background:#1a1a2e;height:5px;border-radius:2px;margin-bottom:2px;width:75%;"></div>
                <div style="background:#2a7a8a;height:3px;border-radius:2px;margin:3px 0 2px;width:60%;"></div>
                <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
            </div>
        </div>`;
    }
    if (id === 'product-manager') {
        return `<div style="height:90px;background:#1a1a2e;overflow:hidden;border-radius:6px 6px 0 0;position:relative;">
            <div style="position:absolute;bottom:0;left:0;right:0;height:28px;background:#f59e0b;clip-path:ellipse(120% 100% at 50% 100%);"></div>
            <div style="padding:5px;display:flex;align-items:center;gap:5px;">
                <div style="width:18px;height:18px;border-radius:50%;background:#c9a87c;border:1px solid rgba(255,255,255,0.3);"></div>
                <div><div style="background:#fff;height:4px;border-radius:2px;width:40px;margin-bottom:2px;"></div><div style="background:rgba(255,255,255,0.3);height:2px;border-radius:1px;width:28px;"></div></div>
            </div>
            <div style="padding:3px 5px;">
                <div style="background:rgba(255,255,255,0.2);height:2px;border-radius:1px;margin:2px 0;width:50%;"></div>
                <div style="background:rgba(255,255,255,0.15);height:2px;border-radius:1px;margin:2px 0;width:75%;"></div>
                <div style="background:#f59e0b;height:3px;border-radius:2px;margin:3px 0;width:60%;"></div>
                <div style="background:#f59e0b;height:3px;border-radius:2px;margin:2px 0;width:48%;"></div>
            </div>
        </div>`;
    }
    if (id === 'botanica') {
        return `<div style="height:90px;background:#1a1a1a;overflow:hidden;border-radius:6px 6px 0 0;position:relative;">
            <div style="position:absolute;top:-5px;right:-5px;font-size:28px;opacity:0.1;">🌿</div>
            <div style="display:flex;gap:4px;padding:5px;">
                <div style="width:18px;height:18px;border-radius:50%;background:#c9a87c;border:1px solid #f59e0b;flex-shrink:0;"></div>
                <div style="flex:1;background:#2a2a2a;border-radius:3px;padding:3px 4px;">
                    <div style="background:#333;height:2px;border-radius:1px;margin:2px 0;"></div>
                    <div style="background:#333;height:2px;border-radius:1px;margin:2px 0;width:75%;"></div>
                </div>
            </div>
            <div style="display:flex;gap:3px;padding:2px 5px;">
                <div style="width:38%;background:#2a2a2a;border-radius:2px;padding:3px 4px;">
                    <div style="background:#f59e0b;height:2px;border-radius:1px;margin:2px 0;width:70%;"></div>
                    <div style="background:#333;height:2px;border-radius:1px;margin:2px 0;"></div>
                    <div style="background:#f59e0b;height:2px;border-radius:1px;margin:3px 0 2px;width:60%;"></div>
                    <div style="background:#333;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
                </div>
                <div style="flex:1;">
                    <div style="background:#f59e0b;height:3px;border-radius:2px;margin:2px 0;width:60%;"></div>
                    <div style="background:#333;height:2px;border-radius:1px;margin:2px 0;"></div>
                    <div style="background:#333;height:2px;border-radius:1px;margin:2px 0;width:70%;"></div>
                </div>
            </div>
        </div>`;
    }
    if (id === 'smith-orange') {
        return `<div style="height:90px;background:#fff;overflow:hidden;border-radius:6px 6px 0 0;position:relative;">
            <div style="height:3px;background:#f97316;"></div>
            <div style="display:flex;align-items:center;gap:4px;padding:4px 5px;border-bottom:1px solid #f0f0f0;">
                <div style="width:16px;height:16px;border-radius:50%;background:#c9a87c;border:1px solid #f97316;flex-shrink:0;"></div>
                <div><div style="background:#1a1a2e;height:4px;border-radius:2px;width:30px;margin-bottom:2px;"></div><div style="background:#d1d5db;height:2px;border-radius:1px;width:20px;"></div></div>
            </div>
            <div style="display:flex;gap:5px;padding:4px 5px;flex:1;">
                <div style="flex:1;"><div style="background:#f97316;height:3px;border-radius:2px;margin-bottom:3px;width:50%;"></div><div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div><div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:75%;"></div></div>
                <div style="flex:1;border-left:1px solid #f0f0f0;padding-left:4px;"><div style="background:#f97316;height:3px;border-radius:2px;margin-bottom:3px;width:50%;"></div><div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div></div>
            </div>
            <div style="position:absolute;bottom:0;left:0;right:0;height:18px;background:#f97316;display:flex;align-items:center;padding:0 5px;gap:8px;">
                <div style="background:rgba(255,255,255,0.4);height:2px;border-radius:1px;flex:1;"></div>
                <div style="background:rgba(255,255,255,0.4);height:2px;border-radius:1px;flex:1;"></div>
                <div style="background:rgba(255,255,255,0.4);height:2px;border-radius:1px;flex:1;"></div>
            </div>
        </div>`;
    }
    if (id === 'brian') {
        return `<div style="height:90px;background:#fff;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="background:linear-gradient(135deg,#0891b2,#0e7490);padding:5px 6px;display:flex;align-items:center;gap:4px;height:24px;">
                <div style="width:16px;height:16px;border-radius:3px;background:rgba(255,255,255,0.3);flex-shrink:0;"></div>
                <div><div style="background:#fff;height:4px;border-radius:2px;width:35px;"></div></div>
            </div>
            <div style="display:flex;padding:4px 5px;gap:5px;">
                <div style="width:40%;border-right:1px solid #f0f0f0;padding-right:4px;">
                    <div style="display:flex;gap:2px;align-items:center;margin-bottom:3px;"><div style="width:5px;height:5px;border-radius:50%;background:#0891b2;"></div><div style="background:#0891b2;height:2px;border-radius:1px;width:35px;"></div></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:70%;"></div>
                    <div style="display:flex;gap:2px;align-items:center;margin:4px 0 2px;"><div style="width:5px;height:5px;border-radius:50%;background:#0891b2;"></div><div style="background:#0891b2;height:2px;border-radius:1px;width:28px;"></div></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                </div>
                <div style="flex:1;">
                    <div style="display:flex;gap:2px;align-items:center;margin-bottom:3px;"><div style="width:5px;height:5px;border-radius:50%;background:#0891b2;"></div><div style="background:#0891b2;height:2px;border-radius:1px;width:40px;"></div></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:65%;"></div>
                </div>
            </div>
        </div>`;
    }
    if (id === 'rudolf') {
        return `<div style="height:90px;display:flex;background:#1a0a2e;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:40%;padding:5px;display:flex;flex-direction:column;align-items:center;border-right:2px solid #a855f7;">
                <div style="width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#c9a87c,#a07845);margin-bottom:3px;border:1px solid #a855f7;"></div>
                <div style="background:rgba(255,255,255,0.7);height:3px;border-radius:1px;margin:2px 0;width:65%;"></div>
                <div style="background:#a855f7;height:2px;border-radius:1px;margin:3px 0;width:70%;"></div>
                <div style="background:rgba(255,255,255,0.2);height:2px;border-radius:1px;margin:1px 0;width:55%;"></div>
            </div>
            <div style="flex:1;padding:5px;">
                <div style="background:#a855f7;height:2px;border-radius:1px;margin-bottom:2px;width:70%;"></div>
                <div style="background:rgba(255,255,255,0.2);height:2px;border-radius:1px;margin:2px 0;"></div>
                <div style="display:flex;gap:2px;flex-wrap:wrap;margin:3px 0;">
                    <div style="width:12px;height:5px;background:rgba(168,85,247,0.4);border:1px solid #a855f7;border-radius:2px;"></div>
                    <div style="width:10px;height:5px;background:rgba(168,85,247,0.4);border:1px solid #a855f7;border-radius:2px;"></div>
                </div>
                <div style="background:rgba(255,255,255,0.15);height:2px;border-radius:1px;margin:2px 0;width:85%;"></div>
                <div style="background:rgba(255,255,255,0.1);height:2px;border-radius:1px;margin:2px 0;width:70%;"></div>
            </div>
        </div>`;
    }
    if (id === 'emily') {
        return `<div style="height:90px;display:flex;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:40%;background:#e8e0d0;overflow:hidden;">
                <div style="height:38px;background:linear-gradient(135deg,#c9a87c,#a07845);"></div>
                <div style="padding:3px 5px;">
                    <div style="background:#1a1a2e;height:4px;border-radius:2px;margin-bottom:2px;width:70%;"></div>
                    <div style="background:#7c3aed;height:2px;border-radius:1px;margin:2px 0;width:50%;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:70%;"></div>
                </div>
            </div>
            <div style="flex:1;background:#fff;padding:5px;">
                <div style="background:#f59e0b;height:5px;border-radius:3px;margin-bottom:3px;width:22px;"></div>
                <div style="background:#888;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
                <div style="background:#1a1a2e;height:2px;border-radius:1px;margin:3px 0;width:60%;"></div>
                <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:75%;"></div>
                <div style="background:#1a1a2e;height:2px;border-radius:1px;margin:3px 0 2px;width:50%;"></div>
                <div style="display:flex;gap:2px;"><div style="width:12px;height:4px;background:#f0f0f8;border-radius:2px;"></div><div style="width:10px;height:4px;background:#f0f0f8;border-radius:2px;"></div></div>
            </div>
        </div>`;
    }
    if (id === 'kelly') {
        return `<div style="height:90px;display:flex;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:52%;padding:5px;background:#fff;">
                <div style="width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg,#c9a87c,#a07845);margin-bottom:3px;border:1px solid #f59e0b;"></div>
                <div style="background:#1a1a1a;height:4px;border-radius:1px;margin:2px 0;width:70%;"></div>
                <div style="background:#f59e0b;height:4px;border-radius:2px;margin:3px 0;width:80%;"></div>
                <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                <div style="background:#f59e0b;height:4px;border-radius:2px;margin:3px 0;width:70%;"></div>
            </div>
            <div style="width:48%;background:#1a1a1a;padding:5px;">
                <div style="background:#f59e0b;height:5px;border-radius:3px;margin-bottom:3px;width:28px;"></div>
                <div style="background:#f59e0b;height:3px;border-radius:2px;margin-bottom:3px;width:85%;"></div>
                <div style="margin-bottom:2px;"><div style="background:rgba(255,255,255,0.3);height:2px;border-radius:1px;margin-bottom:1px;width:60%;"></div><div style="background:#f59e0b;height:3px;border-radius:2px;width:65%;"></div></div>
                <div><div style="background:rgba(255,255,255,0.3);height:2px;border-radius:1px;margin-bottom:1px;width:50%;"></div><div style="background:#f59e0b;height:3px;border-radius:2px;width:55%;"></div></div>
            </div>
        </div>`;
    }
    if (id === 'suhail') {
        return `<div style="height:90px;background:#fff;overflow:hidden;border-radius:6px 6px 0 0;position:relative;padding:5px;">
            <div style="position:absolute;top:-5px;right:-5px;width:20px;height:20px;background:#f97316;opacity:0.7;transform:rotate(45deg);"></div>
            <div style="font-size:6px;font-weight:900;color:#f97316;border-bottom:1.5px solid #f97316;padding-bottom:2px;margin-bottom:3px;">Mohd Suhail</div>
            <div style="display:flex;gap:4px;">
                <div style="flex:1;">
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:75%;"></div>
                    <div style="display:flex;gap:2px;margin:3px 0;">
                        <div style="width:8px;height:8px;background:#fef3c7;border-radius:50%;"></div>
                        <div style="width:8px;height:8px;background:#dbeafe;border-radius:50%;"></div>
                        <div style="width:8px;height:8px;background:#fce7f3;border-radius:50%;"></div>
                    </div>
                </div>
                <div style="flex:1;">
                    <div style="background:#f97316;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:65%;"></div>
                    <div style="background:#f97316;height:2px;border-radius:1px;margin:3px 0 2px;width:70%;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                </div>
            </div>
        </div>`;
    }
    if (id === 'ricktang') {
        return `<div style="height:90px;background:#f0f4f8;overflow:hidden;border-radius:6px 6px 0 0;position:relative;padding:5px;">
            <div style="position:absolute;top:-10px;right:-10px;width:30px;height:30px;border-radius:50%;background:#a5b4fc;opacity:0.5;"></div>
            <div style="background:#1e3a5f;height:6px;border-radius:2px;margin-bottom:1px;width:55%;"></div>
            <div style="background:#6b7280;height:2px;border-radius:1px;margin-bottom:3px;width:38%;"></div>
            <div style="display:flex;gap:4px;">
                <div style="flex:1.5;">
                    <div style="background:#1e3a5f;height:2px;border-radius:1px;margin:2px 0;width:70%;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
                    <div style="background:#1e3a5f;height:2px;border-radius:1px;margin:3px 0 2px;width:55%;"></div>
                </div>
                <div style="flex:0.9;">
                    <div style="background:#1e3a5f;height:2px;border-radius:1px;margin:2px 0;width:65%;"></div>
                    <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                    <div style="background:#3b82f6;height:2px;border-radius:1px;margin:3px 0 2px;width:50%;"></div>
                    <div style="background:#3b82f6;height:2px;border-radius:1px;margin:2px 0;width:40%;"></div>
                </div>
            </div>
        </div>`;
    }
    if (id === 'dark-pro') {
        return `<div style="height:90px;background:#111;overflow:hidden;border-radius:6px 6px 0 0;display:flex;">
            <div style="width:36%;background:#1e1e1e;display:flex;align-items:center;justify-content:center;padding:5px;">
                <div style="width:40px;height:52px;background:linear-gradient(135deg,#c9a87c,#a07845);border-radius:3px;opacity:0.8;"></div>
            </div>
            <div style="flex:1;padding:5px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <div style="background:#fff;height:6px;border-radius:2px;width:55%;"></div>
                    <div style="background:#f59e0b;height:6px;border-radius:3px;width:18px;"></div>
                </div>
                <div style="background:rgba(255,255,255,0.1);height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
                <div style="display:flex;gap:3px;margin:3px 0;">
                    <div style="width:18px;height:5px;background:#1e1e1e;border:1px solid #333;border-radius:2px;"></div>
                    <div style="width:22px;height:5px;background:#1e1e1e;border:1px solid #333;border-radius:2px;"></div>
                </div>
                <div style="display:flex;gap:3px;margin:3px 0;">
                    <div style="flex:1;background:#1e1e1e;border:1px solid #2a2a2a;border-radius:3px;height:18px;padding:2px 3px;">
                        <div style="display:flex;gap:2px;"><div style="width:8px;height:8px;background:#f97316;border-radius:1px;"></div><div style="width:8px;height:8px;background:#3b82f6;border-radius:1px;"></div><div style="width:8px;height:8px;background:#a855f7;border-radius:1px;"></div></div>
                    </div>
                    <div style="flex:1;background:#1e1e1e;border:1px solid #2a2a2a;border-radius:3px;height:18px;padding:3px;">
                        <div style="background:#2a2a2a;height:2px;border-radius:1px;margin:2px 0;"></div>
                        <div style="background:#2a2a2a;height:2px;border-radius:1px;margin:2px 0;width:70%;"></div>
                    </div>
                </div>
            </div>
        </div>`;
    }
    if (id === 'john-green-sidebar') {
        return `<div style="height:90px;display:flex;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:36%;background:#1a4a2a;padding:5px;display:flex;flex-direction:column;align-items:center;">
                <div style="width:18px;height:18px;border-radius:50%;background:#c9a87c;margin-bottom:3px;border:1px solid rgba(255,255,255,0.3);"></div>
                <div style="background:rgba(255,255,255,0.3);height:2px;border-radius:1px;margin:2px 0;width:70%;"></div>
                <div style="background:#4ade80;height:2px;border-radius:1px;margin:2px 0;width:55%;"></div>
                <div style="background:rgba(255,255,255,0.2);height:2px;border-radius:1px;margin:2px 0;width:65%;"></div>
                <div style="background:rgba(255,255,255,0.2);height:2px;border-radius:1px;margin:2px 0;width:60%;"></div>
            </div>
            <div style="flex:1;background:#fff;padding:5px;">
                <div style="background:#1a1a2e;height:5px;border-radius:2px;margin-bottom:2px;width:75%;"></div>
                <div style="background:#1a4a2a;height:3px;border-radius:2px;margin:3px 0 2px;width:55%;"></div>
                <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;"></div>
                <div style="background:#d1d5db;height:2px;border-radius:1px;margin:2px 0;width:80%;"></div>
            </div>
        </div>`;
    }
    // mary
    if (id === 'hani') {
        return `<div style="height:90px;display:flex;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:36%;background:#2c2c3e;padding:5px;display:flex;flex-direction:column;align-items:center;">
                <div style="width:18px;height:18px;border-radius:50%;background:#c9a87c;margin-bottom:3px;"></div>
                <div style="background:rgba(255,255,255,0.5);height:3px;border-radius:2px;margin:1px 0;width:80%;"></div>
                <div style="background:rgba(255,255,255,0.2);height:2px;border-radius:1px;margin:1px 0;width:70%;"></div>
                <div style="background:rgba(255,255,255,0.2);height:2px;border-radius:1px;margin:1px 0;width:60%;"></div>
                <div style="background:#6c3fc9;height:2px;border-radius:1px;margin:2px 0;width:75%;"></div>
                <div style="background:rgba(255,255,255,0.15);height:2px;border-radius:1px;margin:1px 0;width:80%;"></div>
            </div>
            <div style="flex:1;background:#fff;padding:5px;">
                <div style="border-left:2px solid #6c3fc9;padding-left:3px;margin-bottom:2px;"><div style="background:#1a1a2e;height:3px;border-radius:1px;width:60%;"></div></div>
                <div style="background:#f9f9ff;padding:2px 3px;border-left:2px solid #6c3fc9;margin:2px 0;"><div style="background:#d1d5db;height:2px;border-radius:1px;"></div></div>
                <div style="border-left:2px solid #6c3fc9;padding-left:3px;margin-bottom:2px;margin-top:3px;"><div style="background:#1a1a2e;height:3px;border-radius:1px;width:55%;"></div></div>
                <div style="background:#f9f9ff;padding:2px 3px;border-left:2px solid #6c3fc9;margin:2px 0;"><div style="background:#d1d5db;height:2px;border-radius:1px;"></div><div style="background:#d1d5db;height:2px;border-radius:1px;margin-top:1px;width:80%;"></div></div>
            </div>
        </div>`;
    }
    if (id === 'narmatha2') {
        return `<div style="height:90px;display:flex;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:36%;background:#f5f5f5;padding:5px;">
                <div style="width:16px;height:16px;border-radius:2px;background:#c9a87c;margin-bottom:3px;"></div>
                <div style="background:#d1d5db;height:2px;border-radius:1px;margin:1.5px 0;width:80%;"></div>
                <div style="background:#d1d5db;height:2px;border-radius:1px;margin:1.5px 0;width:65%;"></div>
                <div style="display:flex;align-items:center;gap:2px;margin:2px 0;"><div style="width:4px;height:4px;border-radius:50%;background:#8b1c1c;"></div><div style="background:#d1d5db;height:2px;border-radius:1px;flex:1;"></div></div>
                <div style="display:flex;align-items:center;gap:2px;margin:2px 0;"><div style="width:4px;height:4px;border-radius:50%;background:#8b1c1c;"></div><div style="background:#d1d5db;height:2px;border-radius:1px;flex:1;width:70%;"></div></div>
            </div>
            <div style="flex:1;background:#8b1c1c;padding:5px;">
                <div style="background:rgba(255,255,255,0.6);height:5px;border-radius:2px;margin-bottom:2px;width:60%;"></div>
                <div style="background:rgba(255,255,255,0.3);height:2px;border-radius:1px;margin-bottom:3px;width:80%;"></div>
                <div style="background:#d97706;height:5px;border-radius:2px;margin:2px 0;"></div>
                <div style="background:rgba(255,255,255,0.25);height:2px;border-radius:1px;margin:1.5px 0;"></div>
                <div style="background:rgba(255,255,255,0.25);height:2px;border-radius:1px;margin:1.5px 0;width:75%;"></div>
                <div style="background:#d97706;height:5px;border-radius:2px;margin:2px 0;"></div>
            </div>
        </div>`;
    }
    if (id === 'guy-hawkins') {
        return `<div style="height:90px;display:flex;background:#fff;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:36%;padding:5px;border-right:1px solid #e5e7eb;">
                <div style="width:20px;height:20px;background:#c9a87c;margin-bottom:3px;"></div>
                <div style="background:#1a1a2e;height:4px;border-radius:2px;margin-bottom:1px;width:80%;"></div>
                <div style="background:#9ca3af;height:2px;border-radius:1px;margin-bottom:3px;width:55%;"></div>
                <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;width:90%;"></div>
                <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;width:70%;"></div>
                <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;width:80%;"></div>
                <div style="background:#f59e0b;height:2px;border-radius:1px;margin:2px 0;width:60%;"></div>
            </div>
            <div style="flex:1;padding:5px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                    <div style="background:#1a1a2e;height:3px;border-radius:1px;width:55%;"></div>
                    <div style="background:#f59e0b;height:6px;border-radius:3px;width:16px;"></div>
                </div>
                <div style="background:#f9fafb;padding:2px 3px;border-radius:2px;margin:1.5px 0;"><div style="background:#d1d5db;height:2px;border-radius:1px;"></div><div style="background:#d1d5db;height:2px;border-radius:1px;margin-top:1px;width:70%;"></div></div>
                <div style="background:#1a1a2e;height:3px;border-radius:1px;margin:2px 0;width:50%;"></div>
                <div style="background:#f9fafb;padding:2px 3px;border-radius:2px;margin:1.5px 0;"><div style="background:#d1d5db;height:2px;border-radius:1px;"></div><div style="background:#d1d5db;height:2px;border-radius:1px;margin-top:1px;width:80%;"></div></div>
            </div>
        </div>`;
    }
    if (id === 'kate-bishop') {
        return `<div style="height:90px;background:#f8f9ff;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="background:#fff;padding:4px 6px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:4px;">
                <div style="width:16px;height:16px;border-radius:50%;background:#c9a87c;flex-shrink:0;"></div>
                <div>
                    <div style="background:#1a1a2e;height:4px;border-radius:2px;width:40px;margin-bottom:1px;"></div>
                    <div style="background:#6c3fc9;height:2px;border-radius:1px;width:28px;"></div>
                </div>
                <div style="background:#f59e0b;height:5px;border-radius:3px;width:16px;margin-left:auto;"></div>
            </div>
            <div style="display:flex;padding:3px 5px;gap:4px;">
                <div style="flex:1.2;">
                    <div style="border-bottom:1.5px solid #6c3fc9;margin-bottom:2px;"><div style="background:#1a1a2e;height:2px;border-radius:1px;width:55%;"></div></div>
                    <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;"></div>
                    <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;width:75%;"></div>
                    <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;"></div>
                    <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;width:80%;"></div>
                </div>
                <div style="width:38%;border-left:1px solid #e5e7eb;padding-left:4px;">
                    <div style="border-bottom:1.5px solid #6c3fc9;margin-bottom:2px;"><div style="background:#1a1a2e;height:2px;border-radius:1px;width:70%;"></div></div>
                    <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;"></div>
                    <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;width:65%;"></div>
                    <div style="display:flex;gap:1px;flex-wrap:wrap;margin-top:2px;"><div style="background:#d1d5db;height:5px;width:18px;border-radius:2px;"></div><div style="background:#d1d5db;height:5px;width:14px;border-radius:2px;"></div></div>
                </div>
            </div>
        </div>`;
    }
    if (id === 'smith-graphic') {
        return `<div style="height:90px;background:#fff;overflow:hidden;border-radius:6px 6px 0 0;display:flex;flex-direction:column;">
            <div style="padding:4px 6px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:4px;">
                <div style="width:16px;height:16px;border-radius:50%;background:#c9a87c;border:1.5px solid #f97316;flex-shrink:0;"></div>
                <div>
                    <div style="background:#1a1a2e;height:4px;border-radius:2px;width:28px;margin-bottom:1px;"></div>
                    <div style="background:#f97316;height:2px;border-radius:1px;width:20px;"></div>
                </div>
                <div style="background:#f59e0b;height:5px;border-radius:3px;width:16px;margin-left:auto;"></div>
            </div>
            <div style="display:flex;flex:1;padding:3px 5px;gap:4px;">
                <div style="flex:1;"><div style="background:#f97316;height:3px;border-radius:1px;margin-bottom:2px;width:60%;"></div><div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1px 0;"></div><div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1px 0;width:80%;"></div><div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1px 0;width:70%;"></div></div>
                <div style="flex:1;border-left:1px solid #f0f0f0;padding-left:4px;"><div style="background:#f97316;height:3px;border-radius:1px;margin-bottom:2px;width:55%;"></div><div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1px 0;"></div><div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1px 0;width:75%;"></div></div>
            </div>
            <div style="background:#f97316;display:flex;height:16px;">
                <div style="flex:1;border-right:1px solid rgba(255,255,255,0.3);padding:2px 4px;"><div style="background:rgba(255,255,255,0.7);height:2px;border-radius:1px;margin:1px 0;width:80%;"></div><div style="background:rgba(255,255,255,0.4);height:2px;border-radius:1px;width:60%;"></div></div>
                <div style="flex:1;border-right:1px solid rgba(255,255,255,0.3);padding:2px 4px;"><div style="background:rgba(255,255,255,0.7);height:2px;border-radius:1px;margin:1px 0;width:70%;"></div><div style="background:rgba(255,255,255,0.4);height:2px;border-radius:1px;width:50%;"></div></div>
                <div style="flex:1;padding:2px 4px;"><div style="background:rgba(255,255,255,0.7);height:2px;border-radius:1px;margin:1px 0;width:75%;"></div><div style="background:rgba(255,255,255,0.4);height:2px;border-radius:1px;width:55%;"></div></div>
            </div>
        </div>`;
    }
    // ── Template1–31: image-based mini previews ──
    const imgTplColors = {
        'template1':  '#4b1fa8', 'template2':  '#6b7280', 'template3':  '#d97706',
        'template4':  '#f59e0b', 'template5':  '#1a1a2e', 'template6':  '#7c3aed',
        'template7':  '#0f766e', 'template8':  '#f97316', 'template9':  '#166534',
        'template10': '#f59e0b', 'template11': '#4b1fa8', 'template12': '#f43f5e',
        'template13': '#7c3aed', 'template14': '#1e3a5f', 'template15': '#374151',
        'template16': '#3d5a3e', 'template17': '#c084fc', 'template18': '#0284c7',
        'template19': '#a78bfa', 'template20': '#0284c7', 'template21': '#1e3a5f',
        'template22': '#166534', 'template23': '#f97316', 'template24': '#4d7c0f',
        'template25': '#06b6d4', 'template26': '#f59e0b', 'template27': '#1e3a5f',
        'template28': '#f43f5e', 'template29': '#0d9488', 'template30': '#475569',
        'template31': '#4f46e5',
        'template32': '#1a2a4a', 'template33': '#1a3a4a', 'template34': '#1e2d40',
        'template35': '#1d3557', 'template36': '#2d4a3e', 'template37': '#374151',
        'template38': '#2d3f6c',
        'template39': '#3a3a3a', 'template40': '#3d4d8a', 'template41': '#1d3557',
        'template42': '#1d3557', 'template43': '#2d2d2d', 'template44': '#2563eb',
        'template45': '#c9a065',
        'template46': '#1a5f5a', 'template47': '#1a5fb4', 'template48': '#00b3c6',
        'template49': '#2563eb', 'template50': '#2d3748', 'template51': '#1a1a2e',
        'template52': '#1a1a2e',
    };
    // Template 45: custom parchment warm 2-col mini preview matching the real resume-t45 design
    if (id === 'template45') {
        return `<div style="height:90px;background:#faf8f4;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="padding:5px 6px;display:flex;align-items:flex-start;gap:5px;">
                <div style="width:20px;height:20px;border-radius:50%;background:#c9b99a;border:1.5px solid #d4c9b0;flex-shrink:0;"></div>
                <div>
                    <div style="background:#c9a065;height:2px;border-radius:1px;width:30px;margin-bottom:2px;opacity:0.7;"></div>
                    <div style="background:#1a1a1a;height:4px;border-radius:2px;width:50px;margin-bottom:1px;"></div>
                </div>
            </div>
            <div style="height:1px;background:#ddd5c0;margin:0 5px;"></div>
            <div style="display:flex;padding:4px 5px;gap:4px;">
                <div style="width:38%;border-right:1px solid #ddd5c0;padding-right:4px;">
                    <div style="background:#c9a065;height:2px;border-radius:1px;margin-bottom:3px;width:70%;opacity:0.7;"></div>
                    <div style="background:#555;height:2px;border-radius:1px;margin:1.5px 0;width:90%;opacity:0.5;"></div>
                    <div style="background:#555;height:2px;border-radius:1px;margin:1.5px 0;width:80%;opacity:0.4;"></div>
                    <div style="background:#555;height:2px;border-radius:1px;margin:1.5px 0;width:85%;opacity:0.4;"></div>
                    <div style="background:#c9a065;height:2px;border-radius:1px;margin:3px 0 2px;width:65%;opacity:0.6;"></div>
                    <div style="background:#555;height:1.5px;border-radius:1px;margin:1.5px 0;width:80%;opacity:0.35;"></div>
                    <div style="background:#555;height:1.5px;border-radius:1px;margin:1.5px 0;width:70%;opacity:0.35;"></div>
                </div>
                <div style="flex:1;padding-left:3px;">
                    <div style="background:#c9a065;height:2px;border-radius:1px;margin-bottom:3px;width:75%;opacity:0.7;"></div>
                    <div style="background:#333;height:2px;border-radius:1px;margin:1.5px 0;opacity:0.5;"></div>
                    <div style="background:#333;height:2px;border-radius:1px;margin:1.5px 0;width:85%;opacity:0.4;"></div>
                    <div style="background:#c9a065;height:2px;border-radius:1px;margin:3px 0 2px;width:70%;opacity:0.6;"></div>
                    <div style="background:#333;height:2px;border-radius:1px;margin:1.5px 0;opacity:0.4;"></div>
                    <div style="background:#333;height:2px;border-radius:1px;margin:1.5px 0;width:80%;opacity:0.4;"></div>
                </div>
            </div>
        </div>`;
    }
    if (id in imgTplColors) {
        const c = imgTplColors[id];
        const num = parseInt(id.replace('template',''),10);
        const lightSidebar = [3,12,13,15,17,19,23,27,28,29,37,39,44,47,48,49,51,52].includes(num);
        const sbg = lightSidebar ? '#f5f5f5' : c;
        const stxt = lightSidebar ? c : 'rgba(255,255,255,0.7)';
        return `<div style="height:90px;display:flex;overflow:hidden;border-radius:6px 6px 0 0;">
            <div style="width:36%;background:${sbg};padding:5px;display:flex;flex-direction:column;align-items:center;">
                <div style="width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,0.4);border:2px solid ${c};margin-bottom:3px;"></div>
                <div style="background:${stxt};height:3px;border-radius:1px;margin:1.5px 0;width:80%;opacity:0.8;"></div>
                <div style="background:${stxt};height:2px;border-radius:1px;margin:1.5px 0;width:65%;opacity:0.5;"></div>
                <div style="background:${c};height:3px;border-radius:1px;margin:2px 0;width:75%;opacity:0.7;"></div>
                <div style="background:${stxt};height:2px;border-radius:1px;margin:1.5px 0;width:80%;opacity:0.4;"></div>
                <div style="background:${stxt};height:2px;border-radius:1px;margin:1.5px 0;width:60%;opacity:0.4;"></div>
            </div>
            <div style="flex:1;background:#fff;padding:5px;">
                <div style="background:${c};height:4px;border-radius:2px;margin-bottom:2px;width:70%;"></div>
                <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;"></div>
                <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;width:85%;"></div>
                <div style="background:${c};height:3px;border-radius:1px;margin:3px 0;width:50%;opacity:0.5;"></div>
                <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;width:90%;"></div>
                <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;width:75%;"></div>
                <div style="background:#e5e7eb;height:2px;border-radius:1px;margin:1.5px 0;width:80%;"></div>
            </div>
        </div>`;
    }

    return `<div style="height:90px;display:flex;background:#fff;overflow:hidden;border-radius:6px 6px 0 0;">
        <div style="width:36%;padding:5px;border-right:1px solid #f3f4f6;">
            <div style="width:24px;height:24px;border-radius:4px;background:#b0c4ba;margin-bottom:4px;"></div>
            <div style="height:4px;background:#2daf7f;border-radius:2px;margin-bottom:4px;width:100%;"></div>
            <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;width:80%;"></div>
            <div style="background:#2daf7f;height:3px;border-radius:2px;margin:2px 0;width:50%;"></div>
            <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;width:65%;"></div>
        </div>
        <div style="flex:1;padding:5px;">
            <div style="background:#1a1a2e;height:5px;border-radius:2px;margin-bottom:2px;width:75%;"></div>
            <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;"></div>
            <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;width:85%;"></div>
            <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;"></div>
            <div style="background:#d1d5db;height:3px;border-radius:2px;margin:2px 0;width:70%;"></div>
        </div>
    </div>`;
}

function changeTemplate(name) {
    currentTemplate = normalizeReviewTemplate(name);
    reviewRecoveryAttempts = 0;
    // Update colour default per template
    const colorMap = {
        robert:      '#7a1e28',
        olivia:      '#2daf7f',
        mary:        '#2daf7f',
        tanya:       '#b8860b',
        samuel:      '#f5c842',
        alexander:   '#1e3a5f',
        minimal:     '#111111',
        traditional: '#1e3a5f',
        'narmatha-pro':       '#3d1a1a',
        'donna':              '#d946ef',
        'john-purple-left':   '#7c3aed',
        'john-dark-teal':     '#1a2a2e',
        'john-green-sidebar': '#1a4a2a',
        'product-manager':    '#f59e0b',
        'botanica':           '#f59e0b',
        'smith-orange':       '#f97316',
        'brian':              '#0891b2',
        'dark-pro':           '#f59e0b',
        'rudolf':             '#a855f7',
        'emily':              '#7c3aed',
        'kelly':              '#f59e0b',
        'suhail':             '#f97316',
        'ricktang':           '#1e3a5f',
        'hani':               '#6c3fc9',
        'narmatha2':          '#8b1c1c',
        'guy-hawkins':        '#1a1a2e',
        'kate-bishop':        '#6c3fc9',
        'smith-graphic':      '#f97316',
        // template1–template31
        'template1':  '#4b1fa8',
        'template2':  '#6b7280',
        'template3':  '#d97706',
        'template4':  '#f59e0b',
        'template5':  '#1a1a2e',
        'template6':  '#7c3aed',
        'template7':  '#0f766e',
        'template8':  '#f97316',
        'template9':  '#166534',
        'template10': '#f59e0b',
        'template11': '#4b1fa8',
        'template12': '#f43f5e',
        'template13': '#7c3aed',
        'template14': '#1e3a5f',
        'template15': '#1a1a2e',
        'template16': '#3d5a3e',
        'template17': '#c084fc',
        'template18': '#0284c7',
        'template19': '#a78bfa',
        'template20': '#0284c7',
        'template21': '#1e3a5f',
        'template22': '#166534',
        'template23': '#f97316',
        'template24': '#4d7c0f',
        'template25': '#06b6d4',
        'template26': '#f59e0b',
        'template27': '#1e3a5f',
        'template28': '#f43f5e',
        'template29': '#0d9488',
        'template30': '#475569',
        'template31': '#4f46e5',
        'template32': '#1a2a4a',
        'template33': '#1a3a4a',
        'template34': '#1e2d40',
        'template35': '#1d3557',
        'template36': '#2d4a3e',
        'template37': '#374151',
        'template38': '#2d3f6c',
        'template39': '#00bcd4',
        'template40': '#3d4d8a',
        'template41': '#1d3557',
        'template42': '#1d3557',
        'template43': '#2d2d2d',
        'template44': '#2563eb',
        'template45': '#c9a065',
        'template46': '#1a5f5a',
        'template47': '#1a5fb4',
        'template48': '#00b3c6',
        'template49': '#2563eb',
        'template50': '#2d3748',
        'template51': '#1a1a2e',
        'template52': '#1a1a2e',
    };
    currentColor = colorMap[name] || '#2daf7f';
    document.querySelectorAll('.tmpl-thumb').forEach(t => t.classList.remove('selected'));
    const el = document.getElementById('tgrid-' + name);
    if (el) el.classList.add('selected');
    // Sync color swatch UI
    document.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.toggle('active', s.style.background === currentColor ||
            s.dataset.color === currentColor);
    });
    renderResume();
    autosaveDesign();
}

// ============================================================
// COLOR SWATCHES
// ============================================================
function buildColorSwatches() {
    const colors = [
        '#7a1e28','#6c3fc9','#2563eb','#0891b2','#2daf7f',
        '#dc2626','#d97706','#db2777','#374151','#1e293b'
    ];
    const container = document.getElementById('colorSwatches');
    if (!container) return;
    container.innerHTML = '';
    colors.forEach(c => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch' + (c === currentColor ? ' active' : '');
        sw.style.background = c;
        sw.onclick = () => {
            // Color themes available to ALL plans
            currentColor = c;
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
            renderResume();
            autosaveDesign();
        };
        container.appendChild(sw);
    });
}

// ============================================================
// DESIGN CONTROLS
// Colors = ALL plans | Font/Spacing = Premium only
// ============================================================
function isPremium() { return userPlan === 'PREMIUM'; }

function setFontSize(size) {
    if (!isPremium()) { showPremiumUpgradeAlert('Font Size'); return; }
    currentFontSize = size;
    document.querySelectorAll('.fsz-btn').forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    const doc = document.getElementById('resumeDoc');
    if (doc) doc.style.fontSize = size === 'small' ? '11px' : size === 'large' ? '15px' : '13px';
    autosaveDesign();
}
function applyFont(font) {
    if (!isPremium()) { showPremiumUpgradeAlert('Font Family'); return; }
    currentFont = font;
    const doc = document.getElementById('resumeDoc');
    if (doc) doc.style.fontFamily = font + ', sans-serif';
    autosaveDesign();
}
function applySectionSpacing(val) {
    if (!isPremium()) { showPremiumUpgradeAlert('Section Spacing'); return; }
    currentSectionSpacing = val;
    const el = document.getElementById('spacingVal');
    if (el) el.textContent = val + 'px';
    document.querySelectorAll('.section-block').forEach(e => { e.style.marginBottom = val + 'px'; });
    autosaveDesign();
}
function applyLetterSpacing(val) {
    if (!isPremium()) { showPremiumUpgradeAlert('Letter Spacing'); return; }
    currentLetterSpacing = val;
    const el = document.getElementById('letterVal');
    if (el) el.textContent = val + 'px';
    const doc = document.getElementById('resumeDoc');
    if (doc) doc.style.letterSpacing = val + 'px';
    autosaveDesign();
}
function applyLineSpacing(val) {
    if (!isPremium()) { showPremiumUpgradeAlert('Line Spacing'); return; }
    currentLineSpacing = val;
    const el = document.getElementById('lineVal');
    if (el) el.textContent = val;
    const doc = document.getElementById('resumeDoc');
    if (doc) doc.style.lineHeight = val;
    autosaveDesign();
}
function applyPhotoSize(val) {
    if (!isPremium()) { showPremiumUpgradeAlert('Photo Size'); return; }
    currentPhotoSize = parseInt(val);
    const el = document.getElementById('photoSizeVal');
    if (el) el.textContent = val + 'px';
    renderResume();
    autosaveDesign();
}
// ============================================================
// PLAN BADGE — shows current plan in sidebar
// ============================================================
function updatePlanBadge() {
    const bar   = document.getElementById('planBadgeBar');
    const label = document.getElementById('planBadgeLabel');
    const link  = document.getElementById('planUpgradeLink');
    if (!bar || !label) return;

    if (!isLoggedIn) {
        label.textContent = 'Free Plan';
        bar.className = 'plan-badge-bar';
        if (link) { link.textContent = 'Upgrade ↗'; link.href = '/pricing'; }
        return;
    }

    if (userPlan === 'PRO') {
        label.textContent = '🛡️ Pro Plan';
        bar.className = 'plan-badge-bar plan-pro';
        if (link) { link.textContent = 'Go Premium ↗'; link.href = '/pricing'; }
    } else if (userPlan === 'PREMIUM') {
        label.textContent = '🏆 Premium Plan';
        bar.className = 'plan-badge-bar plan-premium';
        if (link) link.style.display = 'none';
    } else {
        label.textContent = 'Free Plan';
        bar.className = 'plan-badge-bar';
        if (link) { link.textContent = 'Upgrade ↗'; link.href = '/pricing'; }
    }
}

// ============================================================
// INIT DESIGN LOCKS
// Colors = ALL plans (Free, Pro, Premium)
// Font, Spacing, Line/Letter spacing, Photo size = Premium only
// ============================================================
function initDesignLocks() {
    // Set data-plan on body so CSS handles lock overlays automatically
    document.body.setAttribute('data-plan', userPlan || 'FREE');

    // Color swatches: available to everyone — no lock needed
    // Premium-only controls: font, spacing, letter, line, photo
    // CSS handles showing/hiding overlays via body[data-plan] selector
    // Nothing extra needed in JS since CSS does the work
}

function showPremiumUpgradeAlert(feature) {
    if (resumeId) sessionStorage.setItem('pendingResumeId', resumeId);
    sessionStorage.setItem('upgradeFeature', feature);
    if (!isLoggedIn) {
        window.location.href = '/login?redirect=' + encodeURIComponent('/pricing?highlight=premium');
        return;
    }
    const existing = document.getElementById('premiumUpgradeModal');
    if (existing) existing.remove();
    const featureList = ['🎨 All color themes','🔤 8 Font families','📏 Font size control','↕ Section spacing','🔡 Letter spacing','📐 Line spacing','🖼 Photo size control','📄 All Pro templates','⬇ Unlimited downloads'];
    const modal = document.createElement('div');
    modal.id = 'premiumUpgradeModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:999999;padding:20px;';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:22px;padding:36px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.3);">
            <div style="width:64px;height:64px;background:linear-gradient(135deg,#7c3aed,#5b21b6);border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:30px;margin:0 auto 16px;">🏆</div>
            <h3 style="font-size:1.3rem;font-weight:800;color:#1a1a2e;margin:0 0 8px;">${feature} is Premium Only</h3>
            <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0 0 6px;">
                You're on <span style="background:#ede9fe;color:#7c3aed;font-weight:700;padding:1px 8px;border-radius:5px;">${userPlan || 'FREE'}</span> plan.
                Upgrade to <strong style="color:#7c3aed;">Premium</strong> to unlock all design controls.
            </p>
            <div style="background:#f9f5ff;border-radius:12px;padding:12px 16px;margin:16px 0 20px;text-align:left;">
                <div style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Premium includes:</div>
                ${featureList.map(f => `<div style="font-size:12px;color:#374151;padding:2px 0;display:flex;align-items:center;gap:7px;"><span style="color:#22c55e;">✓</span>${f}</div>`).join('')}
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="document.getElementById('premiumUpgradeModal').remove()"
                    style="flex:1;padding:11px;border:1.5px solid #e5e7eb;background:#fff;border-radius:11px;font-size:13px;font-weight:600;cursor:pointer;color:#374151;">
                    Maybe Later
                </button>
                <button onclick="goToPremiumPayment()"
                    style="flex:2;padding:11px;background:linear-gradient(135deg,#7c3aed,#5b21b6);border:none;border-radius:11px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;">
                    Upgrade to Premium →
                </button>
            </div>
            <p style="font-size:11px;color:#9ca3af;margin:10px 0 0;">🔒 Secure payment · Cancel anytime</p>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function goToPremiumPayment() {
    if (resumeId) sessionStorage.setItem('pendingResumeId', resumeId);
    window.location.href = '/payment?plan=PREMIUM';
}

function showUpgradeBanner(plan) {
    const existing = document.getElementById('upgradeBanner');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.id = 'upgradeBanner';
    const planLabel = plan === 'PREMIUM' ? '🏆 Premium' : '🛡️ Pro';
    banner.style.cssText = `position:fixed;top:70px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:14px 28px;border-radius:14px;font-weight:700;font-size:14px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.2);display:flex;align-items:center;gap:10px;`;
    banner.innerHTML = `<span style="font-size:20px;">🎉</span> Welcome to ${planLabel}! All features are now unlocked. <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.25);border:none;color:#fff;font-size:16px;cursor:pointer;padding:2px 8px;border-radius:8px;margin-left:8px;">✕</button>`;
    document.body.appendChild(banner);
    setTimeout(() => { if (banner.parentElement) banner.remove(); }, 6000);
}

function showPremiumAlert(feature) {
    if (confirm(`🔒 ${feature} requires a Pro or Premium plan.\n\nUpgrade now to unlock all features?`)) {
        if (resumeId) sessionStorage.setItem('pendingResumeId', resumeId);
        fetch('/api/auth/session').then(r => r.json()).then(data => {
            if (data.loggedIn) {
                window.location.href = '/payment?plan=PRO&redirect=' + encodeURIComponent(buildReviewReturnUrl(currentTemplate));
            } else {
                window.location.href = '/login?redirect=' + encodeURIComponent('/payment?plan=PRO&redirect=' + encodeURIComponent(buildReviewReturnUrl(currentTemplate)));
            }
        }).catch(() => {
            window.location.href = '/pricing';
        });
    }
}

// ============================================================
// SECTIONS TOGGLE
// ============================================================
function toggleSection(name, show) {
    activeSections[name] = show;
    renderResume();
}
function addCustomSection() {
    const inp = document.getElementById('customSectionName');
    const name = inp ? inp.value.trim() : '';
    if (!name) { showToast('Enter a section name.', 'error'); return; }
    activeSections[name] = true;
    renderResume();
    if (inp) inp.value = '';
    showToast('✓ Section added!');
    // Also add a checkbox for the new custom section so user can toggle it
    const list = document.getElementById('addSectionList');
    if (list && !document.getElementById('sec-check-' + name)) {
        const lbl = document.createElement('label');
        lbl.className = 'section-check';
        lbl.id = 'sec-check-' + name;
        lbl.innerHTML = `<input type="checkbox" checked onchange="toggleSection('${name}', this.checked)"> ${name}`;
        list.appendChild(lbl);
    }
    closeAllSidePanels();
}

// ============================================================
// RENDER RESUME
// ============================================================
function renderResume() {
    const doc = document.getElementById('resumeDoc');
    if (!doc) return;
    const renderSeq = ++reviewRenderSeq;
    delete doc.dataset.exactTemplate;
    doc.className = 'resume-doc template-' + currentTemplate;
    const shouldPreserveExactDesign = shouldUseExactGalleryTemplate(currentTemplate) && !!templatePageMarkup;
    if (shouldPreserveExactDesign) {
        doc.style.fontFamily = '';
        doc.style.letterSpacing = '';
        doc.style.lineHeight = '';
        doc.style.fontSize = '';
    } else {
        doc.style.fontFamily     = currentFont + ', sans-serif';
        doc.style.letterSpacing  = currentLetterSpacing + 'px';
        doc.style.lineHeight     = currentLineSpacing;
        doc.style.fontSize       = currentFontSize === 'small' ? '11px' : currentFontSize === 'large' ? '15px' : '13px';
    }

    let edu = [], skills = [], projects = [], experience = [];
    try { edu        = JSON.parse(resumeData.educationJson   || '[]'); } catch {}
    try { skills     = JSON.parse(resumeData.skillsJson      || '[]'); } catch {}
    try { projects   = JSON.parse(resumeData.projectsJson    || '[]'); } catch {}
    try { experience = JSON.parse(resumeData.experienceJson  || '[]'); } catch {}
    edu = edu.filter(e => e && (e.degree || e.school || e.university || e.field || e.year || e.cgpa));
    skills = skills.filter(s => {
        if (!s) return false;
        return typeof s === 'string' ? !!s.trim() : !!(s.name || s.skill || '').toString().trim();
    });
    projects = projects.filter(p => p && (p.title || p.name || p.description || p.tools));
    experience = experience.filter(e => e && (e.jobTitle || e.role || e.title || e.company || e.description || e.bullets));

    const ctx = { resumeData, edu, skills, projects, experience, color: currentColor };

    let exactRendered = false;
    try {
        exactRendered = renderExactGalleryTemplate(doc, ctx, currentTemplate);
    } catch (err) {
        console.warn('Exact gallery render failed, falling back to legacy renderer:', err);
        exactRendered = false;
        doc.innerHTML = '';
        delete doc.dataset.exactTemplate;
    }

    if (exactRendered) {
        if (isUsableRenderedResume(doc, ctx, true)) {
            finalizeRenderedResume(doc, ctx, { edu, skills, projects, experience, skipCleanup: true, renderSeq });
            return;
        }
        doc.innerHTML = '';
        delete doc.dataset.exactTemplate;
    }

    if (currentTemplate === 'robert') {
        doc.innerHTML = buildRobertTemplate(ctx);
    } else if (currentTemplate === 'mary') {
        doc.innerHTML = buildMaryTemplate(ctx);
    } else if (currentTemplate === 'tanya') {
        doc.innerHTML = buildTanyaTemplate(ctx);
    } else if (currentTemplate === 'samuel') {
        doc.innerHTML = buildSamuelTemplate(ctx);
    } else if (currentTemplate === 'alexander') {
        doc.innerHTML = buildAlexanderTemplate(ctx);
    } else if (currentTemplate === 'minimal') {
        doc.innerHTML = buildMinimalTemplate(ctx);
    } else if (currentTemplate === 'traditional') {
        doc.innerHTML = buildTraditionalTemplate(ctx);
    } else if (currentTemplate === 'john-orange') {
        doc.innerHTML = buildJohnOrangeTemplate(ctx);
    } else if (currentTemplate === 'john-purple') {
        doc.innerHTML = buildJohnPurpleTemplate(ctx);
    } else if (currentTemplate === 'alex-creative') {
        doc.innerHTML = buildAlexCreativeTemplate(ctx);
    } else if (currentTemplate === 'lacy') {
        doc.innerHTML = buildLacyTemplate(ctx);
    } else if (currentTemplate === 'marina') {
        doc.innerHTML = buildMarinaTemplate(ctx);
    } else if (currentTemplate === 'rick') {
        doc.innerHTML = buildRickTemplate(ctx);
    } else if (currentTemplate === 'caroline') {
        doc.innerHTML = buildCarolineTemplate(ctx);
    } else if (currentTemplate === 'narmatha') {
        doc.innerHTML = buildNarmathaTemplate(ctx);
    } else if (currentTemplate === 'john-blue') {
        doc.innerHTML = buildJohnBlueTemplate(ctx);
    } else if (currentTemplate === 'monica') {
        doc.innerHTML = buildMonicaTemplate(ctx);
    } else if (currentTemplate === 'narmatha-pro') {
        doc.innerHTML = buildNarmathaProTemplate(ctx);
    } else if (currentTemplate === 'donna') {
        doc.innerHTML = buildDonnaTemplate(ctx);
    } else if (currentTemplate === 'john-purple-left') {
        doc.innerHTML = buildJohnPurpleLeftTemplate(ctx);
    } else if (currentTemplate === 'john-dark-teal') {
        doc.innerHTML = buildJohnDarkTealTemplate(ctx);
    } else if (currentTemplate === 'john-green-sidebar') {
        doc.innerHTML = buildJohnGreenSidebarTemplate(ctx);
    } else if (currentTemplate === 'product-manager') {
        doc.innerHTML = buildProductManagerTemplate(ctx);
    } else if (currentTemplate === 'botanica') {
        doc.innerHTML = buildBotanicaTemplate(ctx);
    } else if (currentTemplate === 'smith-orange') {
        doc.innerHTML = buildSmithOrangeTemplate(ctx);
    } else if (currentTemplate === 'brian') {
        doc.innerHTML = buildBrianTemplate(ctx);
    } else if (currentTemplate === 'dark-pro') {
        doc.innerHTML = buildDarkProTemplate(ctx);
    } else if (currentTemplate === 'rudolf') {
        doc.innerHTML = buildRudolfTemplate(ctx);
    } else if (currentTemplate === 'emily') {
        doc.innerHTML = buildEmilyTemplate(ctx);
    } else if (currentTemplate === 'kelly') {
        doc.innerHTML = buildKellyTemplate(ctx);
    } else if (currentTemplate === 'suhail') {
        doc.innerHTML = buildSuhailTemplate(ctx);
    } else if (currentTemplate === 'ricktang') {
        doc.innerHTML = buildRickTangTemplate(ctx);
    } else if (currentTemplate === 'hani') {
        doc.innerHTML = buildHaniTemplate(ctx);
    } else if (currentTemplate === 'narmatha2') {
        doc.innerHTML = buildNarmatha2Template(ctx);
    } else if (currentTemplate === 'guy-hawkins') {
        doc.innerHTML = buildGuyHawkinsTemplate(ctx);
    } else if (currentTemplate === 'kate-bishop') {
        doc.innerHTML = buildKateBishopTemplate(ctx);
    } else if (currentTemplate === 'smith-graphic') {
        doc.innerHTML = buildSmithGraphicTemplate(ctx);
    } else if (currentTemplate === 'template44') {
        doc.innerHTML = buildTemplate44Template(ctx);
    } else if (currentTemplate === 'template45') {
        doc.innerHTML = buildTemplate45Template(ctx);
    } else if (currentTemplate === 'template46') {
        doc.innerHTML = buildTemplate46Template(ctx);
    } else if (currentTemplate === 'template47') {
        doc.innerHTML = buildTemplate47Template(ctx);
    } else if (currentTemplate === 'template48') {
        doc.innerHTML = buildTemplate48Template(ctx);
    } else if (currentTemplate === 'template49') {
        doc.innerHTML = buildTemplate49Template(ctx);
    } else if (currentTemplate === 'template50') {
        doc.innerHTML = buildTemplate50Template(ctx);
    } else if (currentTemplate === 'template51') {
        doc.innerHTML = buildTemplate51Template(ctx);
    } else if (currentTemplate === 'template52') {
        doc.innerHTML = buildTemplate52Template(ctx);
    } else if (currentTemplate === 'template1')  { doc.innerHTML = buildTemplate1Template(ctx);
    } else if (currentTemplate === 'template2')  { doc.innerHTML = buildTemplate2Template(ctx);
    } else if (currentTemplate === 'template3')  { doc.innerHTML = buildTemplate3Template(ctx);
    } else if (currentTemplate === 'template4')  { doc.innerHTML = buildTemplate4Template(ctx);
    } else if (currentTemplate === 'template5')  { doc.innerHTML = buildTemplate5Template(ctx);
    } else if (currentTemplate === 'template6')  { doc.innerHTML = buildTemplate6Template(ctx);
    } else if (currentTemplate === 'template7')  { doc.innerHTML = buildTemplate7Template(ctx);
    } else if (currentTemplate === 'template8')  { doc.innerHTML = buildTemplate8Template(ctx);
    } else if (currentTemplate === 'template9')  { doc.innerHTML = buildTemplate9Template(ctx);
    } else if (currentTemplate === 'template10') { doc.innerHTML = buildTemplate10Template(ctx);
    } else if (currentTemplate === 'template25') { doc.innerHTML = buildTemplate25Template(ctx);
    } else if (currentTemplate === 'template11') { doc.innerHTML = buildTemplate11Template(ctx);
    } else if (currentTemplate === 'template12') { doc.innerHTML = buildTemplate12Template(ctx);
    } else if (currentTemplate === 'template13') { doc.innerHTML = buildTemplate13Template(ctx);
    } else if (currentTemplate === 'template14') { doc.innerHTML = buildTemplate14Template(ctx);
    } else if (currentTemplate === 'template15') { doc.innerHTML = buildTemplate15Template(ctx);
    } else if (currentTemplate === 'template16') { doc.innerHTML = buildTemplate16Template(ctx);
    } else if (currentTemplate === 'template17') { doc.innerHTML = buildTemplate17ProperTemplate(ctx);
    } else if (currentTemplate === 'template18') { doc.innerHTML = buildTemplate18Template(ctx);
    } else if (currentTemplate === 'template19') { doc.innerHTML = buildTemplate19ProperTemplate(ctx);
    } else if (currentTemplate === 'template20') { doc.innerHTML = buildTemplate20Template(ctx);
    } else if (currentTemplate === 'template21') { doc.innerHTML = buildTemplate21Template(ctx);
    } else if (currentTemplate === 'template22') { doc.innerHTML = buildTemplate22ProperTemplate(ctx);
    } else if (currentTemplate === 'template23') { doc.innerHTML = buildTemplate23ProperTemplate(ctx);
    } else if (currentTemplate === 'template24') { doc.innerHTML = buildTemplate24Template(ctx);
    } else if (currentTemplate === 'template26') { doc.innerHTML = buildTemplate26Template(ctx);
    } else if (currentTemplate === 'template27') { doc.innerHTML = buildTemplate27Template(ctx);
    } else if (currentTemplate === 'template28') { doc.innerHTML = buildTemplate28ProperTemplate(ctx);
    } else if (currentTemplate === 'template29') { doc.innerHTML = buildTemplate29Template(ctx);
    } else if (currentTemplate === 'template30') { doc.innerHTML = buildTemplate30Template(ctx);
    } else if (currentTemplate === 'template31') { doc.innerHTML = buildTemplate31Template(ctx);
    } else if (currentTemplate === 'template32') { doc.innerHTML = buildTemplate32Template(ctx);
    } else if (currentTemplate === 'template33') { doc.innerHTML = buildTemplate33Template(ctx);
    } else if (currentTemplate === 'template34') { doc.innerHTML = buildTemplate34Template(ctx);
    } else if (currentTemplate === 'template35') { doc.innerHTML = buildTemplate35Template(ctx);
    } else if (currentTemplate === 'template36') { doc.innerHTML = buildTemplate36Template(ctx);
    } else if (currentTemplate === 'template37') { doc.innerHTML = buildTemplate37Template(ctx);
    } else if (currentTemplate === 'template38') { doc.innerHTML = buildTemplate38Template(ctx);
    } else if (currentTemplate === 'template39') { doc.innerHTML = buildTemplate39Template(ctx);
    } else if (currentTemplate === 'template40') { doc.innerHTML = buildTemplate40Template(ctx);
    } else if (currentTemplate === 'template41') { doc.innerHTML = buildTemplate41Template(ctx);
    } else if (currentTemplate === 'template42') { doc.innerHTML = buildTemplate42Template(ctx);
    } else if (currentTemplate === 'template43') { doc.innerHTML = buildTemplate43Template(ctx);
    } else if (currentTemplate.startsWith('template')) {
        doc.innerHTML = buildImageBasedTemplate(ctx, currentTemplate);
    } else {
        // default: olivia
        doc.innerHTML = buildOliviaTemplate(ctx);
    }

    finalizeRenderedResume(doc, ctx, { edu, skills, projects, experience, renderSeq });
}

function finalizeRenderedResume(doc, ctx, { edu, skills, projects, experience, skipCleanup = false, renderSeq = 0 }) {
    applyActiveSections();
    if (!skipCleanup) {
        cleanEmptyReviewContent(doc, { edu, skills, projects, experience });
    }
    // Inject edit buttons into ALL templates universally
    injectEditOverlays(ctx);
    if (doc && doc.dataset.exactTemplate === 'true') {
        setTimeout(() => bindExactTemplateLineClicks(), 60);
    } else {
        setTimeout(() => injectSectionToolbars(), 60);
        setTimeout(() => injectLineItemControls(), 90);
        setTimeout(() => bindExactTemplateLineClicks(), 120);
    }
    setTimeout(() => {
        if (renderSeq !== reviewRenderSeq || reviewRecoveryAttempts >= 2) return;
        const liveDoc = document.getElementById('resumeDoc');
        const isExact = liveDoc?.dataset.exactTemplate === 'true';
        if (isUsableRenderedResume(liveDoc, ctx, isExact)) return;
        reviewRecoveryAttempts += 1;
        renderResume();
    }, 1100);
}

function cleanEmptyReviewContent(doc, { edu = [], skills = [], projects = [], experience = [] } = {}) {
    if (!doc) return;
    const hasProfile = !!(resumeData.profileSummary || '').trim();
    const hasCerts = !!(resumeData.certifications || '').trim();
    const hasAwards = !!(resumeData.awards || '').trim();
    const hasLanguages = !!(resumeData.languages || '').trim();
    const hasInterests = !!(resumeData.interests || '').trim();
    const hasStandaloneTools = !!(resumeData.tools || '').trim();

    const sectionData = {
        'profile': hasProfile,
        'profile summary': hasProfile,
        'professional summary': hasProfile,
        'summary': hasProfile,
        'about me': hasProfile,
        'experience': experience.length > 0,
        'work experience': experience.length > 0,
        'career': experience.length > 0,
        'career / experience': experience.length > 0,
        'employment history': experience.length > 0,
        'education': edu.length > 0,
        'skills': skills.length > 0,
        'technical skills': skills.length > 0,
        'projects': projects.length > 0,
        'certifications': hasCerts,
        'certificates': hasCerts,
        'awards': hasAwards,
        'awards & honors': hasAwards,
        'languages': hasLanguages,
        'language': hasLanguages,
        'tools': hasStandaloneTools,
        'tool': hasStandaloneTools,
        'interests': hasInterests,
        'hobbies': hasInterests
    };

    const normalize = (text) => (text || '')
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/\b(edit|delete|click to add|add your|your name|job title|email example com|000 000 0000|your city)\b/gi, '')
        .replace(/[^a-z0-9&/ ]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    Array.from(doc.querySelectorAll('div,h2,h3,h4')).forEach(heading => {
        if (!heading.isConnected || heading.closest('.rv-stb')) return;
        const key = normalize(heading.textContent);
        if (!Object.prototype.hasOwnProperty.call(sectionData, key) || sectionData[key]) return;

        const removable = [];
        let sib = heading.nextElementSibling;
        while (sib && removable.length < 3) {
            const sibKey = normalize(sib.textContent);
            if (Object.prototype.hasOwnProperty.call(sectionData, sibKey)) break;
            removable.push(sib);
            if (sib.classList.contains('section-block') || sib.classList.contains('editable-field')) break;
            sib = sib.nextElementSibling;
        }
        removable.forEach(el => el.remove());
        heading.remove();
    });

    Array.from(doc.querySelectorAll('.editable-field')).forEach(el => {
        if (!el.isConnected) return;
        const text = normalize(el.textContent);
        if (!text) el.remove();
    });
}

// ============================================================
// TEMPLATE 25: CYAN BANNER — exact resume-t25 design
// ============================================================
function buildTemplate25Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#00b4db';
    const name    = d.fullName       || '';
    const title   = d.jobTitle       || '';
    const email   = d.email          || '';
    const phone   = d.phone          || '';
    const addr    = d.address || d.location || '';
    const linkedin= d.linkedin       || '';
    const website = d.website        || '';
    const summary = d.profileSummary || '';
    const initial = (name || 'B').charAt(0).toUpperCase();
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:70px;height:70px;border-radius:8px;object-fit:cover;border:2px solid rgba(255,255,255,.5);cursor:pointer;" class="editable-field t25-photo" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t25-photo editable-field" style="cursor:pointer;background:${accent}99;border-color:rgba(255,255,255,.5);" ${editBtn('profilePhoto','Profile Photo','')}>${initial}</div>`;
    const contactItems = [
        phone    && `<div class="t25-contact-item editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>`,
        email    && `<div class="t25-contact-item editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>`,
        addr     && `<div class="t25-contact-item editable-field" style="cursor:pointer;" ${editBtn('address','Address',addr)}>📍 ${addr} <span class="edit-pen">✏</span></div>`,
        linkedin && `<div class="t25-contact-item editable-field" style="cursor:pointer;" ${editBtn('linkedin','LinkedIn',linkedin)}>🔗 ${linkedin} <span class="edit-pen">✏</span></div>`,
        website  && `<div class="t25-contact-item editable-field" style="cursor:pointer;" ${editBtn('website','Website',website)}>🌐 ${website} <span class="edit-pen">✏</span></div>`,
    ].filter(Boolean).join('');
    const skillsHTML = skills.length
        ? skills.map(s=>`<div class="t25-skill"><div class="t25-skill-dot" style="background:${accent};"></div>${s.name||s}</div>`).join('')
        : `<div class="t25-skill" style="color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;
    const eduLeftHTML = edu.length
        ? edu.map(e=>`<div class="t25-text" style="margin-bottom:6px;"><strong>${e.degree||''}</strong><br/>${e.school||e.university||''}${e.year?' | '+e.year:''}</div>`).join('')
        : `<div class="t25-text" style="color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;
    const expHTML = experience.length
        ? experience.map(e=>`<div class="t25-job section-block" style="border-left-color:${accent};"><div class="t25-job-title editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${e.jobTitle||e.role||e.title||''} <span class="edit-pen">✏</span></div><div class="t25-job-co" style="color:${accent};">${e.company||''}</div><div class="t25-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div><div class="t25-job-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div></div>`).join('')
        : `<div class="t25-job" style="border-left-color:${accent};color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add work experience ✏</div>`;
    const projectsHTML = projects.length
        ? projects.map(p=>`<div class="t25-job" style="border-left-color:${accent};"><div class="t25-job-title">${p.title||p.name||''}</div>${p.tools?`<div class="t25-job-co" style="color:${accent};">Tools: ${p.tools}</div>`:''}<div class="t25-job-desc">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div></div>`).join('')
        : '';
    return `<div class="resume-t25">
  <div class="t25-header" style="background:${accent};">
    ${photoHTML}
    <div class="t25-header-info">
      <div class="t25-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen" style="font-size:12px;opacity:0.7;">✏</span></div>
      <div class="t25-role editable-field" style="cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen" style="font-size:11px;opacity:0.7;">✏</span></div>
    </div>
  </div>
  <div class="t25-dark-strip" style="flex-wrap:wrap;align-items:center;gap:6px 20px;">
    ${contactItems||`<div class="t25-contact-item" style="cursor:pointer;color:#9ca3af;" ${editBtn('phone','Phone','')}>Add contact info ✏</div>`}
  </div>
  <div class="t25-body">
    <div class="t25-bl">
      ${summary?`<div class="t25-sec-title section-block" style="color:${accent};">About Me</div><div class="t25-text editable-field" style="cursor:pointer;" ${editBtn('profileSummary','About Me',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
      <div class="t25-sec-title section-block" style="color:${accent};">Skills</div>
      <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skillsHTML}<span class="edit-pen" style="font-size:10px;color:#9ca3af;display:block;margin-top:4px;">✏</span></div>
      ${edu.length?`<div class="t25-sec-title section-block" style="color:${accent};">Education</div><div class="editable-field" style="cursor:pointer;" ${editBtn('educationJson','Education','')}>${eduLeftHTML}<span class="edit-pen" style="font-size:10px;color:#9ca3af;display:block;">✏</span></div>`:''}
      ${d.languages?`<div class="t25-sec-title section-block" style="color:${accent};">Languages</div><div class="editable-field" style="cursor:pointer;" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div class="t25-skill"><div class="t25-skill-dot" style="background:${accent};"></div>${l.trim()}</div>`).join('')}<span class="edit-pen" style="font-size:10px;color:#9ca3af;">✏</span></div>`:''}
    </div>
    <div class="t25-br">
      <div class="t25-sec-title section-block" id="rv-experience-section" style="color:${accent};">Job Experience</div>
      <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}<span class="edit-pen" style="font-size:10px;color:#9ca3af;display:block;margin-top:4px;">✏</span></div>
      ${projects.length?`<div class="t25-sec-title section-block" id="rv-projects-section" style="color:${accent};">Projects</div><div class="editable-field" ${editBtn('projectsJson','Projects','')}>${projectsHTML}<span class="edit-pen" style="font-size:10px;color:#9ca3af;display:block;">✏</span></div>`:''}
      ${d.certifications?`<div class="t25-sec-title section-block" style="color:${accent};">Certifications</div><div class="editable-field t25-text" style="cursor:pointer;" ${editBtn('certifications','Certifications',d.certifications||'')}>${d.certifications} <span class="edit-pen">✏</span></div>`:''}
      ${d.awards?`<div class="t25-sec-title section-block" style="color:${accent};">Awards</div><div class="editable-field t25-text" style="cursor:pointer;" ${editBtn('awards','Awards',d.awards||'')}>${d.awards} <span class="edit-pen">✏</span></div>`:''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 1: JEREMY CLIFFORD — Dark Gradient Header Two-Col
// ============================================================
function buildTemplate1Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#7c3aed';
    const name   = d.fullName || 'Your Name';
    const title  = d.jobTitle || '';
    const email  = d.email   || '';
    const phone  = d.phone   || '';
    const addr   = d.address || d.location || '';
    const summary= d.profileSummary || '';
    const initial = (name||'Y').charAt(0).toUpperCase();
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t1-avatar-placeholder" style="background:linear-gradient(135deg,${accent},${accent}88);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${initial}</div>`;
    const skillsHTML = skills.length
        ? skills.map(s=>`<span class="t1-skill" style="background:${accent}22;color:${accent};">${s.name||s}</span>`).join('')
        : `<span class="t1-skill" style="color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</span>`;
    const eduHTML = edu.length
        ? edu.map(e=>`<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;"><div><div class="t1-edu-name">${e.school||e.university||''}</div><div class="t1-edu-deg">${e.degree||''}</div></div><div class="t1-edu-date">${e.year||''}</div></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;
    const expHTML = experience.length
        ? experience.map(e=>`<div class="t1-job"><div class="t1-job-title" style="color:${accent};">${e.jobTitle||e.role||e.title||''}</div><div class="t1-job-date">${e.company||''} · ${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div><div class="t1-job-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div></div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;
    return `<div class="resume-t1">
  <div class="t1-header" style="background:linear-gradient(135deg,${accent}dd 0%,${accent} 100%);">
    <div class="t1-header-bg"></div>
    <div class="t1-avatar-wrap">${photoHTML}</div>
  </div>
  <div class="t1-identity">
    <div class="t1-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div class="t1-role editable-field" style="color:${accent};cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
  </div>
  <div class="t1-body">
    <div class="t1-left">
      <div class="t1-section-title" style="border-bottom-color:${accent};color:${accent};">Contact</div>
      ${email?`<div class="t1-field editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}><div class="t1-field-label" style="color:${accent};">Email</div><div class="t1-field-val">✉ ${email} <span class="edit-pen">✏</span></div></div>`:''}
      ${phone?`<div class="t1-field editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}><div class="t1-field-label" style="color:${accent};">Phone</div><div class="t1-field-val">📞 ${phone} <span class="edit-pen">✏</span></div></div>`:''}
      ${addr?`<div class="t1-field editable-field" style="cursor:pointer;" ${editBtn('address','Address',addr)}><div class="t1-field-label" style="color:${accent};">Location</div><div class="t1-field-val">📍 ${addr} <span class="edit-pen">✏</span></div></div>`:''}
      ${d.linkedin?`<div class="t1-field editable-field" style="cursor:pointer;" ${editBtn('linkedin','LinkedIn',d.linkedin||'')}><div class="t1-field-label" style="color:${accent};">LinkedIn</div><div class="t1-field-val">🔗 ${d.linkedin} <span class="edit-pen">✏</span></div></div>`:''}
      <div class="t1-section-title" style="border-bottom-color:${accent};color:${accent};margin-top:14px;">Skills</div>
      <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skillsHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
      <div class="t1-section-title" style="border-bottom-color:${accent};color:${accent};margin-top:14px;">Education</div>
      <div class="section-block editable-field" style="cursor:pointer;" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
    </div>
    <div class="t1-right">
      ${summary?`<div class="t1-section-title" style="border-bottom-color:${accent};color:${accent};">Profile Summary</div><div class="t1-job-desc editable-field" style="cursor:pointer;font-size:11px;color:#555;line-height:1.6;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
      <div class="t1-section-title" style="border-bottom-color:${accent};color:${accent};margin-top:${summary?'14px':'0'};">Experience</div>
      <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
      ${projects.length?`<div class="t1-section-title" style="border-bottom-color:${accent};color:${accent};margin-top:14px;">Projects</div><div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t1-job"><div class="t1-job-title" style="color:${accent};">${p.title||p.name||''}</div>${p.tools?`<div class="t1-job-date">Tools: ${p.tools}</div>`:''}<div class="t1-job-desc">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div></div>`).join('')} <span class="edit-pen">✏</span></div>`:''}
      ${d.certifications?`<div class="t1-section-title" style="border-bottom-color:${accent};color:${accent};margin-top:14px;">Certifications</div><div class="section-block editable-field" style="cursor:pointer;font-size:11px;color:#555;" ${editBtn('certifications','Certifications',d.certifications||'')}>${d.certifications} <span class="edit-pen">✏</span></div>`:''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 2: ROBYN KINGSLEY — Split Layout
// ============================================================
function buildTemplate2Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#7c3aed';
    const name   = d.fullName || '';
    const title  = d.jobTitle || '';
    const email  = d.email   || '';
    const phone  = d.phone   || '';
    const addr   = d.address || d.location || '';
    const summary= d.profileSummary || '';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,${accent},${accent}88);display:flex;align-items:center;justify-content:center;font-size:2rem;color:#fff;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;
    const eduHTML = edu.length
        ? edu.map(e=>`<div class="t2-course"><div class="t2-course-name">${e.degree||''}</div><div class="t2-course-uni">${e.school||e.university||''}</div><div class="t2-course-years">${e.year||''}</div></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;
    const skillsHTML = skills.length
        ? skills.map(s=>`<div class="t2-skill-item">${s.name||s}</div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;
    const expHTML = experience.length
        ? experience.map(e=>`<div class="t2-job"><div class="t2-job-title" style="color:${accent};">${e.jobTitle||e.role||e.title||''}</div><div class="t2-job-meta"><span>${e.company||''}</span><span>${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</span></div><div class="t2-job-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;
    return `<div class="resume-t2">
  <div class="t2-left">
    <div class="t2-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div class="t2-roles"><div class="t2-role-badge editable-field" style="cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div></div>
    ${addr?`<div class="t2-location editable-field" style="cursor:pointer;" ${editBtn('address','Address',addr)}>📍 ${addr} <span class="edit-pen">✏</span></div>`:''}
    <div class="t2-section-title" style="border-bottom-color:${accent};color:${accent};">Education</div>
    <div class="section-block editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
    <div class="t2-section-title" style="border-bottom-color:${accent};color:${accent};margin-top:14px;">Skills</div>
    <div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skillsHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
    ${d.languages?`<div class="t2-section-title" style="border-bottom-color:${accent};color:${accent};margin-top:14px;">Languages</div><div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div class="t2-skill-item">${l.trim()}</div>`).join('')} <span class="edit-pen">✏</span></div>`:''}
  </div>
  <div class="t2-right">
    <div class="t2-photo-contact">
      <div class="t2-photo">${photoHTML}</div>
      <div class="t2-contact-list">
        ${email?`<div class="t2-contact-item editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}><span class="t2-contact-icon">✉</span> ${email} <span class="edit-pen">✏</span></div>`:''}
        ${phone?`<div class="t2-contact-item editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}><span class="t2-contact-icon">📞</span> ${phone} <span class="edit-pen">✏</span></div>`:''}
        ${d.linkedin?`<div class="t2-contact-item editable-field" style="cursor:pointer;" ${editBtn('linkedin','LinkedIn',d.linkedin||'')}><span class="t2-contact-icon">🔗</span> ${d.linkedin} <span class="edit-pen">✏</span></div>`:''}
        ${d.website?`<div class="t2-contact-item editable-field" style="cursor:pointer;" ${editBtn('website','Website',d.website||'')}><span class="t2-contact-icon">🌐</span> ${d.website} <span class="edit-pen">✏</span></div>`:''}
      </div>
    </div>
    ${summary?`<div class="t2-section-title-r" style="border-bottom-color:${accent};color:${accent};">Profile</div><div class="t2-profile-text editable-field" style="cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
    <div class="t2-section-title-r" style="border-bottom-color:${accent};color:${accent};">Experience</div>
    <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
    ${projects.length?`<div class="t2-section-title-r" style="border-bottom-color:${accent};color:${accent};margin-top:14px;">Projects</div><div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t2-job"><div class="t2-job-title" style="color:${accent};">${p.title||p.name||''}</div>${p.tools?`<div class="t2-job-meta"><span>Tools: ${p.tools}</span></div>`:''}<div class="t2-job-desc">${p.description||''}</div></div>`).join('')} <span class="edit-pen">✏</span></div>`:''}
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 3: NINA PATEL — Clean Minimal Left Photo Column
// ============================================================
function buildTemplate3Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#d97706';
    const name   = d.fullName || '';
    const title  = d.jobTitle || '';
    const email  = d.email   || '';
    const phone  = d.phone   || '';
    const addr   = d.address || d.location || '';
    const summary= d.profileSummary || '';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t3-photo-placeholder" style="background:linear-gradient(135deg,${accent},${accent}88);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;
    const expHTML = experience.length
        ? experience.map(e=>`<div class="t3-job"><div class="t3-job-head"><div><div class="t3-job-title">${e.jobTitle||e.role||e.title||''}</div><div class="t3-job-at" style="color:${accent};">${e.company||''}</div></div><div class="t3-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div></div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t3-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;
    const eduHTML = edu.length
        ? edu.map(e=>`<div class="t3-edu-item"><div class="t3-edu-name">${e.degree||''}</div><div class="t3-edu-at" style="color:${accent};">${e.school||e.university||''}</div><div class="t3-edu-date">${e.year||''}</div></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;
    return `<div class="resume-t3">
  <div class="t3-left">
    <div class="t3-left-accent" style="background:${accent};"></div>
    <div class="t3-photo">${photoHTML}</div>
    <div class="t3-left-body">
      <div class="t3-left-title" style="color:#999;">Contact</div>
      ${email?`<div class="t3-contact-item editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>`:''}
      ${phone?`<div class="t3-contact-item editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>`:''}
      ${addr?`<div class="t3-contact-item editable-field" style="cursor:pointer;" ${editBtn('address','Address',addr)}>📍 ${addr} <span class="edit-pen">✏</span></div>`:''}
      ${d.linkedin?`<div class="t3-contact-item editable-field" style="cursor:pointer;" ${editBtn('linkedin','LinkedIn',d.linkedin||'')}>🔗 ${d.linkedin} <span class="edit-pen">✏</span></div>`:''}
      <div class="t3-left-title" style="color:#999;">Skills</div>
      <div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>
        ${skills.length?skills.map(s=>`<div class="t3-skill-item">${s.name||s}</div>`).join(''):`<div style="font-size:10px;color:#9ca3af;cursor:pointer;">Add skills ✏</div>`}
        <span class="edit-pen" style="font-size:10px;">✏</span>
      </div>
      ${d.languages?`<div class="t3-left-title" style="color:#999;">Languages</div><div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div class="t3-skill-item">${l.trim()}</div>`).join('')} <span class="edit-pen">✏</span></div>`:''}
    </div>
  </div>
  <div class="t3-right">
    <div class="t3-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div class="t3-role editable-field" style="cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    ${summary?`<div class="t3-summary editable-field" style="border-left-color:${accent};cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
    <div class="t3-section-title">Experience</div>
    <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
    <div class="t3-section-title">Education</div>
    <div class="section-block editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
    ${projects.length?`<div class="t3-section-title">Projects</div><div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t3-job"><div class="t3-job-head"><div><div class="t3-job-title">${p.title||p.name||''}</div><div class="t3-job-at" style="color:${accent};">${p.tools||''}</div></div></div><div class="t3-bullet">${p.description||''}</div></div>`).join('')} <span class="edit-pen">✏</span></div>`:''}
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 4: JEREMY CLIFFORD v2 — Amber Skill Bars Left Col
// ============================================================
function buildTemplate4Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#e8c14a';
    const name   = d.fullName || '';
    const title  = d.jobTitle || '';
    const email  = d.email   || '';
    const phone  = d.phone   || '';
    const summary= d.profileSummary || '';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t4-photo-placeholder" style="background:${accent};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:3rem;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;
    const expHTML = experience.length
        ? experience.map(e=>`<div class="t4-job"><div class="t4-job-head"><span class="t4-job-title">${e.jobTitle||e.role||e.title||''}</span><span class="t4-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</span></div><div style="font-size:10px;color:#777;">${e.company||''}</div><div class="t4-job-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;
    const skillBarsHTML = skills.length
        ? skills.map(s=>{const pct=typeof s.level==='number'?s.level:80;return`<div class="t4-skill-bar-wrap"><div class="t4-skill-bar-label"><span>${s.name||s}</span><span>${pct}%</span></div><div class="t4-skill-bar-track"><div class="t4-skill-bar-fill" style="width:${pct}%;background:${accent};"></div></div></div>`;}).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;
    const eduHTML = edu.length
        ? edu.map(e=>`<div class="t4-edu-item"><div class="t4-edu-name">${e.school||e.university||''}</div><div class="t4-edu-deg">${e.degree||''}</div><div class="t4-edu-date">${e.year||''}</div></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;
    return `<div class="resume-t4">
  <div class="t4-left">
    <div class="t4-photo">${photoHTML}</div>
    <div class="t4-accent-bar" style="background:${accent};"></div>
    <div class="t4-left-body">
      <div class="t4-left-title" style="color:#999;">Contact</div>
      ${email?`<div class="t4-field editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}><div class="t4-field-label">Email</div><div class="t4-field-val">${email} <span class="edit-pen">✏</span></div></div>`:''}
      ${phone?`<div class="t4-field editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}><div class="t4-field-label">Phone</div><div class="t4-field-val">${phone} <span class="edit-pen">✏</span></div></div>`:''}
      ${d.address?`<div class="t4-field editable-field" style="cursor:pointer;" ${editBtn('address','Address',d.address||'')}><div class="t4-field-label">Location</div><div class="t4-field-val">${d.address} <span class="edit-pen">✏</span></div></div>`:''}
      <div class="t4-left-title" style="color:#999;">Education</div>
      <div class="section-block editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
      <div class="t4-left-title" style="color:#999;">Skills</div>
      <div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>
        ${skills.length?skills.map(s=>`<div class="t4-skill">${s.name||s}</div>`).join(''):`<div style="font-size:10px;color:#9ca3af;">Add skills ✏</div>`}
        <span class="edit-pen" style="font-size:10px;">✏</span>
      </div>
    </div>
  </div>
  <div class="t4-right">
    <div class="t4-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div class="t4-role editable-field" style="cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    ${summary?`<div style="font-size:11px;color:#555;line-height:1.6;margin-bottom:12px;" class="editable-field" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
    <div class="t4-section-title" style="border-bottom-color:${accent};">Employment</div>
    <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
    <div class="t4-section-title" style="border-bottom-color:${accent};margin-top:14px;">Skill Levels</div>
    <div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skillBarsHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
    ${projects.length?`<div class="t4-section-title" style="border-bottom-color:${accent};margin-top:14px;">Projects</div><div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t4-job"><div class="t4-job-head"><span class="t4-job-title">${p.title||p.name||''}</span></div><div class="t4-job-desc">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div></div>`).join('')} <span class="edit-pen">✏</span></div>`:''}
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 5: MARTINA RODLER — Bold Black Header Two-Col
// ============================================================
function buildTemplate5Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#1a1a2e';
    const name   = d.fullName || '';
    const title  = d.jobTitle || '';
    const email  = d.email   || '';
    const phone  = d.phone   || '';
    const summary= d.profileSummary || '';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:4rem;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;
    const nameParts = name.split(' ');
    const expHTML = experience.length
        ? experience.map(e=>`<div class="t5-job"><div class="t5-job-head"><span class="t5-job-title">${e.jobTitle||e.role||e.title||''}</span><span class="t5-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</span></div><div class="t5-job-company">${e.company||''}</div><div class="t5-job-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div></div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;
    return `<div class="resume-t5">
  <div class="t5-header">
    <div class="t5-header-left" style="background:${accent};">
      <div>
        <div class="t5-header-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${nameParts[0]||name}<br>${nameParts.slice(1).join(' ')||''} <span class="edit-pen" style="font-size:12px;opacity:.6;">✏</span></div>
        <div class="t5-header-role editable-field" style="cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen" style="font-size:11px;opacity:.6;">✏</span></div>
      </div>
    </div>
    <div class="t5-header-right">${photoHTML}</div>
  </div>
  ${summary?`<div class="t5-summary editable-field" style="cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
  <div class="t5-body">
    <div class="t5-left">
      <div class="t5-section-title" style="color:${accent};">Contact</div>
      ${email?`<div class="t5-contact-item editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>`:''}
      ${phone?`<div class="t5-contact-item editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>`:''}
      ${d.address?`<div class="t5-contact-item editable-field" style="cursor:pointer;" ${editBtn('address','Address',d.address||'')}>📍 ${d.address} <span class="edit-pen">✏</span></div>`:''}
      ${d.linkedin?`<div class="t5-contact-item editable-field" style="cursor:pointer;" ${editBtn('linkedin','LinkedIn',d.linkedin||'')}>🔗 ${d.linkedin} <span class="edit-pen">✏</span></div>`:''}
      <div class="t5-section-title" style="margin-top:14px;color:${accent};">Skills</div>
      <div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>
        ${skills.length?skills.map(s=>`<div class="t5-skill-item">${s.name||s}</div>`).join(''):`<div class="t5-skill-item" style="color:#9ca3af;">Add skills ✏</div>`}
        <span class="edit-pen" style="font-size:10px;">✏</span>
      </div>
      ${edu.length?`<div class="t5-section-title" style="margin-top:14px;color:${accent};">Education</div><div class="section-block editable-field" ${editBtn('educationJson','Education','')}>${edu.map(e=>`<div style="margin-bottom:8px;"><div style="font-size:11px;font-weight:800;">${e.degree||''}</div><div style="font-size:10px;color:#888;">${e.school||e.university||''}</div><div style="font-size:10px;color:#aaa;">${e.year||''}</div></div>`).join('')} <span class="edit-pen">✏</span></div>`:''}
    </div>
    <div class="t5-right">
      <div class="t5-section-title" style="color:${accent};">Work Experience</div>
      <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
      ${projects.length?`<div class="t5-section-title" style="margin-top:14px;color:${accent};">Projects</div><div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t5-job"><div class="t5-job-head"><span class="t5-job-title">${p.title||p.name||''}</span></div><div class="t5-job-company">${p.tools||''}</div><div class="t5-job-desc">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div></div>`).join('')} <span class="edit-pen">✏</span></div>`:''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 6: Purple Dark Sidebar + Skill Bars
// ============================================================
function buildTemplate6Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#7c3aed';
    const name   = d.fullName || '';
    const title  = d.jobTitle || '';
    const email  = d.email   || '';
    const phone  = d.phone   || '';
    const addr   = d.address || d.location || '';
    const summary= d.profileSummary || '';
    const nameParts = name.split(' ');
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:90px;height:90px;border-radius:50%;border:3px solid ${accent};object-fit:cover;cursor:pointer;display:block;margin:24px auto 0;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t6-avatar" style="border-color:${accent};background:linear-gradient(135deg,${accent},${accent}88);cursor:pointer;margin:24px auto 0;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;
    const skillBarsHTML = skills.length
        ? skills.map(s=>{const pct=typeof s.level==='number'?s.level:80;return`<div class="t6-skill-bar"><div class="t6-skill-name">${s.name||s}</div><div class="t6-skill-track"><div class="t6-skill-fill" style="width:${pct}%;background:linear-gradient(90deg,${accent},${accent}aa);"></div></div></div>`;}).join('')
        : `<div style="font-size:10px;color:rgba(255,255,255,0.5);cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;
    const expHTML = experience.length
        ? experience.map(e=>`<div class="t6-job"><div class="t6-job-head"><span class="t6-job-title">${e.jobTitle||e.role||e.title||''}</span><span class="t6-job-loc" style="color:${accent};">${e.company||''}</span></div><div class="t6-job-company">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t6-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;
    return `<div class="resume-t6">
  <div class="t6-left" style="background:${accent}ee;">
    ${photoHTML}
    <div class="t6-left-body">
      <div class="t6-left-title">Education</div>
      <div class="section-block editable-field" ${editBtn('educationJson','Education','')}>
        ${edu.length?edu.map(e=>`<div class="t6-edu-item"><div class="t6-edu-degree">${e.degree||''}</div><div class="t6-edu-uni" style="color:rgba(255,255,255,0.6);">${e.school||e.university||''}</div><div class="t6-edu-years">${e.year||''}</div></div>`).join(''):`<div style="font-size:10px;color:rgba(255,255,255,0.4);cursor:pointer;">Add education ✏</div>`}
        <span class="edit-pen" style="font-size:10px;color:rgba(255,255,255,0.5);">✏</span>
      </div>
      <div class="t6-left-title">Skills</div>
      <div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skillBarsHTML} <span class="edit-pen" style="font-size:10px;color:rgba(255,255,255,0.5);">✏</span></div>
      ${d.languages?`<div class="t6-left-title">Languages</div><div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div class="t6-lang">${l.trim()}</div>`).join('')} <span class="edit-pen" style="font-size:10px;color:rgba(255,255,255,0.5);">✏</span></div>`:''}
    </div>
    <div class="t6-left-geo" style="background:linear-gradient(135deg,${accent} 0%,${accent}aa 100%);"></div>
  </div>
  <div class="t6-right">
    <div class="t6-right-header">
      <div class="t6-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}><span style="color:${accent};">${nameParts[0]||name}</span>${nameParts.length>1?' '+nameParts.slice(1).join(' '):''} <span class="edit-pen">✏</span></div>
      <div class="t6-role editable-field" style="cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      <div class="t6-contacts">
        ${email?`<div class="t6-contact editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>`:''}
        ${phone?`<div class="t6-contact editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>`:''}
        ${addr?`<div class="t6-contact editable-field" style="cursor:pointer;" ${editBtn('address','Address',addr)}>📍 ${addr} <span class="edit-pen">✏</span></div>`:''}
        ${d.website?`<div class="t6-contact editable-field" style="cursor:pointer;" ${editBtn('website','Website',d.website||'')}>🌐 ${d.website} <span class="edit-pen">✏</span></div>`:''}
      </div>
    </div>
    <div class="t6-right-body">
      ${summary?`<div class="t6-section-title">About Me</div><div class="t6-about editable-field" style="cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
      <div class="t6-section-title">Professional Experience</div>
      <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
      ${projects.length?`<div class="t6-section-title">Projects</div><div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t6-job"><div class="t6-job-head"><span class="t6-job-title">${p.title||p.name||''}</span><span class="t6-job-loc" style="color:${accent};">${p.tools||''}</span></div></div>`).join('')} <span class="edit-pen">✏</span></div>`:''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 7: Dark Teal Header + Left Dark Sidebar
// ============================================================
function buildTemplate7Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#0f766e';
    const name   = d.fullName || '';
    const title  = d.jobTitle || '';
    const email  = d.email   || '';
    const phone  = d.phone   || '';
    const website= d.website || '';
    const summary= d.profileSummary || '';
    const nameParts = name.split(' ');
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;border:3px solid ${accent}aa;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t7-avatar-ph" style="background:linear-gradient(135deg,${accent},${accent}88);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;
    const skillBarsHTML = skills.length
        ? skills.map(s=>{const pct=typeof s.level==='number'?s.level:80;return`<div class="t7-skill-bar"><div class="t7-skill-name">${s.name||s}</div><div class="t7-skill-track"><div class="t7-skill-fill" style="width:${pct}%;background:linear-gradient(90deg,${accent},${accent}aa);"></div></div></div>`;}).join('')
        : `<div style="font-size:10px;color:rgba(255,255,255,0.4);cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;
    const expHTML = experience.length
        ? experience.map(e=>`<div class="t7-job"><div class="t7-job-head"><span class="t7-job-title">${e.jobTitle||e.role||e.title||''}</span><span class="t7-job-loc" style="color:${accent};">${e.company||''}</span></div><div class="t7-job-company">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t7-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;
    return `<div class="resume-t7">
  <div class="t7-header" style="background:linear-gradient(135deg,${accent}dd 0%,${accent} 100%);">
    <div class="t7-header-blob"></div>
    <div class="t7-header-top">
      ${email?`<div class="t7-header-contact editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>`:''}
      ${phone?`<div class="t7-header-contact editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>`:''}
      ${website?`<div class="t7-header-contact editable-field" style="cursor:pointer;" ${editBtn('website','Website',website)}>🌐 ${website} <span class="edit-pen">✏</span></div>`:''}
    </div>
    <div class="t7-header-main">
      <div class="t7-avatar">${photoHTML}</div>
      <div>
        <div class="t7-h-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}><span style="color:#fff;">${nameParts[0]||name}</span>${nameParts.length>1?' '+nameParts.slice(1).join(' '):''} <span class="edit-pen" style="font-size:12px;opacity:.6;">✏</span></div>
        <div class="t7-h-role editable-field" style="cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen" style="font-size:11px;opacity:.6;">✏</span></div>
      </div>
    </div>
  </div>
  <div class="t7-body">
    <div class="t7-left" style="background:${accent}ee;">
      <div class="t7-left-section-title" style="color:rgba(255,255,255,0.7);">Education</div>
      <div class="section-block editable-field" ${editBtn('educationJson','Education','')}>
        ${edu.length?edu.map(e=>`<div class="t7-edu-item"><div class="t7-edu-degree">${e.degree||''}</div><div class="t7-edu-uni" style="color:rgba(255,255,255,0.5);">${e.school||e.university||''}</div><div class="t7-edu-years">${e.year||''}</div></div>`).join(''):`<div style="font-size:10px;color:rgba(255,255,255,0.3);cursor:pointer;">Add education ✏</div>`}
        <span class="edit-pen" style="font-size:10px;color:rgba(255,255,255,0.4);">✏</span>
      </div>
      <div class="t7-left-section-title" style="color:rgba(255,255,255,0.7);">Skills</div>
      <div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skillBarsHTML} <span class="edit-pen" style="font-size:10px;color:rgba(255,255,255,0.4);">✏</span></div>
      ${d.languages?`<div class="t7-left-section-title" style="color:rgba(255,255,255,0.7);">Languages</div><div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div class="t7-lang" style="color:rgba(255,255,255,0.6);">${l.trim()}</div>`).join('')} <span class="edit-pen" style="font-size:10px;color:rgba(255,255,255,0.4);">✏</span></div>`:''}
    </div>
    <div class="t7-right">
      ${summary?`<div class="t7-section-title" style="border-bottom-color:${accent};color:#0d2d2d;">About Me</div><div class="t7-about editable-field" style="cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
      <div class="t7-section-title" style="border-bottom-color:${accent};color:#0d2d2d;">Professional Experience</div>
      <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
      ${projects.length?`<div class="t7-section-title" style="border-bottom-color:${accent};color:#0d2d2d;">Projects</div><div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t7-job"><div class="t7-job-head"><span class="t7-job-title">${p.title||p.name||''}</span></div><div class="t7-job-company">${p.tools||''}</div></div>`).join('')} <span class="edit-pen">✏</span></div>`:''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 8: Orange Geo — Three-Column with Triangles
// ============================================================
function buildTemplate8Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#e8600a';
    const name   = d.fullName || '';
    const title  = d.jobTitle || '';
    const email  = d.email   || '';
    const phone  = d.phone   || '';
    const addr   = d.address || d.location || '';
    const summary= d.profileSummary || '';
    const nameParts = name.split(' ');
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t8-avatar-ph" style="background:linear-gradient(135deg,${accent},${accent}88);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;
    const expHTML = experience.length
        ? experience.map(e=>`<div class="t8-job" style="border-left-color:${accent};"><div class="t8-job-head"><span class="t8-job-title">${e.jobTitle||e.role||e.title||''}</span><span class="t8-job-loc" style="color:${accent};">${e.company||''}</span></div><div class="t8-job-company">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t8-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;
    return `<div class="resume-t8" style="position:relative;">
  <div class="t8-top-geo" style="background:${accent};"></div>
  <div class="t8-bottom-geo"></div>
  <div class="t8-header">
    <div class="t8-avatar">${photoHTML}</div>
    <div>
      <div class="t8-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}><span style="color:${accent};">${nameParts[0]||name}</span>${nameParts.length>1?' '+nameParts.slice(1).join(' '):''} <span class="edit-pen">✏</span></div>
      <div class="t8-role editable-field" style="cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      <div class="t8-header-contacts">
        ${email?`<div class="t8-hc editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>`:''}
        ${phone?`<div class="t8-hc editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>`:''}
        ${addr?`<div class="t8-hc editable-field" style="cursor:pointer;" ${editBtn('address','Address',addr)}>📍 ${addr} <span class="edit-pen">✏</span></div>`:''}
      </div>
    </div>
  </div>
  <div class="t8-body">
    <div class="t8-left">
      <div class="t8-left-title" style="color:${accent};">Education</div>
      <div class="section-block editable-field" ${editBtn('educationJson','Education','')}>
        ${edu.length?edu.map(e=>`<div class="t8-edu-item"><div class="t8-edu-degree">${e.degree||''}</div><div class="t8-edu-uni">${e.school||e.university||''}</div><div class="t8-edu-years">${e.year||''}</div></div>`).join(''):`<div style="font-size:10px;color:#9ca3af;cursor:pointer;">Add education ✏</div>`}
        <span class="edit-pen" style="font-size:10px;">✏</span>
      </div>
      ${d.languages?`<div class="t8-left-title" style="color:${accent};">Languages</div><div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div class="t8-lang">${l.trim()}</div>`).join('')} <span class="edit-pen" style="font-size:10px;">✏</span></div>`:''}
    </div>
    <div class="t8-right">
      ${summary?`<div class="t8-section-title">About Me</div><div class="t8-about editable-field" style="cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
      <div class="t8-section-title">Experience</div>
      <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
      ${projects.length?`<div class="t8-section-title">Projects</div><div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t8-job" style="border-left-color:${accent};"><div class="t8-job-head"><span class="t8-job-title">${p.title||p.name||''}</span></div><div class="t8-job-company">${p.tools||''}</div></div>`).join('')} <span class="edit-pen">✏</span></div>`:''}
    </div>
    <div class="t8-right-sidebar">
      <div class="t8-rs-title" style="color:${accent};">Skills</div>
      <div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>
        ${skills.length?skills.map(s=>`<div class="t8-rs-skill">${s.name||s}</div>`).join(''):`<div class="t8-rs-skill" style="color:#9ca3af;">Add skills ✏</div>`}
        <span class="edit-pen" style="font-size:10px;">✏</span>
      </div>
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 9: Green Professional — Left Dark Green + Right
// ============================================================
function buildTemplate9Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#166534';
    const name   = d.fullName || '';
    const title  = d.jobTitle || '';
    const email  = d.email   || '';
    const phone  = d.phone   || '';
    const website= d.website || '';
    const summary= d.profileSummary || '';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #4ade80;cursor:pointer;display:block;margin:0 auto 10px;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t9-avatar" style="margin:0 auto 10px;"><div class="t9-avatar-ph" style="background:linear-gradient(135deg,${accent},${accent}aa);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div></div>`;
    const expHTML = experience.length
        ? experience.map(e=>`<div class="t9-job"><div class="t9-job-head"><span class="t9-job-title">${e.jobTitle||e.role||e.title||''}</span><span class="t9-job-loc" style="color:${accent};">${e.company||''}</span></div><div class="t9-job-company">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t9-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;
    return `<div class="resume-t9">
  <div class="t9-left">
    <div class="t9-left-top" style="background:linear-gradient(180deg,${accent} 0%,${accent}cc 100%);text-align:center;">
      ${photoHTML}
      <div class="t9-left-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen" style="font-size:10px;opacity:.6;">✏</span></div>
      <div class="t9-left-role editable-field" style="cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen" style="font-size:10px;opacity:.6;">✏</span></div>
    </div>
    <div class="t9-left-body">
      <div class="t9-left-section" style="background:${accent};"><div class="t9-left-section-title">Education</div></div>
      <div class="t9-left-content">
        <div class="section-block editable-field" ${editBtn('educationJson','Education','')}>
          ${edu.length?edu.map(e=>`<div class="t9-edu-item"><div class="t9-edu-degree" style="color:${accent};">${e.degree||''}</div><div class="t9-edu-uni">${e.school||e.university||''}</div><div class="t9-edu-years">${e.year||''}</div></div>`).join(''):`<div style="font-size:10px;color:#9ca3af;cursor:pointer;">Add education ✏</div>`}
          <span class="edit-pen" style="font-size:10px;">✏</span>
        </div>
      </div>
      <div class="t9-left-section" style="background:${accent};"><div class="t9-left-section-title">Skills</div></div>
      <div class="t9-left-content">
        <div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>
          ${skills.length?skills.map(s=>`<div class="t9-skill" style="color:${accent};">${s.name||s}</div>`).join(''):`<div style="font-size:10px;color:#9ca3af;cursor:pointer;">Add skills ✏</div>`}
          <span class="edit-pen" style="font-size:10px;">✏</span>
        </div>
      </div>
      ${d.languages?`<div class="t9-left-section" style="background:${accent};"><div class="t9-left-section-title">Languages</div></div><div class="t9-left-content"><div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div class="t9-lang">${l.trim()}</div>`).join('')} <span class="edit-pen" style="font-size:10px;">✏</span></div></div>`:''}
    </div>
  </div>
  <div class="t9-right">
    <div class="t9-right-header">
      <div class="t9-rh-contact-row">
        ${phone?`<div class="t9-rh-contact editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>`:''}
        ${email?`<div class="t9-rh-contact editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>`:''}
        ${website?`<div class="t9-rh-contact editable-field" style="cursor:pointer;" ${editBtn('website','Website',website)}>🌐 ${website} <span class="edit-pen">✏</span></div>`:''}
      </div>
      <div class="t9-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      <div class="t9-role editable-field" style="cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    </div>
    <div class="t9-right-body">
      ${summary?`<div class="t9-section-title" style="color:${accent};border-bottom-color:${accent}44;">About Me</div><div class="t9-about editable-field" style="cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
      <div class="t9-section-title" style="color:${accent};border-bottom-color:${accent}44;">Professional Experience</div>
      <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML} <span class="edit-pen" style="font-size:10px;">✏</span></div>
      ${projects.length?`<div class="t9-section-title" style="color:${accent};border-bottom-color:${accent}44;">Projects</div><div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t9-job"><div class="t9-job-head"><span class="t9-job-title">${p.title||p.name||''}</span></div><div class="t9-job-company">${p.tools||''}</div></div>`).join('')} <span class="edit-pen">✏</span></div>`:''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// GENERIC BUILDER for templates 11-31 (except 25)
// Uses user's real data with sidebar + main content layout,
// accent colors matching each template's theme
// ============================================================
function buildNumberedTemplate({ resumeData: d, edu, skills, projects, experience, color }, num) {
    const accent  = color || '#1e3a5f';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email   || '';
    const phone   = d.phone   || '';
    const addr    = d.address || d.location || '';
    const linkedin= d.linkedin|| '';
    const website = d.website || '';
    const summary = d.profileSummary || '';

    // Dark sidebar templates
    const darkSidebarNums = [11,14,16,20,22,24,30,33,34,35,36,38,40,42,43];
    const isDark  = darkSidebarNums.includes(num);
    const sbBg    = isDark ? accent : '#f5f5f5';
    const sbText  = isDark ? '#fff' : '#333';
    const sbMuted = isDark ? 'rgba(255,255,255,0.6)' : '#6b7280';
    const sbHr    = isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb';

    const photoSize = d.photoSize || 80;
    const photoBR   = d.photoShape === 'square' ? '8px' : '50%';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBR};object-fit:cover;cursor:pointer;border:3px solid ${isDark?'rgba(255,255,255,0.3)':accent+'44'};display:block;margin:0 auto 12px;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBR};background:${accent}55;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#fff;cursor:pointer;border:3px solid ${isDark?'rgba(255,255,255,0.2)':accent+'44'};margin:0 auto 12px;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillsHTML = skills.length
        ? skills.map(s => {
            const skillName = typeof s === 'string' ? s : (s.name || s.skill || '');
            const pct = (typeof s === 'object' && typeof s.level === 'number') ? s.level : 80;
            return `<div style="margin-bottom:7px;">
              <div style="font-size:10px;color:${sbText};margin-bottom:3px;opacity:0.85;display:flex;justify-content:space-between;"><span>${skillName}</span><span style="font-size:9px;opacity:0.65;">${pct}%</span></div>
              <div style="height:4px;background:${sbHr};border-radius:2px;">
                <div style="width:${pct}%;height:100%;background:${isDark?'rgba(255,255,255,0.7)':accent};border-radius:2px;"></div>
              </div></div>`;
          }).join('')
        : `<div style="font-size:10px;color:${sbMuted};cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div style="margin-bottom:9px;">
            <div style="font-size:11px;font-weight:700;color:${sbText};">${e.degree||''}</div>
            <div style="font-size:10px;color:${sbMuted};">${e.school||e.university||''}</div>
            <div style="font-size:10px;color:${sbMuted};opacity:0.6;">${e.year||''}</div>
          </div>`).join('')
        : `<div style="font-size:10px;color:${sbMuted};cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div style="margin-bottom:14px;padding-left:12px;border-left:3px solid ${accent};">
            <div style="font-size:12px;font-weight:700;color:${accent};">${e.jobTitle||e.role||e.title||''}</div>
            <div style="font-size:11px;color:#555;margin-bottom:2px;">${e.company||''}</div>
            <div style="font-size:10px;color:#888;margin-bottom:4px;">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>
            <div style="font-size:11px;color:#374151;line-height:1.6;">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const projHTML = projects.length
        ? projects.map(p => `<div style="margin-bottom:12px;padding-left:12px;border-left:3px solid ${accent}44;">
            <div style="font-size:12px;font-weight:700;color:${accent};">${p.title||p.name||''}</div>
            ${p.tools?`<div style="font-size:10px;color:#888;">Tools: ${p.tools}</div>`:''}
            <div style="font-size:11px;color:#374151;">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
          </div>`).join('')
        : '';

    const secHd = t => `<div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid ${accent};padding-bottom:3px;margin:16px 0 10px;">${t}</div>`;
    const sbSecHd = t => `<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${sbMuted};margin:14px 0 7px;padding-bottom:3px;border-bottom:1px solid ${sbHr};">${t}</div>`;

    const contactHTML = [
        phone    && `<div style="margin-bottom:5px;font-size:10px;cursor:pointer;color:${sbText};display:flex;align-items:center;gap:5px;" class="editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>`,
        email    && `<div style="margin-bottom:5px;font-size:10px;cursor:pointer;color:${sbText};display:flex;align-items:center;gap:5px;word-break:break-all;" class="editable-field" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>`,
        addr     && `<div style="margin-bottom:5px;font-size:10px;cursor:pointer;color:${sbText};display:flex;align-items:flex-start;gap:5px;" class="editable-field" ${editBtn('address','Address',addr)}>📍 ${addr} <span class="edit-pen">✏</span></div>`,
        linkedin && `<div style="margin-bottom:5px;font-size:10px;cursor:pointer;color:${sbText};word-break:break-all;" class="editable-field" ${editBtn('linkedin','LinkedIn',linkedin)}>🔗 ${linkedin} <span class="edit-pen">✏</span></div>`,
        website  && `<div style="margin-bottom:5px;font-size:10px;cursor:pointer;color:${sbText};word-break:break-all;" class="editable-field" ${editBtn('website','Website',website)}>🌐 ${website} <span class="edit-pen">✏</span></div>`,
    ].filter(Boolean).join('');

    return `<div style="display:flex;min-height:900px;font-family:inherit;background:#fff;width:660px;">
  <!-- SIDEBAR -->
  <div style="width:200px;flex-shrink:0;background:${sbBg};padding:20px 14px;display:flex;flex-direction:column;">
    <div style="text-align:center;margin-bottom:4px;">${photoHTML}</div>
    <div style="font-size:16px;font-weight:900;color:${sbText};text-align:center;margin-bottom:3px;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen" style="font-size:11px;">✏</span></div>
    <div style="font-size:10px;color:${sbMuted};text-align:center;margin-bottom:14px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen" style="font-size:10px;">✏</span></div>
    <div style="height:1px;background:${sbHr};margin-bottom:14px;"></div>
    ${sbSecHd('Contact')}
    ${contactHTML||`<div style="font-size:10px;color:${sbMuted};cursor:pointer;" ${editBtn('email','Email','')}>Add contact ✏</div>`}
    ${sbSecHd('Skills')}
    <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skillsHTML}<span class="edit-pen" style="font-size:10px;color:${sbMuted};">✏</span></div>
    ${sbSecHd('Education')}
    <div class="section-block editable-field" style="cursor:pointer;" ${editBtn('educationJson','Education','')}>${eduHTML}<span class="edit-pen" style="font-size:10px;color:${sbMuted};">✏</span></div>
    ${sbSecHd('Languages')}
    <div class="editable-field" style="color:${sbText};cursor:pointer;" ${editBtn('languages','Languages',d.languages||'')}>${d.languages ? d.languages.split(',').map(l=>`<div style="font-size:10px;margin-bottom:3px;">● ${l.trim()}</div>`).join('') : `<div style="font-size:10px;color:${sbMuted};">Add languages ✏</div>`}<span class="edit-pen" style="font-size:10px;color:${sbMuted};">✏</span></div>
  </div>
  <!-- MAIN CONTENT -->
  <div style="flex:1;padding:24px 22px;background:#fff;min-width:0;">
    ${summary?`${secHd('Profile Summary')}<div class="editable-field section-block" style="font-size:11px;color:#555;line-height:1.7;cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
    ${secHd('Experience')}
    <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML || `<div style="font-size:11px;color:#9ca3af;cursor:pointer;">Add experience ✏</div>`}<span class="edit-pen" style="font-size:10px;">✏</span></div>
    ${projHTML?`${secHd('Projects')}<div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>`:''}
    ${d.certifications?`${secHd('Certifications')}<div class="editable-field section-block" style="font-size:11px;color:#374151;cursor:pointer;" ${editBtn('certifications','Certifications',d.certifications||'')}>${d.certifications} <span class="edit-pen">✏</span></div>`:''}
    ${d.awards?`${secHd('Awards')}<div class="editable-field section-block" style="font-size:11px;color:#374151;cursor:pointer;" ${editBtn('awards','Awards',d.awards||'')}>${d.awards} <span class="edit-pen">✏</span></div>`:''}
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// IMAGE-BASED TEMPLATE RENDERER (template1 – template45)
// Renders a live resume using the template's accent color and
// the user's actual data, with full inline-edit support.
// ============================================================
function buildImageBasedTemplate({ resumeData: d, edu, skills, projects, experience, color }, templateId) {
    const num = parseInt(templateId.replace('template',''), 10) || 1;

    // Per-template accent / sidebar colors
    const themeMap = {
        1:  { bg: '#4b1fa8', sidebar: '#4b1fa8', dark: true  },
        2:  { bg: '#6b7280', sidebar: '#6b7280', dark: true  },
        3:  { bg: '#d97706', sidebar: '#fef3c7', dark: false },
        4:  { bg: '#f59e0b', sidebar: '#1a1a2e', dark: true  },
        5:  { bg: '#1a1a2e', sidebar: '#1a1a2e', dark: true  },
        6:  { bg: '#7c3aed', sidebar: '#7c3aed', dark: true  },
        7:  { bg: '#0f766e', sidebar: '#0f766e', dark: true  },
        8:  { bg: '#f97316', sidebar: '#1a1a2e', dark: true  },
        9:  { bg: '#166534', sidebar: '#166534', dark: true  },
        10: { bg: '#f59e0b', sidebar: '#1a1a2e', dark: true  },
        11: { bg: '#4b1fa8', sidebar: '#4b1fa8', dark: true  },
        12: { bg: '#f43f5e', sidebar: '#fff1f2', dark: false },
        13: { bg: '#7c3aed', sidebar: '#f5f3ff', dark: false },
        14: { bg: '#1e3a5f', sidebar: '#1e3a5f', dark: true  },
        15: { bg: '#1a1a2e', sidebar: '#f9fafb', dark: false },
        16: { bg: '#3d5a3e', sidebar: '#3d5a3e', dark: true  },
        17: { bg: '#c084fc', sidebar: '#fdf4ff', dark: false },
        18: { bg: '#0284c7', sidebar: '#0284c7', dark: true  },
        19: { bg: '#a78bfa', sidebar: '#faf5ff', dark: false },
        20: { bg: '#0284c7', sidebar: '#0284c7', dark: true  },
        21: { bg: '#1e3a5f', sidebar: '#1e3a5f', dark: true  },
        22: { bg: '#166534', sidebar: '#166534', dark: true  },
        23: { bg: '#f97316', sidebar: '#fff7ed', dark: false },
        24: { bg: '#4d7c0f', sidebar: '#1a1a1a', dark: true  },
        25: { bg: '#06b6d4', sidebar: '#1a1a2e', dark: true  },
        26: { bg: '#f59e0b', sidebar: '#1a1a2e', dark: true  },
        27: { bg: '#1e3a5f', sidebar: '#f0f4f8', dark: false },
        28: { bg: '#f43f5e', sidebar: '#fff5f5', dark: false },
        29: { bg: '#0d9488', sidebar: '#f0fdfa', dark: false },
        30: { bg: '#475569', sidebar: '#1e293b', dark: true  },
        31: { bg: '#4f46e5', sidebar: '#4f46e5', dark: true  },
        32: { bg: '#1a2a4a', sidebar: '#f5f0e8', dark: false },
        33: { bg: '#1a3a4a', sidebar: '#1a3a4a', dark: true  },
        34: { bg: '#1e2d40', sidebar: '#1e2d40', dark: true  },
        35: { bg: '#1d3557', sidebar: '#1d3557', dark: true  },
        36: { bg: '#2d4a3e', sidebar: '#4a6e5c', dark: true  },
        37: { bg: '#374151', sidebar: '#f9fafb', dark: false },
        38: { bg: '#2d3f6c', sidebar: '#2d3f6c', dark: true  },
        39: { bg: '#00bcd4', sidebar: '#fff',    dark: false },
        40: { bg: '#3d4d8a', sidebar: '#3d4d8a', dark: true  },
        41: { bg: '#1d3557', sidebar: '#f5f7fa', dark: false },
        42: { bg: '#1d3557', sidebar: '#1d3557', dark: true  },
        43: { bg: '#2d2d2d', sidebar: '#2d2d2d', dark: true  },
        44: { bg: '#2563eb', sidebar: '#ffffff', dark: false },
        45: { bg: '#c9a065', sidebar: '#faf8f4', dark: false },
        46: { bg: '#1a5f5a', sidebar: '#2c7a6e', dark: true  },
        47: { bg: '#1a5fb4', sidebar: '#f5f7fa', dark: false },
        48: { bg: '#00b3c6', sidebar: '#ffffff', dark: false },
        49: { bg: '#2563eb', sidebar: '#f5f7fa', dark: false },
        50: { bg: '#2d3748', sidebar: '#1a202c', dark: true  },
        51: { bg: '#1a1a2e', sidebar: '#ffffff', dark: false },
        52: { bg: '#1a1a2e', sidebar: '#ffffff', dark: false },
    };
    const theme = themeMap[num] || { bg: '#1e3a5f', sidebar: '#1e3a5f', dark: true };
    const accent = color || theme.bg;
    const sidebarBg = theme.dark ? accent : theme.sidebar;
    const sidebarText = theme.dark ? 'rgba(255,255,255,0.9)' : '#374151';
    const sidebarMuted = theme.dark ? 'rgba(255,255,255,0.55)' : '#6b7280';

    const name    = d.fullName       || '';
    const title   = d.jobTitle       || '';
    const email   = d.email          || '';
    const phone   = d.phone          || '';
    const addr    = d.address || d.location || '';
    const website = d.website        || '';
    const linkedin= d.linkedin       || '';
    const summary = d.profileSummary || '';

    const photoSize = d.photoSize || 88;
    const photoBR = d.photoShape === 'square' ? '8px' : '50%';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBR};object-fit:cover;border:3px solid rgba(255,255,255,0.35);cursor:pointer;display:block;margin:0 auto 10px;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : '';

    const skillsList = skills.length
        ? skills.map(s => {
            const sn = typeof s === 'string' ? s : (s.name || s.skill || '');
            const pct = (typeof s === 'object' && typeof s.level === 'number') ? s.level : 80;
            return `<div style="margin-bottom:7px;">
              <div style="font-size:10px;color:${sidebarText};margin-bottom:2px;display:flex;justify-content:space-between;"><span>${sn}</span><span style="font-size:9px;opacity:0.65;">${pct}%</span></div>
              <div style="height:4px;background:rgba(255,255,255,0.2);border-radius:2px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:rgba(255,255,255,0.75);border-radius:2px;"></div>
              </div></div>`;
          }).join('')
        : '';

    const eduHTML = edu.length
        ? edu.map(e => `<div style="margin-bottom:12px;">
            <div style="font-size:12px;font-weight:700;color:#1a1a2e;">${e.degree||''}</div>
            <div style="font-size:11px;color:#555;">${e.school||e.university||''}</div>
            <div style="font-size:10px;color:#9ca3af;">${e.year||e.from||''}</div>
          </div>`).join('')
        : '';

    const expHTML = experience.length
        ? experience.map(e => `<div style="margin-bottom:16px;">
            <div style="font-size:13px;font-weight:700;color:${accent};">${e.jobTitle||e.role||e.title||''} — ${e.company||''}</div>
            <div style="font-size:11px;color:#888;margin-bottom:4px;">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>
            <div style="font-size:12px;color:#374151;line-height:1.65;">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div>
          </div>`).join('')
        : '';

    const projectsHTML = projects.length
        ? projects.map(p => `<div style="margin-bottom:12px;">
            <div style="font-size:12px;font-weight:700;color:${accent};">${p.title||p.name||''}</div>
            ${p.tools ? `<div style="font-size:11px;color:#888;">Tools: ${p.tools}</div>` : ''}
            <div style="font-size:11px;color:#374151;line-height:1.6;">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
          </div>`).join('')
        : '';

    const secHead = (t) => `<div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid ${accent};padding-bottom:3px;margin:16px 0 10px;">${t}</div>`;
    const sdHead  = (t) => `<div style="font-size:10px;font-weight:800;color:${theme.dark?'rgba(255,255,255,0.7)':'#6b7280'};text-transform:uppercase;letter-spacing:1px;margin:14px 0 7px;">${t}</div>`;

    return `<div style="display:flex;min-height:1040px;font-family:inherit;background:#fff;width:660px;">
      <!-- SIDEBAR -->
      <div style="width:210px;flex-shrink:0;background:${sidebarBg};padding:24px 16px;display:flex;flex-direction:column;align-items:center;">
        ${photoHTML ? `<div class="editable-field" style="cursor:pointer;text-align:center;" ${editBtn('profilePhoto','Profile Photo','')}>
          ${photoHTML}
        </div>` : ''}
        <div class="editable-field" style="font-size:18px;font-weight:900;color:${theme.dark?'#fff':'#1a1a2e'};text-align:center;margin-bottom:3px;cursor:pointer;width:100%;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name} <span class="edit-pen" style="font-size:12px;">✏</span></div>
        <div class="editable-field" style="font-size:11px;color:${sidebarMuted};text-align:center;margin-bottom:16px;cursor:pointer;width:100%;" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}>${title} <span class="edit-pen">✏</span></div>

        ${sdHead('Contact')}
        <div style="width:100%;font-size:10px;color:${sidebarText};line-height:2;">
          ${phone    ? `<div class="editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',d.phone||'')}>📞 ${phone} <span class="edit-pen">✏</span></div>` : ''}
          ${email    ? `<div class="editable-field" style="cursor:pointer;word-break:break-all;" ${editBtn('email','Email',d.email||'')}>✉ ${email} <span class="edit-pen">✏</span></div>` : ''}
          ${addr     ? `<div class="editable-field" style="cursor:pointer;" ${editBtn('address','Address',d.address||'')}>📍 ${addr} <span class="edit-pen">✏</span></div>` : ''}
          ${linkedin ? `<div class="editable-field" style="cursor:pointer;word-break:break-all;" ${editBtn('linkedin','LinkedIn',d.linkedin||'')}>🔗 ${linkedin} <span class="edit-pen">✏</span></div>` : ''}
          ${website  ? `<div class="editable-field" style="cursor:pointer;word-break:break-all;" ${editBtn('website','Website',d.website||'')}>🌐 ${website} <span class="edit-pen">✏</span></div>` : ''}
          ${!phone && !email && !addr ? `<div style="font-size:10px;color:${sidebarMuted};cursor:pointer;" ${editBtn('phone','Phone','')}>Add contact ✏</div>` : ''}
        </div>

        ${sdHead('Skills')}
        <div class="editable-field" style="width:100%;cursor:pointer;" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>
          ${skillsList || `<div style="font-size:10px;color:${sidebarMuted};">Add skills ✏</div>`}
          <span class="edit-pen" style="font-size:10px;color:${sidebarMuted};">✏</span>
        </div>

        ${sdHead('Education')}
        <div class="section-block editable-field" style="width:100%;cursor:pointer;font-size:10px;color:${sidebarText};" ${editBtn('educationJson','Education','')}>
          ${edu.length ? edu.map(e=>`<div style="margin-bottom:8px;"><div style="font-weight:700;">${e.degree||''}</div><div style="opacity:0.75;">${e.school||e.university||''}</div><div style="opacity:0.55;font-size:9px;">${e.year||''}</div></div>`).join('') : `<div style="color:${sidebarMuted};">Add education ✏</div>`}
          <span class="edit-pen">✏</span>
        </div>

        ${d.languages ? `${sdHead('Languages')}<div class="editable-field" style="width:100%;font-size:10px;color:${sidebarText};cursor:pointer;line-height:1.9;" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div>● ${l.trim()}</div>`).join('')} <span class="edit-pen">✏</span></div>` : ''}
      </div>

      <!-- MAIN CONTENT -->
      <div style="flex:1;padding:20px 18px;background:#fff;min-width:0;">
        ${summary ? `${secHead('Profile Summary')}<div class="editable-field section-block" style="font-size:12px;color:#555;line-height:1.7;cursor:pointer;" ${editBtn('profileSummary','Profile Summary',d.profileSummary||'')}>${summary} <span class="edit-pen">✏</span></div>` : ''}

        ${secHead('Experience')}
        <div class="section-block" id="rv-experience-section">
          <div class="editable-field" ${editBtn('experienceJson','Experience','')}>
            ${expHTML || `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add work experience ✏</div>`}
            <span class="edit-pen" style="font-size:10px;">✏</span>
          </div>
        </div>

        ${projects.length ? `${secHead('Projects')}<div class="section-block" id="rv-projects-section"><div class="editable-field" ${editBtn('projectsJson','Projects','')}>
          ${projectsHTML} <span class="edit-pen">✏</span></div></div>` : ''}

        ${d.certifications ? `${secHead('Certifications')}<div class="editable-field section-block" style="font-size:12px;color:#374151;line-height:1.7;cursor:pointer;" ${editBtn('certifications','Certifications',d.certifications||'')}>${d.certifications} <span class="edit-pen">✏</span></div>` : ''}

        ${d.awards ? `${secHead('Awards & Honors')}<div class="editable-field section-block" style="font-size:12px;color:#374151;line-height:1.7;cursor:pointer;" ${editBtn('awards','Awards',d.awards||'')}>${d.awards} <span class="edit-pen">✏</span></div>` : ''}

        ${buildExtraSections(accent)}
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 32: CREAM NAVY GOLD (resume-t32)
// ============================================================
function buildTemplate32Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#c9a84c';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const linkedin= d.linkedin || '';
    const website = d.website || '';
    const summary = d.profileSummary || '';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:4px solid ${accent};display:block;margin:0 auto;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t32-photo-wrap" style="background:${accent};cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${(name||'?').charAt(0).toUpperCase()}</div>`;
    const skillsHTML = skills.length ? skills.map(s=>{const sn=typeof s==='string'?s:(s.name||s.skill||'');return `<div class="t32-skill-bullet">${sn}</div>`;}).join('') : '<div style="font-size:10px;color:rgba(255,255,255,0.5);">Add skills</div>';
    const expHTML = experience.length ? experience.map(e=>`<div style="margin-bottom:10px;"><div class="t32-exp-yr">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div><div class="t32-exp-co">${e.company||''}</div><div class="t32-exp-role">${e.jobTitle||e.role||''}</div></div>`).join('') : '';
    const eduHTML2 = edu.length ? edu.map(e=>`<div class="t32-edu-item"><div class="t32-edu-deg">${e.degree||''}</div><div class="t32-edu-uni">${e.school||e.university||''}</div><div class="t32-edu-yr">${e.year||''}</div></div>`).join('') : '';
    return `<div class="resume-t32">
  <div class="t32-left">
    <div class="t32-deco-tl"></div>
    <div class="t32-name editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div class="t32-role editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    <div class="t32-sec-title-l">Contact</div>
    ${phone?`<div class="t32-contact-item editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone}</div>`:''}
    ${email?`<div class="t32-contact-item editable-field" ${editBtn('email','Email',email)}>✉ ${email}</div>`:''}
    ${addr?`<div class="t32-contact-item editable-field" ${editBtn('address','Address',addr)}>📍 ${addr}</div>`:''}
    ${linkedin?`<div class="t32-contact-item editable-field" ${editBtn('linkedin','LinkedIn',linkedin)}>🔗 ${linkedin}</div>`:''}
    ${website?`<div class="t32-contact-item editable-field" ${editBtn('website','Website',website)}>🌐 ${website}</div>`:''}
    ${edu.length?`<div class="t32-sec-title-l">Education</div>${eduHTML2}`:''}
  </div>
  <div class="t32-right">
    <div style="text-align:center;margin-bottom:10px;">${photoHTML}</div>
    <div class="t32-r-sec-title" style="color:${accent};">Profile</div>
    <div class="t32-about editable-field section-block" ${editBtn('profileSummary','Profile Summary',summary)}>${summary||'Add your profile summary.'} <span class="edit-pen">✏</span></div>
    ${skills.length?`<div class="t32-skill-group-title">Skills</div><div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skillsHTML}</div>`:''}
    ${experience.length?`<div class="t32-r-sec-title" style="color:${accent};">Experience</div><div class="section-block editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>`:''}
    ${projects.length?`<div class="t32-r-sec-title" style="color:${accent};">Projects</div><div class="section-block editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div style="margin-bottom:10px;"><div style="font-weight:700;color:${accent};font-size:11px;">${p.title||p.name||''}</div>${p.tools?`<div style="font-size:10px;color:rgba(255,255,255,0.7);">Tools: ${p.tools}</div>`:''}<div style="font-size:10px;color:rgba(255,255,255,0.8);">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div></div>`).join('')}</div>`:''}
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 33: NAVY HEADER 2-COL (resume-t33)
// ============================================================
function buildTemplate33Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#1a3a4a';
    const name=d.fullName||''; const title=d.jobTitle||''; const email=d.email||''; const phone=d.phone||''; const addr=d.address||d.location||''; const linkedin=d.linkedin||''; const summary=d.profileSummary||'';
    const photoHTML = d.profilePhotoData ? `<img src="${d.profilePhotoData}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid #fff;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>` : `<div class="t33-photo-wrap" style="background:${accent}88;">${(name||'?').charAt(0).toUpperCase()}</div>`;
    const expHTML = experience.length ? experience.map(e=>`<div class="t33-job"><div class="t33-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div><div class="t33-job-group-title" style="color:${accent};">${e.jobTitle||e.role||''} @ ${e.company||''}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t33-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('') : '';
    const eduHTML2 = edu.length ? edu.map(e=>`<div class="t33-edu-item"><div class="t33-edu-org" style="color:${accent};">${e.school||e.university||''}</div><div class="t33-edu-deg">${e.degree||''}</div><div class="t33-edu-yr">${e.year||''}</div></div>`).join('') : '';
    const skillsHTML = skills.length ? skills.map(s=>`<div class="t33-comp-item">${typeof s==='string'?s:(s.name||s.skill||'')}</div>`).join('') : '';
    return `<div class="resume-t33">
  <div class="t33-header" style="background:${accent};">
    <div class="t33-header-top">
      ${photoHTML}
      <div>
        <div class="t33-name editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
        <div class="t33-title editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      </div>
    </div>
    <div class="t33-tagline"><span class="t33-tag-item">${title||'Your Title'}</span></div>
  </div>
  <div class="t33-body">
    <div class="t33-left">
      <div class="t33-sec-title" style="color:${accent};">Contact</div>
      ${phone?`<div class="t33-contact-item editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone}</div>`:''}
      ${email?`<div class="t33-contact-item editable-field" ${editBtn('email','Email',email)}>✉ ${email}</div>`:''}
      ${addr?`<div class="t33-contact-item editable-field" ${editBtn('address','Address',addr)}>📍 ${addr}</div>`:''}
      ${linkedin?`<div class="t33-contact-item editable-field" ${editBtn('linkedin','LinkedIn',linkedin)}>🔗 ${linkedin}</div>`:''}
      ${edu.length?`<div class="t33-sec-title" style="color:${accent};margin-top:14px;">Education</div>${eduHTML2}`:''}
      ${skills.length?`<div class="t33-sec-title" style="color:${accent};margin-top:14px;">Skills</div>${skillsHTML}`:''}
    </div>
    <div class="t33-right">
      ${summary?`<div class="t33-sec-title" style="color:${accent};">Profile</div><div class="t33-profile-text editable-field section-block" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
      ${experience.length?`<div class="t33-sec-title" style="color:${accent};margin-top:14px;">Experience</div><div class="section-block editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>`:''}
      ${projects.length?`<div class="t33-sec-title" style="color:${accent};margin-top:14px;">Projects</div><div class="section-block editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t33-job"><div class="t33-job-group-title" style="color:${accent};">${p.title||p.name||''}</div><div class="t33-comp-item">Tools: ${p.tools||''}</div></div>`).join('')}</div>`:''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 34: DARK HEADER MODERN (resume-t34)
// ============================================================
function buildTemplate34Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#1e2d40';
    const name=d.fullName||''; const title=d.jobTitle||''; const email=d.email||''; const phone=d.phone||''; const addr=d.address||d.location||''; const linkedin=d.linkedin||''; const website=d.website||''; const summary=d.profileSummary||'';
    const photoHTML = d.profilePhotoData ? `<img src="${d.profilePhotoData}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid #fff;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>` : `<div class="t34-photo" style="background:${accent}88;">${(name||'?').charAt(0).toUpperCase()}</div>`;
    const contactStrip = [phone,email,addr,linkedin,website].filter(Boolean).map(c=>`<div class="t34-contact-strip-item">● ${c}</div>`).join('');
    const expHTML = experience.length ? experience.map(e=>`<div class="t34-job"><div class="t34-job-head"><span class="t34-job-title" style="color:${accent};">${e.jobTitle||e.role||''}</span><span class="t34-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</span></div><div class="t34-job-co">${e.company||''}</div><div class="t34-job-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join(' ')}</div></div>`).join('') : '';
    const eduHTML2 = edu.length ? edu.map(e=>`<div class="t34-edu-item"><div class="t34-edu-deg" style="color:${accent};">${e.degree||''}</div><div class="t34-edu-uni">${e.school||e.university||''}</div><div class="t34-edu-yr">${e.year||''}</div></div>`).join('') : '';
    const skillsHTML = skills.length ? skills.map(s=>`<div class="t34-skill-item">${typeof s==='string'?s:(s.name||s.skill||'')}</div>`).join('') : '';
    return `<div class="resume-t34">
  <div class="t34-top" style="background:${accent};">
    <div class="t34-top-inner">
      ${photoHTML}
      <div>
        <div class="t34-name editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
        <div class="t34-role editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      </div>
    </div>
  </div>
  <div class="t34-contact-strip" style="background:${accent}dd;">${contactStrip||`<div class="t34-contact-strip-item">Add contact info</div>`}</div>
  <div class="t34-body">
    <div class="t34-left">
      ${eduHTML2?`<div class="t34-sec-title-l" style="border-color:${accent};color:${accent};">Education</div>${eduHTML2}`:''}
      ${skillsHTML?`<div class="t34-sec-title-l" style="border-color:${accent};color:${accent};">Skills</div>${skillsHTML}`:''}
      ${d.languages?`<div class="t34-sec-title-l" style="border-color:${accent};color:${accent};">Languages</div>${d.languages.split(',').map(l=>`<div class="t34-lang-item">${l.trim()}</div>`).join('')}`:''}
    </div>
    <div class="t34-right">
      ${summary?`<div class="t34-sec-title-r" style="color:${accent};border-color:${accent};">About</div><div class="t34-about-text editable-field section-block" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
      ${experience.length?`<div class="t34-sec-title-r" style="color:${accent};border-color:${accent};">Experience</div><div class="section-block editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>`:''}
      ${projects.length?`<div class="t34-sec-title-r" style="color:${accent};border-color:${accent};">Projects</div><div class="section-block editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t34-job"><div class="t34-job-title" style="color:${accent};">${p.title||p.name||''}</div><div class="t34-job-co">${p.tools||''}</div></div>`).join('')}</div>`:''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 35: NAVY BOLD 2-PANEL (resume-t35)
// ============================================================
function buildTemplate35Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#1d3557';
    const name=d.fullName||''; const title=d.jobTitle||''; const email=d.email||''; const phone=d.phone||''; const addr=d.address||d.location||''; const linkedin=d.linkedin||''; const summary=d.profileSummary||'';
    const photoHTML = d.profilePhotoData ? `<img src="${d.profilePhotoData}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:4px solid rgba(255,255,255,0.3);position:absolute;right:24px;top:14px;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>` : `<div class="t35-header-photo" style="background:${accent}99;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${(name||'?').charAt(0).toUpperCase()}</div>`;
    const expHTML = experience.length ? experience.map(e=>`<div class="t35-job"><span class="t35-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</span><div class="t35-job-title">${e.jobTitle||e.role||''}</div><div class="t35-exp-co-big" style="color:${accent};">${e.company||''}</div><div class="t35-bullet">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join(' ')}</div></div>`).join('') : '';
    const eduHTML2 = edu.length ? edu.map(e=>`<div class="t35-edu-item"><div class="t35-edu-org" style="color:${accent};">${e.school||e.university||''}</div><div class="t35-edu-deg">${e.degree||''}</div><div class="t35-edu-yr">${e.year||''}</div></div>`).join('') : '';
    const skillsHTML = skills.length ? skills.map(s=>`<div class="t35-skill-item">${typeof s==='string'?s:(s.name||s.skill||'')}</div>`).join('') : '';
    return `<div class="resume-t35">
  <div class="t35-header" style="background:${accent};">
    <div class="t35-header-left">
      <div class="t35-name-big editable-field" ${editBtn('fullName','Full Name',name)}><span>${name}</span></div>
      <div class="t35-job-title editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    </div>
    ${photoHTML}
  </div>
  <div class="t35-body">
    <div class="t35-left">
      <div class="t35-sec-badge" style="background:${accent};">Contact</div>
      ${phone?`<div class="t35-contact-item editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone}</div>`:''}
      ${email?`<div class="t35-contact-item editable-field" ${editBtn('email','Email',email)}>✉ ${email}</div>`:''}
      ${addr?`<div class="t35-contact-item editable-field" ${editBtn('address','Address',addr)}>📍 ${addr}</div>`:''}
      ${linkedin?`<div class="t35-contact-item editable-field" ${editBtn('linkedin','LinkedIn',linkedin)}>🔗 ${linkedin}</div>`:''}
      ${eduHTML2?`<div class="t35-sec-badge" style="background:${accent};margin-top:12px;">Education</div>${eduHTML2}`:''}
      ${skillsHTML?`<div class="t35-sec-badge" style="background:${accent};margin-top:12px;">Skills</div>${skillsHTML}`:''}
    </div>
    <div class="t35-right">
      ${summary?`<div class="t35-about">${summary}</div>`:''}
      ${experience.length?`<div class="t35-sec-title-r" style="color:${accent};">Experience</div><div class="section-block editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>`:''}
      ${projects.length?`<div class="t35-sec-title-r" style="color:${accent};margin-top:14px;">Projects</div><div class="section-block editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t35-job"><div class="t35-job-title">${p.title||p.name||''}</div><div style="font-size:10px;color:#888;">${p.tools||''}</div></div>`).join('')}</div>`:''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 36: TEAL FOREST SIDEBAR (resume-t36)
// ============================================================
function buildTemplate36Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#2d4a3e';
    const accentLight = color ? color + '99' : '#4a6e5c';
    const name=d.fullName||''; const title=d.jobTitle||''; const email=d.email||''; const phone=d.phone||''; const addr=d.address||d.location||''; const linkedin=d.linkedin||''; const summary=d.profileSummary||'';
    const photoHTML = d.profilePhotoData ? `<img src="${d.profilePhotoData}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.4);display:block;margin:0 auto 12px;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>` : `<div class="t36-photo" style="background:${accent}cc;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${(name||'?').charAt(0).toUpperCase()}</div>`;
    const expHTML = experience.length ? experience.map(e=>`<div class="t36-job"><div class="t36-exp-yr" style="color:${accent};">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div><div class="t36-exp-co">${e.company||''}</div><div class="t36-exp-role">${e.jobTitle||e.role||''}</div><div class="t36-exp-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join(' ')}</div></div>`).join('') : '';
    const eduHTML2 = edu.length ? edu.map(e=>`<div class="t36-edu-item-l"><div class="t36-edu-deg-l">${e.degree||''}</div><div class="t36-edu-uni-l">${e.school||e.university||''}</div><div class="t36-edu-yr-l">${e.year||''}</div></div>`).join('') : '';
    const skillsHTML = skills.length ? skills.map(s=>`<div class="t36-skill-item-l">${typeof s==='string'?s:(s.name||s.skill||'')}</div>`).join('') : '';
    return `<div class="resume-t36">
  <div class="t36-left">
    <div class="t36-left-top" style="background:${accent};">
      ${photoHTML}
      ${phone?`<div class="t36-contact-item-l">📞 ${phone}</div>`:''}
      ${email?`<div class="t36-contact-item-l">✉ ${email}</div>`:''}
      ${addr?`<div class="t36-contact-item-l">📍 ${addr}</div>`:''}
      ${linkedin?`<div class="t36-contact-item-l">🔗 ${linkedin}</div>`:''}
    </div>
    <div class="t36-left-body" style="background:${accentLight};">
      ${skillsHTML?`<div class="t36-sec-title-l">Skills</div>${skillsHTML}`:''}
      ${eduHTML2?`<div class="t36-sec-title-l">Education</div>${eduHTML2}`:''}
      ${d.languages?`<div class="t36-sec-title-l">Languages</div>${d.languages.split(',').map(l=>`<div class="t36-interest-item">${l.trim()}</div>`).join('')}`:''}
    </div>
  </div>
  <div class="t36-right">
    <div class="t36-name editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div class="t36-role editable-field" style="color:${accent};" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    ${summary?`<div class="t36-sec-title-r">Profile</div><div class="t36-about editable-field section-block" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
    ${experience.length?`<div class="t36-sec-title-r">Experience</div><div class="section-block editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>`:''}
    ${projects.length?`<div class="t36-sec-title-r">Projects</div><div class="section-block editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t36-job"><div class="t36-exp-co">${p.title||p.name||''}</div><div class="t36-exp-role">${p.tools||''}</div></div>`).join('')}</div>`:''}
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 37: ATS CLASSIC WHITE (resume-t37)
// ============================================================
function buildTemplate37Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#374151';
    const name=d.fullName||''; const title=d.jobTitle||''; const email=d.email||''; const phone=d.phone||''; const addr=d.address||d.location||''; const linkedin=d.linkedin||''; const website=d.website||''; const summary=d.profileSummary||'';
    const contactItems = [phone,email,addr,linkedin,website].filter(Boolean).map(c=>`<div class="t37-contact-item">● ${c}</div>`).join('');
    const expHTML = experience.length ? experience.map(e=>`<div class="t37-job"><div class="t37-job-title">${e.jobTitle||e.role||''}</div><div class="t37-job-co">${e.company||''} | ${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t37-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('') : '';
    const eduHTML2 = edu.length ? edu.map(e=>`<div class="t37-tl-item"><div class="t37-tl-dot"></div><div class="t37-tl-content"><div class="t37-tl-title">${e.degree||''}</div><div class="t37-tl-sub">${e.school||e.university||''} | ${e.year||''}</div></div></div>`).join('') : '';
    const skillsHTML = skills.length ? `<div class="t37-skill-cols"><div>${skills.map(s=>`<div class="t37-skill-item">${typeof s==='string'?s:(s.name||s.skill||'')}</div>`).join('')}</div></div>` : '';
    return `<div class="resume-t37">
  <div class="t37-top">
    <div class="t37-name editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div class="t37-contact-row">${contactItems}</div>
  </div>
  ${summary?`<div class="t37-bio-sec"><div class="t37-bio-title">Profile</div><div class="t37-bio-text editable-field section-block" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div></div>`:''}
  <div class="t37-body">
    <div class="t37-left">
      ${eduHTML2?`<div class="t37-sec-title">Education</div>${eduHTML2}`:''}
      ${skillsHTML?`<div class="t37-sec-title">Skills</div>${skillsHTML}`:''}
      ${d.languages?`<div class="t37-sec-title">Languages</div>${d.languages.split(',').map(l=>`<div class="t37-skill-item">${l.trim()}</div>`).join('')}`:''}
    </div>
    <div class="t37-right">
      ${experience.length?`<div class="t37-sec-title">Experience</div><div class="section-block editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>`:''}
      ${projects.length?`<div class="t37-sec-title">Projects</div><div class="section-block editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t37-job"><div class="t37-job-title">${p.title||p.name||''}</div><div class="t37-job-co">${p.tools||''}</div></div>`).join('')}</div>`:''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 38: INDIGO SPLIT PRO (resume-t38)
// ============================================================
function buildTemplate38Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#2d3f6c';
    const name=d.fullName||''; const title=d.jobTitle||''; const email=d.email||''; const phone=d.phone||''; const addr=d.address||d.location||''; const linkedin=d.linkedin||''; const summary=d.profileSummary||'';
    const photoHTML = d.profilePhotoData ? `<img src="${d.profilePhotoData}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.35);margin-bottom:10px;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>` : `<div class="t38-photo" style="background:${accent}99;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${(name||'?').charAt(0).toUpperCase()}</div>`;
    const expHTML = experience.length ? experience.map(e=>`<div class="t38-job"><div class="t38-job-title">${e.jobTitle||e.role||''}</div><div class="t38-job-co">${e.company||''} | ${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t38-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('') : '';
    const eduHTML2 = edu.length ? edu.map(e=>`<div class="t38-edu-item"><div class="t38-edu-deg">${e.degree||''}</div><div class="t38-edu-uni">${e.school||e.university||''}</div><div class="t38-edu-yr">${e.year||''}</div></div>`).join('') : '';
    const skillsHTML = skills.length ? skills.map(s=>`<div class="t38-skill-item-l">${typeof s==='string'?s:(s.name||s.skill||'')}</div>`).join('') : '';
    return `<div class="resume-t38">
  <div class="t38-left" style="background:${accent};">
    <div class="t38-left-top">
      ${photoHTML}
      <div class="t38-name-l editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen" style="font-size:10px;">✏</span></div>
      <div class="t38-role-l editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen" style="font-size:10px;">✏</span></div>
    </div>
    <div class="t38-left-contact">
      ${phone?`<div class="t38-contact-item-l">📞 ${phone}</div>`:''}
      ${email?`<div class="t38-contact-item-l">✉ ${email}</div>`:''}
      ${addr?`<div class="t38-contact-item-l">📍 ${addr}</div>`:''}
      ${linkedin?`<div class="t38-contact-item-l">🔗 ${linkedin}</div>`:''}
    </div>
    ${skillsHTML?`<div class="t38-sec-title-l">Skills</div>${skillsHTML}`:''}
    ${eduHTML2?`<div class="t38-sec-title-l">Education</div>${eduHTML2}`:''}
    ${d.languages?`<div class="t38-sec-title-l">Languages</div>${d.languages.split(',').map(l=>`<div class="t38-lang-item">${l.trim()}</div>`).join('')}`:''}
  </div>
  <div class="t38-right">
    <div class="t38-divider"></div>
    ${summary?`<div class="t38-sec-title-r" style="color:${accent};"><div class="t38-sec-icon" style="background:${accent};">👤</div>Profile</div><div class="t38-about-text editable-field section-block" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
    ${experience.length?`<div class="t38-sec-title-r" style="color:${accent};"><div class="t38-sec-icon" style="background:${accent};">💼</div>Experience</div><div class="section-block editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>`:''}
    ${projects.length?`<div class="t38-sec-title-r" style="color:${accent};"><div class="t38-sec-icon" style="background:${accent};">🔗</div>Projects</div><div class="section-block editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t38-job"><div class="t38-job-title">${p.title||p.name||''}</div><div class="t38-job-co">${p.tools||''}</div></div>`).join('')}</div>`:''}
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 39: DARK SPLIT DEV (resume-t39)
// ============================================================
function buildTemplate39Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#00bcd4';
    const name=d.fullName||''; const title=d.jobTitle||''; const email=d.email||''; const phone=d.phone||''; const addr=d.address||d.location||''; const linkedin=d.linkedin||''; const summary=d.profileSummary||'';
    const expHTML = experience.length ? experience.map(e=>`<div class="t39-exp-item"><div class="t39-exp-left"><span class="t39-exp-date">${e.startDate||e.from||''}</span><span class="t39-exp-org">${e.company||''}</span></div><div class="t39-exp-right"><div class="t39-exp-title">${e.jobTitle||e.role||''}</div><div class="t39-exp-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join(' ')}</div></div></div>`).join('') : '';
    const eduHTML2 = edu.length ? edu.map(e=>`<div class="t39-exp-item"><div class="t39-exp-left"><span class="t39-exp-date">${e.year||''}</span></div><div class="t39-exp-right"><div class="t39-exp-title">${e.degree||''}</div><div style="font-size:10px;color:#555;">${e.school||e.university||''}</div></div></div>`).join('') : '';
    const skillsHTML = skills.length ? skills.map(s=>{const sn=typeof s==='string'?s:(s.name||s.skill||'');const pct=(typeof s==='object'&&typeof s.level==='number')?s.level:80;return `<div class="t39-skill-bar-row"><div class="t39-skill-name">${sn}</div><div class="t39-skill-track"><div class="t39-skill-fill" style="width:${pct}%;background:${accent};"></div></div></div>`;}).join('') : '';
    return `<div class="resume-t39">
  <div class="t39-left">
    <div class="t39-name editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div class="t39-role editable-field" style="color:${accent};" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    ${eduHTML2?`<div class="t39-sec-title-l" style="color:#1a1a1a;border-color:#e5e7eb;">Education</div>${eduHTML2}`:''}
    ${d.languages?`<div class="t39-sec-title-l" style="color:#1a1a1a;border-color:#e5e7eb;">Languages</div>${d.languages.split(',').map(l=>`<div style="font-size:10px;color:#555;margin-bottom:3px;">${l.trim()}</div>`).join('')}`:''}
  </div>
  <div class="t39-right" style="background:#3a3a3a;">
    <div class="t39-contact-row">
      ${phone?`<div class="t39-contact-item">📞 ${phone}</div>`:''}
      ${email?`<div class="t39-contact-item">✉ ${email}</div>`:''}
      ${addr?`<div class="t39-contact-item">📍 ${addr}</div>`:''}
      ${linkedin?`<div class="t39-contact-item">🔗 ${linkedin}</div>`:''}
    </div>
    ${summary?`<div class="t39-sec-title-r">Profile</div><div class="t39-about-text editable-field section-block" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
    ${skillsHTML?`<div class="t39-sec-title-r">Skills</div><div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skillsHTML}</div>`:''}
    ${experience.length?`<div class="t39-sec-title-r">Experience</div><div class="section-block editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>`:''}
    ${projects.length?`<div class="t39-sec-title-r">Projects</div><div class="section-block editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t39-exp-item"><div class="t39-exp-right"><div class="t39-exp-title">${p.title||p.name||''}</div><div class="t39-exp-desc">${p.tools||''}</div></div></div>`).join('')}</div>`:''}
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 40: CLEAN NAVY STRIP (resume-t40)
// ============================================================
function buildTemplate40Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#3d4d8a';
    const name=d.fullName||''; const title=d.jobTitle||''; const email=d.email||''; const phone=d.phone||''; const addr=d.address||d.location||''; const linkedin=d.linkedin||''; const summary=d.profileSummary||'';
    const contactItems = [phone,email,addr,linkedin].filter(Boolean).map(c=>`<div class="t40-contact-item">● ${c}</div>`).join('');
    const expHTML = experience.length ? experience.map(e=>`<div class="t40-job"><div class="t40-exp-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div><div class="t40-exp-co">${e.company||''}</div><div class="t40-exp-role">${e.jobTitle||e.role||''}</div><div class="t40-exp-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join(' ')}</div></div>`).join('') : '';
    const eduHTML2 = edu.length ? edu.map(e=>`<div class="t40-edu-item"><div class="t40-edu-deg">${e.degree||''}</div><div class="t40-edu-uni">${e.school||e.university||''}</div><div class="t40-edu-yr">${e.year||''}</div></div>`).join('') : '';
    const skillsHTML = skills.length ? skills.map(s=>`<div class="t40-skill-item"><div class="t40-skill-bullet" style="background:${accent};"></div>${typeof s==='string'?s:(s.name||s.skill||'')}</div>`).join('') : '';
    return `<div class="resume-t40">
  <div class="t40-top">
    <div class="t40-name editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div class="t40-role editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
  </div>
  <div class="t40-contact-strip" style="background:${accent};">${contactItems||`<div class="t40-contact-item">Add contact info</div>`}</div>
  <div class="t40-body">
    <div class="t40-left">
      ${eduHTML2?`<div class="t40-sec-title" style="color:${accent};">Education</div>${eduHTML2}`:''}
      ${skillsHTML?`<div class="t40-sec-title" style="color:${accent};">Skills</div>${skillsHTML}`:''}
      ${d.languages?`<div class="t40-sec-title" style="color:${accent};">Languages</div>${d.languages.split(',').map(l=>`<div class="t40-lang-item">${l.trim()}</div>`).join('')}`:''}
    </div>
    <div class="t40-right">
      ${summary?`<div class="t40-sec-title" style="color:${accent};">Profile</div><div class="t40-profile-text editable-field section-block" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
      ${experience.length?`<div class="t40-sec-title" style="color:${accent};">Experience</div><div class="section-block editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>`:''}
      ${projects.length?`<div class="t40-sec-title" style="color:${accent};">Projects</div><div class="section-block editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t40-job"><div class="t40-exp-co">${p.title||p.name||''}</div><div class="t40-exp-role">${p.tools||''}</div></div>`).join('')}</div>`:''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 41: BLUE GEO LIGHT (resume-t41)
// ============================================================
function buildTemplate41Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#1d3557';
    const name=d.fullName||''; const title=d.jobTitle||''; const email=d.email||''; const phone=d.phone||''; const addr=d.address||d.location||''; const linkedin=d.linkedin||''; const summary=d.profileSummary||'';
    const photoHTML = d.profilePhotoData ? `<img src="${d.profilePhotoData}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:4px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.15);position:relative;z-index:2;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>` : `<div class="t41-photo-wrap" style="background:${accent}88;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${(name||'?').charAt(0).toUpperCase()}</div>`;
    const expHTML = experience.length ? experience.map(e=>`<div class="t41-job"><div class="t41-exp-head"><span class="t41-exp-co" style="color:${accent};">${e.company||''}</span><span class="t41-exp-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</span></div><div class="t41-exp-role">${e.jobTitle||e.role||''}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t41-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('') : '';
    const eduHTML2 = edu.length ? edu.map(e=>`<div class="t41-edu-item"><div class="t41-edu-yr">${e.year||''}</div><div class="t41-edu-org" style="color:${accent};">${e.school||e.university||''}</div><div class="t41-edu-deg">${e.degree||''}</div></div>`).join('') : '';
    const skillsHTML = skills.length ? skills.map(s=>`<div class="t41-skill-item"><div class="t41-skill-bullet" style="background:${accent};"></div>${typeof s==='string'?s:(s.name||s.skill||'')}</div>`).join('') : '';
    return `<div class="resume-t41">
  <div class="t41-top">
    <div class="t41-top-bg" style="background:${accent};"></div>
    <div class="t41-top-accent" style="background:#00bcd4;"></div>
    <div style="margin:14px 0 0 16px;position:relative;z-index:2;">${photoHTML}</div>
    <div class="t41-header-info">
      <div class="t41-name editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      <div class="t41-title editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    </div>
  </div>
  <div class="t41-body">
    <div class="t41-left">
      <div class="t41-sec-title" style="color:${accent};border-color:${accent};">Contact</div>
      ${phone?`<div class="t41-contact-item editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone}</div>`:''}
      ${email?`<div class="t41-contact-item editable-field" ${editBtn('email','Email',email)}>✉ ${email}</div>`:''}
      ${addr?`<div class="t41-contact-item editable-field" ${editBtn('address','Address',addr)}>📍 ${addr}</div>`:''}
      ${linkedin?`<div class="t41-contact-item editable-field" ${editBtn('linkedin','LinkedIn',linkedin)}>🔗 ${linkedin}</div>`:''}
      ${eduHTML2?`<div class="t41-sec-title" style="color:${accent};border-color:${accent};margin-top:14px;">Education</div>${eduHTML2}`:''}
      ${skillsHTML?`<div class="t41-sec-title" style="color:${accent};border-color:${accent};margin-top:14px;">Skills</div>${skillsHTML}`:''}
    </div>
    <div class="t41-right">
      ${summary?`<div class="t41-sec-title" style="color:${accent};border-color:${accent};">Profile</div><div class="t41-profile-text editable-field section-block" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
      ${experience.length?`<div class="t41-sec-title" style="color:${accent};border-color:${accent};">Experience</div><div class="section-block editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>`:''}
      ${projects.length?`<div class="t41-sec-title" style="color:${accent};border-color:${accent};margin-top:14px;">Projects</div><div class="section-block editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t41-job"><div class="t41-exp-co" style="color:${accent};">${p.title||p.name||''}</div><div class="t41-exp-role">${p.tools||''}</div></div>`).join('')}</div>`:''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 42: NAVY TIMELINE PRO (resume-t42)
// ============================================================
function buildTemplate42Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#1d3557';
    const name=d.fullName||''; const title=d.jobTitle||''; const email=d.email||''; const phone=d.phone||''; const addr=d.address||d.location||''; const linkedin=d.linkedin||''; const summary=d.profileSummary||'';
    const photoHTML = d.profilePhotoData ? `<img src="${d.profilePhotoData}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.4);display:block;margin:0 auto 10px;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>` : `<div class="t42-photo" style="background:${accent}88;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${(name||'?').charAt(0).toUpperCase()}</div>`;
    const expHTML = experience.length ? experience.map(e=>`<div class="t42-tl-item"><div class="t42-tl-dot filled" style="border-color:${accent};background:${accent};"></div><div class="t42-exp-head"><span class="t42-exp-co" style="color:${accent};">${e.company||''}</span><span class="t42-exp-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</span></div><div class="t42-exp-role">${e.jobTitle||e.role||''}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t42-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('') : '';
    const eduHTML2 = edu.length ? edu.map(e=>`<div style="margin-bottom:9px;"><div style="font-size:10.5px;font-weight:700;color:${accent};">${e.degree||''}</div><div style="font-size:10px;color:#555;">${e.school||e.university||''}</div><div style="font-size:9.5px;color:#888;">${e.year||''}</div></div>`).join('') : '';
    const skillsHTML = skills.length ? skills.map(s=>`<div class="t42-skill-item"><div class="t42-skill-bullet" style="background:${accent};"></div>${typeof s==='string'?s:(s.name||s.skill||'')}</div>`).join('') : '';
    return `<div class="resume-t42">
  <div class="t42-left">
    <div class="t42-left-top" style="background:${accent};">
      ${photoHTML}
      <div class="t42-name-l editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen" style="font-size:10px;">✏</span></div>
      <div class="t42-role-l editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen" style="font-size:10px;">✏</span></div>
    </div>
    <div class="t42-left-body">
      <div class="t42-sec-title-l" style="color:${accent};border-color:${accent};">Contact</div>
      ${phone?`<div class="t42-contact-item editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone}</div>`:''}
      ${email?`<div class="t42-contact-item editable-field" ${editBtn('email','Email',email)}>✉ ${email}</div>`:''}
      ${addr?`<div class="t42-contact-item editable-field" ${editBtn('address','Address',addr)}>📍 ${addr}</div>`:''}
      ${linkedin?`<div class="t42-contact-item editable-field" ${editBtn('linkedin','LinkedIn',linkedin)}>🔗 ${linkedin}</div>`:''}
      ${skillsHTML?`<div class="t42-sec-title-l" style="color:${accent};border-color:${accent};">Skills</div>${skillsHTML}`:''}
      ${eduHTML2?`<div class="t42-sec-title-l" style="color:${accent};border-color:${accent};">Education</div>${eduHTML2}`:''}
    </div>
  </div>
  <div class="t42-right">
    ${summary?`<div class="t42-sec-title-r" style="color:${accent};">Profile</div><div class="t42-profile-text editable-field section-block" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
    ${experience.length?`<div class="t42-sec-title-r" style="color:${accent};">Experience</div><div class="t42-tl-wrap section-block editable-field" ${editBtn('experienceJson','Experience','')}><div class="t42-tl-line"></div>${expHTML}</div>`:''}
    ${projects.length?`<div class="t42-sec-title-r" style="color:${accent};">Projects</div><div class="section-block editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t42-tl-item"><div class="t42-tl-dot" style="border-color:${accent};"></div><div class="t42-exp-co" style="color:${accent};">${p.title||p.name||''}</div><div class="t42-exp-role">${p.tools||''}</div></div>`).join('')}</div>`:''}
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 43: CHARCOAL YELLOW GEO (resume-t43)
// ============================================================
function buildTemplate43Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#f5c842';
    const name=d.fullName||''; const title=d.jobTitle||''; const email=d.email||''; const phone=d.phone||''; const addr=d.address||d.location||''; const linkedin=d.linkedin||''; const summary=d.profileSummary||'';
    const photoHTML = d.profilePhotoData ? `<img src="${d.profilePhotoData}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid ${accent};display:block;margin:90px auto 14px;position:relative;z-index:2;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>` : `<div class="t43-photo-wrap" style="background:#6b8a9a;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${(name||'?').charAt(0).toUpperCase()}</div>`;
    const expHTML = experience.length ? experience.map(e=>`<div class="t43-tl-item"><div class="t43-tl-dot"></div><div class="t43-exp-head"><span class="t43-exp-co">${e.company||''}</span><span class="t43-exp-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</span></div><div class="t43-exp-role">${e.jobTitle||e.role||''}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t43-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('') : '';
    const skillsHTML = skills.length ? skills.map(s=>`<div class="t43-skill-item"><div class="t43-skill-bullet" style="background:${accent};"></div>${typeof s==='string'?s:(s.name||s.skill||'')}</div>`).join('') : '';
    const eduHTML2 = edu.length ? edu.map(e=>`<div style="margin-bottom:9px;"><div style="font-weight:700;font-size:10px;color:${accent};">${e.degree||''}</div><div style="font-size:9.5px;color:rgba(255,255,255,0.65);">${e.school||e.university||''}</div><div style="font-size:9px;color:rgba(255,255,255,0.5);">${e.year||''}</div></div>`).join('') : '';
    return `<div class="resume-t43">
  <div class="t43-left">
    <div class="t43-left-deco-y" style="background:${accent};"></div>
    <div class="t43-left-deco-gy"></div>
    <div class="t43-left-deco-y2" style="background:${accent};"></div>
    ${photoHTML}
    <div class="t43-left-body">
      <div class="t43-sec-title-l" style="color:${accent};">Contact</div>
      ${phone?`<div class="t43-contact-item">📞 ${phone}</div>`:''}
      ${email?`<div class="t43-contact-item">✉ ${email}</div>`:''}
      ${addr?`<div class="t43-contact-item">📍 ${addr}</div>`:''}
      ${linkedin?`<div class="t43-contact-item">🔗 ${linkedin}</div>`:''}
      ${skillsHTML?`<div class="t43-sec-title-l" style="color:${accent};">Skills</div>${skillsHTML}`:''}
      ${eduHTML2?`<div class="t43-sec-title-l" style="color:${accent};">Education</div>${eduHTML2}`:''}
    </div>
  </div>
  <div class="t43-right">
    <div class="t43-right-deco-gy"></div>
    <div class="t43-right-deco-y" style="background:${accent};opacity:0.5;"></div>
    <div class="t43-header-info">
      <div class="t43-name editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      <div class="t43-title editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    </div>
    ${summary?`<div class="t43-sec-title-r"><div class="t43-sec-icon" style="background:${accent};">👤</div>Profile</div><div class="t43-profile-text editable-field section-block" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`:''}
    ${experience.length?`<div class="t43-sec-title-r"><div class="t43-sec-icon" style="background:${accent};">💼</div>Experience</div><div class="t43-tl-wrap section-block editable-field" ${editBtn('experienceJson','Experience','')}><div class="t43-tl-line"></div>${expHTML}</div>`:''}
    ${projects.length?`<div class="t43-sec-title-r"><div class="t43-sec-icon" style="background:${accent};">🔗</div>Projects</div><div class="section-block editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t43-tl-item"><div class="t43-tl-dot"></div><div class="t43-exp-co">${p.title||p.name||''}</div><div class="t43-exp-role">${p.tools||''}</div></div>`).join('')}</div>`:''}
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 44: KATE BISHOP — Clean Minimal UX (exact resume-t44 design)
// Matches the actual template44 design from templates.html
// ============================================================
function buildTemplate44Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#2563eb';

    const name    = d.fullName       || 'Kate Bishop';
    const title   = d.jobTitle       || 'Product Designer';
    const email   = d.email          || 'email@example.com';
    const phone   = d.phone          || '000-000-0000';
    const linkedin= d.linkedin       || '';
    const summary = d.profileSummary || 'Add your professional summary here.';

    const photoSize = d.photoSize || 0; // t44 has no photo by default

    const contactHTML = [
        email   && `<div class="t44-contact-item editable-field" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>`,
        linkedin && `<div class="t44-contact-item editable-field" ${editBtn('linkedin','LinkedIn',linkedin)}>🔗 ${linkedin} <span class="edit-pen">✏</span></div>`,
        phone   && `<div class="t44-contact-item editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>`,
    ].filter(Boolean).join('');

    const skillsHTML = skills.length
        ? skills.map(s => `<div class="t44-skill-item">${s.name || s}</div>`).join('')
        : `<div class="t44-skill-item" style="color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `
            <div class="t44-sec-title-r section-block" id="rv-experience-section" style="font-size:12px;font-weight:800;color:#111;margin:0 0 4px;">${e.jobTitle||e.role||e.title||''}</div>
            <div class="t44-job-company editable-field" ${editBtn('experienceJson','Experience','')}>${e.company||''}, ${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'} <span class="edit-pen">✏</span></div>
            <div class="t44-job">
              ${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t44-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}
            </div>`).join('')
        : `<div class="t44-sec-title-r" style="color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add work experience ✏</div>`;

    const eduHTML = edu.length
        ? `<div class="t44-edu-section editable-field" ${editBtn('educationJson','Education','')}>
            ${edu.map(e=>`<div><div class="t44-edu-title">${e.degree||''}</div><div class="t44-edu-sub">${e.school||e.university||''}, ${e.year||''}</div></div>`).join('')}
           <span class="edit-pen">✏</span></div>`
        : `<div class="t44-edu-section"><div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div></div>`;

    return `<div class="resume-t44">
  <div class="t44-top">
    <div class="t44-name editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div class="t44-title editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    <div class="t44-bio editable-field" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
  </div>
  <div class="t44-body">
    <div class="t44-left">
      <div class="t44-sec-title-l">Contacts</div>
      ${contactHTML}
      <div class="t44-sec-title-l">Skills</div>
      <div class="editable-field" ${editBtn('skillsJson','Skills','')}>
        ${skillsHTML} <span class="edit-pen">✏</span>
      </div>
      ${d.languages ? `<div class="t44-sec-title-l">Languages</div>
      <div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div class="t44-skill-item">${l.trim()}</div>`).join('')} <span class="edit-pen">✏</span></div>` : ''}
    </div>
    <div class="t44-right">
      ${expHTML}
      ${eduHTML}
      ${projects.length ? `<div class="t44-sec-title-r section-block">Projects</div>
        <div class="t44-job editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div style="margin-bottom:10px;"><div style="font-weight:700;font-size:11px;">${p.title||p.name||''}</div><div style="font-size:10px;color:#2563eb;">${p.tools||''}</div><div style="font-size:10px;color:#444;">${(p.description||'').split('\n').filter(Boolean).map(b=>`<div class="t44-bullet">${b}</div>`).join('')}</div></div>`).join('')} <span class="edit-pen">✏</span></div>` : ''}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 45: KATE BISHOP — Warm Parchment Two-Col (exact resume-t45 design)
// Matches the actual template45 design from templates.html with
// full edit/delete toolbar support on every section.
// ============================================================
function buildTemplate45Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#c9a065';

    const name    = d.fullName       || 'Your Name';
    const title   = d.jobTitle       || 'Product Designer';
    const email   = d.email          || 'email@example.com';
    const phone   = d.phone          || '000-000-0000';
    const linkedin= d.linkedin       || '';
    const summary = d.profileSummary || '';

    const photoBR  = d.photoShape === 'square' ? '6px' : '50%';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:${photoBR};cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<span style="font-size:22px;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</span>`;

    // Work Experience (left column)
    const expHTML = experience.length
        ? experience.map(e => `
            <div class="t45-job">
              <div class="t45-job-title">${e.jobTitle||e.role||e.title||''}</div>
              <div class="t45-job-co">${e.company||''}, ${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>
              <div class="t45-job-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).join(' ')}</div>
            </div>`).join('')
        : `<div class="t45-job" style="color:#9ca3af;font-size:10px;">Click to add experience ✏</div>`;

    // Skills (left column, below experience)
    const skillsHTML = skills.length
        ? `<div class="t45-skills-grid">${skills.map(s=>`<div class="t45-skill-col-item">${s.name||s}</div>`).join('')}</div>`
        : `<div class="t45-skill-item" style="color:#9ca3af;cursor:pointer;">Add skills ✏</div>`;

    // Education (right column)
    const eduHTML = edu.length
        ? edu.map(e=>`
            <div class="t45-edu-item">
              <div class="t45-edu-title">${e.degree||''}</div>
              <div class="t45-edu-sub">${e.school||e.university||''}, ${e.year||''}</div>
            </div>`).join('')
        : `<div class="t45-edu-item" style="color:#9ca3af;font-size:10px;">Click to add education ✏</div>`;

    return `<div class="resume-t45">
  <!-- HEADER -->
  <div class="t45-top">
    <div class="t45-photo-wrap editable-field" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
    <div class="t45-header-text">
      <div class="t45-role-tag editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      <div class="t45-name editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    </div>
    <div style="clear:both;"></div>
    <div class="t45-contact-row">
      <div class="t45-contact-item editable-field" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>
      ${linkedin ? `<div class="t45-contact-item editable-field" ${editBtn('linkedin','LinkedIn',linkedin)}>🔗 ${linkedin} <span class="edit-pen">✏</span></div>` : ''}
      <div class="t45-contact-item editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>
    </div>
  </div>
  <div class="t45-divider"></div>

  <!-- BODY: Left = Work Experience + Skills | Right = Education -->
  <div class="t45-body">
    <div class="t45-left">
      <!-- Work Experience section with Edit + Delete toolbar -->
      <div class="section-block" id="rv-experience-section">
        <div class="t45-sec-title-l" style="font-weight:700;">Work Experience</div>
        <div class="editable-field" ${editBtn('experienceJson','Work Experience','')}>
          ${expHTML} <span class="edit-pen">✏</span>
        </div>
      </div>

      <!-- Skills section with Edit + Delete toolbar -->
      <div class="section-block">
        <div class="t45-sec-title-l" style="font-weight:700;">Skills</div>
        <div class="editable-field" ${editBtn('skillsJson','Skills','')}>
          ${skillsHTML} <span class="edit-pen">✏</span>
        </div>
      </div>

      ${summary ? `<!-- Profile Summary with Edit toolbar -->
      <div class="section-block">
        <div class="t45-sec-title-l" style="font-weight:700;">Profile Summary</div>
        <div class="t45-job-desc editable-field" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
      </div>` : ''}

      ${d.languages ? `<div class="section-block">
        <div class="t45-sec-title-l" style="font-weight:700;">Languages</div>
        <div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div class="t45-skill-item">${l.trim()}</div>`).join('')} <span class="edit-pen">✏</span></div>
      </div>` : ''}

      ${projects.length ? `<div class="section-block" id="rv-projects-section">
        <div class="t45-sec-title-l" style="font-weight:700;">Projects</div>
        <div class="editable-field" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t45-job"><div class="t45-job-title">${p.title||p.name||''}</div><div class="t45-job-co">${p.tools||''}</div><div class="t45-job-desc">${(p.description||'').split('\n').filter(Boolean).join(' ')}</div></div>`).join('')} <span class="edit-pen">✏</span></div>
      </div>` : ''}
    </div>

    <div class="t45-right">
      <!-- Education section with Edit + Delete toolbar -->
      <div class="section-block" id="rv-edu-section">
        <div class="t45-sec-title-r" style="font-weight:700;">Education &amp; Learning</div>
        <div class="editable-field" ${editBtn('educationJson','Education','')}>
          ${eduHTML} <span class="edit-pen">✏</span>
        </div>
      </div>

      ${d.certifications ? `<div class="section-block" id="rv-section-certificates">
        <div class="t45-sec-title-r" style="font-weight:700;">Certifications</div>
        <div class="editable-field" ${editBtn('certifications','Certifications',d.certifications||'')}>${d.certifications} <span class="edit-pen">✏</span></div>
      </div>` : ''}

      ${d.awards ? `<div class="section-block">
        <div class="t45-sec-title-r" style="font-weight:700;">Awards &amp; Honors</div>
        <div class="editable-field" ${editBtn('awards','Awards',d.awards||'')}>${d.awards} <span class="edit-pen">✏</span></div>
      </div>` : ''}

      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 46: ALEX ARCHER — Teal Two-Panel Executive
// ============================================================
function buildTemplate46Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent  = color || '#1a5f5a';
    const name    = d.fullName       || 'Your Name';
    const title   = d.jobTitle       || 'Senior Creative Lead';
    const email   = d.email          || 'email@example.com';
    const phone   = d.phone          || '000-000-0000';
    const addr    = d.address        || 'Your City';
    const website = d.website        || '';
    const summary = d.profileSummary || 'Add your professional summary here.';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:74px;height:74px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.35);cursor:pointer;display:block;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:74px;height:74px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:2rem;cursor:pointer;border:3px solid rgba(255,255,255,0.3);" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div class="t46-edu-item"><div class="t46-edu-deg">${e.degree||''}</div><div class="t46-edu-school">${e.school||e.university||''}</div><div class="t46-edu-yr">${e.year||e.from||''}</div></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const skillBarHTML = skills.length
        ? skills.map(s => {
            const sn = s.name||s; const pct = typeof s.level==='number'?s.level:80;
            return `<div class="t46-skill-bar"><div class="t46-skill-label"><span>${sn}</span><span>${pct}%</span></div><div class="t46-skill-track"><div class="t46-skill-fill" style="width:${pct}%;background:${accent};"></div></div></div>`;
          }).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div class="t46-job"><div class="t46-job-title">${e.jobTitle||e.role||e.title||''}</div><div class="t46-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div><div class="t46-job-co">${e.company||''}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t46-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    return `<div class="resume-t46">
  <div class="t46-top-area">
    <div class="t46-top-left-header" style="background:${accent};">
      <div class="t46-contact-section-title">CONTACTS</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div class="t46-contact-icon" style="background:rgba(255,255,255,0.15);">📞</div><div class="t46-contact-text editable-field" ${editBtn('phone','Phone',phone)}>${phone} <span class="edit-pen">✏</span></div></div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div class="t46-contact-icon" style="background:rgba(255,255,255,0.15);">✉</div><div class="t46-contact-text editable-field" ${editBtn('email','Email',email)}>${email} <span class="edit-pen">✏</span></div></div>
      <div style="display:flex;align-items:center;gap:8px;"><div class="t46-contact-icon" style="background:rgba(255,255,255,0.15);">📍</div><div class="t46-contact-text editable-field" ${editBtn('address','Address',addr)}>${addr} <span class="edit-pen">✏</span></div></div>
    </div>
    <div class="t46-top-right-header" style="background:${accent}cc;">
      <div>
        <div class="t46-name editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      </div>
    </div>
  </div>
  <div style="background:#f9fafb;padding:10px 20px;border-bottom:2px solid ${accent};">
    <div style="font-size:13px;font-weight:900;color:${accent};letter-spacing:2px;text-transform:uppercase;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
  </div>
  <div style="display:flex;flex:1;">
    <div class="t46-left">
      <div class="t46-sec-title" style="border-color:${accent};color:${accent};">About Me</div>
      <div class="t46-about-text editable-field" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
      <div class="t46-sec-title" style="border-color:${accent};color:${accent};">Employment History</div>
      <div class="section-block" id="rv-experience-section">
        <div class="editable-field" ${editBtn('experienceJson','Work Experience','')}>${expHTML} <span class="edit-pen">✏</span></div>
      </div>
    </div>
    <div style="width:200px;flex-shrink:0;padding:16px;background:#f0faf8;border-left:1px solid ${accent}22;">
      <div class="t46-right-sec-title" style="border-color:${accent};color:${accent};">Education</div>
      <div class="section-block" id="rv-edu-section">
        <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen">✏</span></div>
      </div>
      <div class="t46-right-sec-title" style="border-color:${accent};color:${accent};">Core Skills</div>
      <div class="section-block">
        <div class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillBarHTML} <span class="edit-pen">✏</span></div>
      </div>
      ${d.references ? `<div class="t46-right-sec-title" style="border-color:${accent};color:${accent};">References</div>
      <div class="editable-field" ${editBtn('references','References',d.references||'')}>${d.references} <span class="edit-pen">✏</span></div>` : ''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 47: MATHEW SMITH — Blue Header UI Designer
// ============================================================
function buildTemplate47Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent  = color || '#1a5fb4';
    const name    = d.fullName       || 'Your Name';
    const title   = d.jobTitle       || 'UI Designer';
    const email   = d.email          || 'email@example.com';
    const phone   = d.phone          || '000-000-0000';
    const addr    = d.address        || '123 Professional Way, NY';
    const summary = d.profileSummary || 'Add your professional summary here.';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:90px;height:100px;object-fit:cover;border-radius:4px;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t47-photo-wrap" style="display:flex;align-items:center;justify-content:center;font-size:2rem;color:#aaa;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillBarHTML = skills.length
        ? skills.map(s => {
            const sn = s.name||s; const pct = typeof s.level==='number'?s.level:80;
            return `<div class="t47-skill-bar"><div class="t47-skill-label"><span>${sn}</span><span>${pct}%</span></div><div class="t47-skill-track"><div class="t47-skill-fill" style="width:${pct}%;background:${accent};"></div></div></div>`;
          }).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div class="t47-edu-item"><div class="t47-edu-deg">${e.degree||''}</div><div class="t47-edu-school">${e.school||e.university||''}</div><div class="t47-edu-yr">${e.year||e.from||''}</div></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e=>`<div class="t47-job"><div class="t47-job-title">${e.jobTitle||e.role||e.title||''}</div><div class="t47-job-co" style="color:${accent};">${e.company||''}</div><div class="t47-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t47-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    return `<div class="resume-t47">
  <div class="t47-top">
    <div class="t47-top-left">
      <div class="t47-name editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      <div class="t47-role-badge editable-field" style="background:${accent};" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      <div class="t47-summary editable-field" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
    </div>
    <div class="t47-top-right">
      <div class="t47-top-right-contact">
        <div class="editable-field" ${editBtn('address','Address',addr)}>📍 ${addr} <span class="edit-pen">✏</span></div>
        <div class="editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>
        <div class="editable-field" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>
      </div>
    </div>
  </div>
  <div class="t47-top-blue" style="background:${accent};"></div>
  <div class="t47-body">
    <div class="t47-left">
      ${photoHTML}
      <div class="t47-sec-title" style="color:${accent};">🎓 Education</div>
      <div class="section-block" id="rv-edu-section">
        <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen">✏</span></div>
      </div>
      <div class="t47-sec-title" style="color:${accent};">🎯 Expertise</div>
      <div class="section-block">
        <div class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillBarHTML} <span class="edit-pen">✏</span></div>
      </div>
    </div>
    <div class="t47-right">
      <div class="t47-sec-title" style="color:${accent};">💼 Work Experience</div>
      <div class="section-block" id="rv-experience-section">
        <div class="editable-field" ${editBtn('experienceJson','Work Experience','')}>${expHTML} <span class="edit-pen">✏</span></div>
      </div>
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 48: LORNA ALVARADO — Cyan Triangle Sidebar
// ============================================================
function buildTemplate48Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent  = color || '#00b3c6';
    const name    = d.fullName       || 'Your Name';
    const title   = d.jobTitle       || 'Marketing Manager';
    const email   = d.email          || 'email@example.com';
    const phone   = d.phone          || '000-000-0000';
    const website = d.website        || '';
    const summary = d.profileSummary || 'Add your professional summary here.';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #fff;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t48-photo-circle" style="display:flex;align-items:center;justify-content:center;font-size:2rem;color:#fff;background:rgba(0,179,198,0.3);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillDots = skills.length
        ? skills.map(s=>`<div class="t48-skill-dot-item"><div class="t48-skill-dot" style="background:${accent};"></div>${s.name||s}</div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div class="t48-edu-item" style="border-color:${accent};"><div class="t48-edu-deg">${e.degree||''}</div><div class="t48-edu-school"><span>${e.school||e.university||''}</span><span>${e.year||e.from||''}</span></div><div class="t48-edu-desc">${e.description||''}</div></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e=>`<div class="t48-job"><div class="t48-job-title">${e.jobTitle||e.role||e.title||''}</div><div class="t48-job-co-date"><span>${e.company||''}</span><span>${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</span></div><div class="t48-job-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).join(' ')}</div></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    return `<div class="resume-t48">
  <div class="t48-left">
    <div class="t48-left-deco" style="border-color:${accent} transparent transparent transparent;"></div>
    <div class="t48-photo-outer">${photoHTML}</div>
    <div class="t48-name-area">
      <div class="t48-name-48 editable-field" style="color:${accent};" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      <div class="t48-title-48 editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    </div>
    <div class="t48-left-content">
      <div class="t48-sec-title-l" style="color:${accent};">☎ Contact</div>
      <div class="t48-contact-item editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>
      <div class="t48-contact-item editable-field" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>
      ${website ? `<div class="t48-contact-item editable-field" ${editBtn('website','Website',website)}>🌐 ${website} <span class="edit-pen">✏</span></div>` : ''}
      <div class="t48-sec-title-l" style="color:${accent};">👤 About Me</div>
      <div class="t48-about-text editable-field" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
      <div class="t48-sec-title-l" style="color:${accent};">🌟 Skills</div>
      <div class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillDots} <span class="edit-pen">✏</span></div>
    </div>
  </div>
  <div class="t48-right">
    <div class="t48-sec-title-r">🎓 Education</div>
    <div class="section-block" id="rv-edu-section">
      <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen">✏</span></div>
    </div>
    <div class="t48-sec-title-r">💼 Experience</div>
    <div class="section-block" id="rv-experience-section">
      <div class="editable-field" ${editBtn('experienceJson','Work Experience','')}>${expHTML} <span class="edit-pen">✏</span></div>
    </div>
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 49: ALEX WENGER — Blue Geo Contact Strip
// ============================================================
function buildTemplate49Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent  = color || '#2563eb';
    const name    = d.fullName       || 'Your Name';
    const title   = d.jobTitle       || 'Art Director & Web Designer';
    const email   = d.email          || 'email@example.com';
    const phone   = d.phone          || '000-000-0000';
    const addr    = d.address        || '123 Anywhere St., Any City';
    const website = d.website        || 'www.yoursite.com';
    const summary = d.profileSummary || 'Add your professional summary here.';

    const skillBarHTML = skills.length
        ? skills.map(s => {
            const sn = s.name||s; const pct = typeof s.level==='number'?s.level:70;
            return `<div class="t49-skill-bar"><div class="t49-skill-label">${sn}</div><div class="t49-skill-track"><div class="t49-skill-fill" style="width:${pct}%;background:${accent};"></div></div></div>`;
          }).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div class="t49-edu-item"><div class="t49-edu-org">${e.school||e.university||''}</div><div class="t49-edu-deg">${e.degree||''}</div><div class="t49-edu-desc">${e.year||e.from||''}</div></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e=>`<div class="t49-job"><div class="t49-job-title">${e.jobTitle||e.role||e.title||''}</div><div class="t49-job-co" style="color:${accent};">${e.company||''}</div><div class="t49-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t49-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    return `<div class="resume-t49">
  <div class="t49-header">
    <div class="t49-name-area">
      <div class="t49-name-49 editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      <div class="t49-subtitle editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    </div>
    <div class="t49-contact-col" style="background:${accent};">
      <div class="t49-contact-row"><span class="t49-contact-icon">📞</span><span class="t49-contact-text editable-field" ${editBtn('phone','Phone',phone)}>${phone} <span class="edit-pen">✏</span></span></div>
      <div class="t49-contact-row"><span class="t49-contact-icon">✉</span><span class="t49-contact-text editable-field" ${editBtn('email','Email',email)}>${email} <span class="edit-pen">✏</span></span></div>
      <div class="t49-contact-row"><span class="t49-contact-icon">📍</span><span class="t49-contact-text editable-field" ${editBtn('address','Address',addr)}>${addr} <span class="edit-pen">✏</span></span></div>
      <div class="t49-contact-row"><span class="t49-contact-icon">🌐</span><span class="t49-contact-text editable-field" ${editBtn('website','Website',website)}>${website} <span class="edit-pen">✏</span></span></div>
    </div>
  </div>
  <div class="t49-divider-bar" style="background:${accent};"></div>
  <div class="t49-body">
    <div class="t49-left">
      <div class="t49-sec-title">Profile</div>
      <div class="t49-profile-text editable-field" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
      <div class="t49-sec-title">Work Experience</div>
      <div class="section-block" id="rv-experience-section">
        <div class="editable-field" ${editBtn('experienceJson','Work Experience','')}>${expHTML} <span class="edit-pen">✏</span></div>
      </div>
    </div>
    <div class="t49-right">
      <div class="t49-sec-title">Education</div>
      <div class="section-block" id="rv-edu-section">
        <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen">✏</span></div>
      </div>
      <div class="t49-sec-title">Skills</div>
      <div class="section-block">
        <div class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillBarHTML} <span class="edit-pen">✏</span></div>
      </div>
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 50: LORNA ALVARADO — Dark Navy Sidebar
// ============================================================
function buildTemplate50Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent  = color || '#2d3748';
    const name    = d.fullName       || 'Your Name';
    const title   = d.jobTitle       || 'Marketing Manager';
    const email   = d.email          || 'email@example.com';
    const phone   = d.phone          || '000-000-0000';
    const addr    = d.address        || 'Brooklyn, NY';
    const website = d.website        || '';
    const summary = d.profileSummary || 'Add your professional summary here.';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.25);cursor:pointer;margin:0 auto 10px;display:block;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t50-photo-wrap" style="display:flex;align-items:center;justify-content:center;font-size:2rem;color:rgba(255,255,255,0.5);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillBarHTML = skills.length
        ? skills.map(s => {
            const sn = s.name||s; const pct = typeof s.level==='number'?s.level:70;
            return `<div class="t50-skill-bar"><div class="t50-skill-label">${sn}</div><div class="t50-skill-track"><div class="t50-skill-fill" style="width:${pct}%;"></div></div></div>`;
          }).join('')
        : `<div style="font-size:10px;color:rgba(255,255,255,0.4);cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div class="t50-edu-item"><div class="t50-edu-deg">${e.degree||''}</div><div class="t50-edu-uni">${e.school||e.university||''}</div><div class="t50-edu-yr">${e.year||e.from||''}</div></div>`).join('')
        : `<div style="font-size:10px;color:rgba(255,255,255,0.4);cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e=>`<div class="t50-job"><div class="t50-job-title">${e.jobTitle||e.role||e.title||''}</div><div class="t50-job-co-date">${e.company||''}</div><div class="t50-job-loc">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t50-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const langsHTML = d.languages
        ? d.languages.split(',').map(l=>`<div class="t50-lang-item">${l.trim()}</div>`).join('')
        : '';

    return `<div class="resume-t50">
  <div class="t50-left" style="background:${accent};">
    <div class="t50-left-top" style="background:${accent}dd;">
      ${photoHTML}
      <div class="t50-name-50 editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      <div class="t50-title-50 editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    </div>
    <div class="t50-left-content">
      <div class="t50-sec-title-l">About Me</div>
      <div class="t50-about-text editable-field" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
      <div class="t50-sec-title-l">Education</div>
      <div class="section-block" id="rv-edu-section">
        <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen">✏</span></div>
      </div>
      <div class="t50-sec-title-l">Skills</div>
      <div class="section-block">
        <div class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillBarHTML} <span class="edit-pen">✏</span></div>
      </div>
      ${langsHTML ? `<div class="t50-sec-title-l">Languages</div><div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${langsHTML} <span class="edit-pen">✏</span></div>` : ''}
    </div>
  </div>
  <div class="t50-right">
    <div class="t50-top-contact">
      <div class="t50-contact-item editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>
      <div class="t50-contact-item editable-field" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>
      <div class="t50-contact-item editable-field" ${editBtn('address','Address',addr)}>📍 ${addr} <span class="edit-pen">✏</span></div>
      ${website ? `<div class="t50-contact-item editable-field" ${editBtn('website','Website',website)}>🌐 ${website} <span class="edit-pen">✏</span></div>` : ''}
    </div>
    <div class="t50-sec-title-r">Experience</div>
    <div class="section-block" id="rv-experience-section">
      <div class="editable-field" ${editBtn('experienceJson','Work Experience','')}>${expHTML} <span class="edit-pen">✏</span></div>
    </div>
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 51: RICHARD SANCHEZ — Clean White Icon Timeline
// ============================================================
function buildTemplate51Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent  = color || '#1a1a2e';
    const name    = d.fullName       || 'Your Name';
    const title   = d.jobTitle       || 'Marketing Manager';
    const email   = d.email          || 'email@example.com';
    const phone   = d.phone          || '000-000-0000';
    const addr    = d.address        || '123 Anywhere St., Any City';
    const website = d.website        || '';
    const summary = d.profileSummary || 'Add your professional summary here.';

    const skillItems = skills.length
        ? skills.map(s=>`<div class="t51-skill-item">${s.name||s}</div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const eduLeftHTML = edu.length
        ? edu.map(e=>`<div class="t51-edu-item"><div class="t51-edu-yr">${e.year||e.from||''}</div><div class="t51-edu-org">${e.school||e.university||''}</div><div class="t51-edu-deg">${e.degree||''}</div></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const expTLHTML = experience.length
        ? experience.map(e=>`<div class="t51-job"><div class="t51-job-co">${e.company||''} <span style="color:#9ca3af;margin-left:8px;">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</span></div><div class="t51-job-role">${e.jobTitle||e.role||e.title||''}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t51-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    return `<div class="resume-t51">
  <div class="t51-left">
    <div class="t51-name-51 editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div class="t51-title-51 editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    <div class="t51-sec-title-l">Contact</div>
    <div class="t51-contact-item editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>
    <div class="t51-contact-item editable-field" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>
    <div class="t51-contact-item editable-field" ${editBtn('address','Address',addr)}>📍 ${addr} <span class="edit-pen">✏</span></div>
    ${website ? `<div class="t51-contact-item editable-field" ${editBtn('website','Website',website)}>🌐 ${website} <span class="edit-pen">✏</span></div>` : ''}
    <div class="t51-sec-title-l">Education</div>
    <div class="section-block" id="rv-edu-section">
      <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduLeftHTML} <span class="edit-pen">✏</span></div>
    </div>
    <div class="t51-sec-title-l">Skills</div>
    <div class="section-block">
      <div class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillItems} <span class="edit-pen">✏</span></div>
    </div>
    ${d.languages ? `<div class="t51-sec-title-l">Languages</div>
    <div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div class="t51-lang-item">${l.trim()}</div>`).join('')} <span class="edit-pen">✏</span></div>` : ''}
  </div>
  <div class="t51-right">
    <div class="t51-tl-section">
      <div class="t51-tl-head"><div class="t51-tl-icon" style="background:${accent};">👤</div><div class="t51-tl-sec-title">Profile</div></div>
      <div style="font-size:11px;color:#555;line-height:1.65;padding-left:34px;" class="editable-field" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
    </div>
    <div class="t51-tl-section">
      <div class="t51-tl-head"><div class="t51-tl-icon" style="background:${accent};">💼</div><div class="t51-tl-sec-title">Work Experience</div></div>
      <div class="section-block" id="rv-experience-section" style="padding-left:34px;">
        <div class="editable-field" ${editBtn('experienceJson','Work Experience','')}>${expTLHTML} <span class="edit-pen">✏</span></div>
      </div>
    </div>
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 52: MAANVITA KUMARI — Clean Minimal Photo Timeline
// ============================================================
function buildTemplate52Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent  = color || '#1a1a2e';
    const name    = d.fullName       || 'Your Name';
    const title   = d.jobTitle       || 'Marketing Manager';
    const email   = d.email          || 'email@example.com';
    const phone   = d.phone          || '000-000-0000';
    const addr    = d.address        || '123 Anywhere St., Any City';
    const website = d.website        || '';
    const summary = d.profileSummary || 'Add your professional summary here.';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;cursor:pointer;margin-bottom:10px;display:block;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t52-photo-wrap" style="display:flex;align-items:center;justify-content:center;font-size:2rem;color:#aaa;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillItems = skills.length
        ? skills.map(s=>`<div class="t52-skill-item">${s.name||s}</div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div class="t52-edu-item"><div class="t52-edu-yr">${e.year||e.from||''}</div><div class="t52-edu-org">${e.school||e.university||''}</div><div class="t52-edu-deg">${e.degree||''}</div></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const expTLHTML = experience.length
        ? experience.map(e=>`<div class="t52-job"><div class="t52-job-co"><span>${e.company||''}</span><span>${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</span></div><div class="t52-job-role">${e.jobTitle||e.role||e.title||''}</div>${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t52-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}</div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    return `<div class="resume-t52">
  <div class="t52-left">
    ${photoHTML}
    <div class="t52-sec-title-l">Education</div>
    <div class="section-block" id="rv-edu-section">
      <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen">✏</span></div>
    </div>
    <div class="t52-sec-title-l">Skills</div>
    <div class="section-block">
      <div class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillItems} <span class="edit-pen">✏</span></div>
    </div>
    ${d.languages ? `<div class="t52-sec-title-l">Languages</div>
    <div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div class="t52-skill-item">${l.trim()}</div>`).join('')} <span class="edit-pen">✏</span></div>` : ''}
  </div>
  <div class="t52-right">
    <div class="t52-header-area">
      <div class="t52-header-text">
        <div class="t52-name-52 editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
        <div class="t52-title-52 editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
        <div class="t52-contact-row">
          <div class="t52-contact-item editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>
          <div class="t52-contact-item editable-field" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>
          <div class="t52-contact-item editable-field" ${editBtn('address','Address',addr)}>📍 ${addr} <span class="edit-pen">✏</span></div>
          ${website ? `<div class="t52-contact-item editable-field" ${editBtn('website','Website',website)}>🌐 ${website} <span class="edit-pen">✏</span></div>` : ''}
        </div>
      </div>
    </div>
    <hr class="t52-divider"/>
    <div class="t52-timeline">
      <div style="margin-bottom:16px;">
        <div class="t52-tl-head"><div class="t52-tl-icon" style="background:${accent};">👤</div><div class="t52-tl-title">Profile</div></div>
        <div style="font-size:11px;color:#555;line-height:1.65;padding-left:32px;" class="editable-field" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
      </div>
      <div class="section-block" id="rv-experience-section" style="margin-bottom:16px;">
        <div class="t52-tl-head"><div class="t52-tl-icon" style="background:${accent};">💼</div><div class="t52-tl-title">Work Experience</div></div>
        <div style="padding-left:32px;">
          <div class="editable-field" ${editBtn('experienceJson','Work Experience','')}>${expTLHTML} <span class="edit-pen">✏</span></div>
        </div>
      </div>
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}
// Runs after every template renders. Finds text content nodes
// and wraps them with clickable edit overlays.
// Works on ALL templates without modifying each one.
// ============================================================
function injectEditOverlays(ctx) {
    const d   = ctx.resumeData;
    const doc = document.getElementById('resumeDoc');
    if (!doc) return;

    // Helper: wrap a DOM element with edit click handler
    function makeEditable(el, field, label, val) {
        if (!el || el.dataset.editInjected) return;
        el.dataset.editInjected = '1';
        el.style.cursor = 'pointer';
        el.style.position = 'relative';
        el.classList.add('rv-editable');
        el.setAttribute('title', 'Click to edit ' + label);
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            openEditModal(field, label, val !== undefined ? val : (d[field] || ''));
        });
        // Add edit pen icon
        const pen = document.createElement('span');
        pen.className = 'rv-edit-pen';
        pen.innerHTML = '✏';
        pen.style.cssText = 'opacity:0;font-size:10px;color:#7c3aed;margin-left:4px;transition:opacity 0.15s;pointer-events:none;';
        el.appendChild(pen);
        el.addEventListener('mouseenter', () => pen.style.opacity = '1');
        el.addEventListener('mouseleave', () => pen.style.opacity = '0');
    }

    // Helper: find elements by text content match
    function findByText(text, tags) {
        if (!text) return null;
        const clean = text.toString().trim().toLowerCase().substring(0, 30);
        const tagList = tags || ['div','p','span','h1','h2','h3','h4','strong','td','li'];
        let found = null;
        tagList.forEach(tag => {
            if (found) return;
            doc.querySelectorAll(tag).forEach(el => {
                if (found) return;
                const t = (el.textContent || '').trim().toLowerCase();
                if (t.startsWith(clean) && t.length < clean.length + 80) found = el;
            });
        });
        return found;
    }

    // ---- PHOTO ----
    const photoImg = doc.querySelector('img[src*="data:image"]');
    if (photoImg && !photoImg.dataset.editInjected) {
        photoImg.dataset.editInjected = '1';
        photoImg.style.cursor = 'pointer';
        photoImg.title = 'Click to change photo';
        photoImg.addEventListener('click', e => { e.stopPropagation(); openEditModal('profilePhoto','Profile Photo',''); });
    }
    // Photo placeholder divs (👤 emoji)
    doc.querySelectorAll('div').forEach(el => {
        if (el.dataset.editInjected) return;
        const txt = (el.textContent || '').trim();
        if (txt === '👤' || txt === '🧑' || txt === '👩') {
            el.dataset.editInjected = '1';
            el.style.cursor = 'pointer';
            el.title = 'Click to upload photo';
            el.addEventListener('click', e => { e.stopPropagation(); openEditModal('profilePhoto','Profile Photo',''); });
        }
    });

    // ---- FULL NAME ----
    if (d.fullName) {
        const el = findByText(d.fullName, ['h1','h2','h3','div','p','span','strong']);
        if (el) makeEditable(el, 'fullName', 'Full Name', d.fullName);
    }

    // ---- JOB TITLE ----
    if (d.jobTitle) {
        const el = findByText(d.jobTitle, ['div','p','span','h4','h3']);
        if (el) makeEditable(el, 'jobTitle', 'Job Title', d.jobTitle);
    }

    // ---- PROFILE SUMMARY ----
    if (d.profileSummary) {
        const el = findByText(d.profileSummary, ['p','div','span']);
        if (el) makeEditable(el, 'profileSummary', 'Profile Summary', d.profileSummary);
    }

    // ---- CONTACT FIELDS ----
    const contactFields = [
        { field: 'email',   label: 'Email'   },
        { field: 'phone',   label: 'Phone'   },
        { field: 'address', label: 'Address' },
        { field: 'website', label: 'Website' },
        { field: 'linkedin',label: 'LinkedIn'},
    ];
    contactFields.forEach(({ field, label }) => {
        if (!d[field]) return;
        const el = findByText(d[field], ['div','span','p','a','td','li']);
        if (el) makeEditable(el, field, label, d[field]);
    });

    // ---- SKILLS ----
    // Find skill section by looking for skill text nodes
    let skills = [];
    try { skills = JSON.parse(d.skillsJson || '[]'); } catch {}
    if (skills.length) {
        // Try to find a skill item and make its parent container editable
        const firstSkill = skills[0];
        const skillName = typeof firstSkill === 'object' ? firstSkill.name : firstSkill;
        if (skillName) {
            const el = findByText(skillName, ['li','div','span','p']);
            if (el && el.parentElement && !el.parentElement.dataset.editInjected) {
                makeEditable(el.parentElement, 'skillsJson', 'Skills', d.skillsJson || '[]');
            } else if (el) {
                makeEditable(el, 'skillsJson', 'Skills', d.skillsJson || '[]');
            }
        }
    } else {
        // No skills — find "Add skills" placeholder
        const el = findByText('Add skills', ['div','p','span','li']);
        if (el) makeEditable(el, 'skillsJson', 'Skills', '[]');
    }

    // ---- EDUCATION ----
    let edu = [];
    try { edu = JSON.parse(d.educationJson || '[]'); } catch {}
    if (edu.length) {
        const first = edu[0];
        const degreeText = first.degree || first.school || '';
        if (degreeText) {
            const el = findByText(degreeText, ['div','strong','p','span','td','h4']);
            if (el && el.parentElement && !el.parentElement.dataset.editInjected) {
                makeEditable(el.parentElement, 'educationJson', 'Education', d.educationJson || '[]');
            } else if (el) {
                makeEditable(el, 'educationJson', 'Education', d.educationJson || '[]');
            }
        }
    } else {
        const el = findByText('Add education', ['div','p','span']);
        if (el) makeEditable(el, 'educationJson', 'Education', '[]');
    }

    // ---- EXPERIENCE ----
    let exp = [];
    try { exp = JSON.parse(d.experienceJson || '[]'); } catch {}
    if (exp.length) {
        const first = exp[0];
        const expText = first.jobTitle || first.company || first.title || '';
        if (expText) {
            const el = findByText(expText, ['div','strong','p','span','h4','td']);
            if (el && el.parentElement && !el.parentElement.dataset.editInjected) {
                makeEditable(el.parentElement, 'experienceJson', 'Experience', d.experienceJson || '[]');
            } else if (el) {
                makeEditable(el, 'experienceJson', 'Experience', d.experienceJson || '[]');
            }
        }
    } else {
        const el = findByText('Add experience', ['div','p','span']);
        if (el) makeEditable(el, 'experienceJson', 'Experience', '[]');
    }

    // ---- PROJECTS ----
    let projects = [];
    try { projects = JSON.parse(d.projectsJson || '[]'); } catch {}
    if (projects.length) {
        const first = projects[0];
        const projText = first.title || first.name || '';
        if (projText) {
            const el = findByText(projText, ['div','strong','p','span','h4']);
            if (el && el.parentElement && !el.parentElement.dataset.editInjected) {
                makeEditable(el.parentElement, 'projectsJson', 'Projects', d.projectsJson || '[]');
            } else if (el) {
                makeEditable(el, 'projectsJson', 'Projects', d.projectsJson || '[]');
            }
        }
    }

    // ---- CERTIFICATIONS ----
    if (d.certifications) {
        const el = findByText(d.certifications.substring(0,25), ['div','p','span','li']);
        if (el) makeEditable(el, 'certifications', 'Certifications', d.certifications);
    }

    // ---- LANGUAGES ----
    if (d.languages) {
        const el = findByText(d.languages.substring(0,20), ['div','p','span','li']);
        if (el) makeEditable(el, 'languages', 'Languages', d.languages);
    }

    // ---- AWARDS / HONORS ----
    if (d.awards) {
        const el = findByText(d.awards.substring(0,20), ['div','p','span','li']);
        if (el) makeEditable(el, 'awards', 'Awards & Honors', d.awards);
    }

    // ---- INTERESTS ----
    if (d.interests) {
        const el = findByText(d.interests.substring(0,20), ['div','p','span','li']);
        if (el) makeEditable(el, 'interests', 'Interests', d.interests);
    }

    // ---- SECTION HEADERS (click section title to edit that section) ----
    // Add a subtle "+" edit button next to section headers
    const sectionKeywords = {
        'about': { field: 'profileSummary', label: 'Profile Summary' },
        'summary': { field: 'profileSummary', label: 'Profile Summary' },
        'profile': { field: 'profileSummary', label: 'Profile Summary' },
        'experience': { field: 'experienceJson', label: 'Experience' },
        'education': { field: 'educationJson', label: 'Education' },
        'skills': { field: 'skillsJson', label: 'Skills' },
        'projects': { field: 'projectsJson', label: 'Projects' },
        'certifications': { field: 'certifications', label: 'Certifications' },
        'certification': { field: 'certifications', label: 'Certifications' },
        'languages': { field: 'languages', label: 'Languages' },
        'awards': { field: 'awards', label: 'Awards' },
        'interests': { field: 'interests', label: 'Interests' },
        'contact': { field: 'phone', label: 'Contact Info' },
    };

    doc.querySelectorAll('div,h3,h4,span,p').forEach(el => {
        if (el.dataset.editInjected) return;
        const text = (el.textContent || '').trim().toLowerCase().replace(/[^a-z\s]/g,'');
        // Only short text that matches a section header exactly
        if (text.length > 30 || text.length < 3) return;
        const match = sectionKeywords[text];
        if (match) {
            el.dataset.editInjected = '1';
            el.style.cursor = 'pointer';
            el.title = 'Click to edit ' + match.label;
            el.addEventListener('click', e => {
                e.stopPropagation();
                openEditModal(match.field, match.label, d[match.field] || '');
            });
        }
    });
}

// ============================================================
// HELPER
// ============================================================
function escapeQ(str) {
    return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}
function editBtn(field, label, val) {
    return `onclick="openEditModal('${field}','${label}','${escapeQ(val)}')"`;
}

// ============================================================
// TEMPLATE 1: ROBERT — Dark Maroon Sidebar
// Based on image: cream left panel, dark maroon header bar + accents
// ============================================================
function buildRobertTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accentColor = color || '#7a1e28';
    const name    = d.fullName       || 'Your Name';
    const title   = d.jobTitle       || 'Job Title';
    const email   = d.email          || 'email@example.com';
    const phone   = d.phone          || '(123) 456-7890';
    const summary = d.profileSummary || 'Add your professional summary here.';
    const linkedin= d.linkedin       || 'LinkedIn | Portfolio';
    const location= d.location       || 'City, State';

    const photoSize = d.photoSize || 90;
    const photoBorderRadius = d.photoShape === 'square' ? '8px' : '50%';
    const photoHTML = d.profilePhotoData
        ? `<div style="text-align:center;margin-bottom:12px;">
             <img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};object-fit:cover;object-position:${d.photoPosition||'top'};display:inline-block;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>
             <div class="photo-controls" style="margin-top:6px;display:flex;align-items:center;gap:6px;justify-content:center;">
               <input type="range" min="60" max="140" value="${photoSize}" style="width:80px;" oninput="updatePhotoSize(this.value)" title="Photo size">
               <select style="font-size:10px;border:1px solid #ccc;border-radius:4px;padding:1px 3px;" onchange="updatePhotoShape(this.value)" title="Shape">
                 <option value="circle" ${d.photoShape!=='square'?'selected':''}>●</option>
                 <option value="square" ${d.photoShape==='square'?'selected':''}>■</option>
               </select>
             </div>
           </div>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};background:#c9a87c;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 12px;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillsList = skills.length
        ? skills.map(s => `<li style="font-size:12px;color:#374151;padding:2px 0;">${s}</li>`).join('')
        : '<li style="font-size:12px;color:#9ca3af;">Add skills in builder</li>';

    const contactItems = [
        { icon: '📞', val: phone,   field: 'phone',   label: 'Phone'    },
        { icon: '✉',  val: email,   field: 'email',   label: 'Email'    },
        { icon: '🔗', val: linkedin,field: 'linkedin',label: 'LinkedIn' },
        { icon: '📍', val: location,field: 'location',label: 'Location' },
    ].map(c => `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;" class="editable-field" ${editBtn(c.field, c.label, c.val)}>
        <span style="font-size:13px;flex-shrink:0;">${c.icon}</span>
        <span style="font-size:12px;color:#374151;line-height:1.4;">${c.val} <span class="edit-pen">✏</span></span>
    </div>`).join('');

    const expHTML = experience.length
        ? experience.map(e => `
            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;">
                    <strong style="font-size:13px;color:#1a1a2e;">${e.role || e.title || ''} | ${e.company || ''}</strong>
                    <span style="font-size:11px;color:#6b7280;white-space:nowrap;">${e.from || e.startDate || ''} – ${e.to || e.endDate || 'Present'}</span>
                </div>
                <ul style="margin:6px 0 0 16px;padding:0;">
                    ${(e.bullets || e.description || '').toString().split('\n').filter(Boolean).map(b => `<li style="font-size:12px;color:#374151;margin-bottom:3px;">${b}</li>`).join('')}
                </ul>
            </div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')} class="editable-field" ${editBtn('experienceJson','Experience','')}>Click to add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `
            <div style="margin-bottom:10px;">
                <strong style="font-size:13px;color:#1a1a2e;">${e.degree || ''} ${e.field ? '– ' + e.field : ''}</strong>
                <div style="font-size:12px;color:#6b7280;">${e.university || ''} ${e.location ? '· ' + e.location : ''} ${e.year ? '| ' + e.year : ''}</div>
                ${e.cgpa ? `<div style="font-size:11px;color:#9ca3af;">GPA: ${e.cgpa}</div>` : ''}
            </div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')} class="editable-field" ${editBtn('educationJson','Education','')}>Click to add education ✏</div>`;

    const projHTML = projects.length
        ? projects.map(p => `
            <div style="margin-bottom:12px;">
                <strong style="font-size:13px;color:#1a1a2e;">${p.title || ''}</strong>
                ${p.tools ? `<div style="font-size:11px;color:#6b7280;">Tools: ${p.tools}</div>` : ''}
                <div style="font-size:12px;color:#374151;">${p.description || ''}</div>
            </div>`).join('')
        : '';

    return `
    <div style="display:flex;min-height:1040px;font-family:inherit;">

        <!-- LEFT SIDEBAR (cream) -->
        <div style="width:240px;flex-shrink:0;background:#f5ede0;padding:24px 16px;display:flex;flex-direction:column;gap:0;">

            ${photoHTML}

            <!-- Personal Info badge -->
            <div style="background:${accentColor};color:#fff;font-size:9px;font-weight:800;letter-spacing:1px;padding:5px 10px;border-radius:0 8px 8px 0;margin:-0px -16px 12px -16px;text-transform:uppercase;">PERSONAL INFORMATION</div>
            ${contactItems}

            <!-- Key Skills badge -->
            <div style="background:${accentColor};color:#fff;font-size:9px;font-weight:800;letter-spacing:1px;padding:5px 10px;border-radius:0 8px 8px 0;margin:12px -16px 10px -16px;text-transform:uppercase;">KEY SKILLS</div>
            <ul style="list-style:disc;margin:0 0 0 14px;padding:0;" class="editable-field" ${editBtn('skillsJson','Skills',JSON.stringify(skills))}>
                ${skillsList}
                <span class="edit-pen" style="font-size:10px;">✏</span>
            </ul>
        </div>

        <!-- RIGHT CONTENT -->
        <div style="flex:1;display:flex;flex-direction:column;">

            <!-- Dark header bar -->
            <div style="background:${accentColor};padding:28px 28px 20px;position:relative;">
                <div class="editable-field" ${editBtn('fullName','Full Name', d.fullName||'')}>
                    <span style="font-size:2rem;font-weight:900;color:#fff;">${name.split(' ')[0]}</span>
                    <span style="font-size:2rem;font-weight:300;color:#fff;"> ${name.split(' ').slice(1).join(' ')}</span>
                    <span class="edit-pen" style="color:rgba(255,255,255,0.6);">✏</span>
                </div>
                <div class="editable-field" style="margin-top:4px;" ${editBtn('jobTitle','Job Title', d.jobTitle||'')}>
                    <span style="font-size:14px;color:rgba(255,255,255,0.85);font-weight:600;letter-spacing:0.5px;">${title}</span>
                    <span class="edit-pen" style="color:rgba(255,255,255,0.5);">✏</span>
                </div>
                <div class="editable-field" style="margin-top:10px;max-width:520px;" ${editBtn('profileSummary','Summary', d.profileSummary||'')}>
                    <p style="font-size:12px;color:rgba(255,255,255,0.8);line-height:1.6;margin:0;">${summary}</p>
                    <span class="edit-pen" style="color:rgba(255,255,255,0.5);">✏</span>
                </div>
            </div>

            <!-- Body content -->
            <div style="padding:24px 28px;flex:1;">

                <!-- Professional Experience -->
                <div class="section-block" id="rv-experience-section">
                    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:${accentColor};border-bottom:2px solid ${accentColor};padding-bottom:4px;margin-bottom:12px;">PROFESSIONAL EXPERIENCE</div>
                    ${expHTML}
                </div>

                <!-- Projects -->
                ${projHTML ? `
                <div class="section-block" id="rv-projects-section">
                    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:${accentColor};border-bottom:2px solid ${accentColor};padding-bottom:4px;margin-bottom:12px;">PROJECTS</div>
                    ${projHTML}
                </div>` : ''}

                <!-- Education -->
                <div class="section-block" id="rv-edu-section">
                    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:${accentColor};border-bottom:2px solid ${accentColor};padding-bottom:4px;margin-bottom:12px;">EDUCATION</div>
                    ${eduHTML}
                </div>

                <!-- Certifications (custom section) -->
                ${activeSections['certificates'] ? `
                <div class="section-block" id="rv-section-certificates">
                    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:${accentColor};border-bottom:2px solid ${accentColor};padding-bottom:4px;margin-bottom:12px;">CERTIFICATIONS</div>
                    <div class="editable-field extra-section-content" ${editBtn('extra_certificates','Certifications','')}>
                        <em style="color:#9ca3af;font-size:12px;">Click to add certifications ✏</em>
                    </div>
                </div>` : ''}

                ${buildExtraSections(accentColor)}
            </div>
        </div>
    </div>`;
}

// ============================================================
// TEMPLATE 2: OLIVIA — Green Two-Column (photo top-left)
// Based on image: white bg, left photo + teal contact block
// ============================================================
function buildOliviaTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accentColor = color || '#2daf7f';
    const name    = d.fullName       || 'Your Name';
    const title   = d.jobTitle       || 'Job Title';
    const email   = d.email          || 'email@example.com';
    const phone   = d.phone          || '123-456-7890';
    const addr    = d.address        || '123 Anywhere St., Any City';
    const website = d.website        || 'yoursite.com';
    const summary = d.profileSummary || 'Add your professional summary here.';

    const oliviaPhotoHeight = d.photoSize ? Math.max(100, d.photoSize + 60) : 160;
    const photoHTML = d.profilePhotoData
        ? `<div style="position:relative;">
             <img src="${d.profilePhotoData}" style="width:100%;height:${oliviaPhotoHeight}px;object-fit:cover;object-position:${d.photoPosition||'top'};display:block;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>
             <div class="photo-controls" style="padding:6px 8px;background:#f9fafb;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:6px;">
               <span style="font-size:10px;color:#888;">Height:</span>
               <input type="range" min="60" max="140" value="${d.photoSize||90}" style="width:70px;" oninput="updatePhotoSize(this.value)" title="Adjust photo size">
               <select style="font-size:10px;border:1px solid #ccc;border-radius:4px;padding:1px 3px;" onchange="updatePhotoPosition(this.value)" title="Focus">
                 <option value="top" ${(d.photoPosition||'top')==='top'?'selected':''}>Top</option>
                 <option value="center" ${d.photoPosition==='center'?'selected':''}>Center</option>
                 <option value="bottom" ${d.photoPosition==='bottom'?'selected':''}>Bottom</option>
               </select>
             </div>
           </div>`
        : `<div style="width:100%;height:${oliviaPhotoHeight}px;background:#8fa89a;display:flex;align-items:center;justify-content:center;font-size:3rem;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillsList = skills.length
        ? skills.map(s => `<li style="font-size:12px;color:#374151;padding:2px 0;">${s}</li>`).join('')
        : '<li style="font-size:12px;color:#9ca3af;">Add skills in builder</li>';

    const eduHTML = edu.length
        ? edu.map(e => `
            <div style="margin-bottom:10px;">
                <strong style="font-size:13px;color:#1a1a2e;display:block;">${e.degree || ''} | ${e.university || ''}</strong>
                <span style="font-size:11px;color:#6b7280;">${e.from || ''} – ${e.year || ''}</span>
                ${e.cgpa ? `<br><span style="font-size:11px;color:#9ca3af;">${e.cgpa}</span>` : ''}
            </div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Click to add ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `
            <div style="margin-bottom:14px;">
                <strong style="font-size:13px;color:#1a1a2e;display:block;">${e.role || e.title || ''} | ${e.company || ''}</strong>
                <span style="font-size:11px;color:#6b7280;">${e.from || ''} – ${e.to || 'Present'}</span>
                <ul style="margin:5px 0 0 16px;padding:0;">
                    ${(e.bullets || e.description || '').toString().split('\n').filter(Boolean).map(b => `<li style="font-size:12px;color:#374151;margin-bottom:3px;">${b}</li>`).join('')}
                </ul>
            </div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Career / Experience','')}>Click to add career history ✏</div>`;

    const projectsHTML = projects.length
        ? projects.map(p => `
            <div style="margin-bottom:12px;">
                <strong style="font-size:13px;color:#1a1a2e;display:block;">${p.title || ''}</strong>
                ${p.tools ? `<div style="font-size:11px;color:#6b7280;margin-bottom:3px;">Tools: ${p.tools}</div>` : ''}
                <ul style="margin:4px 0 0 16px;padding:0;">
                    ${(p.description || '').split('\n').filter(Boolean).map(b => `<li style="font-size:12px;color:#374151;">${b}</li>`).join('')}
                </ul>
            </div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('projectsJson','Projects','')} class="editable-field" ${editBtn('projectsJson','Projects','')}>Click to add projects ✏</div>`;

    const sectionTitle = (text) =>
        `<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#1a1a2e;border-bottom:1.5px solid #1a1a2e;padding-bottom:3px;margin-bottom:10px;margin-top:16px;">${text}</div>`;

    return `
    <div style="display:flex;min-height:1040px;font-family:inherit;background:#fff;">

        <!-- LEFT COL -->
        <div style="width:260px;flex-shrink:0;border-right:1px solid #f3f4f6;">

            <!-- Photo -->
            <div style="overflow:hidden;">
                ${photoHTML}
            </div>

            <!-- Contact teal block -->
            <div style="background:#d6e8e2;padding:14px 16px;margin-top:0;">
                <div class="editable-field" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;" ${editBtn('address','Address', d.address||'')}>
                    <span style="font-size:13px;">📍</span>
                    <span style="font-size:12px;color:#374151;">${addr} <span class="edit-pen">✏</span></span>
                </div>
                <div class="editable-field" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;" ${editBtn('phone','Phone', d.phone||'')}>
                    <span style="font-size:13px;">📞</span>
                    <span style="font-size:12px;color:#374151;">${phone} <span class="edit-pen">✏</span></span>
                </div>
                <div class="editable-field" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;" ${editBtn('email','Email', d.email||'')}>
                    <span style="font-size:13px;">✉</span>
                    <span style="font-size:12px;color:#374151;">${email} <span class="edit-pen">✏</span></span>
                </div>
                <div class="editable-field" style="display:flex;align-items:center;gap:8px;" ${editBtn('website','Website', d.website||'')}>
                    <span style="font-size:13px;">🌐</span>
                    <span style="font-size:12px;color:#374151;">${website} <span class="edit-pen">✏</span></span>
                </div>
            </div>

            <div style="padding:0 16px 20px;">
                <!-- Education -->
                ${sectionTitle('EDUCATION')}
                <div class="editable-field" ${editBtn('educationJson','Education','')}>
                    ${eduHTML}<span class="edit-pen">✏</span>
                </div>

                <!-- Skills -->
                ${sectionTitle('SKILLS')}
                <ul style="list-style:disc;margin:0 0 0 14px;padding:0;" class="editable-field" ${editBtn('skillsJson','Skills',JSON.stringify(skills))}>
                    ${skillsList}
                    <span class="edit-pen">✏</span>
                </ul>
            </div>
        </div>

        <!-- RIGHT COL -->
        <div style="flex:1;padding:24px 24px 20px;">

            <!-- Name + Title -->
            <div class="editable-field" style="margin-bottom:4px;" ${editBtn('fullName','Full Name', d.fullName||'')}>
                <h1 style="font-size:2rem;font-weight:900;color:#1a1a2e;margin:0;">${name} <span class="edit-pen">✏</span></h1>
            </div>
            <div class="editable-field" style="margin-bottom:16px;" ${editBtn('jobTitle','Job Title', d.jobTitle||'')}>
                <p style="font-size:14px;color:#6b7280;font-style:italic;margin:0;">${title} <span class="edit-pen">✏</span></p>
            </div>

            <!-- Profile -->
            ${sectionTitle('PROFILE')}
            <div class="editable-field section-block" ${editBtn('profileSummary','Profile Summary', d.profileSummary||'')}>
                <p style="font-size:13px;color:#374151;line-height:1.65;margin:0;background:#f0f7f4;padding:12px;border-radius:6px;">${summary} <span class="edit-pen">✏</span></p>
            </div>

            <!-- Career / Experience -->
            ${sectionTitle('CAREER')}
            <div class="section-block" id="rv-experience-section">
                ${expHTML}
            </div>

            <!-- Projects -->
            ${projects.length > 0 ? `${sectionTitle('PROJECTS')}<div class="section-block" id="rv-projects-section">${projectsHTML}</div>` : ''}

            ${buildExtraSections(accentColor)}
        </div>
    </div>`;
}

// ============================================================
// TEMPLATE 3: MARY — Minimal Elegant (green top bar on left)
// Based on image: clean, photo top-left, green skill bars
// ============================================================
function buildMaryTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accentColor = color || '#2daf7f';
    const name    = d.fullName       || 'Your Name';
    const title   = d.jobTitle       || 'Job Title';
    const email   = d.email          || 'email@example.com';
    const phone   = d.phone          || '(415) 123-4343';
    const addr    = d.address        || 'San Francisco, CA 94110';
    const summary = d.profileSummary || 'Add your professional summary here.';

    const photoSize = d.photoSize || 90;
    const photoBorderRadius = d.photoShape === 'square' ? '8px' : '50%';
    const photoHTML = d.profilePhotoData
        ? `<div style="margin-bottom:10px;">
             <img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};object-fit:cover;object-position:${d.photoPosition||'top'};display:block;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>
             <div class="photo-controls" style="margin-top:5px;display:flex;align-items:center;gap:5px;">
               <input type="range" min="60" max="140" value="${photoSize}" style="width:80px;" oninput="updatePhotoSize(this.value)" title="Photo size">
               <select style="font-size:10px;border:1px solid #ccc;border-radius:4px;padding:1px 3px;" onchange="updatePhotoShape(this.value)">
                 <option value="circle" ${d.photoShape!=='square'?'selected':''}>● Circle</option>
                 <option value="square" ${d.photoShape==='square'?'selected':''}>■ Square</option>
               </select>
             </div>
           </div>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};background:#b0c4ba;display:flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:10px;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillsList = skills.length
        ? skills.map((s,i) => `
            <div style="margin-bottom:8px;">
                <div style="font-size:12px;color:#374151;margin-bottom:3px;">${s}</div>
                <div style="height:4px;background:#e5e7eb;border-radius:99px;overflow:hidden;">
                    <div style="height:100%;width:${Math.max(60, 100 - i*10)}%;background:${accentColor};border-radius:99px;"></div>
                </div>
            </div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Click to add skills ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `
            <div style="margin-bottom:8px;">
                <strong style="font-size:13px;color:#1a1a2e;display:block;">${e.degree || ''} ${e.field ? 'in ' + e.field : ''}</strong>
                <div style="font-size:12px;color:#6b7280;">${e.university || ''}, ${e.location || ''}</div>
            </div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Click to add ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `
            <div style="margin-bottom:16px;">
                <strong style="font-size:13px;color:#1a1a2e;display:block;">${e.role || e.title || ''}, ${e.company || ''}, ${e.location || ''}</strong>
                <span style="font-size:11px;color:#6b7280;">${e.from || ''} – ${e.to || 'Present'}</span>
                <ul style="margin:5px 0 0 16px;padding:0;">
                    ${(e.bullets || e.description || '').toString().split('\n').filter(Boolean).map(b => `<li style="font-size:12px;color:#374151;margin-bottom:3px;">${b}</li>`).join('')}
                </ul>
            </div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Employment History','')}>Click to add employment history ✏</div>`;

    const sectionTitle = (text) =>
        `<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#374151;border-bottom:1px solid #d1d5db;padding-bottom:3px;margin-bottom:10px;margin-top:18px;">${text}</div>`;

    return `
    <div style="display:flex;min-height:1040px;font-family:inherit;background:#fff;">

        <!-- LEFT COL -->
        <div style="width:230px;flex-shrink:0;padding:24px 16px;border-right:1px solid #e5e7eb;">

            ${photoHTML}

            <!-- Green accent bar -->
            <div style="height:6px;background:${accentColor};border-radius:3px;margin-bottom:16px;"></div>

            <!-- Contact -->
            ${sectionTitle('Contact')}
            <div class="editable-field" style="margin-bottom:5px;" ${editBtn('address','Address',d.address||'')}>
                <span style="font-size:12px;color:#374151;">📍 ${addr} <span class="edit-pen">✏</span></span>
            </div>
            <div class="editable-field" style="margin-bottom:5px;" ${editBtn('phone','Phone',d.phone||'')}>
                <span style="font-size:12px;color:#374151;">📞 ${phone} <span class="edit-pen">✏</span></span>
            </div>
            <div class="editable-field" style="margin-bottom:5px;" ${editBtn('email','Email',d.email||'')}>
                <span style="font-size:12px;color:#374151;">✉ ${email} <span class="edit-pen">✏</span></span>
            </div>

            <!-- Skills with bars -->
            ${sectionTitle('Skills')}
            <div class="editable-field" id="rv-skills-section" ${editBtn('skillsJson','Skills',JSON.stringify(skills))}>
                ${skillsList}
                <span class="edit-pen">✏</span>
            </div>

            <!-- Education -->
            ${sectionTitle('Education')}
            <div class="editable-field" ${editBtn('educationJson','Education','')}>
                ${eduHTML}<span class="edit-pen">✏</span>
            </div>
        </div>

        <!-- RIGHT COL -->
        <div style="flex:1;padding:24px 24px 20px;">

            <!-- Name + Title + green accent bar -->
            <div class="editable-field" style="margin-bottom:2px;" ${editBtn('fullName','Full Name',d.fullName||'')}>
                <h1 style="font-size:1.8rem;font-weight:900;color:#1a1a2e;margin:0;">${name} <span class="edit-pen">✏</span></h1>
            </div>
            <div class="editable-field" style="margin-bottom:4px;" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}>
                <p style="font-size:13px;color:#6b7280;margin:0;">${title} <span class="edit-pen">✏</span></p>
            </div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:16px;">
                <span>${addr}</span> &nbsp;·&nbsp;
                <span>${phone}</span> &nbsp;·&nbsp;
                <span>${email}</span>
            </div>

            <!-- Profile -->
            ${sectionTitle('Profile')}
            <div class="editable-field section-block" ${editBtn('profileSummary','Profile Summary',d.profileSummary||'')}>
                <p style="font-size:13px;color:#374151;line-height:1.65;margin:0;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',d.profileSummary||'')}>${summary} <span class="edit-pen">✏</span <span class="edit-pen">✏</span></p>
            </div>

            <!-- Employment History -->
            ${sectionTitle('Employment History')}
            <div class="section-block" id="rv-experience-section">
                ${expHTML}
            </div>

            <!-- Projects -->
            ${projects.length > 0 ? `
            ${sectionTitle('Projects')}
            <div class="section-block" id="rv-projects-section">
                ${projects.map(p => `
                    <div style="margin-bottom:12px;">
                        <strong style="font-size:13px;color:#1a1a2e;display:block;">${p.title || ''}</strong>
                        ${p.tools ? `<div style="font-size:11px;color:#6b7280;">Tools: ${p.tools}</div>` : ''}
                        <div style="font-size:12px;color:#374151;line-height:1.5;">${p.description || ''}</div>
                    </div>`).join('')}
            </div>` : ''}

            ${buildExtraSections(accentColor, `border-bottom:1px solid #d1d5db;padding-bottom:3px;`)}
        </div>
    </div>`;
}

// ============================================================
// TEMPLATE 4: TANYA — Dark Sidebar + Gold Accents
// ============================================================
function buildTanyaTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#b8860b';
    const gold   = '#f5c842';
    const name   = d.fullName       || 'Your Name';
    const title  = d.jobTitle       || 'Job Title';
    const email  = d.email          || 'email@example.com';
    const phone  = d.phone          || '000-000-0000';
    const addr   = d.address        || 'Your City';
    const website= d.website        || 'linkedin.com/in/you';
    const summary= d.profileSummary || 'Add your professional summary here.';

    const skillsList = skills.length
        ? skills.map(s => `<div style="font-size:12px;color:#ccc;padding:2px 0;">• ${s}</div>`).join('')
        : '<div style="font-size:12px;color:#888;">Add skills in builder</div>';

    const eduHTML = edu.length
        ? edu.map(e => `<div style="margin-bottom:8px;"><strong style="font-size:12px;color:#fff;display:block;">${e.degree||''}</strong><div style="font-size:11px;color:#aaa;">${e.university||''}</div><div style="font-size:10px;color:#888;">${e.from||''} – ${e.year||''}</div></div>`).join('')
        : `<div style="font-size:11px;color:#888;cursor:pointer;" ${editBtn('educationJson','Education','')}>Click to add ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div style="margin-bottom:14px;"><strong style="font-size:13px;color:#1a1a1a;display:block;">${e.role||e.title||''}</strong><div style="font-size:11px;color:#666;">${e.company||''} · ${e.from||''} – ${e.to||'Present'}</div><ul style="margin:5px 0 0 16px;padding:0;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`<li style="font-size:12px;color:#374151;margin-bottom:2px;">${b}</li>`).join('')}</ul></div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Career / Experience','')}>Click to add career history ✏</div>`;

    const projectsHTML = projects.length
        ? projects.map(p => `<div style="margin-bottom:12px;"><strong style="font-size:13px;color:#1a1a1a;display:block;">${p.title||''}</strong>${p.tools?`<div style="font-size:11px;color:#666;margin-bottom:2px;">Tools: ${p.tools}</div>`:''}<ul style="margin:4px 0 0 16px;padding:0;">${(p.description||'').split('\n').filter(Boolean).map(b=>`<li style="font-size:12px;color:#374151;">${b}</li>`).join('')}</ul></div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('projectsJson','Projects','')} class="editable-field" ${editBtn('projectsJson','Projects','')}>Click to add projects ✏</div>`;

    const secTitle = (t) => `<div style="font-size:11px;font-weight:800;color:${gold};text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px;">${t}</div>`;
    const rSecTitle= (t) => `<div style="font-size:11px;font-weight:800;color:#1a1a1a;text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:2px;margin:14px 0 8px;">${t}</div>`;

    const photoSize = d.photoSize || 80;
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:50%;object-fit:cover;border:3px solid ${gold};margin:0 auto 12px;display:block;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:50%;background:#555;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 12px;border:3px solid ${gold};cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    return `<div style="display:flex;min-height:1040px;font-family:inherit;">
        <div style="width:250px;flex-shrink:0;background:#2b2b2b;padding:24px 16px;color:#fff;">
            ${photoHTML}
            <div class="editable-field" style="text-align:center;margin-bottom:16px;" ${editBtn('fullName','Full Name',d.fullName||'')}><div style="font-size:15px;font-weight:900;color:#fff;">${name} <span class="edit-pen">✏</span></div></div>
            <div class="editable-field" style="text-align:center;margin-bottom:16px;" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}><div style="font-size:11px;color:${gold};">${title} <span class="edit-pen">✏</span></div></div>
            ${secTitle('Contact')}
            <div class="editable-field" style="font-size:12px;color:#ccc;line-height:1.9;" ${editBtn('address','Address',d.address||'')}>📍 ${addr} <span class="edit-pen">✏</span></div>
            <div class="editable-field" style="font-size:12px;color:#ccc;" ${editBtn('phone','Phone',d.phone||'')}>📞 ${phone} <span class="edit-pen">✏</span></div>
            <div class="editable-field" style="font-size:12px;color:#ccc;" ${editBtn('email','Email',d.email||'')}>✉ ${email} <span class="edit-pen">✏</span></div>
            <div class="editable-field" style="font-size:12px;color:#ccc;margin-bottom:14px;" ${editBtn('website','Website',d.website||'')}>🔗 ${website} <span class="edit-pen">✏</span></div>
            ${secTitle('Skills')}
            <div class="editable-field" ${editBtn('skillsJson','Skills',JSON.stringify(skills))}>${skillsList} <span class="edit-pen">✏</span></div>
            ${secTitle('Education')}
            <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen">✏</span></div>
        </div>
        <div style="flex:1;background:#fff;padding:28px 24px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;right:0;width:60px;height:90px;background:${accent};clip-path:polygon(0 0,100% 0,100% 100%);"></div>
            ${rSecTitle('Profile')}
            <div class="editable-field section-block" ${editBtn('profileSummary','Profile Summary',d.profileSummary||'')}><p style="font-size:13px;color:#374151;line-height:1.65;margin:0;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',d.profileSummary||'')}>${summary} <span class="edit-pen">✏</span <span class="edit-pen">✏</span></p></div>
            ${rSecTitle('Career')}
            <div class="section-block" id="rv-experience-section">${expHTML}</div>
            ${projects.length > 0 ? `${rSecTitle('Projects')}<div class="section-block" id="rv-projects-section">${projectsHTML}</div>` : ''}
            ${buildExtraSections(accent)}
        </div>
    </div>`;
}

// ============================================================
// TEMPLATE 5: SAMUEL — Black Sidebar + Yellow Numbered Sections
// ============================================================
function buildSamuelTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#f5c842';
    const name   = d.fullName       || 'Your Name';
    const title  = d.jobTitle       || 'Job Title';
    const email  = d.email          || 'email@example.com';
    const phone  = d.phone          || '000-000-0000';
    const addr   = d.address        || 'Your City';
    const summary= d.profileSummary || 'Add your professional summary here.';

    const skillBars = skills.length
        ? skills.slice(0,6).map(s => `<div style="margin-bottom:7px;"><div style="font-size:10px;color:#aaa;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px;">${s}</div><div style="height:6px;background:#333;border-radius:3px;overflow:hidden;"><div style="width:70%;height:100%;background:linear-gradient(90deg,${accent},#b8860b);border-radius:3px;"></div></div></div>`).join('')
        : `<div style="font-size:11px;color:#888;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Click to add ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div style="display:flex;gap:8px;margin-bottom:6px;align-items:flex-start;"><div style="background:#1a1a1a;color:#fff;font-size:10px;padding:2px 6px;border-radius:3px;white-space:nowrap;flex-shrink:0;">${e.year||'–'}</div><div style="font-size:12px;color:#555;">${e.degree||''} — ${e.university||''}</div></div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Click to add ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div style="display:flex;gap:8px;margin-bottom:10px;align-items:flex-start;"><div style="background:#1a1a1a;color:#fff;font-size:10px;padding:2px 6px;border-radius:3px;white-space:nowrap;flex-shrink:0;">${e.from||'–'}</div><div><div style="font-size:12px;font-weight:700;color:#222;">${e.role||e.title||''} — ${e.company||''}</div><div style="font-size:11px;color:#666;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).slice(0,2).join(' · ')}</div></div></div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Career / Experience','')}>Click to add career history ✏</div>`;

    const projectsHTML = projects.length
        ? projects.map(p => `<div style="margin-bottom:10px;"><strong style="font-size:12px;color:#1a1a1a;">${p.title||''}</strong>${p.tools?`<div style="font-size:10px;color:#888;">Tools: ${p.tools}</div>`:''}</div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('projectsJson','Projects','')}>Click to add ✏</div>`;

    const numSec = (n, t) => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;margin-top:16px;"><div style="width:22px;height:22px;background:${accent};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#1a1a1a;flex-shrink:0;">${n}</div><div style="font-size:11px;font-weight:800;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.5px;">${t}</div></div>`;

    const photoSize = d.photoSize || 80;
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:8px;object-fit:cover;margin:0 auto 12px;display:block;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:8px;background:#555;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 12px;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    return `<div style="display:flex;min-height:1040px;font-family:inherit;">
        <div style="width:240px;flex-shrink:0;background:#1a1a1a;padding:24px 14px;color:#fff;">
            ${photoHTML}
            <div style="background:${accent};color:#1a1a1a;font-size:10px;font-weight:800;padding:4px 8px;border-radius:4px;text-align:center;margin-bottom:10px;">CONTACT ME</div>
            <div class="editable-field" style="font-size:12px;color:#ccc;line-height:1.9;margin-bottom:14px;" ${editBtn('address','Address',d.address||'')}>📍 ${addr}<br>✉ ${email}<br>📞 ${phone} <span class="edit-pen">✏</span></div>
            <div style="background:${accent};color:#1a1a1a;font-size:10px;font-weight:800;padding:4px 8px;border-radius:4px;text-align:center;margin-bottom:10px;">PRO SKILLS</div>
            <div class="editable-field" ${editBtn('skillsJson','Skills',JSON.stringify(skills))}>${skillBars} <span class="edit-pen">✏</span></div>
        </div>
        <div style="flex:1;padding:24px 20px;background:#fff;">
            <div class="editable-field" style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;cursor:pointer;" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}>${title} <span class="edit-pen">✏</span></div>
            <div class="editable-field" style="display:inline-block;background:${accent};padding:3px 10px;margin-bottom:6px;" ${editBtn('fullName','Full Name',d.fullName||'')}><span style="font-size:22px;font-weight:900;color:#1a1a1a;">${name}</span> <span class="edit-pen">✏</span></div>
            <div class="editable-field" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}><div style="font-size:12px;color:#555;margin-bottom:12px;">${title} <span class="edit-pen">✏</span></div></div>
            <div style="font-size:12px;color:#555;line-height:1.65;margin-bottom:12px;">${summary}</div>
            ${numSec(1,'Education')}
            <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen">✏</span></div>
            ${numSec(2,'Experience')}
            <div class="section-block" id="rv-experience-section">${expHTML}</div>
            ${projects.length > 0 ? `${numSec(3,'Projects')}<div class="section-block" id="rv-projects-section">${projectsHTML}</div>` : ''}
            ${buildExtraSections(accent)}
        </div>
    </div>`;
}

// ============================================================
// TEMPLATE 6: ALEXANDER — Navy Timeline (full-width top, timeline left)
// ============================================================
function buildAlexanderTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#1e3a5f';
    const name   = d.fullName       || 'Your Name';
    const title  = d.jobTitle       || 'Job Title';
    const email  = d.email          || 'email@example.com';
    const phone  = d.phone          || '000-000-0000';
    const addr   = d.address        || 'Your City';
    const summary= d.profileSummary || 'Add your professional summary here.';

    const expHTML = experience.length
        ? experience.map(e => `<div style="margin-bottom:14px;position:relative;"><div style="position:absolute;left:-18px;top:4px;width:9px;height:9px;background:${accent};border-radius:50%;"></div><div style="font-size:11px;color:#888;margin-bottom:2px;">${e.from||''} – ${e.to||'Present'}</div><div style="font-size:12px;font-weight:700;color:${accent};">${e.role||e.title||''} — ${e.company||''}</div><ul style="margin:4px 0 0 14px;padding:0;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`<li style="font-size:12px;color:#374151;margin-bottom:2px;">${b}</li>`).join('')}</ul></div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Career / Experience','')}>Click to add career history ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div style="margin-bottom:8px;"><div style="font-size:12px;font-weight:700;color:#222;">${e.degree||''}</div><div style="font-size:11px;color:#555;">${e.university||''} · ${e.year||''}</div></div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Click to add ✏</div>`;

    const skillsList = skills.length
        ? skills.map(s => `<div style="font-size:12px;color:#555;padding:2px 0;">• ${s}</div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Click to add ✏</div>`;

    const projectsHTML = projects.length
        ? projects.map(p => `<div style="margin-bottom:10px;"><strong style="font-size:12px;color:${accent};">${p.title||''}</strong>${p.tools?`<div style="font-size:11px;color:#888;">Tools: ${p.tools}</div>`:''}</div>`).join('')
        : '';

    const secHead = (t) => `<div style="display:flex;align-items:center;gap:8px;margin:14px 0 8px;"><div style="width:22px;height:22px;background:${accent};border-radius:50%;flex-shrink:0;"></div><div style="font-size:12px;font-weight:800;color:${accent};text-transform:uppercase;">${t}</div></div>`;

    const photoSize = d.photoSize || 80;
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.4);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:2rem;border:3px solid rgba(255,255,255,0.4);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    return `<div style="min-height:1040px;font-family:inherit;background:#fff;">
        <div style="background:${accent};padding:24px 28px;display:flex;align-items:center;gap:20px;">
            ${photoHTML}
            <div>
                <div class="editable-field" ${editBtn('fullName','Full Name',d.fullName||'')}><div style="font-size:28px;font-weight:900;color:#fff;margin-bottom:3px;">${name} <span class="edit-pen" style="color:rgba(255,255,255,0.6);">✏</span></div></div>
                <div class="editable-field" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}><div style="font-size:12px;color:rgba(255,255,255,0.75);margin-bottom:10px;">${title} <span class="edit-pen" style="color:rgba(255,255,255,0.5);">✏</span></div></div>
                <div style="display:flex;gap:16px;flex-wrap:wrap;">
                    <div class="editable-field" style="display:flex;align-items:center;gap:5px;" ${editBtn('address','Address',d.address||'')}><div style="width:8px;height:8px;background:#f59e0b;border-radius:50%;flex-shrink:0;"></div><div style="font-size:11px;color:rgba(255,255,255,0.8);">${addr} <span class="edit-pen" style="color:rgba(255,255,255,0.5);">✏</span></div></div>
                    <div class="editable-field" style="display:flex;align-items:center;gap:5px;" ${editBtn('phone','Phone',d.phone||'')}><div style="width:8px;height:8px;background:#f59e0b;border-radius:50%;flex-shrink:0;"></div><div style="font-size:11px;color:rgba(255,255,255,0.8);">${phone} <span class="edit-pen" style="color:rgba(255,255,255,0.5);">✏</span></div></div>
                    <div class="editable-field" style="display:flex;align-items:center;gap:5px;" ${editBtn('email','Email',d.email||'')}><div style="width:8px;height:8px;background:#f59e0b;border-radius:50%;flex-shrink:0;"></div><div style="font-size:11px;color:rgba(255,255,255,0.8);">${email} <span class="edit-pen" style="color:rgba(255,255,255,0.5);">✏</span></div></div>
                </div>
            </div>
        </div>
        <div style="display:flex;gap:0;min-height:760px;">
            <div style="flex:1;padding:20px 24px;">
                <div style="font-size:12px;font-weight:800;color:${accent};text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:3px;margin-bottom:6px;">Profile</div>
                <div class="editable-field section-block" ${editBtn('profileSummary','Profile Summary',d.profileSummary||'')}><p style="font-size:12px;color:#555;line-height:1.65;margin:0 0 14px;">${summary} <span class="edit-pen">✏</span></p></div>
                <div style="font-size:12px;font-weight:800;color:${accent};text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:3px;margin-bottom:10px;">Work History</div>
                <div style="border-left:2px solid #e5e7eb;padding-left:14px;margin-left:6px;" class="section-block" id="rv-experience-section">${expHTML}</div>
                ${projects.length > 0 ? `<div style="font-size:12px;font-weight:800;color:${accent};text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:3px;margin:14px 0 8px;">Projects</div><div class="section-block" id="rv-projects-section">${projectsHTML}</div>` : ''}
                ${buildExtraSections(accent)}
            </div>
            <div style="width:35%;padding:20px 18px;background:#f8fafc;border-left:2px solid #e5e7eb;">
                ${secHead('Education')}
                <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen">✏</span></div>
                ${secHead('Skills')}
                <div class="editable-field" ${editBtn('skillsJson','Skills',JSON.stringify(skills))}>${skillsList} <span class="edit-pen">✏</span></div>
            </div>
        </div>
    </div>`;
}

// ============================================================
// TEMPLATE 7: MINIMAL — Pure Clean Minimal (light sidebar)
// ============================================================
function buildMinimalTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#111111';
    const name   = d.fullName       || 'Your Name';
    const title  = d.jobTitle       || 'Job Title';
    const email  = d.email          || 'email@example.com';
    const phone  = d.phone          || '000-000-0000';
    const addr   = d.address        || 'Your City';
    const website= d.website        || 'yoursite.com';
    const summary= d.profileSummary || 'Add your professional summary here.';

    const skillsList = skills.length
        ? skills.map(s => `<div style="font-size:12px;color:#444;padding:2px 0;">• ${s}</div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Click to add ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div style="margin-bottom:8px;"><div style="font-size:12px;font-weight:700;color:#111;">${e.degree||''}</div><div style="font-size:11px;color:#888;">${e.university||''} · ${e.year||''}</div></div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Click to add ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div style="margin-bottom:14px;display:flex;gap:8px;"><div style="width:7px;height:7px;background:${accent};border-radius:50%;flex-shrink:0;margin-top:5px;"></div><div><div style="font-size:13px;font-weight:700;color:#222;">${e.role||e.title||''} — ${e.company||''}</div><div style="font-size:11px;color:#888;margin-bottom:3px;">${e.from||''} – ${e.to||'Present'}</div><ul style="margin:4px 0 0 14px;padding:0;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`<li style="font-size:12px;color:#374151;margin-bottom:2px;">${b}</li>`).join('')}</ul></div></div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Career / Experience','')}>Click to add career history ✏</div>`;

    const projectsHTML = projects.length
        ? projects.map(p => `<div style="margin-bottom:10px;"><strong style="font-size:13px;color:#222;">${p.title||''}</strong>${p.tools?`<div style="font-size:11px;color:#888;">Tools: ${p.tools}</div>`:''}<ul style="margin:4px 0 0 14px;padding:0;">${(p.description||'').split('\n').filter(Boolean).map(b=>`<li style="font-size:12px;color:#374151;">${b}</li>`).join('')}</ul></div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('projectsJson','Projects','')}>Click to add ✏</div>`;

    const secTitle = (t) => `<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${accent};border-bottom:1.5px solid ${accent};padding-bottom:2px;margin:14px 0 8px;">${t}</div>`;

    const photoSize = d.photoSize || 80;
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:50%;object-fit:cover;display:block;margin-bottom:12px;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:50%;background:#d1d5db;display:flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:12px;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    return `<div style="display:flex;min-height:1040px;font-family:inherit;">
        <div style="width:240px;flex-shrink:0;background:#f8f8f8;padding:28px 16px;border-right:2px solid #e5e7eb;">
            ${photoHTML}
            <div class="editable-field" ${editBtn('fullName','Full Name',d.fullName||'')}><div style="font-size:17px;font-weight:900;color:#111;line-height:1.1;margin-bottom:3px;">${name} <span class="edit-pen">✏</span></div></div>
            <div class="editable-field" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}><div style="font-size:11px;color:#888;margin-bottom:16px;">${title} <span class="edit-pen">✏</span></div></div>
            ${secTitle('Contact')}
            <div class="editable-field" style="font-size:12px;color:#555;line-height:1.9;margin-bottom:14px;" ${editBtn('address','Address',d.address||'')}>📍 ${addr}<br>📞 ${phone}<br>✉ ${email}<br>🔗 ${website} <span class="edit-pen">✏</span></div>
            ${secTitle('Skills')}
            <div class="editable-field" ${editBtn('skillsJson','Skills',JSON.stringify(skills))}>${skillsList} <span class="edit-pen">✏</span></div>
            ${secTitle('Education')}
            <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen">✏</span></div>
        </div>
        <div style="flex:1;padding:28px 22px;background:#fff;">
            ${secTitle('Profile')}
            <div class="editable-field section-block" ${editBtn('profileSummary','Profile Summary',d.profileSummary||'')}><p style="font-size:13px;color:#555;line-height:1.65;margin:0 0 4px;">${summary} <span class="edit-pen">✏</span></p></div>
            ${secTitle('Experience')}
            <div class="section-block" id="rv-experience-section">${expHTML}</div>
            ${projects.length > 0 ? `${secTitle('Projects')}<div class="section-block" id="rv-projects-section">${projectsHTML}</div>` : ''}
            ${buildExtraSections(accent)}
        </div>
    </div>`;
}

// ============================================================
// TEMPLATE 8: TRADITIONAL — Navy Header Full-Width + Two Col
// ============================================================
function buildTraditionalTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#1e3a5f';
    const name   = d.fullName       || 'Your Name';
    const title  = d.jobTitle       || 'Job Title';
    const email  = d.email          || 'email@example.com';
    const phone  = d.phone          || '000-000-0000';
    const addr   = d.address        || 'Your City';
    const summary= d.profileSummary || 'Add your professional summary here.';

    const expHTML = experience.length
        ? experience.map(e => `<div style="margin-bottom:14px;"><div style="font-size:13px;font-weight:700;color:${accent};">${e.role||e.title||''} — ${e.company||''}</div><div style="font-size:11px;color:#888;margin-bottom:3px;">${e.from||''} – ${e.to||'Present'}</div><ul style="margin:4px 0 0 16px;padding:0;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`<li style="font-size:12px;color:#374151;margin-bottom:2px;">${b}</li>`).join('')}</ul></div>`).join('')
        : `<div style="font-size:12px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Career / Experience','')}>Click to add career history ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div style="margin-bottom:10px;"><div style="font-size:12px;font-weight:700;color:#222;">${e.degree||''}</div><div style="font-size:11px;color:#555;">${e.university||''}</div><div style="font-size:11px;color:#888;">${e.year||''}</div></div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Click to add ✏</div>`;

    const skillsList = skills.length
        ? skills.map(s => `<div style="font-size:12px;color:#555;padding:2px 0;">• ${s}</div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Click to add ✏</div>`;

    const projectsHTML = projects.length
        ? projects.map(p => `<div style="margin-bottom:10px;"><strong style="font-size:12px;color:${accent};">${p.title||''}</strong>${p.tools?`<div style="font-size:11px;color:#888;">Tools: ${p.tools}</div>`:''}</div>`).join('')
        : '';

    const secHead = (t) => `<div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:3px;margin:14px 0 8px;">${t}</div>`;

    const photoSize = d.photoSize || 70;
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:50%;object-fit:cover;border:3px solid rgba(255,255,255,0.5);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:1.8rem;border:3px solid rgba(255,255,255,0.4);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    return `<div style="min-height:1040px;font-family:inherit;background:#fff;">
        <div style="background:${accent};padding:22px 28px;display:flex;align-items:center;gap:16px;">
            ${photoHTML}
            <div style="flex:1;">
                <div class="editable-field" ${editBtn('fullName','Full Name',d.fullName||'')}><div style="font-size:26px;font-weight:900;color:#fff;margin-bottom:3px;">${name} <span class="edit-pen" style="color:rgba(255,255,255,0.5);">✏</span></div></div>
                <div class="editable-field" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}><div style="font-size:12px;color:rgba(255,255,255,0.75);margin-bottom:8px;">${title} <span class="edit-pen" style="color:rgba(255,255,255,0.5);">✏</span></div></div>
                <div style="display:flex;gap:16px;flex-wrap:wrap;">
                    <div class="editable-field" style="display:flex;align-items:center;gap:5px;" ${editBtn('address','Address',d.address||'')}><div style="width:7px;height:7px;background:#f59e0b;border-radius:50%;"></div><span style="font-size:11px;color:rgba(255,255,255,0.85);">${addr} <span class="edit-pen" style="color:rgba(255,255,255,0.5);">✏</span></span></div>
                    <div class="editable-field" style="display:flex;align-items:center;gap:5px;" ${editBtn('phone','Phone',d.phone||'')}><div style="width:7px;height:7px;background:#f59e0b;border-radius:50%;"></div><span style="font-size:11px;color:rgba(255,255,255,0.85);">${phone} <span class="edit-pen" style="color:rgba(255,255,255,0.5);">✏</span></span></div>
                    <div class="editable-field" style="display:flex;align-items:center;gap:5px;" ${editBtn('email','Email',d.email||'')}><div style="width:7px;height:7px;background:#f59e0b;border-radius:50%;"></div><span style="font-size:11px;color:rgba(255,255,255,0.85);">${email} <span class="edit-pen" style="color:rgba(255,255,255,0.5);">✏</span></span></div>
                </div>
            </div>
        </div>
        <div style="display:flex;min-height:760px;">
            <div style="flex:1;padding:20px 24px;">
                ${secHead('Summary')}
                <div class="editable-field section-block" ${editBtn('profileSummary','Profile Summary',d.profileSummary||'')}><p style="font-size:12px;color:#555;line-height:1.65;margin:0 0 4px;">${summary} <span class="edit-pen">✏</span></p></div>
                ${secHead('Work History')}
                <div class="section-block" id="rv-experience-section">${expHTML}</div>
                ${secHead('Skills')}
                <div class="editable-field" ${editBtn('skillsJson','Skills',JSON.stringify(skills))}>${skillsList} <span class="edit-pen">✏</span></div>
                ${projects.length > 0 ? `${secHead('Projects')}<div class="section-block" id="rv-projects-section">${projectsHTML}</div>` : ''}
                ${buildExtraSections(accent)}
            </div>
            <div style="width:33%;padding:20px 18px;background:#f8fafc;border-left:2px solid #e5e7eb;">
                ${secHead('Education')}
                <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML} <span class="edit-pen">✏</span></div>
            </div>
        </div>
    </div>`;
}

// ============================================================
// EXTRA SECTIONS (custom)
// ============================================================
function buildExtraSections(color, titleStyle = '') {
    let html = '';
    Object.entries(activeSections).forEach(([name, show]) => {
        if (!show) return;
        html += `
            <div class="section-block" id="rv-section-${name}">
                <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:${color};border-bottom:2px solid ${color};padding-bottom:3px;margin-bottom:10px;margin-top:16px;${titleStyle}">${name.charAt(0).toUpperCase()+name.slice(1)}</div>
                <div class="editable-field extra-section-content" ${editBtn('extra_' + name, name, '')}>
                    <em style="color:#9ca3af;font-size:12px;">Click to add ${name} content</em> <span class="edit-pen">✏</span>
                </div>
            </div>`;
    });
    return html;
}

function applyActiveSections() {
    Object.entries(activeSections).forEach(([name, show]) => {
        const el = document.getElementById('rv-section-' + name);
        if (el) el.style.display = show ? '' : 'none';
    });
}

// ============================================================
// EDIT MODAL
// ============================================================
let editModalField = null;

function openEditModal(field, label, currentVal) {
    editModalField = field;

    const overlay = document.getElementById('inlineEditOverlay');
    const modal   = document.getElementById('inlineEditModal');
    const titleEl = document.getElementById('editModalTitle');
    const body    = document.getElementById('editModalBody');
    if (!overlay || !body) return;

    if (titleEl) titleEl.textContent = 'Edit ' + label;

    // ── Decide which tab to open ──
    const tabMap = {
        profilePhoto:    'photo',
        fullName:        'personal',
        jobTitle:        'personal',
        dob:             'personal',
        gender:          'personal',
        nationality:     'personal',
        profileSummary:  'summary',
        email:           'contact',
        phone:           'contact',
        address:         'contact',
        website:         'contact',
        linkedin:        'contact',
        location:        'contact',
        skillsJson:      'skills',
        educationJson:   'education',
        experienceJson:  'experience',
        projectsJson:    'projects',
        certifications:  'extra',
        languages:       'extra',
        awards:          'extra',
        interests:       'extra',
        qualities:       'extra',
    };
    const startTab = tabMap[field] || (field.startsWith('extra_') ? 'extra' : 'personal');

    body.innerHTML = buildFullEditPanel(startTab);
    overlay.style.display = 'flex';

    // Focus first input
    setTimeout(() => {
        const first = body.querySelector('input:not([type=file]),textarea');
        if (first) first.focus();
    }, 120);
}

// ── Build the full edit panel HTML ──
function buildFullEditPanel(activeTab) {
    const d = resumeData;
    const tabs = [
        { id: 'photo',      icon: '📸', label: 'Photo'      },
        { id: 'personal',   icon: '👤', label: 'Personal'   },
        { id: 'summary',    icon: '📝', label: 'Summary'    },
        { id: 'contact',    icon: '📞', label: 'Contact'    },
        { id: 'skills',     icon: '🛠', label: 'Skills'     },
        { id: 'education',  icon: '🎓', label: 'Education'  },
        { id: 'experience', icon: '💼', label: 'Experience' },
        { id: 'projects',   icon: '📁', label: 'Projects'   },
        { id: 'extra',      icon: '➕', label: 'More'       },
    ];

    const navHTML = tabs.map(t => `
        <button class="ep-tab-btn ${t.id === activeTab ? 'active' : ''}"
                onclick="switchEditTab('${t.id}')" type="button">
            <span class="ep-tab-icon">${t.icon}</span>
            <span class="ep-tab-label">${t.label}</span>
        </button>`).join('');

    return `
    <div class="ep-wrap">
      <div class="ep-nav">${navHTML}</div>
      <div class="ep-content" id="epContent">
        ${buildTabContent(activeTab)}
      </div>
    </div>`;
}

function switchEditTab(tabId) {
    // Save current tab before switching
    saveCurrentTabData();
    document.querySelectorAll('.ep-tab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('onclick').includes(`'${tabId}'`)));
    const content = document.getElementById('epContent');
    if (content) content.innerHTML = buildTabContent(tabId);
    updateEditModalTitle(tabId);
}

function buildTabContent(tabId) {
    const d = resumeData;
    if (tabId === 'photo') return buildPhotoTab(d);
    if (tabId === 'personal') return buildPersonalTab(d);
    if (tabId === 'summary') return buildSummaryTab(d);
    if (tabId === 'contact') return buildContactTab(d);
    if (tabId === 'skills') return buildSkillsTab(d);
    if (tabId === 'education') return buildEducationTab(d);
    if (tabId === 'experience') return buildExperienceTab(d);
    if (tabId === 'projects') return buildProjectsTab(d);
    if (tabId === 'extra') return buildExtraTab(d);
    return '';
}

// ─── PHOTO TAB ───────────────────────────────────────────────
function buildPhotoTab(d) {
    const hasPhoto = !!d.profilePhotoData;
    return `<div class="ep-section">
      <h4 class="ep-section-title">Profile Photo</h4>
      <div style="text-align:center;margin-bottom:18px;">
        ${hasPhoto
            ? `<img src="${d.profilePhotoData}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #7c3aed;display:block;margin:0 auto 12px;">`
            : `<div style="width:100px;height:100px;border-radius:50%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:3rem;margin:0 auto 12px;border:3px dashed #d1d5db;">👤</div>`}
        <label class="ep-upload-btn">
            📷 ${hasPhoto ? 'Change Photo' : 'Upload Photo'}
            <input type="file" id="photoFileInput" accept="image/*" style="display:none" onchange="handleReviewPhotoUpload(event)">
        </label>
        ${hasPhoto ? `<br><button class="ep-remove-btn" onclick="removeReviewPhoto()">🗑 Remove Photo</button>` : ''}
        <p style="font-size:11px;color:#9ca3af;margin-top:10px;">JPG, PNG supported · Max 5MB</p>
      </div>
      <h4 class="ep-section-title">Photo Shape & Size</h4>
      <div class="ep-row">
        <div class="ep-field">
          <label class="ep-label">Shape</label>
          <select class="ep-select" id="ep_photoShape" onchange="livePreviewPhoto()">
            <option value="circle" ${(d.photoShape||'circle')==='circle'?'selected':''}>⬤ Circle</option>
            <option value="square" ${d.photoShape==='square'?'selected':''}>■ Square</option>
          </select>
        </div>
        <div class="ep-field">
          <label class="ep-label">Size: <span id="ep_photoSizeVal">${d.photoSize||88}px</span></label>
          <input type="range" min="50" max="150" value="${d.photoSize||88}" id="ep_photoSize"
                 oninput="document.getElementById('ep_photoSizeVal').textContent=this.value+'px'"
                 style="width:100%;">
        </div>
      </div>
      <button class="ep-save-btn" onclick="savePhotoTab()">💾 Save Changes</button>
    </div>`;
}

// ─── PERSONAL TAB ─────────────────────────────────────────────
function buildPersonalTab(d) {
    return `<div class="ep-section">
      <h4 class="ep-section-title">Personal Information</h4>
      <div class="ep-row">
        <div class="ep-field">
          <label class="ep-label">Full Name *</label>
          <input class="ep-input" id="ep_fullName" value="${esc(d.fullName||'')}" placeholder="e.g. John Smith">
        </div>
        <div class="ep-field">
          <label class="ep-label">Job Title *</label>
          <input class="ep-input" id="ep_jobTitle" value="${esc(d.jobTitle||'')}" placeholder="e.g. Software Engineer">
        </div>
      </div>
      <div class="ep-row">
        <div class="ep-field">
          <label class="ep-label">Date of Birth</label>
          <input class="ep-input" id="ep_dob" value="${esc(d.dob||'')}" placeholder="DD/MM/YYYY">
        </div>
        <div class="ep-field">
          <label class="ep-label">Gender</label>
          <select class="ep-select" id="ep_gender">
            <option value="">– Select –</option>
            <option value="Male" ${d.gender==='Male'?'selected':''}>Male</option>
            <option value="Female" ${d.gender==='Female'?'selected':''}>Female</option>
            <option value="Non-binary" ${d.gender==='Non-binary'?'selected':''}>Non-binary</option>
            <option value="Prefer not to say" ${d.gender==='Prefer not to say'?'selected':''}>Prefer not to say</option>
          </select>
        </div>
      </div>
      <div class="ep-row">
        <div class="ep-field">
          <label class="ep-label">Nationality</label>
          <input class="ep-input" id="ep_nationality" value="${esc(d.nationality||'')}" placeholder="e.g. Indian">
        </div>
        <div class="ep-field">
          <label class="ep-label">Location / City</label>
          <input class="ep-input" id="ep_location" value="${esc(d.location||'')}" placeholder="e.g. Chennai, India">
        </div>
      </div>
      <button class="ep-save-btn" onclick="savePersonalTab()">💾 Save Changes</button>
    </div>`;
}

// ─── SUMMARY TAB ──────────────────────────────────────────────
function buildSummaryTab(d) {
    return `<div class="ep-section">
      <h4 class="ep-section-title">Profile Summary</h4>
      <p class="ep-hint">Write 2–4 sentences highlighting your expertise, experience and career goals.</p>
      <textarea class="ep-textarea" id="ep_profileSummary" rows="6" placeholder="A results-driven professional with X years of experience in...">${esc(d.profileSummary||'')}</textarea>
      <div style="display:flex;gap:10px;align-items:center;margin-top:6px;">
        <span style="font-size:11px;color:#9ca3af;" id="ep_summaryCount">${(d.profileSummary||'').length} chars</span>
      </div>
      <button class="ep-save-btn" onclick="saveSummaryTab()">💾 Save Summary</button>
    </div>`;
}

// ─── CONTACT TAB ──────────────────────────────────────────────
function buildContactTab(d) {
    return `<div class="ep-section">
      <h4 class="ep-section-title">Contact Information</h4>
      <div class="ep-row">
        <div class="ep-field">
          <label class="ep-label">📞 Phone</label>
          <input class="ep-input" id="ep_phone" value="${esc(d.phone||'')}" placeholder="+91 9876543210">
        </div>
        <div class="ep-field">
          <label class="ep-label">✉ Email</label>
          <input class="ep-input" id="ep_email" type="email" value="${esc(d.email||'')}" placeholder="you@email.com">
        </div>
      </div>
      <div class="ep-field">
        <label class="ep-label">📍 Address / City</label>
        <input class="ep-input" id="ep_address" value="${esc(d.address||'')}" placeholder="123 Main St, Chennai, TN">
      </div>
      <div class="ep-row">
        <div class="ep-field">
          <label class="ep-label">🔗 LinkedIn URL</label>
          <input class="ep-input" id="ep_linkedin" value="${esc(d.linkedin||'')}" placeholder="linkedin.com/in/yourname">
        </div>
        <div class="ep-field">
          <label class="ep-label">🌐 Website / Portfolio</label>
          <input class="ep-input" id="ep_website" value="${esc(d.website||'')}" placeholder="yourportfolio.com">
        </div>
      </div>
      <button class="ep-save-btn" onclick="saveContactTab()">💾 Save Contact</button>
    </div>`;
}

// ─── SKILLS TAB ───────────────────────────────────────────────
function buildSkillsTab(d) {
    let skills = [];
    try { skills = JSON.parse(d.skillsJson||'[]'); } catch {}
    const items = skills.map((s,i) => {
        const sn = s.name||s; const lv = typeof s.level==='number' ? s.level : 80;
        return `<div class="ep-skill-row" id="epsk${i}">
          <input class="ep-input" style="flex:1;" value="${esc(sn)}" placeholder="Skill name" oninput="updateSkillEntry(${i},'name',this.value)">
          <div style="display:flex;align-items:center;gap:6px;min-width:160px;">
            <input type="range" min="0" max="100" value="${lv}" style="flex:1;"
                   oninput="updateSkillEntry(${i},'level',+this.value);this.nextElementSibling.textContent=this.value+'%'">
            <span style="font-size:11px;color:#6b7280;min-width:32px;">${lv}%</span>
          </div>
          <button class="ep-remove-row" onclick="removeSkillEntry(${i})" title="Remove">✕</button>
        </div>`;
    }).join('');
    return `<div class="ep-section">
      <h4 class="ep-section-title">Skills</h4>
      <p class="ep-hint">Add your key skills. Drag the slider to set proficiency level.</p>
      <div id="epSkillList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px;">${items}</div>
      <button class="ep-add-btn" onclick="addSkillEntry()">+ Add Skill</button>
      <button class="ep-save-btn" onclick="saveSkillsTab()">💾 Save Skills</button>
    </div>`;
}

// ─── EDUCATION TAB ────────────────────────────────────────────
function buildEducationTab(d) {
    let arr = [];
    try { arr = JSON.parse(d.educationJson||'[]'); } catch {}
    const items = arr.map((e,i) => `<div class="ep-card" id="eped${i}">
      <div class="ep-card-header">
        <span style="font-weight:700;font-size:13px;">🎓 ${e.degree||e.school||'Education #'+(i+1)}</span>
        <button class="ep-remove-row" onclick="removeEduEntry(${i})" title="Remove">✕</button>
      </div>
      <div class="ep-row">
        <div class="ep-field"><label class="ep-label">Degree / Qualification</label>
          <input class="ep-input" value="${esc(e.degree||'')}" placeholder="B.Tech Computer Science" oninput="updateEduEntry(${i},'degree',this.value)"></div>
        <div class="ep-field"><label class="ep-label">School / University</label>
          <input class="ep-input" value="${esc(e.school||e.university||'')}" placeholder="IIT Madras" oninput="updateEduEntry(${i},'school',this.value)"></div>
      </div>
      <div class="ep-row">
        <div class="ep-field"><label class="ep-label">Graduation Year</label>
          <input class="ep-input" value="${esc(e.year||'')}" placeholder="2024" oninput="updateEduEntry(${i},'year',this.value)"></div>
        <div class="ep-field"><label class="ep-label">GPA / CGPA</label>
          <input class="ep-input" value="${esc(e.cgpa||'')}" placeholder="8.5" oninput="updateEduEntry(${i},'cgpa',this.value)"></div>
      </div>
    </div>`).join('');
    return `<div class="ep-section">
      <h4 class="ep-section-title">Education</h4>
      <div id="epEduList" style="display:flex;flex-direction:column;gap:12px;margin-bottom:10px;">${items}</div>
      <button class="ep-add-btn" onclick="addEduEntry()">+ Add Education</button>
      <button class="ep-save-btn" onclick="saveEducationTab()">💾 Save Education</button>
    </div>`;
}

// ─── EXPERIENCE TAB ───────────────────────────────────────────
function buildExperienceTab(d) {
    let arr = [];
    try { arr = JSON.parse(d.experienceJson||'[]'); } catch {}
    const items = arr.map((e,i) => `<div class="ep-card" id="epex${i}">
      <div class="ep-card-header">
        <span style="font-weight:700;font-size:13px;">💼 ${e.jobTitle||e.title||e.company||'Experience #'+(i+1)}</span>
        <button class="ep-remove-row" onclick="removeExpEntry(${i})" title="Remove">✕</button>
      </div>
      <div class="ep-row">
        <div class="ep-field"><label class="ep-label">Job Title / Role *</label>
          <input class="ep-input" value="${esc(e.jobTitle||e.role||e.title||'')}" placeholder="Software Engineer" oninput="updateExpEntry(${i},'jobTitle',this.value)"></div>
        <div class="ep-field"><label class="ep-label">Company / Organisation *</label>
          <input class="ep-input" value="${esc(e.company||'')}" placeholder="Google" oninput="updateExpEntry(${i},'company',this.value)"></div>
      </div>
      <div class="ep-row">
        <div class="ep-field"><label class="ep-label">Start Date</label>
          <input class="ep-input" value="${esc(e.startDate||e.from||'')}" placeholder="Jan 2022" oninput="updateExpEntry(${i},'startDate',this.value)"></div>
        <div class="ep-field"><label class="ep-label">End Date</label>
          <input class="ep-input" value="${esc(e.endDate||e.to||'')}" placeholder="Present" oninput="updateExpEntry(${i},'endDate',this.value)"></div>
      </div>
      <div class="ep-field"><label class="ep-label">Location</label>
        <input class="ep-input" value="${esc(e.location||'')}" placeholder="Chennai, India" oninput="updateExpEntry(${i},'location',this.value)"></div>
      <div class="ep-field"><label class="ep-label">Description / Bullet Points</label>
        <textarea class="ep-textarea" rows="4" placeholder="• Led a team of 5 engineers to deliver…&#10;• Improved performance by 40%…" oninput="updateExpEntry(${i},'description',this.value)">${esc(e.description||e.bullets||'')}</textarea></div>
    </div>`).join('');
    return `<div class="ep-section">
      <h4 class="ep-section-title">Work Experience</h4>
      <div id="epExpList" style="display:flex;flex-direction:column;gap:12px;margin-bottom:10px;">${items}</div>
      <button class="ep-add-btn" onclick="addExpEntry()">+ Add Experience</button>
      <button class="ep-save-btn" onclick="saveExperienceTab()">💾 Save Experience</button>
    </div>`;
}

// ─── PROJECTS TAB ─────────────────────────────────────────────
function buildProjectsTab(d) {
    let arr = [];
    try { arr = JSON.parse(d.projectsJson||'[]'); } catch {}
    const items = arr.map((p,i) => `<div class="ep-card" id="eppr${i}">
      <div class="ep-card-header">
        <span style="font-weight:700;font-size:13px;">📁 ${p.title||p.name||'Project #'+(i+1)}</span>
        <button class="ep-remove-row" onclick="removeProjEntry(${i})" title="Remove">✕</button>
      </div>
      <div class="ep-row">
        <div class="ep-field"><label class="ep-label">Project Title *</label>
          <input class="ep-input" value="${esc(p.title||p.name||'')}" placeholder="E-Commerce Platform" oninput="updateProjEntry(${i},'title',this.value)"></div>
        <div class="ep-field"><label class="ep-label">Tools / Technologies</label>
          <input class="ep-input" value="${esc(p.tools||'')}" placeholder="React, Node.js, MongoDB" oninput="updateProjEntry(${i},'tools',this.value)"></div>
      </div>
      <div class="ep-row">
        <div class="ep-field"><label class="ep-label">Year</label>
          <input class="ep-input" value="${esc(p.year||'')}" placeholder="2024" oninput="updateProjEntry(${i},'year',this.value)"></div>
        <div class="ep-field"><label class="ep-label">Project URL (optional)</label>
          <input class="ep-input" value="${esc(p.url||'')}" placeholder="github.com/you/project" oninput="updateProjEntry(${i},'url',this.value)"></div>
      </div>
      <div class="ep-field"><label class="ep-label">Description</label>
        <textarea class="ep-textarea" rows="3" placeholder="Built a full-stack platform that…" oninput="updateProjEntry(${i},'description',this.value)">${esc(p.description||'')}</textarea></div>
    </div>`).join('');
    return `<div class="ep-section">
      <h4 class="ep-section-title">Projects</h4>
      <div id="epProjList" style="display:flex;flex-direction:column;gap:12px;margin-bottom:10px;">${items}</div>
      <button class="ep-add-btn" onclick="addProjEntry()">+ Add Project</button>
      <button class="ep-save-btn" onclick="saveProjectsTab()">💾 Save Projects</button>
    </div>`;
}

// ─── EXTRA TAB ────────────────────────────────────────────────
function buildExtraTab(d) {
    return `<div class="ep-section">
      <h4 class="ep-section-title">Additional Information</h4>

      <div class="ep-field"><label class="ep-label">🌐 Languages (comma-separated)</label>
        <input class="ep-input" id="ep_languages" value="${esc(d.languages||'')}" placeholder="English, Tamil, Hindi"></div>

      <div class="ep-field"><label class="ep-label">🏆 Awards & Honors</label>
        <textarea class="ep-textarea" id="ep_awards" rows="3" placeholder="Best Employee Award 2023&#10;Hackathon Runner-Up…">${esc(d.awards||'')}</textarea></div>

      <div class="ep-field"><label class="ep-label">❤️ Interests / Hobbies</label>
        <textarea class="ep-textarea" id="ep_interests" rows="3" placeholder="Photography, Open-source Contribution, Chess…">${esc(d.interests||'')}</textarea></div>

      <div class="ep-field"><label class="ep-label">📜 Certifications</label>
        <textarea class="ep-textarea" id="ep_certifications" rows="3" placeholder="AWS Certified Developer (2023)&#10;Google Analytics Certified…">${esc(d.certifications||'')}</textarea></div>

      <div class="ep-field"><label class="ep-label">💡 Key Qualities / Strengths</label>
        <input class="ep-input" id="ep_qualities" value="${esc(d.qualities||'')}" placeholder="Leadership, Problem Solving, Team Player"></div>

      <button class="ep-save-btn" onclick="saveExtraTab()">💾 Save All</button>
    </div>`;
}

// ─── Live edit state (for array fields) ──────────────────────
let _epSkills = [], _epEdu = [], _epExp = [], _epProj = [];

function esc(s) { return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

// ── Skill entries ──
function addSkillEntry() {
    try { _epSkills = JSON.parse(resumeData.skillsJson||'[]'); } catch { _epSkills=[]; }
    _epSkills.push({name:'',level:80});
    const list = document.getElementById('epSkillList');
    if (list) {
        const i = _epSkills.length-1;
        const div = document.createElement('div');
        div.className = 'ep-skill-row'; div.id = 'epsk'+i;
        div.innerHTML = `<input class="ep-input" style="flex:1;" value="" placeholder="Skill name" oninput="updateSkillEntry(${i},'name',this.value)">
          <div style="display:flex;align-items:center;gap:6px;min-width:160px;">
            <input type="range" min="0" max="100" value="80" style="flex:1;"
                   oninput="updateSkillEntry(${i},'level',+this.value);this.nextElementSibling.textContent=this.value+'%'">
            <span style="font-size:11px;color:#6b7280;min-width:32px;">80%</span>
          </div>
          <button class="ep-remove-row" onclick="removeSkillEntry(${i})" title="Remove">✕</button>`;
        list.appendChild(div);
        div.querySelector('input').focus();
    }
}
function updateSkillEntry(i,k,v) { try{_epSkills=JSON.parse(resumeData.skillsJson||'[]');}catch{_epSkills=[];} if(_epSkills[i])_epSkills[i][k]=v; }
function removeSkillEntry(i) {
    try{_epSkills=JSON.parse(resumeData.skillsJson||'[]');}catch{_epSkills=[];}
    _epSkills.splice(i,1);
    resumeData.skillsJson = JSON.stringify(_epSkills);
    const content = document.getElementById('epContent');
    if (content) content.innerHTML = buildTabContent('skills');
}
function saveSkillsTab() {
    const rows = document.querySelectorAll('#epSkillList .ep-skill-row');
    const arr = [];
    rows.forEach((row,i) => {
        const inp = row.querySelector('input[type=text],input:not([type=range]):not([type=file])');
        const rng = row.querySelector('input[type=range]');
        const name = inp ? inp.value.trim() : '';
        if (name) arr.push({ name, level: rng ? +rng.value : 80 });
    });
    resumeData.skillsJson = JSON.stringify(arr);
    persistField('skillsJson', resumeData.skillsJson);
    renderResume(); closeEditModal(); showToast('✓ Skills saved!');
}

// ── Education entries ──
function addEduEntry() {
    try{_epEdu=JSON.parse(resumeData.educationJson||'[]');}catch{_epEdu=[];}
    _epEdu.push({degree:'',school:'',year:'',cgpa:''});
    resumeData.educationJson = JSON.stringify(_epEdu);
    const content = document.getElementById('epContent');
    if (content) content.innerHTML = buildTabContent('education');
}
function updateEduEntry(i,k,v) { try{_epEdu=JSON.parse(resumeData.educationJson||'[]');}catch{_epEdu=[];} if(_epEdu[i])_epEdu[i][k]=v; }
function removeEduEntry(i) {
    try{_epEdu=JSON.parse(resumeData.educationJson||'[]');}catch{_epEdu=[];}
    _epEdu.splice(i,1);
    resumeData.educationJson = JSON.stringify(_epEdu);
    const content = document.getElementById('epContent');
    if (content) content.innerHTML = buildTabContent('education');
}
function saveEducationTab() {
    const cards = document.querySelectorAll('#epEduList .ep-card');
    const arr = [];
    cards.forEach(card => {
        const inputs = card.querySelectorAll('input');
        arr.push({ degree:inputs[0]?.value.trim()||'', school:inputs[1]?.value.trim()||'', year:inputs[2]?.value.trim()||'', cgpa:inputs[3]?.value.trim()||'' });
    });
    resumeData.educationJson = JSON.stringify(arr.filter(e=>e.degree||e.school));
    persistField('educationJson', resumeData.educationJson);
    renderResume(); closeEditModal(); showToast('✓ Education saved!');
}

// ── Experience entries ──
function addExpEntry() {
    try{_epExp=JSON.parse(resumeData.experienceJson||'[]');}catch{_epExp=[];}
    _epExp.push({jobTitle:'',company:'',startDate:'',endDate:'Present',location:'',description:''});
    resumeData.experienceJson = JSON.stringify(_epExp);
    const content = document.getElementById('epContent');
    if (content) content.innerHTML = buildTabContent('experience');
}
function updateExpEntry(i,k,v) { try{_epExp=JSON.parse(resumeData.experienceJson||'[]');}catch{_epExp=[];} if(_epExp[i])_epExp[i][k]=v; }
function removeExpEntry(i) {
    try{_epExp=JSON.parse(resumeData.experienceJson||'[]');}catch{_epExp=[];}
    _epExp.splice(i,1);
    resumeData.experienceJson = JSON.stringify(_epExp);
    const content = document.getElementById('epContent');
    if (content) content.innerHTML = buildTabContent('experience');
}
function saveExperienceTab() {
    const cards = document.querySelectorAll('#epExpList .ep-card');
    const arr = [];
    cards.forEach(card => {
        const inputs = card.querySelectorAll('input');
        const ta = card.querySelector('textarea');
        arr.push({
            jobTitle:   inputs[0]?.value.trim()||'',
            company:    inputs[1]?.value.trim()||'',
            startDate:  inputs[2]?.value.trim()||'',
            endDate:    inputs[3]?.value.trim()||'Present',
            location:   inputs[4]?.value.trim()||'',
            description: ta?.value.trim()||''
        });
    });
    resumeData.experienceJson = JSON.stringify(arr.filter(e=>e.jobTitle||e.company));
    persistField('experienceJson', resumeData.experienceJson);
    renderResume(); closeEditModal(); showToast('✓ Experience saved!');
}

// ── Project entries ──
function addProjEntry() {
    try{_epProj=JSON.parse(resumeData.projectsJson||'[]');}catch{_epProj=[];}
    _epProj.push({title:'',tools:'',year:'',url:'',description:''});
    resumeData.projectsJson = JSON.stringify(_epProj);
    const content = document.getElementById('epContent');
    if (content) content.innerHTML = buildTabContent('projects');
}
function updateProjEntry(i,k,v) { try{_epProj=JSON.parse(resumeData.projectsJson||'[]');}catch{_epProj=[];} if(_epProj[i])_epProj[i][k]=v; }
function removeProjEntry(i) {
    try{_epProj=JSON.parse(resumeData.projectsJson||'[]');}catch{_epProj=[];}
    _epProj.splice(i,1);
    resumeData.projectsJson = JSON.stringify(_epProj);
    const content = document.getElementById('epContent');
    if (content) content.innerHTML = buildTabContent('projects');
}
function saveProjectsTab() {
    const cards = document.querySelectorAll('#epProjList .ep-card');
    const arr = [];
    cards.forEach(card => {
        const inputs = card.querySelectorAll('input');
        const ta = card.querySelector('textarea');
        arr.push({ title:inputs[0]?.value.trim()||'', tools:inputs[1]?.value.trim()||'', year:inputs[2]?.value.trim()||'', url:inputs[3]?.value.trim()||'', description:ta?.value.trim()||'' });
    });
    resumeData.projectsJson = JSON.stringify(arr.filter(p=>p.title));
    persistField('projectsJson', resumeData.projectsJson);
    renderResume(); closeEditModal(); showToast('✓ Projects saved!');
}

// ── Single-field save helpers ──
function savePhotoTab() {
    const shape = document.getElementById('ep_photoShape')?.value || 'circle';
    const size  = +(document.getElementById('ep_photoSize')?.value || 88);
    resumeData.photoShape = shape;
    resumeData.photoSize  = size;
    persistFields({ photoShape: shape, photoSize: size });
    renderResume(); closeEditModal(); showToast('✓ Photo settings saved!');
}
function savePersonalTab() {
    const fields = ['fullName','jobTitle','dob','gender','nationality','location'];
    fields.forEach(f => {
        const el = document.getElementById('ep_'+f);
        if (el) resumeData[f] = el.value.trim();
    });
    persistFields({ fullName:resumeData.fullName, jobTitle:resumeData.jobTitle, dob:resumeData.dob, gender:resumeData.gender, nationality:resumeData.nationality, location:resumeData.location });
    renderResume(); closeEditModal(); showToast('✓ Personal info saved!');
}
function saveSummaryTab() {
    const val = document.getElementById('ep_profileSummary')?.value || '';
    resumeData.profileSummary = val;
    persistField('profileSummary', val);
    renderResume(); closeEditModal(); showToast('✓ Summary saved!');
}
function saveContactTab() {
    ['phone','email','address','linkedin','website'].forEach(f => {
        const el = document.getElementById('ep_'+f);
        if (el) resumeData[f] = el.value.trim();
    });
    persistFields({ phone:resumeData.phone, email:resumeData.email, address:resumeData.address, linkedin:resumeData.linkedin, website:resumeData.website });
    renderResume(); closeEditModal(); showToast('✓ Contact saved!');
}
function saveExtraTab() {
    ['languages','awards','interests','certifications','qualities'].forEach(f => {
        const el = document.getElementById('ep_'+f);
        if (el) resumeData[f] = el.value.trim();
    });
    persistFields({ languages:resumeData.languages, awards:resumeData.awards, interests:resumeData.interests, certifications:resumeData.certifications, qualities:resumeData.qualities });
    renderResume(); closeEditModal(); showToast('✓ Additional info saved!');
}

// ── Persist helpers ──
function persistField(key, val) {
    if (!resumeId) return;
    fetch(`${API_BASE}/${resumeId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({[key]:val}) }).catch(()=>{});
}
function persistFields(obj) {
    if (!resumeId) return;
    fetch(`${API_BASE}/${resumeId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(obj) }).catch(()=>{});
}

// saveCurrentTabData — called before switching tabs so data isn't lost
function saveCurrentTabData() {
    // no-op: each tab saves directly on its Save button click; switching tabs doesn't auto-save
}

function updateEditModalTitle(tabId) {
    const titles = {
        photo: 'Photo',
        personal: 'Personal Details',
        summary: 'Profile Summary',
        contact: 'Contact',
        skills: 'Skills',
        education: 'Education',
        experience: 'Experience',
        projects: 'Projects',
        extra: 'Additional Details'
    };
    const titleEl = document.getElementById('editModalTitle');
    if (titleEl && titles[tabId]) titleEl.textContent = 'Edit ' + titles[tabId];
}

function buildSummarySuggestions(d) {
    const role = (d.jobTitle || 'professional').trim();
    const lowerRole = role.toLowerCase();
    const skills = [];
    try {
        const parsed = JSON.parse(d.skillsJson || '[]');
        if (Array.isArray(parsed)) {
            parsed.forEach(item => {
                const name = typeof item === 'string' ? item : (item?.name || item?.skill || '');
                if (name && skills.length < 3) skills.push(name.trim());
            });
        }
    } catch {}

    let experience = [];
    try {
        const parsedExp = JSON.parse(d.experienceJson || '[]');
        experience = Array.isArray(parsedExp) ? parsedExp : [];
    } catch {}

    let education = [];
    try {
        const parsedEdu = JSON.parse(d.educationJson || '[]');
        education = Array.isArray(parsedEdu) ? parsedEdu : [];
    } catch {}

    const latestExp = experience[0] || {};
    const school = education[0]?.school || education[0]?.university || '';
    const company = latestExp.company || '';
    const location = latestExp.location || d.location || '';
    const skillText = skills.length ? skills.join(', ') : 'collaboration, ownership, and problem-solving';

    return [
        `Results-driven ${lowerRole} with practical experience in ${skillText}. Focused on delivering reliable work, improving workflows, and creating measurable value through thoughtful execution.`,
        `Detail-oriented ${lowerRole} with strong communication and hands-on problem-solving skills${company ? `, including experience at ${company}` : ''}. Known for adapting quickly, supporting team goals, and building polished outcomes${location ? ` in ${location}` : ''}.`,
        `Motivated ${lowerRole} with a solid foundation in ${skillText}${school ? ` and academic experience from ${school}` : ''}. Eager to contribute technical ability, continuous learning, and a user-focused mindset in a growth-oriented role.`
    ];
}

function useSummarySuggestion(index) {
    const suggestions = buildSummarySuggestions(resumeData);
    const textarea = document.getElementById('ep_profileSummary');
    if (!textarea) return;
    textarea.value = suggestions[index] || '';
    updateSummaryCounter();
    textarea.focus();
}

function updateSummaryCounter() {
    const textarea = document.getElementById('ep_profileSummary');
    const counter = document.getElementById('ep_summaryCount');
    if (counter) counter.textContent = `${(textarea?.value || '').length} chars`;
}

function buildSummaryTab(d) {
    const suggestions = buildSummarySuggestions(d);
    return `<div class="ep-section">
      <h4 class="ep-section-title">Profile Summary</h4>
      <p class="ep-hint">Write 2-4 sentences highlighting your expertise, experience and career goals.</p>
      <div style="display:flex;flex-direction:column;gap:10px;margin:10px 0 14px;">
        <div style="font-size:12px;font-weight:700;color:#4b5563;">AI Suggestions</div>
        ${suggestions.map((text, index) => `
          <button type="button" onclick="useSummarySuggestion(${index})" style="text-align:left;border:1px solid #e9ddff;background:#faf7ff;border-radius:14px;padding:12px 14px;cursor:pointer;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
              <span style="font-size:11px;font-weight:800;color:#7c3aed;">Suggestion ${index + 1}</span>
              <span style="font-size:11px;font-weight:700;color:#7c3aed;">Use This</span>
            </div>
            <div style="margin-top:6px;font-size:12px;line-height:1.65;color:#4b5563;">${esc(text)}</div>
          </button>
        `).join('')}
      </div>
      <textarea class="ep-textarea" id="ep_profileSummary" rows="6" oninput="updateSummaryCounter()" placeholder="A results-driven professional with X years of experience in...">${esc(d.profileSummary||'')}</textarea>
      <div style="display:flex;gap:10px;align-items:center;margin-top:6px;">
        <span style="font-size:11px;color:#9ca3af;" id="ep_summaryCount">${(d.profileSummary||'').length} chars</span>
      </div>
      <button class="ep-save-btn" onclick="saveSummaryTab()">Save Summary</button>
    </div>`;
}

function buildExtraTab(d) {
    return `<div class="ep-section">
      <h4 class="ep-section-title">Additional Information</h4>

      <div class="ep-field"><label class="ep-label">Languages (comma-separated)</label>
        <input class="ep-input" id="ep_languages" value="${esc(d.languages||'')}" placeholder="English, Tamil, Hindi"></div>

      <div class="ep-field"><label class="ep-label">Awards & Honors</label>
        <textarea class="ep-textarea" id="ep_awards" rows="3" placeholder="Best Employee Award 2023&#10;Hackathon Runner-Up">${esc(d.awards||'')}</textarea></div>

      <div class="ep-field"><label class="ep-label">Interests / Hobbies</label>
        <textarea class="ep-textarea" id="ep_interests" rows="3" placeholder="Photography, Open-source Contribution, Chess">${esc(d.interests||'')}</textarea></div>

      <div class="ep-field"><label class="ep-label">Certifications</label>
        <textarea class="ep-textarea" id="ep_certifications" rows="3" placeholder="AWS Certified Developer (2023)&#10;Google Analytics Certified">${esc(d.certifications||'')}</textarea></div>

      <div class="ep-field"><label class="ep-label">Tools / Platforms</label>
        <textarea class="ep-textarea" id="ep_tools" rows="3" placeholder="Figma&#10;Adobe XD&#10;Photoshop">${esc(d.tools||'')}</textarea></div>

      <div class="ep-field"><label class="ep-label">Key Qualities / Strengths</label>
        <input class="ep-input" id="ep_qualities" value="${esc(d.qualities||'')}" placeholder="Leadership, Problem Solving, Team Player"></div>

      <button class="ep-save-btn" onclick="saveExtraTab()">Save All</button>
    </div>`;
}

function saveExtraTab() {
    ['languages','awards','interests','certifications','qualities','tools'].forEach(f => {
        const el = document.getElementById('ep_'+f);
        if (el) resumeData[f] = el.value.trim();
    });
    persistFields({
        languages: resumeData.languages,
        awards: resumeData.awards,
        interests: resumeData.interests,
        certifications: resumeData.certifications,
        qualities: resumeData.qualities,
        tools: resumeData.tools
    });
    renderResume();
    closeEditModal();
    showToast('Additional info saved!');
}

function saveSummaryTab() {
    const val = (document.getElementById('ep_profileSummary')?.value || '').trim();
    resumeData.profileSummary = val;
    persistField('profileSummary', val);
    renderResume();
    closeEditModal();
    showToast('Summary saved!');
}

function _rvSetStructuredText(node, value) {
    if (!node) return false;
    const safeValue = value || '';
    const link = node.querySelector('a');
    if (link) {
        link.textContent = safeValue;
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeValue)) link.href = `mailto:${safeValue}`;
        return true;
    }
    const textNodes = Array.from(node.childNodes).filter(child => child.nodeType === Node.TEXT_NODE);
    if (textNodes.length) {
        textNodes.forEach((textNode, index) => { textNode.textContent = index === 0 ? ` ${safeValue}` : ''; });
        return true;
    }
    if (node.firstElementChild) {
        node.appendChild(document.createTextNode(` ${safeValue}`));
        return true;
    }
    node.textContent = safeValue;
    return true;
}

function _getExactSectionHeading(section) {
    return Array.from(section.children).find(child => RV_HEADING_MAP[_rvNormalizeHeading(child.textContent || '')]);
}

function _clearExactSectionBody(section, heading) {
    Array.from(section.children).forEach(child => {
        if (child !== heading) child.remove();
    });
}

function _appendExactSectionLines(section, field, label, lines, canDelete = true) {
    lines.forEach((line, index) => {
        if (!line) return;
        const item = document.createElement('div');
        item.className = 'rv-exact-generic-item';
        item.style.cssText = 'margin-top:8px;line-height:1.7;';
        item.textContent = line;
        attachRvLineMeta(item, field, label, canDelete ? index : null, canDelete);
        section.appendChild(item);
    });
}

function _rvFindLabeledField(root, patterns) {
    const blocks = collectExactTemplateNodes(root, el => {
        const cls = el.className || '';
        return typeof cls === 'string' && /(field|contact-item|contact-row|info-item)/i.test(cls);
    });
    return blocks.find(block => {
        const labelEl = block.querySelector('[class*="label"]');
        const text = _rvNormalizeHeading(labelEl ? labelEl.textContent : block.textContent);
        return patterns.some(pattern => pattern.test(text));
    });
}

function fillExactTemplatePersonalFields(root, d) {
    const personalMap = [
        { key: 'dob', value: d.dob || '', patterns: [/date of birth/i, /\bdob\b/i, /birth/i] },
        { key: 'gender', value: d.gender || '', patterns: [/gender/i] },
        { key: 'nationality', value: d.nationality || '', patterns: [/nationality/i] }
    ];

    personalMap.forEach(({ key, value, patterns }) => {
        const block = _rvFindLabeledField(root, patterns);
        if (!block) return;
        const valueNode = block.querySelector('[class*="field-val"]') || block.querySelector('[class*="contact-text"]') || block;
        if (value) _rvSetStructuredText(valueNode, value);
        else if (valueNode !== block) valueNode.style.display = 'none';
        attachRvLineMeta(valueNode, key, key.toUpperCase(), null, false);
    });
}

function removeExactDemoSections(root, ctx) {
    const d = ctx.resumeData || {};

    // Hide demo-only sections like "Worked with", logos, etc.
    const demoSectionPatterns = /worked with|clients|brands|our clients|partners/i;
    collectExactTemplateNodes(root, node => {
        const text = _rvNormalizeHeading(node.textContent || '');
        return text.length > 0 && demoSectionPatterns.test(text);
    }).forEach(heading => {
        const section = resolveExactSectionContainer(root, heading) || heading.parentElement;
        if (section) section.style.display = 'none';
    });

    // Hide logo rows (e.g. amazon/apple/facebook badges in template1)
    collectExactTemplateNodes(root, node => {
        const cls = node.className || '';
        return typeof cls === 'string' && /(logo-row|logo\.amazon|logo\.apple|logo\.fb)/i.test(cls);
    }).forEach(node => { node.style.display = 'none'; });

    const hasFieldData = (field) => {
        if (field === 'profileSummary') return !!(d.profileSummary || '').trim();
        if (field === 'educationJson') return (ctx.edu || []).length > 0;
        if (field === 'experienceJson') return (ctx.experience || []).length > 0;
        if (field === 'projectsJson') return (ctx.projects || []).length > 0;
        if (field === 'skillsJson') return (ctx.skills || []).length > 0;
        if (field === 'languages') return splitExactSimpleEntries(d.languages || '').length > 0;
        if (field === 'certifications') return splitExactSimpleEntries(d.certifications || '').length > 0;
        if (field === 'qualities') return splitExactSimpleEntries(d.qualities || '').length > 0;
        if (field === 'tools') return splitExactSimpleEntries(d.tools || '').length > 0;
        if (field === 'awards') return splitExactSimpleEntries(d.awards || '').length > 0;
        if (field === 'interests') return splitExactSimpleEntries(d.interests || '').length > 0;
        return true;
    };

    _getExactSectionHeadings(root).forEach(heading => {
        const key = _rvNormalizeHeading(heading.textContent || '');
        const meta = RV_HEADING_MAP[key];
        if (!meta) return;
        const section = resolveExactSectionContainer(root, heading) || heading.parentElement;
        if (!section) return;
        if (!hasFieldData(meta.field)) section.style.display = 'none';
    });

    // Replace all known demo names with actual user name
    const actualName = (d.fullName || '').trim();
    const demoNamePattern = /\b(john smith|alex carter|marina wilkinson|jeremy clifford|robyn kingsley|firstname lastname|your name|nina patel|martina rodler|saurabh rathore|andrew bolton|kate bishop|rick tang|caroline smith|amanda griffith|hani husamuddin|derek jane|brian r|kelly white|adeline palmerston|olivia sanchez|chidi eze|william robartson|paul waulson|lorna alvarado|richard sanchez|olivia wilson|maanvita kumari|herper russo|andrea gillis|alex wenger|mathew smith|alex archer)\b/i;
    collectExactTemplateNodes(root, node => {
        if (node.children.length > 0) return false;
        const cls = (node.className || '').toString();
        if (/(section-title|sec-title|plan-badge|preview-overlay|btn-preview|tpl-)/i.test(cls)) return false;
        return demoNamePattern.test((node.textContent || '').trim());
    }).forEach(node => {
        if (actualName) {
            node.textContent = actualName;
            attachRvLineMeta(node, 'fullName', 'Full Name', null, false);
        } else {
            node.textContent = 'Your Name';
        }
    });

    // Clear lorem ipsum text
    collectExactTemplateNodes(root, node => {
        return node.children.length === 0 && /lorem ipsum/i.test(node.textContent || '');
    }).forEach(node => { node.textContent = ''; });
}

function fillExactTemplateContacts(root, d) {
    const contacts = [
        { key: 'email', value: d.email || '', pattern: /email|@|\[email|✉/i },
        { key: 'phone', value: d.phone || '', pattern: /phone|📱|☎|tel|\+\d/i },
        { key: 'address', value: d.address || d.location || '', pattern: /address|location|📍|germany|india|city/i },
        { key: 'linkedin', value: d.linkedin || '', pattern: /linkedin|\bin\b/i },
        { key: 'website', value: d.website || '', pattern: /🌐|www|http|portfolio|dribbble|behance|webb/i }
    ];

    const used = new Set();

    contacts.forEach(({ key, value, pattern }) => {
        const matches = collectExactTemplateNodes(root, el => {
            const cls = el.className || '';
            if (typeof cls !== 'string') return false;
            if (!/(contact-item|contact-row|contact|field|location|links)/i.test(cls)) return false;
            return pattern.test((el.textContent || '').trim());
        });
        const target = matches.find(el => !used.has(el));
        if (!target) return;
        if (!value) {
            target.style.display = 'none';
            used.add(target);
            return;
        }
        const valueNode = target.querySelector('[class*="field-val"]') || target.querySelector('[class*="contact-text"]') || target;
        _rvSetStructuredText(valueNode, value);
        attachRvLineMeta(valueNode, key, 'Contact', null, false);
        used.add(target);
        used.add(valueNode);
    });

    const looseTargets = collectExactTemplateNodes(root, el => {
        const cls = el.className || '';
        return typeof cls === 'string'
            && /(contact-item|contact-row|location)/i.test(cls)
            && !used.has(el);
    });

    const looseValues = [d.phone || '', d.email || '', d.address || d.location || '', d.linkedin || '', d.website || ''].filter(Boolean);
    looseTargets.forEach((node, index) => {
        const value = looseValues[index];
        if (!value) return;
        _rvSetStructuredText(node, value);
    });
}

function _populateExactEducationSection(section, edu) {
    if (!edu.length) return;
    const blocks = _syncExactBlocks(section, /(edu-item|education-item|timeline-item|item|course)/i, edu.length, /(section-title|sec-title|title|content)/i);
    if (!blocks.length) {
        const heading = _getExactSectionHeading(section);
        const nameClass = Array.from(section.querySelectorAll('[class*="edu-name"], [class*="edu-org"], [class*="edu-school"]'))[0]?.className || '';
        const degreeClass = Array.from(section.querySelectorAll('[class*="edu-deg"], [class*="edu-degree"], [class*="qualification"]'))[0]?.className || '';
        const dateClass = Array.from(section.querySelectorAll('[class*="edu-date"], [class*="edu-year"], [class*="edu-years"], [class*="edu-yr"]'))[0]?.className || '';
        if (!heading) return;
        _clearExactSectionBody(section, heading);

        edu.forEach((item, index) => {
            const school = item.school || item.university || '';
            const degree = [item.degree || item.field || '', item.cgpa ? `${item.cgpa}` : ''].filter(Boolean).join(', ');
            const year = item.year || item.startYear || '';
            const wrap = document.createElement('div');
            wrap.className = 'rv-exact-edu-item';
            attachRvLineMeta(wrap, 'educationJson', 'Education', index, true);

            if (school) {
                const el = document.createElement('div');
                if (nameClass) el.className = nameClass;
                el.textContent = school;
                wrap.appendChild(el);
            }
            if (degree) {
                const el = document.createElement('div');
                if (degreeClass) el.className = degreeClass;
                el.textContent = degree;
                wrap.appendChild(el);
            }
            if (year) {
                const el = document.createElement('div');
                if (dateClass) el.className = dateClass;
                el.textContent = year;
                wrap.appendChild(el);
            }
            section.appendChild(wrap);
        });
        return;
    }

    blocks.forEach((block, index) => {
        const item = edu[index] || {};
        const degree = item.degree || item.field || '';
        const school = item.school || item.university || '';
        const year = item.year || item.startYear || '';
        const desc = [item.description || '', item.cgpa ? `CGPA: ${item.cgpa}` : ''].filter(Boolean).join(' · ');

        _exactSetFirstByClass(block, /(edu-degree|edu-deg|degree|course-name|course|qualification)/i, degree, /(section-title|sec-title)/i);
        _exactSetFirstByClass(block, /(edu-uni|course-uni|school|university|college|org|uni)/i, school, /(section-title|sec-title)/i);
        _exactSetFirstByClass(block, /(edu-date|edu-year|edu-years|course-years|year|yr|date)/i, year, /(section-title|sec-title)/i);
        if (desc) _exactSetFirstByClass(block, /(desc|about|text|content)/i, desc, /(section-title|sec-title)/i);
        attachRvLineMeta(block, 'educationJson', 'Education', index, true);
    });
}

function _populateExactExperienceSection(section, experience) {
    if (!experience.length) return;
    const blocks = _syncExactBlocks(section, /(timeline-item|job|exp-row|exp-item|experience-item)/i, experience.length, /(section-title|sec-title|title-r|title-l)$/i);
    if (!blocks.length) {
        const heading = _getExactSectionHeading(section);
        if (!heading) return;
        _clearExactSectionBody(section, heading);
        experience.forEach((item, index) => {
            const wrap = document.createElement('div');
            wrap.className = 'rv-exact-exp-item';
            wrap.style.cssText = 'margin-top:10px;';
            attachRvLineMeta(wrap, 'experienceJson', 'Experience', index, true);
            [
                [item.jobTitle || item.role || item.title || '', item.company || ''].filter(Boolean).join(' at '),
                [item.location || '', item.startDate || item.from || '', item.endDate || item.to || 'Present'].filter(Boolean).join(' | '),
                (item.description || item.bullets || '').toString().split('\n').map(s => s.trim()).filter(Boolean).join(' • ')
            ].filter(Boolean).forEach(line => {
                const row = document.createElement('div');
                row.textContent = line;
                wrap.appendChild(row);
            });
            section.appendChild(wrap);
        });
        return;
    }

    blocks.forEach((block, index) => {
        const item = experience[index] || {};
        const title = item.jobTitle || item.role || item.title || '';
        const company = item.company || '';
        const location = item.location || '';
        const companyLine = [company, location].filter(Boolean).join(' | ');
        const date = [item.startDate || item.from || '', item.endDate || item.to || 'Present'].filter(Boolean).join(' - ');
        const lines = (item.description || item.bullets || '').toString().split('\n').map(s => s.trim()).filter(Boolean);

        const titleText = [title, company].filter(Boolean).join(' at ');
        _exactSetFirstByClass(block, /(job-title|tl-title|exp-title|role|position|title)/i, titleText || title, /(section-title|sec-title|title-r|title-l|skill-title|edu-title)/i);

        const metaNode = block.querySelector('[class*="job-meta"], [class*="job-company"], [class*="meta"]');
        if (metaNode) {
            const spans = metaNode.querySelectorAll('span');
            if (spans[0]) spans[0].textContent = companyLine;
            else _rvSetStructuredText(metaNode, companyLine);
            if (spans[1]) spans[1].textContent = date;
        } else {
            _exactSetFirstByClass(block, /(job-co|job-company|company|job-at|org|meta|co|loc)/i, companyLine, /(section-title|sec-title)/i);
            _exactSetFirstByClass(block, /(job-date|date|year|years|yr|tl-year|year-badge)/i, date, /(section-title|sec-title)/i);
        }

        const descNode = Array.from(block.querySelectorAll('*')).find(el => {
            const cls = el.className || '';
            return typeof cls === 'string' && /(job-desc|desc|text|content|about)/i.test(cls) && _isExactLeafNode(el);
        });
        if (descNode) descNode.textContent = lines[0] || '';

        const bulletNodes = Array.from(block.querySelectorAll('*')).filter(el => {
            const cls = el.className || '';
            return typeof cls === 'string' && /(bullet)/i.test(cls) && _isExactLeafNode(el);
        });
        if (bulletNodes.length) {
            bulletNodes.forEach((node, i) => {
                const line = lines[i + 1];
                if (line) node.textContent = line;
                else node.style.display = 'none';
            });
        } else if (!descNode && lines.length) {
            _exactSetFirstByClass(block, /(job-desc|desc|text|content|about)/i, lines.join(' • '), /(section-title|sec-title)/i);
        }

        attachRvLineMeta(block, 'experienceJson', 'Experience', index, true);
    });
}

function bindExactTemplateLineClicks() {
    const doc = document.getElementById('resumeDoc');
    if (!doc || doc.dataset.exactTemplate !== 'true') return;

    Array.from(doc.querySelectorAll('[data-rv-line-field]')).forEach(node => {
        if (!node.isConnected || node.dataset.rvClickBound === '1') return;
        if (node.closest('.rv-line-actions, .rv-stb')) return;
        node.dataset.rvClickBound = '1';
        node.style.cursor = 'pointer';
        node.addEventListener('click', (event) => {
            if (event.target.closest('button, a, .rv-line-actions, .rv-stb')) return;
            event.stopPropagation();
            const field = node.dataset.rvLineField || '';
            const label = node.dataset.rvLineLabel || field;
            openEditModal(field, label, resumeData[field] || node.innerText.trim());
        });
    });

    _getExactSectionHeadings(doc).forEach(node => {
        if (node.dataset.rvHeadingBound === '1') return;
        const meta = RV_HEADING_MAP[_rvNormalizeHeading(node.textContent || '')];
        if (!meta) return;
        node.dataset.rvHeadingBound = '1';
        node.style.cursor = 'pointer';
        node.addEventListener('click', (event) => {
            if (event.target.closest('button, a')) return;
            event.stopPropagation();
            openEditModal(meta.field, meta.label, resumeData[meta.field] || '');
        });
    });
}

function hydrateExactGalleryTemplate(root, ctx) {
    const d = ctx.resumeData || {};
    fillExactTemplatePhoto(root, d);

    fillExactTemplateText(root, /(^|[\s-])name([-\s]|$)/i, d.fullName || 'Your Name', {
        field: 'fullName',
        label: 'Full Name',
        limit: 4,
        skip: node => /(edu-name|job-title|project-title|field-label|section-title|sec-title)/i.test(node.className || '')
    });

    const roleBadges = collectExactTemplateNodes(root, node => {
        const cls = node.className || '';
        return typeof cls === 'string' && /role-badge/i.test(cls);
    });
    if (roleBadges.length) {
        roleBadges.forEach((node, index) => {
            if (index === 0) {
                node.textContent = d.jobTitle || 'Professional';
                attachRvLineMeta(node, 'jobTitle', 'Job Title', null, false);
            } else {
                node.style.display = 'none';
            }
        });
    } else {
        fillExactTemplateText(root, /(^|[\s-])role([-\s]|$)|(^|[\s-])(job-title|position|subtitle)([-\s]|$)/i, d.jobTitle || 'Professional', {
            field: 'jobTitle',
            label: 'Job Title',
            limit: 3,
            skip: node => /(sec-title|section-title|title-l|title-r|sec-title-l|sec-title-r|job-title|edu-title|exp-title|skill-title|job|exp|timeline)/i.test(node.className || '')
        });
    }

    fillExactTemplateText(root, /(bio|summary|quote-box|profile-text)/i, d.profileSummary || '', {
        field: 'profileSummary',
        label: 'Profile Summary',
        limit: 1,
        skip: node => /(sec-title|title)/i.test(node.className || '')
    });

    if (d.profileSummary) {
        collectExactTemplateNodes(root, node => {
            const cls = node.className || '';
            return typeof cls === 'string' && /profile-strip/i.test(cls);
        }).forEach(stripNode => {
            const last = stripNode.lastElementChild;
            if (last) last.textContent = d.profileSummary;
        });
    }

    fillExactTemplatePersonalFields(root, d);
    fillExactTemplateContacts(root, d);
    populateExactTemplateSections(root, ctx);
    removeExactDemoSections(root, ctx);
}

function livePreviewPhoto() { /* preview not blocking */ }
function saveEditModal() {
    // Legacy shim — new modal uses per-tab save buttons; nothing to do here
    closeEditModal();
}

function closeEditModal() {
    const overlay = document.getElementById('inlineEditOverlay');
    if (overlay) overlay.style.display = 'none';
    editModalField = null;
}

// ============================================================
// AUTO SAVE DESIGN
// ============================================================
async function autosaveDesign() {
    if (!resumeId) return;
    try {
        await fetch(`${API_BASE}/${resumeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                templateName: currentTemplate,
                selectedColor: currentColor,
                fontFamily: currentFont,
                fontStyle: currentFontSize,
                sectionSpacing: currentSectionSpacing,
                letterSpacing: currentLetterSpacing,
                lineSpacing: currentLineSpacing
            })
        });
    } catch (e) {}
}

// ============================================================
// DOWNLOAD MODAL
// ============================================================
function openDownloadModal() {
    const name = (resumeData.fullName || 'My_Resume').replace(/\s+/g, '_');
    const fn = document.getElementById('downloadFileName');
    if (fn) fn.value = name + '_Resume';
    const dm = document.getElementById('downloadModal');
    if (dm) dm.style.display = 'flex';
}
function closeDownloadModal() {
    const dm = document.getElementById('downloadModal');
    if (dm) dm.style.display = 'none';
}
async function confirmDownload() {
    const format   = document.querySelector('input[name="dlFormat"]:checked')?.value || 'pdf';
    const fileName = document.getElementById('downloadFileName')?.value.trim() || 'My_Resume';
    if (!isLoggedIn) {
        closeDownloadModal();
        redirectToLoginForDownload();
        return;
    }
    try {
        await fetch(`${API_BASE}/${resumeId}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ format, fileName })
        });
    } catch (e) {}
    closeDownloadModal();
    if (format === 'pdf') {
        downloadAsPDF(fileName);
    } else {
        downloadAsText(fileName, format);
    }
}
function downloadAsPDF(fileName) {
    const resumeDoc = document.getElementById('resumeDoc');
    if (!resumeDoc) {
        showToast('Resume preview is not ready.', 'error');
        return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Please allow pop-ups to download the resume.', 'error');
        return;
    }
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(l => `<link rel="stylesheet" href="${l.href}">`).join('');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${fileName}</title><base href="${window.location.origin}/">${styles}
        <style>
          @page { size: A4; margin: 0; }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          * {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          body {
            padding: 18px;
            display: flex;
            justify-content: center;
            background: #fff !important;
          }
          .resume-doc {
            width: 794px !important;
            max-width: 794px !important;
            min-height: auto !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .rv-stb,
          .edit-pen,
          .photo-controls { display:none !important; }
          .editable-field { cursor:default !important; }
          @media print {
            html, body { margin:0; padding:0; background:#fff !important; }
            body { display:block; }
            .resume-doc {
              width: 100% !important;
              max-width: 100% !important;
            }
          }
        </style></head>
        <body>${resumeDoc.outerHTML}
        <script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
    printWindow.document.close();
    showToast('✓ PDF download initiated!');
}
function downloadAsText(fileName, type) {
    const d = resumeData;
    let text = `${d.fullName||'Name'}\n${d.jobTitle||''}\nEmail: ${d.email||''} | Phone: ${d.phone||''}\n\nSUMMARY\n${d.profileSummary||''}\n\n`;
    try { const sk = JSON.parse(d.skillsJson||'[]'); if(sk.length) text += `SKILLS\n${sk.join(', ')}\n\n`; } catch {}
    try { const ed = JSON.parse(d.educationJson||'[]'); if(ed.length){ text+='EDUCATION\n'; ed.forEach(e=>{ text+=`${e.degree} ${e.field} - ${e.university} (${e.year})\n`; }); text+='\n'; } } catch {}
    const blob = new Blob([text], {type:'text/plain'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = fileName + '.txt'; a.click();
    URL.revokeObjectURL(url);
    showToast(`✓ Downloaded!`);
}

// ============================================================
// PRINT / SHARE / SAVE
// ============================================================
function printResume() {
    const resumeDoc = document.getElementById('resumeDoc');
    if (!resumeDoc) {
        showToast('Resume preview is not ready.', 'error');
        return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Please allow pop-ups to print the resume.', 'error');
        return;
    }

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(link => `<link rel="stylesheet" href="${link.href}">`)
        .join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Resume</title><base href="${window.location.origin}/">${styles}
        <style>
          @page { size: A4; margin: 0; }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          * {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          body {
            padding: 18px;
            display: flex;
            justify-content: center;
            background: #fff !important;
          }
          .resume-doc {
            width: 794px !important;
            max-width: 794px !important;
            min-height: auto !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .rv-stb,
          .edit-pen,
          .photo-controls { display:none !important; }
          .editable-field { cursor:default !important; }
          @media print {
            html, body { margin:0; padding:0; background:#fff !important; }
            body { display:block; padding:0; }
            .resume-doc {
              width: 100% !important;
              max-width: 100% !important;
            }
          }
        </style></head>
        <body>${resumeDoc.outerHTML}
        <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script></body></html>`);
    printWindow.document.close();
}
function shareEmail() {
    const subject = encodeURIComponent('My Resume - ' + (resumeData.fullName || ''));
    const body    = encodeURIComponent('View my resume at: ' + window.location.href);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
}
async function saveResume() {
    if (!isLoggedIn) {
        const lm = document.getElementById('loginRequiredModal');
        if (lm) lm.style.display = 'flex';
        return;
    }
    if (!resumeId) {
        showToast('No resume ID found. Please rebuild your resume.', 'error');
        return;
    }
    try {
        const payload = {
            ...resumeData,
            templateName: currentTemplate,
            selectedColor: currentColor,
            fontFamily: currentFont,
            fontStyle: currentFontSize,
            sectionSpacing: currentSectionSpacing,
            letterSpacing: currentLetterSpacing,
            lineSpacing: currentLineSpacing,
            status: 'COMPLETE',
            updatedAt: new Date().toISOString()
        };
        const res = await fetch(`${API_BASE}/${resumeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            sessionStorage.setItem('resumeData', JSON.stringify(payload));
            showToast('✓ Resume saved! Redirecting to dashboard...');
            setTimeout(() => { window.location.href = '/dashboard'; }, 1500);
        } else {
            const errText = await res.text().catch(() => '');
            console.error('Save error response:', errText);
            showToast('Save failed. Please try again.', 'error');
        }
    } catch (err) {
        console.error('Save exception:', err);
        showToast('Save failed. Check your connection.', 'error');
    }
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `position:fixed;bottom:30px;right:30px;padding:14px 24px;border-radius:12px;font-weight:600;font-size:14px;z-index:9999;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,0.15);transition:opacity 0.3s;`;
        document.body.appendChild(toast);
    }
    toast.style.background = type === 'error' ? '#ef4444' : '#22c55e';
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// Close overlays on background click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) e.target.style.display = 'none';
});

// ============================================================
// PHOTO SIZE / SHAPE CONTROLS
// ============================================================
function updatePhotoSize(val) {
    resumeData.photoSize = parseInt(val);
    renderResume();
    if (resumeId) {
        fetch(`${API_BASE}/${resumeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoSize: resumeData.photoSize })
        }).catch(() => {});
    }
}
function updatePhotoShape(val) {
    resumeData.photoShape = val;
    renderResume();
    if (resumeId) {
        fetch(`${API_BASE}/${resumeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoShape: val })
        }).catch(() => {});
    }
}
function updatePhotoPosition(val) {
    resumeData.photoPosition = val;
    renderResume();
    if (resumeId) {
        fetch(`${API_BASE}/${resumeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoPosition: val })
        }).catch(() => {});
    }
}

// ============================================================
// REVIEW PAGE PHOTO UPLOAD / CHANGE / REMOVE
// ============================================================
function handleReviewPhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        resumeData.profilePhotoData = e.target.result;
        if (resumeId) {
            fetch(`${API_BASE}/${resumeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profilePhotoData: e.target.result })
            }).catch(err => console.error('Photo save error:', err));
        }
        closeEditModal();
        renderResume();
        showToast('✓ Photo updated!');
    };
    reader.readAsDataURL(file);
}

function removeReviewPhoto() {
    resumeData.profilePhotoData = '';
    if (resumeId) {
        fetch(`${API_BASE}/${resumeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profilePhotoData: '' })
        }).catch(err => console.error('Photo remove error:', err));
    }
    closeEditModal();
    renderResume();
    showToast('Photo removed.');
}
// ============================================================
// NEW TEMPLATE BUILDERS (john-orange, john-purple, alex-creative, lacy, marina)
// ============================================================

function buildJohnOrangeTemplate(ctx) {
    const { resumeData, edu, skills, experience, color } = ctx;
    const accent = color || '#f59e0b';
    const name = (resumeData.fullName || 'YOUR NAME').toUpperCase();
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || 'YOUR';
    const lastName = nameParts.slice(1).join(' ') || 'NAME';
    const photoHTML = resumeData.profilePhotoData
        ? `<img src="${resumeData.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9a87c,#a07845);border-radius:50%;"></div>`;
    const expHTML = experience.map(e => `
        <div style="font-size:12px;font-weight:700;color:${accent};text-transform:uppercase;margin-bottom:3px;">${e.jobTitle||''}</div>
        <div style="font-size:10px;color:#888;margin-bottom:6px;">${e.company||''} | ${e.startDate||''} – ${e.endDate||'Present'} · ${e.location||''}</div>
        <div style="font-size:11px;color:#555;line-height:1.7;margin-bottom:14px;">${(e.description||'').replace(/\n/g,'<br>')}</div>`).join('');
    const eduHTML = edu.map(e => `${e.degree||''}<br>${e.school||''}, ${e.year||''}`).join('<br><br>');
    const skillsList = skills.map(s => (s.name||s)).join('<br>');
    const langs = resumeData.languages || 'English';
    const summary = resumeData.profileSummary || '';
    const sectionHTML = buildExtraSectionsHTML(ctx, accent, '');
    return `<div style="display:flex;min-height:860px;font-family:'Segoe UI',sans-serif;">
  <div style="width:34%;background:#1a1a1a;padding:24px 16px;display:flex;flex-direction:column;align-items:center;position:relative;">
    <div style="position:absolute;top:0;right:0;width:0;height:0;border-top:860px solid ${accent};border-left:20px solid transparent;"></div>
    <div style="width:90px;height:90px;border-radius:50%;margin-bottom:14px;border:3px solid ${accent};position:relative;z-index:1;overflow:hidden;">${photoHTML}</div>
    <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;position:relative;z-index:1;">${resumeData.jobTitle||'Professional'}</div>
    <div style="background:${accent};color:#fff;font-size:9px;font-weight:800;padding:4px 10px;border-radius:0 8px 8px 0;margin-left:-16px;align-self:flex-start;margin-bottom:8px;position:relative;z-index:1;text-transform:uppercase;">EDUCATION</div>
    <div style="font-size:8px;color:rgba(255,255,255,0.7);align-self:flex-start;line-height:1.8;position:relative;z-index:1;margin-bottom:14px;">${eduHTML||'Add education details'}</div>
    <div style="background:${accent};color:#fff;font-size:9px;font-weight:800;padding:4px 10px;border-radius:0 8px 8px 0;margin-left:-16px;align-self:flex-start;margin-bottom:8px;position:relative;z-index:1;text-transform:uppercase;">SKILLS</div>
    <div style="font-size:8px;color:rgba(255,255,255,0.7);align-self:flex-start;line-height:1.8;position:relative;z-index:1;margin-bottom:14px;" class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillsList||'Add your skills'} <span class="edit-pen">✏</span></div>
    <div style="background:${accent};color:#fff;font-size:9px;font-weight:800;padding:4px 10px;border-radius:0 8px 8px 0;margin-left:-16px;align-self:flex-start;margin-bottom:8px;position:relative;z-index:1;text-transform:uppercase;">LANGUAGES</div>
    <div style="font-size:8px;color:rgba(255,255,255,0.7);align-self:flex-start;line-height:1.8;position:relative;z-index:1;" class="editable-field" ${editBtn('languages','Languages','')}>${langs}</div> <span class="edit-pen">✏</span>
  </div>
  <div style="flex:1;background:#fff;">
    <div style="padding:28px 24px 10px;">
      <div class="editable-field" style="font-size:11px;color:#6b7280;text-align:right;margin-bottom:4px;cursor:pointer;" ${editBtn('phone','Phone',resumeData.phone||'')}>${resumeData.phone||'Add phone'} <span class="edit-pen">✏</span></div>
      <div class="editable-field" style="font-size:30px;font-weight:900;color:#1a1a2e;line-height:1.1;cursor:pointer;" ${editBtn('fullName','Full Name',resumeData.fullName||'')}>${firstName} <span style="color:${accent};">${lastName}</span> <span class="edit-pen">✏</span></div>
      <div class="editable-field" style="font-size:11px;color:#6b7280;margin-bottom:14px;cursor:pointer;" ${editBtn('jobTitle','Job Title',resumeData.jobTitle||'')}>${resumeData.jobTitle||'Your Title'} <span class="edit-pen">✏</span></div>
      <div style="font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:8px;">&#128100; ABOUT ME</div>
      <div class="editable-field" style="font-size:10px;color:#555;line-height:1.7;margin-bottom:18px;cursor:pointer;" ${editBtn('profileSummary','Summary',resumeData.profileSummary||'')}>${summary||'Click to add your profile summary.'} <span class="edit-pen">✏</span></div>
      <div style="font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:12px;">&#127970; PROFESSIONAL EXPERIENCE</div>
      ${expHTML||'<div style="font-size:10px;color:#9ca3af;">Add your experience in the builder.</div>'}
      ${sectionHTML}
    </div>
  </div>
</div>`;
}

function buildJohnPurpleTemplate(ctx) {
    const { resumeData, edu, skills, experience, color } = ctx;
    const accent = color || '#3b1a6e';
    const photoHTML = resumeData.profilePhotoData
        ? `<img src="${resumeData.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9a87c,#a07845);border-radius:50%;"></div>`;
    const expHTML = experience.map(e => `
        <div style="font-size:12px;font-weight:700;color:${accent};text-transform:uppercase;margin-bottom:3px;">${e.jobTitle||''}</div>
        <div style="font-size:10px;color:#888;margin-bottom:6px;">${e.company||''} | ${e.startDate||''} – ${e.endDate||'Present'} · ${e.location||''}</div>
        <div style="font-size:10px;color:#555;line-height:1.7;margin-bottom:12px;">${(e.description||'').replace(/\n/g,'<br>')}</div>`).join('');
    const eduHTML = edu.map(e => `<li style="margin-bottom:6px;">${e.degree||''}<br><span style="color:#888;font-size:8px;">${e.school||''}, ${e.year||''}</span></li>`).join('');
    const skillsHTML = skills.map(s => {
        const nm = s.name||s; const pct = (s.level||70)+'%';
        return `<div style="font-size:9px;color:rgba(255,255,255,0.75);margin-bottom:5px;">${nm}<div style="height:4px;background:rgba(255,255,255,0.25);border-radius:3px;margin-top:2px;"><div style="width:${pct};height:100%;background:#f59e0b;border-radius:3px;"></div></div></div>`;
    }).join('');
    const langs = resumeData.languages || 'English';
    const qualities = resumeData.qualities || 'Adaptability · Problem Solving · Team Player · Detail-Oriented';
    const sectionHTML = buildExtraSectionsHTML(ctx, accent, '');
    return `<div style="display:flex;min-height:860px;font-family:'Segoe UI',sans-serif;">
  <div style="width:36%;background:${accent};padding:24px 16px;display:flex;flex-direction:column;align-items:center;">
    <div style="width:90px;height:90px;border-radius:50%;margin-bottom:14px;border:3px solid #f59e0b;overflow:hidden;">${photoHTML}</div>
    <div style="background:#f59e0b;color:#fff;font-size:9px;font-weight:800;padding:3px 14px;border-radius:99px;margin-bottom:16px;">Pro</div>
    <div style="font-size:9px;font-weight:800;color:#f59e0b;text-transform:uppercase;letter-spacing:0.5px;align-self:flex-start;margin-bottom:8px;">EDUCATION</div>
    <ul style="font-size:8px;color:rgba(255,255,255,0.75);align-self:flex-start;line-height:1.9;margin-bottom:14px;padding-left:14px;">${eduHTML||'<li>Add education</li>'}</ul>
    <div style="font-size:9px;font-weight:800;color:#f59e0b;text-transform:uppercase;letter-spacing:0.5px;align-self:flex-start;margin-bottom:8px;">SKILLS</div>
    <div style="width:100%;margin-bottom:14px;">${skillsHTML||'<div style="font-size:8px;color:rgba(255,255,255,0.5);">Add skills</div>'}</div>
    <div style="font-size:9px;font-weight:800;color:#f59e0b;text-transform:uppercase;letter-spacing:0.5px;align-self:flex-start;margin-bottom:6px;">LANGUAGES</div>
    <div style="font-size:8px;color:rgba(255,255,255,0.75);align-self:flex-start;line-height:1.8;" class="editable-field" ${editBtn('languages','Languages','')}>${langs}</div> <span class="edit-pen">✏</span>
  </div>
  <div style="flex:1;background:#fff;padding:24px 20px;">
    <div class="editable-field" style="font-size:11px;color:#6b7280;text-align:right;margin-bottom:4px;cursor:pointer;" ${editBtn('phone','Phone',resumeData.phone||'')}>${resumeData.phone||'Add phone'} <span class="edit-pen">✏</span></div>
    <div class="editable-field" style="font-size:28px;font-weight:900;color:#1a1a2e;line-height:1.1;cursor:pointer;" ${editBtn('fullName','Full Name',resumeData.fullName||'')}>${(resumeData.fullName||'YOUR NAME').toUpperCase()} <span class="edit-pen">✏</span></div>
    <div class="editable-field" style="font-size:11px;color:#6b7280;margin-bottom:16px;cursor:pointer;" ${editBtn('jobTitle','Job Title',resumeData.jobTitle||'')}>${resumeData.jobTitle||'Your Title'} <span class="edit-pen">✏</span></div>
    <div style="font-size:11px;font-weight:800;color:#1a1a2e;margin-bottom:8px;">&#128100; ABOUT ME</div>
    <div class="editable-field" style="font-size:10px;color:#555;line-height:1.7;margin-bottom:14px;cursor:pointer;" ${editBtn('profileSummary','Summary',resumeData.profileSummary||'')}>${resumeData.profileSummary||'Click to add your profile summary.'} <span class="edit-pen">✏</span></div>
    <div style="font-size:11px;font-weight:800;color:#1a1a2e;margin-bottom:8px;">&#127970; PROFESSIONAL EXPERIENCE</div>
    ${expHTML||'<div style="font-size:10px;color:#9ca3af;">Add your experience.</div>'}
    <div style="font-size:11px;font-weight:800;color:#1a1a2e;margin-top:14px;margin-bottom:8px;">&#11088; QUALITIES</div>
    <div class="editable-field" style="font-size:10px;color:#555;cursor:pointer;" ${editBtn('qualities','Qualities',resumeData.qualities||'')}>${qualities} <span class="edit-pen">✏</span></div>
    ${sectionHTML}
  </div>
</div>`;
}

function buildAlexCreativeTemplate(ctx) {
    const { resumeData, edu, skills, projects, experience, color } = ctx;
    const accent = color || '#6c3fc9';
    const photoHTML = resumeData.profilePhotoData
        ? `<img src="${resumeData.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9a87c,#a07845);border-radius:50%;"></div>`;
    const expHTML = experience.map(e => `
        <div style="font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:3px;">${e.jobTitle||''}</div>
        <div style="font-size:10px;color:#888;margin-bottom:6px;">${e.company||''} | ${e.startDate||''} – ${e.endDate||'Present'}</div>
        <div style="font-size:10px;color:#555;line-height:1.7;margin-bottom:12px;">${(e.description||'').replace(/\n/g,'<br>')}</div>`).join('');
    const projHTML = projects.map(p => `
        <div style="font-size:11px;font-weight:700;color:#1a1a2e;margin-bottom:3px;">${p.name||''}</div>
        <div style="font-size:10px;color:#555;line-height:1.7;margin-bottom:10px;">${(p.description||'').replace(/\n/g,'<br>')}</div>`).join('');
    const eduHTML = edu.map(e => `${e.degree||''}<br>${e.school||''}, ${e.year||''}`).join('<br><br>');
    const skillsList = skills.map(s => `• ${s.name||s}`).join('<br>');
    const langs = resumeData.languages || 'English (Fluent)<br>Tamil (Native)';
    const sectionHTML = buildExtraSectionsHTML(ctx, accent, '');
    return `<div style="min-height:860px;font-family:'Segoe UI',sans-serif;background:#fff;position:relative;overflow:hidden;">
  <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;border-radius:50%;background:#f472b6;opacity:0.6;"></div>
  <div style="position:absolute;bottom:-30px;right:60px;width:90px;height:90px;border-radius:50%;background:#fbbf24;opacity:0.6;"></div>
  <div style="position:absolute;bottom:20px;left:-20px;width:80px;height:80px;border-radius:50%;background:#34d399;opacity:0.6;"></div>
  <div style="display:flex;min-height:860px;position:relative;z-index:1;">
    <div style="width:34%;background:${accent};padding:24px 14px;display:flex;flex-direction:column;align-items:center;">
      <div style="width:90px;height:90px;border-radius:50%;margin-bottom:14px;border:3px solid #fbbf24;overflow:hidden;">${photoHTML}</div>
      <div style="font-size:9px;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:0.5px;align-self:flex-start;margin-bottom:8px;">SKILLS</div>
      <div style="font-size:8px;color:rgba(255,255,255,0.8);align-self:flex-start;line-height:2;margin-bottom:14px;" class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillsList||'Add skills'} <span class="edit-pen">✏</span></div>
      <div style="font-size:9px;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:0.5px;align-self:flex-start;margin-bottom:8px;">EDUCATION</div>
      <div style="font-size:8px;color:rgba(255,255,255,0.8);align-self:flex-start;line-height:1.7;margin-bottom:14px;">${eduHTML||'Add education'}</div>
      <div style="font-size:9px;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:0.5px;align-self:flex-start;margin-bottom:8px;">LANGUAGE</div>
      <div style="font-size:8px;color:rgba(255,255,255,0.8);align-self:flex-start;line-height:1.8;" class="editable-field" ${editBtn('languages','Languages','')}>${langs}</div> <span class="edit-pen">✏</span>
    </div>
    <div style="flex:1;padding:24px 20px;">
      <div class="editable-field" style="font-size:26px;font-weight:900;color:${accent};line-height:1.1;cursor:pointer;" ${editBtn('fullName','Full Name',resumeData.fullName||'')}>${resumeData.fullName||'YOUR NAME'} <span class="edit-pen">✏</span></div>
      <div class="editable-field" style="font-size:11px;color:#6b7280;margin-bottom:6px;cursor:pointer;" ${editBtn('jobTitle','Job Title',resumeData.jobTitle||'')}>${resumeData.jobTitle||'Creative Designer'} <span class="edit-pen">✏</span></div>
      <div style="display:flex;gap:10px;font-size:9px;color:#6b7280;margin-bottom:8px;flex-wrap:wrap;">
        <span>${resumeData.phone||''}</span>${resumeData.email?`<span>&#9993; ${resumeData.email}</span>`:''}${resumeData.website?`<span>&#127758; ${resumeData.website}</span>`:''}
      </div>
      <div style="background:#f59e0b;color:#fff;font-size:9px;font-weight:800;padding:3px 14px;border-radius:99px;display:inline-block;margin-bottom:14px;">Pro</div>
      <div style="font-size:12px;font-weight:800;color:${accent};border-bottom:2px solid ${accent};padding-bottom:3px;margin-bottom:8px;">PROFILE</div>
      <div class="editable-field" style="font-size:10px;color:#555;line-height:1.7;margin-bottom:14px;cursor:pointer;" ${editBtn('profileSummary','Summary',resumeData.profileSummary||'')}>${resumeData.profileSummary||'Click to add your profile summary.'} <span class="edit-pen">✏</span></div>
      <div style="font-size:12px;font-weight:800;color:${accent};border-bottom:2px solid ${accent};padding-bottom:3px;margin-bottom:8px;">PROFESSIONAL EXPERIENCE</div>
      ${expHTML||'<div style="font-size:10px;color:#9ca3af;">Add your experience.</div>'}
      ${projects.length > 0 ? `<div style="font-size:12px;font-weight:800;color:${accent};border-bottom:2px solid ${accent};padding-bottom:3px;margin:14px 0 8px;">PROJECTS</div>${projHTML}` : ''}
      ${sectionHTML}
    </div>
  </div>
</div>`;
}

function buildLacyTemplate(ctx) {
    const { resumeData, edu, skills, experience, color } = ctx;
    const accent = color || '#dc2626';
    const photoHTML = resumeData.profilePhotoData
        ? `<img src="${resumeData.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9a87c,#a07845);"></div>`;
    const expHTML = experience.map(e => `
        <div style="font-size:9px;color:#888;margin-bottom:3px;">${e.startDate||''} – ${e.endDate||'Present'}</div>
        <div style="font-size:11px;font-weight:700;color:#1a1a2e;">${e.jobTitle||''}</div>
        <div style="font-size:10px;color:#555;margin-bottom:4px;">${e.company||''}</div>
        <div style="font-size:9px;color:#555;line-height:1.7;margin-bottom:12px;">${(e.description||'').replace(/\n/g,'<br>')}</div>`).join('');
    const eduHTML = edu.map(e => `
        <div style="font-size:9px;color:#888;margin-bottom:2px;">${e.year||''}</div>
        <div style="font-size:11px;font-weight:700;color:#1a1a2e;">${e.degree||''}</div>
        <div style="font-size:9px;color:#555;margin-bottom:12px;">${e.school||''}</div>`).join('');
    const skillsHTML = skills.map(s => {
        const nm = s.name||s; const pct = (s.level||75)+'%';
        return `<div style="margin-bottom:8px;font-size:10px;color:#333;">${nm}<div style="height:5px;background:#f0f0f0;border-radius:3px;margin-top:3px;"><div style="width:${pct};height:100%;background:${accent};border-radius:3px;"></div></div></div>`;
    }).join('');
    const social = resumeData.linkedin || resumeData.website || 'Add your social links';
    const sectionHTML = buildExtraSectionsHTML(ctx, accent, '');
    return `<div style="min-height:860px;font-family:'Segoe UI',sans-serif;background:#fff;position:relative;">
  <div style="background:#111;padding:20px 24px;display:flex;align-items:center;gap:16px;position:relative;">
    <div class="editable-field" style="font-size:28px;font-weight:900;color:#fff;letter-spacing:3px;writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);height:80px;line-height:1;flex-shrink:0;cursor:pointer;" ${editBtn('fullName','Full Name',resumeData.fullName||'')}>${(resumeData.fullName||'YOUR NAME').toUpperCase()} <span class="edit-pen">✏</span></div>
    <div>
      <div class="editable-field" style="font-size:10px;color:#aaa;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;cursor:pointer;" ${editBtn('jobTitle','Job Title',resumeData.jobTitle||'')}>${(resumeData.jobTitle||'DESIGNER').toUpperCase()} <span class="edit-pen">✏</span></div>
      <div style="height:1px;background:rgba(255,255,255,0.2);width:120px;"></div>
    </div>
    <div style="position:absolute;top:10px;right:24px;width:90px;height:90px;border-radius:4px;overflow:hidden;border:3px solid #222;">${photoHTML}</div>
  </div>
  <div style="padding:12px 24px 10px;border-bottom:1px solid #f0f0f0;">
    <div style="display:flex;gap:16px;font-size:9px;color:#555;flex-wrap:wrap;">
      ${resumeData.email?`<span>&#9993; ${resumeData.email}</span>`:''}
      ${resumeData.phone?`<span>&#9990; ${resumeData.phone}</span>`:''}
      ${resumeData.website?`<span>&#128279; ${resumeData.website}</span>`:''}
      ${resumeData.address?`<span>&#128205; ${resumeData.address}</span>`:''}
      <span class="editable-field" style="cursor:pointer;margin-left:4px;" ${editBtn('phone','Contact Info',resumeData.phone||'')}><span class="edit-pen">✏</span></span>
    </div>
  </div>
  <div style="display:flex;min-height:660px;">
    <div style="width:50%;padding:20px 24px;border-right:2px solid #f0f0f0;">
      <div style="font-size:12px;font-weight:800;color:#111;text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:3px;margin-bottom:12px;">EDUCATION</div>
      ${eduHTML||'<div style="font-size:10px;color:#9ca3af;">Add education details.</div>'}
      <div style="font-size:12px;font-weight:800;color:#111;text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:3px;margin-bottom:12px;margin-top:16px;">EXPERIENCE</div>
      ${expHTML||'<div style="font-size:10px;color:#9ca3af;">Add experience details.</div>'}
      ${sectionHTML}
    </div>
    <div style="flex:1;padding:20px 20px;">
      <div style="font-size:12px;font-weight:800;color:#111;text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:3px;margin-bottom:12px;">ABOUT ME</div>
      <div class="editable-field" style="font-size:10px;color:#555;line-height:1.7;margin-bottom:18px;cursor:pointer;" ${editBtn('profileSummary','Summary',resumeData.profileSummary||'')}>${resumeData.profileSummary||'Click to add your profile summary.'} <span class="edit-pen">✏</span></div>
      <div style="font-size:12px;font-weight:800;color:#111;text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:3px;margin-bottom:12px;">SKILLS</div>
      <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillsHTML||'<div style="font-size:10px;color:#9ca3af;">Add skills.</div>'} <span class="edit-pen">✏</span></div>
      <div style="font-size:12px;font-weight:800;color:#111;text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:3px;margin-bottom:12px;margin-top:16px;">FOLLOW ME</div>
      <div class="editable-field" style="font-size:10px;color:#555;line-height:2;cursor:pointer;" ${editBtn('linkedin','Social Links',resumeData.linkedin||'')}>${social} <span class="edit-pen">✏</span></div>
    </div>
  </div>
</div>`;
}

function buildMarinaTemplate(ctx) {
    const { resumeData, edu, skills, projects, experience, color } = ctx;
    const accent = color || '#ec4899';
    const photoHTML = resumeData.profilePhotoData
        ? `<img src="${resumeData.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9a87c,#a07845);border-radius:4px;"></div>`;
    const expHTML = experience.map(e => `
        <div style="font-size:10px;color:#888;margin-bottom:2px;">${e.startDate||''} – ${e.endDate||'Present'}</div>
        <div style="font-size:12px;font-weight:700;color:#1a1a2e;">${e.jobTitle||''}</div>
        <div style="font-size:10px;color:#555;margin-bottom:4px;">${e.company||''}</div>
        <div style="font-size:10px;color:#555;line-height:1.7;margin-bottom:12px;">${(e.description||'').replace(/\n/g,'<br>')}</div>`).join('');
    const eduHTML = edu.map(e => `
        <div style="font-size:10px;color:#888;margin-bottom:2px;">${e.year||''}</div>
        <div style="font-size:11px;font-weight:700;color:#1a1a2e;">${e.degree||''}</div>
        <div style="font-size:9px;color:#555;margin-bottom:10px;">${e.school||''}</div>`).join('');
    const skillsList = skills.map(s => `• ${s.name||s}`).join('<br>');
    const projHTML = projects.map(p => `
        <div style="font-size:11px;font-weight:700;color:#1a1a2e;margin-bottom:4px;">${p.name||''}</div>
        <div style="font-size:10px;color:#555;line-height:1.7;margin-bottom:8px;">${(p.description||'').replace(/\n/g,'<br>')}</div>`).join('');
    const tools = resumeData.tools || 'Figma<br>Adobe XD<br>Photoshop<br>Illustrator';
    const sectionHTML = buildExtraSectionsHTML(ctx, accent, '');
    return `<div style="min-height:860px;font-family:'Segoe UI',sans-serif;background:#fff;position:relative;overflow:hidden;">
  <div style="position:absolute;top:-25px;left:-25px;width:100px;height:100px;border-radius:50%;background:#34d399;opacity:0.5;"></div>
  <div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:#f472b6;opacity:0.6;"></div>
  <div style="position:absolute;bottom:-25px;right:-15px;width:90px;height:90px;border-radius:50%;background:#34d399;opacity:0.4;"></div>
  <div style="position:relative;z-index:1;">
    <div style="background:${accent};padding:20px 24px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <div style="width:80px;height:80px;border:3px solid #fff;overflow:hidden;flex-shrink:0;">${photoHTML}</div>
      <div>
        <div class="editable-field" style="font-size:22px;font-weight:900;color:#fff;letter-spacing:0.5px;cursor:pointer;" ${editBtn('fullName','Full Name',resumeData.fullName||'')}>${(resumeData.fullName||'YOUR NAME').toUpperCase()} <span class="edit-pen">✏</span></div>
        <div class="editable-field" style="font-size:11px;color:rgba(255,255,255,0.85);margin-top:4px;text-transform:uppercase;cursor:pointer;" ${editBtn('jobTitle','Job Title',resumeData.jobTitle||'')}>${resumeData.jobTitle||'DESIGNER'} <span class="edit-pen">✏</span></div>
        <div class="editable-field" style="display:flex;gap:14px;font-size:9px;color:rgba(255,255,255,0.8);margin-top:6px;flex-wrap:wrap;cursor:pointer;" ${editBtn('phone','Contact',resumeData.phone||'')}>
          ${resumeData.phone?`<span>&#9990; ${resumeData.phone}</span>`:''}
          ${resumeData.email?`<span>&#9993; ${resumeData.email}</span>`:''} <span class="edit-pen">✏</span>
        </div>
      </div>
      <div style="margin-left:auto;background:#f59e0b;color:#fff;font-size:10px;font-weight:800;padding:4px 14px;border-radius:99px;flex-shrink:0;">Pro</div>
    </div>
    <div style="background:#fce7f3;padding:12px 24px;margin:14px 24px;border-radius:10px;">
      <div style="font-size:10px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:6px;">PROFILE</div>
      <div class="editable-field" style="font-size:10px;color:#555;line-height:1.7;cursor:pointer;" ${editBtn('profileSummary','Summary',resumeData.profileSummary||'')}>${resumeData.profileSummary||'Click to add your profile summary.'} <span class="edit-pen">✏</span></div>
    </div>
    <div style="display:flex;padding:0 24px;gap:20px;">
      <div style="width:44%;">
        ${projects.length > 0 ? `<div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:8px;">&#128295; PROJECTS</div>${projHTML}` : ''}
        <div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:8px;margin-top:10px;">&#128736; TOOLS</div>
        <div class="editable-field" style="font-size:10px;color:#555;line-height:2;margin-bottom:12px;cursor:pointer;" ${editBtn('tools','Tools',resumeData.tools||'')}>${tools} <span class="edit-pen">✏</span></div>
        <div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:8px;">&#128161; SKILLS</div>
        <div class="editable-field" style="font-size:10px;color:#555;line-height:2;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillsList||'Add skills'} <span class="edit-pen">✏</span></div>
        ${sectionHTML}
      </div>
      <div style="flex:1;">
        <div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:8px;">&#128188; EXPERIENCE</div>
        ${expHTML||'<div style="font-size:10px;color:#9ca3af;">Add experience details.</div>'}
        <div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:8px;margin-top:14px;">&#127891; EDUCATION</div>
        ${eduHTML||'<div style="font-size:10px;color:#9ca3af;">Add education details.</div>'}
      </div>
    </div>
  </div>
</div>`;
}

function buildExtraSectionsHTML(ctx, accent, titleStyle) {
    let html = '';
    const color = accent;
    Object.entries(activeSections).forEach(([name, show]) => {
        if (!show) return;
        html += `<div class="section-block" id="rv-section-${name}">
            <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:${color};border-bottom:2px solid ${color};padding-bottom:3px;margin-bottom:10px;margin-top:16px;${titleStyle}">${name.charAt(0).toUpperCase()+name.slice(1)}</div>
            <div class="editable-field extra-section-content" onclick="openEditModal('extra_${name}','${name}','')">
                <em style="color:#9ca3af;font-size:12px;">Click to add ${name} content</em> <span class="edit-pen">✏</span>
            </div>
        </div>`;
    });
    return html;
}

// ============================================================
// NEW TEMPLATE BUILDERS — Batch 2 (rick, caroline, narmatha, john-blue, monica)
// ============================================================

function buildRickTemplate(ctx) {
    const { resumeData, edu, skills, experience, color } = ctx;
    const accent = color || '#1e4a3a';
    const photoHTML = resumeData.profilePhotoData
        ? `<img src="${resumeData.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9a87c,#a07845);border-radius:50%;"></div>`;
    const expHTML = experience.map(e => `
        <div style="margin-bottom:16px;">
            <div style="font-size:13px;font-weight:700;color:#1a1a2e;">${e.company||''}</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">${e.jobTitle||''}</div>
            <div style="font-size:10px;color:#9ca3af;margin-bottom:7px;">${e.startDate||''} – ${e.endDate||'Present'}</div>
            <div style="font-size:10px;color:#555;line-height:1.7;">${(e.description||'').replace(/\n/g,'<br>')}</div>
        </div>`).join('');
    const eduHTML = edu.map(e => `
        <div style="margin-bottom:14px;">
            <div style="font-size:12px;font-weight:700;color:#1a1a2e;">${e.school||''}</div>
            <div style="font-size:10px;color:#555;">${e.degree||''}, ${e.year||''}</div>
        </div>`).join('');
    const skillsHTML = skills.map(s => {
        const nm = s.name||s; const pct = (s.level||75)+'%';
        return `<div style="font-size:10px;color:rgba(255,255,255,0.8);margin-bottom:2px;">${nm}</div>
        <div style="height:4px;background:rgba(255,255,255,0.2);border-radius:3px;margin-bottom:8px;"><div style="width:${pct};height:100%;background:#fff;border-radius:3px;"></div></div>`;
    }).join('');
    const langs = resumeData.languages || 'English<br>Italian';
    const links = resumeData.linkedin ? `LinkedIn<br>${resumeData.linkedin}` : 'LinkedIn<br>Dribbble<br>Behance';
    const sectionHTML = buildExtraSectionsHTML(ctx, accent, '');
    return `<div style="display:flex;min-height:860px;font-family:'Segoe UI',sans-serif;">
  <div style="width:36%;background:${accent};padding:28px 18px;display:flex;flex-direction:column;align-items:center;">
    <div style="width:90px;height:90px;border-radius:50%;margin-bottom:12px;border:3px solid rgba(255,255,255,0.25);overflow:hidden;">${photoHTML}</div>
    <div class="editable-field" style="font-size:16px;font-weight:900;color:#fff;margin-bottom:3px;cursor:pointer;" ${editBtn('fullName','Full Name',resumeData.fullName||'')}>${resumeData.fullName||'Your Name'} <span class="edit-pen">✏</span></div>
    <div class="editable-field" style="font-size:10px;color:rgba(255,255,255,0.6);margin-bottom:22px;cursor:pointer;" ${editBtn('jobTitle','Job Title',resumeData.jobTitle||'')}>${resumeData.jobTitle||'Product Designer'} <span class="edit-pen">✏</span></div>
    <div style="font-size:11px;font-weight:800;color:#fff;text-transform:uppercase;align-self:flex-start;margin-bottom:10px;">Details</div>
    <div class="editable-field" style="font-size:9px;color:rgba(255,255,255,0.75);align-self:flex-start;line-height:1.9;margin-bottom:20px;cursor:pointer;" ${editBtn('phone','Contact',resumeData.phone||'')}>${resumeData.address||''}${resumeData.phone?`<br>${resumeData.phone}`:''}${resumeData.email?`<br>${resumeData.email}`:''}</div>
    <div style="font-size:11px;font-weight:800;color:#fff;text-transform:uppercase;align-self:flex-start;margin-bottom:8px;">Links</div>
    <div style="font-size:9px;color:rgba(255,255,255,0.75);align-self:flex-start;line-height:2;margin-bottom:20px;">${links}</div>
    <div style="font-size:11px;font-weight:800;color:#fff;text-transform:uppercase;align-self:flex-start;margin-bottom:10px;">Skills</div>
    <div style="width:100%;" class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillsHTML||'<div style="font-size:9px;color:rgba(255,255,255,0.5);">Add skills</div>'} <span class="edit-pen">✏</span></div>
  </div>
  <div style="flex:1;background:#fff;padding:28px 26px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:20px;font-weight:800;color:#1a1a2e;">Profile</div>
      <div style="background:#f59e0b;color:#fff;font-size:10px;font-weight:800;padding:4px 16px;border-radius:99px;">Pro</div>
    </div>
    <div class="editable-field" style="font-size:10px;color:#555;line-height:1.7;margin-bottom:22px;cursor:pointer;" ${editBtn('profileSummary','Summary',resumeData.profileSummary||'')}>${resumeData.profileSummary||'Click to add your profile summary.'} <span class="edit-pen">✏</span></div>
    <div style="font-size:15px;font-weight:800;color:#1a1a2e;margin-bottom:14px;">Experience</div>
    ${expHTML||'<div style="font-size:10px;color:#9ca3af;">Add your experience.</div>'}
    <div style="font-size:15px;font-weight:800;color:#1a1a2e;margin-bottom:12px;margin-top:10px;">Education</div>
    ${eduHTML||'<div style="font-size:10px;color:#9ca3af;">Add education.</div>'}
    <div style="font-size:15px;font-weight:800;color:#1a1a2e;margin-bottom:10px;margin-top:10px;">Languages</div>
    <div class="editable-field" style="font-size:10px;color:#555;line-height:1.8;cursor:pointer;" ${editBtn('languages','Languages',resumeData.languages||'')}>${langs} <span class="edit-pen">✏</span></div>
    ${sectionHTML}
  </div>
</div>`;
}

function buildCarolineTemplate(ctx) {
    const { resumeData, edu, skills, experience, color } = ctx;
    const accent = color || '#ec4899';
    const photoHTML = resumeData.profilePhotoData
        ? `<img src="${resumeData.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9a87c,#a07845);border-radius:50%;"></div>`;
    const expHTML = experience.map(e => `
        <div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;flex-wrap:wrap;gap:4px;">
                <div style="font-size:12px;font-weight:700;color:#1a1a2e;font-style:italic;">${e.jobTitle||''}</div>
                <div style="display:flex;gap:12px;font-size:9px;color:#888;"><span>&#127970; ${e.company||''}</span><span>&#128197; ${e.startDate||''} – ${e.endDate||'Present'}</span></div>
            </div>
            <div style="font-size:10px;color:#555;line-height:1.8;">${(e.description||'').replace(/\n/g,'<br>')}</div>
        </div>`).join('');
    const eduHTML = edu.map(e => `
        <div style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;color:#1a1a2e;">${e.degree||''}</div>
            <div style="display:flex;justify-content:space-between;font-size:9px;color:#888;"><span>&#127979; ${e.school||''}</span><span>${e.year||''}</span></div>
        </div>`).join('');
    const skillsList = skills.map(s => s.name||s).join(', ');
    const langs = resumeData.languages || 'English';
    const sectionHTML = buildExtraSectionsHTML(ctx, accent, '');
    return `<div style="min-height:860px;font-family:'Segoe UI',sans-serif;background:#fff;padding:28px;">
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
    <div style="width:70px;height:70px;border-radius:50%;flex-shrink:0;overflow:hidden;border:2px solid #e5e7eb;">${photoHTML}</div>
    <div style="flex:1;">
      <div class="editable-field" style="font-size:22px;font-weight:900;color:#1a1a2e;cursor:pointer;" ${editBtn('fullName','Full Name',resumeData.fullName||'')}>${resumeData.fullName||'Your Name'} <span class="edit-pen">✏</span></div>
      <div class="editable-field" style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;cursor:pointer;" ${editBtn('jobTitle','Job Title',resumeData.jobTitle||'')}>${resumeData.jobTitle||'Product Designer'} <span class="edit-pen">✏</span></div>
    </div>
    <div style="background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:6px 18px;border-radius:99px;flex-shrink:0;">Pro</div>
  </div>
  <div style="display:flex;gap:16px;font-size:9px;color:#6b7280;margin-bottom:14px;flex-wrap:wrap;border-bottom:1px solid #f0f0f0;padding-bottom:12px;">
    ${resumeData.email?`<span>&#9993; ${resumeData.email}</span>`:''}
    ${resumeData.website?`<span>&#128279; ${resumeData.website}</span>`:''}
    ${resumeData.phone?`<span>&#9990; ${resumeData.phone}</span>`:''}
  </div>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:18px;">
    <div class="editable-field" style="font-size:10px;color:#555;line-height:1.7;cursor:pointer;" ${editBtn('profileSummary','Summary',resumeData.profileSummary||'')}>${resumeData.profileSummary||'Click to add your profile summary.'} <span class="edit-pen">✏</span></div>
  </div>
  <div style="font-size:12px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">EXPERIENCE</div>
  ${expHTML||'<div style="font-size:10px;color:#9ca3af;margin-bottom:16px;">Add your experience.</div>'}
  <div style="display:flex;gap:24px;margin-top:10px;">
    <div style="flex:1;">
      <div style="font-size:12px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">SKILLS</div>
      <div class="editable-field" style="font-size:10px;color:#555;margin-bottom:10px;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillsList||'Add your skills'} <span class="edit-pen">✏</span></div>
      <div style="font-size:10px;font-weight:700;color:#1a1a2e;margin-bottom:4px;">Languages</div>
      <div class="editable-field" style="font-size:10px;color:#555;cursor:pointer;" ${editBtn('languages','Languages',resumeData.languages||'')}>${langs} <span class="edit-pen">✏</span></div>
    </div>
    <div style="width:42%;">
      <div style="font-size:12px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">EDUCATION</div>
      ${eduHTML||'<div style="font-size:10px;color:#9ca3af;">Add education.</div>'}
    </div>
  </div>
  ${sectionHTML}
</div>`;
}

function buildNarmathaTemplate(ctx) {
    const { resumeData, edu, skills, experience, color } = ctx;
    const accent = color || '#8b1c1c';
    const secColor = '#d97706';
    const photoHTML = resumeData.profilePhotoData
        ? `<img src="${resumeData.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9a87c,#a07845);"></div>`;
    const expHTML = experience.map(e => `
        <div style="margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:#fff;margin-bottom:6px;">${e.jobTitle||''} | ${e.company||''}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.75);line-height:1.8;">
                ${(e.description||'').split('\n').filter(l=>l.trim()).map(l=>`<div style="display:flex;gap:7px;align-items:flex-start;margin-bottom:4px;"><div style="width:8px;height:8px;border-radius:50%;background:#f59e0b;flex-shrink:0;margin-top:2px;"></div><span>${l.replace(/^[•\-]\s*/,'')}</span></div>`).join('')}
            </div>
        </div>`).join('');
    const eduHTML = edu.map(e => `<div style="font-weight:700;">${e.degree||''}</div><div style="font-size:9px;">${e.school||''}</div>`).join('<br>');
    const skillsList = skills.map(s => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div style="width:10px;height:10px;border-radius:50%;background:${accent};flex-shrink:0;"></div>${s.name||s}</div>`).join('');
    const contacts = [
        resumeData.email ? `&#9993; ${resumeData.email}` : '',
        resumeData.phone ? `&#9990; ${resumeData.phone}` : '',
        resumeData.website ? `&#128279; ${resumeData.website}` : '',
        resumeData.address ? `&#128205; ${resumeData.address}` : '',
    ].filter(Boolean);
    const sectionHTML = buildExtraSectionsHTML(ctx, '#f59e0b', '');
    return `<div style="display:flex;min-height:860px;font-family:'Segoe UI',sans-serif;">
  <div style="width:36%;background:#f5f5f5;padding:24px 16px;display:flex;flex-direction:column;">
    <div style="width:80px;height:80px;border-radius:4px;margin-bottom:16px;overflow:hidden;">${photoHTML}</div>
    <div style="font-size:12px;font-weight:800;color:#1a1a2e;margin-bottom:10px;border-bottom:1.5px solid #d1d5db;padding-bottom:4px;">Contact</div>
    <div style="font-size:9px;color:#555;line-height:2;margin-bottom:16px;">${contacts.join('<br>') || 'Add contact details'}</div>
    <div style="font-size:12px;font-weight:800;color:#1a1a2e;margin-bottom:10px;border-bottom:1.5px solid #d1d5db;padding-bottom:4px;">Education</div>
    <div style="font-size:9px;color:#555;line-height:1.7;margin-bottom:16px;">${eduHTML||'Add education'}</div>
    <div style="font-size:12px;font-weight:800;color:#1a1a2e;margin-bottom:10px;border-bottom:1.5px solid #d1d5db;padding-bottom:4px;">Skills</div>
    <div style="font-size:10px;color:#555;" class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillsList||'Add skills'} <span class="edit-pen">✏</span></div>
  </div>
  <div style="flex:1;background:${accent};padding:24px 20px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
      <div class="editable-field" style="font-size:24px;font-weight:900;color:#fff;cursor:pointer;" ${editBtn('fullName','Full Name',resumeData.fullName||'')}>${resumeData.fullName||'Your Name'} <span class="edit-pen">✏</span></div>
      <div style="background:#f59e0b;color:#fff;font-size:10px;font-weight:800;padding:4px 14px;border-radius:99px;">Pro</div>
    </div>
    <div class="editable-field" style="font-size:10px;color:rgba(255,255,255,0.8);line-height:1.7;margin-bottom:20px;cursor:pointer;" ${editBtn('profileSummary','Summary',resumeData.profileSummary||'')}>${resumeData.profileSummary||'Click to add your profile summary.'} <span class="edit-pen">✏</span></div>
    <div style="background:${secColor};color:#fff;font-size:14px;font-weight:800;padding:10px 16px;border-radius:6px;margin-bottom:14px;">Professional Experience</div>
    ${expHTML||'<div style="font-size:10px;color:rgba(255,255,255,0.5);">Add experience.</div>'}
    <div style="background:#b45309;color:#fff;font-size:14px;font-weight:800;padding:10px 16px;border-radius:6px;margin-bottom:14px;margin-top:16px;">CERTIFICATION</div>
    <div style="font-size:10px;color:rgba(255,255,255,0.8);line-height:2;" class="editable-field" ${editBtn('certifications','Certifications','')}>${resumeData.certifications||'<span style="color:#9ca3af;font-size:10px;cursor:pointer;">Click to add certifications ✏</span>'} <span class="edit-pen">✏</span></div>
    ${sectionHTML}
  </div>
</div>`;
}

function buildJohnBlueTemplate(ctx) {
    const { resumeData, edu, skills, experience, color } = ctx;
    const accent = color || '#3b82f6';
    const photoHTML = resumeData.profilePhotoData
        ? `<img src="${resumeData.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;">`
        : '';
    const expHTML = experience.map(e => `
        <div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                <div style="font-size:11px;font-weight:800;color:#1a1a2e;text-transform:uppercase;">${e.jobTitle||''}</div>
                <div style="font-size:9px;color:${accent};">${e.location||''}</div>
            </div>
            <div style="font-size:9px;color:#888;margin-bottom:6px;">${e.company||''} | ${e.startDate||''} – ${e.endDate||'Present'}</div>
            <div style="font-size:9px;color:#555;line-height:1.8;">${(e.description||'').replace(/\n/g,'<br>')}</div>
        </div>`).join('');
    const eduHTML = edu.map(e => `
        <div style="margin-bottom:16px;">
            <div style="font-size:11px;font-weight:800;color:#1a1a2e;text-transform:uppercase;line-height:1.3;">${(e.degree||'').toUpperCase()}</div>
            <div style="font-size:10px;color:${accent};margin-top:2px;">${e.school||''}</div>
            <div style="font-size:9px;color:#888;">${e.location||''} | ${e.year||''}</div>
        </div>`).join('');
    const skillsList = skills.map(s => s.name||s).join('<br>');
    const langs = resumeData.languages || 'English: Native';
    const qualities = resumeData.qualities || 'Adaptability<br>Problem-Solving<br>Team Player<br>Detail-Oriented';
    const sectionHTML = buildExtraSectionsHTML(ctx, accent, '');
    return `<div style="min-height:860px;font-family:'Segoe UI',sans-serif;background:#fff;">
  <div style="display:flex;align-items:center;gap:14px;padding:18px 24px;border-bottom:2px solid #e5e7eb;">
    <div>
      <div class="editable-field" style="font-size:24px;font-weight:900;color:#1a1a2e;letter-spacing:0.5px;cursor:pointer;" ${editBtn('fullName','Full Name',resumeData.fullName||'')}>${(resumeData.fullName||'YOUR NAME').toUpperCase()} <span class="edit-pen">✏</span></div>
      <div style="background:${accent};color:#fff;font-size:9px;font-weight:800;padding:2px 10px;border-radius:3px;display:inline-block;margin-top:4px;">${resumeData.jobTitle||'Marketing Specialist'}</div>
    </div>
    <div style="margin-left:auto;text-align:right;">
      <div style="background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:5px 16px;border-radius:99px;margin-bottom:4px;display:inline-block;">Pro</div>
      ${resumeData.email?`<div style="font-size:9px;color:#6b7280;">${resumeData.email}</div>`:''}
      ${resumeData.website?`<div style="font-size:9px;color:#6b7280;">${resumeData.website}</div>`:''}
    </div>
  </div>
  <div style="display:flex;min-height:760px;">
    <div style="width:36%;padding:20px 18px;border-right:2px solid #e5e7eb;background:#f8f9ff;">
      <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-left:3px solid ${accent};padding-left:8px;margin-bottom:12px;">EDUCATION</div>
      ${eduHTML||'<div style="font-size:10px;color:#9ca3af;">Add education.</div>'}
      <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-left:3px solid ${accent};padding-left:8px;margin-bottom:10px;margin-top:6px;">LANGUAGES</div>
      <div style="font-size:10px;color:#555;line-height:2;margin-bottom:16px;" class="editable-field" ${editBtn('languages','Languages','')}>${langs}</div> <span class="edit-pen">✏</span>
      <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-left:3px solid ${accent};padding-left:8px;margin-bottom:10px;">Skills</div>
      <div style="font-size:10px;color:#555;line-height:2;margin-bottom:16px;" class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillsList||'Add skills'} <span class="edit-pen">✏</span></div>
      <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-left:3px solid ${accent};padding-left:8px;margin-bottom:10px;">Qualities</div>
      <div style="font-size:10px;color:#555;line-height:2;">${qualities}</div>
    </div>
    <div style="flex:1;padding:20px 20px;">
      <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-left:3px solid ${accent};padding-left:8px;margin-bottom:10px;">ABOUT ME</div>
      <div class="editable-field" style="font-size:10px;color:#555;line-height:1.7;margin-bottom:18px;cursor:pointer;" ${editBtn('profileSummary','Summary',resumeData.profileSummary||'')}>${resumeData.profileSummary||'Click to add your profile summary.'} <span class="edit-pen">✏</span></div>
      <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-left:3px solid ${accent};padding-left:8px;margin-bottom:12px;">PROFESSIONAL EXPERIENCE</div>
      ${expHTML||'<div style="font-size:10px;color:#9ca3af;">Add your experience.</div>'}
      ${sectionHTML}
    </div>
  </div>
</div>`;
}

function buildMonicaTemplate(ctx) {
    const { resumeData, edu, skills, experience, color } = ctx;
    const accent = color || '#111111';
    const photoHTML = resumeData.profilePhotoData
        ? `<img src="${resumeData.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#888,#555);border-radius:50%;"></div>`;
    const expHTML = experience.map(e => `
        <div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
                <div style="font-size:11px;font-weight:700;color:#1a1a2e;">${e.startDate||''} – ${e.endDate||'Present'}</div>
                <div style="font-size:9px;color:#888;">${e.location||''}</div>
            </div>
            <div style="font-size:10px;font-weight:600;color:#555;margin-bottom:4px;">${e.jobTitle||''} at ${e.company||''}</div>
            <div style="font-size:9px;color:#555;line-height:1.6;">${(e.description||'').replace(/\n/g,'<br>')}</div>
        </div>`).join('');
    const eduHTML = edu.map(e => `
        <div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
                <div style="font-size:11px;font-weight:700;color:#1a1a2e;">${e.year||''} — ${e.school||''}</div>
                <div style="font-size:9px;color:#888;">${e.location||''}</div>
            </div>
            <div style="font-size:10px;font-weight:600;color:#555;margin-bottom:4px;">${e.degree||''}</div>
            <div style="font-size:9px;color:#555;line-height:1.6;">${e.description||''}</div>
        </div>`).join('');
    const skillsHTML = skills.map(s => {
        const nm = s.name||s; const pct = (s.level||70)+'%';
        return `<div style="font-size:10px;color:#555;margin-bottom:3px;">${nm}</div>
        <div style="height:6px;background:#e5e7eb;border-radius:3px;margin-bottom:10px;"><div style="width:${pct};height:100%;background:${accent};border-radius:3px;"></div></div>`;
    }).join('');
    const sectionHTML = buildExtraSectionsHTML(ctx, accent, '');
    return `<div style="min-height:860px;font-family:'Segoe UI',sans-serif;background:#fff;">
  <div style="display:flex;align-items:center;justify-content:space-between;background:${accent};padding:14px 24px;">
    <div style="font-size:14px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:1px;">Profile</div>
    <div style="background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:5px 18px;border-radius:99px;">Pro</div>
  </div>
  <div style="display:flex;gap:20px;padding:20px 24px;border-bottom:1px solid #f0f0f0;align-items:flex-start;flex-wrap:wrap;">
    <div style="width:90px;height:90px;border-radius:50%;flex-shrink:0;border:3px solid #e5e7eb;overflow:hidden;">${photoHTML}</div>
    <div style="flex:1;min-width:140px;">
      <div class="editable-field" style="font-size:22px;font-weight:900;color:#1a1a2e;line-height:1.1;cursor:pointer;" ${editBtn('fullName','Full Name',resumeData.fullName||'')}>${resumeData.fullName||'Your Name'} <span class="edit-pen">✏</span></div>
      <div class="editable-field" style="font-size:10px;color:#6b7280;margin-top:4px;margin-bottom:8px;cursor:pointer;" ${editBtn('jobTitle','Job Title',resumeData.jobTitle||'')}>${resumeData.jobTitle||'Product Designer'} <span class="edit-pen">✏</span></div>
    </div>
    <div style="font-size:9px;color:#555;line-height:2;">
      <span class="editable-field" style="cursor:pointer;" ${editBtn('phone','Contact Info',resumeData.phone||'')}><span class="edit-pen" style="font-size:10px;color:#888;">✏ Edit Contact</span></span>
      ${resumeData.dob?`<div><span style="color:#888;">Date of birth: </span>${resumeData.dob}</div>`:''}
      ${resumeData.address?`<div><span style="color:#888;">Address: </span>${resumeData.address}</div>`:''}
      ${resumeData.phone?`<div><span style="color:#888;">Phone: </span>${resumeData.phone}</div>`:''}
      ${resumeData.email?`<div><span style="color:#888;">Email: </span>${resumeData.email}</div>`:''}
      ${resumeData.website?`<div><span style="color:#888;">Website: </span>${resumeData.website}</div>`:''}
    </div>
  </div>
  <div class="editable-field" style="padding:14px 24px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#555;line-height:1.7;cursor:pointer;" ${editBtn('profileSummary','Summary',resumeData.profileSummary||'')}>${resumeData.profileSummary||'Click to add your profile summary.'} <span class="edit-pen">✏</span></div>
  <div style="display:inline-block;background:${accent};padding:8px 20px;margin:14px 0 0 24px;">
    <div style="font-size:12px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:1px;">Resume</div>
  </div>
  <div style="display:flex;padding:16px 24px;gap:24px;flex-wrap:wrap;">
    <div style="flex:1;min-width:200px;">
      <div style="font-size:14px;font-weight:800;color:#1a1a2e;margin-bottom:10px;">Education</div>
      ${eduHTML||'<div style="font-size:10px;color:#9ca3af;">Add education.</div>'}
      <div style="font-size:14px;font-weight:800;color:#1a1a2e;margin-bottom:10px;margin-top:8px;">Employment</div>
      ${expHTML||'<div style="font-size:10px;color:#9ca3af;">Add experience.</div>'}
      ${sectionHTML}
    </div>
    <div style="width:36%;min-width:160px;border-left:1px solid #e5e7eb;padding-left:20px;">
      <div style="font-size:14px;font-weight:800;color:#1a1a2e;margin-bottom:14px;">Design Skills</div>
      <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillsHTML||'<div style="font-size:10px;color:#9ca3af;">Add skills.</div>'} <span class="edit-pen">✏</span></div>
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 19: NARMATHA-PRO — Dark Maroon Right + Light Left
// Matching Image 1: beige left panel, dark maroon right
// ============================================================
function buildNarmathaProTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#3d1a1a';
    const name    = d.fullName       || 'Your Name';
    const title   = d.jobTitle       || 'Software Developer';
    const email   = d.email          || 'email@example.com';
    const phone   = d.phone          || '(123) 456-7890';
    const summary = d.profileSummary || 'Add your professional summary here.';
    const linkedin= d.linkedin       || 'LinkedIn | Portfolio';
    const location= d.location       || 'City, State';

    const photoSize = d.photoSize || 80;
    const photoBorderRadius = d.photoShape === 'square' ? '6px' : '50%';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};object-fit:cover;object-position:${d.photoPosition||'top'};display:block;cursor:pointer;border:2px solid #e0cfc2;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};background:#c9a87c;display:flex;align-items:center;justify-content:center;font-size:2rem;cursor:pointer;border:2px solid #e0cfc2;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillsHTML = skills.length
        ? skills.map(s => `<div style="margin-bottom:8px;font-size:12px;color:#333;">${s}
            <div style="height:5px;background:#e5e7eb;border-radius:3px;margin-top:3px;">
              <div style="width:88%;height:100%;background:${accent};border-radius:3px;"></div>
            </div></div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const contactItems = [
        { icon: '📧', val: email,    field: 'email',    label: 'Email'    },
        { icon: '📞', val: phone,    field: 'phone',    label: 'Phone'    },
        { icon: '🔗', val: linkedin, field: 'linkedin', label: 'LinkedIn' },
        { icon: '📍', val: location, field: 'location', label: 'Location' },
    ].map(c => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;font-size:11px;color:#555;cursor:pointer;" class="editable-field" ${editBtn(c.field,c.label,c.val)}>
        <span>${c.icon}</span><span>${c.val} <span class="edit-pen">✏</span></span>
    </div>`).join('');

    const expHTML = experience.length
        ? experience.map(e => `<div style="margin-bottom:14px;">
            <div style="font-size:13px;font-weight:700;color:#fff;">${e.role||e.title||''} · ${e.company||''}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:5px;">${e.from||e.startDate||''} – ${e.to||e.endDate||'Present'}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.8);line-height:1.7;">
              ${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:3px;"><div style="width:6px;height:6px;border-radius:50%;background:#f59e0b;flex-shrink:0;margin-top:3px;"></div>${b}</div>`).join('')}
            </div></div>`).join('')
        : `<div style="font-size:11px;color:rgba(255,255,255,0.5);cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div style="margin-bottom:10px;font-size:11px;color:rgba(255,255,255,0.85);">
            <strong>${e.degree||''} ${e.field?'– '+e.field:''}</strong>
            <div style="color:rgba(255,255,255,0.6);">${e.university||''} ${e.year?'· '+e.year:''}</div>
            ${e.cgpa?`<div style="color:rgba(255,255,255,0.5);">CGPA: ${e.cgpa}</div>`:''}
          </div>`).join('')
        : `<div style="font-size:11px;color:rgba(255,255,255,0.5);cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    return `<div style="display:flex;min-height:860px;font-family:'Segoe UI',sans-serif;">
  <div style="width:38%;background:#f0f0f0;padding:24px 16px;display:flex;flex-direction:column;">
    <div style="margin-bottom:14px;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
    <div style="font-size:11px;font-weight:800;color:#333;border-bottom:1.5px solid #ccc;padding-bottom:4px;margin-bottom:10px;">Experience</div>
    ${expHTML.replace(/<div style="margin-bottom:14px;">/g,'<div style="margin-bottom:10px;font-size:10px;color:#555;">')}
    <div style="font-size:11px;font-weight:800;color:#333;border-bottom:1.5px solid #ccc;padding-bottom:4px;margin:10px 0 10px;">Education</div>
    <div style="font-size:10px;color:#555;">${edu.length?edu.map(e=>`<div style="margin-bottom:8px;"><strong>${e.degree||''}</strong><div style="color:#888;">${e.university||''}</div></div>`).join(''):`<div style="cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`}</div>
    <div style="font-size:11px;font-weight:800;color:#333;border-bottom:1.5px solid #ccc;padding-bottom:4px;margin:10px 0 10px;">Skill</div>
    ${skillsHTML}
    <div style="font-size:11px;font-weight:800;color:#333;border-bottom:1.5px solid #ccc;padding-bottom:4px;margin:10px 0 10px;">Contact</div>
    ${contactItems}
  </div>
  <div style="flex:1;background:${accent};padding:28px 22px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
      <div>
        <div style="font-size:26px;font-weight:900;color:#fff;cursor:pointer;class="editable-field"" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen" style="font-size:14px;">✏</span></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:3px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      </div>
      <div style="background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:5px 18px;border-radius:99px;">Pro</div>
    </div>
    <div style="font-size:10px;color:rgba(255,255,255,0.8);line-height:1.7;margin-bottom:20px;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
    <div style="background:#d97706;color:#fff;font-size:14px;font-weight:800;padding:10px 16px;border-radius:6px;margin-bottom:14px;">Professional Experience</div>
    ${expHTML}
    <div style="background:#b45309;color:#fff;font-size:14px;font-weight:800;padding:10px 16px;border-radius:6px;margin:16px 0 12px;">Education</div>
    ${eduHTML}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 20: DONNA — Clean Pink/Purple Accents
// Matching Image 2: clean white with pink-purple icon-based sections
// ============================================================
function buildDonnaTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#d946ef';
    const name     = d.fullName       || 'Your Name';
    const title    = d.jobTitle       || 'Professional';
    const email    = d.email          || 'email@example.com';
    const phone    = d.phone          || '(123) 456-7890';
    const summary  = d.profileSummary || 'Add your professional summary here.';
    const linkedin = d.linkedin       || 'linkedin.com/in/yourname';
    const location = d.location       || 'City, State';

    const photoSize = d.photoSize || 70;
    const photoBorderRadius = d.photoShape === 'square' ? '6px' : '50%';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};object-fit:cover;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};background:linear-gradient(135deg,#c9a87c,#a07845);display:flex;align-items:center;justify-content:center;font-size:1.8rem;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillTags = skills.length
        ? skills.map(s=>`<span style="background:#fce7f3;color:#9d174d;font-size:11px;padding:4px 10px;border-radius:99px;margin:2px;">${s}</span>`).join('')
        : `<span style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</span>`;

    const expHTML = experience.length
        ? experience.map(e=>`<div style="margin-bottom:16px;">
            <div style="font-size:13px;font-weight:700;color:#1a1a2e;">${e.role||e.title||''} | ${e.company||''}</div>
            <div style="font-size:11px;color:#888;margin-bottom:5px;">${e.from||e.startDate||''} – ${e.to||e.endDate||'Present'}</div>
            <div style="font-size:11px;color:#555;line-height:1.7;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')} class="editable-field" ${editBtn('experienceJson','Experience','')}>Click to add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div style="margin-bottom:10px;">
            <div style="font-size:13px;font-weight:700;color:#1a1a2e;">${e.degree||''} ${e.field?', '+e.field:''} | ${e.university||''}</div>
            <div style="font-size:11px;color:#555;margin-top:2px;">${e.bullets||e.description||''}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')} class="editable-field" ${editBtn('educationJson','Education','')}>Click to add education ✏</div>`;

    function sectionHead(icon, label) {
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;margin-top:20px;">
          <div style="width:28px;height:28px;background:linear-gradient(135deg,#a855f7,${accent});border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;">${icon}</div>
          <div style="font-size:13px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:1px;">${label}</div>
        </div>`;
    }

    return `<div style="min-height:860px;font-family:'Segoe UI',sans-serif;background:#fff;padding:28px;">
  <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #f0f0f0;">
    <div class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
    <div style="flex:1;">
      <div style="font-size:26px;font-weight:900;color:#1a1a2e;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      <div style="font-size:11px;color:#6b7280;margin-top:3px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      <div style="font-size:10px;color:#888;margin-top:4px;">${email} | ${phone}</div>
      <div style="font-size:10px;color:#888;">${location} | ${linkedin}</div>
    </div>
    <div style="background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:5px 18px;border-radius:99px;flex-shrink:0;">Pro</div>
  </div>
  ${sectionHead('👤','About Me')}
  <div style="font-size:11px;color:#555;line-height:1.7;margin-bottom:4px;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
  ${sectionHead('🏢','Experience')}
  <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
  ${sectionHead('🎓','Education')}
  <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
  ${sectionHead('⭐','Skills')}
  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;" class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillTags}</div>
</div>`;
}

// ============================================================
// TEMPLATE 21: JOHN-PURPLE-LEFT — Purple left panel + skills
// Matching Image 3: skills on left, profile right, purple accents
// ============================================================
function buildJohnPurpleLeftTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#7c3aed';
    const name     = d.fullName       || 'JOHN SMITH';
    const title    = d.jobTitle       || 'Software Engineer';
    const email    = d.email          || 'email@example.com';
    const phone    = d.phone          || '(000) 954-987-2679';
    const summary  = d.profileSummary || 'Add your professional summary here.';
    const linkedin = d.linkedin       || 'linkedin.com/in/yourname';
    const location = d.location       || 'City, State';

    const photoSize = d.photoSize || 90;
    const photoBorderRadius = d.photoShape === 'square' ? '6px' : '8px';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};object-fit:cover;cursor:pointer;border:3px solid ${accent};" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};background:linear-gradient(135deg,#c9a87c,#a07845);display:flex;align-items:center;justify-content:center;font-size:2.5rem;cursor:pointer;border:3px solid ${accent};" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillsHTML = skills.length
        ? skills.map(s=>`<div style="font-size:11px;color:#555;margin-bottom:4px;">${s}
            <div style="height:5px;background:${accent};border-radius:3px;margin-top:2px;width:80%;"></div></div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e=>`<div style="margin-bottom:14px;">
            <div style="font-size:13px;font-weight:700;color:${accent};">${e.role||e.title||''}</div>
            <div style="font-size:11px;color:#888;margin-bottom:4px;">${e.company||''} | ${e.from||e.startDate||''} – ${e.to||e.endDate||'Present'}</div>
            <div style="font-size:11px;color:#555;line-height:1.6;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div style="background:#f3e8ff;border-radius:8px;padding:10px 12px;margin-bottom:8px;">
            <div style="font-size:12px;font-weight:700;color:${accent};">${e.degree||''} ${e.field?'in '+e.field:''}</div>
            <div style="font-size:11px;color:#555;">${e.university||''} | ${e.year||''}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const langHTML = d.languages
        ? d.languages.split(',').map(l=>`<div style="background:#f3f4f6;border-radius:20px;padding:5px 12px;font-size:11px;color:#555;margin-bottom:4px;display:inline-block;border:1px solid #e5e7eb;">${l.trim()}</div> `).join('')
        : `<div style="background:#f3f4f6;border-radius:20px;padding:5px 12px;font-size:11px;color:#555;display:inline-block;border:1px solid #e5e7eb;">English</div>`;

    return `<div style="display:flex;min-height:860px;font-family:'Segoe UI',sans-serif;background:#fff;">
  <div style="width:36%;background:#fff;padding:24px 16px;box-shadow:2px 0 10px rgba(0,0,0,0.06);">
    <div style="margin-bottom:14px;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
    <div style="font-size:13px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:10px;cursor:pointer;" class="editable-field" ${editBtn('skillsJson','Skills','')}>Skills ✏</div>
    ${skillsHTML}
    <div style="font-size:13px;font-weight:800;color:${accent};text-transform:uppercase;margin:16px 0 10px;cursor:pointer;" class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>Language ✏</div>
    ${langHTML}
  </div>
  <div style="flex:1;padding:24px 20px;">
    <div style="font-size:11px;color:#6b7280;text-align:right;margin-bottom:4px;cursor:pointer;" class="editable-field" ${editBtn('phone','Phone',phone)}>${phone} ✏</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
      <div>
        <div style="font-size:22px;font-weight:900;color:#1a1a2e;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
        <div style="font-size:12px;color:${accent};margin-top:2px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      </div>
      <div style="background:#f59e0b;color:#fff;font-size:10px;font-weight:800;padding:5px 16px;border-radius:99px;">Pro</div>
    </div>
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:8px;">Profile</div>
    <div style="font-size:11px;color:#555;line-height:1.7;margin-bottom:18px;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;margin-bottom:12px;">Experience</div>
    <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:10px;margin-top:18px;">Education</div>
    <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:8px;margin-top:16px;">Contact</div>
    <div style="font-size:11px;color:#555;line-height:1.8;cursor:pointer;" class="editable-field" ${editBtn('email','Email',email)}>📧 ${email} <span class="edit-pen">✏</span></div>
    <div style="font-size:11px;color:#555;cursor:pointer;" class="editable-field" ${editBtn('location','Location',location)}>📍 ${location} <span class="edit-pen">✏</span></div>
    <div style="font-size:11px;color:#555;cursor:pointer;" class="editable-field" ${editBtn('linkedin','LinkedIn',linkedin)}>🔗 ${linkedin} <span class="edit-pen">✏</span></div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 22: JOHN-DARK-TEAL — Dark sidebar + teal/orange accent
// Matching Image 4: dark left, white right, teal highlights
// ============================================================
function buildJohnDarkTealTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#1a2a2e';
    const accentLight = '#2a7a8a';
    const name     = d.fullName       || 'JOHN SMITH';
    const title    = d.jobTitle       || 'Marketing Specialist';
    const email    = d.email          || 'email@example.com';
    const phone    = d.phone          || '(000) 954-987-2679';
    const summary  = d.profileSummary || 'Add your professional summary here.';
    const linkedin = d.linkedin       || 'linkedin.com/in/yourname';
    const location = d.location       || 'City, State';

    const photoSize = d.photoSize || 90;
    const photoBorderRadius = d.photoShape === 'square' ? '6px' : '50%';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};object-fit:cover;cursor:pointer;border:3px solid #f59e0b;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};background:linear-gradient(135deg,#c9a87c,#a07845);display:flex;align-items:center;justify-content:center;font-size:2.5rem;cursor:pointer;border:3px solid #f59e0b;margin:0 auto;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillsHTML = skills.length
        ? skills.map(s=>`<div style="font-size:11px;color:rgba(255,255,255,0.8);margin-bottom:6px;">${s}
            <div style="display:flex;gap:4px;margin-top:3px;">
              <div style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></div>
              <div style="width:8px;height:8px;border-radius:50%;background:#f59e0b;opacity:0.7;"></div>
              <div style="width:8px;height:8px;border-radius:50%;background:#f59e0b;opacity:0.4;"></div>
              <div style="width:8px;height:8px;border-radius:50%;background:#f59e0b;opacity:0.2;"></div>
            </div></div>`).join('')
        : `<div style="font-size:11px;color:rgba(255,255,255,0.5);cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div style="font-size:11px;color:rgba(255,255,255,0.8);margin-bottom:10px;">
            <strong>${e.degree||''} ${e.field?'in '+e.field:''}</strong>
            <div style="color:rgba(255,255,255,0.5);">${e.university||''} ${e.year?'· '+e.year:''}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:rgba(255,255,255,0.5);cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e=>`<div style="margin-bottom:16px;">
            <div style="font-size:12px;font-weight:800;color:${accentLight};text-transform:uppercase;">${e.role||e.title||''}</div>
            <div style="font-size:11px;color:#888;margin-bottom:5px;">${e.company||''} | ${e.from||e.startDate||''} – ${e.to||e.endDate||'Present'}</div>
            <div style="font-size:11px;color:#555;line-height:1.7;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const langHTML = d.languages
        ? d.languages.split(',').map(l=>`<div style="font-size:11px;color:rgba(255,255,255,0.8);">${l.trim()}</div>`).join('')
        : '<div style="font-size:11px;color:rgba(255,255,255,0.5);">Tamil · English · Spanish</div>';

    return `<div style="display:flex;min-height:860px;font-family:'Segoe UI',sans-serif;">
  <div style="width:36%;background:${accent};padding:24px 16px;display:flex;flex-direction:column;">
    <div style="margin-bottom:14px;text-align:center;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
    <div style="font-size:13px;font-weight:900;color:#fff;text-align:center;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div style="font-size:11px;color:rgba(255,255,255,0.6);text-align:center;margin-bottom:18px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    <div style="font-size:12px;font-weight:800;color:#f59e0b;text-transform:uppercase;margin-bottom:10px;cursor:pointer;" class="editable-field" ${editBtn('educationJson','Education','')}>Education ✏</div>
    ${eduHTML}
    <div style="font-size:12px;font-weight:800;color:#f59e0b;text-transform:uppercase;margin:16px 0 10px;cursor:pointer;" class="editable-field" ${editBtn('skillsJson','Skills','')}>Skills ✏</div>
    ${skillsHTML}
    <div style="font-size:12px;font-weight:800;color:#f59e0b;text-transform:uppercase;margin:16px 0 8px;cursor:pointer;" class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>Languages ✏</div>
    ${langHTML}
    <div style="margin-top:16px;font-size:11px;color:rgba(255,255,255,0.6);">
      <div class="editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>📧 ${email} ✏</div>
      <div class="editable-field" style="cursor:pointer;margin-top:4px;" ${editBtn('phone','Phone',phone)}>📞 ${phone} ✏</div>
    </div>
  </div>
  <div style="flex:1;background:#fff;padding:24px 20px;">
    <div style="font-size:11px;color:#6b7280;text-align:right;margin-bottom:4px;">${phone}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
      <div>
        <div class="editable-field" style="font-size:22px;font-weight:900;color:#1a1a2e;cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name} <span class="edit-pen">✏</span</div>
        <div style="font-size:11px;color:#6b7280;">${title}</div>
      </div>
      <div style="background:#f59e0b;color:#fff;font-size:10px;font-weight:800;padding:5px 16px;border-radius:99px;">Pro</div>
    </div>
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:8px;">👤 ABOUT ME</div>
    <div style="font-size:11px;color:#555;line-height:1.7;margin-bottom:18px;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:12px;">🏢 PROFESSIONAL EXPERIENCE</div>
    <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;margin-top:16px;margin-bottom:8px;">⭐ QUALITIES</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;color:#555;">
      <span>● Adaptability</span><span>● Problem Solving</span><span>● Team Player</span><span>● Detail-Oriented</span>
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 23: JOHN-GREEN-SIDEBAR — Deep green left + white right
// Matching Image 5: green sidebar, icon sections, two-column
// ============================================================
function buildJohnGreenSidebarTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#1a4a2a';
    const name     = d.fullName       || 'JOHN SMITH';
    const title    = d.jobTitle       || 'Marketing Specialist';
    const email    = d.email          || 'email@example.com';
    const phone    = d.phone          || '(000) 954-987-2679';
    const summary  = d.profileSummary || 'Add your professional summary here.';
    const linkedin = d.linkedin       || 'linkedin.com/in/yourname';
    const location = d.location       || 'City, State';

    const photoSize = d.photoSize || 90;
    const photoBorderRadius = d.photoShape === 'square' ? '6px' : '50%';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};object-fit:cover;cursor:pointer;border:3px solid rgba(255,255,255,0.3);margin:0 auto;display:block;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};background:linear-gradient(135deg,#c9a87c,#a07845);display:flex;align-items:center;justify-content:center;font-size:2.5rem;cursor:pointer;border:3px solid rgba(255,255,255,0.3);margin:0 auto;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillsHTML = skills.length
        ? skills.map(s=>`<div style="font-size:11px;color:rgba(255,255,255,0.8);">● ${s}</div>`).join('')
        : `<div style="font-size:11px;color:rgba(255,255,255,0.5);cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;">
            <div style="width:9px;height:9px;border-radius:50%;background:#4ade80;flex-shrink:0;margin-top:2px;"></div>
            <div style="font-size:11px;color:rgba(255,255,255,0.85);">${e.degree||''} ${e.field?'in '+e.field:''}<br>
              <span style="color:rgba(255,255,255,0.5);">${e.university||''} ${e.year?'· '+e.year:''}</span>
            </div></div>`).join('')
        : `<div style="font-size:11px;color:rgba(255,255,255,0.5);cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e=>`<div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
              <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;">${e.role||e.title||''}</div>
              <div style="font-size:10px;color:${accent};font-weight:700;">${e.location||''}</div>
            </div>
            <div style="font-size:11px;color:#888;margin-bottom:5px;">${e.company||''} | ${e.from||e.startDate||''} – ${e.to||e.endDate||'Present'}</div>
            <div style="font-size:11px;color:#555;line-height:1.7;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const langHTML = d.languages
        ? d.languages.split(',').map(l=>`<div style="font-size:11px;color:rgba(255,255,255,0.8);">● ${l.trim()}</div>`).join('')
        : `<div style="font-size:11px;color:rgba(255,255,255,0.7);">● Tamil<br>● English<br>● French</div>`;

    const qualitiesHTML = d.qualities||'Adaptability, Problem Solving, Team Player, Detail-Oriented';

    return `<div style="display:flex;min-height:860px;font-family:'Segoe UI',sans-serif;">
  <div style="width:34%;background:${accent};padding:24px 16px;display:flex;flex-direction:column;">
    <div style="margin-bottom:12px;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
    <div style="font-size:13px;font-weight:900;color:#fff;text-align:center;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div style="font-size:10px;color:rgba(255,255,255,0.6);text-align:center;margin-bottom:6px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    <div style="font-size:9px;color:rgba(255,255,255,0.5);text-align:center;margin-bottom:16px;">${email}</div>
    <div style="font-size:12px;font-weight:800;color:#fff;text-transform:uppercase;margin-bottom:10px;cursor:pointer;" class="editable-field" ${editBtn('educationJson','Education','')}>Education ✏</div>
    ${eduHTML}
    <div style="font-size:12px;font-weight:800;color:#fff;text-transform:uppercase;margin:14px 0 8px;cursor:pointer;" class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>Languages ✏</div>
    ${langHTML}
    <div style="font-size:12px;font-weight:800;color:#fff;text-transform:uppercase;margin:14px 0 8px;cursor:pointer;" class="editable-field" ${editBtn('skillsJson','Skills','')}>Skills ✏</div>
    ${skillsHTML}
    <div style="font-size:12px;font-weight:800;color:#fff;text-transform:uppercase;margin:14px 0 8px;">Qualities</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.8);line-height:2;">
      ${qualitiesHTML.split(',').map(q=>`● ${q.trim()}`).join('<br>')}
    </div>
    <div style="margin-top:16px;font-size:10px;color:rgba(255,255,255,0.5);">
      <div class="editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>📧 ${email} ✏</div>
      <div class="editable-field" style="cursor:pointer;margin-top:3px;" ${editBtn('phone','Phone',phone)}>📞 ${phone} ✏</div>
      <div class="editable-field" style="cursor:pointer;margin-top:3px;" ${editBtn('linkedin','LinkedIn',linkedin)}>🔗 ${linkedin} ✏</div>
    </div>
  </div>
  <div style="flex:1;background:#fff;padding:24px 20px;">
    <div style="font-size:11px;color:#6b7280;text-align:right;margin-bottom:4px;">${phone}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
      <div>
        <div style="font-size:22px;font-weight:900;color:#1a1a2e;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
        <div style="font-size:11px;color:#6b7280;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      </div>
      <div style="background:#f59e0b;color:#fff;font-size:10px;font-weight:800;padding:5px 16px;border-radius:99px;">Pro</div>
    </div>
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:8px;display:flex;align-items:center;gap:6px;"><span>👤</span> ABOUT ME</div>
    <div style="font-size:11px;color:#555;line-height:1.7;margin-bottom:18px;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:12px;display:flex;align-items:center;gap:6px;"><span>🏢</span> PROFESSIONAL EXPERIENCE</div>
    <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 24: PRODUCT-MANAGER — Dark Wave Gold
// Dark background, yellow wave bottom, photo top-left
// ============================================================
function buildProductManagerTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#f59e0b';
    const name     = d.fullName       || 'JOHN SMITH';
    const title    = d.jobTitle       || 'Product Manager';
    const email    = d.email          || 'johnsmith@gmail.com';
    const phone    = d.phone          || '1234567890';
    const summary  = d.profileSummary || 'Results-driven Product Manager with experience in defining product vision, strategy, and roadmaps.';
    const linkedin = d.linkedin       || 'https://behance.net/johnsmith';
    const location = d.location       || '23/2 East street, Tenkasi';

    const photoSize = d.photoSize || 90;
    const photoBorderRadius = d.photoShape === 'square' ? '6px' : '50%';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};object-fit:cover;cursor:pointer;border:3px solid rgba(255,255,255,0.25);" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};background:linear-gradient(135deg,#c9a87c,#a07845);display:flex;align-items:center;justify-content:center;font-size:2.5rem;cursor:pointer;border:3px solid rgba(255,255,255,0.25);" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillsHTML = skills.length
        ? skills.map((s,i) => `<div style="margin-bottom:10px;">
            <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-bottom:4px;cursor:pointer;" class="editable-field" ${editBtn('skillsJson','Skills','')}>${s}</div>
            <div style="height:5px;background:rgba(255,255,255,0.15);border-radius:3px;">
              <div style="width:${85-i*10}%;height:100%;background:${accent};border-radius:3px;"></div>
            </div></div>`).join('')
        : `<div style="font-size:11px;color:rgba(255,255,255,0.4);cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div style="margin-bottom:16px;">
            <div style="display:flex;gap:20px;">
              <div style="width:30%;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.7;">${e.company||''}</div>
              <div style="flex:1;">
                <div style="font-size:11px;font-weight:700;color:${accent};margin-bottom:3px;">${e.role||e.title||''}</div>
                <div style="font-size:9px;color:rgba(255,255,255,0.5);margin-bottom:5px;">${e.from||e.startDate||''} – ${e.to||e.endDate||'Present'}</div>
                <div style="font-size:10px;color:rgba(255,255,255,0.7);line-height:1.6;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).join('<br>')}</div>
              </div>
            </div></div>`).join('')
        : `<div style="font-size:11px;color:rgba(255,255,255,0.4);cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    function sectionLabel(label) {
        return `<div style="font-size:13px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;border-bottom:1.5px solid rgba(255,255,255,0.15);padding-bottom:5px;">${label}</div>`;
    }

    return `<div style="min-height:860px;background:#1a1a2e;font-family:'Segoe UI',sans-serif;position:relative;overflow:hidden;">
  <div style="position:absolute;bottom:0;left:0;right:0;height:200px;background:${accent};clip-path:ellipse(120% 100% at 50% 100%);z-index:0;"></div>
  <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;background:${accent};border-radius:50%;opacity:0.1;z-index:0;"></div>
  <div style="position:relative;z-index:1;">
    <div style="padding:28px 28px 16px;display:flex;align-items:center;gap:16px;">
      <div class="editable-field" style="cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
      <div style="flex:1;">
        <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:1px;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
        <div style="font-size:12px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-top:4px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      </div>
      <div style="background:${accent};color:#1a1a2e;font-size:12px;font-weight:800;padding:6px 20px;border-radius:99px;">Pro</div>
    </div>
    <div style="padding:0 28px 16px;">
      ${sectionLabel('PROFILE')}
      <div style="font-size:10px;color:rgba(255,255,255,0.75);line-height:1.7;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
    </div>
    <div style="padding:0 28px 16px;">
      ${sectionLabel('EXPERIENCE')}
      <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
    </div>
    <div style="padding:0 28px 220px;">
      ${sectionLabel('SKILLS')}
      <div class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillsHTML}</div>
    </div>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;padding:18px 28px;z-index:2;">
    <div style="display:flex;flex-wrap:wrap;gap:14px;">
      <div style="font-size:10px;color:#1a1a2e;font-weight:600;cursor:pointer;" class="editable-field" ${editBtn('email','Email',email)}>📧 ${email} <span class="edit-pen">✏</span></div>
      <div style="font-size:10px;color:#1a1a2e;font-weight:600;cursor:pointer;" class="editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>
      <div style="font-size:10px;color:#1a1a2e;font-weight:600;cursor:pointer;" class="editable-field" ${editBtn('linkedin','LinkedIn',linkedin)}>🔗 ${linkedin} <span class="edit-pen">✏</span></div>
      <div style="font-size:10px;color:#1a1a2e;font-weight:600;cursor:pointer;" class="editable-field" ${editBtn('location','Location',location)}>📍 ${location} <span class="edit-pen">✏</span></div>
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 25: BOTANICA — Dark Botanical French CV
// Dark background, botanical decorations, left sidebar info
// ============================================================
function buildBotanicaTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#f59e0b';
    const name     = d.fullName       || 'Votre Nom';
    const title    = d.jobTitle       || 'Stagiaire / Professional';
    const email    = d.email          || 'email@gmail.com';
    const phone    = d.phone          || '+33 1 23 45 67 89';
    const summary  = d.profileSummary || 'Jeune travailleuse et ambitieuse capable de travailler en équipe. La confiance se mérite et passe par la satisfaction d\'un travail bien fait !';
    const linkedin = d.linkedin       || 'linkedin.com/in/yourname';
    const location = d.location       || 'Nice, FRANCE';

    const photoSize = d.photoSize || 90;
    const photoBorderRadius = d.photoShape === 'square' ? '6px' : '50%';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};object-fit:cover;cursor:pointer;border:3px solid ${accent};" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};background:linear-gradient(135deg,#c9a87c,#a07845);display:flex;align-items:center;justify-content:center;font-size:2.5rem;cursor:pointer;border:3px solid ${accent};" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div style="margin-bottom:18px;">
            <div style="font-size:12px;font-weight:800;color:${accent};margin-bottom:5px;">${e.company||''} — ${e.location||''}</div>
            <div style="font-size:11px;font-weight:700;color:#fff;margin-bottom:2px;">${e.role||e.title||''}</div>
            <div style="font-size:9px;color:rgba(255,255,255,0.5);margin-bottom:6px;">${e.from||e.startDate||''} – ${e.to||e.endDate||'Present'}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.75);line-height:1.7;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:rgba(255,255,255,0.4);cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const infoItem = (icon, label, value, field) =>
        `<div style="margin-bottom:14px;">
          <div style="font-size:10px;color:${accent};font-weight:700;margin-bottom:4px;">${icon} ${label}</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.7);cursor:pointer;" class="editable-field" ${editBtn(field,label,value)}>${value} <span class="edit-pen" style="font-size:9px;">✏</span></div>
        </div>`;

    return `<div style="min-height:860px;background:#1a1a1a;font-family:'Segoe UI',sans-serif;color:#fff;position:relative;overflow:hidden;">
  <div style="position:absolute;top:-10px;right:0;font-size:120px;opacity:0.06;pointer-events:none;user-select:none;">🌿</div>
  <div style="position:absolute;bottom:20px;left:-15px;font-size:100px;opacity:0.05;pointer-events:none;user-select:none;">🌱</div>
  <div style="position:relative;z-index:1;">
    <div style="padding:24px 24px 16px;display:flex;gap:16px;align-items:flex-start;">
      <div class="editable-field" style="flex-shrink:0;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
      <div style="flex:1;background:#262626;border-radius:10px;padding:14px 16px;">
        <div style="font-size:11px;color:rgba(255,255,255,0.75);line-height:1.7;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
      </div>
      <div style="background:${accent};color:#1a1a1a;font-size:11px;font-weight:800;padding:5px 16px;border-radius:99px;flex-shrink:0;">Pro</div>
    </div>
    <div style="display:flex;">
      <div style="width:34%;background:#222;padding:20px 16px;min-height:700px;">
        ${infoItem('📍','localisation',location,'location')}
        ${infoItem('📞','contact',phone,'phone')}
        ${infoItem('✉','email',email,'email')}
        <div style="margin-bottom:14px;">
          <div style="font-size:10px;color:${accent};font-weight:700;margin-bottom:4px;">🌐 langues</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.7);">${d.languages||'Français · Anglais'}</div>
        </div>
        <div style="margin-bottom:14px;">
          <div style="font-size:10px;color:${accent};font-weight:700;margin-bottom:4px;">🚗 automobile</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.7);">Permis B</div>
        </div>
        <div style="margin-bottom:14px;">
          <div style="font-size:10px;color:${accent};font-weight:700;margin-bottom:4px;">💻 informatique</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.7);">Office Suite</div>
        </div>
        <div>
          <div style="font-size:10px;color:${accent};font-weight:700;margin-bottom:4px;">🎵 loisirs</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.7);line-height:2;">Musique<br>Lecture<br>Randonnée</div>
        </div>
      </div>
      <div style="flex:1;padding:18px 20px;">
        <div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:4px;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen" style="font-size:14px;">✏</span></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:16px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
        <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
      </div>
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 26: SMITH-ORANGE — Orange accent with bottom skills bar
// Matching Image 3: orange top/bottom, circular photo, two-col middle
// ============================================================
function buildSmithOrangeTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#f97316';
    const name     = d.fullName       || 'SMITH';
    const title    = d.jobTitle       || 'Graphic Designer';
    const email    = d.email          || 'theresawebb@gmail.com';
    const phone    = d.phone          || '(000)954-987-2679';
    const summary  = d.profileSummary || 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    const linkedin = d.linkedin       || 'www.webb.com/mycv/';
    const location = d.location       || 'City, State';

    const photoSize = d.photoSize || 90;
    const photoBorderRadius = d.photoShape === 'square' ? '6px' : '50%';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};object-fit:cover;cursor:pointer;border:3px solid ${accent};" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};background:linear-gradient(135deg,#c9a87c,#a07845);display:flex;align-items:center;justify-content:center;font-size:2.5rem;cursor:pointer;border:3px solid ${accent};" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div style="margin-bottom:16px;">
            <div style="font-size:10px;color:#888;margin-bottom:3px;">${e.from||e.startDate||''} – ${e.to||e.endDate||'Present'}</div>
            <div style="font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:4px;">${(e.role||e.title||'').toUpperCase()}</div>
            <div style="font-size:10px;color:#555;line-height:1.6;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).join('<br>')}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div style="margin-bottom:12px;">
            <div style="font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:3px;">${(e.degree||'').toUpperCase()} ${e.field?'OF '+e.field.toUpperCase():''}</div>
            <div style="font-size:10px;color:#555;line-height:1.6;">${e.bullets||e.description||''}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const skillsList = skills.length
        ? skills.map(s=>`<div style="font-size:10px;color:rgba(255,255,255,0.9);">● ${s}</div>`).join('')
        : `<div style="font-size:10px;color:rgba(255,255,255,0.7);">● Digital Marketing &amp; SEO<br>● Project Management<br>● Data Analysis<br>● Content Creation</div>`;

    const langHTML = d.languages
        ? d.languages.split(',').map(l=>`<div style="font-size:10px;color:rgba(255,255,255,0.9);">● ${l.trim()}</div>`).join('')
        : `<div style="font-size:10px;color:rgba(255,255,255,0.9);">● Tamil<br>● English<br>● French</div>`;

    const qualitiesHTML = (d.qualities||'Adaptability,Problem Solving,Team Player,Detail-Oriented')
        .split(',').map(q=>`<div style="font-size:10px;color:rgba(255,255,255,0.9);">● ${q.trim()}</div>`).join('');

    return `<div style="min-height:860px;background:#fff;font-family:'Segoe UI',sans-serif;position:relative;overflow:hidden;">
  <div style="height:6px;background:${accent};"></div>
  <div style="display:flex;align-items:center;gap:20px;padding:20px 28px 16px;border-bottom:1px solid #f0f0f0;">
    <div class="editable-field" style="flex-shrink:0;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
    <div style="flex:1;">
      <div style="font-size:24px;font-weight:900;color:#1a1a2e;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:6px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;font-size:10px;color:#888;">
        <span class="editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} ✏</span>
        <span class="editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} ✏</span>
        <span class="editable-field" style="cursor:pointer;" ${editBtn('linkedin','LinkedIn',linkedin)}>🌐 ${linkedin} ✏</span>
      </div>
    </div>
    <div style="text-align:right;min-width:180px;">
      <div style="background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:5px 18px;border-radius:99px;display:inline-block;margin-bottom:8px;">Pro</div>
      <div style="font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:5px;">About me</div>
      <div style="font-size:10px;color:#555;line-height:1.6;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
    </div>
  </div>
  <div style="display:flex;padding:18px 28px 180px;gap:24px;">
    <div style="flex:1;border-right:1px solid #f0f0f0;padding-right:20px;">
      <div style="font-size:14px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px;">🏢 JOB EXPERIENCE</div>
      <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
    </div>
    <div style="flex:1;">
      <div style="font-size:14px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px;">🎓 EDUCATION</div>
      <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
    </div>
  </div>
  <div style="background:${accent};padding:20px 28px;position:absolute;bottom:0;left:0;right:0;">
    <div style="display:flex;gap:24px;">
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:8px;">SKILLS</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillsList} <span class="edit-pen" style="font-size:10px;color:rgba(255,255,255,0.6);">✏</span></div>
      </div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:8px;">LANGUAGE</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('languages','Languages',d.languages||'')}>${langHTML} <span class="edit-pen" style="font-size:10px;color:rgba(255,255,255,0.6);">✏</span></div>
      </div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:8px;">QUALITIES</div>
        ${qualitiesHTML}
      </div>
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 27: BRIAN — Teal Header Web Designer
// Matching Image 4: teal top, dot-icons, two-column, skills bullets
// ============================================================
function buildBrianTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#0891b2';
    const name     = d.fullName       || 'Brian R';
    const title    = d.jobTitle       || 'Graphics & Web Designer';
    const email    = d.email          || 'brianr@gmail.com';
    const phone    = d.phone          || '1234567890';
    const summary  = d.profileSummary || 'Creative and detail-oriented Graphics & Web Designer with experience in designing visually appealing graphics and user-friendly websites.';
    const linkedin = d.linkedin       || 'linkedin.com/in/brianr';
    const location = d.location       || '23/2 East street, Tenkasi';

    const photoSize = d.photoSize || 90;
    const photoBorderRadius = d.photoShape === 'square' ? '6px' : '50%';
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};object-fit:cover;cursor:pointer;border:3px solid rgba(255,255,255,0.3);" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBorderRadius};background:linear-gradient(135deg,#c9a87c,#a07845);display:flex;align-items:center;justify-content:center;font-size:2.5rem;cursor:pointer;border:3px solid rgba(255,255,255,0.3);" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    function sectionHead(label) {
        return `<div style="font-size:13px;font-weight:800;color:${accent};margin-bottom:10px;display:flex;align-items:center;gap:8px;">
          <span style="width:14px;height:14px;background:${accent};border-radius:50%;display:inline-block;flex-shrink:0;"></span>${label}</div>`;
    }

    const skillsHTML = skills.length
        ? skills.map(s=>`<div style="display:flex;gap:8px;align-items:center;margin-bottom:7px;">
            <div style="width:7px;height:7px;border-radius:50%;background:${accent};flex-shrink:0;"></div>
            <span style="font-size:10px;color:#555;">${s}</span></div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div style="margin-bottom:16px;">
            <div style="font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:2px;">${e.role||e.title||''}</div>
            <div style="font-size:10px;color:${accent};font-weight:600;margin-bottom:4px;">${e.company||''} | ${e.from||e.startDate||''} – ${e.to||e.endDate||'Present'}</div>
            <div style="font-size:10px;color:#555;line-height:1.7;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).join('<br>')}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div style="margin-bottom:10px;">
            <div style="font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:2px;">${e.degree||''} ${e.field?'in '+e.field:''}</div>
            <div style="font-size:10px;color:#555;">${e.university||''} | ${e.year||''}</div>
          </div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    return `<div style="min-height:860px;background:#fff;font-family:'Segoe UI',sans-serif;">
  <div style="background:linear-gradient(135deg,${accent},#0e7490);padding:24px 28px;display:flex;align-items:center;gap:20px;">
    <div class="editable-field" style="flex-shrink:0;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
    <div style="flex:1;">
      <div style="font-size:24px;font-weight:900;color:#fff;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:3px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    </div>
    <div style="background:#f59e0b;color:#fff;font-size:12px;font-weight:800;padding:6px 20px;border-radius:99px;">Pro</div>
  </div>
  <div style="display:flex;min-height:660px;">
    <div style="width:40%;padding:20px 18px;border-right:1px solid #f0f0f0;">
      <div style="margin-bottom:18px;position:relative;">
        <div style="font-size:13px;font-weight:800;color:${accent};margin-bottom:10px;display:flex;align-items:center;gap:8px;"><span style="width:14px;height:14px;background:${accent};border-radius:50%;display:inline-block;flex-shrink:0;"></span>ABOUT ME</div>
        <div style="font-size:10px;color:#555;line-height:1.7;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
      </div>
      <div style="margin-bottom:18px;position:relative;">
        <div style="font-size:13px;font-weight:800;color:${accent};margin-bottom:10px;display:flex;align-items:center;gap:8px;"><span style="width:14px;height:14px;background:${accent};border-radius:50%;display:inline-block;flex-shrink:0;"></span>CONTACT ME</div>
        <div style="font-size:10px;color:#555;line-height:2;">
          <div class="editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('location','Location',location)}>📍 ${location} <span class="edit-pen">✏</span></div>
        </div>
      </div>
      <div style="margin-bottom:18px;position:relative;">
        <div style="font-size:13px;font-weight:800;color:${accent};margin-bottom:10px;display:flex;align-items:center;gap:8px;"><span style="width:14px;height:14px;background:${accent};border-radius:50%;display:inline-block;flex-shrink:0;"></span>Education</div>
        <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
      </div>
      <div style="position:relative;">
        <div style="font-size:13px;font-weight:800;color:${accent};margin-bottom:10px;display:flex;align-items:center;gap:8px;"><span style="width:14px;height:14px;background:${accent};border-radius:50%;display:inline-block;flex-shrink:0;"></span>Skills</div>
        <div class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillsHTML}</div>
      </div>
    </div>
    <div style="flex:1;padding:20px 20px;">
      <div style="position:relative;">
        <div style="font-size:13px;font-weight:800;color:${accent};margin-bottom:10px;display:flex;align-items:center;gap:8px;"><span style="width:14px;height:14px;background:${accent};border-radius:50%;display:inline-block;flex-shrink:0;"></span>Job Experience</div>
        <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
      </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 28: DARK-PRO — Full Dark Professional
// Matching Image 5: dark bg, photo left, skills grid, software icons
// ============================================================
function buildDarkProTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#f59e0b';
    const name     = d.fullName       || 'Professional';
    const title    = d.jobTitle       || 'Product Designer';
    const email    = d.email          || 'email@example.com';
    const phone    = d.phone          || 'Phone Number';
    const summary  = d.profileSummary || 'Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.';
    const linkedin = d.linkedin       || 'linkedin.com/in/yourname';
    const location = d.location       || 'City, State';

    const photoSize = d.photoSize || 220;
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100%;height:260px;object-fit:cover;object-position:${d.photoPosition||'top'};cursor:pointer;display:block;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:100%;height:260px;background:linear-gradient(135deg,#c9a87c,#a07845);display:flex;align-items:center;justify-content:center;font-size:4rem;cursor:pointer;opacity:0.8;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillsHTML = skills.length
        ? skills.map(s=>`<span style="font-size:10px;color:rgba(255,255,255,0.75);">● ${s}</span>`).join(' ')
        : `<span style="font-size:10px;color:rgba(255,255,255,0.5);cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</span>`;

    const expHTML = experience.length
        ? experience.map(e=>`<div style="margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);margin-bottom:2px;">${e.company||''}</div>
            <div style="font-size:9px;color:rgba(255,255,255,0.35);font-style:italic;margin-bottom:5px;">${e.role||e.title||''}</div>
            <div style="font-size:9px;color:rgba(255,255,255,0.55);line-height:1.6;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
          </div>`).join('')
        : `<div style="font-size:10px;color:rgba(255,255,255,0.35);cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add work experience ✏</div>`;

    const certsHTML = projects.length
        ? projects.map(p=>`<div style="font-size:9px;color:rgba(255,255,255,0.55);line-height:1.7;">• ${p.title||p.name||''}</div>`).join('')
        : `<div style="font-size:9px;color:rgba(255,255,255,0.35);">• eu finibus velit vestibulum id. Integer viverra odio non nunc fermentum ultrices</div>`;

    const langHTML = d.languages
        ? d.languages.split(',').map(l=>`<div style="font-size:10px;color:rgba(255,255,255,0.65);">• ${l.trim()}</div>`).join('')
        : `<div style="font-size:10px;color:rgba(255,255,255,0.65);">• Language 1<br>• Language 2<br>• Language 3</div>`;

    const softwareIcons = [
        {label:'Illustrator',color:'#f97316',abbr:'Ai'},
        {label:'Powerpoint',color:'#3b82f6',abbr:'Pp'},
        {label:'Photoshop',color:'#a855f7',abbr:'Ps'},
        {label:'Figma',color:'#ec4899',abbr:'Fg'},
        {label:'Adobe XD',color:'#374151',abbr:'UX'},
    ].map(s=>`<div style="text-align:center;">
        <div style="width:38px;height:38px;background:${s.color};border-radius:8px;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;">${s.abbr}</div>
        <div style="font-size:8px;color:rgba(255,255,255,0.45);">${s.label}</div>
      </div>`).join('');

    return `<div style="min-height:860px;background:#111;font-family:'Segoe UI',sans-serif;color:#fff;display:flex;">
  <div style="width:34%;background:linear-gradient(180deg,#1e1e1e,#111);display:flex;flex-direction:column;align-items:center;padding:24px 18px;position:relative;">
    <div style="width:100%;border-radius:8px;overflow:hidden;margin-bottom:18px;border:1px solid #2a2a2a;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
    <div style="background:${accent};width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:12px;">🔖</div>
  </div>
  <div style="flex:1;padding:24px 22px;overflow:auto;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
      <div>
        <div style="font-size:28px;font-weight:900;color:#fff;line-height:1.1;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen" style="font-size:16px;">✏</span></div>
        <div style="font-size:10px;color:rgba(255,255,255,0.45);margin-top:5px;line-height:1.6;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
      </div>
      <div style="background:${accent};color:#1a1a1a;font-size:11px;font-weight:800;padding:5px 16px;border-radius:99px;flex-shrink:0;margin-left:12px;">Pro</div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:14px;">
      <div style="flex:1;background:#1e1e1e;border:1px solid #2a2a2a;border-radius:6px;padding:10px 14px;">
        <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-bottom:4px;">Name</div>
        <div style="font-size:11px;color:#fff;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      </div>
      <div style="flex:1;background:#1e1e1e;border:1px solid #2a2a2a;border-radius:6px;padding:10px 14px;">
        <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-bottom:4px;">Phone Number</div>
        <div style="font-size:11px;color:#fff;cursor:pointer;" class="editable-field" ${editBtn('phone','Phone',phone)}>${phone} <span class="edit-pen">✏</span></div>
      </div>
    </div>
    <div style="margin-bottom:14px;">
      <div style="font-size:13px;font-weight:800;color:${accent};margin-bottom:8px;cursor:pointer;" class="editable-field" ${editBtn('skillsJson','Skills','')}>Skills ✏</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">${skillsHTML}</div>
    </div>
    <div style="display:flex;gap:10px;margin-bottom:12px;">
      <div style="flex:1;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:14px;">
        <div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:12px;">Software Proficiencies</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">${softwareIcons}</div>
      </div>
      <div style="flex:1;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:14px;">
        <div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:10px;">Work</div>
        <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
      </div>
    </div>
    <div style="display:flex;gap:10px;">
      <div style="flex:1;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:12px;">
        <div style="font-size:11px;font-weight:700;color:#fff;margin-bottom:8px;">Certificates and training</div>
        <div class="editable-field" ${editBtn('projectsJson','Projects/Certificates','')}>${certsHTML}</div>
      </div>
      <div style="flex:0.6;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:12px;">
        <div style="font-size:11px;font-weight:700;color:#fff;margin-bottom:8px;">Languages</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('languages','Languages',d.languages||'')}>${langHTML} <span class="edit-pen" style="font-size:9px;color:rgba(255,255,255,0.4);">✏</span></div>
      </div>
    </div>
  </div>
</div>`;
}
// ============================================================
// TEMPLATE 29: RUDOLF — Dark Neon Purple (Creative Marketing)
// ============================================================
function buildRudolfTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#a855f7';
    const name    = d.fullName       || 'Rudolf Nordikus';
    const title   = d.jobTitle       || 'Creative Marketing Professional';
    const email   = d.email          || 'info@nordika.agency';
    const phone   = d.phone          || '+1 (234)567-789';
    const summary = d.profileSummary || 'Creative marketing & design professional with extensive industry experience. Passionate about creating brands with exceptional human experience.';
    const location= d.location       || 'City, State';
    const linkedin= d.linkedin       || 'LinkedIn';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid ${accent};display:block;margin:0 auto 12px;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,#c9a87c,#a07845);margin:0 auto 12px;border:3px solid ${accent};display:flex;align-items:center;justify-content:center;font-size:2rem;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillsHTML = skills.length
        ? skills.map(s=>`<div style="background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.4);color:#d8b4fe;font-size:10px;padding:4px 10px;border-radius:4px;cursor:pointer;" class="editable-field" ${editBtn('skillsJson','Skills','')}>${s} <span class="edit-pen">✏</span></div>`).join('')
        : `<div style="font-size:10px;color:rgba(255,255,255,0.4);cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e=>`<div style="margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
              <div style="font-size:11px;font-weight:800;color:${accent};">${e.company||'Company'}</div>
              <div style="font-size:8px;color:rgba(255,255,255,0.4);">${e.startDate||''} – ${e.endDate||'Present'}</div>
            </div>
            <div style="font-size:9px;color:rgba(255,255,255,0.6);line-height:1.7;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
          </div>`).join('')
        : `<div style="font-size:10px;color:rgba(255,255,255,0.4);cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add work experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div style="margin-bottom:10px;">
            <div style="font-size:10px;font-weight:700;color:#d8b4fe;">${e.degree||'Degree'}</div>
            <div style="font-size:9px;color:rgba(255,255,255,0.55);">${e.school||'School'}</div>
          </div>`).join('')
        : `<div style="font-size:10px;color:rgba(255,255,255,0.4);cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const projHTML = projects.length
        ? projects.map(p=>`<div style="font-size:9px;color:rgba(255,255,255,0.65);line-height:2;">${p.title||p.name||''} — ${p.year||''}</div>`).join('')
        : `<div style="font-size:9px;color:rgba(255,255,255,0.4);">Add projects ✏</div>`;

    return `<div style="display:flex;min-height:860px;background:#1a0a2e;font-family:'Segoe UI',sans-serif;color:#fff;position:relative;">
  <div style="position:absolute;left:200px;top:0;bottom:0;width:4px;background:linear-gradient(180deg,${accent},#7c3aed,#4f46e5);z-index:0;"></div>
  <div style="width:38%;padding:28px 20px;position:relative;z-index:1;">
    <div class="editable-field" style="cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
    <div style="font-size:16px;font-weight:900;color:#fff;text-align:center;margin-bottom:3px;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div style="font-size:10px;color:rgba(255,255,255,0.5);text-align:center;margin-bottom:6px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    <div style="background:#f59e0b;color:#fff;font-size:10px;font-weight:800;padding:4px 14px;border-radius:99px;width:fit-content;margin:0 auto 16px;">Pro</div>
    <div style="font-size:9px;color:rgba(255,255,255,0.45);margin-bottom:14px;">Date of birth: ${d.dob||'DD.MM.YYYY'}<br>Gender: ${d.gender||'—'}</div>
    <div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:8px;">Languages</div>
    <div style="font-size:9px;color:rgba(255,255,255,0.7);line-height:2;margin-bottom:14px;cursor:pointer;" class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${(d.languages||'Add languages').split(',').map(l=>`${l.trim()}`).join('<br>')} <span class="edit-pen">✏</span></div>
    <div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:8px;">Social / Contact</div>
    <div style="font-size:9px;color:rgba(255,255,255,0.65);line-height:2;cursor:pointer;" class="editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>
    <div style="font-size:9px;color:rgba(255,255,255,0.65);cursor:pointer;" class="editable-field" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>
    <div style="font-size:9px;color:rgba(255,255,255,0.65);margin-top:3px;cursor:pointer;" class="editable-field" ${editBtn('linkedin','LinkedIn',linkedin)}>in ${linkedin} <span class="edit-pen">✏</span></div>
  </div>
  <div style="flex:1;padding:28px 24px;position:relative;z-index:1;">
    <div style="font-size:14px;font-weight:900;color:#fff;text-transform:uppercase;border-bottom:2px solid rgba(168,85,247,0.4);padding-bottom:6px;margin-bottom:12px;">Profile</div>
    <div style="font-size:9px;color:rgba(255,255,255,0.65);line-height:1.7;margin-bottom:18px;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
    <div style="font-size:14px;font-weight:900;color:#fff;text-transform:uppercase;border-bottom:2px solid rgba(168,85,247,0.4);padding-bottom:6px;margin-bottom:12px;">Skills</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px;">${skillsHTML}</div>
    <div style="font-size:14px;font-weight:900;color:#fff;text-transform:uppercase;border-bottom:2px solid rgba(168,85,247,0.4);padding-bottom:6px;margin-bottom:12px;">Experience</div>
    <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
    <div style="font-size:14px;font-weight:900;color:#fff;text-transform:uppercase;border-bottom:2px solid rgba(168,85,247,0.4);padding-bottom:6px;margin:16px 0 12px;">Education</div>
    <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
    <div style="font-size:14px;font-weight:900;color:#fff;text-transform:uppercase;border-bottom:2px solid rgba(168,85,247,0.4);padding-bottom:6px;margin:16px 0 12px;">Projects</div>
    <div class="editable-field" ${editBtn('projectsJson','Projects','')}>${projHTML}</div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 30: EMILY — Parchment Elegant (Two Panel + Photo)
// ============================================================
function buildEmilyTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#7c3aed';
    const name    = d.fullName       || 'Emily Johnson';
    const title   = d.jobTitle       || 'Creative Designer';
    const email   = d.email          || 'emily@gmail.com';
    const phone   = d.phone          || '1234567890';
    const summary = d.profileSummary || 'Creative professional with a passion for impactful design and visual storytelling.';
    const location= d.location       || 'City, State';
    const linkedin= d.linkedin       || 'linkedin';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100%;height:200px;object-fit:cover;object-position:${d.photoPosition||'top'};display:block;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:100%;height:200px;background:linear-gradient(135deg,#c9a87c,#a07845);display:flex;align-items:center;justify-content:center;font-size:4rem;cursor:pointer;opacity:0.8;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const skillsHTML = skills.length
        ? skills.map(s=>`<div style="font-size:9px;color:#444;margin-bottom:2px;">● ${s}</div>`).join('')
        : `<div style="font-size:9px;color:#888;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e=>`<div style="margin-bottom:10px;">
            <div style="font-size:10px;font-weight:700;color:#1a1a2e;">${e.company||'Company'}</div>
            <div style="height:2px;background:#d1d5db;border-radius:1px;margin:2px 0;"></div>
            <div style="height:2px;background:#d1d5db;border-radius:1px;margin:2px 0;width:75%;"></div>
          </div>`).join('')
        : `<div style="font-size:9px;color:#888;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div style="margin-bottom:10px;">
            <div style="font-size:10px;font-weight:700;color:#1a1a2e;">${e.degree||'Degree'}</div>
            <div style="font-size:9px;color:#888;">${e.school||'School'} · ${e.year||''}</div>
          </div>`).join('')
        : `<div style="font-size:9px;color:#888;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const expertiseHTML = skills.length > 3
        ? skills.slice(3).map(s=>`<div style="font-size:9px;color:#555;margin-bottom:2px;">● ${s}</div>`).join('')
        : `<div style="font-size:9px;color:#888;">● Design Thinking<br>● Brand Strategy</div>`;

    const langHTML = d.languages
        ? d.languages.split(',').map(l=>`<div style="font-size:9px;color:#555;margin-bottom:2px;">● ${l.trim()}</div>`).join('')
        : `<div style="font-size:9px;color:#888;cursor:pointer;" ${editBtn('languages','Languages',d.languages||'')}>Add languages ✏</div>`;

    const certsHTML = projects.length
        ? projects.map(p=>`<div style="font-size:9px;color:#555;line-height:1.8;">● ${p.title||p.name||''}</div>`).join('')
        : `<div style="font-size:9px;color:#888;">● Add certifications here</div>`;

    return `<div style="display:flex;min-height:860px;font-family:'Segoe UI',sans-serif;">
  <div style="width:40%;background:#e8e0d0;">
    <div class="editable-field" style="cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
    <div style="padding:18px 16px;">
      <div style="font-size:20px;font-weight:900;color:#1a1a2e;margin-bottom:2px;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      <div style="font-size:10px;color:#6b7280;margin-bottom:12px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      <div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:6px;">Skills</div>
      <div class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillsHTML}</div>
      <div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;margin:12px 0 6px;">Work</div>
      <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
    </div>
  </div>
  <div style="flex:1;background:#fff;padding:26px 22px;">
    <div style="background:#f59e0b;color:#fff;font-size:10px;font-weight:800;padding:4px 14px;border-radius:99px;width:fit-content;margin-bottom:14px;">Pro</div>
    <div style="font-size:9px;color:#888;margin-bottom:3px;cursor:pointer;" class="editable-field" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>
    <div style="font-size:9px;color:#888;margin-bottom:3px;cursor:pointer;" class="editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>
    <div style="font-size:9px;color:#888;margin-bottom:14px;cursor:pointer;" class="editable-field" ${editBtn('linkedin','LinkedIn',linkedin)}>🔗 ${linkedin} <span class="edit-pen">✏</span></div>
    <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-bottom:1px solid #e5e7eb;padding-bottom:3px;margin-bottom:8px;">Education</div>
    <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
    <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-bottom:1px solid #e5e7eb;padding-bottom:3px;margin:12px 0 8px;">Expertise</div>
    <div>${expertiseHTML}</div>
    <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-bottom:1px solid #e5e7eb;padding-bottom:3px;margin:12px 0 8px;">Languages</div>
    <div class="editable-field" style="cursor:pointer;" ${editBtn('languages','Languages',d.languages||'')}>${langHTML} <span class="edit-pen" style="font-size:9px;">✏</span></div>
    <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-bottom:1px solid #e5e7eb;padding-bottom:3px;margin:12px 0 8px;">Certifications &amp; Training</div>
    <div class="editable-field" ${editBtn('projectsJson','Projects/Certs','')}>${certsHTML}</div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 31: KELLY — Orange & Black Bold (Art Director)
// ============================================================
function buildKellyTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#f59e0b';
    const name    = d.fullName       || 'Kelly White';
    const title   = d.jobTitle       || 'Art Director';
    const email   = d.email          || 'kelly@email.com';
    const phone   = d.phone          || '9876897678';
    const summary = d.profileSummary || 'Creative and visionary Art Director with a strong background in visual storytelling, branding, and design strategy.';
    const location= d.location       || 'Chennai, Tamil Nadu, India';
    const website = d.linkedin       || 'behance.net';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid ${accent};display:block;margin-bottom:14px;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div style="width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,#c9a87c,#a07845);margin-bottom:14px;border:3px solid ${accent};display:flex;align-items:center;justify-content:center;font-size:2.5rem;cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>👤</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
            <div style="width:10px;height:10px;background:${accent};flex-shrink:0;margin-top:3px;"></div>
            <div>
              <div style="font-size:10px;font-weight:700;color:#1a1a1a;">${e.startYear||''}–${e.endYear||e.year||''} — ${e.degree||'Degree'}</div>
              <div style="font-size:9px;color:#888;">${e.school||'School'} ${e.gpa?'· CGPA: '+e.gpa:''}</div>
            </div>
          </div>`).join('')
        : `<div style="font-size:9px;color:#888;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e=>`<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;">
            <div style="width:10px;height:10px;background:${accent};flex-shrink:0;margin-top:3px;"></div>
            <div>
              <div style="font-size:10px;font-weight:700;color:#1a1a1a;">${e.startDate||''}–${e.endDate||'Present'} — ${e.role||e.title||'Role'}</div>
              <div style="font-size:9px;color:${accent};font-weight:600;margin-bottom:3px;">${e.company||'Company'}</div>
              <div style="font-size:9px;color:#555;line-height:1.7;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`${b}`).join('<br>')}</div>
            </div>
          </div>`).join('')
        : `<div style="font-size:9px;color:#888;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const skillsHTML = skills.length
        ? skills.map((s,i)=>`<div style="margin-bottom:10px;">
            <div style="font-size:9px;color:rgba(255,255,255,0.8);margin-bottom:3px;">${s}</div>
            <div style="height:6px;background:${accent};border-radius:3px;width:${85-i*8>40?85-i*8:40}%;"></div>
          </div>`).join('')
        : `<div style="font-size:9px;color:rgba(255,255,255,0.5);cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    return `<div style="display:flex;min-height:860px;font-family:'Segoe UI',sans-serif;">
  <div style="width:52%;padding:30px 24px;">
    <div class="editable-field" style="cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
    <div style="font-size:22px;font-weight:900;color:#1a1a1a;text-transform:uppercase;line-height:1.2;margin-bottom:4px;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div style="font-size:11px;color:#666;margin-bottom:16px;text-transform:uppercase;letter-spacing:1px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    <div style="font-size:13px;font-weight:800;color:#1a1a1a;text-transform:uppercase;background:${accent};padding:4px 8px;margin-bottom:10px;">ABOUT ME</div>
    <div style="font-size:9px;color:#555;line-height:1.7;margin-bottom:18px;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
    <div style="font-size:13px;font-weight:800;color:#1a1a1a;text-transform:uppercase;background:${accent};padding:4px 8px;margin-bottom:12px;">EDUCATION</div>
    <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
    <div style="font-size:13px;font-weight:800;color:#1a1a1a;text-transform:uppercase;background:${accent};padding:4px 8px;margin:16px 0 12px;">EXPERIENCE</div>
    <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
  </div>
  <div style="width:48%;background:#1a1a1a;padding:28px 20px;color:#fff;">
    <div style="background:${accent};color:#fff;font-size:10px;font-weight:800;padding:4px 16px;border-radius:99px;width:fit-content;margin-bottom:18px;">Pro</div>
    <div style="font-size:13px;font-weight:800;text-transform:uppercase;text-align:center;background:${accent};color:#1a1a1a;padding:6px;margin-bottom:12px;">CONTACT ME</div>
    <div style="font-size:9px;color:rgba(255,255,255,0.7);margin-bottom:5px;cursor:pointer;" class="editable-field" ${editBtn('location','Location',location)}>📍 ${location} <span class="edit-pen">✏</span></div>
    <div style="font-size:9px;color:rgba(255,255,255,0.7);margin-bottom:5px;cursor:pointer;" class="editable-field" ${editBtn('linkedin','Website/LinkedIn',website)}>🌐 ${website} <span class="edit-pen">✏</span></div>
    <div style="font-size:9px;color:rgba(255,255,255,0.7);margin-bottom:18px;cursor:pointer;" class="editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>
    <div style="font-size:13px;font-weight:800;text-transform:uppercase;text-align:center;background:${accent};color:#1a1a1a;padding:6px;margin-bottom:12px;">PRO SKILLS</div>
    <div class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillsHTML}</div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 32: SUHAIL — Colorful Geometric (UI UX Designer)
// ============================================================
function buildSuhailTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#f97316';
    const name    = d.fullName       || 'Mohd Suhail';
    const title   = d.jobTitle       || 'UI UX Designer & Developer';
    const email   = d.email          || 'example@gmail.com';
    const phone   = d.phone          || '+91 93270 56789';
    const summary = d.profileSummary || 'A highly responsible and versatile person, pursuing UI UX design related roles.';
    const location= d.location       || 'New Delhi - 110026';
    const hobbies = d.hobbies        || 'Cooking, Travelling, Karaoke, Swimming, Reading';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid ${accent};display:block;margin-bottom:8px;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : '';

    const skillsHTML = skills.length
        ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;color:#555;line-height:1.8;">${skills.map(s=>`<span>● ${s}</span>`).join('')}</div>`
        : `<div style="font-size:9px;color:#888;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e=>`<div style="margin-bottom:10px;">
            <div style="font-size:10px;font-weight:700;color:#1a1a2e;">${e.role||e.title||'Role'} (${e.startDate||''}–${e.endDate||'Present'})</div>
            <div style="font-size:9px;color:#888;margin-bottom:3px;">${e.company||'Company'}</div>
            <div style="height:2px;background:#f0f0f0;border-radius:1px;"></div>
          </div>`).join('')
        : `<div style="font-size:9px;color:#888;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div style="margin-bottom:10px;">
            <div style="font-size:10px;font-weight:700;color:${accent};">${e.degree||'Degree'} / ${e.year||''}</div>
            <div style="font-size:9px;color:#888;">${e.school||'School'}</div>
          </div>`).join('')
        : `<div style="font-size:9px;color:#888;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const hobbyEmojis = ['🍳','✈️','🎤','🏊','📚','🎨','🎮','🎵'];
    const hobbyList = hobbies.split(',').map((h,i)=>`<div style="text-align:center;">
        <div style="width:36px;height:36px;background:#f0f4f8;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;">${hobbyEmojis[i%hobbyEmojis.length]}</div>
        <div style="font-size:8px;color:#888;margin-top:2px;">${h.trim()}</div>
      </div>`).join('');

    return `<div style="min-height:860px;background:#fff;font-family:'Segoe UI',sans-serif;padding:28px;position:relative;overflow:hidden;">
  <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:${accent};opacity:0.6;transform:rotate(45deg);border-radius:4px;"></div>
  <div style="position:absolute;top:60px;right:30px;width:50px;height:50px;background:#10b981;opacity:0.5;transform:rotate(30deg);"></div>
  <div style="position:absolute;bottom:40px;left:50%;width:60px;height:60px;background:#3b82f6;opacity:0.4;transform:rotate(15deg);"></div>
  <div style="position:relative;z-index:1;">
    <div style="display:flex;align-items:flex-start;gap:20px;margin-bottom:20px;border-bottom:2px solid ${accent};padding-bottom:14px;">
      ${photoHTML}
      <div style="flex:1;">
        <div style="font-size:26px;font-weight:900;color:${accent};line-height:1.2;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen" style="font-size:16px;">✏</span></div>
        <div style="font-size:11px;color:#555;margin-top:4px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
        <div style="width:50px;height:4px;background:${accent};border-radius:2px;margin-top:6px;"></div>
      </div>
      <div style="background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:6px 18px;border-radius:99px;">Pro</div>
    </div>
    <div style="display:flex;gap:24px;">
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:800;color:#1a1a2e;margin-bottom:6px;">About Me</div>
        <div style="font-size:9px;color:#555;line-height:1.7;margin-bottom:14px;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
        <div style="font-size:12px;font-weight:800;color:#1a1a2e;margin-bottom:6px;">Contact</div>
        <div style="font-size:9px;color:#555;line-height:2;margin-bottom:14px;">
          <div class="editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('location','Location',location)}>📍 ${location} <span class="edit-pen">✏</span></div>
        </div>
        <div style="font-size:12px;font-weight:800;color:#1a1a2e;margin-bottom:8px;">Hobbies</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">${hobbyList}</div>
        <div style="font-size:12px;font-weight:800;color:#1a1a2e;margin-bottom:8px;">Skills</div>
        <div class="editable-field" ${editBtn('skillsJson','Skills','')}>${skillsHTML}</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:800;color:#1a1a2e;margin-bottom:8px;">Academia</div>
        <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
        <div style="font-size:12px;font-weight:800;color:#1a1a2e;margin:14px 0 8px;">Work Experience</div>
        <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
      </div>
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 33: RICKTANG — Clean White Blob (Product Designer)
// ============================================================
function buildRickTangTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#1e3a5f';
    const name    = d.fullName       || 'Rick Tang';
    const title   = d.jobTitle       || 'Product Designer';
    const email   = d.email          || 'ricktang@gmail.com';
    const phone   = d.phone          || '(315) 802-8179';
    const summary = d.profileSummary || 'UX/UI specialist focused on designing clean and functional projects across all platforms and devices.';
    const location= d.location       || 'San Francisco, California';
    const linkedin= d.linkedin       || 'LinkedIn';

    const expHTML = experience.length
        ? experience.map(e=>`<div style="margin-bottom:14px;">
            <div style="font-size:11px;font-weight:800;color:#1a1a2e;">${e.company||'Company'} — ${e.role||e.title||'Role'}</div>
            <div style="font-size:9px;color:#888;margin-bottom:5px;">${e.startDate||''} – ${e.endDate||'Present'}</div>
            <div style="font-size:9px;color:#555;line-height:1.7;">${(e.bullets||e.description||'').toString().split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
          </div>`).join('')
        : `<div style="font-size:9px;color:#888;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e=>`<div style="margin-bottom:8px;">
            <div style="font-size:11px;font-weight:700;color:#1a1a2e;">${e.school||'School'}</div>
            <div style="font-size:9px;color:#888;">${e.degree||'Degree'}, ${e.startYear||''} – ${e.year||''}</div>
          </div>`).join('')
        : `<div style="font-size:9px;color:#888;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const skillsHTML = skills.length
        ? skills.map(s=>`<div style="font-size:9px;color:#555;line-height:2;">${s}</div>`).join('')
        : `<div style="font-size:9px;color:#888;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const linksHTML = `<div style="font-size:9px;color:#3b82f6;line-height:2;text-decoration:underline;cursor:pointer;" class="editable-field" ${editBtn('linkedin','Links',linkedin)}>${linkedin} <span class="edit-pen">✏</span></div>`;

    return `<div style="min-height:860px;background:#f0f4f8;font-family:'Segoe UI',sans-serif;padding:32px;position:relative;overflow:hidden;">
  <div style="position:absolute;top:-30px;right:-30px;width:140px;height:140px;border-radius:50%;background:#a5b4fc;opacity:0.45;"></div>
  <div style="position:absolute;bottom:-20px;right:60px;width:100px;height:100px;border-radius:50%;background:#fbbf24;opacity:0.35;"></div>
  <div style="position:absolute;bottom:-10px;left:-15px;width:80px;height:80px;border-radius:50%;background:#6ee7b7;opacity:0.45;"></div>
  <div style="position:relative;z-index:1;">
    <div style="display:flex;align-items:flex-start;gap:20px;margin-bottom:22px;">
      <div style="flex:1;">
        <div style="font-size:28px;font-weight:900;color:${accent};line-height:1.1;margin-bottom:4px;cursor:pointer;" class="editable-field" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen" style="font-size:16px;">✏</span></div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:6px;cursor:pointer;" class="editable-field" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
        <div style="font-size:9px;color:#888;line-height:1.6;cursor:pointer;" class="editable-field" ${editBtn('profileSummary','Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>
      </div>
      <div style="background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:6px 18px;border-radius:99px;flex-shrink:0;">Pro</div>
    </div>
    <div style="display:flex;gap:24px;">
      <div style="flex:1.5;">
        <div style="font-size:12px;font-weight:800;color:${accent};text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:4px;margin-bottom:12px;">Experience</div>
        <div class="editable-field" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
        <div style="font-size:12px;font-weight:800;color:${accent};text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:4px;margin:16px 0 10px;">Education</div>
        <div class="editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
      </div>
      <div style="flex:0.9;">
        <div style="font-size:12px;font-weight:800;color:${accent};text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:4px;margin-bottom:10px;">Details</div>
        <div style="font-size:9px;color:#555;line-height:2;margin-bottom:14px;">
          <div class="editable-field" style="cursor:pointer;" ${editBtn('location','Location',location)}>📍 ${location} <span class="edit-pen">✏</span></div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>
        </div>
        <div style="font-size:12px;font-weight:800;color:${accent};text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:4px;margin-bottom:10px;">Skills</div>
        <div class="editable-field" ${editBtn('skillsJson','Skills','')} style="margin-bottom:14px;">${skillsHTML}</div>
        <div style="font-size:12px;font-weight:800;color:${accent};text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:4px;margin-bottom:10px;">Links</div>
        ${linksHTML}
      </div>
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE: HANI — Dark Sidebar Dev
// ============================================================
function buildHaniTemplate(ctx) {
    const { resumeData: d, edu, skills, experience, color } = ctx;
    const accent = color || '#6c3fc9';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9a87c,#a07845);border-radius:50%;"></div>`;

    const expHTML = experience.length
        ? experience.map(e => `
            <div style="padding:10px 12px;background:rgba(255,255,255,0.04);border-left:3px solid ${accent};border-radius:0 6px 6px 0;margin-bottom:10px;">
              <div style="font-size:12px;font-weight:800;color:#1a1a2e;margin-bottom:2px;">${e.jobTitle||e.title||''} · ${e.company||''}</div>
              <div style="font-size:9px;color:#9ca3af;margin-bottom:5px;">${e.startDate||''} – ${e.endDate||'Present'}</div>
              <div style="font-size:9px;color:#555;line-height:1.7;">${(e.description||'').replace(/\n/g,'<br>')}</div>
            </div>`).join('')
        : `<div style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `
            <div style="padding:10px 12px;background:rgba(255,255,255,0.04);border-left:3px solid ${accent};border-radius:0 6px 6px 0;margin-bottom:8px;">
              <div style="font-size:11px;font-weight:700;color:#1a1a2e;">${e.degree||''}</div>
              <div style="font-size:9px;color:#6b7280;">${e.school||''}</div>
              <div style="font-size:8px;color:#9ca3af;">${e.year||''}</div>
            </div>`).join('')
        : `<div style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const skillsList = skills.length
        ? skills.map(s => `<div style="font-size:9px;color:rgba(255,255,255,0.75);line-height:2;">${s.name||s}</div>`).join('')
        : `<div style="font-size:9px;color:rgba(255,255,255,0.4);">Add skills</div>`;

    const contacts = [
        d.dob       ? `📅 ${d.dob}` : '',
        d.phone     ? `📞 ${d.phone}` : '',
        d.email     ? `✉ ${d.email}` : '',
        d.address   ? `📍 ${d.address}` : '',
    ].filter(Boolean);

    const extraHTML = buildExtraSectionsHTML(ctx, accent, '');

    return `<div style="display:flex;min-height:860px;font-family:'Segoe UI',sans-serif;">
  <div style="width:34%;background:#2c2c3e;padding:28px 18px;display:flex;flex-direction:column;align-items:center;">
    <div style="width:90px;height:90px;margin-bottom:12px;overflow:hidden;flex-shrink:0;">${photoHTML}</div>
    <div class="editable-field" style="font-size:17px;font-weight:900;color:#fff;text-align:center;margin-bottom:3px;cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${d.fullName||'Your Name'} <span class="edit-pen" style="font-size:12px;">✏</span></div>
    <div class="editable-field" style="font-size:10px;color:rgba(255,255,255,0.5);margin-bottom:14px;cursor:pointer;" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}>${d.jobTitle||'Your Title'} <span class="edit-pen">✏</span></div>
    <div style="background:rgba(255,255,255,0.07);border-radius:8px;width:100%;padding:10px 12px;margin-bottom:16px;">
      <div class="editable-field" style="font-size:8px;color:rgba(255,255,255,0.55);line-height:2.1;cursor:pointer;" ${editBtn('phone','Contact',d.phone||'')}>${contacts.join('<br>') || 'Add contact info ✏'} <span class="edit-pen">✏</span></div>
    </div>
    <div style="font-size:10px;font-weight:800;color:#fff;align-self:flex-start;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Skills</div>
    <div class="editable-field" style="align-self:flex-start;width:100%;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillsList} <span class="edit-pen" style="color:rgba(255,255,255,0.3);">✏</span></div>
    ${d.awards ? `<div style="font-size:10px;font-weight:800;color:#fff;align-self:flex-start;margin:14px 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Honor &amp; Award</div>
    <div class="editable-field" style="align-self:flex-start;font-size:9px;color:rgba(255,255,255,0.7);line-height:1.7;cursor:pointer;" ${editBtn('awards','Honor & Award',d.awards||'')}>${d.awards} <span class="edit-pen">✏</span></div>` : ''}
    ${d.interests ? `<div style="font-size:10px;font-weight:800;color:#fff;align-self:flex-start;margin:14px 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Hobbies &amp; Interest</div>
    <div class="editable-field" style="align-self:flex-start;font-size:9px;color:rgba(255,255,255,0.7);line-height:1.7;cursor:pointer;" ${editBtn('interests','Interests',d.interests||'')}>${d.interests} <span class="edit-pen">✏</span></div>` : ''}
    ${d.linkedin||d.website ? `<div style="font-size:10px;font-weight:800;color:#fff;align-self:flex-start;margin:14px 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Links</div>
    <div class="editable-field" style="align-self:flex-start;font-size:9px;color:rgba(255,255,255,0.7);line-height:1.7;cursor:pointer;" ${editBtn('linkedin','Links',d.linkedin||'')}>${d.linkedin||''} ${d.website||''} <span class="edit-pen">✏</span></div>` : ''}
  </div>
  <div style="flex:1;padding:28px 24px;background:#fff;">
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-left:4px solid ${accent};padding-left:10px;margin-bottom:10px;">About</div>
    <div class="editable-field" style="font-size:9px;color:#555;line-height:1.8;margin-bottom:22px;cursor:pointer;" ${editBtn('profileSummary','Summary',d.profileSummary||'')}>${d.profileSummary||'Click to add your profile summary.'} <span class="edit-pen">✏</span></div>
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-left:4px solid ${accent};padding-left:10px;margin-bottom:12px;">Education</div>
    <div class="editable-field" style="cursor:pointer;margin-bottom:20px;" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-left:4px solid ${accent};padding-left:10px;margin-bottom:12px;">Experience</div>
    <div class="editable-field" style="cursor:pointer;margin-bottom:20px;" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
    ${d.certifications ? `<div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-left:4px solid ${accent};padding-left:10px;margin-bottom:10px;">Certifications</div>
    <div class="editable-field" style="font-size:9px;color:#555;line-height:1.8;margin-bottom:16px;cursor:pointer;" ${editBtn('certifications','Certifications',d.certifications||'')}>${d.certifications} <span class="edit-pen">✏</span></div>` : ''}
    ${extraHTML}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE: NARMATHA2 — Maroon + Orange panels
// ============================================================
function buildNarmatha2Template(ctx) {
    const { resumeData: d, edu, skills, experience, color } = ctx;
    const accent    = color || '#8b1c1c';
    const secColor  = '#d97706';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9a87c,#a07845);"></div>`;

    const expHTML = experience.length
        ? experience.map(e => `
            <div style="margin-bottom:14px;">
              <div style="font-size:11px;font-weight:700;color:#fff;margin-bottom:5px;">${e.jobTitle||e.title||''} | ${e.company||''}</div>
              <div style="font-size:9px;color:rgba(255,255,255,0.6);margin-bottom:5px;">${e.startDate||''} – ${e.endDate||'Present'}</div>
              <div style="font-size:9px;color:rgba(255,255,255,0.8);line-height:1.8;">
                ${(e.description||'').split('\n').filter(l=>l.trim()).map(l=>`<div style="display:flex;gap:7px;align-items:flex-start;margin-bottom:3px;"><div style="width:7px;height:7px;border-radius:50%;background:${secColor};flex-shrink:0;margin-top:3px;"></div><span>${l.replace(/^[•\-]\s*/,'')}</span></div>`).join('') || `<div style="opacity:0.7;">${e.description||''}</div>`}
              </div>
            </div>`).join('')
        : `<div style="font-size:10px;color:rgba(255,255,255,0.4);cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div style="margin-bottom:6px;"><div style="font-size:10px;font-weight:700;color:#1a1a2e;">${e.degree||''}</div><div style="font-size:9px;color:#6b7280;">${e.school||''}</div></div>`).join('')
        : `<div style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const skillsList = skills.length
        ? skills.map(s=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><div style="width:9px;height:9px;border-radius:50%;background:${accent};flex-shrink:0;"></div>${s.name||s}</div>`).join('')
        : `<div style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const contacts = [d.email,d.phone,d.website,d.address].filter(Boolean);
    const extraHTML = buildExtraSectionsHTML(ctx, secColor, 'color:#fff;border-color:rgba(255,255,255,0.4);');

    return `<div style="display:flex;min-height:860px;font-family:'Segoe UI',sans-serif;">
  <div style="width:34%;background:#f5f5f5;padding:26px 16px;display:flex;flex-direction:column;">
    <div style="width:80px;height:80px;border-radius:4px;margin-bottom:14px;overflow:hidden;">${photoHTML}</div>
    <div style="font-size:11px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">Contact</div>
    <div class="editable-field" style="font-size:9px;color:#555;line-height:2.1;margin-bottom:14px;cursor:pointer;" ${editBtn('email','Contact',d.email||'')}>${contacts.join('<br>') || 'Add contact info ✏'} <span class="edit-pen">✏</span></div>
    <div style="font-size:11px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">Education</div>
    <div class="editable-field" style="margin-bottom:14px;cursor:pointer;" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
    <div style="font-size:11px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">Skills</div>
    <div class="editable-field" style="font-size:10px;color:#555;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillsList}</div>
    ${d.languages ? `<div style="font-size:11px;font-weight:800;color:#6b7280;text-transform:uppercase;margin:14px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">Languages</div>
    <div class="editable-field" style="font-size:9px;color:#555;line-height:2;cursor:pointer;" ${editBtn('languages','Languages',d.languages||'')}>${d.languages} <span class="edit-pen">✏</span></div>` : ''}
  </div>
  <div style="flex:1;background:${accent};padding:26px 20px;display:flex;flex-direction:column;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
      <div>
        <div class="editable-field" style="font-size:24px;font-weight:900;color:#fff;cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${d.fullName||'Your Name'} <span class="edit-pen" style="font-size:14px;">✏</span></div>
        <div class="editable-field" style="font-size:10px;color:rgba(255,255,255,0.65);margin-top:3px;cursor:pointer;" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}>${d.jobTitle||'Your Title'} <span class="edit-pen">✏</span></div>
      </div>
      <div style="background:#f59e0b;color:#fff;font-size:10px;font-weight:800;padding:4px 14px;border-radius:99px;flex-shrink:0;">Pro</div>
    </div>
    <div class="editable-field" style="font-size:9px;color:rgba(255,255,255,0.75);line-height:1.8;margin-bottom:20px;cursor:pointer;" ${editBtn('profileSummary','Summary',d.profileSummary||'')}>${d.profileSummary||'Click to add your summary.'} <span class="edit-pen">✏</span></div>
    <div style="background:${secColor};color:#fff;font-size:12px;font-weight:800;padding:9px 14px;border-radius:5px;margin-bottom:14px;text-transform:uppercase;">Professional Experience</div>
    <div class="editable-field" style="cursor:pointer;margin-bottom:16px;" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
    ${d.certifications ? `<div style="background:${secColor};color:#fff;font-size:12px;font-weight:800;padding:9px 14px;border-radius:5px;margin-bottom:12px;text-transform:uppercase;">Certification</div>
    <div class="editable-field" style="font-size:10px;color:rgba(255,255,255,0.8);line-height:2;cursor:pointer;" ${editBtn('certifications','Certifications',d.certifications||'')}>${d.certifications} <span class="edit-pen">✏</span></div>` : ''}
    ${extraHTML}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE: GUY-HAWKINS — Clean Two-Col Pro
// ============================================================
function buildGuyHawkinsTemplate(ctx) {
    const { resumeData: d, edu, skills, experience, projects, color } = ctx;
    const accent = color || '#1a1a2e';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9a87c,#a07845);"></div>`;

    const expHTML = experience.length
        ? experience.map(e => `
            <div style="padding:10px;background:#f9fafb;border-radius:6px;margin-bottom:8px;">
              <div style="font-size:11px;font-weight:800;color:#1a1a2e;margin-bottom:1px;">${e.jobTitle||e.title||''} · ${e.company||''}</div>
              <div style="font-size:9px;color:#9ca3af;margin-bottom:5px;">${e.location||''} | ${e.startDate||''} – ${e.endDate||'Present'}</div>
              <div style="font-size:9px;color:#555;line-height:1.7;">${(e.description||'').split('\n').filter(l=>l.trim()).map(l=>`• ${l.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div>
            </div>`).join('')
        : `<div style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `
            <div style="padding:10px;background:#f9fafb;border-radius:6px;margin-bottom:8px;">
              <div style="font-size:11px;font-weight:800;color:#1a1a2e;margin-bottom:1px;">${e.degree||''}</div>
              <div style="font-size:9px;color:#6b7280;">${e.school||''}</div>
              <div style="font-size:8px;color:#9ca3af;">${e.year||''}</div>
            </div>`).join('')
        : `<div style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const skillsList = skills.length
        ? skills.map(s=>s.name||s).join(' &nbsp;·&nbsp; ')
        : `<span style="color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</span>`;

    const contactLines = [
        d.address ? `🏠 ${d.address}` : '',
        d.phone   ? `📞 ${d.phone}` : '',
        d.email   ? `✉ ${d.email}` : '',
        d.website ? `🔗 ${d.website}` : '',
    ].filter(Boolean);

    const certHTML = d.certifications
        ? d.certifications.split('\n').filter(Boolean).map(c=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;"><div style="width:8px;height:8px;border-radius:50%;background:#f59e0b;flex-shrink:0;"></div><span style="font-size:9px;color:#555;">${c}</span></div>`).join('')
        : `<div style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('certifications','Certifications','')}>Add certifications ✏</div>`;

    const extraHTML = buildExtraSectionsHTML(ctx, accent, '');

    return `<div style="display:flex;min-height:860px;font-family:'Segoe UI',sans-serif;background:#fff;">
  <div style="width:33%;padding:26px 16px;border-right:1px solid #e5e7eb;">
    <div style="width:84px;height:84px;margin-bottom:12px;overflow:hidden;">${photoHTML}</div>
    <div class="editable-field" style="font-size:20px;font-weight:900;color:#1a1a2e;margin-bottom:2px;cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${d.fullName||'Your Name'} <span class="edit-pen">✏</span></div>
    <div class="editable-field" style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;cursor:pointer;" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}>${d.jobTitle||'Your Title'} <span class="edit-pen">✏</span></div>
    <div class="editable-field" style="font-size:9px;color:#555;line-height:1.8;margin-bottom:14px;cursor:pointer;" ${editBtn('profileSummary','Summary',d.profileSummary||'')}>${d.profileSummary||'Add your profile summary.'} <span class="edit-pen">✏</span></div>
    <div style="font-size:10px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-bottom:1.5px solid #1a1a2e;padding-bottom:3px;margin-bottom:8px;">Contact</div>
    <div class="editable-field" style="font-size:8px;color:#555;line-height:2;margin-bottom:14px;cursor:pointer;" ${editBtn('phone','Contact',d.phone||'')}>${contactLines.join('<br>') || 'Add contact ✏'} <span class="edit-pen">✏</span></div>
    <div style="font-size:10px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-bottom:1.5px solid #1a1a2e;padding-bottom:3px;margin-bottom:8px;">Skills</div>
    <div class="editable-field" style="font-size:9px;color:#555;line-height:1.8;margin-bottom:14px;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillsList} <span class="edit-pen">✏</span></div>
    ${d.awards ? `<div style="font-size:10px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-bottom:1.5px solid #1a1a2e;padding-bottom:3px;margin-bottom:8px;">Awards</div>
    <div class="editable-field" style="font-size:9px;color:#555;line-height:1.8;margin-bottom:14px;cursor:pointer;" ${editBtn('awards','Awards',d.awards||'')}>${d.awards} <span class="edit-pen">✏</span></div>` : ''}
  </div>
  <div style="flex:1;padding:22px 20px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;display:flex;align-items:center;gap:8px;">🎓 Education</div>
      <div style="background:#f59e0b;color:#fff;font-size:10px;font-weight:800;padding:4px 14px;border-radius:99px;">Pro</div>
    </div>
    <div class="editable-field" style="cursor:pointer;margin-bottom:18px;" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:12px;">💼 Experience</div>
    <div class="editable-field" style="cursor:pointer;margin-bottom:18px;" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
    <div style="font-size:13px;font-weight:800;color:#1a1a2e;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:12px;">🏅 Certification</div>
    <div class="editable-field" style="cursor:pointer;margin-bottom:16px;" ${editBtn('certifications','Certifications',d.certifications||'')}>${certHTML}</div>
    ${d.linkedin||d.website ? `<div style="border-top:1px solid #e5e7eb;margin-top:14px;padding-top:12px;display:flex;justify-content:space-around;flex-wrap:wrap;gap:6px;">
      ${d.linkedin ? `<div class="editable-field" style="font-size:8px;color:#6b7280;cursor:pointer;" ${editBtn('linkedin','LinkedIn',d.linkedin||'')}>🔗 ${d.linkedin} <span class="edit-pen">✏</span></div>` : ''}
      ${d.website  ? `<div class="editable-field" style="font-size:8px;color:#6b7280;cursor:pointer;" ${editBtn('website','Website',d.website||'')}>🌐 ${d.website} <span class="edit-pen">✏</span></div>` : ''}
    </div>` : ''}
    ${extraHTML}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE: KATE-BISHOP — Light Minimal UX
// ============================================================
function buildKateBishopTemplate(ctx) {
    const { resumeData: d, edu, skills, experience, projects, color } = ctx;
    const accent = color || '#6c3fc9';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9a87c,#a07845);border-radius:50%;"></div>`;

    const expHTML = experience.length
        ? experience.map(e => `
            <div style="margin-bottom:16px;">
              <div style="font-size:11px;font-weight:800;color:#1a1a2e;margin-bottom:1px;">${e.jobTitle||e.title||''} · ${e.company||''}</div>
              <div style="font-size:9px;color:${accent};margin-bottom:5px;">${e.startDate||''} – ${e.endDate||'Present'}</div>
              <div style="font-size:9px;color:#555;line-height:1.8;">${(e.description||'').replace(/\n/g,'<br>')}</div>
            </div>`).join('')
        : `<div style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `
            <div style="margin-bottom:12px;">
              <div style="font-size:11px;font-weight:800;color:#1a1a2e;margin-bottom:1px;">${e.degree||''}</div>
              <div style="font-size:9px;color:${accent};margin-bottom:1px;">${e.school||''}</div>
              <div style="font-size:8px;color:#9ca3af;">${e.year||''}</div>
            </div>`).join('')
        : `<div style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const skillTags = skills.length
        ? skills.map(s=>`<span style="display:inline-block;background:#f3f4f6;color:#374151;font-size:9px;padding:3px 8px;border-radius:4px;margin:2px 2px 0 0;">${s.name||s}</span>`).join('')
        : `<span style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</span>`;

    const contactInfo = [
        d.email   ? `✉ ${d.email}` : '',
        d.phone   ? `📞 ${d.phone}` : '',
        d.address ? `📍 ${d.address}` : '',
        d.linkedin? `🔗 ${d.linkedin}` : '',
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');

    const extraHTML = buildExtraSectionsHTML(ctx, accent, '');

    return `<div style="min-height:860px;font-family:'Segoe UI',sans-serif;background:#f8f9ff;">
  <div style="background:#fff;padding:22px 28px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:16px;">
    <div style="width:78px;height:78px;overflow:hidden;flex-shrink:0;">${photoHTML}</div>
    <div style="flex:1;">
      <div class="editable-field" style="font-size:26px;font-weight:900;color:#1a1a2e;margin-bottom:2px;cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${d.fullName||'Your Name'} <span class="edit-pen" style="font-size:14px;">✏</span></div>
      <div class="editable-field" style="font-size:12px;color:${accent};font-weight:700;margin-bottom:6px;cursor:pointer;" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}>${d.jobTitle||'Your Title'} <span class="edit-pen">✏</span></div>
      <div class="editable-field" style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('email','Contact',d.email||'')}>${contactInfo || 'Add contact info ✏'} <span class="edit-pen">✏</span></div>
    </div>
    <div style="background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:6px 18px;border-radius:99px;flex-shrink:0;">Pro</div>
  </div>
  <div style="display:flex;min-height:740px;">
    <div style="flex:1.2;padding:24px 22px;border-right:1px solid #e5e7eb;">
      <div class="editable-field" style="font-size:9px;color:#555;line-height:1.8;margin-bottom:20px;cursor:pointer;" ${editBtn('profileSummary','Summary',d.profileSummary||'')}>${d.profileSummary||'Click to add your profile summary.'} <span class="edit-pen">✏</span></div>
      <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:4px;margin-bottom:14px;">Work Experience</div>
      <div class="editable-field" style="cursor:pointer;margin-bottom:20px;" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
      ${projects.length ? `<div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:4px;margin-bottom:14px;">Projects</div>
      ${projects.map(p=>`<div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:700;color:#1a1a2e;">${p.name||''}</div><div style="font-size:9px;color:#555;line-height:1.7;">${p.description||''}</div></div>`).join('')}` : ''}
      ${extraHTML}
    </div>
    <div style="width:36%;padding:24px 18px;background:#fff;">
      <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:4px;margin-bottom:14px;">Education &amp; Learning</div>
      <div class="editable-field" style="cursor:pointer;margin-bottom:20px;" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
      ${d.certifications ? `<div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:4px;margin-bottom:12px;">Certifications</div>
      <div class="editable-field" style="font-size:9px;color:#555;line-height:1.9;margin-bottom:16px;cursor:pointer;" ${editBtn('certifications','Certifications',d.certifications||'')}>${d.certifications} <span class="edit-pen">✏</span></div>` : ''}
      <div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:4px;margin-bottom:12px;">Skills</div>
      <div class="editable-field" style="cursor:pointer;margin-bottom:16px;" ${editBtn('skillsJson','Skills','')}>${skillTags} <span class="edit-pen">✏</span></div>
      ${d.languages ? `<div style="font-size:12px;font-weight:800;color:#1a1a2e;text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:4px;margin-bottom:10px;">Languages</div>
      <div class="editable-field" style="font-size:9px;color:#555;line-height:2;cursor:pointer;" ${editBtn('languages','Languages',d.languages||'')}>${d.languages} <span class="edit-pen">✏</span></div>` : ''}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE: SMITH-GRAPHIC — Orange Footer Bold
// ============================================================
function buildSmithGraphicTemplate(ctx) {
    const { resumeData: d, edu, skills, experience, color } = ctx;
    const accent = color || '#f97316';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9a87c,#a07845);border-radius:50%;"></div>`;

    const expHTML = experience.length
        ? experience.map(e => `
            <div style="margin-bottom:14px;">
              <div style="font-size:10px;font-weight:800;color:#1a1a2e;text-transform:uppercase;margin-bottom:2px;">${e.jobTitle||e.title||''}</div>
              <div style="font-size:8px;color:${accent};margin-bottom:4px;font-weight:600;">${e.company||''} · ${e.startDate||''} – ${e.endDate||'Present'}</div>
              <div style="font-size:9px;color:#555;line-height:1.7;">${(e.description||'').replace(/\n/g,'<br>')}</div>
            </div>`).join('')
        : `<div style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `
            <div style="margin-bottom:12px;">
              <div style="font-size:10px;font-weight:800;color:#1a1a2e;text-transform:uppercase;margin-bottom:1px;">${e.degree||''}</div>
              <div style="font-size:9px;color:#555;line-height:1.6;">${e.school||''}</div>
              <div style="font-size:8px;color:#9ca3af;">${e.year||''}</div>
            </div>`).join('')
        : `<div style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const skillsList = skills.length
        ? skills.map(s=>`<div style="display:flex;align-items:center;gap:5px;color:rgba(255,255,255,0.9);font-size:9px;margin-bottom:4px;"><span>•</span>${s.name||s}</div>`).join('')
        : `<div style="font-size:9px;color:rgba(255,255,255,0.5);">Add skills</div>`;

    const langs = d.languages
        ? d.languages.split(',').map(l=>`<div style="display:flex;align-items:center;gap:5px;color:rgba(255,255,255,0.9);font-size:9px;margin-bottom:4px;"><span>•</span>${l.trim()}</div>`).join('')
        : `<div style="font-size:9px;color:rgba(255,255,255,0.5);">Add languages</div>`;

    const qualities = d.qualities
        ? d.qualities.split(',').map(q=>`<div style="display:flex;align-items:center;gap:5px;color:rgba(255,255,255,0.9);font-size:9px;margin-bottom:4px;"><span>•</span>${q.trim()}</div>`).join('')
        : `<div style="font-size:9px;color:rgba(255,255,255,0.5);">Add qualities</div>`;

    const contactInfo = [
        d.phone ? `📞 ${d.phone}` : '',
        d.email ? `✉ ${d.email}` : '',
        d.website ? `🌐 ${d.website}` : '',
    ].filter(Boolean).join(' &nbsp; ');

    const extraHTML = buildExtraSectionsHTML(ctx, accent, '');

    return `<div style="min-height:860px;font-family:'Segoe UI',sans-serif;background:#fff;display:flex;flex-direction:column;">
  <div style="padding:22px 28px 14px;border-bottom:1px solid #f0f0f0;display:flex;align-items:flex-start;gap:18px;">
    <div style="width:88px;height:88px;overflow:hidden;flex-shrink:0;border:3px solid ${accent};">${photoHTML}</div>
    <div style="flex:1;">
      <div class="editable-field" style="font-size:26px;font-weight:900;color:#1a1a2e;margin-bottom:2px;cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${d.fullName||'Your Name'} <span class="edit-pen" style="font-size:14px;">✏</span></div>
      <div class="editable-field" style="font-size:12px;color:${accent};font-weight:700;margin-bottom:8px;cursor:pointer;" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}>${d.jobTitle||'Your Title'} <span class="edit-pen">✏</span></div>
      <div class="editable-field" style="font-size:9px;color:#9ca3af;cursor:pointer;" ${editBtn('phone','Contact',d.phone||'')}>${contactInfo || 'Add contact info ✏'} <span class="edit-pen">✏</span></div>
    </div>
    <div style="background:#f59e0b;color:#fff;font-size:11px;font-weight:800;padding:6px 18px;border-radius:99px;flex-shrink:0;">Pro</div>
  </div>
  <div class="editable-field" style="padding:14px 28px;border-bottom:1px solid #f0f0f0;font-size:9px;color:#555;line-height:1.8;cursor:pointer;" ${editBtn('profileSummary','Summary',d.profileSummary||'')}>${d.profileSummary||'Click to add your profile summary.'} <span class="edit-pen">✏</span></div>
  <div style="display:flex;flex:1;">
    <div style="flex:1;padding:18px 22px;border-right:1px solid #f0f0f0;">
      <div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:12px;">Job Experience</div>
      <div class="editable-field" style="cursor:pointer;margin-bottom:16px;" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
      ${extraHTML}
    </div>
    <div style="flex:1;padding:18px 22px;">
      <div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:12px;">Education</div>
      <div class="editable-field" style="cursor:pointer;margin-bottom:16px;" ${editBtn('educationJson','Education','')}>${eduHTML}</div>
      ${d.certifications ? `<div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;margin-bottom:10px;">Certifications</div>
      <div class="editable-field" style="font-size:9px;color:#555;line-height:1.8;margin-bottom:14px;cursor:pointer;" ${editBtn('certifications','Certifications',d.certifications||'')}>${d.certifications} <span class="edit-pen">✏</span></div>` : ''}
    </div>
  </div>
  <div style="background:${accent};display:flex;">
    <div style="flex:1;padding:16px 20px;border-right:1px solid rgba(255,255,255,0.25);">
      <div style="font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;margin-bottom:8px;">Skills</div>
      <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillsList} <span class="edit-pen" style="color:rgba(255,255,255,0.4);">✏</span></div>
    </div>
    <div style="flex:1;padding:16px 20px;border-right:1px solid rgba(255,255,255,0.25);">
      <div style="font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;margin-bottom:8px;">Language</div>
      <div class="editable-field" style="cursor:pointer;" ${editBtn('languages','Languages',d.languages||'')}>${langs} <span class="edit-pen" style="color:rgba(255,255,255,0.4);">✏</span></div>
    </div>
    <div style="flex:1;padding:16px 20px;">
      <div style="font-size:10px;font-weight:800;color:#fff;text-transform:uppercase;margin-bottom:8px;">Qualities</div>
      <div class="editable-field" style="cursor:pointer;" ${editBtn('qualities','Qualities',d.qualities||'')}>${qualities} <span class="edit-pen" style="color:rgba(255,255,255,0.4);">✏</span></div>
    </div>
  </div>
</div>`;
}

// ============================================================

// ============================================================
// TEMPLATE 17: GRADIENT AURA — Blush-to-Lavender Gradient
// Uses resume-t17 CSS classes from review-templates.css
// ============================================================
function buildTemplate17ProperTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#a18cd1';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const summary = d.profileSummary || '';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:4px solid #fff;box-shadow:0 4px 16px rgba(0,0,0,.15);cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t17-photo-wrap" style="background:linear-gradient(135deg,${accent},#fbc2eb);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${(name||'U').charAt(0).toUpperCase()}</div>`;

    const skillDotsHTML = skills.length
        ? skills.map(s => {
            const sn = typeof s === 'string' ? s : (s.name || s.skill || '');
            const pct = (typeof s === 'object' && typeof s.level === 'number') ? s.level : 70;
            const filledDots = Math.round(pct / 20);
            return `<div class="t17-skill-dots">
                <span>${sn}</span>
                <div class="t17-dots">${[1,2,3,4,5].map(i => `<div class="t17-dot${i<=filledDots?' on':''}"></div>`).join('')}</div>
              </div>`;
        }).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div class="t17-edu-item">
            <div class="t17-edu-date">${e.year || e.from || ''}</div>
            <div class="t17-edu-title">${e.degree || ''}</div>
            <div class="t17-edu-place">${e.school || e.university || ''}</div>
          </div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div class="t17-job">
            <div class="t17-job-date">${e.startDate || e.from || ''} – ${e.endDate || e.to || 'Present'}</div>
            <div class="t17-job-title">${e.jobTitle || e.role || e.title || ''}</div>
            <div class="t17-job-co">${e.company || ''}</div>
            ${(e.description || e.bullets || '').toString().split('\n').filter(Boolean).map(b => `<div class="t17-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const projHTML = projects.length
        ? projects.map(p => `<div class="t17-job">
            <div class="t17-job-title">${p.title || p.name || ''}</div>
            <div class="t17-job-co">${p.tools || ''}</div>
            <div class="t17-bullet">${p.description || ''}</div>
          </div>`).join('')
        : '';

    return `<div class="resume-t17">
  <div class="t17-top-grad" style="background:linear-gradient(135deg,#fbc2eb 0%,${accent} 50%,#fbc2eb 100%);">
    <div class="t17-photo-wrap" style="top:50px;right:20px;position:absolute;">${photoHTML}</div>
  </div>
  <div class="t17-header">
    <div class="t17-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    <div class="t17-role editable-field" style="color:${accent};cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    ${summary ? `<div class="t17-bio editable-field" style="cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>` : ''}
  </div>
  <div class="t17-body">
    <div class="t17-left">
      <div class="t17-sec-title" style="border-bottom-color:${accent};color:${accent};">Contact</div>
      ${email ? `<div style="font-size:10px;color:#555;margin-bottom:4px;" class="editable-field" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>` : ''}
      ${phone ? `<div style="font-size:10px;color:#555;margin-bottom:4px;" class="editable-field" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>` : ''}
      ${d.linkedin ? `<div style="font-size:10px;color:#555;margin-bottom:4px;" class="editable-field" ${editBtn('linkedin','LinkedIn',d.linkedin||'')}>🔗 ${d.linkedin} <span class="edit-pen">✏</span></div>` : ''}
      <div class="t17-sec-title" style="border-bottom-color:${accent};color:${accent};margin-top:14px;">Skills</div>
      <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skillDotsHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
      <div class="t17-sec-title" style="border-bottom-color:${accent};color:${accent};margin-top:14px;">Education</div>
      <div class="section-block editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
      ${d.languages ? `<div class="t17-sec-title" style="border-bottom-color:${accent};color:${accent};margin-top:14px;">Languages</div><div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div style="font-size:10px;color:#555;margin:2px 0;">● ${l.trim()}</div>`).join('')}<span class="edit-pen">✏</span></div>` : ''}
    </div>
    <div class="t17-right">
      <div class="t17-sec-title" style="border-bottom-color:${accent};color:${accent};">Experience</div>
      <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
      ${projHTML ? `<div class="t17-sec-title" style="border-bottom-color:${accent};color:${accent};margin-top:14px;">Projects</div><div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>` : ''}
      ${d.certifications ? `<div class="t17-sec-title" style="border-bottom-color:${accent};color:${accent};margin-top:14px;">Certifications</div><div class="editable-field section-block" style="font-size:11px;color:#555;" ${editBtn('certifications','Certifications',d.certifications||'')}>${d.certifications}<span class="edit-pen">✏</span></div>` : ''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 19: BLUSH MANAGER — Lavender/Grey Geometric Split
// Uses resume-t19 CSS classes from review-templates.css
// ============================================================
function buildTemplate19ProperTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#b0c4de';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const summary = d.profileSummary || '';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #fff;cursor:pointer;position:absolute;top:16px;left:20px;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t19-photo" style="background:linear-gradient(135deg,${accent},#8a9bc0);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${(name||'U').charAt(0).toUpperCase()}</div>`;

    const skillsHTML = skills.length
        ? skills.map(s => {
            const sn = typeof s === 'string' ? s : (s.name || s.skill || '');
            const pct = (typeof s === 'object' && typeof s.level === 'number') ? s.level : 75;
            return `<div class="t19-skill-row">
                <span>${sn}</span>
                <div class="t19-skill-bar"><div class="t19-skill-fill" style="width:${pct}%;background:#e8b4c0;"></div></div>
              </div>`;
        }).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div style="margin-bottom:12px;">
            <div class="t19-job-title editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${e.jobTitle || e.role || e.title || ''} <span class="t19-job-date" style="color:${accent};">${e.startDate || e.from || ''} – ${e.endDate || e.to || 'Present'}</span> <span class="edit-pen">✏</span></div>
            <div style="font-size:10px;color:#777;margin-bottom:3px;">${e.company || ''}</div>
            ${(e.description || e.bullets || '').toString().split('\n').filter(Boolean).map(b => `<div class="t19-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div class="t19-item">
            <div class="t19-sec-title" style="display:inline-block;margin:0 0 3px;">${e.degree || ''}</div>
            <div class="t19-job-date" style="color:${accent};float:right;">${e.year || ''}</div>
            <div style="font-size:10px;color:#777;clear:both;">${e.school || e.university || ''}</div>
          </div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    const langHTML = d.languages
        ? d.languages.split(',').map(l => `<div class="t19-lang-item" style="background:#d4d8e8;color:#555;">${l.trim()}</div>`).join('')
        : '';

    return `<div class="resume-t19">
  <div class="t19-top">
    <div class="t19-top-left" style="position:relative;">
      <div class="t19-geo-a"></div>
      <div class="t19-geo-b" style="background:${accent};"></div>
      <div class="t19-blobgray"></div>
      ${photoHTML}
      <div style="padding:110px 16px 14px;">
        <div class="t19-name editable-field" style="font-size:18px;font-weight:900;color:#1a1a2e;cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
        <div class="t19-role editable-field" style="font-size:10px;color:#777;text-transform:uppercase;letter-spacing:1px;margin-top:3px;cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      </div>
    </div>
    <div class="t19-top-right">
      <div style="font-size:10px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Contact</div>
      ${phone ? `<div class="t19-contact-r editable-field" style="font-size:10px;color:#555;cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>` : ''}
      ${email ? `<div class="t19-contact-r editable-field" style="font-size:10px;color:#555;cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>` : ''}
      ${d.linkedin ? `<div class="t19-contact-r editable-field" style="font-size:10px;color:#555;cursor:pointer;" ${editBtn('linkedin','LinkedIn',d.linkedin||'')}>🔗 ${d.linkedin} <span class="edit-pen">✏</span></div>` : ''}
    </div>
  </div>
  <div class="t19-body">
    <div class="t19-bl">
      ${summary ? `<div class="t19-sec-title">Profile</div><div class="editable-field section-block" style="font-size:10px;color:#555;line-height:1.6;cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>` : ''}
      <div class="t19-sec-title">Experience</div>
      <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
      ${projects.length ? `<div class="t19-sec-title">Projects</div><div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div style="margin-bottom:10px;"><div style="font-size:11px;font-weight:700;color:#1a1a2e;">${p.title||p.name||''}</div><div style="font-size:10px;color:${accent};">${p.tools||''}</div><div style="font-size:10px;color:#555;">${p.description||''}</div></div>`).join('')}<span class="edit-pen">✏</span></div>` : ''}
      ${buildExtraSections(accent)}
    </div>
    <div class="t19-br">
      <div class="t19-sec-title">Education</div>
      <div class="section-block editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
      <div class="t19-sec-title" style="margin-top:14px;">Skills</div>
      <div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skillsHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
      ${langHTML ? `<div class="t19-sec-title" style="margin-top:14px;">Languages</div><div class="t19-lang editable-field" ${editBtn('languages','Languages',d.languages||'')}>${langHTML}<span class="edit-pen">✏</span></div>` : ''}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 22: FOREST GREEN — Green Left Sidebar with Skills
// Uses resume-t22 CSS classes from review-templates.css
// ============================================================
function buildTemplate22ProperTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#2e7d32';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const summary = d.profileSummary || '';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:10px;display:block;cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t22-photo" style="background:linear-gradient(135deg,${accent},#81c784);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${(name||'U').charAt(0).toUpperCase()}</div>`;

    const skillsHTML = skills.length
        ? `<div class="t22-skill-list editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skills.map(s=>`<div class="t22-skill">${typeof s==='string'?s:(s.name||s.skill||'')}</div>`).join('')}<span class="edit-pen" style="font-size:10px;">✏</span></div>`
        : `<div style="font-size:10px;color:#555;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const langBarHTML = d.languages
        ? d.languages.split(',').map((l, i) => {
            const pct = [80, 65, 50, 40][i] || 60;
            return `<div class="t22-lang-bar-row"><span style="width:90px;">${l.trim()}</span><div class="t22-lang-track"><div class="t22-lang-fill" style="width:${pct}%;background:${accent};"></div></div></div>`;
        }).join('')
        : '';

    const expHTML = experience.length
        ? experience.map(e => `<div class="t22-exp-item">
            <div class="t22-exp-header">
              <div class="t22-exp-title editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${e.jobTitle || e.role || e.title || ''} <span class="edit-pen">✏</span></div>
              <div class="t22-exp-date">${e.startDate || e.from || ''} – ${e.endDate || e.to || 'Present'}</div>
            </div>
            <div class="t22-exp-co">${e.company || ''}</div>
            <div class="t22-exp-desc">${(e.description || e.bullets || '').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join(' ')}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div class="t22-course-item">
            <div class="t22-course-name">${e.degree || ''}</div>
            <div class="t22-course-sub">${e.school || e.university || ''} · ${e.year || ''}</div>
          </div>`).join('')
        : `<div style="font-size:10px;color:#555;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    return `<div class="resume-t22">
  <div class="t22-left">
    <div class="t22-left-top">
      ${photoHTML}
      <div class="t22-name-left editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    </div>
    <div class="t22-green-btn" style="background:${accent};">Position</div>
    <div class="t22-pos-desired editable-field" style="cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    <div class="t22-contact-section" style="margin-top:10px;">
      <div class="t22-green-btn" style="background:${accent};">Contact</div>
      ${phone ? `<div class="t22-contact-item editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>` : ''}
      ${email ? `<div class="t22-contact-item editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>` : ''}
      ${d.address ? `<div class="t22-contact-item editable-field" style="cursor:pointer;" ${editBtn('address','Address',d.address||'')}>📍 ${d.address} <span class="edit-pen">✏</span></div>` : ''}
    </div>
    ${langBarHTML ? `<div class="t22-contact-section" style="margin-top:10px;"><div class="t22-green-btn-wide" style="background:${accent};">Languages</div><div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${langBarHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div></div>` : ''}
    <div class="t22-contact-section" style="margin-top:10px;">
      <div class="t22-green-btn-wide" style="background:${accent};">Education</div>
      <div class="section-block editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
    </div>
    <div class="t22-contact-section" style="margin-top:10px;">
      <div class="t22-green-btn-wide" style="background:${accent};">Skills</div>
      ${skillsHTML}
    </div>
  </div>
  <div class="t22-right">
    <div class="t22-right-body">
      ${summary ? `<div class="t22-green-btn" style="background:${accent};">Profile</div><div class="editable-field section-block" style="font-size:10px;color:#555;line-height:1.6;margin:6px 0 12px;cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>` : ''}
      <div class="t22-green-btn" style="background:${accent};">Experience</div>
      <div class="section-block editable-field" id="rv-experience-section" style="margin-top:8px;" ${editBtn('experienceJson','Experience','')}>${expHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
      ${projects.length ? `<div class="t22-green-btn" style="background:${accent};margin-top:12px;">Projects</div><div class="section-block editable-field" id="rv-projects-section" style="margin-top:8px;" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t22-exp-item"><div class="t22-exp-title">${p.title||p.name||''}</div><div class="t22-exp-co">${p.tools||''}</div><div class="t22-exp-desc">${p.description||''}</div></div>`).join('')}<span class="edit-pen">✏</span></div>` : ''}
      ${d.certifications ? `<div class="t22-green-btn" style="background:${accent};margin-top:12px;">Certifications</div><div class="editable-field section-block" style="font-size:10px;color:#555;margin-top:6px;cursor:pointer;" ${editBtn('certifications','Certifications',d.certifications||'')}>${d.certifications} <span class="edit-pen">✏</span></div>` : ''}
      ${buildExtraSections(accent)}
    </div>
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 23: ORANGE SPLASH — Orange left sidebar + white right
// Uses resume-t23 CSS classes from review-templates.css
// ============================================================
function buildTemplate23ProperTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#f57c00';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const summary = d.profileSummary || '';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #fff;cursor:pointer;margin:0 auto 8px;display:block;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t23-photo" style="background:linear-gradient(135deg,${accent},#ffb74d);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${(name||'U').charAt(0).toUpperCase()}</div>`;

    const skillsHTML = skills.length
        ? skills.map(s => `<div class="t23-skill-item">${typeof s==='string'?s:(s.name||s.skill||'')}</div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div class="t23-job">
            <div class="t23-job-header">
              <div class="t23-job-title editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${e.jobTitle || e.role || e.title || ''} <span class="edit-pen">✏</span></div>
              <div class="t23-job-date" style="color:${accent};">${e.startDate || e.from || ''} – ${e.endDate || e.to || 'Present'}</div>
            </div>
            <div class="t23-job-co">${e.company || ''}</div>
            ${(e.description || e.bullets || '').toString().split('\n').filter(Boolean).map(b => `<div class="t23-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div class="t23-edu-item">
            <div class="t23-edu-date-co" style="color:${accent};">
              <span>${e.year || e.from || ''}</span>
              <span>${e.school || e.university || ''}</span>
            </div>
            <div class="t23-edu-deg">${e.degree || ''}</div>
            ${e.description ? `<div class="t23-edu-desc">${e.description}</div>` : ''}
          </div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    return `<div class="resume-t23">
  <div class="t23-left">
    <div class="t23-left-top" style="background:${accent};text-align:center;padding:16px;">
      ${photoHTML}
      <div class="t23-name editable-field" style="font-size:16px;font-weight:900;color:#fff;cursor:pointer;margin-bottom:2px;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen" style="opacity:0.7;">✏</span></div>
      <div class="t23-role-badge editable-field" style="background:rgba(255,255,255,0.2);border-radius:3px;display:inline-block;padding:2px 10px;font-size:10px;color:#fff;cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
    </div>
    <div class="t23-contact-sec">
      <div class="t23-orange-sec" style="background:${accent};">Contact</div>
      ${phone ? `<div class="t23-contact-item editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></div>` : ''}
      ${email ? `<div class="t23-contact-item editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></div>` : ''}
      ${d.linkedin ? `<div class="t23-contact-item editable-field" style="cursor:pointer;" ${editBtn('linkedin','LinkedIn',d.linkedin||'')}>🔗 ${d.linkedin} <span class="edit-pen">✏</span></div>` : ''}
      ${d.address ? `<div class="t23-contact-item editable-field" style="cursor:pointer;" ${editBtn('address','Address',d.address||'')}>📍 ${d.address} <span class="edit-pen">✏</span></div>` : ''}
    </div>
    <div class="t23-left-body">
      <div class="t23-orange-sec" style="background:${accent};margin:10px -14px 8px;">Skills</div>
      <div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skillsHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
      ${d.languages ? `<div class="t23-orange-sec" style="background:${accent};margin:10px -14px 8px;">Languages</div><div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div class="t23-interest">${l.trim()}</div>`).join('')}<span class="edit-pen">✏</span></div>` : ''}
    </div>
  </div>
  <div class="t23-right">
    <div class="t23-name editable-field" style="font-size:20px;font-weight:900;color:#1a1a2e;margin-bottom:4px;cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
    ${summary ? `<div class="t23-orange-title" style="background:${accent};">About Me</div><div class="editable-field section-block" style="font-size:10px;color:#555;line-height:1.6;cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>` : ''}
    <div class="t23-orange-title" style="background:${accent};margin-top:12px;">Education</div>
    <div class="section-block editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
    <div class="t23-orange-title" style="background:${accent};margin-top:12px;">Experience</div>
    <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
    ${projects.length ? `<div class="t23-orange-title" style="background:${accent};margin-top:12px;">Projects</div><div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t23-job"><div class="t23-job-title">${p.title||p.name||''}</div><div class="t23-job-co">${p.tools||''}</div></div>`).join('')}<span class="edit-pen">✏</span></div>` : ''}
    ${buildExtraSections(accent)}
  </div>
</div>`;
}

// ============================================================
// TEMPLATE 28: CAROLINE CLEAN — White with Salmon Accents
// Uses resume-t28 CSS classes from review-templates.css
// ============================================================
function buildTemplate28ProperTemplate({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#e8a87c';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const summary = d.profileSummary || '';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:65px;height:65px;border-radius:50%;object-fit:cover;border:2px solid ${accent};cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t28-photo" style="background:linear-gradient(135deg,#f48fb1,#ce93d8);cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${(name||'U').charAt(0).toUpperCase()}</div>`;

    const skillsHTML = skills.length
        ? skills.map((s, i) => {
            const sn = typeof s === 'string' ? s : (s.name || s.skill || '');
            const group = Math.floor(i / 2);
            return `<div class="t28-skill-group"><div class="t28-skill-group-title" style="color:${accent};">${sn}</div><div class="t28-skill-text">${typeof s==='object'&&s.level?s.level+'%':''}</div></div>`;
        }).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('skillsJson','Skills','')}>Add skills ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div class="t28-job">
            <div class="t28-job-left">
              <div class="t28-job-title editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${e.jobTitle || e.role || e.title || ''} <span class="edit-pen">✏</span></div>
              <div class="t28-job-co">${e.company || ''}</div>
              ${(e.description || e.bullets || '').toString().split('\n').filter(Boolean).map(b => `<div class="t28-bullet">${b.replace(/^[•\-]\s*/,'')}</div>`).join('')}
            </div>
            <div class="t28-job-right">${e.startDate || e.from || ''} – ${e.endDate || e.to || 'Present'}</div>
          </div>`).join('')
        : `<div style="font-size:11px;color:#9ca3af;cursor:pointer;" ${editBtn('experienceJson','Experience','')}>Add experience ✏</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div class="t28-edu-item">
            <div>
              <div class="t28-edu-title" style="font-size:11px;font-weight:800;font-style:italic;">${e.degree || ''}</div>
              <div class="t28-edu-sub">${e.school || e.university || ''}</div>
            </div>
            <div class="t28-edu-date">${e.year || ''}</div>
          </div>`).join('')
        : `<div style="font-size:10px;color:#9ca3af;cursor:pointer;" ${editBtn('educationJson','Education','')}>Add education ✏</div>`;

    return `<div class="resume-t28">
  <div class="t28-header">
    ${photoHTML}
    <div>
      <div class="t28-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
      <div class="t28-role editable-field" style="color:${accent};cursor:pointer;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
      <div class="t28-links">
        ${email ? `<span class="editable-field" style="cursor:pointer;" ${editBtn('email','Email',email)}>✉ ${email} <span class="edit-pen">✏</span></span>` : ''}
        ${phone ? `<span class="editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>📞 ${phone} <span class="edit-pen">✏</span></span>` : ''}
        ${d.linkedin ? `<span class="editable-field" style="cursor:pointer;" ${editBtn('linkedin','LinkedIn',d.linkedin||'')}>🔗 ${d.linkedin} <span class="edit-pen">✏</span></span>` : ''}
      </div>
    </div>
  </div>
  ${summary ? `<div class="t28-quote-box editable-field" style="cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>` : ''}
  <div class="t28-body">
    <div class="t28-sec-title" style="color:${accent};">Experience</div>
    <div class="section-block editable-field" id="rv-experience-section" ${editBtn('experienceJson','Experience','')}>${expHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
    <div class="t28-two">
      <div class="t28-col">
        <div class="t28-sec-title" style="color:${accent};">Skills</div>
        <div class="editable-field" ${editBtn('skillsJson','Skills',d.skillsJson||'[]')}>${skillsHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
        ${d.languages ? `<div class="t28-sec-title" style="color:${accent};margin-top:12px;">Languages</div><div class="editable-field" ${editBtn('languages','Languages',d.languages||'')}>${d.languages.split(',').map(l=>`<div class="t28-skill-text">${l.trim()}</div>`).join('')}<span class="edit-pen">✏</span></div>` : ''}
      </div>
      <div class="t28-col">
        <div class="t28-sec-title" style="color:${accent};">Education</div>
        <div class="section-block editable-field" ${editBtn('educationJson','Education','')}>${eduHTML}<span class="edit-pen" style="font-size:10px;">✏</span></div>
        ${projects.length ? `<div class="t28-sec-title" style="color:${accent};margin-top:12px;">Projects</div><div class="section-block editable-field" id="rv-projects-section" ${editBtn('projectsJson','Projects','')}>${projects.map(p=>`<div class="t28-edu-item"><div><div class="t28-edu-title" style="font-style:italic;">${p.title||p.name||''}</div><div class="t28-edu-sub">${p.tools||''}</div></div></div>`).join('')}<span class="edit-pen">✏</span></div>` : ''}
        ${buildExtraSections(accent)}
      </div>
    </div>
  </div>
</div>`;
}

// SIDE PANEL FIX — panels are now top-level DOM elements
// No stacking context interference from parent containers.
// Simply close on backdrop click, never close on panel click.
// ============================================================
document.addEventListener('DOMContentLoaded', function() {

    // Close panel when clicking the backdrop (outside panel)
    var backdrop = document.getElementById('sidePanelBackdrop');
    if (backdrop) {
        backdrop.addEventListener('click', function() {
            closeAllSidePanels();
        });
    }

    // Close panel when pressing Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeAllSidePanels();
    });
});
// Logout handler
async function doLogout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch(e) {}
    window.location.href = "/";
}
// ============================================================
// SECTION TOOLBAR — Edit + Delete button inside each section
// Safe approach: injects toolbar INSIDE section, never wraps parent
// ============================================================

// Known section IDs used across all templates → edit field + label
const RV_SECTIONS = [
    { id: 'rv-experience-section',   field: 'experienceJson', label: 'Career / Experience', canDelete: true  },
    { id: 'rv-projects-section',     field: 'projectsJson',   label: 'Projects',            canDelete: true  },
    { id: 'rv-edu-section',          field: 'educationJson',  label: 'Education',           canDelete: true  },
    { id: 'rv-section-certificates', field: 'certifications', label: 'Certifications',      canDelete: true  },
    { id: 'rv-section-experience',   field: 'experienceJson', label: 'Career / Experience', canDelete: true  },
    { id: 'rv-section-languages',    field: 'languages',      label: 'Languages',           canDelete: true  },
    { id: 'rv-section-tools',        field: 'tools',          label: 'Tools',               canDelete: true  },
    { id: 'rv-section-interests',    field: 'interests',      label: 'Interests',           canDelete: true  },
    { id: 'rv-section-portfolio',    field: 'portfolio',      label: 'Portfolio',           canDelete: true  },
];

// Heading text → field map for dynamic detection
const RV_HEADING_MAP = {
    'profile':                   { field: 'profileSummary', label: 'Profile',         canDelete: false },
    'profile summary':           { field: 'profileSummary', label: 'Profile',         canDelete: false },
    'professional summary':      { field: 'profileSummary', label: 'Profile',         canDelete: false },
    'summary':                   { field: 'profileSummary', label: 'Profile',         canDelete: false },
    'about me':                  { field: 'profileSummary', label: 'Profile',         canDelete: false },
    'about':                     { field: 'profileSummary', label: 'Profile',         canDelete: false },
    'objective':                 { field: 'profileSummary', label: 'Profile',         canDelete: false },
    'contact':                   { field: 'phone',          label: 'Contact',         canDelete: false },
    'contact me':                { field: 'phone',          label: 'Contact',         canDelete: false },
    'contact information':       { field: 'phone',          label: 'Contact',         canDelete: false },
    'career':                    { field: 'experienceJson', label: 'Career',          canDelete: true  },
    'experience':                { field: 'experienceJson', label: 'Experience',      canDelete: true  },
    'work experience':           { field: 'experienceJson', label: 'Experience',      canDelete: true  },
    'employment':                { field: 'experienceJson', label: 'Experience',      canDelete: true  },
    'employment history':        { field: 'experienceJson', label: 'Experience',      canDelete: true  },
    'professional experience':   { field: 'experienceJson', label: 'Experience',      canDelete: true  },
    'job experience':            { field: 'experienceJson', label: 'Experience',      canDelete: true  },
    'education':                 { field: 'educationJson',  label: 'Education',       canDelete: true  },
    'education learning':        { field: 'educationJson',  label: 'Education',       canDelete: true  },
    'education & learning':      { field: 'educationJson',  label: 'Education',       canDelete: true  },
    'academic':                  { field: 'educationJson',  label: 'Education',       canDelete: true  },
    'skills':                    { field: 'skillsJson',     label: 'Skills',          canDelete: true  },
    'technical skills':          { field: 'skillsJson',     label: 'Skills',          canDelete: true  },
    'key skills':                { field: 'skillsJson',     label: 'Skills',          canDelete: true  },
    'pro skills':                { field: 'skillsJson',     label: 'Skills',          canDelete: true  },
    'design skills':             { field: 'skillsJson',     label: 'Skills',          canDelete: true  },
    'projects':                  { field: 'projectsJson',   label: 'Projects',        canDelete: true  },
    'certifications':            { field: 'certifications', label: 'Certifications',  canDelete: true  },
    'certificates':              { field: 'certifications', label: 'Certifications',  canDelete: true  },
    'certification':             { field: 'certifications', label: 'Certifications',  canDelete: true  },
    'languages':                 { field: 'languages',      label: 'Languages',       canDelete: true  },
    'language':                  { field: 'languages',      label: 'Languages',       canDelete: true  },
    'awards':                    { field: 'awards',         label: 'Awards',          canDelete: true  },
    'awards honors':             { field: 'awards',         label: 'Awards',          canDelete: true  },
    'awards & honors':           { field: 'awards',         label: 'Awards',          canDelete: true  },
    'interests':                 { field: 'interests',      label: 'Interests',       canDelete: true  },
    'hobbies':                   { field: 'interests',      label: 'Interests',       canDelete: true  },
    'qualities':                 { field: 'qualities',      label: 'Qualities',       canDelete: true  },
    'tools':                     { field: 'tools',          label: 'Tools',           canDelete: true  },
    'tool':                      { field: 'tools',          label: 'Tools',           canDelete: true  },
    'follow me':                 { field: 'linkedin',       label: 'Social Links',    canDelete: true  },
    'social links':              { field: 'linkedin',       label: 'Social Links',    canDelete: true  },
    'references':                { field: 'references',     label: 'References',      canDelete: true  },
    'reference':                 { field: 'references',     label: 'References',      canDelete: true  },
    'professional skills':       { field: 'skillsJson',     label: 'Skills',          canDelete: true  },
    'position desired':          { field: 'jobTitle',       label: 'Position',        canDelete: false },
    'courses':                   { field: 'certifications', label: 'Courses',         canDelete: true  },
    'honors & awards':           { field: 'awards',         label: 'Awards',          canDelete: true  },
    'honors awards':             { field: 'awards',         label: 'Awards',          canDelete: true  },
    'interest':                  { field: 'interests',      label: 'Interests',       canDelete: true  },
    'contacts':                  { field: 'phone',          label: 'Contact',         canDelete: false },
    'personal info':             { field: 'phone',          label: 'Personal Info',   canDelete: false },
    'personal information':      { field: 'phone',          label: 'Personal Info',   canDelete: false },
};

let _rvUndoStack = [];
let _rvUndoTimer  = null;

const _EDIT_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const _DEL_SVG  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

function _makeToolbar(field, label, canDelete, sectionEl) {
    const tb = document.createElement('div');
    tb.className = 'rv-stb';
    tb.dataset.rvTb = '1';

    const editB = document.createElement('button');
    editB.className = 'rv-stb-btn rv-stb-edit';
    editB.innerHTML = `${_EDIT_SVG} Edit`;
    editB.title = 'Edit ' + label;
    editB.addEventListener('click', e => {
        e.stopPropagation();
        openEditModal(field, label, resumeData[field] || '');
    });
    tb.appendChild(editB);

    if (canDelete) {
        const delB = document.createElement('button');
        delB.className = 'rv-stb-btn rv-stb-del';
        delB.innerHTML = `${_DEL_SVG} Delete`;
        delB.title = 'Delete ' + label;
        delB.addEventListener('click', e => {
            e.stopPropagation();
            _rvDeleteSection(sectionEl, label);
        });
        tb.appendChild(delB);
    }
    return tb;
}

// Helper: strip emoji/icons and normalize text for heading map lookup
function _rvNormalizeHeading(text) {
    return (text || '')
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')   // remove emoji (unicode)
        .replace(/[^\x20-\x7E]/g, '')              // remove non-ASCII (catches more emoji/icons)
        .trim()
        .toLowerCase()
        .replace(/[^a-z\s&\/]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Helper: is this div element visually a section heading?
function _rvIsHeadingDiv(el) {
    if (!el || el.tagName !== 'DIV') return false;
    const style = el.getAttribute('style') || '';
    const isBold = /font-weight\s*:\s*(6|7|8|9)00/i.test(style);
    if (!isBold) return false;
    // Should be short text (heading, not a paragraph)
    const text = _rvNormalizeHeading(el.textContent || '');
    return text.length >= 2 && text.length <= 40;
}

function injectSectionToolbars() {
    const doc = document.getElementById('resumeDoc');
    if (!doc) return;

    // Remove old toolbars and reset hosts
    doc.querySelectorAll('.rv-stb').forEach(t => t.remove());
    doc.querySelectorAll('[data-rv-tb-host]').forEach(el => {
        el.style.position = '';
        el.style.outline  = '';
        delete el.dataset.rvTbHost;
    });
    doc.querySelectorAll('.rv-stb-group').forEach(g => {
        const parent = g.parentNode;
        while (g.firstChild) parent.insertBefore(g.firstChild, g);
        parent.removeChild(g);
    });

    const injected = new Set();

    // ── 1. Known IDs ──
    RV_SECTIONS.forEach(({ id, field, label, canDelete }) => {
        const el = document.getElementById(id);
        if (!el || injected.has(el)) return;
        const prev = el.previousElementSibling;
        const prevText = prev ? _rvNormalizeHeading(prev.textContent) : '';
        const isHeadingOutside = prev && RV_HEADING_MAP[prevText];
        if (isHeadingOutside) {
            const group = document.createElement('div');
            group.className = 'rv-stb-group';
            group.style.position = 'relative';
            el.parentNode.insertBefore(group, prev);
            group.appendChild(prev);
            group.appendChild(el);
            _injectIntoSection(group, field, label, canDelete);
            injected.add(group);
        } else {
            _injectIntoSection(el, field, label, canDelete);
            injected.add(el);
        }
    });

    // ── 2. section-block class ──
    doc.querySelectorAll('.section-block').forEach(el => {
        if (injected.has(el) || el.dataset.rvTbHost) return;
        const heading = el.querySelector('[style*="text-transform:uppercase"],[style*="text-transform: uppercase"],h2,h3,h4');
        if (!heading) return;
        const text = _rvNormalizeHeading(heading.textContent);
        const meta = RV_HEADING_MAP[text];
        if (!meta) return;
        _injectIntoSection(el, meta.field, meta.label, meta.canDelete);
        injected.add(el);
    });

    // ── 3. h2/h3/h4 and class-based headings ──
    doc.querySelectorAll('h2,h3,h4,[class*="section-title"],[class*="section-head"]').forEach(heading => {
        if (heading.closest('.rv-stb') || heading.closest('[data-rv-tb-host]')) return;
        const text = _rvNormalizeHeading(heading.textContent);
        const meta = RV_HEADING_MAP[text];
        if (!meta) return;
        const section = heading.parentElement;
        if (!section || section === doc || injected.has(section)) return;
        _injectIntoSection(section, meta.field, meta.label, meta.canDelete);
        injected.add(section);
    });

    // ── 4. Wrapper-div scan: heading div is first child of a parent container ──
    // Handles templates like brian where each section is wrapped in a div with
    // a bold heading div as first child followed by content divs
    doc.querySelectorAll('div').forEach(el => {
        if (injected.has(el) || el.dataset.rvTbHost) return;
        if (el.closest('.rv-stb') || el.closest('[data-rv-tb-host]')) return;
        const children = Array.from(el.children);
        if (children.length < 2) return;
        const firstChild = children[0];
        if (!_rvIsHeadingDiv(firstChild)) return;
        const text = _rvNormalizeHeading(firstChild.textContent);
        const meta = RV_HEADING_MAP[text];
        if (!meta) return;
        _injectIntoSection(el, meta.field, meta.label, meta.canDelete);
        injected.add(el);
    });

    // ── 5. Sibling scan: bold heading div followed by sibling content in same parent ──
    // Handles the most common template pattern: heading div + content div(s) as
    // siblings inside a column/panel div (john-purple, lacy, marina, and many others)
    doc.querySelectorAll('div').forEach(parentEl => {
        if (parentEl.closest('.rv-stb') || parentEl.closest('[data-rv-tb-host]')) return;
        const children = Array.from(parentEl.children);
        if (children.length < 2) return;

        for (let i = 0; i < children.length; i++) {
            const headingEl = children[i];
            if (!_rvIsHeadingDiv(headingEl)) continue;
            if (injected.has(headingEl)) continue;

            const text = _rvNormalizeHeading(headingEl.textContent);
            const meta = RV_HEADING_MAP[text];
            if (!meta) continue;

            // Collect the heading and following sibling(s) until the next heading or end
            const groupChildren = [headingEl];
            for (let j = i + 1; j < children.length; j++) {
                const sib = children[j];
                // Stop if we hit another heading
                if (_rvIsHeadingDiv(sib) && RV_HEADING_MAP[_rvNormalizeHeading(sib.textContent)]) break;
                groupChildren.push(sib);
            }
            if (groupChildren.length < 2) continue; // heading with no content — skip

            // Wrap heading + content into a group div and inject toolbar
            const group = document.createElement('div');
            group.className = 'rv-stb-group';
            group.style.position = 'relative';
            parentEl.insertBefore(group, headingEl);
            groupChildren.forEach(c => group.appendChild(c));

            _injectIntoSection(group, meta.field, meta.label, meta.canDelete);
            injected.add(group);

            // Adjust loop index: we consumed i..i+groupChildren.length-1, group now at i
            i = i - 1; // will be incremented by for loop, effectively staying at same position
            break; // re-scan this parent from fresh after DOM mutation
        }
    });
}

function _injectIntoSection(el, field, label, canDelete) {
    if (!el || el.dataset.rvTbHost) return;
    el.dataset.rvTbHost = '1';
    el.style.position = 'relative';

    const tb = _makeToolbar(field, label, canDelete, el);

    // Show/hide toolbar on hover
    el.addEventListener('mouseenter', () => {
        tb.style.opacity = '1';
        tb.style.pointerEvents = 'auto';
        el.style.outline = '2px dashed rgba(124,58,237,0.3)';
        el.style.borderRadius = '4px';
    });
    el.addEventListener('mouseleave', () => {
        tb.style.opacity = '0';
        tb.style.pointerEvents = 'none';
        el.style.outline = 'none';
    });

    // Start hidden
    tb.style.opacity = '0';
    tb.style.pointerEvents = 'none';

    // Insert as first child so it sits at top of section
    el.insertBefore(tb, el.firstChild);
}

function _rvMakeLineActions(field, label, index, canDelete, getValue, target) {
    const box = document.createElement('div');
    box.className = 'rv-line-actions';
    box.style.cssText = 'position:absolute;top:0;right:-8px;transform:translate(100%,-20%);display:flex;gap:6px;z-index:12;opacity:0;pointer-events:none;transition:opacity .16s ease;';

    const editBtnEl = document.createElement('button');
    editBtnEl.type = 'button';
    editBtnEl.textContent = 'Edit';
    editBtnEl.style.cssText = 'border:none;background:#f3ebff;color:#7c3aed;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(124,58,237,0.14);';
    editBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(field, label, getValue());
    });
    box.appendChild(editBtnEl);

    if (canDelete && index !== null && index !== undefined) {
        const delBtnEl = document.createElement('button');
        delBtnEl.type = 'button';
        delBtnEl.textContent = 'Delete';
        delBtnEl.style.cssText = 'border:none;background:#ffe8e8;color:#dc2626;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(239,68,68,0.12);';
        delBtnEl.addEventListener('click', (e) => {
            e.stopPropagation();
            removeExactItem(field, Number(index));
        });
        box.appendChild(delBtnEl);
    }

    const showBox = () => {
        box.style.opacity = '1';
        box.style.pointerEvents = 'auto';
    };
    const hideBox = (evt) => {
        if (evt?.relatedTarget && (target.contains(evt.relatedTarget) || box.contains(evt.relatedTarget))) return;
        box.style.opacity = '0';
        box.style.pointerEvents = 'none';
    };

    target.addEventListener('mouseenter', showBox);
    target.addEventListener('mouseleave', hideBox);
    box.addEventListener('mouseenter', showBox);
    box.addEventListener('mouseleave', hideBox);
    target.appendChild(box);
}

function injectLineItemControls() {
    const doc = document.getElementById('resumeDoc');
    if (!doc) return;

    doc.querySelectorAll('.rv-line-actions').forEach(el => el.remove());
    doc.querySelectorAll('[data-rv-line-host]').forEach(el => delete el.dataset.rvLineHost);

    const exactCandidates = Array.from(doc.querySelectorAll('[data-rv-line-field]'));
    exactCandidates.forEach(node => {
        if (!node.isConnected || node.dataset.rvLineHost) return;
        if (node.closest('.rv-section-toolbar, .rv-line-actions')) return;
        if (node.querySelector('[data-rv-line-field]')) return;
        node.dataset.rvLineHost = '1';
        if (!node.style.position || node.style.position === 'static') node.style.position = 'relative';
        const field = node.dataset.rvLineField || '';
        const label = node.dataset.rvLineLabel || field;
        const index = node.dataset.rvLineIndex ?? null;
        const canDelete = node.dataset.rvLineDelete === '1';
        _rvMakeLineActions(field, label, index, canDelete, () => node.innerText.trim(), node);
    });
}

function _rvDeleteSection(el, label) {
    if (!el) return;
    // If el is inside an rv-stb-group, delete the group (heading + section together)
    const group = el.closest('.rv-stb-group');
    const target = group || el;

    const parent = target.parentNode;
    const nextSib = target.nextSibling;
    const deletedField = _rvFieldForLabel(label);
    const previousValue = deletedField ? resumeData[deletedField] : undefined;
    if (deletedField) {
        resumeData[deletedField] = _rvEmptyValueForField(deletedField);
        persistField(deletedField, resumeData[deletedField]);
    }

    // Animate out
    target.style.transition = 'opacity 0.25s ease, max-height 0.3s ease, padding 0.3s ease, margin 0.3s ease';
    target.style.overflow = 'hidden';
    target.style.maxHeight = target.scrollHeight + 'px';
    requestAnimationFrame(() => {
        target.style.opacity = '0';
        target.style.maxHeight = '0';
        target.style.padding = '0';
        target.style.margin = '0';
    });
    setTimeout(() => { target.style.display = 'none'; }, 320);

    // Sync activeSections + checkbox if applicable
    const key = label.toLowerCase();
    if (activeSections.hasOwnProperty(key)) {
        activeSections[key] = false;
        const cb = document.querySelector(`#addSectionList input[onchange*="${key}"]`);
        if (cb) cb.checked = false;
    }

    _rvUndoStack.push({ el: target, parent, nextSib, label, deletedField, previousValue });
    _rvShowUndoToast(label);
}

function _rvFieldForLabel(label) {
    const key = (label || '').toLowerCase();
    if (key.includes('experience') || key.includes('career') || key.includes('employment')) return 'experienceJson';
    if (key.includes('project')) return 'projectsJson';
    if (key.includes('education') || key.includes('academic')) return 'educationJson';
    if (key.includes('skill')) return 'skillsJson';
    if (key.includes('cert') || key.includes('course')) return 'certifications';
    if (key.includes('language')) return 'languages';
    if (key.includes('award') || key.includes('honor')) return 'awards';
    if (key.includes('interest') || key.includes('hobby') || key.includes('hobbi')) return 'interests';
    if (key.includes('portfolio') || key.includes('social') || key.includes('link') || key.includes('follow')) return 'website';
    if (key.includes('reference')) return 'references';
    if (key.includes('tool')) return 'tools';
    if (key.includes('qualit')) return 'qualities';
    return null;
}

function _rvEmptyValueForField(field) {
    return ['experienceJson', 'projectsJson', 'educationJson', 'skillsJson'].includes(field) ? '[]' : '';
}

// Also ensure 'tools' field triggers a section delete properly by treating it as a text field
// (already handled above by returning '')


function _rvUndoDelete() {
    if (!_rvUndoStack.length) return;
    const { el, parent, nextSib, label, deletedField, previousValue } = _rvUndoStack.pop();
    if (deletedField) {
        resumeData[deletedField] = previousValue;
        persistField(deletedField, previousValue);
    }

    el.style.display = '';
    el.style.opacity = '1';
    el.style.maxHeight = '';
    el.style.padding = '';
    el.style.margin = '';
    el.style.overflow = '';

    if (nextSib) parent.insertBefore(el, nextSib);
    else parent.appendChild(el);

    // Restore activeSections
    const key = label.toLowerCase();
    if (activeSections.hasOwnProperty(key)) {
        activeSections[key] = true;
        const cb = document.querySelector(`#addSectionList input[onchange*="${key}"]`);
        if (cb) cb.checked = true;
    }

    _rvHideUndoToast();
    if (_rvUndoStack.length) _rvShowUndoToast(_rvUndoStack[_rvUndoStack.length-1].label);
}

function _rvShowUndoToast(label) {
    clearTimeout(_rvUndoTimer);
    let toast = document.getElementById('rvUndoToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'rvUndoToast';
        toast.style.cssText = [
            'position:fixed','bottom:28px','left:50%',
            'transform:translateX(-50%) translateY(16px)',
            'background:#1a1a2e','color:#fff',
            'padding:11px 18px','border-radius:12px',
            'font-size:13px','font-weight:600',
            'display:flex','align-items:center','gap:12px',
            'z-index:99999','opacity:0',
            'transition:opacity 0.22s,transform 0.22s',
            'box-shadow:0 4px 24px rgba(0,0,0,0.28)',
            'white-space:nowrap'
        ].join(';');
        toast.innerHTML = `
            <span id="rvUndoMsg"></span>
            <button id="rvUndoBtn" style="background:#7c3aed;border:none;color:#fff;padding:4px 13px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Undo</button>
            <button onclick="document.getElementById('rvUndoToast').style.opacity=0" style="background:transparent;border:none;color:rgba(255,255,255,0.5);font-size:18px;cursor:pointer;line-height:1;padding:0 2px;">✕</button>`;
        document.body.appendChild(toast);
        document.getElementById('rvUndoBtn').addEventListener('click', _rvUndoDelete);
    }
    document.getElementById('rvUndoMsg').textContent = `"${label}" deleted`;
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    _rvUndoTimer = setTimeout(() => {
        _rvHideUndoToast();
        _rvUndoStack = [];
    }, 6000);
}

function _rvHideUndoToast() {
    const toast = document.getElementById('rvUndoToast');
    if (!toast) return;
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(16px)';
}

// ============================================================
// TEMPLATE GALLERY EXACT LAYOUT RESTORE
// Templates 11-52 already exist on the gallery page with distinct
// structure/alignment. Reuse that exact markup and only inject the
// per-template CSS rules into review so these templates do not collapse
// into the generic color-only renderer.
// ============================================================
function shouldUseExactGalleryTemplate(templateId) {
    return false;
}

function ensureExactTemplateStylesInjected() {
    if (document.getElementById('reviewExactTemplateStyles')) return;
    if (!templatePageMarkup) return;

    // Inject the full style content from the largest style block on the template page
    // This gives us all resume-t1 through resume-t52 CSS rules for thumbnail rendering
    const styleTags = Array.from(templatePageMarkup.querySelectorAll('style'));
    const largest = styleTags.sort((a, b) => (b.textContent || '').length - (a.textContent || '').length)[0];
    if (!largest) return;

    const style = document.createElement('style');
    style.id = 'reviewExactTemplateStyles';
    style.textContent = largest.textContent || '';
    document.head.appendChild(style);
}

function renderExactGalleryTemplate(doc, ctx, templateId) {
    if (!templatePageMarkup || !shouldUseExactGalleryTemplate(templateId)) return false;

    ensureExactTemplateStylesInjected();

    const normalized = normalizeReviewTemplate(templateId);
    const exactId = resolveExactTemplateId(templateId);

    const source = templatePageMarkup.querySelector(
        `.tpl-card[data-template="${exactId}"] .tpl-preview-inner > div > [class^="resume-t"], ` +
        `.tpl-card[data-template="${exactId}"] .tpl-preview-inner > div > .resume-frame, ` +
        `.tpl-card[data-template="${exactId}"] .tpl-preview-inner [class^="resume-t"], ` +
        `.tpl-card[data-template="${exactId}"] .tpl-preview-inner .resume-frame`
    );
    if (!source) return false;

    const clone = source.cloneNode(true);
    hydrateExactGalleryTemplate(clone, ctx);
    doc.innerHTML = '';
    doc.dataset.exactTemplate = 'true';
    doc.dataset.exactTemplateId = exactId;
    doc.dataset.selectedTemplate = normalized;
    doc.appendChild(clone);
    return true;
}

// ============================================================
// EXACT TEMPLATE OVERRIDES
// Keep gallery template layout intact, but always inject builder data,
// append missing builder sections, and avoid demo-data leftovers.
// ============================================================
function buildExactSectionContent(field, label, ctx) {
    const d = ctx.resumeData || {};
    const wrapStyle = 'display:flex;flex-direction:column;gap:10px;margin-top:10px;';
    const itemStyle = 'font-size:12px;line-height:1.7;color:inherit;cursor:pointer;';

    if (field === 'profileSummary') {
        const summary = d.profileSummary || 'Add profile summary';
        return `<div style="${wrapStyle}">${makeExactEditableLine('profileSummary', 'Profile Summary', summary, { style: itemStyle })}</div>`;
    }

    if (field === 'phone') {
        const contacts = [
            { field: 'phone', value: d.phone || '' },
            { field: 'email', value: d.email || '' },
            { field: 'address', value: d.address || d.location || '' },
            { field: 'linkedin', value: d.linkedin || '' },
            { field: 'website', value: d.website || '' }
        ].filter(item => item.value);

        if (!contacts.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine('phone', 'Contact', 'Add contact details', { style: itemStyle })}</div>`;
        }

        return `<div style="${wrapStyle}">${contacts.map(item =>
            makeExactEditableLine(item.field, 'Contact', item.value, { style: itemStyle })
        ).join('')}</div>`;
    }

    if (field === 'skillsJson') {
        const skills = (ctx.skills || []).map(skill => {
            if (typeof skill === 'string') return { name: skill, level: '' };
            return {
                name: skill.name || skill.skill || '',
                level: typeof skill.level === 'number' ? `${skill.level}%` : String(skill.level || '')
            };
        }).filter(skill => skill.name);

        if (!skills.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine('skillsJson', 'Skills', 'Add skills', { style: itemStyle })}</div>`;
        }

        return `<div style="${wrapStyle}">${skills.map((skill, index) =>
            makeExactEditableLine(
                'skillsJson',
                'Skills',
                [skill.name, skill.level].filter(Boolean).join(' - '),
                { style: itemStyle, deleteButton: makeExactDeleteButton('skillsJson', index) }
            )
        ).join('')}</div>`;
    }

    if (field === 'educationJson') {
        const items = ctx.edu || [];
        if (!items.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine('educationJson', 'Education', 'Add education', { style: itemStyle })}</div>`;
        }

        return `<div style="${wrapStyle}">${items.map((item, index) => {
            const line = [
                item.degree || item.field || '',
                item.school || item.university || '',
                item.year || item.startYear || ''
            ].filter(Boolean).join(' - ') || 'Education';

            return makeExactEditableLine('educationJson', 'Education', line, {
                style: itemStyle,
                deleteButton: makeExactDeleteButton('educationJson', index)
            });
        }).join('')}</div>`;
    }

    if (field === 'experienceJson') {
        const items = ctx.experience || [];
        if (!items.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine('experienceJson', 'Experience', 'Add experience', { style: itemStyle })}</div>`;
        }

        return `<div style="${wrapStyle}">${items.map((item, index) => {
            const date = [item.startDate || item.from || '', item.endDate || item.to || ''].filter(Boolean).join(' - ');
            const line = [
                item.jobTitle || item.role || item.title || '',
                item.company || '',
                date
            ].filter(Boolean).join(' | ');

            return makeExactEditableLine('experienceJson', 'Experience', line || 'Experience', {
                style: itemStyle,
                deleteButton: makeExactDeleteButton('experienceJson', index)
            });
        }).join('')}</div>`;
    }

    if (field === 'projectsJson') {
        const items = ctx.projects || [];
        if (!items.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine('projectsJson', 'Projects', 'Add projects', { style: itemStyle })}</div>`;
        }

        return `<div style="${wrapStyle}">${items.map((item, index) => {
            const line = [
                item.title || item.name || '',
                item.tools || item.url || item.year || '',
                item.description || ''
            ].filter(Boolean).join(' | ');

            return makeExactEditableLine('projectsJson', 'Projects', line || 'Project', {
                style: itemStyle,
                deleteButton: makeExactDeleteButton('projectsJson', index)
            });
        }).join('')}</div>`;
    }

    if (['certifications', 'languages', 'awards', 'interests', 'qualities', 'tools'].includes(field)) {
        const entries = splitExactSimpleEntries(d[field] || '');
        if (!entries.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine(field, label, `Add ${label.toLowerCase()}`, { style: itemStyle })}</div>`;
        }

        return `<div style="${wrapStyle}">${entries.map((entry, index) =>
            makeExactEditableLine(field, label, entry, {
                style: itemStyle,
                deleteButton: makeExactDeleteButton(field, index)
            })
        ).join('')}</div>`;
    }

    if (field === 'website' || field === 'linkedin') {
        const links = [
            { field: 'website', value: d.website || '' },
            { field: 'linkedin', value: d.linkedin || '' }
        ].filter(item => item.value);

        if (!links.length) {
            return `<div style="${wrapStyle}">${makeExactEditableLine('website', label, 'Add links', { style: itemStyle })}</div>`;
        }

        return `<div style="${wrapStyle}">${links.map(item =>
            makeExactEditableLine(item.field, label, item.value, { style: itemStyle })
        ).join('')}</div>`;
    }

    return '';
}

function appendMissingExactSections(root, ctx) {
    const d = ctx.resumeData || {};
    const targetCandidates = Array.from(root.querySelectorAll('*')).filter(node => {
        const cls = node.className || '';
        return typeof cls === 'string'
            && /(body|right|content|br|main|column)/i.test(cls)
            && !/(top|header|photo|avatar|contact|strip|left|info)/i.test(cls);
    });

    let target = targetCandidates[targetCandidates.length - 1]
        || root.querySelector('[class*="body"]')
        || root.querySelector('[class*="content"]')
        || root;

    if (target && target.children.length === 1 && target.firstElementChild && !target.firstElementChild.id) {
        target = target.firstElementChild;
    }

    const hasContentForField = (field) => {
        if (field === 'profileSummary') return !!(d.profileSummary || '').trim();
        if (field === 'phone') return !![d.phone, d.email, d.address || d.location, d.linkedin, d.website].filter(Boolean).length;
        if (field === 'skillsJson') return (ctx.skills || []).length > 0;
        if (field === 'educationJson') return (ctx.edu || []).length > 0;
        if (field === 'experienceJson') return (ctx.experience || []).length > 0;
        if (field === 'projectsJson') return (ctx.projects || []).length > 0;
        if (field === 'languages') return splitExactSimpleEntries(d.languages || '').length > 0;
        if (field === 'certifications') return splitExactSimpleEntries(d.certifications || '').length > 0;
        if (field === 'awards') return splitExactSimpleEntries(d.awards || '').length > 0;
        if (field === 'interests') return splitExactSimpleEntries(d.interests || '').length > 0;
        if (field === 'qualities') return splitExactSimpleEntries(d.qualities || '').length > 0;
        if (field === 'tools') return splitExactSimpleEntries(d.tools || '').length > 0;
        if (field === 'website') return !!((d.website || '').trim() || (d.linkedin || '').trim());
        return false;
    };

    const sections = [
        { key: 'profile', field: 'profileSummary', label: 'Profile Summary' },
        { key: 'contact', field: 'phone', label: 'Contact' },
        { key: 'experience', field: 'experienceJson', label: 'Experience' },
        { key: 'projects', field: 'projectsJson', label: 'Projects' },
        { key: 'education', field: 'educationJson', label: 'Education' },
        { key: 'skills', field: 'skillsJson', label: 'Skills' },
        { key: 'certificates', field: 'certifications', label: 'Certifications' },
        { key: 'languages', field: 'languages', label: 'Languages' },
        { key: 'awards', field: 'awards', label: 'Awards' },
        { key: 'interests', field: 'interests', label: 'Interests' },
        { key: 'tools', field: 'tools', label: 'Tools' },
        { key: 'qualities', field: 'qualities', label: 'Qualities' },
        { key: 'portfolio', field: 'website', label: 'Portfolio' }
    ];

    sections.forEach(sectionMeta => {
        const sectionId = exactSectionIdForField(sectionMeta.field);
        const shouldShow = Object.prototype.hasOwnProperty.call(activeSections, sectionMeta.key)
            ? activeSections[sectionMeta.key] === true
            : hasContentForField(sectionMeta.field);

        if (!shouldShow || root.querySelector('#' + sectionId)) return;

        const section = document.createElement('div');
        section.id = sectionId;
        section.className = 'section-block rv-exact-appended';
        section.style.cssText = 'margin-top:18px;';
        section.innerHTML = `
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:currentColor;border-bottom:2px solid rgba(124,58,237,0.45);padding-bottom:5px;margin-bottom:10px;">${esc(sectionMeta.label)}</div>
            <div class="rv-exact-body">${buildExactSectionContent(sectionMeta.field, sectionMeta.label, ctx)}</div>
        `;
        target.appendChild(section);
    });
}

function ensureExactCoreSections(root, ctx) {
    const d = ctx.resumeData || {};
    const targetCandidates = Array.from(root.querySelectorAll('*')).filter(node => {
        const cls = node.className || '';
        return typeof cls === 'string'
            && /(body|right|content|br|main|column)/i.test(cls)
            && !/(top|header|photo|avatar|contact|strip|left|info)/i.test(cls);
    });

    let target = targetCandidates[targetCandidates.length - 1]
        || root.querySelector('[class*="body"]')
        || root.querySelector('[class*="content"]')
        || root;

    if (target && target.children.length === 1 && target.firstElementChild && !target.firstElementChild.id) {
        target = target.firstElementChild;
    }

    const requiredSections = [
        { field: 'profileSummary', label: 'Profile Summary', show: !!(d.profileSummary || '').trim() },
        { field: 'phone', label: 'Contact', show: !![d.phone, d.email, d.address || d.location, d.linkedin, d.website].filter(Boolean).length },
        { field: 'experienceJson', label: 'Experience', show: (ctx.experience || []).length > 0 },
        { field: 'projectsJson', label: 'Projects', show: (ctx.projects || []).length > 0 },
        { field: 'educationJson', label: 'Education', show: (ctx.edu || []).length > 0 },
        { field: 'skillsJson', label: 'Skills', show: (ctx.skills || []).length > 0 }
    ];

    requiredSections.forEach(sectionMeta => {
        if (!sectionMeta.show) return;
        const sectionId = exactSectionIdForField(sectionMeta.field);
        if (root.querySelector('#' + sectionId)) return;

        const section = document.createElement('div');
        section.id = sectionId;
        section.className = 'section-block rv-exact-appended rv-core-section';
        section.style.cssText = 'margin-top:18px;';
        section.innerHTML = `
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:currentColor;border-bottom:2px solid rgba(124,58,237,0.45);padding-bottom:5px;margin-bottom:10px;">${esc(sectionMeta.label)}</div>
            <div class="rv-exact-body">${buildExactSectionContent(sectionMeta.field, sectionMeta.label, ctx)}</div>
        `;
        target.appendChild(section);
    });
}

function hydrateExactGalleryTemplate(root, ctx) {
    const d = ctx.resumeData || {};

    // ── 1. Photo / avatar ──────────────────────────────────────────
    fillExactTemplatePhoto(root, d);

    // ── 2. Full name ───────────────────────────────────────────────
    fillExactTemplateText(root, /(^|[\s-])name([-\s]|$)/i, d.fullName || 'Your Name', {
        field: 'fullName',
        label: 'Full Name',
        limit: 4,
        skip: node => /(edu-name|job-title|project-title|field-label|section-title|sec-title)/i.test(node.className || '')
    });

    // ── 3. Job title / role ────────────────────────────────────────
    const roleBadges = collectExactTemplateNodes(root, node => {
        const cls = node.className || '';
        return typeof cls === 'string' && /role-badge/i.test(cls);
    });
    if (roleBadges.length) {
        roleBadges.forEach((node, index) => {
            if (index === 0) {
                node.textContent = d.jobTitle || 'Professional';
                attachRvLineMeta(node, 'jobTitle', 'Job Title', null, false);
            } else {
                node.style.display = 'none';
            }
        });
    } else {
        fillExactTemplateText(root,
            /(^|[\s-])role([-\s]|$)|(^|[\s-])(job-title|position|subtitle)([-\s]|$)/i,
            d.jobTitle || 'Professional', {
                field: 'jobTitle',
                label: 'Job Title',
                limit: 3,
                skip: node => /(sec-title|section-title|title-l|title-r|sec-title-l|sec-title-r|exp|timeline)/i.test(node.className || '')
            });
    }

    // ── 4. Profile summary ─────────────────────────────────────────
    if (d.profileSummary) {
        fillExactTemplateText(root, /(bio|summary|quote-box|profile-text|about-text)/i, d.profileSummary, {
            field: 'profileSummary', label: 'Profile Summary', limit: 2,
            skip: node => /(sec-title|title)/i.test(node.className || '')
        });
        // Profile strip (some templates have a dedicated strip element)
        collectExactTemplateNodes(root, node => {
            const cls = node.className || '';
            return typeof cls === 'string' && /profile-strip/i.test(cls);
        }).forEach(stripNode => {
            const last = stripNode.lastElementChild;
            if (last) last.textContent = d.profileSummary;
        });
    } else {
        // Hide any summary/about-me sections if no data
        collectExactTemplateNodes(root, node => {
            const cls = node.className || '';
            return typeof cls === 'string' && /(bio|summary|quote-box|profile-text|about-text)/.test(cls) &&
                   !/(sec-title|section-title|title)/.test(cls) && node.children.length === 0;
        }).forEach(node => { node.closest('[class*="section"], [class*="body"]') || (node.textContent = ''); });
    }

    // ── 5. Contact fields ──────────────────────────────────────────
    fillExactTemplatePersonalFields(root, d);
    fillExactTemplateContacts(root, d);

    // ── 6. Hide demo-only non-resume sections (logos, "worked with", etc.) ──
    collectExactTemplateNodes(root, node => {
        const cls = node.className || '';
        return typeof cls === 'string' && /(logo-row|logo|worked-with|clients-list)/i.test(cls) &&
               !/(sec-title|section-title)/.test(cls);
    }).forEach(node => { node.style.display = 'none'; });

    // ── 7. Populate all recognised sections (edu, exp, skills, etc.) ──
    populateExactTemplateSections(root, ctx);

    // ── 8. Remove leftover demo text / sections ────────────────────
    removeExactDemoSections(root, ctx);

    // ── 9. Ensure core sections are present even if template lacks headings ──
    ensureExactCoreSections(root, ctx);
    appendMissingExactSections(root, ctx);

    // ── 10. Final pass: remove any nodes still showing obvious demo placeholder text ──
    const demoNames = /\b(jeremy clifford|robyn kingsley|nina patel|martina rodler|john smith|alex carter|marina wilkinson|saurabh rathore|andrew bolton|kate bishop|rick tang|caroline smith|amanda griffith|hani husamuddin|derek jane|brian r|kelly white|adeline palmerston|olivia sanchez|chidi eze|william robartson|paul waulson|lorna alvarado|richard sanchez|olivia wilson|maanvita kumari|herper russo|andrea gillis|firstname lastname|your name|position title|company name|job position|lorem ipsum)\b/i;
    collectExactTemplateNodes(root, node => {
        if (node.children.length > 0) return false;
        const cls = (node.className || '').toString();
        if (/(section-title|sec-title|plan-badge|preview-overlay|btn-preview)/i.test(cls)) return false;
        return demoNames.test(node.textContent || '');
    }).forEach(node => {
        // Only replace if we have actual builder data for this type
        const txt = (node.textContent || '').trim().toLowerCase();
        if (/lorem ipsum/.test(txt)) { node.textContent = ''; return; }
        if (d.fullName && /firstname|your name|john smith|jeremy|robyn|nina|alex carter|marina|saurabh|andrew|kate bishop|rick tang|caroline|amanda|hani|derek|brian|kelly|adeline|olivia|chidi|william|paul|lorna|richard|maanvita|herper|andrea|alex wenger/i.test(txt)) {
            node.textContent = d.fullName;
            attachRvLineMeta(node, 'fullName', 'Full Name', null, false);
        }
    });
}

// Final override: keep generic template rendering stable, but split it into
// multiple layout families so templates do not collapse into the same structure.
function buildImageBasedTemplate({ resumeData: d, edu, skills, projects, experience, color }, templateId) {
    const num = parseInt(String(templateId || '').replace('template', ''), 10) || 1;
    const themeMap = {
        1:  { bg: '#4b1fa8', sidebar: '#4b1fa8', dark: true  },
        2:  { bg: '#6b7280', sidebar: '#eef2f7', dark: false },
        3:  { bg: '#d97706', sidebar: '#fff7ed', dark: false },
        4:  { bg: '#f59e0b', sidebar: '#1a1a2e', dark: true  },
        5:  { bg: '#1a1a2e', sidebar: '#1a1a2e', dark: true  },
        6:  { bg: '#7c3aed', sidebar: '#7c3aed', dark: true  },
        7:  { bg: '#0f766e', sidebar: '#0f766e', dark: true  },
        8:  { bg: '#f97316', sidebar: '#fff7ed', dark: false },
        9:  { bg: '#166534', sidebar: '#166534', dark: true  },
        10: { bg: '#f59e0b', sidebar: '#fff7ed', dark: false },
        11: { bg: '#4b1fa8', sidebar: '#4b1fa8', dark: true  },
        12: { bg: '#f43f5e', sidebar: '#fff1f2', dark: false },
        13: { bg: '#7c3aed', sidebar: '#f5f3ff', dark: false },
        14: { bg: '#1e3a5f', sidebar: '#1e3a5f', dark: true  },
        15: { bg: '#1a1a2e', sidebar: '#f9fafb', dark: false },
        16: { bg: '#3d5a3e', sidebar: '#ecfdf5', dark: false },
        17: { bg: '#c084fc', sidebar: '#fdf4ff', dark: false },
        18: { bg: '#0284c7', sidebar: '#e0f2fe', dark: false },
        19: { bg: '#a78bfa', sidebar: '#faf5ff', dark: false },
        20: { bg: '#0284c7', sidebar: '#0284c7', dark: true  },
        21: { bg: '#1e3a5f', sidebar: '#eff6ff', dark: false },
        22: { bg: '#166534', sidebar: '#ecfdf5', dark: false },
        23: { bg: '#f97316', sidebar: '#fff7ed', dark: false },
        24: { bg: '#4d7c0f', sidebar: '#f7fee7', dark: false },
        25: { bg: '#06b6d4', sidebar: '#1a1a2e', dark: true  },
        26: { bg: '#f59e0b', sidebar: '#fff7ed', dark: false },
        27: { bg: '#1e3a5f', sidebar: '#f0f4f8', dark: false },
        28: { bg: '#f43f5e', sidebar: '#fff5f5', dark: false },
        29: { bg: '#0d9488', sidebar: '#f0fdfa', dark: false },
        30: { bg: '#475569', sidebar: '#f8fafc', dark: false },
        31: { bg: '#4f46e5', sidebar: '#4f46e5', dark: true  },
        32: { bg: '#1a2a4a', sidebar: '#f5f0e8', dark: false },
        33: { bg: '#1a3a4a', sidebar: '#1a3a4a', dark: true  },
        34: { bg: '#1e2d40', sidebar: '#1e2d40', dark: true  },
        35: { bg: '#1d3557', sidebar: '#1d3557', dark: true  },
        36: { bg: '#2d4a3e', sidebar: '#ecfdf5', dark: false },
        37: { bg: '#374151', sidebar: '#f9fafb', dark: false },
        38: { bg: '#2d3f6c', sidebar: '#eef2ff', dark: false },
        39: { bg: '#00bcd4', sidebar: '#ffffff', dark: false },
        40: { bg: '#3d4d8a', sidebar: '#eef2ff', dark: false },
        41: { bg: '#1d3557', sidebar: '#f5f7fa', dark: false },
        42: { bg: '#1d3557', sidebar: '#1d3557', dark: true  },
        43: { bg: '#2d2d2d', sidebar: '#2d2d2d', dark: true  },
        44: { bg: '#2563eb', sidebar: '#ffffff', dark: false },
        45: { bg: '#c9a065', sidebar: '#faf8f4', dark: false },
        46: { bg: '#1a5f5a', sidebar: '#e6fffb', dark: false },
        47: { bg: '#1a5fb4', sidebar: '#f5f7fa', dark: false },
        48: { bg: '#00b3c6', sidebar: '#ffffff', dark: false },
        49: { bg: '#2563eb', sidebar: '#f5f7fa', dark: false },
        50: { bg: '#2d3748', sidebar: '#f8fafc', dark: false },
        51: { bg: '#1a1a2e', sidebar: '#ffffff', dark: false },
        52: { bg: '#1a1a2e', sidebar: '#ffffff', dark: false }
    };

    const theme = themeMap[num] || { bg: '#1e3a5f', sidebar: '#1e3a5f', dark: true };
    const accent = color || theme.bg;
    const sidebarBg = theme.dark ? accent : theme.sidebar;
    const sidebarText = theme.dark ? 'rgba(255,255,255,0.92)' : '#334155';
    const sidebarMuted = theme.dark ? 'rgba(255,255,255,0.62)' : '#64748b';
    const panelBg = theme.dark ? '#ffffff' : (theme.sidebar || '#f8fafc');

    const name = d.fullName || '';
    const title = d.jobTitle || '';
    const email = d.email || '';
    const phone = d.phone || '';
    const addr = d.address || d.location || '';
    const website = d.website || '';
    const linkedin = d.linkedin || '';
    const summary = d.profileSummary || '';

    const photoSize = d.photoSize || 88;
    const photoBR = d.photoShape === 'square' ? '10px' : '50%';
    const photoBorder = theme.dark ? 'rgba(255,255,255,0.35)' : `${accent}33`;
    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBR};object-fit:cover;border:3px solid ${photoBorder};display:block;cursor:pointer;">`
        : `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${photoBR};display:flex;align-items:center;justify-content:center;background:${theme.dark ? 'rgba(255,255,255,0.12)' : `${accent}18`};color:${theme.dark ? '#fff' : accent};font-size:28px;font-weight:700;border:3px solid ${photoBorder};cursor:pointer;">${(name || 'U').trim().charAt(0).toUpperCase()}</div>`;

    const secHead = (t) => `<div style="font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid ${accent};padding-bottom:3px;margin:16px 0 10px;">${t}</div>`;
    const sideHead = (t) => `<div style="font-size:10px;font-weight:800;color:${theme.dark ? 'rgba(255,255,255,0.72)' : '#64748b'};text-transform:uppercase;letter-spacing:1px;margin:14px 0 7px;">${t}</div>`;

    const contactHTML = [
        phone ? `<div class="editable-field" style="cursor:pointer;" ${editBtn('phone','Phone',phone)}>${phone} <span class="edit-pen">✏</span></div>` : '',
        email ? `<div class="editable-field" style="cursor:pointer;word-break:break-all;" ${editBtn('email','Email',email)}>${email} <span class="edit-pen">✏</span></div>` : '',
        addr ? `<div class="editable-field" style="cursor:pointer;" ${editBtn('address','Address',addr)}>${addr} <span class="edit-pen">✏</span></div>` : '',
        linkedin ? `<div class="editable-field" style="cursor:pointer;word-break:break-all;" ${editBtn('linkedin','LinkedIn',linkedin)}>${linkedin} <span class="edit-pen">✏</span></div>` : '',
        website ? `<div class="editable-field" style="cursor:pointer;word-break:break-all;" ${editBtn('website','Website',website)}>${website} <span class="edit-pen">✏</span></div>` : ''
    ].filter(Boolean).join('');

    const skillBars = skills.length
        ? skills.map(s => {
            const sn = typeof s === 'string' ? s : (s.name || s.skill || '');
            const pct = (typeof s === 'object' && typeof s.level === 'number') ? s.level : 80;
            return `<div style="margin-bottom:8px;">
                <div style="font-size:10px;color:${sidebarText};margin-bottom:2px;display:flex;justify-content:space-between;"><span>${sn}</span><span style="font-size:9px;opacity:0.7;">${pct}%</span></div>
                <div style="height:4px;background:${theme.dark ? 'rgba(255,255,255,0.18)' : `${accent}18`};border-radius:2px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${theme.dark ? 'rgba(255,255,255,0.75)' : accent};border-radius:2px;"></div>
                </div>
            </div>`;
        }).join('')
        : `<div style="font-size:10px;color:${sidebarMuted};">Add skills</div>`;

    const skillTags = skills.length
        ? skills.map(s => {
            const sn = typeof s === 'string' ? s : (s.name || s.skill || '');
            return `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 8px;border-radius:999px;background:${accent}12;color:${accent};font-size:10px;font-weight:700;">${sn}</span>`;
        }).join('')
        : `<div style="font-size:10px;color:#94a3b8;">Add skills</div>`;

    const eduHTML = edu.length
        ? edu.map(e => `<div style="margin-bottom:12px;">
            <div style="font-size:12px;font-weight:700;color:${theme.dark ? '#fff' : '#0f172a'};">${e.degree || ''}</div>
            <div style="font-size:11px;color:${theme.dark ? sidebarMuted : '#555'};">${e.school || e.university || ''}</div>
            <div style="font-size:10px;color:${theme.dark ? 'rgba(255,255,255,0.5)' : '#9ca3af'};">${e.year || e.from || ''}</div>
        </div>`).join('')
        : '';

    const experienceHTML = experience.length
        ? experience.map(e => `<div style="margin-bottom:16px;">
            <div style="font-size:13px;font-weight:700;color:${accent};">${e.jobTitle || e.role || e.title || ''}</div>
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">${e.company || ''}${e.company && (e.startDate || e.from || e.endDate || e.to) ? ' • ' : ''}${e.startDate || e.from || ''}${(e.startDate || e.from || e.endDate || e.to) ? ' - ' : ''}${e.endDate || e.to || ((e.startDate || e.from) ? 'Present' : '')}</div>
            <div style="font-size:11px;color:#374151;line-height:1.65;">${(e.description || e.bullets || '').toString().split('\n').filter(Boolean).map(b => `• ${b.replace(/^[•\\-]\\s*/, '')}`).join('<br>')}</div>
        </div>`).join('')
        : '';

    const projectsHTML = projects.length
        ? projects.map(p => `<div style="margin-bottom:12px;">
            <div style="font-size:12px;font-weight:700;color:${accent};">${p.title || p.name || ''}</div>
            ${p.tools ? `<div style="font-size:11px;color:#888;">Tools: ${p.tools}</div>` : ''}
            <div style="font-size:11px;color:#374151;line-height:1.6;">${(p.description || '').split('\n').filter(Boolean).map(b => `• ${b}`).join('<br>')}</div>
        </div>`).join('')
        : '';

    const languagesHTML = d.languages
        ? d.languages.split(',').map(l => `<div style="font-size:10px;margin-bottom:3px;">• ${l.trim()}</div>`).join('')
        : `<div style="font-size:10px;color:${theme.dark ? sidebarMuted : '#94a3b8'};">Add languages</div>`;

    const summaryBlock = summary
        ? `<div class="editable-field section-block" style="font-size:12px;color:#555;line-height:1.7;cursor:pointer;" ${editBtn('profileSummary','Profile Summary',summary)}>${summary} <span class="edit-pen">✏</span></div>`
        : '';
    const experienceBlock = `<div class="section-block" id="rv-experience-section"><div class="editable-field" ${editBtn('experienceJson','Experience','')}>${experienceHTML || `<div style="font-size:11px;color:#9ca3af;cursor:pointer;">Add work experience ✏</div>`}<span class="edit-pen" style="font-size:10px;">✏</span></div></div>`;
    const projectsBlock = projectsHTML ? `<div class="section-block" id="rv-projects-section"><div class="editable-field" ${editBtn('projectsJson','Projects','')}>${projectsHTML}<span class="edit-pen">✏</span></div></div>` : '';
    const certBlock = d.certifications ? `<div class="editable-field section-block" style="font-size:12px;color:#374151;line-height:1.7;cursor:pointer;" ${editBtn('certifications','Certifications',d.certifications || '')}>${d.certifications} <span class="edit-pen">✏</span></div>` : '';
    const awardsBlock = d.awards ? `<div class="editable-field section-block" style="font-size:12px;color:#374151;line-height:1.7;cursor:pointer;" ${editBtn('awards','Awards',d.awards || '')}>${d.awards} <span class="edit-pen">✏</span></div>` : '';

    const classicNums = [2, 8, 10, 13, 15, 21, 27, 32, 37, 41, 47, 49];
    const topBandNums = [12, 17, 19, 23, 28, 29, 39, 48, 51, 52];
    const cardNums = [16, 18, 22, 24, 30, 36, 38, 40, 46, 50];

    let layoutMode = 'sidebar';
    if (classicNums.includes(num)) layoutMode = 'classic';
    if (topBandNums.includes(num)) layoutMode = 'topband';
    if (cardNums.includes(num)) layoutMode = 'cards';

    if (layoutMode === 'classic') {
        return `<div style="width:660px;min-height:980px;background:#fff;font-family:inherit;padding:22px 22px 26px;">
            <div style="padding-bottom:12px;border-bottom:3px solid ${accent};">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;">
                    <div style="flex:1;min-width:0;">
                        <div class="editable-field" style="font-size:28px;font-weight:900;color:#0f172a;cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
                        <div class="editable-field" style="font-size:12px;color:${accent};font-weight:800;letter-spacing:1px;text-transform:uppercase;cursor:pointer;margin-top:4px;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
                    </div>
                    <div class="editable-field" style="cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:10px 16px;margin-top:12px;font-size:11px;color:#475569;">${contactHTML || `<div class="editable-field" style="cursor:pointer;" ${editBtn('email','Email','')}>Add contact <span class="edit-pen">✏</span></div>`}</div>
            </div>
            ${summaryBlock ? `${secHead('Profile')}${summaryBlock}` : ''}
            <div style="display:flex;gap:22px;align-items:flex-start;">
                <div style="width:200px;flex-shrink:0;">
                    ${secHead('Education')}
                    <div class="editable-field section-block" style="cursor:pointer;font-size:11px;color:#374151;" ${editBtn('educationJson','Education','')}>${eduHTML || `<div style="font-size:10px;color:#9ca3af;">Add education</div>`}<span class="edit-pen">✏</span></div>
                    ${secHead('Skills')}
                    <div class="editable-field section-block" style="cursor:pointer;" ${editBtn('skillsJson','Skills',d.skillsJson || '[]')}>${skillTags}<span class="edit-pen">✏</span></div>
                    ${secHead('Languages')}
                    <div class="editable-field section-block" style="cursor:pointer;font-size:10px;color:#475569;line-height:1.8;" ${editBtn('languages','Languages',d.languages || '')}>${languagesHTML}<span class="edit-pen">✏</span></div>
                </div>
                <div style="flex:1;min-width:0;">
                    ${secHead('Experience')}
                    ${experienceBlock}
                    ${projectsBlock ? `${secHead('Projects')}${projectsBlock}` : ''}
                    ${certBlock ? `${secHead('Certifications')}${certBlock}` : ''}
                    ${awardsBlock ? `${secHead('Awards')}${awardsBlock}` : ''}
                    ${buildExtraSections(accent)}
                </div>
            </div>
        </div>`;
    }

    if (layoutMode === 'topband') {
        return `<div style="width:660px;min-height:980px;background:#fff;font-family:inherit;">
            <div style="padding:26px 28px 20px;background:linear-gradient(135deg, ${accent} 0%, ${theme.dark ? '#1f2937' : `${accent}aa`} 100%);color:#fff;position:relative;overflow:hidden;">
                <div style="position:absolute;right:-28px;top:-34px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,0.08);"></div>
                <div style="position:absolute;left:-20px;bottom:-46px;width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,0.06);"></div>
                <div style="display:flex;align-items:center;gap:18px;position:relative;z-index:1;">
                    <div class="editable-field" style="cursor:pointer;" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
                    <div style="flex:1;min-width:0;">
                        <div class="editable-field" style="font-size:28px;font-weight:900;cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
                        <div class="editable-field" style="font-size:12px;opacity:0.85;letter-spacing:1px;text-transform:uppercase;cursor:pointer;margin-top:4px;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
                        <div style="margin-top:12px;font-size:10px;line-height:1.8;">${contactHTML || `<div class="editable-field" style="cursor:pointer;" ${editBtn('email','Email','')}>Add contact <span class="edit-pen">✏</span></div>`}</div>
                    </div>
                </div>
            </div>
            <div style="display:flex;min-height:770px;">
                <div style="width:230px;flex-shrink:0;background:${theme.dark ? '#f8fafc' : panelBg};padding:22px 18px;">
                    ${summaryBlock ? `${sideHead('Profile')}${summaryBlock}` : ''}
                    ${sideHead('Skills')}
                    <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills',d.skillsJson || '[]')}>${skillTags}<span class="edit-pen">✏</span></div>
                    ${sideHead('Education')}
                    <div class="editable-field section-block" style="cursor:pointer;font-size:11px;color:#334155;" ${editBtn('educationJson','Education','')}>${eduHTML || `<div style="font-size:10px;color:#94a3b8;">Add education</div>`}<span class="edit-pen">✏</span></div>
                    ${sideHead('Languages')}
                    <div class="editable-field section-block" style="cursor:pointer;font-size:10px;color:#475569;line-height:1.8;" ${editBtn('languages','Languages',d.languages || '')}>${languagesHTML}<span class="edit-pen">✏</span></div>
                </div>
                <div style="flex:1;min-width:0;padding:22px 20px;">
                    ${secHead('Experience')}
                    ${experienceBlock}
                    ${projectsBlock ? `${secHead('Projects')}${projectsBlock}` : ''}
                    ${certBlock ? `${secHead('Certifications')}${certBlock}` : ''}
                    ${awardsBlock ? `${secHead('Awards')}${awardsBlock}` : ''}
                    ${buildExtraSections(accent)}
                </div>
            </div>
        </div>`;
    }

    if (layoutMode === 'cards') {
        return `<div style="width:660px;min-height:980px;background:#fff;font-family:inherit;">
            <div style="display:flex;align-items:stretch;min-height:170px;">
                <div style="width:235px;flex-shrink:0;background:${accent};padding:24px 18px;color:#fff;">
                    <div class="editable-field" style="cursor:pointer;display:flex;justify-content:center;margin-bottom:10px;" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
                    <div class="editable-field" style="font-size:24px;font-weight:900;text-align:center;cursor:pointer;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen">✏</span></div>
                    <div class="editable-field" style="font-size:11px;opacity:0.8;text-align:center;cursor:pointer;margin-top:5px;letter-spacing:1px;text-transform:uppercase;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
                </div>
                <div style="flex:1;padding:24px 20px 18px;background:#fff;">
                    ${summaryBlock ? `${secHead('Profile Summary')}${summaryBlock}` : `${secHead('Contact')}<div class="editable-field section-block" style="font-size:11px;color:#475569;line-height:1.8;cursor:pointer;" ${editBtn('email','Email','')}>${contactHTML || 'Add contact'} <span class="edit-pen">✏</span></div>`}
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:18px;">
                <div style="background:${theme.dark ? '#f8fafc' : panelBg};padding:16px;border-top:4px solid ${accent};">
                    ${secHead('Contact')}
                    <div class="editable-field section-block" style="font-size:11px;color:#475569;line-height:1.8;cursor:pointer;" ${editBtn('email','Email','')}>${contactHTML || 'Add contact'} <span class="edit-pen">✏</span></div>
                    ${secHead('Skills')}
                    <div class="editable-field section-block" style="cursor:pointer;" ${editBtn('skillsJson','Skills',d.skillsJson || '[]')}>${skillBars}<span class="edit-pen">✏</span></div>
                    ${secHead('Education')}
                    <div class="editable-field section-block" style="cursor:pointer;font-size:11px;color:#334155;" ${editBtn('educationJson','Education','')}>${eduHTML || `<div style="font-size:10px;color:#94a3b8;">Add education</div>`}<span class="edit-pen">✏</span></div>
                </div>
                <div style="background:#fff;padding:16px;border-top:4px solid ${accent};">
                    ${secHead('Experience')}
                    ${experienceBlock}
                    ${projectsBlock ? `${secHead('Projects')}${projectsBlock}` : ''}
                    ${d.languages ? `${secHead('Languages')}<div class="editable-field section-block" style="cursor:pointer;font-size:10px;color:#475569;line-height:1.8;" ${editBtn('languages','Languages',d.languages || '')}>${languagesHTML}<span class="edit-pen">✏</span></div>` : ''}
                    ${certBlock ? `${secHead('Certifications')}${certBlock}` : ''}
                    ${awardsBlock ? `${secHead('Awards')}${awardsBlock}` : ''}
                    ${buildExtraSections(accent)}
                </div>
            </div>
        </div>`;
    }

    return `<div style="display:flex;min-height:1040px;font-family:inherit;background:#fff;width:660px;">
        <div style="width:210px;flex-shrink:0;background:${sidebarBg};padding:24px 16px;display:flex;flex-direction:column;align-items:center;">
            <div class="editable-field" style="cursor:pointer;text-align:center;" ${editBtn('profilePhoto','Profile Photo','')}>${photoHTML}</div>
            <div class="editable-field" style="font-size:18px;font-weight:900;color:${theme.dark ? '#fff' : '#0f172a'};text-align:center;margin-bottom:3px;cursor:pointer;width:100%;" ${editBtn('fullName','Full Name',name)}>${name} <span class="edit-pen" style="font-size:12px;">✏</span></div>
            <div class="editable-field" style="font-size:11px;color:${sidebarMuted};text-align:center;margin-bottom:16px;cursor:pointer;width:100%;" ${editBtn('jobTitle','Job Title',title)}>${title} <span class="edit-pen">✏</span></div>
            ${sideHead('Contact')}
            <div style="width:100%;font-size:10px;color:${sidebarText};line-height:2;">${contactHTML || `<div style="font-size:10px;color:${sidebarMuted};cursor:pointer;" ${editBtn('phone','Phone','')}>Add contact ✏</div>`}</div>
            ${sideHead('Skills')}
            <div class="editable-field" style="width:100%;cursor:pointer;" ${editBtn('skillsJson','Skills',d.skillsJson || '[]')}>${skillBars}<span class="edit-pen" style="font-size:10px;color:${sidebarMuted};">✏</span></div>
            ${sideHead('Education')}
            <div class="section-block editable-field" style="width:100%;cursor:pointer;font-size:10px;color:${sidebarText};" ${editBtn('educationJson','Education','')}>${eduHTML || `<div style="color:${sidebarMuted};">Add education ✏</div>`}<span class="edit-pen">✏</span></div>
            ${sideHead('Languages')}
            <div class="editable-field" style="width:100%;font-size:10px;color:${sidebarText};cursor:pointer;line-height:1.9;" ${editBtn('languages','Languages',d.languages || '')}>${languagesHTML}<span class="edit-pen">✏</span></div>
        </div>
        <div style="flex:1;padding:20px 18px;background:#fff;min-width:0;">
            ${summaryBlock ? `${secHead('Profile Summary')}${summaryBlock}` : ''}
            ${secHead('Experience')}
            ${experienceBlock}
            ${projectsBlock ? `${secHead('Projects')}${projectsBlock}` : ''}
            ${certBlock ? `${secHead('Certifications')}${certBlock}` : ''}
            ${awardsBlock ? `${secHead('Awards & Honors')}${awardsBlock}` : ''}
            ${buildExtraSections(accent)}
        </div>
    </div>`;
}
// ============================================================
// TEMPLATE 10: YELLOW WAVE — resume-t10
// ============================================================
function buildTemplate10Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#f59e0b';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const linkedin= d.linkedin || '';
    const website = d.website || '';
    const summary = d.profileSummary || '';

    const photoHTML = d.profilePhotoData
        ? `<img src="${d.profilePhotoData}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:4px solid #fff;box-shadow:0 4px 16px rgba(0,0,0,.2);cursor:pointer;" class="editable-field" ${editBtn('profilePhoto','Profile Photo','')}>`
        : `<div class="t10-avatar-ph" style="background:linear-gradient(135deg,${accent},#d97706);" ${editBtn('profilePhoto','Profile Photo','')}>${(name||'U').charAt(0).toUpperCase()}</div>`;

    const skillBars = skills.length
        ? skills.map(s => {
            const sn = typeof s === 'string' ? s : (s.name || s.skill || '');
            const pct = (typeof s === 'object' && typeof s.level === 'number') ? s.level : 80;
            return `<div class="t10-skill-bar">
              <div class="t10-skill-bar-label"><span>${sn}</span><span>${pct}%</span></div>
              <div class="t10-skill-track"><div class="t10-skill-fill" style="width:${pct}%;background:linear-gradient(90deg,${accent},#fbbf24);"></div></div>
            </div>`;
          }).join('')
        : `<div style="color:#d1d5db;font-size:10px;">Add skills ✏</div>`;

    const expHTML = experience.length
        ? experience.map(e => `<div class="t10-exp-row">
            <div class="t10-exp-left-col">${e.startDate||e.from||''}<br><span style="color:#888;">${e.endDate||e.to||'Present'}</span></div>
            <div class="t10-exp-right-col">
              <div class="t10-exp-job">${e.jobTitle||e.role||e.title||''}</div>
              <div class="t10-exp-company">${e.company||''}</div>
              <div class="t10-exp-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div>
            </div>
          </div>`).join('')
        : `<div style="font-size:10px;color:#888;">Add experience ✏</div>`;

    const projHTML = projects.length
        ? projects.map(p => `<div style="margin-bottom:10px;">
            <div style="font-size:11px;font-weight:800;color:#1a1a2e;">${p.title||p.name||''}</div>
            ${p.tools?`<div style="font-size:10px;color:#888;">Tools: ${p.tools}</div>`:''}
            <div style="font-size:10px;color:#555;line-height:1.5;">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
          </div>`).join('')
        : '';

    const contactItems = [phone,email,addr,linkedin,website].filter(Boolean).join(' &nbsp;·&nbsp; ');

    return `<div class="resume-t10">
      <div class="t10-top-wave"></div>
      <div class="t10-top-dark"></div>
      <div class="t10-header">
        <div class="t10-avatar">${photoHTML}</div>
        <div class="t10-header-text">
          <div class="t10-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
          <div class="t10-role editable-field" style="cursor:pointer;" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}>${title}</div>
        </div>
      </div>
      <div class="t10-body">
        ${summary?`<div class="t10-profile-section">
          <div class="t10-section-title">Profile Summary</div>
          <div class="t10-about editable-field" style="cursor:pointer;" ${editBtn('profileSummary','Profile Summary',d.profileSummary||'')}>${summary}</div>
        </div>`:''}
        <div class="t10-main-cols">
          <div class="t10-exp-col">
            <div class="t10-exp-title">Experience</div>
            <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expHTML}</div>
            ${projects.length?`<div class="t10-exp-title" style="margin-top:14px;">Projects</div>
            <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projHTML}</div>`:''}
          </div>
          <div style="width:180px;flex-shrink:0;padding-left:16px;">
            <div class="t10-exp-title">Education</div>
            ${edu.map(e=>`<div style="margin-bottom:10px;">
              <div style="font-size:11px;font-weight:800;color:#1a1a2e;">${e.degree||''}</div>
              <div style="font-size:10px;color:#555;">${e.school||e.university||''}</div>
              <div style="font-size:10px;color:#9ca3af;">${e.year||''}</div>
            </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="t10-bottom-dark">
        <div class="t10-skills-title">Skills</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillBars}</div>
      </div>
      <div class="t10-footer">
        ${phone?`<div class="t10-footer-item">📞 ${phone}</div>`:''}
        ${email?`<div class="t10-footer-item">✉ ${email}</div>`:''}
        ${addr?`<div class="t10-footer-item">📍 ${addr}</div>`:''}
        ${linkedin?`<div class="t10-footer-item">🔗 ${linkedin}</div>`:''}
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 11: VIVID CREATIVE — resume-t11
// ============================================================
function buildTemplate11Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#7c3aed';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const summary = d.profileSummary || '';

    const skillItems = skills.map(s => {
        const sn = typeof s === 'string' ? s : (s.name || s.skill || '');
        return `<div class="t11-skill">${sn}</div>`;
    }).join('');

    const expItems = experience.map(e => `<div class="t11-job">
        <div class="t11-job-title">${e.jobTitle||e.role||e.title||''}</div>
        <div class="t11-job-co" style="color:${accent};">${e.company||''} ${e.startDate||e.from?`· ${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}`:''}
        </div>
        <div class="t11-job-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div>
    </div>`).join('');

    const projItems = projects.map(p => `<div class="t11-job">
        <div class="t11-job-title">${p.title||p.name||''}</div>
        ${p.tools?`<div class="t11-job-co" style="color:${accent};">Tools: ${p.tools}</div>`:''}
        <div class="t11-job-desc">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
    </div>`).join('');

    return `<div class="resume-t11">
      <div class="t11-header" style="background:linear-gradient(135deg,#1a1a2e 0%,${accent} 100%);">
        <div class="t11-blobs">
          <div class="t11-blob1"></div><div class="t11-blob2"></div><div class="t11-blob3"></div>
        </div>
        <div class="t11-avatar" style="background:linear-gradient(135deg,#e040fb,${accent});">${(name||'U').charAt(0).toUpperCase()}</div>
        <div class="t11-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
        <div class="t11-role editable-field" style="cursor:pointer;color:#e0b0ff;" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}>${title}</div>
        <div class="t11-contact-row">
          ${phone?`<span>📞 ${phone}</span>`:''}${email?`<span>✉ ${email}</span>`:''}${addr?`<span>📍 ${addr}</span>`:''}
        </div>
      </div>
      <div class="t11-body">
        <div class="t11-left">
          ${skills.length?`<div class="t11-sec"><div class="t11-sec-title" style="color:${accent};border-color:${accent};">Skills</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillItems}</div></div>`:''}
          ${edu.length?`<div class="t11-sec"><div class="t11-sec-title" style="color:${accent};border-color:${accent};">Education</div>
          ${edu.map(e=>`<div style="margin-bottom:8px;"><div style="font-size:11px;font-weight:800;color:#1a1a2e;">${e.degree||''}</div><div style="font-size:10px;color:${accent};">${e.school||e.university||''}</div><div style="font-size:10px;color:#888;">${e.year||''}</div></div>`).join('')}</div>`:''}
          ${d.languages?`<div class="t11-sec"><div class="t11-sec-title" style="color:${accent};border-color:${accent};">Languages</div>
          <div style="font-size:10px;color:#555;">${d.languages}</div></div>`:''}
        </div>
        <div class="t11-right">
          ${summary?`<div class="t11-sec"><div class="t11-sec-title" style="color:${accent};border-color:${accent};">Profile</div>
          <div class="editable-field" style="font-size:10px;color:#555;line-height:1.6;cursor:pointer;" ${editBtn('profileSummary','Profile Summary',d.profileSummary||'')}>${summary}</div></div>`:''}
          ${expItems?`<div class="t11-sec"><div class="t11-sec-title" style="color:${accent};border-color:${accent};">Experience</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expItems}</div></div>`:''}
          ${projItems?`<div class="t11-sec"><div class="t11-sec-title" style="color:${accent};border-color:${accent};">Projects</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div></div>`:''}
        </div>
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 12: NORDIC CORAL — resume-t12
// ============================================================
function buildTemplate12Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#e8645a';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const summary = d.profileSummary || '';

    const expItems = experience.map(e => `<div class="t12-item">
        <div class="t12-item-title">${e.jobTitle||e.role||e.title||''}</div>
        <div class="t12-item-sub">${e.company||''} ${e.startDate||e.from?`· ${e.startDate||e.from} – ${e.endDate||e.to||'Present'}`:''}
        </div>
        <div style="font-size:10px;color:#555;margin-top:3px;line-height:1.5;">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div>
    </div>`).join('');

    const projItems = projects.map(p => `<div class="t12-item">
        <div class="t12-item-title">${p.title||p.name||''}</div>
        ${p.tools?`<div class="t12-item-sub">Tools: ${p.tools}</div>`:''}
        <div style="font-size:10px;color:#555;margin-top:2px;">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
    </div>`).join('');

    const skillItems = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        return `<div class="t12-skill">${sn}</div>`;
    }).join('');

    return `<div class="resume-t12">
      <div class="t12-top">
        <div class="t12-top-left">
          <div class="t12-bloba"></div><div class="t12-blobb"></div><div class="t12-blobgray"></div>
          <div class="t12-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
          <div class="t12-role editable-field" style="cursor:pointer;" ${editBtn('jobTitle','Job Title',d.jobTitle||'')}>${title}</div>
          <div class="t12-contact-mini">${[phone,email,addr].filter(Boolean).join(' · ')}</div>
        </div>
        <div class="t12-top-right" style="background:linear-gradient(135deg,${accent} 0%,#f48fb1 100%);">
          <div class="t12-photo-ph">${(name||'U').charAt(0).toUpperCase()}</div>
        </div>
      </div>
      ${summary?`<div class="t12-profile-strip" style="background:${accent};">
        <span class="t12-profile-strip-title">Profile</span>
        <span class="editable-field" style="cursor:pointer;" ${editBtn('profileSummary','Profile Summary',d.profileSummary||'')}>${summary}</span>
      </div>`:''}
      <div class="t12-body">
        <div class="t12-bl">
          ${edu.length?`<div class="t12-sec-title" style="color:${accent};border-color:${accent};">Education</div>
          ${edu.map(e=>`<div class="t12-item"><div class="t12-item-title">${e.degree||''}</div><div class="t12-item-sub">${e.school||e.university||''} ${e.year?`· ${e.year}`:''}</div></div>`).join('')}`:''}
          ${skills.length?`<div class="t12-sec-title" style="color:${accent};border-color:${accent};">Skills</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillItems}</div>`:''}
          ${d.languages?`<div class="t12-sec-title" style="color:${accent};border-color:${accent};">Languages</div>
          <div style="font-size:10px;color:#555;">${d.languages}</div>`:''}
        </div>
        <div class="t12-br">
          ${expItems?`<div class="t12-sec-title" style="color:${accent};border-color:${accent};">Experience</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expItems}</div>`:''}
          ${projItems?`<div class="t12-sec-title" style="color:${accent};border-color:${accent};">Projects</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div>`:''}
        </div>
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 13: PURPLE SOFT — resume-t13
// ============================================================
function buildTemplate13Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#9c27b0';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const summary = d.profileSummary || '';

    const skillBars = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        const pct = (typeof s==='object'&&typeof s.level==='number')?s.level:80;
        return `<div class="t13-skill-row">
          <div class="t13-skill-name">${sn}</div>
          <div class="t13-skill-track"><div class="t13-skill-fill" style="width:${pct}%;background:linear-gradient(90deg,${accent},#673ab7);"></div></div>
        </div>`;
    }).join('');

    const expItems = experience.map(e=>`<div class="t13-job">
        <div class="t13-job-title">${e.jobTitle||e.role||e.title||''}</div>
        <div class="t13-job-co" style="color:${accent};">${e.company||''} ${e.startDate||e.from?`· ${e.startDate||e.from} – ${e.endDate||e.to||'Present'}`:''}
        </div>
        <div class="t13-job-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div>
    </div>`).join('');

    const projItems = projects.map(p=>`<div class="t13-job">
        <div class="t13-job-title">${p.title||p.name||''}</div>
        ${p.tools?`<div class="t13-job-co" style="color:${accent};">Tools: ${p.tools}</div>`:''}
        <div class="t13-job-desc">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
    </div>`).join('');

    return `<div class="resume-t13">
      <div class="t13-top">
        <div class="t13-photo" style="background:linear-gradient(135deg,${accent},#673ab7);border-color:${accent};">${(name||'U').charAt(0).toUpperCase()}</div>
        <div class="t13-top-info">
          <div class="t13-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
          <div class="t13-role" style="color:${accent};">${title}</div>
          <div class="t13-contact">${[phone,email].filter(Boolean).join(' · ')}</div>
        </div>
        <div class="t13-contact-r">${[addr].filter(Boolean).join('<br>')}</div>
      </div>
      <div class="t13-body">
        <div class="t13-left">
          ${summary?`<div class="t13-sec-title" style="color:${accent};border-color:${accent};">Profile</div>
          <div style="font-size:10px;color:#555;line-height:1.6;">${summary}</div>`:''}
          ${skills.length?`<div class="t13-sec-title" style="color:${accent};border-color:${accent};">Skills</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillBars}</div>`:''}
          ${d.languages?`<div class="t13-sec-title" style="color:${accent};border-color:${accent};">Languages</div>
          ${d.languages.split(',').map(l=>`<div class="t13-lang-box">${l.trim()}</div>`).join('')}`:''}
        </div>
        <div class="t13-right">
          ${expItems?`<div class="t13-sec-title" style="color:${accent};border-color:${accent};">Experience</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expItems}</div>`:''}
          ${projItems?`<div class="t13-sec-title" style="color:${accent};border-color:${accent};">Projects</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div>`:''}
          ${edu.length?`<div class="t13-sec-title" style="color:${accent};border-color:${accent};">Education</div>
          ${edu.map(e=>`<div class="t13-edu"><div class="t13-edu-deg">${e.degree||''}</div><div class="t13-edu-uni">${e.school||e.university||''} ${e.year?`· ${e.year}`:''}</div></div>`).join('')}`:''}
        </div>
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 14: NAVY TIMELINE — resume-t14
// ============================================================
function buildTemplate14Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#1c2a4a';
    const gold   = '#c8a96e';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const summary = d.profileSummary || '';

    const skillBars = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        const pct = (typeof s==='object'&&typeof s.level==='number')?s.level:80;
        return `<div class="t14-skill-row">
          <span>${sn}</span>
          <div class="t14-skill-bar"><div class="t14-skill-fill" style="width:${pct}%;"></div></div>
        </div>`;
    }).join('');

    const expItems = experience.map(e=>`<div class="t14-timeline-item">
        <div class="t14-tl-year"><span class="t14-year-badge">${(e.startDate||e.from||'').split('-')[0]||''}</span></div>
        <div class="t14-tl-dot" style="background:${gold};"></div>
        <div class="t14-tl-content">
          <div class="t14-tl-title">${e.jobTitle||e.role||e.title||''}</div>
          <div class="t14-tl-co" style="color:${gold};">${e.company||''}</div>
          <div class="t14-tl-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).slice(0,2).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div>
        </div>
    </div>`).join('');

    const projItems = projects.map(p=>`<div class="t14-timeline-item">
        <div class="t14-tl-year"></div>
        <div class="t14-tl-dot" style="background:${gold};"></div>
        <div class="t14-tl-content">
          <div class="t14-tl-title">${p.title||p.name||''}</div>
          ${p.tools?`<div class="t14-tl-co" style="color:${gold};">Tools: ${p.tools}</div>`:''}
        </div>
    </div>`).join('');

    return `<div class="resume-t14">
      <div class="t14-left">
        <div class="t14-photo" style="background:linear-gradient(135deg,#4a90d9,#7c3aed);border-color:${gold};">${(name||'U').charAt(0).toUpperCase()}</div>
        <div class="t14-name-l editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
        <div class="t14-role-l" style="color:#4a90d9;">${title}</div>
        <div class="t14-contact-item">📞 ${phone||''}</div>
        <div class="t14-contact-item">✉ ${email||''}</div>
        ${addr?`<div class="t14-contact-item">📍 ${addr}</div>`:''}
        ${skills.length?`<div class="t14-sec-l"><div class="t14-sec-title-l" style="border-color:${gold};">Skills</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillBars}</div></div>`:''}
        ${edu.length?`<div class="t14-sec-l"><div class="t14-sec-title-l" style="border-color:${gold};">Education</div>
        ${edu.map(e=>`<div style="margin-bottom:8px;"><div style="font-size:11px;font-weight:800;color:#1a1a2e;">${e.degree||''}</div><div style="font-size:10px;color:#777;">${e.school||e.university||''}</div><div style="font-size:10px;color:#aaa;">${e.year||''}</div></div>`).join('')}</div>`:''}
      </div>
      <div class="t14-right" style="background:${accent};">
        ${summary?`<div class="t14-sec-r"><div class="t14-sec-title-r" style="color:${gold};">Profile</div>
        <div class="t14-tl-desc" style="color:#aab;">${summary}</div></div>`:''}
        ${expItems?`<div class="t14-sec-r"><div class="t14-sec-title-r" style="color:${gold};">Experience</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expItems}</div></div>`:''}
        ${projItems?`<div class="t14-sec-r"><div class="t14-sec-title-r" style="color:${gold};">Projects</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div></div>`:''}
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 15: CLASSIC MONO — resume-t15
// ============================================================
function buildTemplate15Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = '#1a237e';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const summary = d.profileSummary || '';

    const expItems = experience.map(e=>`<div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;">
          <div><div class="t15-org">${e.company||''}</div>
          <div class="t15-pos">${e.jobTitle||e.role||e.title||''}</div></div>
          <div class="t15-date">${(e.startDate||e.from||'').split('-')[0]||''} – ${(e.endDate||e.to||'Present').split('-')[0]||'Present'}</div>
        </div>
        ${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t15-bullet"><span>•</span><span>${b.replace(/^[•\-]\s*/,'')}</span></div>`).join('')}
    </div>`).join('');

    const projItems = projects.map(p=>`<div style="margin-bottom:10px;">
        <div class="t15-org">${p.title||p.name||''}</div>
        ${p.tools?`<div class="t15-pos">Tools: ${p.tools}</div>`:''}
        ${(p.description||'').split('\n').filter(Boolean).map(b=>`<div class="t15-bullet"><span>•</span><span>${b}</span></div>`).join('')}
    </div>`).join('');

    const skillItems = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        return `<div class="t15-skill">${sn}</div>`;
    }).join('');

    return `<div class="resume-t15">
      <div class="t15-top">
        <div class="t15-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
        ${title?`<div style="font-size:11px;color:${accent};font-weight:700;text-align:center;margin-top:3px;">${title}</div>`:''}
        <div class="t15-contact-row">
          ${phone?`<span>${phone}</span><span class="t15-sep">|</span>`:''}
          ${email?`<span>${email}</span>`:''}
          ${addr?`<span class="t15-sep">|</span><span>${addr}</span>`:''}
        </div>
      </div>
      <div class="t15-body">
        <div class="t15-left">
          ${edu.length?`<div class="t15-sec-title">Education</div>
          ${edu.map(e=>`<div style="margin-bottom:10px;"><div class="t15-org">${e.school||e.university||''}</div><div class="t15-pos">${e.degree||''}</div><div class="t15-date">${e.year||''}</div></div>`).join('')}`:''}
          ${skills.length?`<div class="t15-sec-title">Skills</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillItems}</div>`:''}
          ${d.languages?`<div class="t15-sec-title">Languages</div>
          <div class="t15-cert">${d.languages}</div>`:''}
        </div>
        <div class="t15-right">
          ${summary?`<div class="t15-sec-title">Profile Summary</div>
          <div style="font-size:10px;color:#555;line-height:1.6;margin-bottom:10px;">${summary}</div>`:''}
          ${expItems?`<div class="t15-sec-title">Experience</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expItems}</div>`:''}
          ${projItems?`<div class="t15-sec-title">Projects</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div>`:''}
        </div>
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 16: DARK KHAKI — resume-t16
// ============================================================
function buildTemplate16Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#3d5246';
    const gold   = '#b5a47a';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const summary = d.profileSummary || '';

    const skillBars = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        const pct = (typeof s==='object'&&typeof s.level==='number')?s.level:80;
        return `<div class="t16-skill-row">
          <div class="t16-skill-name">${sn}</div>
          <div class="t16-skill-track"><div class="t16-skill-fill" style="width:${pct}%;background:linear-gradient(90deg,${accent},#6d8b74);"></div></div>
        </div>`;
    }).join('');

    const expItems = experience.map(e=>`<div class="t16-exp-item">
        <div class="t16-exp-year">${(e.startDate||e.from||'').split('-')[0]||''} – ${(e.endDate||e.to||'Present').split('-')[0]||'Pres'}</div>
        <div class="t16-exp-co">${e.company||''}</div>
        <div class="t16-exp-role">${e.jobTitle||e.role||e.title||''}</div>
        <div class="t16-exp-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).slice(0,2).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join(' ')}</div>
    </div>`).join('');

    const projItems = projects.map(p=>`<div class="t16-exp-item">
        <div class="t16-exp-co">${p.title||p.name||''}</div>
        ${p.tools?`<div class="t16-exp-role">Tools: ${p.tools}</div>`:''}
    </div>`).join('');

    const eduHTML = edu.map(e=>`<div style="margin-bottom:8px;">
        <div class="t16-edu-year">${e.year||''}</div>
        <div class="t16-edu-deg">${e.degree||''}</div>
        <div class="t16-edu-uni">${e.school||e.university||''}</div>
    </div>`).join('');

    return `<div class="resume-t16">
      <div class="t16-left" style="background:#2d3a2e;">
        <div class="t16-left-top">
          <div class="t16-photo" style="background:linear-gradient(135deg,#6d8b74,#a0b89a);">${(name||'U').charAt(0).toUpperCase()}</div>
          <div class="t16-name editable-field" style="cursor:pointer;color:#fff;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
          <div class="t16-role" style="color:${gold};">${title}</div>
          ${summary?`<div class="t16-bio">${summary.substring(0,100)}...</div>`:''}
        </div>
        <div class="t16-sec-title" style="background:#3d5246;color:${gold};">Contact</div>
        <div class="t16-left-content">
          ${phone?`<div class="t16-contact">📞 ${phone}</div>`:''}
          ${email?`<div class="t16-contact">✉ ${email}</div>`:''}
          ${addr?`<div class="t16-contact">📍 ${addr}</div>`:''}
        </div>
        ${skills.length?`<div class="t16-sec-title" style="background:#3d5246;color:${gold};">Skills</div>
        <div class="t16-left-content editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillBars}</div>`:''}
        ${expItems?`<div class="t16-sec-title" style="background:#3d5246;color:${gold};">Experience</div>
        <div class="t16-left-content editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expItems}</div>`:''}
      </div>
      <div class="t16-right">
        ${edu.length?`<div class="t16-right-sec" style="background:#e8e0d0;">Education</div>
        <div class="t16-right-body">${eduHTML}</div>`:''}
        ${projItems?`<div class="t16-right-sec" style="background:#e8e0d0;">Projects</div>
        <div class="t16-right-body editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div>`:''}
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 18: SKY BLUE PRO — resume-t18
// ============================================================
function buildTemplate18Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#00b4db';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const linkedin= d.linkedin || '';
    const summary = d.profileSummary || '';

    const skillRows = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        const pct = (typeof s==='object'&&typeof s.level==='number')?s.level:80;
        return `<div class="t18-skill-row">
          <div class="t18-skill-name">${sn}</div>
          <div class="t18-skill-bar" style="flex:1;margin:0 8px;height:3px;background:#e0f7fa;border-radius:2px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${accent};border-radius:2px;"></div>
          </div>
          <div class="t18-skill-level" style="color:${accent};">${pct}%</div>
        </div>`;
    }).join('');

    const empItems = experience.map(e=>`<div class="t18-emp-item">
        <div class="t18-emp-header">
          <div class="t18-emp-title">${e.jobTitle||e.role||e.title||''}</div>
          <div class="t18-emp-loc" style="color:${accent};">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>
        </div>
        <div style="font-size:10px;color:${accent};margin-bottom:2px;">${e.company||''}</div>
        <div class="t18-emp-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div>
    </div>`).join('');

    const projItems = projects.map(p=>`<div class="t18-emp-item">
        <div class="t18-emp-title">${p.title||p.name||''}</div>
        ${p.tools?`<div style="font-size:10px;color:${accent};">Tools: ${p.tools}</div>`:''}
        <div class="t18-emp-desc">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
    </div>`).join('');

    const eduItems = edu.map(e=>`<div class="t18-edu-item">
        <div class="t18-edu-date"><span class="t18-edu-name">${e.degree||''}</span><span style="font-size:10px;color:#aaa;">${e.year||''}</span></div>
        <div class="t18-edu-deg">${e.school||e.university||''}</div>
    </div>`).join('');

    return `<div class="resume-t18">
      <div class="t18-header" style="background:${accent};">
        <div class="t18-photo" style="background:linear-gradient(135deg,#0083b0,#00d2ff);">${(name||'U').charAt(0).toUpperCase()}</div>
        <div class="t18-header-info">
          <div class="t18-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
          <div class="t18-role">${title}</div>
        </div>
      </div>
      <div class="t18-body">
        ${summary?`<div class="t18-profile" style="font-size:11px;color:#555;line-height:1.6;">${summary}</div>`:''}
        <div class="t18-cols">
          <div class="t18-col-left">
            ${empItems?`<div class="t18-sec-title" style="border-color:${accent};">Experience</div>
            <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${empItems}</div>`:''}
            ${projItems?`<div class="t18-sec-title" style="border-color:${accent};">Projects</div>
            <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div>`:''}
          </div>
          <div class="t18-col-right">
            ${eduItems?`<div class="t18-sec-title" style="border-color:${accent};">Education</div>${eduItems}`:''}
            ${skills.length?`<div class="t18-sec-title" style="border-color:${accent};">Skills</div>
            <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillRows}</div>`:''}
            <div class="t18-sec-title" style="border-color:${accent};">Contact</div>
            ${phone?`<div style="font-size:10px;color:#555;">📞 ${phone}</div>`:''}
            ${email?`<div style="font-size:10px;color:#555;">✉ ${email}</div>`:''}
            ${addr?`<div style="font-size:10px;color:#555;">📍 ${addr}</div>`:''}
            ${linkedin?`<div style="font-size:10px;color:#555;">🔗 ${linkedin}</div>`:''}
          </div>
        </div>
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 20: AZURE SPLIT — resume-t20
// ============================================================
function buildTemplate20Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#2196f3';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const linkedin= d.linkedin || '';
    const website = d.website || '';
    const summary = d.profileSummary || '';

    const expItems = experience.map(e=>`<div class="t20-job">
        <div class="t20-job-title" style="color:${accent};">${e.jobTitle||e.role||e.title||''}</div>
        <div class="t20-job-co">${e.company||''}</div>
        <div class="t20-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>
        <div class="t20-job-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div>
    </div>`).join('');

    const projItems = projects.map(p=>`<div class="t20-job">
        <div class="t20-job-title" style="color:${accent};">${p.title||p.name||''}</div>
        ${p.tools?`<div class="t20-job-co">Tools: ${p.tools}</div>`:''}
        <div class="t20-job-desc">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
    </div>`).join('');

    const skillItems = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        return `<div class="t20-skill">${sn}</div>`;
    }).join('');

    return `<div class="resume-t20">
      <div class="t20-left">
        <div class="t20-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
        <div class="t20-role" style="color:${accent};">${title}</div>
        ${summary?`<div class="t20-bio">${summary}</div>`:''}
        <div class="t20-sec-title-l">Experience</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expItems||`<div style="font-size:10px;color:#aaa;">Add experience ✏</div>`}</div>
        ${projItems?`<div class="t20-sec-title-l">Projects</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div>`:''}
      </div>
      <div class="t20-right" style="border-color:${accent};">
        <div class="t20-sec-title-r">Contact</div>
        ${phone?`<div class="t20-contact">📞 ${phone}</div>`:''}
        ${email?`<div class="t20-contact">✉ ${email}</div>`:''}
        ${addr?`<div class="t20-contact">📍 ${addr}</div>`:''}
        ${linkedin?`<div class="t20-social" style="color:${accent};">🔗 ${linkedin}</div>`:''}
        ${website?`<div class="t20-social" style="color:${accent};">🌐 ${website}</div>`:''}
        ${skills.length?`<div class="t20-sec-title-r">Skills</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillItems}</div>`:''}
        ${edu.length?`<div class="t20-sec-title-r">Education</div>
        ${edu.map(e=>`<div style="margin-bottom:8px;"><div style="font-size:11px;font-weight:800;color:#1a1a2e;">${e.degree||''}</div><div style="font-size:10px;color:#777;">${e.school||e.university||''}</div><div style="font-size:10px;color:#aaa;">${e.year||''}</div></div>`).join('')}`:''}
        ${d.languages?`<div class="t20-sec-title-r">Languages</div>
        <div class="t20-lang">${d.languages}</div>`:''}
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 21: HARVARD BLUE — resume-t21
// ============================================================
function buildTemplate21Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = '#1a237e';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const linkedin= d.linkedin || '';
    const summary = d.profileSummary || '';

    const expItems = experience.map(e=>`<div style="margin-bottom:12px;">
        <div class="t21-org">${e.company||''}</div>
        <div class="t21-pos">${e.jobTitle||e.role||e.title||''}</div>
        <div class="t21-date-row"><span>${e.startDate||e.from||''}</span><span>${e.endDate||e.to||'Present'}</span></div>
        ${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t21-bullet"><span>•</span><span>${b.replace(/^[•\-]\s*/,'')}</span></div>`).join('')}
    </div>`).join('');

    const projItems = projects.map(p=>`<div style="margin-bottom:10px;">
        <div class="t21-org">${p.title||p.name||''}</div>
        ${p.tools?`<div class="t21-pos">Tools: ${p.tools}</div>`:''}
        ${(p.description||'').split('\n').filter(Boolean).map(b=>`<div class="t21-bullet"><span>•</span><span>${b}</span></div>`).join('')}
    </div>`).join('');

    const skillItems = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        return `<div class="t21-skills-row">${sn}</div>`;
    }).join('');

    return `<div class="resume-t21">
      <div class="t21-header" style="background:${accent};">
        <div class="t21-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
        ${title?`<div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:3px;">${title}</div>`:''}
        <div class="t21-contact-row">
          ${phone?`<span>${phone}</span><span class="t21-sep">|</span>`:''}
          ${email?`<span>${email}</span>`:''}
          ${addr?`<span class="t21-sep">|</span><span>${addr}</span>`:''}
          ${linkedin?`<span class="t21-sep">|</span><span>${linkedin}</span>`:''}
        </div>
      </div>
      <div class="t21-body">
        ${summary?`<div class="t21-sec-title">Profile Summary</div>
        <div style="font-size:10px;color:#555;line-height:1.6;margin-bottom:10px;">${summary}</div>`:''}
        ${expItems?`<div class="t21-sec-title">Experience</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expItems}</div>`:''}
        ${projItems?`<div class="t21-sec-title">Projects</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div>`:''}
        <div class="t21-two">
          <div class="t21-two-l">
            ${edu.length?`<div class="t21-sec-title">Education</div>
            ${edu.map(e=>`<div style="margin-bottom:8px;"><div class="t21-org">${e.school||e.university||''}</div><div class="t21-pos">${e.degree||''}</div><div style="font-size:10px;color:#888;">${e.year||''}</div></div>`).join('')}`:''}
          </div>
          <div class="t21-two-r">
            ${skills.length?`<div class="t21-sec-title">Skills</div>
            <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillItems}</div>`:''}
            ${d.languages?`<div class="t21-sec-title">Languages</div>
            <div class="t21-skills-row">${d.languages}</div>`:''}
          </div>
        </div>
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 24: DARK OLIVE — resume-t24
// ============================================================
function buildTemplate24Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#8bc34a';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const linkedin= d.linkedin || '';
    const summary = d.profileSummary || '';

    const expItems = experience.map(e=>`<div class="t24-job">
        <div class="t24-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>
        <div class="t24-job-title">${e.jobTitle||e.role||e.title||''}</div>
        <div class="t24-job-co">${e.company||''}</div>
        ${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t24-bullet"><span>-</span><span>${b.replace(/^[•\-]\s*/,'')}</span></div>`).join('')}
    </div>`).join('');

    const projItems = projects.map(p=>`<div class="t24-job">
        <div class="t24-job-title">${p.title||p.name||''}</div>
        ${p.tools?`<div class="t24-job-co">Tools: ${p.tools}</div>`:''}
        ${(p.description||'').split('\n').filter(Boolean).map(b=>`<div class="t24-bullet"><span>-</span><span>${b}</span></div>`).join('')}
    </div>`).join('');

    const skillItems = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        return `<div class="t24-skill">${sn}</div>`;
    }).join('');

    const eduItems = edu.map(e=>`<div style="margin-bottom:8px;">
        <div class="t24-edu-date">${e.year||''}</div>
        <div class="t24-edu-deg">${e.degree||''}</div>
        <div class="t24-edu-uni">${e.school||e.university||''}</div>
    </div>`).join('');

    return `<div class="resume-t24" style="background:#212121;">
      <div class="t24-top">
        <div class="t24-top-info">
          <div class="t24-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
          <div class="t24-role" style="color:${accent};">${title}</div>
          ${summary?`<div class="t24-bio">${summary}</div>`:''}
          <div class="t24-contact-row">
            ${phone?`<span>📞 ${phone}</span>`:''}${email?`<span>✉ ${email}</span>`:''}${addr?`<span>📍 ${addr}</span>`:''}
          </div>
        </div>
        <div class="t24-photo" style="color:${accent};">${(name||'U').charAt(0).toUpperCase()}</div>
      </div>
      <div class="t24-body">
        <div class="t24-left">
          ${expItems?`<div class="t24-sec-title" style="color:${accent};">Experience</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expItems}</div>`:''}
          ${projItems?`<div class="t24-sec-title" style="color:${accent};">Projects</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div>`:''}
        </div>
        <div class="t24-right">
          ${skillItems?`<div class="t24-sec-title" style="color:${accent};">Skills</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillItems}</div>`:''}
          ${eduItems?`<div class="t24-sec-title" style="color:${accent};">Education</div>${eduItems}`:''}
          ${d.languages?`<div class="t24-sec-title" style="color:${accent};">Languages</div>
          ${d.languages.split(',').map(l=>`<div class="t24-lang">${l.trim()}</div>`).join('')}`:''}
        </div>
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 26: AMBER DARK — resume-t26
// ============================================================
function buildTemplate26Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#ff8f00';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const summary = d.profileSummary || '';

    const skillBars = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        const pct = (typeof s==='object'&&typeof s.level==='number')?s.level:80;
        return `<div class="t26-skill-bar-row">
          <div class="t26-skill-label">${sn}</div>
          <div class="t26-skill-track"><div class="t26-skill-fill" style="width:${pct}%;background:${accent};"></div></div>
        </div>`;
    }).join('');

    const expRows = experience.map(e=>`<div style="padding:6px 16px;border-bottom:1px solid #333;">
        <div class="t26-exp-row">
          <div class="t26-exp-year">${(e.startDate||e.from||'').split('-')[0]||''}</div>
          <div>
            <div class="t26-exp-role">${e.jobTitle||e.role||e.title||''}</div>
            <div class="t26-exp-co">${e.company||''}</div>
            <div class="t26-exp-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).slice(0,2).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join(' ')}</div>
          </div>
        </div>
    </div>`).join('');

    const projRows = projects.map(p=>`<div style="padding:4px 16px;">
        <div class="t26-exp-row">
          <div class="t26-exp-year"></div>
          <div><div class="t26-exp-role">${p.title||p.name||''}</div>${p.tools?`<div class="t26-exp-co">Tools: ${p.tools}</div>`:''}</div>
        </div>
    </div>`).join('');

    const eduRows = edu.map(e=>`<div style="padding:4px 16px;">
        <div class="t26-edu-row">
          <div class="t26-edu-year">${e.year||''}</div>
          <div><div class="t26-edu-deg">${e.degree||''}</div><div class="t26-edu-uni">${e.school||e.university||''}</div></div>
        </div>
    </div>`).join('');

    return `<div class="resume-t26">
      <div class="t26-left">
        <div class="t26-left-top">
          <div style="position:relative;">
            <div class="t26-photo-wrap" style="background:#e0e0e0;display:flex;align-items:center;justify-content:center;font-size:40px;color:#888;">${(name||'U').charAt(0).toUpperCase()}</div>
            <div class="t26-amber-bar" style="background:${accent};"></div>
          </div>
          <div class="t26-name-block">
            <div class="t26-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
            <div class="t26-role">${title}</div>
          </div>
        </div>
        ${summary?`<div class="t26-about">${summary}</div>`:''}
        <div class="t26-sec-container">
          ${expRows?`<div class="t26-sec-title"><div class="t26-amber-sq" style="background:${accent};"></div>Experience</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expRows}</div>`:''}
          ${projRows?`<div class="t26-sec-title"><div class="t26-amber-sq" style="background:${accent};"></div>Projects</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projRows}</div>`:''}
          ${eduRows?`<div class="t26-sec-title"><div class="t26-amber-sq" style="background:${accent};"></div>Education</div>${eduRows}`:''}
        </div>
      </div>
      <div class="t26-right" style="background:#212121;">
        <div class="t26-right-sec" style="color:${accent};">Contact</div>
        ${phone?`<div class="t26-contact-item">📞 ${phone}</div>`:''}
        ${email?`<div class="t26-contact-item">✉ ${email}</div>`:''}
        ${addr?`<div class="t26-contact-item">📍 ${addr}</div>`:''}
        ${skills.length?`<div class="t26-right-sec" style="color:${accent};">Skills</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillBars}</div>`:''}
        ${d.languages?`<div class="t26-right-sec" style="color:${accent};">Languages</div>
        <div style="font-size:10px;color:#aaa;">${d.languages}</div>`:''}
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 27: BLOB NAVY — resume-t27
// ============================================================
function buildTemplate27Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#1565c0';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const linkedin= d.linkedin || '';
    const summary = d.profileSummary || '';

    const expItems = experience.map(e=>`<div class="t27-job">
        <div class="t27-job-title">${e.jobTitle||e.role||e.title||''}</div>
        <div class="t27-job-co" style="color:${accent};">${e.company||''}</div>
        <div class="t27-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>
        ${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t27-bullet"><span style="color:${accent};">•</span><span>${b.replace(/^[•\-]\s*/,'')}</span></div>`).join('')}
    </div>`).join('');

    const projItems = projects.map(p=>`<div class="t27-job">
        <div class="t27-job-title">${p.title||p.name||''}</div>
        ${p.tools?`<div class="t27-job-co" style="color:${accent};">Tools: ${p.tools}</div>`:''}
        ${(p.description||'').split('\n').filter(Boolean).map(b=>`<div class="t27-bullet"><span style="color:${accent};">•</span><span>${b}</span></div>`).join('')}
    </div>`).join('');

    const skillItems = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        return `<div class="t27-skill">${sn}</div>`;
    }).join('');

    return `<div class="resume-t27">
      <div class="t27-blob-tl"></div><div class="t27-blob-tr"></div>
      <div class="t27-blob-br"></div><div class="t27-blob-bl"></div>
      <div class="t27-header">
        <div class="t27-photo" style="background:linear-gradient(135deg,${accent},#42a5f5);">${(name||'U').charAt(0).toUpperCase()}</div>
        <div class="t27-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
        <div class="t27-role" style="color:${accent};">${title}</div>
        ${summary?`<div class="t27-bio">${summary}</div>`:''}
      </div>
      <div class="t27-body">
        <div class="t27-left">
          ${expItems?`<div class="t27-sec-title" style="color:${accent};">Experience</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expItems}</div>`:''}
          ${projItems?`<div class="t27-sec-title" style="color:${accent};">Projects</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div>`:''}
          ${edu.length?`<div class="t27-sec-title" style="color:${accent};">Education</div>
          ${edu.map(e=>`<div style="margin-bottom:8px;"><div style="font-size:11px;font-weight:800;color:#1a1a2e;">${e.degree||''}</div><div style="font-size:10px;color:${accent};">${e.school||e.university||''}</div><div style="font-size:10px;color:#aaa;">${e.year||''}</div></div>`).join('')}`:''}
        </div>
        <div class="t27-right">
          <div class="t27-sec-title" style="color:${accent};">Contact</div>
          ${phone?`<div class="t27-contact">📞 ${phone}</div>`:''}
          ${email?`<div class="t27-contact">✉ ${email}</div>`:''}
          ${addr?`<div class="t27-contact">📍 ${addr}</div>`:''}
          ${linkedin?`<div class="t27-link" style="color:${accent};">🔗 ${linkedin}</div>`:''}
          ${skills.length?`<div class="t27-sec-title" style="color:${accent};">Skills</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillItems}</div>`:''}
          ${d.languages?`<div class="t27-sec-title" style="color:${accent};">Languages</div>
          <div class="t27-contact">${d.languages}</div>`:''}
        </div>
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 29: MINT MINIMAL — resume-t29
// ============================================================
function buildTemplate29Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#00897b';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const linkedin= d.linkedin || '';
    const summary = d.profileSummary || '';

    const expItems = experience.map(e=>`<div class="t29-job">
        <div class="t29-job-title">${e.jobTitle||e.role||e.title||''}</div>
        <div class="t29-job-co">${e.company||''}</div>
        <div class="t29-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>
        ${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t29-bullet"><span style="color:${accent};">•</span><span>${b.replace(/^[•\-]\s*/,'')}</span></div>`).join('')}
    </div>`).join('');

    const projItems = projects.map(p=>`<div class="t29-job">
        <div class="t29-job-title">${p.title||p.name||''}</div>
        ${p.tools?`<div class="t29-job-co">Tools: ${p.tools}</div>`:''}
        ${(p.description||'').split('\n').filter(Boolean).map(b=>`<div class="t29-bullet"><span style="color:${accent};">•</span><span>${b}</span></div>`).join('')}
    </div>`).join('');

    const skillItems = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        return `<div class="t29-skill">${sn}</div>`;
    }).join('');

    return `<div class="resume-t29">
      <div class="t29-header" style="background:linear-gradient(90deg,#e0f2f1 0%,#f5fffe 100%);border-color:${accent};">
        <div class="t29-photo" style="background:linear-gradient(135deg,${accent},#4db6ac);">${(name||'U').charAt(0).toUpperCase()}</div>
        <div class="t29-header-info">
          <div class="t29-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
          <div class="t29-role" style="color:${accent};">${title}</div>
          ${summary?`<div class="t29-bio">${summary}</div>`:''}
        </div>
        <div class="t29-contacts">
          ${phone?`<div>📞 ${phone}</div>`:''}
          ${email?`<div>✉ ${email}</div>`:''}
          ${addr?`<div>📍 ${addr}</div>`:''}
          ${linkedin?`<div>🔗 ${linkedin}</div>`:''}
        </div>
      </div>
      <div class="t29-body">
        <div class="t29-left">
          ${expItems?`<div class="t29-sec-title" style="color:${accent};">Experience</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expItems}</div>`:''}
          ${projItems?`<div class="t29-sec-title" style="color:${accent};">Projects</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div>`:''}
        </div>
        <div class="t29-right">
          ${edu.length?`<div class="t29-sec-title" style="color:${accent};">Education</div>
          ${edu.map(e=>`<div class="t29-edu-item"><div class="t29-edu-title">${e.degree||''}</div><div class="t29-edu-sub">${e.school||e.university||''}</div><div class="t29-edu-date">${e.year||''}</div></div>`).join('')}`:''}
          ${skills.length?`<div class="t29-sec-title" style="color:${accent};">Skills</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillItems}</div>`:''}
          ${d.languages?`<div class="t29-sec-title" style="color:${accent};">Languages</div>
          <div class="t29-skill">${d.languages}</div>`:''}
        </div>
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 30: SLATE DEV — resume-t30
// ============================================================
function buildTemplate30Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#475569';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const linkedin= d.linkedin || '';
    const website = d.website || '';
    const summary = d.profileSummary || '';

    const expItems = experience.map(e=>`<div class="t30-job">
        <div class="t30-job-title">${e.jobTitle||e.role||e.title||''}</div>
        <div class="t30-job-co">${e.company||''}</div>
        <div class="t30-job-date">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</div>
        <div class="t30-job-desc">${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`• ${b.replace(/^[•\-]\s*/,'')}`).join('<br>')}</div>
    </div>`).join('');

    const projItems = projects.map(p=>`<div class="t30-job">
        <div class="t30-job-title">${p.title||p.name||''}</div>
        ${p.tools?`<div class="t30-job-co">Tools: ${p.tools}</div>`:''}
        <div class="t30-job-desc">${(p.description||'').split('\n').filter(Boolean).map(b=>`• ${b}`).join('<br>')}</div>
    </div>`).join('');

    const skillItems = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        return `<div class="t30-skill-l">${sn}</div>`;
    }).join('');

    return `<div class="resume-t30">
      <div class="t30-left" style="background:#37474f;">
        <div class="t30-left-top">
          <div class="t30-photo" style="background:linear-gradient(135deg,#546e7a,#78909c);">${(name||'U').charAt(0).toUpperCase()}</div>
          <div class="t30-name-l editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
          <div class="t30-role-l">${title}</div>
        </div>
        <div class="t30-info-box">📞 ${phone||''}</div>
        <div class="t30-info-box" style="word-break:break-all;">✉ ${email||''}</div>
        ${addr?`<div class="t30-info-box">📍 ${addr}</div>`:''}
        ${linkedin?`<div class="t30-link-box">🔗 ${linkedin}</div>`:''}
        ${website?`<div class="t30-link-box">🌐 ${website}</div>`:''}
        <div class="t30-sec-title-l">Skills</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillItems||`<div style="font-size:10px;color:#90a4ae;">Add skills</div>`}</div>
        ${edu.length?`<div class="t30-sec-title-l">Education</div>
        ${edu.map(e=>`<div style="margin-bottom:8px;padding:0 16px;"><div style="font-size:11px;font-weight:700;color:#fff;">${e.degree||''}</div><div style="font-size:10px;color:#b0bec5;">${e.school||e.university||''}</div><div style="font-size:10px;color:#90a4ae;">${e.year||''}</div></div>`).join('')}`:''}
        ${d.languages?`<div class="t30-sec-title-l">Languages</div>
        ${d.languages.split(',').map(l=>`<div class="t30-hobby">${l.trim()}</div>`).join('')}`:''}
      </div>
      <div class="t30-right">
        ${summary?`<div class="t30-sec-title-r" style="border-color:${accent};">Profile</div>
        <div class="t30-bio-text">${summary}</div>`:''}
        ${expItems?`<div class="t30-sec-title-r" style="border-color:${accent};">Experience</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expItems}</div>`:''}
        ${projItems?`<div class="t30-sec-title-r" style="border-color:${accent};">Projects</div>
        <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div>`:''}
      </div>
    </div>`;
}

// ============================================================
// TEMPLATE 31: INDIGO MARKETING — resume-t31
// ============================================================
function buildTemplate31Template({ resumeData: d, edu, skills, projects, experience, color }) {
    const accent = color || '#3f51b5';
    const name    = d.fullName || '';
    const title   = d.jobTitle || '';
    const email   = d.email || '';
    const phone   = d.phone || '';
    const addr    = d.address || d.location || '';
    const linkedin= d.linkedin || '';
    const summary = d.profileSummary || '';

    const expItems = experience.map(e=>`<div class="t31-job">
        <div><div class="t31-job-title">${e.jobTitle||e.role||e.title||''}</div>
        <span class="t31-job-loc" style="color:${accent};">${e.startDate||e.from||''} – ${e.endDate||e.to||'Present'}</span></div>
        <div class="t31-job-co">${e.company||''}</div>
        ${(e.description||e.bullets||'').toString().split('\n').filter(Boolean).map(b=>`<div class="t31-bullet"><span style="color:${accent};">•</span><span>${b.replace(/^[•\-]\s*/,'')}</span></div>`).join('')}
    </div>`).join('');

    const projItems = projects.map(p=>`<div class="t31-job">
        <div class="t31-job-title">${p.title||p.name||''}</div>
        ${p.tools?`<div class="t31-job-co">Tools: ${p.tools}</div>`:''}
        ${(p.description||'').split('\n').filter(Boolean).map(b=>`<div class="t31-bullet"><span style="color:${accent};">•</span><span>${b}</span></div>`).join('')}
    </div>`).join('');

    const skillRows = skills.map(s=>{
        const sn = typeof s==='string'?s:(s.name||s.skill||'');
        return `<div class="t31-skill-row"><span>${sn}</span><span class="t31-skill-dot" style="color:${accent};">●</span></div>`;
    }).join('');

    return `<div class="resume-t31">
      <div class="t31-header">
        <div>
          <div class="t31-name editable-field" style="cursor:pointer;" ${editBtn('fullName','Full Name',d.fullName||'')}>${name}</div>
          <div class="t31-role-badge" style="background:${accent};">${title}</div>
        </div>
        <div class="t31-contact-r">
          ${phone?`<div class="t31-contact-r-item">📞 ${phone}</div>`:''}
          ${email?`<div class="t31-contact-r-item">✉ ${email}</div>`:''}
          ${addr?`<div class="t31-contact-r-item">📍 ${addr}</div>`:''}
          ${linkedin?`<div class="t31-contact-r-item">🔗 ${linkedin}</div>`:''}
        </div>
      </div>
      <div class="t31-accent-bar" style="background:linear-gradient(90deg,${accent},#7986cb);"></div>
      <div class="t31-body">
        <div class="t31-left">
          ${summary?`<div class="t31-sec-title" style="color:${accent};">About</div>
          <div class="t31-about">${summary}</div>`:''}
          ${edu.length?`<div class="t31-sec-title" style="color:${accent};">Education</div>
          ${edu.map(e=>`<div class="t31-edu-item"><div class="t31-edu-deg">${e.degree||''}</div><div class="t31-edu-uni" style="color:${accent};">${e.school||e.university||''}</div><div class="t31-edu-loc">${e.year||''}</div></div>`).join('')}`:''}
          ${d.languages?`<div class="t31-sec-title" style="color:${accent};">Languages</div>
          ${d.languages.split(',').map(l=>`<div class="t31-lang-item">${l.trim()}</div>`).join('')}`:''}
        </div>
        <div class="t31-right">
          ${skills.length?`<div class="t31-sec-title" style="color:${accent};">Skills</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('skillsJson','Skills','')}>${skillRows}</div>`:''}
          ${expItems?`<div class="t31-sec-title" style="color:${accent};">Experience</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('experienceJson','Experience','')}>${expItems}</div>`:''}
          ${projItems?`<div class="t31-sec-title" style="color:${accent};">Projects</div>
          <div class="editable-field" style="cursor:pointer;" ${editBtn('projectsJson','Projects','')}>${projItems}</div>`:''}
        </div>
      </div>
    </div>`;
}
