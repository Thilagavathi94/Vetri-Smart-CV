// =============================================
// VetriSmartCV - script.js
// Main index page JavaScript
// =============================================

// --- Resume Modal ---

function openResumeModal() {
  var modal = document.getElementById('resumeModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeResumeModal() {
  var modal = document.getElementById('resumeModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// Close modal when clicking outside the modal box
document.addEventListener('DOMContentLoaded', function () {
  var overlay = document.getElementById('resumeModal');
  if (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        closeResumeModal();
      }
    });
  }

  // Generic mainModal close button
  var closeBtn = document.getElementById('modalCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      var mainModal = document.getElementById('mainModal');
      if (mainModal) mainModal.style.display = 'none';
      document.body.style.overflow = '';
    });
  }
});

// --- Import CV ---

function showImportCvToast(message, type) {
  var toast = document.getElementById('landingImportCvToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'landingImportCvToast';
    toast.style.cssText = [
      'position:fixed',
      'bottom:28px',
      'right:28px',
      'z-index:99999',
      'padding:14px 20px',
      'border-radius:12px',
      'font-weight:700',
      'font-size:14px',
      'color:#fff',
      'box-shadow:0 10px 30px rgba(0,0,0,0.18)',
      'max-width:460px',
      'opacity:0',
      'transition:opacity 0.25s ease'
    ].join(';');
    document.body.appendChild(toast);
  }

  toast.style.background = type === 'error'
    ? 'linear-gradient(135deg,#ef4444,#dc2626)'
    : 'linear-gradient(135deg,#6c3fc9,#a855f7)';
  toast.textContent = message;
  toast.style.opacity = '1';
  window.clearTimeout(toast._hideTimer);
  toast._hideTimer = window.setTimeout(function () {
    toast.style.opacity = '0';
  }, 3200);
}

function normalizeImportedResumePayload(parsed) {
  var payload = {};
  if (!parsed || typeof parsed !== 'object') return payload;

  if (parsed.fullName) payload.fullName = parsed.fullName;
  if (parsed.jobTitle) payload.jobTitle = parsed.jobTitle;
  if (parsed.email) payload.email = parsed.email;
  if (parsed.phone) payload.phone = parsed.phone;
  if (parsed.address) payload.address = parsed.address;
  if (parsed.location) payload.location = parsed.location;
  if (parsed.website) payload.website = parsed.website;
  if (parsed.linkedin) payload.linkedin = parsed.linkedin;
  if (parsed.profileSummary) payload.profileSummary = parsed.profileSummary;

  if (Array.isArray(parsed.skills) && parsed.skills.length) {
    payload.skillsJson = JSON.stringify(parsed.skills);
  } else if (parsed.skillsHint) {
    var hintedSkills = String(parsed.skillsHint)
      .split(/[\n,|•·]/)
      .map(function (item) { return item.trim(); })
      .filter(Boolean)
      .slice(0, 12);
    if (hintedSkills.length) payload.skillsJson = JSON.stringify(hintedSkills);
  }

  if (Array.isArray(parsed.education) && parsed.education.length) {
    payload.educationJson = JSON.stringify(parsed.education);
  }
  if (Array.isArray(parsed.experience) && parsed.experience.length) {
    payload.experienceJson = JSON.stringify(parsed.experience);
  }
  if (Array.isArray(parsed.projects) && parsed.projects.length) {
    payload.projectsJson = JSON.stringify(parsed.projects);
  }

  payload.uploadedCvParsedJson = JSON.stringify(parsed);
  return payload;
}

function hasMeaningfulImportedResumeData(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  if (parsed.fullName || parsed.jobTitle || parsed.email || parsed.phone || parsed.profileSummary) return true;
  if (Array.isArray(parsed.skills) && parsed.skills.length) return true;
  if (Array.isArray(parsed.education) && parsed.education.length) return true;
  if (Array.isArray(parsed.experience) && parsed.experience.length) return true;
  if (Array.isArray(parsed.projects) && parsed.projects.length) return true;
  return false;
}

function buildImportedResumeData(parsed) {
  var templateName = sessionStorage.getItem('selectedTemplate') || 'template1';
  var payload = normalizeImportedResumePayload(parsed);
  var resumeData = Object.assign({
    templateName: templateName,
    fullName: '',
    jobTitle: '',
    email: '',
    phone: '',
    address: '',
    location: '',
    website: '',
    linkedin: '',
    profileSummary: '',
    skillsJson: '[]',
    educationJson: '[]',
    experienceJson: '[]',
    projectsJson: '[]'
  }, payload);
  resumeData.templateName = templateName;
  return resumeData;
}

