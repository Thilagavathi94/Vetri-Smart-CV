(function () {
    const DEFAULT_SUPPORT = {
        phoneDisplay: '8438164827 / 8438781327',
        phoneLink: 'tel:+918438164827',
        email: 'vetritechnologysolutions@gmail.com',
        address: "April's Complex, Bus Stand Backside, Surandai - 627859 | Shanthi's Complex, Surandai Old Market, Near Bus Stand, Surandai - 627859",
        mapUrl: 'https://maps.google.com/?q=Surandai,Tamil+Nadu+627859',
        hours: 'Mon-Fri, 9am-6pm IST',
        emailEnabled: false
    };

    let supportConfig = { ...DEFAULT_SUPPORT };

    function addresses() {
        return String(supportConfig.address || '')
            .split('|')
            .map(item => item.trim())
            .filter(Boolean);
    }

    function buildContactHtml() {
        const locationHtml = addresses()
            .map(item => `<div style="font-size:13px;color:#374151;line-height:1.5;">${item}</div>`)
            .join('');

        return `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px;">
              <a href="mailto:${supportConfig.email}" style="text-decoration:none;background:#f8f5ff;border-radius:4px;padding:16px;text-align:center;color:#374151;">
                <strong style="display:block;color:#1a1a2e;font-size:13px;margin-bottom:4px;">Email</strong>
                <span style="color:#6c3fc9;font-size:13px;font-weight:600;word-break:break-word;">${supportConfig.email}</span>
              </a>
              <a href="${supportConfig.phoneLink}" style="text-decoration:none;background:#f0fdf4;border-radius:4px;padding:16px;text-align:center;color:#374151;">
                <strong style="display:block;color:#1a1a2e;font-size:13px;margin-bottom:4px;">Phone</strong>
                <span style="color:#6c3fc9;font-size:13px;font-weight:600;">${supportConfig.phoneDisplay}</span>
              </a>
              <a href="${supportConfig.mapUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;background:#fff7ed;border-radius:4px;padding:16px;text-align:center;color:#374151;">
                <strong style="display:block;color:#1a1a2e;font-size:13px;margin-bottom:4px;">Location</strong>
                ${locationHtml}
              </a>
              <div style="background:#f0f9ff;border-radius:4px;padding:16px;text-align:center;color:#374151;">
                <strong style="display:block;color:#1a1a2e;font-size:13px;margin-bottom:4px;">Hours</strong>
                <span style="font-size:13px;">${supportConfig.hours}</span>
              </div>
            </div>
            <div style="border-top:1px solid #f0f0f5;padding-top:20px;">
              <div id="contactFormWrap">
                <h3 style="font-size:1.05rem;font-weight:800;color:#1f2940;margin:0 0 16px;">Send Us a Message</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                  <input id="cf_name" type="text" placeholder="Your Name" required style="padding:14px 16px;border:1.5px solid #d8def0;border-radius:8px;font-size:15px;outline:none;">
                  <input id="cf_email" type="email" placeholder="Your Email" required style="padding:14px 16px;border:1.5px solid #d8def0;border-radius:8px;font-size:15px;outline:none;">
                </div>
                <input id="cf_subject" type="text" placeholder="Subject" required style="margin-top:14px;width:100%;padding:14px 16px;border:1.5px solid #d8def0;border-radius:8px;font-size:15px;outline:none;box-sizing:border-box;">
                <textarea id="cf_message" rows="5" placeholder="Enter your message here - Minimum 20 characters required" required style="margin-top:14px;width:100%;padding:14px 16px;border:1.5px solid #d8def0;border-radius:8px;font-size:15px;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
                <button onclick="submitContactForm()" style="margin-top:16px;padding:14px 22px;border:none;border-radius:8px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 16px 40px rgba(124,58,237,.25);">Send Message</button>
              </div>
              <div id="contactFormSuccess" style="display:none;background:#ecfdf3;border:1px solid #bbf7d0;border-radius:6px;padding:20px;color:#166534;">
                <h3 style="margin:0 0 8px;font-size:1.15rem;">Support Request Received</h3>
                <p id="contactSuccessMessage" style="margin:0 0 10px;">Thank you for contacting VetriSmartCV. We have received your request and our support team will get back to you shortly.</p>
                <p id="contactSuccessEmailNote" style="display:none;margin:0;color:#166534;font-weight:600;">A confirmation email has been sent to your inbox.</p>
              </div>
            </div>
        `;
    }

    function updateFooterModalContents() {
        if (!window.footerModalContents || !window.footerModalContents.contact) return;
        const html = buildContactHtml();
        if (typeof window.footerModalContents.contact === 'object') {
            window.footerModalContents.contact.html = html;
        } else {
            window.footerModalContents.contact = html;
        }
    }

    function patchFooterContactColumn() {
        const modalBox = document.getElementById('footerModalBox');
        if (modalBox) {
            modalBox.style.borderRadius = '6px';
        }

        document.querySelectorAll('.footer-socials').forEach(group => {
            group.style.justifyContent = 'center';
            group.style.alignItems = 'center';
            group.querySelectorAll('.social-instagram, .social-linkedin, .social-twitter, .social-youtube, .social-github').forEach(link => {
                link.style.display = 'none';
            });
            group.querySelectorAll('a').forEach(link => {
                if (!link.classList.contains('social-instagram')) return;
                link.style.display = 'inline-flex';
                link.style.alignItems = 'center';
                link.style.justifyContent = 'center';
                link.style.padding = '0';
                link.style.lineHeight = '1';
            });
            group.querySelectorAll('svg').forEach(svg => {
                svg.style.display = 'block';
                svg.style.margin = '0';
            });
        });

        document.querySelectorAll('.footer-col').forEach((column) => {
            const heading = column.querySelector('h3, h4');
            if (!heading || heading.textContent.trim().toLowerCase() !== 'contact') return;

            column.querySelectorAll('.footer-contact-item').forEach(item => item.remove());
            column.querySelectorAll('ul').forEach(list => list.remove());
            column.insertAdjacentHTML('beforeend', `
                <div class="footer-contact-item"><div class="contact-icon">☎</div><a href="${supportConfig.phoneLink}">${supportConfig.phoneDisplay}</a></div>
                <div class="footer-contact-item"><div class="contact-icon">@</div><a href="mailto:${supportConfig.email}">${supportConfig.email}</a></div>
                ${addresses().map(address => `<div class="footer-contact-item"><div class="contact-icon">⌖</div><a href="${supportConfig.mapUrl}" target="_blank" rel="noopener noreferrer">${address}</a></div>`).join('')}
            `);
        });
    }

    async function loadSupportConfig() {
        try {
            const response = await fetch('/api/support/config');
            if (response.ok) {
                const config = await response.json();
                supportConfig = { ...DEFAULT_SUPPORT, ...config };
            }
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

        if (!name || !emailRaw || !subject || !message) {
            alert('Please fill in all fields before sending.');
            return;
        }
        if (!/^[A-Za-z]+(\s[A-Za-z]+)*$/.test(name)) {
            alert('Please enter a valid name (letters and spaces only).');
            document.getElementById('cf_name')?.focus();
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
            alert('Please enter a valid email address.');
            document.getElementById('cf_email')?.focus();
            return;
        }
        if (message.length < 20) {
            alert('Your message must be at least 20 characters long.');
            document.getElementById('cf_message')?.focus();
            return;
        }

        try {
            const response = await fetch('/api/support/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, subject, message })
            });
            const result = await response.json();
            if (!result.success) {
                alert(result.message || 'Unable to send your message right now.');
                return;
            }
            document.getElementById('contactFormWrap').style.display = 'none';
            document.getElementById('contactFormSuccess').style.display = 'block';
            const successMessage = document.getElementById('contactSuccessMessage');
            const emailNote = document.getElementById('contactSuccessEmailNote');
            if (successMessage) successMessage.textContent = result.message || 'Thank you for contacting VetriSmartCV.';
            if (emailNote) emailNote.style.display = result.emailSent ? 'block' : 'none';
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
