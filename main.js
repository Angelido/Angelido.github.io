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
      about_me: null,
      posts: [],
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
    // Highlight selected language in the inline switch (EN | IT)
    $$('.lang-inline').forEach((btn) => {
      const isActive = btn.dataset.lang === state.lang;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  /* =========================================================
     Data loading
     - profile/home are language-dependent
     - others are shared
  ========================================================== */
  async function loadData() {
    const base = 'data';

    const [profile, posts, education, experience, publications, topics, talks, projects, social, cv] = await Promise.all([
      fetch(`${base}/profile.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/posts.${state.lang}.json`).then((r) => r.json()),
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

    state.data = { profile, posts, education, experience, publications, topics, talks, projects, social, cv };

  }

  /* =========================================================
     Router (hash-based)
  ========================================================== */
  const routes = {
    '/home': renderAcademicHome,
    '/about': renderAbout,
    '/posts': renderPosts,
    '/research': renderResearch,
    '/experience': renderExperience,
    '/cv': renderCV,
    '/research/publications': renderPublications,
    '/privacy': renderPrivacy
  };

  function parseHash() {
    const h = location.hash.replace(/^#/, '');
    return h || '/home';
  }

  function updateActiveNavLinks() {
    const path = parseHash();
    const navPath = path.startsWith('/posts/') ? '/posts' : path;

    $$('.nav-item[data-route]').forEach((link) => {
      link.classList.toggle('active', navPath === link.dataset.route);
    });
  }

  function onRouteChange() {
    const path = parseHash();

    // Dynamic post route: /posts/<id>
    if (path.startsWith('/posts/') && path.split('/').length >= 3) {
      const postId = decodeURIComponent(path.split('/')[2] || '');
      renderPostDetail(postId);
      updateActiveNavLinks();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const view = routes[path] || renderNotFound;

    view();
    updateActiveNavLinks();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* =========================================================
     About text helpers
     - Support blank-line paragraphs + **bold** syntax
  ========================================================== */
  function splitParagraphs(text) {
    return text.trim().split(/\n\s*\n/);
  }

  function renderInlineMD(s) {
    if (!s) return '';

    // 1) Escape minimal to avoid breaking HTML (keeps it simple & safe)
    let html = String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2) **bold**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 3) [text](https://url)  (only http/https)
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, text, url) => {
      return `<a href="${url}" target="_blank" rel="noopener" class="inline-link">${text}</a>`;
    });

    return html;
  }

  function renderParagraphHTML(p) {
    return renderInlineMD(p);
  }

  function formatMonthYearShort(ym) {
  if (!ym) return '';
  const [y, m] = String(ym).split('-').map(Number);
  if (!y || !m) return ym;

  const d = new Date(y, m - 1, 1);
  const loc = state.lang === 'it' ? 'it-IT' : 'en-GB';

  // month: 'short' -> IT: "feb", "giu" | EN: "Feb", "Jun"
  let s = new Intl.DateTimeFormat(loc, { month: 'short', year: 'numeric' }).format(d);

  // Remove trailing dot some locales produce (e.g., "feb." -> "feb")
  s = s.replace('.', '');

  // Capitalize first letter -> "Feb 2026", "Giu 2026"
  s = s.charAt(0).toUpperCase() + s.slice(1);

  return s;
}


  /* =========================================================
     UI components
  ========================================================== */
  function socialIcon(item, opts = {}) {
    const mono = !!opts.mono;

    // Mono variant: use CSS mask so the icon color becomes "currentColor"
    if (mono) {
      return `
        <a class="icon-btn icon-btn--mono"
          href="${item.href}"
          ${item.newTab ? 'target="_blank" rel="noopener"' : ''}
          aria-label="${item.label}"
          style="--icon-url: url('assets/svg/${item.icon}')"
        ></a>
      `;
    }

    // Default variant (used elsewhere): keep original colored SVG via <img>
    return `
      <a class="icon-btn icon-btn--circle"
        href="${item.href}"
        ${item.newTab ? 'target="_blank" rel="noopener"' : ''}
        aria-label="${item.label}">
        <img src="assets/svg/${item.icon}" alt="${item.label}">
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
// =========================================================
// Sostituisci l'intera funzione renderAcademicHome() in main.js
// =========================================================

  function renderAcademicHome() {
    const { profile } = state.data;
    const app = $('#app');

    // Latest post (first by date desc)
    const posts = (state.data.posts || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latest = posts[0] || null;

    // Singolare: "Ultimo post" / "Latest post"
    const latestTitle = state.i18n?.home?.latestTitle || (state.lang === 'it' ? 'Ultimo post' : 'Latest post');

    const formatPostDate = (iso) => {
      if (!iso) return '';
      const d = new Date(iso + 'T00:00:00');
      return isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString(state.lang === 'it' ? 'it-IT' : 'en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
    };

    const dateStr = latest?.date ? formatPostDate(latest.date) : '';

    const line1 = state.lang === 'it'
      ? `👨🏻‍🎓 Dottorando in Informatica presso ${profile?.university || 'Università di Pisa'}`
      : `👨🏻‍🎓 PhD Student in Computer Science at ${profile?.university || 'University of Pisa'}`;

    const line2 = state.lang === 'it'
      ? `📌 Stanza 304, ${profile?.department || 'Dipartimento di Informatica'}`
      : `📌 Room 304, ${profile?.department || 'Department of Computer Science'}`;

    app.innerHTML = `
      <section class="home-simple">
        <div class="home-simple-head">
          <div class="home-simple-avatar">
            <img src="assets/img/personal.jpg" alt="Foto profilo di ${profile?.name || 'Angelo Nardone'}" />
          </div>

          <h1 class="home-simple-name">${profile?.name || 'Angelo Nardone'}</h1>

          <div class="home-simple-lines">
            <div class="home-simple-line">${renderInlineMD(line1)}</div>
            <div class="home-simple-line">${renderInlineMD(line2)}</div>
          </div>

          <div class="home-social">
            ${(state.data.social || []).map((s) => socialIcon(s, { mono: true })).join('')}
          </div>
        </div>

        <section class="home-latest">
          <div class="home-latest-title">${latestTitle}</div>

          ${latest ? `
            <a class="home-latest-card" href="#/posts/${encodeURIComponent(latest.id)}" aria-label="${latest.title || ''}">
              ${latest.title ? `<div class="home-latest-posttitle">${latest.title}</div>` : ''}
              ${latest.abstract ? `<div class="home-latest-abstract">${latest.abstract}</div>` : ''}
              ${(latest.tags||[]).length ? `
                <div class="home-latest-tags">
                  <span class="home-latest-tags-label">${state.lang === 'it' ? 'Tag:' : 'Tags:'}</span>
                  ${latest.tags.map(t => `<span class="tag">${t}</span>`).join('')}
                </div>
              ` : ''}
              ${dateStr ? `<div class="home-latest-meta">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/>
                  <line x1="1" y1="7" x2="15" y2="7" stroke="currentColor" stroke-width="1.4"/>
                  <line x1="5" y1="1" x2="5" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                  <line x1="11" y1="1" x2="11" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
                ${dateStr}
              </div>` : ''}
            </a>
          ` : `
            <div class="pub-meta">${state.lang === 'it' ? 'Nessun post disponibile.' : 'No posts available.'}</div>
          `}
        </section>
      </section>
    `;
  }

  async function renderAbout() {
    const app = $('#app');

    const pageTitle = state.i18n?.aboutPage?.title || 'About me';
    const intro = state.i18n?.aboutPage?.intro || '';

    // Load markdown (language-specific)
    const mdPath = `data/about_me.${state.lang}.md`;

    let bodyHtml = '';
    try {
      const md = await fetch(mdPath).then(r => r.text());
      const rawHtml = window.marked ? marked.parse(md) : md;
      bodyHtml = window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;

      // Add site link styling to markdown links
      bodyHtml = bodyHtml.replace(/<a\s+/g, '<a class="inline-link" ');
    } catch (e) {
      bodyHtml = `<p class="pub-meta">${state.lang === 'it'
        ? 'Impossibile caricare la pagina About me.'
        : 'Unable to load the About me page.'}</p>`;
    }

    app.innerHTML = `
      ${pageHeaderHTML(pageTitle, intro)}

      <section class="section aboutme markdown-body">
        ${bodyHtml}
      </section>
    `;
  }

  function formatPostDate(iso) {
    // ISO YYYY-MM-DD -> locale
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString(state.lang === 'it' ? 'it-IT' : 'en-GB', {
      year: 'numeric', month: 'short', day: '2-digit'
    });
  }

  function collectAllTags(posts) {
    const set = new Set();
    (posts || []).forEach(p => (p.tags || []).forEach(t => set.add(String(t))));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function renderPosts() {
    const app = $('#app');

    const POSTS_PER_PAGE = 5;

    const pageTitle = state.i18n?.postsPage?.title || 'Posts';
    const intro = state.i18n?.postsPage?.intro || '';
    const filterLabel = state.i18n?.postsPage?.filterByTag || (state.lang === 'it' ? 'Filtra per tag' : 'Filter by tag');
    const allTagsLabel = state.i18n?.postsPage?.allTags || (state.lang === 'it' ? 'Tutti' : 'All');
    const emptyLabel = state.i18n?.postsPage?.noItems || (state.lang === 'it' ? 'Nessun post trovato.' : 'No posts found.');
    const minReadLabel = state.lang === 'it' ? 'min di lettura' : 'min read';
    const tagsLabel = state.lang === 'it' ? 'Tag:' : 'Tags:';

    const posts = (state.data.posts || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const allTags = collectAllTags(posts);

    app.innerHTML = `
      ${pageHeaderHTML(pageTitle, intro)}

      <section class="section posts-toolbar">
        <div class="posts-toolbar-inner">
          <div class="posts-toolbar-spacer"></div>

          <div class="posts-filter">
            <label class="posts-filter-label" for="tagSel">${filterLabel}</label>
            <select id="tagSel" class="input posts-filter-select">
              <option value="">${allTagsLabel}</option>
              ${allTags.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
        </div>
      </section>

      <section class="section posts-flat-list" id="postsList"></section>

      <div class="posts-pagination" id="postsPagination"></div>
    `;

    const listEl = $('#postsList');
    const paginationEl = $('#postsPagination');

    let currentPage = 1;
    let currentItems = posts;

    const renderPage = (items, page, readingMinutes = {}) => {
      const total = items.length;
      const totalPages = Math.ceil(total / POSTS_PER_PAGE);
      const start = (page - 1) * POSTS_PER_PAGE;
      const slice = items.slice(start, start + POSTS_PER_PAGE);

      listEl.innerHTML = total
        ? slice.map((p, idx) => {
            const dateStr = formatPostDate(p.date);
            const tags = Array.isArray(p.tags) ? p.tags : [];
            const mins = readingMinutes[p.id] || 1;
            const isLast = idx === slice.length - 1;

            const href = `#/posts/${encodeURIComponent(p.id)}`;

            return `
              <article class="post-flat-item${isLast ? ' post-flat-item--last' : ''}${p.image ? ' post-flat-item--hasimg' : ''}"
                       onclick="location.href='${href}'"
                       role="link"
                       tabindex="0"
                       onkeydown="if(event.key==='Enter')location.href='${href}'"
                       aria-label="${p.title || ''}">

                <div class="post-flat-inner">
                  <div class="post-flat-content">
                    <a class="post-flat-link" href="${href}" tabindex="-1" aria-hidden="true">
                      ${p.title ? `<h2 class="post-flat-title">${p.title}</h2>` : ''}
                    </a>

                    ${p.abstract ? `<p class="post-flat-abstract">${p.abstract}</p>` : ''}

                    ${tags.length ? `
                      <div class="post-flat-tags">
                        <span class="post-flat-tags-label">${tagsLabel}</span>
                        ${tags.map(t => `<span class="tag">${t}</span>`).join('')}
                      </div>
                    ` : ''}

                    <div class="post-flat-meta">
                      ${dateStr ? `<span class="post-flat-date">
                        <svg class="post-flat-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/>
                          <line x1="1" y1="7" x2="15" y2="7" stroke="currentColor" stroke-width="1.4"/>
                          <line x1="5" y1="1" x2="5" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                          <line x1="11" y1="1" x2="11" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                        </svg>
                        ${dateStr}
                      </span>` : ''}
                      <span class="post-flat-readtime">
                        <svg class="post-flat-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/>
                          <line x1="8" y1="5" x2="8" y2="8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                          <line x1="8" y1="8.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                        </svg>
                        ${mins} ${minReadLabel}
                      </span>
                    </div>
                  </div>

                  ${p.image ? `
                    <div class="post-flat-thumb">
                      <img src="${p.image}" alt="${p.title || ''}" loading="lazy" />
                    </div>
                  ` : ''}
                </div>
              </article>
            `;
          }).join('')
        : `<p class="pub-meta">${emptyLabel}</p>`;

      // Pagination
      if (totalPages > 1) {
        const prevDisabled = page <= 1;
        const nextDisabled = page >= totalPages;

        // Build page numbers: always show up to 5 pages around current
        const pageNums = [];
        for (let i = 1; i <= totalPages; i++) pageNums.push(i);

        paginationEl.innerHTML = `
          <nav class="pagination" aria-label="Paginazione post">
            <button class="pagination-btn" data-page="${page - 1}" ${prevDisabled ? 'disabled aria-disabled="true"' : ''} aria-label="Pagina precedente">
              &lsaquo;
            </button>
            ${pageNums.map(n => `
              <button class="pagination-btn${n === page ? ' pagination-btn--active' : ''}" data-page="${n}" aria-label="Pagina ${n}" ${n === page ? 'aria-current="page"' : ''}>
                ${n}
              </button>
            `).join('')}
            <button class="pagination-btn" data-page="${page + 1}" ${nextDisabled ? 'disabled aria-disabled="true"' : ''} aria-label="Pagina successiva">
              &rsaquo;
            </button>
          </nav>
        `;

        $$('.pagination-btn', paginationEl).forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.disabled) return;
            currentPage = parseInt(btn.dataset.page, 10);
            renderPage(currentItems, currentPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
        });
      } else {
        paginationEl.innerHTML = '';
      }
    };

    const applyFilter = () => {
      const sel = $('#tagSel').value;
      currentItems = !sel ? posts : posts.filter(p => (p.tags || []).map(String).includes(sel));
      currentPage = 1;
      renderPage(currentItems, currentPage, readingMinutes);
    };

    $('#tagSel').addEventListener('change', applyFilter);

    // Fetch all markdown files in parallel to compute real reading times
    const readingMinutes = {};
    Promise.all(
      posts.map(p => {
        const mdPath = p.content || p.contentPath || '';
        if (!mdPath || !/\.md$/i.test(mdPath)) return Promise.resolve({ id: p.id, mins: 1 });
        return fetch(mdPath)
          .then(r => r.text())
          .then(text => {
            const words = text.trim().split(/\s+/).filter(Boolean).length;

            const baseMinutes = Math.max(1, Math.round(words / 200));
            return { id: p.id, mins: baseMinutes + 1 };
          })
          .catch(() => ({ id: p.id, mins: 1 }));
      })
    ).then(results => {
      results.forEach(r => { readingMinutes[r.id] = r.mins; });
      renderPage(currentItems, currentPage, readingMinutes);
    });

    // Initial render with placeholder (1 min) until fetch completes
    renderPage(posts, currentPage, readingMinutes);
  }

  async function renderPostDetail(postId) {
    const app = $('#app');

    const posts = state.data.posts || [];
    const p = posts.find(x => String(x.id) === String(postId));

    if (!p) { renderNotFound(); return; }

    const dateStr = formatPostDate(p.date);
    const tags = Array.isArray(p.tags) ? p.tags : [];

    let bodyHtml = '';
    let mdText = '';

    const mdPath = p.contentPath || p.content;

    if (mdPath && /\.md$/i.test(mdPath)) {
      mdText = await fetch(mdPath).then(r => r.text());
      const rawHtml = window.marked ? marked.parse(mdText) : mdText;
      bodyHtml = window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;
      bodyHtml = bodyHtml.replace(/<a\s+/g, '<a class="inline-link" ');
    } else {
      const paragraphs = splitParagraphs(String(p.content || ''));
      bodyHtml = paragraphs.map((pp) => `<p>${renderParagraphHTML(pp)}</p>`).join('');
    }

    const isMarkdown = !!(mdPath && /\.md$/i.test(mdPath));

    // Minuti di lettura (stessa logica della lista, nessun fetch aggiuntivo)
    const words = mdText.trim().split(/\s+/).filter(Boolean).length;
    const readMins = mdText ? Math.max(1, Math.round(words / 200)) + 1 : 1;
    const minReadLabel = state.lang === 'it' ? 'min di lettura' : 'min read';

    app.innerHTML = `
      <section class="section post-page">

        <div class="post-page-header">
          ${p.title ? `<h1 class="post-page-title">${p.title}</h1>` : ''}

          <div class="post-page-meta">
            ${dateStr ? `
              <span class="post-page-meta-item">
                <svg class="post-page-meta-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/>
                  <line x1="1" y1="7" x2="15" y2="7" stroke="currentColor" stroke-width="1.4"/>
                  <line x1="5" y1="1" x2="5" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                  <line x1="11" y1="1" x2="11" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
                ${dateStr}
              </span>
            ` : ''}
            <span class="post-page-meta-item">
              <svg class="post-page-meta-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/>
                <line x1="8" y1="5" x2="8" y2="8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <line x1="8" y1="8.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
              ${readMins} ${minReadLabel}
            </span>
          </div>

          ${tags.length ? `
            <div class="post-page-tags">
              ${tags.map(t => `<span class="tag">${t}</span>`).join('')}
            </div>
          ` : ''}
        </div>

        <hr class="post-page-divider" />

        ${(!isMarkdown && p.image) ? `
          <figure class="post-page-figure">
            <img class="post-page-img" src="${p.image}" alt="${p.title || ''}">
          </figure>
        ` : ''}

        <div class="post-page-body markdown-body">
          ${bodyHtml}
        </div>

        <div class="post-page-footer">
          <a href="#/posts" class="post-back-link">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="14" height="14">
              <line x1="13" y1="8" x2="3" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <polyline points="7,4 3,8 7,12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ${state.lang === 'it' ? 'Torna ai post' : 'Back to posts'}
          </a>
        </div>

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

        <!-- Left column: Talks + Topics -->
        <div class="research-col-left">

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
                          <div><strong>${renderInlineMD(t.event || '')}</strong></div>

                          <!-- 2) Institution / venue -->
                          ${t.institution ? `
                            <div class="pub-meta">
                              ${renderInlineMD(t.institution)}
                              ${t.venue ? ` — ${renderInlineMD(t.venue)}` : ''}
                            </div>
                          ` : ''}

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

          <!-- Topics -->
          <article class="card research-panel research-panel--topics">
            <h2>${topicsTitle}</h2>
            <div class="tags">
              ${topics.map((t) => `<span class="tag">${t}</span>`).join('')}
            </div>
          </article>
        </div>

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
                                <strong>${labels.desc}:</strong> ${renderInlineMD(p.description)}
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

      </section>
    `;

    // --- Mobile/desktop ordering: keep desktop (Talks+Topics left), mobile (Talks → Projects → Topics)
    const syncResearchOrder = () => {
      const left = document.querySelector('.research-col-left');
      const projectsPanel = document.querySelector('.research-panel--projects');
      const topicsPanel = document.querySelector('.research-panel--topics');

      if (!left || !projectsPanel || !topicsPanel) return;

      const isMobile = window.matchMedia('(max-width:1099px)').matches;

      if (isMobile) {
        // Move Topics AFTER Projects
        if (projectsPanel.nextElementSibling !== topicsPanel) {
          projectsPanel.insertAdjacentElement('afterend', topicsPanel);
        }
      } else {
        // Put Topics back into the left column (under Talks)
        if (!left.contains(topicsPanel)) {
          left.appendChild(topicsPanel);
        }
      }
    };

    // Run once now
    syncResearchOrder();

    // Re-run on resize (debounced) — register only once
    if (!window.__researchResizeBound) {
      window.__researchResizeBound = true;
      window.addEventListener('resize', debounce(() => {
        // Only run when Research page is mounted
        if (document.querySelector('.research-grid')) syncResearchOrder();
      }, 150));
    }

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

    const title        = state.i18n?.cv?.title         || 'Curriculum Vitae';
    const intro        = state.i18n?.cv?.intro          || '';
    const itLabel      = state.i18n?.cv?.itLabel        || (state.lang === 'it' ? 'CV in italiano'  : 'Italian CV');
    const enLabel      = state.i18n?.cv?.enLabel        || (state.lang === 'it' ? 'CV in inglese'   : 'English CV');
    const openText     = state.i18n?.actions?.openNewTab  || (state.lang === 'it' ? 'Apri'           : 'Open');
    const downloadText = state.i18n?.actions?.downloadPdf || (state.lang === 'it' ? 'Scarica PDF'    : 'Download PDF');
    const lastUpdatedLabel = state.i18n?.cv?.lastUpdatedLabel || (state.lang === 'it' ? 'Ultimo aggiornamento' : 'Last updated');

    const cvIt   = state.data.cv?.it          || 'assets/pdf/cv-it.pdf';
    const cvEn   = state.data.cv?.en          || 'assets/pdf/cv-en.pdf';
    const updated = state.data.cv?.lastUpdated || '';

    const noteHtml = state.lang === 'it'
      ? `Il contenuto principale è già nelle sezioni <a class="inline-link" href="#/research">Ricerca</a> e <a class="inline-link" href="#/experience">Formazione &amp; Esperienza</a>.`
      : `Most of the content is already in <a class="inline-link" href="#/research">Research</a> and <a class="inline-link" href="#/experience">Education &amp; Experience</a>.`;

    // SVG icons inline (no external dependency)
    const iconExternal = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
    const iconDownload = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    const iconCalendar = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

    const cvCard = (label, langTag, pdfPath) => `
      <div class="cv-card">
        <div class="cv-card-top">
          <span class="cv-lang-badge">${langTag}</span>
          <div class="cv-card-doc-icon" aria-hidden="true">
            <div class="cv-doc-sheet">
              <div class="cv-doc-line cv-doc-line--title"></div>
              <div class="cv-doc-line"></div>
              <div class="cv-doc-line cv-doc-line--short"></div>
              <div class="cv-doc-line"></div>
              <div class="cv-doc-line cv-doc-line--short"></div>
            </div>
          </div>
          <div class="cv-card-label">${label}</div>
          <div class="cv-card-meta">PDF</div>
        </div>
        <div class="cv-card-actions">
          <a class="cv-card-btn cv-card-btn--primary" href="${pdfPath}" target="_blank" rel="noopener">
            ${iconExternal} ${openText}
          </a>
          <a class="cv-card-btn cv-card-btn--outline" href="${pdfPath}" download>
            ${iconDownload} ${downloadText}
          </a>
        </div>
      </div>
    `;

    app.innerHTML = `
      ${pageHeaderHTML(title, intro)}

      <section class="section cv-gateway-v2">

        <div class="cv-cards-row">
          ${cvCard(enLabel, 'EN', cvEn)}
          ${cvCard(itLabel, 'IT', cvIt)}
        </div>

        ${updated ? `
          <div class="cv-updated-v2">
            ${iconCalendar}
            <span>${lastUpdatedLabel}: <strong>${updated}</strong></span>
          </div>
        ` : ''}

        <p class="cv-note-v2">${noteHtml}</p>

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
          ${formatMonthYearShort(x.from)} — ${x.to ? formatMonthYearShort(x.to) : ongoingLabel}
          ${x.finalGrade ? ` • <strong>${x.finalGrade}</strong>` : ''}
        </div>

        ${x.topic ? `
        <div class="edu-line">
          <span class="edu-label">${state.lang === 'it' ? 'Tema:' : 'Topic:'}</span>
          <span class="edu-value"><em>${x.topic}</em></span>
        </div>
      ` : ""}

        ${x.description ? `
          <div class="edu-description">
            <span class="edu-label">${state.lang === 'it' ? 'Descrizione:' : 'Description:'}</span>
            <span class="edu-desc-text">${renderInlineMD(x.description)}</span>
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
            <span class="edu-value">${renderInlineMD(x.supervisor)}</span>

          </div>
        ` : ""}

        ${x.opponent ? `
          <div class="edu-line">
            <span class="edu-label">${opponentLabel}</span>
            <span class="edu-value">${renderInlineMD(x.opponent)}</span>
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

  async function renderPrivacy() {
    const app = $('#app');

    // Load markdown (language-specific)
    const mdPath = `data/privacy.${state.lang}.md`;

    let bodyHtml = '';
    try {
      const md = await fetch(mdPath).then(r => r.text());
      const rawHtml = window.marked ? marked.parse(md) : md;
      bodyHtml = window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;

      // Add site link styling to markdown links
      bodyHtml = bodyHtml.replace(/<a\s+/g, '<a class="inline-link" ');
    } catch (e) {
      bodyHtml = `<p class="pub-meta">${state.lang === 'it'
        ? 'Impossibile caricare la pagina privacy.'
        : 'Unable to load the privacy page.'}</p>`;
    }

    // IMPORTANT: no extra title/intro here — markdown only
    app.innerHTML = `
      <section class="section privacy-page markdown-body">
        ${bodyHtml}
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

    // Language inline switch (EN | IT)
    syncLangUI();
    updateActiveNavLinks();

    $$('.lang-inline').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const newLang = e.currentTarget.dataset.lang;
        if (!newLang || newLang === state.lang) return;

        state.lang = newLang;
        localStorage.setItem('lang', newLang);

        await loadI18n();
        await loadData();

        onRouteChange();
        syncLangUI();
      });
    });


    // Mobile nav (hamburger)
    const navToggle = $('#navToggle');
    const mobileNav = $('#mobileNav');

    navToggle?.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      mobileNav.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

      // NEW: overlay + body state
      document.body.classList.toggle('nav-open', isOpen);
    });

    // Close mobile menu when a link is clicked
    $$('#mobileNav .nav-item').forEach((link) => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        mobileNav.setAttribute('aria-hidden', 'true');
        navToggle.setAttribute('aria-expanded', 'false');

        // NEW
        document.body.classList.remove('nav-open');
      });
    });

    // Route changes: render view + close mobile menu defensively
    window.addEventListener('hashchange', () => {
      onRouteChange();

      mobileNav?.classList.remove('open');
      mobileNav?.setAttribute('aria-hidden', 'true');
      navToggle?.setAttribute('aria-expanded', 'false');

      // NEW
      document.body.classList.remove('nav-open');
    });

    // If resized to desktop, ensure the mobile menu is closed
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1000 && mobileNav && navToggle) {
        mobileNav.classList.remove('open');
        mobileNav.setAttribute('aria-hidden', 'true');
        navToggle.setAttribute('aria-expanded', 'false');

        // NEW
        document.body.classList.remove('nav-open');
      }
    });

    document.addEventListener('click', (e) => {
      if (!document.body.classList.contains('nav-open')) return;

      const clickedInsideDrawer = mobileNav.contains(e.target);
      const clickedToggle = navToggle.contains(e.target);

      if (!clickedInsideDrawer && !clickedToggle) {
        mobileNav.classList.remove('open');
        mobileNav.setAttribute('aria-hidden', 'true');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('nav-open');
      }
    });

    // Initial render
    onRouteChange();
  }

  boot();
})();