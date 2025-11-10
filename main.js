(() => {
  // --------------------------
  // Config di base
  // --------------------------
  const state = {
    lang: localStorage.getItem('lang') || 'it',
    theme: localStorage.getItem('theme') || 'light',
    i18n: {},
    data: { profile:null, education:[], experience:[], publications:[], topics:[] }
  };

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // --------------------------
  // UI helpers
  // --------------------------
  function setYear(){ $('#year').textContent = new Date().getFullYear(); }
  // function toggleMobileMenu(){
  //   const menuBtn = $('#menuBtn');
  //   const mobile = $('#mobileMenu');
  //   menuBtn?.addEventListener('click', () => {
  //     const open = mobile.style.display === 'block';
  //     mobile.style.display = open ? 'none' : 'block';
  //     menuBtn.setAttribute('aria-expanded', String(!open));
  //   });
  // }

  // --------------------------
  // I18N
  // --------------------------
  async function loadI18n(){
    const res = await fetch(`i18n/ui.${state.lang}.json`);
    state.i18n = await res.json();
    applyI18n();
  }
  function applyI18n(){
    $$('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = key.split('.').reduce((o,k)=>o?.[k], state.i18n);
      if (typeof val === 'string') el.textContent = val;
    });
    document.documentElement.lang = state.lang;
    document.title = state.i18n?.site?.title || document.title;
  }

  // --------------------------
  // Data loading
  // --------------------------
  async function loadData(){
    const base = 'data';
    const [profile, education, experience, publications, topics] = await Promise.all([
      fetch(`${base}/profile.${state.lang}.json`).then(r=>r.json()),
      fetch(`${base}/education.json`).then(r=>r.json()),
      fetch(`${base}/experience.json`).then(r=>r.json()),
      fetch(`${base}/publications.json`).then(r=>r.json()),
      fetch(`${base}/topics.json`).then(r=>r.json()),
    ]);
    state.data = { profile, education, experience, publications, topics };
  }

  // --------------------------
  // Router
  // --------------------------
  const routes = {
    // Home (default)
    '/accademico': renderAcademicHome,

    // Nuova pagina "Work" (Projects & Publications + formazione)
    '/work': renderWork,

    // Pagina CV
    '/cv': renderCV,

    // Route “interne” che riusiamo (restano valide)
    '/accademico/pubblicazioni': renderPublications,
    '/accademico/education': renderEducation,

    // Pagina personale
    '/personale': renderPersonalStub
  };

  function parseHash(){
    const h = location.hash.replace(/^#/, '');
    return h || '/accademico';
  }
  function onRouteChange(){
    const path = parseHash();
    const view = routes[path] || renderNotFound;
    view();
    updateModeLink();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  // --------------------------
  // Render: Accademico (home)
  // --------------------------
  function renderAcademicHome(){
  const { profile } = state.data;
  const app = $('#app');
  app.innerHTML = `
    <section class="hero hero-home">
      <div class="hero-left">
        <div class="hero-avatar">
          <img src="assets/personal.jpg" alt="Foto profilo di ${profile.name}" />
        </div>
        <h1 class="hero-name">${profile.name}</h1>
        <p class="hero-role">${profile.role}</p>
        <div class="social-row">
          ${socialIcon('linkedin', profile.links.linkedin)}
          ${socialIcon('github', profile.links.github)}
          ${socialIcon('email', profile.links.email)}
        </div>
      </div>

      <div class="hero-right">
        <h2 class="about-title">About me</h2>
        <p class="about-body">
          ${profile.about.long}
        </p>
      </div>
    </section>
  `;
}


  // --------------------------
  // Render: Work (Projects & Publications + formazione)
  // --------------------------
  function renderWork(){
    const { profile, topics } = state.data;
    const app = $('#app');

    const list = (state.data.education.concat(state.data.experience))
      .sort((a,b)=> (b.to||'9999').localeCompare(a.to||'9999'))
      .slice(0,3);

    app.innerHTML = `
      <section class="section">
        <div class="card" id="aboutCard">
          <h1>Projects & Publications</h1>
          <h2 data-i18n="section.about">Chi sono</h2>
          <p id="aboutText">${profile.about.short}</p>
          <button class="btn btn-outline" id="aboutMoreBtn" data-i18n="action.readmore">Leggi di più</button>
        </div>
      </section>

      <section class="section">
        <h2 data-i18n="section.research">Research topics</h2>
        <div class="tags">
          ${topics.map(t=>`<span class="tag">${t}</span>`).join('')}
        </div>
      </section>

      <section class="section">
        <div class="row space-between">
          <h2 data-i18n="section.education">Formazione ed esperienze</h2>
          <a class="btn btn-outline" href="#/accademico/education" data-i18n="action.viewall">Vedi tutto</a>
        </div>
        <div class="grid grid-3" id="eduPreview"></div>
      </section>

      <section class="section">
        <div class="row space-between">
          <h2 data-i18n="section.publications">Pubblicazioni</h2>
          <a class="btn" href="#/accademico/pubblicazioni">
            Vai a tutte le pubblicazioni
          </a>
        </div>
      </section>
    `;

    // About espandibile
    const btn = $('#aboutMoreBtn');
    btn?.addEventListener('click', () => {
      const el = $('#aboutText');
      el.textContent = profile.about.long;
      btn.remove();
    });

    // Preview education/experience (prime 3)
    const wrap = $('#eduPreview');
    wrap.innerHTML = list.map(item => eduCard(item)).join('');
  }

    // --------------------------
  // Render: CV
  // --------------------------
  function renderCV(){
    const { profile } = state.data;
    const app = $('#app');

    app.innerHTML = `
      <section class="section">
        <div class="card">
          <h1>Curriculum Vitae</h1>
          <p>
            Puoi scaricare il mio CV aggiornato in formato PDF.
          </p>
          <div style="margin-top:1rem;">
            <a class="btn" href="${profile.cv || '#'}" target="_blank" rel="noopener">
              Apri CV (PDF)
            </a>
          </div>
        </div>
      </section>
    `;
  }



  function socialButtons(links){
    const btn = (href, label) => href ? `<a class="btn btn-outline" href="${href}" target="_blank" rel="noopener">${label}</a>` : '';
    return [
      btn(links.github, 'GitHub'),
      btn(links.linkedin, 'LinkedIn'),
      btn(links.email ? `mailto:${links.email}` : '', 'Email')
    ].join('');
  }

  function eduCard(x){
    return `
      <article class="card">
        <div class="badge">${x.type || 'Item'}</div>
        <h3>${x.title}</h3>
        <p class="pub-meta">${x.institution || x.company} • ${x.city || ''}</p>
        <p class="pub-meta">${x.from} — ${x.to || 'in corso'}</p>
        <p>${x.details || ''}</p>
      </article>`;
  }

 function socialIcon(type, value){
    if (!value) return '';

    let href = '#';
    let label = '';
    let iconFile = '';

    if (type === 'linkedin'){
      href = value;
      label = 'LinkedIn';
      iconFile = 'linkedin.svg';
    } else if (type === 'github'){
      href = value;
      label = 'GitHub';
      iconFile = 'github-mark.svg';
    } else if (type === 'email'){
      href = `mailto:${value}`;
      label = 'Email';
      iconFile = 'gmail.svg';   // usa il nome che hai dato al file
    }

    return `
      <a class="icon-btn" href="${href}" target="_blank" rel="noopener" aria-label="${label}">
        <img src="assets/${iconFile}" alt="${label} icon">
      </a>`;
  }



  // --------------------------
  // Render: Pubblicazioni
  // --------------------------
  function renderPublications(){
    const app = $('#app');
    const pubs = state.data.publications.slice().sort((a,b)=> (b.year||0)-(a.year||0));
    app.innerHTML = `
      <section class="section">
        <div class="row space-between">
          <h1 data-i18n="section.publications">Pubblicazioni</h1>
          <a class="btn btn-outline" href="#/accademico">← <span data-i18n="action.back">Indietro</span></a>
        </div>
        <div class="toolbar">
          <input id="q" class="input" placeholder="Cerca titolo/autori/venue" />
          <select id="yearSel" class="input">
            <option value="">Tutti gli anni</option>
            ${Array.from(new Set(pubs.map(p=>p.year))).sort((a,b)=>b-a).map(y=>`<option>${y}</option>`).join('')}
          </select>
        </div>
        <div id="pubList" class="list"></div>
      </section>`;

    const render = (items) => {
      $('#pubList').innerHTML = items.map(p=>`
        <article class="pub-card">
          <h3>${p.title}</h3>
          <div class="pub-meta">${p.authors} — ${p.venue||''} (${p.year||''})</div>
          <div class="row">
            ${p.pdf ? `<a class="btn" href="${p.pdf}" target="_blank">PDF</a>`:''}
            ${p.doi ? `<a class="btn btn-outline" href="${p.doi}" target="_blank">DOI</a>`:''}
            ${p.code ? `<a class="btn btn-outline" href="${p.code}" target="_blank">Code</a>`:''}
          </div>
        </article>`).join('');
    };
    render(pubs);

    $('#q').addEventListener('input', debounce(() => {
      filter();
    }, 180));
    $('#yearSel').addEventListener('change', filter);

    function filter(){
      const q = $('#q').value.toLowerCase();
      const y = $('#yearSel').value;
      const res = pubs.filter(p => (
        (!y || String(p.year)===String(y)) && (
          p.title?.toLowerCase().includes(q) ||
          p.authors?.toLowerCase().includes(q) ||
          p.venue?.toLowerCase().includes(q)
        ))
      );
      render(res);
    }
  }

  // --------------------------
  // Render: Education + Experience (timeline)
  // --------------------------
  function renderEducation(){
    const app = $('#app');
    const items = state.data.education.concat(state.data.experience)
      .sort((a,b)=> (b.to||'9999').localeCompare(a.to||'9999'));
    app.innerHTML = `
      <section class="section">
        <div class="row space-between">
          <h1 data-i18n="section.education">Formazione ed esperienze</h1>
          <a class="btn btn-outline" href="#/accademico">← <span data-i18n="action.back">Indietro</span></a>
        </div>
        <ol class="timeline list" id="tl"></ol>
      </section>`;
    const tl = $('#tl');
    tl.innerHTML = items.map(x => `
      <li class="tl-item">
        <span class="tl-dot" aria-hidden="true"></span>
        <h3>${x.title}</h3>
        <div class="pub-meta">${x.institution || x.company} • ${x.city || ''}</div>
        <div class="pub-meta">${x.from} — ${x.to || 'in corso'}</div>
        ${x.details ? `<p>${x.details}</p>`:''}
      </li>`).join('');
  }

  // --------------------------
  // Render: Personale (stub)
  // --------------------------
  function renderPersonalStub(){
    const app = $('#app');
    app.innerHTML = `
      <section class="hero">
        <h1 data-i18n="nav.personal">Personale</h1>
        <p class="kicker">Sezione in costruzione</p>
        <div class="card" style="max-width:520px">
          <img src="assets/placeholder-personale.jpg" alt="Anteprima sezione personale" />
        </div>
      </section>`;
  }

  function renderNotFound(){
    $('#app').innerHTML = `<section class="section"><h1>404</h1><p>Pagina non trovata.</p></section>`;
  }

  // --------------------------
  // Utils
  // --------------------------
  function debounce(fn, ms){
    let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
  }

  function setTheme(mode){
    state.theme = mode;
    localStorage.setItem('theme', mode);
    document.documentElement.setAttribute('data-theme', mode);
  }

  function syncLangUI(){
    const langBtn = $('#langBtn');
    if (langBtn){
      const flagSpan = langBtn.querySelector('.flag');
      const codeSpan = langBtn.querySelector('.lang-code');
      if (state.lang === 'it'){
        flagSpan.textContent = '🇮🇹';
        codeSpan.textContent = 'IT';
      } else {
        flagSpan.textContent = '🇬🇧';
        codeSpan.textContent = 'EN';
      }
    }
    $$('#langMenu .lang-item').forEach(item => {
      const isActive = item.dataset.lang === state.lang;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  // Evidenzia voce attiva nel menu (desktop + mobile)
  function updateModeLink(){
    const path = parseHash();

    $$('.nav-item[data-route]').forEach(link => {
      const route = link.dataset.route;
      const isActive = path === route;
      link.classList.toggle('active', isActive);
    });
  }

  // --------------------------
  // Boot
  // --------------------------
  async function boot(){
    setYear();

    // Se non c'è ancora un tema salvato, forza LIGHT come default
    if (!localStorage.getItem('theme')) {
      setTheme('light');
    } else {
      // Applica quello salvato (dark o light)
      setTheme(state.theme);
    }
    // Bottone toggle tema
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      setTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    await loadI18n();
    await loadData();

    // --- language dropdown ---
    const langBtn = $('#langBtn');
    const langMenu = $('#langMenu');

    // inizializza UI in base a state.lang (default 'it')
    syncLangUI();
    updateModeLink();

    langBtn?.addEventListener('click', () => {
      const open = langMenu.getAttribute('aria-hidden') === 'false';
      langMenu.setAttribute('aria-hidden', open ? 'true' : 'false');
      langBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });

    $$('#langMenu .lang-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        const newLang = e.currentTarget.dataset.lang;
        if (newLang && newLang !== state.lang){
          state.lang = newLang;
          localStorage.setItem('lang', newLang);
          await loadI18n();
          await loadData();
          onRouteChange();
          syncLangUI();
        }
        langMenu.setAttribute('aria-hidden','true');
        langBtn.setAttribute('aria-expanded','false');
      });
    });

    // --- HAMBURGER / MENU MOBILE ---
    const navToggle = $('#navToggle');
    const mobileNav = $('#mobileNav');

    navToggle?.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      mobileNav.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    });

    // chiudi menu mobile quando clicchi un link
    $$('#mobileNav .nav-item').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        mobileNav.setAttribute('aria-hidden','true');
        navToggle.setAttribute('aria-expanded','false');
      });
    });

    window.addEventListener('hashchange', () => {
      onRouteChange();
      // per sicurezza chiudiamo il menu mobile al cambio pagina
      const mobileNav = $('#mobileNav');
      const navToggle = $('#navToggle');
      if (mobileNav && navToggle){
        mobileNav.classList.remove('open');
        mobileNav.setAttribute('aria-hidden','true');
        navToggle.setAttribute('aria-expanded','false');
      }
    });

    // chiudi il menu mobile se si torna a larghezza desktop
    window.addEventListener('resize', () => {
      const mobileNav = $('#mobileNav');
      const navToggle = $('#navToggle');
      if (window.innerWidth > 768 && mobileNav && navToggle){
        mobileNav.classList.remove('open');
        mobileNav.setAttribute('aria-hidden','true');
        navToggle.setAttribute('aria-expanded','false');
      }
    });

    onRouteChange();
  }
  boot();

})();