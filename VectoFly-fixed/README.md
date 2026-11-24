# Vectofly

A responsive, dependency-free directory of 64 online developer tools. The site uses plain HTML, CSS, and JavaScript and can be hosted on any static hosting provider that serves directory `index.html` files (for example, `/tools/json-formatter/`).

## Site files

- `index.html`, `styles.css`, `app.js`, and `tools-data.js` power the responsive tool directory and browser-based utilities.
- `tools/<slug>/index.html` provides an individual, search-friendly landing page for every tool, including its own title, description, canonical URL, FAQ content, and structured data.
- `about/`, `privacy-policy/`, `terms-and-conditions/`, and `contact/` contain the information pages.
- `robots.txt` and `sitemap.xml` provide crawler discovery.

The pages assume the production origin is `https://vectofly.com`. Update canonical URLs and the sitemap if the production domain changes.
