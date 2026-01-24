(() => {
  /* =========================================================
     State & DOM helpers
  ========================================================== */
  const state = {
    lang: localStorage.getItem('lang') || 'en',
    theme: localStorage.getItem('theme') || 'light',
    i18n: {},
    data: {
      profile: null,
      home: null,
      education: [],
      experience: [],
      publications: [],
      topics: []
    }
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* =========================================================
     Small UI utilities
  ========================================================== */
  function setYear() {
    const el = $('#year');
    if (el) el.textContent = new Date().getFullYear();
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  /* =========================================================
     Theme (data-theme on <html>)
  ========================================================== */
  function setTheme(mode) {
    state.theme = mode;
    localStorage.setItem('theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }

  /* =========================================================
     I18N
     - ui.<lang>.json controls labels inside index.html + route views
  ========================================================== */
  async function loadI18n() {
    const res = await fetch(`i18n/ui.${state.lang}.json`);
    state.i18n = await res.json();
    applyI18n();
  }

  function applyI18n() {
    $$('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = key.split('.').reduce((o, k) => o?.[k], state.i18n);
      if (typeof val === 'string') el.textContent = val;
    });

    // Keep <html lang=".."> in sync
    document.documentElement.lang = state.lang;

    // Update the browser tab title if provided by i18n
    document.title = state.i18n?.site?.title || document.title;
  }

  function syncLangUI() {
    const langBtn = $('#langBtn');
    if (langBtn) {
      const flagSpan = langBtn.querySelector('.flag');
      const codeSpan = langBtn.querySelector('.lang-code');

      if (state.lang === 'it') {
        flagSpan.textContent = '🇮🇹';
        codeSpan.textContent = 'IT';
      } else {
        flagSpan.textContent = '🇬🇧';
        codeSpan.textContent = 'EN';
      }
    }

    // Highlight selected language inside dropdown
    $$('#langMenu .lang-item').forEach((item) => {
      const isActive = item.dataset.lang === state.lang;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  /* =========================================================
     Data loading
     - profile/home are language-dependent
     - others are shared
  ========================================================== */
  async function loadData() {
    const base = 'data';

    const [profile, home, education, experience, publications, topics] = await Promise.all([
      fetch(`${base}/profile.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/home.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/education.json`).then((r) => r.json()),
      fetch(`${base}/experience.json`).then((r) => r.json()),
      fetch(`${base}/publications.json`).then((r) => r.json()),
      fetch(`${base}/topics.json`).then((r) => r.json())
    ]);

    state.data = { profile, home, education, experience, publications, topics };
  }

  /* =========================================================
     Router (hash-based)
  ========================================================== */
  const routes = {
    '/accademico': renderAcademicHome,
    '/research': renderResearch,
    '/experience': renderExperience,
    '/cv': renderCV,
    '/research/publications': renderPublications,
    '/privacy': renderPrivacy
  };

  function parseHash() {
    const h = location.hash.replace(/^#/, '');
    return h || '/accademico';
  }

  function updateActiveNavLinks() {
    const path = parseHash();
    $$('.nav-item[data-route]').forEach((link) => {
      link.classList.toggle('active', path === link.dataset.route);
    });
  }

  function onRouteChange() {
    const path = parseHash();
    const view = routes[path] || renderNotFound;

    view();
    updateActiveNavLinks();

    // Keep the UX consistent: scroll to top on navigation
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* =========================================================
     About text helpers
     - Support blank-line paragraphs + **bold** syntax
  ========================================================== */
  function splitParagraphs(text) {
    return text.trim().split(/\n\s*\n/);
  }

  function renderParagraphHTML(p) {
    // Convert **text** -> <strong>text</strong>
    return p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  /* =========================================================
     UI components
  ========================================================== */
  function eduCard(x) {
    return `
      <article class="card">
        <div class="badge">${x.type || 'Item'}</div>
        <h3>${x.title}</h3>
        <p class="pub-meta">${x.institution || x.company} • ${x.city || ''}</p>
        <p class="pub-meta">${x.from} — ${x.to || 'in corso'}</p>
        <p>${x.details || ''}</p>
      </article>
    `;
  }

  function socialIcon(type) {
    let href = '#';
    let label = '';
    let iconFile = '';
    let newTab = true;

    if (type === 'linkedin') {
      href = 'https://www.linkedin.com/in/nardone-angelo';
      label = 'LinkedIn';
      iconFile = 'linkedin.svg';
    } else if (type === 'github') {
      href = 'https://github.com/Angelido';
      label = 'GitHub';
      iconFile = 'github-mark.svg';
    } else if (type === 'email') {
      href = 'mailto:angelo.nardone17@gmail.com';
      label = 'Email';
      iconFile = 'gmail.svg';
      newTab = false;
    } else if (type === 'orcid') {
      href = 'https://orcid.org/0009-0006-2068-5934';
      label = 'ORCID';
      iconFile = 'orcid.svg';
    } else if (type === 'scholar') {
      href = 'https://scholar.google.com/citations?user=C2QAXR4AAAAJ';
      label = 'Scholar';
      iconFile = 'scholar.svg';
    }

    return `
      <a class="icon-btn icon-btn--circle"
         href="${href}"
         ${newTab ? 'target="_blank" rel="noopener"' : ''}
         aria-label="${label}">
        <img src="assets/${iconFile}" alt="${label}">
      </a>
    `;
  }

  /* =========================================================
     Views
  ========================================================== */
  function renderAcademicHome() {
    const { profile } = state.data;
    const app = $('#app');

    const aboutText = profile.about.long || '';
    const paragraphs = splitParagraphs(aboutText);
    const fullHtml = paragraphs.map((p) => `<p>${renderParagraphHTML(p)}</p>`).join('');

    app.innerHTML = `
      <section class="hero hero-home">
        <div class="hero-left">
          <div class="hero-avatar">
            <img src="assets/personal.jpg" alt="Foto profilo di ${profile.name}" />
          </div>

          <h1 class="hero-name">${profile.name}</h1>
          <p class="hero-role">${profile.role}</p>

          <div class="hero-affil">
            <p class="hero-affil-line">${profile.department}</p>
            <p class="hero-affil-line">${profile.university}</p>
          </div>

          <div class="social-row">
            ${socialIcon('linkedin')}
            ${socialIcon('github')}
            ${socialIcon('email')}
            ${socialIcon('orcid')}
            ${socialIcon('scholar')}
          </div>
        </div>

        <div class="hero-center">
          <div class="about-card">
            <h2 class="about-title">${state.lang === 'it' ? 'Chi sono' : 'About me'}</h2>
            <div class="about-body" id="aboutBody">
              ${fullHtml}
            </div>
          </div>
        </div>

        <aside class="hero-side" aria-label="Quick info">
          <div class="side-panel">
            ${(state.data.home?.cards || [])
              .map(
                (c) => `
                <div class="side-card">
                  <div class="side-kicker">${c.kicker}</div>
                  <div class="side-title">${c.title}</div>
                  <div class="side-text">${c.text}</div>
                </div>
              `
              )
              .join('')}
          </div>
        </aside>
      </section>
    `;
  }

  function renderResearch() {
    const { topics } = state.data;
    const app = $('#app');

    const title = state.lang === 'it' ? 'Projects & Publications' : 'Projects & Publications';
    const intro =
      state.lang === 'it'
        ? 'Qui trovi una panoramica dei progetti e delle pubblicazioni, insieme a un estratto del mio percorso accademico.'
        : 'Here you can find an overview of my projects and publications, together with a snapshot of my academic path.';

    const list = state.data.education
      .concat(state.data.experience)
      .sort((a, b) => (b.to || '9999').localeCompare(a.to || '9999'))
      .slice(0, 3);

    app.innerHTML = `
      <section class="section">
        <div class="card" id="aboutCard">
          <h1>${title}</h1>
          <p>${intro}</p>
        </div>
      </section>

      <section class="section">
        <h2 data-i18n="section.research">Research topics</h2>
        <div class="tags">
          ${topics.map((t) => `<span class="tag">${t}</span>`).join('')}
        </div>
      </section>

      <section class="section">
        <div class="row space-between">
          <h2 data-i18n="section.education">Formazione ed esperienze</h2>
          <a class="btn btn-outline" href="#/experience" data-i18n="action.viewall">Vedi tutto</a>
        </div>
        <div class="grid grid-3" id="eduPreview"></div>
      </section>

      <section class="section">
        <div class="row space-between">
          <h2 data-i18n="section.publications">Pubblicazioni</h2>
          <a class="btn" href="#/research/publications">Vai a tutte le pubblicazioni</a>
        </div>
      </section>
    `;

    const wrap = $('#eduPreview');
    if (wrap) wrap.innerHTML = list.map((item) => eduCard(item)).join('');
  }

  function renderCV() {
    const app = $('#app');
    const lang = state.lang;

    const title = 'Curriculum Vitae';
    const intro =
      lang === 'it'
        ? 'Qui puoi consultare e scaricare il mio CV in italiano e in inglese.'
        : 'Here you can view and download my CV in both Italian and English.';

    const itLabel = lang === 'it' ? 'CV in italiano' : 'Italian CV';
    const enLabel = lang === 'it' ? 'CV in inglese' : 'English CV';

    const openText = lang === 'it' ? 'Apri in una nuova scheda' : 'Open in a new tab';
    const downloadText = lang === 'it' ? 'Scarica PDF' : 'Download PDF';

    // PDF paths (edit here if names differ)
    const cvIt = 'assets/cv-it.pdf';
    const cvEn = 'assets/cv-en.pdf';

    app.innerHTML = `
      <section class="section">
        <h1>${title}</h1>
        <p>${intro}</p>

        <div class="cv-grid">
          <article class="card cv-card">
            <h2>${itLabel}</h2>
            <div class="cv-buttons">
              <a class="btn" href="${cvIt}" target="_blank" rel="noopener">${openText}</a>
              <a class="btn btn-outline" href="${cvIt}" download>${downloadText}</a>
            </div>
            <div class="cv-preview">
              <iframe src="${cvIt}#view=FitH" class="cv-iframe" title="${itLabel}"></iframe>
            </div>
          </article>

          <article class="card cv-card">
            <h2>${enLabel}</h2>
            <div class="cv-buttons">
              <a class="btn" href="${cvEn}" target="_blank" rel="noopener">${openText}</a>
              <a class="btn btn-outline" href="${cvEn}" download>${downloadText}</a>
            </div>
            <div class="cv-preview">
              <iframe src="${cvEn}#view=FitH" class="cv-iframe" title="${enLabel}"></iframe>
            </div>
          </article>
        </div>
      </section>
    `;
  }

  function renderPublications() {
    const app = $('#app');
    const pubs = state.data.publications.slice().sort((a, b) => (b.year || 0) - (a.year || 0));

    app.innerHTML = `
      <section class="section">
        <div class="row space-between">
          <h1 data-i18n="section.publications">Pubblicazioni</h1>
          <a class="btn btn-outline" href="#/research">← <span data-i18n="action.back">Indietro</span></a>
        </div>

        <div class="toolbar">
          <input id="q" class="input" placeholder="Cerca titolo/autori/venue" />
          <select id="yearSel" class="input">
            <option value="">Tutti gli anni</option>
            ${Array.from(new Set(pubs.map((p) => p.year)))
              .sort((a, b) => b - a)
              .map((y) => `<option>${y}</option>`)
              .join('')}
          </select>
        </div>

        <div id="pubList" class="list"></div>
      </section>
    `;

    const render = (items) => {
      $('#pubList').innerHTML = items
        .map(
          (p) => `
          <article class="pub-card">
            <h3>${p.title}</h3>
            <div class="pub-meta">${p.authors} — ${p.venue || ''} (${p.year || ''})</div>
            <div class="row">
              ${p.pdf ? `<a class="btn" href="${p.pdf}" target="_blank">PDF</a>` : ''}
              ${p.doi ? `<a class="btn btn-outline" href="${p.doi}" target="_blank">DOI</a>` : ''}
              ${p.code ? `<a class="btn btn-outline" href="${p.code}" target="_blank">Code</a>` : ''}
            </div>
          </article>
        `
        )
        .join('');
    };

    render(pubs);

    $('#q').addEventListener(
      'input',
      debounce(() => {
        filter();
      }, 180)
    );
    $('#yearSel').addEventListener('change', filter);

    function filter() {
      const q = $('#q').value.toLowerCase();
      const y = $('#yearSel').value;

      const res = pubs.filter(
        (p) =>
          (!y || String(p.year) === String(y)) &&
          (p.title?.toLowerCase().includes(q) ||
            p.authors?.toLowerCase().includes(q) ||
            p.venue?.toLowerCase().includes(q))
      );

      render(res);
    }
  }

  function renderExperience() {
    const app = $('#app');
    const items = state.data.education
      .concat(state.data.experience)
      .sort((a, b) => (b.to || '9999').localeCompare(a.to || '9999'));

    app.innerHTML = `
      <section class="section">
        <div class="row space-between">
          <h1 data-i18n="section.education">Formazione ed esperienze</h1>
          <a class="btn btn-outline" href="#/accademico">← <span data-i18n="action.back">Indietro</span></a>
        </div>
        <ol class="timeline list" id="tl"></ol>
      </section>
    `;

    const tl = $('#tl');
    tl.innerHTML = items
      .map(
        (x) => `
        <li class="tl-item">
          <span class="tl-dot" aria-hidden="true"></span>
          <h3>${x.title}</h3>
          <div class="pub-meta">${x.institution || x.company} • ${x.city || ''}</div>
          <div class="pub-meta">${x.from} — ${x.to || 'in corso'}</div>
          ${x.details ? `<p>${x.details}</p>` : ''}
        </li>
      `
      )
      .join('');
  }

  const renderEducation = renderExperience;

  function renderPrivacy() {
    const app = $('#app');
    const isIt = state.lang === 'it';

    const title = 'Privacy';
    const intro = isIt
      ? 'Questo sito personale non utilizza cookie di profilazione e non raccoglie dati personali oltre a quelli strettamente necessari al funzionamento tecnico.'
      : 'This personal website does not use profiling cookies and does not collect personal data beyond what is strictly necessary for its technical operation.';

    const contact = isIt
      ? 'Per qualsiasi domanda relativa alla privacy puoi contattarmi via email.'
      : 'For any questions about privacy, you can contact me via email.';

    const emailLabel = 'angelo.nardone17@gmail.com';

    const dataSectionTitle = isIt ? 'Dati raccolti' : 'Data collected';
    const dataSectionText = isIt
      ? 'Il sito può registrare informazioni tecniche standard (come indirizzi IP anonimizzati, log del server o statistiche aggregate di traffico) esclusivamente per finalità di sicurezza e manutenzione.'
      : 'The site may log standard technical information (such as anonymized IP addresses, server logs or aggregated traffic statistics) solely for security and maintenance purposes.';

    const linksTitle = isIt ? 'Link esterni' : 'External links';
    const linksText = isIt
      ? 'I link a GitHub e LinkedIn rimandano a servizi esterni che adottano le proprie politiche di trattamento dati. Ti invito a consultare le loro privacy policy.'
      : 'Links to GitHub and LinkedIn point to external services which apply their own data protection policies. Please refer to their respective privacy policies.';

    app.innerHTML = `
      <section class="section">
        <div class="card">
          <h1>${title}</h1>
          <p>${intro}</p>

          <h2 style="margin-top:1.2rem;">${dataSectionTitle}</h2>
          <p>${dataSectionText}</p>

          <h2 style="margin-top:1.2rem;">${linksTitle}</h2>
          <p>${linksText}</p>

          <h2 style="margin-top:1.2rem;">${isIt ? 'Contatti' : 'Contact'}</h2>
          <p>${contact}</p>

          <p>
            <a href="mailto:${emailLabel}" class="btn btn-outline">${emailLabel}</a>
          </p>
        </div>
      </section>
    `;
  }

  function renderNotFound() {
    $('#app').innerHTML = `<section class="section"><h1>404</h1><p>Pagina non trovata.</p></section>`;
  }

  /* =========================================================
     Boot: wire up topbar + router + initial theme/lang
  ========================================================== */
  async function boot() {
    setYear();

    // Theme: use saved theme if present, otherwise follow system preference
    const storedTheme = localStorage.getItem('theme');
    if (!storedTheme) {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    } else {
      setTheme(storedTheme);
    }

    // Theme toggle button
    $('#themeToggle')?.addEventListener('click', () => {
      setTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    // Load translations + data
    await loadI18n();
    await loadData();

    // Language dropdown
    const langBtn = $('#langBtn');
    const langMenu = $('#langMenu');

    syncLangUI();
    updateActiveNavLinks();

    langBtn?.addEventListener('click', () => {
      const open = langMenu.getAttribute('aria-hidden') === 'false';
      langMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
      langBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });

    $$('#langMenu .lang-item').forEach((item) => {
      item.addEventListener('click', async (e) => {
        const newLang = e.currentTarget.dataset.lang;

        if (newLang && newLang !== state.lang) {
          state.lang = newLang;
          localStorage.setItem('lang', newLang);

          await loadI18n();
          await loadData();

          onRouteChange();
          syncLangUI();
        }

        // Close dropdown
        langMenu.setAttribute('aria-hidden', 'true');
        langBtn.setAttribute('aria-expanded', 'false');
      });
    });

    // Mobile nav (hamburger)
    const navToggle = $('#navToggle');
    const mobileNav = $('#mobileNav');

    navToggle?.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      mobileNav.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    });

    // Close mobile menu when a link is clicked
    $$('#mobileNav .nav-item').forEach((link) => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        mobileNav.setAttribute('aria-hidden', 'true');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Route changes: render view + close mobile menu defensively
    window.addEventListener('hashchange', () => {
      onRouteChange();

      mobileNav?.classList.remove('open');
      mobileNav?.setAttribute('aria-hidden', 'true');
      navToggle?.setAttribute('aria-expanded', 'false');
    });

    // If resized to desktop, ensure the mobile menu is closed
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768 && mobileNav && navToggle) {
        mobileNav.classList.remove('open');
        mobileNav.setAttribute('aria-hidden', 'true');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Initial render
    onRouteChange();
  }

  boot();
})();
