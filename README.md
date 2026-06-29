# Blue Modern Advisory — static site

A clean, static, multi-page reproduction of bluemodernadvisory.com. The original is a
React/Vite single-page app; this rebuild captures the exact rendered DOM of each route,
reuses the original stylesheet verbatim, and replaces the React runtime with a small
vanilla-JS file for the interactions.

## Run it

```bash
cd site
python3 -m http.server 8080
# open http://localhost:8080/index.html
```

Any static host works (Vercel, Netlify, GitHub Pages, S3) — there is no build step.

## Pages

| File                | Route on the original                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| `index.html`        | `/` — hero, trusted-by marquee, what-we-build, pricing, use cases, FAQ |
| `capabilities.html` | `/capabilities` — tool hub, 7-row capability matrix, delivery model    |
| `about.html`        | `/about` — team, practice areas, final CTA                             |
| `get-started.html`  | `/get-started` — sign-up form                                          |

## Structure

```
site/
  index.html  capabilities.html  about.html  get-started.html
  css/styles.css      # the original compiled stylesheet, unmodified except a small
                      # appended block for the mobile menu + scroll-reveal classes
  js/app.js           # mobile nav, FAQ + use-case accordions, scroll reveal, form handlers
  assets/             # logos, reviewer + team photos, tool logos (fetched from the live site)
  images/             # hero background + favicon referenced by the original CSS
```

## Notes

- The serif is Newsreader, the sans is Inter (loaded from Google Fonts).
- Scroll-reveal is progressive enhancement: a 1.4s fail-safe and `prefers-reduced-motion`
  guarantee no content ever stays hidden.
- The use-case accordion detail copy was recovered from the original JS bundle.
- Internal links are rewritten to the static filenames; `Sign In` / `Login` point at
  `get-started.html` since the original auth pages were not part of this copy.

Built with D1 Vibe Coding
