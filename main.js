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
      topics: [],
      social: [],
      cv: null
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
      if (typeof val !== 'string') return;

      const attr = el.getAttribute('data-i18n-attr');
      if (attr) {
        attr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((a) => el.setAttribute(a, val));
      } else {
        el.textContent = val;
      }
    });

    document.documentElement.lang = state.lang;
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

    const [profile, home, education, experience, publications, topics, talks, projects, social, cv] = await Promise.all([
      fetch(`${base}/profile.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/home.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/education.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/experience.${state.lang}.json`).then((r) => r.json()),

      // Research page content (language-dependent)
      fetch(`${base}/publications.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/topics.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/talks.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/projects.${state.lang}.json`).then((r) => r.json()),

      fetch(`${base}/social.json`).then((r) => r.json()),
      fetch(`${base}/cv.json`).then((r) => r.json())
    ]);

    state.data = { profile, home, education, experience, publications, topics, talks, projects, social, cv };

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
  function socialIcon(item) {
    return `
      <a class="icon-btn icon-btn--circle"
        href="${item.href}"
        ${item.newTab ? 'target="_blank" rel="noopener"' : ''}
        aria-label="${item.label}">
        <img src="assets/${item.icon}" alt="${item.label}">
      </a>
    `;
  }

  function pageHeaderHTML(title, intro) {
    return `
      <section class="section section-head">
        <h1>${title}</h1>
        ${intro ? `<p class="page-intro">${intro}</p>` : ``}
      </section>
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
            ${(state.data.social || []).map(socialIcon).join('')}
          </div>

        </div>

        <div class="hero-center">
          <div class="about-card">
            <h2 class="about-title">${state.i18n?.home?.aboutTitle || ''}</h2>
            <div class="about-body" id="aboutBody">
              ${fullHtml}
            </div>
          </div>
        </div>

        <aside class="hero-side" aria-label="${state.i18n?.home?.quickInfoLabel || 'Quick info'}">
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
    const app = $('#app');

    const pubs = (state.data.publications || []).slice().sort((a, b) => (b.year || 0) - (a.year || 0));
    const topics = state.data.topics || [];
    const talks = state.data.talks || [];
    const projects = state.data.projects || [];

    const pageTitle = state.i18n?.research?.title || 'Research';
    const intro = state.i18n?.research?.intro || '';

    const sec = state.i18n?.research?.sections || {};
    const pubsTitle = sec.publications || 'Publications';
    const talksTitle = sec.talks || 'Talks';
    const projectsTitle = sec.projects || 'Projects';
    const topicsTitle = sec.topics || 'Research topics';

    const searchPH = state.i18n?.publications?.searchPlaceholder || '';
    const allYears = state.i18n?.publications?.allYears || '';

    const talksEmpty = state.i18n?.talks?.noItems || '';
    const projEmpty = state.i18n?.projects?.noItems || '';
    const viewOnGitHub = state.i18n?.projects?.viewOnGitHub || 'View';

    const years = Array.from(new Set(pubs.map((p) => p.year).filter(Boolean)))
      .sort((a, b) => b - a);

    app.innerHTML = `
      ${pageHeaderHTML(pageTitle, intro)}

      <section class="section research-grid">
        <!-- Publications (full width on desktop) -->
        <article class="card research-panel research-panel--pubs">
          <h2>${pubsTitle}</h2>

          <div id="pubList" class="list"></div>
        </article>

        <!-- Talks -->
        <article class="card research-panel research-panel--talks">
          <h2>${talksTitle}</h2>

          <div id="talkList">
            ${
              talks.length
                ? `<ul class="research-list">
                  ${talks.map((t) => {
                    const labels = state.lang === 'it'
                      ? { event: 'Evento', poster: 'Locandina', talk: 'Talk', subtitle: 'Subtitle', roleTypeSep: ' • ' }
                      : { event: 'Event',  poster: 'Poster',    talk: 'Talk', subtitle: 'Subtitle', roleTypeSep: ' • ' };

                    const locationLine = [t.city, t.country].filter(Boolean).join(', ');
                    const roleTypeLine = [t.role, t.type].filter(Boolean).join(labels.roleTypeSep);

                    return `
                      <li>
                        <!-- 1) Workshop name -->
                        <div><strong>${t.event || ''}</strong></div>

                        <!-- 2) Institution / venue -->
                        ${t.institution ? `<div class="pub-meta">${t.institution}${t.venue ? ` — ${t.venue}` : ''}</div>` : ''}

                        <!-- 3) City, Country (separato) -->
                        ${locationLine ? `<div class="pub-meta">${locationLine}</div>` : ''}

                        <!-- 4) Date (subito sotto, riga dedicata) -->
                        ${t.date ? `<div class="pub-meta">${t.date}</div>` : ''}

                        <!-- 5) Role + Type (non più insieme alla data) -->
                        ${roleTypeLine ? `<div class="pub-meta" style="margin-top:.2rem;">${roleTypeLine}</div>` : ''}

                        <!-- 6) Talk title -->
                        ${t.talkTitle ? `<div style="margin-top:.45rem;"><strong>${labels.talk}:</strong> ${t.talkTitle}</div>` : ''}

                        <!-- 7) Subtitle con label -->
                        ${t.subtitle ? `<div class="pub-meta"><strong>${labels.subtitle}:</strong> ${t.subtitle}</div>` : ''}

                        <!-- Links -->
                        ${(t.link || t.poster) ? `
                          <div class="row" style="margin-top:.45rem;">
                            ${t.link ? `<a class="btn btn-outline" href="${t.link}" target="_blank" rel="noopener">${labels.event}</a>` : ''}
                            ${t.poster ? `<a class="btn btn-outline" href="${t.poster}" target="_blank" rel="noopener">${labels.poster}</a>` : ''}
                          </div>
                        ` : ''}
                      </li>
                    `;
                  }).join('')}
                  </ul>`
                : `<p class="pub-meta">${talksEmpty}</p>`
            }
          </div>
        </article>

        <!-- Projects -->
        <article class="card research-panel research-panel--projects">
          <h2>${projectsTitle}</h2>
          <div id="projectList">
            ${
              projects.length
                ? `<ul class="research-list">
                    ${projects.map((p) => {
                      const labels = state.lang === 'it'
                        ? { desc: 'Description', repo: 'Code Repository', topics: 'Topics', langs: 'Languages' }
                        : { desc: 'Description', repo: 'Code Repository', topics: 'Topics', langs: 'Languages' };

                      const topics = Array.isArray(p.topics) ? p.topics : [];
                      const langs  = Array.isArray(p.languages) ? p.languages : [];

                      return `
                        <li>
                          <div><strong>${p.title || ''}</strong></div>

                          ${p.description ? `
                            <div class="pub-meta" style="margin-top:.25rem;">
                              <strong>${labels.desc}:</strong> ${p.description}
                            </div>
                          ` : ''}

                          ${p.repo ? `
                            <div class="pub-meta" style="margin-top:.25rem;">
                              <strong>${labels.repo}:</strong>
                              <a href="${p.repo}" target="_blank" rel="noopener">GitHub link</a>
                            </div>
                          ` : ''}
                          ${topics.length ? `
                            <div class="pub-meta" style="margin-top:.35rem;">
                              <strong>${labels.topics}:</strong>
                            </div>
                            <div class="tags" style="margin-top:.25rem;">
                              ${topics.map((t) => `<span class="tag">${t}</span>`).join('')}
                            </div>
                          ` : ''}

                          ${langs.length ? `
                            <div class="pub-meta" style="margin-top:.45rem;">
                              <strong>${labels.langs}:</strong>
                            </div>
                            <div class="tags" style="margin-top:.25rem;">
                              ${langs.map((t) => `<span class="tag">${t}</span>`).join('')}
                            </div>
                          ` : ''}
                        </li>
                      `;
                    }).join('')}
                  </ul>`
                : `<p class="pub-meta">${projEmpty}</p>`
            }
          </div>
        </article>

        <!-- Topics -->
        <article class="card research-panel research-panel--topics">
          <h2>${topicsTitle}</h2>
          <div class="tags">
            ${topics.map((t) => `<span class="tag">${t}</span>`).join('')}
          </div>
        </article>

      </section>
    `;

    // --- Publications render + filter (same logic as your publications page) ---
    const renderPubs = (items) => {
      const labels = state.lang === 'it'
        ? {
            conference: 'Conferenza',
            arxiv: 'arXiv',
            code: 'Code',
            short: 'Short paper (PDF)',
            poster: 'Poster (PDF)'
          }
        : {
            conference: 'Conference',
            arxiv: 'arXiv',
            code: 'Code',
            short: 'Short paper (PDF)',
            poster: 'Poster (PDF)'
          };

      $('#pubList').innerHTML = items.length
        ? `<ul class="research-list">
            ${items.map((p) => {
              const locationLine = [p.city, p.country].filter(Boolean).join(', ');
              const dateLine = p.date || '';
              const typeLine = [p.type, p.eventLink ? (state.lang === 'it' ? 'Conferenza' : 'Conference') : null]
                .filter(Boolean)
                .join(' • ');

              return `
                <li>
                  <!-- 1) Event -->
                  ${p.event ? `<div><strong>${p.event}</strong></div>` : ''}

                  <!-- 2) Location -->
                  ${locationLine ? `<div class="pub-meta">${locationLine}</div>` : ''}

                  <!-- 3) Date (riga dedicata, sotto il luogo) -->
                  ${dateLine ? `<div class="pub-meta">${dateLine}</div>` : ''}

                  <!-- 4) Type • Conference (riga dedicata sotto la data) -->
                  ${typeLine ? `<div class="pub-meta">${typeLine}</div>` : ''}

                  <!-- 5) Work title -->
                  ${p.title ? `<div style="margin-top:.45rem;"><strong>Title:</strong> ${p.title}</div>` : ''}

                  <!-- 6) Authors (subito sotto il titolo) -->
                  ${p.authors ? `<div class="pub-meta">${p.authors}</div>` : ''}

                  <!-- 7) Description -->
                  ${p.desc ? `
                    <div class="pub-meta" style="margin-top:.25rem;">
                      <strong>Description:</strong> ${p.desc}
                    </div>
                  ` : ''}

                  <!-- 8) Keywords -->
                  ${Array.isArray(p.keywords) && p.keywords.length ? `
                    <div class="pub-meta" style="margin-top:.2rem;">
                      <strong>Keywords:</strong> ${p.keywords.join(', ')}
                    </div>
                  ` : ''}

                  <!-- 9) Links -->
                  ${(p.eventLink || p.arxiv || p.code || p.shortPdf || p.posterPdf) ? `
                    <div class="row" style="margin-top:.45rem;">
                      ${p.eventLink ? `<a class="btn btn-outline" href="${p.eventLink}" target="_blank" rel="noopener">${labels.conference}</a>` : ''}
                      ${p.arxiv ? `<a class="btn btn-outline" href="${p.arxiv}" target="_blank" rel="noopener">${labels.arxiv}</a>` : ''}
                      ${p.code ? `<a class="btn btn-outline" href="${p.code}" target="_blank" rel="noopener">${labels.code}</a>` : ''}
                      ${p.shortPdf ? `<a class="btn btn-outline" href="${p.shortPdf}" target="_blank" rel="noopener">${labels.short}</a>` : ''}
                      ${p.posterPdf ? `<a class="btn btn-outline" href="${p.posterPdf}" target="_blank" rel="noopener">${labels.poster}</a>` : ''}
                    </div>
                  ` : ''}
                </li>
              `;
            }).join('')}
          </ul>`
        : `<p class="pub-meta"></p>`;
    };

    const filterPubs = () => {
      const q = ($('#pubQ').value || '').toLowerCase();
      const y = $('#pubYear').value;

      const res = pubs.filter((p) =>
        (!y || String(p.year) === String(y)) &&
        (
          (p.title || '').toLowerCase().includes(q) ||
          (p.authors || '').toLowerCase().includes(q) ||
          (p.venue || '').toLowerCase().includes(q)
        )
      );

      renderPubs(res);
    };

    renderPubs(pubs);
  }

  function renderCV() {
    const app = $('#app');
    const lang = state.lang;

    const title = 'Curriculum Vitae';
    const intro = state.i18n?.cv?.intro || '';
    const itLabel = state.i18n?.cv?.itLabel || 'Italian CV';
    const enLabel = state.i18n?.cv?.enLabel || 'English CV';

    const openText = state.i18n?.actions?.openNewTab || 'Open in a new tab';
    const downloadText = state.i18n?.actions?.downloadPdf || 'Download PDF';

    const cvIt = state.data.cv?.it || 'assets/cv-it.pdf';
    const cvEn = state.data.cv?.en || 'assets/cv-en.pdf';

    app.innerHTML = `
      ${pageHeaderHTML(title, intro)}

      <section class="section">
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
          <input id="q" class="input" placeholder="${state.i18n?.publications?.searchPlaceholder || ''}" />
          <select id="yearSel" class="input">
            <option value="">${state.i18n?.publications?.allYears || ''}</option>
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

    // Titles from i18n (with sensible defaults)
    const pageTitle =
      state.i18n?.experiencePage?.title ||
      state.i18n?.section?.education ||
      'Education & Experience';

    const expTitle = state.i18n?.experiencePage?.experienceTitle || 'Experience';
    const eduTitle = state.i18n?.experiencePage?.educationTitle || 'Education';

    const ongoingLabel =
      state.lang === 'it'
        ? (state.i18n?.labels?.ongoing || 'in corso')
        : (state.i18n?.labels?.ongoing || 'ongoing');

    // Sort: most recent first (uses `to`, fallback "9999" for ongoing)
    const sortByToDesc = (a, b) => (b.to || '9999').localeCompare(a.to || '9999');

    const expItems = (state.data.experience || []).slice().sort(sortByToDesc);
    const eduItems = (state.data.education || []).slice().sort(sortByToDesc);
    const specLabel = state.lang === 'it' ? 'Specializzazione:' : 'Specialization:';
    const thesisLabel = state.lang === 'it' ? 'Titolo tesi:' : 'Thesis:';
    const supervisorLabel = state.lang === 'it' ? 'Supervisore:' : 'Supervisor:';
    const opponentLabel = state.lang === 'it' ? 'Controrelatore:' : 'Opponent:';

    const itemRow = (x) => `
      <li class="tl-item">
        <span class="tl-dot" aria-hidden="true"></span>

        <h3>${x.title}</h3>

        <!-- Institution / Company -->
        ${(x.company || x.institution)
          ? `<div class="pub-meta">${x.company || x.institution}</div>`
          : ''}

        <!-- City (riga separata) -->
        ${x.city
          ? `<div class="pub-meta">${x.city}</div>`
          : ''}

        <div class="pub-meta">
          ${x.from} — ${x.to || ongoingLabel}
          ${x.finalGrade ? ` • <strong>${x.finalGrade}</strong>` : ''}
        </div>

        ${x.topic ? `
        <div class="edu-line">
          <span class="edu-label">${state.lang === 'it' ? 'Tema:' : 'Topic:'}</span>
          <span class="edu-value"><em>${x.topic}</em></span>
        </div>
      ` : ""}


        ${x.thesis ? `
          <div class="edu-line">
            <span class="edu-label">${thesisLabel}</span>
            <span class="edu-value"><em>${x.thesis}</em></span>
          </div>
        ` : ""}

        ${x.supervisor ? `
          <div class="edu-line">
            <span class="edu-label">${supervisorLabel}</span>
            <span class="edu-value">${x.supervisor}</span>
          </div>
        ` : ""}

        ${x.opponent ? `
          <div class="edu-line">
            <span class="edu-label">${opponentLabel}</span>
            <span class="edu-value">${x.opponent}</span>
          </div>
          ` : ""}
      
          ${x.specialization?.length ? `
            <div class="edu-spec">
              <span class="edu-label">${specLabel}</span>
              <span class="edu-spec-text"><em>${x.specialization.join(" · ")}</em></span>
            </div>
          ` : ""}
      </li>
    `;
    
    const intro = state.i18n?.experiencePage?.intro || '';

    app.innerHTML = `
      ${pageHeaderHTML(pageTitle, intro)}

      <section class="section">
        <div class="expedu-split">
          <article class="expedu-panel">
            <div class="expedu-panel-head">
              <h2>${eduTitle}</h2>
            </div>
            <ol class="timeline expedu-timeline">
              ${eduItems.map(itemRow).join('')}
            </ol>
          </article>

          <article class="expedu-panel">
            <div class="expedu-panel-head">
              <h2>${expTitle}</h2>
            </div>
            <ol class="timeline expedu-timeline">
              ${expItems.map(itemRow).join('')}
            </ol>
          </article>
        </div>
      </section>
    `;
  }

  const renderEducation = renderExperience;

  function renderPrivacy() {
    const app = $('#app');

    const title = state.i18n?.privacy?.title || 'Privacy';
    const intro = state.i18n?.privacy?.intro || '';

    const dataTitle = state.i18n?.privacy?.dataTitle || '';
    const dataText  = state.i18n?.privacy?.dataText  || '';

    const linksTitle = state.i18n?.privacy?.linksTitle || '';
    const linksText  = state.i18n?.privacy?.linksText  || '';

    const contactTitle = state.i18n?.privacy?.contactTitle || '';
    const contactText  = state.i18n?.privacy?.contactText  || '';

    // keep as a constant (or move to data/config if you want)
    const emailLabel = 'angelo.nardone17@gmail.com';

    app.innerHTML = `
      <section class="section">
        <div class="card">
          <h1>${title}</h1>
          <p>${intro}</p>

          <h2 style="margin-top:1.2rem;">${dataTitle}</h2>
          <p>${dataText}</p>

          <h2 style="margin-top:1.2rem;">${linksTitle}</h2>
          <p>${linksText}</p>

          <h2 style="margin-top:1.2rem;">${contactTitle}</h2>
          <p>${contactText}</p>

          <p>
            <a href="mailto:${emailLabel}" class="btn btn-outline">${emailLabel}</a>
          </p>
        </div>
      </section>
    `;
  }


  function renderNotFound() {
    const t = state.i18n?.errors?.notFoundTitle || '404';
    const p = state.i18n?.errors?.notFoundText || 'Page not found.';
    $('#app').innerHTML = `<section class="section"><h1>${t}</h1><p>${p}</p></section>`;
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
