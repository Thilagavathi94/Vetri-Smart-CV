/* =============================================
   BUILDER.JS — VetriSmartCV (Enhanced)
   ============================================= */

const API_BASE = '/api/resume';
let currentStep = 1;
const totalSteps = 7;
let resumeId = null;
let parsedCvData = {};
let profilePhotoBase64 = '';

const resumeData = {
    jobTitle: '',
    experienceLevel: '',
    educationJson: '[]',
    skillsJson: '[]',
    projectsJson: '[]',
    experienceJson: '[]',
    fullName: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    linkedin: '',
    location: '',
    profileSummary: '',
    uploadedCvParsedJson: '',
    templateName: 'template1',
    includePhoto: true,
    profilePhotoData: '',
    status: 'DRAFT'
};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    populateYearDropdowns();
    // Populate experience year dropdowns for the first entry
    document.querySelectorAll('.exp-start-year, .exp-end-year').forEach(sel => populateExpYearDropdown(sel));
    updateProgress();
    loadSkillSuggestions();
    checkSession();

    const params = new URLSearchParams(window.location.search);
    if (params.get('id')) {
        resumeId = parseInt(params.get('id'));
        loadExistingResume(resumeId);
    }
    // Read template from URL param (e.g. coming from /template page)
    const tmplParam = params.get('template');
    selectTemplate(tmplParam || resumeData.templateName || 'template1');
});

function normalizeBuilderTemplate(tplId) {
    const legacyMap = {
        minimal: 'template1',
        modern: 'template2',
        creative: 'template3'
    };
    const raw = String(tplId || '').trim();
    const mapped = legacyMap[raw] || raw;
    const num = parseInt(mapped.replace('template', ''), 10);
    return /^template\d+$/.test(mapped) && num >= 1 && num <= 52 ? mapped : 'template1';
}

function bindBuilderDashboardLink(root) {
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

// ============================================================
// SESSION CHECK — update navbar
// ============================================================
async function checkSession() {
    try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data.loggedIn && data.user) {
            const user = data.user;
            const initial = (user.name || '?').charAt(0).toUpperCase();
            const userName = user.name || 'User';
            const loginLi = document.getElementById('navLoginLi');
            const dashLi  = document.getElementById('navDashLi');
            const nameEl  = document.getElementById('navUserName');
            if (loginLi) loginLi.style.display = 'none';
            if (dashLi)  dashLi.style.display = 'list-item';
            if (nameEl)  nameEl.textContent = userName;
            // show user widget if present
            const widget = document.getElementById('navUserWidget');
            if (widget) {
                widget.style.display = 'flex';
                bindBuilderDashboardLink(widget);
                const av = document.getElementById('navWidgetAvatar');
                const nm = document.getElementById('navWidgetName');
                if (av) av.textContent = initial;
                if (nm) nm.textContent = userName;
            }
            document.querySelectorAll('.nav-user-pill').forEach(bindBuilderDashboardLink);
            const logoutBtn = document.getElementById('navLogoutBtn');
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
        }
    } catch (e) {}
}

// ============================================================
// PROGRESS
// ============================================================
function updateProgress() {
    document.getElementById('currentStepLabel').textContent = currentStep;
    const pct = (currentStep / totalSteps) * 100;
    document.getElementById('progressBar').style.width = pct + '%';

    for (let i = 1; i <= totalSteps; i++) {
        const dot  = document.getElementById('dot-' + i);
        const line = document.getElementById('line-' + i);
        dot.classList.remove('active', 'done');
        if (line) line.classList.remove('done');

        if (i < currentStep) {
            dot.classList.add('done');
            if (line) line.classList.add('done');
        } else if (i === currentStep) {
            dot.classList.add('active');
        }
    }
}

// ============================================================
// NAVIGATION
// ============================================================
function nextStep() {
    if (!validateStep(currentStep)) return;
    collectStepData(currentStep);
    autoSaveStep();
    if (currentStep < totalSteps) showStep(currentStep + 1);
}

function prevStep() {
    if (currentStep > 1) {
        collectStepData(currentStep);
        showStep(currentStep - 1);
    }
}