async function uploadExistingCvAndOpenReview(file) {
  if (!file) return;

  var formData = new FormData();
  formData.append('file', file);
  showImportCvToast('Uploading and reading your CV...');

  try {
    var response = await fetch('/api/resume/upload-cv', {
      method: 'POST',
      body: formData
    });
    var data = await response.json();

    if (!data.success) {
      showImportCvToast('Could not parse CV: ' + (data.message || 'Unknown error'), 'error');
      return;
    }

    var parsed = data.parsed || {};
    if (!hasMeaningfulImportedResumeData(parsed)) {
      showImportCvToast('CV uploaded, but no useful resume details were detected. Try another file.', 'error');
      return;
    }

    var resumeData = buildImportedResumeData(parsed);
    sessionStorage.setItem('resumeData', JSON.stringify(resumeData));
    sessionStorage.setItem('selectedTemplate', resumeData.templateName);
    sessionStorage.removeItem('pendingResumeId');
    closeResumeModal();
    showImportCvToast('CV imported successfully! Opening review page...');
    window.setTimeout(function () {
      window.location.href = '/review?template=' + encodeURIComponent(resumeData.templateName);
    }, 150);
  } catch (error) {
    showImportCvToast('Upload failed. Please try again.', 'error');
  }
}

function handleCVImport(event) {
  var file = event && event.target && event.target.files ? event.target.files[0] : null;
  uploadExistingCvAndOpenReview(file);
  if (event && event.target) event.target.value = '';
}

function importCV() {
  var input = document.getElementById('cvFileInput');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'cvFileInput';
    input.accept = '.pdf,.doc,.docx';
    input.style.display = 'none';
    input.addEventListener('change', handleCVImport);
    document.body.appendChild(input);
  }
  input.click();
}

// --- Plan helpers ---

function getUserPlan() {
  // Read plan from meta tag set by Thymeleaf — always normalise to lowercase
  // Server injects e.g. "PRO", "FREE", "PREMIUM" — we lowercase for comparison
  var meta = document.querySelector('meta[name="user-plan"]');
  return meta ? (meta.getAttribute('content') || 'free').toLowerCase().trim() : 'free';
}

function isUserLoggedIn() {
  var meta = document.querySelector('meta[name="user-loggedin"]');
  return meta ? meta.getAttribute('content') === 'true' : false;
}

function userHasPro() {
  var plan = getUserPlan();
  return plan === 'pro' || plan === 'premium';
}

// --- Home Template Buttons ---

function homeOpenTemplate(tmplName, title, subtitle, requiredPlan) {
  // Try to open the inline preview modal if it exists on this page
  var modal   = document.getElementById('homeTplModal');
  var titleEl = document.getElementById('htmTitle');
  var subEl   = document.getElementById('htmSubtitle');
  var imgEl   = document.getElementById('htmImg');
  var btnEl   = document.getElementById('htmUseBtn');

  if (modal && titleEl && btnEl) {
    if (titleEl) titleEl.textContent = title    || tmplName;
    if (subEl)   subEl.textContent   = subtitle || '';
    if (imgEl)   imgEl.src           = '/images/previews/' + tmplName + '.jpg';

    var locked = (requiredPlan === 'pro') && !userHasPro();
    btnEl.style.background = locked
      ? 'linear-gradient(135deg,#f59e0b,#d97706)'
      : 'linear-gradient(135deg,#7c3aed,#5b21b6)';
    btnEl.textContent = locked ? '\uD83D\uDD12 Use Template' : '\u270F\uFE0F Use Template';
    btnEl.onclick = function() {
      closeHomeTpl();
      homeUseTemplate(tmplName, requiredPlan);
    };

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  } else {
    // Fallback: just go to templates page
    window.location.href = '/template';
  }
}

function closeHomeTpl() {
  var modal = document.getElementById('homeTplModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

function homeUseTemplate(tmplName, requiredPlan) {
  var planLevels = { free: 0, pro: 1, premium: 2 };

  // IMPORTANT: normalise both values to lowercase before comparing.
  // The server injects "PRO"/"FREE"/"PREMIUM" (uppercase) into the meta tag.
  // The old bug was comparing 'PRO' against keys 'pro'/'free' — always failing.
  var userPlan = getUserPlan();                              // already lowercase
  var required = (requiredPlan || 'free').toLowerCase();

  // User has sufficient plan — go straight to builder
  if ((planLevels[userPlan] || 0) >= (planLevels[required] || 0)) {
    window.location.href = '/builder?template=' + encodeURIComponent(tmplName);
    return;
  }

  // Free user hitting a Pro template — show upgrade confirm (no blocking alert)
  var planName = required.charAt(0).toUpperCase() + required.slice(1);
  if (confirm(
    '\uD83D\uDD12 This is a ' + planName + ' template.\n\n' +
    'Upgrade to unlock all premium templates.\n\nGo to Pricing?'
  )) {
    window.location.href = isUserLoggedIn()
      ? '/payment?plan=PRO'
      : '/login?redirect=%2Fpayment%3Fplan%3DPRO';
  }
}

// Aliases (kept for backward compat with any inline fallback scripts)
var selectTemplateFromHome = homeUseTemplate;
var openTmplPreview = homeOpenTemplate;

function closeTmplPreview() {
  var m = document.getElementById('tmplPreviewModal');
  if (m) m.style.display = 'none';
  document.body.style.overflow = '';
}

function toggleLoginDropdown(e) {
  if (e) e.stopPropagation();
  var wrap = document.getElementById('navLoginWrap');
  if (wrap) wrap.classList.toggle('open');
}

document.addEventListener('click', function(e) {
  var wrap = document.getElementById('navLoginWrap');
  if (wrap && !wrap.contains(e.target)) {
    wrap.classList.remove('open');
  }
});
