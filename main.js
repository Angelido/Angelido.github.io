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
  function toggleMobileMenu(){
    const menuBtn = $('#menuBtn');
    const mobile = $('#mobileMenu');
    menuBtn?.addEventListener('click', () => {
      const open = mobile.style.display === 'block';
      mobile.style.display = open ? 'none' : 'block';
      menuBtn.setAttribute('aria-expanded', String(!open));
    });
  }

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
    '/accademico': renderAcademicHome,
    '/accademico/pubblicazioni': renderPublications,
    '/accademico/education': renderEducation,
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --------------------------
  // Render: Accademico (home)
  // --------------------------
  function renderAcademicHome(){
    const { profile, topics } = state.data;
    const app = $('#app');
    app.innerHTML = `
      <section class="hero two-col">
        <div>
          <p class="kicker">${profile.affiliation || ''}</p>
          <h1>${profile.name} — ${profile.role}</h1>
          <p>${profile.tagline}</p>
          <div class="row">
            <a class="btn" href="${profile.cv || '#'}" target="_blank" rel="noopener">CV (PDF)</a>
            <a class="btn btn-outline" href="#/accademico/pubblicazioni" data-i18n="nav.pubs">Pubblicazioni</a>
          </div>
          <div class="section">
            <h2 data-i18n="section.about">Chi sono</h2>
            <div class="card" id="aboutCard">
              <p id="aboutText">${profile.about.short}</p>
              <button class="btn btn-outline" id="aboutMoreBtn" data-i18n="action.readmore">Leggi di più</button>
            </div>
          </div>
          <div class="section">
            <h2 data-i18n="section.research">Research topics</h2>
            <div class="tags">${topics.map(t=>`<span class="tag">${t}</span>`).join('')}</div>
          </div>
        </div>
        <aside>
          <div class="card" style="text-align:center">
            <img src="assets/personal.jpg" alt="Foto profilo di Angelo Nardone" style="border-radius:12px;margin:auto;max-width:260px" />
            <div class="row" style="justify-content:center;margin-top:.8rem">
              ${socialButtons(profile.links)}
            </div>
          </div>
        </aside>
      </section>

      <section class="section">
        <div class="row space-between">
          <h2 data-i18n="section.education">Formazione ed esperienze</h2>
          <a class="btn btn-outline" href="#/accademico/education" data-i18n="action.viewall">Vedi tutto</a>
        </div>
        <div class="grid grid-3" id="eduPreview"></div>
      </section>
    `;

    // About expand
    const btn = $('#aboutMoreBtn');
    btn?.addEventListener('click', () => {
      const el = $('#aboutText');
      el.textContent = profile.about.long;
      btn.remove();
    });

    // Education preview (prime 3 voci miste da education/experience)
    const list = (state.data.education.concat(state.data.experience))
      .sort((a,b)=> (b.to||'9999') .localeCompare(a.to||'9999'))
      .slice(0,3);
    const wrap = $('#eduPreview');
    wrap.innerHTML = list.map(item => eduCard(item)).join('');
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




  // --------------------------
  // Boot
  // --------------------------
  async function boot(){
    setYear();
    toggleMobileMenu();

    // Imposta il tema al primo avvio
    document.documentElement.setAttribute('data-theme', state.theme);
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

    window.addEventListener('hashchange', onRouteChange);
    onRouteChange();
  }
  boot();

})();