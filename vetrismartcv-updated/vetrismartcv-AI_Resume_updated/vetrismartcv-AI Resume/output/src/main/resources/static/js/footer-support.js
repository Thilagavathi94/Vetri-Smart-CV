(function () {
    const DEFAULT_SUPPORT = {
        phoneDisplay: '+91 98765 43210',
        phoneLink: 'tel:+919876543210',
        email: 'support@vetrismartcv.com',
        address: 'Chennai, Tamil Nadu, India',
        mapUrl: 'https://maps.google.com/?q=Chennai,Tamil%20Nadu,India',
        hours: 'Mon-Fri, 9am-6pm IST',
        emailEnabled: false
    };

    let supportConfig = { ...DEFAULT_SUPPORT };

    function updateFooterModalContents() {
        if (!window.footerModalContents || !window.footerModalContents.contact) {
            return;
        }

        window.footerModalContents.contact = `
            <h2 style="font-size:2rem;font-weight:900;color:#1f2940;margin:0 0 8px;display:flex;align-items:center;gap:14px;">
              <span style="width:56px;height:56px;border-radius:18px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:28px;box-shadow:0 12px 32px rgba(124,58,237,.28);">💬</span>
              Contact Us
            </h2>
            <p style="font-size:1rem;color:#667085;margin:0 0 28px;">Need help with your resume or account? Reach out to our support team.</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px;">
              <a href="${supportConfig.phoneLink}" style="text-decoration:none;background:#fff7ed;border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:8px;color:#374151;">
                <strong style="color:#1f2940;">Phone</strong>
                <span>${supportConfig.phoneDisplay}</span>
              </a>
              <a href="mailto:${supportConfig.email}" style="text-decoration:none;background:#eff6ff;border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:8px;color:#374151;">
                <strong style="color:#1f2940;">Email</strong>
                <span>${supportConfig.email}</span>
              </a>
              <a href="${supportConfig.mapUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;background:#f5f3ff;border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:8px;color:#374151;">
                <strong style="color:#1f2940;">Location</strong>
                <span>${supportConfig.address}</span>
              </a>
              <div style="background:#eef7ff;border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:8px;color:#374151;">
                <strong style="color:#1f2940;">Hours</strong>
                <span>${supportConfig.hours}</span>
              </div>
            </div>
            <div id="contactFormWrap">
              <h3 style="font-size:1.2rem;font-weight:800;color:#1f2940;margin:0 0 16px;">Send Us a Message</h3>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <input id="cf_name" type="text" placeholder="Your Name" required style="padding:14px 16px;border:1.5px solid #d8def0;border-radius:14px;font-size:15px;outline:none;">
                <input id="cf_email" type="email" placeholder="your@email.com" required style="padding:14px 16px;border:1.5px solid #d8def0;border-radius:14px;font-size:15px;outline:none;">
              </div>
              <input id="cf_subject" type="text" placeholder="Subject" required style="margin-top:14px;width:100%;padding:14px 16px;border:1.5px solid #d8def0;border-radius:14px;font-size:15px;outline:none;box-sizing:border-box;">
              <textarea id="cf_message" rows="5" placeholder="Enter your message here - Minimum 20 characters required" required style="margin-top:14px;width:100%;padding:14px 16px;border:1.5px solid #d8def0;border-radius:14px;font-size:15px;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
              <button onclick="submitContactForm()" style="margin-top:16px;padding:14px 22px;border:none;border-radius:14px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 16px 40px rgba(124,58,237,.25);">Send Message</button>
            </div>
            <div id="contactFormSuccess" style="display:none;background:#ecfdf3;border:1px solid #bbf7d0;border-radius:18px;padding:20px;color:#166534;">
              <h3 style="margin:0 0 8px;font-size:1.15rem;">Support Request Received</h3>
              <p id="contactSuccessMessage" style="margin:0 0 10px;">Thank you for contacting VetriSmartCV. We have received your request and our support team will get back to you shortly.</p>
              <p id="contactSuccessEmailNote" style="display:none;margin:0;color:#166534;font-weight:600;">A confirmation email has been sent to your inbox.</p>
            </div>
        `;
    }

    function patchFooterContactColumn() {
        document.querySelectorAll('.footer-col').forEach((column) => {
            const heading = column.querySelector('h4');
            if (!heading || heading.textContent.trim().toLowerCase() !== 'contact') {
                return;
            }

            const items = column.querySelectorAll('li');
            if (items[0]) {
                items[0].innerHTML = `<a href="${supportConfig.phoneLink}" style="color:inherit;text-decoration:none;">${supportConfig.phoneDisplay}</a>`;
            }
            if (items[1]) {
                items[1].innerHTML = `<a href="mailto:${supportConfig.email}" style="color:inherit;text-decoration:none;">${supportConfig.email}</a>`;
            }
            if (items[2]) {
                items[2].innerHTML = `<a href="${supportConfig.mapUrl}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${supportConfig.address}</a>`;
            }
            if (items[3]) {
                items[3].textContent = supportConfig.hours;
            }
        });
    }

    async function loadSupportConfig() {
        try {
            const response = await fetch('/api/support/config');
            if (!response.ok) {
                return;
            }
            const config = await response.json();
            supportConfig = { ...DEFAULT_SUPPORT, ...config };
        } catch (error) {
            console.warn('Falling back to default support config.', error);
        } finally {
            updateFooterModalContents();
            patchFooterContactColumn();
        }
    }

    window.submitContactForm = async function submitContactForm() {
        const name = document.getElementById('cf_name')?.value.trim() || '';
        const emailRaw = document.getElementById('cf_email')?.value.trim() || '';
        const email = emailRaw.toLowerCase();
        const subject = document.getElementById('cf_subject')?.value.trim() || '';
        const message = document.getElementById('cf_message')?.value.trim() || '';

        // D_012 FIX: Client-side validation for name and email
        if (!name || !emailRaw || !subject || !message) {
            alert('Please fill in all fields before sending.');
            return;
        }

        // D_012 FIX: Name must be alphabetic only (no numbers/special chars)
        const nameRegex = /^[A-Za-z]+(\s[A-Za-z]+)*$/;
        if (!nameRegex.test(name)) {
            alert('Please enter a valid name (letters and spaces only). Numbers and special characters are not allowed.');
            document.getElementById('cf_name').focus();
            return;
        }

        // D_012 FIX: Email format validation + normalize to lowercase
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailRaw)) {
            alert('Please enter a valid email address (e.g. you@example.com).');
            document.getElementById('cf_email').focus();
            return;
        }

        // D_012 FIX: Message minimum 20 characters
        if (message.length < 20) {
            alert('Your message must be at least 20 characters long.');
            document.getElementById('cf_message').focus();
            return;
        }

        try {
            const response = await fetch('/api/support/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, subject, message })  // email already normalized to lowercase
            });

            const result = await response.json();
            if (!result.success) {
                alert(result.message || 'Unable to send your message right now.');
                return;
            }

            const formWrap = document.getElementById('contactFormWrap');
            const successWrap = document.getElementById('contactFormSuccess');
            const successMessage = document.getElementById('contactSuccessMessage');
            const emailNote = document.getElementById('contactSuccessEmailNote');

            if (formWrap) {
                formWrap.style.display = 'none';
            }
            if (successWrap) {
                successWrap.style.display = 'block';
            }
            if (successMessage) {
                successMessage.textContent = result.message || 'Thank you for contacting VetriSmartCV.';
            }
            if (emailNote) {
                emailNote.style.display = result.emailSent ? 'block' : 'none';
            }
        } catch (error) {
            console.error('Support form submit failed', error);
            alert('Unable to send your message right now. Please try again shortly.');
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadSupportConfig);
    } else {
        loadSupportConfig();
    }
})();