function showStep(n) {
    document.getElementById('step-' + currentStep).classList.remove('active');
    currentStep = n;
    document.getElementById('step-' + currentStep).classList.add('active');
    updateProgress();
    if (currentStep === 4) loadSkillSuggestions();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// VALIDATION
// ============================================================
function validateStep(step) {
    switch (step) {
        case 1:
            if (!resumeData.jobTitle) { showToast('Please select or type a job title.', 'error'); return false; }
            break;
        case 2:
            if (!resumeData.experienceLevel) { showToast('Please select your experience level.', 'error'); return false; }
            break;
        case 6:
            if (!document.getElementById('fullName').value.trim())  { showToast('Name is required.', 'error'); return false; }
            if (!document.getElementById('emailAddr').value.trim())  { showToast('Email is required.', 'error'); return false; }
            break;
    }
    return true;
}

// ============================================================
// COLLECT STEP DATA
// ============================================================
function collectStepData(step) {
    switch (step) {
        case 2:
            collectExperienceData();
            break;

        case 3:
            const eduList = [];
            document.querySelectorAll('.edu-entry').forEach(entry => {
                eduList.push({
                    university: entry.querySelector('.edu-university')?.value || '',
                    location:   entry.querySelector('.edu-location')?.value || '',
                    degree:     entry.querySelector('.edu-degree')?.value || '',
                    field:      entry.querySelector('.edu-field')?.value || '',
                    month:      entry.querySelector('.edu-month')?.value || '',
                    year:       entry.querySelector('.edu-year')?.value || '',
                    cgpa:       entry.querySelector('.edu-cgpa')?.value || ''
                });
            });
            resumeData.educationJson = JSON.stringify(eduList);
            break;

        case 5:
            const projList = [];
            document.querySelectorAll('.proj-entry').forEach(entry => {
                const title = entry.querySelector('.proj-title')?.value || '';
                if (title) {
                    projList.push({
                        title,
                        tools: entry.querySelector('.proj-tools')?.value || '',
                        description: entry.querySelector('.proj-desc')?.value || ''
                    });
                }
            });
            resumeData.projectsJson = JSON.stringify(projList);
            break;

        case 6:
            resumeData.fullName       = document.getElementById('fullName').value.trim();
            resumeData.email          = document.getElementById('emailAddr').value.trim();
            resumeData.phone          = document.getElementById('phoneNum').value.trim();
            resumeData.address        = document.getElementById('addressField')?.value.trim() || '';
            resumeData.website        = document.getElementById('websiteField')?.value.trim() || '';
            resumeData.linkedin       = document.getElementById('linkedinField')?.value.trim() || '';
            resumeData.location       = document.getElementById('locationField')?.value.trim() || '';
            resumeData.profileSummary = document.getElementById('profileSummary').value.trim();
            resumeData.profilePhotoData = profilePhotoBase64;
            break;

        case 7:
            resumeData.includePhoto = document.getElementById('includePhoto').checked;
            break;
    }
}

// ============================================================
// AUTO SAVE
// ============================================================
async function autoSaveStep() {
    try {
        if (!resumeId) {
            const res  = await fetch(`${API_BASE}/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(resumeData)
            });
            const data = await res.json();
            resumeId = data.id;
        } else {
            await fetch(`${API_BASE}/${resumeId}/step`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(resumeData)
            });
        }
    } catch (err) { console.error('Auto-save error:', err); }
}

// ============================================================
// SAVE DRAFT
// ============================================================
async function saveDraft() {
    collectStepData(currentStep);
    try {
        let res, data;
        if (!resumeId) {
            res  = await fetch(`${API_BASE}/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...resumeData, status: 'DRAFT' })
            });
            data = await res.json();
            resumeId = data.id;
        } else {
            res  = await fetch(`${API_BASE}/${resumeId}/draft`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(resumeData)
            });
            data = await res.json();
        }
        showToast('✓ Draft saved! Resume ID: ' + data.id);
    } catch (err) {
        showToast('Failed to save draft.', 'error');
    }
}

// ============================================================
// PROCESS CV (Final)
// ============================================================
async function processCV() {
    // Collect all steps to make sure nothing is missed
    collectStepData(3);
    collectStepData(4);
    collectStepData(5);
    collectStepData(6);
    collectStepData(7);
    if (!resumeData.templateName) { showToast('Please choose a template.', 'error'); return; }

    document.getElementById('processingOverlay').style.display = 'flex';

    try {
        let data = null;
        if (!resumeId) {
            const res = await fetch(`${API_BASE}/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...resumeData, status: 'COMPLETE' })
            });
            data = await res.json().catch(() => null);
            if (res.ok && data && (data.id || data.resumeId)) {
                resumeId = data.id || data.resumeId;
            }
        } else {
            const res = await fetch(`${API_BASE}/${resumeId}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(resumeData)
            });
            data = await res.json().catch(() => null);
            if (!res.ok) console.error('Process failed:', data);
        }

        const finalId = (data && (data.id || data.resumeId)) ? (data.id || data.resumeId) : resumeId;
        setTimeout(() => {
            document.getElementById('processingOverlay').style.display = 'none';
            sessionStorage.setItem('resumeData', JSON.stringify(resumeData));
            sessionStorage.setItem('selectedTemplate', resumeData.templateName);
            if (finalId) {
                window.location.href = `/review/${finalId}?template=${encodeURIComponent(resumeData.templateName)}`;
            } else {
                window.location.href = `/review?template=${encodeURIComponent(resumeData.templateName)}`;
            }
        }, 2000);

    } catch (err) {
        console.error('Process CV error:', err);
        document.getElementById('processingOverlay').style.display = 'none';
        sessionStorage.setItem('resumeData', JSON.stringify(resumeData));
        sessionStorage.setItem('selectedTemplate', resumeData.templateName);
        window.location.href = `/review?template=${encodeURIComponent(resumeData.templateName)}`;
    }
}

