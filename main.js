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
      cv: null,
      schools: []
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

  async function highlightCodeWithShiki(code, lang) {
    if (!window.shikiCodeToHtml && window._shikiReady) {
      await window._shikiReady;
    }
    const shiki = window.shikiCodeToHtml;
    if (!shiki) {
      return `<pre><code>${String(code)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</code></pre>`;
    }

    const normalizedLang = !lang || ['txt', 'text', 'plaintext'].includes(lang)
      ? 'text'
      : lang;

    const theme = state.theme === 'dark' ? 'github-dark' : 'github-light';

    try {
      return await shiki(String(code), {
        lang: normalizedLang,
        theme
      });
    } catch (err) {
      return await shiki(String(code), {
        lang: 'text',
        theme
      });
    }
  }

  async function replaceAsync(str, regex, asyncFn) {
    const promises = [];
    str.replace(regex, (...args) => {
      promises.push(asyncFn(...args));
      return args[0];
    });

    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift());
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

    const [profile, posts, education, experience, publications, topics, talks, projects, schools, social, cv, places] = await Promise.all([
      fetch(`${base}/profile.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/posts.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/education.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/experience.${state.lang}.json`).then((r) => r.json()),

      // Research page content (language-dependent)
      fetch(`${base}/publications.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/topics.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/talks.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/projects.${state.lang}.json`).then((r) => r.json()),
      fetch(`${base}/schools.${state.lang}.json`).then((r) => r.json()),

      fetch(`${base}/social.json`).then((r) => r.json()),
      fetch(`${base}/cv.json`).then((r) => r.json()),
      fetch(`${base}/places.json`).then((r) => r.json()),
    ]);

    state.data = { profile, posts, education, experience, publications, topics, talks, projects, schools, social, cv, places };

  }

  /* =========================================================
     Router (History API)
  ========================================================== */
  const routes = {
    '/home': renderAcademicHome,
    '/about': renderAbout,
    '/posts': renderPosts,
    '/research': renderResearch,
    '/experience': renderExperience,
    '/cv': renderCV,
    '/map': renderMap,
    '/research/publications': renderPublications,
    '/privacy': renderPrivacy
  };

  function parsePath() {
    const p = location.pathname;
    return p === '/' || p === '' || p === '/index.html' ? '/home' : p;
  }

  function updateActiveNavLinks() {
    const path = parsePath();
    const navPath = path.startsWith('/posts/') ? '/posts' : path;

    $$('.nav-item[data-route]').forEach((link) => {
      link.classList.toggle('active', navPath === link.dataset.route);
    });
  }

  function navigate(href) {
    if (href !== location.pathname) history.pushState({}, '', href);
    onRouteChange();
  }

  function onRouteChange() {
    const path = parsePath();

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

  async function renderMarkdownFragment(md) {
    const codeBlocks = [];
    const fenced = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;

    md = await replaceAsync(md, fenced, async (_, lang, code) => {
      const cleanLang = (lang || 'txt').trim().toLowerCase();
      const shikiHtml = await highlightCodeWithShiki(code, cleanLang);

      const wrapped = `
  <div class="code-block">
    <span class="code-block-lang-badge">${cleanLang || 'txt'}</span>

    <button
      class="code-block-copy"
      type="button"
      aria-label="Copy code"
    >
      <svg class="copy-icon copy-icon--default" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="9" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
        <path d="M3 10.5H2.5A1.5 1.5 0 0 1 1 9V2.5A1.5 1.5 0 0 1 2.5 1H9A1.5 1.5 0 0 1 10.5 2.5V3" stroke="currentColor" stroke-width="1.4"/>
      </svg>

      <svg class="copy-icon copy-icon--check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <polyline points="2,8 6,12 14,4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>

      <span class="copy-label">Copy</span>
    </button>

    ${shikiHtml}
  </div>`.trim();

      const token = `@@CODEBLOCK_${codeBlocks.length}@@`;
      codeBlocks.push(wrapped);
      return token;
    });

    const mathBlocks = [];
    // \[...\] first — captures any nested \begin{equation} as one unit
    md = md.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => {
      const token = `@@MATH_${mathBlocks.length}@@`;
      const trimmed = inner.trim();
      const numberedEq = trimmed.match(/^\\begin\{equation\}([\s\S]*?)\\end\{equation\}$/);
      const starEq     = trimmed.match(/^\\begin\{equation\*\}([\s\S]*?)\\end\{equation\*\}$/);
      if (numberedEq) {
        mathBlocks.push({ math: numberedEq[1].trim(), display: true, numbered: true });
      } else if (starEq) {
        mathBlocks.push({ math: starEq[1].trim(), display: true, numbered: false });
      } else {
        mathBlocks.push({ math: trimmed, display: true, numbered: false });
      }
      return `\n\n${token}\n\n`;
    });
    // Standalone \begin{environment}...\end{environment}
    md = md.replace(/\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|split)\}([\s\S]*?)\\end\{\1\}/g, (match, env, inner) => {
      const token = `@@MATH_${mathBlocks.length}@@`;
      const numbered = env === 'equation';
      const math = /^equation/.test(env) ? inner.trim() : match;
      mathBlocks.push({ math, display: true, numbered });
      return `\n\n${token}\n\n`;
    });
    md = md.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => {
      const token = `@@MATH_${mathBlocks.length}@@`;
      mathBlocks.push({ math: inner, display: false });
      return token;
    });
    const rawHtml = window.marked ? marked.parse(md) : md;
    let html = window.DOMPurify ? DOMPurify.sanitize(rawHtml) : rawHtml;
    html = html.replace(/<a\s+/g, '<a class="inline-link" ');

    html = html.replace(
      /<pre><code class="([^"]*)">([\s\S]*?)<\/code><\/pre>/g,
      (match, cls, code) => {
        const langMatch = cls.match(/language-([a-zA-Z0-9_+-]+)/);
        const lang = langMatch ? langMatch[1] : 'txt';

        return `
  <div class="code-block">
    <span class="code-block-lang-badge">${lang}</span>

    <button
      class="code-block-copy"
      type="button"
      aria-label="Copy code"
    >
      <svg class="copy-icon copy-icon--default" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="9" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
        <path d="M3 10.5H2.5A1.5 1.5 0 0 1 1 9V2.5A1.5 1.5 0 0 1 2.5 1H9A1.5 1.5 0 0 1 10.5 2.5V3" stroke="currentColor" stroke-width="1.4"/>
      </svg>

      <svg class="copy-icon copy-icon--check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <polyline points="2,8 6,12 14,4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>

      <span class="copy-label">Copy</span>
    </button>

    <pre><code class="${cls}">${code}</code></pre>
  </div>
        `;
      }
    );

    mathBlocks.forEach(({ math, display, numbered }, i) => {
      let rendered;
      if (window.katex) {
        try {
          rendered = katex.renderToString(math, { displayMode: display, throwOnError: false });
        } catch (e) {
          rendered = math;
        }
      } else {
        rendered = display ? `$$${math}$$` : `$${math}$`;
      }
      if (display) {
        const cls = numbered ? 'math-display math-eq-numbered' : 'math-display';
        const wrapped = `<div class="${cls}">${rendered}</div>`;
        html = html.replace(new RegExp(`<p>\\s*@@MATH_${i}@@\\s*<\\/p>`), wrapped);
      }
      html = html.replace(`@@MATH_${i}@@`, rendered);
    });

    codeBlocks.forEach((block, i) => {
      html = html.replace(`@@CODEBLOCK_${i}@@`, block);
    });

    return html;
  }

  async function renderMarkdown(md) {
    // ── Extract and parse ## References / ## Riferimenti section ─────────
    const refs = {};
    let refsHtml = '';

    md = md.replace(/^## (?:References|Riferimenti)\b([\s\S]*)/m, (_, content) => {
      const entryRe = /^\[([^\]]+)\]\s+(.+)$/gm;
      const refEntries = [];
      let em;
      while ((em = entryRe.exec(content)) !== null) {
        const key = em[1].trim();
        const entry = em[2].trim();
        const yearMatch = entry.match(/\((\d{4})\)/);
        const year = yearMatch ? yearMatch[1] : '';
        const beforeYear = yearMatch
          ? entry.slice(0, yearMatch.index).trim().replace(/[,.]$/, '')
          : entry;
        const parts = beforeYear.split(/\s*&\s*/);
        const lastNames = parts.map(a => {
          const t = a.trim();
          const ci = t.indexOf(',');
          return ci > 0 ? t.slice(0, ci).trim() : (t.split(/\s+/).pop() || '');
        }).filter(Boolean);
        let inline;
        if (!lastNames.length)           inline = year;
        else if (lastNames.length === 1) inline = `${lastNames[0]}, ${year}`;
        else if (lastNames.length === 2) inline = `${lastNames[0]} & ${lastNames[1]}, ${year}`;
        else                             inline = `${lastNames[0]} et al., ${year}`;
        refs[key] = { inlineCite: inline, entry };
        refEntries.push({ key, entry });
      }
      if (refEntries.length) {
        const label = state.lang === 'it' ? 'Riferimenti' : 'References';
        refsHtml = `
        <div class="post-references">
          <div class="post-references-label">${label}</div>
          <div class="post-references-list">
            ${refEntries.map(({ key, entry }) => {
              const eHtml = window.marked ? marked.parseInline(entry) : entry;
              return `<div class="post-ref-item" id="ref-${key}">${eHtml}</div>`;
            }).join('')}
          </div>
        </div>`;
      }
      return '';
    });
    md = md.trimEnd();

    // ── Figure blocks: :::figure[src] — svg inline / img / iframe, bypasses DOMPurify ─
    const htmlFigs = [];
    md = md.replace(/:::figure\[([^\]]+)\]\s*\n([\s\S]*?)\n:::/g, (_, src, caption) => {
      const token = `@@HTMLFIG_${htmlFigs.length}@@`;
      const trimSrc = src.trim();
      const isSvg = /\.svg$/i.test(trimSrc);
      const isImg = !isSvg && /\.(png|jpe?g|gif|webp)$/i.test(trimSrc);
      htmlFigs.push({ src: trimSrc, caption: caption.trim(), isImg, isSvg });
      return token;
    });

    // ── Process all theorem / definition / example / proof blocks ─────────
    const TYPES = {
      theorem:     { en: 'Theorem',     it: 'Teorema',       style: 'theorem',    noNum: false },
      lemma:       { en: 'Lemma',       it: 'Lemma',         style: 'theorem',    noNum: false },
      proposition: { en: 'Proposition', it: 'Proposizione',  style: 'theorem',    noNum: false },
      corollary:   { en: 'Corollary',   it: 'Corollario',    style: 'theorem',    noNum: false },
      claim:       { en: 'Claim',       it: 'Affermazione',  style: 'theorem',    noNum: false },
      definition:  { en: 'Definition',  it: 'Definizione',   style: 'definition', noNum: false },
      notation:    { en: 'Notation',    it: 'Notazione',     style: 'definition', noNum: false },
      example:     { en: 'Example',     it: 'Esempio',       style: 'example',    noNum: false },
      remark:      { en: 'Remark',      it: 'Osservazione',  style: 'remark',     noNum: false },
      observation: { en: 'Observation', it: 'Osservazione',  style: 'remark',     noNum: false },
      note:        { en: 'Note',        it: 'Nota',          style: 'remark',     noNum: false },
      proof:       { en: 'Proof',       it: 'Dimostrazione', style: 'proof',      noNum: true  },
    };
    const counters = {};
    const blocks = [];

    md = await replaceAsync(md, /:::(\w+)(?:\[([^\]]*)\])?\s*\n([\s\S]*?)\n:::/g,
      async (_, type, name, content) => {
        const key = type.toLowerCase();
        const info = TYPES[key];
        if (!info) return _;
        const lang = state.lang === 'it' ? 'it' : 'en';
        let label = info[lang];
        if (!info.noNum) {
          counters[key] = (counters[key] || 0) + 1;
          label += ` ${counters[key]}`;
        }
        if (name) label += ` (${name})`;

        let inner = await renderMarkdownFragment(content.trim());
        const labelHtml = info.style === 'proof'
          ? `<em class="theorem-label">${label}.</em>&ensp;`
          : `<strong class="theorem-label">${label}.</strong>&ensp;`;

        const pIdx = inner.indexOf('<p>');
        if (pIdx !== -1) {
          inner = inner.slice(0, pIdx + 3) + labelHtml + inner.slice(pIdx + 3);
        } else {
          inner = `<p>${labelHtml}</p>` + inner;
        }
        if (info.style === 'proof') {
          const lastEnd = inner.lastIndexOf('</p>');
          if (lastEnd !== -1)
            inner = inner.slice(0, lastEnd) + '<span class="theorem-qed">□</span>' + inner.slice(lastEnd);
        }

        const token = `@@BLOCK_${blocks.length}@@`;
        blocks.push(`<div class="theorem-block theorem-block--${info.style}">${inner}</div>`);
        return token;
      }
    );

    let html = await renderMarkdownFragment(md);

    blocks.forEach((b, i) => {
      html = html
        .replace(`<p>@@BLOCK_${i}@@</p>`, b)
        .replace(`@@BLOCK_${i}@@`, b);
    });

    for (const [i, { src, caption, isImg, isSvg }] of htmlFigs.entries()) {
      const capHtml = window.marked ? marked.parseInline(caption) : caption;
      const safeTitle = caption.replace(/"/g, '&quot;').replace(/</g, '&lt;');
      let media;
      if (isSvg) {
        try {
          const svgResp = await fetch(src);
          let svgText = await svgResp.text();
          svgText = svgText.replace(/<script[\s\S]*?<\/script>/gi, '');
          svgText = svgText.replace('<svg ', '<svg class="post-html-figure__svg" ');
          svgText = svgText.replace(/(<svg[^>]*>)/, '$1<rect width="100%" height="100%" class="post-html-figure__bg"/>');
          media = svgText;
        } catch {
          media = `<img src="${src}" alt="${safeTitle}" class="post-html-figure__img">`;
        }
      } else if (isImg) {
        media = `<img src="${src}" alt="${safeTitle}" class="post-html-figure__img">`;
      } else {
        media = `<iframe src="${src}" class="post-html-figure__frame" title="${safeTitle}" loading="lazy" scrolling="no"></iframe>`;
      }
      const fig = `<figure class="post-html-figure">` +
        media +
        `<figcaption class="post-html-figure__caption">${capHtml}</figcaption>` +
        `</figure>`;
      html = html.replace(`<p>@@HTMLFIG_${i}@@</p>`, fig).replace(`@@HTMLFIG_${i}@@`, fig);
    }

    // Replace [@key] citations in final HTML (after blocks are resolved)
    html = html.replace(/\[@([^\]]+)\]/g, (_, key) => {
      const ref = refs[key.trim()];
      if (ref) return `<a class="cite-inline" href="#ref-${key.trim()}">(${ref.inlineCite})</a>`;
      return `[@${key}]`;
    });

    return { bodyHtml: html, refsHtml };
  }

  function renderMath(container) {
    if (window.renderMathInElement) {
    renderMathInElement(container, {
      delimiters: [
        { left: '$$',   right: '$$',   display: true  },
        { left: '\\[',  right: '\\]',  display: true  },
        { left: '$',    right: '$',    display: false },
        { left: '\\(',  right: '\\)',  display: false },
        { left: '\\begin{equation}',  right: '\\end{equation}',  display: true },
        { left: '\\begin{equation*}', right: '\\end{equation*}', display: true },
        { left: '\\begin{align}',     right: '\\end{align}',     display: true },
        { left: '\\begin{align*}',    right: '\\end{align*}',    display: true },
        { left: '\\begin{gather}',    right: '\\end{gather}',    display: true },
        { left: '\\begin{gather*}',   right: '\\end{gather*}',   display: true },
        { left: '\\begin{multline}',  right: '\\end{multline}',  display: true },
        { left: '\\begin{multline*}', right: '\\end{multline*}', display: true }
      ],
      throwOnError: false
    });
    }
    let eqN = 0;
    container.querySelectorAll('.math-display.math-eq-numbered').forEach(div => {
      eqN++;
      const num = document.createElement('span');
      num.className = 'math-eq-number';
      num.textContent = `(${eqN})`;
      div.appendChild(num);
    });
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

  function slugifyHeading(text) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function setupPostTOC(container) {
    if (!container) return;

    const toc = container.querySelector('.post-toc');
    const body = container.querySelector('.post-page-body');
    if (!toc || !body) return;

    const headings = Array.from(body.querySelectorAll('h2, h3'));
    if (!headings.length) {
      toc.remove();
      return;
    }

    // Ensure headings have IDs
    const usedIds = new Set();
    headings.forEach((h, idx) => {
      let base = h.id || slugifyHeading(h.textContent) || `section-${idx + 1}`;
      let id = base;
      let n = 2;
      while (usedIds.has(id) || document.getElementById(id)) {
        id = `${base}-${n++}`;
      }
      h.id = id;
      usedIds.add(id);
    });

    const tocLabel = state.lang === 'it' ? 'Indice' : 'Index';

    toc.innerHTML = `
      <nav class="post-toc-nav" aria-label="${tocLabel}">
        ${headings.map(h => `
          <button
            class="post-toc-link post-toc-link--${h.tagName.toLowerCase()}"
            type="button"
            data-target="${h.id}"
          >
            ${h.textContent}
          </button>
        `).join('')}
      </nav>
    `;

    const links = Array.from(toc.querySelectorAll('.post-toc-link'));

    let tocClickLock = false;

    links.forEach((link) => {
      link.addEventListener('click', () => {
        const id = link.dataset.target;
        const target = document.getElementById(id);
        if (!target) return;

        tocClickLock = true;
        setActive(id);

        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });

        // Compensate the fixed topbar after scrollIntoView
        setTimeout(() => {
          window.scrollBy({
            top: -96,
            behavior: 'instant'
          });
        }, 40);

        // Release observer lock shortly after the jump
        setTimeout(() => {
          tocClickLock = false;
        }, 450);
      });
    });

    const setActive = (id) => {
      links.forEach(link => {
        link.classList.toggle('active', link.dataset.target === id);
      });
    };

    // Smooth-ish active section tracking
    const observer = new IntersectionObserver(
      (entries) => {
        if (tocClickLock) return;

        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length) {
          setActive(visible[0].target.id);
        }
      },
      {
        root: null,
        rootMargin: '-90px 0px -70% 0px',
        threshold: [0, 0.2, 0.6, 1]
      }
    );

    headings.forEach(h => observer.observe(h));

    // Fallback: mark first heading initially
    setActive(headings[0].id);
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
     Page meta helpers
  ========================================================== */
  function setPageMeta(title, description) {
    const siteName = 'Angelo Nardone';
    const fullTitle = title ? `${title} — ${siteName}` : siteName;
    document.title = fullTitle;
    const set = (sel, val) => { const el = document.querySelector(sel); if (el) el.setAttribute('content', val); };
    set('meta[name="description"]',        description || '');
    set('meta[property="og:title"]',       fullTitle);
    set('meta[property="og:description"]', description || '');
    set('meta[property="og:url"]',         location.href);
    set('meta[name="twitter:title"]',      fullTitle);
    set('meta[name="twitter:description"]',description || '');
    const ldArticle = document.getElementById('ld-article');
    if (ldArticle) ldArticle.remove();
  }

  function setArticleJsonLd(p) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'ld-article';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      'headline': p.title || '',
      'description': p.abstract || '',
      'datePublished': p.date || '',
      'author': { '@type': 'Person', 'name': 'Angelo Nardone', 'url': 'https://angelido.github.io/' },
      'url': location.href
    });
    document.head.appendChild(script);
  }

  /* =========================================================
     Views
  ========================================================== */
  function renderAcademicHome() {
    const { profile } = state.data;
    const app = $('#app');
    setPageMeta(null, state.lang === 'it'
      ? 'Dottorando in Informatica all\'Università di Pisa. Compressione lossless, algoritmi su stringhe e Large Language Models.'
      : 'PhD Student in Computer Science at the University of Pisa. Lossless compression, string algorithms and Large Language Models.');

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
            <a class="home-latest-card" href="/posts/${encodeURIComponent(latest.id)}" aria-label="${latest.title || ''}">
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
    setPageMeta(
      state.lang === 'it' ? 'Chi sono' : 'About me',
      state.lang === 'it'
        ? 'Informazioni su Angelo Nardone: formazione, interessi di ricerca e contatti.'
        : 'About Angelo Nardone: background, research interests and contact information.'
    );

    const pageTitle = state.i18n?.aboutPage?.title || 'About me';
    const intro = state.i18n?.aboutPage?.intro || '';

    // Load markdown (language-specific)
    const mdPath = `data/about_me.${state.lang}.md`;

    let bodyHtml = '';
    try {
      const md = await fetch(mdPath).then(r => r.text());
      bodyHtml = (await renderMarkdown(md)).bodyHtml;
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
    renderMath($('.section.aboutme', app));
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
    setPageMeta(
      state.lang === 'it' ? 'Post' : 'Posts',
      state.lang === 'it'
        ? 'Note tecniche, resoconti di conferenze e articoli di divulgazione sulla compressione dati e gli algoritmi.'
        : 'Technical notes, conference reports and explainers on data compression and algorithms.'
    );

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

      <section class="section posts-section">
        <div class="posts-list-header">
          <div class="posts-list-header-row">
            <span class="posts-count" id="postsCount"></span>
            <div class="posts-filter">
              <button class="filter-toggle" id="filterToggle" aria-expanded="false">
                <svg class="filter-toggle-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true" width="13" height="13">
                  <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                  <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                  <line x1="6" y1="12" x2="10" y2="12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
                <span class="filter-toggle-text">${filterLabel}</span>
                <span class="filter-toggle-sep">·</span>
                <span class="filter-toggle-value" id="filterValue">${allTagsLabel}</span>
                <svg class="filter-toggle-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true" width="12" height="12">
                  <polyline points="4,6 8,10 12,6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="tag-chips" id="tagChips">
            <button class="tag-chip tag-chip--active" data-tag="">${allTagsLabel}</button>
            ${allTags.map(t => `<button class="tag-chip" data-tag="${t}">${t}</button>`).join('')}
          </div>
        </div>
        <div id="postsList"></div>
      </section>

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

            const href = `/posts/${encodeURIComponent(p.id)}`;

            return `
              <article class="post-flat-item${isLast ? ' post-flat-item--last' : ''}${p.image ? ' post-flat-item--hasimg' : ''}"
                       role="link"
                       tabindex="0"
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

      const countEl = $('#postsCount');
      if (countEl) countEl.textContent = `${total} ${total === 1 ? 'post' : 'posts'}`;

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

    const activeTags = new Set();

    const applyFilter = () => {
      currentItems = activeTags.size === 0
        ? posts
        : posts.filter(p => (p.tags || []).some(t => activeTags.has(String(t))));
      currentPage = 1;
      renderPage(currentItems, currentPage, readingMinutes);
    };

    const filterToggleEl = $('#filterToggle');
    const tagChipsEl = $('#tagChips');
    const filterValueEl = $('#filterValue');

    const updateToggleLabel = () => {
      if (activeTags.size === 0) {
        filterValueEl.textContent = allTagsLabel;
      } else if (activeTags.size === 1) {
        filterValueEl.textContent = [...activeTags][0];
      } else {
        filterValueEl.textContent = `${activeTags.size} tags`;
      }
    };

    filterToggleEl.addEventListener('click', () => {
      const isOpen = tagChipsEl.classList.contains('is-open');
      tagChipsEl.classList.toggle('is-open', !isOpen);
      filterToggleEl.setAttribute('aria-expanded', String(!isOpen));
    });

    tagChipsEl.addEventListener('click', e => {
      const chip = e.target.closest('.tag-chip');
      if (!chip) return;
      const tag = chip.dataset.tag || '';

      if (tag === '') {
        activeTags.clear();
        $$('.tag-chip', tagChipsEl).forEach(c => c.classList.toggle('tag-chip--active', c.dataset.tag === ''));
        tagChipsEl.classList.remove('is-open');
        filterToggleEl.setAttribute('aria-expanded', 'false');
      } else {
        if (activeTags.has(tag)) {
          activeTags.delete(tag);
        } else {
          activeTags.add(tag);
        }
        const allChip = tagChipsEl.querySelector('[data-tag=""]');
        if (allChip) allChip.classList.toggle('tag-chip--active', activeTags.size === 0);
        chip.classList.toggle('tag-chip--active', activeTags.has(tag));
      }

      updateToggleLabel();
      applyFilter();
    });

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

    setPageMeta(p.title, p.abstract || '');
    setArticleJsonLd(p);

    const dateStr = formatPostDate(p.date);
    const tags = Array.isArray(p.tags) ? p.tags : [];

    let bodyHtml = '';
    let mdText = '';
    let refsHtml = '';

    const mdPath = p.contentPath || p.content;

    if (mdPath && /\.md$/i.test(mdPath)) {
      mdText = await fetch(mdPath).then(r => r.text());
      ({ bodyHtml, refsHtml } = await renderMarkdown(mdText));

    } else {
      const paragraphs = splitParagraphs(String(p.content || ''));
      bodyHtml = paragraphs.map((pp) => `<p>${renderParagraphHTML(pp)}</p>`).join('');
    }

    const isMarkdown = !!(mdPath && /\.md$/i.test(mdPath));
    const showTOC = !!p.showToc;
    const isPrintable = !!p.printable;

    // Minuti di lettura (stessa logica della lista, nessun fetch aggiuntivo)
    const words = mdText.trim().split(/\s+/).filter(Boolean).length;
    const readMins = mdText ? Math.max(1, Math.round(words / 200)) + 1 : 1;
    const minReadLabel = state.lang === 'it' ? 'min di lettura' : 'min read';

    const authorName = (state.data.profile || {}).name || '';
    const printLabel = state.lang === 'it' ? 'Stampa / PDF' : 'Print / PDF';
    const keywordsLabel = state.lang === 'it' ? 'Parole chiave' : 'Keywords';

    // Related posts
    const relatedIds = Array.isArray(p.related) ? p.related : [];
    const relatedPosts = relatedIds.map(id => posts.find(x => String(x.id) === String(id))).filter(Boolean);
    const seeAlsoLabel = state.lang === 'it' ? 'Vedi anche' : 'See also';
    const relatedHTML = relatedPosts.length ? `
      <div class="post-related">
        <div class="post-related-label">${seeAlsoLabel}</div>
        <div class="post-related-list">
          ${relatedPosts.map(rp => {
            const rDate = formatPostDate(rp.date);
            return `
              <a class="post-related-item" href="/posts/${encodeURIComponent(rp.id)}">
                <div class="post-related-content">
                  <div class="post-related-title">${rp.title || ''}</div>
                  ${rp.abstract ? `<div class="post-related-abstract">${rp.abstract}</div>` : ''}
                  ${rDate ? `<div class="post-related-meta">${rDate}</div>` : ''}
                </div>
              </a>
            `;
          }).join('<div class="post-related-sep"></div>')}
        </div>
      </div>
    ` : '';

    app.innerHTML = `
    <section class="section post-shell">
      ${showTOC ? `<aside class="post-toc" aria-hidden="false"></aside>` : ``}

      <div class="post-page">

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

        ${refsHtml}

        ${relatedHTML}

        <div class="post-page-footer">
          <a href="/posts" class="post-back-link">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="14" height="14">
              <line x1="13" y1="8" x2="3" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <polyline points="7,4 3,8 7,12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ${state.lang === 'it' ? 'Torna ai post' : 'Back to posts'}
          </a>
          ${isPrintable ? `
          <button class="post-print-btn" id="postPrintBtn" aria-label="${printLabel}">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="15" height="15">
              <rect x="3" y="1" width="10" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/>
              <rect x="3" y="9" width="10" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/>
              <path d="M3 7h10M1 5h14v6a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5z" stroke="currentColor" stroke-width="1.4"/>
              <circle cx="12" cy="8" r=".8" fill="currentColor"/>
            </svg>
            ${printLabel}
          </button>
          ` : ''}

       </div>
      </section>    
    `;
    renderMath($('.post-page-body', app));
    if (showTOC) {
      setupPostTOC(app);
    }
    if (isPrintable) {
      const printBtn = app.querySelector('#postPrintBtn');
      if (printBtn) {
        printBtn.addEventListener('click', () => {
          openPrintWindow({ p, dateStr, readMins, minReadLabel, authorName, keywordsLabel, tags, app });
        });
      }
    }
  }

  function openPrintWindow({ p, dateStr, readMins, minReadLabel, authorName, keywordsLabel, tags, app }) {
    const bodyEl = app.querySelector('.post-page-body');
    const refsEl = app.querySelector('.post-references');
    if (!bodyEl) return;

    const bodyHtml = bodyEl.innerHTML;
    const refsHtml = refsEl ? refsEl.outerHTML : '';

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Popup bloccato. Abilita i popup per questa pagina e riprova.'); return; }

    const noticeText = document.documentElement.lang === 'it'
      ? '⚠️ Nel dialogo di stampa, vai su <b>Altre impostazioni</b> e disattiva <b>Intestazioni e piè di pagina</b>. Il numero di pagina è già incluso nel foglio.'
      : '⚠️ In the print dialog, open <b>More settings</b> and uncheck <b>Headers and footers</b>. Page numbers are already included in the sheet.';
    const printNowText = document.documentElement.lang === 'it' ? 'Stampa' : 'Print';

    win.document.write(`<!DOCTYPE html>
<html lang="${document.documentElement.lang || 'en'}">
<head>
<meta charset="utf-8">
<title>${p.title || ''}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=STIX+Two+Text:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
<style>
*, *::before, *::after { box-sizing: border-box; }

@page {
  margin: 2cm 2.5cm;
  size: A4;
  @top-left    { content: ''; }
  @top-center  { content: ''; }
  @top-right   { content: ''; }
  @bottom-left { content: ''; }
  @bottom-right{ content: ''; }
  @bottom-center {
    content: counter(page);
    font-family: 'STIX Two Text', Georgia, serif;
    font-size: 9pt;
    color: #666;
  }
}

html, body {
  font-family: 'STIX Two Text', Georgia, serif;
  font-size: 10pt;
  line-height: 1.35;
  color: #000;
  background: #fff;
  margin: 0;
  padding: 0;
  text-rendering: optimizeLegibility;
  font-feature-settings: 'liga' 1, 'kern' 1;
}

/* ── Screen-only notice ── */
@media screen {
  .notice {
    font-family: system-ui, sans-serif;
    font-size: 13px;
    background: #fff8e1;
    border: 1px solid #f0c040;
    border-radius: 6px;
    padding: .7rem 1rem;
    margin: 1.2rem 2rem .5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .notice-print-btn {
    font-family: system-ui, sans-serif;
    font-size: 13px;
    padding: .35rem .9rem;
    border: 1px solid #aaa;
    border-radius: 5px;
    background: #fff;
    cursor: pointer;
    white-space: nowrap;
  }
  .notice-print-btn:hover { background: #f5f5f5; }
  .content { padding: 1.5rem 2rem 2rem; }
}
@media print {
  .notice { display: none; }
  .content { padding: 0; }
}

/* ── Paper header ── */
.ph { text-align: center; margin-bottom: 2rem; }
.ph-title { font-size: 17pt; font-weight: 700; line-height: 1.25; margin: 0 0 .4rem; }
.ph-author { font-size: 11pt; margin: 0 0 .15rem; }
.ph-meta { font-size: 9.5pt; color: #444; margin: 0 0 .15rem; }
.ph-keywords { font-size: 9pt; color: #444; margin: 0 0 .6rem; font-style: italic; }
.ph-rule { border: none; border-top: 1px solid #bbb; width: 50%; margin: 0 auto; display: block; }

/* ── Body ── */
.body { font-size: 10pt; line-height: 1.35; text-align: justify; }

p { margin: 0 0 .6em; orphans: 3; widows: 3; }

h2 { font-size: 13pt; font-weight: 700; margin: 1.6em 0 .35em; page-break-after: avoid; }
h3 { font-size: 11pt; font-weight: 700; margin: 1.2em 0 .3em; page-break-after: avoid; }
h4 { font-size: 10pt; font-weight: 700; margin: 1em 0 .25em; page-break-after: avoid; }

/* ── Horizontal rules: hidden ── */
hr { display: none; }
.ph-rule { display: block; }

/* ── Links ── */
a { color: #000; text-decoration: none; }
a[href]::after { content: ' (' attr(href) ')'; font-size: 7.5pt; color: #555; word-break: break-all; }
.cite-inline::after,
.inline-link.cite-inline::after { content: none !important; }
.inline-link { text-decoration: underline; }

/* ── Theorem blocks ── */
.theorem-block { margin: .9em 0; }
.theorem-label { font-style: normal; font-weight: 700; font-size: 10pt; }
.theorem-block--theorem .theorem-label { color: #7a1a10; }
.theorem-block--definition .theorem-label { color: #0d3a5e; }
.theorem-block--example .theorem-label { color: #5a3a10; }
.theorem-block--remark .theorem-label { color: #3a1a6e; }
.theorem-block--theorem p, .theorem-block--theorem li,
.theorem-block--definition p, .theorem-block--definition li { font-style: italic; }
.theorem-block--theorem code, .theorem-block--theorem .katex,
.theorem-block--definition code, .theorem-block--definition .katex { font-style: normal; }
.theorem-qed { float: right; }

/* ── Blockquote ── */
blockquote { border-left: 2px solid #999; margin: .9em 1.5em; padding: 0 0 0 .9em; color: #222; font-style: italic; }
blockquote p { margin: 0; }
blockquote p + p { font-style: normal; font-size: 9pt; text-align: right; margin-top: .3em; }

/* ── Code blocks ── */
.code-block {
  background: #f5f5f5 !important;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: .45em .7em;
  margin: .7em 0;
  page-break-inside: avoid;
  overflow: hidden;
}
.code-block-copy, .code-block-lang-badge { display: none !important; }
.code-block pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
.code-block pre, .code-block code, .code-block span {
  font-family: 'Courier New', monospace !important;
  font-size: 8pt !important;
  background: transparent !important;
  color: #000 !important;
}

/* ── Tables ── */
table { border-collapse: collapse; width: 100%; margin: .8em 0; font-size: 9.5pt; page-break-inside: avoid; }
th, td { border: 1px solid #bbb; padding: .3em .6em; text-align: left; }
th { font-weight: 700; background: #f0f0f0; }
tr:nth-child(even) td { background: #fafafa; }

/* ── Math ── */
.math-display { text-align: center; margin: .9em 0; }
.katex-display { margin: 0 !important; }
.katex, .katex * { color: #000 !important; }

/* ── Lists ── */
ul, ol { margin: 0 0 .6em; padding-left: 1.6em; }
li { margin-bottom: .15em; }

/* ── References ── */
.post-references { margin-top: 1.8em; border-top: 1px solid #bbb; padding-top: .9em; }
.post-references-label { font-size: 12pt; font-weight: 700; margin-bottom: .4em; display: block; }
.post-ref-item { font-size: 9pt; margin-bottom: .3em; }

/* ── Figures ── */
.post-html-figure { margin: 1em 0; text-align: center; page-break-inside: avoid; }
.post-html-figure__img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
.post-html-figure__svg { width: 100%; height: auto; display: block; filter: none; }
.post-html-figure__bg { fill: transparent; }
.post-html-figure__frame { display: none !important; }
.post-html-figure:has(.post-html-figure__frame)::before {
  content: '[Figura interattiva — disponibile nella versione online]';
  display: block;
  font-style: italic;
  font-size: 9pt;
  color: #666;
  border: 1px dashed #ccc;
  padding: .35em .6em;
  border-radius: 3px;
  margin-bottom: .3em;
}
.post-html-figure__caption { font-size: 9pt; color: #444; margin-top: .4em; line-height: 1.4; }
</style>
</head>
<body>
<div class="notice">
  <span>${noticeText}</span>
  <button class="notice-print-btn" onclick="window.print()">${printNowText}</button>
</div>
<div class="content">
  <div class="ph">
    <p class="ph-title">${p.title || ''}</p>
    ${authorName ? `<p class="ph-author">${authorName}</p>` : ''}
    <p class="ph-meta">${[dateStr, readMins + ' ' + minReadLabel].filter(Boolean).join(' &middot; ')}</p>
    ${tags.length ? `<p class="ph-keywords">${keywordsLabel}: ${tags.join(', ')}</p>` : ''}
    <hr class="ph-rule">
  </div>
  <div class="body">${bodyHtml}</div>
  ${refsHtml}
</div>
</body>
</html>`);
    win.document.close();
  }

  function renderResearch() {
    const app = $('#app');
    setPageMeta(
      state.lang === 'it' ? 'Ricerca' : 'Research',
      state.lang === 'it'
        ? 'Pubblicazioni, talk, scuole estive e progetti di ricerca di Angelo Nardone.'
        : 'Publications, talks, summer schools and research projects by Angelo Nardone.'
    );

    const pubs = (state.data.publications || []).slice().sort((a, b) => (b.year || 0) - (a.year || 0));
    const topics = state.data.topics || [];
    const talks = state.data.talks || [];
    const projects = state.data.projects || [];
    const schools = state.data.schools || [];

    const pageTitle = state.i18n?.research?.title || 'Research';
    const intro = state.i18n?.research?.intro || '';

    const sec = state.i18n?.research?.sections || {};
    const pubsTitle = sec.publications || 'Publications';
    const talksTitle = sec.talks || 'Talks';
    const projectsTitle = sec.projects || 'Projects';
    const topicsTitle = sec.topics || 'Research topics';
    const schoolsTitle = sec.schools || 'Schools';

    const searchPH = state.i18n?.publications?.searchPlaceholder || '';
    const allYears = state.i18n?.publications?.allYears || '';

    const talksEmpty = state.i18n?.talks?.noItems || '';
    const projEmpty = state.i18n?.projects?.noItems || '';
    const viewOnGitHub = state.i18n?.projects?.viewOnGitHub || 'View';
    const schoolsEmpty = state.i18n?.schools?.noItems || '';
    const schoolLabels = state.lang === 'it'
      ? { directors: 'Direttori', speakers: 'Speaker Principali', guests: 'Ospiti', page: 'Pagina scuola' }
      : { directors: 'Directors', speakers: 'Main Speakers',      guests: 'Guests',  page: 'School page' };

    const personLink = (p) =>
      p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${p.name}</a>` : p.name;

    const peopleRow = (label, arr) =>
      arr && arr.length
        ? `<div class="pub-meta mt-sm"><strong>${label}:</strong> ${arr.map(personLink).join(' · ')}</div>`
        : '';

    const years = Array.from(new Set(pubs.map((p) => p.year).filter(Boolean)))
      .sort((a, b) => b - a);

    app.innerHTML = `
      ${pageHeaderHTML(pageTitle, intro)}

      <section class="section">
        <details class="research-section research-section--pubs" open>
          <summary>${pubsTitle} <span class="section-toggle" aria-hidden="true"></span></summary>
          <div id="pubList" class="list"></div>
        </details>

        <details class="research-section research-section--talks">
          <summary>${talksTitle} <span class="section-toggle" aria-hidden="true"></span></summary>

            <div id="talkList">
              ${
                talks.length
                  ? `<ul class="research-list">
                    ${talks.map((t) => {
                      const labels = state.lang === 'it'
                        ? { event: 'Evento', poster: 'Locandina', talk: 'Talk', subtitle: 'Sottotitolo', roleTypeSep: ' • ' }
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
                          ${roleTypeLine ? `<div class="pub-meta mt-xs">${roleTypeLine}</div>` : ''}

                          <!-- 6) Talk title -->
                          ${t.talkTitle ? `<div class="mt-lg"><strong>${labels.talk}:</strong> ${t.talkTitle}</div>` : ''}

                          <!-- 7) Subtitle con label -->
                          ${t.subtitle ? `<div class="pub-meta"><strong>${labels.subtitle}:</strong> ${t.subtitle}</div>` : ''}

                          <!-- Links -->
                          ${(t.link || t.poster) ? `
                            <div class="row mt-lg">
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
        </details>

        <details class="research-section research-section--schools">
          <summary>${schoolsTitle} <span class="section-toggle" aria-hidden="true"></span></summary>
          <div id="schoolList">
            ${
              schools.length
                ? `<ul class="research-list">
                    ${schools.map((s) => {
                      const schoolTopics = Array.isArray(s.topics) ? s.topics : [];
                      return `
                        <li>
                          <div>
                            <strong>${s.name}</strong>
                          </div>

                          ${s.subtitle ? `<div class="pub-meta"><em>${s.subtitle}</em></div>` : ''}

                          ${s.location ? `<div class="pub-meta">${s.location}</div>` : ''}

                          ${s.dates ? `<div class="pub-meta">${s.dates}</div>` : ''}

                          ${(s.role || s.type) ? `<div class="pub-meta mt-xs">${[s.role, s.type].filter(Boolean).join(' · ')}</div>` : ''}

                          ${s.description ? `
                            <div class="pub-meta mt-sm">
                              <strong>${state.lang === 'it' ? 'Descrizione' : 'Description'}:</strong> ${s.description}
                            </div>
                          ` : ''}

                          ${peopleRow(schoolLabels.directors, s.directors)}
                          ${peopleRow(schoolLabels.speakers,  s.speakers)}
                          ${peopleRow(schoolLabels.guests,    s.guests)}

                          ${schoolTopics.length ? `
                            <div class="pub-meta mt-md">
                              <strong>${state.lang === 'it' ? 'Temi' : 'Topics'}:</strong>
                            </div>
                            <div class="tags mt-sm">
                              ${schoolTopics.map((t) => `<span class="tag">${t}</span>`).join('')}
                            </div>
                          ` : ''}

                          ${s.url ? `
                            <div class="row mt-lg">
                              <a class="btn btn-outline" href="${s.url}" target="_blank" rel="noopener">${schoolLabels.page}</a>
                            </div>
                          ` : ''}
                        </li>
                      `;
                    }).join('')}
                  </ul>`
                : `<p class="pub-meta">${schoolsEmpty}</p>`
            }
          </div>
        </details>

        <details class="research-section research-section--projects">
          <summary>${projectsTitle} <span class="section-toggle" aria-hidden="true"></span></summary>
          <div id="projectList">
            ${
              projects.length
                ? `<ul class="research-list">
                    ${projects.map((p) => {
                      const labels = state.lang === 'it'
                        ? { desc: 'Descrizione', repo: 'Repository', topics: 'Temi', langs: 'Linguaggi' }
                        : { desc: 'Description', repo: 'Code Repository', topics: 'Topics', langs: 'Languages' };

                      const topics = Array.isArray(p.topics) ? p.topics : [];
                      const langs  = Array.isArray(p.languages) ? p.languages : [];

                      return `
                        <li>
                          <div><strong>${p.title || ''}</strong></div>

                          ${p.description ? `
                            <div class="pub-meta mt-sm">
                                <strong>${labels.desc}:</strong> ${renderInlineMD(p.description)}
                            </div>
                          ` : ''}

                          ${p.repo ? `
                            <div class="pub-meta mt-sm">
                              <strong>${labels.repo}:</strong>
                              <a href="${p.repo}" target="_blank" rel="noopener">GitHub link</a>
                            </div>
                          ` : ''}
                          ${topics.length ? `
                            <div class="pub-meta mt-md">
                              <strong>${labels.topics}:</strong>
                            </div>
                            <div class="tags mt-sm">
                              ${topics.map((t) => `<span class="tag">${t}</span>`).join('')}
                            </div>
                          ` : ''}

                          ${langs.length ? `
                            <div class="pub-meta mt-lg">
                              <strong>${labels.langs}:</strong>
                            </div>
                            <div class="tags mt-sm">
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
        </details>

        <details class="research-section research-section--topics" open>
          <summary>${topicsTitle} <span class="section-toggle" aria-hidden="true"></span></summary>
          <div class="tags">
            ${topics.map((t) => `<span class="tag">${t}</span>`).join('')}
          </div>
        </details>
      </section>
    `;

    // --- Publications render + filter ---
    const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const formatAuthors = (str) => {
      if (!str) return '';
      const authors = str.split(', ').map((name) => {
        const tokens = name.trim().split(' ');
        if (tokens.length < 2) return name;
        const last     = tokens[tokens.length - 1];
        const initials = tokens.slice(0, -1).map((t) => t[0] + '.').join(' ');
        const abbr     = `${initials} ${last}`;
        return abbr === 'A. Nardone'
          ? `<strong>${abbr}</strong>`
          : abbr;
      });
      if (authors.length === 1) return authors[0];
      if (authors.length === 2) return authors.join(' and ');
      return authors.slice(0, -1).join(', ') + ', and ' + authors[authors.length - 1];
    };

    const peerReviewedStatuses = new Set(['to appear', 'published', 'in pubblicazione']);
    const reviewBadge = (status) => {
      if (!status) return '';
      return peerReviewedStatuses.has(status.toLowerCase())
        ? `<span class="pub-review-badge pub-review-badge--peer">● Peer-reviewed</span>`
        : `<span class="pub-review-badge pub-review-badge--preprint">● Preprint</span>`;
    };

    const renderPubs = (items) => {
      const isIt = state.lang === 'it';
      const topicsLabel = isIt ? 'Temi' : 'Topics';

      $('#pubList').innerHTML = items.length
        ? `<ul class="research-list">
            ${items.map((p) => {
              const venueFull    = [p.venue, p.venueShort ? `(${p.venueShort})` : null].filter(Boolean).join(' ');
              const locationDate = [[p.city, p.country].filter(Boolean).join(', '), p.date].filter(Boolean).join(' · ');
              const badge        = [p.year, p.badge].filter(Boolean).join(' · ');
              const authorsHtml  = formatAuthors(p.authors);
              const topics       = Array.isArray(p.topics) ? p.topics : [];
              const links        = Array.isArray(p.links) ? p.links.filter((l) => l.url) : [];

              return `
                <li>
                  <details class="pub-details">
                    <summary>
                      <div class="pub-summary-body">
                        <div><strong>${p.title}</strong></div>
                        ${authorsHtml ? `<div class="pub-meta">${authorsHtml}</div>` : ''}
                        ${p.status    ? `<div class="pub-meta">${reviewBadge(p.status)}</div>` : ''}
                        ${venueFull   ? `<div class="pub-meta pub-meta--venue">${p.venueLink ? `<a class="inline-link" href="${p.venueLink}" target="_blank" rel="noopener">${venueFull}</a>` : venueFull}</div>` : ''}
                        ${badge       ? `<div class="pub-meta">${badge}</div>` : ''}
                      </div>
                      <span class="pub-toggle" aria-hidden="true"></span>
                    </summary>
                    <div class="pub-expanded">
                      ${locationDate ? `<div class="pub-meta mt-xs">${locationDate}</div>` : ''}
                      ${p.publisher ? `<div class="pub-meta">${p.publisher}</div>` : ''}

                      ${p.abstract ? `
                        <div class="pub-meta mt-sm">
                          <strong>Abstract:</strong> ${p.abstract}
                        </div>
                      ` : ''}

                      ${p.bibtex ? `
                        <details class="bibtex-details mt-lg">
                          <summary class="pub-meta"><strong>BibTeX</strong> <span class="bibtex-caret" aria-hidden="true"></span></summary>
                          <div class="code-block bibtex-code-block">
                            <span class="code-block-lang-badge">bibtex</span>
                            <button class="code-block-copy" type="button" aria-label="Copy BibTeX">
                              <svg class="copy-icon copy-icon--default" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <rect x="4" y="4" width="9" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
                                <path d="M3 10.5H2.5A1.5 1.5 0 0 1 1 9V2.5A1.5 1.5 0 0 1 2.5 1H9A1.5 1.5 0 0 1 10.5 2.5V3" stroke="currentColor" stroke-width="1.4"/>
                              </svg>
                              <svg class="copy-icon copy-icon--check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <polyline points="2,8 6,12 14,4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                              </svg>
                              <span class="copy-label">Copy</span>
                            </button>
                            <pre><code>${escHtml(p.bibtex)}</code></pre>
                          </div>
                        </details>
                      ` : ''}

                      ${topics.length ? `
                        <div class="pub-meta mt-lg"><strong>${topicsLabel}:</strong></div>
                        <div class="tags mt-sm">
                          ${topics.map((t) => `<span class="tag">${t}</span>`).join('')}
                        </div>
                      ` : ''}
                    </div>
                  </details>

                  ${links.length ? `
                    <div class="row mt-sm">
                      ${links.map((l) => `<a class="btn btn-outline" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`).join('')}
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
          (p.title      || '').toLowerCase().includes(q) ||
          (p.authors    || '').toLowerCase().includes(q) ||
          (p.venue      || '').toLowerCase().includes(q) ||
          (p.venueShort || '').toLowerCase().includes(q)
        )
      );

      renderPubs(res);
    };

    renderPubs(pubs);
  }

  /* =========================================================
     Academic Map
  ========================================================== */
  function renderMap() {
    const app = $('#app');
    const places = state.data.places || [];

    const isIt = state.lang === 'it';
    const pageTitle  = isIt ? 'Mappa accademica' : 'Academic Map';
    const pageIntro  = isIt
      ? 'Luoghi che hanno fatto parte del mio percorso accademico.'
      : 'Places that have shaped my academic journey.';
    setPageMeta(pageTitle, pageIntro);

    const typeLabels = {
      conference: isIt ? 'Conferenza'    : 'Conference',
      school:     isIt ? 'Scuola estiva' : 'Summer School',
      workshop:   isIt ? 'Workshop'      : 'Workshop',
      office:     isIt ? 'Sede di lavoro': 'Workplace',
    };

    const typeColors = {
      conference: '#b85020',
      school:     '#2563eb',
      workshop:   '#7c3aed',
      office:     '#059669',
    };

    app.innerHTML = `
      ${pageHeaderHTML(pageTitle, pageIntro)}
      <section class="section">
        <div id="academic-map"></div>
        <div class="map-legend">
          ${Object.entries(typeLabels).map(([type, label]) => `
            <span class="map-legend-item">
              <span class="map-legend-dot" style="background:${typeColors[type]}"></span>
              ${label}
            </span>
          `).join('')}
        </div>
      </section>
    `;

    requestAnimationFrame(() => {
      const container = document.getElementById('academic-map');
      if (!container || typeof L === 'undefined') return;

      const map = L.map(container, { zoomControl: true }).setView([45, 8], 5);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      const makeIcon = (type) => {
        const c = typeColors[type] || '#6b7280';
        return L.divIcon({
          className: '',
          html: `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 0C5.82 0 0 5.82 0 13C0 22.75 13 34 13 34C13 34 26 22.75 26 13C26 5.82 20.18 0 13 0Z"
                  fill="${c}" stroke="rgba(255,255,255,.75)" stroke-width="1.5"/>
            <circle cx="13" cy="12.5" r="5" fill="white" opacity="0.55"/>
          </svg>`,
          iconSize:    [26, 34],
          iconAnchor:  [13, 34],
          popupAnchor: [0, -36],
        });
      };

      places.forEach((place) => {
        const dominantType = place.events?.[0]?.type || 'office';
        const icon = makeIcon(dominantType);

        const eventsHtml = (place.events || []).map((ev) => `
          <li class="map-popup-event">
            <span class="map-popup-badge" style="--badge-color:${typeColors[ev.type] || '#6b7280'}">
              ${typeLabels[ev.type] || ev.type}
            </span>
            <div class="map-popup-title">${ev.title}</div>
            ${ev.role       ? `<div class="map-popup-meta">${ev.role}${ev.institution ? ' &middot; ' + ev.institution : ''}</div>` : ''}
            ${!ev.role && ev.institution ? `<div class="map-popup-meta">${ev.institution}</div>` : ''}
            ${ev.note       ? `<div class="map-popup-note">${ev.note}</div>` : ''}
            <div class="map-popup-date">${ev.date}</div>
          </li>
        `).join('');

        const popup = `
          <div class="map-popup">
            <div class="map-popup-city">${place.city}<span class="map-popup-country">, ${place.country}</span></div>
            <ul class="map-popup-events">${eventsHtml}</ul>
          </div>
        `;

        L.marker([place.lat, place.lng], { icon })
          .addTo(map)
          .bindPopup(popup, { maxWidth: 290, className: 'academic-popup' });
      });
    });
  }

  function renderCV() {
    const app = $('#app');
    setPageMeta(
      'Curriculum Vitae',
      state.lang === 'it' ? 'Curriculum vitae di Angelo Nardone.' : 'Curriculum vitae of Angelo Nardone.'
    );

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
      ? `Il contenuto principale è già nelle sezioni <a class="inline-link" href="/research">Ricerca</a> e <a class="inline-link" href="/experience">Formazione &amp; Esperienza</a>.`
      : `Most of the content is already in <a class="inline-link" href="/research">Research</a> and <a class="inline-link" href="/experience">Education &amp; Experience</a>.`;

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
    setPageMeta('Publications', 'Full list of academic publications by Angelo Nardone.');
    const app = $('#app');
    const pubs = state.data.publications.slice().sort((a, b) => (b.year || 0) - (a.year || 0));

    app.innerHTML = `
      <section class="section">
        <div class="row space-between">
          <h1 data-i18n="section.publications">Pubblicazioni</h1>
          <a class="btn btn-outline" href="/research">← <span data-i18n="action.back">Indietro</span></a>
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
        .map((p) => {
          const links = Array.isArray(p.links) ? p.links.filter((l) => l.url) : [];
          return `
            <article class="pub-card">
              <h3>${p.title}</h3>
              <div class="pub-meta">${p.authors || ''}</div>
              <div class="pub-meta">${[p.venueShort || p.venue, p.year].filter(Boolean).join(' · ')}</div>
              ${links.length ? `
                <div class="row">
                  ${links.map((l) => `<a class="btn btn-outline" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`).join('')}
                </div>
              ` : ''}
            </article>
          `;
        })
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
    setPageMeta(pageTitle, state.lang === 'it'
      ? 'Formazione accademica ed esperienze professionali di Angelo Nardone.'
      : 'Academic background and professional experience of Angelo Nardone.');

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

    const itemRow = (x) => {
      const fromYear = String(x.from || '').slice(0, 4);
      const toYear   = x.to ? String(x.to).slice(0, 4) : ongoingLabel;
      const yearDisplay = fromYear
        ? (fromYear === toYear ? fromYear : `${fromYear}–${toYear}`)
        : '';

      return `
      <li class="tl-item">
        <div class="tl-year">${yearDisplay}</div>
        <div class="tl-body">
          <h3>${x.title}</h3>

          ${(x.company || x.institution)
            ? `<div class="pub-meta">${x.company || x.institution}</div>`
            : ''}

          ${x.city
            ? `<div class="pub-meta">${x.city}</div>`
            : ''}

          ${x.finalGrade
            ? `<div class="pub-meta"><strong>${x.finalGrade}</strong></div>`
            : ''}

          ${x.topic ? `
          <div class="edu-line">
            <span class="edu-label">${state.lang === 'it' ? 'Tema:' : 'Topic:'}</span>
            <span class="edu-value"><em>${x.topic}</em></span>
          </div>
          ` : ''}

          ${x.description ? `
            <div class="edu-description">
              <span class="edu-label">${state.lang === 'it' ? 'Descrizione:' : 'Description:'}</span>
              <span class="edu-desc-text">${renderInlineMD(x.description)}</span>
            </div>
          ` : ''}

          ${x.thesis ? `
            <div class="edu-line">
              <span class="edu-label">${thesisLabel}</span>
              <span class="edu-value"><em>${x.thesis}</em></span>
            </div>
          ` : ''}

          ${x.supervisor ? `
            <div class="edu-line">
              <span class="edu-label">${supervisorLabel}</span>
              <span class="edu-value">${renderInlineMD(x.supervisor)}</span>
            </div>
          ` : ''}

          ${x.opponent ? `
            <div class="edu-line">
              <span class="edu-label">${opponentLabel}</span>
              <span class="edu-value">${renderInlineMD(x.opponent)}</span>
            </div>
          ` : ''}

          ${x.specialization?.length ? `
            <div class="edu-spec">
              <span class="edu-label">${specLabel}</span>
              <span class="edu-spec-text"><em>${x.specialization.join(' · ')}</em></span>
            </div>
          ` : ''}
        </div>
      </li>
    `;
    };
    
    const intro = state.i18n?.experiencePage?.intro || '';

    app.innerHTML = `
      ${pageHeaderHTML(pageTitle, intro)}

      <section class="section">
        <div class="expedu-split">
          <details class="expedu-panel">
            <summary class="expedu-panel-head">
              <h2>${eduTitle}</h2>
              <span class="section-toggle" aria-hidden="true"></span>
            </summary>
            <ol class="timeline expedu-timeline">
              ${eduItems.map(itemRow).join('')}
            </ol>
          </details>

          <details class="expedu-panel">
            <summary class="expedu-panel-head">
              <h2>${expTitle}</h2>
              <span class="section-toggle" aria-hidden="true"></span>
            </summary>
            <ol class="timeline expedu-timeline">
              ${expItems.map(itemRow).join('')}
            </ol>
          </details>
        </div>
      </section>
    `;
  }

  async function renderPrivacy() {
    const app = $('#app');
    setPageMeta('Privacy Policy', '');

    // Load markdown (language-specific)
    const mdPath = `data/privacy.${state.lang}.md`;

    let bodyHtml = '';
    try {
      const md = await fetch(mdPath).then(r => r.text());
      bodyHtml = (await renderMarkdown(md)).bodyHtml;

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
    renderMath($('.section.privacy-page', app));
  }

  function renderNotFound() {
    setPageMeta('404 — Page Not Found', '');
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
    $('#themeToggle')?.addEventListener('click', async () => {
      setTheme(state.theme === 'dark' ? 'light' : 'dark');
      onRouteChange();
    });

    // Load translations + data in parallel
    await Promise.all([loadI18n(), loadData()]);

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

    // Intercept in-page anchor clicks (e.g. citation links) to prevent SPA routing
    document.addEventListener('click', e => {
      const link = e.target.closest('a.cite-inline');
      if (!link) return;
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const target = document.getElementById(href.slice(1));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // SPA click interceptor: intercept internal path links, use pushState
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//')) return;
      e.preventDefault();
      navigate(href);
    });

    // Route changes via browser back/forward
    window.addEventListener('popstate', () => {
      onRouteChange();

      mobileNav?.classList.remove('open');
      mobileNav?.setAttribute('aria-hidden', 'true');
      navToggle?.setAttribute('aria-expanded', 'false');

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

    // Copy-to-clipboard for code blocks (event delegation, CSP-safe)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.code-block-copy');
      if (!btn) return;
      const codeEl = btn.closest('.code-block')?.querySelector('code');
      if (!codeEl) return;
      navigator.clipboard.writeText(codeEl.innerText).then(() => {
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 1800);
      });
    });

    // Post card click/keyboard (event delegation, CSP-safe)
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.post-flat-item[role="link"]');
      if (!card || e.target.closest('a')) return;
      const link = card.querySelector('.post-flat-link');
      if (link) navigate(link.getAttribute('href'));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const card = e.target.closest('.post-flat-item[role="link"]');
      if (!card) return;
      const link = card.querySelector('.post-flat-link');
      if (link) navigate(link.getAttribute('href'));
    });

    // Initial render
    onRouteChange();
  }

  boot();
})();