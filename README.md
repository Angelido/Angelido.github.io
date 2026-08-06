# Angelo Nardone — Personal Website

[![Website](https://img.shields.io/website?url=https%3A%2F%2Fangelido.github.io&style=flat-square&label=website)](https://angelido.github.io/)
[![Last commit](https://img.shields.io/github/last-commit/Angelido/Angelido.github.io?style=flat-square&label=last%20update)](https://github.com/Angelido/Angelido.github.io/commits/main)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Hosted on GitHub Pages](https://img.shields.io/badge/hosted%20on-GitHub%20Pages-222?style=flat-square&logo=github)](https://angelido.github.io/)
[![Repo size](https://img.shields.io/github/repo-size/Angelido/Angelido.github.io?style=flat-square&label=repo%20size)](https://github.com/Angelido/Angelido.github.io)
[![Map: Leaflet](https://img.shields.io/badge/map-Leaflet-199900?style=flat-square&logo=leaflet)](https://leafletjs.com/)

> A lightweight, static personal website built with **HTML**, **CSS**, and **vanilla JavaScript** — designed to present my academic profile, research, and writing in one place.

### 🌐 Live Website

<a href="https://angelido.github.io/" target="_blank" rel="noopener">
  🔗 angelido.github.io
</a>

## 👤 About

This site serves as my digital home base: a single-page application that brings together my **academic profile**, **research interests**, **publications**, **posts**, an interactive **academic map**, and personal background.

The design philosophy is *minimalism with purpose* — fast to load, easy to navigate, and focused entirely on content.

## 🛠️ Built With

- **HTML5** — semantic, accessible markup  
- **CSS3** — custom styling, no frameworks  
- **Vanilla JavaScript** — lightweight interactivity, minimal dependencies  
- **Leaflet.js** — interactive academic map (via CDN)  
- **marked.js** — Markdown rendering  
- **KaTeX** — math typesetting  
- **Shiki** — syntax highlighting  

## 📁 Project Structure

```
/
├── index.html              # Main entry point
├── 404.html                # GitHub Pages SPA redirect
├── styles.css              # Stylesheet
├── main.js                 # JavaScript logic (SPA router, rendering)
│
├── data/                   # 📊 JSON files with site content
│   ├── posts.en.json       #    Post metadata (English)
│   ├── posts.it.json       #    Post metadata (Italian)
│   ├── publications.json   #    Research publications
│   ├── places.json         #    Academic map locations
│   ├── projects.json       #    Academic projects & interests
│   └── ...
│
├── i18n/                   # 🌐 Internationalization & section labels
│   ├── ui.en.json          #    English strings (titles, headings, UI)
│   └── ui.it.json          #    Italian strings (titles, headings, UI)
│
├── posts/                  # ✍️ Blog & writing
│   ├── post-title.en.md    #    Markdown files, one per post per language
│   ├── post-title.it.md
│   └── ...
│
├── robots.txt              # 🤖 Crawler directives
├── sitemap.xml             # 🗺️ Sitemap for search engine indexing
│
└── assets/                 # 🖼️ Images, documents, CV, etc.
```

## 🚀 Deployment

The site is hosted on **GitHub Pages** and automatically re-deployed on every push to `main`.

```
main branch → GitHub Pages → angelido.github.io
```

Routing uses the **History API** (`/posts/id` instead of `#/posts/id`). Direct URL access and page refreshes are handled via `404.html`, which saves the requested path to `sessionStorage` and redirects to `/`, where the SPA router restores the correct view.

## License

The source code is licensed under the MIT License.

All personal content (including CV, texts, and publications) is © Angelo Nardone and may not be reused without permission.