// ============================================================
// LOAD EXISTING RESUME
// ============================================================
async function loadExistingResume(id) {
    try {
        const res  = await fetch(`${API_BASE}/${id}`);
        const data = await res.json();
        Object.assign(resumeData, data);
        populateUIFromData(data);
    } catch (err) { console.error('Failed to load resume:', err); }
}

function populateUIFromData(data) {
    if (data.jobTitle)  selectJob(data.jobTitle);
    if (data.fullName)  document.getElementById('fullName').value = data.fullName;
    if (data.email)     document.getElementById('emailAddr').value = data.email;
    if (data.phone)     document.getElementById('phoneNum').value = data.phone;
    if (data.address  && document.getElementById('addressField'))   document.getElementById('addressField').value  = data.address;
    if (data.website  && document.getElementById('websiteField'))   document.getElementById('websiteField').value  = data.website;
    if (data.linkedin && document.getElementById('linkedinField'))  document.getElementById('linkedinField').value = data.linkedin;
    if (data.location && document.getElementById('locationField'))  document.getElementById('locationField').value = data.location;
    if (data.profileSummary) document.getElementById('profileSummary').value = data.profileSummary;
    if (data.templateName)   selectTemplate(data.templateName);
    if (data.skillsJson) {
        try { JSON.parse(data.skillsJson).forEach(s => addSkillTag(s)); } catch {}
    }
    if (data.experienceLevel) {
        document.querySelectorAll('.exp-card').forEach(c => {
            if (c.querySelector('span')?.textContent === data.experienceLevel) {
                c.classList.add('selected');
                resumeData.experienceLevel = data.experienceLevel;
            }
        });
    }
}

// ============================================================
// STEP 1 — JOB TITLE
// ============================================================
const allJobs = [
    'UI Designer','UX Designer','Software Developer','Marketing Executive','Data Analyst',
    'Customer Support','Product Manager','Full Stack Developer','Business Analyst',
    'Graphic Designer','DevOps Engineer','QA Engineer','HR Manager',
    'Content Writer','Digital Marketer','Backend Developer','Frontend Developer',
    'Mobile Developer','Cloud Engineer','Data Scientist','Network Engineer',
    'Sales Executive','Finance Analyst','Operations Manager','Project Manager'
];

function filterJobSuggestions(val) {
    const list = document.getElementById('jobSuggestions');
    list.innerHTML = '';
    const filtered = val
        ? allJobs.filter(j => j.toLowerCase().includes(val.toLowerCase()))
        : allJobs;
    filtered.forEach(job => {
        const li = document.createElement('li');
        li.textContent = job;
        li.onclick = () => selectJob(job);
        list.appendChild(li);
    });
}

function handleJobKey(e) {
    if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (val) addCustomJobTitle(val);
    }
}

function addCustomJob() {
    const val = document.getElementById('jobInput').value.trim();
    if (val) addCustomJobTitle(val);
    else showToast('Type a job title first.', 'error');
}

function addCustomJobTitle(title) {
    if (!allJobs.includes(title)) allJobs.unshift(title);
    selectJob(title);
    filterJobSuggestions('');
}

function selectJob(job) {
    resumeData.jobTitle = job;
    document.getElementById('jobInput').value = job;
    document.getElementById('selectedJobTag').innerHTML =
        `<div class="selected-tag">${job} <button onclick="clearJob()">✕</button></div>`;
    loadSkillSuggestions();
}

function clearJob() {
    resumeData.jobTitle = '';
    document.getElementById('jobInput').value = '';
    document.getElementById('selectedJobTag').innerHTML = '';
}

