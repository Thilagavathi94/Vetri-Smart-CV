/* ============================================================
   VetriSmartCV — scroll-animations.js
   Smooth reveal animations for every section on scroll.
   Uses IntersectionObserver (no jQuery, no heavy libraries).
   ============================================================ */

(function () {
  'use strict';

  /* ── 1. Inject CSS ─────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `

    /* ── Base hidden state for all animated elements ── */
    .sv-reveal {
      opacity: 0;
      will-change: opacity, transform;
      transition:
        opacity 0.75s cubic-bezier(0.22, 1, 0.36, 1),
        transform 0.75s cubic-bezier(0.22, 1, 0.36, 1);
    }

    /* ── Direction variants ── */
    .sv-reveal.from-bottom  { transform: translateY(52px); }
    .sv-reveal.from-left    { transform: translateX(-60px); }
    .sv-reveal.from-right   { transform: translateX(60px); }
    .sv-reveal.from-top     { transform: translateY(-40px); }
    .sv-reveal.scale-up     { transform: scale(0.88); }
    .sv-reveal.zoom-fade    { transform: scale(0.92) translateY(24px); }

    /* ── Visible (animated-in) state ── */
    .sv-reveal.is-visible {
      opacity: 1;
      transform: none;
    }

    /* ── Stagger delays ── */
    .sv-delay-1  { transition-delay: 0.08s; }
    .sv-delay-2  { transition-delay: 0.18s; }
    .sv-delay-3  { transition-delay: 0.28s; }
    .sv-delay-4  { transition-delay: 0.38s; }
    .sv-delay-5  { transition-delay: 0.48s; }
    .sv-delay-6  { transition-delay: 0.58s; }

    /* ── Section title underline wipe ── */
    .sv-title-wipe {
      display: inline-block;
      position: relative;
    }
    .sv-title-wipe::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 0;
      width: 0;
      height: 3px;
      background: linear-gradient(90deg, #7c3aed, #f59e0b);
      border-radius: 3px;
      transition: width 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.4s;
    }
    .sv-title-wipe.is-visible::after {
      width: 100%;
    }

    /* ── Floating number counter ── */
    .sv-counter {
      display: inline-block;
    }

    /* ── Progress bar fill ── */
    .sv-progress-fill {
      width: 0 !important;
      transition: width 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.3s;
    }
    .sv-progress-fill.is-visible {
      width: var(--target-width) !important;
    }

    /* ── Scroll progress indicator (top of page) ── */
    #sv-scroll-bar {
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      width: 0%;
      background: linear-gradient(90deg, #7c3aed, #a855f7, #f59e0b);
      z-index: 99999;
      transition: width 0.1s linear;
      border-radius: 0 2px 2px 0;
      box-shadow: 0 0 8px rgba(124, 58, 237, 0.5);
    }

    /* ── Smooth scroll for anchor links ── */
    html { scroll-behavior: smooth; }

    /* ── Nav link active highlight ── */
    .sv-nav-dot {
      position: fixed;
      right: 22px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 9000;
    }
    .sv-nav-dot a {
      display: block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(124, 58, 237, 0.25);
      border: 2px solid rgba(124, 58, 237, 0.4);
      transition: all 0.3s ease;
      cursor: pointer;
    }
    .sv-nav-dot a.active,
    .sv-nav-dot a:hover {
      background: #7c3aed;
      border-color: #7c3aed;
      transform: scale(1.4);
      box-shadow: 0 0 10px rgba(124, 58, 237, 0.5);
    }
    .sv-nav-dot a[title]::before {
      content: attr(title);
      position: absolute;
      right: 22px;
      background: rgba(15, 10, 30, 0.85);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
      backdrop-filter: blur(4px);
    }
    .sv-nav-dot a:hover::before { opacity: 1; }

    /* ── Floating "back to top" button ── */
    #sv-top-btn {
      position: fixed;
      bottom: 32px;
      right: 24px;
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #7c3aed, #5b21b6);
      color: #fff;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
      opacity: 0;
      transform: translateY(20px) scale(0.8);
      transition: opacity 0.4s ease, transform 0.4s ease, background 0.2s;
      z-index: 8999;
    }
    #sv-top-btn.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    #sv-top-btn:hover {
      background: linear-gradient(135deg, #6d28d9, #4c1d95);
      transform: translateY(-3px) scale(1.05);
      box-shadow: 0 8px 28px rgba(124, 58, 237, 0.55);
    }

    /* ── Particle sparkle on feature cards hover ── */
    .feature-card {
      position: relative;
      overflow: visible;
    }
    .feature-icon {
      z-index: 2;
    }
    .feature-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at var(--mx,50%) var(--my,50%),
        rgba(124,58,237,0.08) 0%, transparent 65%);
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    }
    .feature-card:hover::before { opacity: 1; }

    /* ── How-card icon bounce ── */
    .how-card.is-visible .icon-box {
      animation: sv-bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    @keyframes sv-bounce-in {
      0%   { transform: scale(0.5) rotate(-10deg); opacity: 0; }
      60%  { transform: scale(1.15) rotate(4deg);  opacity: 1; }
      100% { transform: scale(1) rotate(0deg);     opacity: 1; }
    }

    /* ── Template card tilt-in ── */
    .tmpl-card-home {
      transition:
        transform 0.4s cubic-bezier(0.22,1,0.36,1),
        box-shadow 0.4s ease;
    }
    .tmpl-card-home:hover {
      transform: translateY(-8px) scale(1.02);
      box-shadow: 0 24px 48px rgba(0,0,0,0.14);
    }

    /* ── Job item slide ── */
    .job-item {
      opacity: 0;
      transform: translateX(-30px);
      transition:
        opacity 0.5s cubic-bezier(0.22,1,0.36,1),
        transform 0.5s cubic-bezier(0.22,1,0.36,1);
    }
    .job-item.is-visible {
      opacity: 1;
      transform: none;
    }

    /* ── CTA section shimmer ── */
    .cta-section {
      position: relative;
      overflow: hidden;
    }
    .cta-section::after {
      content: '';
      position: absolute;
      top: -60%;
      left: -80%;
      width: 60%;
      height: 220%;
      background: linear-gradient(
        105deg,
        transparent 40%,
        rgba(255,255,255,0.07) 50%,
        transparent 60%
      );
      transform: skewX(-15deg);
      animation: sv-shimmer 4s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes sv-shimmer {
      0%   { left: -80%; }
      100% { left: 120%; }
    }

    /* ── Moving bar pause on hover ── */
    .moving-bar:hover .moving-content { animation-play-state: paused; }

  `;
  document.head.appendChild(style);


  /* ── 2. Scroll progress bar ───────────────────────────── */
  const scrollBar = document.createElement('div');
  scrollBar.id = 'sv-scroll-bar';
  document.body.prepend(scrollBar);

  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollBar.style.width = (max > 0 ? (scrolled / max) * 100 : 0) + '%';
  }, { passive: true });


  /* ── 3. Back-to-top button ───────────────────────────── */
  const topBtn = document.createElement('button');
  topBtn.id = 'sv-top-btn';
  topBtn.title = 'Back to top';
  topBtn.innerHTML = '↑';
  topBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(topBtn);

  window.addEventListener('scroll', () => {
    topBtn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });


  /* ── 4. Side nav dots ─────────────────────────────────── */
  const sections = [
    { el: document.querySelector('.hero'),        label: 'Home'      },
    { el: document.querySelector('.how-section'), label: 'How It Works' },
    { el: document.querySelector('.features'),    label: 'Features'  },
    { el: document.querySelector('.template-section'), label: 'Templates' },
    { el: document.querySelector('.job-section'), label: 'Why Us'    },
    { el: document.querySelector('.cta-section'), label: 'Get Started' },
  ].filter(s => s.el);

  if (sections.length > 1) {
    const navDot = document.createElement('nav');
    navDot.className = 'sv-nav-dot';
    navDot.setAttribute('aria-label', 'Page sections');

    sections.forEach((s, i) => {
      const a = document.createElement('a');
      a.title = s.label;
      a.setAttribute('aria-label', s.label);
      a.onclick = (e) => {
        e.preventDefault();
        s.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      navDot.appendChild(a);
      s.dot = a;
    });

    document.body.appendChild(navDot);

    // Highlight active dot on scroll
    const updateDots = () => {
      const mid = window.scrollY + window.innerHeight * 0.45;
      sections.forEach(s => {
        const top = s.el.offsetTop;
        const bot = top + s.el.offsetHeight;
        s.dot.classList.toggle('active', mid >= top && mid < bot);
      });
    };
    window.addEventListener('scroll', updateDots, { passive: true });
    updateDots();
  }


  /* ── 5. Register elements for reveal ─────────────────── */
  function tag(el, direction, delay) {
    if (!el) return;
    el.classList.add('sv-reveal', direction || 'from-bottom');
    if (delay) el.classList.add('sv-delay-' + delay);
  }

  // Section titles
  document.querySelectorAll('.how-title, .feature-title, .job-section h2, .cta-content h2')
    .forEach(el => {
      el.classList.add('sv-title-wipe');
      tag(el, 'from-bottom');
    });

  // How cards — staggered
  document.querySelectorAll('.how-card').forEach((el, i) => {
    tag(el, 'from-bottom', i + 1);
  });

  // Feature cards — alternating directions
  document.querySelectorAll('.feature-card').forEach((el, i) => {
    const dir = i % 2 === 0 ? 'from-left' : 'from-right';
    tag(el, dir, Math.min(i + 1, 6));

    // Mouse-tracking glow
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width  * 100).toFixed(1);
      const y = ((e.clientY - r.top)  / r.height * 100).toFixed(1);
      el.style.setProperty('--mx', x + '%');
      el.style.setProperty('--my', y + '%');
    });
  });

  // Template section heading & cards
  const tmplSection = document.querySelector('.template-section');
  if (tmplSection) {
    const h2 = tmplSection.querySelector('h2');
    if (h2) { h2.classList.add('sv-title-wipe'); tag(h2, 'from-bottom'); }

    tmplSection.querySelectorAll('.tmpl-card-home, [class*="tpl-card"], [class*="tmpl-card"]')
      .forEach((el, i) => tag(el, 'zoom-fade', Math.min(i + 1, 6)));
  }

  // Job section — left image, right items
  tag(document.querySelector('.job-left'),  'from-left',  1);
  tag(document.querySelector('.job-right'), 'from-right', 2);

  // Job items individual stagger
  document.querySelectorAll('.job-item').forEach((el, i) => {
    el.classList.remove('sv-reveal'); // use own class
    setTimeout(() => {}, 0); // ensure class resets
    el.dataset.svDelay = (i * 0.12).toFixed(2);
  });

  // CTA section
  tag(document.querySelector('.cta-image'),   'from-left',  1);
  tag(document.querySelector('.cta-content'), 'from-right', 2);

  // Subtitles / paragraphs
  document.querySelectorAll('.how-subtitle, .feature-sub, .cta-content p')
    .forEach(el => tag(el, 'from-bottom', 2));

  // Buttons in sections
  document.querySelectorAll('.how-btn .btn, .cta-content .btn')
    .forEach((el, i) => tag(el, 'scale-up', 3));

  // Moving bar section — just fade in
  const movingBar = document.querySelector('.moving-bar');
  if (movingBar) tag(movingBar, 'from-bottom');


  /* ── 6. IntersectionObserver — fire animations ────────── */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('is-visible');
      io.unobserve(el);
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  // Observe all sv-reveal elements
  document.querySelectorAll('.sv-reveal').forEach(el => io.observe(el));

  // Observe sv-title-wipe elements separately
  document.querySelectorAll('.sv-title-wipe').forEach(el => io.observe(el));


  /* ── 7. Job items — staggered on section enter ────────── */
  const jobIo = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const items = entry.target.querySelectorAll('.job-item');
      items.forEach((item, i) => {
        setTimeout(() => item.classList.add('is-visible'), i * 130);
      });
      jobIo.unobserve(entry.target);
    });
  }, { threshold: 0.15 });

  const jobContainer = document.querySelector('.job-container');
  if (jobContainer) jobIo.observe(jobContainer);


  /* ── 8. How-section icon bounce trigger ──────────────── */
  // Icons animate once the card enters via the main observer.
  // The CSS animation is bound to .how-card.is-visible .icon-box
  // so no extra JS needed here.


  /* ── 9. Number counter animation ─────────────────────── */
  function animateCounter(el, target, duration) {
    const start = performance.now();
    const update = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 4);
      el.textContent = Math.round(ease * target).toLocaleString();
      if (t < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  const counterIo = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.svCount || el.textContent.replace(/\D/g, ''), 10);
      if (!isNaN(target)) animateCounter(el, target, 1600);
      counterIo.unobserve(el);
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-sv-count]').forEach(el => counterIo.observe(el));


  /* ── 10. Parallax — only on animated-bg, never the hero itself ── */
  const heroBg = document.querySelector('.hero .animated-bg');
  if (heroBg) {
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        // Move only the blurred background layer, not the hero container
        // parallax disabled — prevented hero from collapsing correctly
      }
    }, { passive: true });
  }


  /* ── 11. Feature card tilt on hover ──────────────────── */
  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const r  = card.getBoundingClientRect();
      const cx = r.left + r.width  / 2;
      const cy = r.top  + r.height / 2;
      const dx = (e.clientX - cx) / (r.width  / 2);
      const dy = (e.clientY - cy) / (r.height / 2);
      card.style.transform = `perspective(600px) rotateX(${-dy * 6}deg) rotateY(${dx * 6}deg) translateY(-6px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });


  /* ── 12. Smooth section entrance sound (visual pulse) ── */
  // Add a subtle flash ring when a section enters viewport
  const sectionIo = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const s = entry.target;
      s.classList.add('sv-section-entered');
      sectionIo.unobserve(s);
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('section').forEach(s => sectionIo.observe(s));


  /* ── 13. Highlight active nav link on scroll ─────────── */
  const navLinks = document.querySelectorAll('.nav-links a');
  const sectionMap = {
    '/':        document.querySelector('.hero'),
    '#how':     document.querySelector('.how-section'),
    '#features':document.querySelector('.features'),
    '#templates':document.querySelector('.template-section'),
  };

  if (navLinks.length) {
    const navIo = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(l => l.classList.remove('active'));
        const match = [...navLinks].find(l => {
          const href = l.getAttribute('href');
          return href && Object.values(sectionMap).includes(entry.target);
        });
        if (match) match.classList.add('active');
      });
    }, { threshold: 0.4 });

    Object.values(sectionMap).filter(Boolean).forEach(s => navIo.observe(s));
  }

  /* ── Done ────────────────────────────────────────────── */
  console.log('[VetriSmartCV] Scroll animations initialised ✓');

})();