// ============================================================
// STEP 2 — EXPERIENCE
// ============================================================
function selectExp(el, level) {
    document.querySelectorAll('.exp-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    resumeData.experienceLevel = level;

    const section = document.getElementById('experienceDetailsSection');
    if (level === 'No Experience (Fresher)') {
        section.style.display = 'none';
        resumeData.experienceJson = '[]';
    } else {
        section.style.display = 'block';
        // Populate year dropdowns on first show
        document.querySelectorAll('.exp-start-year, .exp-end-year').forEach(sel => {
            if (sel.options.length === 0) populateExpYearDropdown(sel);
        });
    }
}

let expCount = 1;

function addExperience() {
    const container = document.getElementById('experienceEntries');
    const idx = expCount++;
    const div = document.createElement('div');
    div.className = 'exp-entry';
    div.id = 'exp-entry-' + idx;
    div.innerHTML = `
        <hr style="margin:20px 0;border-color:#f3f4f6;">
        <div style="display:flex;justify-content:flex-end;">
            <button onclick="removeExpEntry(${idx})" style="background:transparent;border:none;color:#ef4444;cursor:pointer;font-size:13px;font-weight:600;">✕ Remove</button>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Job Title / Role*</label><input type="text" placeholder="e.g., Software Developer" class="exp-jobtitle"></div>
            <div class="form-group"><label>Company Name*</label><input type="text" placeholder="e.g., Infosys" class="exp-company"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Location</label><input type="text" placeholder="e.g., Chennai, Tamil Nadu" class="exp-location"></div>
            <div class="form-group">
                <label>Employment Type</label>
                <select class="exp-type">
                    <option value="">Select</option>
                    <option>Full-time</option><option>Part-time</option>
                    <option>Internship</option><option>Freelance</option><option>Contract</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Start Date*</label>
                <div style="display:flex;gap:8px;">
                    <select class="exp-start-month" style="flex:1;">
                        <option value="">Month</option>
                        <option>January</option><option>February</option><option>March</option>
                        <option>April</option><option>May</option><option>June</option>
                        <option>July</option><option>August</option><option>September</option>
                        <option>October</option><option>November</option><option>December</option>
                    </select>
                    <select class="exp-start-year" style="flex:1;"></select>
                </div>
            </div>
            <div class="form-group">
                <label>End Date</label>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <select class="exp-end-month" style="flex:1;">
                        <option value="">Month</option>
                        <option>January</option><option>February</option><option>March</option>
                        <option>April</option><option>May</option><option>June</option>
                        <option>July</option><option>August</option><option>September</option>
                        <option>October</option><option>November</option><option>December</option>
                    </select>
                    <select class="exp-end-year" style="flex:1;"></select>
                    <label class="exp-current-label"><input type="checkbox" class="exp-current" onchange="toggleCurrentJob(this)"> Currently Working</label>
                </div>
            </div>
        </div>
        <div class="form-group full-width">
            <label>Job Description / Responsibilities</label>
            <textarea placeholder="Describe your key responsibilities and achievements..." class="exp-desc" rows="3"></textarea>
        </div>`;
    container.appendChild(div);
    div.querySelectorAll('.exp-start-year, .exp-end-year').forEach(sel => populateExpYearDropdown(sel));
}

function removeExpEntry(idx) {
    const el = document.getElementById('exp-entry-' + idx);
    if (el) el.remove();
}

function toggleCurrentJob(checkbox) {
    const endMonth = checkbox.closest('.form-group').querySelector('.exp-end-month');
    const endYear  = checkbox.closest('.form-group').querySelector('.exp-end-year');
    if (endMonth) endMonth.disabled = checkbox.checked;
    if (endYear)  { endYear.disabled = checkbox.checked; if (checkbox.checked) { endYear.dataset.prev = endYear.value; endYear.value = 'Present'; } else { endYear.value = endYear.dataset.prev || ''; } }
}

function populateExpYearDropdown(sel) {
    sel.innerHTML = '<option value="">Year</option>';
    const now = new Date().getFullYear();
    for (let y = now; y >= 1980; y--) {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y;
        sel.appendChild(opt);
    }
}

function collectExperienceData() {
    const expList = [];
    document.querySelectorAll('.exp-entry').forEach(entry => {
        const title = entry.querySelector('.exp-jobtitle')?.value || '';
        const company = entry.querySelector('.exp-company')?.value || '';
        if (title || company) {
            expList.push({
                jobTitle:    title,
                company:     company,
                location:    entry.querySelector('.exp-location')?.value || '',
                type:        entry.querySelector('.exp-type')?.value || '',
                startMonth:  entry.querySelector('.exp-start-month')?.value || '',
                startYear:   entry.querySelector('.exp-start-year')?.value || '',
                endMonth:    entry.querySelector('.exp-end-month')?.value || '',
                endYear:     entry.querySelector('.exp-end-year')?.value || '',
                current:     entry.querySelector('.exp-current')?.checked || false,
                description: entry.querySelector('.exp-desc')?.value || '',
                startDate:   [entry.querySelector('.exp-start-month')?.value, entry.querySelector('.exp-start-year')?.value].filter(Boolean).join(' '),
                endDate:     entry.querySelector('.exp-current')?.checked ? 'Present' : [entry.querySelector('.exp-end-month')?.value, entry.querySelector('.exp-end-year')?.value].filter(Boolean).join(' ')
            });
        }
    });
    resumeData.experienceJson = JSON.stringify(expList);
}

// ============================================================
// STEP 3 — EDUCATION
// ============================================================
let eduCount = 1;

function addEducation() {
    const container = document.getElementById('educationEntries');
    const idx = eduCount++;
    const div = document.createElement('div');
    div.className = 'edu-entry';
    div.id = 'edu-' + idx;
    div.innerHTML = `
        <hr style="margin:20px 0;border-color:#f3f4f6;">
        <div style="display:flex;justify-content:flex-end;">
            <button onclick="removeEdu(${idx})" style="background:transparent;border:none;color:#ef4444;cursor:pointer;font-size:13px;font-weight:600;">✕ Remove</button>
        </div>
        <div class="form-row">
            <div class="form-group"><label>University*</label><input type="text" placeholder="University Name" class="edu-university"></div>
            <div class="form-group"><label>Location*</label><input type="text" placeholder="Tamil Nadu, India" class="edu-location"></div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Degree*</label>
                <select class="edu-degree">
                    <option value="">Select</option>
                    <option>B.E / B.Tech</option><option>M.E / M.Tech</option>
                    <option>B.Sc</option><option>M.Sc</option><option>MBA</option>
                    <option>B.Com</option><option>BCA</option><option>MCA</option>
                    <option>PhD</option><option>Diploma</option>
                </select>
            </div>
            <div class="form-group"><label>Field of Study*</label><input type="text" placeholder="e.g., ECE" class="edu-field"></div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Month</label>
                <select class="edu-month">
                    <option>January</option><option>February</option><option>March</option>
                    <option>April</option><option>May</option><option>June</option>
                    <option>July</option><option>August</option><option>September</option>
                    <option>October</option><option>November</option><option>December</option>
                </select>
            </div>
            <div class="form-group">
                <label>Year*</label>
                <select class="edu-year">${buildYearOptions()}</select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>CGPA / Percentage</label><input type="text" placeholder="e.g., 80%" class="edu-cgpa"></div>
        </div>`;
    container.appendChild(div);
}

function removeEdu(idx) {
    const el = document.getElementById('edu-' + idx);
    if (el) el.remove();
}

function buildYearOptions() {
    let opts = '';
    const now = new Date().getFullYear();
    for (let y = now + 4; y >= 1990; y--) opts += `<option>${y}</option>`;
    return opts;
}

function populateYearDropdowns() {
    document.querySelectorAll('.edu-year, #gradYearSelect').forEach(sel => {
        const now = new Date().getFullYear();
        for (let y = now + 4; y >= 1990; y--) {
            const opt = document.createElement('option');
            opt.value = y; opt.textContent = y;
            if (y === now) opt.selected = true;
            sel.appendChild(opt);
        }
    });
}

// ============================================================
// STEP 4 — SKILLS
// ============================================================
let selectedSkills = [];

async function loadSkillSuggestions() {
    const jobTitle = resumeData.jobTitle || 'software developer';
    const list = document.getElementById('skillSuggestions');
    if (!list) return;
    list.innerHTML = '<li style="color:#9ca3af;">Loading AI suggestions...</li>';

    try {
        const res  = await fetch(`${API_BASE}/ai/suggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'skills', context: jobTitle })
        });
        const data = await res.json();
        list.innerHTML = '';
        (data.suggestions || []).forEach(skill => {
            if (!selectedSkills.includes(skill)) {
                const li = document.createElement('li');
                li.textContent = skill;
                li.onclick = () => { addSkillTag(skill); li.style.opacity = '0.4'; li.style.pointerEvents = 'none'; };
                list.appendChild(li);
            }
        });
    } catch {
        list.innerHTML = '<li onclick="addSkillTag(\'Communication\')">Communication</li>';
    }
}

function filterSkillSearch(val) {
    const list = document.getElementById('skillSuggestions');
    if (!val) { loadSkillSuggestions(); return; }
    list.querySelectorAll('li').forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(val.toLowerCase()) ? '' : 'none';
    });
}

function handleSkillKey(e) {
    if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (val) { addSkillTag(val); e.target.value = ''; }
    }
}

function addSkillFromInput() {
    const input = document.getElementById('skillInput');
    const val   = input.value.trim();
    if (val) { addSkillTag(val); input.value = ''; }
    else showToast('Type a skill first.', 'error');
}

function addSkillTag(skill) {
    if (!skill || selectedSkills.includes(skill)) return;
    selectedSkills.push(skill);
    resumeData.skillsJson = JSON.stringify(selectedSkills);

    const container = document.getElementById('selectedSkillTags');
    const tag = document.createElement('div');
    tag.className = 'skill-tag';
    tag.id = 'skill-tag-' + skill.replace(/\W/g,'_');
    tag.innerHTML = `${skill} <button onclick="removeSkill('${skill.replace(/'/g,"\\'")}')">✕</button>`;
    container.appendChild(tag);
}

function removeSkill(skill) {
    selectedSkills = selectedSkills.filter(s => s !== skill);
    resumeData.skillsJson = JSON.stringify(selectedSkills);
    const el = document.getElementById('skill-tag-' + skill.replace(/\W/g,'_'));
    if (el) el.remove();
}

// ============================================================
// STEP 5 — PROJECTS
// ============================================================
function toggleProjects(hasProjects) {
    document.getElementById('projYesBtn').classList.toggle('selected', hasProjects);
    document.getElementById('projNoBtn').classList.toggle('selected', !hasProjects);
    document.getElementById('projectForm').style.display = hasProjects ? 'block' : 'none';
}

function addProject() {
    const container = document.getElementById('projectEntries');
    const div = document.createElement('div');
    div.className = 'proj-entry';
    div.innerHTML = `
        <hr style="margin:16px 0;border-color:#f3f4f6;">
        <div style="display:flex;justify-content:flex-end;">
            <button onclick="this.closest('.proj-entry').remove()" style="background:transparent;border:none;color:#ef4444;cursor:pointer;font-size:13px;font-weight:600;">✕ Remove</button>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Project Title*</label><input type="text" placeholder="Title" class="proj-title"></div>
            <div class="form-group"><label>Tools Used</label><input type="text" placeholder="Tools & Technologies" class="proj-tools"></div>
        </div>
        <div class="form-group full-width">
            <label>Description</label>
            <textarea placeholder="About Project" class="proj-desc" rows="3"></textarea>
        </div>`;
    container.appendChild(div);
}

// ============================================================
// STEP 6 — PROFILE PHOTO
// ============================================================
function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        profilePhotoBase64 = e.target.result;
        resumeData.profilePhotoData = profilePhotoBase64;
        showToast('✓ Photo uploaded!');
    };
    reader.readAsDataURL(file);
}

// ============================================================
// STEP 6 — AI SUMMARY (3 options)
// ============================================================
async function generateAISummary() {
    const btn = document.querySelector('.ai-gen-btn');
    btn.textContent = '✦ Generating...';
    btn.disabled = true;

    try {
        const res  = await fetch(`${API_BASE}/ai/suggestions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'profileSummary', context: resumeData.jobTitle || 'professional' })
        });
        const data = await res.json();
        const summaries = data.summaries || [];
        showAISummaryModal(summaries);
    } catch {
        showToast('Could not generate AI suggestions.', 'error');
    } finally {
        btn.textContent = '✦ Generate AI Suggestions (3 options)';
        btn.disabled = false;
    }
}

function showAISummaryModal(summaries) {
    const container = document.getElementById('aiSummaryOptions');
    container.innerHTML = '';
    summaries.forEach((s, i) => {
        const card = document.createElement('div');
        card.className = 'ai-summary-card';
        card.innerHTML = `
            <strong>${s.title}</strong>
            <p>${s.text}</p>
        `;
        card.onclick = () => {
            document.getElementById('profileSummary').value = s.text;
            resumeData.profileSummary = s.text;
            closeAISummaryModal();
            showToast('✓ Summary applied!');
        };
        container.appendChild(card);
    });
    document.getElementById('aiSummaryModal').style.display = 'flex';
}

function closeAISummaryModal() {
    document.getElementById('aiSummaryModal').style.display = 'none';
}

// ============================================================
// STEP 7 — TEMPLATE
// ============================================================
const TEMPLATE_LIST = [
    { id: 'template1',  label: 'Minimal Resume Template' },
    { id: 'template2',  label: 'Modern Resume Template' },
    { id: 'template3',  label: 'Creative Resume Template' },
    { id: 'template4',  label: 'Professional Resume Template' },
    { id: 'template5',  label: 'Classic Resume Template' },
    { id: 'template6',  label: 'Executive Resume Template' },
    { id: 'template7',  label: 'Elegant Resume Template' },
    { id: 'template8',  label: 'Bold Resume Template' },
    { id: 'template9',  label: 'Clean Resume Template' },
    { id: 'template10', label: 'Simple Resume Template' },
];

function buildTemplateDropdown() {
    const grid = document.getElementById('templateDropdownGrid');
    if (!grid || grid.children.length > 0) return;
    TEMPLATE_LIST.forEach(t => {
        const item = document.createElement('div');
        item.className = 'tmpl-dropdown-item';
        item.id = 'tmpl-dd-' + t.id;
        item.innerHTML = `<span class="tmpl-dd-name">${t.label}</span>`;
        item.onclick = () => {
            selectTemplate(t.id);
            closeTemplateDropdown();
        };
        grid.appendChild(item);
    });
}

function toggleTemplateDropdown(e) {
    if (e) e.stopPropagation();
    buildTemplateDropdown();
    const dd = document.getElementById('templateDropdown');
    const isOpen = dd.style.display !== 'none';
    dd.style.display = isOpen ? 'none' : 'block';
    highlightCurrentInDropdown();
}

function closeTemplateDropdown() {
    const dd = document.getElementById('templateDropdown');
    if (dd) dd.style.display = 'none';
}

function highlightCurrentInDropdown() {
    document.querySelectorAll('.tmpl-dropdown-item').forEach(item => {
        item.classList.remove('active');
    });
    const cur = document.getElementById('tmpl-dd-' + resumeData.templateName);
    if (cur) cur.classList.add('active');
}

function selectTemplate(name) {
    const templateName = normalizeBuilderTemplate(name);
    resumeData.templateName = templateName;
    sessionStorage.setItem('selectedTemplate', templateName);
    document.querySelectorAll('.tmpl-option').forEach(o => o.classList.remove('selected'));
    const el = document.getElementById('tmpl-' + templateName);
    if (el) el.classList.add('selected');
    const label = document.getElementById('selectedTemplateLabel');
    // Find nice label from TEMPLATE_LIST
    const found = TEMPLATE_LIST.find(t => t.id === templateName);
    if (label) label.textContent = found ? found.label : templateName.replace('template', 'Template ');
    highlightCurrentInDropdown();
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    const dd = document.getElementById('templateDropdown');
    const btn = document.querySelector('.builder-template-change');
    if (dd && btn && !dd.contains(e.target) && !btn.contains(e.target)) {
        dd.style.display = 'none';
    }
});

// ============================================================
// UPLOAD CV
// ============================================================
async function handleCvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    showToast('Parsing your CV...');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res  = await fetch(`${API_BASE}/upload-cv`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            parsedCvData = data.parsed || {};
            if (hasMeaningfulParsedCvData(parsedCvData)) {
                applyParsedData(true);
            } else {
                showUploadParseModal(parsedCvData);
            }
        } else {
            showToast('Could not parse CV: ' + (data.message || 'Unknown error'), 'error');
        }
    } catch {
        showToast('Upload failed. Please try again.', 'error');
    }
}

function showUploadParseModal(parsed) {
    const preview = document.getElementById('parsedDataPreview');
    preview.innerHTML = '';

    const fields = [
        { key: 'fullName', label: '👤 Name' },
        { key: 'email',    label: '✉ Email' },
        { key: 'phone',    label: '📞 Phone' },
        { key: 'skillsHint', label: '🛠 Skills hint' }
    ];

    fields.forEach(f => {
        if (parsed[f.key]) {
            const row = document.createElement('div');
            row.className = 'parsed-row';
            row.innerHTML = `<span class="parsed-label">${f.label}</span><span class="parsed-val">${parsed[f.key]}</span>`;
            preview.appendChild(row);
        }
    });

    if (preview.innerHTML === '') {
        preview.innerHTML = '<p style="color:#6b7280;text-align:center;">We could extract some data. Click Apply to pre-fill what we found.</p>';
    }

    document.getElementById('uploadParseModal').style.display = 'flex';
}

function applyParsedData() {
    if (parsedCvData.fullName) {
        document.getElementById('fullName').value = parsedCvData.fullName;
        resumeData.fullName = parsedCvData.fullName;
    }
    if (parsedCvData.email) {
        document.getElementById('emailAddr').value = parsedCvData.email;
        resumeData.email = parsedCvData.email;
    }
    if (parsedCvData.phone) {
        document.getElementById('phoneNum').value = parsedCvData.phone;
        resumeData.phone = parsedCvData.phone;
    }
    document.getElementById('uploadParseModal').style.display = 'none';
    showToast('✓ CV data applied! Please review and fill in missing fields.');
    // Jump to personal details step
    showStep(6);
}

// ============================================================
// TOAST
// ============================================================
function setBuilderFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el && typeof value === 'string') el.value = value;
}

function applyParsedSkills(skills) {
    if (!Array.isArray(skills) || !skills.length) return;
    selectedSkills = [];
    resumeData.skillsJson = '[]';
    const container = document.getElementById('selectedSkillTags');
    if (container) container.innerHTML = '';
    skills.forEach(skill => addSkillTag(skill));
}

function normalizeParsedCvPayload(parsed) {
    const payload = {};
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
        const hintedSkills = parsed.skillsHint
            .split(/[\n,|•·]/)
            .map(s => s.trim())
            .filter(Boolean)
            .slice(0, 10);
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

function hasMeaningfulParsedCvData(parsed) {
    if (!parsed || typeof parsed !== 'object') return false;
    if (parsed.fullName || parsed.jobTitle || parsed.email || parsed.phone || parsed.profileSummary) return true;
    if (Array.isArray(parsed.skills) && parsed.skills.length) return true;
    if (Array.isArray(parsed.education) && parsed.education.length) return true;
    if (Array.isArray(parsed.experience) && parsed.experience.length) return true;
    if (Array.isArray(parsed.projects) && parsed.projects.length) return true;
    return false;
}

function redirectToReviewWithParsedCv() {
    const templateName = normalizeBuilderTemplate(resumeData.templateName || sessionStorage.getItem('selectedTemplate') || 'template1');
    resumeData.templateName = templateName;
    sessionStorage.setItem('resumeData', JSON.stringify(resumeData));
    sessionStorage.setItem('selectedTemplate', templateName);
    sessionStorage.removeItem('pendingResumeId');
    window.location.href = `/review?template=${encodeURIComponent(templateName)}`;
}

function showUploadParseModal(parsed) {
    const preview = document.getElementById('parsedDataPreview');
    preview.innerHTML = '';

    const fields = [
        { key: 'fullName', label: 'Name' },
        { key: 'jobTitle', label: 'Job Title' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'profileSummary', label: 'Summary' },
        { key: 'skills', label: 'Skills' }
    ];

    fields.forEach(f => {
        if (!parsed[f.key]) return;
        const row = document.createElement('div');
        const value = Array.isArray(parsed[f.key]) ? parsed[f.key].join(', ') : parsed[f.key];
        row.className = 'parsed-row';
        row.innerHTML = `<span class="parsed-label">${f.label}</span><span class="parsed-val">${value}</span>`;
        preview.appendChild(row);
    });

    [
        { key: 'education', label: 'Education entries' },
        { key: 'experience', label: 'Experience entries' },
        { key: 'projects', label: 'Project entries' }
    ].forEach(f => {
        if (!Array.isArray(parsed[f.key]) || !parsed[f.key].length) return;
        const row = document.createElement('div');
        row.className = 'parsed-row';
        row.innerHTML = `<span class="parsed-label">${f.label}</span><span class="parsed-val">${parsed[f.key].length}</span>`;
        preview.appendChild(row);
    });

    if (preview.innerHTML === '') {
        preview.innerHTML = '<p style="color:#6b7280;text-align:center;">We could extract some data. Click Apply to pre-fill what we found.</p>';
    }

    document.getElementById('uploadParseModal').style.display = 'flex';
}

function applyParsedData(goToReview = true) {
    const payload = normalizeParsedCvPayload(parsedCvData);
    Object.assign(resumeData, payload);

    if (payload.jobTitle) selectJob(payload.jobTitle);
    setBuilderFieldValue('fullName', payload.fullName || '');
    setBuilderFieldValue('emailAddr', payload.email || '');
    setBuilderFieldValue('phoneNum', payload.phone || '');
    setBuilderFieldValue('addressField', payload.address || '');
    setBuilderFieldValue('websiteField', payload.website || '');
    setBuilderFieldValue('linkedinField', payload.linkedin || '');
    setBuilderFieldValue('locationField', payload.location || '');
    setBuilderFieldValue('profileSummary', payload.profileSummary || '');

    if (payload.skillsJson) {
        try { applyParsedSkills(JSON.parse(payload.skillsJson)); } catch {}
    }

    sessionStorage.setItem('resumeData', JSON.stringify(resumeData));
    sessionStorage.setItem('selectedTemplate', resumeData.templateName);
    document.getElementById('uploadParseModal').style.display = 'none';
    if (goToReview) {
        showToast('CV uploaded successfully! Opening review page...');
        setTimeout(() => redirectToReviewWithParsedCv(), 150);
        return;
    }
    showToast('CV data applied! Please review and fill in missing fields.');
    showStep(6);
}

function showToast(msg, type = 'success') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position:fixed;bottom:30px;right:30px;padding:14px 24px;border-radius:12px;
            font-weight:600;font-size:14px;z-index:9999;color:#fff;
            box-shadow:0 4px 16px rgba(0,0,0,0.15);transition:opacity 0.3s;`;
        document.body.appendChild(toast);
    }
    toast.style.background = type === 'error' ? '#ef4444' : '#22c55e';
    toast.textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ============================================================
// MODAL HELPERS
// ============================================================
function openResumeModal() {
    window.location.href = '/builder';
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});
// Logout handler
async function doLogout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch(e) {}
    window.location.href = "/";
}
